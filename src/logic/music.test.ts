import { describe, expect, it } from 'vitest';
import {
  TRACKS,
  eventsBetween,
  musicForScene,
  noteFreq,
  parseScore,
  scoreBeats,
  trackEvents,
  trackSeconds,
  type NoteEvent,
} from './music';

describe('noteFreq', () => {
  it('A4 是 440Hz，高八度加倍', () => {
    expect(noteFreq('A4')).toBeCloseTo(440);
    expect(noteFreq('A5')).toBeCloseTo(880);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
  });

  it('升降記號', () => {
    expect(noteFreq('F#4')).toBeCloseTo(369.99, 1);
    expect(noteFreq('Bb3')).toBeCloseTo(noteFreq('A#3')!);
  });

  it('看不懂的音名回傳 null', () => {
    expect(noteFreq('H4')).toBeNull();
    expect(noteFreq('A')).toBeNull();
  });
});

describe('parseScore', () => {
  it('音、休止符、打擊樂、和弦與小節線', () => {
    const notes = parseScore('D4 | -:0.5 x:0.5 D3+A3:2');
    expect(notes.map((n) => [n.beat, n.beats, n.freqs.length])).toEqual([
      [0, 1, 1],
      [1, 0.5, 0],
      [1.5, 0.5, 1],
      [2, 2, 2],
    ]);
    expect(notes[2].freqs).toEqual([0]);
    expect(scoreBeats('D4 | -:0.5 x:0.5 D3+A3:2')).toBe(4);
  });

  it('寫錯就丟錯誤', () => {
    expect(() => parseScore('Z9')).toThrow();
    expect(() => parseScore('D4:0')).toThrow();
  });
});

describe('兩首曲子', () => {
  for (const track of Object.values(TRACKS)) {
    it(`〈${track.name}〉每個聲部都剛好 ${track.beats} 拍`, () => {
      for (const part of track.parts) {
        expect(scoreBeats(part.score), part.voice).toBeCloseTo(track.beats);
      }
    });

    it(`〈${track.name}〉攤開後照時間排好，都落在一輪之內`, () => {
      const events = trackEvents(track);
      const loop = trackSeconds(track);
      expect(events.length).toBeGreaterThan(50);
      events.forEach((e, i) => {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t).toBeLessThan(loop);
        expect(e.gain).toBeGreaterThan(0);
        expect(e.gain).toBeLessThanOrEqual(1);
        if (i > 0) expect(e.t).toBeGreaterThanOrEqual(events[i - 1].t);
      });
    });
  }

  it('循環長度：短到不佔記憶體，長到不會一直聽到重複', () => {
    expect(trackSeconds(TRACKS.lobby)).toBeCloseTo(45.71, 1);
    expect(trackSeconds(TRACKS.battle)).toBeCloseTo(25.6, 1);
  });

  it('和弦的音各自小聲一點', () => {
    const pad = trackEvents(TRACKS.lobby).filter((e) => e.voice === 'pad');
    const part = TRACKS.lobby.parts.find((p) => p.voice === 'pad')!;
    expect(pad[0].gain).toBeCloseTo(part.gain / Math.sqrt(3));
  });
});

describe('eventsBetween', () => {
  const ev = (t: number): NoteEvent => ({ t, dur: 0.1, freq: 440, voice: 'pluck', gain: 0.5 });
  const events = [ev(0), ev(1), ev(3)];

  it('只取這段時間內的音，含頭不含尾', () => {
    expect(eventsBetween(events, 4, 0, 1).map((e) => e.t)).toEqual([0]);
    expect(eventsBetween(events, 4, 1, 3).map((e) => e.t)).toEqual([1]);
  });

  it('跨過循環接縫會接上下一輪', () => {
    expect(eventsBetween(events, 4, 2.5, 5.5).map((e) => e.t)).toEqual([3, 4, 5]);
    expect(eventsBetween(events, 4, 8, 9).map((e) => e.t)).toEqual([8]);
  });

  it('一段一段接著排，每個音剛好排到一次', () => {
    const got: number[] = [];
    for (let from = 0; from < 12; from += 0.25) {
      got.push(...eventsBetween(events, 4, from, from + 0.25).map((e) => e.t));
    }
    expect(got).toEqual([0, 1, 3, 4, 5, 7, 8, 9, 11]);
  });

  it('空的區間或不合理的長度回傳空陣列', () => {
    expect(eventsBetween(events, 4, 2, 2)).toEqual([]);
    expect(eventsBetween(events, 0, 0, 5)).toEqual([]);
  });
});

describe('musicForScene', () => {
  it('戰鬥畫面播戰鬥曲，其他畫面播主頁那首，開機畫面不播', () => {
    expect(musicForScene('BattleScene')).toBe('battle');
    expect(musicForScene('LobbyScene')).toBe('lobby');
    expect(musicForScene('CampaignScene')).toBe('lobby');
    expect(musicForScene('BootScene')).toBeNull();
  });
});
