// Checks for Sage Canyon Quest: the campus and the land around it, the physics of getting around (walk, climb a tower,
// glide, swim), the items and cooking, and the shrines. Run: npm test
import { W, POI, SPOT, REGIONS, TREES, BOXES, CASTLE, VILLAGE, BUILDINGS, PLAY, MESA, groundH, slopeDeg, regionAt, zoneAt, paved, px } from '../js/world.js';
import { WEAPONS, BOWS, SHIELDS, OUTFITS, MATS, cook, effectOf } from '../js/items.js';
import { outdoor, newBody, stepBody, groundAt } from '../js/physics.js';
import { buildShrine, allShrines, shrineSegments } from '../js/shrine.js';

let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

// ---------------------------------------------------------------- the campus and the land
ok('the campus is level, on the mesa', [px(200, 190), px(150, 450), px(640, 300), px(420, 680)].every(([x, z]) => Math.abs(groundH(x, z) - MESA) < 0.01));
ok('the campus zones are where the picture has them', zoneAt(...px(300, 190)) === 'field' && zoneAt(...px(150, 450)) === 'blacktop' && zoneAt(...px(440, 300)) === 'roof' && zoneAt(...px(440, 420)) === 'garden' && zoneAt(...px(420, 680)) === 'asphalt');
ok('buildings do not overlap', BUILDINGS.every(([, a], i) => BUILDINGS.every(([, b], j) => i === j || a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1])));
ok('the canyon cuts deep beside the school, with a creek', groundH(-405, -40) < 0 && groundH(120, 345) < 0);
ok('every region has a tower on dry land', REGIONS.every((r) => POI.towers.some((t) => t.region === r.id && t.y > 1)));
ok('16 shrines and 4 great shrines, all on dry, gentle ground', POI.shrines.length === 16 && POI.greats.length === 4 && POI.shrines.concat(POI.greats).every((s) => s.y > 1 && slopeDeg(s.x, s.z) < 26));
ok('four shrines on the campus teach the four runes', ['magnet', 'bomb', 'ice', 'stasis'].every((r) => POI.shrines.some((s) => s.region === 'plateau' && s.teach === r)));
ok('no shrine, tower or chest sits inside a building', POI.shrines.concat(POI.towers, POI.chests).every((s) => zoneAt(s.x, s.z) !== 'roof'));
ok('Josh\'s street is level and in the neighborhood', Math.abs(groundH(VILLAGE.x, VILLAGE.z) - MESA) < 8 && slopeDeg(VILLAGE.x + 10, VILLAGE.z) < 8 && regionAt(VILLAGE.x, VILLAGE.z) === 'neighborhood');
ok('a neighborhood of houses, none in the canyon', POI.houses.length > 60 && POI.houses.every((h) => h.y > 40), `${POI.houses.length}`);
ok('plenty to find: leaf sprites, camps, ores, plants, chests', POI.seeds.length >= 30 && POI.camps.length >= 16 && POI.ores.length >= 40 && POI.plants.length >= 200 && POI.chests.length >= 20, `${POI.seeds.length} seeds, ${POI.camps.length} camps`);
ok('trees, none in water and none on pavement', TREES.length > 1000 && TREES.every((t) => t.y > 0.4 && (t.planter || !['blacktop', 'asphalt', 'roof'].includes(zoneAt(t.x, t.z)))), `${TREES.length}`);
ok('the west ends in sea', groundH(-790, 0) < 0 && groundH(-760, 300) < 0);
ok('Black Mountain rises above everything, the station on top', CASTLE.y > 200);
ok('the start and the gardener are on the campus', regionAt(SPOT.start.x, SPOT.start.z) === 'plateau' && regionAt(SPOT.hermit.x, SPOT.hermit.z) === 'plateau');

// ---------------------------------------------------------------- getting around
const sim = (B, secs, inp, opt = {}) => { const o = { glider: false, climbMul: 1, stamMax: 1, ...opt }; let ev = {}; for (let i = 0; i < secs * 60; i++) { const e = stepBody(B, 1 / 60, typeof inp === 'function' ? inp(B, i) : inp, outdoor, o); for (const k in e) ev[k] = e[k]; } return ev; };
const I = (mx, mz, o = {}) => ({ mx, mz, ix: 0, iy: 0, sprint: false, jump: false, drop: false, ...o });
{
  const B = newBody(SPOT.start.x, groundH(SPOT.start.x, SPOT.start.z), SPOT.start.z);
  sim(B, 3, I(0, -1));
  ok('walking: about 5 m/s and you stay on the ground', B.mode === 'ground' && Math.abs(B.z - SPOT.start.z + 15.6) < 2.5, `moved ${(SPOT.start.z - B.z).toFixed(1)} m`);
}
{ // sprinting across the open village square
  const B = newBody(VILLAGE.x - 4, groundH(VILLAGE.x - 4, VILLAGE.z), VILLAGE.z), x0 = B.x; sim(B, 0.5, I(1, 0)); const x1 = B.x; sim(B, 2, I(1, 0, { sprint: true }));
  ok('sprinting is faster and costs stamina', B.x - x1 > 13 && B.stamina < 0.8, `${(B.x - x1).toFixed(1)} m, stamina ${B.stamina.toFixed(2)}`); void x0;
}
{ // running off the campus's west edge you go over the canyon rim
  const B = newBody(-305, MESA, -60);
  sim(B, 20, (b) => (b.mode === 'climb' ? I(0, 0, { drop: true }) : I(-1, 0)), {});
  ok('the canyon rim: you go over and fall a long way (or must climb)', B.y < MESA - 30 || B.mode === 'climb' || B.mode === 'swim', `y ${B.y.toFixed(0)} mode ${B.mode}`);
}
{ // climbing a tower: up a section, rest on the ledge, up again
  const t = POI.towers[0], B = newBody(t.x, groundH(t.x, t.z + 7), t.z + 7);
  let rested = 0, t0 = 0;
  for (let i = 0; i < 120 * 60 && B.y < t.top - 0.1; i++) {
    const resting = B.mode === 'ground' && B.y > t.y + 5 && B.stamina < 0.95;
    if (resting) rested++;
    stepBody(B, 1 / 60, resting ? I(0, 0) : B.mode === 'climb' ? I(0, 0, { iy: 1 }) : I(0, -1), outdoor, { glider: false, climbMul: 1, stamMax: 1 });
    t0 = i;
  }
  ok('a tower can be climbed by resting on its ledges', B.y >= t.top - 0.1, `reached ${B.y.toFixed(1)} / ${t.top.toFixed(1)} in ${(t0 / 60).toFixed(0)} s, rested ${(rested / 60).toFixed(0)} s`);
  // and from the top you can glide far
  // glide from the top: walk off the edge, open the glider once you are in the air
  Object.assign(B, newBody(t.x, t.top, t.z)); const y0 = B.y;
  let opened = false;
  const ev = sim(B, 40, (b) => { if (!opened && b.mode === 'air' && b.y - groundAt(outdoor, b.x, b.z, b.y).h > 4) { opened = true; return I(0, -1, { jump: true }); } return I(0, -1); }, { glider: true });
  ok('gliding from the tower carries you far and lands softly', Math.hypot(B.x - t.x, B.z - t.z) > 60 && !(ev.fall > 12), `${Math.hypot(B.x - t.x, B.z - t.z).toFixed(0)} m, fall ${ev.fall ? ev.fall.toFixed(1) : 0}`);
  void y0;
}
{ // swimming: in the sea you float and can swim back
  const B = newBody(-780, 5, 0); const ev = sim(B, 2, I(0, 0));
  ok('falling into the sea: you swim', B.mode === 'swim' && Math.abs(B.y - (W.sea - 1.2)) < 0.01, B.mode);
  void ev;
}
{ // you cannot walk into a house
  const h = POI.houses[0], B = newBody(h.x, groundH(h.x, h.z + h.d / 2 + 2), h.z + h.d / 2 + 2);
  sim(B, 2, I(0, -1, {})); ok('houses are solid (you start climbing them)', B.z > h.z + h.d / 2 - 0.1 || B.mode === 'climb', `${B.mode} z ${(B.z - h.z).toFixed(2)}`);
}

// ---------------------------------------------------------------- items and cooking
ok('every weapon, bow and shield has power and durability', Object.values(WEAPONS).every((w) => w.pow > 0 && w.dur > 0) && Object.values(BOWS).every((b) => b.pow > 0 && b.dur > 0) && Object.values(SHIELDS).every((s) => s.guard > 0 && s.dur > 0));
{
  const a = cook(['apple', 'apple', 'apple']), b = cook(['meat', 'shroom']), c = cook(['pepper', 'pepper', 'meat']), d = cook(['radish']), e = cook(['horn']), f = cook(['pepper', 'stamella']);
  ok('cooking: fruit simmers, meat sears, peppers warm, radish fills', a.name[1] === 'Simmered Fruit' && a.heal === 12 && b.name[1].includes('Skewer') && c.fx === 'cold' && c.power === 2 && d.heal === 999 && effectOf(d).extra === 4);
  ok('cooking: inedible things make dubious food; mixed effects cancel', e.name[1] === 'Dubious Food' && f.fx === null);
}
ok('chest loot and shop items exist', POI.chests.every((c) => { const id = c.loot.split(':')[0]; return id === 'gold' || id === 'mat' || WEAPONS[id] || BOWS[id] || SHIELDS[id]; }) && ['warm', 'climber', 'soldier'].every((o) => OUTFITS[o].price));

// ---------------------------------------------------------------- shrines
{
  const all = allShrines(), defs = all.map((s, i) => buildShrine(s, i));
  ok('every shrine has a start, an altar and a floor under both', defs.every((D) => D.start && D.altar && groundAt({ terrain: false, boxes: D.boxes, dyn: [], water: () => -1e9 }, D.start[0], D.start[2], D.start[1] + 1).h > -1 && groundAt({ terrain: false, boxes: D.boxes, dyn: [], water: () => -1e9 }, D.altar[0], D.altar[2] + 3, D.altar[1] + 1).h > D.altar[1] - 0.5));
  ok('shrines never overlap each other', defs.every((D, i) => defs.every((E, j) => i === j || Math.abs(D.origin[0] - E.origin[0]) > 20 || Math.abs(D.origin[1] - E.origin[1]) > 200)));
  ok('great shrines end with a Blight; rune shrines teach their rune', defs.filter((D) => D.great).every((D) => D.enemies.some((e) => e.type === 'blight')) && all.filter((s) => s.teach).length === 4);
  ok('every pit has a slab long enough to bridge it', defs.every((D) => D.props.filter((p) => p.kind === 'slab').every((p) => p.size[2] > 9.5)));
  ok('ice pools: the ledge is within reach of a pillar', defs.every((D) => D.waters.every((w) => D.boxes.some((b) => b.role === 'ledge' && b.max[1] <= w.y + 3.6 + 0.01 && b.max[1] > w.y + 2))));
  ok('segments for every kind of shrine', all.every((s) => shrineSegments(s).length >= 1));
}
console.log(fails ? `test: ${fails} failed` : 'test: all passed');
process.exit(fails ? 1 : 0);
