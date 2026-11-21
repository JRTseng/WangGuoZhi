import Phaser from 'phaser';
import { COLORS } from '../config';
import {
  canDeleteMail,
  claimAllMail,
  claimMail,
  deleteDoneMail,
  deleteMail,
  inbox,
  readMail,
  type Letter,
} from '../logic/mail';
import { MAIL_ROWS, mailLayout, mailPages, type MailLayout } from '../logic/mailLayout';
import type { Rect } from '../logic/layout';
import { ratLootText } from '../logic/ratRaid';
import { setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const DOT = 0xe0452b;
const DONE = 0x4f8a3c;
const PAPER = 0xf7ecd6;

/**
 * 信箱（T040）：主頁右上「信箱」進來。
 * 左邊是信的清單（還沒領的排前面），右邊是打開的那封信與附件。
 * 信是照規則長出來的（歡迎信、捷報、升官賀信、每週補給、更新消息），規則在 src/logic/mail.ts。
 */
export class MailScene extends Phaser.Scene {
  private layout!: MailLayout;
  private body!: Phaser.GameObjects.Container;
  private toast: Phaser.GameObjects.Text | null = null;
  private toastText = '';
  /** 這次進來時信的順序；看過、領過以後不重排，免得點一下清單就跳來跳去 */
  private order: string[] = [];
  private openId: string | null = null;
  private page = 0;

  constructor() {
    super('MailScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    this.toastText = '';
    this.order = [];
    this.openId = null;
    this.page = 0;
    const { w, h } = viewOf(this);
    this.layout = mailLayout(w, h, BAR);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '信箱', () => this.scene.start('LobbyScene'), BAR);
    this.body = this.add.container(0, 0);
    this.render();
    patchDebug({ backButton: back });
    // 換週時每週補給會換一封
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refresh() });
  }

  private letters(): Letter[] {
    const list = inbox(tick(), Date.now(), timeOptions());
    // 新來的信排最前面，其餘照這次進來時的順序
    const known = this.order.filter((id) => list.some((l) => l.id === id));
    const fresh = list.filter((l) => !known.includes(l.id)).map((l) => l.id);
    this.order = [...fresh, ...known];
    return this.order.map((id) => list.find((l) => l.id === id)!);
  }

  private refresh(): void {
    const ids = inbox(tick(), Date.now(), timeOptions()).map((l) => l.id);
    if (ids.length !== this.order.length || ids.some((id) => !this.order.includes(id))) {
      this.render();
    }
  }

  private render(): void {
    let list = this.letters();
    const pages = mailPages(list.length);
    this.page = Math.min(this.page, pages - 1);
    if (!this.openId || !list.some((l) => l.id === this.openId)) {
      this.openId = list[this.page * MAIL_ROWS]?.id ?? list[0]?.id ?? null;
    }
    // 打開的那封記成看過
    if (this.openId) {
      const st = tick();
      const next = readMail(st, this.openId, Date.now(), timeOptions());
      if (next !== st) {
        setState(next);
        list = this.letters();
      }
    }
    const open = list.find((l) => l.id === this.openId) ?? null;
    const L = this.layout;
    this.body.removeAll(true);

    const g = this.add.graphics();
    this.body.add(g);
    const shown = list.slice(this.page * MAIL_ROWS, (this.page + 1) * MAIL_ROWS);
    shown.forEach((l, i) => this.drawRow(g, L.rows[i], l, l.id === this.openId));

    // 換頁
    const prev = new Button(this, L.prev, '‹', () => this.turn(-1), 24);
    const next = new Button(this, L.next, '›', () => this.turn(1), 24);
    prev.setColor(COLORS.bar).setEnabled(this.page > 0);
    next.setColor(COLORS.bar).setEnabled(this.page < pages - 1);
    this.body.add([
      prev,
      next,
      addText(
        this,
        L.page.x,
        L.page.y,
        list.length > 0 ? `${this.page + 1} / ${pages}・共 ${list.length} 封` : '沒有信',
        14,
        COLORS.inkSoft,
      ).setOrigin(0.5),
    ]);

    this.drawPane(g, open);

    const claimable = list.filter((l) => !l.claimed).length;
    const cleanable = list.filter((l) => l.read && l.claimed).length;
    const claim = new Button(
      this,
      L.claim,
      open && open.gifts.length === 0 ? '沒有附件' : open?.claimed ? '已領取' : '領取附件',
      () => this.claim(),
      17,
    );
    claim.setColor(DONE).setEnabled(!!open && !open.claimed);
    const remove = new Button(this, L.remove, '刪除', () => this.remove(), 16);
    remove.setColor(COLORS.bar).setEnabled(!!open && canDeleteMail(open));
    const claimAll = new Button(
      this,
      L.claimAll,
      claimable > 0 ? `全部領取 ${claimable}` : '全部領取',
      () => this.claimAll(),
      16,
    );
    claimAll.setColor(DONE).setEnabled(claimable > 0);
    const clean = new Button(this, L.clean, '清掉看過的', () => this.clean(), 16);
    clean.setColor(COLORS.bar).setEnabled(cleanable > 0);
    this.body.add([claim, remove, claimAll, clean]);

    patchDebug({
      resources: { ...tick().resources },
      mail: {
        rows: shown.map((l, i) => ({
          ...L.rows[i],
          id: l.id,
          kind: l.kind,
          title: l.title,
          read: l.read,
          claimed: l.claimed,
        })),
        ids: list.map((l) => l.id),
        page: this.page,
        pages,
        prev: { ...L.prev },
        next: { ...L.next },
        open: open
          ? {
              id: open.id,
              from: open.from,
              title: open.title,
              gifts: open.giftTexts,
              read: open.read,
              claimed: open.claimed,
            }
          : null,
        claim: { ...L.claim, enabled: !!open && !open.claimed },
        remove: { ...L.remove, enabled: !!open && canDeleteMail(open) },
        claimAll: { ...L.claimAll, count: claimable },
        clean: { ...L.clean, count: cleanable },
        toast: this.toastText,
      },
    });
  }

  /** 清單的一列：信封、標題、寄件人；還沒領附件的右邊有紅點 */
  private drawRow(g: Phaser.GameObjects.Graphics, r: Rect, l: Letter, open: boolean): void {
    g.fillStyle(open ? COLORS.cardSelected : COLORS.card, l.read && l.claimed && !open ? 0.7 : 1);
    g.lineStyle(2, open ? COLORS.button : COLORS.cardBorder, 1);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, 10);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
    this.drawEnvelope(g, r.x + 26, r.y + r.height / 2, l.read);

    const soft = l.read && l.claimed;
    const room = r.width - 52 - 26;
    const title = addText(this, r.x + 50, r.y + 6, l.title, 15, soft ? COLORS.inkSoft : COLORS.ink);
    title.setFontStyle(l.read ? 'normal' : 'bold');
    if (title.width > room) title.setScale(room / title.width);
    const from = addText(
      this,
      r.x + 50,
      r.y + r.height - 20,
      l.gifts.length > 0 ? `${l.from}・${l.claimed ? '附件已領' : '有附件'}` : l.from,
      12,
      !l.claimed ? '#4f8a3c' : COLORS.inkSoft,
    );
    this.body.add([title, from]);
    if (!l.claimed || !l.read) {
      this.body.add(
        this.add.circle(r.x + r.width - 14, r.y + 14, 6, DOT).setStrokeStyle(2, 0xffffff),
      );
    }
    const zone = this.add
      .zone(r.x, r.y, r.width, r.height)
      .setOrigin(0, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerup', () => this.select(l.id));
    this.body.add(zone);
  }

  /** 信封：沒看過是封著的，看過是打開的 */
  private drawEnvelope(g: Phaser.GameObjects.Graphics, x: number, y: number, read: boolean): void {
    const w = 30;
    const h = 20;
    g.lineStyle(2, COLORS.inkHex, read ? 0.45 : 1);
    g.fillStyle(read ? 0xefe2c8 : 0xffffff, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 3);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 3);
    g.beginPath();
    g.moveTo(x - w / 2, y - h / 2);
    g.lineTo(x, read ? y - h / 2 - 7 : y + 2);
    g.lineTo(x + w / 2, y - h / 2);
    g.strokePath();
    if (!read) {
      g.fillStyle(DOT, 1);
      g.fillCircle(x, y + 3, 3);
    }
  }

  /** 右邊打開的那封信 */
  private drawPane(g: Phaser.GameObjects.Graphics, l: Letter | null): void {
    const L = this.layout;
    const p = L.pane;
    g.fillStyle(PAPER, 1);
    g.lineStyle(2, COLORS.cardBorder, 1);
    g.fillRoundedRect(p.x, p.y, p.width, p.height, 14);
    g.strokeRoundedRect(p.x, p.y, p.width, p.height, 14);
    if (!l) {
      this.body.add(
        addText(
          this,
          p.x + p.width / 2,
          p.y + p.height / 2 - 40,
          '信箱是空的\n有新的捷報、補給或更新消息會寄到這裡',
          15,
          COLORS.inkSoft,
        )
          .setOrigin(0.5)
          .setAlign('center'),
      );
      return;
    }
    const t = L.text;
    const title = addText(this, t.x, t.y, l.title, 19, COLORS.ink, true);
    if (title.width > t.width) title.setScale(t.width / title.width);
    const from = addText(this, t.x, t.y + 28, `寄件人：${l.from}`, 13, COLORS.inkSoft);
    g.lineStyle(1, COLORS.cardBorder, 1);
    g.lineBetween(t.x, t.y + 50, t.x + t.width, t.y + 50);
    const bodyTop = t.y + 58;
    const text = addText(this, t.x, bodyTop, l.body, 14, COLORS.ink)
      .setWordWrapWidth(t.width, true)
      .setLineSpacing(5);
    // 內文太長就縮一點，不要蓋到附件
    const room = L.gifts.y - 6 - bodyTop;
    if (text.height > room) text.setScale(room / text.height);
    this.body.add([title, from, text]);

    // 附件
    const b = L.gifts;
    if (l.gifts.length === 0) return;
    g.fillStyle(l.claimed ? 0xe6dccb : COLORS.card, 1);
    g.lineStyle(2, l.claimed ? COLORS.cardBorder : DONE, 1);
    g.fillRoundedRect(b.x, b.y, b.width, b.height, 10);
    g.strokeRoundedRect(b.x, b.y, b.width, b.height, 10);
    const label = addText(
      this,
      b.x + 12,
      b.y + 6,
      l.claimed ? '附件（已領取）' : '附件',
      12,
      l.claimed ? COLORS.inkSoft : '#4f8a3c',
      true,
    );
    const gifts = addText(
      this,
      b.x + 12,
      b.y + 24,
      l.giftTexts.join('　'),
      16,
      l.claimed ? COLORS.inkSoft : COLORS.ink,
      true,
    );
    if (gifts.width > b.width - 24) gifts.setScale((b.width - 24) / gifts.width);
    this.body.add([label, gifts]);
  }

  private select(id: string): void {
    if (id === this.openId) return;
    playSfx('tap');
    this.openId = id;
    this.render();
  }

  private turn(step: number): void {
    const pages = mailPages(this.order.length);
    const page = Math.max(0, Math.min(pages - 1, this.page + step));
    if (page === this.page) return;
    playSfx('tap');
    this.page = page;
    this.openId = this.order[page * MAIL_ROWS] ?? this.openId;
    this.render();
  }

  private claim(): void {
    if (!this.openId) return;
    const r = claimMail(tick(), this.openId, Date.now(), timeOptions());
    if (r.gifts.length === 0) return;
    setState(r.state);
    playSfx('levelup');
    this.showToast(`領取：${r.gifts.map(ratLootText).join('、')}`);
    this.render();
  }

  private claimAll(): void {
    const r = claimAllMail(tick(), Date.now(), timeOptions());
    if (r.count === 0) return;
    setState(r.state);
    playSfx('levelup');
    this.showToast(`領了 ${r.count} 封信的附件：${r.gifts.map(ratLootText).join('、')}`);
    this.render();
  }

  private remove(): void {
    if (!this.openId) return;
    const st = tick();
    const next = deleteMail(st, this.openId, Date.now(), timeOptions());
    if (next === st) return;
    // 刪掉以後打開原本排在它後面那封
    const at = this.order.indexOf(this.openId);
    setState(next);
    playSfx('tap');
    this.openId = this.order[at + 1] ?? this.order[at - 1] ?? null;
    this.toastText = '';
    this.render();
  }

  private clean(): void {
    const r = deleteDoneMail(tick(), Date.now(), timeOptions());
    if (r.count === 0) return;
    setState(r.state);
    playSfx('tap');
    this.openId = null;
    this.page = 0;
    this.showToast(`刪掉 ${r.count} 封看過的信`);
    this.render();
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    this.toastText = text;
    const { w } = viewOf(this);
    const t = addText(this, w - 12, BAR / 2, text, 14, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(12, 8, 12, 8)
      .setBackgroundColor('#4f8a3c')
      .setDepth(60);
    // 東西很多時不要蓋到左邊的「返回」
    const room = w - 12 - 110;
    if (t.width > room) t.setScale(room / t.width);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1800,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}
