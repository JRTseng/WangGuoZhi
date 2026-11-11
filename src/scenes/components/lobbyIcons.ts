import Phaser from 'phaser';

export type LobbyIcon =
  | 'battle'
  | 'team'
  | 'story'
  | 'background'
  | 'quest'
  | 'bag'
  | 'recruit'
  | 'shop'
  | 'reward'
  | 'mail'
  | 'event'
  | 'train';

/** 主頁用的簡單幾何圖示（佔位美術），以 (x, y) 為中心、s 約為半徑 */
export function drawLobbyIcon(
  g: Phaser.GameObjects.Graphics,
  icon: LobbyIcon,
  x: number,
  y: number,
  s: number,
  color = 0xffffff,
): void {
  g.lineStyle(Math.max(2, s * 0.2), color, 1);
  g.fillStyle(color, 1);
  switch (icon) {
    case 'battle':
      // 交叉的兩把劍
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(x - d * s, y - s);
        g.lineTo(x + d * s * 0.8, y + s * 0.8);
        g.strokePath();
        g.fillCircle(x + d * s * 0.9, y + s * 0.9, s * 0.2);
      }
      break;
    case 'team':
      g.fillCircle(x, y - s * 0.35, s * 0.42);
      g.fillCircle(x - s * 0.85, y - s * 0.1, s * 0.34);
      g.fillCircle(x + s * 0.85, y - s * 0.1, s * 0.34);
      g.fillEllipse(x, y + s * 0.65, s * 1.4, s * 0.8);
      g.fillEllipse(x - s * 0.95, y + s * 0.65, s * 0.9, s * 0.6);
      g.fillEllipse(x + s * 0.95, y + s * 0.65, s * 0.9, s * 0.6);
      break;
    case 'story':
      // 打開的書
      g.fillRoundedRect(x - s * 1.05, y - s * 0.75, s, s * 1.5, 3);
      g.fillRoundedRect(x + s * 0.05, y - s * 0.75, s, s * 1.5, 3);
      break;
    case 'background':
      // 山與太陽
      g.fillTriangle(x - s, y + s * 0.7, x + s * 0.2, y + s * 0.7, x - s * 0.4, y - s * 0.5);
      g.fillTriangle(x - s * 0.2, y + s * 0.7, x + s, y + s * 0.7, x + s * 0.4, y - s * 0.1);
      g.fillCircle(x + s * 0.6, y - s * 0.65, s * 0.25);
      break;
    case 'quest':
      // 卷軸
      g.fillRoundedRect(x - s * 0.7, y - s * 0.8, s * 1.4, s * 1.6, 3);
      g.fillCircle(x - s * 0.7, y - s * 0.8, s * 0.22);
      g.fillCircle(x + s * 0.7, y + s * 0.8, s * 0.22);
      g.lineStyle(Math.max(2, s * 0.12), 0x3b2a1a, 0.6);
      for (const k of [-0.35, 0, 0.35])
        g.lineBetween(x - s * 0.4, y + k * s, x + s * 0.4, y + k * s);
      break;
    case 'bag':
      // 寶箱
      g.fillRoundedRect(x - s, y - s * 0.6, s * 2, s * 0.6, { tl: 6, tr: 6, bl: 0, br: 0 });
      g.fillRect(x - s, y + s * 0.08, s * 2, s * 0.8);
      g.fillStyle(0x3b2a1a, 0.6);
      g.fillRect(x - s * 0.18, y - s * 0.15, s * 0.36, s * 0.4);
      break;
    case 'recruit':
      // 軍旗
      g.lineBetween(x - s * 0.7, y - s, x - s * 0.7, y + s);
      g.fillTriangle(x - s * 0.6, y - s, x + s, y - s * 0.55, x - s * 0.6, y - s * 0.05);
      break;
    case 'shop':
      // 提袋
      g.fillRoundedRect(x - s * 0.85, y - s * 0.35, s * 1.7, s * 1.25, 4);
      g.strokeCircle(x, y - s * 0.4, s * 0.45);
      break;
    case 'reward':
      // 禮物盒
      g.fillRect(x - s * 0.9, y - s * 0.3, s * 1.8, s * 1.15);
      g.fillRect(x - s, y - s * 0.6, s * 2, s * 0.35);
      g.fillStyle(0xe0452b, 1);
      g.fillRect(x - s * 0.15, y - s * 0.6, s * 0.3, s * 1.45);
      break;
    case 'mail':
      g.fillRoundedRect(x - s, y - s * 0.65, s * 2, s * 1.3, 3);
      g.lineStyle(Math.max(2, s * 0.14), 0x3b2a1a, 0.7);
      g.beginPath();
      g.moveTo(x - s, y - s * 0.65);
      g.lineTo(x, y + s * 0.1);
      g.lineTo(x + s, y - s * 0.65);
      g.strokePath();
      break;
    case 'event': {
      // 星星
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s : s * 0.45;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'train':
      // 骨頭（訓練用）
      g.fillRect(x - s * 0.7, y - s * 0.2, s * 1.4, s * 0.4);
      for (const dx of [-1, 1])
        for (const dy of [-1, 1]) g.fillCircle(x + dx * s * 0.75, y + dy * s * 0.25, s * 0.3);
      break;
  }
}

/** 狗掌印（裝飾用），(x, y) 為掌心中心 */
export function drawPaw(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  color = 0xffffff,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y + s * 0.25, s * 1.1, s * 0.9);
  for (const [dx, dy] of [
    [-0.55, -0.35],
    [-0.2, -0.7],
    [0.2, -0.7],
    [0.55, -0.35],
  ])
    g.fillEllipse(x + dx * s, y + dy * s, s * 0.34, s * 0.42);
}

/** 圓角面板的「可愛精緻」質感：底色 + 上半高光 + 內描邊 + 金外框 */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1,
  border = 0xe0b25a,
): void {
  g.fillStyle(0x000000, 0.22 * alpha);
  g.fillRoundedRect(x + 1, y + 4, w, h, r);
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, r);
  // 上半部亮一點，像糖果一樣
  g.fillStyle(0xffffff, 0.1 * alpha);
  g.fillRoundedRect(x + 3, y + 3, w - 6, Math.max(4, h * 0.42), {
    tl: r - 2,
    tr: r - 2,
    bl: 4,
    br: 4,
  });
  g.lineStyle(1.5, 0xffffff, 0.22 * alpha);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3));
  g.lineStyle(2.5, border, alpha);
  g.strokeRoundedRect(x, y, w, h, r);
}
