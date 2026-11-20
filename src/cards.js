// 內容卡的資料模型：只組資料，不碰 DOM。
// Block = { heading?, headingPlaceholder?, kicker?, accent?, sheet?, items: Item[] }（sheet：畫成公會卡的欄位表）
// Item  = { id, text, kind: 'text'|'list'|'link'|'button', href?, label?, labelPlaceholder?, list?, placeholder }

export const CARD_KEYS = ['hearth', 'armory', 'anvil', 'commissions', 'ledger', 'shelf', 'mailbox'];

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const SKILLS = 4;
const STORIES = 4;
const CREEDS = 3;
const ORDERS = 3;
// 冒險者公會卡的欄位：[欄位名稱 ID, 內容 ID]
const GUILD_FIELDS = [
  ['ui.guild.name', 'site.name'],
  ['ui.guild.class', 'site.title'],
  ['ui.guild.years', 'guild.years'],
  ['ui.guild.guild', 'ledger.job1.company'],
  ['ui.guild.affinity', 'guild.affinity'],
  ['ui.guild.title', 'guild.title'],
];
const LANGS = ['zh', 'en', 'ja'];

function item(i18n, id, extra = {}) {
  const e = i18n.entry(id);
  if (!e) return null;
  return { id, text: e.text, kind: 'text', placeholder: e.status === 'todo', ...extra };
}

function block(items, head = {}) {
  const kept = items.filter(Boolean);
  return kept.length ? { ...head, items: kept } : null;
}

function heading(i18n, ids, sep = ' · ') {
  const parts = ids.map((id) => i18n.entry(id)).filter(Boolean);
  if (!parts.length) return {};
  return { heading: parts.map((p) => p.text).join(sep), headingPlaceholder: parts.some((p) => p.status === 'todo') };
}

const https = (s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

function link(i18n, id, toHref, extra = {}) {
  const it = item(i18n, id, { kind: 'link', ...extra });
  if (it && !it.placeholder) it.href = toHref(it.text.trim());
  return it;
}

// 帶小標的條目：標題來自另一個 ID（例如「守則標題：說明」）
function labelled(i18n, labelId, textId, extra = {}) {
  const lab = i18n.entry(labelId);
  return item(i18n, textId, { ...(lab ? { label: lab.text, labelPlaceholder: lab.status === 'todo' } : {}), ...extra });
}

// 只在第一個有內容的區塊放 kicker
function withKicker(blocks, kicker) {
  const kept = blocks.filter(Boolean);
  if (kept.length) kept[0] = { ...kept[0], kicker };
  return kept;
}

// 自己鍛造的魔導書（作品集）：每個小作品一個區塊，第一個區塊帶小標
function grimoires(i18n) {
  return withKicker(range(ORDERS).map((n) => block(
    [item(i18n, `orders.item${n}.desc`), link(i18n, `orders.item${n}.link`, https)],
    heading(i18n, [`orders.item${n}.title`]),
  )), i18n.t('ui.card.grimoire'));
}

const BUILDERS = {
  hearth: (i) => [
    block([item(i, 'hearth.profile')]),
    block(range(STORIES).map((n) => item(i, `hearth.story${n}`)), { heading: i.t('ui.card.story') }),
    block(range(CREEDS).map((n) => labelled(i, `hearth.creed${n}.title`, `hearth.creed${n}.desc`, { kind: 'list' })), { heading: i.t('ui.card.creed') }),
  ],
  armory: (i) => range(SKILLS).map((n) => block(
    [item(i, `armory.skill${n}.items`), item(i, `armory.skill${n}.core`, { label: i.t('ui.card.core') })],
    { kicker: i.t('ui.card.enchant'), accent: n, ...heading(i, [`armory.skill${n}.name`]) },
  )),
  anvil: (i) => [block(range(4).map((n) => item(i, `anvil.focus${n}`, { kind: 'list' })))],
  commissions: (i) => [
    ...range(3).map((n) => block(
      [
        item(i, `commission${n}.role`, { label: i.t('ui.card.role') }),
        item(i, `commission${n}.tags`, { label: i.t('ui.card.tags') }),
        ...['problem', 'decision', 'outcome'].map((k) => item(i, `commission${n}.${k}`, { label: i.t(`ui.card.${k}`) })),
      ],
      heading(i, [`commission${n}.title`]),
    )),
  ],
  // 冒險者公會卡：角色狀態欄位＋語言
  ledger: (i) => [
    block(GUILD_FIELDS.map(([label, id]) => item(i, id, { label: i.t(label) })), { sheet: true }),
    block(LANGS.map((l) => item(i, `ledger.lang.${l}`, { kind: 'list' })), { heading: i.t('ui.card.languages') }),
  ],
  // 魔導書架：開頭一句說明＋作品集；作品全部「不適用」時整張卡不顯示
  shelf: (i) => {
    const books = grimoires(i);
    return books.length ? [block([item(i, 'shelf.intro')]), ...books] : [];
  },
  mailbox: (i) => [block([
    link(i, 'contact.email', (s) => `mailto:${s}`),
    link(i, 'contact.linkedin', https),
    link(i, 'contact.github', https),
    item(i, 'site.location'),
    item(i, 'ui.btn.send', { kind: 'button' }),
  ], { heading: i.t('ui.card.contact') })],
};

export function cardModel(key, i18n) {
  const build = BUILDERS[key];
  if (!build) throw new Error(`unknown card: ${key}`);
  return { key, title: i18n.t(`ui.obj.${key}`), blocks: build(i18n).filter(Boolean) };
}

// 全部條目都是「不適用」的卡片（例如沒有文章的書架）不顯示
export function visibleCardKeys(i18n) {
  return CARD_KEYS.filter((k) => cardModel(k, i18n).blocks.length > 0);
}

// 卡片骨架一定要有的 ID（Excel 必須有這些列）。可整列設成「不適用」的選填內容不列在這裡。
export function ALL_CARD_IDS() {
  return [
    ...CARD_KEYS.map((k) => `ui.obj.${k}`),
    'hearth.profile',
    ...range(SKILLS).flatMap((n) => [`armory.skill${n}.name`, `armory.skill${n}.items`]),
    ...range(3).flatMap((n) => ['title', 'problem', 'decision', 'outcome'].map((k) => `commission${n}.${k}`)),
    'site.name', 'site.title', 'ledger.lang.zh', 'ledger.lang.en',
    ...GUILD_FIELDS.map(([label]) => label),
    'ui.card.problem', 'ui.card.decision', 'ui.card.outcome', 'ui.card.languages', 'ui.card.contact',
    'ui.card.story', 'ui.card.creed', 'ui.card.enchant', 'ui.card.core', 'ui.card.role', 'ui.card.tags', 'ui.card.grimoire',
    'contact.email', 'contact.linkedin', 'contact.github', 'site.location', 'ui.btn.send',
  ];
}

// 選填內容：可以整列設成「不適用」，卡片會自動略過
export function OPTIONAL_CARD_IDS() {
  return [
    ...range(STORIES).map((n) => `hearth.story${n}`),
    ...range(CREEDS).flatMap((n) => [`hearth.creed${n}.title`, `hearth.creed${n}.desc`]),
    ...range(SKILLS).map((n) => `armory.skill${n}.core`),
    ...range(4).map((n) => `anvil.focus${n}`),
    ...range(3).flatMap((n) => [`commission${n}.role`, `commission${n}.tags`]),
    ...range(ORDERS).flatMap((n) => ['title', 'desc', 'link'].map((k) => `orders.item${n}.${k}`)),
    'shelf.intro',
    'ledger.job1.company', 'guild.years', 'guild.affinity', 'guild.title', 'ledger.lang.ja',
  ];
}
