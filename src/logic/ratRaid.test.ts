import { afterEach, describe, expect, it } from 'vitest';
import { RAT_TIERS, ratStage, ratStageId, ratTierOf } from '../data/rats';
import { createInitialState, type GameState } from '../state/gameState';
import { completeExpedition, beginExpedition, runExpedition } from './expedition';
import { nextStagePlan } from './nextStage';
import {
  RAT_RAID,
  RAT_UNLOCK_STAGE,
  applyRatLoot,
  ratCanFight,
  ratHoursOpen,
  ratHoursText,
  ratTier,
  ratVisible,
  ratWavesLeft,
  rollRatLoot,
  sanitizeRats,
} from './ratRaid';
import { sanitizeState } from './save';

const TZ = { tzOffsetMin: -480 };
/** 台北 2026-11-17 12:30 */
const NOON = Date.UTC(2026, 10, 17, 4, 30);
const DAY = 86_400_000;
const allDay = RAT_RAID.hours;

afterEach(() => {
  RAT_RAID.hours = allDay;
});

function strong(cleared: string[] = [RAT_UNLOCK_STAGE]): GameState {
  const s = createInitialState(NOON);
  const dogs = { ...s.dogs };
  for (const id of s.owned) {
    dogs[id] = { ...dogs[id], level: 100, growthAttack: 3000, growthDefense: 3000 };
  }
  return { ...s, dogs, cleared };
}

describe('老鼠幫的關卡', () => {
  it('一共 10 級，每一級都有鼠老大和小弟，越後面越強', () => {
    let last = 0;
    for (let t = 1; t <= RAT_TIERS; t++) {
      const st = ratStage(t)!;
      expect(ratTierOf(st.id)).toBe(t);
      expect(st.enemies.some((e) => e.role === '頭目')).toBe(true);
      expect(st.enemies.length).toBeGreaterThanOrEqual(4);
      expect(st.enemies.every((e) => e.look?.breed?.includes('鼠'))).toBe(true);
      expect(st.recommendedPower).toBeGreaterThanOrEqual(last);
      last = st.recommendedPower;
    }
    expect(ratTierOf('rat-0')).toBe(0);
    expect(ratTierOf('rat-11')).toBe(0);
    expect(ratTierOf('tower-3')).toBe(0);
  });
});

describe('出現的時段', () => {
  it('現在是全天；改成中午就只有中午出現', () => {
    expect(ratHoursText()).toBe('全天');
    expect(ratHoursOpen(NOON, TZ)).toBe(true);
    expect(ratHoursOpen(NOON + 8 * 3_600_000, TZ)).toBe(true);
    RAT_RAID.hours = [{ from: 12, to: 14 }];
    expect(ratHoursText()).toBe('12:00～14:00');
    expect(ratHoursOpen(NOON, TZ)).toBe(true);
    expect(ratHoursOpen(NOON - 3_600_000, TZ)).toBe(false);
    expect(ratHoursOpen(NOON + 2 * 3_600_000, TZ)).toBe(false);
    expect(ratVisible(strong(), NOON + 2 * 3_600_000, TZ)).toBe(false);
  });

  it('第一章頭目打倒之前不會出現', () => {
    expect(ratVisible(strong([]), NOON, TZ)).toBe(false);
    expect(ratVisible(strong(), NOON, TZ)).toBe(true);
  });
});

describe('強度與波數', () => {
  it('主線打到第幾章就是第幾級', () => {
    expect(ratTier(strong([]))).toBe(1);
    expect(ratTier(strong(['luoyepo-5', 'zhulindu-1']))).toBe(2);
  });

  // 結算用的是裝置的時區，所以這幾個測試不另外指定時區
  it('打贏記一波、拿寶物；一天三波，隔天重來；不算通關、不花體力', () => {
    let s = strong();
    const id = ratStageId(1);
    const team = s.owned.slice(0, 5);
    for (let i = 0; i < RAT_RAID.dailyWins; i++) {
      expect(ratCanFight(s, id, NOON)).toBe(true);
      const before = s;
      const r = runExpedition(s, id, team, NOON, { seed: 100 + i, enforce: true });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.record.win).toBe(true);
      expect(r.record.loot![0].kind).toBe('gear');
      expect(r.state.stamina.value).toBe(before.stamina.value);
      expect(r.state.cleared).not.toContain(id);
      // 寶物真的進了存檔
      const expected = applyRatLoot(
        {
          ...before,
          resources: {
            food: before.resources.food + r.record.reward.food + (r.record.lord?.food ?? 0),
            bones: before.resources.bones + r.record.reward.bones + (r.record.lord?.bones ?? 0),
          },
        },
        r.record.loot!,
      );
      expect(r.state.resources).toEqual(expected.resources);
      expect(r.state.gear).toEqual(expected.gear);
      expect(r.state.shards).toEqual(expected.shards);
      expect(r.state.snacks).toEqual(expected.snacks);
      s = r.state;
    }
    expect(s.rats).toMatchObject({ wins: 3, total: 3 });
    expect(ratWavesLeft(s, NOON)).toBe(0);
    expect(ratCanFight(s, id, NOON)).toBe(false);
    expect(runExpedition(s, id, team, NOON)).toEqual({ ok: false, error: 'stage-locked' });
    expect(nextStagePlan(s, id, team, NOON)).toBeNull();
    expect(ratWavesLeft(s, NOON + DAY)).toBe(3);
    expect(ratCanFight(s, id, NOON + DAY)).toBe(true);
  });

  it('還有下一波時，結算的「下一關」是再打一波', () => {
    const s = strong();
    const id = ratStageId(1);
    const b = beginExpedition(s, id, s.owned.slice(0, 5), NOON, { seed: 7 });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const done = completeExpedition(b.state)!;
    expect(nextStagePlan(done.state, id, s.owned.slice(0, 5), NOON)?.stage.id).toBe(id);
  });

  it('打輸沒有獎勵也不算一波', () => {
    const s = { ...createInitialState(NOON), cleared: ['luoyepo-5', 'wangdu-5'] };
    const tier = ratTier(s);
    const r = runExpedition(s, ratStageId(tier), s.owned.slice(0, 1), NOON, { seed: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.win).toBe(false);
    expect(r.record.reward).toEqual({ food: 0, bones: 0 });
    expect(r.record.loot).toBeUndefined();
    expect(r.state.rats.wins).toBe(0);
  });
});

describe('寶物', () => {
  it('同一個種子抽到的一樣；第一樣是裝備；同樣的東西合併', () => {
    const owned = ['a', 'b', 'c'];
    for (let seed = 1; seed <= 200; seed++) {
      const loot = rollRatLoot(seed, 1 + (seed % 10), owned);
      expect(loot).toEqual(rollRatLoot(seed, 1 + (seed % 10), owned));
      expect(loot[0].kind).toBe('gear');
      expect(loot.length).toBeLessThanOrEqual(RAT_RAID.lootRolls);
      const keys = loot
        .filter((x) => x.kind !== 'gear')
        .map((x) => ('id' in x ? `${x.kind}:${x.id}` : x.kind));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('存檔', () => {
  it('壞掉的欄位回到預設；舊存檔沒有這一欄也讀得進來', () => {
    expect(sanitizeRats(undefined)).toEqual({ day: '', wins: 0, total: 0 });
    expect(sanitizeRats({ day: 'x', wins: -1, total: 2.5 })).toEqual({
      day: '',
      wins: 0,
      total: 0,
    });
    expect(sanitizeRats({ day: '2026-11-17', wins: 2, total: 9 })).toEqual({
      day: '2026-11-17',
      wins: 2,
      total: 9,
    });
    const s = createInitialState(NOON) as unknown as Record<string, unknown>;
    delete s.rats;
    expect(sanitizeState(s, NOON)?.rats).toEqual({ day: '', wins: 0, total: 0 });
  });
});
