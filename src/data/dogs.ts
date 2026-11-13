/**
 * 官方已釋放的狗狗武將。前 5 隻依 docs/GDD.md，玩家一開始就擁有（見 STARTER_DOG_IDS）；
 * 其他的要到主頁「召募」抽（T007，規則在 src/logic/gacha.ts），沒擁有的在組隊畫面以暗色顯示。
 * 補血狗「暖桶」不靠召募，第一次打贏第 1 章 Boss 就送（見 regions.ts 的 firstClearDog）；
 * 拿到之後才會進召募池（重複抽到換碎片，才能升星）。
 * T007 新增的 10 隻犬種取自 docs/BREEDS.md，名字、性格、技能都是原創。
 * 純資料，不放公式；戰力由 src/logic/power.ts 計算。
 */
export type DogRole =
  '隊長／補給' | '前排／突擊' | '前排／守護' | '後排／謀略' | '後排／幸運' | '後排／補血';

/** 稀有度：越後面越稀有、基礎數值越高（T007） */
export type DogRarity = 'N' | 'R' | 'SR' | 'SSR';
/** 體型（T007） */
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
  /** 稀有度（T007 起每隻都有） */
  rarity?: DogRarity;
  /** 體型（T007 起每隻都有） */
  size?: DogSize;
  /** 屬性：等 T017 設計相剋時再填 */
  element?: string;
  /** 關卡通關送的狗：沒拿到之前不會出現在召募池 */
  rewardOnly?: boolean;
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
    rarity: 'R',
    size: '中型',
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
    rarity: 'R',
    size: '大型',
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
    rarity: 'R',
    size: '大型',
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
    rarity: 'N',
    size: '中型',
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
    rarity: 'N',
    size: '中型',
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
    rarity: 'SR',
    size: '大型',
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
    rarity: 'N',
    size: '小型',
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
    rarity: 'R',
    size: '中型',
  },
  // ---- T007 新增的 10 隻（召募取得） ----
  {
    id: 'douding',
    name: '豆丁',
    breed: '吉娃娃',
    personality: '膽子比身體大，看到誰都先吼兩聲',
    role: '後排／幸運',
    color: 0xd8b48a,
    accent: 0xfff3e0,
    baseAttack: 40,
    baseDefense: 32,
    level: 1,
    skill: { name: '虛張聲勢', description: '開戰時大吼，敵方有機率嚇到慢一拍' },
    rarity: 'N',
    size: '小型',
  },
  {
    id: 'chanbi',
    name: '饞鼻',
    breed: '米格魯',
    personality: '貪吃、鼻子靈，聞到香味就走不動',
    role: '隊長／補給',
    color: 0xb9783f,
    accent: 0xffffff,
    baseAttack: 38,
    baseDefense: 42,
    level: 1,
    skill: { name: '聞香尋糧', description: '出征帶回的糧草 +10%' },
    rarity: 'N',
    size: '小型',
  },
  {
    id: 'changgong',
    name: '長弓',
    breed: '臘腸犬',
    personality: '固執、愛挖洞，認定的事九頭牛也拉不回',
    role: '前排／突擊',
    color: 0x7a4a2a,
    accent: 0xc9955f,
    baseAttack: 50,
    baseDefense: 30,
    level: 1,
    skill: { name: '掘地突襲', description: '從地底鑽出來，攻擊敵方後排' },
    rarity: 'N',
    size: '小型',
  },
  {
    id: 'yuandun',
    name: '圓盾',
    breed: '法國鬥牛犬',
    personality: '黏人、愛玩，擋在前面一步都不退',
    role: '前排／守護',
    color: 0x5b5450,
    accent: 0xe9e2d8,
    baseAttack: 40,
    baseDefense: 58,
    level: 1,
    skill: { name: '肉盾衝撞', description: '替血量最少的隊友擋下一次攻擊' },
    rarity: 'R',
    size: '小型',
  },
  {
    id: 'modian',
    name: '墨點',
    breed: '大麥町',
    personality: '活力用不完，跑起來像一陣花風',
    role: '前排／突擊',
    color: 0xf4f1ec,
    accent: 0x2b2b2b,
    baseAttack: 62,
    baseDefense: 36,
    level: 1,
    skill: { name: '連環飛撲', description: '攻擊後有機率再追加一擊' },
    rarity: 'R',
    size: '中型',
  },
  {
    id: 'zhuifeng',
    name: '追風',
    breed: '喜樂蒂',
    personality: '敏感、聰明，最愛把大家趕成一隊',
    role: '後排／謀略',
    color: 0xc98b4b,
    accent: 0xfffaf0,
    baseAttack: 54,
    baseDefense: 42,
    level: 1,
    skill: { name: '牧陣', description: '重新整隊，隊伍防禦 +10%' },
    rarity: 'R',
    size: '中型',
  },
  {
    id: 'shanlan',
    name: '山嵐',
    breed: '台灣犬',
    personality: '忠心、機警，山路再陡也認得回家的方向',
    role: '隊長／補給',
    color: 0x3b2f2a,
    accent: 0xa0703f,
    baseAttack: 56,
    baseDefense: 56,
    level: 1,
    skill: { name: '識途', description: '帶路走捷徑，隊伍先攻' },
    rarity: 'SR',
    size: '中型',
  },
  {
    id: 'jiying',
    name: '疾影',
    breed: '杜賓',
    personality: '機警、俐落，出手比影子還快',
    role: '前排／突擊',
    color: 0x2a2422,
    accent: 0xa3642f,
    baseAttack: 74,
    baseDefense: 40,
    level: 1,
    skill: { name: '影襲', description: '第一擊必定命中要害' },
    rarity: 'SR',
    size: '大型',
  },
  {
    id: 'xiongyue',
    name: '熊嶽',
    breed: '高加索犬',
    personality: '沉著、無畏，站著就像一座小山',
    role: '前排／守護',
    color: 0x8c7a66,
    accent: 0x4a3d33,
    baseAttack: 58,
    baseDefense: 72,
    level: 1,
    skill: { name: '不動如山', description: '血量越少防禦越高' },
    rarity: 'SSR',
    size: '大型',
  },
  {
    id: 'xueling',
    name: '雪綾',
    breed: '蘇俄牧羊犬',
    personality: '優雅、安靜，看穿對手才慢慢開口',
    role: '後排／謀略',
    color: 0xf2ede4,
    accent: 0xc9b59a,
    baseAttack: 76,
    baseDefense: 50,
    level: 1,
    skill: { name: '雪上無痕', description: '看穿敵方陣形，隊伍攻擊 +15%' },
    rarity: 'SSR',
    size: '大型',
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
    rarity: 'SR',
    size: '大型',
    rewardOnly: true,
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
