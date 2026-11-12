import Phaser from 'phaser';
import { COLORS } from '../config';
import { findDog } from '../data/dogs';
import { REGIONS, findRegionOfStage, findStage, type StageData } from '../data/regions';
import {
  battlePaceFromSearch,
  type BattlePace,
  nextBattleSpeed,
  stepDelayMs,
  type BattleEvent,
  type BattleResult,
  type BattleSide,
} from '../logic/battle';
import { battleLayout, type BattleLayout, type BattleSlot } from '../logic/battleLayout';
import { expeditionBattle } from '../logic/expedition';
import type { ExpeditionRecord } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { ResultPanel } from './components/ResultPanel';
import { Scenery } from './components/Scenery';
import { addText, patchDebug, resetDebug, viewOf } from './ui';

export interface BattleSceneData {
  /** 出征紀錄 id（開戰當下就結算，勝負與獎勵都已寫在裡面） */
  recordId: string;
  /** 結算面板的額外訊息（通過關卡、新背景…） */
  extra?: string[];
  /** 結算後要接著播的劇情 */
  storyId?: string;
}

/** 野犬（非 Boss 敵人）的佔位配色 */
const MOB_LOOK = { color: 0x7d746c, accent: 0xcfc6bb };
const HP_COLOR = { team: 0x4f8a3c, enemy: 0xb0413e };

/** 畫面上的一隻角色：頭像 + 名字 + 血條 */
interface UnitView {
  side: BattleSide;
  id: string;
  slot: BattleSlot;
  color: number;
  accent: number;
  fierce: boolean;
  maxHp: number;
  hp: number;
  box: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
}

/**
 * 戰鬥畫面：只是播放器。勝負與回合紀錄都由 src/logic/battle.ts 算好，
 * 這裡照著紀錄逐次播放（往前衝、閃一下、跳傷害、扣血、倒下變暗），不自己決定任何結果。
 * 右上角切換 ×1～×4 速度，隨時可按「略過」直接看結算。
 */
export class BattleScene extends Phaser.Scene {
  private payload: BattleSceneData = { recordId: '' };
  private record: ExpeditionRecord | null = null;
  private stage: StageData | null = null;
  private battle!: BattleResult;
  private layout!: BattleLayout;
  private units: Record<BattleSide, UnitView[]> = { team: [], enemy: [] };
  private index = 0;
  private round = 1;
  private phase: 'playing' | 'result' = 'playing';
  private skipped = false;
  private pace: BattlePace = 'normal';
  private speedLabel!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private skipButton!: Button;
  private timer: Phaser.Time.TimerEvent | null = null;
  /** 還在飄的傷害數字，略過或結束時一起清掉 */
  private floating = new Set<Phaser.GameObjects.Text>();

  constructor() {
    super('BattleScene');
  }

  init(data: BattleSceneData): void {
    this.payload = { recordId: data?.recordId ?? '', extra: data?.extra, storyId: data?.storyId };
    this.record = getState().history.find((r) => r.id === this.payload.recordId) ?? null;
    this.stage = this.record ? (findStage(this.record.stageId) ?? null) : null;
    this.index = 0;
    this.round = 1;
    this.phase = 'playing';
    this.skipped = false;
    this.timer = null;
    this.units = { team: [], enemy: [] };
    this.floating = new Set();
  }

  create(): void {
    resetDebug(this);
    if (!this.record || !this.stage) {
      this.scene.start('LobbyScene');
      return;
    }
    this.pace = battlePaceFromSearch(window.location.search);
    // 同一份紀錄、同一個種子，重算出來和開戰時結算的一模一樣
    this.battle = expeditionBattle(this.record);

    const { w, h, landscape } = viewOf(this);
    this.layout = battleLayout(
      w,
      h,
      landscape,
      this.battle.team.length,
      this.battle.enemies.length,
    );
    this.drawStage(w, h, landscape);
    this.drawUnits();
    this.drawControls();
    this.sync();

    // 開場停一下再開打
    this.timer = this.time.delayedCall(this.pace === 'fast' ? 0 : 500 / this.speed, () =>
      this.step(),
    );
  }

  private get speed(): number {
    return getState().settings.battleSpeed;
  }

  private get stepMs(): number {
    return stepDelayMs(this.battle.events.length, this.speed, this.pace);
  }

  // ---- 畫面 ----

  private drawStage(w: number, h: number, landscape: boolean): void {
    const theme = findRegionOfStage(this.stage!.id)?.theme ?? 'slope';
    new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      theme,
      getState().settings.quality,
      landscape ? 0.45 : 0.4,
    ).setDepth(-10);
    // 壓暗一點，讓角色與數字清楚
    this.add.rectangle(0, 0, w, h, 0x000000, 0.12).setOrigin(0, 0).setDepth(-9);

    const bar = this.layout.barHeight;
    this.add.rectangle(0, 0, w, bar, COLORS.bar).setOrigin(0, 0);
    addText(this, 16, bar / 2, `戰鬥・${this.stage!.name}`, 20, COLORS.barText, true).setOrigin(
      0,
      0.5,
    );
    this.roundLabel = addText(this, w / 2, bar + 6, '', 16, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setBackgroundColor('#3b2a1acc')
      .setPadding(12, 4, 12, 4);

    const f = this.layout.field;
    const labelY = landscape ? f.y - 22 : f.y - 30;
    addText(this, f.x + f.width * 0.25, labelY, '我方', 15, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
    addText(this, f.x + f.width * 0.75, labelY, '敵方', 15, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
  }

  private drawUnits(): void {
    const boss = this.stage!.boss;
    this.battle.team.forEach((u, i) => {
      const d = findDog(u.id);
      this.units.team.push(
        this.makeUnit('team', u.id, u.name, u.maxHp, this.layout.team[i], {
          color: d?.color ?? 0xd9894a,
          accent: d?.accent ?? 0xfff3e0,
          fierce: false,
        }),
      );
    });
    this.battle.enemies.forEach((u, i) => {
      this.units.enemy.push(
        this.makeUnit('enemy', u.id, u.name, u.maxHp, this.layout.enemies[i], {
          color: boss?.color ?? MOB_LOOK.color,
          accent: boss?.accent ?? MOB_LOOK.accent,
          fierce: true,
        }),
      );
    });
  }

  private makeUnit(
    side: BattleSide,
    id: string,
    name: string,
    maxHp: number,
    slot: BattleSlot,
    look: { color: number; accent: number; fierce: boolean },
  ): UnitView {
    const box = this.add.container(slot.x, slot.y);
    const shadow = this.add.ellipse(0, slot.r * 0.95, slot.r * 2, slot.r * 0.5, 0x000000, 0.2);
    const head = this.add.graphics();
    const label = addText(this, 0, slot.r + 6, name, 14, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
    const bar = this.add.graphics();
    box.add([shadow, head, label, bar]);
    const unit: UnitView = { side, id, slot, ...look, maxHp, hp: maxHp, box, head, bar };
    this.redrawUnit(unit);
    return unit;
  }

  /** 依目前血量重畫頭像（倒下變暗）與血條 */
  private redrawUnit(u: UnitView): void {
    const down = u.hp <= 0;
    u.head.clear();
    drawDogHead(u.head, 0, 0, u.slot.r, u.color, u.accent, { fierce: u.fierce, dark: down });
    u.box.setAlpha(down ? 0.7 : 1);

    const bw = Math.max(56, u.slot.r * 2.2);
    const by = u.slot.r + 26;
    u.bar.clear();
    u.bar.fillStyle(0x3b2a1a, 1);
    u.bar.fillRoundedRect(-bw / 2 - 2, by - 2, bw + 4, 12, 5);
    u.bar.fillStyle(0xe9dcc8, 1);
    u.bar.fillRoundedRect(-bw / 2, by, bw, 8, 4);
    const ratio = Math.max(0, u.hp / u.maxHp);
    if (ratio > 0) {
      u.bar.fillStyle(HP_COLOR[u.side], 1);
      u.bar.fillRoundedRect(-bw / 2, by, Math.max(6, bw * ratio), 8, 4);
    }
  }

  private drawControls(): void {
    // 右上角速度按鈕：×1 → ×2 → ×3 → ×4 → ×1
    const r = this.layout.speed;
    const c = this.add.container(r.x, r.y);
    const g = this.add.graphics();
    g.fillStyle(0xfff6e8, 1);
    g.lineStyle(2, 0xd8a24a, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 12);
    g.strokeRoundedRect(0, 0, r.width, r.height, 12);
    this.speedLabel = addText(this, r.width / 2, r.height / 2, '', 19, COLORS.ink, true).setOrigin(
      0.5,
    );
    c.add([g, this.speedLabel]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', () => this.cycleSpeed());

    this.skipButton = new Button(this, this.layout.skip, '略過 ››', () => this.skip(), 22);
    this.skipButton.setColor(COLORS.bar).setDepth(20);
  }

  // ---- 播放 ----

  private cycleSpeed(): void {
    if (this.phase !== 'playing') return;
    const st = getState();
    setState({
      ...st,
      settings: { ...st.settings, battleSpeed: nextBattleSpeed(st.settings.battleSpeed) },
    });
    this.sync();
  }

  /** 播下一次出手；播完就進結算 */
  private step(): void {
    if (this.phase !== 'playing') return;
    const e = this.battle.events[this.index];
    if (!e) {
      this.finish();
      return;
    }
    const d = this.stepMs;
    this.round = e.round;
    this.animate(e, d);
    this.apply(e);
    this.index++;
    this.sync();
    const last = this.index >= this.battle.events.length;
    // 最後一下之後多停一下，看清楚誰倒了
    this.timer = this.time.delayedCall(
      last ? d + (this.pace === 'fast' ? 0 : 400 / this.speed) : d,
      () => this.step(),
    );
  }

  /** 把一次出手的結果套到血量上（略過時也用這個，不帶動畫） */
  private apply(e: BattleEvent): void {
    const target = this.units[e.side === 'team' ? 'enemy' : 'team'][e.target];
    target.hp = e.targetHp;
    this.redrawUnit(target);
  }

  /** 純裝飾：攻擊方往前衝、被打的閃一下、跳出傷害數字 */
  private animate(e: BattleEvent, d: number): void {
    const attacker = this.units[e.side][e.attacker];
    const target = this.units[e.side === 'team' ? 'enemy' : 'team'][e.target];
    const dir = e.side === 'team' ? 1 : -1;
    this.tweens.add({
      targets: attacker.box,
      x: attacker.slot.x + dir * 26,
      duration: d * 0.3,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => attacker.box.setX(attacker.slot.x),
    });
    if (e.damage > 0) {
      this.tweens.add({
        targets: target.box,
        x: target.slot.x + dir * 8,
        duration: d * 0.12,
        delay: d * 0.25,
        yoyo: true,
        repeat: 1,
        onComplete: () => target.box.setX(target.slot.x),
      });
    }
    const text = addText(
      this,
      target.slot.x,
      target.slot.y - target.slot.r - 6,
      e.damage > 0 ? `-${e.damage}` : '閃過',
      e.defeated ? 26 : 21,
      e.damage > 0 ? (e.side === 'team' ? '#ffe08a' : '#ff9a8a') : '#ffffff',
      true,
    )
      .setOrigin(0.5, 1)
      .setStroke('#3b2a1a', 5)
      .setDepth(10);
    this.floating.add(text);
    this.tweens.add({
      targets: text,
      y: text.y - 34,
      alpha: 0,
      duration: Math.max(260, d * 1.4),
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.floating.delete(text);
        text.destroy();
      },
    });
  }

  /** 略過：剩下的出手直接套用，馬上進結算。結果和看完整場一樣。 */
  private skip(): void {
    if (this.phase !== 'playing') return;
    this.skipped = true;
    this.timer?.remove();
    while (this.index < this.battle.events.length) this.apply(this.battle.events[this.index++]);
    this.finish();
  }

  private finish(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'result';
    this.timer?.remove();
    this.timer = null;
    // 停掉還在跑的動畫，角色回到原位
    this.tweens.killAll();
    for (const t of this.floating) t.destroy();
    this.floating.clear();
    for (const u of [...this.units.team, ...this.units.enemy]) u.box.setX(u.slot.x);
    this.skipButton.setVisible(false).disableInteractive();
    const last = this.battle.events[this.battle.events.length - 1];
    if (last) this.round = last.round;
    this.sync();

    const rec = this.record!;
    new ResultPanel(
      this,
      this.stage!.name,
      rec.reward,
      rec.win,
      () => {
        patchDebug({ result: null, growth: null });
        if (this.payload.storyId) {
          this.scene.start('StoryScene', { mode: 'play', storyId: this.payload.storyId });
        } else {
          // 回出征地圖，可以馬上再打一場
          const chapter = REGIONS.findIndex((r) => r.stages.some((x) => x.id === rec.stageId));
          this.scene.start('CampaignScene', chapter >= 0 ? { chapter } : undefined);
        }
      },
      this.payload.extra ?? [],
      rec.gains,
    );
    patchDebug({ result: { ...rec.reward, win: rec.win }, growth: rec.gains });
  }

  /** 更新文字與 Playwright 用的除錯資訊 */
  private sync(): void {
    this.speedLabel.setText(`×${this.speed}`);
    this.roundLabel.setText(this.phase === 'result' ? '戰鬥結束' : `第 ${this.round} 回合`);
    const view = (u: UnitView) => ({ id: u.id, hp: u.hp, maxHp: u.maxHp, ...u.slot });
    patchDebug({
      battle: {
        stageId: this.stage!.id,
        win: this.record!.win,
        phase: this.phase,
        speed: this.speed,
        stepMs: this.stepMs,
        index: this.index,
        total: this.battle.events.length,
        round: this.round,
        skipped: this.skipped,
        skipButton: this.layout.skip,
        speedButton: this.layout.speed,
        team: this.units.team.map(view),
        enemies: this.units.enemy.map(view),
      },
    });
  }
}
