/**
 * 語音包的掛點（T017 先留位置，語音之後另外設計）。
 *
 * 做法：畫面在該出聲的時間點算出一個「提示 id」（例如大耳放大絕招是 `daer.ultimate`），
 * 再問目前的語音包有沒有對應的音檔。現在沒有任何語音包，所以一律回傳 null、不出聲；
 * 之後做語音包只要在 VOICE_PACKS 加資料並讓玩家選一個，戰鬥畫面不用改。
 * 這裡是純函式，真正播放聲音在 src/scenes/components/voice.ts。
 */

/** 會出聲的時機；之後可以再加（例如 'win'、'hurt'） */
export type VoiceMoment = 'ultimate';

export interface VoicePack {
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 提示 id → 音檔網址 */
  clips: Readonly<Record<string, string>>;
}

/** 已收錄的語音包；目前沒有 */
export const VOICE_PACKS: readonly VoicePack[] = [];

/** 某隻角色在某個時機的提示 id */
export function voiceCueId(unitId: string, moment: VoiceMoment): string {
  return `${unitId}.${moment}`;
}

export function findVoicePack(
  id: string | null | undefined,
  packs: readonly VoicePack[] = VOICE_PACKS,
): VoicePack | null {
  return packs.find((p) => p.id === id) ?? null;
}

/**
 * 這個提示要播哪個音檔；不該出聲時回傳 null
 * （設定把語音關掉、沒有選語音包、語音包沒收錄這一句）。
 */
export function voiceClip(pack: VoicePack | null, enabled: boolean, cue: string): string | null {
  if (!enabled || !pack) return null;
  return pack.clips[cue] ?? null;
}
