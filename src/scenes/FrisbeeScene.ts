import Phaser from 'phaser';
import { PIXEL_SIZE } from '../logic/atmosphere';
import { COLORS, RARITY_COLORS } from '../config';
import { DOGS, findDog, type DogData } from '../data/dogs';
import { createRng, mixSeed } from '../logic/battle';
import { gearOf } from '../logic/equipment';
import {
  FRISBEE_COUNT,
  FRISBEE_REACH,
  finishFrisbee,
  frisbeeCaught,
  frisbeeComment,
  frisbeeDefaultDog,
  frisbeePlan,
  frisbeePos,
  frisbeeReady,
  frisbeeReward,
  moveDog,
  type FrisbeeResult,
  type FrisbeeThrow,
} from '../logic/frisbee';
import {
  fieldFrac,
  fieldX,
  fieldY,
  frisbeeLayout,
  type FrisbeeLayout,
} from '../logic/frisbeeLayout';
import type { Rect } from '../logic/layout';
import { dogStats, formatGain } from '../logic/leveling';
import { snackLabel } from '../logic/snacks';
import { getState, setState, tick, timeOptions } from '../state/store';
import { playSfx } from './components/audio';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { DogSprite } from './components/DogSprite';
import { makeTapArea } from './components/hitArea';
import { Scenery } from './components/Scenery';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
/** 兩格畫面隔超過這麼久（切到別的 App、畫面卡住）就當成暫停，不讓飛盤偷偷落地 */
const PAUSE_GAP_MS = 500;
/** 接到後飛盤叼在嘴上多久、跳起來多久 */
const HOLD_MS = 450;
const JUMP_MS = 320;
/** 最後一個落地後多久跳出結算 */
const RESULT_DELAY_MS = 700;

const DISC = { red: 0xe0452b, rim: 0xffffff, gold: 0xf4c430 } as const;

type Phase = 'intro' | 'play' | 'result';

/**
 * 訓練場每日小遊戲「接飛盤」（T022）：訓練場右上角進來。
 * 先選一隻狗，飛盤一個一個丟出來，手指按著左右滑（或移動滑鼠）帶狗狗跑到落點就接到。
 * 每天第一次玩有經驗，全部接到再送一個零食；之後可以再玩但沒有獎勵。
 * 規則都在 src/logic/frisbee.ts，這裡只管畫面與操作。
 */
export class FrisbeeScene extends Phaser.Scene {
  private layout!: FrisbeeLayout;
  private phase: Phase = 'intro';
  private dogId = '';
  private ownedIds: string[] = [];
  private intro: Phaser.GameObjects.Container | null = null;
  private resultLayer: Phaser.GameObjects.Container | null = null;
  private resultRects: { again: Rect; back: Rect } | null = null;
  private result: FrisbeeResult | null = null;

  private sprite: DogSprite | null = null;
  private discs!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;

  private plan: FrisbeeThrow[] = [];
  /** 每個飛盤的結果：還沒落地是 null */
  private outcomes: (boolean | null)[] = [];
  /** 這一場已經過了多久（毫秒，暫停時不走） */
  private elapsed = 0;
  private lastFrame = 0;
  private dogX = 0.5;
  private targetX = 0.5;
  private facing: 1 | -1 = 1;
  private caughtAt = -Infinity;
  private endAt = Infinity;

  constructor() {
    super('FrisbeeScene');
  }

  create(): void {
    resetDebug(this);
    const { w, h } = viewOf(this);
    const st = tick();
    this.phase = 'intro';
    this.intro = null;
    this.resultLayer = null;
    this.resultRects = null;
    this.result = null;
    this.sprite = null;
    this.plan = [];
    this.outcomes = [];
    this.ownedIds = DOGS.filter((d) => st.owned.includes(d.id)).map((d) => d.id);
    this.dogId = frisbeeDefaultDog(st);
    this.layout = frisbeeLayout(w, h, this.ownedIds.length, BAR);

    new Scenery(
      this,
      { x: 0, y: BAR, width: w, height: h - BAR },
      st.backgroundId,
      st.settings.quality,
      0.66,
    ).setDepth(-10);
    const back = drawHeader(this, '每日小遊戲・接飛盤', () => this.scene.start('TrainingScene'));

    this.discs = this.add.graphics().setDepth(20);
    this.hud = this.add.graphics().setDepth(30);
    const l = this.layout;
    this.scoreText = addText(this, l.score.x, l.score.y, '', 17, '#ffffff', true)
      .setStroke('#3b2a1a', 4)
      .setDepth(30);
    this.tip = addText(this, w / 2, l.field.y + 26, '', 16, '#ffffff', true)
      .setOrigin(0.5)
      .setStroke('#3b2a1a', 4)
      .setDepth(30);

    // 按著左右滑或移動滑鼠，狗狗就往那邊跑；不用一直點
    const follow = (p: Phaser.Input.Pointer): void => {
      if (this.phase === 'play') this.targetX = fieldFrac(this.layout, p.worldX);
    };
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', follow);

    patchDebug({ backButton: back });
    this.placeDog();
    this.openIntro();
  }

  private dog(): DogData {
    return findDog(this.dogId) ?? DOGS[0];
  }

  /** 把上場的狗放到場地中間（換狗、重玩時重畫） */
  private placeDog(): void {
    this.sprite?.destroy();
    const d = this.dog();
    const l = this.layout;
    this.dogX = 0.5;
    this.targetX = 0.5;
    this.facing = 1;
    this.sprite = new DogSprite(this, fieldX(l, 0.5), l.groundY, {
      color: d.color,
      accent: d.accent,
      gear: gearOf(getState(), d.id),
      pixel: PIXEL_SIZE / l.dogScale,
      breed: d.breed,
    });
    this.sprite.setScale(l.dogScale).setDepth(10);
    this.sprite.play('wag');
  }

  // ---- 開始前：選狗、看獎勵 ----

  private openIntro(): void {
    this.phase = 'intro';
    this.intro?.destroy();
    this.sprite?.setVisible(false);
    this.discs.clear();
    this.hud.clear();
    this.scoreText.setText('');
    this.tip.setText('');
    const st = getState();
    const l = this.layout;
    const p = l.panel;
    const ready = frisbeeReady(st, Date.now(), timeOptions());
    const layer = (this.intro = this.add.container(0, 0).setDepth(40));
    const g = this.add.graphics();
    g.fillStyle(COLORS.card, 0.96);
    g.lineStyle(3, COLORS.cardBorder, 1);
    g.fillRoundedRect(p.x, p.y, p.width, p.height, 18);
    g.strokeRoundedRect(p.x, p.y, p.width, p.height, 18);
    layer.add(g);
    layer.add([
      addText(
        this,
        p.x + 16,
        p.y + 12,
        '飛盤會一個一個丟出來，手指按著左右滑，帶狗狗跑到影子那裡就接到',
        14,
        COLORS.ink,
        true,
      ),
      addText(
        this,
        p.x + 16,
        p.y + 36,
        `選一隻狗上場（拿經驗的是牠）・最佳紀錄 ${st.frisbee.best}／${FRISBEE_COUNT}`,
        13,
        COLORS.inkSoft,
      ),
    ]);

    // 左邊：擁有的狗，點一下就換牠上場
    this.ownedIds.forEach((id, i) => {
      const r = l.cells[i];
      const d = findDog(id)!;
      const on = id === this.dogId;
      const pad = 3;
      g.fillStyle(on ? COLORS.cardSelected : 0xffffff, 1);
      g.lineStyle(on ? 3 : 1.5, on ? COLORS.button : RARITY_COLORS[d.rarity ?? 'N'], 1);
      g.fillRoundedRect(r.x + pad, r.y + pad, r.width - pad * 2, r.height - pad * 2, 9);
      g.strokeRoundedRect(r.x + pad, r.y + pad, r.width - pad * 2, r.height - pad * 2, 9);
      drawDogHead(g, r.x + r.width / 2, r.y + r.height / 2 + 3, r.width * 0.27, d.color, d.accent, {
        breed: d.breed,
      });
      const c = this.add.container(r.x, r.y);
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => {
        if (this.dogId === id) return;
        this.dogId = id;
        this.placeDog();
        this.openIntro();
      });
      layer.add(c);
    });

    // 右邊：上場的狗、今天的獎勵、開始
    const d = this.dog();
    const s = dogStats(st, d);
    const preview = new DogSprite(this, l.preview.x, l.preview.y, {
      color: d.color,
      accent: d.accent,
      gear: gearOf(st, d.id),
      breed: d.breed,
    });
    preview.setScale(l.preview.scale);
    preview.play('wag');
    layer.add(preview);
    const lo = frisbeeReward(st, 0).exp;
    const hi = frisbeeReward(st, FRISBEE_COUNT);
    const maxed = s.expNeed === 0;
    const rewardLine = !ready
      ? '今天的獎勵領過了，再玩只是好玩'
      : maxed
        ? '牠已經滿級，拿不到經驗'
        : `今天的獎勵：經驗 +${lo}～+${hi.exp}`;
    const bonusLine = ready
      ? `全部接到再送 ${snackLabel(hi.snack!.id, hi.snack!.amount)}`
      : '明天 05:00 後又有獎勵';
    layer.add([
      addText(
        this,
        l.paneX,
        l.preview.y + 8,
        `${d.name}\u3000Lv.${s.level}`,
        17,
        COLORS.ink,
        true,
      ).setOrigin(0.5, 0),
      addText(
        this,
        l.paneX,
        l.preview.y + 34,
        rewardLine,
        13,
        ready && !maxed ? '#2f7d32' : '#b5651d',
        true,
      ).setOrigin(0.5, 0),
      addText(this, l.paneX, l.preview.y + 54, bonusLine, 12, COLORS.inkSoft).setOrigin(0.5, 0),
    ]);
    const start = new Button(
      this,
      l.start,
      ready ? '開始' : '再玩一次',
      () => this.startPlay(),
      20,
    );
    start.setColor(COLORS.harvest);
    layer.add(start);
    this.publish();
  }

  // ---- 進行中 ----

  private startPlay(): void {
    this.intro?.destroy();
    this.intro = null;
    this.resultLayer?.destroy();
    this.resultLayer = null;
    this.resultRects = null;
    this.result = null;
    this.placeDog();
    this.plan = frisbeePlan(mixSeed(Date.now(), 0xf215bee));
    this.outcomes = this.plan.map(() => null);
    this.elapsed = 0;
    this.lastFrame = Date.now();
    this.caughtAt = -Infinity;
    this.endAt = Infinity;
    this.phase = 'play';
    this.tip.setText('按著左右滑，跑到影子那裡');
    this.drawHud();
    this.publish();
  }

  update(): void {
    if (this.phase !== 'play') return;
    const now = Date.now();
    let dt = now - this.lastFrame;
    this.lastFrame = now;
    if (dt > PAUSE_GAP_MS) dt = 16;
    this.elapsed += dt;
    const t = this.elapsed;
    const l = this.layout;

    // 狗狗往手指的位置跑
    const before = this.dogX;
    this.dogX = moveDog(this.dogX, this.targetX, dt);
    const moving = Math.abs(this.dogX - before) > 1e-6;
    if (moving) this.facing = this.dogX > before ? 1 : -1;

    // 落地的飛盤：看狗狗在不在落點
    let changed = false;
    this.plan.forEach((th, i) => {
      if (this.outcomes[i] !== null || t < th.at + th.flight) return;
      const ok = frisbeeCaught(th, this.dogX);
      this.outcomes[i] = ok;
      changed = true;
      this.popNote(fieldX(l, th.landX), ok);
      if (ok) {
        this.caughtAt = t;
        playSfx('equip');
      }
      if (i === this.plan.length - 1) this.endAt = t + RESULT_DELAY_MS;
    });
    if (t > 2600 && this.tip.text) this.tip.setText('');

    // 狗狗：跑的時候一顛一顛，接到跳一下
    const sp = this.sprite!;
    const jump = t - this.caughtAt;
    const lift =
      jump < JUMP_MS
        ? Math.sin((jump / JUMP_MS) * Math.PI) * 26
        : moving
          ? Math.abs(Math.sin(t / 70)) * 5
          : 0;
    sp.setPosition(fieldX(l, this.dogX), l.groundY - lift);
    sp.setScale(l.dogScale * this.facing, l.dogScale);

    this.drawDiscs(t);
    if (changed) {
      this.drawHud();
      this.publish();
    } else {
      this.publishMoving();
    }
    if (t >= this.endAt) this.finish();
  }

  /** 畫空中的飛盤、地上的影子，還有剛接到叼在嘴上的那一個 */
  private drawDiscs(t: number): void {
    const g = this.discs;
    const l = this.layout;
    g.clear();
    this.plan.forEach((th, i) => {
      const pos = frisbeePos(th, t);
      if (!pos) return;
      const lx = fieldX(l, th.landX);
      if (this.outcomes[i] === null) {
        // 落點的影子：越接近落地越大越深，旁邊一圈是接得到的範圍
        const k = 0.35 + 0.65 * pos.p;
        g.fillStyle(0x000000, 0.12 + 0.22 * pos.p);
        g.fillEllipse(lx, l.groundY + 2, 64 * k, 14 * k);
        g.lineStyle(2, 0xffffff, 0.55);
        g.strokeEllipse(lx, l.groundY + 2, FRISBEE_REACH * l.field.width * 2, 16);
        this.disc(g, fieldX(l, pos.x), fieldY(l, pos.y), 1, Math.sin(t / 90 + i) * 0.25);
        return;
      }
      const since = t - (th.at + th.flight);
      if (this.outcomes[i]) {
        // 接到：叼在嘴上一下
        if (since < HOLD_MS) {
          const sp = this.sprite!;
          this.disc(g, sp.x + this.facing * 34, sp.y - 46, 0.8, 0);
        }
      } else if (since < 500) {
        // 沒接到：掉在地上彈一下就不見
        const y =
          l.groundY - 4 - Math.abs(Math.sin((since / 500) * Math.PI * 2)) * 10 * (1 - since / 500);
        this.disc(g, lx + (since / 500) * 14, y, 1 - since / 1000, 0);
      }
    });
  }

  /** 一個飛盤：扁扁的橢圓，tilt 讓它飛的時候晃一晃 */
  private disc(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    s: number,
    tilt: number,
  ): void {
    const w = 36 * s;
    const h = (11 + tilt * 8) * s;
    g.fillStyle(DISC.red, 1);
    g.lineStyle(2, COLORS.inkHex, 1);
    g.fillEllipse(x, y, w, h);
    g.strokeEllipse(x, y, w, h);
    g.fillStyle(DISC.rim, 0.9);
    g.fillEllipse(x, y - h * 0.12, w * 0.5, h * 0.42);
  }

  /** 落點冒出一句「接到！」或「差一點」 */
  private popNote(x: number, ok: boolean): void {
    const l = this.layout;
    const note = addText(
      this,
      x,
      l.groundY - 96,
      ok ? '接到！' : '差一點',
      18,
      ok ? '#fff3b0' : '#ffffff',
      true,
    )
      .setOrigin(0.5)
      .setStroke(ok ? '#b5651d' : '#5b6770', 4)
      .setDepth(31);
    this.tweens.add({
      targets: note,
      y: note.y - 28,
      alpha: 0,
      duration: 800,
      onComplete: () => note.destroy(),
    });
  }

  /** 上方的計分：接到幾個，加一排小飛盤（接到紅色、沒接到灰色打叉、還沒丟空心） */
  private drawHud(): void {
    const l = this.layout;
    const catches = this.outcomes.filter((o) => o === true).length;
    this.scoreText.setText(`接到 ${catches}／${this.plan.length}`);
    const g = this.hud;
    g.clear();
    this.outcomes.forEach((o, i) => {
      const x = l.marks.x + i * l.marks.gap;
      const y = l.marks.y;
      g.lineStyle(2, COLORS.inkHex, 1);
      g.fillStyle(o === true ? DISC.red : o === false ? 0x9aa3a8 : 0xffffff, o === null ? 0.5 : 1);
      g.fillEllipse(x, y, 18, 9);
      g.strokeEllipse(x, y, 18, 9);
      if (o === false) {
        g.lineBetween(x - 5, y - 5, x + 5, y + 5);
        g.lineBetween(x - 5, y + 5, x + 5, y - 5);
      }
    });
  }

  // ---- 結算 ----

  private finish(): void {
    this.phase = 'result';
    const catches = this.outcomes.filter((o) => o === true).length;
    const now = Date.now();
    const r = finishFrisbee(
      tick(),
      this.dogId,
      catches,
      now,
      createRng(mixSeed(now, 0xd15c)),
      timeOptions(),
      this.plan.length,
    );
    setState(r.state);
    this.result = r.result;
    this.discs.clear();
    this.sprite!.setPosition(fieldX(this.layout, this.dogX), this.layout.groundY);
    playSfx(r.result.gain && r.result.gain.toLevel > r.result.gain.fromLevel ? 'levelup' : 'win');
    this.openResult(r.result);
  }

  private openResult(res: FrisbeeResult): void {
    const d = this.dog();
    const lines: { text: string; color: string }[] = [];
    if (res.newBest) lines.push({ text: '新紀錄！', color: '#b5651d' });
    if (res.rewarded && res.gain) {
      const g = res.gain;
      lines.push({
        text: g.exp > 0 ? `${d.name} 經驗 +${g.exp}` : `${d.name} 已經滿級，經驗沒有增加`,
        color: '#2f7d32',
      });
      if (g.toLevel > g.fromLevel) {
        lines.push({
          text: `Lv.${g.fromLevel} → Lv.${g.toLevel}\u3000${formatGain(g)}`,
          color: '#2f7d32',
        });
      }
      if (res.snack) {
        lines.push({
          text: `全部接到！再送 ${snackLabel(res.snack.id, res.snack.amount)}`,
          color: '#b5651d',
        });
      }
    } else {
      lines.push({ text: '今天的獎勵領過了，明天 05:00 後再來', color: COLORS.inkSoft });
    }

    const { layer, box } = openModal(this, { width: 440, height: 250 }, () => undefined);
    this.resultLayer = layer;
    const cx = box.x + box.width / 2;
    layer.add([
      addText(
        this,
        cx,
        box.y + 18,
        `接到 ${res.catches}／${res.total}`,
        24,
        COLORS.ink,
        true,
      ).setOrigin(0.5, 0),
      addText(
        this,
        cx,
        box.y + 54,
        frisbeeComment(res.catches, res.total),
        14,
        COLORS.inkSoft,
      ).setOrigin(0.5, 0),
    ]);
    lines.forEach((ln, i) => {
      layer.add(
        addText(this, cx, box.y + 84 + i * 24, ln.text, 15, ln.color, true).setOrigin(0.5, 0),
      );
    });
    const bw = (box.width - 48) / 2;
    const by = box.y + box.height - 60;
    const back: Rect = { x: box.x + 16, y: by, width: bw, height: 46 };
    const again: Rect = { x: box.x + 32 + bw, y: by, width: bw, height: 46 };
    const backButton = new Button(
      this,
      back,
      '回訓練場',
      () => this.scene.start('TrainingScene'),
      18,
    );
    const againButton = new Button(this, again, '再玩一次（沒有獎勵）', () => this.startPlay(), 16);
    againButton.setColor(0x8a6f55);
    layer.add([backButton, againButton]);
    this.resultRects = { again, back };
    this.publish();
  }

  // ---- 給畫面測試看的狀態 ----

  private publish(): void {
    const st = getState();
    const l = this.layout;
    const res = this.result;
    patchDebug({
      frisbee: {
        phase: this.phase,
        ready: frisbeeReady(st, Date.now(), timeOptions()),
        dogId: this.dogId,
        best: st.frisbee.best,
        total: this.plan.length || FRISBEE_COUNT,
        reward: { min: frisbeeReward(st, 0).exp, max: frisbeeReward(st, FRISBEE_COUNT).exp },
        cells: this.ownedIds.map((id, i) => ({ ...l.cells[i], id, selected: id === this.dogId })),
        start: l.start,
        field: l.field,
        plan: this.plan.map((th) => ({ landX: fieldX(l, th.landX), at: th.at, flight: th.flight })),
        outcomes: [...this.outcomes],
        catches: this.outcomes.filter((o) => o === true).length,
        dogX: fieldX(l, this.dogX),
        elapsed: this.elapsed,
        result:
          res && this.resultRects
            ? {
                catches: res.catches,
                rewarded: res.rewarded,
                newBest: res.newBest,
                exp: res.gain?.exp ?? 0,
                fromLevel: res.gain?.fromLevel ?? 0,
                toLevel: res.gain?.toLevel ?? 0,
                snack: res.snack,
                ...this.resultRects,
              }
            : null,
      },
    });
  }

  /** 每一格畫面只更新會動的數字，不整包重做 */
  private publishMoving(): void {
    const f = window.__WGZ__?.frisbee;
    if (!f) return;
    f.dogX = fieldX(this.layout, this.dogX);
    f.elapsed = this.elapsed;
  }
}
