import Phaser from 'phaser';
import { COLORS, RARITY_COLORS } from '../config';
import { bioOf } from '../data/bios';
import { DOGS, findDog, type DogData } from '../data/dogs';
import { wt } from '../data/worldText';
import { PIXEL_SIZE } from '../logic/atmosphere';
import {
  BOND_GIFT,
  bondUpText,
  bondView,
  canPet,
  giftBlock,
  giftBlockText,
  giftLine,
  giftSnack,
  giftsLeft,
  petDog,
  petLine,
} from '../logic/bond';
import { bodyScale } from '../logic/dogSize';
import { gearOf } from '../logic/equipment';
import { playerFaction } from '../logic/faction';
import { countQuest } from '../logic/quests';
import {
  HOME_AREA_LABEL,
  HOME_MAX,
  HOME_STYLES,
  clearFurniture,
  findHomeStyle,
  furnitureOf,
  homePlaced,
  homeResidents,
  moveFurniture,
  setHomeArea,
  setHomeStyle,
  toggleFurniture,
  toggleResident,
  type FurnitureData,
  type HomeArea,
  type HomeSpot,
} from '../logic/home';
import {
  HOME_BAR,
  homeCardLayout,
  homeLayout,
  homeModalGrid,
  petAt,
  petBox,
  spotOf,
  xyOf,
  type HomeCardLayout,
  type HomeLayout,
} from '../logic/homeLayout';
import type { Rect } from '../logic/layout';
import { SNACKS, snackCount } from '../logic/snacks';
import { getState, setState, tick, timeOptions } from '../state/store';
import { playSfx } from './components/audio';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { DogSprite, type DogAction } from './components/DogSprite';
import {
  FURNITURE_BOX,
  drawFurniture,
  drawFurnitureFront,
  hasFurnitureFront,
} from './components/furnitureArt';
import { makeTapArea } from './components/hitArea';
import { drawIndoor, drawStyleSwatch, drawYard } from './components/homeArt';
import { pixelize } from './components/pixelStage';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

/** 角色走路的速度（每秒幾點） */
const WALK_SPEED = 64;
/** 家裡的角色畫多大（再乘上體型） */
const PET_SCALE = 0.44;
/** 家具畫多大（家具圖是照 1 倍畫的） */
const FURN_SCALE = 1.2;
/** 家具拖超過這個距離才算搬動，不然當成點一下 */
const DRAG_MIN = 8;

type ModalKind = 'residents' | 'furniture' | 'style';

interface Piece {
  item: FurnitureData;
  /** 現在畫在哪裡（玩具被追著跑時會暫時離開原位） */
  x: number;
  y: number;
  body: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container | null;
  /** 正在用這件家具的角色 */
  user: string | null;
}

interface Pet {
  dog: DogData;
  sprite: DogSprite;
  scale: number;
  x: number;
  y: number;
  /** 離地多高（待在家具上） */
  lift: number;
  facing: 1 | -1;
  mode: 'idle' | 'walk' | 'use';
  tx: number;
  ty: number;
  /** 要去用的家具 */
  goal: Piece | null;
  /** 這個狀態到什麼時候結束（場景時間，毫秒） */
  until: number;
}

/** 平面的家具：永遠畫在角色腳下 */
const FLAT = new Set(['rug', 'pool', 'pond', 'picnic', 'cushion', 'frisbee']);
/** 坐、看的時候直接待在家具上面，不是站旁邊 */
const ON_TOP = new Set(['rug', 'picnic', 'cushion']);

/**
 * 我的家（T033）：主頁的腳印按鈕進來。屋內與庭院兩個場景，最多住五隻角色，
 * 牠們會自己走來走去、去玩擺出來的家具。家具可以用手指拖到喜歡的位置。
 * 點一下角色可以摸摸牠（和主頁算同一次）、送牠零食加好感度（T044，規則在 src/logic/bond.ts）。
 * 規則與資料在 src/logic/home.ts，版面在 src/logic/homeLayout.ts。
 */
export class HomeScene extends Phaser.Scene {
  private layout!: HomeLayout;
  private area: HomeArea = 'indoor';
  private pieces: Piece[] = [];
  private pets: Pet[] = [];
  private modal: Phaser.GameObjects.Container | null = null;
  private modalKind: ModalKind | null = null;
  private modalPage = 0;
  private modalDirty = false;
  private toast: Phaser.GameObjects.Text | null = null;
  private rnd: () => number = Math.random;
  /** 正在互動的角色與牠的互動卡（T044） */
  private sel: Pet | null = null;
  private card: Phaser.GameObjects.Container | null = null;
  private cardLayout!: HomeCardLayout;
  private bubble: Phaser.GameObjects.Text | null = null;
  private line = '';
  private talkCount = 0;
  private cardDebug: NonNullable<WgzDebugState['home']>['card'] = null;
  private ring: Phaser.GameObjects.Ellipse | null = null;

  constructor() {
    super('HomeScene');
  }

  create(): void {
    resetDebug(this);
    const { w, h } = viewOf(this);
    const st = tick();
    this.layout = homeLayout(w, h);
    this.cardLayout = homeCardLayout(w, h);
    this.sel = null;
    this.card = null;
    this.bubble = null;
    this.line = '';
    this.cardDebug = null;
    this.area = st.home.area;
    this.pieces = [];
    this.pets = [];
    this.modal = null;
    this.modalKind = null;
    this.modalDirty = false;
    this.toast = null;
    const l = this.layout;
    const style = findHomeStyle(st.home.style);

    // 背景：照風格畫，整張拍成像素圖
    const bg = this.add.graphics();
    const stage: Rect = { x: 0, y: HOME_BAR, width: w, height: h - HOME_BAR };
    if (this.area === 'indoor') drawIndoor(bg, stage, l.horizon, style);
    else drawYard(bg, stage, l.horizon, style);
    this.add.existing(pixelize(this, bg, stage, PIXEL_SIZE).setDepth(-20));
    if (this.area === 'yard') this.addDrift(style.drift);

    const back = drawHeader(
      this,
      `我的家・${HOME_AREA_LABEL[this.area]}`,
      () => this.scene.start('LobbyScene'),
      HOME_BAR,
    );
    const other: HomeArea = this.area === 'indoor' ? 'yard' : 'indoor';
    const mk = (r: Rect, text: string, fn: () => void, color?: number): void => {
      const b = new Button(this, r, text, fn, 15).setDepth(51);
      if (color) b.setColor(color);
    };
    mk(l.buttons.area, `去${HOME_AREA_LABEL[other]}`, () => this.switchArea(other), COLORS.harvest);
    mk(l.buttons.residents, '住戶', () => this.openModalOf('residents'));
    mk(l.buttons.furniture, '家具', () => this.openModalOf('furniture'));
    mk(l.buttons.style, '風格', () => this.openModalOf('style'));

    for (const p of homePlaced(st, playerFaction(st), this.area)) this.addPiece(p.item, p.spot);
    for (const id of homeResidents(st)) this.addPet(id);
    this.setupDrag();
    this.ring = this.add.ellipse(0, 0, 64, 18, 0xfff3a0, 0.55).setVisible(false);
    this.ring.setStrokeStyle(2, 0xe0452b, 0.8);

    if (this.pets.length === 0) this.say(wt('還沒有住戶，按右上的「住戶」請狗狗住進來'));
    else if (this.pieces.length === 0) this.say('這裡空空的，按右上的「家具」擺點東西');
    else if (this.pets.some((p) => canPet(st, p.dog.id, Date.now(), timeOptions()))) {
      this.say('點一下角色可以摸摸牠、送牠零食');
    }

    patchDebug({ backButton: back });
    this.publish();
  }

  // ---------------- 家具 ----------------

  private addPiece(item: FurnitureData, spot: HomeSpot): void {
    const { x, y } = xyOf(this.layout, spot);
    const shot = (draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.Container => {
      const c = this.add.container(x, y).setScale(FURN_SCALE);
      const g = this.add.graphics();
      draw(g);
      c.add([g, pixelize(this, g, FURNITURE_BOX, PIXEL_SIZE)]);
      return c;
    };
    const body = shot((g) => drawFurniture(g, item.id));
    const front = hasFurnitureFront(item.id) ? shot((g) => drawFurnitureFront(g, item.id)) : null;
    body.setSize(96, 84);
    body.setInteractive(
      // 容器的點擊範圍從「大小框」的左上角算起（原點在框的正中央），所以要往下移半個框
      new Phaser.Geom.Rectangle(0, -34, 96, 84),
      Phaser.Geom.Rectangle.Contains,
    );
    const piece: Piece = { item, x, y, body, front, user: null };
    body.setData('piece', piece);
    this.pieces.push(piece);
    this.layer(piece);
  }

  /** 照位置決定誰蓋住誰：越靠近鏡頭（y 越大）越上面；平面的家具墊在最下面 */
  private layer(p: Piece): void {
    p.body.setPosition(p.x, p.y).setDepth(FLAT.has(p.item.id) ? -5 + p.y / 1000 : p.y);
    p.front?.setPosition(p.x, p.y).setDepth(p.y + 0.6);
  }

  /** 家具可以按住拖到別的位置；沒拖動就當成點一下，顯示名字與說明 */
  private setupDrag(): void {
    let held: Piece | null = null;
    let moved = false;
    let ox = 0;
    let oy = 0;
    // 按下去的位置：在場地上（不是標題列、互動卡、彈出視窗）才算，放開時沒移動就是「點一下」
    let press: { x: number; y: number } | null = null;
    this.input.on(
      'pointerdown',
      (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        press = null;
        if (this.modal) return;
        if (ptr.worldY < HOME_BAR || this.onCard(ptr.worldX, ptr.worldY)) return;
        press = { x: ptr.worldX, y: ptr.worldY };
        // 重疊時拿最前面那一件
        const hit = over
          .map((o) => o.getData('piece') as Piece | undefined)
          .filter((p): p is Piece => !!p)
          .sort((a, b) => b.y - a.y)[0];
        if (!hit) return;
        held = hit;
        moved = false;
        ox = hit.x - ptr.worldX;
        oy = hit.y - ptr.worldY;
      },
    );
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!held || !ptr.isDown) return;
      const nx = ptr.worldX + ox;
      const ny = ptr.worldY + oy;
      if (!moved && Math.hypot(nx - held.x, ny - held.y) < DRAG_MIN) return;
      if (!moved) {
        moved = true;
        this.release(held);
        this.tweens.killTweensOf(held.body);
      }
      const spot = spotOf(this.layout, nx, ny);
      const at = xyOf(this.layout, spot);
      held.x = at.x;
      held.y = at.y;
      this.layer(held);
    });
    const drop = (ptr: Phaser.Input.Pointer): void => {
      const p = held;
      const at = press;
      held = null;
      press = null;
      if (!moved && at && !this.modal) {
        // 點一下：先看有沒有點到角色（角色站在家具前面或上面時，摸的是角色）
        const still = Math.hypot(ptr.worldX - at.x, ptr.worldY - at.y) < DRAG_MIN;
        const i = still
          ? petAt(
              this.pets.map((x) => this.boxOf(x)),
              at.x,
              at.y,
            )
          : -1;
        if (i >= 0) {
          this.tapPet(this.pets[i]);
          return;
        }
        if (!p && still && this.sel) this.closeCard();
      }
      if (!p) return;
      if (!moved) {
        this.say(`${p.item.name}：${p.item.note}`);
        return;
      }
      playSfx('tap');
      const st = getState();
      setState(moveFurniture(st, playerFaction(st), p.item.id, spotOf(this.layout, p.x, p.y)));
      this.publish();
    };
    this.input.on('pointerup', drop);
    this.input.on('pointerupoutside', drop);
  }

  /** 家具被搬走：正在用的角色先下來 */
  private release(p: Piece): void {
    const pet = this.pets.find((x) => x.dog.id === p.user || x.goal === p);
    if (pet) this.rest(pet, this.time.now);
    p.user = null;
  }

  // ---------------- 摸摸與送零食（T044） ----------------

  /** 角色可以點的範圍（跟著牠現在的位置） */
  private boxOf(pet: Pet): Rect {
    return petBox(pet.x, pet.y - pet.lift, pet.scale);
  }

  private onCard(x: number, y: number): boolean {
    if (!this.card) return false;
    const b = this.cardLayout.box;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  /** 點一下角色：摸摸牠（今天第一次會加好感度），並打開下面的互動卡 */
  private tapPet(pet: Pet): void {
    playSfx('tap');
    if (this.sel && this.sel !== pet) this.letGo(this.sel);
    this.sel = pet;
    // 牠會停下來看你，卡片關掉才繼續去玩
    if (pet.mode === 'walk') {
      if (pet.goal?.user === pet.dog.id) pet.goal.user = null;
      pet.goal = null;
      pet.mode = 'idle';
      pet.lift = 0;
    }
    pet.until = Infinity;
    pet.sprite.play('wag');
    const id = pet.dog.id;
    const r = petDog(getState(), id, Date.now(), timeOptions());
    // 每週任務（T045）「摸摸角色」算一次
    if (r.gained > 0) setState(countQuest(r.state, 'pet'));
    this.heart(pet, r.gained > 0 ? `♥ 好感 +${r.gained}` : '♥', r.gained > 0);
    this.talkCount += 1;
    this.talk(
      pet,
      petLine(bondView(getState(), id).level, this.talkCount + id.length, bioOf(id)?.likes),
    );
    if (r.ups.length > 0) {
      playSfx('levelup');
      this.say(bondUpText(r.ups));
    }
    this.renderCard();
  }

  /** 送一個零食給正在互動的角色 */
  private gift(snackId: string): void {
    const pet = this.sel;
    if (!pet) return;
    const id = pet.dog.id;
    const r = giftSnack(getState(), id, snackId, Date.now(), timeOptions());
    if (r.block) {
      this.say(giftBlockText(r.block));
      return;
    }
    setState(r.state);
    playSfx(r.ups.length > 0 ? 'levelup' : 'heal');
    pet.sprite.play('lick');
    this.heart(pet, `♥ 好感 +${r.gained}`, true);
    this.talkCount += 1;
    const snack = SNACKS.find((x) => x.id === snackId);
    this.talk(pet, giftLine(bondView(r.state, id).level, this.talkCount, snack?.name ?? ''));
    if (r.ups.length > 0) this.say(bondUpText(r.ups));
    this.renderCard();
  }

  /** 角色頭上往上飄的愛心 */
  private heart(pet: Pet, text: string, gained: boolean): void {
    const b = this.boxOf(pet);
    const heart = addText(this, pet.x, b.y - 46, text, gained ? 18 : 26, '#e0452b', true)
      .setOrigin(0.5)
      .setStroke('#ffffff', 4)
      .setDepth(945);
    this.tweens.add({
      targets: heart,
      y: heart.y - 34,
      alpha: 0,
      duration: gained ? 1400 : 900,
      onComplete: () => heart.destroy(),
    });
  }

  /** 角色頭上的對話泡泡 */
  private talk(pet: Pet, text: string): void {
    this.line = text;
    this.bubble?.destroy();
    const { w } = viewOf(this);
    const b = this.boxOf(pet);
    const bubble = addText(
      this,
      pet.x,
      Math.max(HOME_BAR + 34, b.y - 2),
      text,
      14,
      COLORS.ink,
      true,
    )
      .setOrigin(0.5, 1)
      .setBackgroundColor('#fffaf0')
      .setPadding(9, 5, 9, 5)
      .setDepth(940);
    // 站在畫面邊邊時泡泡不要跑出去
    const half = bubble.width / 2 + 6;
    bubble.x = Math.min(w - half, Math.max(half, bubble.x));
    this.bubble = bubble;
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 2000,
      duration: 300,
      onComplete: () => {
        bubble.destroy();
        if (this.bubble === bubble) this.bubble = null;
      },
    });
  }

  /** 互動完了，過一下下就繼續去玩 */
  private letGo(pet: Pet): void {
    pet.until = this.time.now + 700;
  }

  private closeCard(): void {
    if (this.sel) this.letGo(this.sel);
    this.sel = null;
    this.card?.destroy();
    this.card = null;
    this.cardDebug = null;
    this.publish();
  }

  /** 畫面下面的互動卡：名字、好感度、三種零食 */
  private renderCard(): void {
    this.card?.destroy();
    this.card = null;
    this.cardDebug = null;
    const pet = this.sel;
    if (!pet) return;
    const st = getState();
    const id = pet.dog.id;
    const now = Date.now();
    const c = this.cardLayout;
    const v = bondView(st, id);
    const left = giftsLeft(st, id, now, timeOptions());
    const layer = (this.card = this.add.container(0, 0).setDepth(960));
    const g = this.add.graphics();
    g.fillStyle(COLORS.card, 0.96);
    g.lineStyle(3, COLORS.cardBorder, 1);
    g.fillRoundedRect(c.box.x, c.box.y, c.box.width, c.box.height, 14);
    g.strokeRoundedRect(c.box.x, c.box.y, c.box.width, c.box.height, 14);
    const progress = v.max ? '（滿了）' : `（${v.into}／${v.need}）`;
    const second = v.max
      ? '好感度滿了，謝謝你一直陪牠'
      : left > 0
        ? `今天還能送零食 ${left} 次`
        : '今天吃飽了，明天再送';
    layer.add([
      g,
      addText(
        this,
        c.info.x,
        c.info.y,
        `${pet.dog.name}\u3000♥${v.level}${progress}`,
        16,
        COLORS.ink,
        true,
      ),
      addText(this, c.info.x, c.info.y + 24, second, 12, COLORS.inkSoft),
    ]);
    const gifts = SNACKS.map((snack, i) => {
      const r = c.gifts[i];
      const count = snackCount(st, snack.id);
      const ok = giftBlock(st, id, snack.id, now, timeOptions()) === null;
      const b = new Button(this, r, '', () => this.gift(snack.id), 13);
      b.setColor(ok ? snack.color : COLORS.buttonDisabled);
      layer.add([
        b,
        addText(
          this,
          r.x + r.width / 2,
          r.y + 14,
          `${snack.name} ×${count}`,
          13,
          '#ffffff',
          true,
        ).setOrigin(0.5),
        addText(
          this,
          r.x + r.width / 2,
          r.y + 31,
          `好感 +${BOND_GIFT[snack.id]}`,
          11,
          '#ffffff',
        ).setOrigin(0.5),
      ]);
      return { id: snack.id, count, ok, ...r };
    });
    layer.add(
      new Button(this, c.close, '✕', () => this.closeCard(), 18).setColor(COLORS.buttonDisabled),
    );
    this.cardDebug = {
      dogId: id,
      level: v.level,
      points: v.points,
      left,
      line: this.line,
      gifts,
      close: c.close,
    };
    this.publish();
  }

  // ---------------- 角色 ----------------

  private addPet(id: string): void {
    const dog = findDog(id);
    if (!dog) return;
    const l = this.layout;
    const scale = PET_SCALE * bodyScale(dog.size);
    const x = l.field.x + (0.12 + this.rnd() * 0.76) * l.field.width;
    const y = l.field.y + (0.25 + this.rnd() * 0.7) * l.field.height;
    const sprite = new DogSprite(this, x, y, {
      color: dog.color,
      accent: dog.accent,
      gear: gearOf(getState(), dog.id),
      breed: dog.breed,
      photo: dog.id,
      pixel: PIXEL_SIZE / scale,
    });
    sprite.setScale(scale).setDepth(y);
    sprite.play('idle');
    this.pets.push({
      dog,
      sprite,
      scale,
      x,
      y,
      lift: 0,
      facing: this.rnd() < 0.5 ? 1 : -1,
      mode: 'idle',
      tx: x,
      ty: y,
      goal: null,
      until: this.time.now + 600 + this.rnd() * 2400,
    });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    for (const pet of this.pets) {
      if (pet.mode === 'walk') this.walk(pet, time, dt);
      else if (time >= pet.until) this.next(pet);
      const bob = pet.mode === 'walk' ? Math.abs(Math.sin(time / 80)) * 3 : 0;
      pet.sprite.setPosition(pet.x, pet.y - pet.lift - bob);
      pet.sprite.setScale(pet.scale * pet.facing, pet.scale);
      pet.sprite.setDepth(pet.y + (pet.mode === 'use' ? 0.3 : 0));
    }
    // 正在互動的角色腳下有一圈亮亮的，看得出互動卡是誰的
    this.ring?.setVisible(!!this.sel);
    if (this.sel && this.ring) {
      const p = this.sel;
      this.ring.setPosition(p.x, p.y - p.lift + 2).setDepth(p.y - 0.2);
      this.ring.setScale(p.scale / PET_SCALE);
    }
    // 角色會走動，可以點的範圍每一格都更新給畫面測試
    const dbg = window.__WGZ__?.home;
    if (dbg) dbg.pets = this.petsDebug();
  }

  private petsDebug(): NonNullable<WgzDebugState['home']>['pets'] {
    const st = getState();
    const now = Date.now();
    return this.pets.map((p) => ({
      id: p.dog.id,
      level: bondView(st, p.dog.id).level,
      canPet: canPet(st, p.dog.id, now, timeOptions()),
      moving: p.mode === 'walk',
      ...this.boxOf(p),
    }));
  }

  private walk(pet: Pet, time: number, dt: number): void {
    const dx = pet.tx - pet.x;
    const dy = pet.ty - pet.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt;
    if (dist <= step) {
      pet.x = pet.tx;
      pet.y = pet.ty;
      if (pet.goal && pet.goal.user === pet.dog.id) this.use(pet, pet.goal, time);
      else this.rest(pet, time);
      return;
    }
    if (Math.abs(dx) > 1) pet.facing = dx > 0 ? 1 : -1;
    pet.x += (dx / dist) * step;
    pet.y += (dy / dist) * step;
  }

  /** 停下來發呆一下 */
  private rest(pet: Pet, time: number): void {
    if (pet.goal?.user === pet.dog.id) pet.goal.user = null;
    pet.goal = null;
    pet.mode = 'idle';
    pet.lift = 0;
    // 正在互動的角色留在原地，等互動卡關掉
    pet.until = pet === this.sel ? Infinity : time + 1500 + this.rnd() * 3000;
    const acts: DogAction[] = ['idle', 'wag', 'look', 'sit', 'idle'];
    pet.sprite.play(acts[Math.floor(this.rnd() * acts.length)]);
  }

  /** 決定接下來做什麼：去玩一件沒人用的家具，或是隨便走走 */
  private next(pet: Pet): void {
    if (pet.goal?.user === pet.dog.id) pet.goal.user = null;
    pet.goal = null;
    pet.lift = 0;
    const l = this.layout;
    const free = this.pieces.filter((p) => !p.user);
    if (free.length > 0 && this.rnd() < 0.65) {
      const goal = free[Math.floor(this.rnd() * free.length)];
      goal.user = pet.dog.id;
      pet.goal = goal;
      const at = this.standAt(goal);
      pet.tx = at.x;
      pet.ty = at.y;
    } else {
      pet.tx = l.field.x + (0.06 + this.rnd() * 0.88) * l.field.width;
      pet.ty = l.field.y + (0.2 + this.rnd() * 0.78) * l.field.height;
    }
    pet.mode = 'walk';
    pet.sprite.play('idle');
  }

  /** 要用這件家具時站在哪裡 */
  private standAt(p: Piece): { x: number; y: number; face?: 1 | -1 } {
    const l = this.layout;
    const side: 1 | -1 = p.x > l.field.x + l.field.width / 2 ? -1 : 1;
    const clampX = (x: number): number =>
      Math.min(l.field.x + l.field.width, Math.max(l.field.x, x));
    switch (p.item.play) {
      case 'eat':
      case 'look':
        return { x: clampX(p.x + side * 46), y: p.y + 3, face: side === 1 ? -1 : 1 };
      case 'sit':
        if (p.item.lift > 0 || ON_TOP.has(p.item.id)) return { x: p.x, y: p.y + 1 };
        return { x: clampX(p.x + side * 42), y: p.y + 4, face: side === 1 ? -1 : 1 };
      case 'jump':
        return { x: clampX(p.x - 58), y: p.y + 2, face: 1 };
      case 'chase':
        return { x: clampX(p.x - 30), y: p.y + 2, face: 1 };
      default:
        return { x: p.x, y: p.y + 1 };
    }
  }

  /** 走到了，開始玩 */
  private use(pet: Pet, p: Piece, time: number): void {
    pet.mode = 'use';
    pet.until = time + 5000 + this.rnd() * 5000;
    const at = this.standAt(p);
    if (at.face) pet.facing = at.face;
    const sp = pet.sprite;
    switch (p.item.play) {
      case 'nap':
        pet.lift = p.item.lift * FURN_SCALE;
        sp.play('sleep');
        break;
      case 'sit':
        pet.lift = p.item.lift * FURN_SCALE;
        sp.play('sit');
        break;
      case 'perch':
        pet.lift = p.item.lift * FURN_SCALE;
        sp.play(this.rnd() < 0.5 ? 'sit' : 'look');
        break;
      case 'eat':
        sp.play('lick');
        break;
      case 'look':
        sp.play(this.rnd() < 0.5 ? 'look' : 'wag');
        break;
      case 'swim':
        pet.y = p.y - 16;
        sp.play('wag');
        break;
      case 'hide':
        pet.y = p.y - 2;
        sp.play('look');
        break;
      case 'jump': {
        // 來回跳過去兩趟
        pet.until = time + 2600;
        sp.play('idle');
        const hop = (to: number, then?: () => void): void => {
          pet.facing = to > pet.x ? 1 : -1;
          this.tweens.add({ targets: pet, x: to, duration: 520, ease: 'Sine.easeInOut' });
          this.tweens.add({
            targets: pet,
            lift: 46,
            duration: 260,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: then,
          });
        };
        const left = pet.x;
        hop(p.x + 58, () => this.time.delayedCall(500, () => pet.mode === 'use' && hop(left)));
        break;
      }
      case 'chase': {
        // 玩具滾（飛）出去，追過去
        const l = this.layout;
        const dir = p.x > l.field.x + l.field.width * 0.5 ? -1 : 1;
        const to = Math.min(
          l.field.x + l.field.width - 20,
          Math.max(l.field.x + 20, p.x + dir * (90 + this.rnd() * 110)),
        );
        const ms = 900;
        this.tweens.add({ targets: p, x: to, duration: ms, ease: 'Quad.easeOut' });
        if (p.item.id === 'frisbee') {
          this.tweens.add({ targets: p.body.list[1], y: '-=46', duration: ms / 2, yoyo: true });
        }
        this.tweens.addCounter({ duration: ms, onUpdate: () => this.layer(p) });
        pet.mode = 'walk';
        pet.goal = null;
        p.user = null;
        pet.tx = to - dir * 26;
        pet.ty = p.y + 2;
        sp.play('wag');
        break;
      }
    }
  }

  // ---------------- 其他 ----------------

  /** 庭院天上飄的小東西（花瓣、雪、葉子、螢火蟲） */
  private addDrift(kind: 'petal' | 'snow' | 'leaf' | 'firefly' | undefined): void {
    if (!kind || getState().settings.quality === 'low') return;
    const { w, h } = viewOf(this);
    const color = { petal: 0xf7b6cf, snow: 0xffffff, leaf: 0xe08a3c, firefly: 0xfff3a0 }[kind];
    for (let i = 0; i < 14; i++) {
      const dot = this.add
        .rectangle(this.rnd() * w, HOME_BAR + this.rnd() * (h - HOME_BAR), 4, 4, color)
        .setDepth(900);
      if (kind === 'firefly') {
        this.tweens.add({
          targets: dot,
          alpha: 0.15,
          x: dot.x + (this.rnd() - 0.5) * 60,
          y: dot.y + (this.rnd() - 0.5) * 40,
          duration: 1400 + this.rnd() * 1600,
          yoyo: true,
          repeat: -1,
        });
      } else {
        const ms = 5000 + this.rnd() * 5000;
        dot.y = HOME_BAR + 2;
        this.tweens.add({
          targets: dot,
          y: h + 10,
          x: dot.x + (kind === 'snow' ? 30 : 110),
          duration: ms,
          repeat: -1,
          delay: this.rnd() * ms,
        });
      }
    }
  }

  private say(text: string): void {
    this.toast?.destroy();
    const { w } = viewOf(this);
    const t = (this.toast = addText(this, w / 2, HOME_BAR + 14, text, 15, '#ffffff', true)
      .setOrigin(0.5, 0)
      .setStroke('#3b2a1a', 4)
      .setDepth(950));
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2600,
      duration: 500,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
    patchDebug({ home: { ...window.__WGZ__!.home!, note: text } });
  }

  private switchArea(area: HomeArea): void {
    setState(setHomeArea(getState(), area));
    this.scene.restart();
  }

  // ---------------- 彈出視窗：住戶、家具、風格 ----------------

  private openModalOf(kind: ModalKind): void {
    if (this.modal) return;
    if (this.sel) this.closeCard();
    this.modalKind = kind;
    this.modalPage = 0;
    this.modalDirty = false;
    this.renderModal();
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    this.modalKind = null;
    // 有改過就整個重畫（住戶、家具、風格都會變）
    if (this.modalDirty) this.scene.restart();
    else this.publish();
  }

  private renderModal(): void {
    this.modal?.destroy();
    const kind = this.modalKind!;
    const st = getState();
    const faction = playerFaction(st);
    const { layer, box } = openModal(this, { width: 720, height: 322 }, () => this.closeModal());
    this.modal = layer.setDepth(2000);
    const add = (...o: Phaser.GameObjects.GameObject[]): void => void layer.add(o);
    const cells: { id: string; on: boolean; rect: Rect }[] = [];
    const cell = (r: Rect, on: boolean, fn: () => void): Phaser.GameObjects.Container => {
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(on ? COLORS.cardSelected : 0xffffff, 1);
      g.lineStyle(on ? 3 : 2, on ? COLORS.button : COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 8);
      g.strokeRoundedRect(0, 0, r.width, r.height, 8);
      c.add(g);
      makeTapArea(c, r.width, r.height, 0);
      c.on('pointerup', () => {
        playSfx('tap');
        fn();
      });
      add(c);
      return c;
    };
    const change = (next: ReturnType<typeof getState>): void => {
      setState(next);
      this.modalDirty = true;
      this.renderModal();
    };

    let title: string;
    let hint: string;
    let pages = 1;
    if (kind === 'residents') {
      const now = homeResidents(st);
      title = `住在家裡的角色（${now.length}/${HOME_MAX}）`;
      hint = '點一下住進來，再點一下搬出去';
      const owned = DOGS.filter((d) => st.owned.includes(d.id)).sort(
        (a, b) => Number(now.includes(b.id)) - Number(now.includes(a.id)),
      );
      const grid = homeModalGrid(box, 10, 3);
      pages = Math.max(1, Math.ceil(owned.length / grid.length));
      this.modalPage = Math.min(this.modalPage, pages - 1);
      owned
        .slice(this.modalPage * grid.length, (this.modalPage + 1) * grid.length)
        .forEach((d, i) => {
          const r = grid[i];
          const on = now.includes(d.id);
          const c = cell(r, on, () => {
            const res = toggleResident(getState(), d.id);
            if (res.ok) change(res.state);
            else this.say(`最多住 ${HOME_MAX} 隻，先請一隻搬出去`);
          });
          const g = this.add.graphics();
          drawDogHead(g, r.width / 2, r.height / 2 - 8, 19, d.color, d.accent, {
            breed: d.breed,
            photo: d.id,
          });
          g.fillStyle(RARITY_COLORS[d.rarity ?? 'N'], 1);
          g.fillRect(4, 4, 6, 6);
          c.add([
            g,
            addText(this, r.width / 2, r.height - 9, d.name, 11, COLORS.ink, on).setOrigin(0.5),
          ]);
          cells.push({ id: d.id, on, rect: r });
        });
    } else if (kind === 'furniture') {
      const list = furnitureOf(this.area);
      const placed = homePlaced(st, faction, this.area).map((p) => p.item.id);
      title = `${HOME_AREA_LABEL[this.area]}的家具（擺出來 ${placed.length}/${list.length}）`;
      hint = '點一下擺出來或收起來；擺出來以後可以用手指拖到喜歡的位置';
      const grid = homeModalGrid(box, 5, 5);
      list.forEach((f, i) => {
        const r = grid[i];
        const on = placed.includes(f.id);
        const c = cell(r, on, () => change(toggleFurniture(getState(), faction, f.id)));
        const g = this.add
          .graphics()
          .setPosition(26, r.height - 5)
          .setScale(0.27);
        drawFurniture(g, f.id);
        c.add([g, addText(this, 54, r.height / 2, f.name, 13, COLORS.ink, on).setOrigin(0, 0.5)]);
        cells.push({ id: f.id, on, rect: r });
      });
    } else {
      title = '家的地形與風格';
      hint = '庭院的地形和屋內的顏色會一起換';
      const grid = homeModalGrid(box, 5, 3);
      HOME_STYLES.forEach((s, i) => {
        const r = grid[i];
        const on = st.home.style === s.id;
        const c = cell(r, on, () => change(setHomeStyle(getState(), s.id)));
        const g = this.add.graphics();
        drawStyleSwatch(g, { x: 5, y: 5, width: r.width - 10, height: r.height - 26 }, s);
        c.add([
          g,
          addText(this, r.width / 2, r.height - 11, s.name, 13, COLORS.ink, on).setOrigin(0.5),
        ]);
        cells.push({ id: s.id, on, rect: r });
      });
    }

    add(
      addText(this, box.x + 18, box.y + 12, wt(title), 17, COLORS.ink, true),
      addText(this, box.x + 18, box.y + box.height - 34, hint, 12, COLORS.inkSoft),
    );
    const close: Rect = {
      x: box.x + box.width - 104,
      y: box.y + box.height - 44,
      width: 90,
      height: 34,
    };
    add(new Button(this, close, '完成', () => this.closeModal(), 15));
    let clear: Rect | null = null;
    if (kind === 'furniture') {
      clear = { x: close.x - 120, y: close.y, width: 112, height: 34 };
      add(
        new Button(
          this,
          clear,
          '全部收起來',
          () => change(clearFurniture(getState(), faction, this.area)),
          14,
        ).setColor(COLORS.buttonDisabled),
      );
    }
    let prev: Rect | null = null;
    let next: Rect | null = null;
    if (pages > 1) {
      prev = { x: box.x + box.width - 200, y: box.y + 6, width: 40, height: 30 };
      next = { x: box.x + box.width - 60, y: box.y + 6, width: 40, height: 30 };
      const turn = (d: number) => (): void => {
        this.modalPage = (this.modalPage + d + pages) % pages;
        this.renderModal();
      };
      add(
        new Button(this, prev, '‹', turn(-1), 18),
        new Button(this, next, '›', turn(1), 18),
        addText(
          this,
          box.x + box.width - 110,
          box.y + 21,
          `${this.modalPage + 1}/${pages}`,
          14,
          COLORS.ink,
          true,
        ).setOrigin(0.5),
      );
    }
    this.publish({
      kind,
      cells: cells.map((c) => ({ id: c.id, on: c.on, ...c.rect })),
      close,
      clear,
      prev,
      next,
    });
  }

  private publish(
    modal: NonNullable<NonNullable<WgzDebugState['home']>['modal']> | null = null,
  ): void {
    const st = getState();
    patchDebug({
      home: {
        area: this.area,
        style: st.home.style,
        residents: this.pets.map((p) => p.dog.id),
        pieces: this.pieces.map((p) => ({
          id: p.item.id,
          x: p.x - 40,
          y: p.y - 60,
          width: 80,
          height: 60,
        })),
        buttons: this.layout.buttons,
        field: this.layout.field,
        note: window.__WGZ__?.home?.note ?? '',
        modal,
        pets: this.petsDebug(),
        card: this.cardDebug,
      },
    });
  }
}
