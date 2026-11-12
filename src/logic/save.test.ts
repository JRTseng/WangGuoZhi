import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { setAuto } from './auto';
import { runExpedition } from './expedition';
import { SAVE_VERSION, deserialize, sanitizeState, serialize, type SaveFile } from './save';
import { buyStamina, settle } from './stamina';
import { drill } from './training';

const NOW = Date.UTC(2026, 10, 12, 4, 0, 0);
const O = { tzOffsetMin: -480 };

/** 玩過一陣子的狀態：打過仗、特訓過、買過體力、開了自動出征、換過設定 */
function playedState(): GameState {
  let st = settle(createInitialState(NOW), NOW, O);
  const run = runExpedition(st, 'luoyepo-1', ['daer', 'heixuan', 'changxu'], NOW, {
    ...O,
    seed: 7,
  });
  if (!run.ok) throw new Error(`出征失敗：${run.error}`);
  st = run.state;
  const d = drill(st, 'daer', 'attack');
  if (!d.check.ok) throw new Error('特訓失敗');
  st = d.state;
  const b = buyStamina(st, NOW, O);
  if (!b.ok) throw new Error('買體力失敗');
  st = setAuto(b.state, true, NOW);
  return {
    ...st,
    owned: [...st.owned, 'nuantong'],
    dogs: { ...st.dogs, nuantong: { ...st.dogs.daer, level: 5 } },
    lobbyDogId: 'heixuan',
    backgroundId: 'bamboo',
    seenStories: ['prologue'],
    redeemedCodes: ['HELLODOG'],
    settings: { ...st.settings, music: false, quality: 'low', skipBattle: true, battleSpeed: 3 },
  };
}

describe('serialize / deserialize', () => {
  it('沒有存檔時是新遊戲', () => {
    const r = deserialize(null, NOW);
    expect(r.status).toBe('new');
    expect(r.state).toEqual(createInitialState(NOW));
  });

  it('新遊戲存了再讀，完全一樣', () => {
    const st = createInitialState(NOW);
    const r = deserialize(serialize(st, NOW), NOW);
    expect(r.status).toBe('ok');
    expect(r.state).toEqual(st);
  });

  it('玩過的進度存了再讀，完全一樣', () => {
    const st = playedState();
    // 確認這份狀態真的有東西可以存
    expect(st.history).toHaveLength(1);
    expect(st.dogs.daer.drillAttack).toBe(1);
    expect(st.daily.staminaBuys).toBe(1);
    expect(st.auto.enabled).toBe(true);

    const r = deserialize(serialize(st, NOW), NOW + 1000);
    expect(r.status).toBe('ok');
    expect(r.state).toEqual(st);
  });

  it('存檔帶版本號與存檔時間', () => {
    const file = JSON.parse(serialize(createInitialState(NOW), NOW)) as SaveFile;
    expect(file.version).toBe(SAVE_VERSION);
    expect(file.savedAt).toBe(NOW);
  });

  it.each([
    ['不是 JSON', '{壞掉了'],
    ['空字串', ''],
    ['不是物件', '42'],
    ['是陣列', '[]'],
    ['null', 'null'],
    ['沒有 state', JSON.stringify({ version: 1 })],
    ['state 不是物件', JSON.stringify({ version: 1, state: 'x' })],
    ['沒有版本號', JSON.stringify({ state: {} })],
    ['版本號不對', JSON.stringify({ version: 0, state: {} })],
  ])('壞檔（%s）自動重置成新遊戲', (_name, raw) => {
    const r = deserialize(raw, NOW);
    expect(r.status).toBe('reset');
    expect(r.state).toEqual(createInitialState(NOW));
  });

  it('比較新的版本存的檔也盡量讀，不清掉進度', () => {
    const st = playedState();
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, savedAt: NOW, state: st });
    const r = deserialize(raw, NOW);
    expect(r.status).toBe('ok');
    expect(r.state.resources).toEqual(st.resources);
    expect(r.state.cleared).toEqual(st.cleared);
  });
});

describe('sanitizeState', () => {
  it('缺的欄位補預設值，其他進度留著（舊存檔遇到新欄位）', () => {
    const st = playedState();
    const old: Partial<GameState> = { ...st };
    delete old.stamina;
    delete old.daily;
    delete old.auto;
    delete old.settings;
    const out = sanitizeState(old, NOW);
    const base = createInitialState(NOW);
    expect(out.stamina).toEqual(base.stamina);
    expect(out.daily).toEqual(base.daily);
    expect(out.auto).toEqual(base.auto);
    expect(out.settings).toEqual(base.settings);
    expect(out.resources).toEqual(st.resources);
    expect(out.dogs).toEqual(st.dogs);
    expect(out.cleared).toEqual(st.cleared);
  });

  it('型別不對或超出範圍的數值會被修正', () => {
    const st = playedState();
    const out = sanitizeState(
      {
        ...st,
        resources: { food: -50, bones: 'many' },
        dogs: {
          ...st.dogs,
          daer: { ...st.dogs.daer, level: 999, exp: 1e9, drillAttack: 99, drillDefense: -3 },
          heixuan: 'oops',
        },
        settings: { ...st.settings, quality: 'ultra', battleSpeed: 9, voice: 'yes' },
        stamina: { value: Number.NaN, updatedAt: 'x' },
      },
      NOW,
    );
    expect(out.resources).toEqual({ food: 0, bones: 50 });
    expect(out.dogs.daer.level).toBe(100);
    expect(out.dogs.daer.exp).toBe(0);
    expect(out.dogs.daer.drillAttack).toBe(10);
    expect(out.dogs.daer.drillDefense).toBe(0);
    expect(out.dogs.heixuan).toEqual(createInitialState(NOW).dogs.heixuan);
    expect(out.settings.quality).toBe('high');
    expect(out.settings.battleSpeed).toBe(1);
    expect(out.settings.voice).toBe(true);
    expect(out.stamina).toEqual({ value: 100, updatedAt: NOW });
  });

  it('認不得的狗狗、關卡、劇情、背景會被丟掉', () => {
    const st = playedState();
    const out = sanitizeState(
      {
        ...st,
        owned: [...st.owned, 'ghost', 'daer', 7],
        team: ['ghost', 'daer', 'daer', 'abai'],
        lobbyDogId: 'ghost',
        backgroundId: 'moon',
        cleared: ['luoyepo-1', 'nowhere-9', 'luoyepo-1'],
        seenStories: ['prologue', 'fake'],
        daily: { ...st.daily, runs: { 'luoyepo-1': 2, 'nowhere-9': 3, 'luoyepo-2': -1 } },
        history: [...st.history, { id: 'bad' }, null],
      },
      NOW,
    );
    expect(out.owned).toEqual(st.owned);
    expect(out.team).toEqual(['daer', 'abai']);
    expect(out.lobbyDogId).toBe(st.owned[0]);
    expect(out.backgroundId).toBe('slope');
    expect(out.cleared).toEqual(['luoyepo-1']);
    expect(out.seenStories).toEqual(['prologue']);
    expect(out.daily.runs).toEqual({ 'luoyepo-1': 2 });
    expect(out.history).toEqual(st.history);
  });

  it('擁有的狗一定有養成進度；一隻狗都沒有就給初始的狗', () => {
    const st = playedState();
    const out = sanitizeState({ ...st, dogs: {} }, NOW);
    for (const id of st.owned) expect(out.dogs[id]).toBeDefined();

    const empty = sanitizeState({ ...st, owned: [] }, NOW);
    expect(empty.owned).toEqual(createInitialState(NOW).owned);
  });

  it('存檔時間比現在還晚（系統時間被調過）：從現在重新起算', () => {
    const st = playedState();
    const out = sanitizeState(
      {
        ...st,
        stamina: { value: 40, updatedAt: NOW + 86_400_000 },
        auto: { ...st.auto, lastAt: NOW + 86_400_000 },
      },
      NOW,
    );
    expect(out.stamina).toEqual({ value: 40, updatedAt: NOW });
    expect(out.auto.lastAt).toBe(NOW);
  });

  it('關掉遊戲的時間，讀檔後體力照樣恢復', () => {
    const st = { ...playedState(), stamina: { value: 40, updatedAt: NOW } };
    const later = NOW + 50 * 60_000;
    const loaded = deserialize(serialize(st, NOW), later).state;
    expect(loaded.stamina).toEqual({ value: 40, updatedAt: NOW });
    expect(settle(loaded, later, O).stamina.value).toBe(50);
  });

  it('完全不是物件就給新遊戲', () => {
    expect(sanitizeState(null, NOW)).toEqual(createInitialState(NOW));
    expect(sanitizeState([1, 2], NOW)).toEqual(createInitialState(NOW));
  });
});
