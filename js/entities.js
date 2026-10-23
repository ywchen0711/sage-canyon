// What lives and moves in the world besides you: goblins at their camps, archers on lookouts, ogres, ancient sentinels
// and their scouts, the great shrines' Blights and the Gloomshade; boars; arrows and laser beams; things dropped on the
// ground; and the shrine props and runes (magnet, bombs, stasis, ice pillars).
import * as THREE from 'three';
import { groundAt, pushOut, G } from './physics.js';
import { POI, groundH, CASTLE, regionAt, W } from './world.js';
import { makeGoblin, makeOgre, makeSentinel, makeBoar, makeBoss, makeNPC, toon, glowMat, weaponMesh, bowMesh, shieldMesh } from './models.js';
import { WEAPONS, BOWS, SHIELDS, MATS } from './items.js';
import { hash2 } from './noise.js';

const TYPES = {
  goblin:   { hp: [13, 72, 200, 400], dmg: [2, 4, 8, 12], run: 4.6, reach: 2.2, r: 0.55, h: 1.6, sight: 22 },
  archer:   { hp: [13, 72, 200, 400], dmg: [2, 4, 6, 8], run: 0, reach: 0, r: 0.55, h: 1.6, sight: 38 },
  ogre:     { hp: [340], dmg: [12], run: 3.4, reach: 4.2, r: 1.2, h: 4, sight: 26 },
  sentinel: { hp: [900], dmg: [16], run: 0, reach: 0, r: 2.0, h: 4, sight: 58, charge: 3.0 },
  scout:    { hp: [70], dmg: [4], run: 2.6, reach: 0, r: 0.8, h: 1.7, sight: 34, charge: 1.6 },
  blight:   { hp: [1000], dmg: [8], run: 3.4, reach: 3.2, r: 1.4, h: 3.6, sight: 60, charge: 1.5 },
  boss:     { hp: [3000], dmg: [12], run: 3.0, reach: 5.5, r: 2.6, h: 7, sight: 90, charge: 1.1 },
  boar:     { hp: [6], dmg: [0], run: 7, reach: 0, r: 0.6, h: 1.0, sight: 12 },
};
const BLIGHT_COL = { frost: '#8ad8ff', fire: '#ff6a2a', water: '#4ae0c8', thunder: '#ffe040' };
const v3 = new THREE.Vector3();

export function createEntities(gfx, game) {
  const scene = gfx.scene, enemies = [], arrows = [], pickups = [], props = [], beams = [], orbs = [], npcs = [];
  let L = game.level();

  // ---------------------------------------------------------------- enemies
  function spawn(type, x, z, o = {}) {
    const T = TYPES[type], tier = o.tier || 0, e = { type, tier, x, z, y: o.y ?? groundAt(L, x, z).h, yaw: o.yaw ?? hash2(x | 0, z | 0) * 6.28, hp: (T.hp[tier] ?? T.hp[0]) * (o.hpMul || 1), state: 'idle', t: Math.random() * 2, cd: 0, home: [x, z], key: o.key, camp: o.camp, post: o.post, kind: o.kind, frozen: 0, impulse: new THREE.Vector3(), flash: 0, alertT: 0, stun: 0, wander: null, ...o };
    e.max = e.hp;
    e.model = type === 'goblin' || type === 'archer' ? makeGoblin(tier) : type === 'ogre' ? makeOgre() : type === 'sentinel' ? makeSentinel(false) : type === 'scout' ? makeSentinel(true) : type === 'boar' ? makeBoar() : type === 'boss' ? makeBoss() : makeBlight(o.kind);
    if (type === 'goblin' || type === 'archer') {
      e.weapon = type === 'archer' ? 'b_goblin' : tier >= 2 ? (hash2(x | 0, z | 0, 2) < 0.5 ? 'w_dragonbone' : 'w_boko2') : tier === 1 ? (hash2(x | 0, z | 0, 3) < 0.5 ? 'w_spiked' : 'w_bokospear') : hash2(x | 0, z | 0, 4) < 0.6 ? 'w_club' : 'w_bokospear';
      const wm = e.weapon.startsWith('b_') ? bowMesh(e.weapon) : weaponMesh(e.weapon); if (!e.weapon.startsWith('b_')) wm.rotation.x = Math.PI / 2; e.model.userData.P.armRh.add(wm);
    }
    e.model.position.set(x, e.y, z); scene.add(e.model);
    e.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex(), transparent: true, depthTest: false })); e.mark.scale.set(0.9, 0.9, 1); e.mark.visible = false; scene.add(e.mark);
    if (type === 'sentinel' || type === 'scout' || type === 'blight' || type === 'boss') e.beam = laserLine(type === 'boss' ? '#ff2a6a' : '#ff3a3a');
    enemies.push(e); return e;
  }
  function makeBlight(kind) {
    const g = makeBoss(), col = BLIGHT_COL[kind] || '#ff6a2a';
    g.scale.setScalar(0.5); g.userData.P.eye.material = glowMat(col, 2.6); g.traverse((o) => { if (o.isMesh && !o.userData.isOutline && o !== g.userData.P.eye && o.material.emissive && o.material.emissiveIntensity > 1) o.material = glowMat(col, 2); });
    return g;
  }
  let markCanvasTex = null;
  function markTex() { if (markCanvasTex) return markCanvasTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffe040'; g.strokeStyle = '#000'; g.lineWidth = 6; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.strokeText('!', 32, 54); g.fillText('!', 32, 54); return (markCanvasTex = new THREE.CanvasTexture(c)); }
  function laserLine(col) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 })); l.visible = false; l.frustumCulled = false; scene.add(l); return l; }
  function remove(e) { scene.remove(e.model); scene.remove(e.mark); if (e.beam) scene.remove(e.beam); const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); }
  const P = () => game.player();
  const chest = (e) => e.y + TYPES[e.type].h * (e.type === 'sentinel' ? 0.75 : 0.55);

  // outdoors: bring camps, ogres, sentinels and boars to life when you come near; let them go when you are far
  let scanT = 0;
  function scan() {
    const p = P(), S = game.S;
    const near = (o, d) => Math.hypot(o.x - p.x, o.z - p.z) < d;
    const has = (key) => enemies.some((e) => e.key === key);
    const killed = (key) => S.kills[key] !== undefined;
    for (const c of POI.camps) {
      if (!near(c, 150)) continue;
      const tier = campTier(c);
      for (let i = 0; i < c.size; i++) { const key = c.id + '#' + i; if (has(key) || killed(key)) continue; const a = (i / c.size) * Math.PI * 2; spawn('goblin', c.x + Math.cos(a) * 3.2, c.z + Math.sin(a) * 3.2, { key, camp: c.id, tier: i === 0 ? tier : Math.max(0, tier - (i % 2)) }); }
      if (c.post) { const key = c.id + '#a'; if (!has(key) && !killed(key)) spawn('archer', c.post[0], c.post[2], { key, camp: c.id, tier: Math.max(0, tier - 1), y: c.post[1], post: true }); }
    }
    for (const o of POI.ogres) if (near(o, 160) && !has(o.id) && !killed(o.id)) spawn('ogre', o.x, o.z, { key: o.id });
    for (const s of POI.sentinels) if (near(s, 190) && !has(s.id) && !killed(s.id)) spawn('sentinel', s.x, s.z, { key: s.id, walk: s.walk, hpMul: s.dormant ? 0.7 : 1 });
    for (const b of POI.boars) if (near(b, 120) && !has(b.id) && !killed(b.id)) spawn('boar', b.x, b.z, { key: b.id });
    for (const e of [...enemies]) if (e.key && !e.inShrine && Math.hypot(e.x - p.x, e.z - p.z) > 240 && e.type !== 'boss') remove(e);
  }
  function campTier(c) {
    const reg = c.region, prog = game.S.blights || 0, r = hash2(c.x | 0, c.z | 0, 9);
    if (reg === 'plateau') return 0;
    if (reg === 'central' || reg === 'forest' || reg === 'east') return r < 0.5 + prog * 0.1 ? 1 : 0 + (prog >= 3 ? 1 : 0);
    return r < 0.35 + prog * 0.12 ? 2 : 1;
  }
  function alertCamp(camp) { for (const e of enemies) if (e.camp === camp && e.state === 'idle') { e.state = 'alert'; e.t = 0.3 + Math.random() * 0.4; } }

  function hurtEnemy(e, dmg, from, o = {}) {
    if (e.dead) return;
    if (e.frozen > 0) { const d = v3.set(e.x - from.x, 0, e.z - from.z).normalize().multiplyScalar(dmg * 0.25); e.impulse.add(d); e.storedDmg = (e.storedDmg || 0) + dmg; game.sfx('hit'); return; }
    e.hp -= dmg; e.flash = 0.15; game.sfx('hit');
    gfx.burst({ x: e.x, y: chest(e), z: e.z }, { n: 6, color: '#ffffff', speed: 3, life: 0.3, size: 0.35 });
    if (e.type === 'boar') { e.state = 'flee'; e.t = 4; }
    else if (e.state === 'idle' || e.state === 'return') { e.state = 'chase'; if (e.camp) alertCamp(e.camp); }
    if (o.knock && ['goblin', 'boar', 'scout'].includes(e.type)) { const k = v3.set(e.x - from.x, 0, e.z - from.z).normalize(); e.kx = k.x * o.knock; e.kz = k.z * o.knock; e.stun = Math.max(e.stun, 0.35); }
    if (o.stun) e.stun = Math.max(e.stun, o.stun);
    if (e.hp <= 0) die(e);
  }
  function die(e) {
    e.dead = true; e.state = 'dead'; e.t = 0; e.mark.visible = false; if (e.beam) e.beam.visible = false;
    if (e.key) game.S.kills[e.key] = game.S.day;
    gfx.burst({ x: e.x, y: chest(e), z: e.z }, { n: e.type === 'boss' ? 60 : 18, color: e.type === 'boar' ? '#ffffff' : '#c060ff', speed: 4, life: 0.9, size: 0.6 });
    const drop = (item, dx = 0, dz = 0) => addPickup(item, e.x + dx, e.y, e.z + dz);
    if (e.type === 'goblin' || e.type === 'archer') { if (Math.random() < 0.65) drop('horn', 0.4); if (e.weapon && Math.random() < 0.6) drop(e.weapon, -0.6, 0.3); if (e.type === 'archer') drop('arrows:4', 0.3, -0.5); if (Math.random() < 0.15) drop('amber', 0, 0.6); }
    if (e.type === 'ogre') { drop('horn', 0.5); drop('horn', -0.5); drop('ruby', 0, 0.6); drop('gold:60', 0, -0.6); }
    if (e.type === 'sentinel' || e.type === 'scout') { drop('screw', 0.6); drop('screw', -0.6); if (Math.random() < (e.type === 'sentinel' ? 0.45 : 0.15)) drop(['w_ancient', 'b_ancient', 's_ancient'][Math.floor(Math.random() * 3)], 0, 0.8); }
    if (e.type === 'boar') { drop('meat', 0.4); if (Math.random() < 0.5) drop('meat', -0.4); }
    if (e.camp && !enemies.some((o) => o.camp === e.camp && !o.dead)) game.campCleared(e.camp);
    game.enemyDied(e);
  }
  // enemy attacks reach the player through game.hurt (it handles shields, perfect guards, the champions' gifts)
  function strike(e, dmg, kind) { return game.hurt(dmg, e, kind); }

  function face(e, x, z, rate, dt) { const want = Math.atan2(x - e.x, z - e.z); let d = want - e.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); e.yaw += Math.max(-rate * dt, Math.min(rate * dt, d)); return Math.abs(d); }
  function moveTo(e, x, z, sp, dt) {
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz); if (d < 0.1) return;
    face(e, x, z, 7, dt); e.x += (dx / d) * sp * dt; e.z += (dz / d) * sp * dt;
  }
  function ground(e) {
    const o = { x: e.x, y: e.y, z: e.z }; pushOut(L, o, TYPES[e.type].r, TYPES[e.type].h); e.x = o.x; e.z = o.z;
    if (e.post) return;
    const g = groundAt(L, e.x, e.z, e.y + 1).h; e.y += (g - e.y) * 0.5;
    if (L.terrain && g < -1.2 && e.type !== 'boss') { e.x -= (e.x - e.home[0]) * 0.05; e.z -= (e.z - e.home[1]) * 0.05; }   // don't wade into the sea
  }
  // laser: charge, lock on, fire
  function laserAI(e, dt, p, d, T, sees) {
    if (e.state !== 'charge' && e.state !== 'cool') { if (sees) { e.state = 'charge'; e.t = 0; e.aim = new THREE.Vector3(p.x, p.y + 1, p.z); game.sfx('lockon'); } return; }
    if (e.state === 'cool') { e.t -= dt; if (e.t <= 0) e.state = sees ? 'charge' : 'idle', e.t = 0; e.beam.visible = false; return; }
    e.t += dt; const lockAt = T.charge - 0.35;
    if (e.t < lockAt) { e.aim.lerp(v3.set(p.x + p.vx * 0.25, p.y + 1, p.z + p.vz * 0.25), Math.min(1, dt * 6)); }
    const eye = eyePos(e), ln = e.beam;
    ln.visible = true; ln.geometry.attributes.position.setXYZ(0, eye.x, eye.y, eye.z); ln.geometry.attributes.position.setXYZ(1, e.aim.x, e.aim.y, e.aim.z); ln.geometry.attributes.position.needsUpdate = true;
    ln.material.opacity = 0.3 + 0.6 * Math.abs(Math.sin(e.t * (6 + e.t * 6)));
    if (e.t >= T.charge) {
      e.state = 'cool'; e.t = e.type === 'boss' ? 0.8 : e.type === 'scout' ? 1.8 : 2.4;
      flash(eye, e.aim, e.type === 'scout' ? '#ff8a6a' : '#ff4a4a');
      game.sfx('laser'); gfx.burst(e.aim, { n: 16, color: '#ffb060', speed: 5, life: 0.5, size: 0.7 });
      const hit = Math.hypot(p.x - e.aim.x, p.y + 1 - e.aim.y, p.z - e.aim.z) < (e.type === 'boss' ? 2.6 : 2.2);
      if (hit) { const r = strike(e, e.type === 'boss' ? 10 : e.type === 'blight' ? 12 : T.dmg[0], 'laser'); if (r === 'reflect') { hurtEnemy(e, e.type === 'scout' ? 60 : e.type === 'sentinel' ? 300 : 160, p, { stun: 2 }); flash(v3.set(p.x, p.y + 1.2, p.z).clone(), eye, '#40c8ff'); } }
    }
  }
  function eyePos(e) { const P2 = e.model.userData.P; const w = new THREE.Vector3(); (P2.pupil || P2.eye).getWorldPosition(w); return w; }
  function flash(a, b, col) { const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]); const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, linewidth: 3 })); m.frustumCulled = false; scene.add(m); beams.push({ m, t: 0.18 }); }

  function updateEnemy(e, dt) {
    const T = TYPES[e.type], p = P(), dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), m = e.model, PP = m.userData.P;
    if (e.dead) { e.t += dt; m.rotation.x = Math.min(1.4, e.t * 3); m.position.y -= dt * (e.t > 0.8 ? 1.5 : 0); if (e.t > 1.6) remove(e); return; }
    e.flash = Math.max(0, e.flash - dt);
    if (e.frozen > 0) {
      e.frozen -= dt; if (e.beam) e.beam.visible = false;
      if (e.frozen <= 0) { const imp = e.impulse.length(); if (imp > 0) { e.kx = e.impulse.x * 2; e.kz = e.impulse.z * 2; e.impulse.set(0, 0, 0); hurtEnemy(e, e.storedDmg || 0, { x: e.x - e.kx, z: e.z - e.kz }); e.storedDmg = 0; } }
      tint(e, '#ffd040'); return;
    }
    tint(e, e.flash > 0 ? '#ffffff' : null);
    if (e.kx) { e.x += e.kx * dt; e.z += e.kz * dt; e.kx *= 0.85; e.kz *= 0.85; if (Math.abs(e.kx) < 0.1) e.kx = e.kz = 0; }
    if (e.stun > 0) { e.stun -= dt; if (e.beam) e.beam.visible = false; ground(e); place(e, dt, 0); return; }
    const playerHere = !game.hidden() && game.levelId() === (e.inShrine || 'world');
    const night = gfx.night > 0.5 ? 0.65 : 1, sees = playerHere && d < T.sight * night && (d < 7 || Math.cos(Math.atan2(dx, dz) - e.yaw) > -0.1 || e.state !== 'idle');
    let speed = 0;
    if (e.type === 'boar') {
      if (e.state === 'flee' || (playerHere && d < 11)) { if (e.state !== 'flee') { e.state = 'flee'; e.t = 3.5; } e.t -= dt; moveTo(e, e.x - dx * 3, e.z - dz * 3, T.run, dt); speed = T.run; if (e.t <= 0) e.state = 'idle'; }
      else speed = wander(e, dt, 1.2);
    } else if (e.type === 'goblin' || e.type === 'ogre') {
      if (e.state === 'idle') { speed = wander(e, dt, e.type === 'ogre' ? 1 : 0.8); if (sees) { e.state = 'alert'; e.t = 0.6; if (e.camp) alertCamp(e.camp); game.sfx('alert'); game.combat(); } }
      else if (e.state === 'alert') { e.t -= dt; face(e, p.x, p.z, 8, dt); e.mark.visible = true; if (e.t <= 0) { e.state = 'chase'; e.mark.visible = false; } }
      else if (e.state === 'chase') {
        game.combat();
        if (!playerHere || d > 55) { e.state = 'return'; }
        else if (d > T.reach) { moveTo(e, p.x, p.z, T.run * (e.tier >= 2 ? 1.1 : 1), dt); speed = T.run; }
        else if (e.cd <= 0) { e.state = 'attack'; e.t = 0; }
        else face(e, p.x, p.z, 6, dt);
        e.cd -= dt;
      } else if (e.state === 'attack') {
        e.t += dt; const wind = e.type === 'ogre' ? 0.9 : 0.5; face(e, p.x, p.z, 3, dt);
        if (e.t >= wind && !e.swung) { e.swung = true; game.sfx('swing'); if (d < T.reach + 0.8 && Math.cos(Math.atan2(dx, dz) - e.yaw) > 0.3) strike(e, T.dmg[e.tier] ?? T.dmg[0], 'melee'); if (e.type === 'ogre') gfx.burst({ x: e.x + Math.sin(e.yaw) * 3, y: e.y + 0.3, z: e.z + Math.cos(e.yaw) * 3 }, { n: 14, color: '#c8b090', speed: 4, add: false, size: 0.8 }); }
        if (e.t >= wind + 0.35) { e.state = 'chase'; e.swung = false; e.cd = e.type === 'ogre' ? 1.6 : 0.9 + Math.random() * 0.6; }
      } else if (e.state === 'return') { speed = 2; moveTo(e, e.home[0], e.home[1], 2.2, dt); if (Math.hypot(e.home[0] - e.x, e.home[1] - e.z) < 1.5) e.state = 'idle'; if (sees && d < 15) e.state = 'chase'; }
    } else if (e.type === 'archer') {
      if (sees) { face(e, p.x, p.z, 6, dt); e.mark.visible = e.state === 'idle'; if (e.state === 'idle') { e.state = 'aim'; e.t = 1.2; game.sfx('alert'); if (e.camp) alertCamp(e.camp); } game.combat(); }
      if (e.state === 'aim') { e.t -= dt; if (e.t <= 0) { e.mark.visible = false; e.t = 2.6; if (playerHere && d < T.sight) shootArrow({ x: e.x, y: e.y + 1.5, z: e.z }, { x: p.x + p.vx * d / 40, y: p.y + 1.1, z: p.z + p.vz * d / 40 }, 'enemy', T.dmg[e.tier] ?? 2); } }
    } else if (e.type === 'sentinel' || e.type === 'scout') {
      if (PP.eyeP) { if (e.state === 'idle') { PP.eyeP.rotation.y = Math.sin(e.t * 0.6) * 1.2; e.t += dt; } else PP.eyeP.rotation.y *= 0.9; }
      if (e.state !== 'idle') { face(e, p.x, p.z, e.type === 'scout' ? 3 : 1.2, dt); game.combat(); }
      if ((e.walk || e.type === 'scout') && e.state !== 'idle' && d > 6) { moveTo(e, p.x, p.z, e.type === 'scout' ? T.run : 2.4, dt); speed = 2; }
      laserAI(e, dt, p, d, T, sees);
      if (!sees && e.state === 'charge' && e.t < 0.3) { e.state = 'idle'; e.beam.visible = false; }
    } else if (e.type === 'blight' || e.type === 'boss') bossAI(e, dt, p, d, T, sees);
    ground(e); place(e, dt, speed);
    if (e.mark.visible) e.mark.position.set(e.x, e.y + T.h + 0.8, e.z);
  }
  function wander(e, dt, sp) {
    e.t -= dt;
    if (!e.wander || e.t <= 0) { e.t = 2 + Math.random() * 4; e.wander = Math.random() < 0.5 ? null : [e.home[0] + (Math.random() - 0.5) * 10, e.home[1] + (Math.random() - 0.5) * 10]; }
    if (e.wander) { moveTo(e, e.wander[0], e.wander[1], sp, dt); if (Math.hypot(e.wander[0] - e.x, e.wander[1] - e.z) < 0.5) e.wander = null; return sp; }
    return 0;
  }
  // the Blights and the Gloomshade: swipe, laser, call for help (orbs from the Gloomshade)
  function bossAI(e, dt, p, d, T, sees) {
    if (!sees) return;
    game.combat(true);
    e.cd -= dt;
    if (e.state === 'charge' || e.state === 'cool') { laserAI(e, dt, p, d, T, sees); if (e.state === 'cool' && e.t < 0.1) { e.state = 'chase'; e.cd = 1.2; e.beam.visible = false; } return; }
    if (e.state === 'swipe') {
      e.t += dt; face(e, p.x, p.z, 3, dt); const PP = e.model.userData.P; PP.armR.rotation.x = -2 + Math.min(1, e.t / 0.7) * 2.6;
      if (e.t >= 0.7 && !e.swung) { e.swung = true; game.sfx('swing'); if (d < T.reach + 1 && Math.cos(Math.atan2(p.x - e.x, p.z - e.z) - e.yaw) > 0.2) strike(e, T.dmg[0] + (e.type === 'boss' && e.hp < e.max / 2 ? 4 : 0), 'melee'); }
      if (e.t >= 1.1) { e.state = 'chase'; e.swung = false; e.cd = 0.8; PP.armR.rotation.x = 0; }
      return;
    }
    if (e.type === 'blight' && !e.called && e.hp < e.max / 2) { e.called = true; for (const s of [-1, 1]) spawn('scout', e.x + s * 4, e.z + 2, { inShrine: e.inShrine, y: e.y }); game.msg(['災厄召喚了守護者！', 'The Blight calls its guardians!']); }
    if (e.type === 'boss' && !e.called && e.hp < e.max / 2) { e.called = true; for (const s of [-1, 1]) spawn('goblin', e.x + s * 6, e.z + 4, { tier: 2, y: e.y, key: 'bossminion' + s }).state = 'chase'; game.msg(['黑霧魔怒吼，召來了霧精！', 'The Gloom roars and calls its gremlins!']); }
    face(e, p.x, p.z, 2.5, dt);
    if (d > T.reach) { moveTo(e, p.x, p.z, T.run * (e.hp < e.max / 2 ? 1.3 : 1), dt); }
    if (e.cd <= 0) {
      const r = Math.random();
      if (d < T.reach + 0.5 && r < 0.6) { e.state = 'swipe'; e.t = 0; }
      else if (e.type === 'boss' && r < 0.8) { for (let k = 0; k < 3; k++) orbs.push(makeOrb(e, k)); e.cd = 3; game.sfx('orb'); }
      else { e.state = 'charge'; e.t = 0; e.aim = new THREE.Vector3(p.x, p.y + 1, p.z); game.sfx('lockon'); }
    }
  }
  function makeOrb(e, k) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), glowMat('#c02a8a', 2.6)); m.position.set(e.x + (k - 1) * 2, e.y + 6, e.z); scene.add(m); return { m, t: 4 + k * 0.4, v: new THREE.Vector3() }; }
  function tint(e, col) {
    if (e.tint === col) return; e.tint = col;
    e.model.traverse((o) => { if (o.isMesh && !o.userData.isOutline && o.material.emissive) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = col ? glowMat(col, 0.6) : o.userData.mat0; } });
  }
  function place(e, dt, speed) {
    const m = e.model, PP = m.userData.P; m.position.set(e.x, e.y, e.z); m.rotation.y = e.yaw;
    e.anim = (e.anim || 0) + dt * (speed > 0 ? speed * 2.2 : 1);
    if (PP.legL) { const a = speed > 0 ? Math.sin(e.anim) * 0.7 : 0; PP.legL.rotation.x = a; PP.legR.rotation.x = -a; }
    if (PP.armL && e.state !== 'swipe') { PP.armL.rotation.x = speed > 0 ? -Math.sin(e.anim) * 0.5 : Math.sin(e.anim * 0.5) * 0.08; if (e.state === 'attack') PP.armR.rotation.x = -2.6 + Math.min(1, e.t / 0.5) * 3.2; else if (e.state === 'aim') PP.armR.rotation.x = -1.4; else PP.armR.rotation.x = speed > 0 ? Math.sin(e.anim) * 0.5 : 0; }
    if (PP.legs) PP.legs.forEach((l, i) => { l.rotation.x = speed > 0 ? Math.sin(e.anim + i) * 0.3 : 0; });
    if (e.type === 'boss' || e.type === 'blight') { PP.hips.position.y = 3.5 + Math.sin(e.anim * 2) * 0.2; PP.core.rotation.y += dt * 0.3; }
  }

  // ---------------------------------------------------------------- arrows (yours and the archers')
  function shootArrow(from, to, owner, dmg, speed = owner === 'player' ? 62 : 34) {
    const dir = v3.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), toon(owner === 'player' ? '#f0e8d0' : '#8a6a4a')); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); g.position.set(from.x, from.y, from.z); scene.add(g);
    arrows.push({ g, p: new THREE.Vector3(from.x, from.y, from.z), v: dir.clone().multiplyScalar(speed), owner, dmg, life: 3 });
  }
  function updateArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i], o = a.p.clone(); a.v.y -= (a.owner === 'player' ? 4 : 9) * dt; a.p.addScaledVector(a.v, dt); a.life -= dt;
      a.g.position.copy(a.p); a.g.lookAt(a.p.clone().add(a.v));
      let hit = false;
      if (a.owner === 'player') {
        for (const e of enemies) {
          if (e.dead) continue; const T = TYPES[e.type], c = new THREE.Vector3(e.x, chest(e), e.z), r = T.r * 1.1 + 0.3;
          if (segDist(o, a.p, c) < r) {
            let dmg = a.dmg; const eye = e.model.userData.P.pupil || e.model.userData.P.eye;
            if (eye && (e.type !== 'boar')) { const ep = new THREE.Vector3(); eye.getWorldPosition(ep); if (segDist(o, a.p, ep) < (e.type === 'boss' ? 1.0 : 0.7)) { dmg *= 2; e.stun = Math.max(e.stun, e.type === 'boss' ? 1.4 : 2); game.msg(['命中弱點！', 'Weak point!']); if (e.beam) { e.beam.visible = false; if (e.state === 'charge') e.state = 'cool', e.t = 1; } } }
            if (e.type === 'goblin' && o.y > e.y + 1.3) dmg *= 1.5;
            hurtEnemy(e, dmg, { x: o.x, z: o.z }, { knock: 2 }); hit = true; break;
          }
        }
        if (!hit) for (const pr of props) if (pr.frozen > 0 && aabbHit(pr, a.p)) { pr.impulse.addScaledVector(a.v.clone().normalize(), 4); hit = true; game.sfx('hit'); break; }
      } else {
        const p = P(), c = new THREE.Vector3(p.x, p.y + 1, p.z);
        if (segDist(o, a.p, c) < 0.6) { strike({ x: o.x, z: o.z, type: 'archer' }, a.dmg, 'arrow'); hit = true; }
      }
      const gy = groundAt(L, a.p.x, a.p.z, a.p.y + 0.5).h;
      if (hit || a.life <= 0 || a.p.y < gy || a.p.y < L.killY) { scene.remove(a.g); arrows.splice(i, 1); }
    }
  }
  const segDist = (a, b, c) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / (ab.lengthSq() || 1))); return a.clone().addScaledVector(ab, t).distanceTo(c); };
  const aabbHit = (pr, p) => p.x > pr.box.min[0] - 0.2 && p.x < pr.box.max[0] + 0.2 && p.y > pr.box.min[1] - 0.2 && p.y < pr.box.max[1] + 0.2 && p.z > pr.box.min[2] - 0.2 && p.z < pr.box.max[2] + 0.2;

  // ---------------------------------------------------------------- things on the ground to pick up
  function addPickup(item, x, y, z) {
    const g = new THREE.Group(); let m;
    const id = item.split(':')[0];
    if (WEAPONS[id]) { m = weaponMesh(id); m.rotation.z = Math.PI / 2; m.position.y = 0.15; }
    else if (BOWS[id]) { m = bowMesh(id); m.rotation.x = Math.PI / 2; m.position.y = 0.1; }
    else if (SHIELDS[id]) { m = shieldMesh(id); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; }
    else m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), toon(MATS[id] ? MATS[id].col : id === 'gold' ? '#ffd040' : '#e8dcc0'));
    g.add(m); const gl = gfx.glowSprite(0, 0.5, 0, 0.6, '#fff6c0', g); void gl;
    const yy = groundAt(L, x, z, y + 1).h; g.position.set(x, yy + 0.2, z); scene.add(g);
    const p = { item, x, y: yy, z, g }; pickups.push(p); return p;
  }
  function takePickup(p) { scene.remove(p.g); const i = pickups.indexOf(p); if (i >= 0) pickups.splice(i, 1); }

  // ---------------------------------------------------------------- props, runes
  // a prop: { kind: slab | crate | bomb | ice, box: {min, max} (also a floor and a wall for you), size, metal, held, frozen }
  function addProp(kind, pos, size, o = {}) {
    const [sx, sy, sz] = size, mat = kind === 'ice' ? toon('#bfe8ff', { transparent: true, opacity: 0.85 }) : kind === 'bomb' ? glowMat('#40c8ff', 0.7) : toon(o.metal ? '#6a7080' : '#8a5a2a');
    const geo = kind === 'bomb' ? new THREE.SphereGeometry(sx / 2, 14, 12) : new THREE.BoxGeometry(sx, sy, sz);
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; scene.add(m);
    if (o.metal && kind !== 'bomb') { const band = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, Math.min(0.12, sy * 0.3), sz + 0.02), glowMat('#ff5a3a', 0.6)); m.add(band); }
    const pr = { kind, size, m, metal: !!o.metal, held: false, frozen: 0, impulse: new THREE.Vector3(), v: new THREE.Vector3(), home: pos.slice(), box: { min: [0, 0, 0], max: [0, 0, 0], climb: kind === 'ice', temp: true, prop: true }, y0: pos[1] - sy / 2, rise: kind === 'ice' ? 0 : 1, ...o };
    pr.p = new THREE.Vector3(pos[0], pos[1], pos[2]); props.push(pr); if (kind !== 'bomb') L.dyn.push(pr.box); syncProp(pr); return pr;
  }
  function syncProp(pr) {
    const [sx, sy, sz] = pr.size, h = pr.kind === 'ice' ? sy * pr.rise : sy;
    pr.box.min = [pr.p.x - sx / 2, pr.p.y - sy / 2, pr.p.z - sz / 2]; pr.box.max = [pr.p.x + sx / 2, pr.p.y - sy / 2 + h, pr.p.z + sz / 2];
    pr.m.position.set(pr.p.x, pr.p.y - sy / 2 + h / 2, pr.p.z); if (pr.kind === 'ice') pr.m.scale.y = Math.max(0.01, pr.rise);
  }
  function removeProp(pr) { scene.remove(pr.m); const i = props.indexOf(pr); if (i >= 0) props.splice(i, 1); const j = L.dyn.indexOf(pr.box); if (j >= 0) L.dyn.splice(j, 1); }
  // what a prop rests on: the highest floor under any part of it
  function floorUnder(pr) {
    const [sx, , sz] = pr.size, b = pr.box; let best = -1e9; const keep = pr.box.off; pr.box.off = true;
    for (const [fx, fz] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) best = Math.max(best, groundAt(L, pr.p.x + fx * sx, pr.p.z + fz * sz, b.min[1] + 0.3).h);
    pr.box.off = keep; return best;
  }
  function updateProps(dt) {
    for (const pr of [...props]) {
      if (pr.kind === 'ice') { pr.rise = Math.min(1, pr.rise + dt * 3); syncProp(pr); continue; }
      if (pr.kind === 'bomb') { pr.life = (pr.life || 0) + dt; pr.m.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(pr.life * 4)) * 0.8; }
      if (pr.held) { const tgt = game.magnetTarget(pr); pr.v.set(tgt.x - pr.p.x, tgt.y - pr.p.y, tgt.z - pr.p.z).multiplyScalar(6).clampLength(0, 14); }
      else if (pr.frozen > 0) { pr.frozen -= dt; pr.v.set(0, 0, 0); pr.m.material = toon('#ffd040'); if (pr.frozen <= 0) { pr.m.material = pr.metal ? toon('#6a7080') : pr.kind === 'bomb' ? glowMat('#40c8ff', 0.7) : toon('#8a5a2a'); pr.v.copy(pr.impulse.clampLength(0, 30)); pr.impulse.set(0, 0, 0); } continue; }
      else pr.v.y -= G * dt;
      // move axis by axis so walls stop it
      const sy = pr.size[1];
      for (const ax of ['x', 'z', 'y']) {
        const old = pr.p[ax]; pr.p[ax] += pr.v[ax] * dt; syncProp(pr);
        if (ax === 'y') { const fl = floorUnder(pr); if (pr.p.y - sy / 2 < fl && pr.v.y <= 0 && !pr.held) { pr.p.y = fl + sy / 2; pr.v.y = 0; pr.v.x *= 0.82; pr.v.z *= 0.82; } else if (pr.held && pr.p.y - sy / 2 < fl) pr.p.y = fl + sy / 2; syncProp(pr); }
        else if (hitsWall(pr)) { pr.p[ax] = old; pr.v[ax] = 0; syncProp(pr); }
      }
      if (pr.p.y < L.killY) { if (pr.kind === 'bomb') removeProp(pr); else { pr.p.set(...pr.home); pr.v.set(0, 0, 0); pr.held = false; syncProp(pr); game.msg(['物件回到了原處。', 'The object returned to its place.']); } }
    }
  }
  function hitsWall(pr) {
    const b = pr.box, keep = b.off; b.off = true; let hit = false;
    const list = L.terrain ? [] : L.boxes;
    for (const o of list) { if (o.off || o === b) continue; if (b.min[0] < o.max[0] - 0.02 && b.max[0] > o.min[0] + 0.02 && b.min[2] < o.max[2] - 0.02 && b.max[2] > o.min[2] + 0.02 && b.min[1] < o.max[1] - 0.05 && b.max[1] > o.min[1] + 0.05) { hit = true; break; } }
    if (L.terrain && b.min[1] < groundH(pr.p.x, pr.p.z) - 0.3) hit = true;
    b.off = keep; return hit;
  }
  // a bomb goes off: hurts, throws, breaks cracked walls and ore
  function explode(pos) {
    game.sfx('boom'); gfx.burst(pos, { n: 30, color: '#ffc060', speed: 8, life: 0.6, size: 1.2 }); gfx.burst(pos, { n: 14, color: '#8a8a8a', speed: 3, life: 1.2, size: 1.6, add: false, grav: -1 });
    for (const e of enemies) { const d = Math.hypot(e.x - pos.x, chest(e) - pos.y, e.z - pos.z); if (d < 4.8 + TYPES[e.type].r) hurtEnemy(e, e.type === 'blight' || e.type === 'boss' ? 30 : 14, pos, { knock: 8 }); }
    for (const pr of props) { if (pr.kind === 'bomb' || pr.kind === 'ice') continue; const d = pr.p.distanceTo(pos); if (d < 5) { if (pr.frozen > 0) pr.impulse.add(pr.p.clone().sub(pos).normalize().multiplyScalar(10)); else pr.v.add(pr.p.clone().sub(pos).normalize().multiplyScalar(8)); } }
    const p = P(); if (Math.hypot(p.x - pos.x, p.y + 1 - pos.y, p.z - pos.z) < 2.6) game.hurt(2, { x: pos.x, z: pos.z, type: 'bomb' }, 'bomb');
    game.exploded(pos);
  }
  // runes ---------------------------------------------------------------
  function propOnRay(o, d, want) {
    let best = null, bt = 30;
    for (const pr of props) { if (want === 'metal' && !pr.metal) continue; if (pr.kind === 'ice' || pr.kind === 'bomb') continue; const t = rayBox(o, d, pr.box); if (t !== null && t < bt) { bt = t; best = pr; } }
    return best;
  }
  function rayBox(o, d, b) {
    let t0 = 0, t1 = 1e9;
    for (const [i, k] of [[0, 'x'], [1, 'y'], [2, 'z']]) { const inv = 1 / (d[k] || 1e-9); let a = (b.min[i] - o[k]) * inv, c = (b.max[i] - o[k]) * inv; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return null; }
    return t0;
  }
  function enemyOnRay(o, d) { let best = null, bt = 40; for (const e of enemies) { if (e.dead || e.type === 'boss') continue; const c = new THREE.Vector3(e.x, chest(e), e.z), t = c.clone().sub(o).dot(d); if (t < 0 || t > bt) continue; if (o.clone().addScaledVector(d, t).distanceTo(c) < TYPES[e.type].r + 0.6) { bt = t; best = e; } } return best; }
  // a gate can be aimed at anywhere along its path (a raised gate is still a target)
  function gateOnRay(o, d) {
    if (L.terrain) return null; let best = null, bt = 30;
    for (const g of game.gates()) { if (g.frozen > 0) continue; const b = g.box, h = b.max[1] - b.min[1], span = { min: [b.min[0], g.y0, b.min[2]], max: [b.max[0], g.y0 + Math.max(0, g.lift) + h, b.max[2]] }; const t = rayBox(o, d, span); if (t !== null && t < bt) { bt = t; best = g; } }
    return best;
  }

  // ---------------------------------------------------------------- the people of the village (and the hermit)
  for (const n of POI.npcs) { const m = makeNPC(n.look); m.position.set(n.x, n.y, n.z); scene.add(m); npcs.push({ ...n, m }); }

  // ---------------------------------------------------------------- each frame
  function update(dt) {
    L = game.level();
    if (L.terrain) { scanT -= dt; if (scanT <= 0) { scanT = 0.6; scan(); } }
    for (const e of [...enemies]) { if (!!e.inShrine !== !L.terrain) { e.model.visible = false; continue; } e.model.visible = true; updateEnemy(e, dt); }
    updateArrows(dt); updateProps(dt);
    for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.t -= dt; if (b.t <= 0) { scene.remove(b.m); beams.splice(i, 1); } }
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], p = P(); o.t -= dt; const to = v3.set(p.x - o.m.position.x, p.y + 1 - o.m.position.y, p.z - o.m.position.z);
      if (o.t < 3.6) { o.v.addScaledVector(to.normalize(), dt * 14).clampLength(0, 9); o.m.position.addScaledVector(o.v, dt); } else o.m.position.y += dt * 1.5;
      if (o.m.position.distanceTo(v3.set(p.x, p.y + 1, p.z)) < 1.1) { const r = game.hurt(8, { x: o.m.position.x, z: o.m.position.z, type: 'orb' }, 'orb'); o.t = 0; if (r === 'reflect' || r === 'block') gfx.burst(o.m.position, { n: 10, color: '#c02a8a' }); }
      if (o.t <= 0) { scene.remove(o.m); orbs.splice(i, 1); }
    }
    for (const p of pickups) { p.g.rotation.y += dt * 1.5; p.g.position.y = p.y + 0.25 + Math.sin(performance.now() / 400 + p.x) * 0.06; }
    const pl = P();
    for (const n of npcs) { const d = Math.hypot(n.x - pl.x, n.z - pl.z); if (d < 8 && n.look !== 'statue') n.m.rotation.y = Math.atan2(pl.x - n.x, pl.z - n.z); const P2 = n.m.userData.P; if (P2 && P2.hips) P2.hips.position.y = (P2.legL ? 0.85 * 0.82 : 0.85) + Math.sin(performance.now() / 600 + n.x) * 0.01; }
  }
  function clearShrine() { for (const e of [...enemies]) if (e.inShrine) remove(e); for (const pr of [...props]) removeProp(pr); for (const p of [...pickups]) if (p.inShrine) takePickup(p); }
  function clearAll() { for (const e of [...enemies]) remove(e); for (const pr of [...props]) removeProp(pr); for (const p of [...pickups]) takePickup(p); for (const a of arrows) scene.remove(a.g); arrows.length = 0; for (const o of orbs) scene.remove(o.m); orbs.length = 0; }
  return { enemies, pickups, props, npcs, spawn, remove, hurtEnemy, update, shootArrow, addPickup, takePickup, addProp, removeProp, explode, propOnRay, enemyOnRay, gateOnRay, rayBox, clearShrine, clearAll, syncProp, TYPES, chest, setLevel(l) { L = l; } };
}
