import { VOICE_PACKS, voiceClip, type VoicePack } from '../../logic/voicePack';
import { getState } from '../../state/store';

/** 目前使用的語音包；還沒有語音包可選，所以是「第一個，沒有就不出聲」 */
function activePack(): VoicePack | null {
  return VOICE_PACKS[0] ?? null;
}

/**
 * 播一句語音（T017 的掛點）。回傳有沒有真的播。
 * 現在沒有語音包，所以一定是 false；設定的「語音」關掉時也不播。
 */
export function playVoiceCue(cue: string): boolean {
  const clip = voiceClip(activePack(), getState().settings.voice, cue);
  if (!clip) return false;
  try {
    void new Audio(clip).play().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
