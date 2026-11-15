import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { ULT_POSES, ULT_POSE_NAMES, ultPoseOf } from './ultPose';

describe('大絕招的專屬姿勢', () => {
  it('30 隻狗都有指定姿勢，動作加角度的組合每隻都不一樣', () => {
    const seen = new Set<string>();
    for (const d of DOGS) {
      const p = ultPoseOf(d.id);
      expect(ULT_POSES).toContain(p.pose);
      seen.add(`${p.pose}/${p.lean}`);
    }
    expect(seen.size).toBe(DOGS.length);
  });

  it('每種動作都有狗在用，也都有名字', () => {
    const used = new Set(DOGS.map((d) => ultPoseOf(d.id).pose));
    for (const p of ULT_POSES) {
      expect(used.has(p)).toBe(true);
      expect(ULT_POSE_NAMES[p]).toBeTruthy();
    }
  });

  it('敵人沒有自己的姿勢：頭目長嚎，其他撲擊', () => {
    expect(ultPoseOf('enemy-1', '頭目')).toEqual({ pose: 'howl', lean: 0 });
    expect(ultPoseOf('enemy-2', '突擊')).toEqual({ pose: 'pounce', lean: 0 });
  });
});
