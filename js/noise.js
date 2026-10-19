// Seeded randomness and 2D simplex noise (for the land's shape). No DOM, so node tests can use it too.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash2 = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function simplex(seed) {
  const r = rng(seed), p = new Uint8Array(512), perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const F = 0.5 * (Math.sqrt(3) - 1), Gk = (3 - Math.sqrt(3)) / 6;
  return function noise(x, y) {
    const s = (x + y) * F, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * Gk;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + Gk, y1 = y0 - j1 + Gk, x2 = x0 - 1 + 2 * Gk, y2 = y0 - 1 + 2 * Gk, ii = i & 255, jj = j & 255;
    let n = 0;
    for (const [dx, dy, gi] of [[x0, y0, p[ii + p[jj]]], [x1, y1, p[ii + i1 + p[jj + j1]]], [x2, y2, p[ii + 1 + p[jj + 1]]]]) {
      let tt = 0.5 - dx * dx - dy * dy; if (tt < 0) continue; tt *= tt; const g = G[gi & 7]; n += tt * tt * (g[0] * dx + g[1] * dy);
    }
    return 70 * n;     // about -1..1
  };
}
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
