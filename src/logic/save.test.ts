import { grantExclusives } from './equipment';
import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { setAuto } from './auto';
import { createRng } from './battle';
import { beginExpedition, completeExpedition, runExpedition, settlePending } from './expedition';
import { setDogRow, teamRows } from './formation';
import { pull } from './gacha';
import { SAVE_VERSION, deserialize, sanitizeState, serialize, type SaveFile } from './save';
import { SKILL_LINE_MAX, setSkillLine } from './skillShow';
import { buyStamina, settle } from './stamina';
import { starUp } from './star';
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
    expect(r.state).toEqual(grantExclusives(st));
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
    expect(r.state).toEqual(grantExclusives(st));
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

describe('召募、碎片與星數（T007）', () => {
  it('抽過卡、升過星的進度存了再讀，完全一樣', () => {
    const pulled = pull(playedState(), 10, createRng(8)).state;
    const st = starUp({ ...pulled, shards: { ...pulled.shards, daer: 25 } }, 'daer').state;
    expect(st.dogs.daer.star).toBe(2);
    expect(st.gacha.pulls).toBe(10);
    expect(st.owned.length).toBeGreaterThan(6);
    const r = deserialize(serialize(st, NOW), NOW);
    expect(r.status).toBe('ok');
    expect(r.state).toEqual(grantExclusives(st));
  });

  it('T007 之前的舊存檔：沒有碎片、召募紀錄與星數，補成預設值，其他進度留著', () => {
    const st = playedState();
    const old: Record<string, unknown> = JSON.parse(JSON.stringify(st));
    delete old.shards;
    delete old.gacha;
    const out = sanitizeState(old, NOW);
    expect(out.shards).toEqual({});
    expect(out.gacha).toEqual({ pulls: 0, sinceSSR: 0 });
    expect(out.dogs.daer.star).toBeUndefined();
    expect(out.dogs).toEqual(st.dogs);
    expect(out.owned).toEqual(st.owned);
  });

  it('怪怪的值會被修正：星數夾在 1～5、碎片只留認得的狗與正整數、保底計數不超過門檻', () => {
    const st = createInitialState(NOW);
    const out = sanitizeState(
      {
        ...st,
        dogs: {
          ...st.dogs,
          daer: { ...st.dogs.daer, star: 99 },
          abai: { ...st.dogs.abai, star: -2 },
          heixuan: { ...st.dogs.heixuan, star: 'five' },
          changxu: { ...st.dogs.changxu, star: 2, level: 80, exp: 50 },
        },
        shards: { daer: 20.9, abai: -5, nobody: 30, tieya: 'x', heixuan: 0 },
        gacha: { pulls: -3, sinceSSR: 9999 },
      },
      NOW,
    );
    expect(out.dogs.daer.star).toBe(5);
    expect(out.dogs.abai.star).toBeUndefined();
    expect(out.dogs.heixuan.star).toBeUndefined();
    // 等級超過這個星數的上限：等級留著，但經驗歸零（不會再升）
    expect(out.dogs.changxu).toMatchObject({ star: 2, level: 80, exp: 0 });
    expect(out.shards).toEqual({ daer: 20 });
    expect(out.gacha).toEqual({ pulls: 0, sinceSSR: 49 });
    expect(sanitizeState({ ...st, shards: [1, 2], gacha: 'x' }, NOW)).toMatchObject({
      shards: {},
      gacha: { pulls: 0, sinceSSR: 0 },
    });
  });
});

describe('招式台詞（T017）', () => {
  it('填過台詞的進度存了再讀，完全一樣', () => {
    const st = setSkillLine(playedState(), 'daer', '兄弟們衝啊！');
    expect(st.skillLines).toEqual({ daer: '兄弟們衝啊！' });
    const r = deserialize(serialize(st, NOW), NOW);
    expect(r.status).toBe('ok');
    expect(r.state).toEqual(grantExclusives(st));
  });

  it('T017 之前的舊存檔沒有台詞：補成空的，其他進度留著', () => {
    const st = playedState();
    const old: Record<string, unknown> = JSON.parse(JSON.stringify(st));
    delete old.skillLines;
    const out = sanitizeState(old, NOW);
    expect(out.skillLines).toEqual({});
    expect(out.dogs).toEqual(st.dogs);
  });

  it('怪怪的值會被修正：只留認得的狗與字串，太長截掉，空的丟掉', () => {
    const st = createInitialState(NOW);
    const out = sanitizeState(
      {
        ...st,
        skillLines: {
          daer: `  ${'汪'.repeat(50)}  `,
          heixuan: 'A\nB',
          abai: '   ',
          changxu: 123,
          nobody: '我是誰',
        },
      },
      NOW,
    );
    expect(out.skillLines).toEqual({ daer: '汪'.repeat(SKILL_LINE_MAX), heixuan: 'A B' });
    expect(sanitizeState({ ...st, skillLines: ['x'] }, NOW).skillLines).toEqual({});
  });
});

describe('陣型與開戰中的仗（T023）', () => {
  const TEAM = ['daer', 'heixuan', 'changxu'];

  it('排過陣型、關掉自動放招的進度存了再讀，完全一樣', () => {
    let st = setDogRow(playedState(), TEAM, 'changxu', 2);
    st = { ...st, settings: { ...st.settings, autoUlt: false } };
    const out = deserialize(serialize(st, NOW), NOW);
    expect(out.status).toBe('ok');
    // 記的是九宮格的格子（排 × 3 + 格 + 3）：大耳中排中、黑旋前排上、長鬚後排中
    expect(out.state.formation).toEqual({ daer: 7, heixuan: 3, changxu: 10 });
    expect(out.state.settings.autoUlt).toBe(false);
    expect(teamRows(out.state, TEAM)).toEqual([1, 0, 2]);
    expect(out.state).toEqual(grantExclusives(st));
  });

  it('T023 之前的舊存檔：沒有陣型，自動照定位排好；自動放招預設打勾', () => {
    const st = playedState();
    const old: Record<string, unknown> = JSON.parse(JSON.stringify(st));
    delete old.formation;
    delete old.pending;
    delete (old.settings as Record<string, unknown>).autoUlt;
    const out = sanitizeState(old, NOW);
    expect(out.formation).toEqual({});
    expect(out.pending).toBeNull();
    expect(out.settings.autoUlt).toBe(true);
    expect(teamRows(out, TEAM)).toEqual([1, 0, 0]);
    expect(out.dogs).toEqual(st.dogs);
    // 舊的出征紀錄（隊伍資料沒有定位與站位）照樣留著
    expect(out.history).toHaveLength(st.history.length);
  });

  it('怪怪的陣型會被修正：只留認得的狗與 0～11', () => {
    const st = createInitialState(NOW);
    const out = sanitizeState(
      {
        ...st,
        formation: { daer: 2, heixuan: 12, changxu: '0', abai: -1, nobody: 1, xiaosuan: 11 },
      },
      NOW,
    );
    expect(out.formation).toEqual({ daer: 2, xiaosuan: 11 });
    expect(sanitizeState({ ...st, formation: [1, 2] }, NOW).formation).toEqual({});
  });

  it('開戰到一半存檔：讀回來那一仗還在，可以用自動放招算完', () => {
    const begun = beginExpedition(settle(createInitialState(NOW), NOW, O), 'luoyepo-1', TEAM, NOW, {
      ...O,
      seed: 11,
    });
    if (!begun.ok) throw new Error('應該可以開戰');
    const out = deserialize(serialize(begun.state, NOW), NOW);
    expect(out.state.pending).toEqual(begun.state.pending);
    const done = settlePending(out.state);
    expect(done.pending).toBeNull();
    expect(done.history).toHaveLength(1);
    expect(done.history[0]).toMatchObject({ stageId: 'luoyepo-1', seed: 11, win: true });
  });

  it('開戰中的仗資料怪怪的就丟掉；手動放招的紀錄存得回來', () => {
    const st = createInitialState(NOW);
    for (const pending of [
      { stageId: 'nowhere', dogIds: TEAM, seed: 1, at: NOW },
      { stageId: 'luoyepo-1', dogIds: [], seed: 1, at: NOW },
      { stageId: 'luoyepo-1', dogIds: ['tieya'], seed: 1, at: NOW },
      { stageId: 'luoyepo-1', dogIds: TEAM, seed: 'x', at: NOW },
      'battle',
    ]) {
      expect(sanitizeState({ ...st, pending }, NOW).pending).toBeNull();
    }
    const begun = beginExpedition(settle(st, NOW, O), 'luoyepo-1', TEAM, NOW, { ...O, seed: 3 });
    if (!begun.ok) throw new Error('應該可以開戰');
    const done = completeExpedition(begun.state, [])!;
    expect(done.record.ultTurns).toEqual([]);
    const out = deserialize(serialize(done.state, NOW), NOW);
    expect(out.state.history).toEqual(done.state.history);
    const broken = JSON.parse(JSON.stringify(done.state));
    broken.history[0].ultTurns = ['a'];
    expect(sanitizeState(broken, NOW).history).toHaveLength(0);
  });
});
