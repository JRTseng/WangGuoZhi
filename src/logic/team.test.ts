import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { teamCells } from './formation';
import { autoFillTeam, dogPower, placeDog, setLobbyDog, teamPower, toggleTeamMember } from './team';

describe('組隊編排', () => {
  it('預設隊伍 3 隻，點隊伍中的狗移出', () => {
    const s = toggleTeamMember(createInitialState(), 'heixuan');
    expect(s.team).toEqual(['daer', 'changxu']);
  });
  it('隊伍最多 5 隻，有空位才能加入，滿了沒反應', () => {
    const start = { ...createInitialState(), owned: [...createInitialState().owned, 'tieya'] };
    const full = toggleTeamMember(toggleTeamMember(start, 'xiaosuan'), 'abai');
    expect(full.team).toEqual(['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
    expect(toggleTeamMember(full, 'tieya')).toBe(full);
    const s = toggleTeamMember(toggleTeamMember(full, 'daer'), 'tieya');
    expect(s.team).toEqual(['heixuan', 'changxu', 'xiaosuan', 'abai', 'tieya']);
  });
  it('拖到九宮格：隊友換位置或對調；沒上陣的狗上陣站那一格，格子上有隊友就換人', () => {
    const s0 = createInitialState();
    const team = s0.team; // 大耳（中排中）、黑旋（前排上）、長鬚（前排下）
    // 隊友換到空格
    const a = placeDog(s0, team, 'changxu', 2, 0);
    expect(a.error).toBeNull();
    expect(a.team).toEqual(team);
    expect(teamCells(a.state, a.team)[2]).toEqual({ row: 2, lane: 0 });
    // 小算從卡片格拖到後排下：加入隊伍，其他隊友不動
    const b = placeDog(a.state, a.team, 'xiaosuan', 2, 2);
    expect(b.team).toEqual(['daer', 'heixuan', 'changxu', 'xiaosuan']);
    expect(teamCells(b.state, b.team)).toEqual([
      { row: 1, lane: 1 },
      { row: 0, lane: 0 },
      { row: 2, lane: 0 },
      { row: 2, lane: 2 },
    ]);
    // 阿白拖到黑旋身上：換黑旋下來，阿白站那一格
    const c = placeDog(b.state, b.team, 'abai', 0, 0);
    expect(c.team).toEqual(['daer', 'abai', 'changxu', 'xiaosuan']);
    expect(teamCells(c.state, c.team)[1]).toEqual({ row: 0, lane: 0 });
    expect(s0.formation).toEqual({});
  });
  it('拖到九宮格：隊伍滿了不能再放到空格，沒擁有、寄宿中的不能放', () => {
    const base = createInitialState();
    const owned = { ...base, owned: [...base.owned, 'tieya'] };
    const full = { ...owned, team: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'] };
    const cells = teamCells(full, full.team);
    const free = [0, 1, 2]
      .flatMap((row) => [0, 1, 2].map((lane) => ({ row, lane })))
      .find((x) => !cells.some((c) => c.row === x.row && c.lane === x.lane))!;
    const no = placeDog(full, full.team, 'tieya', free.row as 0, free.lane as 0);
    expect(no.error).toContain('隊伍滿了');
    expect(no.state).toBe(full);
    expect(no.team).toEqual(full.team);
    // 滿了還是可以拖到隊友身上換人
    const swap = placeDog(full, full.team, 'tieya', cells[0].row, cells[0].lane);
    expect(swap.error).toBeNull();
    expect(swap.team).toEqual(['tieya', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
    expect(placeDog(base, base.team, 'tieya', 2, 1).error).toContain('還沒擁有');
    const boarding = {
      ...base,
      team: ['daer'],
      boarding: [{ dogId: 'abai', since: 0, at: 0, carry: 0, exp: 0, levels: 0 }],
    };
    expect(placeDog(boarding, boarding.team, 'abai', 2, 1).error).toContain('寄宿');
  });
  it('沒擁有的狗不能加入、不能當主頁角色', () => {
    const s = toggleTeamMember(createInitialState(), 'daer');
    expect(toggleTeamMember(s, 'tieya')).toBe(s);
    expect(setLobbyDog(s, 'tieya')).toBe(s);
  });
  it('自動編隊：擁有的狗裡戰力最高的 5 隻', () => {
    const s0 = createInitialState();
    expect(autoFillTeam(s0).team).toEqual(['changxu', 'daer', 'heixuan', 'xiaosuan', 'abai']);
    const six = { ...s0, owned: [...s0.owned, 'tieya'] };
    expect(autoFillTeam(six).team).toEqual(['tieya', 'changxu', 'daer', 'heixuan', 'xiaosuan']);
    const none = { ...s0, owned: [] };
    expect(autoFillTeam(none)).toBe(none);
  });
  it('設定主頁角色', () => {
    expect(setLobbyDog(createInitialState(), 'abai').lobbyDogId).toBe('abai');
  });
  it('隊伍戰力為成員戰力加總', () => {
    const s = createInitialState();
    // 大耳 3 級（R）：攻 42+8、防 48+8；黑旋 2 級（R）：攻 64+5、防 30+3
    expect(teamPower(s, ['daer', 'heixuan'])).toBe(106 + 102);
    expect(teamPower(s, [])).toBe(0);
  });
  it('升級後戰力跟著變高，自動編隊照新的戰力排', () => {
    const s0 = createInitialState();
    const abai = s0.dogs.abai;
    const s = {
      ...s0,
      dogs: { ...s0.dogs, abai: { ...abai, level: 20, growthAttack: 60, growthDefense: 60 } },
    };
    expect(dogPower(s, 'abai')).toBe(70 + 120);
    expect(autoFillTeam(s).team[0]).toBe('abai');
  });
});
