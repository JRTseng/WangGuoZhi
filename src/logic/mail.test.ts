import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { setWorldWords } from '../data/worldText';
import { createInitialState } from '../state/gameState';
import {
  EMPTY_MAIL,
  MAIL,
  MAIL_NEWS,
  claimAllMail,
  claimMail,
  deleteDoneMail,
  deleteMail,
  inbox,
  mailClaimable,
  mailPending,
  mergeGifts,
  readMail,
  sanitizeMail,
  weekMailId,
} from './mail';
import { deserialize, serialize } from './save';

const TZ = { tzOffsetMin: -480 };
/** 台北 2026-11-22（星期日）12:00 */
const SUNDAY = Date.UTC(2026, 10, 22, 4, 0, 0);
const DAY = 86_400_000;
const fresh = () => createInitialState(SUNDAY);
const bossOf = (i: number) => REGIONS[i].stages[REGIONS[i].stages.length - 1].id;
const ids = (st: ReturnType<typeof fresh>, now = SUNDAY) => inbox(st, now, TZ).map((l) => l.id);

describe('信箱：有哪些信', () => {
  it('新遊戲有三封：更新消息、每週補給、歡迎信，都還沒看、都有附件', () => {
    const list = inbox(fresh(), SUNDAY, TZ);
    expect(list.map((l) => l.kind)).toEqual(['news', 'week', 'welcome']);
    expect(list).toHaveLength(2 + MAIL_NEWS.length);
    for (const l of list) {
      expect(l.read).toBe(false);
      expect(l.claimed).toBe(false);
      expect(l.gifts.length).toBeGreaterThan(0);
      expect(l.giftTexts).toHaveLength(l.gifts.length);
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.body.length).toBeGreaterThan(10);
    }
    expect(mailPending(fresh(), SUNDAY, TZ)).toBe(3);
    expect(mailClaimable(fresh(), SUNDAY, TZ)).toBe(3);
  });

  it('歡迎信送骨頭幣與小肉乾', () => {
    const l = inbox(fresh(), SUNDAY, TZ).find((x) => x.id === 'welcome')!;
    expect(l.gifts).toEqual([
      { kind: 'bones', amount: MAIL.welcome.bones },
      { kind: 'snack', id: 'small', amount: MAIL.welcome.snacks },
    ]);
    expect(l.giftTexts).toEqual(['骨頭幣 +100', '小肉乾 ×5']);
  });

  it('打倒一章的頭目寄一封捷報，越後面的章節送越多；只打到一半不寄', () => {
    const half = { ...fresh(), cleared: [REGIONS[0].stages[0].id] };
    expect(ids(half)).not.toContain('chapter-1');
    const st = { ...fresh(), cleared: [bossOf(0), bossOf(1)] };
    const list = inbox(st, SUNDAY, TZ);
    const c1 = list.find((l) => l.id === 'chapter-1')!;
    const c2 = list.find((l) => l.id === 'chapter-2')!;
    expect(c1.title).toBe(`捷報：${REGIONS[0].name}平定了`);
    expect(c1.body).toContain(REGIONS[0].stages[4].boss!.name);
    expect(c1.body).toContain(REGIONS[1].name);
    expect(c1.gifts).toEqual([
      { kind: 'food', amount: 300 },
      { kind: 'bones', amount: 30 },
    ]);
    expect(c2.gifts).toEqual([
      { kind: 'food', amount: 600 },
      { kind: 'bones', amount: 40 },
    ]);
    expect(ids(st)).not.toContain('chapter-3');
  });

  it('十章全破有十封捷報，最後一封不提下一站', () => {
    const st = { ...fresh(), cleared: REGIONS.map((_, i) => bossOf(i)) };
    const list = inbox(st, SUNDAY, TZ).filter((l) => l.kind === 'chapter');
    expect(list).toHaveLength(REGIONS.length);
    expect(list[0].id).toBe(`chapter-${REGIONS.length}`);
    expect(list[0].body).toContain('十章全部平定');
  });

  it('城主等級每 10 級一封賀信', () => {
    const at = (level: number) =>
      ids({ ...fresh(), lord: { level, exp: 0 } }).filter((id) => id.startsWith('lord-'));
    expect(at(9)).toEqual([]);
    expect(at(10)).toEqual(['lord-10']);
    expect(at(35)).toEqual(['lord-30', 'lord-20', 'lord-10']);
    expect(at(60)).toHaveLength(6);
    const l = inbox({ ...fresh(), lord: { level: 20, exp: 0 } }, SUNDAY, TZ).find(
      (x) => x.id === 'lord-20',
    )!;
    expect(l.title).toBe('升任太守');
    expect(l.gifts).toEqual([
      { kind: 'bones', amount: 150 },
      { kind: 'snack', id: 'mid', amount: 2 },
    ]);
  });

  it('每週補給跟著打到第幾章變多；星期一 05:00 換新的一封', () => {
    const w1 = weekMailId(SUNDAY, TZ);
    expect(w1).toBe('week-2026-11-16');
    const l = inbox(fresh(), SUNDAY, TZ).find((x) => x.id === w1)!;
    expect(l.gifts).toEqual([
      { kind: 'food', amount: MAIL.weekFoodPerChapter },
      { kind: 'bones', amount: MAIL.weekBones },
      { kind: 'snack', id: 'small', amount: MAIL.weekSnacks },
    ]);
    const ch3 = { ...fresh(), cleared: [bossOf(0), bossOf(1)] };
    expect(inbox(ch3, SUNDAY, TZ).find((x) => x.id === w1)!.gifts[0]).toEqual({
      kind: 'food',
      amount: MAIL.weekFoodPerChapter * 3,
    });
    // 星期一 04:59 還是上週，05:00 換週
    const monday0459 = Date.UTC(2026, 10, 22, 20, 59, 0);
    expect(weekMailId(monday0459, TZ)).toBe(w1);
    expect(weekMailId(monday0459 + 60_000, TZ)).toBe('week-2026-11-23');
  });

  it('加入喵國以後信裡的說法跟著換', () => {
    setWorldWords('cat');
    try {
      const l = inbox(fresh(), SUNDAY, TZ).find((x) => x.id === 'welcome')!;
      expect(l.from).toBe('喵國內政處');
      expect(l.body).toContain('貓咪');
      expect(l.body).not.toContain('狗');
    } finally {
      setWorldWords('dog');
    }
  });
});

describe('信箱：看信、領附件', () => {
  it('打開一封記成看過，再開一次存檔不變', () => {
    const a = readMail(fresh(), 'welcome', SUNDAY, TZ);
    expect(a.mail.read).toEqual(['welcome']);
    expect(inbox(a, SUNDAY, TZ).find((l) => l.id === 'welcome')!.read).toBe(true);
    expect(readMail(a, 'welcome', SUNDAY, TZ)).toBe(a);
    expect(readMail(a, 'nothing', SUNDAY, TZ)).toBe(a);
    // 看過但附件還沒領，仍算有事要做
    expect(mailPending(a, SUNDAY, TZ)).toBe(3);
  });

  it('領附件：東西進存檔、順便記成看過，再領一次沒有東西', () => {
    const st = fresh();
    const r = claimMail(st, 'welcome', SUNDAY, TZ);
    expect(r.gifts).toHaveLength(2);
    expect(r.state.resources.bones).toBe(st.resources.bones + MAIL.welcome.bones);
    expect(r.state.snacks.small).toBe(MAIL.welcome.snacks);
    expect(r.state.mail.read).toEqual(['welcome']);
    expect(r.state.mail.claimed).toEqual(['welcome']);
    expect(mailPending(r.state, SUNDAY, TZ)).toBe(2);
    const again = claimMail(r.state, 'welcome', SUNDAY, TZ);
    expect(again.gifts).toEqual([]);
    expect(again.state).toBe(r.state);
    expect(claimMail(st, 'chapter-1', SUNDAY, TZ).gifts).toEqual([]);
  });

  it('全部領取：一次領完，同一種東西加在一起', () => {
    const st = { ...fresh(), cleared: [bossOf(0)] };
    const r = claimAllMail(st, SUNDAY, TZ);
    expect(r.count).toBe(4);
    // 更新消息 50＋每週 30＋捷報 30＋歡迎 100
    expect(r.state.resources.bones).toBe(st.resources.bones + 210);
    // 每週 500 × 第 2 章＋捷報 300
    expect(r.state.resources.food).toBe(st.resources.food + 1300);
    expect(r.state.snacks.small).toBe(MAIL.welcome.snacks + MAIL.weekSnacks);
    expect(r.gifts).toEqual([
      { kind: 'bones', amount: 210 },
      { kind: 'food', amount: 1300 },
      { kind: 'snack', id: 'small', amount: 8 },
    ]);
    expect(mailClaimable(r.state, SUNDAY, TZ)).toBe(0);
    expect(mailPending(r.state, SUNDAY, TZ)).toBe(0);
    expect(claimAllMail(r.state, SUNDAY, TZ)).toMatchObject({ count: 0, gifts: [] });
  });

  it('mergeGifts 不會改到原本的東西，裝備各算各的', () => {
    const a = { kind: 'bones', amount: 10 } as const;
    const out = mergeGifts([a, a, { kind: 'gear', id: 'x' }, { kind: 'gear', id: 'x' }]);
    expect(out).toEqual([
      { kind: 'bones', amount: 20 },
      { kind: 'gear', id: 'x' },
      { kind: 'gear', id: 'x' },
    ]);
    expect(a.amount).toBe(10);
  });

  it('還沒領的排前面，再來是還沒看的，看過領過的在最後', () => {
    let st = fresh();
    st = claimMail(st, 'news-mailbox', SUNDAY, TZ).state;
    expect(ids(st)).toEqual([weekMailId(SUNDAY, TZ), 'welcome', 'news-mailbox']);
  });
});

describe('信箱：刪信', () => {
  it('附件還沒領的刪不掉；領過就能刪，刪了不會再出現', () => {
    const st = fresh();
    expect(deleteMail(st, 'welcome', SUNDAY, TZ)).toBe(st);
    const claimed = claimMail(st, 'welcome', SUNDAY, TZ).state;
    const gone = deleteMail(claimed, 'welcome', SUNDAY, TZ);
    expect(ids(gone)).not.toContain('welcome');
    expect(gone.mail.deleted).toEqual(['welcome']);
    expect(deleteMail(gone, 'welcome', SUNDAY, TZ)).toBe(gone);
    // 刪掉的信不能再領一次
    expect(claimMail(gone, 'welcome', SUNDAY, TZ).gifts).toEqual([]);
  });

  it('清掉看過的：只刪看過又領過的', () => {
    let st = fresh();
    st = claimMail(st, 'welcome', SUNDAY, TZ).state;
    st = readMail(st, 'news-mailbox', SUNDAY, TZ);
    const r = deleteDoneMail(st, SUNDAY, TZ);
    expect(r.count).toBe(1);
    expect(ids(r.state)).toEqual(['news-mailbox', weekMailId(SUNDAY, TZ)]);
    expect(deleteDoneMail(r.state, SUNDAY, TZ)).toMatchObject({ count: 0 });
  });

  it('換週：新的補給又能領，上週那封不見了；刪過的每週補給下週照樣會來', () => {
    let st = claimAllMail(fresh(), SUNDAY, TZ).state;
    st = deleteDoneMail(st, SUNDAY, TZ).state;
    expect(ids(st)).toEqual([]);
    const next = SUNDAY + DAY;
    expect(ids(st, next)).toEqual(['week-2026-11-23']);
    const r = claimMail(st, 'week-2026-11-23', next, TZ);
    expect(r.gifts).toHaveLength(3);
    // 過期的那一週不用再記
    expect(r.state.mail.claimed).not.toContain('week-2026-11-16');
    expect(r.state.mail.deleted).not.toContain('week-2026-11-16');
    expect(r.state.mail.claimed).toContain('week-2026-11-23');
  });

  it('手機時間調回上週，領過的這週補給不會被忘掉', () => {
    const st = claimMail(fresh(), weekMailId(SUNDAY, TZ), SUNDAY, TZ).state;
    const back = readMail(st, 'welcome', SUNDAY - 7 * DAY, TZ);
    expect(back.mail.claimed).toContain('week-2026-11-16');
  });
});

describe('信箱：存檔', () => {
  it('存檔讀回來一樣；舊存檔沒有這個欄位就是都還沒看', () => {
    const st = claimMail(fresh(), 'welcome', SUNDAY, TZ).state;
    const back = deserialize(serialize(st, SUNDAY), SUNDAY);
    expect(back.status).toBe('ok');
    expect(back.state.mail).toEqual(st.mail);
    expect(sanitizeMail(undefined)).toEqual(EMPTY_MAIL);
    expect(sanitizeMail('x')).toEqual(EMPTY_MAIL);
  });

  it('壞掉的內容會被丟掉', () => {
    expect(
      sanitizeMail({ read: ['welcome', 'welcome', 3, 'BAD ID', ''], claimed: 'x', deleted: null }),
    ).toEqual({ read: ['welcome'], claimed: [], deleted: [] });
    const many = Array.from({ length: 500 }, (_, i) => `week-${i}`);
    expect(sanitizeMail({ read: many }).read).toHaveLength(200);
  });
});
