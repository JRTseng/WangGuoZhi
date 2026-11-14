import Phaser from 'phaser';
import { COLORS } from '../../config';
import { REDEEM_ERROR_TEXT, redeemCode } from '../../logic/promo';
import type { Rect } from '../../logic/layout';
import type { Quality, Settings } from '../../state/gameState';
import { getState, resetSave, setState } from '../../state/store';
import { addText, openModal, patchDebug, viewOf } from '../ui';
import { makeTapArea } from './hitArea';

/** 官方連結（目前先指向 GitHub 專案頁與 Issues） */
export const OFFICIAL_URL = 'https://github.com/JRTseng/WangGuoZhi';
export const FORUM_URL = 'https://github.com/JRTseng/WangGuoZhi/issues';

const QUALITY_LABEL: Record<Quality, string> = { low: '低', medium: '中', high: '高' };

type ToggleKey = 'voice' | 'music' | 'sfx' | 'push' | 'skipBattle';
type Key = ToggleKey | Quality | 'site' | 'forum' | 'redeem' | 'reset' | 'close';

/**
 * 左上角「帳號與設定」面板：語音、音樂、音效、推播、略過戰鬥畫面開關，畫質，官方連結、討論區、優惠碼。
 * 音樂與音效的開關一切就生效（T016）；語音／推播目前只記住開關，還沒有實際功能。畫質會影響場景裡會動的東西。
 * 直式單欄、橫式左右兩欄。
 */
export class SettingsPanel {
  private layer!: Phaser.GameObjects.Container;
  private input: Phaser.GameObjects.DOMElement | null = null;
  private message = '';
  private messageOk = true;
  /** 「重新開始」按過一次、等第二次確認 */
  private resetArmed = false;
  private readonly rects: Partial<Record<Key, Rect>> = {};

  constructor(
    private readonly scene: Phaser.Scene,
    /** 設定或資源有變（例如畫質、兌換）時通知主頁重畫 */
    private readonly onChange: (qualityChanged: boolean) => void,
    private readonly onClose: () => void,
  ) {
    this.render();
  }

  destroy(): void {
    this.input?.destroy();
    this.input = null;
    this.layer.destroy();
    patchDebug({ settings: undefined });
  }

  private render(): void {
    const keepText = (this.input?.node as HTMLInputElement | undefined)?.value ?? '';
    this.input?.destroy();
    this.layer?.destroy();
    const { landscape } = viewOf(this.scene);
    const { layer, box } = openModal(
      this.scene,
      landscape ? { width: 640, height: 366 } : { width: 358, height: 640 },
      () => this.onClose(),
    );
    this.layer = layer;
    const s = getState().settings;
    const pad = 18;

    layer.add(addText(this.scene, box.x + pad, box.y + 14, '帳號與設定', 22, COLORS.ink, true));
    layer.add(
      addText(
        this.scene,
        box.x + pad,
        box.y + 44,
        '城主 ID：WGZ-000001（尚未綁定帳號）',
        13,
        COLORS.inkSoft,
      ),
    );

    // 欄位：直式一欄，橫式兩欄
    const colW = landscape ? (box.width - pad * 3) / 2 : box.width - pad * 2;
    const leftX = box.x + pad;
    const rightX = landscape ? leftX + colW + pad : leftX;
    let y = box.y + 72;
    const rowH = landscape ? 34 : 46;

    const toggles: [ToggleKey, string][] = [
      ['voice', '語音'],
      ['music', '音樂'],
      ['sfx', '音效'],
      ['push', '推播通知'],
      ['skipBattle', '略過戰鬥畫面'],
    ];
    for (const [key, label] of toggles) {
      this.toggleRow(leftX, y, colW, rowH, label, key, s);
      y += rowH;
    }

    layer.add(addText(this.scene, leftX, y + 8, '遊戲畫質', 17, COLORS.ink, true));
    y += 36;
    const qs: Quality[] = ['low', 'medium', 'high'];
    const segW = (colW - 16) / 3;
    qs.forEach((q, i) => {
      const r = { x: leftX + i * (segW + 8), y, width: segW, height: 40 };
      this.pill(
        r,
        QUALITY_LABEL[q],
        s.quality === q ? COLORS.button : 0xe9dcc8,
        s.quality === q,
        q,
        () => {
          this.update({ quality: q }, true);
        },
      );
    });
    y += 48;
    layer.add(
      addText(this.scene, leftX, y, '低畫質會關掉落葉、雪花等特效，比較省電', 12, COLORS.inkSoft),
    );

    // 右欄（橫式）／接續（直式）
    let ry = landscape ? box.y + 72 : y + 30;
    const half = (colW - 10) / 2;
    this.pill(
      { x: rightX, y: ry, width: half, height: 44 },
      '官方網站',
      0x4f6d8a,
      true,
      'site',
      () => window.open(OFFICIAL_URL, '_blank', 'noopener'),
    );
    this.pill(
      { x: rightX + half + 10, y: ry, width: half, height: 44 },
      '討論區',
      0x4f6d8a,
      true,
      'forum',
      () => window.open(FORUM_URL, '_blank', 'noopener'),
    );
    ry += 60;

    layer.add(addText(this.scene, rightX, ry, '優惠碼', 17, COLORS.ink, true));
    ry += 28;
    const inputW = colW - 96;
    const inputRect = { x: rightX, y: ry, width: inputW, height: 44 };
    this.input = this.scene.add
      .dom(rightX + inputW / 2, ry + 22, 'input', {
        width: `${inputW - 12}px`,
        height: '36px',
        fontSize: '18px',
        padding: '0 6px',
        border: '2px solid #d8c3a5',
        borderRadius: '10px',
        background: '#ffffff',
        color: '#3b2a1a',
        outline: 'none',
      })
      .setDepth(101);
    const el = this.input.node as HTMLInputElement;
    el.placeholder = '輸入優惠碼';
    el.value = keepText;
    el.setAttribute('aria-label', '優惠碼');
    this.pill(
      { x: rightX + inputW + 8, y: ry, width: 88, height: 44 },
      '兌換',
      COLORS.harvest,
      true,
      'redeem',
      () => this.redeem(),
    );
    ry += 52;
    const msg = addText(
      this.scene,
      rightX,
      ry,
      this.message,
      14,
      this.messageOk ? '#4f8a3c' : '#c0392b',
      true,
    );
    msg.setWordWrapWidth(colW);
    layer.add(msg);
    ry += 40;

    const closeY = landscape ? box.y + box.height - 58 : box.y + box.height - 62;
    // 最下面一列：左邊「重新開始」（要按兩次才會清除存檔），右邊「關閉」
    const lastY = Math.max(ry, closeY);
    const resetW = Math.floor((colW - 10) * 0.46);
    this.pill(
      { x: rightX, y: lastY, width: resetW, height: 46 },
      this.resetArmed ? '再按一次清除' : '重新開始',
      this.resetArmed ? 0xc0392b : 0xe9dcc8,
      this.resetArmed,
      'reset',
      () => this.reset(),
    );
    this.pill(
      { x: rightX + resetW + 10, y: lastY, width: colW - resetW - 10, height: 46 },
      '關閉',
      COLORS.bar,
      true,
      'close',
      () => this.onClose(),
    );

    patchDebug({
      settings: {
        values: { ...s },
        rects: { ...this.rects } as Record<string, Rect>,
        input: inputRect,
        message: this.message,
        resetArmed: this.resetArmed,
      },
    });
  }

  private toggleRow(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    key: ToggleKey,
    s: Settings,
  ): void {
    const on = s[key];
    this.layer.add(addText(this.scene, x, y + h / 2, label, 18, COLORS.ink).setOrigin(0, 0.5));
    const sw = { x: x + w - 64, y: y + h / 2 - 16, width: 64, height: 32 };
    const c = this.scene.add.container(sw.x, sw.y);
    const g = this.scene.add.graphics();
    g.fillStyle(on ? COLORS.harvest : 0xc9b79c, 1);
    g.fillRoundedRect(0, 0, sw.width, sw.height, 16);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(on ? sw.width - 16 : 16, 16, 12);
    c.add(g);
    // 點整列都可以切換
    const row = { x, y, width: w, height: h };
    const hit = this.scene.add.container(row.x, row.y);
    makeTapArea(hit, row.width, row.height);
    hit.on('pointerup', () => this.update({ [key]: !on } as Partial<Settings>, false));
    this.layer.add([c, hit]);
    this.rects[key] = row;
  }

  private pill(
    r: Rect,
    label: string,
    color: number,
    active: boolean,
    key: Key,
    onTap: () => void,
  ): void {
    const c = this.scene.add.container(r.x, r.y);
    const g = this.scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 12);
    const t = addText(
      this.scene,
      r.width / 2,
      r.height / 2,
      label,
      17,
      active ? '#ffffff' : COLORS.ink,
      true,
    );
    t.setOrigin(0.5);
    c.add([g, t]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', onTap);
    this.layer.add(c);
    this.rects[key] = r;
  }

  private update(patch: Partial<Settings>, qualityChanged: boolean): void {
    const st = getState();
    setState({ ...st, settings: { ...st.settings, ...patch } });
    this.disarmReset();
    this.render();
    this.onChange(qualityChanged);
  }

  /** 做了別的事就取消「重新開始」的確認狀態 */
  private disarmReset(): void {
    if (!this.resetArmed) return;
    this.resetArmed = false;
    this.message = '';
  }

  /** 第一次按只是提醒，第二次才真的清除存檔並重開遊戲 */
  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.message = '會清除所有進度，從頭開始。確定的話再按一次。';
      this.messageOk = false;
      this.render();
      return;
    }
    resetSave();
    window.location.reload();
  }

  private redeem(): void {
    const el = this.input?.node as HTMLInputElement | undefined;
    this.resetArmed = false;
    const r = redeemCode(getState(), el?.value ?? '');
    if (r.ok) {
      setState(r.state);
      this.message = `兌換成功！${r.promo.description}`;
      this.messageOk = true;
      if (el) el.value = '';
    } else {
      this.message = REDEEM_ERROR_TEXT[r.error];
      this.messageOk = false;
    }
    this.render();
    this.onChange(false);
  }
}
