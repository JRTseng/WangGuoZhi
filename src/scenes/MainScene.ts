import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import { findStage } from '../data/regions';
import { RESOURCE_LABELS, type Resources } from '../data/resources';
import {
  busyDogIds,
  collectExpedition,
  expeditionReward,
  isComplete,
  progress,
  remainingMs,
} from '../logic/expedition';
import { formatAmount, formatCountdown } from '../logic/format';
import { layoutList } from '../logic/layout';
import type { Expedition } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogCard } from './components/DogCard';
import { DogInfoPanel } from './components/DogInfoPanel';
import { ResultPanel } from './components/ResultPanel';

const BAR_HEIGHT = 64;
const BUTTON = { x: 24, y: GAME_HEIGHT - 112, width: GAME_WIDTH - 48, height: 64 };
/** 按鈕上方的出征狀態列 */
const STATUS_Y = BUTTON.y - 22;
const PROGRESS = { x: BUTTON.x, y: BUTTON.y - 8, width: BUTTON.width, height: 6 };
/** 畫面刷新間隔（只刷新顯示，計時以時間戳為準） */
const REFRESH_MS = 250;

export class MainScene extends Phaser.Scene {
  private panel: Phaser.GameObjects.Container | null = null;
  private cards: DogCard[] = [];
  private button!: Button;
  private statusText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private resourceTexts: Partial<Record<keyof Resources, Phaser.GameObjects.Text>> = {};

  constructor() {
    super('MainScene');
  }

  create(): void {
    this.panel = null;
    this.resourceTexts = {};
    this.drawResourceBar();

    this.add
      .text(GAME_WIDTH / 2, BAR_HEIGHT + 30, '我的武將', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    const listTop = BAR_HEIGHT + 56;
    const rects = layoutList(DOGS.length, {
      area: { x: 16, y: listTop, width: GAME_WIDTH - 32, height: STATUS_Y - 20 - listTop },
      gap: 12,
      maxCardHeight: 108,
    });
    this.cards = DOGS.map((dog, i) => new DogCard(this, dog, rects[i], (d) => this.togglePanel(d)));

    this.statusText = this.add
      .text(GAME_WIDTH / 2, STATUS_Y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5);
    this.progressBar = this.add.graphics();
    this.button = new Button(this, BUTTON, '出征', () => this.onButton());

    window.__WGZ__ = {
      ...window.__WGZ__,
      scene: 'MainScene',
      version: window.__WGZ__?.version ?? '',
      cards: this.cards.map((c) => ({
        id: c.dog.id,
        name: c.dog.name,
        power: c.power,
        busy: false,
        ...c.rect,
      })),
      panel: null,
      result: null,
    };

    this.refresh();
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
  }

  /** 依目前狀態與時間更新畫面（資源、忙碌標籤、按鈕、倒數） */
  private refresh(): void {
    const state = getState();
    const now = Date.now();

    for (const key of Object.keys(this.resourceTexts) as (keyof Resources)[]) {
      const text = `${RESOURCE_LABELS[key]} ${formatAmount(state.resources[key])}`;
      const t = this.resourceTexts[key]!;
      if (t.text !== text) t.setText(text);
    }

    const busy = busyDogIds(state);
    for (const c of this.cards) c.setStatus({ busy: busy.has(c.dog.id) });

    const exp = this.focusExpedition(now);
    this.progressBar.clear();
    if (!exp) {
      this.button.setText('出征').setColor(COLORS.button).setEnabled(true);
      this.statusText.setText('選 3 隻武將，出征落葉坡');
    } else {
      const stage = findStage(exp.stageId);
      const names = exp.dogIds.map((id) => DOGS.find((d) => d.id === id)?.name ?? id).join('、');
      this.statusText.setText(`${stage?.name ?? ''}｜${names}`);
      if (isComplete(exp, now)) {
        this.button.setText('收成！').setColor(COLORS.harvest).setEnabled(true);
      } else {
        this.button.setText(`出征中 ${formatCountdown(remainingMs(exp, now))}`).setEnabled(false);
      }
      const p = progress(exp, now);
      this.progressBar.fillStyle(COLORS.cardBorder, 1);
      this.progressBar.fillRoundedRect(PROGRESS.x, PROGRESS.y, PROGRESS.width, PROGRESS.height, 3);
      if (p > 0) {
        this.progressBar.fillStyle(p >= 1 ? COLORS.harvest : COLORS.button, 1);
        this.progressBar.fillRoundedRect(
          PROGRESS.x,
          PROGRESS.y,
          Math.max(PROGRESS.height, PROGRESS.width * p),
          PROGRESS.height,
          3,
        );
      }
    }

    const dbg = window.__WGZ__;
    if (dbg) {
      dbg.resources = { ...state.resources };
      dbg.cards = dbg.cards?.map((c) => ({ ...c, busy: busy.has(c.id) }));
      dbg.expeditionButton = {
        label: this.button.text,
        enabled: this.button.isEnabled,
        ...BUTTON,
      };
      dbg.expedition = exp
        ? {
            id: exp.id,
            stageId: exp.stageId,
            dogIds: [...exp.dogIds],
            remainingMs: remainingMs(exp, now),
            complete: isComplete(exp, now),
          }
        : null;
    }
  }

  /** 主畫面要顯示的那一筆出征：先找可收成的，否則取最快結束的 */
  private focusExpedition(now: number): Expedition | undefined {
    const list = getState().expeditions;
    return list.find((e) => isComplete(e, now)) ?? [...list].sort((a, b) => a.endsAt - b.endsAt)[0];
  }

  private onButton(): void {
    if (this.panel) return;
    const now = Date.now();
    const exp = this.focusExpedition(now);
    if (!exp) {
      this.scene.start('ExpeditionScene');
      return;
    }
    if (!isComplete(exp, now)) return;
    const reward = expeditionReward(exp);
    const r = collectExpedition(getState(), exp.id, now);
    if (!r.ok) return;
    setState(r.state);
    this.refresh();
    const stageName = findStage(exp.stageId)?.name ?? '';
    this.panel = new ResultPanel(this, stageName, reward, () => this.closePanel());
    if (window.__WGZ__) window.__WGZ__.result = { ...reward };
  }

  private drawResourceBar(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, BAR_HEIGHT, COLORS.bar).setOrigin(0, 0);
    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    const slot = GAME_WIDTH / keys.length;
    keys.forEach((key, i) => {
      const cx = slot * i + slot / 2;
      const icon = this.add.graphics();
      if (key === 'food') {
        // 糧草：一束麥（橢圓）
        icon.fillStyle(0xf2c14e, 1);
        icon.fillEllipse(cx - 58, BAR_HEIGHT / 2, 16, 26);
      } else {
        // 骨頭幣：圓幣
        icon.fillStyle(0xf5f0e6, 1);
        icon.fillCircle(cx - 58, BAR_HEIGHT / 2, 12);
        icon.lineStyle(2, 0xc9b79c, 1);
        icon.strokeCircle(cx - 58, BAR_HEIGHT / 2, 12);
      }
      this.resourceTexts[key] = this.add
        .text(cx - 40, BAR_HEIGHT / 2, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          fontStyle: 'bold',
          color: COLORS.barText,
        })
        .setOrigin(0, 0.5)
        .setName(`resource-${key}`);
    });
  }

  private togglePanel(dog: DogData): void {
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.panel = new DogInfoPanel(this, dog, () => this.closePanel());
    if (window.__WGZ__) window.__WGZ__.panel = dog.id;
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    if (window.__WGZ__) {
      window.__WGZ__.panel = null;
      window.__WGZ__.result = null;
    }
  }
}
