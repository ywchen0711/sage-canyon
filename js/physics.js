// Moving about: the ground under you, walls around you, and the player's ways of getting anywhere: walk, run, sprint,
// jump, climb (any steep slope or wall, while stamina lasts), glide, swim. A "level" says what is solid:
// outdoors it is the terrain plus buildings, trunks and rocks; inside a shrine it is the shrine's boxes.
import { groundH, normalAt, solidsNear, W } from './world.js';
import { clamp } from './noise.js';

export const G = 26, JUMP = 8.4, R_PLAYER = 0.42, STEP = 0.55;
export const outdoor = { terrain: true, water: (x, z) => W.sea, dyn: [], killY: -80, rain: false };
export function shrineLevel(boxes, waters = [], killY = -20) { return { terrain: false, boxes, water: (x, z) => { for (const w of waters) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return w.y; return -1e9; }, dyn: [], killY }; }

// every solid box near a point (static ones from the level, moving ones such as crates, ice pillars and gates)
function boxesNear(L, x, z, r) {
  const out = [];
  if (L.terrain) for (const o of solidsNear(x, z, r)) if (o.min) out.push(o);
  if (L.boxes) for (const b of L.boxes) if (!b.off && x > b.min[0] - r - 1 && x < b.max[0] + r + 1 && z > b.min[2] - r - 1 && z < b.max[2] + r + 1) out.push(b);
  for (const b of L.dyn) if (!b.off && b.min && x > b.min[0] - r - 1 && x < b.max[0] + r + 1 && z > b.min[2] - r - 1 && z < b.max[2] + r + 1) out.push(b);
  return out;
}
const cylsNear = (L, x, z, r) => { const out = []; if (L.terrain) for (const o of solidsNear(x, z, r)) if (o.r !== undefined && !o.gone) out.push(o); for (const o of L.dyn) if (o.r !== undefined && o.cyl && !o.off) out.push(o); return out; };

// the highest floor under (x, z) that is no higher than y + STEP
export function groundAt(L, x, z, y = 1e9, r = 0.25) {
  let h = L.terrain ? groundH(x, z) : -1e9, on = null;
  for (const b of boxesNear(L, x, z, r)) if (x > b.min[0] - r * 0.5 && x < b.max[0] + r * 0.5 && z > b.min[2] - r * 0.5 && z < b.max[2] + r * 0.5 && b.max[1] <= y + STEP && b.max[1] > h) { h = b.max[1]; on = b; }
  for (const c of cylsNear(L, x, z, Math.max(r, 1.5))) if (c.top && Math.hypot(x - c.x, z - c.z) < c.top && c.y1 <= y + STEP && c.y1 > h) { h = c.y1; on = c; }
  return { h, on };
}
// push a body of radius r out of walls; returns the wall it touched (normal, can it be climbed)
export function pushOut(L, p, r, height = 1.7) {
  let wall = null;
  for (const b of boxesNear(L, p.x, p.z, r)) {
    if (b.max[1] - p.y <= STEP || p.y + height <= b.min[1]) continue;      // low enough to step onto
    const cx = clamp(p.x, b.min[0], b.max[0]), cz = clamp(p.z, b.min[2], b.max[2]);
    let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-6) {           // inside: leave by the nearest side
      const pen = [[p.x - b.min[0], -1, 0], [b.max[0] - p.x, 1, 0], [p.z - b.min[2], 0, -1], [b.max[2] - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
      dx = pen[1]; dz = pen[2]; p.x += dx * (pen[0] + r); p.z += dz * (pen[0] + r);
    } else { dx /= d; dz /= d; p.x += dx * (r - d); p.z += dz * (r - d); }
    wall = { nx: dx, nz: dz, climb: b.climb !== false, box: b };
  }
  for (const c of cylsNear(L, p.x, p.z, r)) {
    if (p.y >= c.y1 - 0.05 || p.y + height <= c.y0) continue;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
    if (d >= m || d < 1e-6) continue;
    p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d);
    if (!wall) wall = { nx: dx / d, nz: dz / d, climb: !!c.top && c.y1 - p.y > 1.2, cyl: c };
  }
  return wall;
}
const slopeOf = (L, x, z) => (L.terrain ? Math.acos(clamp(normalAt(x, z)[1], -1, 1)) * 57.2958 : 0);

// ---------------------------------------------------------------- the player
export function newBody(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, mode: 'ground', stamina: 1, exhausted: false, fallTop: y, climb: null, swimDash: false, safe: [x, y, z],
    sprinting: false, moving: false, slipT: 0, hopT: 0, landed: 0, idleStam: 0 };
}
// inp: { mx, mz (wanted direction in the world, length 0..1), ix, iy (stick: right, up), sprint, jump (pressed), drop (pressed) }
// opt: { glider, climbMul, stamMax, updraft(x,z,y) }; returns events: { fall: metres, drown: true, splash: true }
export function stepBody(B, dt, inp, L, opt) {
  const ev = {}, len = Math.hypot(inp.mx, inp.mz), smax = opt.stamMax;
  B.landed = Math.max(0, B.landed - dt); B.hopT = Math.max(0, B.hopT - dt);       // the landing crouch and the climbing hop wear off
  const useStam = (n) => { B.stamina = Math.max(0, B.stamina - n); B.idleStam = 0; if (B.stamina <= 0) B.exhausted = true; };
  B.sprinting = false; B.moving = len > 0.05;
  const water = L.water(B.x, B.z);
  if (B.mode === 'ground' || B.mode === 'air') {
    const onG = B.mode === 'ground';
    let sp = len > 0.05 ? (len < 0.55 ? 2.4 : 5.2) : 0;
    if (inp.sprint && len > 0.3 && !B.exhausted && onG) { sp = 8.2; B.sprinting = true; useStam(0.2 * dt); }
    if (B.exhausted) sp = Math.min(sp, 2.6);
    const tx = len > 0.05 ? (inp.mx / Math.max(1, len)) * sp : 0, tz = len > 0.05 ? (inp.mz / Math.max(1, len)) * sp : 0;
    const acc = onG ? 28 : 7;
    B.vx += clamp(tx - B.vx, -acc * dt, acc * dt); B.vz += clamp(tz - B.vz, -acc * dt, acc * dt);
    if (len > 0.05) B.yaw = Math.atan2(inp.mx, inp.mz);
    if (onG && inp.jump) { B.vy = JUMP; B.mode = 'air'; B.fallTop = B.y; }
    B.vy -= G * dt;
    const ox = B.x, oz = B.z, oldG = groundAt(L, ox, oz, B.y).h;
    B.x += B.vx * dt; B.z += B.vz * dt; B.y += B.vy * dt;
    const wall = pushOut(L, B, R_PLAYER);
    const pushing = (n) => len > 0.3 && (inp.mx * -n.nx + inp.mz * -n.nz) / len > 0.55;
    // a wall in front: keep pushing into it for a moment and you start to climb
    const intoWall = wall && wall.climb && pushing(wall) && !B.exhausted && B.stamina > 0.02 && (wall.box || wall.cyl);
    B.pushT = intoWall ? (B.pushT || 0) + dt : 0;
    if (intoWall && (B.pushT > 0.22 || B.mode === 'air')) { B.pushT = 0; startClimbBox(B, wall); return ev; }
    let g = groundAt(L, B.x, B.z, B.y);
    // steep terrain is a wall too: climb it if pushing into it, otherwise you can't walk up it
    if (L.terrain && slopeOf(L, B.x, B.z) > 50 && g.h > oldG + 0.02 && !g.on) {
      const n = normalAt(B.x, B.z), hl = Math.hypot(n[0], n[2]) || 1, nn = { nx: n[0] / hl, nz: n[2] / hl };
      B.pushT = pushing(nn) ? (B.pushT || 0) + dt : 0;
      if (pushing(nn) && (B.pushT > 0.22 || B.mode === 'air') && !B.exhausted && B.stamina > 0.02 && B.y + 1.2 > g.h) { B.pushT = 0; B.mode = 'climb'; B.climb = { kind: 'terrain' }; B.vx = B.vz = B.vy = 0; B.y = g.h; return ev; }
      if (B.y < g.h - 0.05 || onG) { B.x = ox; B.z = oz; B.vx *= 0.2; B.vz *= 0.2; g = groundAt(L, B.x, B.z, B.y); }
    }
    if (B.mode === 'air') {
      B.fallTop = Math.max(B.fallTop, B.y);
      if (inp.jump && opt.glider && !B.exhausted && B.stamina > 0.02 && B.y - g.h > 2.2) { B.mode = 'glide'; B.vy = Math.max(B.vy, -3); return ev; }
    }
    if (B.y <= g.h + 0.001 && B.vy <= 0.01) {
      if (B.mode === 'air') { const fall = B.fallTop - g.h; if (fall > 1) ev.fall = fall; B.landed = 0.25; }
      B.y = g.h; B.vy = 0; B.mode = 'ground';
      // standing on a steep slope: slide down it
      if (L.terrain && !g.on && slopeOf(L, B.x, B.z) > 46) { const n = normalAt(B.x, B.z); B.vx += n[0] * 30 * dt; B.vz += n[2] * 30 * dt; }
      else if (Math.hypot(B.vx, B.vz) < 6 && (!L.terrain || slopeOf(L, B.x, B.z) < 30) && !g.on?.temp) { B.safeT = (B.safeT || 0) + dt; if (B.safeT > 0.8) { B.safe = [B.x, B.y, B.z]; B.safeT = 0; } }
    } else if (B.mode === 'ground') {
      if (B.y - g.h < STEP && B.vy <= 0) { B.y = g.h; B.vy = 0; } else { B.mode = 'air'; B.fallTop = B.y; }
    }
    if (water - B.y > 1.15) { B.mode = 'swim'; B.vy = 0; ev.splash = true; }
  } else if (B.mode === 'glide') {
    const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw);
    if (len > 0.05) { const want = Math.atan2(inp.mx, inp.mz); let d = want - B.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); B.yaw += clamp(d, -2.4 * dt, 2.4 * dt); }
    const sp = 7.6;
    B.vx += (fx * sp - B.vx) * Math.min(1, dt * 2); B.vz += (fz * sp - B.vz) * Math.min(1, dt * 2);
    const up = opt.updraft ? opt.updraft(B.x, B.z, B.y) : 0;
    B.vy += ((up > 0 ? up : -2.1) - B.vy) * Math.min(1, dt * (up > 0 ? 1.6 : 3));
    useStam(0.02 * dt);                            // a full wheel keeps you aloft for about 50 seconds
    B.x += B.vx * dt; B.z += B.vz * dt; B.y += B.vy * dt; B.fallTop = B.y;
    const wall = pushOut(L, B, R_PLAYER);
    if (wall && wall.climb && (wall.box || wall.cyl) && B.stamina > 0.02) { startClimbBox(B, wall); return ev; }
    const g = groundAt(L, B.x, B.z, B.y);
    if (B.y <= g.h) { B.y = g.h; B.vy = 0; B.mode = 'ground'; B.landed = 0.2; }
    else if (inp.jump || B.exhausted) { B.mode = 'air'; B.fallTop = B.y; }
    if (water - B.y > 1.15) { B.mode = 'swim'; B.vy = 0; ev.splash = true; }
  } else if (B.mode === 'climb') {
    climbStep(B, dt, inp, L, opt, useStam, ev);
  } else if (B.mode === 'swim') {
    let sp = len > 0.05 ? 2.7 : 0;
    if (inp.sprint && len > 0.2 && !B.exhausted) { sp = 4.8; useStam(0.28 * dt); }
    if (inp.jump && !B.exhausted) { useStam(0.12); B.vx += Math.sin(B.yaw) * 4; B.vz += Math.cos(B.yaw) * 4; }
    const tx = len > 0.05 ? (inp.mx / Math.max(1, len)) * sp : 0, tz = len > 0.05 ? (inp.mz / Math.max(1, len)) * sp : 0;
    B.vx += (tx - B.vx) * Math.min(1, dt * 3); B.vz += (tz - B.vz) * Math.min(1, dt * 3);
    if (len > 0.05) B.yaw = Math.atan2(inp.mx, inp.mz);
    B.x += B.vx * dt; B.z += B.vz * dt; B.y = water - 1.2; B.fallTop = B.y;
    const wall = pushOut(L, B, R_PLAYER);
    if (wall && wall.climb && len > 0.3 && !B.exhausted) { startClimbBox(B, wall); return ev; }
    const g = groundAt(L, B.x, B.z, B.y + 1.1);
    if (g.h > water - 1.15) { B.y = g.h; B.mode = 'ground'; }
    if (B.exhausted && B.stamina <= 0) ev.drown = true;
  }
  // stamina comes back on solid ground (and while floating still)
  const resting = (B.mode === 'ground' && !B.sprinting) || (B.mode === 'swim' && !inp.sprint);
  if (resting) { B.idleStam += dt; if (B.idleStam > 0.5) B.stamina = Math.min(smax, B.stamina + (B.exhausted ? 0.28 : 0.42) * dt); }
  if (B.exhausted && B.stamina >= smax - 0.001) B.exhausted = false;
  if (B.y < L.killY) ev.void = true;
  return ev;
}
function startClimbBox(B, wall) {
  B.mode = 'climb'; B.vx = B.vz = B.vy = 0; B.fallTop = B.y;
  if (wall.box) {
    const b = wall.box, ax = Math.abs(wall.nx) > Math.abs(wall.nz) ? 'x' : 'z';
    B.climb = { kind: 'box', box: b, ax, s: ax === 'x' ? Math.sign(wall.nx) || 1 : Math.sign(wall.nz) || 1 };
  } else B.climb = { kind: 'cyl', cyl: wall.cyl };
  B.yaw = Math.atan2(-wall.nx, -wall.nz);
}
function climbStep(B, dt, inp, L, opt, useStam, ev) {
  const c = B.climb, mul = opt.climbMul || 1, v = (B.exhausted ? 0 : 1.55) * mul;
  const moving = Math.hypot(inp.ix, inp.iy) > 0.1;
  if (moving && v > 0) useStam((0.1 / Math.sqrt(mul)) * dt); else useStam(0.012 * dt);
  // rain makes the rock slippery
  if (L.rain && moving && inp.iy > 0) { B.slipT += dt; if (B.slipT > 2.4) { B.slipT = 0; ev.slip = true; climbMove(B, L, 0, -1.4); } }
  if (inp.jump && B.stamina > 0.05 && !B.exhausted) { useStam(0.22); B.hopT = 0.3; climbMove(B, L, inp.ix * 1.2, inp.ix ? 1.0 : 2.0); }
  if (inp.drop || B.exhausted && B.stamina <= 0) { letGo(B); return; }
  if (moving) climbMove(B, L, inp.ix * v * dt, inp.iy * v * dt);
  if (B.mode !== 'climb') return;
  const water = L.water(B.x, B.z);
  if (water - B.y > 1.15) { B.mode = 'swim'; B.climb = null; }
}
// move along the surface: up (dy) and to the right (dx)
function climbMove(B, L, dx, dy) {
  const c = B.climb;
  if (c.kind === 'terrain') {
    const n = normalAt(B.x, B.z), hl = Math.hypot(n[0], n[2]) || 1, gx = -n[0] / hl, gz = -n[2] / hl, s = Math.tan(Math.acos(clamp(n[1], -1, 1)));
    const rx = -gz, rz = gx;                       // to the right while facing the slope
    const h = dy / Math.sqrt(1 + s * s);
    B.x += gx * h + rx * dx; B.z += gz * h + rz * dx;
    pushOut(L, B, R_PLAYER);
    B.y = groundH(B.x, B.z); B.yaw = Math.atan2(gx, gz);
    const sl = Math.acos(clamp(normalAt(B.x, B.z)[1], -1, 1)) * 57.2958;
    if (sl < 42) { B.mode = 'ground'; B.climb = null; B.landed = 0.15; }
    return;
  }
  if (c.kind === 'cyl') {
    const cy = c.cyl, a = Math.atan2(B.x - cy.x, B.z - cy.z) + dx / (cy.r + R_PLAYER);
    B.y += dy; B.x = cy.x + Math.sin(a) * (cy.r + R_PLAYER); B.z = cy.z + Math.cos(a) * (cy.r + R_PLAYER); B.yaw = a + Math.PI;
    if (B.y >= cy.y1 - 0.5) { B.y = cy.y1; B.x = cy.x; B.z = cy.z; B.mode = 'ground'; B.climb = null; }
    else if (B.y <= groundAt(L, B.x, B.z, B.y).h && dy < 0) { B.mode = 'ground'; B.climb = null; }
    return;
  }
  const b = c.box, e = 0.02;
  B.y += dy;
  // sideways along the face (stop at its edges)
  if (c.ax === 'x') { B.z = clamp(B.z - dx * c.s, b.min[2] + 0.2, b.max[2] - 0.2); B.x = c.s > 0 ? b.max[0] + R_PLAYER + e : b.min[0] - R_PLAYER - e; B.yaw = c.s > 0 ? -Math.PI / 2 : Math.PI / 2; }
  else { B.x = clamp(B.x + dx * c.s, b.min[0] + 0.2, b.max[0] - 0.2); B.z = c.s > 0 ? b.max[2] + R_PLAYER + e : b.min[2] - R_PLAYER - e; B.yaw = c.s > 0 ? Math.PI : 0; }
  if (B.y >= b.max[1] - 0.6) {       // over the top
    B.y = b.max[1];
    if (c.ax === 'x') B.x += c.s > 0 ? -(R_PLAYER + 0.6) : R_PLAYER + 0.6; else B.z += c.s > 0 ? -(R_PLAYER + 0.6) : R_PLAYER + 0.6;
    B.mode = 'ground'; B.climb = null; B.landed = 0.15; return;
  }
  const g = groundAt(L, B.x, B.z, B.y).h;
  if (B.y <= g + 0.02 && dy <= 0) { B.y = g; B.mode = 'ground'; B.climb = null; }
}
function letGo(B) {
  const c = B.climb; let nx = 0, nz = 0;
  if (c && c.kind === 'box') { if (c.ax === 'x') nx = c.s; else nz = c.s; } else { nx = -Math.sin(B.yaw); nz = -Math.cos(B.yaw); }
  B.mode = 'air'; B.climb = null; B.vx = nx * 2; B.vz = nz * 2; B.vy = 0; B.fallTop = B.y; B.x += nx * 0.3; B.z += nz * 0.3;
}
