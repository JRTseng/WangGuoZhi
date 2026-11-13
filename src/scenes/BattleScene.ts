import Phaser from 'phaser';
import { COLORS } from '../config';
import { findDog } from '../data/dogs';
import { BOSS_SKILLS, BOSS_SKILL_FALLBACK, DEFAULT_SKILL_LINES } from '../data/skillLines';
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
import {
  ULT_CHARGE,
  ULT_CUTIN_RATIO,
  planShow,
  skillLineOf,
  ultDelayMs,
  ultKindOfRole,
  type ShowCasters,
  type ShowStep,
  type ShowUlt,
} from '../logic/skillShow';
import { voiceCueId } from '../logic/voicePack';
import type { ExpeditionRecord } from '../state/gameState';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { ResultPanel } from './components/ResultPanel';
import { Scenery } from './components/Scenery';
import { playUltimate } from './components/UltimateShow';
import { playVoiceCue } from './components/voice';
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
const HEAL_TEXT = '#9df08a';
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
  /** 會不會放大絕招（會的才畫 EN 條）與目前 EN 格數（0～ULT_CHARGE） */
  canUlt: boolean;
  en: number;
  box: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
}

/**
 * 戰鬥畫面：只是播放器。勝負與回合紀錄都由 src/logic/battle.ts 算好，
 * 這裡照著紀錄逐次播放（往前衝、閃一下、跳傷害、扣血、倒下變暗），不自己決定任何結果。
 * 大絕招（T017）也只是演出：哪幾下要播成大絕招由 src/logic/skillShow.ts 從紀錄排出來，
 * 血量變化仍然完全照紀錄。每隻狗血條下面的細條是 EN 條（T023 會接上真正的 EN 值）。
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
  /** 每一次出手對應的演出（是不是大絕招、EN 條到哪） */
  private show: ShowStep[] = [];
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
    this.show = [];
    this.fx = [];
    this.fxCaster = null;
    this.ult = null;
    this.ultCount = 0;
    this.lastVoiceCue = null;
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
    this.casterList = this.casters();
    this.show = planShow(this.battle.events, this.casterList);

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

  /** 誰會放大絕招：我方有技能的狗，以及章末 Boss；野犬小兵不會 */
  private casters(): ShowCasters {
    const lines = getState().skillLines;
    const boss = this.stage!.boss;
    const bossSkill = boss ? (BOSS_SKILLS[boss.name] ?? BOSS_SKILL_FALLBACK) : null;
    return {
      team: this.battle.team.map((u) => {
        const d = findDog(u.id);
        if (!d?.skill) return null;
        return {
          name: d.name,
          skill: d.skill.name,
          kind: ultKindOfRole(d.role),
          line: skillLineOf(lines, DEFAULT_SKILL_LINES, d.id),
        };
      }),
      enemy: this.battle.enemies.map((u) =>
        bossSkill
          ? { name: u.name, skill: bossSkill.name, kind: 'single', line: bossSkill.line }
          : null,
      ),
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
        this.makeUnit('team', u.id, u.heal ? `✚ ${u.name}` : u.name, u.maxHp, this.layout.team[i], {
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
    const canUlt = !!this.casterList[side][this.units[side].length];
    const unit: UnitView = {
      side,
      id,
      slot,
      ...look,
      maxHp,
      hp: maxHp,
      canUlt,
      en: 0,
      box,
      head,
      bar,
    };
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
    if (!u.canUlt) return;
    // EN 條：一格一格的細條；集氣中是藍的，滿了變金色；倒下的不顯示集氣
    const ey = by + hpH + 1;
    const full = !down && u.en >= ULT_CHARGE;
    const gap = 2;
    const cell = (bw - gap * (ULT_CHARGE - 1)) / ULT_CHARGE;
    for (let i = 0; i < ULT_CHARGE; i++) {
      const lit = !down && i < u.en;
      u.bar.fillStyle(lit ? (full ? EN_COLOR.full : EN_COLOR.charging) : 0x6b5a4a, 1);
      u.bar.fillRect(-bw / 2 + i * (cell + gap), ey, cell, 4);
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
    this.clearUltimate();
    this.round = e.round;
    const ult = this.show[this.index]?.ult ?? null;
    if (!ult) {
      this.hit(e, this.stepMs);
      return;
    }
    // 大絕招：先播喊招字卡，字卡滑走後才真的打下去（扣血仍然照紀錄）
    const total = ultDelayMs(this.speed, this.pace);
    const cutIn = Math.round(total * ULT_CUTIN_RATIO);
    this.ult = ult;
    this.ultCount++;
    this.lastVoiceCue = voiceCueId(this.units[ult.side][ult.index].id, 'ultimate');
    playVoiceCue(this.lastVoiceCue);
    if (this.pace !== 'fast') this.showUltimate(e, ult, total, cutIn);
    this.sync();
    this.timer = this.time.delayedCall(cutIn, () => this.hit(e, total - cutIn, true));
  }

  /** 這一下真的打下去：動畫、扣血、EN 條，然後排下一次出手 */
  private hit(e: BattleEvent, d: number, big = false): void {
    if (this.phase !== 'playing') return;
    this.animate(e, d, big);
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

  /** 開始播大絕招演出：施放者拉到遮罩上面，其餘交給 UltimateShow */
  private showUltimate(e: BattleEvent, ult: ShowUlt, total: number, cutIn: number): void {
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
      target: this.targetOf(e).slot,
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
  private apply(e: BattleEvent): void {
    const target = this.targetOf(e);
    target.hp = e.targetHp;
    this.redrawUnit(target);
    const actor = this.units[e.side][e.attacker];
    const en = this.show[this.index]?.en[e.side][e.attacker] ?? actor.en;
    if (en !== actor.en) {
      actor.en = en;
      this.redrawUnit(actor);
    }
  }

  /** 這次出手的對象：攻擊是對面的，補血是自己這一方的 */
  private targetOf(e: BattleEvent): UnitView {
    const side = e.heal !== undefined ? e.side : e.side === 'team' ? 'enemy' : 'team';
    return this.units[side][e.target];
  }

  /** 飄起來再淡掉的數字 */
  private floatText(target: UnitView, s: string, size: number, color: string, d: number): void {
    const text = addText(
      this,
      target.slot.x,
      target.slot.y - target.slot.r - 6,
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
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.floating.delete(text);
        text.destroy();
      },
    });
  }

  /** 純裝飾：攻擊方往前衝、被打的閃一下、跳出傷害數字；補血是原地跳一下、跳出綠色數字 */
  private animate(e: BattleEvent, d: number, big = false): void {
    const attacker = this.units[e.side][e.attacker];
    const target = this.targetOf(e);
    if (e.heal !== undefined) {
      for (const u of new Set([attacker, target])) {
        this.tweens.add({
          targets: u.box,
          y: u.slot.y - 10,
          duration: d * 0.25,
          yoyo: true,
          ease: 'Quad.easeOut',
          onComplete: () => u.box.setY(u.slot.y),
        });
      }
      this.floatText(target, `+${e.heal}`, big ? 30 : 22, HEAL_TEXT, d);
      return;
    }
    const dir = e.side === 'team' ? 1 : -1;
    this.tweens.add({
      targets: attacker.box,
      x: attacker.slot.x + dir * (big ? 44 : 26),
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
    this.floatText(
      target,
      e.damage > 0 ? `-${e.damage}` : '閃過',
      big ? 32 : e.defeated ? 26 : 21,
      e.damage > 0 ? (e.side === 'team' ? '#ffe08a' : '#ff9a8a') : '#ffffff',
      d,
    );
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
    this.clearUltimate();
    this.cameras.main.resetFX();
    for (const t of this.floating) t.destroy();
    this.floating.clear();
    for (const u of [...this.units.team, ...this.units.enemy])
      u.box.setPosition(u.slot.x, u.slot.y);
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
    patchDebug({
      result: { ...rec.reward, win: rec.win, newDogId: rec.newDogId },
      growth: rec.gains,
    });
  }

  /** 更新文字與 Playwright 用的除錯資訊 */
  private sync(): void {
    this.speedLabel.setText(`×${this.speed}`);
    this.roundLabel.setText(this.phase === 'result' ? '戰鬥結束' : `第 ${this.round} 回合`);
    const view = (u: UnitView) => ({
      id: u.id,
      hp: u.hp,
      maxHp: u.maxHp,
      en: u.canUlt ? u.en : null,
      ...u.slot,
    });
    patchDebug({
      battle: {
        stageId: this.stage!.id,
        win: this.record!.win,
        phase: this.phase,
        speed: this.speed,
        stepMs: this.stepMs,
        index: this.index,
        total: this.battle.events.length,
        heals: this.battle.events.slice(0, this.index).filter((e) => e.heal !== undefined).length,
        ults: this.ultCount,
        ultTotal: this.show.filter((s) => s.ult).length,
        ult: this.ult
          ? {
              id: this.units[this.ult.side][this.ult.index].id,
              side: this.ult.side,
              skill: this.ult.skill,
              line: this.ult.line,
              kind: this.ult.kind,
            }
          : null,
        enMax: ULT_CHARGE,
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
