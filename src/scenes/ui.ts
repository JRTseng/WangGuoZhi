import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import type { Rect } from '../logic/layout';
import { orientationFor } from '../logic/orientation';

/** 目前的畫面尺寸與方向（直式 390 x 844，橫式 844 x 390） */
export interface View {
  w: number;
  h: number;
  landscape: boolean;
}

export function viewOf(scene: Phaser.Scene): View {
  const w = scene.scale.width;
  const h = scene.scale.height;
  return { w, h, landscape: orientationFor(w, h) === 'landscape' };
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size: number,
  color: string = COLORS.ink,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
  });
}

/** 把顏色往黑色混（amount 0 不變、1 全黑），未擁有角色的暗色處理用 */
export function darken(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const k = 1 - amount;
  return Phaser.Display.Color.GetColor(
    Math.round(c.red * k),
    Math.round(c.green * k),
    Math.round(c.blue * k),
  );
}

/**
 * 每個場景開始時重設 Playwright 用的除錯資訊（保留版本號），
 * 並記下目前方向與尺寸，測試用它把遊戲座標換成頁面座標。
 */
export function resetDebug(scene: Phaser.Scene): WgzDebugState {
  const v = viewOf(scene);
  window.__WGZ__ = {
    scene: scene.scene.key,
    version: window.__WGZ__?.version ?? '',
    orientation: v.landscape ? 'landscape' : 'portrait',
    size: { width: v.w, height: v.h },
  };
  return window.__WGZ__;
}

export function patchDebug(patch: Partial<WgzDebugState>): void {
  if (window.__WGZ__) Object.assign(window.__WGZ__, patch);
}

/** 頂端深色標題列 + 左側「‹ 返回」，回傳返回鍵的點擊範圍 */
export function drawHeader(
  scene: Phaser.Scene,
  title: string,
  onBack: () => void,
  barHeight = 56,
): Rect {
  const { w } = viewOf(scene);
  scene.add.rectangle(0, 0, w, barHeight, COLORS.bar).setOrigin(0, 0).setDepth(50);
  addText(scene, w / 2, barHeight / 2, title, 21, COLORS.barText, true)
    .setOrigin(0.5)
    .setDepth(50);
  const back: Rect = { x: 4, y: 4, width: 96, height: barHeight - 8 };
  addText(scene, back.x + 14, barHeight / 2, '‹ 返回', 19, COLORS.barText)
    .setOrigin(0, 0.5)
    .setDepth(50);
  scene.add
    .zone(back.x, back.y, back.width, back.height)
    .setOrigin(0, 0)
    .setDepth(50)
    .setInteractive({ cursor: 'pointer' })
    .on('pointerup', onBack);
  return back;
}

/** 半透明遮罩 + 中央卡片的彈出框。點遮罩呼叫 onShade。回傳容器與卡片範圍。 */
export function openModal(
  scene: Phaser.Scene,
  size: { width: number; height: number },
  onShade: () => void,
  border: number = COLORS.cardBorder,
): { layer: Phaser.GameObjects.Container; box: Rect } {
  const { w, h } = viewOf(scene);
  const layer = scene.add.container(0, 0).setDepth(100);
  const shade = scene.add.rectangle(0, 0, w, h, COLORS.overlay, 0.5).setOrigin(0, 0);
  shade.setInteractive();
  shade.on('pointerup', onShade);
  const bw = Math.min(size.width, w - 32);
  const bh = Math.min(size.height, h - 24);
  const box: Rect = { x: (w - bw) / 2, y: (h - bh) / 2, width: bw, height: bh };
  const g = scene.add.graphics();
  g.fillStyle(COLORS.card, 1);
  g.lineStyle(3, border, 1);
  g.fillRoundedRect(box.x, box.y, bw, bh, 18);
  g.strokeRoundedRect(box.x, box.y, bw, bh, 18);
  // 卡片本身吃掉點擊，避免點到卡片空白處就關閉
  const blocker = scene.add.zone(box.x, box.y, bw, bh).setOrigin(0, 0).setInteractive();
  layer.add([shade, g, blocker]);
  return { layer, box };
}
