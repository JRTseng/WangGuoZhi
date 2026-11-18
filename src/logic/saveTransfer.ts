import type { GameState } from '../state/gameState';
import { playerFaction } from './faction';
import { SAVE_VERSION, deserialize } from './save';

/**
 * 存檔搬家（T037）：把 T006 的存檔 JSON 變成一串可以複製貼上的「存檔碼」，再變回來。
 * 這裡只負責「字串 ↔ 字串」與檢查；讀寫 localStorage 在 src/state/store.ts，視窗在
 * src/scenes/components/SaveTransfer.ts。
 *
 * 格式：`WGZ1.<z 或 r>.<內容>.<檢查碼>`
 * - z：內容壓縮過（deflate-raw）；r：沒壓縮（環境沒有壓縮功能時）
 * - 內容：base64url（只有英數與 - _，貼到哪裡都不會被改掉）
 * - 檢查碼：內容位元組的 FNV-1a，8 個十六進位字；少複製一截或被改過就對不上
 */

export const CODE_PREFIX = 'WGZ1';
/** 讀取別的進度之前，現在這份先備份到這個 localStorage 鍵 */
export const SAVE_IMPORT_BACKUP_KEY = 'wgz-save-before-import';

export type TransferError =
  /** 什麼都沒貼 */
  | 'empty'
  /** 不是存檔碼 */
  | 'format'
  /** 是存檔碼但少了一截或被改過 */
  | 'damaged'
  /** 這個瀏覽器解不開壓縮 */
  | 'unsupported'
  /** 解開了但不是遊戲的存檔 */
  | 'invalid'
  /** 存檔比遊戲新，要先更新遊戲 */
  | 'newer';

export const TRANSFER_ERROR_TEXT: Record<TransferError, string> = {
  empty: '請先把存檔碼貼在上面的框框裡。',
  format: '這不是存檔碼。存檔碼是 WGZ1 開頭的一長串英文與數字。',
  damaged: '存檔碼不完整，可能少複製了一截。請回去重新複製整串。',
  unsupported: '這個瀏覽器太舊，讀不了這串存檔碼。請更新瀏覽器再試。',
  invalid: '存檔碼的內容讀不懂，沒有動到現在的進度。',
  newer: '這份進度是比較新版的遊戲存的。請先把這邊的遊戲更新到最新版再讀取。',
};

export type Codec = (bytes: Uint8Array) => Promise<Uint8Array>;

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** 環境內建的壓縮；沒有（很舊的瀏覽器）回傳 null */
export function nativeDeflate(): Codec | null {
  if (typeof CompressionStream === 'undefined') return null;
  return (bytes) => pipe(bytes, new CompressionStream('deflate-raw'));
}

export function nativeInflate(): Codec | null {
  if (typeof DecompressionStream === 'undefined') return null;
  return (bytes) => pipe(bytes, new DecompressionStream('deflate-raw'));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64[c & 63];
  }
  return out;
}

/** 有不認得的字或長度不對回傳 null */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let n = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** FNV-1a 32 位元，轉成 8 個十六進位字 */
export function checksum(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** 存檔 JSON → 存檔碼。deflate 給 null 就不壓縮 */
export async function encodeSaveCode(
  json: string,
  deflate: Codec | null = nativeDeflate(),
): Promise<string> {
  const raw: Uint8Array = new TextEncoder().encode(json);
  let mode = 'r';
  let bytes = raw;
  if (deflate) {
    try {
      const packed = await deflate(raw);
      // 壓了沒有變小（存檔很小的時候）就不用壓
      if (packed.length < raw.length) {
        bytes = packed;
        mode = 'z';
      }
    } catch {
      // 壓縮失敗就照沒壓縮的給
    }
  }
  return `${CODE_PREFIX}.${mode}.${toBase64Url(bytes)}.${checksum(bytes)}`;
}

export type DecodeResult = { ok: true; json: string } | { ok: false; error: TransferError };

/** 存檔碼 → 存檔 JSON。只管格式與檢查碼，內容是不是遊戲存檔交給 inspectSave */
export async function decodeSaveCode(
  code: string,
  inflate: Codec | null = nativeInflate(),
): Promise<DecodeResult> {
  // 通訊軟體會自動斷行、前後多空白，全部拿掉
  const text = code.replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'empty' };
  const parts = text.split('.');
  if (parts[0] !== CODE_PREFIX) return { ok: false, error: 'format' };
  if (parts.length !== 4 || (parts[1] !== 'z' && parts[1] !== 'r')) {
    return { ok: false, error: 'damaged' };
  }
  const bytes = fromBase64Url(parts[2]);
  if (!bytes || bytes.length === 0 || checksum(bytes) !== parts[3].toLowerCase()) {
    return { ok: false, error: 'damaged' };
  }
  let raw = bytes;
  if (parts[1] === 'z') {
    if (!inflate) return { ok: false, error: 'unsupported' };
    try {
      raw = await inflate(bytes);
    } catch {
      return { ok: false, error: 'damaged' };
    }
  }
  try {
    return { ok: true, json: new TextDecoder('utf-8', { fatal: true }).decode(raw) };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

/** 一份進度的摘要：讀取前給玩家看一眼，免得貼錯 */
export interface SaveSummary {
  faction: 'dog' | 'cat';
  lordLevel: number;
  /** 有幾隻角色 */
  owned: number;
  /** 通過幾關 */
  cleared: number;
  /** 存檔時間（毫秒時間戳）；不知道是 0 */
  savedAt: number;
}

export function saveSummary(state: GameState, savedAt: number): SaveSummary {
  return {
    faction: playerFaction(state),
    lordLevel: state.lord.level,
    owned: state.owned.length,
    cleared: state.cleared.length,
    savedAt,
  };
}

/** 例：「喵國・城主 Lv.12・角色 34 隻・通關 21 關」 */
export function summaryText(s: SaveSummary): string {
  const unit = s.faction === 'cat' ? '喵國' : '汪國';
  return `${unit}・城主 Lv.${s.lordLevel}・角色 ${s.owned} 隻・通關 ${s.cleared} 關`;
}

/** 例：「11/19 00:30」；tzOffsetMin 與 Date.getTimezoneOffset() 同方向（台北是 -480） */
export function savedAtText(savedAt: number, tzOffsetMin: number): string {
  if (!savedAt) return '';
  const d = new Date(savedAt - tzOffsetMin * 60_000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export type InspectResult =
  { ok: true; state: GameState; summary: SaveSummary } | { ok: false; error: TransferError };

/** 檢查解出來的 JSON 是不是讀得進來的存檔；讀得進來就回傳整理好的狀態與摘要 */
export function inspectSave(json: string, now: number): InspectResult {
  let file: unknown;
  try {
    file = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (typeof file !== 'object' || file === null || Array.isArray(file)) {
    return { ok: false, error: 'invalid' };
  }
  const f = file as { version?: unknown; savedAt?: unknown };
  if (typeof f.version === 'number' && Math.floor(f.version) > SAVE_VERSION) {
    return { ok: false, error: 'newer' };
  }
  const r = deserialize(json, now);
  if (r.status !== 'ok') return { ok: false, error: 'invalid' };
  const savedAt = typeof f.savedAt === 'number' && Number.isFinite(f.savedAt) ? f.savedAt : 0;
  return { ok: true, state: r.state, summary: saveSummary(r.state, savedAt) };
}

/** 存成檔案時的檔名，例：「wangguozhi-save-20261119-0030.txt」 */
export function saveFileName(now: number, tzOffsetMin: number): string {
  const d = new Date(now - tzOffsetMin * 60_000);
  const p = (n: number): string => String(n).padStart(2, '0');
  const day = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  return `wangguozhi-save-${day}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}.txt`;
}
