import Phaser from 'phaser';
import { playSfx } from './audio';

/**
 * 讓 Container 整塊 (0,0)–(w,h) 都可點。
 *
 * Phaser 判斷 Container 的點擊時，會把座標加上 displayOrigin（寬高的一半），
 * 所以直接用 Rectangle(0, 0, w, h) 只有左上 1/4 點得到。
 * 這裡把點擊範圍往右下移半個寬高，抵銷這個位移。
 * 按下去會有一聲輕輕的點按音效（T016）。
 */
export function makeTapArea(container: Phaser.GameObjects.Container, w: number, h: number): void {
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(w / 2, h / 2, w, h),
    Phaser.Geom.Rectangle.Contains,
  );
  container.input!.cursor = 'pointer';
  container.on('pointerdown', () => playSfx('tap'));
}
