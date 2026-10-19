// Sage Canyon Quest: Josh wakes on the school field in a strange fog, earns a glider from the gardener, frees the four great
// shrines around the canyon and climbs Black Mountain to face the Gloom.
// This file ties it together: the game state and saving, input (keys, mouse, touch), the camera, fighting, runes,
// interactions, the story, time and weather, shrines, and the frame loop.
import * as THREE from 'three';
import { T, EN } from './i18n.js';
import { W, POI, SPOT, CASTLE, VILLAGE, REGIONS, TREES, groundH, regionAt, isCold, normalAt, solidsNear } from './world.js';
import { WEAPONS, BOWS, SHIELDS, OUTFITS, MATS, effectOf, rawDish, kindOf } from './items.js';
import { outdoor, shrineLevel, newBody, stepBody, groundAt } from './physics.js';
import { createGfx } from './gfx.js';
import { createEntities } from './entities.js';
import { makeHero, poseHero, setGear, setOutfit, toon, glowMat, makeNPC } from './models.js';
import { buildShrine, allShrines } from './shrine.js';
import * as UI from './ui.js';
import * as SND from './audio.js';

const KEY = 'sc.save.v1', GAME_ID = 'sage-canyon';
const $ = (s) => document.querySelector(s);
const gfx = createGfx($('#gl')), camera = gfx.camera;
let S = null, B = null, hero = null, L = outdoor, inShrine = null, started = false, timeScale = 1, quality = 1;
const SHRINES = allShrines(), shrineDefs = new Map();
const hermitNPC = POI.npcs.find((n) => n.id === 'hermit');

// ---------------------------------------------------------------- the game state
function newState() {
  const x = SPOT.start.x, z = SPOT.start.z;
  return { v: 1, pos: [x, groundH(x, z), z], yaw: Math.PI, hearts: 12, maxHearts: 3, extra: 0, stamMax: 1, orbs: 0, seeds: 0, gold: 0,
    runes: { magnet: 0, bomb: 0, ice: 0, stasis: 0 }, rune: null, glider: false,
    weapons: [], bows: [], shields: [], arrows: 0, mats: {}, food: [], outfits: ['traveler'], outfit: 'traveler', eq: { w: -1, b: -1, s: -1 }, slots: { w: 6, b: 4, s: 4 },
    flags: {}, shrines: {}, towers: {}, seedsFound: {}, picked: {}, opened: {}, ores: {}, kills: {}, gifts: { gale: 0, protect: 0, grace: 0, fury: 0 }, giftT: { gale: 0, protect: 0, grace: 0, fury: 0 },
    time: 7.2, day: 1, rain: false, weatherT: 3, coldFx: 0, blights: 0, bossDown: false, spawn: [x, groundH(x, z), z], pin: null, play: 0 };
}
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.v === 1 ? d : null; } catch (e) { return null; } };
let cloud = null;
function save() {
  if (!S || !B) return;
  if (!inShrine) { S.pos = [B.x, B.y, B.z]; S.yaw = B.yaw; }
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ }
  if (cloud) try { cloud.touch(GAME_ID, KEY); } catch (e) { /* ignore */ }
}
import('/save.js').then(async (m) => { cloud = m; if (await m.pull(GAME_ID, KEY) && !started) showTitle(); }).catch(() => {});

// ---------------------------------------------------------------- input
const keys = new Set(), pressed = new Set(), touch = { mx: 0, my: 0, active: false };
let mouseL = false, mouseR = false, wheel = 0, lookX = 0, lookY = 0;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const KM = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
  KeyE: 'act', KeyR: 'rune', KeyQ: 'shield', Tab: 'menu', KeyI: 'menu', KeyM: 'map', Escape: 'esc', KeyG: 'gale', KeyF: 'fury', Digit1: 'r1', Digit2: 'r2', Digit3: 'r3', Digit4: 'r4', Enter: 'ok', KeyZ: 'attack', KeyX: 'bow', KeyC: 'drop', BracketLeft: 'prevW', BracketRight: 'nextW' };
addEventListener('keydown', (e) => {
  const k = KM[e.code]; if (!k) return; if (['Tab', 'Space'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
  SND.unlock(); if (!keys.has(k)) pressed.add(k); keys.add(k);
  if ((k === 'act' || k === 'ok' || k === 'jump') && UI.advance()) pressed.clear();
});
addEventListener('keyup', (e) => { const k = KM[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());
const glc = $('#gl');
glc.addEventListener('mousedown', (e) => {
  SND.unlock(); if (!started || UI.menuOpen()) return;
  if (UI.talking()) { UI.advance(); return; }
  if (!document.pointerLockElement && !isTouch) { glc.requestPointerLock && glc.requestPointerLock(); return; }
  if (e.button === 0) { mouseL = true; pressed.add('attack'); } if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => { if (document.pointerLockElement === glc) { lookX += e.movementX; lookY += e.movementY; } });
addEventListener('wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });
// touch: a stick on the left, look by dragging on the right, buttons
const held = new Set();
if (isTouch) {
  document.body.classList.add('touch');
  const stick = $('#stick'), knob = $('#knob'); let sid = null, sx = 0, sy = 0, lid = null, lx = 0, ly = 0;
  glc.addEventListener('touchstart', (e) => {
    SND.unlock();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && sid === null) { sid = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.display = 'block'; stick.style.left = sx - 60 + 'px'; stick.style.top = sy - 60 + 'px'; }
      else if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    if (UI.talking()) UI.advance();
  }, { passive: true });
  glc.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === sid) { let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy); if (d > 55) { dx *= 55 / d; dy *= 55 / d; } touch.mx = dx / 55; touch.my = dy / 55; knob.style.transform = `translate(${dx}px, ${dy}px)`; }
      if (t.identifier === lid) { lookX += (t.clientX - lx) * 1.6; lookY += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; touch.mx = touch.my = 0; stick.style.display = 'none'; knob.style.transform = ''; } if (t.identifier === lid) lid = null; } };
  glc.addEventListener('touchend', end); glc.addEventListener('touchcancel', end);
  for (const b of document.querySelectorAll('[data-t]')) {
    const k = b.dataset.t;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); SND.unlock(); if (UI.talking()) { UI.advance(); return; } held.add(k); pressed.add(k); b.classList.add('on'); }, { passive: false });
    const up = (e) => { e.preventDefault(); held.delete(k); b.classList.remove('on'); };
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  }
}
const down = (k) => keys.has(k) || held.has(k);
const hit = (k) => pressed.has(k);

// ---------------------------------------------------------------- the camera
let camYaw = Math.PI, camPitch = 0.35, camDist = 6.5, shake = 0, aimK = 0;
const camTarget = new THREE.Vector3(), camDir = new THREE.Vector3();
function updateCamera(dt, aiming) {
  const sens = isTouch ? 0.0045 : 0.0026;
  camYaw -= lookX * sens; camPitch = Math.max(-0.75, Math.min(1.25, camPitch + lookY * sens)); lookX = lookY = 0;
  if (down('camL')) camYaw += dt * 2; if (down('camR')) camYaw -= dt * 2;

  aimK += ((aiming ? 1 : 0) - aimK) * Math.min(1, dt * 10);
  const dist = (inShrine ? Math.min(camDist, 6) : camDist) * (1 - aimK) + 3.3 * aimK;
  const fov = 58 - 20 * aimK; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  camTarget.set(B.x + rx * 0.9 * aimK, B.y + (B.mode === 'swim' ? 0.4 : 1.55), B.z + rz * 0.9 * aimK);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  // pull the camera in front of any wall between it and you
  let dd = dist; const inBox = (x, y, z) => { const list = inShrine ? L.boxes : [...solidsNear(x, z, 1)].filter((o) => o.min); for (const b of list) if (!b.off && x > b.min[0] - 0.2 && x < b.max[0] + 0.2 && y > b.min[1] - 0.2 && y < b.max[1] + 0.2 && z > b.min[2] - 0.2 && z < b.max[2] + 0.2) return true; return false; };
  for (let k = 0.6; k <= dist; k += 0.3) if (inBox(camTarget.x - fx * k * cp, camTarget.y + k * sp, camTarget.z - fz * k * cp)) { dd = Math.max(0.6, k - 0.4); break; }
  camera.position.set(camTarget.x - fx * dd * cp, camTarget.y + dd * sp, camTarget.z - fz * dd * cp);
  if (!inShrine) { const g = groundH(camera.position.x, camera.position.z) + 0.6; if (camera.position.y < g) camera.position.y = g; }
  else { const g = groundAt(L, camera.position.x, camera.position.z, camera.position.y).h + 0.4; if (camera.position.y < g) camera.position.y = g; }
  camera.lookAt(camTarget);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.getWorldDirection(camDir);
}
function screenOf(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera), r = glc.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height]; }
function resize() { gfx.resize(innerWidth, innerHeight, window.devicePixelRatio || 1); }
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- helpers for the game
const P = () => B;
const stamMax = () => S.stamMax;
const outfit = () => OUTFITS[S.outfit] || OUTFITS.traveler;
const cur = (k) => (k === 'w' ? S.weapons : k === 'b' ? S.bows : S.shields)[S.eq[k]];
function msg(t) { UI.toast(Array.isArray(t) ? T(t) : t); }
function giveItem(item, quiet) {
  const [id, a, b] = item.split(':');
  if (id === 'gold') { S.gold += +a; if (!quiet) msg(`💰 +${a}`); return true; }
  if (id === 'arrows') { S.arrows += +a; if (!quiet) msg(T(`🏹 箭 +${a}`, `🏹 Arrows +${a}`)); return true; }
  if (id === 'mat') { S.mats[a] = (S.mats[a] || 0) + (+b || 1); if (!quiet) msg(`${UI.name(a)} +${b || 1}`); return true; }
  const k = kindOf(id);
  if (k === 'w' || k === 'b' || k === 's') {
    const list = k === 'w' ? S.weapons : k === 'b' ? S.bows : S.shields, DEF = k === 'w' ? WEAPONS : k === 'b' ? BOWS : SHIELDS;
    if (list.length >= S.slots[k]) { msg(T('欄位滿了，丟掉一些再來吧。', 'Your pouch is full. Drop something first.')); return false; }
    list.push({ id, dur: DEF[id].dur }); if (S.eq[k] < 0) S.eq[k] = list.length - 1;
    if (!quiet) msg(`✦ ${UI.name(id)}`); gearChanged();
    if (k === 'w') tipOnce('weapon', ['武器', 'Weapons'], isTouch ? T(['按 ⚔ 攻擊，會自動轉向附近的敵人。武器用久了會壞，按 ⇄ 換武器。', 'Tap ⚔ to attack; you turn to face nearby enemies. Weapons break with use: tap ⇄ to switch.']) : T(['按<kbd class="m">左鍵</kbd>攻擊，會自動轉向附近的敵人。武器用久了會壞掉，用<kbd class="m">滾輪</kbd>或 <kbd>[</kbd><kbd>]</kbd> 快速換武器。', 'Press <kbd class="m">Left click</kbd> to attack; you turn to face the nearest enemy. Weapons wear out and break: switch with the <kbd class="m">Wheel</kbd> or <kbd>[</kbd><kbd>]</kbd>.']));
    if (k === 'b') { if (S.arrows < 10) S.arrows += 10; tipOnce('bow', ['弓箭', 'Bows'], isTouch ? T(['按住 🏹 瞄準（畫面會拉近），放開射出。在空中拉弓時間會變慢！', 'Hold 🏹 to aim (the view zooms in), release to shoot. Aiming in mid-air slows time!']) : T(['按住<kbd class="m">右鍵</kbd>（或 <kbd>X</kbd>）拉弓瞄準，放開就射出。準心變紅表示瞄準到敵人。跳起來或滑翔時拉弓，時間會變慢！', 'Hold <kbd class="m">Right click</kbd> (or <kbd>X</kbd>) to draw and aim; release to shoot. The reticle turns red on an enemy. Draw in mid-air to slow time!'])); }
    if (k === 's') tipOnce('shield', ['盾牌', 'Shields'], isTouch ? T(['按住 🛡 舉盾。在敵人打中前一瞬間舉盾就是完美防禦！', 'Hold 🛡 to raise your shield. Raise it just before a hit for a Perfect Guard!']) : T(['按住 <kbd>Q</kbd> 舉盾擋下攻擊。在敵人打到你的前一瞬間舉盾，就是「完美防禦」，連雷射都能彈回去！', 'Hold <kbd>Q</kbd> to raise your shield. Raise it just before a hit lands for a Perfect Guard, which even sends lasers back!']));
    return true;
  }
  if (k === 'o') { if (!S.outfits.includes(id)) S.outfits.push(id); if (!quiet) msg(`✦ ${UI.name(id)}`); return true; }
  if (k === 'm') { S.mats[id] = (S.mats[id] || 0) + 1; if (!quiet) msg(`${UI.name(id)} +1`); return true; }
  return false;
}
function gearChanged() {
  if (!hero) return; setOutfit(hero, S.outfit);
  hero.userData.gearKey = null;
}
function heal(q) { const max = S.maxHearts * 4; S.hearts = q >= 999 ? max : Math.min(max, S.hearts + q); }
function eatDish(f) {
  const e = effectOf(f); heal(e.heal); if (e.stamina) B.stamina = Math.min(S.stamMax + 0.6, B.stamina + e.stamina); if (e.cold) S.coldFx = Math.max(S.coldFx, e.cold); if (e.extra) S.extra = Math.min(20, S.extra + e.extra);
  SND.sfx('pick'); msg(`🍴 ${T(f.name)}`);
}
function dropItem(id) { ents.addPickup(id, B.x + Math.sin(B.yaw) * 1.2, B.y, B.z + Math.cos(B.yaw) * 1.2); }

// ---------------------------------------------------------------- the world's moving parts
const game = {
  get S() { return S; }, player: P, level: () => L, levelId: () => (inShrine ? inShrine.id : 'world'), hidden: () => !started || !B,
  hurt, msg, sfx: SND.sfx, combat: (boss) => { SND.combat(boss); if (S) tipOnce('fight', ['戰鬥', 'Fighting'], T(['敵人頭上的黃色箭頭是目前的目標。攻擊時會自動面向它。被圍攻時舉盾或後退，也可以從遠處用弓射頭部造成更多傷害。', 'The yellow arrow marks your target; your attacks turn toward it. When outnumbered, raise your shield or back off, or shoot heads from afar for extra damage.'])); }, enemyDied, campCleared, exploded,
  // where a held metal object goes: along your line of sight, never below the ground
  magnetTarget: (pr) => { const d = magnetDist, x = camera.position.x + camDir.x * d, z = camera.position.z + camDir.z * d; return { x, y: Math.max(camera.position.y + camDir.y * d, groundAt(L, x, z, camera.position.y + 2).h + (pr ? pr.size[1] / 2 + 0.25 : 0.8)), z }; },
  gates: () => (inShrine ? inShrine.gates : []),
};
const ents = createEntities(gfx, game);

// ---------------------------------------------------------------- the hero
function spawnHero() {
  if (hero) gfx.scene.remove(hero);
  hero = makeHero(); gfx.scene.add(hero); setOutfit(hero, S.outfit);
}
let target = null, hitStop = 0, atkT = -1, atkDur = 0.4, atkKind = 'one', combo = 0, comboT = 0, swung = false, aiming = false, aimT = 0, blocking = false, blockStart = 0, invuln = 0, hurtFlash = 0, bombCD = 0, runeCD = 0, magnetHeld = null, magnetDist = 8, dead = false;
const now = () => performance.now() / 1000;

function startAttack() {
  const w = cur('w'); if (B.mode !== 'ground' && B.mode !== 'air') return;
  const kind = w ? WEAPONS[w.id].kind : 'one';
  if (w && w.rest > 0) { msg(T('這把劍正在休息，等一下再用吧。', 'This blade is resting. Wait a little.')); return; }
  combo = comboT > 0 ? combo + 1 : 0;
  atkKind = kind; atkDur = kind === 'two' ? (combo % 2 ? 0.66 : 0.78) : kind === 'spear' ? 0.36 : combo % 3 === 2 ? 0.5 : 0.42; atkT = 0; swung = false; comboT = 1.0; SND.sfx('swing');
  const tg = target && Math.hypot(target.x - B.x, target.z - B.z) < 7 ? target : null; if (tg) B.yaw = Math.atan2(tg.x - B.x, tg.z - B.z);
  if (B.mode === 'ground') { B.vx += Math.sin(B.yaw) * 2.5; B.vz += Math.cos(B.yaw) * 2.5; }
}
function doHit() {
  const w = cur('w'), d = w ? WEAPONS[w.id] : { pow: 1, reach: 1.8, kind: 'one' };
  let pow = d.pow * (outfit().atk || 1), hits = 0;
  const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), reach = d.reach + (atkKind === 'two' ? 0.4 : 0);
  for (const e of ents.enemies) {
    if (e.dead || (!!e.inShrine !== !!inShrine)) continue;
    const r = ents.TYPES[e.type].r, dx = e.x - B.x, dz = e.z - B.z, dist = Math.hypot(dx, dz) - r;
    if (dist > reach || Math.abs(ents.chest(e) - (B.y + 1)) > 3.5) continue;
    if ((dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) < (atkKind === 'two' ? 0.1 : 0.35)) continue;
    ents.hurtEnemy(e, pow, B, { knock: atkKind === 'two' ? 7 : 4 }); hits++;
  }
  for (const pr of ents.props) { if (pr.frozen > 0 && pr.p.distanceTo(new THREE.Vector3(B.x, B.y + 1, B.z)) < reach + 1.4) { pr.impulse.addScaledVector(new THREE.Vector3(fx, 0.25, fz), Math.max(3, pow * 0.6)); SND.sfx('hit'); hits++; } }
  if (!inShrine) for (const o of POI.ores) { if (oreGone(o)) continue; if (Math.hypot(o.x - B.x, o.z - B.z) < reach + 1.2) { o.hits = (o.hits || 0) + (atkKind === 'two' ? 2 : 1); gfx.burst({ x: o.x, y: o.y + 0.8, z: o.z }, { n: 6, color: '#c8c0b0', add: false }); SND.sfx('hit'); if (o.hits >= 4) breakOre(o); hits++; } }
  if (hits) { hitStop = 0.07; shake = Math.max(shake, 0.12); }
  if (hits && w && !WEAPONS[w.id].recharge) wear('w', hits);
  else if (hits && w && WEAPONS[w.id].recharge) { w.dur -= hits; if (w.dur <= 0) { w.dur = 0; w.rest = 90; msg(T('曉光之劍的光芒暗了下來……它需要休息。', 'The Sword of Dawn dims… it needs to rest.')); } }
}
// a ribbon of light that follows the blade through the strike
const TRAIL_N = 16, trailPos = new Float32Array(TRAIL_N * 2 * 3), trailCol = new Float32Array(TRAIL_N * 2 * 3), trailPts = [];
const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; gfx.scene.add(trail);
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
function swingTrail(dt) {
  const p = atkT >= 0 ? atkT / atkDur : -1, wpn = hero && hero.userData.P.armRh.children[0];
  if (p > 0.3 && p < 0.72 && wpn && wpn.userData.len) { const L2 = wpn.userData.len; wpn.updateWorldMatrix(true, false); wpn.localToWorld(tA.set(0, L2 * 0.35, 0)); wpn.localToWorld(tB.set(0, L2 + 0.15, 0)); trailPts.unshift([tA.clone(), tB.clone(), 1]); }
  for (const q of trailPts) q[2] -= dt * 5;
  while (trailPts.length > TRAIL_N || (trailPts.length && trailPts[trailPts.length - 1][2] <= 0)) trailPts.pop();
  trail.visible = trailPts.length > 1;
  if (!trail.visible) return;
  for (let i = 0; i < TRAIL_N; i++) {
    const q = trailPts[Math.min(i, trailPts.length - 1)], f = Math.max(0, q[2]) * (1 - i / TRAIL_N);
    trailPos.set([q[0].x, q[0].y, q[0].z, q[1].x, q[1].y, q[1].z], i * 6);
    trailCol.set([f * 0.15, f * 0.18, f * 0.22, f * 0.95, f * 0.95, f], i * 6);
  }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
}
function cycleWeapon(d) {
  if (S.weapons.length < 2) { if (S.weapons.length) UI.quick(S.weapons, S.eq.w, WEAPONS); return; }
  S.eq.w = (S.eq.w + d + S.weapons.length) % S.weapons.length; gearChanged(); SND.sfx('rune'); UI.quick(S.weapons, S.eq.w, WEAPONS);
}
// a tip shown the first time something happens
function tipOnce(k, title, text) { S.tips = S.tips || {}; if (S.tips[k]) return; S.tips[k] = 1; UI.tip(title, text); }
function wear(k, n = 1) {
  const list = k === 'w' ? S.weapons : k === 'b' ? S.bows : S.shields, it = list[S.eq[k]]; if (!it) return;
  it.dur -= n;
  if (it.dur <= 0) {
    SND.sfx('break'); msg(T(`${UI.name(it.id)}壞掉了！`, `Your ${UI.name(it.id)} broke!`)); gfx.burst({ x: B.x, y: B.y + 1.2, z: B.z }, { n: 14, color: '#d8d8e0', add: false, speed: 3 });
    list.splice(S.eq[k], 1); S.eq[k] = list.length ? list.reduce((bi, x, i, a) => (power(k, x) > power(k, a[bi]) ? i : bi), 0) : -1; gearChanged();
  }
}
const power = (k, it) => (k === 'w' ? WEAPONS[it.id].pow : k === 'b' ? BOWS[it.id].pow : SHIELDS[it.id].guard);
// you are hit: shields, perfect guards, the champions' gifts; returns 'reflect' | 'block' | 'hit' | 'none'
function hurt(q, src, kind) {
  if (dead || invuln > 0 || !started) return 'none';
  const sh = cur('s'), front = Math.cos(Math.atan2(src.x - B.x, src.z - B.z) - B.yaw) > 0.25;
  if (blocking && sh && front) {
    const perfect = now() - blockStart < 0.32, D = SHIELDS[sh.id];
    if (perfect) { SND.sfx('parry'); gfx.burst({ x: B.x + Math.sin(B.yaw), y: B.y + 1.2, z: B.z + Math.cos(B.yaw) }, { n: 18, color: '#80e0ff', speed: 6 }); msg(T('完美防禦！', 'Perfect guard!')); if (kind === 'melee' && src.stun !== undefined) src.stun = 1.4; return 'reflect'; }
    if (kind === 'laser' && !D.laser) { wear('s', 6); q = Math.ceil(q * 0.5); }
    else { SND.sfx('block'); wear('s', 1); const left = Math.max(0, q - Math.floor(D.guard / 4)); if (!left) { B.vx -= Math.sin(B.yaw) * 4; B.vz -= Math.cos(B.yaw) * 4; return 'block'; } q = left; }
  }
  if (S.gifts.protect && S.giftT.protect <= 0) { S.giftT.protect = 300; SND.sfx('parry'); gfx.burst({ x: B.x, y: B.y + 1, z: B.z }, { n: 30, color: '#ff9a3a', speed: 5 }); msg(T('守護之加護擋下了攻擊！', 'The Guardian Gift shields you!')); return 'block'; }
  q = Math.max(1, q - Math.floor(outfit().def / 3));
  if (S.extra > 0) { const a = Math.min(S.extra, q); S.extra -= a; q -= a; }
  S.hearts -= q; invuln = 0.7; hurtFlash = 0.35; shake = 0.35; SND.sfx('hurt');
  const kx = B.x - src.x, kz = B.z - src.z, kd = Math.hypot(kx, kz) || 1; B.vx += (kx / kd) * 6; B.vz += (kz / kd) * 6;
  if (B.mode === 'glide' || B.mode === 'climb') { B.mode = 'air'; B.climb = null; B.fallTop = B.y; }
  if (S.hearts <= 0) dieNow();
  return 'hit';
}
async function dieNow() {
  if (S.gifts.grace && S.giftT.grace <= 0) { S.giftT.grace = 900; S.hearts = S.maxHearts * 4; SND.sfx('heart'); gfx.burst({ x: B.x, y: B.y + 1, z: B.z }, { n: 40, color: '#4ae0c8', speed: 4 }); msg(T('慈愛之加護讓你重新站了起來！', 'The Grace Gift brings you back!')); return; }
  dead = true; S.hearts = 0; $('#fade').classList.add('on');
  await new Promise((r) => setTimeout(r, 1300));
  await UI.say(null, ['……你倒下了。但旅程還沒有結束。', '…You have fallen. But your journey is not over.']);
  if (inShrine) leaveShrine(true);
  const sp = S.spawn; B.x = sp[0]; B.y = sp[1] + 0.5; B.z = sp[2]; B.vx = B.vy = B.vz = 0; B.mode = 'air'; B.fallTop = B.y;
  S.hearts = S.maxHearts * 4; B.stamina = S.stamMax; B.exhausted = false; dead = false; invuln = 2;
  for (const e of [...ents.enemies]) if (e.type === 'boss') ents.remove(e);
  $('#fade').classList.remove('on'); save();
}
function enemyDied(e) {
  if (e.type === 'boss') bossDown();
  if (inShrine && e.inShrine && !ents.enemies.some((o) => o.inShrine && !o.dead)) { msg(T('門打開了。', 'The way opens.')); SND.sfx('jingle'); }
}
function campCleared(id) {
  const c = POI.camps.find((q) => q.id === id); if (!c) return;
  SND.sfx('jingle'); msg(T('營地清除了！營火旁出現了寶箱。', 'Camp cleared! A chest appears by the fire.'));
  const tier = c.region === 'plateau' ? 0 : c.region === 'central' || c.region === 'forest' || c.region === 'east' ? 1 : 2;
  const loot = [['w_traveler', 's_wood', 'b_traveler', 'gold:40'], ['w_soldier', 's_traveler', 'b_soldier', 'w_spear', 'gold:120'], ['w_knight', 's_knight', 'w_claymore', 'w_halberd', 'gold:300']][tier];
  const p = ents.addPickup(loot[Math.floor(Math.random() * loot.length)], c.x + 2, c.y, c.z + 2); p.chest = true;
}
function exploded(pos) {
  if (inShrine) for (const b of inShrine.cracked) { if (b.off) continue; const cx = Math.max(b.min[0], Math.min(pos.x, b.max[0])), cy = Math.max(b.min[1], Math.min(pos.y, b.max[1])), cz = Math.max(b.min[2], Math.min(pos.z, b.max[2])); if (Math.hypot(pos.x - cx, pos.y - cy, pos.z - cz) < 4.5) { b.off = true; if (b.mesh) b.mesh.visible = false; gfx.burst(pos, { n: 30, color: '#a89880', add: false, speed: 6, size: 0.9 }); msg(T('裂開的牆崩塌了！', 'The cracked wall crumbles!')); } }
  if (!inShrine) for (const o of POI.ores) if (!oreGone(o) && Math.hypot(o.x - pos.x, o.z - pos.z) < 5) breakOre(o);
  shake = Math.max(shake, 0.4);
}
const oreGone = (o) => S.ores[o.id] !== undefined && S.day - S.ores[o.id] < 3;
function breakOre(o) {
  S.ores[o.id] = S.day; o.hits = 0; gfx.places.ores[o.id].visible = false; SND.sfx('break');
  gfx.burst({ x: o.x, y: o.y + 0.8, z: o.z }, { n: 20, color: '#a89880', add: false, speed: 5 });
  ents.addPickup('amber', o.x + 0.6, o.y, o.z); if (Math.random() < (o.rich ? 0.8 : 0.3)) ents.addPickup(o.rich && Math.random() < 0.3 ? 'diamond' : 'ruby', o.x - 0.6, o.y, o.z + 0.4);
  ents.addPickup('gold:' + (o.rich ? 30 : 10), o.x, o.y, o.z - 0.6);
}

// ---------------------------------------------------------------- runes
function useRune() {
  const r = S.rune; if (!r || !S.runes[r]) { msg(T('還沒有可以用的符文。', 'You have no rune yet.')); return; }
  const o = camera.position.clone(), d = camDir.clone();
  if (r === 'bomb') {
    const b = ents.props.find((p) => p.kind === 'bomb');
    if (b) { ents.explode(b.p.clone()); ents.removeProp(b); bombCD = 2.5; return; }
    if (bombCD > 0) { msg(T('炸彈還在重新充能。', 'The bomb rune is recharging.')); return; }
    const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), pr = ents.addProp('bomb', [B.x + fx * 0.8, B.y + 1.5, B.z + fz * 0.8], [0.7, 0.7, 0.7]);
    pr.v.set(camDir.x * 9.5, 4 + camDir.y * 6, camDir.z * 9.5); SND.sfx('rune'); return;
  }
  if (r === 'magnet') {
    if (magnetHeld) { magnetHeld.held = false; magnetHeld = null; SND.sfx('rune'); return; }
    const pr = ents.propOnRay(o, d, 'metal'); if (!pr) { msg(T('找不到可以吸住的金屬。', 'No metal object in sight.')); return; }
    pr.held = true; magnetHeld = pr; magnetDist = Math.max(3, Math.min(22, pr.p.distanceTo(o))); SND.sfx('magnet'); return;
  }
  if (r === 'stasis') {
    if (runeCD > 0) { msg(T('靜止符文還在重新充能。', 'Stasis is recharging.')); return; }
    const pr = ents.propOnRay(o, d), e = ents.enemyOnRay(o, d), g = ents.gateOnRay(o, d);
    const tp = pr ? pr.p.distanceTo(o) : 1e9, te = e ? Math.hypot(e.x - o.x, e.z - o.z) : 1e9, tg = g ? 1 : 1e9;
    if (g && tg <= Math.min(tp, te) && g.mode === 'cycle') { g.frozen = 6; SND.sfx('stasis'); runeCD = 2; msg(T('機關靜止了！', 'The mechanism stops!')); return; }
    if (pr && tp <= te) { pr.frozen = 6.5; SND.sfx('stasis'); runeCD = 2; return; }
    if (e && !['boss', 'blight', 'sentinel'].includes(e.type)) { e.frozen = 4; SND.sfx('stasis'); runeCD = 4; return; }
    msg(T('沒有可以靜止的東西。', 'Nothing to freeze there.')); return;
  }
  if (r === 'ice') {
    const at = waterOnRay(o, d); if (!at) { msg(T('要瞄準水面。', 'Aim at a water surface.')); return; }
    const pillars = ents.props.filter((p) => p.kind === 'ice'); if (pillars.length >= 3) ents.removeProp(pillars[0]);
    const floor = Math.max(groundAt(L, at.x, at.z, at.y).h, at.y - 6), top = at.y + 3.6, h = top - floor;
    ents.addProp('ice', [at.x, floor + h / 2, at.z], [2.2, h, 2.2]); SND.sfx('ice'); gfx.burst(at, { n: 14, color: '#c8f0ff', speed: 3 });
  }
}
function waterOnRay(o, d) {
  for (let t = 1; t < 30; t += 0.25) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, w = L.water(x, z);
    if (w > -1e8 && y <= w && groundAt(L, x, z, w).h < w - 0.8) return new THREE.Vector3(x, w, z);
    if (groundAt(L, x, z, y + 0.5).h > y) return null;
  }
  return null;
}

// ---------------------------------------------------------------- what you can do nearby
const SEEN = { shrine: 140 };
function interactables() {
  const out = [], px = B.x, pz = B.z, add = (d, label, act) => out.push({ d, label, act });
  const D = (x, z) => Math.hypot(x - px, z - pz);
  for (const p of ents.pickups) { const d = Math.hypot(p.x - px, p.z - pz); if (d < 2 && Math.abs(p.y - B.y) < 2.5) add(d, (p.chest ? '📦 ' : '') + T('撿起', 'Pick up') + ' ' + pickName(p.item), () => { if (giveItem(p.item)) { ents.takePickup(p); SND.sfx('pick'); } }); }
  if (inShrine) {
    const D2 = inShrine;
    if (Math.hypot(D2.altar[0] - px, D2.altar[2] - pz) < 3.4) add(0.5, T('觸碰祭壇', 'Touch the altar'), () => finishShrine());
    if (Math.hypot(D2.start[0] - px, D2.start[2] - pz) < 2) add(1.5, T('離開神殿', 'Leave the shrine'), () => leaveShrine(false));
    if (D2.chest && !S.opened[D2.id + '_c'] && Math.hypot(D2.chest.pos[0] - px, D2.chest.pos[2] - pz) < 2.2) add(1, T('打開寶箱', 'Open chest'), () => { S.opened[D2.id + '_c'] = 1; if (D2.chestMesh) D2.chestMesh.lid.rotation.x = -1.9; giveItem(D2.chest.loot); SND.sfx('jingle'); });
    return out;
  }
  for (const s of POI.shrines.concat(POI.greats)) if (D(s.x, s.z) < 2.6 && B.y > s.y - 1) add(D(s.x, s.z), (s.gift ? T('進入大神殿', 'Enter the Great Shrine') : T('進入', 'Enter') + ' ' + T(s.name)) + (S.shrines[s.id] === 2 ? T('（已完成）', ' (done)') : ''), () => enterShrine(s));
  for (const t of POI.towers) if (D(t.x, t.z) < 3 && B.y > t.top - 0.8) add(0.5, S.towers[t.id] ? T('觀看地圖', 'View the map') : T('啟動瞭望塔', 'Activate the tower'), () => activateTower(t));
  for (const n of ents.npcs) if (D(n.x, n.z) < 2.6 && Math.abs(n.y - B.y) < 3 && (n.id !== 'hermit' || !S.flags.hermitGone)) add(D(n.x, n.z), n.id === 'statue' ? T('向女神像祈禱', 'Pray to the statue') : T('交談', 'Talk'), () => talk(n));
  for (const p of POI.pots) if (D(p.x, p.z) < 2.4) add(D(p.x, p.z), T('料理', 'Cook'), () => UI.cookMenu());
  for (const c of POI.chests) if (!S.opened[c.id] && D(c.x, c.z) < 2.2) add(D(c.x, c.z), T('打開寶箱', 'Open chest'), () => { S.opened[c.id] = 1; gfx.places.chests[c.id].lid.rotation.x = -1.9; const it = c.loot.startsWith('mat:') ? c.loot : c.loot; giveItem(it); SND.sfx('jingle'); });
  for (const p of POI.plants) if (plantHere(p) && D(p.x, p.z) < 1.8) add(D(p.x, p.z), T('採集', 'Pick') + ' ' + UI.name(p.item), () => { S.picked[p.id] = S.day; gfx.places.plants[p.id].visible = false; giveItem(p.item); SND.sfx('pick'); });
  for (const s of POI.seeds) if (!S.seedsFound[s.id] && s.kind === 'rock' && D(s.x, s.z) < 2) add(D(s.x, s.z), T('抬起石頭', 'Lift the rock'), () => foundSeed(s));
  if (D(SPOT.grove.x, SPOT.grove.z) < 3 && !S.flags.dawn) add(1, T('拔出劍', 'Draw the sword'), () => drawDawn());
  // shake an apple tree
  for (let i = 0; i < TREES.length; i++) { const t = TREES[i]; if (!t.apple || D(t.x, t.z) > 2.2) continue; const k = 'tree' + i; if (S.picked[k] !== undefined && S.day - S.picked[k] < 2) continue; add(D(t.x, t.z), T('搖樹', 'Shake the tree'), () => { S.picked[k] = S.day; for (let a = 0; a < 2; a++) ents.addPickup('apple', t.x + Math.cos(a * 3) * 1.3, t.y, t.z + Math.sin(a * 3) * 1.3); SND.sfx('pick'); }); break; }
  return out;
}
const pickName = (item) => { const [id, n] = item.split(':'); if (id === 'gold') return `💰 ${n}`; if (id === 'arrows') return T(`箭 ×${n}`, `Arrows ×${n}`); return UI.name(id); };
const plantHere = (p) => S.picked[p.id] === undefined || S.day - S.picked[p.id] >= 2;
function foundSeed(s) {
  S.seedsFound[s.id] = 1; S.seeds++; SND.sfx('jingle');
  const g = gfx.places.seeds[s.id]; if (g) { if (g.userData.rock) g.userData.rock.visible = false; if (g.userData.leaf) g.userData.leaf.visible = false; }
  gfx.burst({ x: s.x, y: s.y + 1, z: s.z }, { n: 20, color: '#8aff6a', speed: 3 });
  UI.toast(T(`🍃 呀哈哈！你找到我了！（葉精種子 ${Object.keys(S.seedsFound).length}/${POI.seeds.length}）`, `🍃 Yahaha! You found me! (Leaf Sprite Seeds ${Object.keys(S.seedsFound).length}/${POI.seeds.length})`), true);
}
async function drawDawn() {
  if (S.maxHearts < 6) { await UI.say(null, ['你握住劍柄用力一拔……劍紋風不動，你的力量被吸走了。（需要更多心）', 'You grip the hilt and pull… it will not move, and it drains your strength. (You need more hearts.)']); S.hearts = Math.max(1, S.hearts - 4); return; }
  if (!giveItem('w_dawn', true)) return;
  S.flags.dawn = 1; gfx.places.dawn.visible = false; SND.sfx('heart'); UI.banner(T('曉光之劍', 'Sword of Dawn'), T('不會壞掉，用盡力量後會自己恢復。', 'It never breaks; when spent it recovers on its own.'));
}

// ---------------------------------------------------------------- towers, shrines
async function activateTower(t) {
  if (S.towers[t.id]) { UI.openMenu('map'); return; }
  S.towers[t.id] = true; S.spawn = [t.x, t.top, t.z]; SND.sfx('tower'); shake = 0.6;
  const pl = gfx.places.towers[t.id]; for (const s of pl.seams) s.material = glowMat('#40c8ff', 1.8); pl.orb.material = glowMat('#40c8ff', 2.8);
  gfx.burst({ x: t.x, y: t.top + 2, z: t.z }, { n: 60, color: '#40c8ff', speed: 9, life: 1.4, size: 0.9 });
  const reg = REGIONS.find((r) => r.id === t.region);
  UI.banner(T(reg.name), T('地圖資料已更新', 'Map updated'));
  if (t.region === 'plateau' && !S.flags.towerTalk) { S.flags.towerTalk = 1; await UI.say(['神秘的聲音', 'A Gentle Voice'], ['你喚醒了瞭望塔……從這裡可以看見整個峽谷。', 'You woke the tower… from here you can see the whole canyon.']); await UI.say(['神秘的聲音', 'A Gentle Voice'], ['中庭花園裡有一位老園丁在等你。去和他談談吧。', 'An old gardener is waiting in the courtyard garden. Go and talk to him.']); objective(); }
  save();
}
function enterShrine(s) {
  const i = SHRINES.indexOf(s);
  let D = shrineDefs.get(s.id); if (!D) { D = buildShrine(s, i); shrineDefs.set(s.id, D); buildShrineMeshes(D); }
  inShrine = D; L = shrineLevel(D.boxes, D.waters, D.killY); ents.setLevel(L);
  if (!S.shrines[s.id]) S.shrines[s.id] = 1;
  for (const b of D.cracked) { b.off = false; if (b.mesh) b.mesh.visible = true; }
  for (const g of D.gates) { g.off = 0; g.frozen = 0; }
  for (const pr of D.props) ents.addProp(pr.kind, pr.pos, pr.size, { metal: pr.metal });
  if (S.shrines[s.id] !== 2) for (const e of D.enemies) { const en = ents.spawn(e.type, e.pos[0], e.pos[2], { inShrine: D.id, y: e.pos[1], kind: e.kind, key: null }); en.home = [e.pos[0], e.pos[2]]; }
  D.group.visible = true; gfx.setInside(true);
  B.x = D.start[0]; B.y = D.start[1]; B.z = D.start[2]; B.vx = B.vy = B.vz = 0; B.mode = 'ground'; B.yaw = Math.PI; camYaw = Math.PI;
  SND.setMood('shrine'); UI.banner(s.gift ? T('大神殿', 'Great Shrine') : T(s.name), s.gift ? T(REGIONS.find((r) => r.id === s.region).name) : s.teach ? T('符文的試煉', 'Trial of the Rune') : '');
  if (s.teach && !S.runes[s.teach]) {
    S.runes[s.teach] = 1; S.rune = s.teach; SND.sfx('rune');
    const help = { magnet: ['磁力符文：按 R 瞄準金屬物體吸住，移動視角帶著它走，滾輪調整遠近，再按 R 放開。', 'Magnet rune: press R while aiming at metal to grab it, turn to carry it, wheel for distance, R again to let go.'],
      bomb: ['炸彈符文：按 R 丟出炸彈，再按一次 R 引爆。可以炸開有裂痕的牆。', 'Bomb rune: press R to throw a bomb, R again to set it off. Bombs break cracked walls.'],
      ice: ['製冰符文：瞄準水面按 R 造出冰柱，可以爬上去。最多三根。', 'Ice rune: aim at water and press R to raise a pillar you can climb. Up to three.'],
      stasis: ['靜止符文：瞄準機關或物體按 R 讓它暫時停住。靜止中打它會累積力量。', 'Stasis rune: aim at a mechanism or object and press R to freeze it for a while. Hitting it stores force.'] }[s.teach];
    UI.say(['風之石板', 'Wind Slate'], help).then(() => UI.toast(T('數字鍵 1-4 可以切換符文。', 'Keys 1-4 switch runes.')));
  }
}
function buildShrineMeshes(D) {
  const g = new THREE.Group(); gfx.inside.add(g); D.group = g;
  const mat = { floor: toon('#5a5e6a'), wall: toon('#363a46'), cracked: toon('#9a8a76'), gate: toon('#2a3448'), shelf: toon('#5a5e6a'), ledge: toon('#4a4e5a'), poolfloor: toon('#2a3a4a'), altar: glowMat('#40c8ff', 0.8) };
  for (const b of D.boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), mat[b.role] || mat.floor);
    m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); m.receiveShadow = true; m.castShadow = b.role !== 'wall'; g.add(m); b.mesh = m;
    if (b.role === 'wall') { const s = new THREE.Mesh(new THREE.BoxGeometry(b.max[0] - b.min[0] + 0.02, 0.12, b.max[2] - b.min[2] + 0.02), glowMat('#40a8ff', 1.2)); s.position.set(m.position.x, D.floorY + 3.2, m.position.z); g.add(s); }
    if (b.role === 'gate') { const s = new THREE.Mesh(new THREE.BoxGeometry(b.max[0] - b.min[0] + 0.04, 0.3, b.max[2] - b.min[2] + 0.04), glowMat('#ff9a3a', 1.4)); s.position.y = 1; m.add(s); }
    if (b.role === 'cracked') { for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.06), toon('#3a2e26')); c.position.set((k - 2.5) * 1.8, Math.sin(k) * 1.5, (b.max[2] - b.min[2]) / 2 + 0.01); c.rotation.z = 0.4 * Math.sin(k * 3); m.add(c); } }
  }
  for (const w of D.waters) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.z1 - w.z0), new THREE.MeshPhongMaterial({ color: '#2a8ad8', transparent: true, opacity: 0.75, shininess: 80 })); m.rotation.x = -Math.PI / 2; m.position.set((w.x0 + w.x1) / 2, w.y, (w.z0 + w.z1) / 2); g.add(m); }
  for (const p of D.plates) { p.mesh = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 20), glowMat('#ff9a3a', 1)); p.mesh.position.set(p.x, p.y + 0.06, p.z); g.add(p.mesh); }
  const monk = makeNPC('monk'); monk.position.set(D.altar[0], D.altar[1], D.altar[2] - 1.5); g.add(monk); D.monk = monk;
  const orb = gfx.glowSprite(D.altar[0], D.altar[1] + 1.6, D.altar[2] - 0.7, 1.4, '#80d8ff', g); D.orbGlow = orb;
  if (D.chest) { const cg = new THREE.Group(); cg.position.set(...D.chest.pos); g.add(cg); const bm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), toon('#3a4a6a')); bm.position.y = 0.3; cg.add(bm); const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.37); cg.add(lid); const lm = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.3, 0.78), toon('#4a6a9a')); lm.position.set(0, 0.15, 0.39); lid.add(lm); D.chestMesh = { lid }; if (S.opened[D.id + '_c']) lid.rotation.x = -1.9; }
  g.visible = false;
}
async function finishShrine() {
  const D = inShrine, s = SHRINES.find((q) => q.id === D.id);
  if (ents.enemies.some((e) => e.inShrine === D.id && !e.dead)) { msg(T('先打倒守護者吧。', 'Defeat the guardians first.')); return; }
  if (S.shrines[s.id] === 2) { leaveShrine(false); return; }
  S.shrines[s.id] = 2; SND.sfx('orb'); gfx.burst({ x: D.altar[0], y: D.altar[1] + 1.5, z: D.altar[2] }, { n: 40, color: '#80d8ff', speed: 4, life: 1.4 });
  if (s.gift) {
    S.gifts[s.gift] = 1; S.blights++;
    await UI.say(['峽谷守護靈', 'Canyon Guardian Spirit'], ['謝謝你，Josh。黑霧離開了這裡。我的力量會陪著你。', 'Thank you, Josh. The Gloom has left this place. My strength goes with you.']);
    UI.banner(T(UI.GIFT_NAME[s.gift]), T('黑霧魔的力量減弱了', 'The Gloom grows weaker'));
    const g = gfx.places.greats[s.id]; g.cr.material = glowMat(g.col, 2); g.pad.material = glowMat(g.col, 1.4);
  } else {
    S.orbs++;
    await UI.say(['修行僧', 'The Monk'], ['你通過了試煉。收下這顆精靈寶珠吧。四顆可以在女神像前換得祝福。', 'You have passed the trial. Take this Spirit Orb; four of them earn a blessing at a goddess statue.']);
    UI.toast(T(`✦ 精靈寶珠 ×${S.orbs}`, `✦ Spirit Orbs ×${S.orbs}`), true);
    const pl = gfx.places.shrines[s.id]; pl.ring.material = glowMat('#40c8ff', 2); pl.pad.material = glowMat('#40c8ff', 1.2);
  }
  leaveShrine(false); S.spawn = [s.x, s.y + 0.5, s.z + 2]; objective(); save();
}
function leaveShrine(silent) {
  const D = inShrine; if (!D) return; const s = SHRINES.find((q) => q.id === D.id);
  ents.clearShrine(); if (magnetHeld) magnetHeld = null; D.group.visible = false; gfx.setInside(false);
  inShrine = null; L = outdoor; L.dyn.length = 0; ents.setLevel(L);
  B.x = s.x; B.z = s.z + 2.2; B.y = s.y + 0.4; B.vx = B.vy = B.vz = 0; B.mode = 'ground'; B.yaw = 0;
  SND.setMood('field'); if (!silent) SND.sfx('rune');
}
function updateShrine(dt) {
  const D = inShrine, t = now();
  for (const g of D.gates) {
    let open = 0;
    if (g.mode === 'cycle') { if (g.frozen > 0) { g.frozen -= dt; open = g.held ?? 0; } else { const p = ((t + g.phase) % g.period); open = p < g.open ? 1 : 0; g.held = open; } }
    else if (g.mode === 'plate') open = D.plates.some((pl) => pl.gate === g.id && pl.on) ? 1 : 0;
    else if (g.mode === 'enemies') open = ents.enemies.some((e) => e.inShrine === D.id && !e.dead) ? 0 : 1;
    g.cur = (g.cur ?? 0) + ((open ? 1 : 0) - (g.cur ?? 0)) * Math.min(1, dt * (g.mode === 'cycle' ? 14 : 4));
    if (g.frozen > 0 && g.mode === 'cycle') g.cur = g.held;
    const off = g.cur * g.lift, h = g.box.max[1] - g.box.min[1];
    g.box.min[1] = g.y0 + off; g.box.max[1] = g.y0 + off + h;
    if (g.box.mesh) { g.box.mesh.position.y = (g.box.min[1] + g.box.max[1]) / 2; g.box.mesh.material = g.frozen > 0 ? toon('#ffd040') : toon('#2a3448'); }
  }
  for (const pl of D.plates) {
    const on = ents.props.some((pr) => pr.kind !== 'bomb' && Math.abs(pr.box.min[1] - pl.y) < 0.6 && pr.box.min[0] < pl.x + pl.r && pr.box.max[0] > pl.x - pl.r && pr.box.min[2] < pl.z + pl.r && pr.box.max[2] > pl.z - pl.r) || (Math.hypot(B.x - pl.x, B.z - pl.z) < pl.r && Math.abs(B.y - pl.y) < 0.4);
    if (on !== pl.on) { pl.on = on; pl.mesh.material = glowMat(on ? '#40c8ff' : '#ff9a3a', 1); SND.sfx(on ? 'rune' : 'step'); }
  }
  if (D.monk) D.monk.rotation.y = Math.atan2(B.x - D.monk.position.x, B.z - D.monk.position.z);
}

// ---------------------------------------------------------------- the people
async function talk(n) {
  const S2 = S, josh = ['Josh', 'Josh'];
  if (n.id === 'hermit') {
    const who = ['老園丁 Rowan', 'Mr. Rowan, the Gardener'];
    if (!S2.flags.metHermit) {
      S2.flags.metHermit = 1;
      await UI.say(who, ['喔！是 Josh 啊。還好你沒事。', 'Oh! Josh. Thank goodness you are all right.']);
      await UI.say(who, ['你在草地上睡著的時候，一陣灰色的霧從黑山飄下來，把整個峽谷都蓋住了。大家都被藏在霧裡了。', 'While you napped on the field, a grey fog rolled down from Black Mountain and covered the whole canyon. Everyone is hidden inside it.']);
      await UI.say(who, ['學校裡冒出了四座發光的神殿。把它們都完成，我就把我的老風箏滑翔翼送給你。', 'Four glowing shrines have appeared around the school. Finish all of them, and my old kite-glider is yours.']);
      if (!S2.weapons.length) { giveItem('w_traveler'); await UI.say(who, ['霧裡有怪東西。這把木劍給你防身。肚子餓了就用我小屋旁邊的鍋子煮點東西。', 'There are strange things in the fog. Take this wooden sword. If you get hungry, cook something in the pot by my shed.']); }
      objective(); return;
    }
    const done = POI.shrines.filter((s) => s.region === 'plateau' && S2.shrines[s.id] === 2).length;
    if (!S2.glider && done < 4) return UI.say(who, [`還有 ${4 - done} 座神殿。地圖上橘色的標記就是了。`, `${4 - done} shrines to go. They are the orange marks on your map.`]);
    if (!S2.glider) {
      await UI.say(who, ['你辦到了！……其實我不只是園丁。我是守護這個峽谷很久很久的老精靈。', 'You did it! …In truth I am more than a gardener. I am the old spirit who has watched over this canyon for a very long time.']);
      await UI.say(who, ['回家去吧，你爸爸 Jeff、媽媽 Erin 和 Jasper 都在家裡等你。Jeff 知道接下來該怎麼做。', 'Go home. Your dad Jeff, your mom Erin and Jasper are waiting for you. Jeff will know what to do next.']);
      S2.glider = true; S2.flags.hermitGone = 1; SND.sfx('heart'); UI.banner(T('風箏滑翔翼', 'Kite-glider'), T('在空中按跳躍打開，慢慢滑翔', 'Press jump in mid-air to glide'));
      tipOnce('glider', ['滑翔翼', 'Kite-glider'], T(['跳起來後在空中再按一次<kbd>空白</kbd>打開滑翔翼，再按一次收起。從屋頂或懸崖跳下去試試看！', 'Jump, then press <kbd>Space</kbd> again in mid-air to open the glider; press again to let go. Try it off a roof or a cliff!']));
      n.m.visible = false; S2.pin = [VILLAGE.x, VILLAGE.z]; objective(); save(); return;
    }
    return;
  }
  if (n.id === 'elder') {
    const who = ['爸爸 Jeff', 'Dad (Jeff)'];
    if (!S2.flags.quest) {
      await UI.say(who, ['Josh！你沒事！太好了。媽媽和 Jasper 也都在家。', 'Josh! You are safe! Mom and Jasper are here too.']);
      await UI.say(who, ['我用電腦查過了：黑霧是從黑山上那座廢棄的電台發出來的。', 'I looked into it on my computer: the Gloom is coming from the old abandoned radio station on Black Mountain.']);
      await UI.say(who, ['它在峽谷四周的大神殿裡放了「災厄」——鼠尾草峽谷、峽谷小溪、西海岸、卡梅爾丘陵。解放它們，黑霧就會變弱。', 'It has put Blights in four great shrines around the canyon: Sage Canyon, Canyon Creek, the West Shore and the Carmel Hills. Free them, and the Gloom will weaken.']);
      await UI.say(who, ['準備好了，就爬上黑山。……答應我，要小心喔。', 'When you are ready, climb Black Mountain. …And promise me you will be careful.']);
      S2.flags.quest = 1; objective(); save(); return;
    }
    return UI.say(who, [`你已經解放了 ${S2.blights} 座大神殿。加油，兒子！`, `You have freed ${S2.blights} great shrines. Keep going, son!`]);
  }
  if (n.id === 'shop') return UI.shopMenu();
  if (n.id === 'statue') return UI.statueMenu();
  if (n.id === 'leafgramps') return UI.leafMenu();
  if (n.id === 'inn') {
    const who = ['媽媽 Erin', 'Mom (Erin)'];
    const c = await UI.ask(who, ['累了吧？在家睡一覺，心都會恢復喔。', 'Tired? Have a good sleep at home and your hearts will come back.'], [['睡到早上', 'Sleep until morning'], ['睡到晚上', 'Sleep until night'], ['不用了', 'Not now']]);
    if (c === 2) return;
    S2.hearts = S2.maxHearts * 4; S2.extra = Math.max(S2.extra, 4); $('#fade').classList.add('on'); await new Promise((r) => setTimeout(r, 900));
    S2.time = c === 0 ? 7 : 20; if (c === 0) S2.day++; $('#fade').classList.remove('on'); msg(T('在家睡得好香，心都恢復了。', 'A good sleep at home. Your hearts are full.')); save(); return;
  }
  if (n.id === 'kid') return UI.say(['Jasper', 'Jasper'], ['哥！我聽說峽谷底下小溪旁邊有一把會發光的劍！可是要很多顆心才拔得起來喔。', 'Bro! They say there is a glowing sword down in the canyon by the creek! But you need lots of hearts to pull it out.']);
  void josh;
}
// what to do next, shown under the hearts
function objective() {
  const S2 = S, plateauDone = POI.shrines.filter((s) => s.region === 'plateau' && S2.shrines[s.id] === 2).length;
  let t;
  if (!S2.towers.t_plateau) t = ['爬上學校東邊停車場的瞭望塔', 'Climb the tower in the school\'s east lot'];
  else if (!S2.flags.metHermit) t = ['到中庭花園找老園丁', 'Find the gardener in the courtyard garden'];
  else if (!S2.glider) t = [`完成學校裡的神殿（${plateauDone}/4），再找老園丁`, `Clear the school shrines (${plateauDone}/4), then see the gardener`];
  else if (!S2.flags.quest) t = ['回東邊社區的家，找爸爸', 'Go home to the neighborhood in the east and find Dad'];
  else if (!S2.bossDown) t = [`解放大神殿（${S2.blights}/4），登上黑山打倒黑霧魔`, `Free the great shrines (${S2.blights}/4), then climb Black Mountain and defeat the Gloom`];
  else t = ['自由地探索這片大地吧', 'Explore the land freely'];
  $('#objective').textContent = T(t);
}

// ---------------------------------------------------------------- the last battle
let bossOn = false;
function bossCheck() {
  if (S.bossDown || inShrine) return;
  const d = Math.hypot(B.x - CASTLE.arena.x, B.z - CASTLE.arena.z);
  if (!bossOn && d < 24 && Math.abs(B.y - CASTLE.y) < 10) {
    bossOn = true; const hpMul = 1 - 0.2 * S.blights;
    const e = ents.spawn('boss', CASTLE.arena.x, CASTLE.arena.z - 12, { hpMul, y: CASTLE.y }); e.state = 'chase';
    UI.banner(T('黑霧魔', 'The Gloom'), S.blights ? T(`守護靈們削弱了它（${S.blights}/4）`, `Weakened by the guardians (${S.blights}/4)`) : T('它的力量完整無缺……', 'Its power is whole…'));
    SND.combat(true);
  }
  if (bossOn && d > 80) { bossOn = false; for (const e of [...ents.enemies]) if (e.type === 'boss') ents.remove(e); }
}
async function bossDown() {
  S.bossDown = true; bossOn = false; SND.sfx('orb'); shake = 1;
  for (const s of gfx.places.gloom) s.visible = false; gfx.places.arenaRing.visible = false;
  await UI.say(null, ['黑霧魔發出最後的嘶吼，化成光點消散了。灰色的霧慢慢散開，峽谷又看得見了。', 'The Gloom lets out a last cry and scatters into motes of light. The grey fog thins, and the canyon can be seen again.']);
  await UI.say(['爸爸 Jeff', 'Dad (Jeff)'], ['Josh！霧散了，大家都回來了！你是我們的英雄。', 'Josh! The fog is gone and everyone is back! You are our hero.']);
  $('#ending').classList.remove('hidden');
  $('#ending').innerHTML = `<h1>${T('鼠尾草峽谷大冒險', 'Sage Canyon Quest')}</h1><p>${T('感謝遊玩', 'Thank you for playing')}</p><p class="sm">${T(`神殿 ${Object.values(S.shrines).filter((v) => v === 2).length}/${SHRINES.length} · 葉精種子 ${Object.keys(S.seedsFound).length}/${POI.seeds.length} · 瞭望塔 ${Object.keys(S.towers).length}/${POI.towers.length}`, `Shrines ${Object.values(S.shrines).filter((v) => v === 2).length}/${SHRINES.length} · Leaf Sprite Seeds ${Object.keys(S.seedsFound).length}/${POI.seeds.length} · Towers ${Object.keys(S.towers).length}/${POI.towers.length}`)}</p>`;
  const b = document.createElement('button'); b.className = 'go'; b.textContent = T('繼續探索', 'Keep exploring'); b.onclick = () => $('#ending').classList.add('hidden'); $('#ending').appendChild(b);
  objective(); save();
}

// ---------------------------------------------------------------- starting
function begin(fresh) {
  S = fresh ? newState() : load() || newState();
  S.kills = S.kills || {};
  B = newBody(S.pos[0], S.pos[1] + 0.3, S.pos[2]); B.yaw = S.yaw || 0; B.stamina = S.stamMax; camYaw = B.yaw;
  spawnHero(); started = true; $('#hud').classList.remove('hidden');
  for (const s of POI.shrines) if (S.shrines[s.id] === 2) { const pl = gfx.places.shrines[s.id]; pl.ring.material = glowMat('#40c8ff', 2); pl.pad.material = glowMat('#40c8ff', 1.2); }
  for (const s of POI.greats) if (S.shrines[s.id] === 2) { const g = gfx.places.greats[s.id]; g.cr.material = glowMat(g.col, 2); g.pad.material = glowMat(g.col, 1.4); }
  for (const t of POI.towers) if (S.towers[t.id]) { const pl = gfx.places.towers[t.id]; for (const s of pl.seams) s.material = glowMat('#40c8ff', 1.8); pl.orb.material = glowMat('#40c8ff', 2.8); }
  for (const c of POI.chests) if (S.opened[c.id]) gfx.places.chests[c.id].lid.rotation.x = -1.9;
  for (const s of POI.seeds) if (S.seedsFound[s.id]) { const g = gfx.places.seeds[s.id]; if (g.userData.rock) g.userData.rock.visible = false; if (g.userData.leaf) g.userData.leaf.visible = false; }
  if (S.flags.dawn) gfx.places.dawn.visible = false;
  if (S.bossDown) { for (const s of gfx.places.gloom) s.visible = false; gfx.places.arenaRing.visible = false; }
  const hn = ents.npcs.find((n) => n.id === 'hermit'); if (hn) { hn.x = hermitNPC.x; hn.z = hermitNPC.z; hn.y = hermitNPC.y; hn.m.position.set(hn.x, hn.y, hn.z); hn.m.visible = !S.flags.hermitGone; }
  objective();
  if (fresh) intro();
}
async function intro() {
  $('#fade').classList.add('on');
  for (const [zh, en] of [['……Josh，醒醒。', '…Josh. Wake up.'], ['你在學校的大草地上睡著了。可是周圍好安靜……', 'You fell asleep on the school field. But everything is so quiet…'], ['一陣灰色的霧蓋住了整個峽谷。Josh，只有你能把它趕走。', 'A grey fog has covered the whole canyon. Josh, only you can drive it away.']]) await UI.say(['神秘的聲音', 'A Gentle Voice'], [zh, en]);
  $('#fade').classList.remove('on');
  ents.addPickup('w_branch', B.x + 2, B.y, B.z - 2); ents.addPickup('apple', B.x - 2, B.y, B.z - 1.5); ents.addPickup('apple', B.x - 2.5, B.y, B.z - 2.4);
  S.pin = [POI.towers[0].x, POI.towers[0].z];
  UI.banner(T('鼠尾草峽谷小學', 'Sage Canyon School'), T('前往發光的瞭望塔', 'Head for the glowing tower'));
  UI.toast(T('WASD 移動、滑鼠看四周（點一下畫面）、E 撿起東西。', 'WASD to move, mouse to look (click the screen), E to pick things up.'));
  save();
}
function showTitle() { UI.titleScreen(!!load(), (fresh) => begin(fresh)); }

// ---------------------------------------------------------------- the frame loop
let last = performance.now(), lastRaf = performance.now(), regionNow = null, cold = false, coldT = 0, saveT = 0, stepT = 0, seenT = 0, slowT = 0, fpsT = 0, frames = 0;
const rafLoop = () => { lastRaf = performance.now(); frame(); requestAnimationFrame(rafLoop); };
setInterval(() => { if (performance.now() - lastRaf > 150) frame(); }, 33);
function frame() {
  const t0 = performance.now(), rdt = Math.max(0, Math.min(0.05, (t0 - last) / 1000)); last = t0;
  if (!started) {           // the title: drift above the plateau
    const a = t0 / 9000; camera.position.set(SPOT.plateau.x + Math.cos(a) * 330, SPOT.plateau.h + 170, SPOT.plateau.z + Math.sin(a) * 330); camera.lookAt(SPOT.plateau.x, SPOT.plateau.h, SPOT.plateau.z);
    gfx.setTime(7.5, false, camera.position); gfx.updateGrass(0, 0, false); gfx.frame(rdt, camera.position); SND.tick(rdt, false); return;
  }
  const paused = game.paused || UI.talking() || dead;
  if (hitStop > 0) hitStop -= rdt;
  const dt = paused ? 0 : rdt * timeScale * (hitStop > 0 ? 0.05 : 1);
  if (!paused) step(dt, rdt);
  pressed.clear(); wheel = 0;
  updateCamera(rdt, aiming || (S.rune && ['magnet', 'stasis', 'ice'].includes(S.rune) && down('runeAim')));
  // the hero's pose
  const dbgA = window.__atkPose;      // tests: freeze a swing at some point { p, kind, combo }
  const sp = Math.hypot(B.vx, B.vz), hold = atkT >= 0 || blocking || dbgA ? 'weapon' : aiming ? 'bow' : null;
  setGear(hero, { weapon: cur('w')?.id, bow: cur('b')?.id, shield: cur('s')?.id }, hold);
  hero.position.set(B.x, B.y, B.z); hero.rotation.y = B.yaw;
  const nearGround = B.mode === 'air' && atkT >= 0 && B.y - groundAt(L, B.x, B.z, B.y).h < 0.9;
  poseHero(hero, { mode: nearGround ? 'ground' : B.mode, speed: sp, t: t0 / 1000, attack: dbgA ? dbgA.p : atkT >= 0 ? atkT / atkDur : -1, kind: dbgA ? dbgA.kind : atkKind, combo: dbgA ? dbgA.combo : combo, aim: aiming, block: blocking, climbMove: B.mode === 'climb' && Math.hypot(inp.ix, inp.iy) > 0.1 && !B.exhausted, swimMove: sp > 0.5, dead, land: B.landed, hop: B.hopT });
  swingTrail(rdt);
  hero.visible = invuln <= 0 || Math.floor(t0 / 70) % 2 === 0 || dead;
  // the world's look
  const rainy = S.rain && !inShrine && regionAt(B.x, B.z) !== 'desert';
  gfx.setTime(inShrine ? 12 : S.time, rainy, new THREE.Vector3(B.x, B.y, B.z));
  gfx.updateGrass(B.x, B.z, !inShrine && quality >= 1);
  if (!inShrine && L !== outdoor) L = outdoor; outdoor.rain = rainy;
  gfx.frame(rdt, new THREE.Vector3(B.x, B.y, B.z));
  UI.hud(rdt); SND.tick(rdt, gfx.night > 0.5);
  // the boss's health
  const boss = ents.enemies.find((e) => (e.type === 'boss' || e.type === 'blight') && !e.dead && e.model.visible && Math.hypot(e.x - B.x, e.z - B.z) < 60), bb = $('#bossbar');
  bb.style.display = boss ? 'block' : 'none';
  if (boss) { bb.firstChild.textContent = boss.type === 'boss' ? T('黑霧魔', 'The Gloom') : T({ frost: ['冰之災厄', 'Frostblight'], fire: ['火之災厄', 'Fireblight'], water: ['水之災厄', 'Waterblight'], thunder: ['雷之災厄', 'Thunderblight'] }[boss.kind]); bb.lastChild.firstChild.style.width = Math.max(0, (boss.hp / boss.max) * 100) + '%'; }
  $('#hurt').style.opacity = Math.max(0, hurtFlash * 2); hurtFlash = Math.max(0, hurtFlash - rdt);
  $('#lowhp').classList.toggle('on', S.hearts <= 4 && !dead);
  const lh = $('#lockhint'), needLock = !isTouch && !document.pointerLockElement && !UI.menuOpen() && !UI.talking() && !dead;
  lh.style.display = needLock ? 'block' : 'none'; if (needLock) lh.lastChild.textContent = T('點一下畫面，用滑鼠控制視角', 'Click the screen to control the camera with the mouse');
  // adapt the picture to slow devices
  frames++; fpsT += rdt; if (fpsT > 3) { const fps = frames / fpsT; frames = 0; fpsT = 0; if (fps < 26 && quality > 0.5) { quality = Math.max(0.5, quality - 0.25); gfx.setQuality(quality); resize(); } }
}
const inp = { mx: 0, mz: 0, ix: 0, iy: 0, sprint: false, jump: false, drop: false };
function step(dt, rdt) {
  S.play += rdt;
  // ---- input to movement
  let ix = (down('right') ? 1 : 0) - (down('left') ? 1 : 0) + touch.mx, iy = (down('up') ? 1 : 0) - (down('down') ? 1 : 0) - touch.my;
  const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  const busy = atkT >= 0 && B.mode === 'ground';
  inp.mx = (fx * iy + rx * ix) * (busy ? 0.15 : blocking ? 0.45 : aiming ? 0.5 : 1); inp.mz = (fz * iy + rz * ix) * (busy ? 0.15 : blocking ? 0.45 : aiming ? 0.5 : 1);
  inp.ix = ix; inp.iy = iy; inp.sprint = down('sprint') && !aiming && !blocking; inp.jump = hit('jump'); inp.drop = hit('sprint') || hit('drop');
  if (B.mode === 'climb') inp.drop = hit('drop') || hit('sprint');
  const ev = stepBody(B, dt, inp, L, { glider: S.glider, climbMul: outfit().climb || 1, stamMax: S.stamMax, updraft: updraftAt });
  if (ev.fall) { if (ev.fall > 34) { S.hearts = 0; dieNow(); } else if (ev.fall > 12) hurt(Math.round((ev.fall - 12) * 1.1), { x: B.x, z: B.z }, 'fall'); }
  if (ev.drown || ev.void) { const sp = ev.void && inShrine ? inShrine.start : B.safe; B.x = sp[0]; B.y = sp[1] + 0.2; B.z = sp[2]; B.vx = B.vy = B.vz = 0; B.mode = 'ground'; B.exhausted = false; B.stamina = Math.max(B.stamina, 0.3); S.hearts -= 2; hurtFlash = 0.4; SND.sfx('hurt'); msg(ev.drown ? T('你游不動了……', 'You ran out of strength…') : T('你掉下去了……', 'You fell…')); if (S.hearts <= 0) dieNow(); }
  if (ev.splash) { SND.sfx('splash'); gfx.burst({ x: B.x, y: B.y + 1, z: B.z }, { n: 12, color: '#c8e8ff', speed: 3, add: false }); }
  if (ev.slip) msg(T('下雨了，岩壁好滑！', 'The rain makes the rock slippery!'));
  if (B.mode === 'glide' && !game.wasGlide) SND.sfx('glide'); game.wasGlide = B.mode === 'glide';
  // ---- fighting
  invuln -= dt; comboT -= dt; bombCD -= dt; runeCD -= dt;
  const canAct = B.mode === 'ground' || B.mode === 'air' || B.mode === 'glide';
  if ((hit('attack') || (isTouch && hit('attack'))) && atkT < 0 && !aiming && (B.mode === 'ground' || B.mode === 'air')) startAttack();
  if (atkT >= 0) { atkT += dt; if (!swung && atkT >= atkDur * 0.5) { swung = true; doHit(); } if (atkT >= atkDur) atkT = -1; }
  const wantAim = (mouseR || down('bow')) && cur('b') && canAct;
  if (wantAim && !aiming) { aiming = true; aimT = 0; }
  if (aiming) {
    aimT += rdt; B.yaw = camYaw;
    const air = B.mode === 'air' || B.mode === 'glide';
    timeScale = air && B.stamina > 0.01 ? 0.3 : 1; if (air) { B.stamina = Math.max(0, B.stamina - rdt * 0.14); if (B.stamina <= 0) B.exhausted = true; }
    if (!wantAim) { aiming = false; timeScale = 1; fireArrow(); }
  } else timeScale = 1;
  const wantBlock = down('shield') && cur('s') && B.mode === 'ground' && !aiming;
  if (wantBlock && !blocking) blockStart = now(); blocking = !!wantBlock;
  // ---- runes, gifts, quick keys
  if (hit('rune')) useRune();
  for (const [k, r] of [['r1', 'magnet'], ['r2', 'bomb'], ['r3', 'ice'], ['r4', 'stasis']]) if (hit(k) && S.runes[r]) { S.rune = r; SND.sfx('rune'); if (magnetHeld && r !== 'magnet') { magnetHeld.held = false; magnetHeld = null; } }
  if (hit('cycleRune')) { const owned = ['magnet', 'bomb', 'ice', 'stasis'].filter((r) => S.runes[r]); if (owned.length) { S.rune = owned[(owned.indexOf(S.rune) + 1) % owned.length]; SND.sfx('rune'); } }
  if (magnetHeld && wheel) magnetDist = Math.max(3, Math.min(25, magnetDist - wheel));
  if (magnetHeld) { if (down('up') && down('jump')) magnetDist = Math.min(25, magnetDist + dt * 6); }
  if ((hit('gale') || (hit('gift') && S.gifts.gale)) && S.gifts.gale && S.giftT.gale <= 0 && !inShrine) { S.giftT.gale = 300; B.mode = 'air'; B.vy = 24; B.fallTop = B.y; SND.sfx('glide'); gfx.burst({ x: B.x, y: B.y, z: B.z }, { n: 30, color: '#c8f0ff', speed: 6, up: 8 }); msg(T('風之加護！在空中按跳躍打開滑翔傘。', 'Gale Gift! Press jump in the air to glide.')); }
  if ((hit('fury') || (hit('gift') && S.gifts.fury && !S.gifts.gale)) && S.gifts.fury && S.giftT.fury <= 0) { S.giftT.fury = 300; SND.sfx('boom'); shake = 0.6; gfx.burst({ x: B.x, y: B.y + 2, z: B.z }, { n: 50, color: '#ffe040', speed: 10, life: 0.6 }); for (const e of ents.enemies) if (!e.dead && Math.hypot(e.x - B.x, e.z - B.z) < 10) ents.hurtEnemy(e, 45, B, { stun: 2 }); msg(T('雷霆之加護！', 'Thunder Gift!')); }
  for (const k of Object.keys(S.giftT)) S.giftT[k] = Math.max(0, S.giftT[k] - dt);
  // ---- menus
  if (!magnetHeld && !aiming && wheel) cycleWeapon(Math.sign(wheel));
  if (hit('nextW')) cycleWeapon(1); if (hit('prevW')) cycleWeapon(-1);
  if (hit('menu')) UI.openMenu('weapons');
  if (hit('map')) UI.openMenu('map');
  if (hit('esc')) { if (document.pointerLockElement) document.exitPointerLock(); else UI.openMenu('system'); }
  // ---- things nearby
  const near = interactables().sort((a, b) => a.d - b.d)[0];
  UI.prompt(near && !dead ? near.label : null);
  if (near && (hit('act') || hit('ok'))) near.act();
  // ---- the reticle and rune targets
  const runeAim = S.rune && ['magnet', 'stasis', 'ice'].includes(S.rune) && S.runes[S.rune];
  let hot = false; if (runeAim) { const o = camera.position, d = camDir; hot = S.rune === 'magnet' ? !!(magnetHeld || ents.propOnRay(o, d, 'metal')) : S.rune === 'ice' ? !!waterOnRay(o, d) : !!(ents.propOnRay(o, d) || ents.enemyOnRay(o, d) || ents.gateOnRay(o, d)); }
  if (aiming && !hot) hot = 'enemy' === (ents.enemyOnRay(camera.position, camDir) ? 'enemy' : '');
  UI.reticle(aiming || runeAim, hot); $('#reticle').classList.toggle('enemy', aiming && !!ents.enemyOnRay(camera.position, camDir));
  const ar = $('#arrows'); ar.style.display = aiming ? 'block' : 'none'; if (aiming) ar.textContent = `🏹 ${S.arrows}`;
  // the target: the nearest enemy in front of the camera
  target = null; let best = 16;
  for (const e of ents.enemies) { if (e.dead || e.type === 'boar' || (!!e.inShrine !== !!inShrine) || !e.model.visible) continue; const dx = e.x - B.x, dz = e.z - B.z, d = Math.hypot(dx, dz); if (d > best) continue; if ((dx * camDir.x + dz * camDir.z) / (d || 1) < 0.35 && d > 3) continue; best = d; target = e; }
  showHints();
  // ---- world things
  if (!inShrine) {
    for (const s of POI.seeds) if (s.kind === 'peak' && !S.seedsFound[s.id] && Math.hypot(s.x - B.x, s.z - B.z) < 2 && Math.abs(s.y + 1.6 - B.y - 1) < 2.5) foundSeed(s);
    seenT -= rdt; if (seenT <= 0) { seenT = 1; for (const s of POI.shrines.concat(POI.greats)) if (!S.shrines[s.id] && Math.hypot(s.x - B.x, s.z - B.z) < SEEN.shrine) { S.shrines[s.id] = 1; UI.toast(T(`發現了「${T(s.name || ['大神殿', 'Great Shrine'])}」`, `Found: ${T(s.name || ['大神殿', 'Great Shrine'])}`)); } for (const p of POI.plants) gfx.places.plants[p.id].visible = plantHere(p); for (const o of POI.ores) gfx.places.ores[o.id].visible = !oreGone(o); }
    const reg = regionAt(B.x, B.z); if (reg !== regionNow) { if (regionNow) UI.banner(T(REGIONS.find((r) => r.id === reg).name)); regionNow = reg; SND.setMood(Math.hypot(B.x - VILLAGE.x, B.z - VILLAGE.z) < 70 ? 'village' : 'field'); }
    else if (Math.hypot(B.x - VILLAGE.x, B.z - VILLAGE.z) < 70 !== (game.mood === 'village')) { game.mood = Math.hypot(B.x - VILLAGE.x, B.z - VILLAGE.z) < 70 ? 'village' : 'field'; SND.setMood(game.mood); }
    bossCheck();
    // cold
    cold = isCold(B.x, B.z, B.y) && !outfit().cold && S.coldFx <= 0;
    if (cold) { coldT += dt; if (coldT > 3.5) { coldT = 0; S.hearts -= 1; hurtFlash = 0.2; msg(T('好冷……穿上保暖衣物或吃辣的料理吧。', 'So cold… wear something warm or eat spicy food.')); if (S.hearts <= 0) dieNow(); } } else coldT = 0;
  } else updateShrine(dt);
  S.coldFx = Math.max(0, S.coldFx - dt);
  // the Sword of Dawn recovers
  for (const w of S.weapons) if (w.rest > 0) { w.rest -= dt; if (w.rest <= 0) { w.dur = WEAPONS[w.id].dur; msg(T('曉光之劍恢復了光芒！', 'The Sword of Dawn shines again!')); } }
  // ---- time and weather (a game minute every second)
  if (!inShrine) {
    const before = S.time; S.time += dt / 60;
    if (S.time >= 24) { S.time -= 24; S.day++; if (S.day % 3 === 0) { S.kills = {}; UI.banner(T('血月升起', 'The Blood Moon rises'), T('被打倒的魔物復活了……', 'Fallen monsters return…')); } }
    S.weatherT -= dt / 60; if (S.weatherT <= 0) { S.weatherT = 3 + Math.random() * 5; S.rain = !S.rain && Math.random() < 0.3; }
    void before;
  }
  // ---- footsteps, autosave
  stepT -= dt * Math.hypot(B.vx, B.vz); if (stepT <= 0 && B.mode === 'ground') { stepT = 2.2; SND.sfx('step'); }
  saveT += rdt; if (saveT > 30) { saveT = 0; save(); }
  ents.update(dt);
  if (S.hearts > S.maxHearts * 4) S.hearts = S.maxHearts * 4;
}
function showHints() {
  const h = [], cap = (k) => (k === 'L' ? T('左鍵', 'L-click') : k === 'R' ? T('右鍵', 'R-click') : k);
  if (B.mode === 'climb') h.push([T('WASD', 'WASD'), T('攀爬', 'Climb')], [T('空白', 'Space'), T('往上跳', 'Climb jump')], ['C', T('放手', 'Let go')]);
  else if (B.mode === 'glide') h.push([T('WASD', 'WASD'), T('轉向', 'Steer')], [T('空白', 'Space'), T('收起滑翔傘', 'Close glider')]);
  else if (B.mode === 'swim') h.push(['Shift', T('加速游', 'Swim faster')], [T('空白', 'Space'), T('衝刺', 'Dash')]);
  else if (aiming) h.push([T('放開右鍵', 'Release R'), T('射箭', 'Shoot'), true], [T('滑鼠', 'Mouse'), T('瞄準', 'Aim')]);
  else if (magnetHeld) h.push(['R', T('放開', 'Let go'), true], [T('滑鼠', 'Mouse'), T('移動物體', 'Move it')], [T('滾輪', 'Wheel'), T('遠／近', 'Farther / nearer')]);
  else {
    h.push([cap('L'), cur('w') ? T('攻擊', 'Attack') : T('拳頭', 'Punch')]);
    if (cur('b')) h.push([cap('R'), T('拉弓', 'Draw bow')]);
    if (cur('s')) h.push(['Q', T('舉盾', 'Shield')]);
    if (S.weapons.length > 1) h.push([T('滾輪', 'Wheel'), T('換武器', 'Switch weapon')]);
    h.push([T('空白', 'Space'), B.mode === 'air' && S.glider ? T('滑翔傘', 'Glider') : T('跳', 'Jump')], ['Shift', T('衝刺', 'Sprint')]);
    if (S.rune) h.push(['R', ents.props.some((p) => p.kind === 'bomb') ? T('引爆', 'Detonate') : T(UI.RUNE_NAME[S.rune])]);
  }
  UI.hints(h);
  // where the target is on screen, with its health once it has been hurt
  const tg = $('#target');
  if (target && !aiming) { const T2 = ents.TYPES[target.type], sp = screenOf(target.x, target.y + T2.h + 0.4, target.z); tg.style.display = 'block'; tg.style.left = sp[0] + 'px'; tg.style.top = sp[1] + 'px'; tg.classList.toggle('lock', Math.hypot(target.x - B.x, target.z - B.z) < 7); const hp = tg.lastChild; hp.style.display = target.hp < target.max && target.type !== 'boss' && target.type !== 'blight' ? 'block' : 'none'; hp.firstChild.style.width = Math.max(0, (target.hp / target.max) * 100) + '%'; }
  else tg.style.display = 'none';
}
function updraftAt(x, z, y) {
  for (const p of POI.pots.concat(POI.camps)) if (Math.hypot(p.x - x, p.z - z) < 2.2 && y - p.y < 22) return 7;
  return 0;
}
function fireArrow() {
  const b = cur('b'); if (!b) return; if (S.arrows <= 0) { msg(T('沒有箭了。', 'Out of arrows.')); return; }
  const from = { x: B.x + Math.sin(B.yaw) * 0.5, y: B.y + 1.45, z: B.z + Math.cos(B.yaw) * 0.5 }, o = camera.position;
  const to = { x: o.x + camDir.x * 80, y: o.y + camDir.y * 80, z: o.z + camDir.z * 80 };
  ents.shootArrow(from, to, 'player', BOWS[b.id].pow * (outfit().atk || 1)); S.arrows--; SND.sfx('shoot'); wear('b', 1);
}

// ---------------------------------------------------------------- the interface's view of the game
Object.assign(game, {
  stamMax, screenOf, mapPicture: () => gfx.mapPicture(), enemies: () => ents.enemies, inShrine: () => !!inShrine, cold: () => cold,
  save, eat: eatDish, eatRaw: (id) => eatDish(rawDish(id)), dropItem, gearChanged, giveItem, sfx: SND.sfx, travel(p) { B.x = p[0]; B.y = p[1] + 0.5; B.z = p[2]; B.vx = B.vy = B.vz = 0; B.mode = 'air'; B.fallTop = B.y; S.spawn = p.slice(); gfx.burst({ x: B.x, y: B.y + 1, z: B.z }, { n: 30, color: '#40c8ff', speed: 4 }); SND.sfx('rune'); },
  muted: () => SND.isMuted(), setMuted: SND.setMuted, quality: () => quality, setQuality(q) { quality = q; gfx.setQuality(q); resize(); }, touch: isTouch,
  gift() { const ready = Object.keys(S.gifts).filter((k) => S.gifts[k]); if (!ready.length) return ''; return ready.map((k) => `${{ gale: '🌪', protect: '🛡', grace: '💧', fury: '⚡' }[k]}${S.giftT[k] > 0 ? `<small>${Math.ceil(S.giftT[k])}</small>` : ''}`).join(' '); },
});
UI.initUI(game);
showTitle();
requestAnimationFrame(rafLoop);

// for tests
window.__wb = { get S() { return S; }, get B() { return B; }, begin, game, ents, gfx, enterShrine: (id) => enterShrine(SHRINES.find((s) => s.id === id)), leaveShrine, finishShrine, useRune, press: (k) => pressed.add(k), hold: (k, on) => (on ? keys.add(k) : keys.delete(k)),
  set magnetDist(v) { magnetDist = v; }, get magnetHeld() { return magnetHeld; }, camera,
  tp(x, z, y) { B.x = x; B.z = z; B.y = y ?? groundH(x, z) + 0.2; B.vx = B.vy = B.vz = 0; B.mode = 'air'; B.fallTop = B.y; }, setCam(yaw, pitch, dist) { camYaw = yaw; if (pitch !== undefined) camPitch = pitch; if (dist) camDist = dist; }, get inShrine() { return inShrine; }, activateTower, talk: (id) => talk(ents.npcs.find((n) => n.id === id)), UI };
