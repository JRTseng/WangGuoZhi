/**
 * 第一批 5 隻狗狗武將（依 docs/GDD.md）。
 * 純資料，不放公式；戰力由 src/logic/power.ts 計算。
 */
export type DogRole = '隊長／補給' | '前排／突擊' | '前排／守護' | '後排／謀略' | '後排／幸運';

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
];
