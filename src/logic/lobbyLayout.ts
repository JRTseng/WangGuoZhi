import type { Rect } from './layout';

/** 左側功能選單 */
export const MENU_KEYS = ['team', 'quest', 'bag', 'background'] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

/** 右上一排圓形小圖示 */
export const SHORTCUT_KEYS = ['recruit', 'shop', 'reward'] as const;
export type ShortcutKey = (typeof SHORTCUT_KEYS)[number];

/** 右側小卡片 */
export const MINI_CARD_KEYS = ['event', 'train'] as const;
export type MiniCardKey = (typeof MINI_CARD_KEYS)[number];

export interface LobbyLayout {
  /** 左上頭像／等級／總戰力 */
  account: Rect;
  /** 右上資源（糧草、骨頭幣） */
  resources: Rect[];
  mail: Rect;
  shortcuts: Record<ShortcutKey, Rect>;
  menu: Record<MenuKey, Rect>;
  /** 左選單是否只顯示圖示（直式） */
  menuCompact: boolean;
  /** 出征大卡整張的外框 */
  expeditionCard: Rect;
  /** 出征大卡上半部（點了進地圖） */
  expedition: Rect;
  /** 出征卡底部的狀態條（倒數／收成） */
  status: Rect;
  story: Rect;
  miniCards: Record<MiniCardKey, Rect>;
  dog: { x: number; y: number; scale: number };
}

/**
 * 主頁版面（參考常見放置手遊大廳）：
 * 左上帳號、左側功能選單、右上資源與小圖示、右側（直式為下方）大卡片，中間是狗狗。
 */
export function lobbyLayout(w: number, h: number, landscape: boolean): LobbyLayout {
  return landscape ? landscapeLayout(w, h) : portraitLayout(w, h);
}

/** 右對齊排一列：最右邊是 items[last] */
function rowFromRight(right: number, y: number, size: number, h: number, gap: number, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    x: right - (n - i) * size - (n - 1 - i) * gap,
    y,
    width: size,
    height: h,
  }));
}

function landscapeLayout(w: number, h: number): LobbyLayout {
  const m = 12;
  // 左選單
  const menuTop = 92;
  const menuW = 128;
  const gap = 8;
  const mh = Math.floor((h - menuTop - m - gap * 3) / 4);
  const menu = Object.fromEntries(
    MENU_KEYS.map((k, i) => [k, { x: m, y: menuTop + i * (mh + gap), width: menuW, height: mh }]),
  ) as Record<MenuKey, Rect>;

  // 右上：資源 + 信箱
  const mail: Rect = { x: w - m - 44, y: 10, width: 44, height: 34 };
  const resW = 140;
  const resources = [
    { x: mail.x - 8 - resW * 2 - 8, y: 10, width: resW, height: 34 },
    { x: mail.x - 8 - resW, y: 10, width: resW, height: 34 },
  ];
  const sc = rowFromRight(w - m, 50, 58, 62, 8, SHORTCUT_KEYS.length);
  const shortcuts = Object.fromEntries(SHORTCUT_KEYS.map((k, i) => [k, sc[i]])) as Record<
    ShortcutKey,
    Rect
  >;

  // 右側大卡
  const cw = 270;
  const cx = w - m - cw;
  const top = 120;
  const avail = h - m - top;
  const expH = Math.round(avail * 0.44);
  const storyH = Math.round(avail * 0.26);
  const miniH = avail - expH - storyH - gap * 2;
  const statusH = 30;
  const expCard: Rect = { x: cx, y: top, width: cw, height: expH };
  const story: Rect = { x: cx, y: top + expH + gap, width: cw, height: storyH };
  const my = story.y + storyH + gap;
  const mw = (cw - gap) / 2;
  return {
    account: { x: m, y: 8, width: 240, height: 74 },
    resources,
    mail,
    shortcuts,
    menu,
    menuCompact: false,
    expeditionCard: expCard,
    expedition: { ...expCard, height: expH - statusH - 6 },
    status: { x: cx + 8, y: top + expH - statusH - 6, width: cw - 16, height: statusH },
    story,
    miniCards: {
      event: { x: cx, y: my, width: mw, height: miniH },
      train: { x: cx + mw + gap, y: my, width: mw, height: miniH },
    },
    dog: { x: (m + menuW + cx) / 2, y: h - 52, scale: 1.15 },
  };
}

function portraitLayout(w: number, h: number): LobbyLayout {
  const m = 12;
  const gap = 8;
  // 右上：兩個資源上下排
  const resW = 140;
  const resources = [
    { x: w - m - resW, y: 12, width: resW, height: 32 },
    { x: w - m - resW, y: 50, width: resW, height: 32 },
  ];
  // 第二列：召募／商城／獎勵／信箱 靠右
  const row = rowFromRight(w - m, 94, 56, 60, 6, SHORTCUT_KEYS.length + 1);
  const shortcuts = Object.fromEntries(SHORTCUT_KEYS.map((k, i) => [k, row[i]])) as Record<
    ShortcutKey,
    Rect
  >;
  const mail = row[row.length - 1];

  // 左選單：只放圖示
  const ms = 64;
  const menuTop = 172;
  const menu = Object.fromEntries(
    MENU_KEYS.map((k, i) => [k, { x: m, y: menuTop + i * (ms + 10), width: ms, height: ms }]),
  ) as Record<MenuKey, Rect>;

  // 下方大卡：出征在最底（拇指好按），上面是劇情 + 兩張小卡
  const cw = w - m * 2;
  const expH = 128;
  const statusH = 34;
  const expY = h - m - expH;
  const rowH = 88;
  const rowY = expY - gap - rowH;
  const storyW = Math.round((cw - gap) * 0.5);
  const miniW = (cw - storyW - gap * 2) / 2;
  return {
    account: { x: m, y: 12, width: 216, height: 70 },
    resources,
    mail,
    shortcuts,
    menu,
    menuCompact: true,
    expeditionCard: { x: m, y: expY, width: cw, height: expH },
    expedition: { x: m, y: expY, width: cw, height: expH - statusH - 8 },
    status: { x: m + 8, y: expY + expH - statusH - 8, width: cw - 16, height: statusH },
    story: { x: m, y: rowY, width: storyW, height: rowH },
    miniCards: {
      event: { x: m + storyW + gap, y: rowY, width: miniW, height: rowH },
      train: { x: m + storyW + gap * 2 + miniW, y: rowY, width: miniW, height: rowH },
    },
    dog: { x: w * 0.56, y: rowY - 40, scale: 1.35 },
  };
}

/** 版面上所有可點的區塊（給測試檢查重疊與出界） */
export function tappableRects(L: LobbyLayout): Record<string, Rect> {
  return {
    account: L.account,
    mail: L.mail,
    ...L.shortcuts,
    ...L.menu,
    expedition: L.expedition,
    status: L.status,
    story: L.story,
    ...L.miniCards,
  };
}
