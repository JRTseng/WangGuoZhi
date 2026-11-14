/**
 * 音效的配方（T016）。每個音效由幾個小段組成，真正出聲在 src/scenes/components/audio.ts。
 * 全部是本專案原創、用程式合成，沒有音檔。
 */

export type SfxId =
  | 'tap'
  | 'hit'
  | 'crit'
  | 'heal'
  | 'ultimate'
  | 'ko'
  | 'win'
  | 'lose'
  | 'levelup'
  | 'recruit'
  | 'rare'
  | 'equip';

export type SfxWave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

export interface SfxTone {
  wave: SfxWave;
  /** 起始頻率（noise 則是濾波器的中心頻率） */
  from: number;
  /** 結束頻率；省略就不滑音 */
  to?: number;
  /** 音效開始後第幾秒發出 */
  at: number;
  /** 長度（秒） */
  dur: number;
  /** 音量（0～1） */
  gain: number;
}

const tone = (
  wave: SfxWave,
  from: number,
  to: number | undefined,
  at: number,
  dur: number,
  gain: number,
): SfxTone => ({ wave, from, to, at, dur, gain });

/** 一串往上或往下的短音 */
const run = (wave: SfxWave, freqs: number[], step: number, dur: number, gain: number): SfxTone[] =>
  freqs.map((f, i) => tone(wave, f, undefined, i * step, dur, gain));

export const SFX: Readonly<Record<SfxId, readonly SfxTone[]>> = {
  tap: [tone('sine', 700, 940, 0, 0.05, 0.22)],
  hit: [tone('noise', 1100, 500, 0, 0.09, 0.4), tone('sine', 190, 70, 0, 0.11, 0.5)],
  crit: [
    tone('noise', 1600, 600, 0, 0.12, 0.5),
    tone('sine', 220, 60, 0, 0.16, 0.6),
    tone('square', 990, 1480, 0.02, 0.12, 0.12),
  ],
  heal: [tone('sine', 523, 784, 0, 0.14, 0.3), tone('sine', 784, 1047, 0.1, 0.2, 0.28)],
  ultimate: [
    tone('sawtooth', 110, 880, 0, 0.42, 0.22),
    tone('triangle', 220, 1760, 0, 0.42, 0.2),
    tone('noise', 3200, 800, 0.38, 0.35, 0.4),
    tone('sine', 150, 50, 0.38, 0.3, 0.55),
  ],
  ko: [tone('triangle', 330, 80, 0, 0.32, 0.35)],
  win: [
    ...run('triangle', [587, 740, 880, 1175], 0.11, 0.16, 0.34),
    tone('triangle', 1175, undefined, 0.5, 0.5, 0.34),
    tone('sine', 880, undefined, 0.5, 0.5, 0.2),
    tone('sine', 587, undefined, 0.5, 0.5, 0.2),
  ],
  lose: [
    ...run('triangle', [440, 392, 330], 0.2, 0.24, 0.3),
    tone('triangle', 294, 262, 0.6, 0.6, 0.3),
  ],
  levelup: run('sine', [659, 880, 1319], 0.07, 0.14, 0.3),
  recruit: run('sine', [587, 659, 740, 880, 988], 0.05, 0.12, 0.26),
  rare: [
    ...run('sine', [587, 740, 880, 1175, 1480, 1760], 0.06, 0.16, 0.26),
    tone('triangle', 1175, undefined, 0.4, 0.5, 0.24),
    tone('sine', 1760, undefined, 0.4, 0.5, 0.14),
  ],
  equip: [tone('noise', 2600, 1800, 0, 0.035, 0.3), tone('triangle', 440, 660, 0.02, 0.09, 0.28)],
};

/** 整個音效多長（秒） */
export function sfxSeconds(id: SfxId): number {
  return Math.max(...SFX[id].map((t) => t.at + t.dur));
}

/** 同一個音效最短要隔多久才能再播（戰鬥開 4 倍速時免得疊成一團） */
export const SFX_MIN_GAP_MS = 60;

/** 距離上次播同一個音效夠久了沒 */
export function sfxAllowed(lastAt: number | undefined, now: number): boolean {
  return lastAt === undefined || now - lastAt >= SFX_MIN_GAP_MS;
}
