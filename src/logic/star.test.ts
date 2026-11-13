import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { board, settleBoarding } from './boarding';
import { dogStatsById, STAR_MAX } from './leveling';
import { checkStarUp, shardsOf, starText, starUp, starUpCost } from './star';

const NOW = 1_800_000_000_000;
const fresh = () => createInitialState(NOW);
const withShards = (n: number, dogId = 'daer') => ({ ...fresh(), shards: { [dogId]: n } });

describe('升星花費', () => {
  it('10 × 目前星數；滿星為 0', () => {
    expect([1, 2, 3, 4].map(starUpCost)).toEqual([10, 20, 30, 40]);
    expect(starUpCost(STAR_MAX)).toBe(0);
    expect(starUpCost(9)).toBe(0);
  });
});

describe('checkStarUp', () => {
  it('碎片夠才能升；不夠會說還差多少', () => {
    expect(checkStarUp(fresh(), 'daer')).toMatchObject({
      ok: false,
      reason: 'shards',
      star: 1,
      shards: 0,
      cost: 10,
      short: 10,
      levelCap: 60,
      nextLevelCap: 70,
    });
    expect(checkStarUp(withShards(10), 'daer')).toMatchObject({ ok: true, short: 0 });
    // 別隻狗的碎片不能拿來用
    expect(checkStarUp(withShards(99, 'abai'), 'daer').ok).toBe(false);
  });

  it('沒擁有、不認得、滿星都不能升', () => {
    expect(checkStarUp({ ...fresh(), shards: { tieya: 50 } }, 'tieya').reason).toBe('not-owned');
    expect(checkStarUp(fresh(), 'nobody').reason).toBe('unknown-dog');
    const s = withShards(50);
    const maxed = { ...s, dogs: { ...s.dogs, daer: { ...s.dogs.daer, star: STAR_MAX } } };
    expect(checkStarUp(maxed, 'daer')).toMatchObject({
      ok: false,
      reason: 'maxed',
      cost: 0,
      short: 0,
      levelCap: 100,
      nextLevelCap: 100,
    });
  });
});

describe('starUp', () => {
  it('扣碎片、星數 +1，攻防與等級上限提高，等級與特訓不變', () => {
    const s0 = withShards(35);
    const before = dogStatsById(s0, 'daer')!;
    const r = starUp(s0, 'daer');
    expect(r.check.ok).toBe(true);
    expect(shardsOf(r.state, 'daer')).toBe(25);
    const after = dogStatsById(r.state, 'daer')!;
    expect(after).toMatchObject({ star: 2, levelCap: 70, level: before.level, exp: before.exp });
    // 大耳基礎攻 42、防 48：各多 10%
    expect(after.attack).toBe(before.attack + 4);
    expect(after.defense).toBe(before.defense + 5);
    // 原本的狀態不變
    expect(s0.dogs.daer.star).toBeUndefined();
    expect(s0.shards.daer).toBe(35);
    // 再升一次要 20，剩 5 個不夠升第三次
    const r2 = starUp(r.state, 'daer');
    expect(shardsOf(r2.state, 'daer')).toBe(5);
    const r3 = starUp(r2.state, 'daer');
    expect(r3.check).toMatchObject({ ok: false, reason: 'shards', short: 25 });
    expect(r3.state).toBe(r2.state);
  });

  it('碎片夠就能一路升到滿星（共 100 個），滿星後不能再升', () => {
    let s = withShards(100);
    for (let i = 0; i < 4; i++) s = starUp(s, 'daer').state;
    expect(dogStatsById(s, 'daer')).toMatchObject({ star: 5, levelCap: 100 });
    expect(shardsOf(s, 'daer')).toBe(0);
    const more = { ...s, shards: { daer: 100 } };
    expect(starUp(more, 'daer').state).toBe(more);
  });

  it('卡在等級上限的寄宿狗升星後從現在重新起算，不會一次補發', () => {
    const s0 = fresh();
    const capped = {
      ...s0,
      team: ['daer'],
      shards: { abai: 10 },
      dogs: { ...s0.dogs, abai: { ...s0.dogs.abai, level: 60, exp: 0 } },
    };
    // 60 級已到上限不能寄宿，所以先放進去再調成上限的狀況：直接塞一個寄宿位
    const boarded = {
      ...capped,
      boarding: [{ dogId: 'abai', since: NOW, at: NOW, carry: 0, exp: 0, levels: 0 }],
    };
    expect(board(capped, 'abai', NOW).block).toBe('max-level');
    const later = NOW + 30 * 24 * 3600_000;
    const settled = settleBoarding(boarded, later);
    expect(settled.dogs.abai.level).toBe(60);
    const up = starUp(settled, 'abai', later).state;
    expect(up.boarding[0].at).toBe(later);
    expect(settleBoarding(up, later).dogs.abai).toMatchObject({ level: 60, star: 2 });
  });
});

describe('starText', () => {
  it('實心星加空心星共 5 顆', () => {
    expect(starText(1)).toBe('★☆☆☆☆');
    expect(starText(5)).toBe('★★★★★');
    expect(starText(9)).toBe('★★★★★');
  });
});
