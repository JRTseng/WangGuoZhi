/**
 * 像素立體光影畫面（T025）的設定：像素大小、每個場景的光線氣氛、時段的色調、各畫質的數量。
 * 全部是純資料與純函式，真正畫在 src/scenes/components/Scenery.ts 與 pixelStage.ts。
 */

/** 場景的一格像素等於版面上的幾點（844 x 390 的版面除以它，就是場景實際畫的大小） */
export const PIXEL_SIZE = 2;

/** 遠景失焦的模糊半徑（以場景像素算） */
export const FAR_BLUR = 2;
/** 近景（畫面最前面那幾叢）失焦的模糊半徑 */
export const NEAR_BLUR = 3;

export type AtmoQuality = 'low' | 'medium' | 'high';

/** 各畫質飄在空中的光點數量（低畫質沒有） */
export const MOTES_BY_QUALITY: Record<AtmoQuality, number> = { low: 0, medium: 8, high: 18 };

/** 會動的場景幾毫秒重畫一次（約每秒 30 格；像素畫不需要更密，也比較省電） */
export const PIXEL_REDRAW_MS = 30;

export interface Mood {
  /** 光的顏色 */
  light: number;
  /** 光源（太陽或月亮）在哪裡：x 是寬度的比例，y 是地平線高度的比例；沒有就從畫面上方灑下來 */
  sun: { x: number; y: number } | null;
  /** 幾道光束（0 就沒有） */
  rays: number;
  /** 光束最亮的時候多亮（0～1） */
  rayAlpha: number;
  /** 空中光點的顏色 */
  mote: number;
  /** 地平線那一層霧氣的顏色與濃度 */
  haze: number;
  hazeAlpha: number;
  /** 最前面失焦草叢的顏色 */
  fore: number;
  /** 四個角落壓暗多少（0～1） */
  vignette: number;
  /** 本來就是晚上的場景（不再套時段色調） */
  dark: boolean;
}

/** 每個場景自己的光線氣氛（鍵和 sceneryArt.ts 的 SceneryTheme 一樣） */
export const MOODS = {
  slope: {
    light: 0xffdf9e,
    sun: { x: 0.8, y: 0.26 },
    rays: 5,
    rayAlpha: 0.3,
    mote: 0xfff0c0,
    haze: 0xffe6c0,
    hazeAlpha: 0.17,
    fore: 0x6a3a1c,
    vignette: 0.42,
    dark: false,
  },
  bamboo: {
    light: 0xf2ffd8,
    sun: { x: 0.3, y: 0.3 },
    rays: 6,
    rayAlpha: 0.33,
    mote: 0xf0ffd0,
    haze: 0xeaf7e4,
    hazeAlpha: 0.21,
    fore: 0x1f4a2c,
    vignette: 0.42,
    dark: false,
  },
  snow: {
    light: 0xdcecff,
    sun: { x: 0.78, y: 0.24 },
    rays: 3,
    rayAlpha: 0.18,
    mote: 0xffffff,
    haze: 0xdfeaf7,
    hazeAlpha: 0.17,
    fore: 0x2a3a5a,
    vignette: 0.48,
    dark: true,
  },
  lantern: {
    light: 0xffb65c,
    sun: null,
    rays: 0,
    rayAlpha: 0,
    mote: 0xffd08a,
    haze: 0xff9a4a,
    hazeAlpha: 0.12,
    fore: 0x1a1020,
    vignette: 0.55,
    dark: true,
  },
  peach: {
    light: 0xffe4ec,
    sun: { x: 0.22, y: 0.26 },
    rays: 5,
    rayAlpha: 0.3,
    mote: 0xffe0ea,
    haze: 0xffe9ef,
    hazeAlpha: 0.18,
    fore: 0x2f5a34,
    vignette: 0.4,
    dark: false,
  },
  desert: {
    light: 0xffd28a,
    sun: { x: 0.7, y: 0.62 },
    rays: 4,
    rayAlpha: 0.24,
    mote: 0xffe6b0,
    haze: 0xffd9a0,
    hazeAlpha: 0.19,
    fore: 0x7a4a20,
    vignette: 0.42,
    dark: false,
  },
  marsh: {
    light: 0xcfeedd,
    sun: null,
    rays: 3,
    rayAlpha: 0.15,
    mote: 0xe6ff8a,
    haze: 0xbfe0d0,
    hazeAlpha: 0.17,
    fore: 0x14302a,
    vignette: 0.55,
    dark: true,
  },
  volcano: {
    light: 0xff8a4a,
    sun: null,
    rays: 0,
    rayAlpha: 0,
    mote: 0xffb347,
    haze: 0xff6a3a,
    hazeAlpha: 0.14,
    fore: 0x1c0f0c,
    vignette: 0.55,
    dark: true,
  },
  coast: {
    light: 0xfffbe6,
    sun: { x: 0.76, y: 0.22 },
    rays: 5,
    rayAlpha: 0.27,
    mote: 0xffffff,
    haze: 0xe6f6ff,
    hazeAlpha: 0.17,
    fore: 0x1f5a4a,
    vignette: 0.38,
    dark: false,
  },
  cloud: {
    light: 0xffe9b8,
    sun: { x: 0.2, y: 0.6 },
    rays: 5,
    rayAlpha: 0.3,
    mote: 0xfff6d8,
    haze: 0xffe9cf,
    hazeAlpha: 0.19,
    fore: 0x5a6a8a,
    vignette: 0.4,
    dark: false,
  },
  palace: {
    light: 0xffc66b,
    sun: null,
    rays: 0,
    rayAlpha: 0,
    mote: 0xffd56b,
    haze: 0xffa84a,
    hazeAlpha: 0.11,
    fore: 0x140c14,
    vignette: 0.55,
    dark: true,
  },
  city: {
    light: 0xffedc0,
    sun: { x: 0.82, y: 0.24 },
    rays: 5,
    rayAlpha: 0.27,
    mote: 0xfff3c4,
    haze: 0xfff1d6,
    hazeAlpha: 0.17,
    fore: 0x2f5a34,
    vignette: 0.4,
    dark: false,
  },
} as const satisfies Record<string, Mood>;

export type MoodKey = keyof typeof MOODS;

// ---------------------------------------------------------------- 時段

/** 一天的四個時段：清晨、白天、黃昏、夜晚 */
export const DAY_TIMES = ['dawn', 'day', 'dusk', 'night'] as const;
export type DayTime = (typeof DAY_TIMES)[number];

export const DAY_TIME_NAMES: Record<DayTime, string> = {
  dawn: '清晨',
  day: '白天',
  dusk: '黃昏',
  night: '夜晚',
};

/** 幾點算哪個時段：5～8 點清晨、8～16 點白天、16～19 點黃昏，其他是夜晚 */
export function dayTimeFor(hour: number): DayTime {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'dusk';
  return 'night';
}

/** 網址的 ?time=dusk（測試與預覽用）；沒寫或寫錯回傳 null */
export function dayTimeFromSearch(search: string): DayTime | null {
  const raw = new URLSearchParams(search).get('time');
  return (DAY_TIMES as readonly string[]).includes(raw ?? '') ? (raw as DayTime) : null;
}

export interface Grade {
  /** 整張場景乘上去的顏色（白色等於不變） */
  tint: number;
  /** 光束亮度的倍數 */
  rays: number;
  /** 四角壓暗多加多少 */
  vignette: number;
  /** 換掉光的顏色（null 用場景自己的） */
  light: number | null;
  /** 換掉空中光點的顏色（夜晚變螢火蟲） */
  mote: number | null;
}

/** 各時段的色調 */
export const GRADES: Record<DayTime, Grade> = {
  dawn: { tint: 0xffe3d2, rays: 1.2, vignette: 0.04, light: 0xffd9b8, mote: null },
  day: { tint: 0xffffff, rays: 1, vignette: 0, light: null, mote: null },
  dusk: { tint: 0xffb98e, rays: 1.5, vignette: 0.08, light: 0xff9a52, mote: 0xffd08a },
  night: { tint: 0x7482c2, rays: 0.45, vignette: 0.14, light: 0xbcd0ff, mote: 0xe6ff8a },
};

/** 場景加上時段以後實際用的氣氛。本來就是晚上的場景不再套時段 */
export function moodAt(key: MoodKey, time: DayTime): Mood & { tint: number } {
  const m: Mood = MOODS[key];
  if (m.dark || time === 'day') return { ...m, tint: 0xffffff };
  const g = GRADES[time];
  return {
    ...m,
    light: g.light ?? m.light,
    mote: g.mote ?? m.mote,
    rayAlpha: Math.min(0.4, m.rayAlpha * g.rays),
    vignette: Math.min(0.7, m.vignette + g.vignette),
    tint: g.tint,
  };
}

/** 光束的角度（度；0 是直直往下，正的往左下斜）：從光源往畫面中間散開 */
export function rayAngles(sunX: number, count: number): number[] {
  if (count <= 0) return [];
  // 光源在右邊就往左下灑，在左邊就往右下灑
  const lean = (sunX - 0.5) * 70;
  const spread = 46;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    return lean + (t - 0.5) * spread;
  });
}

/**
 * 模糊時要疊的幾個位移（一個方向）：中間先畫，再往兩邊。
 * 第 i 張用 1 / (i + 1) 的透明度疊上去，疊完剛好是全部的平均。
 */
export function blurTaps(radius: number): { offset: number; alpha: number }[] {
  const r = Math.max(0, Math.floor(radius));
  const offsets = [0];
  for (let i = 1; i <= r; i++) offsets.push(i, -i);
  return offsets.map((offset, i) => ({ offset, alpha: 1 / (i + 1) }));
}
