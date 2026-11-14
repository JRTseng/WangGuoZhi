import type { DogRarity } from './dogs';

/**
 * 狗狗裝備（T014）。五個部位，每隻狗每個部位最多穿一件。
 * 名字走台灣人愛的諧音梗（Jimmy 2026-11-12），造型與名字全部原創；pun 是原本那句話，給說明用。
 * 加成合計照稀有度：N +2、R +4、SR +7、SSR +12（見 GEAR_BONUS），攻擊與防禦怎麼分看部位：
 * 手套全加攻擊、衣服全加防禦、鞋子偏攻擊、褲子偏防禦、頭飾攻防各半。
 * GEARS 是一般裝備（關卡會掉）；專屬裝備在下面的 EXCLUSIVE_GEARS。
 * 純資料，不放公式；穿脫與掉落的規則在 src/logic/equipment.ts。
 */
export type GearSlot = 'clothes' | 'gloves' | 'pants' | 'shoes' | 'head';

export const GEAR_SLOTS: readonly GearSlot[] = ['clothes', 'gloves', 'pants', 'shoes', 'head'];

export const GEAR_SLOT_LABEL: Readonly<Record<GearSlot, string>> = {
  clothes: '衣服',
  gloves: '手套',
  pants: '褲子',
  shoes: '鞋子',
  head: '頭飾',
};

/** 每個稀有度的加成合計（攻擊 + 防禦） */
export const GEAR_BONUS: Readonly<Record<DogRarity, number>> = { N: 2, R: 4, SR: 7, SSR: 12 };

/** 畫在狗身上與圖示的樣式；同一個部位不同樣式畫法不同 */
export type GearStyle =
  | 'bib'
  | 'sweater'
  | 'vest'
  | 'robe'
  | 'mitt'
  | 'boxing'
  | 'diaper'
  | 'shorts'
  | 'trousers'
  | 'sneaker'
  | 'boots'
  | 'bandana'
  | 'cone'
  | 'bow'
  | 'hat'
  | 'crown';

export interface GearData {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: DogRarity;
  attack: number;
  defense: number;
  /** 名字是從哪句話來的 */
  pun: string;
  /** 一句可愛的說明 */
  note: string;
  style: GearStyle;
  /** 主色與點綴色 */
  color: number;
  accent: number;
  /** 專屬裝備：只有這隻狗能穿（狗狗 id）；拿到這隻狗就送，不會從關卡掉 */
  exclusive?: string;
  /** 專屬裝備的額外加成：穿上後攻擊、防禦各多這個比例（以沒算裝備的攻防為準） */
  pct?: number;
}

/** 專屬裝備的加成：SR 合計 +10；SSR 合計 +16，攻防再各 +5%（暫定） */
export const EXCLUSIVE_BONUS: Readonly<Record<'SR' | 'SSR', number>> = { SR: 10, SSR: 16 };
export const EXCLUSIVE_SSR_PCT = 0.05;

export const GEARS: readonly GearData[] = [
  // ---- 衣服：全加防禦 ----
  {
    id: 'bib-douzhezou',
    name: '兜著走圍兜',
    slot: 'clothes',
    rarity: 'N',
    attack: 0,
    defense: 2,
    pun: '吃不完兜著走',
    note: '掉下來的飼料通通接住，吃不完還能打包。',
    style: 'bib',
    color: 0xfff3e0,
    accent: 0xe07a5f,
  },
  {
    id: 'sweater-wufeng',
    name: '毛衣無縫',
    slot: 'clothes',
    rarity: 'R',
    attack: 0,
    defense: 4,
    pun: '天衣無縫',
    note: '阿嬤織的，一個線頭都找不到。',
    style: 'sweater',
    color: 0xc8553d,
    accent: 0xfff3e0,
  },
  {
    id: 'vest-yiyibushe',
    name: '衣衣不捨背心',
    slot: 'clothes',
    rarity: 'SR',
    attack: 0,
    defense: 7,
    pun: '依依不捨',
    note: '穿上去就捨不得脫，洗澡也想穿。',
    style: 'vest',
    color: 0x3f7fa8,
    accent: 0xf2cc8f,
  },
  {
    id: 'robe-yimingjingren',
    name: '衣鳴驚人戰袍',
    slot: 'clothes',
    rarity: 'SSR',
    attack: 0,
    defense: 12,
    pun: '一鳴驚人',
    note: '一披上去，整條街的狗都回頭看。',
    style: 'robe',
    color: 0xb5452b,
    accent: 0xf4c430,
  },
  // ---- 手套：全加攻擊 ----
  {
    id: 'mitt-taojiaoqing',
    name: '套交情手套',
    slot: 'gloves',
    rarity: 'N',
    attack: 2,
    defense: 0,
    pun: '套交情',
    note: '戴著跟誰握手都像老朋友。',
    style: 'mitt',
    color: 0xf2cc8f,
    accent: 0xe8a0a0,
  },
  {
    id: 'boxing-quanquan',
    name: '拳拳到肉球',
    slot: 'gloves',
    rarity: 'R',
    attack: 4,
    defense: 0,
    pun: '拳拳到肉',
    note: '每一拳都軟軟的，但是很有感。',
    style: 'boxing',
    color: 0xc0392b,
    accent: 0xffffff,
  },
  {
    id: 'mitt-aibushi',
    name: '愛不釋手套',
    slot: 'gloves',
    rarity: 'SR',
    attack: 7,
    defense: 0,
    pun: '愛不釋手',
    note: '摸過的骨頭就不想放下。',
    style: 'mitt',
    color: 0x8e44ad,
    accent: 0xf7d6ff,
  },
  {
    id: 'boxing-zhetian',
    name: '一手遮天套',
    slot: 'gloves',
    rarity: 'SSR',
    attack: 12,
    defense: 0,
    pun: '一手遮天',
    note: '一掌舉起來，太陽都被擋住半邊。',
    style: 'boxing',
    color: 0xd99a1c,
    accent: 0x6b4a2e,
  },
  // ---- 褲子：偏防禦 ----
  {
    id: 'diaper-baonimanyi',
    name: '包你滿意尿布',
    slot: 'pants',
    rarity: 'N',
    attack: 0,
    defense: 2,
    pun: '包你滿意',
    note: '包得牢牢的，出門不怕尷尬。',
    style: 'diaper',
    color: 0xffffff,
    accent: 0x9bc1bc,
  },
  {
    id: 'shorts-kuku',
    name: '褲褲的短褲',
    slot: 'pants',
    rarity: 'R',
    attack: 1,
    defense: 3,
    pun: '酷酷的',
    note: '穿上去走路自動變慢動作。',
    style: 'shorts',
    color: 0x3d5a94,
    accent: 0xf2cc8f,
  },
  {
    id: 'trousers-kujinganlai',
    name: '褲盡甘來',
    slot: 'pants',
    rarity: 'SR',
    attack: 2,
    defense: 5,
    pun: '苦盡甘來',
    note: '練到腿痠的那條褲子，穿久了會有甜頭。',
    style: 'trousers',
    color: 0x4f8a3c,
    accent: 0xfff3e0,
  },
  {
    id: 'trousers-chikunailao',
    name: '吃褲耐勞工作褲',
    slot: 'pants',
    rarity: 'SSR',
    attack: 4,
    defense: 8,
    pun: '吃苦耐勞',
    note: '膝蓋補了三層，怎麼跪怎麼爬都不會破。',
    style: 'trousers',
    color: 0x6b4a2e,
    accent: 0xd99a1c,
  },
  // ---- 鞋子：偏攻擊 ----
  {
    id: 'sneaker-xiexieni',
    name: '鞋鞋你布鞋',
    slot: 'shoes',
    rarity: 'N',
    attack: 2,
    defense: 0,
    pun: '謝謝你',
    note: '每走一步都很有禮貌。',
    style: 'sneaker',
    color: 0xf7f4ee,
    accent: 0xe07a5f,
  },
  {
    id: 'boots-yuguotianxie',
    name: '雨過天鞋',
    slot: 'shoes',
    rarity: 'R',
    attack: 3,
    defense: 1,
    pun: '雨過天晴',
    note: '踩水窪專用，踩完天就放晴。',
    style: 'boots',
    color: 0xf4c430,
    accent: 0x3f7fa8,
  },
  {
    id: 'boots-xieshouhezuo',
    name: '鞋手合作靴',
    slot: 'shoes',
    rarity: 'SR',
    attack: 5,
    defense: 2,
    pun: '攜手合作',
    note: '四隻腳終於不會各走各的。',
    style: 'boots',
    color: 0x8e44ad,
    accent: 0xf2cc8f,
  },
  {
    id: 'sneaker-wuxiekeji',
    name: '無鞋可擊',
    slot: 'shoes',
    rarity: 'SSR',
    attack: 8,
    defense: 4,
    pun: '無懈可擊',
    note: '跑起來連影子都追不上，找不到破綻。',
    style: 'sneaker',
    color: 0xd99a1c,
    accent: 0xb5452b,
  },
  // ---- 頭飾：攻防各半 ----
  {
    id: 'bandana-jinjinjijiao',
    name: '巾巾計較頭巾',
    slot: 'head',
    rarity: 'N',
    attack: 1,
    defense: 1,
    pun: '斤斤計較',
    note: '綁上去之後，零食少一顆都算得出來。',
    style: 'bandana',
    color: 0xc8553d,
    accent: 0xfff3e0,
  },
  {
    id: 'cone-taolao',
    name: '套牢頭套',
    slot: 'head',
    rarity: 'N',
    attack: 0,
    defense: 2,
    pun: '套牢',
    note: '受傷戴的那種。套上去就拿不下來，跟某些股票一樣。',
    style: 'cone',
    color: 0xdfeaf2,
    accent: 0x8d99ae,
  },
  {
    id: 'bow-jiejiegaosheng',
    name: '結結高升蝴蝶結',
    slot: 'head',
    rarity: 'R',
    attack: 2,
    defense: 2,
    pun: '節節高升',
    note: '打得越大，氣勢越高。',
    style: 'bow',
    color: 0xe8749a,
    accent: 0xffffff,
  },
  {
    id: 'hat-maoxianfannan',
    name: '帽險犯難探險帽',
    slot: 'head',
    rarity: 'SR',
    attack: 4,
    defense: 3,
    pun: '冒險犯難',
    note: '戴上去就想往沒去過的草叢鑽。',
    style: 'hat',
    color: 0x8a6f55,
    accent: 0x4f8a3c,
  },
  {
    id: 'crown-yiguandaodi',
    name: '一冠到底小皇冠',
    slot: 'head',
    rarity: 'SSR',
    attack: 6,
    defense: 6,
    pun: '一貫到底',
    note: '戴上去就要當王當到底，不准中途耍賴。',
    style: 'crown',
    color: 0xf4c430,
    accent: 0xc0392b,
  },
];

/**
 * 專屬裝備：SR、SSR 的狗各有一件，只有牠自己能穿，拿到那隻狗就送（Jimmy 2026-11-13：越稀有越華麗、功能越強）。
 * SR 合計 +10；SSR 合計 +16，穿上後攻防再各 +5%。不會從關卡掉。
 */
export const EXCLUSIVE_GEARS: readonly GearData[] = [
  {
    id: 'ex-tieya',
    name: '牙牙學衣鐵甲',
    slot: 'clothes',
    rarity: 'SR',
    attack: 0,
    defense: 10,
    pun: '牙牙學語',
    note: '鐵牙小時候的第一件鐵甲，上面還有牙印。',
    style: 'vest',
    color: 0x8d99ae,
    accent: 0x8a5a2b,
    exclusive: 'tieya',
  },
  {
    id: 'ex-shanlan',
    name: '老馬識鞋',
    slot: 'shoes',
    rarity: 'SR',
    attack: 6,
    defense: 4,
    pun: '老馬識途',
    note: '穿上去閉著眼睛也走得回家。',
    style: 'boots',
    color: 0x4f8a3c,
    accent: 0x3b2f2a,
    exclusive: 'shanlan',
  },
  {
    id: 'ex-jiying',
    name: '捕風捉影爪套',
    slot: 'gloves',
    rarity: 'SR',
    attack: 10,
    defense: 0,
    pun: '捕風捉影',
    note: '揮出去只看得到殘影。',
    style: 'mitt',
    color: 0x2a2422,
    accent: 0xc0392b,
    exclusive: 'jiying',
  },
  {
    id: 'ex-shuangtong',
    name: '另眼相看眼罩',
    slot: 'head',
    rarity: 'SR',
    attack: 5,
    defense: 5,
    pun: '另眼相看',
    note: '一藍一褐兩個鏡片，戴上去誰都多看兩眼。',
    style: 'bandana',
    color: 0x6f7f93,
    accent: 0x7ad0e8,
    exclusive: 'shuangtong',
  },
  {
    id: 'ex-jinling',
    name: '鈴機一動鈴鐺',
    slot: 'clothes',
    rarity: 'SR',
    attack: 4,
    defense: 6,
    pun: '靈機一動',
    note: '叮一聲，好主意就來了。',
    style: 'bib',
    color: 0xf4c430,
    accent: 0xd9762b,
    exclusive: 'jinling',
  },
  {
    id: 'ex-xiongyue',
    name: '熊熊烈褲',
    slot: 'pants',
    rarity: 'SSR',
    attack: 4,
    defense: 12,
    pun: '熊熊烈火',
    note: '褲管繡著火焰，其實很保暖。',
    style: 'trousers',
    color: 0xb5452b,
    accent: 0xf4c430,
    exclusive: 'xiongyue',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-xueling',
    name: '雪中送鞋',
    slot: 'shoes',
    rarity: 'SSR',
    attack: 11,
    defense: 5,
    pun: '雪中送炭',
    note: '踩在雪上不留腳印，還暖呼呼的。',
    style: 'boots',
    color: 0xdfeaf2,
    accent: 0x7ad0e8,
    exclusive: 'xueling',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-nuantong',
    name: '桶一天下披風',
    slot: 'clothes',
    rarity: 'SSR',
    attack: 4,
    defense: 12,
    pun: '統一天下',
    note: '披上去，全天下的狗都想靠過來取暖。',
    style: 'robe',
    color: 0xb5652f,
    accent: 0xfff3e0,
    exclusive: 'nuantong',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-liuxing',
    name: '流星趕月爪',
    slot: 'gloves',
    rarity: 'SSR',
    attack: 16,
    defense: 0,
    pun: '流星趕月',
    note: '出爪的時候會拖一條亮亮的尾巴。',
    style: 'boxing',
    color: 0xb9bfc9,
    accent: 0xf4c430,
    exclusive: 'liuxing',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-songling',
    name: '一聲嶺下將軍盔',
    slot: 'head',
    rarity: 'SSR',
    attack: 8,
    defense: 8,
    pun: '一聲令下',
    note: '戴上去吠一聲，全隊立正。',
    style: 'hat',
    color: 0xc77b3b,
    accent: 0xf4c430,
    exclusive: 'songling',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-fuqiu',
    name: '球之不得蝴蝶結',
    slot: 'head',
    rarity: 'SSR',
    attack: 8,
    defense: 8,
    pun: '求之不得',
    note: '別的狗求都求不到的好運，打個結綁在頭上。',
    style: 'bow',
    color: 0xf0a04a,
    accent: 0xfff3e0,
    exclusive: 'fuqiu',
    pct: EXCLUSIVE_SSR_PCT,
  },
  {
    id: 'ex-haiyan',
    name: '海晏河清救生衣',
    slot: 'clothes',
    rarity: 'SSR',
    attack: 4,
    defense: 12,
    pun: '海晏河清',
    note: '穿著牠下水，再大的浪都會靜下來。',
    style: 'vest',
    color: 0xe07a2b,
    accent: 0x2e3a4a,
    exclusive: 'haiyan',
    pct: EXCLUSIVE_SSR_PCT,
  },
];

/** 全部的裝備：一般的＋專屬的 */
export const ALL_GEARS: readonly GearData[] = [...GEARS, ...EXCLUSIVE_GEARS];

export function findGear(id: string): GearData | undefined {
  return ALL_GEARS.find((g) => g.id === id);
}

/** 這隻狗的專屬裝備；沒有回傳 undefined */
export function exclusiveGearOf(dogId: string): GearData | undefined {
  return EXCLUSIVE_GEARS.find((g) => g.exclusive === dogId);
}
