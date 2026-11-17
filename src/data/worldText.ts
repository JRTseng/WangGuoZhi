import type { Faction } from './dogs';

/**
 * 畫面上的字跟著陣營換（T031）：加入喵國以後，「狗狗」說成「貓咪」、「汪國」說成「喵國」。
 * 規則與數值都不變，只換說法。由 applyWorld 設定現在是哪一邊。
 */
let cat = false;

export function setWorldWords(faction: Faction): void {
  cat = faction === 'cat';
}

/** 把一段給玩家看的字換成現在陣營的說法 */
export function wt(text: string): string {
  if (!cat) return text;
  return text
    .replace(/狗狗/g, '貓咪')
    .replace(/汪國/g, '喵國')
    .replace(/汪王/g, '喵王')
    .replace(/神犬/g, '神貓')
    .replace(/之犬/g, '之貓')
    .replace(/狗/g, '貓');
}
