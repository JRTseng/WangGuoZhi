import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { createBattle, nextActor, stepBattle, autoUlt, type BattleAction } from './battle';
import {
  battleInputOf,
  battleTeamOf,
  beginExpedition,
  completeExpedition,
  expeditionBattle,
  resultNotes,
  runExpedition,
  settlePending,
  stageWinChance,
} from './expedition';
import { setDogRow } from './formation';
import { autoFillTeam } from './team';
import { STAMINA_COST } from './stamina';

const NOW = 1_800_000_000_000;
const TEAM = ['daer', 'heixuan', 'changxu'];
/** 可以上 4 隻的關卡 */
const STAGE4 = 'luoyepo-3';
const fresh = (): GameState => createInitialState(NOW);

describe('出征與陣型（T023）', () => {
  it('隊伍的戰鬥資料帶著定位與站位；改了陣型就跟著變', () => {
    const st = fresh();
    const team = battleTeamOf(st, [...TEAM, 'xiaosuan']);
    expect(team.map((d) => d.role)).toEqual(['補給', '突擊', '守護', '謀略']);
    expect(team.map((d) => d.row)).toEqual([1, 0, 0, 2]);
    expect(team.every((d) => d.hasSkill)).toBe(true);
    const moved = setDogRow(st, TEAM, 'changxu', 2);
    expect(battleTeamOf(moved, TEAM).map((d) => d.row)).toEqual([1, 0, 2]);
  });

  it('暖桶是 SSR 補血、攻擊後補血', () => {
    const st = { ...fresh(), owned: [...fresh().owned, 'nuantong'] };
    expect(battleTeamOf(st, ['nuantong'])[0]).toMatchObject({
      role: '補血',
      heal: true,
      ssr: true,
      afterHeal: true,
      row: 2,
    });
  });

  it('每一關用自己的敵人陣容（T018）：第 1 關三隻小卒，Boss 關是頭目加兩隻小兵', () => {
    const team = battleTeamOf(fresh(), TEAM);
    const first = battleInputOf({ stageId: 'luoyepo-1', team, seed: 1 });
    expect(first.recommendedPower).toBe(150);
    expect(first.enemies!.map((e) => `${e.name}:${e.role}:${e.row}`)).toEqual([
      '坡匪小卒甲:野犬:0',
      '坡匪小卒乙:野犬:0',
      '坡匪小卒丙:野犬:1',
    ]);
    const boss = battleInputOf({ stageId: 'luoyepo-5', team, seed: 1 });
    expect(boss.enemies!.map((e) => `${e.name}:${e.role}:${e.row}`)).toEqual([
      '坡匪小卒甲:野犬:0',
      '坡匪小卒乙:野犬:0',
      '雷吼:頭目:1',
    ]);
    // 頭目佔大部分的戰力，而且只有牠會放大絕招
    const sim = createBattle(boss);
    expect(sim.enemies[2].maxHp).toBeGreaterThan(sim.enemies[0].maxHp * 3);
    expect(sim.enemies.map((u) => u.canUlt)).toEqual([false, false, true]);
  });

  it('略過戰鬥（runExpedition）= 開戰後用自動放招打完，結果與紀錄一樣', () => {
    const st = fresh();
    const direct = runExpedition(st, 'luoyepo-1', TEAM, NOW, { seed: 9 });
    const begun = beginExpedition(st, 'luoyepo-1', TEAM, NOW, { seed: 9 });
    if (!direct.ok || !begun.ok) throw new Error('應該可以出征');
    // 開戰當下：體力與次數已經扣了，還沒有獎勵與紀錄
    expect(begun.state.stamina.value).toBe(st.stamina.value - STAMINA_COST);
    expect(begun.state.resources).toEqual(st.resources);
    expect(begun.state.history).toHaveLength(0);
    expect(begun.state.pending).toMatchObject({ stageId: 'luoyepo-1', dogIds: TEAM, seed: 9 });
    const done = completeExpedition(begun.state)!;
    expect(done.state).toEqual(direct.state);
    expect(done.record).toEqual(direct.record);
    expect(done.state.pending).toBeNull();
    expect(done.record.ultTurns).toBeUndefined();
    // 沒有開戰中的仗
    expect(completeExpedition(done.state)).toBeNull();
    expect(settlePending(done.state)).toBe(done.state);
  });

  it('開戰的檢查和直接出征一樣；開戰到一半又開戰，會先把上一仗算完', () => {
    const st = fresh();
    expect(beginExpedition(st, 'luoyepo-2', TEAM, NOW)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
    expect(beginExpedition(st, 'luoyepo-1', [], NOW)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    const a = beginExpedition(st, 'luoyepo-1', TEAM, NOW, { seed: 1 });
    if (!a.ok) throw new Error('應該可以開戰');
    const b = beginExpedition(a.state, 'luoyepo-1', TEAM, NOW + 1, { seed: 2 });
    if (!b.ok) throw new Error('應該可以再開戰');
    expect(b.state.history).toHaveLength(1);
    expect(b.state.pending?.seed).toBe(2);
    expect(b.state.stamina.value).toBe(st.stamina.value - STAMINA_COST * 2);
    // 讀檔時把沒打完的仗算完
    const settled = settlePending(b.state);
    expect(settled.pending).toBeNull();
    expect(settled.history).toHaveLength(2);
  });

  it('結算訊息：通過關卡、敗北', () => {
    const st = fresh();
    const win = runExpedition(st, 'luoyepo-1', TEAM, NOW, { seed: 9 });
    if (!win.ok) throw new Error('應該可以出征');
    expect(win.record.win).toBe(true);
    expect(resultNotes(st, win.state, win.record)).toContain('通過關卡！下一關已開放');
    const lose = runExpedition(st, 'luoyepo-1', ['abai'], NOW, { seed: 9 });
    if (!lose.ok) throw new Error('應該可以出征');
    expect(lose.record.win).toBe(false);
    expect(resultNotes(st, lose.state, lose.record)).toEqual(['只帶回三成物資，關卡還沒通過']);
  });

  it('選隊伍畫面的勝率：模擬出來的，陣型排錯會變低，隊伍不合法是 0', () => {
    const st = fresh();
    const all = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    expect(stageWinChance(st, 'luoyepo-1', TEAM)).toBe(1);
    expect(stageWinChance(st, 'luoyepo-1', ['abai'])).toBeLessThan(0.05);
    expect(stageWinChance(st, 'luoyepo-1', [])).toBe(0);
    // 超過這一關的上陣上限（第 1 關 3 隻、第 1 章 Boss 關 4 隻）也是 0
    expect(stageWinChance(st, 'luoyepo-1', all.slice(0, 4))).toBe(0);
    expect(stageWinChance(st, 'luoyepo-5', all)).toBe(0);
    const four = ['heixuan', 'changxu', 'xiaosuan', 'abai'];
    const good = stageWinChance(st, STAGE4, four);
    let bad = st;
    bad = setDogRow(bad, four, 'heixuan', 2);
    bad = setDogRow(bad, four, 'changxu', 1);
    bad = setDogRow(bad, four, 'xiaosuan', 0);
    bad = setDogRow(bad, four, 'abai', 0);
    expect(stageWinChance(bad, STAGE4, four)).toBeLessThan(good - 0.15);
  });

  it('一鍵自動編隊會把站位照定位排好', () => {
    const st = fresh();
    const all = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    const moved = setDogRow(st, all, 'changxu', 2);
    const auto = autoFillTeam(moved);
    expect(
      battleTeamOf(auto, auto.team)
        .map((d) => `${d.id}:${d.row}`)
        .sort(),
    ).toEqual(['abai:2', 'changxu:0', 'daer:1', 'heixuan:0', 'xiaosuan:2'].sort());
  });
});

describe('手動放招的紀錄', () => {
  it('玩家留著不放、晚一點才放：結算用同樣的時機重算，勝負與畫面一致', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const st = { ...fresh(), cleared: ['luoyepo-1', 'luoyepo-2'] };
      const begun = beginExpedition(st, 'luoyepo-3', TEAM, NOW, { seed });
      if (!begun.ok) throw new Error('應該可以開戰');
      // 戰鬥畫面：一步一步推，我方第 3 回合起才放招
      let sim = createBattle(battleInputOf(begun.state.pending!));
      const actions: BattleAction[] = [];
      while (!sim.over) {
        const a = nextActor(sim)!;
        const use = a.side === 'enemy' ? autoUlt(sim) : a.ultReady && sim.round >= 3;
        const r = stepBattle(sim, use);
        actions.push(r.action);
        sim = r.state;
      }
      const ultTurns = actions.filter((a) => a.side === 'team' && a.ult).map((a) => a.turn);
      const done = completeExpedition(begun.state, ultTurns)!;
      expect(done.record.win).toBe(sim.win);
      expect(done.record.ultTurns).toEqual(ultTurns);
      expect(expeditionBattle(done.record).actions).toEqual(actions);
      expect(done.state.cleared.includes('luoyepo-3')).toBe(sim.win);
    }
  });
});
