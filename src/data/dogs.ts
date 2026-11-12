/**
 * 官方已釋放的狗狗武將。前 5 隻依 docs/GDD.md，玩家一開始就擁有（見 STARTER_DOG_IDS）；
 * 後面幾隻已釋放但玩家尚未擁有，組隊畫面會以暗色顯示（招募 T007 之後才拿得到）。
 * 最後的補血狗不靠招募，第一次打贏第 1 章 Boss 就送（見 regions.ts 的 firstClearDog）。
 * 純資料，不放公式；戰力由 src/logic/power.ts 計算。
 */
export type DogRole =
  '隊長／補給' | '前排／突擊' | '前排／守護' | '後排／謀略' | '後排／幸運' | '後排／補血';

/** 稀有度（T007 抽卡之後才有資料，先預留） */
export type DogRarity = 'N' | 'R' | 'SR' | 'SSR';
/** 體型（T007 之後才有資料，先預留） */
export type DogSize = '小型' | '中型' | '大型';

export interface DogSkill {
  name: string;
  description: string;
}

export interface DogData {
  id: string;
  /** 代號（顯示名稱） */
  name: string;
  breed: string;
  personality: string;
  role: DogRole;
  /** 佔位圖形主色 */
  color: number;
  /** 耳朵／點綴色 */
  accent: number;
  baseAttack: number;
  baseDefense: number;
  level: number;
  skill: DogSkill;
  /** 稀有度，T007 定義後填上 */
  rarity?: DogRarity;
  /** 體型，T007 定義後填上 */
  size?: DogSize;
  /** 屬性，T007 定義後填上 */
  element?: string;
}

export const DOGS: readonly DogData[] = [
  {
    id: 'daer',
    name: '大耳',
    breed: '柴犬',
    personality: '溫厚、慢熟、很會交朋友',
    role: '隊長／補給',
    color: 0xd9894a,
    accent: 0xfff3e0,
    baseAttack: 42,
    baseDefense: 48,
    level: 3,
    skill: { name: '結義', description: '出征隊伍全體士氣 +10%' },
  },
  {
    id: 'heixuan',
    name: '黑旋',
    breed: '黑色拉布拉多',
    personality: '衝動、直率、力氣大',
    role: '前排／突擊',
    color: 0x2f2a28,
    accent: 0x8a6f55,
    baseAttack: 64,
    baseDefense: 30,
    level: 2,
    skill: { name: '怒吼', description: '首回合攻擊翻倍' },
  },
  {
    id: 'changxu',
    name: '長鬚',
    breed: '阿富汗獵犬',
    personality: '冷靜、講義氣、愛面子',
    role: '前排／守護',
    color: 0xc9a46a,
    accent: 0x7a5a32,
    baseAttack: 46,
    baseDefense: 58,
    level: 2,
    skill: { name: '單騎', description: '替隊友擋一次傷害' },
  },
  {
    id: 'xiaosuan',
    name: '小算',
    breed: '邊境牧羊犬',
    personality: '聰明、愛算計、話多',
    role: '後排／謀略',
    color: 0x3a3a3a,
    accent: 0xffffff,
    baseAttack: 38,
    baseDefense: 34,
    level: 1,
    skill: { name: '借箭', description: '掠奪資源 +20%' },
  },
  {
    id: 'abai',
    name: '阿白',
    breed: '薩摩耶',
    personality: '樂觀、愛吃、運氣好',
    role: '後排／幸運',
    color: 0xf7f4ee,
    accent: 0xd8cfc2,
    baseAttack: 34,
    baseDefense: 36,
    level: 1,
    skill: { name: '天降', description: '有機率雙倍掉落' },
  },
  {
    id: 'tieya',
    name: '鐵牙',
    breed: '德國牧羊犬',
    personality: '嚴肅、守紀律、刀子嘴豆腐心',
    role: '前排／守護',
    color: 0x8a5a2b,
    accent: 0x2b1d14,
    baseAttack: 55,
    baseDefense: 60,
    level: 1,
    skill: { name: '鐵壁', description: '隊伍受到的傷害 -15%' },
  },
  {
    id: 'duantui',
    name: '短腿',
    breed: '柯基',
    personality: '熱情、愛現、跑得比誰都快',
    role: '隊長／補給',
    color: 0xe39b4f,
    accent: 0xffffff,
    baseAttack: 40,
    baseDefense: 44,
    level: 1,
    skill: { name: '急行軍', description: '出征時間 -10%' },
  },
  {
    id: 'shuangyan',
    name: '霜眼',
    breed: '哈士奇',
    personality: '神秘、愛惡作劇、常常唱歌',
    role: '後排／謀略',
    color: 0x7d8796,
    accent: 0xf2f4f7,
    baseAttack: 52,
    baseDefense: 38,
    level: 1,
    skill: { name: '狼嚎', description: '敵方士氣 -10%' },
  },
  {
    // 第 1 章 Boss 的通關獎勵（T017）。名字、犬種、數值暫定
    id: 'nuantong',
    name: '暖桶',
    breed: '聖伯納犬',
    personality: '溫和、有耐心，看到誰受傷就叼著小木桶跑過去',
    role: '後排／補血',
    color: 0xb5652f,
    accent: 0xfdf6ea,
    baseAttack: 36,
    baseDefense: 60,
    level: 5,
    skill: { name: '暖心桶', description: '隊友血量剩六成以下時幫他回血 25%，隊伍戰力 +10%' },
  },
];

/** 新玩家一開始就擁有的狗狗 */
export const STARTER_DOG_IDS: readonly string[] = [
  'daer',
  'heixuan',
  'changxu',
  'xiaosuan',
  'abai',
];

/** 依 id 找狗狗 */
export function findDog(id: string): DogData | undefined {
  return DOGS.find((d) => d.id === id);
}
