import { FONT_FAMILY } from '../../config';
import {
  TRANSFER_ERROR_TEXT,
  decodeSaveCode,
  encodeSaveCode,
  inspectSave,
  saveFileName,
  saveSummary,
  savedAtText,
  summaryText,
} from '../../logic/saveTransfer';
import {
  exportSave,
  getState,
  hasImportBackup,
  importSave,
  restoreImportBackup,
} from '../../state/store';
import { patchDebug } from '../ui';

const ROOT_ID = 'wgz-transfer';

export function isSaveTransferOpen(): boolean {
  return !!document.getElementById(ROOT_ID);
}

export function closeSaveTransfer(): void {
  document.getElementById(ROOT_ID)?.remove();
  patchDebug({ transfer: undefined });
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

/** 寫進剪貼簿；新的做法不行就退回舊的（選取後下複製指令） */
async function copyText(text: string, fallback: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    fallback.value = text;
    fallback.focus();
    fallback.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/**
 * 存檔搬家視窗（T037）：把進度變成存檔碼帶走，或貼上存檔碼讀回來。
 * 要貼上文字、選檔案、下載檔案，Phaser 的畫布做不到，所以和改台詞的視窗（TextPrompt）一樣
 * 用一般網頁元素蓋在遊戲上面。只能用「關閉」關掉。
 * 讀取或還原成功後整頁重新整理，讓每個畫面都照新的進度重來。
 */
export function openSaveTransfer(onClose: () => void): void {
  closeSaveTransfer();
  const root = el(
    'div',
    `position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
     background:rgba(0,0,0,0.55);font-family:${FONT_FAMILY};padding:10px;box-sizing:border-box;
     touch-action:pan-y;overflow:auto;`,
  );
  root.id = ROOT_ID;
  const card = el(
    'div',
    `width:100%;max-width:700px;max-height:100%;overflow:auto;background:#fffaf2;
     border:3px solid #d8c3a5;border-radius:18px;padding:12px 16px 12px;box-sizing:border-box;
     color:#3b2a1a;`,
  );
  const title = el('div', 'font-size:20px;font-weight:bold;text-align:center;', '存檔搬家');
  const note = el(
    'div',
    'font-size:13px;color:#8a6f55;text-align:center;margin:2px 0 8px;line-height:1.4;',
    '把進度帶到另一支手機、另一個瀏覽器，或「加到主畫面」的版本。',
  );
  const cols = el('div', 'display:flex;flex-wrap:wrap;gap:10px 16px;');
  const colCss = 'flex:1 1 280px;min-width:0;display:flex;flex-direction:column;gap:6px;';
  const head = (text: string): HTMLDivElement =>
    el('div', 'font-size:16px;font-weight:bold;', text);
  const small = (text: string): HTMLDivElement =>
    el('div', 'font-size:13px;color:#8a6f55;line-height:1.45;', text);
  const button = (label: string, act: string, bg: string): HTMLButtonElement => {
    const b = el(
      'button',
      `flex:1;min-height:44px;border:none;border-radius:12px;font-size:15px;font-weight:bold;
       color:#ffffff;background:${bg};font-family:inherit;cursor:pointer;padding:0 6px;`,
      label,
    );
    b.type = 'button';
    b.dataset.act = act;
    return b;
  };
  const row = (...items: HTMLElement[]): HTMLDivElement => {
    const r = el('div', 'display:flex;gap:8px;');
    r.append(...items);
    return r;
  };

  // 左：帶走
  const out = el('div', colCss);
  const mine = saveSummary(getState(), Date.now());
  const mineBox = el(
    'div',
    `font-size:14px;line-height:1.5;background:#f3e6d0;border-radius:10px;padding:8px 10px;`,
    summaryText(mine),
  );
  const copy = button('複製存檔碼', 'copy', '#b5651d');
  const file = button('存成檔案', 'download', '#4f6d8a');
  out.append(
    head('① 帶走現在的進度'),
    mineBox,
    row(copy, file),
    small('複製後，到另一邊開「設定 → 存檔搬家」貼上。存檔碼就是整份進度，不要給別人。'),
  );

  // 右：讀取
  const into = el('div', colCss);
  const area = el(
    'textarea',
    `width:100%;height:58px;box-sizing:border-box;font-size:14px;padding:8px 10px;resize:none;
     border:2px solid #d8c3a5;border-radius:10px;background:#ffffff;color:#3b2a1a;
     font-family:monospace;outline:none;word-break:break-all;`,
  );
  area.placeholder = '把存檔碼貼在這裡（WGZ1 開頭）';
  area.autocomplete = 'off';
  area.spellcheck = false;
  area.setAttribute('autocapitalize', 'off');
  area.setAttribute('autocorrect', 'off');
  area.setAttribute('aria-label', '存檔碼');
  const paste = button('貼上', 'paste', '#8a6f55');
  const pick = button('選檔案', 'pick', '#4f6d8a');
  const load = button('讀取', 'load', '#5a9a46');
  const picker = el('input', 'display:none;');
  picker.type = 'file';
  picker.accept = '.txt,text/plain';
  into.append(head('② 讀取別處的進度'), area, row(paste, pick, load), picker);

  const message = el(
    'div',
    'font-size:14px;font-weight:bold;line-height:1.45;min-height:40px;margin:8px 0 6px;',
  );
  const restore = button('還原讀取前的進度', 'restore', '#8a6f55');
  const close = button('關閉', 'close', '#6b4a2f');
  const foot = row(restore, close);
  restore.style.display = hasImportBackup() ? '' : 'none';

  // 狀態
  let code = '';
  /** 按過一次「讀取」、檢查過的存檔 JSON；再按一次才真的換 */
  let armed: string | null = null;
  let restoreArmed = false;
  let lastMessage = '';
  const debug = (): void =>
    patchDebug({
      transfer: {
        code,
        message: lastMessage,
        armed: armed !== null,
        restoreArmed,
        canRestore: hasImportBackup(),
        summary: summaryText(mine),
      },
    });
  const say = (text: string, ok: boolean): void => {
    lastMessage = text;
    message.textContent = text;
    message.style.color = ok ? '#4f8a3c' : '#c0392b';
    debug();
  };
  const disarm = (): void => {
    armed = null;
    restoreArmed = false;
    load.textContent = '讀取';
    load.style.background = '#5a9a46';
    restore.textContent = '還原讀取前的進度';
    restore.style.background = '#8a6f55';
  };
  const done = (): void => {
    closeSaveTransfer();
    onClose();
  };

  // 壓縮是非同步的，而 Safari 規定寫剪貼簿要在點按的當下，所以一開視窗就先把存檔碼算好
  const ready = encodeSaveCode(exportSave()).then((c) => {
    code = c;
    debug();
    return c;
  });

  copy.addEventListener('click', () => {
    disarm();
    const go = (c: string): void => {
      void copyText(c, area).then((ok) => {
        if (ok) {
          say(`已複製存檔碼（${c.length} 個字）。到另一邊貼上就可以讀取。`, true);
        } else {
          area.value = c;
          area.focus();
          area.select();
          say('沒辦法自動複製。存檔碼已經放在右邊的框框並選取，請長按它選「複製」。', false);
        }
      });
    };
    if (code) go(code);
    else void ready.then(go);
  });

  file.addEventListener('click', () => {
    disarm();
    void ready.then((c) => {
      const url = URL.createObjectURL(new Blob([c], { type: 'text/plain' }));
      const a = el('a', 'display:none;');
      a.href = url;
      a.download = saveFileName(Date.now(), new Date().getTimezoneOffset());
      root.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      say(`已存成檔案「${a.download}」。到另一邊按「選檔案」選它。`, true);
    });
  });

  paste.addEventListener('click', () => {
    disarm();
    const fail = (): void => {
      area.focus();
      say('沒辦法自動貼上。請長按上面的框框選「貼上」。', false);
    };
    if (!navigator.clipboard?.readText) {
      fail();
      return;
    }
    navigator.clipboard.readText().then((text) => {
      area.value = text;
      say(text.trim() ? '已貼上，按「讀取」看看這份進度。' : '剪貼簿裡沒有文字。', !!text.trim());
    }, fail);
  });

  pick.addEventListener('click', () => {
    disarm();
    picker.value = '';
    picker.click();
  });
  picker.addEventListener('change', () => {
    const f = picker.files?.[0];
    if (!f) return;
    // 存檔碼頂多幾萬個字；選到別的大檔案就不讀了
    if (f.size > 2_000_000) {
      say('這個檔案太大，不是存檔檔案。', false);
      return;
    }
    f.text().then(
      (text) => {
        area.value = text.trim();
        say(`已讀進「${f.name}」，按「讀取」看看這份進度。`, true);
      },
      () => say('這個檔案讀不出來。', false),
    );
  });

  area.addEventListener('input', () => {
    if (armed !== null) {
      disarm();
      say('', true);
    }
  });

  load.addEventListener('click', () => {
    if (armed !== null) {
      const json = armed;
      disarm();
      if (importSave(json)) window.location.reload();
      else say('寫入失敗（手機空間可能滿了），現在的進度沒有變。', false);
      return;
    }
    restoreArmed = false;
    restore.textContent = '還原讀取前的進度';
    restore.style.background = '#8a6f55';
    const text = area.value;
    void decodeSaveCode(text).then((d) => {
      const r = d.ok ? inspectSave(d.json, Date.now()) : d;
      if (!r.ok) {
        say(TRANSFER_ERROR_TEXT[r.error], false);
        return;
      }
      // 檢查途中框框裡的字又被改了就不算
      if (area.value !== text || !d.ok) return;
      armed = d.json;
      load.textContent = '確定讀取';
      load.style.background = '#c0392b';
      const at = savedAtText(r.summary.savedAt, new Date().getTimezoneOffset());
      say(
        `這份進度：${summaryText(r.summary)}${at ? `（${at} 存的）` : ''}。` +
          '讀取後會換掉現在的進度，確定的話再按一次「確定讀取」。',
        false,
      );
    });
  });

  restore.addEventListener('click', () => {
    if (!restoreArmed) {
      disarm();
      restoreArmed = true;
      restore.textContent = '確定還原';
      restore.style.background = '#c0392b';
      say('會換回上次讀取之前的進度（現在這份會留著，可以再換回來）。確定的話再按一次。', false);
      return;
    }
    disarm();
    if (restoreImportBackup()) window.location.reload();
    else say('還原失敗，現在的進度沒有變。', false);
  });

  close.addEventListener('click', done);

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

  cols.append(out, into);
  card.append(title, note, cols, message, foot);
  root.append(card);
  document.body.append(root);
  debug();
}
