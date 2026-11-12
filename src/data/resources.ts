/** 資源種類與初始數量（新遊戲的起始值；之後的數量跟著存檔） */
export interface Resources {
  /** 糧草 */
  food: number;
  /** 骨頭幣 */
  bones: number;
}

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  food: '糧草',
  bones: '骨頭幣',
};

export const INITIAL_RESOURCES: Readonly<Resources> = {
  food: 1200,
  bones: 50,
};
