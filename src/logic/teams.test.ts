import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { cellValue } from './formation';
import { sanitizeState } from './save';
import { placeDog } from './team';
import { TEAM_PRESETS, presetSizes, switchTeam } from './teams';

const base = () => ({
  ...createInitialState(0),
  owned: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'],
});

describe('五組隊伍切換', () => {
  it('新遊戲在第一組，其他四組是空的', () => {
    const st = base();
    expect(st.teamIndex).toBe(0);
    expect(st.teams).toHaveLength(TEAM_PRESETS);
    expect(presetSizes(st)).toEqual([3, 0, 0, 0, 0]);
  });

  it('切到空的組是空隊伍，切回來成員與站位都還在', () => {
    let st = base();
    const placed = placeDog(st, st.team, 'daer', 2, 0);
    st = { ...placed.state, team: placed.team };
    const cells = { ...st.formation };

    let second = switchTeam(st, 1);
    expect(second.teamIndex).toBe(1);
    expect(second.team).toEqual([]);
    expect(presetSizes(second)).toEqual([3, 0, 0, 0, 0]);

    // 第二組放不同的狗，大耳在這組站前排
    const r = placeDog(second, second.team, 'daer', 0, 1);
    second = { ...r.state, team: r.team };
    const r2 = placeDog(second, second.team, 'abai', 1, 1);
    second = { ...r2.state, team: r2.team };
    expect(second.formation.daer).toBe(cellValue(0, 1));

    const back = switchTeam(second, 0);
    expect(back.team).toEqual(['daer', 'heixuan', 'changxu']);
    expect(back.formation.daer).toBe(cellValue(2, 0));
    for (const id of back.team) expect(back.formation[id]).toBe(cells[id] ?? back.formation[id]);
    expect(presetSizes(back)).toEqual([3, 2, 0, 0, 0]);

    const again = switchTeam(back, 1);
    expect(again.team).toEqual(['daer', 'abai']);
    expect(again.formation.daer).toBe(cellValue(0, 1));
  });

  it('同一組、超出範圍的編號不動', () => {
    const st = base();
    expect(switchTeam(st, 0)).toBe(st);
    expect(switchTeam(st, 5)).toBe(st);
    expect(switchTeam(st, -1)).toBe(st);
    expect(switchTeam(st, 1.5)).toBe(st);
  });

  it('切回來時，寄宿中的狗會從那一組拿掉', () => {
    let st = switchTeam(base(), 2);
    st = { ...st, boarding: [{ dogId: 'heixuan', since: 0, claimedAt: 0 }] as never };
    const back = switchTeam(st, 0);
    expect(back.team).toEqual(['daer', 'changxu']);
  });

  it('存檔：五組與目前第幾組都留著，壞資料會整理掉', () => {
    const st = switchTeam(base(), 3);
    const loaded = sanitizeState(JSON.parse(JSON.stringify(st)), 0);
    expect(loaded.teamIndex).toBe(3);
    expect(loaded.teams[0].team).toEqual(['daer', 'heixuan', 'changxu']);
    expect(loaded.teams).toHaveLength(TEAM_PRESETS);

    const raw = JSON.parse(JSON.stringify(st));
    raw.teamIndex = 99;
    raw.teams = [
      { team: ['daer', 'daer', 'nobody', 7], formation: { daer: 4, heixuan: 5, x: 99 } },
    ];
    const fixed = sanitizeState(raw, 0);
    expect(fixed.teamIndex).toBe(TEAM_PRESETS - 1);
    expect(fixed.teams[0]).toEqual({ team: ['daer'], formation: { daer: 4 } });
    expect(fixed.teams.slice(1).every((p) => p.team.length === 0)).toBe(true);
  });

  it('舊存檔沒有這些欄位：補成第一組', () => {
    const raw = JSON.parse(JSON.stringify(base()));
    delete raw.teamIndex;
    delete raw.teams;
    const loaded = sanitizeState(raw, 0);
    expect(loaded.teamIndex).toBe(0);
    expect(loaded.teams).toHaveLength(TEAM_PRESETS);
    expect(loaded.team).toEqual(['daer', 'heixuan', 'changxu']);
  });
});
