// 平面閱讀版：不載入 3D，依 CARD_KEYS 順序把每張（有內容的）卡渲染成一個區塊。
import { visibleCardKeys, cardModel } from './cards.js';
import { renderBlocks } from './cardView.js';
import { setupI18n, applyChrome, bindLangButton, bindMailboxButton } from './ui.js';

const i18n = setupI18n();
const sheets = document.getElementById('sheets');
let toastTimer = 0;

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    t.style.position = 'fixed';
    document.body.append(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

function render() {
  applyChrome(i18n);
  document.getElementById('btn-back3d').textContent = i18n.t('ui.btn.back3d');
  sheets.replaceChildren();
  for (const key of visibleCardKeys(i18n)) {
    const model = cardModel(key, i18n);
    const sec = document.createElement('section');
    sec.className = 'plain-sheet';
    sec.id = key;
    const h = document.createElement('h2');
    h.textContent = model.title;
    const body = document.createElement('div');
    renderBlocks(model, body);
    sec.append(h, body);
    sheets.append(sec);
  }
}

bindLangButton(i18n);
bindMailboxButton(sheets, i18n, toast);
i18n.onChange(render);
render();
