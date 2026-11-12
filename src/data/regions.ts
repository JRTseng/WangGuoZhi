import type { Resources } from './resources';

/**
 * 出征地圖：3 個章節，每章 5 個小節，第 5 節是 Boss。純資料，不放公式。
 * 數值為暫定。T019 起關卡沒有等待時間，每關都花一樣的體力。
 */

/** 章末 Boss 的外觀（佔位圖用顏色畫） */
export interface BossData {
  name: string;
  breed: string;
  color: number;
  accent: number;
}

export interface StageData {
  id: string;
  name: string;
  /** 難度（1 起算，顯示用星數） */
  difficulty: number;
  /** 建議隊伍戰力；勝負判定交給 T004，這裡先顯示參考 */
  recommendedPower: number;
  /** 固定獎勵（T004 之後會依勝負調整） */
  reward: Resources;
  /** 有值代表這一關是 Boss 關 */
  boss?: BossData;
}

/** 主頁背景與地圖配色主題 */
export type ThemeId = 'slope' | 'bamboo' | 'snow' | 'lantern';

export interface RegionData {
  id: string;
  /** 第幾章（1 起算） */
  chapter: number;
  name: string;
  /** 一兩句章節介紹 */
  description: string;
  theme: ThemeId;
  stages: readonly StageData[];
}

const stage = (
  id: string,
  name: string,
  difficulty: number,
  recommendedPower: number,
  food: number,
  bones: number,
  boss?: BossData,
): StageData => ({
  id,
  name,
  difficulty,
  recommendedPower,
  reward: { food, bones },
  ...(boss ? { boss } : {}),
});

export const REGIONS: readonly RegionData[] = [
  {
    id: 'luoyepo',
    chapter: 1,
    name: '落葉坡',
    description: '汪州西邊的緩坡，秋天滿地紅葉。\n新上任的城主，從這裡開始練兵吧。',
    theme: 'slope',
    stages: [
      stage('luoyepo-1', '坡腳小徑', 1, 150, 120, 5),
      stage('luoyepo-2', '紅葉林', 2, 250, 260, 12),
      stage('luoyepo-3', '坡頂哨站', 3, 350, 560, 25),
      stage('luoyepo-4', '山風隘口', 3, 400, 640, 30),
      stage('luoyepo-5', '高山犬・雷吼', 4, 480, 1000, 60, {
        name: '雷吼',
        breed: '高山犬',
        color: 0x2a2421,
        accent: 0xc9773a,
      }),
    ],
  },
  {
    id: 'zhulindu',
    chapter: 2,
    name: '竹林渡',
    description: '霧氣繚繞的竹林與渡口，\n江上的船隊據說藏著不少糧草。',
    theme: 'bamboo',
    stages: [
      stage('zhulindu-1', '竹影小路', 3, 450, 300, 12),
      stage('zhulindu-2', '霧中渡口', 4, 520, 520, 20),
      stage('zhulindu-3', '江心沙洲', 4, 580, 800, 32),
      stage('zhulindu-4', '竹林水寨', 5, 640, 900, 38),
      stage('zhulindu-5', '大丹犬・巨影', 5, 720, 1500, 80, {
        name: '巨影',
        breed: '大丹犬',
        color: 0x5b6470,
        accent: 0xd8dde3,
      }),
    ],
  },
  {
    id: 'xuelingguan',
    chapter: 3,
    name: '雪嶺關',
    description: '終年積雪的北方關口，\n傳說守關的是一頭從雪山下來的猛獒。',
    theme: 'snow',
    stages: [
      stage('xuelingguan-1', '雪原入口', 5, 700, 500, 20),
      stage('xuelingguan-2', '冰河谷', 5, 780, 760, 30),
      stage('xuelingguan-3', '風雪棧道', 6, 860, 1100, 45),
      stage('xuelingguan-4', '關前烽台', 6, 940, 1250, 52),
      stage('xuelingguan-5', '藏獒・鎮嶺王', 7, 1050, 2400, 120, {
        name: '鎮嶺王',
        breed: '藏獒',
        color: 0x7a3b1d,
        accent: 0x2a1a12,
      }),
    ],
  },
];

/** 依 id 找關卡，找不到回傳 undefined */
export function findStage(stageId: string): StageData | undefined {
  for (const region of REGIONS) {
    const s = region.stages.find((x) => x.id === stageId);
    if (s) return s;
  }
  return undefined;
}

/** 依關卡 id 找所在章節 */
export function findRegionOfStage(stageId: string): RegionData | undefined {
  return REGIONS.find((r) => r.stages.some((s) => s.id === stageId));
}
