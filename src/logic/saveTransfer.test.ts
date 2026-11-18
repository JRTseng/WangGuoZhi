import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { SAVE_VERSION, serialize } from './save';
import {
  CODE_PREFIX,
  checksum,
  decodeSaveCode,
  encodeSaveCode,
  fromBase64Url,
  inspectSave,
  saveFileName,
  saveSummary,
  savedAtText,
  summaryText,
  toBase64Url,
} from './saveTransfer';

const NOW = Date.UTC(2026, 10, 18, 16, 30, 0); // 台北 11/19 00:30
const TAIPEI = -480;

function played(): GameState {
  const st = createInitialState(NOW);
  return {
    ...st,
    resources: { food: 4321, bones: 987 },
    cleared: ['luoyepo-1', 'luoyepo-2'],
    lord: { level: 7, exp: 12 },
    skillLines: { daer: '看我的大耳旋風！' },
  };
}

describe('base64url', () => {
  it('各種長度來回都一樣', () => {
    for (let n = 0; n < 20; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 73 + 251) & 255);
      const text = toBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(fromBase64Url(text)!)).toEqual(Array.from(bytes));
    }
  });

  it('不認得的字或長度不對回傳 null', () => {
    expect(fromBase64Url('ab+c')).toBeNull();
    expect(fromBase64Url('abcde')).toBeNull();
  });
});

describe('存檔碼', () => {
  it('壓縮後來回，內容一字不差（含中文）', async () => {
    const json = serialize(played(), NOW);
    const code = await encodeSaveCode(json);
    expect(code.startsWith(`${CODE_PREFIX}.z.`)).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(code.length).toBeLessThan(json.length);
    expect(await decodeSaveCode(code)).toEqual({ ok: true, json });
  });

  it('沒有壓縮功能時給沒壓縮的，一樣讀得回來', async () => {
    const json = serialize(played(), NOW);
    const code = await encodeSaveCode(json, null);
    expect(code.startsWith(`${CODE_PREFIX}.r.`)).toBe(true);
    expect(await decodeSaveCode(code, null)).toEqual({ ok: true, json });
  });

  it('壓縮失敗或沒變小就不壓', async () => {
    const boom = await encodeSaveCode('{"a":1}', () => Promise.reject(new Error('x')));
    expect(boom.startsWith(`${CODE_PREFIX}.r.`)).toBe(true);
    const same = await encodeSaveCode('{"a":1}', (b) => Promise.resolve(b));
    expect(same.startsWith(`${CODE_PREFIX}.r.`)).toBe(true);
  });

  it('中間被斷行、前後有空白也讀得回來', async () => {
    const json = serialize(played(), NOW);
    const code = await encodeSaveCode(json);
    const wrapped = `  ${code.replace(/(.{40})/g, '$1\n')}  \n`;
    expect(await decodeSaveCode(wrapped)).toEqual({ ok: true, json });
  });

  it('空的、不是存檔碼、少一截、被改過，各有各的原因', async () => {
    const code = await encodeSaveCode(serialize(played(), NOW));
    expect(await decodeSaveCode('  \n')).toEqual({ ok: false, error: 'empty' });
    expect(await decodeSaveCode('哈囉')).toEqual({ ok: false, error: 'format' });
    expect(await decodeSaveCode('{"version":1}')).toEqual({ ok: false, error: 'format' });
    expect(await decodeSaveCode(code.slice(0, code.length - 30))).toEqual({
      ok: false,
      error: 'damaged',
    });
    expect(await decodeSaveCode(code.slice(0, 20))).toEqual({ ok: false, error: 'damaged' });
    const i = 20;
    const swapped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(await decodeSaveCode(swapped)).toEqual({ ok: false, error: 'damaged' });
  });

  it('壓縮過的碼遇到不會解壓縮的環境', async () => {
    const code = await encodeSaveCode(serialize(played(), NOW));
    expect(await decodeSaveCode(code, null)).toEqual({ ok: false, error: 'unsupported' });
  });

  it('檢查碼是 8 個十六進位字', () => {
    expect(checksum(new Uint8Array([]))).toBe('811c9dc5');
    expect(checksum(new TextEncoder().encode('a'))).toBe('e40c292c');
  });
});

describe('inspectSave', () => {
  it('讀得進來的存檔回傳狀態與摘要', () => {
    const r = inspectSave(serialize(played(), NOW), NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.resources).toEqual({ food: 4321, bones: 987 });
    expect(r.state.skillLines.daer).toBe('看我的大耳旋風！');
    expect(r.summary).toEqual({
      faction: 'dog',
      lordLevel: 7,
      owned: r.state.owned.length,
      cleared: 2,
      savedAt: NOW,
    });
  });

  it('不是 JSON、不是存檔，都不收', () => {
    expect(inspectSave('不是 JSON', NOW)).toEqual({ ok: false, error: 'invalid' });
    expect(inspectSave('[1,2]', NOW)).toEqual({ ok: false, error: 'invalid' });
    expect(inspectSave('{"hello":1}', NOW)).toEqual({ ok: false, error: 'invalid' });
  });

  it('比遊戲新的存檔格式不收', () => {
    const file = JSON.stringify({ version: SAVE_VERSION + 1, savedAt: NOW, state: played() });
    expect(inspectSave(file, NOW)).toEqual({ ok: false, error: 'newer' });
  });
});

describe('摘要與檔名', () => {
  it('摘要文字跟著陣營', () => {
    const s = saveSummary(played(), NOW);
    expect(summaryText(s)).toBe(`汪國・城主 Lv.7・角色 ${s.owned} 隻・通關 2 關`);
    expect(summaryText({ ...s, faction: 'cat' }).startsWith('喵國')).toBe(true);
  });

  it('存檔時間與檔名用當地時間', () => {
    expect(savedAtText(NOW, TAIPEI)).toBe('11/19 00:30');
    expect(savedAtText(0, TAIPEI)).toBe('');
    expect(saveFileName(NOW, TAIPEI)).toBe('wangguozhi-save-20261119-0030.txt');
  });
});
