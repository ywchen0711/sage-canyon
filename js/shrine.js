// Shrine interiors: a corridor of puzzle pieces ending at an altar where a monk gives you a Spirit Orb.
// Pieces: a pit to bridge with a metal slab (magnet), cracked walls (bombs), a pool under a high ledge (ice pillars),
// gates that slam open and shut (stasis), a weight plate for a metal crate (magnet), guardian scouts, and in the four
// great shrines a Blight to defeat. Each shrine is built far outside the island, so its boxes never touch the land.
import { POI } from './world.js';

const SEGS = {
  magnet: [['pit', 'plate'], ['plate', 'pit']], bomb: [['crack', 'crack'], ['crack', 'plate']], ice: [['pool'], ['pool', 'crack']],
  stasis: [['gates'], ['gates', 'pit']], combat: [['scouts']], combo: [['pit', 'crack'], ['plate', 'gates'], ['pool', 'gates']],
};
const GREAT_SEGS = { canyon: ['pool', 'gates', 'pool', 'boss'], hills: ['crack', 'pit', 'crack', 'boss'], creek: ['pool', 'plate', 'pit', 'boss'], beach: ['gates', 'scouts', 'gates', 'boss'] };
export const BLIGHT = { canyon: 'frost', hills: 'fire', creek: 'water', beach: 'thunder' };

export function shrineSegments(s) {
  if (s.gift) return GREAT_SEGS[s.region];
  if (s.teach) return { magnet: ['pit'], bomb: ['crack', 'crack'], ice: ['pool'], stasis: ['gates'] }[s.teach];
  const opts = SEGS[s.kind] || SEGS.combo, n = parseInt(s.id.replace(/\D/g, ''), 10) || 0;
  return opts[n % opts.length];
}
// build the interior of shrine s (index i among all shrines): boxes, water, props, plates, gates, enemies, start, altar
export function buildShrine(s, i) {
  const OX = 3000 + (i % 6) * 260, OZ = 3000 + Math.floor(i / 6) * 420, HW = 6.5;
  const D = { id: s.id, boxes: [], waters: [], props: [], plates: [], gates: [], cracked: [], enemies: [], lights: [], origin: [OX, OZ], killY: -40, great: !!s.gift };
  const B = (x0, y0, z0, x1, y1, z1, o = {}) => { const b = { min: [OX + Math.min(x0, x1), Math.min(y0, y1), OZ + Math.min(z0, z1)], max: [OX + Math.max(x0, x1), Math.max(y0, y1), OZ + Math.max(z0, z1)], climb: false, role: 'floor', ...o }; D.boxes.push(b); return b; };
  const walls = (z0, z1, y) => { B(-HW - 1, y - 30, z0, -HW, y + 11, z1, { role: 'wall' }); B(HW, y - 30, z0, HW + 1, y + 11, z1, { role: 'wall' }); };
  const floor = (z0, z1, y) => B(-HW, y - 2, z0, HW, y, z1);
  let z = 0, y = 0;
  floor(2, -8, y); walls(2, -8, y); B(-HW, y - 2, 2, HW, y + 11, 3, { role: 'wall' }); D.start = [OX, y, OZ - 5]; z = -8;
  for (const seg of shrineSegments(s)) {
    if (seg === 'pit') {
      floor(z, z - 12, y); walls(z, z - 21, y);
      D.props.push({ kind: 'slab', size: [2.4, 0.4, 10.6], pos: [OX + 3.4, y + 0.2, OZ + z - 6], metal: true });
      z -= 21; floor(z, z - 6, y); walls(z, z - 6, y); z -= 6;
    } else if (seg === 'crack') {
      floor(z, z - 14, y); walls(z, z - 14, y);
      D.cracked.push(B(-HW, y, z - 6, HW, y + 7, z - 7.6, { role: 'cracked' }));
      z -= 14;
    } else if (seg === 'pool') {
      floor(z, z - 6, y); walls(z, z - 30, y);
      B(-HW, y - 6, z - 6, HW, y - 4, z - 21, { role: 'poolfloor' }); D.waters.push({ x0: OX - HW, x1: OX + HW, z0: OZ + z - 21, z1: OZ + z - 6, y: y - 0.5 });
      const top = y + 3; B(-HW, y - 6, z - 21, HW, top, z - 30, { role: 'ledge' });
      z -= 30; y = top; floor(z, z - 4, y); walls(z, z - 4, y); z -= 4;
    } else if (seg === 'gates') {
      floor(z, z - 18, y); walls(z, z - 18, y);
      for (const [k, gz] of [[0, z - 4], [1, z - 11]]) D.gates.push({ id: 'cyc' + D.gates.length, mode: 'cycle', box: B(-HW, y, gz, HW, y + 7, gz - 3, { role: 'gate' }), y0: y, lift: 7.5, period: 3.0, open: 0.4, phase: k * 1.4 });
      z -= 18;
    } else if (seg === 'plate') {
      floor(z, z - 16, y); walls(z, z - 16, y);
      const gate = B(-HW, y, z - 12, HW, y + 7, z - 13.2, { role: 'gate' });
      D.gates.push({ id: 'pl' + D.plates.length, mode: 'plate', box: gate, y0: y, lift: -7.2 });
      D.plates.push({ x: OX - 3, z: OZ + z - 6, y, r: 1.3, gate: 'pl' + D.plates.length });
      B(2.5, y, z - 2, HW, y + 4, z - 6, { role: 'shelf' });
      D.props.push({ kind: 'crate', size: [1.4, 1.4, 1.4], pos: [OX + 4.6, y + 4.7, OZ + z - 4], metal: true });
      z -= 16;
    } else if (seg === 'scouts') {
      floor(z, z - 22, y); walls(z, z - 22, y);
      D.enemies.push({ type: 'scout', pos: [OX - 3, y, OZ + z - 9] }, { type: 'scout', pos: [OX + 3, y, OZ + z - 14] });
      D.gates.push({ id: 'en' + D.gates.length, mode: 'enemies', box: B(-HW, y, z - 20, HW, y + 7, z - 21.2, { role: 'gate' }), y0: y, lift: -7.2 });
      z -= 22;
    } else if (seg === 'boss') {
      floor(z, z - 34, y); walls(z, z - 34, y);
      D.enemies.push({ type: 'blight', kind: BLIGHT[s.region], pos: [OX, y, OZ + z - 18] });
      D.gates.push({ id: 'boss', mode: 'enemies', box: B(-HW, y, z - 32, HW, y + 7, z - 33.2, { role: 'gate' }), y0: y, lift: -7.2 });
      z -= 34;
    }
  }
  floor(z, z - 14, y); walls(z, z - 14, y); B(-HW, y - 2, z - 14, HW, y + 11, z - 15, { role: 'wall' });
  D.altar = [OX, y, OZ + z - 9]; B(-1.2, y, z - 10, 1.2, y + 0.9, z - 11.4, { role: 'altar' });
  if (s.kind === 'combat' || s.kind === 'combo' || s.gift) D.chest = { pos: [OX + 4, y, OZ + z - 6], loot: s.gift ? 'w_royal' : s.kind === 'combat' ? 'w_ancient' : 'b_falcon' };
  D.floorY = y; D.length = -z;
  return D;
}
export const allShrines = () => POI.shrines.concat(POI.greats);
