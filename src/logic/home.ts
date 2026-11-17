import type { Faction } from '../data/dogs';
import type { GameState } from '../state/gameState';

/**
 * 我的家（T033，Jimmy 2026-11-17）：
 * 「讓使用者有一個自己的家，提供一些家具，可以放五隻角色進去裡面，屋內的場景跟屋外的庭院或者草皮，
 *   例如貓就是有貓跳台，狗的屋外可以泳池或者丟飛盤玩球球」。
 *
 * - 兩個場景：屋內、庭院。每個場景有自己的家具，家具有固定的擺放位置，擺出來或收起來。
 * - 最多住五隻角色，會在家裡走來走去，走到家具旁邊就玩那個家具（泡泳池、爬跳台、追球…）。
 * - 家具全部免費、一開始就有（暫定）；純外觀，不影響戰鬥數值。
 * 這裡只放資料與規則，畫面在 src/scenes/HomeScene.ts。
 */
export type HomeArea = 'indoor' | 'yard';
export const HOME_AREAS: readonly HomeArea[] = ['indoor', 'yard'];
export const HOME_AREA_LABEL: Readonly<Record<HomeArea, string>> = { indoor: '屋內', yard: '庭院' };

/** 最多住幾隻 */
export const HOME_MAX = 5;

/** 角色走到家具旁邊做什麼 */
export type HomePlay =
  /** 趴上去睡覺（沙發、窩、吊床） */
  | 'nap'
  /** 坐著（地毯、遮陽傘下） */
  | 'sit'
  /** 跳到上面坐著（貓跳台、紙箱、狗屋屋頂） */
  | 'perch'
  /** 吃東西（飯碗） */
  | 'eat'
  /** 泡在水裡（泳池） */
  | 'swim'
  /** 追著跑（球、飛盤、毛線球） */
  | 'chase'
  /** 聞一聞、看一看（盆栽、花圃、魚缸） */
  | 'look'
  /** 鑽進去只露出頭（紙箱、帳篷、沙坑） */
  | 'hide'
  /** 跳過去（跳欄、圈圈） */
  | 'jump';

export interface FurnitureData {
  id: string;
  name: string;
  area: HomeArea;
  play: HomePlay;
  /** 角色待在上面時離地多高（沙發的座位、貓跳台的頂） */
  lift: number;
  /** 擺出來時預設放在場地的哪裡（0～1，x 由左到右；y 由遠到近）；之後可以自己拖 */
  x: number;
  y: number;
  /** 一句說明 */
  note: string;
  /** 哪一國的人一開始就擺出來（沒寫是兩邊都擺，none 是都不擺、要自己拿出來） */
  starter?: Faction | 'none';
}

/** 家具 50 種（Jimmy 2026-11-17：「家具類先提供50種」）：屋內 25、庭院 25 */
export const FURNITURE: readonly FurnitureData[] = [
  // ---- 屋內 ----
  {
    id: 'sofa',
    name: '沙發',
    area: 'indoor',
    play: 'nap',
    lift: 24,
    x: 0.18,
    y: 0.1,
    note: '全家最搶手的位置。',
  },
  {
    id: 'armchair',
    name: '單人椅',
    area: 'indoor',
    play: 'sit',
    lift: 22,
    x: 0.36,
    y: 0.1,
    note: '坐上去就不想讓位。',
    starter: 'none',
  },
  {
    id: 'rug',
    name: '圓地毯',
    area: 'indoor',
    play: 'sit',
    lift: 0,
    x: 0.46,
    y: 0.6,
    note: '踩起來軟軟的。',
  },
  {
    id: 'cattree',
    name: '貓跳台',
    area: 'indoor',
    play: 'perch',
    lift: 96,
    x: 0.86,
    y: 0.16,
    note: '爬到最高的地方看大家。',
    starter: 'cat',
  },
  {
    id: 'box',
    name: '紙箱',
    area: 'indoor',
    play: 'hide',
    lift: 0,
    x: 0.64,
    y: 0.82,
    note: '比買來的窩還好睡。',
    starter: 'cat',
  },
  {
    id: 'yarn',
    name: '毛線球',
    area: 'indoor',
    play: 'chase',
    lift: 0,
    x: 0.3,
    y: 0.86,
    note: '滾一滾就停不下來。',
    starter: 'cat',
  },
  {
    id: 'bed',
    name: '軟軟的窩',
    area: 'indoor',
    play: 'nap',
    lift: 6,
    x: 0.66,
    y: 0.22,
    note: '一躺下去就不想起來。',
    starter: 'dog',
  },
  {
    id: 'bowl',
    name: '飯碗',
    area: 'indoor',
    play: 'eat',
    lift: 0,
    x: 0.08,
    y: 0.72,
    note: '永遠覺得還沒吃飽。',
  },
  {
    id: 'plant',
    name: '盆栽',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.5,
    y: 0.06,
    note: '葉子很好聞，但是不能咬。',
  },
  {
    id: 'fishtank',
    name: '魚缸',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.95,
    y: 0.7,
    note: '可以看一整個下午。',
    starter: 'none',
  },
  {
    id: 'shelf',
    name: '書櫃',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.6,
    y: 0.04,
    note: '最上面那格放著零食。',
    starter: 'none',
  },
  {
    id: 'lamp',
    name: '立燈',
    area: 'indoor',
    play: 'sit',
    lift: 0,
    x: 0.04,
    y: 0.12,
    note: '燈下面特別溫暖。',
    starter: 'none',
  },
  {
    id: 'table',
    name: '小茶几',
    area: 'indoor',
    play: 'perch',
    lift: 30,
    x: 0.3,
    y: 0.4,
    note: '明明不能上去，還是想上去。',
    starter: 'none',
  },
  {
    id: 'tv',
    name: '電視',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.72,
    y: 0.04,
    note: '今天播的是動物頻道。',
    starter: 'none',
  },
  {
    id: 'fireplace',
    name: '壁爐',
    area: 'indoor',
    play: 'nap',
    lift: 0,
    x: 0.4,
    y: 0.04,
    note: '冬天大家都擠在這裡。',
    starter: 'none',
  },
  {
    id: 'scratch',
    name: '貓抓柱',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.76,
    y: 0.5,
    note: '抓一抓，爪子舒服多了。',
    starter: 'cat',
  },
  {
    id: 'tunnel',
    name: '布隧道',
    area: 'indoor',
    play: 'hide',
    lift: 0,
    x: 0.5,
    y: 0.86,
    note: '鑽進去再從另一頭衝出來。',
    starter: 'none',
  },
  {
    id: 'cushion',
    name: '大坐墊',
    area: 'indoor',
    play: 'nap',
    lift: 4,
    x: 0.16,
    y: 0.5,
    note: '太陽曬過，暖暖的。',
  },
  {
    id: 'clock',
    name: '落地鐘',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.94,
    y: 0.06,
    note: '每個整點都被嚇一跳。',
    starter: 'none',
  },
  {
    id: 'toybox',
    name: '玩具箱',
    area: 'indoor',
    play: 'look',
    lift: 0,
    x: 0.86,
    y: 0.86,
    note: '裡面什麼都有。',
    starter: 'dog',
  },
  {
    id: 'fan',
    name: '電風扇',
    area: 'indoor',
    play: 'sit',
    lift: 0,
    x: 0.06,
    y: 0.42,
    note: '吹得毛都飛起來。',
    starter: 'none',
  },
  {
    id: 'kotatsu',
    name: '暖桌',
    area: 'indoor',
    play: 'hide',
    lift: 0,
    x: 0.56,
    y: 0.42,
    note: '鑽進去只露出一顆頭。',
    starter: 'none',
  },
  {
    id: 'fountainbowl',
    name: '飲水機',
    area: 'indoor',
    play: 'eat',
    lift: 0,
    x: 0.2,
    y: 0.72,
    note: '流動的水比較好喝。',
    starter: 'none',
  },
  {
    id: 'bone',
    name: '大骨頭',
    area: 'indoor',
    play: 'chase',
    lift: 0,
    x: 0.4,
    y: 0.88,
    note: '咬起來喀喀響。',
    starter: 'dog',
  },
  {
    id: 'mouse',
    name: '老鼠玩偶',
    area: 'indoor',
    play: 'chase',
    lift: 0,
    x: 0.72,
    y: 0.9,
    note: '一動就忍不住撲過去。',
    starter: 'none',
  },
  // ---- 庭院 ----
  {
    id: 'pool',
    name: '泳池',
    area: 'yard',
    play: 'swim',
    lift: 0,
    x: 0.24,
    y: 0.6,
    note: '夏天泡在裡面最舒服。',
    starter: 'dog',
  },
  {
    id: 'frisbee',
    name: '飛盤',
    area: 'yard',
    play: 'chase',
    lift: 0,
    x: 0.6,
    y: 0.5,
    note: '丟出去就有人追。',
    starter: 'dog',
  },
  {
    id: 'ball',
    name: '球球',
    area: 'yard',
    play: 'chase',
    lift: 0,
    x: 0.76,
    y: 0.86,
    note: '滾到哪追到哪。',
  },
  {
    id: 'kennel',
    name: '小木屋',
    area: 'yard',
    play: 'perch',
    lift: 62,
    x: 0.88,
    y: 0.12,
    note: '屋頂曬太陽剛剛好。',
  },
  {
    id: 'parasol',
    name: '遮陽傘',
    area: 'yard',
    play: 'sit',
    lift: 0,
    x: 0.52,
    y: 0.12,
    note: '躲太陽的好地方。',
  },
  {
    id: 'flowers',
    name: '花圃',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.1,
    y: 0.08,
    note: '蝴蝶常常飛過來。',
  },
  {
    id: 'hammock',
    name: '吊床',
    area: 'yard',
    play: 'nap',
    lift: 30,
    x: 0.3,
    y: 0.12,
    note: '搖一搖就睡著了。',
    starter: 'cat',
  },
  {
    id: 'catgrass',
    name: '貓草盆',
    area: 'yard',
    play: 'eat',
    lift: 0,
    x: 0.95,
    y: 0.74,
    note: '聞一下心情就很好。',
    starter: 'cat',
  },
  {
    id: 'tree',
    name: '大樹',
    area: 'yard',
    play: 'sit',
    lift: 0,
    x: 0.7,
    y: 0.06,
    note: '樹蔭下最涼。',
    starter: 'none',
  },
  {
    id: 'bench',
    name: '長椅',
    area: 'yard',
    play: 'perch',
    lift: 26,
    x: 0.4,
    y: 0.3,
    note: '坐著看大家玩。',
    starter: 'none',
  },
  {
    id: 'slide',
    name: '溜滑梯',
    area: 'yard',
    play: 'perch',
    lift: 58,
    x: 0.84,
    y: 0.44,
    note: '爬上去，咻一下滑下來。',
    starter: 'none',
  },
  {
    id: 'sandbox',
    name: '沙坑',
    area: 'yard',
    play: 'hide',
    lift: 0,
    x: 0.5,
    y: 0.84,
    note: '挖洞挖到看不見。',
    starter: 'none',
  },
  {
    id: 'tent',
    name: '帳篷',
    area: 'yard',
    play: 'hide',
    lift: 0,
    x: 0.12,
    y: 0.34,
    note: '今天晚上睡外面。',
    starter: 'none',
  },
  {
    id: 'bbq',
    name: '烤肉架',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.64,
    y: 0.24,
    note: '香味飄過來，大家都圍過來。',
    starter: 'none',
  },
  {
    id: 'fountain',
    name: '噴水池',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.46,
    y: 0.5,
    note: '水花濺到鼻子上。',
    starter: 'none',
  },
  {
    id: 'swing',
    name: '鞦韆',
    area: 'yard',
    play: 'nap',
    lift: 30,
    x: 0.2,
    y: 0.1,
    note: '盪得高高的。',
    starter: 'none',
  },
  {
    id: 'tire',
    name: '輪胎',
    area: 'yard',
    play: 'perch',
    lift: 20,
    x: 0.92,
    y: 0.9,
    note: '鑽過去、跳上去都好玩。',
    starter: 'none',
  },
  {
    id: 'hurdle',
    name: '跳欄',
    area: 'yard',
    play: 'jump',
    lift: 0,
    x: 0.36,
    y: 0.88,
    note: '跳過去的樣子最帥。',
    starter: 'none',
  },
  {
    id: 'agility',
    name: '鑽圈圈',
    area: 'yard',
    play: 'jump',
    lift: 0,
    x: 0.62,
    y: 0.8,
    note: '一二三，穿過去。',
    starter: 'none',
  },
  {
    id: 'lantern',
    name: '石燈籠',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.96,
    y: 0.3,
    note: '晚上會亮起來。',
    starter: 'none',
  },
  {
    id: 'pond',
    name: '小池塘',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.74,
    y: 0.62,
    note: '裡面有魚游來游去。',
    starter: 'none',
  },
  {
    id: 'stump',
    name: '樹樁',
    area: 'yard',
    play: 'perch',
    lift: 26,
    x: 0.06,
    y: 0.62,
    note: '站上去剛剛好一隻。',
    starter: 'none',
  },
  {
    id: 'snowman',
    name: '雪人',
    area: 'yard',
    play: 'look',
    lift: 0,
    x: 0.06,
    y: 0.9,
    note: '鼻子是一根紅蘿蔔。',
    starter: 'none',
  },
  {
    id: 'picnic',
    name: '野餐墊',
    area: 'yard',
    play: 'eat',
    lift: 0,
    x: 0.36,
    y: 0.58,
    note: '籃子裡有三明治。',
    starter: 'none',
  },
  {
    id: 'campfire',
    name: '營火',
    area: 'yard',
    play: 'sit',
    lift: 0,
    x: 0.52,
    y: 0.3,
    note: '圍著火聽故事。',
    starter: 'none',
  },
];

export function findFurniture(id: string): FurnitureData | undefined {
  return FURNITURE.find((f) => f.id === id);
}

export function furnitureOf(area: HomeArea): FurnitureData[] {
  return FURNITURE.filter((f) => f.area === area);
}

/** 庭院遠處的景色 */
export type HomeBackdrop =
  'hills' | 'sea' | 'snow' | 'bamboo' | 'forest' | 'dunes' | 'lake' | 'clouds' | 'city' | 'volcano';

/**
 * 家的地形與風格（Jimmy 2026-11-17：「家的地形與風格也提供15種讓使用者選擇」）。
 * 一種風格同時決定庭院的地形（天空、地面、遠景）和屋內的配色（牆、地板）；全部免費，隨時可換。
 */
export interface HomeStyle {
  id: string;
  name: string;
  note: string;
  /** 庭院：天空上下兩色、地面兩色、遠景種類與顏色、圍籬顏色 */
  sky: readonly [number, number];
  ground: readonly [number, number];
  backdrop: HomeBackdrop;
  far: number;
  fence: number;
  /** 屋內：牆、牆腳板、地板、地板線 */
  wall: number;
  trim: number;
  floor: number;
  plank: number;
  /** 晚上的風格：天上有星星，窗外是暗的 */
  night?: boolean;
  /** 天上飄的東西 */
  drift?: 'petal' | 'snow' | 'leaf' | 'firefly';
}

export const HOME_STYLES: readonly HomeStyle[] = [
  {
    id: 'meadow',
    name: '草原木屋',
    note: '一大片草地，最適合跑來跑去。',
    sky: [0x8fd0f0, 0xd8f0f6],
    ground: [0x8ccf6a, 0x74b957],
    backdrop: 'hills',
    far: 0x6fae6a,
    fence: 0xf4ead8,
    wall: 0xf3dfc0,
    trim: 0xb98a5a,
    floor: 0xd4a570,
    plank: 0xb98a5a,
  },
  {
    id: 'beach',
    name: '海邊小屋',
    note: '踩著沙子聽海浪。',
    sky: [0x6ec3ee, 0xcdeffa],
    ground: [0xf1dba0, 0xe3c684],
    backdrop: 'sea',
    far: 0x3d9ed0,
    fence: 0xffffff,
    wall: 0xe6f3f5,
    trim: 0x5fa8c4,
    floor: 0xe9d3a4,
    plank: 0xcbb07a,
  },
  {
    id: 'snow',
    name: '雪地木屋',
    note: '外面下雪，屋裡暖呼呼。',
    sky: [0xb9cfe6, 0xeaf2fa],
    ground: [0xf6fafd, 0xdfe9f3],
    backdrop: 'snow',
    far: 0xc6d6e8,
    fence: 0x9a6b3f,
    wall: 0xc98f5e,
    trim: 0x7a4f2c,
    floor: 0xa9713f,
    plank: 0x8a5a30,
    drift: 'snow',
  },
  {
    id: 'bamboo',
    name: '竹林茶屋',
    note: '風吹過來沙沙響。',
    sky: [0xbfe3c6, 0xeaf6e0],
    ground: [0xa9c97a, 0x93b465],
    backdrop: 'bamboo',
    far: 0x5f9a58,
    fence: 0xc9b06a,
    wall: 0xf0ead2,
    trim: 0x6b8a4a,
    floor: 0xcdbb7c,
    plank: 0xa99a5c,
    drift: 'leaf',
  },
  {
    id: 'sakura',
    name: '櫻花庭園',
    note: '花瓣一直飄下來。',
    sky: [0xf6c9dc, 0xfdeef2],
    ground: [0xa8d58a, 0x92c275],
    backdrop: 'forest',
    far: 0xf3a6c2,
    fence: 0x8a5a3c,
    wall: 0xfbe9ec,
    trim: 0xd9869f,
    floor: 0xd9b088,
    plank: 0xbf9368,
    drift: 'petal',
  },
  {
    id: 'desert',
    name: '沙漠土屋',
    note: '白天很熱，還好有泳池。',
    sky: [0xf2b866, 0xfbe4b4],
    ground: [0xe8c27a, 0xd9ac5f],
    backdrop: 'dunes',
    far: 0xd79a4c,
    fence: 0xc07a3e,
    wall: 0xe9c79a,
    trim: 0xb5651d,
    floor: 0xc98f5a,
    plank: 0xa9713f,
  },
  {
    id: 'forest',
    name: '森林樹屋',
    note: '住在大樹旁邊，到處都是綠的。',
    sky: [0x9fd6b8, 0xdff3e2],
    ground: [0x6fb061, 0x5c9a52],
    backdrop: 'forest',
    far: 0x3f7f4a,
    fence: 0x8a6a45,
    wall: 0xb98a5a,
    trim: 0x6b4a2e,
    floor: 0x9a6b3f,
    plank: 0x7a5230,
    drift: 'leaf',
  },
  {
    id: 'lake',
    name: '湖畔小屋',
    note: '湖面像鏡子一樣。',
    sky: [0x9ed2ee, 0xe4f4f8],
    ground: [0x98cf7c, 0x80ba66],
    backdrop: 'lake',
    far: 0x5fb0d6,
    fence: 0xe8dcc4,
    wall: 0xe4eef0,
    trim: 0x4f8aa0,
    floor: 0xcfa878,
    plank: 0xb08a5c,
  },
  {
    id: 'peak',
    name: '山頂雲海',
    note: '家在雲的上面。',
    sky: [0x79b8ec, 0xe8f4fc],
    ground: [0xb7cf9a, 0xa0ba84],
    backdrop: 'clouds',
    far: 0xffffff,
    fence: 0xd8c3a5,
    wall: 0xeef2f6,
    trim: 0x8aa0b8,
    floor: 0xc9b99a,
    plank: 0xa99878,
  },
  {
    id: 'maple',
    name: '秋天楓林',
    note: '滿地都是紅葉。',
    sky: [0xf4c089, 0xfdecc8],
    ground: [0xd9a85a, 0xc68f45],
    backdrop: 'forest',
    far: 0xd9603a,
    fence: 0x7a4f2c,
    wall: 0xf2d6a8,
    trim: 0xb5562a,
    floor: 0xc0824a,
    plank: 0x9a6232,
    drift: 'leaf',
  },
  {
    id: 'night',
    name: '星空露台',
    note: '躺著數星星。',
    sky: [0x1d2a52, 0x4a4f86],
    ground: [0x4f7f5c, 0x426e50],
    backdrop: 'hills',
    far: 0x2c4a52,
    fence: 0x6b5a48,
    wall: 0x4a4468,
    trim: 0x2f2a48,
    floor: 0x7a5a48,
    plank: 0x5c4234,
    night: true,
    drift: 'firefly',
  },
  {
    id: 'rooftop',
    name: '城裡頂樓',
    note: '看得到整個城的燈。',
    sky: [0x8fb4dc, 0xf6d9c0],
    ground: [0xb9b4aa, 0xa5a096],
    backdrop: 'city',
    far: 0x6f7f9a,
    fence: 0x5a6270,
    wall: 0xe9e6e0,
    trim: 0x5a6270,
    floor: 0xb8a48a,
    plank: 0x98846a,
  },
  {
    id: 'flower',
    name: '花田小屋',
    note: '一年四季都有花。',
    sky: [0x9ad8f2, 0xf4f6dc],
    ground: [0x9fd470, 0x88c05c],
    backdrop: 'hills',
    far: 0xf2c14b,
    fence: 0xffffff,
    wall: 0xfff3d6,
    trim: 0xe0a030,
    floor: 0xdcb880,
    plank: 0xc09a60,
    drift: 'petal',
  },
  {
    id: 'hotspring',
    name: '火山溫泉',
    note: '遠遠的火山冒著煙，水是熱的。',
    sky: [0xd98a6a, 0xf8d8b8],
    ground: [0x9a8f86, 0x857a72],
    backdrop: 'volcano',
    far: 0x5c4a48,
    fence: 0x6b4a2e,
    wall: 0xd9c0a0,
    trim: 0x7a3b2a,
    floor: 0xa87a52,
    plank: 0x885c38,
  },
  {
    id: 'candy',
    name: '糖果屋',
    note: '什麼都是甜甜的顏色。',
    sky: [0xbfe4fb, 0xfde6f4],
    ground: [0xbdecc8, 0xa6dcb4],
    backdrop: 'clouds',
    far: 0xffd6ea,
    fence: 0xff9ec4,
    wall: 0xffe3ef,
    trim: 0xff9ec4,
    floor: 0xffe9b8,
    plank: 0xf6cf8a,
  },
];

export function findHomeStyle(id: string): HomeStyle {
  return HOME_STYLES.find((s) => s.id === id) ?? HOME_STYLES[0];
}

/** 家具擺在場地的哪裡（0～1，x 由左到右；y 由遠到近） */
export interface HomeSpot {
  x: number;
  y: number;
}

export interface HomeState {
  /** 住在家裡的角色（最多 HOME_MAX 隻）；null 表示還沒選過，先住目前的隊伍 */
  residents: string[] | null;
  /** 擺出來的家具與位置（0～1）；null 表示還沒動過，照陣營擺預設的 */
  placed: Record<string, HomeSpot> | null;
  /** 上次看的是屋內還是庭院 */
  area: HomeArea;
  /** 家的地形與風格（HOME_STYLES 的 id） */
  style: string;
}

export const INITIAL_HOME: HomeState = {
  residents: null,
  placed: null,
  area: 'indoor',
  style: 'meadow',
};

/** 這個陣營一開始擺出來的家具（位置是每件家具預設的） */
export function starterFurniture(faction: Faction): Record<string, HomeSpot> {
  return Object.fromEntries(
    FURNITURE.filter((f) => !f.starter || f.starter === faction).map((f) => [
      f.id,
      { x: f.x, y: f.y },
    ]),
  );
}

type HomeView = Pick<GameState, 'home' | 'owned' | 'team'>;

/** 現在住在家裡的角色：選過就照選的（只留還擁有的），沒選過就是目前的隊伍 */
export function homeResidents(state: HomeView): string[] {
  const base = state.home.residents ?? state.team;
  return base
    .filter((id, i) => state.owned.includes(id) && base.indexOf(id) === i)
    .slice(0, HOME_MAX);
}

/** 現在擺出來的家具與位置（area 有給就只看那個場景），照目錄的順序 */
export function homePlaced(
  state: Pick<GameState, 'home'>,
  faction: Faction,
  area?: HomeArea,
): { item: FurnitureData; spot: HomeSpot }[] {
  const all = state.home.placed ?? starterFurniture(faction);
  return FURNITURE.filter((f) => all[f.id] && (!area || f.area === area)).map((f) => ({
    item: f,
    spot: all[f.id],
  }));
}

export type HomeError = 'full' | 'not-owned';
export type HomeResult = { ok: true; state: GameState } | { ok: false; error: HomeError };

/** 讓一隻角色住進來；已經住著就搬出去 */
export function toggleResident(state: GameState, dogId: string): HomeResult {
  if (!state.owned.includes(dogId)) return { ok: false, error: 'not-owned' };
  const now = homeResidents(state);
  let residents: string[];
  if (now.includes(dogId)) residents = now.filter((id) => id !== dogId);
  else if (now.length >= HOME_MAX) return { ok: false, error: 'full' };
  else residents = [...now, dogId];
  return { ok: true, state: { ...state, home: { ...state.home, residents } } };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** 把一件家具擺出來（放在它預設的位置）；已經擺著就收起來 */
export function toggleFurniture(state: GameState, faction: Faction, id: string): GameState {
  const f = findFurniture(id);
  if (!f) return state;
  const placed = { ...(state.home.placed ?? starterFurniture(faction)) };
  if (placed[id]) delete placed[id];
  else placed[id] = { x: f.x, y: f.y };
  return { ...state, home: { ...state.home, placed } };
}

/** 把擺著的家具搬到別的位置（拖曳）；沒擺出來的不變 */
export function moveFurniture(
  state: GameState,
  faction: Faction,
  id: string,
  spot: HomeSpot,
): GameState {
  const placed = { ...(state.home.placed ?? starterFurniture(faction)) };
  if (!placed[id]) return state;
  placed[id] = { x: clamp01(spot.x), y: clamp01(spot.y) };
  return { ...state, home: { ...state.home, placed } };
}

/** 一個場景的家具全部收起來 */
export function clearFurniture(state: GameState, faction: Faction, area: HomeArea): GameState {
  const placed = { ...(state.home.placed ?? starterFurniture(faction)) };
  for (const f of furnitureOf(area)) delete placed[f.id];
  return { ...state, home: { ...state.home, placed } };
}

export function setHomeStyle(state: GameState, style: string): GameState {
  const id = findHomeStyle(style).id;
  if (state.home.style === id) return state;
  return { ...state, home: { ...state.home, style: id } };
}

export function setHomeArea(state: GameState, area: HomeArea): GameState {
  if (state.home.area === area) return state;
  return { ...state, home: { ...state.home, area } };
}

/** 讀檔時檢查：只留認得的角色與家具、不重複、最多五隻 */
export function sanitizeHome(raw: unknown, isOwned: (dogId: string) => boolean): HomeState {
  if (typeof raw !== 'object' || raw === null) return { ...INITIAL_HOME };
  const v = raw as Record<string, unknown>;
  const list = (x: unknown, ok: (id: string) => boolean): string[] | null =>
    Array.isArray(x)
      ? x.filter((id, i): id is string => typeof id === 'string' && ok(id) && x.indexOf(id) === i)
      : null;
  const spots = (x: unknown): Record<string, HomeSpot> | null => {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
    const out: Record<string, HomeSpot> = {};
    for (const [id, p] of Object.entries(x)) {
      if (!findFurniture(id) || typeof p !== 'object' || p === null) continue;
      const { x: px, y: py } = p as Record<string, unknown>;
      if (typeof px !== 'number' || typeof py !== 'number') continue;
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      out[id] = { x: clamp01(px), y: clamp01(py) };
    }
    return out;
  };
  const residents = list(v.residents, isOwned);
  return {
    residents: residents ? residents.slice(0, HOME_MAX) : null,
    placed: spots(v.placed),
    area: v.area === 'yard' ? 'yard' : 'indoor',
    style: findHomeStyle(typeof v.style === 'string' ? v.style : '').id,
  };
}
