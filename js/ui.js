// The screen around the world: hearts, the stamina wheel, gear, clock and weather, the minimap, prompts and notices,
// conversations, and the menus (inventory, map with fast travel, cooking, the shop, the goddess statue, settings).
import { T, EN, setLang } from './i18n.js';
import { WEAPONS, BOWS, SHIELDS, OUTFITS, MATS, ARROW_PRICE, cook, itemDef } from './items.js';
import { W, POI, REGIONS, regionAt, SPOT, CASTLE, VILLAGE } from './world.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const btn = (label, fn, cls = '') => { const b = el('button', cls, label); b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
export const name = (id) => { const d = itemDef(id); return d ? T(d.name) : id; };
// little drawn icons for every kind of gear, tinted with the item's colour
export function icon(id) {
  const w = WEAPONS[id], b = BOWS[id], s = SHIELDS[id], m = MATS[id], c = (w || b || s || m || {}).col || '#ccc';
  const wrap = (inner) => `<svg viewBox="0 0 40 40">${inner}</svg>`, st = 'stroke="#141018" stroke-width="2" stroke-linejoin="round"';
  if (w && (id === 'w_branch' || id === 'w_torch' || id.includes('club') || id === 'w_spiked' || id === 'w_dragonbone')) return wrap(`<path d="M10 33 L28 9" stroke="#141018" stroke-width="8" stroke-linecap="round"/><path d="M10 33 L28 9" stroke="${c}" stroke-width="5" stroke-linecap="round"/>${id === 'w_torch' ? '<circle cx="29" cy="8" r="6" fill="#ffb040" stroke="#141018" stroke-width="2"/>' : ''}`);
  if (w && w.kind === 'spear') return wrap(`<path d="M7 35 L30 10" stroke="#141018" stroke-width="5"/><path d="M7 35 L30 10" stroke="#8a5a2a" stroke-width="2.5"/><path d="M28 6 L36 4 L34 12 L27 14 Z" fill="${c}" ${st}/>`);
  if (w && id === 'w_axe') return wrap(`<path d="M10 35 L27 10" stroke="#141018" stroke-width="5"/><path d="M10 35 L27 10" stroke="#8a5a2a" stroke-width="2.5"/><path d="M22 6 Q34 6 34 18 L26 14 Z" fill="#b0b8c0" ${st}/>`);
  if (w) { const k = w.kind === 'two' ? 1.3 : 1; return wrap(`<path d="M${20 - 3 * k} 30 L${20 - 3 * k} ${8 - 2 * k} L20 ${3 - 2 * k} L${20 + 3 * k} ${8 - 2 * k} L${20 + 3 * k} 30 Z" fill="${c}" ${st}/><rect x="11" y="29" width="18" height="4" rx="1" fill="#d8b040" ${st}/><rect x="18" y="33" width="4" height="5" fill="#6a4426" ${st}/>`); }
  if (b) return wrap(`<path d="M12 4 Q34 20 12 36" fill="none" stroke="#141018" stroke-width="6"/><path d="M12 4 Q34 20 12 36" fill="none" stroke="${c}" stroke-width="3.5"/><path d="M12 4 L12 36" stroke="#f0f0f0" stroke-width="1.2"/>`);
  if (s) return wrap(id === 's_potlid' ? `<circle cx="20" cy="20" r="14" fill="${c}" ${st}/><circle cx="20" cy="20" r="3" fill="#5a4a3a"/>` : `<path d="M8 6 L32 6 L32 18 Q32 32 20 37 Q8 32 8 18 Z" fill="${c}" ${st}/><path d="M20 8 L20 34" stroke="#e8d8a0" stroke-width="3"/>`);
  if (m) return wrap(`<circle cx="20" cy="22" r="11" fill="${c}" ${st}/><path d="M20 11 Q24 5 28 7" fill="none" stroke="#3a7a2a" stroke-width="2.5"/>`);
  return wrap(`<circle cx="20" cy="20" r="10" fill="${c}" ${st}/>`);
}
// the control hints in the corner: [[key, label, hot]]
let hintKey = '';
export function hints(list) {
  const k = JSON.stringify(list); if (k === hintKey) return; hintKey = k;
  $('#hints').innerHTML = list.map(([key, label, hot]) => `<div class="${hot ? 'hot' : ''}"><kbd class="${/click|左鍵|右鍵|滾輪|Wheel|Click/.test(key) ? 'm' : ''}">${esc(key)}</kbd>${esc(label)}</div>`).join('');
}
// quick select: a row of icons with the current one highlighted, shown for a moment
let quickT = null;
export function quick(list, cur, defs) {
  const q = $('#quick'); q.innerHTML = list.map((it, i) => `<div class="q${i === cur ? ' on' : ''}">${icon(it.id)}<div class="bar"><i style="width:${Math.max(4, (it.dur / defs[it.id].dur) * 100)}%"></i></div></div>`).join('');
  q.classList.add('on'); clearTimeout(quickT); quickT = setTimeout(() => q.classList.remove('on'), 1400);
}
// a tip card that slides in once
let tipT = null;
export function tip(title, text) { const t = $('#tip'); t.innerHTML = `<b>${esc(T(title))}</b>${T(text)}`; t.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(() => t.classList.remove('on'), 9000); }
let G = null;

export function initUI(game) { G = game; }

// ---------------------------------------------------------------- the HUD
let lastHearts = '', lastGear = '', miniT = 0;
export function hud(dt) {
  const S = G.S;
  const hk = `${S.hearts},${S.maxHearts},${S.extra}`;
  if (hk !== lastHearts) {
    lastHearts = hk; let h = '';
    for (let i = 0; i < S.maxHearts; i++) h += heart(Math.max(0, Math.min(4, S.hearts - i * 4)), false);
    for (let i = 0; i < Math.ceil(S.extra / 4); i++) h += heart(Math.max(0, Math.min(4, S.extra - i * 4)), true);
    $('#hearts').innerHTML = h;
  }
  const w = S.weapons[S.eq.w], b = S.bows[S.eq.b], s = S.shields[S.eq.s];
  const gk = JSON.stringify([w, b, s, S.arrows, S.rune, S.runes, G.gift && G.gift()]);
  if (gk !== lastGear) {
    lastGear = gk;
    const bar = (it, def) => (it ? `<i style="width:${Math.max(4, (it.dur / def.dur) * 100)}%;background:${it.dur / def.dur < 0.25 ? '#ff6a4a' : '#9ae86a'}"></i>` : '');
    const runeIcon = { magnet: '🧲', bomb: '💣', ice: '🧊', stasis: '⏳' };
    $('#gear').innerHTML = `
      <div class="slot rune">${S.rune ? `${runeIcon[S.rune]}<small>${T(RUNE_NAME[S.rune])}</small>` : '<small>—</small>'}</div>
      <div class="slot">${w ? icon(w.id) : '✊'}<small>${w ? esc(name(w.id)) : T('空手', 'Bare hands')}</small><b class="dur">${bar(w, w && WEAPONS[w.id])}</b></div>
      <div class="slot">${b ? icon(b.id) : '—'}<small>${b ? `🏹 ${S.arrows}` : T('沒有弓', 'No bow')}</small><b class="dur">${bar(b, b && BOWS[b.id])}</b></div>
      <div class="slot">${s ? icon(s.id) : '—'}<small>${s ? esc(name(s.id)) : T('沒有盾', 'No shield')}</small><b class="dur">${bar(s, s && SHIELDS[s.id])}</b></div>
      ${G.gift && G.gift() ? `<div class="slot gift">${G.gift()}</div>` : ''}`;
  }
  const hh = Math.floor(S.time), mm = Math.floor((S.time % 1) * 60);
  $('#clock').innerHTML = `${S.rain ? '🌧' : S.time > 6 && S.time < 19 ? '☀' : '☾'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${G.cold() ? '<b class="cold">❄</b>' : ''}${S.coldFx > 0 ? '<b class="warm">🔥</b>' : ''}`;
  // the stamina wheel sits beside you when it is not full
  const P = G.player(), cv = $('#stam'), full = P.stamina >= G.stamMax() - 0.001 && !P.exhausted;
  G.stamFade = full ? Math.max(0, (G.stamFade || 0) - dt) : 1.2;
  cv.style.opacity = Math.min(1, G.stamFade);
  if (G.stamFade > 0) {
    const sp = G.screenOf(P.x, P.y + 1.9, P.z); cv.style.transform = `translate(${sp[0] + 34}px, ${sp[1] - 40}px)`;
    const c = cv.getContext('2d'), wheels = G.stamMax(); c.clearRect(0, 0, 64, 64);
    for (let k = 0; k < Math.ceil(wheels - 0.001); k++) {
      const r = 20 - k * 7, cap = Math.min(1, wheels - k), val = Math.max(0, Math.min(cap, P.stamina - k));
      c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(32, 32, r, -Math.PI / 2, -Math.PI / 2 + cap * Math.PI * 2); c.stroke();
      c.strokeStyle = P.exhausted ? '#ff6a3a' : '#7aea5a'; c.beginPath(); c.arc(32, 32, r, -Math.PI / 2, -Math.PI / 2 + val * Math.PI * 2); c.stroke();
    }
  }
  miniT -= dt; if (miniT <= 0) { miniT = 0.2; minimap(); }
}
const RUNE_NAME = { magnet: ['磁力', 'Magnet'], bomb: ['炸彈', 'Bomb'], ice: ['製冰', 'Ice Pillar'], stasis: ['靜止', 'Stasis'] };
export { RUNE_NAME };
function heart(q, extra) {
  const f = q / 4, id = 'h' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 24 22" class="heart${extra ? ' extra' : ''}"><defs><clipPath id="${id}"><rect x="0" y="0" width="${24 * f}" height="22"/></clipPath></defs>
    <path d="M12 21 C-6 9 4 -3 12 5 C20 -3 30 9 12 21Z" fill="rgba(0,0,0,.45)" stroke="#fff" stroke-width="1.4"/>
    <path d="M12 21 C-6 9 4 -3 12 5 C20 -3 30 9 12 21Z" fill="${extra ? '#ffd040' : '#ff4a5a'}" clip-path="url(#${id})"/></svg>`;
}
// ---------------------------------------------------------------- the minimap
function minimap() {
  const cv = $('#mini'); if (!cv || cv.offsetParent === null) return;
  const c = cv.getContext('2d'), P = G.player(), pic = G.mapPicture(), n = pic.width, S = G.S, R = 90, scale = 1.4;      // pixels per map cell
  c.save(); c.clearRect(0, 0, 180, 180); c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.clip();
  if (G.inShrine()) { c.fillStyle = '#0a1420'; c.fillRect(0, 0, 180, 180); }
  else {
    const px = (P.x + W.half) / W.cell, pz = (P.z + W.half) / W.cell;
    c.imageSmoothingEnabled = false; c.drawImage(revealed(), px - R / scale, pz - R / scale, (R * 2) / scale, (R * 2) / scale, 0, 0, 180, 180);
    const mark = (x, z, col, sz = 4) => { const mx = R + ((x - P.x) / W.cell) * scale, mz = R + ((z - P.z) / W.cell) * scale; if (Math.hypot(mx - R, mz - R) > R - 6) return; c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.arc(mx, mz, sz, 0, 7); c.fill(); c.stroke(); };
    for (const t of POI.towers) mark(t.x, t.z, S.towers[t.id] ? '#40c8ff' : '#ff9a3a', 4.5);
    for (const s of POI.shrines) if (S.shrines[s.id]) mark(s.x, s.z, S.shrines[s.id] === 2 ? '#40c8ff' : '#ff9a3a', 3.5);
    for (const s of POI.greats) if (S.flags.quest || S.shrines[s.id]) mark(s.x, s.z, S.shrines[s.id] === 2 ? '#40c8ff' : '#ff3a7a', 4.5);
    for (const e of G.enemies()) if (!e.dead && e.state !== 'idle' && e.type !== 'boar') mark(e.x, e.z, '#ff3a3a', 2.5);
    if (S.pin) mark(S.pin[0], S.pin[1], '#ffe040', 4);
  }
  c.restore();
  c.save(); c.translate(R, R); c.rotate(-P.yaw + Math.PI); c.fillStyle = '#ffe040'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('N', R, 15);
}
// the map: regions you have not yet revealed from their tower are blank parchment
let regionGrid = null, revCanvas = null, revKey = '';
function revealed() {
  const S = G.S, key = Object.keys(S.towers).sort().join(); if (revCanvas && key === revKey) return revCanvas;
  const pic = G.mapPicture(), n = pic.width;
  if (!regionGrid) { regionGrid = new Uint8Array(n * n); const ids = REGIONS.map((r) => r.id); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) regionGrid[j * n + i] = ids.indexOf(regionAt(-W.half + i * W.cell, -W.half + j * W.cell)); }
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(pic, 0, 0);
  const img = g.getImageData(0, 0, n, n), open = REGIONS.map((r) => !!S.towers['t_' + r.id]);
  for (let k = 0; k < n * n; k++) if (!open[regionGrid[k]]) { const v = 200 + ((k * 7919) % 23); img.data[k * 4] = v; img.data[k * 4 + 1] = v - 18; img.data[k * 4 + 2] = v - 52; }
  g.putImageData(img, 0, 0); revCanvas = c; revKey = key; return c;
}

// ---------------------------------------------------------------- prompts and notices
let promptText = null;
export function prompt(t) { if (t === promptText) return; promptText = t; const p = $('#prompt'); p.innerHTML = t ? `${G.touch ? '✋ ' : '<kbd>E</kbd>'}${esc(t)}` : ''; p.style.display = t ? 'block' : 'none'; const b = $('#t-act'); if (b) b.style.display = t ? 'flex' : 'none'; }
export function toast(t, big) { const d = el('div', 'toast' + (big ? ' big' : ''), t); $('#toasts').appendChild(d); setTimeout(() => d.classList.add('out'), big ? 2600 : 1800); setTimeout(() => d.remove(), big ? 3200 : 2400); }
let bannerT = null;
export function banner(title, sub = '') { const b = $('#banner'); b.innerHTML = `<div>${esc(title)}</div>${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 3200); }
export function reticle(on, hot) { const r = $('#reticle'); r.style.display = on ? 'block' : 'none'; r.classList.toggle('hot', !!hot); }

// ---------------------------------------------------------------- conversations
let talkDone = null, choiceDone = null;
export const talking = () => !$('#dialog').classList.contains('hidden');
export function say(who, text) {
  return new Promise((res) => {
    const d = $('#dialog'); d.classList.remove('hidden'); d.innerHTML = `${who ? `<div class="who">${esc(T(who))}</div>` : ''}<div class="txt">${esc(T(text))}</div><div class="more">▼</div>`;
    talkDone = () => { talkDone = null; d.classList.add('hidden'); res(); };
  });
}
export function ask(who, text, options) {
  return new Promise((res) => {
    const d = $('#dialog'); d.classList.remove('hidden'); d.innerHTML = `${who ? `<div class="who">${esc(T(who))}</div>` : ''}<div class="txt">${esc(T(text))}</div>`;
    const box = el('div', 'choices'); options.forEach((o, i) => box.appendChild(btn(esc(T(o)), () => { choiceDone = null; d.classList.add('hidden'); res(i); }))); d.appendChild(box);
    choiceDone = (i) => { const b = box.children[i]; if (b) b.click(); };
  });
}
export function advance() { if (talkDone) { talkDone(); return true; } return false; }
$('#dialog') && $('#dialog').addEventListener('click', () => advance());

// ---------------------------------------------------------------- menus
export const menuOpen = () => !$('#menu').classList.contains('hidden');
export function closeMenu() { $('#menu').classList.add('hidden'); $('#menu').innerHTML = ''; G.paused = false; }
function frame(title, tabs, cur, body) {
  const m = $('#menu'); m.classList.remove('hidden'); m.innerHTML = ''; G.paused = true;
  const win = el('div', 'win'), head = el('div', 'head');
  head.appendChild(el('h2', '', esc(title)));
  if (tabs) { const t = el('div', 'tabs'); for (const [k, l] of tabs) t.appendChild(btn(esc(T(l)), () => openMenu(k), k === cur ? 'on' : '')); head.appendChild(t); }
  head.appendChild(btn('✕', closeMenu, 'x')); win.appendChild(head);
  const b = el('div', 'body'); body(b); win.appendChild(b); m.appendChild(win);
}
const TABS = [['weapons', ['武器', 'Weapons']], ['bows', ['弓', 'Bows']], ['shields', ['盾', 'Shields']], ['outfits', ['服裝', 'Outfits']], ['mats', ['素材', 'Materials']], ['food', ['料理', 'Food']], ['key', ['重要', 'Key Items']], ['map', ['地圖', 'Map']], ['system', ['系統', 'System']]];
export function openMenu(tab = 'weapons') {
  const S = G.S;
  if (tab === 'map') return mapMenu();
  if (tab === 'system') return systemMenu();
  frame(T('背包', 'Inventory') + `   💰 ${S.gold}`, TABS, tab, (b) => {
    const grid = el('div', 'grid');
    const card = (label, sub, on, onClick, extra = '', id = null) => { const c = el('div', 'card' + (on ? ' on' : ''), `${id ? `<div class="ic">${icon(id)}</div>` : ''}<div class="tx"><b>${label}</b><small>${sub}</small>${extra}</div>`); c.onclick = onClick; grid.appendChild(c); return c; };
    const durBar = (it, def) => `<i class="dur"><i style="width:${Math.max(4, (it.dur / def.dur) * 100)}%"></i></i>`;
    if (tab === 'weapons' || tab === 'bows' || tab === 'shields') {
      const list = tab === 'weapons' ? S.weapons : tab === 'bows' ? S.bows : S.shields, DEF = tab === 'weapons' ? WEAPONS : tab === 'bows' ? BOWS : SHIELDS, k = tab[0];
      b.appendChild(el('p', 'sm', `${T('欄位', 'Slots')} ${list.length} / ${S.slots[k]}`));
      b.appendChild(el('p', 'sm', T('點一下裝備或丟棄。遊戲中用滑鼠滾輪快速切換武器。', 'Click to equip or drop. In the field, the mouse wheel switches weapons quickly.')));
      list.forEach((it, i) => { const d = DEF[it.id]; card(esc(T(d.name)), tab === 'shields' ? `${T('防禦', 'Guard')} ${d.guard}` : `${T('攻擊', 'Attack')} ${d.pow}${d.kind === 'two' ? T(' · 雙手', ' · two-handed') : d.kind === 'spear' ? T(' · 長槍', ' · spear') : ''}`, S.eq[k] === i, () => itemAct(k, i), durBar(it, d), it.id); });
      if (tab === 'bows') b.appendChild(el('p', 'sm', `🏹 ${T('箭', 'Arrows')} × ${S.arrows}`));
    } else if (tab === 'outfits') {
      for (const id of S.outfits) { const o = OUTFITS[id]; card(esc(T(o.name)), `${T('防禦', 'Defence')} ${o.def}${o.perk ? ' · ' + esc(T(o.perk)) : ''}`, S.outfit === id, () => { S.outfit = id; G.gearChanged(); openMenu('outfits'); }); }
    } else if (tab === 'mats') {
      for (const [id, n] of Object.entries(S.mats)) if (n > 0) { const m = MATS[id]; card(`${esc(T(m.name))} ×${n}`, m.food ? `❤ ${(m.heal / 4).toFixed(2).replace(/\.?0+$/, '')}${m.fx ? ' · ' + fxName(m.fx) : ''}` : `💰 ${m.price}`, false, () => m.food && eatRaw(id), '', id); }
      if (!Object.values(S.mats).some((n) => n > 0)) b.appendChild(el('p', 'sm', T('還沒有素材。採集植物、狩獵、打倒魔物都能得到素材。', 'No materials yet. Pick plants, hunt and defeat monsters to gather them.')));
    } else if (tab === 'food') {
      S.food.forEach((f, i) => card(esc(T(f.name)), `${f.heal >= 999 ? T('完全回復', 'Full heal') : '❤ ' + (f.heal / 4)}${f.fx ? ' · ' + fxName(f.fx) : ''}`, false, () => { G.eat(f); S.food.splice(i, 1); openMenu('food'); }));
      if (!S.food.length) b.appendChild(el('p', 'sm', T('在營火的鍋子裡放入素材就能做料理。', 'Put ingredients in a pot over a fire to cook.')));
    } else if (tab === 'key') {
      const runes = Object.keys(S.runes).filter((k2) => S.runes[k2]);
      for (const r of runes) card(`${{ magnet: '🧲', bomb: '💣', ice: '🧊', stasis: '⏳' }[r]} ${esc(T(RUNE_NAME[r]))}`, T(RUNE_HELP[r]), S.rune === r, () => { S.rune = r; G.gearChanged(); openMenu('key'); });
      if (S.glider) card('🪂 ' + T('滑翔傘', 'Paraglider'), T('在空中按跳躍打開', 'Press jump in the air to open'), false, () => {});
      card('✦ ' + T('精靈寶珠', 'Spirit Orbs'), `× ${S.orbs}`, false, () => {});
      card('🍃 ' + T('葉精種子', 'Leaf Sprite Seeds'), `× ${S.seeds}  (${Object.keys(S.seedsFound).length} / ${POI.seeds.length})`, false, () => {});
      for (const [k2, v] of Object.entries(S.gifts)) if (v) card('★ ' + T(GIFT_NAME[k2]), T(GIFT_HELP[k2]), false, () => {});
    }
    b.appendChild(grid);
  });
}
const fxName = (fx) => T({ stamina: ['回復精力', 'Restores stamina'], cold: ['禦寒', 'Cold resistance'], hearty: ['額外心', 'Extra hearts'] }[fx]);
const RUNE_HELP = { magnet: ['抓住並移動金屬物體', 'Grab and move metal objects'], bomb: ['丟出炸彈，再按一次引爆', 'Throw a bomb; press again to detonate'], ice: ['在水面上造出冰柱', 'Raise ice pillars from water'], stasis: ['讓物體暫時靜止，期間打擊累積力量', 'Freeze an object; hits store force'] };
export const GIFT_NAME = { gale: ['風之加護', 'Gale Gift'], protect: ['守護之加護', 'Guardian Gift'], grace: ['慈愛之加護', 'Grace Gift'], fury: ['雷霆之加護', 'Thunder Gift'] };
const GIFT_HELP = { gale: ['按 G 製造上升氣流，冷卻後可再用', 'Press G for an updraft; recharges'], protect: ['自動擋下一次攻擊，冷卻後可再用', 'Blocks one hit for you; recharges'], grace: ['倒下時復活一次，冷卻後可再用', 'Revives you once when you fall; recharges'], fury: ['按 F 召喚雷擊周圍敵人，冷卻後可再用', 'Press F to call lightning around you; recharges'] };
function itemAct(k, i) {
  const S = G.S, list = k === 'w' ? S.weapons : k === 'b' ? S.bows : S.shields;
  G.paused = true;
  ask(null, name(list[i].id), [['裝備', 'Equip'], ['丟棄', 'Drop'], ['取消', 'Cancel']]).then((c) => {
    if (c === 0) S.eq[k] = i;
    if (c === 1) { G.dropItem(list[i].id); list.splice(i, 1); if (S.eq[k] >= list.length) S.eq[k] = list.length - 1; if (S.eq[k] === i) S.eq[k] = list.length ? 0 : -1; }
    G.gearChanged(); openMenu(k === 'w' ? 'weapons' : k === 'b' ? 'bows' : 'shields');
  });
}
function eatRaw(id) { const S = G.S; if (!S.mats[id]) return; S.mats[id]--; G.eatRaw(id); openMenu('mats'); }

// the map, with fast travel to woken towers and finished shrines
function mapMenu() {
  frame(T('地圖', 'Map'), TABS, 'map', (b) => {
    const S = G.S, wrap = el('div', 'mapwrap'), cv = el('canvas'); const n = 640; cv.width = cv.height = n; wrap.appendChild(cv); b.appendChild(wrap);
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.drawImage(revealed(), 0, 0, n, n);
    const toMap = (x, z) => [((x + W.half) / W.size) * n, ((z + W.half) / W.size) * n], marks = [];
    const draw = (x, z, col, label, travel, r = 7) => { const [mx, mz] = toMap(x, z); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(mx, mz, r, 0, 7); c.fill(); c.stroke(); marks.push({ mx, mz, label, travel, r }); };
    c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
    for (const r of REGIONS) if (S.towers['t_' + r.id]) { const [mx, mz] = toMap(r.x, r.z); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(T(r.name), mx + 1, mz + 31); c.fillStyle = '#fff'; c.fillText(T(r.name), mx, mz + 30); }
    draw(CASTLE.x, CASTLE.z, '#a02a6a', T('黑山電台', 'Black Mountain Station'), null, 9);
    draw(VILLAGE.x, VILLAGE.z, '#ffd890', T('Josh 的家', 'Josh\'s Home'), null, 7);
    for (const t of POI.towers) draw(t.x, t.z, S.towers[t.id] ? '#40c8ff' : '#ff9a3a', T('瞭望塔', 'Tower') + ' · ' + T(REGIONS.find((r) => r.id === t.region).name), S.towers[t.id] ? [t.x, t.top, t.z] : null, 7);
    for (const s of POI.shrines) if (S.shrines[s.id]) draw(s.x, s.z, S.shrines[s.id] === 2 ? '#40c8ff' : '#ff9a3a', T(s.name), [s.x, s.y + 0.4, s.z + 2], 6);
    for (const s of POI.greats) if (S.flags.quest || S.shrines[s.id]) draw(s.x, s.z, S.shrines[s.id] === 2 ? '#40c8ff' : '#ff3a7a', T('大神殿', 'Great Shrine') + ' · ' + T(REGIONS.find((r) => r.id === s.region).name), S.shrines[s.id] ? [s.x, s.y + 0.4, s.z + 3] : null, 8);
    if (S.pin) draw(S.pin[0], S.pin[1], '#ffe040', T('標記', 'Pin'), null, 6);
    const P = G.player(), [px, pz] = toMap(P.x, P.z); c.save(); c.translate(px, pz); c.rotate(-P.yaw + Math.PI); c.fillStyle = '#ffe040'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    const info = el('p', 'sm', T('點選藍色的塔或神殿可以快速移動。點其他地方放下標記。', 'Click a blue tower or shrine to travel there. Click elsewhere to place a pin.')); b.appendChild(info);
    cv.onclick = (ev) => {
      const r = cv.getBoundingClientRect(), mx = ((ev.clientX - r.left) / r.width) * n, mz = ((ev.clientY - r.top) / r.height) * n;
      const m = marks.find((q) => Math.hypot(q.mx - mx, q.mz - mz) < q.r + 6);
      if (m && m.travel) { ask(null, [`要移動到「${m.label}」嗎？`, `Travel to ${m.label}?`], [['移動', 'Travel'], ['取消', 'Cancel']]).then((c2) => { if (c2 === 0) { closeMenu(); G.travel(m.travel); } else mapMenu(); }); return; }
      if (m) { toast(m.label); return; }
      S.pin = [(mx / n) * W.size - W.half, (mz / n) * W.size - W.half]; mapMenu();
    };
  });
}
function systemMenu() {
  frame(T('系統', 'System'), TABS, 'system', (b) => {
    const list = el('div', 'list');
    list.appendChild(btn('💾 ' + T('存檔', 'Save'), () => { G.save(); toast(T('已存檔。', 'Saved.')); }));
    list.appendChild(btn('🌐 ' + (EN ? '中文' : 'English'), () => { G.save(); setLang(EN ? 'zh' : 'en'); }));
    list.appendChild(btn('🔊 ' + T('聲音：', 'Sound: ') + (G.muted() ? T('關', 'off') : T('開', 'on')), () => { G.setMuted(!G.muted()); systemMenu(); }));
    list.appendChild(btn('🖥 ' + T('畫質：', 'Graphics: ') + (G.quality() < 1 ? T('省電', 'Fast') : T('精美', 'Fine')), () => { G.setQuality(G.quality() < 1 ? 1 : 0.6); systemMenu(); }));
    list.appendChild(el('div', 'help', T(HELP_ZH, HELP_EN)));
    list.appendChild(btn('🏠 ' + T('回到標題', 'Title screen'), () => { G.save(); location.reload(); }));
    b.appendChild(list);
  });
}
const HELP_ZH = '<b>鍵盤</b>：WASD 移動 · 滑鼠看 (點畫面鎖定) · Shift 衝刺/游泳加速/攀爬時放手 · 空白 跳/攀爬跳/空中開滑翔傘 · 左鍵 攻擊 · 右鍵按住 拉弓 · Q 按住 舉盾 · E 調查/撿 · R 使用符文 · 1-4 換符文 · Tab 背包 · M 地圖 · G/F 英傑之力 · 滾輪或 [ ] 換武器（拿著磁力物體時調整遠近）· C 攀爬時放手<br><b>手機</b>：左半邊搖桿，右半邊滑動看，右側按鈕';
const HELP_EN = '<b>Keyboard</b>: WASD move · mouse look (click to lock) · Shift sprint / swim dash / let go while climbing · Space jump / climb-jump / open the glider in the air · Left click attack · hold Right click aim the bow · hold Q shield · E interact · R use rune · 1-4 choose rune · Tab inventory · M map · G/F champion gifts · wheel or [ ] switch weapons (magnet distance while holding) · C let go while climbing<br><b>Touch</b>: left half stick, right half drag to look, buttons on the right';

// cooking: up to five ingredients
export function cookMenu() {
  const S = G.S, pot = [];
  const draw = () => frame(T('料理鍋', 'Cooking Pot'), null, null, (b) => {
    b.appendChild(el('p', 'sm', T('選最多五樣素材放進鍋裡。同一種效果的素材放越多，效果越強；混了不同效果就會互相抵消。', 'Choose up to five ingredients. More of one effect makes it stronger; mixing effects cancels them.')));
    const potRow = el('div', 'pot'); for (let i = 0; i < 5; i++) { const id = pot[i]; potRow.appendChild(btn(id ? esc(name(id)) : '·', () => { if (id) { pot.splice(i, 1); draw(); } }, id ? 'in' : 'empty')); } b.appendChild(potRow);
    const grid = el('div', 'grid');
    for (const [id, n] of Object.entries(S.mats)) { const left = n - pot.filter((p) => p === id).length; if (left <= 0) continue; const m = MATS[id]; const c = el('div', 'card', `<b>${esc(T(m.name))} ×${left}</b><small>${m.food ? '❤ ' + m.heal / 4 + (m.fx ? ' · ' + fxName(m.fx) : '') : T('不能吃', 'Not edible')}</small>`); c.onclick = () => { if (pot.length < 5) { pot.push(id); draw(); } }; grid.appendChild(c); }
    b.appendChild(grid);
    const go = btn('🍲 ' + T('開始料理', 'Cook'), () => {
      if (!pot.length) return; for (const id of pot) S.mats[id]--; const dish = cook(pot); G.sfx('cook');
      if (S.food.length >= 30) { toast(T('料理放不下了。', 'No room for more food.')); return; }
      S.food.push(dish); pot.length = 0; draw(); toast(`🍲 ${esc(T(dish.name))}`, true);
    }, 'go'); go.disabled = !pot.length; b.appendChild(go);
  });
  draw();
}
// the village shop
export function shopMenu() {
  const S = G.S;
  const draw = (mode = 'buy') => frame(T('街角商店', 'Corner Store') + `   💰 ${S.gold}`, null, null, (b) => {
    const tabs = el('div', 'tabs'); tabs.appendChild(btn(T('買', 'Buy'), () => draw('buy'), mode === 'buy' ? 'on' : '')); tabs.appendChild(btn(T('賣', 'Sell'), () => draw('sell'), mode === 'sell' ? 'on' : '')); b.appendChild(tabs);
    const grid = el('div', 'grid');
    if (mode === 'buy') {
      const stock = [['arrows', ['箭 ×5', 'Arrows ×5'], ARROW_PRICE], ...['warm', 'climber', 'soldier'].filter((o) => !S.outfits.includes(o)).map((o) => [o, OUTFITS[o].name, OUTFITS[o].price]),
        ['w_soldier', WEAPONS.w_soldier.name, WEAPONS.w_soldier.price], ['b_soldier', BOWS.b_soldier.name, BOWS.b_soldier.price], ['s_soldier', SHIELDS.s_soldier.name, SHIELDS.s_soldier.price],
        ['radish', MATS.radish.name, 40], ['pepper', MATS.pepper.name, 12], ['stamella', MATS.stamella.name, 16]];
      for (const [id, nm, price] of stock) { const c = el('div', 'card', `<b>${esc(T(nm))}</b><small>💰 ${price}${OUTFITS[id] && OUTFITS[id].perk ? ' · ' + esc(T(OUTFITS[id].perk)) : ''}</small>`); c.onclick = () => { if (S.gold < price) { toast(T('錢不夠。', 'Not enough money.')); return; } if (!G.giveItem(id === 'arrows' ? 'arrows:5' : id, true)) return; S.gold -= price; G.sfx('pick'); draw('buy'); }; grid.appendChild(c); }
    } else {
      for (const [id, n] of Object.entries(S.mats)) if (n > 0) { const m = MATS[id]; const c = el('div', 'card', `<b>${esc(T(m.name))} ×${n}</b><small>💰 ${m.price}</small>`); c.onclick = () => { S.mats[id]--; S.gold += m.price; G.sfx('pick'); draw('sell'); }; grid.appendChild(c); }
    }
    b.appendChild(grid);
  });
  draw();
}
// the goddess statue: four orbs for a heart or more stamina
export async function statueMenu() {
  const S = G.S;
  if (S.orbs < 4) return say(['峽谷守護石像', 'Canyon Guardian Statue'], [`帶著四顆精靈寶珠前來吧……（你有 ${S.orbs} 顆）`, `Bring me four Spirit Orbs… (you have ${S.orbs})`]);
  const c = await ask(['峽谷守護石像', 'Canyon Guardian Statue'], ['你帶來了寶珠。你希望得到什麼？', 'You have brought the orbs. What do you wish for?'], [['心之容器', 'Heart Container'], ['精力之容器', 'Stamina Vessel'], ['不用了', 'Nothing yet']]);
  if (c === 0) { S.orbs -= 4; S.maxHearts++; S.hearts = S.maxHearts * 4; G.sfx('heart'); toast(T('最大心數增加了！', 'Your hearts increased!'), true); }
  if (c === 1) { S.orbs -= 4; S.stamMax = +(S.stamMax + 0.2).toFixed(1); G.player().stamina = S.stamMax; G.sfx('heart'); toast(T('精力上限增加了！', 'Your stamina increased!'), true); }
}
// grandpa leaf: seeds for more inventory slots
export async function leafMenu() {
  const S = G.S, cost = (k) => 1 + (S.slots[k] - (k === 'w' ? 6 : 4));
  const c = await ask(['葉精老爺爺', 'Grandpa Leaf'], [`喲呵！拿葉精種子來，我幫你把背包撐大一點！（你有 ${S.seeds} 顆）`, `Yahaha! Bring me Leaf Sprite Seeds and I'll stretch your pouches! (you have ${S.seeds})`],
    [[`武器欄 +1（${cost('w')} 顆）`, `Weapon slot +1 (${cost('w')})`], [`弓欄 +1（${cost('b')} 顆）`, `Bow slot +1 (${cost('b')})`], [`盾欄 +1（${cost('s')} 顆）`, `Shield slot +1 (${cost('s')})`], ['下次吧', 'Later']]);
  const k = ['w', 'b', 's'][c]; if (!k) return;
  if (S.seeds < cost(k)) return say(['葉精老爺爺', 'Grandpa Leaf'], ['種子不夠喔！森林裡、山頂上、奇怪的石頭底下都找找看吧。', 'Not enough seeds! Look in the woods, on peaks, and under odd little rocks.']);
  S.seeds -= cost(k); S.slots[k]++; G.sfx('jingle'); toast(T('背包變大了！', 'Your pouch grew!'), true);
}

// ---------------------------------------------------------------- the title screen
export function titleScreen(hasSave, onStart) {
  const t = $('#title'); t.classList.remove('hidden');
  t.innerHTML = `<div class="logo"><div class="l1">${T('鼠尾草峽谷大冒險', 'Sage Canyon Quest')}</div><div class="l2">${T('Josh 的峽谷之旅', 'Josh and the Canyon Gloom')}</div></div>`;
  const m = el('div', 'tmenu');
  if (hasSave) m.appendChild(btn(T('繼續旅程', 'Continue'), () => { t.classList.add('hidden'); onStart(false); }, 'go'));
  m.appendChild(btn(T('新的旅程', 'New Journey'), () => { if (hasSave && !confirm(T('原本的進度會被覆蓋，確定嗎？', 'Your saved journey will be replaced. Are you sure?'))) return; t.classList.add('hidden'); onStart(true); }, hasSave ? '' : 'go'));
  m.appendChild(btn('🌐 ' + (EN ? '中文' : 'English'), () => setLang(EN ? 'zh' : 'en'), 'small'));
  t.appendChild(m);
  t.appendChild(el('div', 'foot', T('WASD 移動 · 滑鼠 看 · 空白 跳 · 左鍵 攻擊 · E 調查 · Tab 背包 · M 地圖', 'WASD move · mouse look · Space jump · left click attack · E interact · Tab inventory · M map')));
}
