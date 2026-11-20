// cardModel → DOM。文字一律用 textContent，絕不用 innerHTML 插入內容。
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderItem(it) {
  let node;
  if (it.kind === 'link' && it.href) {
    node = el('a', 'card-link', it.text);
    node.href = it.href;
    if (!it.href.startsWith('mailto:')) { node.target = '_blank'; node.rel = 'noopener'; }
  } else if (it.kind === 'button') {
    node = el('button', 'card-btn', it.text);
    node.type = 'button';
    node.dataset.action = it.id;
  } else {
    node = el(it.kind === 'list' ? 'li' : 'p', 'card-text');
    if (it.label) node.append(el('strong', it.labelPlaceholder ? 'label ph' : 'label', it.label), document.createTextNode(' '));
    node.append(el('span', it.placeholder ? 'ph' : null, it.text));
    return node;
  }
  if (it.placeholder) node.classList.add('ph');
  if (it.list) {
    const li = el('li', 'card-text');
    li.append(node);
    return li;
  }
  return node;
}

const isListy = (it) => it.kind === 'list' || it.list;

export function renderBlocks(model, container) {
  container.replaceChildren();
  for (const b of model.blocks) {
    const sec = el('section', 'card-block');
    if (b.accent) sec.dataset.accent = String(b.accent);
    // 公會卡：欄位表畫成一張有邊框的卡（樣式見 site.css 的 .card-block.sheet）
    if (b.sheet) sec.classList.add('sheet');
    if (b.kicker) sec.append(el('p', 'card-kicker', b.kicker));
    if (b.heading) sec.append(el('h3', b.headingPlaceholder ? 'card-h ph' : 'card-h', b.heading));
    let list = null;
    for (const it of b.items) {
      const node = renderItem(it);
      if (isListy(it)) {
        if (!list) { list = el('ul', 'card-list'); sec.append(list); }
        list.append(node);
      } else {
        list = null;
        sec.append(node);
      }
    }
    container.append(sec);
  }
}

export function renderCard(model, container) {
  renderBlocks(model, container);
}
