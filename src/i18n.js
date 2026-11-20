// 語系：偵測、儲存、取字。純邏輯，不碰 DOM。
const LANGS = ['zh', 'en'];
const KEY = 'forge.lang';

export function detectLang(languages = []) {
  const first = String(languages[0] || '').toLowerCase();
  return first.startsWith('zh') ? 'zh' : 'en';
}

export function htmlLang(lang) {
  return lang === 'zh' ? 'zh-Hant-TW' : 'en';
}

function safeGet(storage, key) {
  try { return storage ? storage.getItem(key) : null; } catch { return null; }
}
function safeSet(storage, key, value) {
  try { if (storage) storage.setItem(key, value); } catch { /* 無痕或封鎖時忽略 */ }
}

export function createI18n({ content, storage, languages }) {
  const stored = safeGet(storage, KEY);
  const listeners = [];
  const api = {
    lang: LANGS.includes(stored) ? stored : detectLang(languages),
    setLang(l) {
      if (!LANGS.includes(l) || l === api.lang) return;
      api.lang = l;
      safeSet(storage, KEY, l);
      listeners.forEach((fn) => fn(l));
    },
    entry(id) {
      const e = content[id];
      if (!e || e.status === 'hidden') return null;
      return { text: e[api.lang], status: e.status };
    },
    t(id) {
      const e = api.entry(id);
      return e ? e.text : '';
    },
    onChange(fn) { listeners.push(fn); },
  };
  return api;
}
