import type { ThemeId } from './regions';

/**
 * 主頁動態背景。依關卡進度或活動（優惠碼）取得。
 * unlock：'start' 一開始就有；stage 打過某關；code 兌換某組優惠碼。
 */
export type BackgroundUnlock =
  { kind: 'start' } | { kind: 'stage'; stageId: string } | { kind: 'code'; code: string };

export interface BackgroundData {
  id: ThemeId;
  name: string;
  /** 顯示給玩家看的取得方式 */
  howToGet: string;
  unlock: BackgroundUnlock;
}

export const BACKGROUNDS: readonly BackgroundData[] = [
  { id: 'slope', name: '落葉坡之秋', howToGet: '一開始就有', unlock: { kind: 'start' } },
  {
    id: 'bamboo',
    name: '竹林晨霧',
    howToGet: '打倒第一章 Boss',
    unlock: { kind: 'stage', stageId: 'luoyepo-5' },
  },
  {
    id: 'snow',
    name: '雪嶺夜色',
    howToGet: '打倒第二章 Boss',
    unlock: { kind: 'stage', stageId: 'zhulindu-5' },
  },
  {
    id: 'lantern',
    name: '秋祭燈會（活動）',
    howToGet: '活動優惠碼',
    unlock: { kind: 'code', code: 'WANGWANG' },
  },
];

/** 優惠碼（大小寫不拘）。之後要接後端時換掉這張表即可。 */
export interface PromoCode {
  code: string;
  reward: { food: number; bones: number };
  description: string;
}

export const PROMO_CODES: readonly PromoCode[] = [
  {
    code: 'WANGWANG',
    reward: { food: 0, bones: 100 },
    description: '秋祭活動：骨頭幣 100 + 燈會背景',
  },
  { code: 'HELLODOG', reward: { food: 500, bones: 0 }, description: '新手禮：糧草 500' },
];
