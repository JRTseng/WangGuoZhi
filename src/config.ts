/** 設計基準尺寸（直式，iPhone 12–15 等級） */
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

export const FONT_FAMILY = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

export const COLORS = {
  background: 0xf4e9d8,
  ink: '#3b2a1a',
  inkSoft: '#8a6f55',
  inkHex: 0x3b2a1a,
  card: 0xfffaf2,
  cardBorder: 0xd8c3a5,
  /** 出征選角時被選中的卡片底色 */
  cardSelected: 0xffe2c2,
  bar: 0x6b4a2e,
  barText: '#fff6e8',
  button: 0xb5651d,
  buttonDisabled: 0xb9a48c,
  /** 收成按鈕 */
  harvest: 0x4f8a3c,
  overlay: 0x000000,
} as const;

/** 稀有度的代表色（T007）：卡片外框與標籤用 */
export const RARITY_COLORS = {
  N: 0x8f979e,
  R: 0x3f7fa8,
  SR: 0x8e44ad,
  SSR: 0xd99a1c,
} as const;

/** 稀有度代表色的文字版（'#rrggbb'） */
export function rarityHex(rarity: keyof typeof RARITY_COLORS): string {
  return `#${RARITY_COLORS[rarity].toString(16).padStart(6, '0')}`;
}
