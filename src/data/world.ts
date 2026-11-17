import type { Faction } from './dogs';
import {
  ENEMY_KINDS,
  REGIONS,
  STAGE_LINEUPS,
  parseLineup,
  type BossData,
  type EnemyKind,
  type GangData,
  type RegionData,
  type StageData,
} from './regions';
import { STORIES, STORIES_BY_FACTION } from './stories';
import { rebuildTower } from './tower';

/**
 * 兩個陣營看到的世界不一樣（T031，Jimmy 2026-11-17：「劇情可以做設計不一樣的…敵人也可以改一下」）。
 * 地圖、關卡、陣容與強度兩邊完全一樣（平衡只要調一套），不一樣的是「誰在那裡」：
 * 汪國玩家一路遇到的是各地的匪幫與大狗頭目；喵國玩家遇到的是野貓幫與大貓頭目，
 * 章節介紹、關卡頭目、敵人的名字與長相、登天塔的守層、劇情都換一套。
 *
 * 做法：REGIONS、STORIES 與登天塔都是遊戲一開始建好的資料；applyWorld 把裡面「看得到的部分」
 * 換成那個陣營的版本（數值一個都不動）。存檔的陣營一變，src/state/store.ts 就會呼叫一次。
 */

/** 喵國遇到的敵人：兵種的規則和原本一樣，只換名字與品種 */
const CAT_KINDS: Readonly<Record<string, EnemyKind>> = {
  m: { ...ENEMY_KINDS.m, label: '小嘍囉', breed: '虎斑貓' },
  a: { ...ENEMY_KINDS.a, label: '快爪', breed: '阿比西尼亞貓' },
  g: { ...ENEMY_KINDS.g, label: '肉墊兵', breed: '英國短毛貓' },
  s: { ...ENEMY_KINDS.s, label: '毛線手', breed: '暹羅貓' },
  l: { ...ENEMY_KINDS.l, label: '搗蛋貓', breed: '曼赤肯貓' },
  h: { ...ENEMY_KINDS.h, label: '薄荷師', breed: '金吉拉貓' },
  e: { ...ENEMY_KINDS.e, label: '利爪', breed: '緬因貓' },
};

interface ChapterSkin {
  description: string;
  gang: GangData;
  boss: BossData;
}

/** 喵國版的十章：章節介紹、野貓幫、大貓頭目（鍵是 REGIONS 的 id） */
const CAT_CHAPTERS: Readonly<Record<string, ChapterSkin>> = {
  luoyepo: {
    description: '從喵國的屋頂往西看，就是滿地紅葉的緩坡。\n九命鈴的第一顆，聽說掛在坡頂。',
    gang: { name: '落葉幫', color: 0xa8784e },
    boss: { name: '葉影', breed: '石虎', color: 0xc49a5c, accent: 0x4a3420 },
  },
  zhulindu: {
    description: '霧氣繚繞的竹林與渡口。\n渡口幫把第二顆鈴拿來當魚鈴，一響就有魚吃。',
    gang: { name: '渡口幫', color: 0x6a8a84 },
    boss: { name: '江爪', breed: '漁貓', color: 0x8a8a70, accent: 0x3a3a2c },
  },
  xuelingguan: {
    description: '終年積雪的北方關口。\n守關的那一位，據說毛厚到連自己都找不到東西。',
    gang: { name: '雪團', color: 0xc4ccd8 },
    boss: { name: '厚毛王', breed: '兔猻', color: 0xa89c8c, accent: 0x5a5048 },
  },
  taohuagu: {
    description: '一整片開滿桃花的山谷。\n花貓黨最愛漂亮的東西，第四顆鈴被掛在最高的樹上。',
    gang: { name: '花貓黨', color: 0xd89aae },
    boss: { name: '長腿桃', breed: '藪貓', color: 0xe0b060, accent: 0x3a2a1c },
  },
  huangshadao: {
    description: '往西的商路穿過大片沙丘。\n沙爪幫躲在沙子底下，耳朵比誰都靈。',
    gang: { name: '沙爪', color: 0xc8a068 },
    boss: { name: '沙耳', breed: '沙丘貓', color: 0xe6cc9a, accent: 0xfff2d8 },
  },
  wuzhaoze: {
    description: '終年不散的濃霧與泥沼。\n霧貓說，沒有哪隻貓能自己走出這片沼澤。',
    gang: { name: '霧貓', color: 0x6f8a78 },
    boss: { name: '霧鬚', breed: '山貓', color: 0xa8947c, accent: 0x3e3428 },
  },
  chiyanling: {
    description: '火山腳下的鐵匠村，到處都是暖烘烘的爐子。\n爐邊幫佔走了每一個最暖的位置。',
    gang: { name: '爐邊幫', color: 0xb85a3c },
    boss: { name: '赤耳', breed: '獰貓', color: 0xc8784a, accent: 0xf2dcc0 },
  },
  bihaiwan: {
    description: '南方的海灣是整個汪州最大的魚市。\n魚市幫用第八顆鈴秤魚，少一兩都不行。',
    gang: { name: '魚市幫', color: 0x4a8aa8 },
    boss: { name: '浪紋', breed: '雲豹', color: 0xc8b088, accent: 0x3a3028 },
  },
  yundingzhan: {
    description: '通往汪都的山路懸在雲海上。\n雲行者守著每一座吊橋，只放有耐心的貓過去。',
    gang: { name: '雲行者', color: 0xa8b4d0 },
    boss: { name: '凌雲', breed: '雪豹', color: 0xe4e4dc, accent: 0x4a4a50 },
  },
  wangdu: {
    description: '汪都的地底下，就是傳說中的萬罐庫。\n最後一顆鈴，在九命衛的大王手上。',
    gang: { name: '九命衛', color: 0x8a7ab8 },
    boss: { name: '九命王', breed: '白虎', color: 0xf4f2ee, accent: 0x3a3a44 },
  },
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** 汪國原本的樣子：第一次換之前先記下來，換回汪國時還原 */
let original: Map<string, { region: RegionData; stages: StageData[] }> | null = null;
let applied: Faction = 'dog';

/** 現在套用的是哪個陣營的世界 */
export function worldFaction(): Faction {
  return applied;
}

/** 把關卡敵人、頭目、章節介紹、劇情、登天塔換成這個陣營的版本 */
export function applyWorld(faction: Faction): void {
  if (faction === applied) return;
  if (!original) {
    original = new Map(
      REGIONS.map((r) => [r.id, { region: { ...r }, stages: r.stages.map((s) => ({ ...s })) }]),
    );
  }
  for (const r of REGIONS as Mutable<RegionData>[]) {
    const base = original.get(r.id)!;
    const skin = faction === 'cat' ? CAT_CHAPTERS[r.id] : undefined;
    r.description = skin?.description ?? base.region.description;
    r.gang = skin?.gang ?? base.region.gang;
    (r.stages as Mutable<StageData>[]).forEach((s, i) => {
      const b = base.stages[i];
      if (!skin) {
        s.name = b.name;
        s.enemies = b.enemies;
        if (b.boss) s.boss = b.boss;
        return;
      }
      const boss = b.boss ? skin.boss : undefined;
      s.enemies = parseLineup(STAGE_LINEUPS[s.id], skin.gang, boss, CAT_KINDS);
      if (boss) {
        s.boss = boss;
        s.name = `${boss.breed}・${boss.name}`;
      }
    });
  }
  STORIES.splice(0, STORIES.length, ...STORIES_BY_FACTION[faction]);
  applied = faction;
  rebuildTower(faction === 'cat' ? '貓' : '犬', faction === 'cat' ? CAT_KINDS : ENEMY_KINDS);
}
