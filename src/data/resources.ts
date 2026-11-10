/** 資源種類與初始數量（T002 先寫死，T006 存檔後改由存檔讀取） */
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
