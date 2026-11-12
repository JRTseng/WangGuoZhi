import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { autoFillTeam, dogPower, setLobbyDog, teamPower, toggleTeamMember } from './team';

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
    // 大耳 3 級：攻 42+7、防 48+7；黑旋 2 級：攻 64+4、防 30+3
    expect(teamPower(s, ['daer', 'heixuan'])).toBe(104 + 101);
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
