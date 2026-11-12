import Phaser from 'phaser';
import { COLORS } from '../../config';
import { findStage } from '../../data/regions';
import type { Rect } from '../../logic/layout';
import {
  RUN_PACK,
  STAMINA_MAX,
  STAMINA_PACK,
  buyRun,
  buyStamina,
  runBuysLeft,
  runsLeft,
  runsTotal,
  staminaBuysLeft,
  type BuyResult,
} from '../../logic/stamina';
import { getState, setState, tick, timeOptions } from '../../state/store';
import { addText, openModal, patchDebug } from '../ui';
import { Button } from './Button';

export type ShopKind = 'stamina' | 'runs';

/**
 * 用骨頭幣補體力／加購出征次數的小視窗（T019）。
 * 價格固定、每天有上限；買不了的時候按鈕變灰並寫出原因。
 * 買完留在視窗裡更新數字，可以連續買；關閉時呼叫 onClose。
 */
export class StaminaShop {
  private layer: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kind: ShopKind,
    /** 加購次數時是哪一關 */
    private readonly stageId: string,
    private readonly onClose: () => void,
  ) {
    this.render();
  }

  private close(): void {
    this.layer?.destroy();
    this.layer = null;
    patchDebug({ shop: null });
    this.onClose();
  }

  destroy(): void {
    this.layer?.destroy();
    this.layer = null;
    patchDebug({ shop: null });
  }

  private render(): void {
    this.layer?.destroy();
    const scene = this.scene;
    const now = Date.now();
    const o = timeOptions();
    const st = tick(now);
    const stamina = this.kind === 'stamina';
    const pack = stamina ? STAMINA_PACK : RUN_PACK;
    const left = stamina ? staminaBuysLeft(st, now, o) : runBuysLeft(st, now, o);
    const stage = findStage(this.stageId);

    const { layer, box } = openModal(scene, { width: 340, height: 300 }, () => this.close());
    this.layer = layer;
    const cx = box.x + box.width / 2;
    let y = box.y + 30;
    const line = (s: string, size: number, color: string = COLORS.ink, bold = false) => {
      layer.add(addText(scene, cx, y, s, size, color, bold).setOrigin(0.5));
      y += size + 14;
    };
    line(stamina ? '補充體力' : '加購出征次數', 24, COLORS.ink, true);
    line(
      stamina
        ? `${pack.price} 骨頭幣 換 ${pack.amount} 體力`
        : `${pack.price} 骨頭幣 換「${stage?.name ?? ''}」${pack.amount} 次`,
      18,
      '#b5651d',
      true,
    );
    line(
      stamina
        ? `目前體力 ${st.stamina.value}/${STAMINA_MAX}`
        : `這一關今天還剩 ${runsLeft(st, this.stageId, now, o)}/${runsTotal(st, this.stageId, now, o)} 次`,
      16,
      COLORS.inkSoft,
    );
    line(
      `骨頭幣 ${st.resources.bones}・今天還能買 ${left}/${pack.dailyLimit} 次`,
      16,
      COLORS.inkSoft,
    );

    const message =
      left <= 0
        ? '今天已經買到上限，明天 05:00 重置'
        : st.resources.bones < pack.price
          ? '骨頭幣不夠'
          : '';
    if (message) line(message, 15, '#b0413e', true);

    const bw = (box.width - 44 - 12) / 2;
    const by = box.y + box.height - 70;
    const cancelRect: Rect = { x: box.x + 22, y: by, width: bw, height: 52 };
    const okRect: Rect = { x: box.x + 22 + bw + 12, y: by, width: bw, height: 52 };
    const cancel = new Button(scene, cancelRect, '關閉', () => this.close(), 20);
    cancel.setColor(0x8a6f55);
    const ok = new Button(scene, okRect, '購買', () => this.buy(), 20);
    ok.setEnabled(!message);
    layer.add([cancel, ok]);

    patchDebug({
      shop: { kind: this.kind, enabled: !message, message, left, ok: okRect, cancel: cancelRect },
    });
  }

  private buy(): void {
    const now = Date.now();
    const o = timeOptions();
    const r: BuyResult =
      this.kind === 'stamina'
        ? buyStamina(getState(), now, o)
        : buyRun(getState(), this.stageId, now, o);
    if (r.ok) setState(r.state);
    this.render();
  }
}
