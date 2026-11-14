import { gearOf } from '../../logic/equipment';
import { woundLevel } from '../../logic/wounds';
import type { GameState } from '../../state/gameState';
import type { HeadOptions } from './dogArt';

/** 小頭像要帶的外觀（T014）：身上的頭飾，還有是不是剛出征回來、掛彩 */
export function headLook(
  state: Pick<GameState, 'equipped' | 'wounds'>,
  dogId: string,
  now: number = Date.now(),
): Pick<HeadOptions, 'gear' | 'hurt'> {
  return { gear: gearOf(state, dogId), hurt: woundLevel(state, dogId, now) };
}
