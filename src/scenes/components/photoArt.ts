import Phaser from 'phaser';
import lanjueBody from '../../assets/photo/lanjue-body.webp';
import lanjueHead from '../../assets/photo/lanjue-head.webp';

/**
 * 圖檔角色（T035）：有圖檔的角色用圖檔，沒有的照舊用程式畫（breedArt.ts）。
 * 要多換一隻：用 scripts/make-photo-art.py 做出全身與頭像兩張圖，在 PHOTO_ART 加一筆就好，
 * 其他畫面不用改（各畫面都把角色 id 傳給 drawDogHead／DogSprite 的 photo）。
 */
export interface PhotoArt {
  /** 貼圖名稱的開頭：`${key}-body`、`${key}-head` */
  key: string;
  body: string;
  head: string;
  /** 全身圖的寬除以高 */
  aspect: number;
  /** 站在場上的高度（DogSprite 自己的座標，程式畫的狗大約 140） */
  height: number;
  /**
   * 臉在全身圖上的位置，都以全身高為 1：x、y 是頭像那張正方形的中心（x 從圖的左邊算、y 從上面算），
   * half 是正方形的半邊長。頭飾與 OK 繃靠這個對位。
   */
  face: { x: number; y: number; half: number };
}

export const PHOTO_ART: Record<string, PhotoArt> = {
  // 藍爵（英國短毛貓）：第一隻試換的角色
  lanjue: {
    key: 'photo-lanjue',
    body: lanjueBody,
    head: lanjueHead,
    aspect: 0.5821,
    height: 158,
    face: { x: 0.268, y: 0.262, half: 0.268 },
  },
};

/** 頭像正方形的邊長是頭半徑 r 的幾倍；中心比臉的中心高 r 的幾倍（耳朵往上凸） */
export const PHOTO_HEAD_SIDE = 2.25;
export const PHOTO_HEAD_LIFT = 0.08;

/** 網址加 ?photo=0 可以整個關掉圖檔角色（新舊對照用） */
const enabled =
  typeof window === 'undefined' || new URLSearchParams(window.location.search).get('photo') !== '0';

export function photoArtOf(id: string | undefined): PhotoArt | undefined {
  return enabled && id ? PHOTO_ART[id] : undefined;
}

/** 開機時把所有圖檔角色載進來 */
export function preloadPhotoArt(scene: Phaser.Scene): void {
  for (const art of Object.values(PHOTO_ART)) {
    scene.load.image(`${art.key}-body`, art.body);
    scene.load.image(`${art.key}-head`, art.head);
  }
}

interface Companions {
  heads: { img: Phaser.GameObjects.Image; x: number; y: number; side: number }[];
  /** 蓋在頭像上面的那一層：頭飾、OK 繃 */
  over: Phaser.GameObjects.Graphics;
}

const COMPANIONS = new WeakMap<Phaser.GameObjects.Graphics, Companions>();
/** pixelize 會把原本的畫布藏起來，這時跟著它的頭像還是要顯示 */
export const PIXELIZED_KEY = 'photoKeepVisible';

/**
 * 在一張畫布（Graphics）上的 (x, y) 放一顆半徑 r 的圖檔頭像。
 * Graphics 自己不能貼圖，所以頭像是另外的物件，緊跟在畫布後面（同一個容器、同樣的位置縮放透明度），
 * 畫布 clear() 或收掉時一起收掉。回傳蓋在頭像上面的那一層，頭飾與 OK 繃要畫在那上面。
 */
export function addPhotoHead(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  art: PhotoArt,
  dark: boolean,
): Phaser.GameObjects.Graphics {
  const scene = g.scene;
  let c = COMPANIONS.get(g);
  if (!c) {
    const made: Companions = { heads: [], over: scene.make.graphics({}, false) };
    c = made;
    COMPANIONS.set(g, made);
    const drop = () => {
      for (const h of made.heads) h.img.destroy();
      made.heads = [];
      made.over.clear();
    };
    const clear = g.clear.bind(g);
    g.clear = () => {
      drop();
      return clear();
    };
    const sync = () => syncCompanions(g, made);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
    g.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
      drop();
      made.over.destroy();
      COMPANIONS.delete(g);
    });
  }
  const img = scene.make.image({ key: `${art.key}-head` }, false);
  if (dark) img.setTint(0x54483c);
  c.heads.push({ img, x, y: y - r * PHOTO_HEAD_LIFT, side: r * PHOTO_HEAD_SIDE });
  syncCompanions(g, c);
  return c.over;
}

function syncCompanions(g: Phaser.GameObjects.Graphics, c: Companions): void {
  const parent = g.parentContainer;
  const shown = (g.visible || g.getData(PIXELIZED_KEY) === true) && (!!parent || !!g.displayList);
  const cos = Math.cos(g.rotation);
  const sin = Math.sin(g.rotation);
  const objs: (Phaser.GameObjects.Image | Phaser.GameObjects.Graphics)[] = [
    ...c.heads.map((h) => h.img),
    c.over,
  ];
  // 跟著畫布待在同一個容器（或場景）裡，順序緊接在畫布後面
  let after: Phaser.GameObjects.GameObject = g;
  for (const o of objs) {
    if (parent) {
      if (o.parentContainer !== parent) parent.add(o);
      const want = parent.getIndex(after) + 1;
      if (parent.getIndex(o) !== want) parent.moveAbove(o as never, after as never);
    } else if (g.displayList) {
      if (o.parentContainer) o.parentContainer.remove(o);
      if (o.displayList !== g.displayList) g.displayList.add(o);
      if (g.displayList.getIndex(o) !== g.displayList.getIndex(after) + 1) {
        g.displayList.moveAbove(o, after);
      }
      o.setDepth(g.depth);
    }
    after = o;
    o.setVisible(shown).setAlpha(g.alpha).setScrollFactor(g.scrollFactorX, g.scrollFactorY);
    if (o.mask !== g.mask) {
      if (g.mask) o.setMask(g.mask);
      else o.clearMask();
    }
  }
  for (const h of c.heads) {
    const lx = h.x * g.scaleX;
    const ly = h.y * g.scaleY;
    h.img
      .setPosition(g.x + lx * cos - ly * sin, g.y + lx * sin + ly * cos)
      .setRotation(g.rotation)
      .setDisplaySize(h.side * Math.abs(g.scaleX), h.side * Math.abs(g.scaleY));
    if (g.scaleX < 0) h.img.setFlipX(true);
  }
  c.over.setPosition(g.x, g.y).setRotation(g.rotation).setScale(g.scaleX, g.scaleY);
}
