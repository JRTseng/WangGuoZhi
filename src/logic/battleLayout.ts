import type { Rect } from './layout';

/** 戰鬥畫面上一隻角色的位置：頭的中心點與半徑 */
export interface BattleSlot {
  x: number;
  y: number;
  r: number;
}

export interface BattleLayout {
  /** 上方標題列高度 */
  barHeight: number;
  /** 右上角速度按鈕 */
  speed: Rect;
  /** 略過按鈕 */
  skip: Rect;
  /** 雙方站位的範圍 */
  field: Rect;
  team: BattleSlot[];
  enemies: BattleSlot[];
}

export const BATTLE_BAR_HEIGHT = 56;
/** 頭的半徑上限；只有一隻敵人（Boss）時放大 */
const MAX_R = 34;
const BOSS_SCALE = 1.5;

/** 一隻角色實際佔的範圍（頭、耳朵、名字、血條） */
export function slotBounds(s: BattleSlot): Rect {
  const halfW = Math.max(s.r * 1.3, 40);
  return { x: s.x - halfW, y: s.y - s.r * 1.35, width: halfW * 2, height: s.r * 2.35 + 30 };
}

/**
 * 一方的站位。直式排成一直排（前後錯開一點）；
 * 橫式高度不夠，超過 3 隻就分前後兩排。facing：我方在左（1），敵方在右（-1）。
 */
function sideSlots(count: number, field: Rect, landscape: boolean, facing: 1 | -1): BattleSlot[] {
  if (count <= 0) return [];
  const mid = field.x + field.width / 2;
  const columns: number[][] =
    landscape && count > 3
      ? [
          Array.from({ length: Math.ceil(count / 2) }, (_, i) => i),
          Array.from({ length: Math.floor(count / 2) }, (_, i) => Math.ceil(count / 2) + i),
        ]
      : [Array.from({ length: count }, (_, i) => i)];
  const rows = columns[0].length;
  const spacing = field.height / rows;
  const solo = count === 1;
  const r = Math.round(
    Math.max(14, Math.min(MAX_R * (solo ? BOSS_SCALE : 1), spacing * 0.27, field.width * 0.11)),
  );
  // 前排離中線的距離、兩排之間的距離
  const front = landscape ? field.width * 0.16 : field.width * 0.22;
  const colGap = field.width * 0.2;
  const slots: BattleSlot[] = [];
  columns.forEach((col, ci) => {
    const colSpacing = field.height / col.length;
    col.forEach((unit, row) => {
      const stagger = landscape || solo ? 0 : (row % 2 === 0 ? 1 : -1) * 14;
      slots[unit] = {
        x: Math.round(mid - facing * (front + ci * colGap + stagger)),
        // 把名字與血條算進去，整塊在格子裡上下置中
        y: Math.round(field.y + colSpacing * (row + 0.5) - 14 + r * 0.17),
        r,
      };
    });
  });
  return slots;
}

/** 戰鬥畫面版面（直式 390 x 844、橫式 844 x 390 都適用） */
export function battleLayout(
  w: number,
  h: number,
  landscape: boolean,
  teamCount: number,
  enemyCount: number,
): BattleLayout {
  const bar = BATTLE_BAR_HEIGHT;
  const speed: Rect = { x: w - 84, y: 8, width: 76, height: bar - 16 };
  const skip: Rect = landscape
    ? { x: w / 2 - 70, y: h - 60, width: 140, height: 48 }
    : { x: 24, y: h - 84, width: w - 48, height: 60 };
  const top = bar + (landscape ? 30 : 44);
  const field: Rect = landscape
    ? { x: 16, y: top, width: w - 32, height: h - top - 8 }
    : { x: 8, y: top, width: w - 16, height: skip.y - 12 - top };
  return {
    barHeight: bar,
    speed,
    skip,
    field,
    team: sideSlots(teamCount, field, landscape, 1),
    enemies: sideSlots(enemyCount, field, landscape, -1),
  };
}
