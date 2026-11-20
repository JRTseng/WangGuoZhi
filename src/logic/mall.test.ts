import { describe, expect, it } from 'vitest';
import { DOGS, factionOf, findDog } from '../data/dogs';
import { GEARS, findGear } from '../data/equipment';
import { REGIONS } from '../data/regions';
import { createInitialState } from '../state/gameState';
import {
  MALL,
  MALL_LIMIT,
  MALL_SLOTS,
  buyMall,
  mallAt,
  mallBlock,
  mallGiftReady,
  mallGoods,
  mallItemText,
  mallPriceText,
  sanitizeMall,
} from './mall';
import { deserialize, serialize } from './save';

const TZ = { tzOffsetMin: -480 };
/** 台北 2026-11-21 12:00 */
const NOON = Date.UTC(2026, 10, 21, 4, 0, 0);
const HOUR = 3_600_000;
const rich = () => ({ ...createInitialState(NOON), resources: { food: 99_999, bones: 9_999 } });
const slotOf = (kind: (typeof MALL_SLOTS)[number]) => MALL_SLOTS.indexOf(kind);

describe('商城：今天的商品', () => {
  it('一批六樣，順序固定，同一天怎麼算都一樣', () => {
    const st = createInitialState(NOON);
    const a = mallGoods(st, NOON, TZ);
    expect(a.map((g) => g.kind)).toEqual([...MALL_SLOTS]);
    expect(a).toHaveLength(6);
    expect(mallGoods(st, NOON + 3 * HOUR, TZ)).toEqual(a);
    for (const g of a) {
      expect(g.left).toBe(g.limit);
      expect(g.bought).toBe(0);
      expect(g.text.length).toBeGreaterThan(0);
    }
  });

  it('每日禮物免費，其他都要錢；零食花糧草，其餘花骨頭幣', () => {
    const goods = mallGoods(createInitialState(NOON), NOON, TZ);
    expect(goods[slotOf('gift')]).toMatchObject({ currency: 'free', price: 0, limit: 1 });
    expect(goods[slotOf('gift')].item).toEqual({
      kind: 'food',
      amount: MALL.giftFoodPerChapter,
    });
    expect(goods[slotOf('snack')]).toMatchObject({ currency: 'food', price: 600 });
    expect(goods[slotOf('snack')].item).toEqual({ kind: 'snack', id: 'small', amount: 3 });
    expect(goods[slotOf('snackPack')]).toMatchObject({ currency: 'bones', price: 30 });
    for (const g of goods.slice(1)) expect(g.price).toBeGreaterThan(0);
  });

  it('碎片是自己陣營的角色，價錢照稀有度；裝備是一般裝備', () => {
    for (let d = 0; d < 40; d++) {
      for (const faction of ['dog', 'cat'] as const) {
        const st = { ...createInitialState(NOON), faction };
        const goods = mallGoods(st, NOON + d * 24 * HOUR, TZ);
        const normal = goods[slotOf('shards')];
        const rare = goods[slotOf('rareShards')];
        for (const g of [normal, rare]) {
          if (g.item.kind !== 'shards') throw new Error('應該是碎片');
          const dog = findDog(g.item.id)!;
          expect(factionOf(dog)).toBe(faction);
          expect(g.price).toBe(MALL.shardBones[dog.rarity ?? 'N']);
          expect(g.item.amount).toBe(MALL.shardAmount);
        }
        if (normal.item.kind === 'shards') {
          expect(['N', 'R']).toContain(findDog(normal.item.id)!.rarity ?? 'N');
        }
        if (rare.item.kind === 'shards') {
          const rarity = findDog(rare.item.id)!.rarity;
          expect(['SR', 'SSR']).toContain(rarity);
          expect(rare.limit).toBe(rarity === 'SSR' ? 1 : MALL_LIMIT.rareShards);
        }
        const gear = goods[slotOf('gear')];
        if (gear.item.kind !== 'gear') throw new Error('應該是裝備');
        const data = findGear(gear.item.id)!;
        expect(GEARS).toContain(data);
        expect(gear.price).toBe(MALL.gearBones[data.rarity]);
      }
    }
  });

  it('碎片優先挑已經有的角色', () => {
    const st = createInitialState(NOON);
    for (let d = 0; d < 20; d++) {
      const g = mallGoods(st, NOON + d * 24 * HOUR, TZ)[slotOf('shards')];
      if (g.item.kind !== 'shards') throw new Error('應該是碎片');
      // 一開始的五隻裡有 N／R，所以每天都挑得到自己有的
      expect(st.owned).toContain(g.item.id);
    }
  });

  it('不同天會換東西；稀有碎片偶爾出 SSR', () => {
    const st = createInitialState(NOON);
    const seen = new Set<string>();
    let ssr = 0;
    for (let d = 0; d < 60; d++) {
      const goods = mallGoods({ ...st, owned: [] }, NOON + d * 24 * HOUR, TZ);
      seen.add(goods.map((g) => g.text).join('|'));
      const rare = goods[slotOf('rareShards')].item;
      if (rare.kind === 'shards' && findDog(rare.id)?.rarity === 'SSR') ssr++;
    }
    expect(seen.size).toBeGreaterThan(30);
    expect(ssr).toBeGreaterThan(0);
    expect(ssr).toBeLessThan(30);
  });

  it('主線打得越後面，禮物越多、零食越好', () => {
    const late = {
      ...createInitialState(NOON),
      cleared: REGIONS.slice(0, 8).flatMap((r) => r.stages.map((s) => s.id)),
    };
    const goods = mallGoods(late, NOON, TZ);
    expect(goods[slotOf('gift')].item).toEqual({
      kind: 'food',
      amount: MALL.giftFoodPerChapter * 9,
    });
    expect(goods[slotOf('snack')].item).toMatchObject({ id: 'big' });
    expect(goods[slotOf('snack')]).toMatchObject({ currency: 'food', price: 9000 });
    expect(goods[slotOf('snackPack')].price).toBe(120);
  });
});

describe('商城：購買', () => {
  it('領每日禮物：拿到糧草、不扣錢，領過就沒了', () => {
    const st = createInitialState(NOON);
    expect(mallGiftReady(st, NOON, TZ)).toBe(true);
    const r = buyMall(st, slotOf('gift'), NOON, TZ);
    expect(r.block).toBeNull();
    expect(r.state.resources).toEqual({
      food: st.resources.food + MALL.giftFoodPerChapter,
      bones: st.resources.bones,
    });
    expect(mallGiftReady(r.state, NOON, TZ)).toBe(false);
    expect(mallBlock(r.state, slotOf('gift'), NOON, TZ)).toBe('sold-out');
    const again = buyMall(r.state, slotOf('gift'), NOON, TZ);
    expect(again.block).toBe('sold-out');
    expect(again.state).toBe(r.state);
  });

  it('買零食：扣糧草、零食變多，一天最多三次', () => {
    let st = rich();
    for (let i = 0; i < 3; i++) {
      const r = buyMall(st, slotOf('snack'), NOON, TZ);
      expect(r.block).toBeNull();
      st = r.state;
    }
    expect(st.snacks.small).toBe(9);
    expect(st.resources).toEqual({ food: 99_999 - 1800, bones: 9_999 });
    expect(mallGoods(st, NOON, TZ)[slotOf('snack')]).toMatchObject({ bought: 3, left: 0 });
    expect(buyMall(st, slotOf('snack'), NOON, TZ).block).toBe('sold-out');
  });

  it('買碎片與裝備：扣骨頭幣，東西進存檔', () => {
    const st = rich();
    const goods = mallGoods(st, NOON, TZ);
    const shard = goods[slotOf('shards')];
    const a = buyMall(st, shard.slot, NOON, TZ);
    if (shard.item.kind !== 'shards') throw new Error('應該是碎片');
    expect(a.state.shards[shard.item.id]).toBe(MALL.shardAmount);
    expect(a.state.resources.bones).toBe(9_999 - shard.price);

    const gear = goods[slotOf('gear')];
    const b = buyMall(a.state, gear.slot, NOON, TZ);
    if (gear.item.kind !== 'gear') throw new Error('應該是裝備');
    expect(b.state.gear[gear.item.id]).toBe(1);
    expect(b.state.resources.bones).toBe(9_999 - shard.price - gear.price);
    expect(b.good?.text).toBe(gear.text);
  });

  it('錢不夠不能買，狀態不變', () => {
    const st = { ...createInitialState(NOON), resources: { food: 10, bones: 0 } };
    expect(mallBlock(st, slotOf('snack'), NOON, TZ)).toBe('food');
    expect(mallBlock(st, slotOf('snackPack'), NOON, TZ)).toBe('bones');
    expect(mallBlock(st, 99, NOON, TZ)).toBe('unknown');
    const r = buyMall(st, slotOf('gear'), NOON, TZ);
    expect(r.block).toBe('bones');
    expect(r.state).toBe(st);
  });

  it('隔天 05:00 換新：買過的次數歸零；手機時間調回去不會重置', () => {
    const r = buyMall(rich(), slotOf('gift'), NOON, TZ);
    // 台北隔天 04:59 還是同一天
    const before5 = NOON + 16 * HOUR + 59 * 60_000;
    expect(mallGiftReady(r.state, before5, TZ)).toBe(false);
    const after5 = NOON + 17 * HOUR + 60_000;
    expect(mallGiftReady(r.state, after5, TZ)).toBe(true);
    expect(mallAt(r.state, after5, TZ)).toEqual({ day: '2026-11-22', bought: [] });
    // 調回前一天
    expect(mallGiftReady(r.state, NOON - 24 * HOUR, TZ)).toBe(false);
    const next = buyMall(r.state, slotOf('gift'), after5, TZ);
    expect(next.block).toBeNull();
    expect(next.state.mall).toEqual({ day: '2026-11-22', bought: [1, 0, 0, 0, 0, 0] });
  });
});

describe('商城：文字與存檔', () => {
  it('價錢與商品的文字', () => {
    expect(mallPriceText({ currency: 'free', price: 0 })).toBe('免費');
    expect(mallPriceText({ currency: 'food', price: 9000 })).toBe('糧草 9,000');
    expect(mallPriceText({ currency: 'bones', price: 30 })).toBe('骨頭幣 30');
    expect(mallItemText({ kind: 'food', amount: 1800 })).toBe('糧草 1,800');
    expect(mallItemText({ kind: 'snack', id: 'small', amount: 3 })).toBe('小肉乾 ×3');
    const dog = DOGS[0];
    expect(mallItemText({ kind: 'shards', id: dog.id, amount: 5 })).toBe(`${dog.name}碎片 ×5`);
    expect(mallItemText({ kind: 'gear', id: GEARS[0].id })).toBe(GEARS[0].name);
  });

  it('讀檔整理：亂七八糟的值回到沒買過，次數不超過上限', () => {
    expect(sanitizeMall(undefined)).toEqual({ day: '', bought: [] });
    expect(sanitizeMall({ day: 'abc', bought: [1] })).toEqual({ day: '', bought: [] });
    expect(sanitizeMall({ day: '2026-11-21', bought: [9, -1, 'x', 1.5, 2] })).toEqual({
      day: '2026-11-21',
      bought: [1, 0, 0, 0, 2, 0],
    });
  });

  it('存檔再讀回來，今天買過的還在；舊存檔沒有這個欄位也讀得進來', () => {
    const r = buyMall(rich(), slotOf('gift'), NOON, TZ);
    const back = deserialize(serialize(r.state, NOON), NOON);
    expect(back.status).toBe('ok');
    expect(back.state.mall).toEqual(r.state.mall);

    const file = JSON.parse(serialize(createInitialState(NOON), NOON));
    delete file.state.mall;
    const old = deserialize(JSON.stringify(file), NOON);
    expect(old.status).toBe('ok');
    expect(old.state.mall).toEqual({ day: '', bought: [] });
  });
});
