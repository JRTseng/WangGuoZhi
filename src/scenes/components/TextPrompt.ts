import { FONT_FAMILY } from '../../config';

export interface TextPromptOptions {
  title: string;
  /** 標題下面的說明 */
  note: string;
  /** 目前的內容 */
  value: string;
  /** 輸入框空白時顯示的提示（預設台詞） */
  placeholder: string;
  /** 最多幾個字 */
  maxLength: number;
  /** 按下確定；空字串代表恢復預設 */
  onSubmit: (value: string) => void;
  onClose?: () => void;
}

const ROOT_ID = 'wgz-prompt';

/** 目前有沒有開著輸入視窗 */
export function isTextPromptOpen(): boolean {
  return !!document.getElementById(ROOT_ID);
}

export function closeTextPrompt(): void {
  document.getElementById(ROOT_ID)?.remove();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
}

/**
 * 打字用的小視窗（T017 填招式台詞）。Phaser 的畫布不能叫出手機鍵盤與中文輸入法，
 * 所以用一般網頁的輸入框蓋在遊戲上面；蓋住整個畫面，開著的時候點不到後面的遊戲。
 * 只能用按鈕關閉（點旁邊不會關），免得手滑把打到一半的字弄丟。
 */
export function openTextPrompt(o: TextPromptOptions): void {
  closeTextPrompt();
  const root = el(
    'div',
    `position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
     background:rgba(0,0,0,0.55);font-family:${FONT_FAMILY};padding:16px;box-sizing:border-box;`,
  );
  root.id = ROOT_ID;
  const card = el(
    'div',
    `width:100%;max-width:340px;background:#fffaf2;border:3px solid #d8c3a5;border-radius:18px;
     padding:18px 16px 16px;box-sizing:border-box;color:#3b2a1a;`,
  );
  const title = el('div', 'font-size:20px;font-weight:bold;text-align:center;', o.title);
  const note = el(
    'div',
    'font-size:14px;color:#8a6f55;text-align:center;margin:6px 0 12px;line-height:1.5;white-space:pre-line;',
    o.note,
  );
  const input = el(
    'input',
    `width:100%;box-sizing:border-box;font-size:18px;padding:10px 12px;border:2px solid #d8c3a5;
     border-radius:10px;background:#ffffff;color:#3b2a1a;font-family:inherit;outline:none;`,
  );
  input.type = 'text';
  input.value = o.value;
  input.placeholder = o.placeholder;
  input.maxLength = o.maxLength;
  input.autocomplete = 'off';
  input.enterKeyHint = 'done';
  const count = el('div', 'font-size:13px;color:#8a6f55;text-align:right;margin:4px 2px 12px;');
  const showCount = (): void => {
    count.textContent = `${Array.from(input.value).length}/${o.maxLength}`;
  };
  showCount();
  input.addEventListener('input', showCount);

  const row = el('div', 'display:flex;gap:8px;');
  const button = (label: string, act: string, bg: string): HTMLButtonElement => {
    const b = el(
      'button',
      `flex:1;min-height:46px;border:none;border-radius:12px;font-size:16px;font-weight:bold;
       color:#ffffff;background:${bg};font-family:inherit;cursor:pointer;`,
      label,
    );
    b.type = 'button';
    b.dataset.act = act;
    return b;
  };
  const close = (): void => {
    closeTextPrompt();
    o.onClose?.();
  };
  const submit = (value: string): void => {
    closeTextPrompt();
    o.onSubmit(value);
    o.onClose?.();
  };
  const reset = button('恢復預設', 'reset', '#8a6f55');
  const cancel = button('取消', 'cancel', '#b9a48c');
  const ok = button('確定', 'ok', '#b5651d');
  reset.addEventListener('click', () => submit(''));
  cancel.addEventListener('click', close);
  ok.addEventListener('click', () => submit(input.value));
  input.addEventListener('keydown', (ev) => {
    // 輸入法選字中的 Enter 不算送出
    if (ev.key === 'Enter' && !ev.isComposing) submit(input.value);
  });
  // 視窗裡的點擊與按鍵不要傳到遊戲
  for (const type of [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'touchstart',
    'touchend',
  ]) {
    root.addEventListener(type, (ev) => ev.stopPropagation());
  }
  for (const type of ['keydown', 'keyup']) {
    root.addEventListener(type, (ev) => ev.stopPropagation());
  }

  row.append(reset, cancel, ok);
  card.append(title, note, input, count, row);
  root.append(card);
  document.body.append(root);
  input.focus();
}
