import Phaser from 'phaser';
import { COLORS } from '../config';
import { REGIONS, type StageData } from '../data/regions';
import { RESOURCE_LABELS, type Resources } from '../data/resources';
import { formatAmount } from '../logic/format';
import { layoutPath, type Rect } from '../logic/layout';
import {
  currentChapterIndex,
  isChapterUnlocked,
  stageNodeState,
  type NodeState,
} from '../logic/progress';
import { getState } from '../state/store';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { Scenery } from './components/Scenery';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const NODE_R = 28;
const BOSS_R = 58;

interface CampaignData {
  chapter?: number;
}

/**
 * 出征地圖：3 個章節分頁，每章 5 個小節用點和線連起來，最後一關是大隻的 Boss。
 * 打過的關卡打勾，可以挑戰的會閃，還沒開的上鎖。點關卡看詳情 → 選隊伍出發。
 */
export class CampaignScene extends Phaser.Scene {
  private chapter = 0;
  private modal: Phaser.GameObjects.Container | null = null;
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('CampaignScene');
  }

  init(data: CampaignData): void {
    const st = getState();
    const want = data?.chapter ?? currentChapterIndex(st);
    this.chapter = isChapterUnlocked(st, want) ? want : currentChapterIndex(st);
  }

  create(): void {
    this.modal = null;
    this.toast = null;
    resetDebug(this);
    const { w, h, landscape } = viewOf(this);
    const region = REGIONS[this.chapter];
    const st = getState();

    new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      region.theme,
      'low',
      landscape ? 0.45 : 0.3,
    );
    this.add.rectangle(0, 0, w, h, 0xf4e9d8, 0.35).setOrigin(0, 0);

    const back = drawHeader(this, `出征・第${'一二三'[this.chapter]}章 ${region.name}`, () =>
      this.scene.start('LobbyScene'),
    );

    // ---- 章節分頁 ----
    const tabY = BAR + 8;
    const tabH = 40;
    const tabsW = landscape ? Math.min(520, w - 32) : w - 32;
    const tabW = (tabsW - 16) / REGIONS.length;
    const tabX0 = (w - tabsW) / 2;
    const chapters = REGIONS.map((r, i) => {
      const rect = { x: tabX0 + i * (tabW + 8), y: tabY, width: tabW, height: tabH };
      const unlocked = isChapterUnlocked(st, i);
      const active = i === this.chapter;
      const c = this.add.container(rect.x, rect.y);
      const g = this.add.graphics();
      g.fillStyle(active ? COLORS.button : unlocked ? 0xfffaf2 : 0xb9a48c, 1);
      g.lineStyle(2, active ? 0x8a4a12 : COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, tabW, tabH, 12);
      g.strokeRoundedRect(0, 0, tabW, tabH, 12);
      const label = `${unlocked ? '' : '🔒'}第${'一二三'[i]}章 ${r.name}`;
      c.add([
        g,
        addText(
          this,
          tabW / 2,
          tabH / 2,
          label,
          15,
          active ? '#ffffff' : COLORS.ink,
          true,
        ).setOrigin(0.5),
      ]);
      makeTapArea(c, tabW, tabH);
      c.on('pointerup', () => {
        if (this.modal) return;
        if (!unlocked) this.showToast('打倒上一章的 Boss 才能前往');
        else if (i !== this.chapter) this.scene.restart({ chapter: i });
      });
      return { id: r.id, unlocked, ...rect };
    });

    // ---- 章節介紹（直式才放） ----
    if (!landscape) {
      addText(this, w / 2, tabY + tabH + 14, region.description, 14, COLORS.ink)
        .setOrigin(0.5, 0)
        .setAlign('center');
    }

    // ---- 路線與節點 ----
    const area: Rect = landscape
      ? { x: 70, y: tabY + tabH + 70, width: w - 140, height: h - (tabY + tabH + 70) - 70 }
      : { x: 50, y: tabY + tabH + 160, width: w - 100, height: h - (tabY + tabH + 160) - 70 };
    const pts = layoutPath(region.stages.length, area, landscape);
    const states = region.stages.map((s) => stageNodeState(st, s.id));
    const busyStages = new Set(st.expeditions.map((e) => e.stageId));

    const path = this.add.graphics();
    for (let i = 1; i < pts.length; i++) {
      const done = states[i - 1] === 'cleared';
      this.drawSegment(path, pts[i - 1], pts[i], done);
    }

    const nodes = region.stages.map((s, i) =>
      this.drawNode(s, pts[i], states[i], busyStages.has(s.id), landscape),
    );

    patchDebug({
      backButton: back,
      map: { chapter: this.chapter, chapters, nodes, stagePanel: null },
    });
  }

  private drawSegment(
    g: Phaser.GameObjects.Graphics,
    a: { x: number; y: number },
    b: { x: number; y: number },
    done: boolean,
  ) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dash = 14;
    const n = Math.floor(len / dash);
    g.lineStyle(done ? 8 : 6, done ? 0x8a5a2b : 0x9c8b78, done ? 1 : 0.85);
    for (let k = 0; k < n; k++) {
      if (!done && k % 2 === 1) continue;
      const t0 = k / n;
      const t1 = (k + 1) / n;
      g.beginPath();
      g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
      g.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      g.strokePath();
    }
  }

  private drawNode(
    s: StageData,
    p: { x: number; y: number },
    state: NodeState,
    busy: boolean,
    landscape: boolean,
  ): { id: string; state: NodeState; boss: boolean } & Rect {
    const boss = !!s.boss;
    const r = boss ? (landscape ? BOSS_R * 0.75 : BOSS_R) : NODE_R;
    const c = this.add.container(p.x, p.y);
    const g = this.add.graphics();
    const fill = state === 'cleared' ? 0x4f8a3c : state === 'open' ? COLORS.button : 0x9c8b78;

    if (state === 'open') {
      const glow = this.add.circle(0, 0, r + 10, 0xffd56b, 0.6);
      c.add(glow);
      this.tweens.add({
        targets: glow,
        scale: 1.25,
        alpha: 0.1,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(3, 5, r);
    g.fillStyle(boss ? (state === 'locked' ? 0x6d5f52 : 0x7a1f1f) : fill, 1);
    g.lineStyle(4, 0xfff6e8, 1);
    g.fillCircle(0, 0, r);
    g.strokeCircle(0, 0, r);
    c.add(g);

    if (boss) {
      const hg = this.add.graphics();
      // Boss 沒解鎖也照樣畫出來，讓玩家看到目標
      drawDogHead(hg, 0, 6, r * 0.62, s.boss!.color, s.boss!.accent, { fierce: true });
      c.add(hg);
      c.add(
        addText(this, 0, -r - 4, 'BOSS', 15, '#ffffff', true)
          .setOrigin(0.5, 1)
          .setBackgroundColor('#c0392b')
          .setPadding(8, 2, 8, 2),
      );
      if (state === 'cleared')
        c.add(addText(this, r * 0.7, r * 0.5, '✓', 26, '#7CFC7C', true).setOrigin(0.5));
    } else {
      const num = s.id.split('-').pop() ?? '';
      const mark = state === 'cleared' ? '✓' : state === 'locked' ? '🔒' : num;
      c.add(
        addText(this, 0, 0, mark, state === 'locked' ? 18 : 24, '#ffffff', true).setOrigin(0.5),
      );
    }

    const label = boss ? `${s.boss!.breed}・${s.boss!.name}` : s.name;
    const ly = r + 6;
    c.add(
      addText(this, 0, ly, label, boss ? 16 : 14, state === 'locked' ? '#6d5f52' : COLORS.ink, true)
        .setOrigin(0.5, 0)
        .setBackgroundColor('#fffaf2cc')
        .setPadding(6, 2, 6, 2),
    );
    if (busy) {
      c.add(
        addText(this, 0, -r - (boss ? 26 : 4), '出征中', 12, '#ffffff', true)
          .setOrigin(0.5, 1)
          .setBackgroundColor('#8a6f55')
          .setPadding(5, 2, 5, 2),
      );
    }

    const rect = { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 };
    const hit = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
    hit.setInteractive({ cursor: 'pointer' }).on('pointerup', () => {
      if (this.modal) return;
      if (state === 'locked') this.showToast('先通過前一關才能挑戰');
      else this.openStage(s);
    });
    return { id: s.id, state, boss, ...rect };
  }

  private openStage(s: StageData): void {
    const { landscape } = viewOf(this);
    const close = () => {
      this.modal?.destroy();
      this.modal = null;
      patchDebug({ map: { ...window.__WGZ__!.map!, stagePanel: null } });
    };
    const { layer, box } = openModal(
      this,
      landscape ? { width: 520, height: 300 } : { width: 340, height: s.boss ? 420 : 330 },
      close,
      s.boss ? 0xc0392b : COLORS.cardBorder,
    );
    this.modal = layer;
    const left = box.x + 22;
    let y = box.y + 20;
    if (s.boss) {
      const hg = this.add.graphics();
      drawDogHead(hg, box.x + box.width - 64, box.y + 70, 42, s.boss.color, s.boss.accent, {
        fierce: true,
      });
      layer.add([hg, addText(this, left, y, 'BOSS 關', 15, '#c0392b', true)]);
      y += 24;
    }
    const stars = '★'.repeat(Math.min(s.difficulty, 7));
    layer.add(addText(this, left, y, s.name, 24, COLORS.ink, true));
    y += 38;
    layer.add(addText(this, left, y, `難度 ${stars}`, 16, '#b5651d', true));
    y += 30;
    if (s.boss) {
      layer.add(addText(this, left, y, `守關：${s.boss.breed}「${s.boss.name}」`, 16, COLORS.ink));
      y += 28;
    }
    layer.add(
      addText(
        this,
        left,
        y,
        `耗時 ${s.durationMin} 分鐘・建議戰力 ${s.recommendedPower}`,
        16,
        COLORS.inkSoft,
      ),
    );
    y += 28;
    layer.add(addText(this, left, y, `獎勵 ${rewardText(s.reward)}`, 16, COLORS.ink));

    const go: Rect = {
      x: box.x + 22,
      y: box.y + box.height - 70,
      width: box.width - 44,
      height: 52,
    };
    const c = this.add.container(go.x, go.y);
    const g = this.add.graphics();
    g.fillStyle(s.boss ? 0xc0392b : COLORS.button, 1);
    g.fillRoundedRect(0, 0, go.width, go.height, 16);
    c.add([
      g,
      addText(this, go.width / 2, go.height / 2, '選隊伍出發', 21, '#ffffff', true).setOrigin(0.5),
    ]);
    makeTapArea(c, go.width, go.height);
    c.on('pointerup', () =>
      this.scene.start('ExpeditionScene', { stageId: s.id, chapter: this.chapter }),
    );
    layer.add(c);
    patchDebug({ map: { ...window.__WGZ__!.map!, stagePanel: { stageId: s.id, go } } });
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const { w, h } = viewOf(this);
    this.toast = addText(this, w / 2, h - 40, text, 16, '#ffffff', true)
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
}

function rewardText(r: Resources): string {
  return (Object.keys(RESOURCE_LABELS) as (keyof Resources)[])
    .map((k) => `${RESOURCE_LABELS[k]} ${formatAmount(r[k])}`)
    .join('、');
}
