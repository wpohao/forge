// 兩個版本共用的 UI 小工具：建立 i18n、頂部身分文字、語言按鈕、文件標題。
import content from '../content/content.js';
import { createI18n, htmlLang } from './i18n.js';

export function setupI18n() {
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return createI18n({ content, storage, languages: navigator.languages || [navigator.language] });
}

export function setText(id, text, placeholder = false) {
  const n = document.getElementById(id);
  if (!n) return;
  n.textContent = text;
  n.classList.toggle('ph', placeholder);
}

export function applyChrome(i18n) {
  const name = i18n.entry('site.name');
  document.documentElement.lang = htmlLang(i18n.lang);
  document.title = `${name ? name.text : ''} — ${i18n.t('site.title')}`;
  setText('who-name', name ? name.text : '', name?.status === 'todo');
  setText('who-title', i18n.t('site.title'));
  setText('who-tagline', i18n.t('site.tagline'));
  const lang = document.getElementById('btn-lang');
  if (lang) {
    lang.textContent = i18n.lang === 'zh' ? 'EN' : '中';
    lang.setAttribute('aria-label', i18n.lang === 'zh' ? 'Switch to English' : '切換為中文');
  }
}

export function bindLangButton(i18n) {
  document.getElementById('btn-lang')?.addEventListener('click', () => i18n.setLang(i18n.lang === 'zh' ? 'en' : 'zh'));
}

// 信箱卡的寄信按鈕：email 已填 → 開 mailto；未填 → 提示。第二次點擊顯示 409 彩蛋。
export function bindMailboxButton(container, i18n, toast) {
  let sent = false;
  container.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action="ui.btn.send"]');
    if (!btn) return;
    if (sent) { toast(i18n.t('ui.easter.409')); return; }
    sent = true;
    const email = i18n.entry('contact.email');
    if (email && email.status !== 'todo') window.location.href = `mailto:${email.text.trim()}`;
    else toast(i18n.lang === 'zh' ? 'Email 尚未設定' : 'Email not set yet');
  });
  return () => { sent = false; };
}
