import Phaser from 'phaser';
import { COLORS } from '../config';
import { findDog } from '../data/dogs';
import {
  BOSS_SKILLS,
  BOSS_SKILL_FALLBACK,
  ELITE_SKILL,
  DEFAULT_SKILL_LINES,
} from '../data/skillLines';
import { REGIONS, findRegionOfStage, findStage, type StageData } from '../data/regions';
import {
  EN_MAX,
  autoUlt,
  battlePaceFromSearch,
  createBattle,
  finishBattle,
  nextActor,
  nextBattleSpeed,
  stepBattle,
  stepDelayMs,
  type BattleAction,
  type BattleHit,
  type BattlePace,
  type BattleSide,
  type BattleState,
  ROW_NAMES,
} from '../logic/battle';
import { battleLayout, type BattleLayout, type BattleSlot } from '../logic/battleLayout';
import { battleInputOf, completeExpedition, resultNotes } from '../logic/expedition';
import { newStoriesAfter } from '../logic/progress';
import {
  ULT_CUTIN_RATIO,
  skillLineOf,
  ultDelayMs,
  ultKindOfRole,
  type ShowCasters,
  type ShowUlt,
} from '../logic/skillShow';
import { voiceCueId } from '../logic/voicePack';
import type { ExpeditionRecord, GameState, PendingBattle } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { ResultPanel } from './components/ResultPanel';
import { Scenery } from './components/Scenery';
import { playSfx } from './components/audio';
import { nextLabel, planNext, startNext } from './components/nextStage';
import { playUltimate } from './components/UltimateShow';
import { playVoiceCue } from './components/voice';
import { addText, patchDebug, resetDebug, viewOf } from './ui';

export interface BattleSceneData {
  /** 打完回地圖時停在哪一章 */
  chapter?: number;
  /** 進來就直接算完看結算（開了「略過戰鬥畫面」又按「下一關」時用） */
  instant?: boolean;
}

/** 野犬（非 Boss 敵人）的佔位配色 */
const MOB_LOOK = { color: 0x7d746c, accent: 0xcfc6bb };
const HP_COLOR = { team: 0x4f8a3c, enemy: 0xb0413e };
const HEAL_TEXT = '#9df08a';
const SHIELD_TEXT = '#9fd8ff';
/** EN 條的顏色：集氣中是藍的，滿了變金色 */
const EN_COLOR = { charging: 0x4aa3e0, full: 0xffd75e };
/** 大絕招演出的深度：壓暗遮罩在角色之上，施放者、字卡、傷害數字再疊上去；略過按鈕永遠最上面 */
const ULT_DEPTH = 12;

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
  /** 站第幾排（0 前、1 中、2 後） */
  row: number;
  /** 會不會放大絕招（會的才畫 EN 條）與目前 EN 值（0～EN_MAX） */
  canUlt: boolean;
  en: number;
  /** 玩家點了「輪到牠就放大絕招」（手動放招時） */
  armed: boolean;
  box: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  mark: Phaser.GameObjects.Text;
}

/**
 * 戰鬥畫面（T023）：戰鬥一步一步往前推。每一步由 src/logic/battle.ts 算出「這次出手打到誰、扣多少」，
 * 這裡只負責決定我方要不要放大絕招、照結果播動畫（往前衝、閃一下、跳傷害、扣血、倒下變暗）。
 * - 「自動放招」打勾：EN 一滿、輪到牠就放。沒打勾：EN 滿的狗會亮起來，點牠一下，輪到牠時才放。
 * - 敵方一律自動放招。按「略過」剩下的用自動放招一次算完。
 * - 打完才結算（體力與次數開戰時就扣了）；我方放招的時機會寫進出征紀錄，之後重算結果一樣。
 * 右上角切換 ×1～×4 速度。
 */
export class BattleScene extends Phaser.Scene {
  private chapter: number | undefined;
  private instant = false;
  private ticket: PendingBattle | null = null;
  /** 開戰前的狀態（比對結算後多了什麼用） */
  private before!: GameState;
  private record: ExpeditionRecord | null = null;
  private stage: StageData | null = null;
  /** 戰鬥目前的狀態與已經算出來的每一次出手 */
  private sim!: BattleState;
  private actions: BattleAction[] = [];
  /** 已經算出來、字卡還在播、還沒套到畫面上的那一次出手 */
  private queued: BattleAction | null = null;
  /** 開場時用自動放招預估整場有幾次出手（決定播放節奏用） */
  private planned = 1;
  private layout!: BattleLayout;
  private units: Record<BattleSide, UnitView[]> = { team: [], enemy: [] };
  private index = 0;
  private round = 1;
  private heals = 0;
  private phase: 'playing' | 'result' = 'playing';
  private skipped = false;
  private pace: BattlePace = 'normal';
  private speedLabel!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private autoLabel!: Phaser.GameObjects.Text;
  private skipButton!: Button;
  private timer: Phaser.Time.TimerEvent | null = null;
  /** 還在飄的傷害數字，略過或結束時一起清掉 */
  private floating = new Set<Phaser.GameObjects.Text>();
  private casterList: ShowCasters = { team: [], enemy: [] };
  /** 大絕招演出產生的物件，下一次出手或略過時清掉 */
  private fx: Phaser.GameObjects.GameObject[] = [];
  private fxCaster: UnitView | null = null;
  /** 正在播的大絕招（給測試與語音掛點看）與已經播了幾次 */
  private ult: ShowUlt | null = null;
  private ultCount = 0;
  private lastVoiceCue: string | null = null;

  constructor() {
    super('BattleScene');
  }

  init(data: BattleSceneData): void {
    this.chapter = data?.chapter;
    this.instant = !!data?.instant;
    this.before = getState();
    this.ticket = this.before.pending;
    this.stage = this.ticket ? (findStage(this.ticket.stageId) ?? null) : null;
    this.record = null;
    this.actions = [];
    this.queued = null;
    this.index = 0;
    this.round = 1;
    this.heals = 0;
    this.phase = 'playing';
    this.skipped = false;
    this.timer = null;
    this.units = { team: [], enemy: [] };
    this.floating = new Set();
    this.fx = [];
    this.fxCaster = null;
    this.ult = null;
    this.ultCount = 0;
    this.lastVoiceCue = null;
  }

  create(): void {
    resetDebug(this);
    if (!this.ticket || !this.stage) {
      this.scene.start('LobbyScene');
      return;
    }
    this.pace = battlePaceFromSearch(window.location.search);
    this.sim = createBattle(battleInputOf(this.ticket));
    this.planned = Math.max(1, finishBattle(this.sim).actions.length);
    this.casterList = this.casters();

    const { w, h, landscape } = viewOf(this);
    this.layout = battleLayout(
      w,
      h,
      landscape,
      this.sim.team.map((u) => u.row),
      this.sim.enemies.map((u) => u.row),
      this.sim.team.map((u) => u.lane),
      this.sim.enemies.map((u) => !!u.look?.big),
    );
    this.drawStage(w, h, landscape);
    this.drawUnits();
    this.drawControls();
    this.sync();

    if (this.instant) {
      this.skip();
      return;
    }
    // 開場停一下再開打
    this.timer = this.time.delayedCall(this.pace === 'fast' ? 0 : 500 / this.speed, () =>
      this.step(),
    );
  }

  private get speed(): number {
    return getState().settings.battleSpeed;
  }

  private get stepMs(): number {
    return stepDelayMs(this.planned, this.speed, this.pace);
  }

  /** 誰會放大絕招：我方有技能的狗，以及章末 Boss；野犬小兵不會 */
  private casters(): ShowCasters {
    const lines = getState().skillLines;
    const boss = this.stage!.boss;
    const bossSkill = boss ? (BOSS_SKILLS[boss.name] ?? BOSS_SKILL_FALLBACK) : null;
    return {
      team: this.sim.team.map((u) => {
        const d = findDog(u.id);
        if (!d?.skill || !u.canUlt) return null;
        return {
          name: d.name,
          skill: d.skill.name,
          kind: ultKindOfRole(d.role),
          line: skillLineOf(lines, DEFAULT_SKILL_LINES, d.id),
        };
      }),
      enemy: this.sim.enemies.map((u) => {
        if (!u.canUlt) return null;
        // 頭目用自己的招式；精銳小兵用共用的
        const skill = u.role === '頭目' ? (bossSkill ?? BOSS_SKILL_FALLBACK) : ELITE_SKILL;
        return { name: u.name, skill: skill.name, kind: ultKindOfRole(u.role), line: skill.line };
      }),
    };
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
    const labelY = landscape ? f.y - 30 : f.y - 46;
    // 前排、中排、後排的小標：前排最靠近中線
    for (const side of ['team', 'enemy'] as const) {
      this.layout.rowX[side].forEach((x, row) => {
        addText(this, x, f.y - (landscape ? 8 : 22), ROW_NAMES[row], 12, '#fff3c4', true)
          .setOrigin(0.5, 0)
          .setStroke('#3b2a1a', 3);
      });
    }
    addText(this, f.x + f.width * 0.25, labelY, '我方', 15, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
    addText(this, f.x + f.width * 0.75, labelY, '敵方', 15, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
  }

  private drawUnits(): void {
    this.sim.team.forEach((u, i) => {
      const d = findDog(u.id);
      const unit = this.makeUnit('team', i, u.heal ? `✚ ${u.name}` : u.name, this.layout.team[i], {
        color: d?.color ?? 0xd9894a,
        accent: d?.accent ?? 0xfff3e0,
        fierce: false,
      });
      this.units.team.push(unit);
      // 手動放招：點 EN 滿的狗，輪到牠就放大絕招；再點一次取消
      const s = unit.slot;
      const zone = this.add
        .zone(s.x, s.y + 10, Math.max(72, s.r * 2.6), s.r * 2 + 44)
        .setInteractive({ cursor: 'pointer' });
      zone.on('pointerup', () => this.toggleArm(unit));
    });
    this.sim.enemies.forEach((u, i) => {
      this.units.enemy.push(
        this.makeUnit('enemy', i, u.name, this.layout.enemies[i], {
          color: u.look?.color ?? MOB_LOOK.color,
          accent: u.look?.accent ?? MOB_LOOK.accent,
          fierce: true,
        }),
      );
    });
  }

  private makeUnit(
    side: BattleSide,
    index: number,
    name: string,
    slot: BattleSlot,
    look: { color: number; accent: number; fierce: boolean },
  ): UnitView {
    const data = (side === 'team' ? this.sim.team : this.sim.enemies)[index];
    const box = this.add.container(slot.x, slot.y);
    const shadow = this.add.ellipse(0, slot.r * 0.95, slot.r * 2, slot.r * 0.5, 0x000000, 0.2);
    const head = this.add.graphics();
    const label = addText(this, 0, slot.r + 6, name, 14, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4);
    const bar = this.add.graphics();
    const mark = addText(this, 0, -slot.r - 4, '', 13, '#3b2a1a', true)
      .setOrigin(0.5, 1)
      .setBackgroundColor('#ffd75e')
      .setPadding(6, 2, 6, 2)
      .setVisible(false);
    box.add([shadow, head, label, bar, mark]);
    const unit: UnitView = {
      side,
      id: data.id,
      slot,
      ...look,
      maxHp: data.maxHp,
      hp: data.maxHp,
      row: data.row,
      canUlt: !!this.casterList[side][index],
      en: 0,
      armed: false,
      box,
      head,
      bar,
      mark,
    };
    this.redrawUnit(unit);
    return unit;
  }

  /** 手動放招：點一下 EN 滿的狗，輪到牠就放；再點一次取消。自動放招時點了沒反應。 */
  private toggleArm(u: UnitView): void {
    if (this.phase !== 'playing' || getState().settings.autoUlt) return;
    if (u.hp <= 0 || !u.canUlt || u.en < EN_MAX) return;
    u.armed = !u.armed;
    this.redrawUnit(u);
    this.sync();
  }

  private toggleAuto(): void {
    if (this.phase !== 'playing') return;
    const st = getState();
    setState({ ...st, settings: { ...st.settings, autoUlt: !st.settings.autoUlt } });
    for (const u of this.units.team) {
      u.armed = false;
      this.redrawUnit(u);
    }
    this.sync();
  }

  /** 依目前血量重畫頭像（倒下變暗）與血條 */
  private redrawUnit(u: UnitView): void {
    const down = u.hp <= 0;
    u.head.clear();
    drawDogHead(u.head, 0, 0, u.slot.r, u.color, u.accent, { fierce: u.fierce, dark: down });
    u.box.setAlpha(down ? 0.7 : 1);

    const bw = Math.max(56, u.slot.r * 2.2);
    const by = u.slot.r + 26;
    // 會放大絕招的：血條與 EN 條包在同一個框裡（血條 7、EN 條 4），整塊只比原本高 3
    const hpH = u.canUlt ? 7 : 8;
    u.bar.clear();
    u.bar.fillStyle(0x3b2a1a, 1);
    u.bar.fillRoundedRect(-bw / 2 - 2, by - 2, bw + 4, u.canUlt ? 16 : 12, 5);
    u.bar.fillStyle(0xe9dcc8, 1);
    u.bar.fillRoundedRect(-bw / 2, by, bw, hpH, 3);
    const ratio = Math.max(0, u.hp / u.maxHp);
    if (ratio > 0) {
      u.bar.fillStyle(HP_COLOR[u.side], 1);
      u.bar.fillRoundedRect(-bw / 2, by, Math.max(6, bw * ratio), hpH, 3);
    }
    const manual = u.side === 'team' && !getState().settings.autoUlt && this.phase === 'playing';
    const ready = !down && u.canUlt && u.en >= EN_MAX;
    u.mark.setVisible(manual && ready).setText(u.armed ? '放招！' : '點我放招');
    u.mark.setBackgroundColor(u.armed ? '#ff8a5c' : '#ffd75e');
    if (manual && ready) {
      // EN 滿了：頭像外面一圈亮框，點了之後變粗
      u.head.lineStyle(u.armed ? 5 : 3, u.armed ? 0xff8a5c : EN_COLOR.full, 1);
      u.head.strokeCircle(0, 0, u.slot.r * 1.22);
    }
    if (!u.canUlt) return;
    // EN 條：集氣中是藍的，滿了變金色；倒下的不顯示集氣
    const ey = by + hpH + 1;
    const en = down ? 0 : Math.min(1, u.en / EN_MAX);
    u.bar.fillStyle(0x6b5a4a, 1);
    u.bar.fillRect(-bw / 2, ey, bw, 4);
    if (en > 0) {
      u.bar.fillStyle(en >= 1 ? EN_COLOR.full : EN_COLOR.charging, 1);
      u.bar.fillRect(-bw / 2, ey, bw * en, 4);
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

    // 自動放招勾選框
    const a = this.layout.auto;
    const ac = this.add.container(a.x, a.y).setDepth(20);
    const ag = this.add.graphics();
    ag.fillStyle(0xfff6e8, 1);
    ag.lineStyle(2, 0xd8a24a, 1);
    ag.fillRoundedRect(0, 0, a.width, a.height, 12);
    ag.strokeRoundedRect(0, 0, a.width, a.height, 12);
    this.autoLabel = addText(this, a.width / 2, a.height / 2, '', 17, COLORS.ink, true).setOrigin(
      0.5,
    );
    ac.add([ag, this.autoLabel]);
    makeTapArea(ac, a.width, a.height);
    ac.on('pointerup', () => this.toggleAuto());

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

  /** 輪到的那一隻要不要放大絕招：敵方與自動放招照規則；手動時看玩家有沒有點牠 */
  private decide(): boolean {
    const next = nextActor(this.sim);
    if (!next || !next.ultReady) return false;
    if (next.side === 'enemy' || getState().settings.autoUlt) return autoUlt(this.sim);
    return this.units.team[next.index].armed;
  }

  /** 往前推一步並播出來；打完就進結算 */
  private step(): void {
    if (this.phase !== 'playing') return;
    this.clearUltimate();
    if (this.sim.over) {
      this.finish();
      return;
    }
    const r = stepBattle(this.sim, this.decide());
    this.sim = r.state;
    const e = r.action;
    this.actions.push(e);
    this.round = e.round;
    const actor = this.units[e.side][e.actor];
    actor.armed = false;
    const caster = e.ult ? this.casterList[e.side][e.actor] : null;
    if (!caster) {
      this.hit(e, this.stepMs);
      return;
    }
    // 大絕招：先播喊招字卡，字卡滑走後才真的打下去
    const total = ultDelayMs(this.speed, this.pace);
    const cutIn = Math.round(total * ULT_CUTIN_RATIO);
    const ult: ShowUlt = {
      ...caster,
      kind: e.kind === 'attack' ? caster.kind : e.kind,
      side: e.side,
      index: e.actor,
    };
    this.ult = ult;
    this.ultCount++;
    this.queued = e;
    this.lastVoiceCue = voiceCueId(actor.id, 'ultimate');
    playVoiceCue(this.lastVoiceCue);
    if (this.pace !== 'fast') this.showUltimate(e, ult, total, cutIn);
    playSfx('ultimate');
    this.sync();
    this.timer = this.time.delayedCall(cutIn, () => this.hit(e, total - cutIn, true));
  }

  /** 這一下真的打下去：動畫、扣血、EN 條，然後排下一次出手 */
  private hit(e: BattleAction, d: number, big = false): void {
    if (this.phase !== 'playing') return;
    this.queued = null;
    this.animate(e, d, big);
    this.playHitSound(e);
    this.apply(e);
    this.sync();
    // 最後一下之後多停一下，看清楚誰倒了
    this.timer = this.time.delayedCall(
      this.sim.over ? d + (this.pace === 'fast' ? 0 : 400 / this.speed) : d,
      () => this.step(),
    );
  }

  /** 這一下的音效：倒下、爆擊、打中、補血各一種，一次只播最重要的那個 */
  private playHitSound(e: BattleAction): void {
    if (e.hits.some((h) => h.defeated)) playSfx('ko');
    if (e.hits.some((h) => h.crit)) playSfx('crit');
    else if (e.hits.some((h) => h.heal === undefined && !h.dodged)) playSfx('hit');
    else if (e.hits.some((h) => h.heal !== undefined)) playSfx('heal');
  }

  /** 開始播大絕招演出：施放者拉到遮罩上面，其餘交給 UltimateShow */
  private showUltimate(e: BattleAction, ult: ShowUlt, total: number, cutIn: number): void {
    const { w, h, landscape } = viewOf(this);
    const caster = this.units[ult.side][ult.index];
    const alive = (list: UnitView[]) => list.filter((u) => u.hp > 0).map((u) => u.slot);
    const foeSide: BattleSide = ult.side === 'team' ? 'enemy' : 'team';
    caster.box.setDepth(ULT_DEPTH + 1);
    this.fxCaster = caster;
    this.fx = playUltimate(this, {
      w,
      h,
      landscape,
      top: this.layout.barHeight,
      side: ult.side,
      kind: ult.kind,
      name: ult.name,
      skill: ult.skill,
      line: ult.line,
      caster: { ...caster.slot, color: caster.color, accent: caster.accent, fierce: caster.fierce },
      target: (e.hits[0] ? this.units[e.hits[0].side][e.hits[0].target] : caster).slot,
      allies: alive(this.units[ult.side]),
      foes: alive(this.units[foeSide]),
      total,
      cutIn,
      depth: ULT_DEPTH,
    });
  }

  /** 收掉上一次大絕招演出留下的東西 */
  private clearUltimate(): void {
    for (const o of this.fx) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.fx = [];
    this.fxCaster?.box.setDepth(0);
    this.fxCaster = null;
    this.ult = null;
  }

  /** 把一次出手的結果套到血量與 EN 條上（略過時也用這個，不帶動畫） */
  private apply(e: BattleAction): void {
    for (const h of e.hits) {
      this.units[h.side][h.target].hp = h.targetHp;
      if (h.heal !== undefined && !h.shield) this.heals++;
    }
    for (const side of ['team', 'enemy'] as const) {
      this.units[side].forEach((u, i) => {
        u.en = e.en[side][i];
        if (u.hp <= 0 || u.en < EN_MAX) u.armed = false;
        this.redrawUnit(u);
      });
    }
    this.index++;
  }

  /** 飄起來再淡掉的數字 */
  private floatText(
    target: UnitView,
    s: string,
    size: number,
    color: string,
    d: number,
    nth = 0,
  ): void {
    const text = addText(
      this,
      target.slot.x,
      target.slot.y - target.slot.r - 6 - nth * 20,
      s,
      size,
      color,
      true,
    )
      .setOrigin(0.5, 1)
      .setStroke('#3b2a1a', 5)
      .setDepth(ULT_DEPTH + 4);
    this.floating.add(text);
    this.tweens.add({
      targets: text,
      y: text.y - 34,
      alpha: 0,
      duration: Math.max(260, d * 1.4),
      delay: nth * Math.min(120, d * 0.2),
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.floating.delete(text);
        text.destroy();
      },
    });
  }

  /** 純裝飾：攻擊方往前衝、被打的閃一下、跳出傷害數字；補血是原地跳一下、跳出綠色數字 */
  private animate(e: BattleAction, d: number, big = false): void {
    const actor = this.units[e.side][e.actor];
    const dir = e.side === 'team' ? 1 : -1;
    const attacks = e.hits.filter((h) => h.heal === undefined);
    const bounce = (u: UnitView): void => {
      this.tweens.add({
        targets: u.box,
        y: u.slot.y - 10,
        duration: d * 0.25,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => u.box.setY(u.slot.y),
      });
    };
    if (attacks.length > 0) {
      this.tweens.add({
        targets: actor.box,
        x: actor.slot.x + dir * (big ? 44 : 26),
        duration: d * 0.3,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => actor.box.setX(actor.slot.x),
      });
    } else {
      bounce(actor);
    }
    const buffText = { taunt: '嘲諷！', inspire: '鼓舞！', command: '號令！' };
    if (e.buff) this.floatText(actor, buffText[e.buff], 22, '#fff3c4', d);
    // 同一隻被打好幾下（連打）：數字往上疊
    const seen = new Map<UnitView, number>();
    for (const h of e.hits) {
      const target = this.units[h.side][h.target];
      const nth = seen.get(target) ?? 0;
      seen.set(target, nth + 1);
      this.showHit(e, h, target, nth, d, big);
      if (h.heal !== undefined && nth === 0 && target !== actor) bounce(target);
    }
  }

  private showHit(
    e: BattleAction,
    h: BattleHit,
    target: UnitView,
    nth: number,
    d: number,
    big: boolean,
  ): void {
    if (h.shield) {
      this.floatText(target, '護盾', 22, SHIELD_TEXT, d, nth);
      return;
    }
    if (h.heal !== undefined) {
      const text = h.revive ? `救起 +${h.heal}` : h.cheer ? `+${h.heal} 打氣` : `+${h.heal}`;
      this.floatText(target, text, big || h.revive ? 30 : 22, HEAL_TEXT, d, nth);
      return;
    }
    const dir = e.side === 'team' ? 1 : -1;
    if (h.damage > 0 && nth === 0) {
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
    this.floatText(
      target,
      h.dodged
        ? '閃過'
        : `${h.crit ? '爆擊 ' : ''}${h.shielded ? '護盾 ' : ''}-${h.damage}${h.slowed ? ' 慢' : ''}`,
      big || h.crit ? 30 : h.defeated ? 26 : 21,
      h.dodged ? '#ffffff' : e.side === 'team' ? '#ffe08a' : '#ff9a8a',
      d,
      nth,
    );
  }

  /** 略過：剩下的用自動放招一次算完，馬上進結算。 */
  private skip(): void {
    if (this.phase !== 'playing') return;
    this.skipped = true;
    this.timer?.remove();
    // 字卡播到一半的那一下已經算好了，先套上去
    if (this.queued) this.apply(this.queued);
    this.queued = null;
    const rest = finishBattle(this.sim);
    this.sim = rest.state;
    for (const e of rest.actions) {
      this.actions.push(e);
      this.apply(e);
    }
    this.finish();
  }

  private finish(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'result';
    this.timer?.remove();
    this.timer = null;
    // 停掉還在跑的動畫，角色回到原位
    this.tweens.killAll();
    this.clearUltimate();
    this.cameras.main.resetFX();
    for (const t of this.floating) t.destroy();
    this.floating.clear();
    for (const u of [...this.units.team, ...this.units.enemy]) {
      u.armed = false;
      u.box.setPosition(u.slot.x, u.slot.y);
      this.redrawUnit(u);
    }
    this.skipButton.setVisible(false).disableInteractive();
    this.round = this.sim.round;

    // 結算：把我方實際放招的時機交給規則重算一次，結果和畫面上打的一樣
    const ultTurns = this.actions.filter((a) => a.side === 'team' && a.ult).map((a) => a.turn);
    const done = completeExpedition(getState(), ultTurns);
    if (!done) {
      this.scene.start('LobbyScene');
      return;
    }
    setState(done.state);
    const rec = (this.record = done.record);
    this.sync();
    const storyId = newStoriesAfter(done.state, rec.stageId)[0]?.id;
    // 打贏而且下一關可以打：多一顆「下一關」，用同一隊直接挑戰
    const from = { stageId: rec.stageId, team: [...this.ticket!.dogIds] };
    const plan = rec.win ? planNext(from) : null;
    const panel = new ResultPanel(
      this,
      this.stage!.name,
      rec.reward,
      rec.win,
      () => {
        patchDebug({ result: null, growth: null, drop: null, nextButton: null });
        if (storyId) {
          this.scene.start('StoryScene', { mode: 'play', storyId });
        } else {
          // 回出征地圖，可以馬上再打一場
          const found = REGIONS.findIndex((r) => r.stages.some((x) => x.id === rec.stageId));
          const chapter = this.chapter ?? found;
          this.scene.start('CampaignScene', chapter >= 0 ? { chapter } : undefined);
        }
      },
      resultNotes(this.before, done.state, rec),
      rec.gains,
      plan
        ? {
            label: nextLabel(plan),
            onTap: () => {
              patchDebug({ result: null, growth: null, drop: null, nextButton: null });
              // 有新劇情先看劇情，看完接著打下一關
              if (storyId) this.scene.start('StoryScene', { mode: 'play', storyId, next: from });
              else if (!startNext(this, from)) {
                this.scene.start('CampaignScene', { chapter: plan.chapter });
              }
            },
          }
        : undefined,
    );
    patchDebug({
      nextButton: panel.nextRect && plan ? { stageId: plan.stage.id, ...panel.nextRect } : null,
      result: { ...rec.reward, win: rec.win, newDogId: rec.newDogId },
      drop: rec.dropGearId ?? null,
      growth: rec.gains,
      resources: { ...done.state.resources },
    });
  }

  /** 更新文字與 Playwright 用的除錯資訊 */
  private sync(): void {
    const auto = getState().settings.autoUlt;
    this.speedLabel.setText(`×${this.speed}`);
    this.autoLabel.setText(`${auto ? '☑' : '☐'} 自動放招`);
    this.roundLabel.setText(this.phase === 'result' ? '戰鬥結束' : `第 ${this.round} 回合`);
    // 剩下的部分用自動放招預估（總共幾次出手、還會放幾次大絕招）
    const rest = this.sim.over ? [] : finishBattle(this.sim).actions;
    const isUlt = (side: BattleSide, i: number): boolean => !!this.casterList[side][i];
    const ultsOf = (list: readonly BattleAction[]): number =>
      list.filter((a) => a.ult && isUlt(a.side, a.actor)).length;
    const view = (u: UnitView) => ({
      id: u.id,
      hp: u.hp,
      maxHp: u.maxHp,
      en: u.canUlt ? u.en : null,
      row: u.row,
      armed: u.armed,
      ...u.slot,
    });
    patchDebug({
      battle: {
        stageId: this.stage!.id,
        win: this.record ? this.record.win : null,
        phase: this.phase,
        speed: this.speed,
        stepMs: this.stepMs,
        index: this.index,
        total: this.actions.length + rest.length,
        heals: this.heals,
        ults: this.ultCount,
        ultTotal: ultsOf(this.actions) + ultsOf(rest),
        ult: this.ult
          ? {
              id: this.units[this.ult.side][this.ult.index].id,
              side: this.ult.side,
              skill: this.ult.skill,
              line: this.ult.line,
              kind: this.ult.kind,
            }
          : null,
        enMax: EN_MAX,
        autoUlt: auto,
        autoButton: this.layout.auto,
        voiceCue: this.lastVoiceCue,
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
