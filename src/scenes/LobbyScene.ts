import Phaser from 'phaser';
import { COLORS } from '../config';
import { BACKGROUNDS } from '../data/backgrounds';
import { DOGS, findDog } from '../data/dogs';
import { findStage } from '../data/regions';
import { RESOURCE_LABELS, type Resources } from '../data/resources';
import {
  collectExpedition,
  expeditionReward,
  isComplete,
  progress,
  remainingMs,
} from '../logic/expedition';
import { formatAmount, formatCountdown } from '../logic/format';
import type { Rect } from '../logic/layout';
import { newStoriesAfter, nextBackground, unlockedBackgrounds } from '../logic/progress';
import type { Expedition } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { DogSprite } from './components/DogSprite';
import { makeTapArea } from './components/hitArea';
import { ResultPanel } from './components/ResultPanel';
import { Scenery } from './components/Scenery';
import { SettingsPanel } from './components/SettingsPanel';
import { SideButton } from './components/SideButton';
import { addText, patchDebug, resetDebug, viewOf } from './ui';

/** 主頁狗狗換動作的間隔 */
const ACTION_MS = 3000;
/** 畫面刷新間隔（只刷新顯示，計時以時間戳為準） */
const REFRESH_MS = 250;

interface LobbyLayout {
  account: Rect;
  resources: Rect[];
  dog: { x: number; y: number; scale: number };
  story: Rect;
  team: Rect;
  expedition: Rect;
  background: Rect;
  status: Rect;
}

/** 直式／橫式的主頁版面 */
function lobbyLayout(w: number, h: number, landscape: boolean): LobbyLayout {
  if (landscape) {
    const bs = 86;
    const bx = w - bs - 16;
    return {
      account: { x: 12, y: 10, width: 176, height: 56 },
      resources: [
        { x: w - 340, y: 14, width: 158, height: 32 },
        { x: w - 172, y: 14, width: 158, height: 32 },
      ],
      dog: { x: w * 0.5, y: h - 52, scale: 1.2 },
      story: { x: bx, y: 62, width: bs, height: bs },
      team: { x: bx, y: 62 + bs + 10, width: bs, height: bs },
      expedition: {
        x: bx - 6,
        y: 62 + (bs + 10) * 2,
        width: bs + 6,
        height: h - 62 - (bs + 10) * 2 - 12,
      },
      background: { x: 16, y: h - 128, width: 64, height: 56 },
      status: { x: 16, y: h - 64, width: 272, height: 52 },
    };
  }
  const bs = 84;
  const bx = w - bs - 14;
  return {
    account: { x: 12, y: 12, width: 176, height: 56 },
    resources: [
      { x: w - 170, y: 14, width: 158, height: 30 },
      { x: w - 170, y: 50, width: 158, height: 30 },
    ],
    dog: { x: w * 0.4, y: h * 0.8, scale: 1.45 },
    story: { x: bx, y: h * 0.3, width: bs, height: bs },
    team: { x: bx, y: h * 0.3 + bs + 14, width: bs, height: bs },
    expedition: { x: bx - 8, y: h * 0.3 + (bs + 14) * 2, width: bs + 8, height: bs + 24 },
    background: { x: 14, y: h * 0.3, width: 64, height: 56 },
    status: { x: 16, y: h - 84, width: w - 32, height: 64 },
  };
}

/**
 * 主頁面（放置型遊戲大廳）：
 * - 會動的背景（依進度／活動取得，可切換）
 * - 前景是玩家選的狗狗，會輪流換動作；點牠會開心跳一下
 * - 左上：帳號與設定；右上：資源
 * - 右側：劇情、組隊、出征
 * - 下方：出征狀態與收成
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
  private storyButton!: SideButton;
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
    this.drawSideButtons();
    this.drawStatus();

    patchDebug({
      lobby: {
        dogId: getState().lobbyDogId,
        dogAction: this.dog.action,
        background: getState().backgroundId,
        buttons: {
          account: this.layout.account,
          story: this.layout.story,
          team: this.layout.team,
          expedition: this.layout.expedition,
          background: this.layout.background,
        },
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
      landscape ? 0.6 : 0.62,
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
    addText(this, x, y + 10, `${d.name}\u3000Lv.${d.level}`, 17, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke(COLORS.ink, 4);

    // 點狗狗：開心跳一下
    const hit = this.add
      .zone(x - 90 * scale, y - 150 * scale, 180 * scale, 160 * scale)
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

  private drawAccount(): void {
    const r = this.layout.account;
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    g.fillStyle(0x3b2a1a, 0.72);
    g.fillRoundedRect(0, 0, r.width, r.height, 28);
    const d = findDog(getState().lobbyDogId) ?? DOGS[0];
    g.fillStyle(0xfff6e8, 1);
    g.fillCircle(28, r.height / 2, 24);
    drawDogHead(g, 28, r.height / 2 + 3, 15, d.color, d.accent);
    c.add([
      g,
      addText(this, 60, 10, '城主\u3000Lv.1', 16, COLORS.barText, true),
      addText(this, 60, 32, '⚙ 帳號與設定', 13, '#f2d9b8'),
    ]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', () => this.openSettings());
  }

  private drawResources(): void {
    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    keys.forEach((key, i) => {
      const r = this.layout.resources[i];
      const g = this.add.graphics();
      g.fillStyle(0x3b2a1a, 0.72);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, r.height / 2);
      const ix = r.x + 18;
      const iy = r.y + r.height / 2;
      if (key === 'food') {
        g.fillStyle(0xf2c14e, 1);
        g.fillEllipse(ix, iy, 13, 20);
      } else {
        g.fillStyle(0xf5f0e6, 1);
        g.fillCircle(ix, iy, 10);
        g.lineStyle(2, 0xc9b79c, 1);
        g.strokeCircle(ix, iy, 10);
      }
      this.resourceTexts[key] = addText(this, r.x + 34, iy, '', 15, COLORS.barText, true)
        .setOrigin(0, 0.5)
        .setName(`resource-${key}`);
    });
  }

  private drawSideButtons(): void {
    const L = this.layout;
    this.storyButton = new SideButton(this, L.story, '劇情', 'story', 0x7a5ea8, () =>
      this.scene.start('StoryScene', { mode: 'list' }),
    );
    new SideButton(this, L.team, '組隊', 'team', 0x3f7fa8, () => this.scene.start('TeamScene'));
    new SideButton(this, L.expedition, '出征', 'battle', 0xc0392b, () =>
      this.scene.start('CampaignScene'),
    );
    new SideButton(this, L.background, '背景', 'background', 0x4f8a3c, () =>
      this.switchBackground(),
    );
  }

  private drawStatus(): void {
    const r = this.layout.status;
    this.progressBar = this.add.graphics();
    this.statusButton = new Button(this, r, '', () => this.onStatus(), 18);
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
    this.storyButton.setDot(!state.seenStories.includes('prologue'));

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
      this.progressBar.fillRoundedRect(r.x, r.y - 10, r.width, 6, 3);
      if (p > 0) {
        this.progressBar.fillStyle(p >= 1 ? COLORS.harvest : COLORS.button, 1);
        this.progressBar.fillRoundedRect(r.x, r.y - 10, Math.max(6, r.width * p), 6, 3);
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
}
