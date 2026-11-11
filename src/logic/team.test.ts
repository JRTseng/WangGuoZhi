import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { setLobbyDog, teamPower, toggleTeamMember } from './team';

describe('組隊編排', () => {
  it('預設隊伍 3 隻，點隊伍中的狗移出', () => {
    const s = toggleTeamMember(createInitialState(), 'heixuan');
    expect(s.team).toEqual(['daer', 'changxu']);
  });
  it('有空位才能加入，滿了沒反應', () => {
    const full = createInitialState();
    expect(toggleTeamMember(full, 'abai')).toBe(full);
    const s = toggleTeamMember(toggleTeamMember(full, 'daer'), 'abai');
    expect(s.team).toEqual(['heixuan', 'changxu', 'abai']);
  });
  it('沒擁有的狗不能加入、不能當主頁角色', () => {
    const s = toggleTeamMember(createInitialState(), 'daer');
    expect(toggleTeamMember(s, 'tieya')).toBe(s);
    expect(setLobbyDog(s, 'tieya')).toBe(s);
  });
  it('設定主頁角色', () => {
    expect(setLobbyDog(createInitialState(), 'abai').lobbyDogId).toBe('abai');
  });
  it('隊伍戰力為成員戰力加總', () => {
    expect(teamPower(['daer', 'heixuan'])).toBe(108 + 103);
    expect(teamPower([])).toBe(0);
  });
});
