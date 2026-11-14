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
  /** 「自動放招」勾選框（T023）：直式在略過按鈕左邊，橫式在標題列速度按鈕左邊 */
  auto: Rect;
  /** 雙方站位的範圍 */
  field: Rect;
  team: BattleSlot[];
  enemies: BattleSlot[];
  /** 雙方前排、中排、後排那一直行的 x 座標（畫「前中後」小標用） */
  rowX: { team: number[]; enemy: number[] };
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

/** 前排、中排、後排離中線多遠 */
function rowOffsets(field: Rect, landscape: boolean): number[] {
  return landscape
    ? [field.width * 0.15, field.width * 0.27, field.width * 0.39]
    : [field.width * 0.12, field.width * 0.255, field.width * 0.39];
}

/**
 * 一方的站位（T023 三排）：前排最靠近中線，中排、後排依序往外。facing：我方在左（1），敵方在右（-1）。
 * - 直式寬度不夠三排並肩，所以每隻各佔一條橫的「跑道」（由上而下照隊伍順序），
 *   站哪一排決定牠在跑道上靠中線多近。
 * - 橫式每一排是一直行，同一排的由上而下排開。
 * - 有給 cellLanes（九宮格的上、中、下，我方才有）時：橫式照格子站，上中下各一條固定的橫線，
 *   看起來就是 3×3；直式的跑道改成先照上中下、再照前中後排，由上而下的順序和陣型面板一樣。
 */
function sideSlots(
  rows: readonly number[],
  field: Rect,
  landscape: boolean,
  facing: 1 | -1,
  cellLanes?: readonly (number | undefined)[],
): BattleSlot[] {
  const count = rows.length;
  if (count <= 0) return [];
  const mid = field.x + field.width / 2;
  const offsets = rowOffsets(field, landscape);
  const solo = count === 1;
  const inRow = [0, 1, 2].map((r) => rows.filter((x) => x === r).length);
  const grid =
    !!cellLanes &&
    cellLanes.length === count &&
    cellLanes.every((l) => l === 0 || l === 1 || l === 2) &&
    new Set(rows.map((row, i) => row * 3 + cellLanes[i]!)).size === count;
  // 直式跑道的順序：照格子的話先上中下、再前中後
  const runway = rows.map((_, i) => i);
  if (grid) {
    const key = (i: number) => cellLanes![i]! * 3 + rows[i];
    const order = [...runway].sort((a, b) => key(a) - key(b));
    order.forEach((i, n) => (runway[i] = n));
  }
  const lanes = landscape ? (grid && !solo ? 3 : Math.max(...inRow)) : count;
  const spacing = field.height / lanes;
  const r = Math.round(
    Math.max(
      14,
      Math.min(
        MAX_R * (solo ? BOSS_SCALE : 1),
        spacing * 0.27,
        field.width * 0.11,
        // 前排的名字與血條不能壓到中線
        solo ? Infinity : (offsets[0] - 1) / 1.3,
      ),
    ),
  );
  const seen = [0, 0, 0];
  return rows.map((row, i) => {
    const lane = landscape ? (grid && !solo ? cellLanes![i]! : seen[row]++) : runway[i];
    const laneCount = landscape ? (grid && !solo ? 3 : inRow[row]) : count;
    const laneSpacing = field.height / laneCount;
    return {
      // 單獨一隻畫得比較大，站前排時往外挪一點才不會壓到中線
      x: Math.round(mid - facing * Math.max(offsets[row], solo ? r * 1.3 + 6 : 0)),
      // 把名字與血條算進去，整塊在跑道裡上下置中
      y: Math.round(field.y + laneSpacing * (lane + 0.5) - 14 + r * 0.17),
      r,
    };
  });
}

/**
 * 戰鬥畫面版面（直式 390 x 844、橫式 844 x 390 都適用）。
 * teamRows／enemyRows：雙方每一隻站第幾排（0 前、1 中、2 後）。
 * teamLanes：我方每一隻在九宮格的上、中、下（0／1／2）；沒給就照隊伍順序排。
 */
export function battleLayout(
  w: number,
  h: number,
  landscape: boolean,
  teamRows: readonly number[],
  enemyRows: readonly number[],
  teamLanes?: readonly (number | undefined)[],
): BattleLayout {
  const bar = BATTLE_BAR_HEIGHT;
  const speed: Rect = { x: w - 84, y: 8, width: 76, height: bar - 16 };
  const skip: Rect = landscape
    ? { x: w / 2 - 70, y: h - 60, width: 140, height: 48 }
    : { x: 172, y: h - 84, width: w - 196, height: 60 };
  const auto: Rect = landscape
    ? { x: speed.x - 8 - 136, y: 8, width: 136, height: bar - 16 }
    : { x: 24, y: h - 84, width: 140, height: 60 };
  const top = bar + (landscape ? 34 : 52);
  const field: Rect = landscape
    ? { x: 16, y: top, width: w - 32, height: h - top - 8 }
    : { x: 8, y: top, width: w - 16, height: skip.y - 12 - top };
  const mid = field.x + field.width / 2;
  const offsets = rowOffsets(field, landscape);
  return {
    barHeight: bar,
    speed,
    skip,
    auto,
    field,
    team: sideSlots(teamRows, field, landscape, 1, teamLanes),
    enemies: sideSlots(enemyRows, field, landscape, -1),
    rowX: {
      team: offsets.map((o) => Math.round(mid - o)),
      enemy: offsets.map((o) => Math.round(mid + o)),
    },
  };
}
