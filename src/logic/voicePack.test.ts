import { describe, expect, it } from 'vitest';
import { VOICE_PACKS, findVoicePack, voiceClip, voiceCueId, type VoicePack } from './voicePack';

const pack: VoicePack = {
  id: 'demo',
  name: '示範語音包',
  clips: { 'daer.ultimate': 'voice/daer-ult.mp3' },
};

describe('語音包掛點', () => {
  it('提示 id 是「角色.時機」', () => {
    expect(voiceCueId('daer', 'ultimate')).toBe('daer.ultimate');
  });

  it('有語音包、語音開著、有收錄這一句才回傳音檔', () => {
    expect(voiceClip(pack, true, 'daer.ultimate')).toBe('voice/daer-ult.mp3');
    expect(voiceClip(pack, false, 'daer.ultimate')).toBeNull();
    expect(voiceClip(pack, true, 'heixuan.ultimate')).toBeNull();
    expect(voiceClip(null, true, 'daer.ultimate')).toBeNull();
  });

  it('目前沒有任何語音包；找不到回傳 null', () => {
    expect(VOICE_PACKS).toHaveLength(0);
    expect(findVoicePack('demo')).toBeNull();
    expect(findVoicePack('demo', [pack])).toBe(pack);
    expect(findVoicePack(null, [pack])).toBeNull();
  });
});
