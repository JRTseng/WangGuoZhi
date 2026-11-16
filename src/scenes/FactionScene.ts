import Phaser from 'phaser';
import { COLORS } from '../config';
import { FACTIONS, FACTION_NAMES, STARTER_IDS, findDog, type Faction } from '../data/dogs';
import { chooseFaction, isFreshSave, needFactionPick, playerFaction } from '../logic/faction';
import type { Rect } from '../logic/layout';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { DogSprite } from './components/DogSprite';
import { playSfx } from './components/audio';
import { drawDogHead } from './components/dogArt';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

const LOOK: Readonly<
  Record<Faction, { color: number; soft: number; text: string; line: string; pool: string }>
> = {
  dog: {
    color: 0xb5651d,
    soft: 0xfbe9cf,
    text: '#8a4a12',
    line: '重情重義的狗狗們，一呼百應',
    pool: '召募到的都是狗狗（50 種）',
  },
  cat: {
    color: 0x5a6fb0,
    soft: 0xe2e8f8,
    text: '#3c4c86',
    line: '我行我素的貓咪們，各有絕活',
    pool: '召募到的都是貓咪（20 種）',
  },
};

/**
 * 選陣營（T029，Jimmy 2026-11-17：「使用者一開始可以選擇要加入哪個陣營」）。
 * 左邊汪國、右邊喵國，各一張大卡：代表角色、一句話、一開始的五隻、召募內容，下面一顆「加入」。
 * 還沒選的時候一進主頁就會被帶來這裡（沒有返回鍵，一定要選）；
 * 選過以後從主頁帳號卡下面的陣營徽章進來，可以換（每週積分戰做好之前先不限制）。
 * 規則在 src/logic/faction.ts。
 */
export class FactionScene extends Phaser.Scene {
  constructor() {
    super('FactionScene');
  }

  create(): void {
    resetDebug(this);
    const { w, h } = viewOf(this);
    const st = getState();
    const picked = !needFactionPick(st);
    const fresh = isFreshSave(st);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    if (picked) {
      const back = drawHeader(this, '選擇陣營', () => this.scene.start('LobbyScene'), BAR);
      patchDebug({ backButton: back });
    } else {
      this.add.rectangle(0, 0, w, BAR, COLORS.bar).setOrigin(0, 0);
      addText(this, w / 2, BAR / 2, '選擇陣營', 22, COLORS.barText, true).setOrigin(0.5);
    }

    const m = 16;
    const gap = 14;
    const top = BAR + 10;
    const hintH = 24;
    const cardW = (w - m * 2 - gap) / 2;
    const cardH = h - top - hintH - 10;
    const rects = {} as Record<Faction, Rect>;
    FACTIONS.forEach((f, i) => {
      rects[f] = this.drawCard(f, m + i * (cardW + gap), top, cardW, cardH, picked);
    });

    const hint = !picked
      ? '選了之後還可以從主頁左上的陣營徽章再換'
      : fresh
        ? '還沒開始玩，換陣營會直接換成那一邊的五隻夥伴'
        : '換陣營後原本的夥伴都會留著，另外送新陣營的五隻；之後召募到的是新陣營的角色';
    addText(this, w / 2, h - hintH / 2 - 6, hint, 13, COLORS.inkSoft).setOrigin(0.5);

    patchDebug({ faction: { current: st.faction, fresh, dog: rects.dog, cat: rects.cat } });
  }

  /** 一張陣營卡，回傳「加入」按鈕的範圍 */
  private drawCard(
    f: Faction,
    x: number,
    y: number,
    cw: number,
    ch: number,
    picked: boolean,
  ): Rect {
    const L = LOOK[f];
    const mine = picked && playerFaction(getState()) === f;
    const g = this.add.graphics();
    g.fillStyle(L.soft, 1);
    g.fillRoundedRect(x, y, cw, ch, 16);
    g.lineStyle(mine ? 4 : 2, L.color, 1);
    g.strokeRoundedRect(x, y, cw, ch, 16);
    // 上面一條色帶寫國名
    g.fillStyle(L.color, 1);
    g.fillRoundedRect(x, y, cw, 40, { tl: 16, tr: 16, bl: 0, br: 0 });
    addText(this, x + 16, y + 20, FACTION_NAMES[f], 22, '#ffffff', true).setOrigin(0, 0.5);
    if (mine)
      addText(this, x + cw - 14, y + 20, '目前的陣營', 14, '#ffffff', true).setOrigin(1, 0.5);

    // 左邊：代表角色全身
    const starters = STARTER_IDS[f].map((id) => findDog(id)!);
    const lead = starters[0];
    const stageW = Math.min(150, cw * 0.36);
    const footY = y + ch - 72;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x + stageW / 2 + 20, footY + 2, 110, 16);
    const sprite = new DogSprite(this, x + stageW / 2 + 20, footY, {
      color: lead.color,
      accent: lead.accent,
      breed: lead.breed,
    });
    sprite.setScale(0.9);
    this.add.existing(sprite);
    sprite.play('wag');

    // 右邊：一句話、一開始的五隻、召募內容
    const tx = x + stageW + 24;
    const tw = cw - stageW - 36;
    addText(this, tx, y + 52, L.line, 15, L.text, true);
    addText(this, tx, y + 78, '一開始的夥伴', 13, COLORS.inkSoft);
    const hr = Math.min(17, (tw - 8) / 10 - 2);
    starters.forEach((d, i) => {
      const cx = tx + hr + 2 + i * (hr * 2 + 6);
      const cy = y + 100 + hr;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx, cy, hr + 2);
      g.lineStyle(1.5, L.color, 0.8);
      g.strokeCircle(cx, cy, hr + 2);
      drawDogHead(g, cx, cy + 2, hr * 0.62, d.color, d.accent, { breed: d.breed });
    });
    addText(
      this,
      tx,
      y + 106 + hr * 2 + 6,
      starters.map((d) => d.name).join('、'),
      12,
      COLORS.inkSoft,
    );
    addText(this, tx, y + 106 + hr * 2 + 26, L.pool, 13, L.text, true);

    const btn: Rect = { x: x + 14, y: y + ch - 52, width: cw - 28, height: 42 };
    const b = new Button(
      this,
      btn,
      mine ? `留在${FACTION_NAMES[f]}` : `加入${FACTION_NAMES[f]}`,
      () => this.choose(f),
    );
    b.setColor(L.color);
    return btn;
  }

  private choose(f: Faction): void {
    playSfx('tap');
    setState(chooseFaction(getState(), f));
    this.scene.start('LobbyScene');
  }
}
