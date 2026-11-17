import Phaser from 'phaser';
import { PIXELIZED_KEY } from './photoArt';
import { blurTaps } from '../../logic/atmosphere';

/**
 * 像素立體光影畫面（T025）共用的小工具：柔光、光束、暗角的貼圖，還有把一張圖弄模糊（失焦）。
 * 貼圖都是程式現場畫的，沒有圖檔；整個遊戲只畫一次，之後每個畫面共用。
 */

export const TEX_GLOW = 'wgz-glow';
export const TEX_RAY = 'wgz-ray';
export const TEX_VIGNETTE = 'wgz-vignette';

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  paint(tex.context);
  tex.refresh();
}

/** 確定三張光影貼圖都畫好了 */
export function ensureLightTextures(scene: Phaser.Scene): void {
  // 柔光：中間亮、往外慢慢淡掉的一團白光
  canvasTexture(scene, TEX_GLOW, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  // 光束：上面亮、往下淡掉，左右兩邊也是柔的
  canvasTexture(scene, TEX_RAY, 64, 256, (ctx) => {
    const down = ctx.createLinearGradient(0, 0, 0, 256);
    down.addColorStop(0, 'rgba(255,255,255,0.9)');
    down.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    down.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, 64, 256);
    ctx.globalCompositeOperation = 'destination-in';
    const across = ctx.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 64, 256);
  });
  // 暗角：中間透明、四個角落變暗
  canvasTexture(scene, TEX_VIGNETTE, 256, 128, (ctx) => {
    ctx.save();
    ctx.scale(2, 1);
    const g = ctx.createRadialGradient(64, 64, 26, 64, 64, 92);
    g.addColorStop(0, 'rgba(12,8,20,0)');
    g.addColorStop(0.55, 'rgba(12,8,20,0.28)');
    g.addColorStop(1, 'rgba(12,8,20,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
  });
}

/**
 * 把一張小圖弄模糊：先橫向疊幾次、再直向疊幾次（每次錯開一格、算平均）。
 * 只在畫面建立時做一次，之後每一格就只是貼一張圖。會把傳進來的那張收掉，回傳模糊好的新圖。
 */
export function blurSheet(
  scene: Phaser.Scene,
  src: Phaser.GameObjects.RenderTexture,
  radius: number,
): Phaser.GameObjects.RenderTexture {
  const taps = blurTaps(radius);
  if (taps.length <= 1) return src;
  const make = () =>
    scene.make.renderTexture({ x: 0, y: 0, width: src.width, height: src.height }, false);
  const pass = (
    from: Phaser.GameObjects.RenderTexture,
    horizontal: boolean,
  ): Phaser.GameObjects.RenderTexture => {
    const to = make();
    from.setOrigin(0, 0).setScale(1);
    for (const t of taps) {
      from.setAlpha(t.alpha);
      to.draw(from, horizontal ? t.offset : 0, horizontal ? 0 : t.offset);
    }
    from.destroy();
    return to;
  };
  return pass(pass(src, true), false).setOrigin(0, 0);
}

/**
 * 把一張畫布（Graphics）變成像素圖：照 px 的格子畫進一張小圖，再用最近點放大回原本的大小。
 * 畫布本身藏起來留著（之後內容改了可以再呼叫一次，傳同一張 into 進來就會重畫）。
 * bounds 是畫布自己座標裡要拍下來的範圍。回傳的像素圖要自己加到畫布所在的容器裡。
 */
export function pixelize(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  bounds: { x: number; y: number; width: number; height: number },
  px: number,
  into?: Phaser.GameObjects.RenderTexture,
): Phaser.GameObjects.RenderTexture {
  const rt =
    into ??
    scene.make.renderTexture(
      {
        x: 0,
        y: 0,
        width: Math.ceil(bounds.width / px),
        height: Math.ceil(bounds.height / px),
      },
      false,
    );
  if (!into) {
    rt.setOrigin(0, 0).setScale(px);
    rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const { x, y, scaleX, scaleY, alpha } = g;
  rt.setPosition(x + bounds.x * scaleX, y + bounds.y * scaleY);
  rt.clear();
  g.setScale(1 / px).setAlpha(1);
  rt.draw(g, -bounds.x / px, -bounds.y / px);
  g.setScale(scaleX, scaleY).setPosition(x, y).setAlpha(alpha).setVisible(false);
  // 畫布上如果有圖檔頭像（T035），畫布藏起來頭像還是要在
  g.setData(PIXELIZED_KEY, true);
  return rt;
}
