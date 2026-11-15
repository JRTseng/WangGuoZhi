import Phaser from 'phaser';
import { MIN_TAP, tapPad } from '../../logic/layout';
import { playSfx } from './audio';

/**
 * 讓 Container 整塊 (0,0)–(w,h) 都可點。
 *
 * Phaser 判斷 Container 的點擊時，會把座標加上 displayOrigin（寬高的一半），
 * 所以直接用 Rectangle(0, 0, w, h) 只有左上 1/4 點得到。
 * 這裡把點擊範圍往右下移半個寬高，抵銷這個位移。
 * 按下去會有一聲輕輕的點按音效（T016）。
 * 畫得比 44 小的按鈕，可點範圍會以中心往外補到 44（T008），手指比較好按。
 */
export function makeTapArea(
  container: Phaser.GameObjects.Container,
  w: number,
  h: number,
  /** 可點範圍最少這麼大（T008）；緊貼著排的列表傳 0，免得搶到隔壁的點擊 */
  min: number = MIN_TAP,
): void {
  const px = tapPad(w, min);
  const py = tapPad(h, min);
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(w / 2 - px, h / 2 - py, w + px * 2, h + py * 2),
    Phaser.Geom.Rectangle.Contains,
  );
  container.input!.cursor = 'pointer';
  container.on('pointerdown', () => playSfx('tap'));
}
