import { REGIONS } from '../data/regions';
import { wt } from '../data/worldText';
import type { GameState, RatLoot } from '../state/gameState';
import { LORD_MAX_LEVEL, lordTitle } from './lord';
import { currentChapterIndex } from './progress';
import { applyRatLoot, ratLootText } from './ratRaid';
import { snackDrop } from './snacks';
import type { TimeOptions } from './stamina';
import { weekKey } from './tower';

/**
 * 信箱（T040）：主頁右上「信箱」進來，收信、領附件。全部是純函式。
 *
 * 遊戲是單機的，沒有伺服器寄信，所以信是照規則「長」出來的：
 * - 歡迎信：一開始就有
 * - 捷報：每打倒一章的頭目寄一封
 * - 升官賀信：城主等級到 10／20／…／60 各寄一封
 * - 每週補給：每週一 05:00 換新的一封，上週沒領的就過期
 * - 更新消息：遊戲有新東西時寄一封（清單在 MAIL_NEWS，之後更新就往下加）
 *
 * 存檔只記哪幾封「看過／領過／刪掉」，信的內容每次現算。
 */

export interface MailState {
  /** 看過的信 */
  read: string[];
  /** 領過附件的信 */
  claimed: string[];
  /** 刪掉的信 */
  deleted: string[];
}

export const EMPTY_MAIL: MailState = { read: [], claimed: [], deleted: [] };

export type MailKind = 'welcome' | 'chapter' | 'lord' | 'week' | 'news';

/** 數字都是暫定，等 Jimmy 看過再調 */
export const MAIL = {
  welcome: { bones: 100, snacks: 5 },
  /** 捷報：糧草與骨頭幣，乘上第幾章 */
  chapterFood: 300,
  chapterBonesBase: 20,
  chapterBonesPerChapter: 10,
  /** 升官賀信：每 10 級一封 */
  lordStep: 10,
  lordBonesBase: 50,
  lordBonesPerLevel: 5,
  /** 每週補給：糧草乘上打到第幾章 */
  weekFoodPerChapter: 500,
  weekBones: 30,
  weekSnacks: 3,
} as const;

/** 更新消息：遊戲有新東西時往下加一筆，玩家下次開信箱就會收到 */
export const MAIL_NEWS: readonly {
  id: string;
  title: string;
  body: string;
  gifts: readonly RatLoot[];
}[] = [
  {
    id: 'news-mailbox',
    title: '驛站開張了',
    body:
      '汪國的驛站開始送信了！\n' +
      '打倒頭目的捷報、升官的賀信、每週的補給，還有遊戲更新的消息，之後都會寄到這裡。\n' +
      '信裡附的東西記得領，領完的信可以刪掉。',
    gifts: [{ kind: 'bones', amount: 50 }],
  },
];

export interface Letter {
  id: string;
  kind: MailKind;
  /** 寄件人 */
  from: string;
  title: string;
  body: string;
  gifts: RatLoot[];
  /** 附件的文字：「骨頭幣 +100」「小肉乾 ×5」 */
  giftTexts: string[];
  read: boolean;
  /** 附件領過了（沒有附件的信一律算領過） */
  claimed: boolean;
}

type HasMail = Pick<GameState, 'mail'>;
type InboxFields = HasMail & Pick<GameState, 'cleared' | 'lord'>;
type ClaimFields = InboxFields & Pick<GameState, 'resources' | 'snacks' | 'gear' | 'shards'>;

const WEEK_PREFIX = 'week-';
export const weekMailId = (now: number, o?: TimeOptions): string =>
  `${WEEK_PREFIX}${weekKey(now, o)}`;

type Draft = Pick<Letter, 'id' | 'kind' | 'from' | 'title' | 'body' | 'gifts'>;

/** 現在該有哪些信，由舊到新（還沒管看過、領過、刪掉） */
function delivered(state: Pick<GameState, 'cleared' | 'lord'>, now: number, o?: TimeOptions) {
  const list: Draft[] = [];
  const office = wt('汪國內政處');
  list.push({
    id: 'welcome',
    kind: 'welcome',
    from: office,
    title: '歡迎上任，城主大人',
    body: wt(
      '恭喜城主大人上任！\n' +
        '這裡是汪國的信箱，內政處會把捷報、賀信和補給寄過來。\n' +
        '先送上一點見面禮，帶著狗狗們出征去吧。',
    ),
    gifts: [
      { kind: 'bones', amount: MAIL.welcome.bones },
      { kind: 'snack', id: 'small', amount: MAIL.welcome.snacks },
    ],
  });

  REGIONS.forEach((r, i) => {
    const last = r.stages[r.stages.length - 1];
    if (!state.cleared.includes(last.id)) return;
    const next = REGIONS[i + 1];
    const boss = last.boss?.name ?? '頭目';
    list.push({
      id: `chapter-${r.chapter}`,
      kind: 'chapter',
      from: office,
      title: `捷報：${r.name}平定了`,
      body: wt(
        `城主大人打倒了${boss}，${r.name}的百姓送來謝禮。\n` +
          (next
            ? `下一站是${next.name}，聽說那裡的敵人更難纏，出發前記得把狗狗練強一點。`
            : '十章全部平定，汪國上下都在傳頌城主大人的名字！'),
      ),
      gifts: [
        { kind: 'food', amount: MAIL.chapterFood * r.chapter },
        {
          kind: 'bones',
          amount: MAIL.chapterBonesBase + MAIL.chapterBonesPerChapter * r.chapter,
        },
      ],
    });
  });

  for (let lv = MAIL.lordStep; lv <= LORD_MAX_LEVEL; lv += MAIL.lordStep) {
    if (state.lord.level < lv) break;
    const title = lordTitle(lv);
    list.push({
      id: `lord-${lv}`,
      kind: 'lord',
      from: wt('汪王'),
      title: lv >= LORD_MAX_LEVEL ? `城主等級 ${lv}：登上${title}` : `升任${title}`,
      body: wt(
        `城主等級到了 ${lv} 級，從今天起大家要改口叫您「${title}」了。\n` +
          '這是一點賀禮，請繼續帶著狗狗們往前走。',
      ),
      gifts: [
        { kind: 'bones', amount: MAIL.lordBonesBase + MAIL.lordBonesPerLevel * lv },
        { kind: 'snack', id: 'mid', amount: lv / MAIL.lordStep },
      ],
    });
  }

  const chapter = REGIONS[currentChapterIndex(state)]?.chapter ?? 1;
  list.push({
    id: weekMailId(now, o),
    kind: 'week',
    from: wt('汪國糧倉'),
    title: '這個星期的補給到了',
    body: wt(
      '糧倉每個星期一早上 05:00 會送一份補給過來，打到越後面的章節送得越多。\n' +
        '補給只留到這個星期結束，下星期一換新的一份，記得先領。',
    ),
    gifts: [
      { kind: 'food', amount: MAIL.weekFoodPerChapter * chapter },
      { kind: 'bones', amount: MAIL.weekBones },
      { kind: 'snack', id: snackDrop(chapter, false).id, amount: MAIL.weekSnacks },
    ],
  });

  for (const n of MAIL_NEWS) {
    list.push({
      id: n.id,
      kind: 'news',
      from: wt('汪國驛站'),
      title: n.title,
      body: wt(n.body),
      gifts: [...n.gifts],
    });
  }
  return list;
}

/** 有東西還沒領排最前面，再來是還沒看的，其餘在後；同一組裡新的在前 */
const rank = (l: Letter): number => (!l.claimed ? 0 : !l.read ? 1 : 2);

/** 信箱裡現在的信（刪掉的不算） */
export function inbox(state: InboxFields, now: number, o?: TimeOptions): Letter[] {
  const m = state.mail;
  return delivered(state, now, o)
    .filter((d) => !m.deleted.includes(d.id))
    .map((d, i) => ({
      letter: {
        ...d,
        giftTexts: d.gifts.map(ratLootText),
        read: m.read.includes(d.id),
        claimed: d.gifts.length === 0 || m.claimed.includes(d.id),
      },
      i,
    }))
    .sort((a, b) => rank(a.letter) - rank(b.letter) || b.i - a.i)
    .map((x) => x.letter);
}

/** 還沒看、或附件還沒領的信有幾封（主頁「信箱」紅點用） */
export function mailPending(state: InboxFields, now: number, o?: TimeOptions): number {
  return inbox(state, now, o).filter((l) => !l.read || !l.claimed).length;
}

/** 附件還沒領的信有幾封 */
export function mailClaimable(state: InboxFields, now: number, o?: TimeOptions): number {
  return inbox(state, now, o).filter((l) => !l.claimed).length;
}

const add = (list: readonly string[], id: string): string[] =>
  list.includes(id) ? [...list] : [...list, id];

/** 過期的每週補給不用再記 */
function prune(mail: MailState, now: number, o?: TimeOptions): MailState {
  const week = weekMailId(now, o);
  const keep = (id: string) => !id.startsWith(WEEK_PREFIX) || id >= week;
  return {
    read: mail.read.filter(keep),
    claimed: mail.claimed.filter(keep),
    deleted: mail.deleted.filter(keep),
  };
}

/** 打開一封信：記成看過 */
export function readMail<S extends InboxFields>(
  state: S,
  id: string,
  now: number,
  o?: TimeOptions,
): S {
  const letter = inbox(state, now, o).find((l) => l.id === id);
  if (!letter || letter.read) return state;
  return { ...state, mail: prune({ ...state.mail, read: add(state.mail.read, id) }, now, o) };
}

/** 領一封信的附件（順便記成看過）；沒有這封或領過了就什麼都不做 */
export function claimMail<S extends ClaimFields>(
  state: S,
  id: string,
  now: number,
  o?: TimeOptions,
): { state: S; gifts: RatLoot[] } {
  const letter = inbox(state, now, o).find((l) => l.id === id);
  if (!letter || letter.claimed) return { state, gifts: [] };
  const mail = prune(
    {
      ...state.mail,
      read: add(state.mail.read, id),
      claimed: add(state.mail.claimed, id),
    },
    now,
    o,
  );
  return { state: applyRatLoot({ ...state, mail }, letter.gifts), gifts: letter.gifts };
}

/** 把所有還沒領的附件一次領完 */
export function claimAllMail<S extends ClaimFields>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; gifts: RatLoot[]; count: number } {
  let s = state;
  let count = 0;
  const gifts: RatLoot[] = [];
  for (const l of inbox(state, now, o)) {
    if (l.claimed) continue;
    const r = claimMail(s, l.id, now, o);
    if (r.gifts.length === 0) continue;
    s = r.state;
    count += 1;
    gifts.push(...r.gifts);
  }
  return { state: s, gifts: mergeGifts(gifts), count };
}

/** 同一種東西加在一起（「全部領取」的提示用） */
export function mergeGifts(gifts: readonly RatLoot[]): RatLoot[] {
  const out: RatLoot[] = [];
  for (const g of gifts) {
    const same = out.find(
      (x) => x.kind === g.kind && ('id' in x ? x.id : '') === ('id' in g ? g.id : ''),
    );
    if (same && 'amount' in same && 'amount' in g) same.amount += g.amount;
    else out.push({ ...g });
  }
  return out;
}

/** 這封信能不能刪：附件領過（或本來就沒有附件）才能刪 */
export function canDeleteMail(letter: Pick<Letter, 'claimed'>): boolean {
  return letter.claimed;
}

/** 刪一封信；附件還沒領的刪不掉 */
export function deleteMail<S extends InboxFields>(
  state: S,
  id: string,
  now: number,
  o?: TimeOptions,
): S {
  const letter = inbox(state, now, o).find((l) => l.id === id);
  if (!letter || !canDeleteMail(letter)) return state;
  return {
    ...state,
    mail: prune({ ...state.mail, deleted: add(state.mail.deleted, id) }, now, o),
  };
}

/** 把看過、領過的信一次刪掉 */
export function deleteDoneMail<S extends InboxFields>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; count: number } {
  const done = inbox(state, now, o).filter((l) => l.read && l.claimed);
  if (done.length === 0) return { state, count: 0 };
  const deleted = [...state.mail.deleted];
  for (const l of done) if (!deleted.includes(l.id)) deleted.push(l.id);
  return {
    state: { ...state, mail: prune({ ...state.mail, deleted }, now, o) },
    count: done.length,
  };
}

const ID = /^[a-z0-9-]{1,40}$/;
const MAX_IDS = 200;

function idList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && ID.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

/** 讀檔時整理信箱欄位；舊存檔沒有這個欄位就是一封都還沒看 */
export function sanitizeMail(raw: unknown): MailState {
  if (typeof raw !== 'object' || raw === null) return { read: [], claimed: [], deleted: [] };
  const r = raw as { read?: unknown; claimed?: unknown; deleted?: unknown };
  return { read: idList(r.read), claimed: idList(r.claimed), deleted: idList(r.deleted) };
}
