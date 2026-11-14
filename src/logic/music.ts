/**
 * 背景音樂的樂譜與排程計算（T016）。全部是純函式，真正出聲在 src/scenes/components/audio.ts。
 *
 * 樂譜寫法：一個聲部是一行字串，用空白隔開每個音，`音名:拍數`。
 * - 音名像 `D4`、`F#4`、`Bb3`；休止符寫 `-`；打擊樂寫 `x`
 * - 和弦用 `+` 連起來：`D3+F#3+A3:4`
 * - 拍數省略就是 1 拍；`|` 只是給人看的小節線，會被略過
 *
 * 兩首曲子都是本專案原創，用五聲音階寫的短循環。
 */

export type TrackId = 'lobby' | 'battle';

/** 音色：撥弦、笛、低音、墊底長音、大鼓、梆子 */
export type VoiceId = 'pluck' | 'flute' | 'bass' | 'pad' | 'drum' | 'clack';

export interface TrackPart {
  voice: VoiceId;
  /** 這個聲部的音量（0～1） */
  gain: number;
  score: string;
}

export interface Track {
  id: TrackId;
  name: string;
  /** 每分鐘幾拍 */
  bpm: number;
  /** 一輪循環總共幾拍；每個聲部都要剛好這麼長 */
  beats: number;
  parts: readonly TrackPart[];
}

/** 樂譜裡的一個音（或休止符） */
export interface ScoreNote {
  /** 從第幾拍開始 */
  beat: number;
  beats: number;
  /** 頻率；休止符是空陣列，打擊樂是 [0] */
  freqs: number[];
}

/** 排進時間軸的一個聲音 */
export interface NoteEvent {
  /** 從循環開頭算起第幾秒 */
  t: number;
  /** 長度（秒） */
  dur: number;
  /** 頻率；打擊樂是 0 */
  freq: number;
  voice: VoiceId;
  gain: number;
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 音名換頻率（A4 = 440Hz）；看不懂的音名回傳 null */
export function noteFreq(name: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  const semi = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** 把一行樂譜拆成一個個音。寫錯的音名會丟出錯誤（單元測試會抓到）。 */
export function parseScore(score: string): ScoreNote[] {
  const out: ScoreNote[] = [];
  let beat = 0;
  for (const token of score.split(/\s+/)) {
    if (!token || token === '|') continue;
    const [head, len] = token.split(':');
    const beats = len === undefined ? 1 : Number(len);
    if (!(beats > 0)) throw new Error(`樂譜拍數不對：${token}`);
    let freqs: number[];
    if (head === '-') freqs = [];
    else if (head === 'x') freqs = [0];
    else {
      freqs = head.split('+').map((n) => {
        const f = noteFreq(n);
        if (f === null) throw new Error(`樂譜音名不對：${token}`);
        return f;
      });
    }
    out.push({ beat, beats, freqs });
    beat += beats;
  }
  return out;
}

/** 一行樂譜總共幾拍 */
export function scoreBeats(score: string): number {
  return parseScore(score).reduce((sum, n) => sum + n.beats, 0);
}

/** 一輪循環幾秒 */
export function trackSeconds(track: Pick<Track, 'bpm' | 'beats'>): number {
  return (track.beats * 60) / track.bpm;
}

/** 把整首曲子攤成時間軸上的聲音清單（照時間排好） */
export function trackEvents(track: Track): NoteEvent[] {
  const beatSec = 60 / track.bpm;
  const out: NoteEvent[] = [];
  for (const part of track.parts) {
    for (const n of parseScore(part.score)) {
      for (const freq of n.freqs) {
        out.push({
          t: n.beat * beatSec,
          dur: n.beats * beatSec,
          freq,
          voice: part.voice,
          // 和弦的音一多就各自小聲一點，整體音量才不會爆
          gain: part.gain / Math.sqrt(n.freqs.length),
        });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * 循環播放時，[from, to) 這段時間（從開始播算起的秒數）裡該發出哪些聲音。
 * 回傳的 t 是從開始播算起的絕對秒數，跨過循環接縫也會接上下一輪。
 */
export function eventsBetween(
  events: readonly NoteEvent[],
  loopSeconds: number,
  from: number,
  to: number,
): NoteEvent[] {
  if (!(loopSeconds > 0) || to <= from) return [];
  const out: NoteEvent[] = [];
  const start = Math.max(0, from);
  for (let k = Math.floor(start / loopSeconds); k * loopSeconds < to; k++) {
    const base = k * loopSeconds;
    for (const e of events) {
      const t = base + e.t;
      if (t >= start && t < to) out.push({ ...e, t });
    }
  }
  return out;
}

const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join(' ');

/** 戰鬥曲的低音：一小節八個八分音符，根音為主、第三與第七個換成五度 */
const drive = (root: string, fifth: string) =>
  [root, root, fifth, root, root, root, fifth, root].map((n) => `${n}:0.5`).join(' ');

/** 主頁：〈城裡的午後〉，D 宮五聲，慢板，撥弦主旋律，後半段加笛聲 */
const LOBBY: Track = {
  id: 'lobby',
  name: '城裡的午後',
  bpm: 84,
  beats: 64,
  parts: [
    {
      voice: 'pluck',
      gain: 0.5,
      score: `
        F#4 A4 B4:1.5 A4:0.5 | F#4 E4 D4:2 | E4 F#4 A4:1.5 F#4:0.5 | E4:3 -
        F#4 A4 B4:1.5 D5:0.5 | B4 A4 F#4:2 | E4 D4 B3 D4 | D4:3 -
        D5:1.5 B4:0.5 A4 B4 | D5 E5 D5:2 | B4:1.5 A4:0.5 F#4 A4 | B4:3 -
        A4 B4:0.5 A4:0.5 F#4 E4 | D4 E4 F#4:2 | E4 F#4:0.5 E4:0.5 D4 B3 | D4:4`,
    },
    {
      voice: 'flute',
      gain: 0.16,
      score: `-:32
        F#5:4 | A5:2 F#5:2 | E5:4 | D5:3 -
        F#5:2 E5:2 | D5:4 | B4:2 A4:2 | A4:4`,
    },
    {
      voice: 'bass',
      gain: 0.42,
      score: `
        D2:2 A2:2 | B2:2 F#2:2 | G2:2 D3:2 | A2:2 E2:2
        D2:2 A2:2 | B2:2 F#2:2 | G2:2 A2:2 | D2:2 A2 D2
        G2:2 D3:2 | D2:2 A2:2 | B2:2 F#2:2 | G2:2 A2:2
        D2:2 A2:2 | B2:2 F#2:2 | G2:2 A2:2 | D2:4`,
    },
    {
      voice: 'pad',
      gain: 0.2,
      score: `
        D3+F#3+A3:4 | B2+D3+F#3:4 | G3+B3+D4:4 | A3+C#4+E4:4
        D3+F#3+A3:4 | B2+D3+F#3:4 | G3+B3+D4:2 A3+C#4+E4:2 | D3+F#3+A3:4
        G3+B3+D4:4 | D3+F#3+A3:4 | B2+D3+F#3:4 | G3+B3+D4:2 A3+C#4+E4:2
        D3+F#3+A3:4 | B2+D3+F#3:4 | G3+B3+D4:2 A3+C#4+E4:2 | D3+F#3+A3:4`,
    },
  ],
};

/** 戰鬥：〈陣前鼓〉，A 羽五聲，快板，撥弦短句配大鼓與梆子 */
const BATTLE: Track = {
  id: 'battle',
  name: '陣前鼓',
  bpm: 150,
  beats: 64,
  parts: [
    {
      voice: 'pluck',
      gain: 0.44,
      score: `
        A4:0.5 A4:0.5 C5:0.5 A4:0.5 E5 D5 | C5:0.5 D5:0.5 C5:0.5 A4:0.5 G4 A4
        A4:0.5 A4:0.5 C5:0.5 A4:0.5 E5 G5 | E5:0.5 D5:0.5 C5:0.5 D5:0.5 E5:2
        G5 E5:0.5 D5:0.5 C5 D5 | E5:0.5 D5:0.5 C5:0.5 A4:0.5 G4 A4
        C5:0.5 D5:0.5 E5:0.5 G5:0.5 A5 G5:0.5 E5:0.5 | A4:2 -:0.5 E4:0.5 G4:0.5 A4:0.5
        D5 D5:0.5 E5:0.5 G5 E5 | D5:0.5 C5:0.5 D5:0.5 E5:0.5 C5 A4
        D5 D5:0.5 E5:0.5 G5 A5 | G5:0.5 E5:0.5 D5:0.5 E5:0.5 G5:2
        A5 G5:0.5 E5:0.5 D5 C5 | D5:0.5 E5:0.5 D5:0.5 C5:0.5 A4 G4
        A4:0.5 C5:0.5 D5:0.5 E5:0.5 G5:0.5 E5:0.5 D5:0.5 C5:0.5 | A4:3 -`,
    },
    {
      voice: 'bass',
      gain: 0.4,
      score: [
        rep(drive('A2', 'E3'), 4),
        drive('F2', 'C3'),
        drive('G2', 'D3'),
        rep(drive('A2', 'E3'), 2),
        rep(drive('D2', 'A2'), 3),
        drive('E2', 'B2'),
        drive('F2', 'C3'),
        drive('G2', 'D3'),
        rep(drive('A2', 'E3'), 2),
      ].join(' '),
    },
    { voice: 'drum', gain: 0.6, score: rep('x -:0.5 x:0.5 x x:0.5 x:0.5', 16) },
    { voice: 'clack', gain: 0.16, score: rep('-:0.5 x:0.5', 64) },
  ],
};

export const TRACKS: Readonly<Record<TrackId, Track>> = { lobby: LOBBY, battle: BATTLE };

/** 這個畫面播哪一首：戰鬥畫面播戰鬥曲，其他都播主頁那首；開機畫面不播 */
export function musicForScene(sceneKey: string): TrackId | null {
  if (sceneKey === 'BootScene') return null;
  return sceneKey === 'BattleScene' ? 'battle' : 'lobby';
}
