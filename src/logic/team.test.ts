import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { autoFillTeam, setLobbyDog, teamPower, toggleTeamMember } from './team';

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
  it('自動編隊：戰力最高的 5 隻可出征狗狗，出征中的跳過', () => {
    const s0 = createInitialState();
    expect(autoFillTeam(s0).team).toEqual(['changxu', 'daer', 'heixuan', 'xiaosuan', 'abai']);
    const busy = {
      ...s0,
      owned: [...s0.owned, 'tieya'],
      expeditions: [
        { id: 'e1', stageId: 'luoyepo-1', dogIds: ['changxu'], startedAt: 0, endsAt: 1, seed: 1 },
      ],
    };
    expect(autoFillTeam(busy).team).toEqual(['tieya', 'daer', 'heixuan', 'xiaosuan', 'abai']);
    const allBusy = { ...s0, expeditions: [{ ...busy.expeditions[0], dogIds: [...s0.owned] }] };
    expect(autoFillTeam(allBusy)).toBe(allBusy);
  });
  it('設定主頁角色', () => {
    expect(setLobbyDog(createInitialState(), 'abai').lobbyDogId).toBe('abai');
  });
  it('隊伍戰力為成員戰力加總', () => {
    expect(teamPower(['daer', 'heixuan'])).toBe(108 + 103);
    expect(teamPower([])).toBe(0);
  });
});
