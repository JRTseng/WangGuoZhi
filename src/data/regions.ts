import type { BattleEnemy, BattleRole, BattleTrait, RowIndex } from '../logic/battle';
import { LINEUP_SCALE } from './lineupScale';
import type { Resources } from './resources';

/**
 * 出征地圖：10 個章節，每章 5 個小節，第 5 節是 Boss。
 * 每一關有自己的敵人陣容，能上陣幾隻跟著敵人數量（T018）。數值為暫定。T019 起關卡沒有等待時間，每關都花一樣的體力。
 */

/** 章末 Boss 的外觀（佔位圖用顏色畫） */
export interface BossData {
  name: string;
  breed: string;
  color: number;
  accent: number;
}

/**
 * 敵人的兵種（T018）：一個字母一種，寫陣容用。敵人照和我方一樣的定位規則打：
 * 小卒只會打最前排；先鋒穿透兩排；盾兵比較耐打；投石手越過前排打中後排；
 * 搗蛋鬼亂打、會爆擊會閃；藥師幫受傷的同伴回血；精銳是比較壯的先鋒，會放大絕招。
 * weight 是這一隻佔敵方總戰力的比重。數值都是暫定。
 */
interface EnemyKind {
  label: string;
  role: BattleRole;
  weight: number;
  /** 點綴色（主色跟著章節的敵軍） */
  accent: number;
  canUlt?: boolean;
  trait?: BattleTrait;
}

export const ENEMY_KINDS: Readonly<Record<string, EnemyKind>> = {
  m: { label: '小卒', role: '野犬', weight: 1, accent: 0xd9d2c7 },
  a: { label: '先鋒', role: '突擊', weight: 1, accent: 0xe07a5f },
  g: { label: '盾兵', role: '守護', weight: 1.1, accent: 0x8d99ae },
  s: { label: '投石手', role: '謀略', weight: 0.9, accent: 0x9bc1bc },
  l: { label: '搗蛋鬼', role: '幸運', weight: 0.9, accent: 0xf2cc8f },
  h: { label: '藥師', role: '補血', weight: 0.8, accent: 0xa7c957, trait: 'smallHeal' },
  e: { label: '精銳', role: '突擊', weight: 1.6, accent: 0xc0392b, canUlt: true },
};
/** 頭目佔敵方總戰力的比重（旁邊的小兵一隻約 1） */
export const BOSS_WEIGHT = 4;
/** 算上陣數量時，頭目一隻算幾隻 */
export const BOSS_HEADCOUNT = 2;
/** 上陣數量的上限（和隊伍上限一樣） */
export const STAGE_TEAM_CAP = 5;

/** 這一章的敵軍：名字開頭與主色 */
export interface GangData {
  name: string;
  color: number;
}

export interface StageData {
  id: string;
  name: string;
  /** 難度（1 起算，顯示用星數；也決定經驗） */
  difficulty: number;
  /** 建議隊伍戰力（以這一關能上陣的隻數來算） */
  recommendedPower: number;
  /** 打贏的獎勵（打輸只拿一部分） */
  reward: Resources;
  /** 這一關的敵人陣容（T018） */
  enemies: readonly BattleEnemy[];
  /** 敵方強度倍率（調勝率用，照陣容查 src/data/lineupScale.ts） */
  scale: number;
  /** 這一關最多能上陣幾隻（T018）：跟著敵人數量，頭目算兩隻，最多 5 隻 */
  teamMax: number;
  /** 有值代表這一關是 Boss 關 */
  boss?: BossData;
  /** 第一次打贏這一關送的狗狗 id（已經擁有就不再送） */
  firstClearDog?: string;
}

/** 章節的場景：十章各一張，畫法在 src/scenes/components/sceneryArt.ts（T016） */
export type RegionScene =
  | 'slope'
  | 'bamboo'
  | 'snow'
  | 'peach'
  | 'desert'
  | 'marsh'
  | 'volcano'
  | 'coast'
  | 'cloud'
  | 'palace'
  | 'lantern';
/** 主頁背景（存檔裡記的是這個）：T016 起每一章的場景都能當主頁背景，再加上活動的燈會與全破送的主城 */
export type ThemeId = RegionScene | 'city';

export interface RegionData {
  id: string;
  /** 第幾章（1 起算） */
  chapter: number;
  name: string;
  /** 一兩句章節介紹 */
  description: string;
  theme: RegionScene;
  /** 這一章的敵軍 */
  gang: GangData;
  stages: readonly StageData[];
}

const SUFFIX = '甲乙丙丁戊己庚辛壬';

/**
 * 把陣容字串變成敵人清單。寫法：「前排/中排/後排」，一個字母一隻（見 ENEMY_KINDS），B 是頭目。
 * 例如 'gg/B/s' = 前排兩隻盾兵、中排頭目、後排一隻投石手。同名的後面加甲乙丙。
 */
export function parseLineup(lineup: string, gang: GangData, boss?: BossData): BattleEnemy[] {
  const out: BattleEnemy[] = [];
  lineup.split('/').forEach((letters, row) => {
    for (const ch of letters) {
      if (ch === 'B' && boss) {
        out.push({
          name: boss.name,
          role: '頭目',
          row: row as RowIndex,
          weight: BOSS_WEIGHT,
          canUlt: true,
          look: { color: boss.color, accent: boss.accent, big: true },
        });
        continue;
      }
      const k = ENEMY_KINDS[ch];
      if (!k) throw new Error(`沒有這種敵人：${ch}`);
      out.push({
        name: `${gang.name}${k.label}`,
        role: k.role,
        row: row as RowIndex,
        weight: k.weight,
        ...(k.canUlt ? { canUlt: true } : {}),
        ...(k.trait ? { trait: k.trait } : {}),
        look: { color: gang.color, accent: k.accent },
      });
    }
  });
  // 同名的加上甲乙丙
  const count: Record<string, number> = {};
  for (const e of out) count[e.name] = (count[e.name] ?? 0) + 1;
  const seen: Record<string, number> = {};
  return out.map((e) => {
    if (count[e.name] <= 1) return e;
    const n = seen[e.name] ?? 0;
    seen[e.name] = n + 1;
    return { ...e, name: `${e.name}${SUFFIX[n] ?? ''}` };
  });
}

/** 這個陣容可以上陣幾隻：一隻敵人一隻，頭目算兩隻，最多 5 隻 */
export function teamMaxOf(enemies: readonly BattleEnemy[]): number {
  const heads = enemies.reduce((n, e) => n + (e.role === '頭目' ? BOSS_HEADCOUNT : 1), 0);
  return Math.min(STAGE_TEAM_CAP, Math.max(1, heads));
}

const stage = (
  gang: GangData,
  id: string,
  name: string,
  lineup: string,
  difficulty: number,
  recommendedPower: number,
  food: number,
  bones: number,
  boss?: BossData,
  firstClearDog?: string,
): StageData => {
  const enemies = parseLineup(lineup, gang, boss);
  STAGE_LINEUPS[id] = lineup;
  return {
    id,
    name,
    difficulty,
    recommendedPower,
    reward: { food, bones },
    enemies,
    scale: LINEUP_SCALE[lineup] ?? 1,
    teamMax: teamMaxOf(enemies),
    ...(boss ? { boss } : {}),
    ...(firstClearDog ? { firstClearDog } : {}),
  };
};

const round10 = (n: number): number => Math.round(n / 10) * 10;

/**
 * 第四章起的關卡數值照公式排（暫定）：每章 5 關，難度、每隻狗該有的戰力、獎勵都一路往上。
 * 建議戰力 = 每隻狗該有的戰力 × 這一關能上陣的隻數（上陣少的關卡通常派最強的幾隻，所以再多算一點）。
 */
const LATE_STEP = { difficulty: [0, 0, 1, 1, 2], perDog: [0, 10, 20, 30, 45] };
const LATE_FOOD = [600, 900, 1300, 1500, 2900];
const LATE_BONES = [24, 36, 54, 62, 140];

interface LateChapter {
  id: string;
  chapter: number;
  name: string;
  description: string;
  theme: RegionScene;
  gang: GangData;
  /** 五關的名字（最後一關用「犬種・名字」）與陣容 */
  stages: readonly (readonly [name: string, lineup: string])[];
  boss: BossData;
}

function lateRegion(c: LateChapter): RegionData {
  const k = c.chapter - 4;
  return {
    id: c.id,
    chapter: c.chapter,
    name: c.name,
    description: c.description,
    theme: c.theme,
    gang: c.gang,
    stages: c.stages.map(([name, lineup], i) => {
      const boss = i === c.stages.length - 1 ? c.boss : undefined;
      const max = teamMaxOf(parseLineup(lineup, c.gang, boss));
      const perDog = 215 + k * 50 + LATE_STEP.perDog[i];
      const rate = 1 + 0.3 * k;
      return stage(
        c.gang,
        `${c.id}-${i + 1}`,
        name,
        lineup,
        7 + k * 2 + LATE_STEP.difficulty[i],
        round10(perDog * max * (max < STAGE_TEAM_CAP ? 1.08 : 1)),
        round10(LATE_FOOD[i] * rate),
        Math.round(LATE_BONES[i] * rate),
        boss,
      );
    }),
  };
}

const G1: GangData = { name: '坡匪', color: 0x8a8f98 };
const G2: GangData = { name: '江賊', color: 0x5f7f8a };
const G3: GangData = { name: '雪匪', color: 0xb8c4d6 };

/** 每一關的陣容字串（調強度倍率的工具用） */
export const STAGE_LINEUPS: Record<string, string> = {};

export const REGIONS: readonly RegionData[] = [
  {
    id: 'luoyepo',
    chapter: 1,
    name: '落葉坡',
    description: '汪州西邊的緩坡，秋天滿地紅葉。\n新上任的城主，從這裡開始練兵吧。',
    theme: 'slope',
    gang: G1,
    stages: [
      // 第一關五隻小卒：五隻新手狗都能上場；第二關起上陣數量才有限制
      stage(G1, 'luoyepo-1', '坡腳小徑', 'mmm/mm', 1, 150, 120, 5),
      stage(G1, 'luoyepo-2', '紅葉林', 'mmm', 2, 250, 260, 12),
      stage(G1, 'luoyepo-3', '坡頂哨站', 'mam/s', 3, 350, 560, 25),
      stage(G1, 'luoyepo-4', '山風隘口', 'gmg/s', 3, 400, 640, 30),
      stage(
        G1,
        'luoyepo-5',
        '高山犬・雷吼',
        'mm/B',
        4,
        480,
        1000,
        60,
        { name: '雷吼', breed: '高山犬', color: 0x2a2421, accent: 0xc9773a },
        // 第 1 章通關獎勵：補血狗（T017）
        'nuantong',
      ),
    ],
  },
  {
    id: 'zhulindu',
    chapter: 2,
    name: '竹林渡',
    description: '霧氣繚繞的竹林與渡口，\n江上的船隊據說藏著不少糧草。',
    theme: 'bamboo',
    gang: G2,
    stages: [
      stage(G2, 'zhulindu-1', '竹影小路', 'mam/m', 3, 450, 300, 12),
      stage(G2, 'zhulindu-2', '霧中渡口', 'gg/ss', 4, 520, 520, 20),
      stage(G2, 'zhulindu-3', '江心沙洲', 'mam/s/h', 4, 580, 800, 32),
      stage(G2, 'zhulindu-4', '竹林水寨', 'gag/sl', 5, 640, 900, 38),
      stage(G2, 'zhulindu-5', '大丹犬・巨影', 'gmg/B', 5, 720, 1500, 80, {
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
    gang: G3,
    stages: [
      stage(G3, 'xuelingguan-1', '雪原入口', 'gag/s/l', 5, 700, 500, 20),
      stage(G3, 'xuelingguan-2', '冰河谷', 'aaa/ss', 5, 780, 760, 30),
      // 只有兩隻精銳：只能派兩隻上陣
      stage(G3, 'xuelingguan-3', '風雪棧道', 'ee', 6, 400, 1100, 45),
      stage(G3, 'xuelingguan-4', '關前烽台', 'gag/s/h', 6, 940, 1250, 52),
      stage(G3, 'xuelingguan-5', '藏獒・鎮嶺王', 'gg/B/s', 7, 1050, 2400, 120, {
        name: '鎮嶺王',
        breed: '藏獒',
        color: 0x7a3b1d,
        accent: 0x2a1a12,
      }),
    ],
  },
  lateRegion({
    id: 'taohuagu',
    chapter: 4,
    name: '桃花谷',
    description: '過了北門，是一整片開滿桃花的山谷。\n花賊在林子裡設了不少埋伏。',
    theme: 'peach',
    gang: { name: '花賊', color: 0xc98aa0 },
    stages: [
      ['谷口花徑', 'mmm/ll'],
      ['落英溪', 'e/ss'],
      ['桃林深處', 'gag/sh'],
      ['花雨亭', 'aaa/ll'],
      ['伯恩山犬・花嶽', 'ag/B/s'],
    ],
    boss: { name: '花嶽', breed: '伯恩山犬', color: 0x2b2420, accent: 0xb5651d },
  }),
  lateRegion({
    id: 'huangshadao',
    chapter: 5,
    name: '黃沙道',
    description: '往西的商路穿過大片沙丘，\n沙盜專挑運糧的隊伍下手。',
    theme: 'desert',
    gang: { name: '沙盜', color: 0xb98b4e },
    stages: [
      ['沙丘驛站', 'gg/sss'],
      ['枯井', 'eee'],
      ['風蝕岩', 'mmm/mmm'],
      ['綠洲市集', 'gag/l/sh'],
      ['坎高犬・沙牙', 'gg/B/ll'],
    ],
    boss: { name: '沙牙', breed: '坎高犬', color: 0xd2b48c, accent: 0x3b2f2f },
  }),
  lateRegion({
    id: 'wuzhaoze',
    chapter: 6,
    name: '霧沼澤',
    description: '終年不散的濃霧與泥沼，\n走錯一步就會被沼賊包圍。',
    theme: 'marsh',
    gang: { name: '沼賊', color: 0x5d7a55 },
    stages: [
      ['蘆葦渡', 'lll/ll'],
      ['泥沼棧橋', 'gg/hs'],
      ['螢火窪', 'ee/s'],
      ['枯木林', 'gag/sss'],
      ['尋血獵犬・玄霧', 'aa/B/ss'],
    ],
    boss: { name: '玄霧', breed: '尋血獵犬', color: 0x6b4a2f, accent: 0x2a1a12 },
  }),
  lateRegion({
    id: 'chiyanling',
    chapter: 7,
    name: '赤焰嶺',
    description: '火山腳下的鐵匠村被炎兵佔了，\n整座山都是打鐵的聲音。',
    theme: 'volcano',
    gang: { name: '炎兵', color: 0x9c4a3a },
    stages: [
      ['熔岩小道', 'aaa/aa'],
      ['鐵匠村', 'ggg/sh'],
      ['硫磺谷', 'e/e/s'],
      ['火口棧道', 'gag/ll/s'],
      ['羅威那・炎錘', 'gg/B/sl'],
    ],
    boss: { name: '炎錘', breed: '羅威那', color: 0x1f1a17, accent: 0xb5541d },
  }),
  lateRegion({
    id: 'bihaiwan',
    chapter: 8,
    name: '碧海灣',
    description: '南方的海灣停滿了海寇的船，\n潮水退去時才有路可以靠近。',
    theme: 'coast',
    gang: { name: '海寇', color: 0x3f7f9c },
    stages: [
      ['退潮沙灘', 'mmm/sss'],
      ['珊瑚礁', 'ee/h'],
      ['海寇碼頭', 'gag/sl/h'],
      ['燈塔', 'eee/s'],
      ['萊昂貝格犬・潮王', 'ga/B/sl'],
    ],
    boss: { name: '潮王', breed: '萊昂貝格犬', color: 0xb8793a, accent: 0x2a1a12 },
  }),
  lateRegion({
    id: 'yundingzhan',
    chapter: 9,
    name: '雲頂棧',
    description: '通往汪都的山路懸在雲海上，\n雲衛把守著每一座吊橋。',
    theme: 'cloud',
    gang: { name: '雲衛', color: 0x8f9bc4 },
    stages: [
      ['雲海吊橋', 'ggg/ss'],
      ['觀星台', 'll/ss/h'],
      ['一線天', 'e/e'],
      ['天門關', 'gag/ss/h'],
      ['愛爾蘭獵狼犬・凌霄', 'gg/B/ss'],
    ],
    boss: { name: '凌霄', breed: '愛爾蘭獵狼犬', color: 0x8a8f98, accent: 0xe6edf7 },
  }),
  lateRegion({
    id: 'wangdu',
    chapter: 10,
    name: '汪都',
    description: '汪州的都城就在眼前。\n打開城門，把這場亂局收個尾吧。',
    theme: 'palace',
    gang: { name: '禁軍', color: 0x8a6d1f },
    stages: [
      ['外城門', 'gag/sss'],
      ['朱雀大街', 'aea/ll'],
      ['御花園', 'gg/hsh'],
      ['金鑾殿前', 'ee/e/s'],
      ['英國獒犬・天狼王', 'gag/B/s'],
    ],
    boss: { name: '天狼王', breed: '英國獒犬', color: 0xc9a227, accent: 0x3b2a1a },
  }),
];

/** 第幾章的國字（1～10） */
export function chapterName(chapter: number): string {
  return `第${'一二三四五六七八九十'[chapter - 1] ?? chapter}章`;
}

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
