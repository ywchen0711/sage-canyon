// The land of Sage Canyon Quest. The school campus sits on a mesa in the middle, laid out after an aerial view of
// Sage Canyon School (approximately, at about twice life size, with no room labels): the big field in the north,
// the blacktop and play structure in the west, the lunch shelter, the main building and its classroom wings around a
// garden courtyard, the portables, the parking lots. Around it, a made-up adventure land: the canyon and its creek
// wind along the west and south, the neighborhood lies east, Carmel Mountain Road runs along the north, and beyond it
// the hills climb to Black Mountain. The west ends at the sea.
// Everything here is plain math so the physics and the node tests can use it; js/gfx.js turns it into meshes.
import { simplex, rng, hash2, smooth, lerp, clamp } from './noise.js';

export const W = { size: 1600, half: 800, n: 256, sea: 0 };
W.cell = W.size / W.n;
const nA = simplex(11), nB = simplex(23), nC = simplex(37), nD = simplex(51), nE = simplex(77);
const fbm = (f, x, y, o) => { let s = 0, a = 1, fr = 1, t = 0; for (let i = 0; i < o; i++) { s += a * f(x * fr, y * fr); t += a; a *= 0.5; fr *= 2.03; } return s / t; };
const ridged = (f, x, y, o) => { let s = 0, a = 1, fr = 1, t = 0; for (let i = 0; i < o; i++) { const v = 1 - Math.abs(f(x * fr, y * fr)); s += a * v * v; t += a; a *= 0.5; fr *= 2.1; } return s / t; };
const dist = (x, z, a, b) => Math.hypot(x - a, z - b);
const segDist = (x, z, pts) => {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
};

// ---------------------------------------------------------------- the campus, traced from the aerial picture
// map pixels (the picture is about 800 x 830) to the world: 0.8 m a pixel, the campus centred at (0, -230)
export const MESA = 60;
export const px = (x, y) => [(x - 400) * 0.8, (y - 430) * 0.8 - 230];
const R4 = (x0, y0, x1, y1) => { const [a, b] = px(x0, y0), [c, d] = px(x1, y1); return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]; };
export const CAMPUS = R4(0, 100, 753, 772);
const HOUSES_SE = R4(712, 316, 800, 830);                  // the houses that reach into the picture's east edge
// ground zones painted on the campus (later zones win)
export const ZONES = [
  ['lawn', R4(0, 380, 43, 645)],                           // the grassy slope west of the blacktop
  ['field', R4(30, 107, 556, 272)],
  ['blacktop', R4(43, 283, 321, 591)],
  ['asphalt', R4(304, 345, 336, 506)],                     // the service lane beside the west wing
  ['blacktop', R4(556, 129, 753, 316)],                    // the east blacktop
  ['asphalt', R4(556, 316, 627, 600)],                     // the drive along the portables
  ['garden', R4(393, 339, 493, 476)],                      // the courtyard
  ['lawn', R4(588, 530, 632, 578)],
  ['asphalt', R4(43, 598, 226, 662)],                      // the drop-off loop in front of the hall
  ['lawn', R4(69, 626, 195, 654)],                         // ... and its planted median
  ['asphalt', R4(300, 588, 567, 760), 75],                 // the front parking loop, its corners rounded
];
// buildings: [name, rect, height, roof]
export const BUILDINGS = [
  ['north', R4(317, 261, 565, 339), 14, 'flat'],           // the two-story building facing the field
  ['westwing', R4(337, 345, 393, 502), 8, 'flat'],
  ['eastwing', R4(493, 348, 552, 500), 8, 'flat'],
  ['front', R4(395, 489, 493, 532), 8, 'flat'],
  ['southblock', R4(335, 535, 410, 575), 7, 'flat'],
  ['portable', R4(627, 316, 692, 420), 6, 'flat'],
  ['southeast', R4(549, 578, 608, 639), 6, 'flat'],
];
// the angled buildings in the southwest: [name, centre x, centre y, length, width (pixels), angle (degrees), height, roof]
export const ANGLED = [
  ['hall', 242, 573, 88, 73, 36, 8, 'flat'],               // the multipurpose hall and its rooms
  ['hallroof', 256, 585, 56, 46, 36, 12, 'tile'],          // ... its tall brown roof
  ['diagonal', 352, 531, 129, 32, -34, 8, 'flat'],         // the long wing that runs up to the front building
];
export const SHELTER = R4(221, 376, 306, 504);            // the lunch shelter: two roofs on posts
export const CANOPIES = [[...R4(398, 474, 491, 489), 5], [...R4(279, 523, 313, 557), 6, 'pyramid']];   // the covered walk across the courtyard, the pyramid canopy over the lunch tables
export const PLAY = [px(145, 322), px(556, 232), px(632, 486)].map(([x, z], i) => ({ x, z, big: i === 0 }));
export const COURTS = { hoops: [363, 448, 537].map((y) => px(72, y)), line: [px(150, 359), px(150, 440)], octagon: px(139, 474), four: [px(187, 467), px(187, 487), px(210, 487)] };
export const GOALS = [px(58, 188), px(528, 188)];
export const AMPHI = px(369, 582);
export const ISLANDS = [px(445, 621), px(510, 656), px(497, 704), px(365, 647)];
export const COURT_PATHS = [[px(393, 339), px(493, 476)], [px(493, 339), px(393, 476)], [px(443, 339), px(443, 476)]];
const inRect = (x, z, r, m = 0) => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m;
const inRRect = (x, z, r, rad) => { if (!inRect(x, z, r)) return false; const cx = Math.max(r[0] + rad, Math.min(x, r[2] - rad)), cz = Math.max(r[1] + rad, Math.min(z, r[3] - rad)); return Math.hypot(x - cx, z - cz) < rad; };
const ROT = ANGLED.map(([nm, cx, cy, L, Wd, ang, h, roof]) => { const [x, z] = px(cx, cy), a = (ang * Math.PI) / 180; return { nm, x, z, hl: L * 0.4, hw: Wd * 0.4, c: Math.cos(a), s: Math.sin(a), ang: a, h, roof }; });
export const ANGLED_W = ROT;
const inRot = (x, z, r, m = 0) => { const dx = x - r.x, dz = z - r.z, u = dx * r.c + dz * r.s, v = -dx * r.s + dz * r.c; return Math.abs(u) < r.hl + m && Math.abs(v) < r.hw + m; };
export const inCampus = (x, z) => inRect(x, z, CAMPUS) && !inRect(x, z, HOUSES_SE);
export const zoneAt = (x, z) => {
  if (!inCampus(x, z)) return null;
  let k = 'campus'; for (const [t, r, rad] of ZONES) if (rad ? inRRect(x, z, r, rad) : inRect(x, z, r)) k = t;
  for (const b of BUILDINGS) if (inRect(x, z, b[1])) k = 'roof';
  for (const r of ROT) if (inRot(x, z, r)) k = 'roof';
  return k;
};
export const inBuilding = (x, z, m = 0) => BUILDINGS.some((b) => inRect(x, z, b[1], m)) || ROT.some((r) => inRot(x, z, r, m)) || inRect(x, z, SHELTER, m);

// ---------------------------------------------------------------- landmarks
export const SPOT = {
  plateau: { x: -20, z: -230, r: 300, h: MESA },
  start: (() => { const [x, z] = px(300, 190); return { x, z }; })(),
  hermit: (() => { const [x, z] = px(468, 452); return { x, z }; })(),
  castle: { x: 380, z: -690 }, village: { x: 470, z: -110 }, grove: { x: -380, z: 200 }, volcano: null,
};
const CANYON = [[-820, -400], [-640, -360], [-520, -300], [-440, -190], [-405, -40], [-370, 110], [-260, 240], [-90, 300], [120, 345], [330, 420], [560, 460], [820, 470]];
const PEAK = { x: 380, z: -690 };
export const canyonDist = (x, z) => segDist(x, z, CANYON) + nD(x / 90, z / 90) * 12;
export const REGIONS = [
  { id: 'plateau', name: ['鼠尾草峽谷小學', 'Sage Canyon School'], x: -20, z: -230 },
  { id: 'canyon', name: ['鼠尾草峽谷', 'Sage Canyon'], x: -440, z: -120 },
  { id: 'creek', name: ['峽谷小溪', 'Canyon Creek'], x: 120, z: 400 },
  { id: 'beach', name: ['西海岸', 'West Shore'], x: -690, z: 120 },
  { id: 'hills', name: ['卡梅爾丘陵', 'Carmel Hills'], x: -220, z: -660 },
  { id: 'mountain', name: ['黑山', 'Black Mountain'], x: 380, z: -660 },
  { id: 'neighborhood', name: ['峽谷社區', 'Canyon Neighborhood'], x: 480, z: -80 },
];
export function regionAt(x, z) {
  if (inCampus(x, z)) return 'plateau';
  if (dist(x, z, PEAK.x, PEAK.z) < 280) return 'mountain';
  if (x < -560 && canyonDist(x, z) > 90) return 'beach';
  if (canyonDist(x, z) < 110) return x < -150 ? 'canyon' : 'creek';
  if (z < -548) return 'hills';
  if (x < -560) return 'beach';
  return 'neighborhood';
}
// streets: Carmel Mountain Road in the north, the road past the front of the school, and the neighborhood's streets
export const ROADS = [
  [[-640, -518], [800, -518]],
  [px(0, 655), px(150, 668), px(260, 700), px(330, 730), px(420, 770), px(520, 820), [180, 120], [330, 140], [560, 150], [740, 140]],
  [[480, -512], [480, 360]], [[330, -512], [330, 140]], [[660, -512], [660, 380]],
  ...[-400, -300, -200, -100, 0].map((z) => [[262, z], [740, z]]),
  [[-300, 150], [250, 150]],
];
const roadW = (i) => (i === 0 ? 14 : 6);
function roadDist(x, z) { let b = 1e9; ROADS.forEach((r, i) => { b = Math.min(b, segDist(x, z, r) - (roadW(i) - 6)); }); return b; }
export const paved = (x, z) => { const k = zoneAt(x, z); return (k && k !== 'field' && k !== 'garden') || roadDist(x, z) < 6; };

// ---------------------------------------------------------------- the shape of the land
export function rawH(x, z) {
  let h = MESA + fbm(nA, x / 260, z / 260, 4) * 6 + fbm(nB, x / 70, z / 70, 2) * 1.2;
  const hills = smooth(-545, -640, z);                                                             // the hills beyond the road
  if (hills > 0) h += hills * (25 + ridged(nC, x / 200, z / 200, 4) * 70);
  const dp = dist(x, z, PEAK.x, PEAK.z);                                                           // Black Mountain
  h += 175 * Math.pow(Math.max(0, 1 - dp / 300), 1.5);
  const cb = Math.max(Math.abs(x - PEAK.x), Math.abs(z - PEAK.z));                                 // its summit levelled for the old station
  h = lerp(h, 250, smooth(92, 72, cb));
  const cd = canyonDist(x, z);                                                                     // the canyon, with a creek along its floor
  h = lerp(h, -1.8 + fbm(nB, x / 40, z / 40, 2) * 1.2, smooth(78, 20, cd));
  h = lerp(h, -14, smooth(-600, -700, x + nD(z / 120, x / 120) * 25));                           // the sea in the west
  const e = Math.max(x, z, -z - 60);                                                               // ridges closing the north, east and south
  h += smooth(690, 790, e) * 160;
  // the campus and the streets are level
  if (inRect(x, z, CAMPUS, 12)) h = lerp(h, MESA, inRect(x, z, CAMPUS) ? 1 : 0.6);
  if (roadDist(x, z) < 10 && h > 20 && h < 120) h = lerp(h, MESA + fbm(nA, x / 260, z / 260, 4) * 6, smooth(10, 5, roadDist(x, z)));
  return h;
}

// ---------------------------------------------------------------- the height grid (physics uses the same triangles as the mesh)
const N1 = W.n + 1;
export const HGRID = new Float32Array(N1 * N1);
for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) HGRID[j * N1 + i] = rawH(-W.half + i * W.cell, -W.half + j * W.cell);
export function groundH(x, z) {
  const fx = clamp((x + W.half) / W.cell, 0, W.n - 1e-6), fz = clamp((z + W.half) / W.cell, 0, W.n - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h00 = HGRID[j * N1 + i], h10 = HGRID[j * N1 + i + 1], h01 = HGRID[(j + 1) * N1 + i], h11 = HGRID[(j + 1) * N1 + i + 1];
  return v > u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
}
export function normalAt(x, z) {
  const d = 1.2, gx = (groundH(x + d, z) - groundH(x - d, z)) / (2 * d), gz = (groundH(x, z + d) - groundH(x, z - d)) / (2 * d), l = Math.hypot(gx, 1, gz);
  return [-gx / l, 1 / l, -gz / l];
}
export const slopeDeg = (x, z) => Math.acos(clamp(normalAt(x, z)[1], -1, 1)) * 180 / Math.PI;
export const snowLine = () => 9999;                 // no snow in San Diego
export const isCold = () => false;

// ---------------------------------------------------------------- colours (vertex colours and the map)
const C = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const COL = { lawn: C('#7c8c44'), lawn2: C('#6a7a38'), field: C('#86963e'), field2: C('#748434'), blacktop: C('#5a5450'), asphalt: C('#6a6460'), concrete: C('#c4b494'), roof: C('#a89a80'),
  garden: C('#647a38'), sage: C('#8e9450'), sage2: C('#a8a068'), sand: C('#d8bf84'), wet: C('#7a6e50'), rock: C('#b4946a'), rock2: C('#8e8270'), chap: C('#6e7a3e'), dry: C('#c4ac6c'), road: C('#9a7a52') };
export function colorAt(x, z, h, slope) {
  if (h < -0.6) return mixc(COL.wet, [0.25, 0.32, 0.36], clamp(-h / 20, 0, 0.7));
  const reg = regionAt(x, z), n = nE(x / 40, z / 40) * 0.5 + 0.5, zone = zoneAt(x, z);
  if (zone) {
    if (zone === 'field') return mixc(COL.field, COL.field2, (Math.floor((x + 400) / 12) % 2) * 0.6 + n * 0.2);       // mowing stripes
    if (zone === 'blacktop') return mixc(COL.blacktop, COL.asphalt, n * 0.3);
    if (zone === 'asphalt') return mixc(COL.asphalt, COL.blacktop, n * 0.3);
    if (zone === 'garden') return mixc(COL.garden, COL.lawn, n);
    if (zone === 'roof') return COL.concrete;
    return mixc(COL.concrete, COL.lawn, n > 0.8 ? 0.6 : 0.03);                                                      // walkways, a planter here and there
  }
  let c;
  if (reg === 'neighborhood') c = mixc(COL.lawn, COL.lawn2, n);
  else if (reg === 'beach') c = mixc(COL.sand, COL.sage2, smooth(4, 14, h) * 0.6);
  else if (reg === 'hills' || reg === 'mountain') c = mixc(COL.chap, COL.dry, smooth(0.35, 0.75, fbm(nC, x / 90, z / 90, 3) * 0.5 + 0.5));
  else c = mixc(COL.sage, COL.sage2, n);                                                                             // the canyon's sage scrub
  if (reg === 'creek' || reg === 'canyon') { if (h < 4) c = mixc(c, mixc(COL.lawn2, COL.wet, 0.3), smooth(4, 0.5, h)); }
  if (roadDist(x, z) < 6 && h > 20) c = COL.road;
  if (slope > 34) c = mixc(c, mixc(COL.rock, COL.rock2, n), smooth(34, 48, slope));                                // sandstone canyon walls
  return c;
}
export const forestNoise = (x, z) => fbm(nC, x / 160 + 9, z / 160 - 4, 3) * 0.5 + 0.5;

// ---------------------------------------------------------------- finding good spots
const R = rng(92130);
export function landNear(x, z, maxSlope = 22, minH = 3) {
  for (let r = 0; r < 140; r += 3) for (let k = 0; k < Math.max(1, r); k++) {
    const a = (k / Math.max(1, r)) * Math.PI * 2 + r, qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r;
    const h = groundH(qx, qz); if (h > minH && slopeDeg(qx, qz) < maxSlope && !hitsBuilding(qx, qz, 6)) return [qx, qz];
  }
  return [x, z];
}
const hitsBuilding = (x, z, m) => inBuilding(x, z, m);
const okLand = (x, z, maxSlope = 24) => { const h = groundH(x, z); return h > 1.5 && slopeDeg(x, z) < maxSlope && Math.abs(x) < 700 && Math.abs(z) < 700 && !paved(x, z) && !hitsBuilding(x, z, 8); };
const pt = (o, x, z) => ({ ...o, x, z, y: groundH(x, z) });

// ---------------------------------------------------------------- places
export const POI = { towers: [], shrines: [], greats: [], camps: [], ogres: [], sentinels: [], seeds: [], pots: [], ores: [], plants: [], boars: [], chests: [], houses: [], npcs: [] };
const keepOut = [];        // [x, z, r] areas where nothing random is placed
const far = (x, z, list, d) => list.every((p) => dist(x, z, p.x, p.z) > d);
const clear = (x, z) => keepOut.every(([a, b, r]) => dist(x, z, a, b) > r);
keepOut.push([SPOT.start.x, SPOT.start.z, 16], [SPOT.hermit.x, SPOT.hermit.z, 14], [SPOT.village.x, SPOT.village.z, 70], [SPOT.castle.x, SPOT.castle.z, 110], [SPOT.grove.x, SPOT.grove.z, 22]);
for (const p of PLAY) keepOut.push([p.x, p.z, 14]);
// the neighborhood: rows of houses along the streets (Josh's street is the village, built below)
export const VILLAGE = { x: SPOT.village.x, z: SPOT.village.z, y: groundH(SPOT.village.x, SPOT.village.z) };
const HOUSE_COLS = ['#f0e4cc', '#e8d8b8', '#f4ece0', '#e0d0b4', '#ece0c8', '#f2e2d0'];
{
  const spots = [];
  for (let z = -440; z < 90; z += 26) spots.push([298, z]);
  for (const z0 of [-450, -350, -250, -150, -50, 50]) for (const side of [-1, 1]) for (let x = 360; x < 720; x += 30) spots.push([x, z0 + side * 22 + 25]);
  for (const z of [40, 75, 120, 165, 205]) for (let x = -300; x < 280; x += 30) spots.push([x + (z % 2 ? 15 : 0), z]);
  for (const [x, z] of spots) {
    if (canyonDist(x, z) < 95 || roadDist(x, z) < 12 || (inCampus(x, z) || inCampus(x - 9, z) || inCampus(x, z - 8)) || dist(x, z, VILLAGE.x, VILLAGE.z) < 70 || Math.abs(x - 480) < 12 || Math.abs(x - 330) < 12 || Math.abs(x - 660) < 12) continue;
    const y = groundH(x, z); if (y < 40 || slopeDeg(x, z) > 10) continue;
    POI.houses.push({ x, z, y, w: 14 + hash2(x | 0, z | 0) * 4, d: 12, h: 6 + (hash2(z | 0, x | 0) < 0.3 ? 4 : 0), role: 'house', col: HOUSE_COLS[Math.floor(hash2(x | 0, z | 0, 3) * HOUSE_COLS.length)] });
    keepOut.push([x, z, 13]);
  }
}
for (const [dx, dz, w, d, role] of [[-26, -22, 14, 12, 'elder'], [8, -30, 12, 10, 'shop'], [-26, 24, 14, 12, 'inn'], [30, 14, 12, 10, 'house'], [-2, 36, 12, 10, 'leaf'], [34, -22, 12, 10, 'house']]) {
  const x = VILLAGE.x + dx, z = VILLAGE.z + dz; POI.houses.push({ x, z, y: groundH(x, z), w, d, h: 6, role, col: HOUSE_COLS[(dx + dz + 200) % HOUSE_COLS.length] });
}
// towers: one per region; activating one reveals that region on the map
const TOWER_AT = { plateau: px(660, 190), canyon: [-440, -110], creek: [120, 380], beach: [-650, 140], hills: [-160, -650], mountain: [270, -600], neighborhood: [570, -270] };
for (const [reg, [x0, z0]] of Object.entries(TOWER_AT)) { const [x, z] = landNear(x0, z0, 18, 2); POI.towers.push(pt({ id: 't_' + reg, region: reg }, x, z)); keepOut.push([x, z, 14]); }
// shrines: four on the campus teach the runes; two in each other region; four great shrines hold the guardians' gifts
const CAMPUS_SHRINES = [['magnet', ...px(120, 190)], ['bomb', ...px(90, 548)], ['ice', ...px(600, 300)], ['stasis', ...px(400, 690)]];
CAMPUS_SHRINES.forEach(([kind, x0, z0], i) => { const [x, z] = [x0, z0]; POI.shrines.push(pt({ id: 's_p' + i, kind, teach: kind, region: 'plateau', name: shrineName(i) }, x, z)); keepOut.push([x, z, 12]); });
const KINDS = ['magnet', 'bomb', 'ice', 'stasis', 'combat', 'combo'];
let sn = 4;
for (const reg of ['canyon', 'creek', 'beach', 'hills', 'mountain', 'neighborhood']) {
  const c = REGIONS.find((r) => r.id === reg); let got = 0;
  for (let t = 0; t < 6000 && got < 2; t++) {
    const x = c.x + (R() - 0.5) * 460, z = c.z + (R() - 0.5) * 460;
    if (regionAt(x, z) !== reg || !okLand(x, z, 18) || !clear(x, z) || !far(x, z, POI.shrines, 140)) continue;
    POI.shrines.push(pt({ id: 's_' + sn, kind: KINDS[sn % KINDS.length], region: reg, name: shrineName(sn) }, x, z)); keepOut.push([x, z, 12]); sn++; got++;
  }
}
const GREAT = [['canyon', 'gale', -470, 40], ['hills', 'protect', -20, -700], ['creek', 'grace', 330, 430], ['beach', 'fury', -690, -60]];
for (const [reg, gift, x0, z0] of GREAT) { const [x, z] = landNear(x0, z0, 20, 1.5); POI.greats.push(pt({ id: 'g_' + reg, region: reg, gift }, x, z)); keepOut.push([x, z, 18]); }
function shrineName(i) {
  const zh = ['鼠尾草之祠', '仙人掌之祠', '山艾之祠', '郊狼之祠', '鷹之祠', '橡樹之祠', '小溪之祠', '海浪之祠', '松果之祠', '野花之祠', '岩石之祠', '月光之祠', '夕陽之祠', '晨露之祠', '清風之祠', '星光之祠'];
  const en = ['Sage Shrine', 'Cactus Shrine', 'Brush Shrine', 'Coyote Shrine', 'Hawk Shrine', 'Oak Shrine', 'Brook Shrine', 'Wave Shrine', 'Pinecone Shrine', 'Wildflower Shrine', 'Boulder Shrine', 'Moonlight Shrine', 'Sunset Shrine', 'Dewdrop Shrine', 'Breeze Shrine', 'Starlight Shrine'];
  return [zh[i % zh.length], en[i % en.length]];
}
// gremlin camps: two small ones on the campus, more across the land
for (const [x0, z0] of [px(90, 145), px(290, 330)]) POI.camps.push(pt({ id: 'c_p' + POI.camps.length, size: 2, region: 'plateau' }, x0, z0));
for (let t = 0; t < 8000 && POI.camps.length < 20; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (reg === 'plateau' || reg === 'neighborhood' || !okLand(x, z, 15) || !clear(x, z) || !far(x, z, POI.camps, 110)) continue;
  POI.camps.push(pt({ id: 'c_' + POI.camps.length, size: 2 + Math.floor(R() * 3), region: reg, archer: R() < 0.5 }, x, z)); keepOut.push([x, z, 14]);
}
// big brutes, and the rusty robots (thickest around Black Mountain)
for (let t = 0; t < 5000 && POI.ogres.length < 6; t++) {
  const x = (R() - 0.5) * 1200, z = (R() - 0.5) * 1100, reg = regionAt(x, z);
  if (reg === 'plateau' || reg === 'neighborhood' || !okLand(x, z, 18) || !clear(x, z) || !far(x, z, POI.ogres, 200)) continue;
  POI.ogres.push(pt({ id: 'o_' + POI.ogres.length }, x, z));
}
for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.3, r = 150 + (k % 3) * 30, [x, z] = landNear(SPOT.castle.x + Math.cos(a) * r, SPOT.castle.z + Math.sin(a) * r, 25, 3); POI.sentinels.push(pt({ id: 'g' + k, walk: k % 3 === 0 }, x, z)); }
for (let t = 0; t < 4000 && POI.sentinels.length < 14; t++) {
  const x = (R() - 0.5) * 1100, z = (R() - 0.5) * 1000, reg = regionAt(x, z);
  if (['plateau', 'neighborhood'].includes(reg) || !okLand(x, z, 20) || !clear(x, z) || !far(x, z, POI.sentinels, 150)) continue;
  POI.sentinels.push(pt({ id: 'g' + POI.sentinels.length, dormant: true }, x, z));
}
// leaf sprites: lift a strange rock, or reach a high, lonely peak
for (let t = 0; t < 10000 && POI.seeds.filter((s) => s.kind === 'rock').length < 30; t++) {
  const x = (R() - 0.5) * 1340, z = (R() - 0.5) * 1340;
  if (!okLand(x, z, 30) || !clear(x, z) || !far(x, z, POI.seeds, 60)) continue;
  POI.seeds.push(pt({ id: 'k' + POI.seeds.length, kind: 'rock' }, x, z));
}
{
  const peaks = [];
  for (let j = 6; j < W.n - 6; j += 2) for (let i = 6; i < W.n - 6; i += 2) {
    const h = HGRID[j * N1 + i]; if (h < 75) continue;
    let top = true; for (let b = -5; b <= 5 && top; b++) for (let a = -5; a <= 5; a++) if (HGRID[(j + b) * N1 + i + a] > h) { top = false; break; }
    if (top) peaks.push({ x: -W.half + i * W.cell, z: -W.half + j * W.cell, h });
  }
  peaks.sort((a, b) => b.h - a.h);
  for (const p of peaks) { if (POI.seeds.filter((s) => s.kind === 'peak').length >= 12) break; if (far(p.x, p.z, POI.seeds, 60) && clear(p.x, p.z) && Math.abs(p.x) < 700 && Math.abs(p.z) < 700) POI.seeds.push(pt({ id: 'k' + POI.seeds.length, kind: 'peak' }, p.x, p.z)); }
}
// cooking pots: at every tower foot, Josh's street, the gardener's shed and some camps
for (const t of POI.towers) POI.pots.push(pt({ id: 'pot_' + t.id }, t.x + 8, t.z + 3));
POI.pots.push(pt({ id: 'pot_village' }, VILLAGE.x + 8, VILLAGE.z + 4), pt({ id: 'pot_hermit' }, SPOT.hermit.x + 6, SPOT.hermit.z + 12));
POI.camps.forEach((c, i) => { if (i % 2 === 0) POI.pots.push(pt({ id: 'pot_' + c.id }, c.x + 3, c.z - 3)); });
// ore in the canyon walls and the hills, plants to pick, boars to hunt, chests (some in the school's lost and found)
for (let t = 0; t < 8000 && POI.ores.length < 50; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (!['canyon', 'creek', 'hills', 'mountain', 'beach'].includes(reg) || !okLand(x, z, 36) || !clear(x, z) || !far(x, z, POI.ores, 40)) continue;
  POI.ores.push(pt({ id: 'ore' + POI.ores.length, rich: R() < 0.25 }, x, z));
}
const PLANT_BY = { canyon: ['shroom', 'stamella', 'pepper', 'apple'], creek: ['apple', 'shroom', 'radish', 'stamella'], plateau: ['apple', 'radish'],
  hills: ['pepper', 'stamella', 'shroom'], mountain: ['pepper', 'stamella'], beach: ['radish', 'pepper'], neighborhood: ['apple', 'radish'] };
for (let t = 0; t < 12000 && POI.plants.length < 240; t++) {
  const x = (R() - 0.5) * 1360, z = (R() - 0.5) * 1360, reg = regionAt(x, z);
  if (!okLand(x, z, 30) || !clear(x, z) || (reg === 'neighborhood' && R() < 0.8)) continue;
  const list = PLANT_BY[reg]; POI.plants.push(pt({ id: 'pl' + POI.plants.length, item: list[Math.floor(R() * list.length)] }, x, z));
}
for (let t = 0; t < 5000 && POI.boars.length < 22; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300, reg = regionAt(x, z);
  if (!['canyon', 'creek', 'hills'].includes(reg) || !okLand(x, z, 22) || !clear(x, z) || !far(x, z, POI.boars, 60)) continue;
  POI.boars.push(pt({ id: 'b' + POI.boars.length }, x, z));
}
for (const [x0, z0, loot] of [[...px(470, 200), 's_wood'], [...px(120, 575), 'b_traveler'], [...px(700, 470), 'gold:50']]) POI.chests.push(pt({ id: 'ch' + POI.chests.length, loot }, x0, z0));
const CHEST_LOOT = ['w_soldier', 'b_soldier', 's_soldier', 'gold:100', 'w_claymore', 'w_spear', 'gold:300', 'mat:amber:3', 'w_knight', 'b_falcon', 's_knight', 'w_ancient'];
for (let t = 0; t < 6000 && POI.chests.length < 24; t++) {
  const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300;
  if (regionAt(x, z) === 'plateau' || !okLand(x, z, 26) || !clear(x, z) || !far(x, z, POI.chests, 90)) continue;
  POI.chests.push(pt({ id: 'ch' + POI.chests.length, loot: CHEST_LOOT[POI.chests.length % CHEST_LOOT.length] }, x, z));
}
POI.npcs.push(
  { id: 'elder', x: VILLAGE.x - 26, z: VILLAGE.z - 12, look: 'dad' }, { id: 'shop', x: VILLAGE.x + 8, z: VILLAGE.z - 21, look: 'merchant' },
  { id: 'inn', x: VILLAGE.x - 26, z: VILLAGE.z + 33, look: 'mom' }, { id: 'leafgramps', x: VILLAGE.x - 2, z: VILLAGE.z + 45, look: 'leaf' },
  { id: 'statue', x: VILLAGE.x + 4, z: VILLAGE.z + 6, look: 'statue' }, { id: 'kid', x: VILLAGE.x + 16, z: VILLAGE.z + 22, look: 'jasper' },
  { id: 'hermit', x: SPOT.hermit.x, z: SPOT.hermit.z + 9, look: 'hermit' },
);
for (const n of POI.npcs) n.y = groundH(n.x, n.z);

// ---------------------------------------------------------------- trees and rocks
export const TREES = [], ROCKS = [];
const tree = (x, z, type, s, apple = false) => TREES.push({ x, z, y: groundH(x, z), type, s: s * 1.8, rot: hash2(x | 0, z | 0, 6) * 6.28, apple, planter: true });
// the school's trees, from the picture: the rows along Carmel Mountain Road, the trees between the field and the blacktop,
// the slope west of the blacktop, the courtyard, the east edge, around the hall, the front lot's islands and the road
for (let x = 0; x <= 795; x += 20) { const [a, b] = px(x, 30); tree(a, b, 'pine', 1.5 + hash2(x, 1) * 0.5); const [c, d] = px(x + 10, 98); tree(c, d, 'oak', 1.2 + hash2(x, 2) * 0.4); }
for (let y = 280; y <= 640; y += 18) { const [a, b] = px(14 + (y % 3) * 8, y); tree(a, b, 'oak', 1.3 + hash2(y, 3) * 0.5); }
for (let y = 110; y <= 270; y += 26) { const [a, b] = px(14, y); tree(a, b, 'oak', 1.3 + hash2(y, 9) * 0.4); }
for (let y = 120; y <= 340; y += 16) { const [a, b] = px(770, y); tree(a, b, 'oak', 1.3 + hash2(y, 4) * 0.5); }
for (let y = 420; y <= 720; y += 16) { const [a, b] = px(645 + (y % 3) * 8, y); tree(a, b, y % 48 ? 'oak' : 'pine', 1.2 + hash2(y, 5) * 0.5); }
for (let x = 300; x <= 560; x += 14) { const [a, b] = px(x, 768 + (x - 300) * 0.12); tree(a, b, 'oak', 0.7 + hash2(x, 6) * 0.3); }
for (let x = 60; x <= 220; x += 30) { const [a, b] = px(x, 672); tree(a, b, 'pine', 1.0); }
for (const [x, y, sz] of [[115, 283, 0.75], [135, 283, 0.75], [156, 283, 0.75], [180, 283, 0.75], [482, 233, 1.2], [25, 210, 1.1], [38, 245, 1.0],
  [393, 358, 0.7], [491, 358, 0.7], [443, 363, 0.8], [426, 428, 0.6], [463, 424, 0.6], [430, 454, 0.55], [452, 454, 0.55],
  [169, 567, 1.3], [192, 596, 1.3], [322, 581, 1.2], [400, 578, 1.2], [445, 621, 1.1], [510, 656, 1.0], [497, 704, 1.1], [365, 647, 1.0], [600, 545, 1.3], [470, 240, 1.0], [300, 600, 1.2], [575, 640, 1.2], [560, 300, 1.1]]) { const [a, b] = px(x, y); tree(a, b, 'oak', sz, x === 443); }
{
  const cell = 8, nC2 = W.size / cell;
  for (let j = 0; j < nC2; j++) for (let i = 0; i < nC2; i++) {
    const r1 = hash2(i, j, 1), x = -W.half + (i + hash2(i, j, 2)) * cell, z = -W.half + (j + hash2(i, j, 3)) * cell;
    const h = groundH(x, z); if (h < 0.5 || Math.abs(x) > 740 || Math.abs(z) > 740) continue;
    const reg = regionAt(x, z), fn = forestNoise(x, z);
    if (reg === 'plateau') continue;
    let dens = { canyon: 0.3, creek: 0.34, beach: 0.05, hills: 0.22, mountain: 0.12, neighborhood: 0.035 }[reg];
    dens *= 0.4 + fn * 1.3;
    if ((reg === 'creek' || reg === 'canyon') && h < 6) dens = 0.5;                   // sycamores along the creek
    if (r1 > dens) continue;
    if (slopeDeg(x, z) > 36 || roadDist(x, z) < 8 || !clear(x, z) || paved(x, z)) continue;
    const small = (reg === 'canyon' || reg === 'creek' || reg === 'hills') && h > 6;      // sage and chaparral bushes on the slopes and the mesa
    const type = reg === 'beach' ? 'pine' : reg === 'mountain' && hash2(i, j, 4) < 0.4 ? 'dead' : hash2(i, j, 4) < 0.12 ? 'pine' : 'oak';
    TREES.push({ x, z, y: h, type, s: small ? 0.45 + hash2(i, j, 5) * 0.35 : 0.85 + hash2(i, j, 5) * 0.6, rot: hash2(i, j, 6) * 6.28, apple: type === 'oak' && !small && hash2(i, j, 7) < 0.12 });
  }
  for (let t = 0; t < 1100; t++) {
    const x = (R() - 0.5) * 1440, z = (R() - 0.5) * 1440, h = groundH(x, z), reg = regionAt(x, z);
    if (h < 0.5 || reg === 'plateau' || reg === 'neighborhood' || !clear(x, z) || roadDist(x, z) < 8) continue;
    ROCKS.push({ x, z, y: h, r: 0.5 + R() * R() * 2.6, rot: R() * 6.28 });
  }
}

// ---------------------------------------------------------------- solid things: boxes (buildings, towers, walls) and cylinders (trunks, rocks)
// box: { min: [x, y, z], max: [x, y, z], climb } ; cylinder: { x, z, y0, y1, r }
export const BOXES = [], CYLS = [];
const box = (x0, y0, z0, x1, y1, z1, o = {}) => { const b = { min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], climb: true, ...o }; BOXES.push(b); return b; };
for (const t of POI.towers) {
  const lo = Math.min(...[[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([a, b]) => groundH(t.x + a, t.z + b))) - 1;
  t.segs = [[4.6, lo, t.y + 10], [3.3, t.y + 10, t.y + 20], [2.0, t.y + 20, t.y + 30]]; t.top = t.y + 30;
  for (const [hw, y0, y1] of t.segs) box(t.x - hw, y0, t.z - hw, t.x + hw, y1, t.z + hw, { tower: t.id });
}
// the school buildings, the lunch shelter's roof and posts, the play structures (decks to climb, a slide)
for (const [nm, r, hgt] of BUILDINGS) box(r[0], MESA - 2, r[1], r[2], MESA + hgt, r[3], { building: nm });
for (const r of ROT) {                       // an angled block, filled with 1.6 m slices along z that follow its outline
  const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [r.x + a * r.hl * r.c - b * r.hw * r.s, r.z + a * r.hl * r.s + b * r.hw * r.c]);
  const z0 = Math.min(...cs.map((q) => q[1])), z1 = Math.max(...cs.map((q) => q[1]));
  for (let z = z0; z < z1; z += 1.6) {
    const zm = z + 0.8, xs = [];
    for (let k = 0; k < 4; k++) { const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4]; if ((az - zm) * (bz - zm) <= 0 && az !== bz) xs.push(ax + ((zm - az) / (bz - az)) * (bx - ax)); }
    if (xs.length >= 2) box(Math.min(...xs), MESA - 2, z, Math.max(...xs), MESA + r.h, z + 1.6, { building: r.nm });
  }
}
for (const [x0, z0, x1, z1, top, kind] of CANOPIES) {
  box(x0, MESA + top, z0, x1, MESA + top + 0.4, z1, { canopy: 1 });
  for (const [x, z] of kind ? [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]] : [[x0 + 2, (z0 + z1) / 2], [x1 - 2, (z0 + z1) / 2], [(x0 + x1) / 2, (z0 + z1) / 2]]) box(x - 0.25, MESA - 1, z - 0.25, x + 0.25, MESA + top, z + 0.25);
}
{
  const [x0, z0, x1, z1] = SHELTER, top = MESA + 6;
  box(x0, top, z0, x1, top + 0.5, z1, { shelter: 1 });
  for (let x = x0 + 1; x < x1; x += (x1 - x0 - 2) / 3) for (const z of [z0 + 1, z1 - 1, (z0 + z1) / 2]) box(x - 0.3, MESA - 1, z - 0.3, x + 0.3, top, z + 0.3);
}
for (const p of PLAY) {
  const k = p.big ? 1.3 : 1;
  p.decks = [[p.x - 4 * k, p.z - 3 * k, 3, 3 * k], [p.x + 2 * k, p.z - 2 * k, 4.5, 3 * k], [p.x - 1 * k, p.z + 3 * k, 2, 2.5 * k]];
  for (const [x, z, h, s] of p.decks) box(x - s, MESA + h - 0.3, z - s, x + s, MESA + h, z + s, { play: 1 });
  for (const [x, z, h, s] of p.decks) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a * s - 0.15, MESA - 1, z + b * s - 0.15, x + a * s + 0.15, MESA + h + 2.4, z + b * s + 0.15);
}
{ const x = SPOT.hermit.x, z = SPOT.hermit.z, y = groundH(x, z); box(x - 3.5, y - 2, z - 3, x + 3.5, y + 3.6, z + 3, { house: 'hermit' }); }
for (const c of POI.camps) if (c.archer) {
  const x = c.x - 6, z = c.z + 4, y = groundH(x, z); c.post = [x, y + 5.15, z];
  box(x - 1.3, y + 4.85, z - 1.3, x + 1.3, y + 5.15, z + 1.3, { climb: false });
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a - 0.15, y - 1, z + b - 0.15, x + a + 0.15, y + 4.85, z + b + 0.15);
}
for (const h of POI.houses) { const lo = h.y - 2; box(h.x - h.w / 2, lo, h.z - h.d / 2, h.x + h.w / 2, h.y + h.h, h.z + h.d / 2, { house: h.role }); }
// the old radio station on Black Mountain: walls with gates on four sides, a tall keep, a yard where the last battle is fought
export const CASTLE = { x: SPOT.castle.x, z: SPOT.castle.z, y: groundH(SPOT.castle.x, SPOT.castle.z), half: 62, wallH: 12 };
{
  const { x, z, half, wallH } = CASTLE, y0 = CASTLE.y - 12, y1 = CASTLE.y + wallH, th = 3, gate = 9;
  for (const s of [-1, 1]) {
    box(x - half, y0, z + s * half - th / 2, x - gate, y1, z + s * half + th / 2, { castle: 1 }); box(x + gate, y0, z + s * half - th / 2, x + half, y1, z + s * half + th / 2, { castle: 1 });
    box(x + s * half - th / 2, y0, z - half, x + s * half + th / 2, y1, z - gate, { castle: 1 }); box(x + s * half - th / 2, y0, z + gate, x + s * half + th / 2, y1, z + half, { castle: 1 });
  }
  CASTLE.keep = box(x - 14, y0, z - 56, x + 14, CASTLE.y + 40, z - 30, { castle: 1 });
  CASTLE.arena = { x, z: z + 8, y: CASTLE.y, r: 28 };
}
for (const t of TREES) CYLS.push({ x: t.x, z: t.z, y0: t.y - 1, y1: t.y + (t.type === 'cactus' ? 3 : 6) * t.s, r: (t.type === 'cactus' ? 0.45 : 0.55) * t.s, top: t.type === 'cactus' || t.s < 0.8 ? 0 : 1.3 * t.s, tree: t });
for (const r of ROCKS) CYLS.push({ x: r.x, z: r.z, y0: r.y - r.r, y1: r.y + r.r * 0.75, r: r.r * 0.9, rock: 1, top: r.r * 0.7 });
for (const s of POI.shrines.concat(POI.greats)) { const lo = s.y - 2; box(s.x - 3, lo, s.z - 3, s.x + 3, s.y + 0.35, s.z + 3, { climb: false, shrine: s.id }); }

// a grid of what is near, for collision
const HC = 16, hashCells = new Map();
const key = (i, j) => i * 4096 + j;
function addHash(o, x0, z0, x1, z1) { for (let j = Math.floor(z0 / HC); j <= Math.floor(z1 / HC); j++) for (let i = Math.floor(x0 / HC); i <= Math.floor(x1 / HC); i++) { const k = key(i, j); let a = hashCells.get(k); if (!a) hashCells.set(k, (a = [])); a.push(o); } }
for (const b of BOXES) addHash(b, b.min[0], b.min[2], b.max[0], b.max[2]);
for (const c of CYLS) addHash(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
export function solidsNear(x, z, r = 2) {
  const out = new Set();
  for (let j = Math.floor((z - r) / HC); j <= Math.floor((z + r) / HC); j++) for (let i = Math.floor((x - r) / HC); i <= Math.floor((x + r) / HC); i++) { const a = hashCells.get(key(i, j)); if (a) for (const o of a) out.add(o); }
  return out;
}
export { roadDist, dist };
