import type { Resources } from './resources';

/**
 * 地區與關卡資料（依 docs/specs/T003）。純資料，不放公式。
 * 第一版只有 1 個地區「落葉坡」、3 個關卡。
 */
export interface StageData {
  id: string;
  name: string;
  /** 難度（1 起算，顯示用星數） */
  difficulty: number;
  /** 建議隊伍戰力；勝負判定交給 T004，這裡先顯示參考 */
  recommendedPower: number;
  /** 耗時（分鐘）；測試模式下 1 分鐘 = 1 秒 */
  durationMin: number;
  /** 固定獎勵（T004 之後會依勝負調整） */
  reward: Resources;
}

export interface RegionData {
  id: string;
  name: string;
  /** 一兩句地區介紹 */
  description: string;
  stages: readonly StageData[];
}

export const REGIONS: readonly RegionData[] = [
  {
    id: 'luoyepo',
    name: '落葉坡',
    description: '汪州西邊的緩坡，秋天滿地紅葉。\n新上任的城主，從這裡開始練兵吧。',
    stages: [
      {
        id: 'luoyepo-1',
        name: '坡腳小徑',
        difficulty: 1,
        recommendedPower: 150,
        durationMin: 5,
        reward: { food: 120, bones: 5 },
      },
      {
        id: 'luoyepo-2',
        name: '紅葉林',
        difficulty: 2,
        recommendedPower: 250,
        durationMin: 10,
        reward: { food: 260, bones: 12 },
      },
      {
        id: 'luoyepo-3',
        name: '坡頂哨站',
        difficulty: 3,
        recommendedPower: 350,
        durationMin: 20,
        reward: { food: 560, bones: 25 },
      },
    ],
  },
];

/** 依 id 找關卡，找不到回傳 undefined */
export function findStage(stageId: string): StageData | undefined {
  for (const region of REGIONS) {
    const stage = region.stages.find((s) => s.id === stageId);
    if (stage) return stage;
  }
  return undefined;
}
