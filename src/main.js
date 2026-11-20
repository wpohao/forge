// 3D 版接線：場景、導覽、內容卡、UI。
import { createNav } from './nav.js';
import { createTapTracker } from './input.js';
import { pickTier, TIER_SETTINGS } from './quality.js';
import { cardModel, visibleCardKeys } from './cards.js';
import { renderCard } from './cardView.js';
import { setupI18n, applyChrome, bindLangButton, bindMailboxButton, setText } from './ui.js';
import { createAudio } from './audio.js';
import { fitView } from './framing.js';
import { resolvePick } from './pick.js';

const $ = (id) => document.getElementById(id);
const i18n = setupI18n();
const nav = createNav();
// 整張卡都是「不適用」時（例如沒放文章的書架），快捷列與室內物件都不提供入口
const VISIBLE = visibleCardKeys(i18n);

// ---------- UI 文字 ----------
function applyTexts() {
  applyChrome(i18n);
  setText('btn-plain', i18n.t('ui.btn.plain'));
  setText('btn-sound', i18n.t('ui.btn.sound'));
  setText('btn-sky', i18n.t('ui.btn.night'));
  setText('btn-forge-exit', i18n.t('ui.forge.exit'));
  setText('card-close', i18n.t('ui.btn.close'));
  setText('btn-exit', i18n.t('ui.btn.exit'));
  setText('qb-label', i18n.t('ui.quickbar'));
  setText('loader-text', i18n.t('ui.loading'));
  setText('fallback-text', i18n.t('ui.fallback'));
  setText('fallback-link', i18n.t('ui.btn.plain'));
  for (const b of $('quickbar').querySelectorAll('button[data-key]')) {
    b.textContent = i18n.t(`ui.obj.${b.dataset.key}`);
    b.hidden = !VISIBLE.includes(b.dataset.key);
  }
  setText('hint', hintText());
  if (nav.state === 'card') showCard(nav.card);
}

// 底部提示：島上、室內、第一人稱打鐵各一句
let forging = false;
function hintText() {
  if (forging) return i18n.t('ui.forge.hint');
  return i18n.t(nav.state === 'island' ? 'ui.hint.island' : 'ui.hint.inside');
}

// ---------- 內容卡 ----------
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}
const resetMailbox = bindMailboxButton($('card-body'), i18n, toast);
let lastFocus = null;
// 關卡片時延遲隱藏（等滑出動畫）。開卡片時一定要取消它，
// 否則進門後第一幀編譯 shader 很久，計時器會在卡片滑入前把它藏起來。
let hideTimer = 0;

function showCard(key) {
  const model = cardModel(key, i18n);
  $('card-title').textContent = model.title;
  renderCard(model, $('card-body'));
  const card = $('card');
  clearTimeout(hideTimer);
  if (!card.classList.contains('open')) {
    lastFocus = document.activeElement;
    card.hidden = false;
    void card.offsetWidth; // 先套用隱藏位置，再加 open 才有滑入動畫
    card.classList.add('open');
    $('card-close').focus({ preventScroll: true });
  }
  $('card-body').scrollTop = 0;
  updateScrollCue();
}

// 卡片捲動提示：上／下還有內容時才顯示（樣式見 site.css 的 .more-above／.more-below）
function updateScrollCue() {
  const b = $('card-body');
  const card = $('card');
  card.classList.toggle('more-above', b.scrollTop > 4);
  card.classList.toggle('more-below', b.scrollTop + b.clientHeight < b.scrollHeight - 4);
}
$('card-body').addEventListener('scroll', updateScrollCue, { passive: true });
window.addEventListener('resize', updateScrollCue);
if (document.fonts) document.fonts.ready.then(updateScrollCue);
function hideCard() {
  const card = $('card');
  card.classList.remove('open');
  $('toast').hidden = true;
  resetMailbox();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!card.classList.contains('open')) card.hidden = true; }, 350);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

function syncUi() {
  const inside = nav.state !== 'island';
  $('quickbar').hidden = false;
  measureTopbar();
  $('btn-exit').hidden = !inside;
  // 黃昏／夜晚只影響島上，室內不顯示切換鈕
  $('btn-sky').hidden = inside || !skyReady;
  document.body.classList.toggle('card-open', nav.state === 'card');
  // 第一人稱打鐵：藏起快捷列與「出門」，改顯示「放下鐵鎚」與打鐵進度
  document.body.classList.toggle('forging', forging);
  $('btn-forge-exit').hidden = !forging;
  $('forge-hud').hidden = !forging;
  setText('hint', hintText());
  if (nav.state === 'card') showCard(nav.card);
  else hideCard();
}

// ---------- 黃昏／夜晚 ----------
// 初始值：網址 ?sky=night|dusk 優先，其次是上次的選擇（localStorage），預設黃昏
let skyReady = false;
function initialSky() {
  const q = new URLSearchParams(location.search).get('sky');
  if (q === 'night' || q === 'dusk') return q;
  try { return localStorage.getItem('forge.sky') === 'night' ? 'night' : 'dusk'; } catch { return 'dusk'; }
}
function rememberSky(mode) {
  try { localStorage.setItem('forge.sky', mode); } catch { /* 無痕模式等，不記也沒關係 */ }
}

// ---------- 啟動 ----------
function detectTier() {
  let webgl = false;
  try { webgl = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl = false; }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 測試用：?tier=none|low|high 強制指定
  const forced = new URLSearchParams(location.search).get('tier');
  if (['none', 'low', 'high'].includes(forced)) return { tier: forced, reducedMotion };
  return {
    tier: pickTier({
      webgl,
      mobile: window.matchMedia('(pointer: coarse)').matches,
      cores: navigator.hardwareConcurrency || 4,
      reducedMotion,
    }),
    reducedMotion,
  };
}

function hideLoader() { $('loader').classList.add('done'); }

// 量頂列實際高度給 CSS（--topbar-h），內容卡才能在頂列下方與螢幕底之間上下等距；
// 也量快捷列佔掉的底部空間（--quickbar-space），窄螢幕時卡片停在快捷列上方，不會把它蓋住
// 量到的值也存在 chrome，島的取景（frameIsland）用同一組數字算可用區域
const chrome = { topbar: 56, quickbar: 0 };
function measureTopbar() {
  const root = document.documentElement.style;
  const kids = [...$('topbar').children].map((el) => el.getBoundingClientRect().bottom);
  chrome.topbar = Math.ceil(Math.max(0, ...kids));
  root.setProperty('--topbar-h', `${chrome.topbar}px`);
  const qb = $('quickbar');
  const space = qb.hidden ? 0 : Math.max(0, window.innerHeight - qb.getBoundingClientRect().top);
  chrome.quickbar = Math.ceil(space);
  root.setProperty('--quickbar-space', `${chrome.quickbar}px`);
}

bindLangButton(i18n);
i18n.onChange(applyTexts);
i18n.onChange(measureTopbar);
applyTexts();
measureTopbar();
window.addEventListener('resize', measureTopbar);
if (document.fonts) document.fonts.ready.then(measureTopbar);

// 3D 不可用、three.js 載入失敗、或 15 秒內畫不出第一幀 → 顯示備援（改看平面版）
let fellBack = false;
let firstFrame = false;
function showFallback(err) {
  if (err) console.error('[forge] 3D 無法啟動，改顯示備援畫面', err);
  fellBack = true;
  $('fallback').hidden = false;
  $('hint').hidden = true;
  $('quickbar').hidden = true;
  hideLoader();
}

const { tier, reducedMotion } = detectTier();
if (tier === 'none') {
  showFallback();
} else {
  // 視窗最小化或分頁在背景時瀏覽器會暫停繪圖，這段時間不算進「15 秒畫不出來」
  let waited = 0;
  const watchdog = setInterval(() => {
    if (firstFrame || fellBack) { clearInterval(watchdog); return; }
    if (document.visibilityState === 'visible') waited += 500;
    if (waited >= 15000) { clearInterval(watchdog); showFallback(new Error('timeout')); }
  }, 500);
  start(TIER_SETTINGS[tier]).catch(showFallback);
}

async function start(settings) {
  // three.js 走 CDN：動態載入，失敗時 UI 與語言切換仍可用
  const [THREE, { createStage }, { buildIsland }, { buildInterior }, { createCameraRig }, { createSparks, setSkyMode }] = await Promise.all([
    import('three'), import('./scene/stage.js'), import('./scene/island.js'),
    import('./scene/interior.js'), import('./scene/cameraRig.js'), import('./scene/effects.js'),
  ]);
  if (fellBack) return;
  const container = $('scene');
  let sky = initialSky();
  setSkyMode(sky);
  const stage = createStage(container, settings);
  const island = buildIsland(settings);
  const interior = buildInterior(settings);
  interior.interactive = interior.interactive.filter((g) => VISIBLE.includes(g.userData.key));
  const rig = createCameraRig(stage.camera, stage.renderer.domElement);
  rig.setReducedMotion(reducedMotion);
  const raycaster = new THREE.Raycaster();
  let current = island;

  // 島：依頂列與快捷列之間的可用區域取景，整座島（含岩底）都看得到、不被快捷列蓋住。
  // 用 setViewOffset 把投影中心移到可用區域中央，旋轉仍繞著島心，點擊射線也跟著一致。
  const ISLAND_FILL = 0.82;
  const ISLAND_FILL_NARROW = 0.9;
  const islandTarget = new THREE.Vector3();
  let islandDistance = 22;
  function frameIsland(dir) {
    const cam = stage.camera;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const wide = w > 720;
    // 寬螢幕的頂列只佔左右兩角，島在中間，上緣只留小邊距；窄螢幕頂列橫跨整排，要避開
    const safe = {
      top: wide ? 16 : chrome.topbar + 8,
      bottom: h - chrome.quickbar - (wide ? 16 : 10),
      left: wide ? 24 : 8,
      right: w - (wide ? 24 : 8),
    };
    const home = island.cameraHome.target;
    const fit = fitView({
      points: island.framePoints, target: home.toArray(), dir: dir.toArray(),
      fovDeg: cam.fov, aspect: cam.aspect, viewport: { w, h }, safe, yRange: [-4, 3],
      // 島不撐滿可用區域，四周留白、鏡頭拉遠，背景遠景露得多，空間比較開闊（窄螢幕左右本來就緊，留少一點）
      fill: wide ? ISLAND_FILL : ISLAND_FILL_NARROW,
    });
    cam.setViewOffset(w, h, fit.offsetX, fit.offsetY, w, h);
    islandTarget.set(home.x, fit.targetY, home.z);
    islandDistance = fit.distance;
    cam.position.copy(islandTarget).addScaledVector(dir, fit.distance);
    cam.lookAt(islandTarget);
    return islandTarget;
  }
  function goHome(place) {
    const { position, target } = place.cameraHome;
    // 島與室內都用廣角（52°），空間感比較大，進出門時視角也不會跳
    stage.camera.userData.baseFov = place.fov ?? 42;
    stage.onResize();
    if (place === island) return frameIsland(position.clone().sub(target).normalize());
    stage.camera.clearViewOffset();
    stage.camera.position.copy(position);
    stage.camera.lookAt(target);
    return target;
  }
  const islandMode = () => rig.setMode('island', islandTarget, { distance: islandDistance });
  // 取景要用快捷列的實際高度：先讓它顯示再量
  $('quickbar').hidden = false;
  measureTopbar();
  goHome(island);
  islandMode();
  // 視窗大小改變、字型載入完（頂列高度會變）：島上保留使用者目前的方位，重新取景
  const reframe = () => {
    if (current !== island || rig.flying || nav.busy) return;
    measureTopbar();
    frameIsland(stage.camera.position.clone().sub(rig.controls.target).normalize());
    islandMode();
  };
  window.addEventListener('resize', reframe);
  if (document.fonts) document.fonts.ready.then(reframe);
  stage.setScene(island.scene);
  const audio = createAudio();
  const sparks = createSparks(Math.round(80 * settings.particles + 20));
  island.scene.add(sparks.points);
  // 室內小互動的特效與音效
  // 打鐵進度：已敲幾下就亮幾顆，顏色是下一個附魔
  function showForgeProgress(count, per, kind) {
    const hud = $('forge-hud');
    hud.dataset.kind = String(kind);
    [...hud.children].forEach((s, i) => s.classList.toggle('on', i < count && count < per));
  }
  // 附魔成功：畫面中央浮出半透明大字（附魔名稱＋對應的技能類別），約 2.8 秒後淡出
  let bannerTimer = 0;
  function showEnchantBanner(kind) {
    const b = $('enchant-banner');
    b.dataset.kind = String(kind);
    b.querySelector('.eb-main').textContent = i18n.t(`ui.forge.enchant${kind + 1}`);
    b.querySelector('.eb-sub').textContent = i18n.t(`armory.skill${kind + 1}.name`);
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth; // 重新觸發動畫
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.classList.remove('show'); b.hidden = true; }, 3000);
  }
  interior.setFx({
    burst: (p, n) => sparks.burst(p, n),
    sound: (name, arg) => (name === 'hammer' ? audio.hammer() : audio.play(name, arg)),
    forgeProgress: showForgeProgress,
    enchanted: showEnchantBanner,
  });
  const label = $('obj-label');
  // 滑鼠指著的東西：{ key（內容物件）, prop（小互動）, weapon（兵器架第幾件）}
  let hover = null;
  const setHover = (h) => {
    hover = current === interior && h ? h : null;
    interior.setHover(hover?.key ?? null, hover?.weapon ?? -1);
    if (!hover) label.hidden = true;
  };

  const flash = (on) => new Promise((r) => { $('flash').classList.toggle('on', on); setTimeout(r, 360); });

  async function enterForge(thenOpen) {
    if (nav.busy || nav.state !== 'island') return;
    nav.beginTransition();
    const door = island.doorTarget.clone();
    const approach = door.clone().add(new THREE.Vector3(0, 0.4, 2.2));
    await rig.flyTo(approach, door, reducedMotion ? 1 : 900);
    await flash(true);
    current = interior;
    stage.setScene(interior.scene);
    interior.scene.add(sparks.points);
    goHome(interior);
    rig.setMode('interior', interior.cameraHome.target);
    nav.endTransition();
    nav.enter();
    if (thenOpen) nav.open(thenOpen);
    await flash(false);
  }

  async function leaveForge() {
    if (nav.busy) return;
    nav.beginTransition();
    await flash(true);
    current = island;
    setHover(null);
    stage.setScene(island.scene);
    island.scene.add(sparks.points);
    goHome(island);
    islandMode();
    nav.endTransition();
    if (nav.state === 'card') nav.back();
    nav.back();
    await flash(false);
  }

  // 第一人稱打鐵：鏡頭飛到鐵砧前方，鐵鎚跟著游標；Esc 或「放下鐵鎚」回到室內視角
  async function startForging() {
    if (forging || nav.busy || nav.state !== 'interior') return;
    nav.beginTransition();
    setHover(null);
    container.classList.remove('pointer');
    const view = interior.forgeView;
    await rig.flyTo(view.position, view.target, reducedMotion ? 1 : 750);
    interior.enterForgeMode();
    rig.setMode('forge', view.target);
    forging = true;
    nav.endTransition();
    syncUi();
  }

  async function stopForging() {
    if (!forging || nav.busy) return;
    nav.beginTransition();
    forging = false;
    interior.exitForgeMode();
    syncUi();
    const home = interior.cameraHome;
    await rig.flyTo(home.position, home.target, reducedMotion ? 1 : 650);
    goHome(interior);
    rig.setMode('interior', home.target);
    nav.endTransition();
  }

  function goBack() {
    if (nav.busy) return;
    if (forging) stopForging();
    else if (nav.state === 'card') nav.back();
    else if (nav.state === 'interior') leaveForge();
  }

  function openCard(key) {
    if (!VISIBLE.includes(key) || forging) return;
    if (nav.state === 'island') enterForge(key);
    else nav.open(key);
  }

  // 室內小互動：交給 interior.poke，需要接著開卡（例如魔導書）時稍等動畫再開
  function pokeProp(name, obj) {
    if (current !== interior) return;
    const r = interior.poke(name, obj ?? interior.propByName(name));
    if (r?.forge) { startForging(); return; }
    if (!r?.open || !VISIBLE.includes(r.open)) return;
    setTimeout(() => {
      if (current === interior && !nav.busy) openCard(r.open);
    }, reducedMotion ? 0 : r.delay ?? 0);
  }

  // ---------- 指標 ----------
  const pointer = new THREE.Vector2();
  // 室內同時打「內容物件」與「小互動」，規則見 pick.js
  const interiorTargets = [...interior.interactive, ...interior.props];
  function pick(ev) {
    const r = stage.renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, stage.camera);
    const targets = current === interior ? interiorTargets : current.interactive;
    return resolvePick(raycaster.intersectObjects(targets, true));
  }

  const taps = createTapTracker();
  const canvas = stage.renderer.domElement;
  const pt = (ev) => ({ id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now() });
  // 打鐵時：游標（或手指點的位置）就是鐵鎚要落下的地方
  function forgeAimAt(ev) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, stage.camera);
    interior.forgeAim(raycaster.ray);
  }
  canvas.addEventListener('pointerdown', (ev) => {
    taps.down(pt(ev));
    if (forging && !nav.busy) forgeAimAt(ev);
  });
  canvas.addEventListener('pointercancel', (ev) => taps.cancel(ev.pointerId));
  canvas.addEventListener('pointerup', (ev) => {
    const tap = taps.up(pt(ev));
    // 右鍵／中鍵是平移與縮放，不算點擊
    if (!tap || nav.busy || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    if (forging) { forgeAimAt(ev); interior.forgeStrike(); return; }
    const hit = pick(ev);
    if (!hit) { hammerAt(ev); return; }
    if (hit.prop) pokeProp(hit.prop, hit.obj);
    else if (hit.key === 'door') enterForge();
    else openCard(hit.key);
  });
  // 點空白處：一記錘擊，噴出火星（音效開啟時有錘聲）
  function hammerAt(ev) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, stage.camera);
    const hit = raycaster.intersectObjects(current.scene.children, true)
      .find((h) => h.object.isMesh && !h.object.userData.hitbox && !h.object.material.isShaderMaterial && h.distance < 60);
    if (!hit) return;
    sparks.burst(hit.point.clone().add(new THREE.Vector3(0, 0.05, 0)), 26);
    audio.hammer();
  }
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || nav.busy) return;
    if (forging) { forgeAimAt(ev); return; }
    const hit = pick(ev);
    container.classList.toggle('pointer', !!hit);
    if (hit?.key === 'armory') hit.weapon = interior.weaponAt(hit.point);
    setHover(hit);
  });
  canvas.addEventListener('pointerleave', () => setHover(null));

  // ---------- 按鈕與鍵盤 ----------
  $('card-close').addEventListener('click', () => nav.back());
  $('btn-exit').addEventListener('click', () => leaveForge());
  $('btn-forge-exit').addEventListener('click', () => stopForging());
  $('quickbar').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-key]');
    if (b) openCard(b.dataset.key);
  });
  const syncSkyBtn = () => $('btn-sky').setAttribute('aria-pressed', String(sky === 'night'));
  syncSkyBtn();
  skyReady = true;
  $('btn-sky').addEventListener('click', () => {
    sky = sky === 'night' ? 'dusk' : 'night';
    setSkyMode(sky);
    rememberSky(sky);
    syncSkyBtn();
  });
  $('btn-sound').addEventListener('click', () => {
    const b = $('btn-sound');
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    audio.setEnabled(on);
  });
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') goBack(); });
  nav.onChange(syncUi);
  syncUi();

  // ---------- 主迴圈 ----------
  const clock = new THREE.Clock();
  let first = true;
  stage.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    current.update(reducedMotion ? 0 : t, dt);
    sparks.update(dt, t);
    if (!rig.flying && rig.mode !== 'forge') rig.controls.update();
    // 物件名稱標籤跟著物件；小互動只有鐵砧上的鐵鎚有提示（「敲打」），其他靠游標變手指
    const labelKey = hover && nav.state === 'interior' ? (hover.key ?? (hover.prop === 'hammer' ? 'hammer' : null)) : null;
    if (labelKey) {
      const v = interior.labelAnchor(labelKey).project(stage.camera);
      const r = canvas.getBoundingClientRect();
      label.textContent = i18n.t(hover.key ? `ui.obj.${labelKey}` : 'ui.prop.hammer');
      label.style.left = `${r.left + (v.x + 1) / 2 * r.width}px`;
      label.style.top = `${r.top + (1 - v.y) / 2 * r.height}px`;
      label.hidden = false;
    } else label.hidden = true;
    stage.render();
    if (first) { first = false; firstFrame = true; hideLoader(); }
  });

  // 測試與除錯用
  window.__forge = {
    nav, enterForge, leaveForge, openCard, goBack, audio, sparks, camera: stage.camera, rig, interior,
    hover: (key, weapon = -1) => setHover(key ? { key, prop: null, weapon } : null),
    // 模擬點擊室內小互動（bellows、lamp、tome、tools、hammer、cat、smith、archer）
    poke: (name) => pokeProp(name),
    startForging, stopForging,
    get forging() { return forging; },
    // 模擬打鐵：在螢幕座標 (x, y) 敲一下
    forgeStrikeAt(x, y) { forgeAimAt({ clientX: x, clientY: y }); interior.forgeStrike(); },
    get scene() { return current.scene; },
    camDistToDoor: () => stage.camera.position.distanceTo(island.doorTarget),
    // 除錯：螢幕座標打到的第一個物件與世界座標
    probe(x, y) {
      const r = canvas.getBoundingClientRect();
      pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, stage.camera);
      // 粒子（Points）會擋在前面，略過
      const hit = raycaster.intersectObjects(current.scene.children, true).find((h) => h.object.isMesh);
      return hit ? { type: hit.object.type, geo: hit.object.geometry.type, mat: hit.object.material.type, hitbox: !!hit.object.userData.hitbox, p: hit.point.toArray().map((v) => +v.toFixed(2)) } : null;
    },
    // 螢幕座標會點到什麼（與實際點擊同一套規則）
    pickAt(x, y) {
      const h = pick({ clientX: x, clientY: y });
      return h ? { key: h.key, prop: h.prop } : null;
    },
    // 回傳某個可互動物件在螢幕上的座標（給自動化測試點擊用）
    screenPos(key) {
      const place = current;
      const obj = place === island
        ? island.interactive.find((o) => o.userData.key === key)
        : interior.hotspots.get(key) ?? interior.propByName(key);
      if (!obj) return null;
      const box = new THREE.Box3().setFromObject(obj);
      const v = box.getCenter(new THREE.Vector3()).project(stage.camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
  };
}
