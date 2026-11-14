import {
  TRACKS,
  eventsBetween,
  trackEvents,
  trackSeconds,
  type NoteEvent,
  type TrackId,
} from '../../logic/music';
import { SFX, sfxAllowed, sfxSeconds, type SfxId, type SfxTone } from '../../logic/sfx';
import { getState } from '../../state/store';

/**
 * 背景音樂與音效（T016）：全部用 Web Audio 當場合成，沒有音檔。
 *
 * - 瀏覽器規定要先有操作才能出聲，所以第一次點畫面（或按鍵）時才建立 AudioContext。
 * - 音樂：每 50 毫秒把接下來 0.25 秒該響的音排進去；換曲時舊的淡出、新的接上。
 * - 每次排程都讀一次設定，所以「音樂」「音效」開關一切就生效。
 * - 切到別的分頁或鎖螢幕時暫停。
 */

const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.7;
/** 一次往後排多久的音（秒）；比排程間隔長很多，分頁被放慢時才不會斷 */
const LOOKAHEAD = 0.25;
const PUMP_MS = 50;

interface Playing {
  id: TrackId;
  bus: GainNode;
  /** 這首從 AudioContext 的第幾秒開始算 */
  startAt: number;
  /** 已經排到第幾秒（從 startAt 算起） */
  until: number;
  events: NoteEvent[];
  loop: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let wanted: TrackId | null = null;
let playing: Playing | null = null;
let unlocked = false;
let started = false;
let sfxCount = 0;
let lastSfxId: SfxId | null = null;
const lastSfxAt = new Map<SfxId, number>();
const eventCache = new Map<TrackId, NoteEvent[]>();

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    // 壓一下最大音量，好幾個聲音疊在一起時才不會破音
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(limiter).connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

function unlock(): void {
  const c = ensureContext();
  if (!c) return;
  unlocked = true;
  if (c.state === 'suspended' && !document.hidden) void c.resume().catch(() => undefined);
  pump();
}

/** 開機時呼叫一次：掛上「第一次操作才出聲」與分頁切換的處理，並開始排程 */
export function initAudio(): void {
  if (started) return;
  started = true;
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) {
    window.addEventListener(ev, unlock, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  });
  window.setInterval(pump, PUMP_MS);
}

/** 指定現在該播哪一首（null 是不播）；真的換曲在下一次排程 */
export function setMusic(track: TrackId | null): void {
  wanted = track;
  pump();
}

/** 測試與除錯用：現在想播哪首、實際在播哪首、播過幾個音效 */
export function audioDebug(): NonNullable<WgzDebugState['audio']> {
  return {
    wanted,
    playing: playing?.id ?? null,
    unlocked,
    running: ctx?.state === 'running',
    sfxCount,
    lastSfx: lastSfxId,
  };
}

function publish(): void {
  if (window.__WGZ__) window.__WGZ__.audio = audioDebug();
}

function stopPlaying(): void {
  if (!playing || !ctx) return;
  const { bus } = playing;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  window.setTimeout(() => bus.disconnect(), 900);
  playing = null;
}

function startTrack(id: TrackId): void {
  if (!ctx || !master) return;
  const track = TRACKS[id];
  let events = eventCache.get(id);
  if (!events) {
    events = trackEvents(track);
    eventCache.set(id, events);
  }
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(MUSIC_VOLUME, ctx.currentTime, 0.15);
  bus.connect(master);
  playing = {
    id,
    bus,
    startAt: ctx.currentTime + 0.2,
    until: 0,
    events,
    loop: trackSeconds(track),
  };
}

function pump(): void {
  if (ctx && ctx.state === 'running') {
    const want = getState().settings.music ? wanted : null;
    if (playing && playing.id !== want) stopPlaying();
    if (!playing && want) startTrack(want);
    if (playing) {
      const pos = ctx.currentTime - playing.startAt;
      // 分頁被放慢、排程落後時，過去的音就不補了
      const from = Math.max(playing.until, pos);
      const to = pos + LOOKAHEAD;
      for (const e of eventsBetween(playing.events, playing.loop, from, to)) {
        playNote(ctx, e, playing.startAt + e.t, playing.bus);
      }
      playing.until = Math.max(playing.until, to);
    }
  }
  publish();
}

/** 音量包絡：很快升到 peak，維持到 hold，再用 release 秒收掉 */
function envelope(
  c: AudioContext,
  dest: AudioNode,
  at: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + Math.max(attack, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack, hold) + release);
  g.connect(dest);
  return g;
}

function osc(
  c: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  at: number,
  stop: number,
  detune = 0,
): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.detune.value = detune;
  o.connect(dest);
  o.start(at);
  o.stop(stop);
  return o;
}

function noiseBurst(
  c: AudioContext,
  dest: AudioNode,
  filterType: BiquadFilterType,
  from: number,
  to: number,
  at: number,
  dur: number,
): void {
  if (!noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, at);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + dur);
  src.connect(f).connect(dest);
  src.start(at);
  src.stop(at + dur + 0.02);
}

function playNote(c: AudioContext, e: NoteEvent, at: number, dest: AudioNode): void {
  switch (e.voice) {
    case 'pluck': {
      // 撥弦：一下就到最大聲，然後慢慢消掉
      const ring = Math.min(1.6, Math.max(0.45, e.dur * 1.5));
      const g = envelope(c, dest, at, e.gain, 0.004, 0.004, ring);
      osc(c, g, 'triangle', e.freq, at, at + ring + 0.05);
      const g2 = envelope(c, dest, at, e.gain * 0.25, 0.004, 0.004, ring * 0.5);
      osc(c, g2, 'sine', e.freq * 2, at, at + ring * 0.5 + 0.05);
      break;
    }
    case 'flute': {
      const g = envelope(c, dest, at, e.gain, 0.09, e.dur * 0.85, 0.3);
      const o = osc(c, g, 'sine', e.freq, at, at + e.dur + 0.4);
      // 一點點抖音
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = 5;
      depth.gain.value = e.freq * 0.006;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(at);
      lfo.stop(at + e.dur + 0.4);
      break;
    }
    case 'bass': {
      const g = envelope(c, dest, at, e.gain, 0.012, e.dur * 0.6, Math.min(0.5, e.dur * 0.5));
      osc(c, g, 'triangle', e.freq, at, at + e.dur * 1.2 + 0.1);
      osc(c, g, 'sine', e.freq, at, at + e.dur * 1.2 + 0.1);
      break;
    }
    case 'pad': {
      const g = envelope(c, dest, at, e.gain * 0.5, 0.4, e.dur, 0.7);
      osc(c, g, 'sine', e.freq, at, at + e.dur + 0.8, -5);
      osc(c, g, 'sine', e.freq, at, at + e.dur + 0.8, 5);
      break;
    }
    case 'drum': {
      const g = envelope(c, dest, at, e.gain, 0.003, 0.003, 0.22);
      const o = osc(c, g, 'sine', 130, at, at + 0.26);
      o.frequency.exponentialRampToValueAtTime(48, at + 0.2);
      const g2 = envelope(c, dest, at, e.gain * 0.35, 0.002, 0.002, 0.05);
      noiseBurst(c, g2, 'lowpass', 500, 200, at, 0.05);
      break;
    }
    case 'clack': {
      const g = envelope(c, dest, at, e.gain, 0.002, 0.002, 0.04);
      noiseBurst(c, g, 'bandpass', 2600, 2600, at, 0.04);
      break;
    }
  }
}

function playTone(c: AudioContext, t: SfxTone, base: number, dest: AudioNode): void {
  const at = base + t.at;
  const g = envelope(c, dest, at, t.gain, 0.004, t.dur * 0.3, t.dur * 0.7);
  if (t.wave === 'noise') {
    noiseBurst(c, g, 'bandpass', t.from, t.to ?? t.from, at, t.dur);
    return;
  }
  const o = osc(c, g, t.wave, t.from, at, at + t.dur + 0.03);
  if (t.to !== undefined && t.to !== t.from) {
    o.frequency.exponentialRampToValueAtTime(t.to, at + t.dur);
  }
}

/** 勝利、落敗的短樂句響的時候，背景音樂先小聲一下 */
const DUCKING: readonly SfxId[] = ['win', 'lose', 'rare'];

/**
 * 播一個音效。設定把「音效」關掉、還沒有操作過（瀏覽器不讓出聲）、
 * 或同一個音效剛剛才播過，就不播。回傳有沒有真的播。
 */
export function playSfx(id: SfxId): boolean {
  if (!getState().settings.sfx) return false;
  const now = performance.now();
  if (!sfxAllowed(lastSfxAt.get(id), now)) return false;
  lastSfxAt.set(id, now);
  sfxCount += 1;
  lastSfxId = id;
  publish();
  if (!ctx || !master || ctx.state !== 'running') return false;
  const bus = ctx.createGain();
  bus.gain.value = SFX_VOLUME;
  bus.connect(master);
  const base = ctx.currentTime + 0.005;
  for (const t of SFX[id]) playTone(ctx, t, base, bus);
  const seconds = sfxSeconds(id);
  window.setTimeout(() => bus.disconnect(), (seconds + 0.5) * 1000);
  if (playing && DUCKING.includes(id)) {
    const g = playing.bus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(MUSIC_VOLUME * 0.3, ctx.currentTime, 0.05);
    g.setTargetAtTime(MUSIC_VOLUME, ctx.currentTime + seconds + 0.2, 0.3);
  }
  return true;
}
