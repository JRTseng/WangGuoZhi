import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { grantTryDog, tryDogFromSearch } from './tryDog';

describe('試看角色（?try=）', () => {
  it('只認得存在的角色 id', () => {
    expect(tryDogFromSearch('?try=lanjue')).toBe('lanjue');
    expect(tryDogFromSearch('?try=nobody')).toBeNull();
    expect(tryDogFromSearch('')).toBeNull();
  });

  it('拿到角色、放到主頁、頂掉隊伍第一位，隊伍人數不變', () => {
    const s0 = createInitialState();
    const s1 = grantTryDog(s0, 'lanjue');
    expect(s1.owned).toContain('lanjue');
    expect(s1.dogs.lanjue.level).toBe(1);
    expect(s1.lobbyDogId).toBe('lanjue');
    expect(s1.team).toEqual(['lanjue', ...s0.team.slice(1)]);
    // 再來一次不會變
    expect(grantTryDog(s1, 'lanjue')).toBe(s1);
  });
});
