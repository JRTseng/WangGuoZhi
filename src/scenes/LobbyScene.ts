import Phaser from 'phaser';
import { COLORS } from '../config';
import { BACKGROUNDS } from '../data/backgrounds';
import { DOGS, findDog } from '../data/dogs';
import { REGIONS, findStage } from '../data/regions';
import { RESOURCE_LABELS, type Resources } from '../data/resources';
import { STORIES } from '../data/stories';
import {
  collectExpedition,
  expeditionReward,
  isComplete,
  progress,
  remainingMs,
} from '../logic/expedition';
import { formatAmount, formatCountdown } from '../logic/format';
import type { Rect } from '../logic/layout';
import { lobbyLayout, tappableRects, type LobbyLayout } from '../logic/lobbyLayout';
import {
  currentChapterIndex,
  isStoryUnlocked,
  newStoriesAfter,
  nextBackground,
  stageNodeState,
  unlockedBackgrounds,
} from '../logic/progress';
import { teamPower } from '../logic/team';
import type { Expedition } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { DogSprite } from './components/DogSprite';
import { makeTapArea } from './components/hitArea';
import { drawLobbyIcon, drawPanel, drawPaw } from './components/lobbyIcons';
import { LOBBY, LobbyCard, MenuItem, RoundShortcut } from './components/LobbyWidgets';
import { ResultPanel } from './components/ResultPanel';
import { Scenery } from './components/Scenery';
import { SettingsPanel } from './components/SettingsPanel';
import { addText, patchDebug, resetDebug, viewOf } from './ui';

/** 主頁狗狗換動作的間隔 */
const ACTION_MS = 3000;
/** 畫面刷新間隔（只刷新顯示，計時以時間戳為準） */
const REFRESH_MS = 250;
/** 還沒做的功能 */
const COMING_SOON = '即將開放';

/**
 * 主頁面（放置型遊戲大廳，版面參考常見放置手遊）：
 * - 會動的背景（依進度／活動取得，可切換），中間是玩家選的狗狗，會輪流換動作
 * - 左上：頭像、城主等級、總戰力（點了開帳號與設定）
 * - 左側：功能選單（武將／任務／倉庫／背景）
 * - 右上：資源列、信箱，下方一排召募／商城／獎勵
 * - 右側（直式為下方）：出征大卡（含出征倒數與收成）、劇情章節卡、活動與訓練小卡
 */
export class LobbyScene extends Phaser.Scene {
  private layout!: LobbyLayout;
  private scenery: Scenery | null = null;
  private dog!: DogSprite;
  private statusButton!: Button;
  private progressBar!: Phaser.GameObjects.Graphics;
  private resourceTexts: Partial<Record<keyof Resources, Phaser.GameObjects.Text>> = {};
  private settings: SettingsPanel | null = null;
  private result: ResultPanel | null = null;
  private storyCard!: LobbyCard;
  private expeditionCard!: LobbyCard;
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('LobbyScene');
  }

  create(): void {
    const { w, h, landscape } = viewOf(this);
    this.layout = lobbyLayout(w, h, landscape);
    this.settings = null;
    this.result = null;
    this.toast = null;
    this.resourceTexts = {};
    resetDebug(this);

    this.drawBackground();
    this.drawDog();
    this.drawAccount();
    this.drawResources();
    this.drawShortcuts();
    this.drawMenu();
    this.drawCards();
    this.drawStatus();

    const buttons: Partial<Record<string, Rect>> = { ...tappableRects(this.layout) };
    delete buttons.status;
    patchDebug({
      lobby: {
        dogId: getState().lobbyDogId,
        dogAction: this.dog.action,
        background: getState().backgroundId,
        buttons: buttons as NonNullable<WgzDebugState['lobby']>['buttons'],
      },
      result: null,
    });

    this.refresh();
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
  }

  // ---- 畫面 ----

  private drawBackground(): void {
    this.scenery?.destroy();
    const { w, h, landscape } = viewOf(this);
    const st = getState();
    this.scenery = new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      st.backgroundId,
      st.settings.quality,
      landscape ? 0.6 : 0.5,
    );
    this.scenery.setDepth(-10);
  }

  private drawDog(): void {
    const d = findDog(getState().lobbyDogId) ?? DOGS[0];
    const { x, y, scale } = this.layout.dog;
    this.dog = new DogSprite(this, x, y, { color: d.color, accent: d.accent });
    this.dog.setScale(scale);
    this.dog.onActionChange = (a) =>
      patchDebug({ lobby: { ...window.__WGZ__!.lobby!, dogAction: a } });
    this.dog.startCycle(ACTION_MS);

    // 名牌
    addText(this, x, y + 8, `${d.name}\u3000Lv.${d.level}`, 16, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke(COLORS.ink, 4);

    // 點狗狗：開心跳一下
    const hit = this.add
      .zone(x - 90 * scale, y - 150 * scale, 180 * scale, 150 * scale)
      .setOrigin(0, 0);
    hit.setInteractive({ cursor: 'pointer' }).on('pointerup', () => {
      this.dog.play('hop');
      const heart = addText(
        this,
        x + 40 * scale,
        y - 150 * scale,
        '♥',
        30,
        '#e0452b',
        true,
      ).setOrigin(0.5);
      this.tweens.add({
        targets: heart,
        y: heart.y - 40,
        alpha: 0,
        duration: 900,
        onComplete: () => heart.destroy(),
      });
    });
  }

  /** 左上：大頭像（金框）+ 城主等級 + 總戰力 */
  private drawAccount(): void {
    const r = this.layout.account;
    const st = getState();
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    const R = r.height / 2 - 3;
    const cx = R + 3;
    const cy = r.height / 2;
    // 文字底條（從頭像右側延伸出去，右端淡出）
    drawPanel(g, cx, 8, r.width - cx, r.height - 16, 14, LOBBY.panel, 0.85);
    drawPaw(g, r.width - 36, r.height - 22, 5, LOBBY.gold, 0.45);
    // 頭像
    const d = findDog(st.lobbyDogId) ?? DOGS[0];
    g.fillStyle(0xfff6e8, 1);
    g.fillCircle(cx, cy, R);
    drawDogHead(g, cx, cy + 4, R * 0.62, d.color, d.accent);
    g.lineStyle(4, LOBBY.gold, 1);
    g.strokeCircle(cx, cy, R);
    g.lineStyle(1.5, 0x8a5a1a, 1);
    g.strokeCircle(cx, cy, R + 2);
    const tx = cx + R + 10;
    c.add([
      g,
      addText(this, tx, 12, 'Lv.1', 17, LOBBY.goldText, true),
      addText(this, tx + 44, 13, '城主', 15, LOBBY.text, true),
      addText(this, tx, 36, `總戰力 ${formatAmount(teamPower(st.team))}`, 15, LOBBY.text, true),
      // 設定小齒輪
      addText(this, r.width - 8, r.height - 10, '⚙', 15, LOBBY.goldText).setOrigin(1, 1),
    ]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', () => this.openSettings());
  }

  /** 右上資源列（各帶「＋」）與信箱 */
  private drawResources(): void {
    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    keys.forEach((key, i) => {
      const r = this.layout.resources[i];
      const g = this.add.graphics();
      drawPanel(g, r.x, r.y, r.width, r.height, r.height / 2, LOBBY.panel, 0.85);
      g.fillStyle(LOBBY.gold, 1);
      g.fillCircle(r.x + r.width - 15, r.y + r.height / 2, r.height / 2 - 6);
      const ix = r.x + 16;
      const iy = r.y + r.height / 2;
      if (key === 'food') {
        g.fillStyle(0xf2c14e, 1);
        g.fillEllipse(ix, iy, 12, 18);
      } else {
        drawLobbyIcon(g, 'train', ix, iy, 9, 0xf5f0e6);
      }
      this.resourceTexts[key] = addText(this, r.x + 30, iy, '', 14, LOBBY.text, true)
        .setOrigin(0, 0.5)
        .setName(`resource-${key}`);
      // ＋：之後接商城
      const plus = addText(this, r.x + r.width - 15, iy, '+', 16, '#5a3a1c', true).setOrigin(0.5);
      plus
        .setInteractive({ cursor: 'pointer' })
        .on('pointerup', () => this.showToast(`商城${COMING_SOON}`));
    });

    new RoundShortcut(this, this.layout.mail, '信箱', 'mail', 0x6b4a2e, () =>
      this.showToast(`信箱${COMING_SOON}`),
    );
  }

  /** 右上第二列：召募／商城／獎勵 */
  private drawShortcuts(): void {
    const S = this.layout.shortcuts;
    new RoundShortcut(this, S.recruit, '召募', 'recruit', 0xa83a2b, () =>
      this.showToast(`召募${COMING_SOON}（抽卡 T007）`),
    ).setDot(true);
    new RoundShortcut(this, S.shop, '商城', 'shop', 0x3f7fa8, () =>
      this.showToast(`商城${COMING_SOON}`),
    );
    new RoundShortcut(this, S.reward, '獎勵', 'reward', 0x4f8a3c, () =>
      this.showToast(`獎勵中心${COMING_SOON}`),
    );
  }

  /** 左側功能選單 */
  private drawMenu(): void {
    const M = this.layout.menu;
    const compact = this.layout.menuCompact;
    new MenuItem(this, M.team, '武將', 'team', compact, () => this.scene.start('TeamScene'));
    new MenuItem(
      this,
      M.quest,
      '任務',
      'quest',
      compact,
      () => this.showToast(`任務${COMING_SOON}（T011）`),
      compact ? undefined : COMING_SOON,
    );
    new MenuItem(
      this,
      M.bag,
      '倉庫',
      'bag',
      compact,
      () => this.showToast(`倉庫${COMING_SOON}`),
      compact ? undefined : COMING_SOON,
    );
    new MenuItem(this, M.background, '背景', 'background', compact, () => this.switchBackground());
  }

  /** 右側大卡片 */
  private drawCards(): void {
    const L = this.layout;
    const st = getState();
    const leader = findDog(st.team[0] ?? st.lobbyDogId) ?? DOGS[0];
    this.expeditionCard = new LobbyCard(
      this,
      L.expedition,
      {
        title: '出征',
        icon: 'battle',
        color: 0xb5452b,
        subtitle: '',
        frame: L.expeditionCard,
        decorate: (g, w, h) => {
          // 右側淡淡的隊長頭像
          g.fillStyle(0xffffff, 0.12);
          g.fillCircle(w - h * 0.34, h * 0.36, h * 0.3);
          drawDogHead(g, w - h * 0.34, h * 0.39, h * 0.19, leader.color, leader.accent);
        },
      },
      () => this.scene.start('CampaignScene'),
    );

    const unlocked = STORIES.filter((s) => isStoryUnlocked(st, s)).length;
    this.storyCard = new LobbyCard(
      this,
      L.story,
      {
        title: '劇情',
        icon: 'story',
        color: 0x6a4f98,
        subtitle: `第 ${REGIONS[currentChapterIndex(st)].chapter} 章 ${REGIONS[currentChapterIndex(st)].name}`,
        corner: `${unlocked} / ${STORIES.length}`,
        decorate: (g, w, h) => {
          g.fillStyle(0xffffff, 0.1);
          g.fillTriangle(w * 0.45, h, w * 0.75, h * 0.25, w, h);
          g.fillTriangle(w * 0.62, h, w * 0.88, h * 0.4, w, h * 0.7);
        },
      },
      () => this.scene.start('StoryScene', { mode: 'list' }),
    );

    const faint =
      (icon: 'event' | 'train') => (g: Phaser.GameObjects.Graphics, w: number, h: number) => {
        const ic = this.add.graphics();
        g.fillStyle(0xffffff, 0.1);
        g.fillCircle(w * 0.72, h * 0.58, Math.min(w, h) * 0.34);
        ic.destroy();
        drawLobbyIcon(g, icon, w * 0.72, h * 0.58, Math.min(w, h) * 0.2, 0xfff6e8);
      };
    new LobbyCard(
      this,
      L.miniCards.event,
      { title: '活動', icon: 'event', color: 0xc7832b, tag: COMING_SOON, decorate: faint('event') },
      () => this.showToast(`活動${COMING_SOON}`),
    );
    new LobbyCard(
      this,
      L.miniCards.train,
      { title: '訓練', icon: 'train', color: 0x2f7a74, tag: COMING_SOON, decorate: faint('train') },
      () => this.showToast(`訓練${COMING_SOON}（升級 T005）`),
    );
  }

  /** 出征卡底部的狀態條（倒數／收成）與進度條 */
  private drawStatus(): void {
    const r = this.layout.status;
    this.progressBar = this.add.graphics();
    this.statusButton = new Button(this, r, '', () => this.onStatus(), 15);
  }

  // ---- 互動 ----

  private switchBackground(): void {
    const before = getState();
    const after = nextBackground(before);
    const owned = unlockedBackgrounds(before).length;
    if (after === before) {
      this.showToast(owned <= 1 ? '過關或參加活動可以取得更多背景' : '');
      return;
    }
    setState(after);
    this.drawBackground();
    const name = BACKGROUNDS.find((b) => b.id === after.backgroundId)?.name ?? '';
    this.showToast(`背景：${name}`);
    patchDebug({ lobby: { ...window.__WGZ__!.lobby!, background: after.backgroundId } });
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    if (!text) return;
    const { w, h } = viewOf(this);
    this.toast = addText(this, w / 2, h * 0.18, text, 16, '#ffffff', true)
      .setOrigin(0.5)
      .setBackgroundColor('#3b2a1acc')
      .setPadding(12, 6, 12, 6)
      .setDepth(90);
    const t = this.toast;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => t.destroy(),
    });
  }

  private openSettings(): void {
    if (this.settings || this.result) return;
    this.settings = new SettingsPanel(
      this,
      (qualityChanged) => {
        if (qualityChanged) this.drawBackground();
        this.refresh();
      },
      () => {
        this.settings?.destroy();
        this.settings = null;
      },
    );
  }

  /** 主頁要顯示的那一筆出征：先找可收成的，否則取最快結束的 */
  private focusExpedition(now: number): Expedition | undefined {
    const list = getState().expeditions;
    return list.find((e) => isComplete(e, now)) ?? [...list].sort((a, b) => a.endsAt - b.endsAt)[0];
  }

  private onStatus(): void {
    if (this.result || this.settings) return;
    const now = Date.now();
    const exp = this.focusExpedition(now);
    if (!exp) {
      this.scene.start('CampaignScene');
      return;
    }
    if (!isComplete(exp, now)) return;
    const before = getState();
    const reward = expeditionReward(exp);
    const r = collectExpedition(before, exp.id, now);
    if (!r.ok) return;
    setState(r.state);
    this.refresh();

    const extra: string[] = [];
    if (!before.cleared.includes(exp.stageId)) extra.push('通過關卡！下一關已開放');
    const newBgs = unlockedBackgrounds(r.state).filter(
      (b) => !unlockedBackgrounds(before).includes(b),
    );
    for (const b of newBgs)
      extra.push(`獲得主頁背景「${BACKGROUNDS.find((x) => x.id === b)?.name}」`);

    const stories = newStoriesAfter(r.state, exp.stageId);
    this.result = new ResultPanel(
      this,
      findStage(exp.stageId)?.name ?? '',
      reward,
      () => {
        this.result?.destroy();
        this.result = null;
        patchDebug({ result: null });
        if (stories.length)
          this.scene.start('StoryScene', { mode: 'play', storyId: stories[0].id });
      },
      extra,
    );
    patchDebug({ result: { ...reward } });
  }

  /** 依目前狀態與時間更新畫面（資源、出征狀態、劇情紅點） */
  private refresh(): void {
    const state = getState();
    const now = Date.now();

    for (const key of Object.keys(this.resourceTexts) as (keyof Resources)[]) {
      const text = `${RESOURCE_LABELS[key]} ${formatAmount(state.resources[key])}`;
      const t = this.resourceTexts[key]!;
      if (t.text !== text) t.setText(text);
    }
    this.storyCard.setDot(
      STORIES.some((x) => isStoryUnlocked(state, x) && !state.seenStories.includes(x.id)),
    );
    this.expeditionCard.setSubtitle(this.nextStageLabel());

    const r = this.layout.status;
    const exp = this.focusExpedition(now);
    this.progressBar.clear();
    if (!exp) {
      this.statusButton.setText('隊伍待命中・點我選關卡出征').setColor(0x6b4a2e).setEnabled(true);
    } else {
      const stage = findStage(exp.stageId);
      if (isComplete(exp, now)) {
        this.statusButton
          .setText(`收成！ ${stage?.name ?? ''}`)
          .setColor(COLORS.harvest)
          .setEnabled(true);
      } else {
        this.statusButton
          .setText(`${stage?.name ?? ''} 出征中 ${formatCountdown(remainingMs(exp, now))}`)
          .setEnabled(false);
      }
      const p = progress(exp, now);
      this.progressBar.fillStyle(COLORS.cardBorder, 1);
      this.progressBar.fillRoundedRect(r.x, r.y - 7, r.width, 4, 2);
      if (p > 0) {
        this.progressBar.fillStyle(p >= 1 ? COLORS.harvest : LOBBY.gold, 1);
        this.progressBar.fillRoundedRect(r.x, r.y - 7, Math.max(4, r.width * p), 4, 2);
      }
    }

    patchDebug({
      resources: { ...state.resources },
      status: { label: this.statusButton.text, enabled: this.statusButton.isEnabled, ...r },
      expedition: exp
        ? {
            id: exp.id,
            stageId: exp.stageId,
            dogIds: [...exp.dogIds],
            remainingMs: remainingMs(exp, now),
            complete: isComplete(exp, now),
          }
        : null,
    });
  }

  /** 出征卡副標：目前章節與下一個可打的關卡 */
  private nextStageLabel(): string {
    const st = getState();
    const region = REGIONS[currentChapterIndex(st)];
    const next = region.stages.find((x) => stageNodeState(st, x.id) === 'open');
    return `第 ${region.chapter} 章・${next ? `下一關 ${next.name}` : `${region.name}已全破`}`;
  }
}
