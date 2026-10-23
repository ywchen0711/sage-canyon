// Drawing the world with three.js: sky and sun through the day, the terrain, water and lava, trees and rocks in chunks,
// grass that sways around you, towers, shrines, the village, the castle, camps, and little things to pick up.
// Also particles, rain, and the map picture.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, HGRID, groundH, colorAt, normalAt, TREES, ROCKS, POI, CASTLE, VILLAGE, SPOT, regionAt, snowLine, roadDist, BOXES, MESA, BUILDINGS, ANGLED_W, SHELTER, CANOPIES, PLAY, COURTS, GOALS, ZONES, AMPHI, ISLANDS, COURT_PATHS, paved, px } from './world.js';
import { toon, glowMat, outline, makeNPC, weaponMesh } from './models.js';
import { hash2 } from './noise.js';

const N1 = W.n + 1;
const col3 = (h) => new THREE.Color(h);
function colored(geo, hex) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); if (s !== 1) g.scale(s, s, s); g.translate(x, y, z); return g; };

export function createGfx(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 2600);
  // render into a multisampled target so edges stay smooth through the post effects
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.4, 0.92); composer.addPass(bloom); composer.addPass(new OutputPass());
  // painterly grade: a little more colour and contrast, warm highlights, cool shadows, a soft vignette
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uVig: { value: 0.22 }, uSat: { value: 1.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(vec3(l), c.rgb, uSat); c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
        c.rgb += vec3(0.035, 0.018, -0.025) * smoothstep(0.35, 1.0, l) + vec3(0.01, 0.0, -0.01) * (1.0 - smoothstep(0.0, 0.35, l));
        vec2 v = vUv - 0.5; c.rgb *= 1.0 - uVig * dot(v, v) * 1.6; gl_FragColor = c; }`,
  }); composer.addPass(grade);
  // pixel art in 3D: the frame sampled in chunky square pixels, colours rounded to a smaller palette, and a dark
  // brown line where depth of colour changes sharply (a hand-drawn edge)
  const pixel = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1280, 720) }, uPix: { value: 3.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uPix; varying vec2 vUv;
      vec3 at(vec2 cell){ return texture2D(tDiffuse, (cell + 0.5) * uPix / uRes).rgb; }
      void main(){ vec2 cell = floor(vUv * uRes / uPix); vec3 c = at(cell);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        float e = max(abs(l - dot(at(cell + vec2(1.0, 0.0)), vec3(0.299, 0.587, 0.114))), abs(l - dot(at(cell + vec2(0.0, 1.0)), vec3(0.299, 0.587, 0.114))));
        // a 4x4 ordered dither, then the smaller palette (no banding on the sky)
        vec2 m = mod(cell, 4.0); float b = m.x < 1.0 ? (m.y < 1.0 ? 0.0 : m.y < 2.0 ? 12.0 : m.y < 3.0 ? 3.0 : 15.0) : m.x < 2.0 ? (m.y < 1.0 ? 8.0 : m.y < 2.0 ? 4.0 : m.y < 3.0 ? 11.0 : 7.0) : m.x < 3.0 ? (m.y < 1.0 ? 2.0 : m.y < 2.0 ? 14.0 : m.y < 3.0 ? 1.0 : 13.0) : (m.y < 1.0 ? 10.0 : m.y < 2.0 ? 6.0 : m.y < 3.0 ? 9.0 : 5.0);
        c = floor(c * 18.0 + b / 16.0) / 18.0;
        c = mix(c, vec3(0.18, 0.12, 0.07), smoothstep(0.22, 0.42, e) * 0.55);
        gl_FragColor = vec4(c, 1.0); }`,
  }); composer.addPass(pixel);
  const world = new THREE.Group(), inside = new THREE.Group(); scene.add(world); scene.add(inside);

  // ---------------------------------------------------------------- light and sky
  const hemi = new THREE.HemisphereLight('#fff2d8', '#6a5a34', 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const skyU = { top: { value: col3('#5aa0d8') }, hor: { value: col3('#f2e8c8') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: col3('#fff0c0') }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float night; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main(){ float y = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55)); if (vD.y < 0.0) c = hor * 0.9;
        float s = max(dot(vD, sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 2.5 + pow(s, 8.0) * 0.25);
        vec3 m = -sunDir; float mo = max(dot(vD, m), 0.0); c += vec3(0.9, 0.95, 1.0) * pow(mo, 900.0) * 2.0 * night;
        vec3 q = floor(vD * 260.0); float st = step(0.9975, h(q)) * night * smoothstep(0.0, 0.3, vD.y); c += vec3(st);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog('#efe2c0', 160, 1100);
  // clouds: soft puffs drifting high up
  const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const clouds = new THREE.Group(); world.add(clouds);
  for (let i = 0; i < 46; i++) { const cl = new THREE.Group(); for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); s.scale.setScalar(60 + hash2(i, k, 3) * 60); s.position.set((k - 2) * 30, hash2(i, k, 4) * 14, hash2(i, k, 5) * 20); cl.add(s); } cl.position.set((hash2(i, 1, 9) - 0.5) * 2400, 330 + hash2(i, 2, 9) * 120, (hash2(i, 3, 9) - 0.5) * 2400); clouds.add(cl); }

  // ---------------------------------------------------------------- terrain
  {
    const pos = new Float32Array(N1 * N1 * 3), colr = new Float32Array(N1 * N1 * 3), idx = [];
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const k = j * N1 + i, x = -W.half + i * W.cell, z = -W.half + j * W.cell, h = HGRID[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const n = normalAt(x, z), sl = Math.acos(Math.min(1, n[1])) * 57.3, c = colorAt(x, z, h, sl);
      colr[k * 3] = c[0]; colr[k * 3 + 1] = c[1]; colr[k * 3 + 2] = c[2];
    }
    for (let j = 0; j < W.n; j++) for (let i = 0; i < W.n; i++) { const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1; idx.push(a, c, d, a, d, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const tm = new THREE.MeshLambertMaterial({ vertexColors: true });
    tm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = `varying vec3 vWP; varying vec3 vWN;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
        ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float n1 = vn(vWP.xz * 0.35), n2 = vn(vWP.xz * 1.7), n3 = vn(vWP.xz * 0.06);
        diffuseColor.rgb *= 0.88 + n1 * 0.14 + (n3 - 0.5) * 0.1;
        float px = hh(floor(vWP.xz * 1.25)), px2 = hh(floor(vWP.xz * 0.5) + 7.0);
        diffuseColor.rgb *= 0.9 + step(0.55, px) * 0.1 + step(0.86, px) * 0.08 - step(0.93, px2) * 0.12;
        float steep = 1.0 - smoothstep(0.55, 0.8, vWN.y);
        float strata = 0.85 + 0.15 * sin(vWP.y * 2.2 + vn(vWP.xz * 0.5) * 4.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * strata * vec3(0.95, 0.93, 0.9), steep);`);
    };
    const terrain = new THREE.Mesh(g, tm); terrain.receiveShadow = true; world.add(terrain);
    // a skirt of sea floor beyond the island
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: '#2f6e88' })); floor.rotation.x = -Math.PI / 2; floor.position.y = -42; world.add(floor);
  }
  // water: a gently moving sheet with ripples
  const waterTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { const x = hash2(i, 1) * 128, y = hash2(i, 2) * 128, r = 3 + hash2(i, 3) * 10, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,150,255,0.5)'); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); return t; })();
  const waterU = { uTime: { value: 0 } };
  const waterMat = new THREE.MeshPhongMaterial({ color: '#ffffff', vertexColors: true, transparent: true, opacity: 0.86, shininess: 110, specular: '#ffffff', normalMap: waterTex, normalScale: new THREE.Vector2(0.55, 0.55) });
  waterMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterU.uTime;
    sh.vertexShader = 'attribute float depth; varying float vDepth; varying vec3 vWPw;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vDepth = depth; vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime; varying float vDepth; varying vec3 vWPw;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 shallow = vec3(0.36, 0.86, 0.82), mid = vec3(0.16, 0.56, 0.82), deep = vec3(0.06, 0.24, 0.52);
      vec3 wc = mix(shallow, mid, smoothstep(0.0, 3.5, vDepth)); wc = mix(wc, deep, smoothstep(3.5, 22.0, vDepth));
      float foam = (1.0 - smoothstep(0.0, 0.9, vDepth)) * (0.55 + 0.45 * sin(uTime * 1.6 + vWPw.x * 0.35 + vWPw.z * 0.3));
      diffuseColor.rgb = mix(wc, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
      diffuseColor.a *= mix(0.7, 0.95, smoothstep(0.0, 6.0, vDepth));`);
  };
  // the sheet near the island follows the land's grid, so every vertex knows how deep the water is there
  const water = (() => {
    const n = 200, size = 1800, g = new THREE.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, d = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) d[i] = Math.max(0, W.sea - groundH(P.getX(i), P.getZ(i)));
    g.setAttribute('depth', new THREE.BufferAttribute(d, 1));
    const c = new Float32Array(P.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Mesh(g, waterMat); m.position.y = W.sea + 0.02; m.receiveShadow = true; world.add(m);
    const og = new THREE.RingGeometry(890, 4000, 64, 1); og.rotateX(-Math.PI / 2); const od = new Float32Array(og.attributes.position.count).fill(40); og.setAttribute('depth', new THREE.BufferAttribute(od, 1));
    og.setAttribute('color', new THREE.BufferAttribute(new Float32Array(og.attributes.position.count * 3).fill(1), 3));
    const outer = new THREE.Mesh(og, waterMat); outer.position.y = W.sea; world.add(outer);
    return m;
  })();
  if (SPOT.volcano) { const ly = groundH(SPOT.volcano.x, SPOT.volcano.z) + 3, lava = new THREE.Mesh(new THREE.CircleGeometry(48, 32), glowMat('#ff5a1a', 2.2)); lava.rotation.x = -Math.PI / 2; lava.position.set(SPOT.volcano.x, ly, SPOT.volcano.z); world.add(lava); }

  // ---------------------------------------------------------------- trees and rocks, in chunks that hide when far away
  const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap, flatShading: true });
  const windU = { uTime: { value: 0 } };
  treeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 tp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float bend = max(0.0, position.y - 1.6) * 0.045;
      transformed.x += sin(uTime * 1.3 + tp.x * 0.11 + tp.z * 0.07) * bend; transformed.z += cos(uTime * 1.1 + tp.z * 0.09) * bend * 0.6;`);
  };
  const TG = {
    oak: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 7), 0, 1.6, 0), '#7a5430'), colored(at(new THREE.IcosahedronGeometry(2.2, 0), 0, 4.4, 0), '#5e8a36'), colored(at(new THREE.IcosahedronGeometry(1.5, 1), 1.2, 3.8, 0.6), '#5a9a42'), colored(at(new THREE.IcosahedronGeometry(1.4, 1), -1.1, 4.0, -0.5), '#3f7a34')]),
    apple: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 7), 0, 1.6, 0), '#7a5430'), colored(at(new THREE.IcosahedronGeometry(2.2, 0), 0, 4.4, 0), '#5e8a36'), colored(at(new THREE.IcosahedronGeometry(1.5, 1), 1.2, 3.8, 0.6), '#5a9a42'),
      ...[[1.4, 3.6, 1.4], [-1.6, 4.4, 0.8], [0.4, 5.2, -1.8], [-0.6, 3.4, 1.9]].map(([x, y, z]) => colored(at(new THREE.IcosahedronGeometry(0.22, 0), x, y, z), '#e83a3a'))]),
    pine: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0, 1.2, 0), '#5a3e28'), colored(at(new THREE.ConeGeometry(2.0, 3.2, 7), 0, 3.2, 0), '#3e6a34'), colored(at(new THREE.ConeGeometry(1.6, 2.8, 7), 0, 4.8, 0), '#3a7a44'), colored(at(new THREE.ConeGeometry(1.0, 2.2, 7), 0, 6.2, 0), '#46884e')]),
    snowpine: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0, 1.2, 0), '#5a3e28'), colored(at(new THREE.ConeGeometry(2.0, 3.2, 7), 0, 3.2, 0), '#4a6a4a'), colored(at(new THREE.ConeGeometry(1.6, 2.8, 7), 0, 4.8, 0), '#e8f0f8'), colored(at(new THREE.ConeGeometry(1.0, 2.2, 7), 0, 6.2, 0), '#f4f8fc')]),
    dead: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.18, 0.35, 4.2, 6), 0, 2.1, 0), '#3a2e2a'), colored(at(new THREE.CylinderGeometry(0.08, 0.14, 1.8, 5), 0.6, 3.2, 0, 0, 0, -0.8), '#3a2e2a'), colored(at(new THREE.CylinderGeometry(0.07, 0.12, 1.5, 5), -0.5, 2.6, 0.2, 0.3, 0, 0.9), '#3a2e2a')]),
    cactus: mergeGeometries([colored(at(new THREE.CylinderGeometry(0.35, 0.4, 3.0, 8), 0, 1.5, 0), '#4a8a4a'), colored(at(new THREE.CylinderGeometry(0.2, 0.22, 1.2, 7), 0.6, 1.9, 0, 0, 0, 0), '#4a8a4a'), colored(at(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 7), 0.4, 1.4, 0, 0, 0, 1.57), '#4a8a4a')]),
  };
  const rockGeo = colored(new THREE.DodecahedronGeometry(1, 0), '#9a9282');
  const CH = 200, chunks = new Map();
  const chunkOf = (x, z) => `${Math.floor((x + W.half) / CH)},${Math.floor((z + W.half) / CH)}`;
  const byChunk = new Map(); const put = (k, type, m) => { let c = byChunk.get(k); if (!c) byChunk.set(k, (c = {})); (c[type] = c[type] || []).push(m); };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  for (const t of TREES) { const type = t.apple ? 'apple' : t.type === 'pine' && t.y > snowLine(t.x, t.z) - 25 ? 'snowpine' : t.type; q.setFromEuler(e.set(0, t.rot, 0)); m4.compose(v.set(t.x, t.y - 0.2, t.z), q, sc.setScalar(t.s)); put(chunkOf(t.x, t.z), type, m4.clone()); }
  for (const r of ROCKS) { q.setFromEuler(e.set(r.rot, r.rot * 2, 0)); m4.compose(v.set(r.x, r.y + r.r * 0.15, r.z), q, sc.set(r.r, r.r * 0.75, r.r)); put(chunkOf(r.x, r.z), 'rock', m4.clone()); }
  for (const [k, types] of byChunk) {
    const grp = new THREE.Group(); const [ci, cj] = k.split(',').map(Number); grp.userData.c = [-W.half + (ci + 0.5) * CH, -W.half + (cj + 0.5) * CH];
    for (const [type, list] of Object.entries(types)) {
      const im = new THREE.InstancedMesh(type === 'rock' ? rockGeo : TG[type], treeMat, list.length);
      const tint = new THREE.Color();
      list.forEach((mm, i) => { im.setMatrixAt(i, mm); const h = hash2(i, type.length, ci * 31 + cj); tint.setRGB(0.86 + h * 0.24, 0.9 + hash2(i, 3, cj) * 0.2, 0.84 + hash2(i, 5, ci) * 0.2); im.setColorAt(i, tint); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im);
    }
    world.add(grp); chunks.set(k, grp);
  }
  // ---------------------------------------------------------------- grass around the player
  // a blade: two faces (one each way) with normals pointing up, so both sides catch the light like the ground
  const bladeGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.06, 0, 0, 0.06, 0, 0, 0.0, 0.55, 0.03, -0.06, 0, 0, 0.0, 0.55, 0.03, 0.06, 0, 0]), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3)); return g; })();
  const grassU = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() } };
  const grassMat = new THREE.MeshLambertMaterial();
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = grassU.uTime; sh.uniforms.uPlayer = grassU.uPlayer;
    sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float hh = position.y;
      transformed.x += sin(uTime * 2.1 + wp.x * 0.35 + wp.z * 0.2) * 0.14 * hh; transformed.z += cos(uTime * 1.6 + wp.z * 0.4) * 0.07 * hh;
      vec2 away = wp.xz - uPlayer.xz; float dd = length(away); if (dd < 1.2) transformed.xz += normalize(away + 0.001) * (1.2 - dd) * 0.5 * hh;
      vTip = hh / 0.55;`).replace('void main() {', 'varying float vTip;\nvoid main() {');
    sh.fragmentShader = 'varying float vTip;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.55, 1.18, vTip);');
  };
  const GMAX = 16000, grass = new THREE.InstancedMesh(bladeGeo, grassMat, GMAX); grass.count = 0; grass.receiveShadow = true; grass.frustumCulled = false;
  grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GMAX * 3), 3); world.add(grass);
  let grassKey = '';
  function updateGrass(px, pz, on) {
    grass.visible = on; if (!on) return;
    const T = 6, ti = Math.floor(px / T), tj = Math.floor(pz / T), key = ti + ',' + tj; if (key === grassKey) return; grassKey = key;
    let n = 0; const RR = 5, cc = new THREE.Color();
    for (let b = -RR; b <= RR; b++) for (let a = -RR; a <= RR; a++) {
      if (a * a + b * b > RR * RR + 1) continue;
      const tx = (ti + a) * T, tz = (tj + b) * T, reg = regionAt(tx, tz);
      if (reg === 'beach' && groundH(tx, tz) < 8) continue;
      const h0 = groundH(tx + 3, tz + 3); if (h0 < 1.5 || h0 > snowLine(tx, tz) - 12) continue;
      const base = colorAt(tx + 3, tz + 3, h0, 10);
      for (let k = 0; k < 140 && n < GMAX; k++) {
        const x = tx + hash2(ti + a, tj + b, k * 3) * T, z = tz + hash2(ti + a, tj + b, k * 3 + 1) * T, h = groundH(x, z);
        if (h < 1.2 || paved(x, z)) continue;
        const nn = normalAt(x, z); if (nn[1] < 0.8) continue;
        const s = 0.7 + hash2(x | 0, z | 0, 7) * 0.8;
        q.setFromEuler(e.set(0, hash2(k, a, b) * 6.28, 0)); m4.compose(v.set(x, h - 0.03, z), q, sc.set(s, s, s)); grass.setMatrixAt(n, m4);
        const f = 0.85 + hash2(k, b, a) * 0.3, fl = hash2(k * 7, a, b);
        cc.setRGB(base[0] * f * (fl < 0.3 ? 1.12 : 1.02), base[1] * f * 1.12, base[2] * f * (fl < 0.3 ? 0.85 : 1)); void fl;
        grass.setColorAt(n, cc); n++;
      }
    }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; grass.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- places
  const places = { towers: {}, shrines: {}, greats: {}, chests: {}, ores: {}, plants: {}, seeds: {}, pots: {}, fires: [] };
  const stone = toon('#7a766c'), dark = toon('#4a4640'), wood = toon('#8a5a32'), roofR = toon('#a84a3a');
  const mesh = (geo, mat, x, y, z, parent = world) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 40, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowSprite = (x, y, z, s, color = '#ffffff', parent = world) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); parent.add(sp); return sp; };
  function fire(x, z, parent) { const y = groundH(x, z); for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 5), toon('#5a3a22'), x, y + 0.1, z, parent).rotation.set(1.5, i * 0.8, 0); const f = glowSprite(x, y + 0.6, z, 1.6, '#ffffff', parent); places.fires.push(f); return f; }
  // towers: a dark stone spire with glowing seams, orange until you wake it, then blue
  for (const t of POI.towers) {
    const g = new THREE.Group(); world.add(g); const seams = [];
    for (const [hw, y0, y1] of t.segs) {
      mesh(new THREE.BoxGeometry(hw * 2, y1 - y0, hw * 2), dark, t.x, (y0 + y1) / 2, t.z, g);
      mesh(new THREE.BoxGeometry(hw * 2 + 0.1, 0.35, hw * 2 + 0.1), stone, t.x, y1 - 0.17, t.z, g);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, s = mesh(new THREE.BoxGeometry(0.35, y1 - y0 - 2, 0.1), glowMat('#ff8a2a', 1.5), t.x + Math.sin(a) * (hw + 0.02), (y0 + y1) / 2, t.z + Math.cos(a) * (hw + 0.02), g); s.rotation.y = a; seams.push(s); }
    }
    const term = mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8), stone, t.x, t.top + 0.55, t.z, g);
    const orb = mesh(new THREE.SphereGeometry(0.32, 12, 10), glowMat('#ff8a2a', 2.5), t.x, t.top + 1.4, t.z, g);
    places.towers[t.id] = { g, seams, orb, term };
  }
  // shrines: a stone platform under an arch with a glowing ring (orange, blue when done)
  for (const s of POI.shrines) {
    const g = new THREE.Group(); world.add(g);
    mesh(new THREE.BoxGeometry(6, 2.35, 6), stone, s.x, s.y - 0.8, s.z, g);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), dark, s.x + sx * 2.1, s.y + 2.4, s.z - 1.6, g);
    mesh(new THREE.BoxGeometry(5.2, 0.8, 1.0), dark, s.x, s.y + 4.6, s.z - 1.6, g);
    const ring = mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 28), glowMat('#ff8a2a', 2), s.x, s.y + 2.3, s.z - 1.6, g);
    const pad = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 24), glowMat('#ff8a2a', 1.2), s.x, s.y + 0.4, s.z, g);
    places.shrines[s.id] = { g, ring, pad };
  }
  // great shrines: a tall pedestal under a huge floating crystal in the region's colour
  const GREAT_COL = { canyon: '#8ad8ff', hills: '#ff6a3a', creek: '#4ae0c8', beach: '#ffd040' };
  for (const s of POI.greats) {
    const g = new THREE.Group(); world.add(g);
    mesh(new THREE.BoxGeometry(6, 2.35, 6), stone, s.x, s.y - 0.8, s.z, g);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; mesh(new THREE.BoxGeometry(0.9, 7, 0.9), dark, s.x + Math.sin(a) * 4.2, s.y + 3, s.z + Math.cos(a) * 4.2, g); }
    const cr = mesh(new THREE.OctahedronGeometry(2.2, 0), glowMat('#b02a5a', 1.6), s.x, s.y + 9, s.z, g); cr.scale.y = 1.7;
    const pad = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 24), glowMat('#b02a5a', 1.2), s.x, s.y + 0.4, s.z, g);
    places.greats[s.id] = { g, cr, pad, col: GREAT_COL[s.region] };
  }
  // the village: houses with gabled roofs, a goddess statue, lanterns
  const winMat = toon('#5a7a98'), tileRoof = toon('#b45a42'), doorMat = toon('#7a5030'), garage = toon('#e8e4dc');
  for (const h of POI.houses) {
    const wall = toon(h.col || '#ece4d0'), roof = h.role === 'elder' ? toon('#5a6a9a') : h.role === 'leaf' ? toon('#5e8a36') : h.role === 'shop' ? toon('#3a8a6a') : tileRoof;
    mesh(new THREE.BoxGeometry(h.w, h.h + 2, h.d), wall, h.x, h.y + h.h / 2 - 1, h.z);
    const r = mesh(new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.76, 3.4, 4), roof, h.x, h.y + h.h + 1.7, h.z); r.rotation.y = Math.PI / 4; r.scale.set(h.w / Math.max(h.w, h.d), 1, h.d / Math.max(h.w, h.d));
    const f = h.z + h.d / 2 + 0.04;
    mesh(new THREE.BoxGeometry(1.4, 2.4, 0.1), doorMat, h.x - h.w * 0.12, h.y + 1.2, f);
    if (h.role === 'house') mesh(new THREE.BoxGeometry(h.w * 0.34, 2.6, 0.1), garage, h.x + h.w * 0.26, h.y + 1.3, f);
    for (const sx of h.role === 'house' ? [-0.36] : [-0.32, 0.3]) mesh(new THREE.BoxGeometry(1.6, 1.2, 0.08), winMat, h.x + sx * h.w, h.y + 3.0, f);
    if (h.h > 7) for (const sx of [-0.3, 0.05, 0.32]) mesh(new THREE.BoxGeometry(1.4, 1.1, 0.08), winMat, h.x + sx * h.w, h.y + 7, f);
  }
  campus();
  for (const [dx, dz] of [[-10, -6], [10, -6], [-10, 16], [10, 18]]) { const x = VILLAGE.x + dx, z = VILLAGE.z + dz, y = groundH(x, z); mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), toon('#3a3a3a'), x, y + 1.3, z); mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), glowMat('#ffd890', 1.5), x, y + 2.7, z); }
  // the hermit's cabin and the chamber where you wake
  { const x = SPOT.hermit.x, z = SPOT.hermit.z, y = groundH(x, z); mesh(new THREE.BoxGeometry(7, 4, 6), wood, x, y + 1.6, z); const r = mesh(new THREE.ConeGeometry(5.5, 2.6, 4), toon('#6a5a4a'), x, y + 4.8, z); r.rotation.y = Math.PI / 4; mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), stone, x + 2, y + 5, z - 1); fire(x + 5, z + 5); }
  // where Josh wakes: a mysterious glowing stone half sunk in the grass
  { const x = SPOT.start.x, z = SPOT.start.z, y = groundH(x, z); const st = mesh(new THREE.DodecahedronGeometry(1.2, 0), stone, x - 2.5, y + 0.4, z - 2); st.scale.set(1, 0.7, 1.3); mesh(new THREE.BoxGeometry(1.6, 0.25, 0.5), glowMat('#40c8ff', 1.2), x - 2.5, y + 1.15, z - 2); glowSprite(x - 2.5, y + 1.4, z - 2, 2.2, '#80d8ff'); }
  // the grove and its sword
  { const x = SPOT.grove.x, z = SPOT.grove.z, y = groundH(x, z); mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.8, 10), stone, x, y + 0.4, z); const sw = weaponMesh('w_dawn'); sw.position.set(x, y + 0.6, z); sw.rotation.x = Math.PI; sw.position.y += 1.3; world.add(sw); places.dawn = sw; glowSprite(x, y + 1.8, z, 3, '#a8e8ff'); }
  // the castle: dark walls and towers, the keep wrapped in red-violet gloom
  {
    const cstone = toon('#5a5866');
    for (const b of BOXES) if (b.castle && b !== CASTLE.keep) mesh(new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), cstone, (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    const k = CASTLE.keep; mesh(new THREE.BoxGeometry(k.max[0] - k.min[0], k.max[1] - k.min[1], k.max[2] - k.min[2]), toon('#4a4858'), (k.min[0] + k.max[0]) / 2, (k.min[1] + k.max[1]) / 2, (k.min[2] + k.max[2]) / 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = CASTLE.x + dx * CASTLE.half, z = CASTLE.z + dz * CASTLE.half, y = groundH(x, z); mesh(new THREE.BoxGeometry(9, CASTLE.y + 18 - y, 9), cstone, x, (CASTLE.y + 18 + y) / 2, z); }
    // the old radio mast, red and white, with dishes, wrapped in gloom
    for (let i = 0; i < 12; i++) mesh(new THREE.CylinderGeometry(0.9 - i * 0.05, 1.0 - i * 0.05, 5, 6), toon(i % 2 ? '#e8e4dc' : '#c83a3a'), CASTLE.x, k.max[1] + 2.5 + i * 5, CASTLE.z - 43);
    for (const [dy, ry] of [[14, 0.6], [26, -0.9]]) { const d = mesh(new THREE.SphereGeometry(3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), toon('#d8d8dc', { side: THREE.DoubleSide }), CASTLE.x + 1.2, k.max[1] + dy, CASTLE.z - 43); d.rotation.set(Math.PI / 2, ry, 0); }
    mesh(new THREE.SphereGeometry(0.7, 10, 8), glowMat('#ff3a3a', 3), CASTLE.x, k.max[1] + 63, CASTLE.z - 43);
    places.gloom = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 22 + (i % 3) * 6, s = mesh(new THREE.SphereGeometry(4 + (i % 4), 12, 10), glowMat(i % 2 ? '#7a1a4a' : '#4a1a5a', 0.9), CASTLE.x + Math.cos(a) * r, k.max[1] + 4 + (i % 5) * 6, CASTLE.z - 47 + Math.sin(a) * r * 0.6); s.userData.a = a; places.gloom.push(s); }
    const ring = mesh(new THREE.TorusGeometry(CASTLE.arena.r, 0.3, 6, 60), glowMat('#ff2a5a', 1.4), CASTLE.arena.x, CASTLE.arena.y + 0.2, CASTLE.arena.z); ring.rotation.x = Math.PI / 2; places.arenaRing = ring;
  }
  // camps: tents, a campfire, a lookout for archers
  for (const c of POI.camps) {
    fire(c.x, c.z);
    for (let i = 0; i < 2; i++) { const a = i * 2.4 + 0.8, x = c.x + Math.cos(a) * 6, z = c.z + Math.sin(a) * 6, y = groundH(x, z); const t = mesh(new THREE.ConeGeometry(2.2, 2.8, 4), toon(i ? '#8a6a4a' : '#a8885a'), x, y + 1.3, z); t.rotation.y = a; }
    if (c.archer) { const x = c.x - 6, z = c.z + 4, y = groundH(x, z); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5), wood, x + a, y + 2.5, z + b); mesh(new THREE.BoxGeometry(2.6, 0.3, 2.6), wood, x, y + 5, z); }
  }
  // cooking pots on a fire
  for (const p of POI.pots) { const g = new THREE.Group(); world.add(g); fire(p.x, p.z, g); const pot = mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#2a2a2a'), p.x, p.y + 1.0, p.z, g); pot.rotation.x = Math.PI; places.pots[p.id] = g; }
  // ore deposits, chests, plants, leaf-sprite hiding places
  for (const o of POI.ores) { const g = new THREE.Group(); world.add(g); mesh(new THREE.DodecahedronGeometry(1.1, 0), toon('#6a6460'), o.x, o.y + 0.6, o.z, g).scale.set(1, 0.8, 1); for (let i = 0; i < 4; i++) mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat(o.rich ? '#ffd040' : '#e06aff', 0.8), o.x + Math.cos(i * 1.6) * 0.8, o.y + 0.7 + (i % 2) * 0.4, o.z + Math.sin(i * 1.6) * 0.8, g); places.ores[o.id] = g; }
  for (const c of POI.chests) { const g = new THREE.Group(); g.position.set(c.x, c.y, c.z); world.add(g); mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), toon('#8a5a2a'), 0, 0.3, 0, g); const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.37); g.add(lid); mesh(new THREE.BoxGeometry(1.14, 0.3, 0.78), toon('#a06a32'), 0, 0.15, 0.39, lid); mesh(new THREE.BoxGeometry(1.16, 0.12, 0.8), toon('#e0b840'), 0, 0.42, 0, g); places.chests[c.id] = { g, lid }; }
  const PLANT = { apple: () => [new THREE.SphereGeometry(0.16, 8, 6), toon('#e83a3a')], shroom: () => [new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#c89a6a')],
    radish: () => [new THREE.SphereGeometry(0.2, 8, 6), toon('#f4f0f0')], stamella: () => [new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#d8f04a')], pepper: () => [new THREE.ConeGeometry(0.1, 0.32, 6), toon('#ff4a2a')] };
  for (const p of POI.plants) { const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); world.add(g); const [geo, mat] = PLANT[p.item](); const m = mesh(geo, mat, 0, p.item === 'shroom' || p.item === 'stamella' ? 0.18 : 0.16, 0, g); if (p.item === 'shroom' || p.item === 'stamella') mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), toon('#f0e8d0'), 0, 0.09, 0, g); if (p.item === 'radish') mesh(new THREE.ConeGeometry(0.12, 0.35, 5), toon('#5aa040'), 0, 0.42, 0, g); void m; glowSprite(p.x, p.y + 0.5, p.z, 0.35, '#fff6c0', g).position.set(0, 0.5, 0); places.plants[p.id] = g; }
  for (const s of POI.seeds) {
    const g = new THREE.Group(); g.position.set(s.x, s.y, s.z); world.add(g);
    if (s.kind === 'rock') { for (let i = 0; i < 7; i++) mesh(new THREE.DodecahedronGeometry(0.18, 0), toon('#bcb8ac'), Math.cos(i * 0.9) * 1.4, 0.1, Math.sin(i * 0.9) * 1.4, g); g.userData.rock = mesh(new THREE.DodecahedronGeometry(0.55, 0), toon('#a8a49a'), 0, 0.35, 0, g); }
    else { g.userData.leaf = mesh(new THREE.OctahedronGeometry(0.35, 0), glowMat('#8aff6a', 1.6), 0, 1.6, 0, g); g.userData.leaf.scale.set(0.6, 1, 0.3); glowSprite(0, 1.6, 0, 1.4, '#aaffaa', g); }
    places.seeds[s.id] = g;
  }

  // ---------------------------------------------------------------- the school: buildings, the lunch shelter, play structures, courts and lines
  function campus() {
    const Y = MESA, stucco = toon('#ecdfc6'), base = toon('#b89a7a'), roofFlat = toon('#dcdcd8'), roofDark = toon('#3a4258'), tile = toon('#9a6a56'), glass = toon('#4e6e8e'), trim = toon('#6a8aa8');
    const white = new THREE.MeshLambertMaterial({ color: '#f4f4ee' }), conc = new THREE.MeshLambertMaterial({ color: '#c8c2b4' });
    const flat = (geo, mat, x, y, z, ry = 0) => { const m = mesh(geo, mat, x, y, z); m.rotation.y = ry; m.castShadow = false; return m; };
    const line = (x0, z0, x1, z1, mat = white, w = 0.35, y = Y + 0.03) => { const L = Math.hypot(x1 - x0, z1 - z0); return flat(new THREE.BoxGeometry(w, 0.04, L), mat, (x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)); };
    // a block of classrooms: stucco walls, a stone base, a band of windows on each floor, a roof
    function block(cx, cz, w, d, h, roof, ry = 0, wallMat = stucco) {
      const g = new THREE.Group(); g.position.set(cx, Y, cz); g.rotation.y = ry; world.add(g);
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      add(new THREE.BoxGeometry(w, h + 2, d), wallMat, 0, h / 2 - 1, 0);
      add(new THREE.BoxGeometry(w + 0.1, 1.2, d + 0.1), base, 0, 0.6, 0);
      for (let fy = 2.4; fy < h - 1.5; fy += 6) { add(new THREE.BoxGeometry(w + 0.12, 1.6, d * 0.55), glass, 0, fy + 0.8, 0); add(new THREE.BoxGeometry(w * 0.55, 1.6, d + 0.12), glass, 0, fy + 0.8, 0); }
      if (roof === 'tile') { const big = Math.max(w, d), rh = Math.min(5, big * 0.15), r = add(new THREE.ConeGeometry(big * 0.72, rh, 4), tile, 0, h + rh / 2, 0); r.rotation.y = Math.PI / 4; r.scale.set((w / big) * 1.06, 1, (d / big) * 1.06); }
      else { add(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8), roofFlat, 0, h + 0.3, 0); for (let i = 0; i < Math.max(1, Math.floor(w / 22)); i++) add(new THREE.BoxGeometry(3, 1.6, 2.4), toon('#b8b8b4'), -w / 2 + 11 + i * 22, h + 1.4, 0); }
      return g;
    }
    for (const [nm, r, h, roof] of BUILDINGS) {
      const [x0, z0, x1, z1] = r, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      block(cx, cz, w, d, h, roof, 0, nm === 'portable' || nm === 'southeast' ? toon('#d8d4c4') : stucco);
      if (nm === 'north') {                // the long dark canopy along the field side, and the brown tile trim of the upper story
        mesh(new THREE.BoxGeometry(w, 0.5, 11), roofDark, cx, Y + 5, z0 - 1); for (let x = x0 + 3; x < x1; x += 9) mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 6), trim, x, Y + 2.5, z0 - 6);
        for (const zz of [z0 + 4, z1 - 4]) mesh(new THREE.BoxGeometry(w - 6, 1.2, 4), tile, cx, Y + h + 0.9, zz);
      }
      if (nm === 'westwing' || nm === 'eastwing') {   // covered walks with lockers along the courtyard side
        const xs = nm === 'westwing' ? x1 + 1.6 : x0 - 1.6; mesh(new THREE.BoxGeometry(3.2, 0.4, d), roofFlat, xs, Y + 4, cz); for (let z = z0 + 3; z < z1; z += 9) mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 6), trim, xs + (nm === 'westwing' ? 1.4 : -1.4), Y + 2, z);
      }
    }
    for (const r of ANGLED_W) { const g = block(r.x, r.z, r.hl * 2, r.hw * 2, r.h, r.roof, -r.ang, r.nm === 'hallroof' ? toon('#e4d4b8') : stucco); if (r.nm === 'hallroof') g.children[0].material = toon('#d8c8a8'); }
    // the lunch shelter: two long metal roofs on blue posts, tables underneath
    { const [x0, z0, x1, z1] = SHELTER, top = Y + 6, xm = (x0 + x1) / 2;
      for (const [a, b] of [[x0, xm], [xm, x1]]) { const r = mesh(new THREE.BoxGeometry(b - a - 0.4, 0.4, z1 - z0), toon('#9ab0bc'), (a + b) / 2, top + 0.2, (z0 + z1) / 2); for (let x = a + 2; x < b; x += 3) mesh(new THREE.BoxGeometry(0.2, 0.15, z1 - z0), toon('#7a909c'), x, top + 0.45, (z0 + z1) / 2); void r; }
      for (let x = x0 + 1; x < x1; x += (x1 - x0 - 2) / 3) for (const z of [z0 + 1, z1 - 1, (z0 + z1) / 2]) mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), trim, x, Y + 3, z);
      for (let i = 0; i < 8; i++) { const z = z0 + 6 + i * ((z1 - z0 - 12) / 7); for (const xx of [(x0 + xm) / 2, (xm + x1) / 2]) { mesh(new THREE.BoxGeometry(14, 0.15, 1.6), toon('#4a6a8a'), xx, Y + 1.1, z); mesh(new THREE.BoxGeometry(14, 0.12, 0.5), toon('#4a6a8a'), xx, Y + 0.6, z + 1.3); } } }
    // the covered walk across the south of the courtyard, the pyramid canopy over the lunch tables
    for (const [x0, z0, x1, z1, top, kind] of CANOPIES) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (kind === 'pyramid') { const c = mesh(new THREE.ConeGeometry((x1 - x0) * 0.75, 4, 4), toon('#7a96c0'), cx, Y + top + 2, cz); c.rotation.y = Math.PI / 4; for (const [a, b] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) mesh(new THREE.CylinderGeometry(0.25, 0.25, top, 8), trim, a, Y + top / 2, b);
        for (let i = 0; i < 9; i++) mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 12), toon('#4a6a8a'), x0 - 8 + (i % 3) * 10, Y + 1.0, z0 - 6 + Math.floor(i / 3) * 9); }
      else { mesh(new THREE.BoxGeometry(x1 - x0, 0.4, z1 - z0), roofDark, cx, Y + top + 0.2, cz); for (const x of [x0 + 2, x1 - 2, cx]) mesh(new THREE.CylinderGeometry(0.2, 0.2, top, 6), trim, x, Y + top / 2, cz); }
    }
    // the courtyard: paths in an X and a cross, a planted bed in the middle
    for (const [[ax, az], [bx, bz]] of COURT_PATHS) line(ax, az, bx, bz, conc, 4.5, Y + 0.035);
    { const [cx, cz] = px(443, 368); flat(new THREE.BoxGeometry(30, 0.3, 14), toon('#a8583a'), cx, Y + 0.15, cz); const [mx, mz] = px(443, 404); flat(new THREE.BoxGeometry(8, 0.5, 8), conc, mx, Y + 0.25, mz); }
    // play structures: decks, posts, canopies, a yellow slide, on wood chips
    for (const p of PLAY) {
      const blue = toon('#3a7ad8'), red = toon('#e04a3a'), yellow = toon('#f0c040');
      for (const [x, z, h, sz] of p.decks) {
        mesh(new THREE.BoxGeometry(sz * 2, 0.3, sz * 2), toon('#5a5a62'), x, Y + h - 0.15, z);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.16, 0.16, h + 2.4, 8), blue, x + a * sz, Y + (h + 2.4) / 2, z + b * sz);
        const c = mesh(new THREE.ConeGeometry(sz * 1.6, 1.8, 4), h > 4 ? red : blue, x, Y + h + 3.3, z); c.rotation.y = Math.PI / 4;
        for (const b of [-1, 1]) mesh(new THREE.BoxGeometry(sz * 2, 0.9, 0.08), yellow, x, Y + h + 0.6, z + b * sz);
      }
      const [x, z, h, sz] = p.decks[1], sl = mesh(new THREE.BoxGeometry(1.4, 0.25, h * 1.9), yellow, x + sz + 0.8, Y + h / 2, z + h * 0.7); sl.rotation.x = -0.5;
      flat(new THREE.CylinderGeometry(p.big ? 22 : 16, p.big ? 22 : 16, 0.06, 32), toon('#7aa0c8'), p.x, Y + 0.03, p.z);      // the blue rubber surface round each structure
    }
    // the blacktop: three basketball hoops on the west side with their keys, the long line down the middle, the octagon, the four-square grids
    for (const [hx, hz] of COURTS.hoops) {
      mesh(new THREE.CylinderGeometry(0.2, 0.2, 7, 8), toon('#5a5a62'), hx - 1.4, Y + 3.5, hz); mesh(new THREE.BoxGeometry(0.15, 2.4, 3.6), white, hx, Y + 6.4, hz);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16), toon('#ff7a2a')); hoop.rotation.x = Math.PI / 2; hoop.position.set(hx + 0.7, Y + 5.6, hz); world.add(hoop);
      line(hx, hz - 5, hx + 15, hz - 5); line(hx, hz + 5, hx + 15, hz + 5); line(hx + 15, hz - 5, hx + 15, hz + 5);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(5, 0.15, 4, 24, Math.PI), white); arc.rotation.x = Math.PI / 2; arc.rotation.z = -Math.PI / 2; arc.position.set(hx + 15, Y + 0.04, hz); world.add(arc);
    }
    line(COURTS.line[0][0], COURTS.line[0][1], COURTS.line[1][0], COURTS.line[1][1], toon('#2a2a30'), 0.5);
    { const [cx, cz] = COURTS.octagon, oct = new THREE.Mesh(new THREE.TorusGeometry(10, 0.25, 4, 8), white); oct.rotation.x = Math.PI / 2; oct.position.set(cx, Y + 0.04, cz); world.add(oct); mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), toon('#c8c8cc'), cx, Y + 2.5, cz); mesh(new THREE.SphereGeometry(0.45, 12, 10), toon('#f0c040'), cx + 0.8, Y + 3.2, cz); }
    { const cols = ['#e04a3a', '#3a7ad8', '#f0c040', '#3ab060']; for (const [cx, cz] of COURTS.four) for (let i = 0; i < 4; i++) flat(new THREE.BoxGeometry(5.6, 0.04, 5.6), toon(cols[(i + Math.round(cx)) % 4]), cx + (i % 2 ? 2.9 : -2.9), Y + 0.03, cz + (i < 2 ? -2.9 : 2.9)); }
    // soccer goals at both ends of the field, and its lines
    for (const [gx, gz] of GOALS) { const sg = gx < 0 ? 1 : -1; for (const b of [-1, 1]) mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), white, gx, Y + 1.3, gz + b * 4); const bar = mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), white, gx, Y + 2.6, gz); bar.rotation.x = Math.PI / 2; const net = mesh(new THREE.BoxGeometry(2, 2.6, 8), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 }), gx - sg, Y + 1.3, gz); net.castShadow = false; }
    { const [x0, z0, x1, z1] = ZONES[1][1]; line(x0 + 8, z0 + 6, x1 - 8, z0 + 6); line(x0 + 8, z1 - 6, x1 - 8, z1 - 6); line(x0 + 8, z0 + 6, x0 + 8, z1 - 6); line(x1 - 8, z0 + 6, x1 - 8, z1 - 6); line((x0 + x1) / 2, z0 + 6, (x0 + x1) / 2, z1 - 6);
      const c = new THREE.Mesh(new THREE.TorusGeometry(14, 0.18, 4, 40), white); c.rotation.x = Math.PI / 2; c.position.set((x0 + x1) / 2, Y + 0.04, (z0 + z1) / 2); world.add(c); }
    // the front loop: rows of parking stalls round planted islands
    { const [x0, z0, x1, z1] = ZONES[10][1]; for (const zz of [z0 + 22, z0 + 50, z0 + 82, z1 - 22]) for (let x = x0 + 18; x < x1 - 18; x += 5.5) if (!ISLANDS.some(([a, b]) => Math.hypot(a - x, b - zz) < 9) && paved(x, zz - 5) && paved(x, zz + 5) && paved(x - 30, zz) && paved(x + 30, zz)) line(x, zz - 5, x, zz + 5, white, 0.25);
      for (const [a, b] of ISLANDS) flat(new THREE.CylinderGeometry(6, 6, 0.4, 16), toon('#6a9a48'), a, Y + 0.2, b); }
    // parking stalls along the east blacktop's edge
    { const [x0, z0, x1] = ZONES[4][1]; for (let x = x0 + 10; x < x1 - 6; x += 5.5) line(x, z0 + 2, x, z0 + 12, white, 0.25); }
    // the amphitheatre: a half ring of seat steps
    { const [cx, cz] = AMPHI; for (let k = 0; k < 3; k++) { const r = 8 + k * 3, ring = mesh(new THREE.CylinderGeometry(r, r, 0.5 + k * 0.4, 24, 1, true, Math.PI * 0.5, Math.PI), conc, cx, Y + 0.25 + k * 0.2, cz); ring.material = new THREE.MeshLambertMaterial({ color: '#c8c2b4', side: THREE.DoubleSide }); } }
    // the roads: a yellow centre line on Carmel Mountain Road, crosswalks on the front road
    { const yl = new THREE.MeshLambertMaterial({ color: '#f0c040' }); for (let x = -620; x < 790; x += 12) line(x - 3, -518, x + 3, -518, yl, 0.35, groundH(x, -518) + 0.05);
      for (const [cx, cy] of [[260, 704], [278, 734]]) { const [x, z] = px(cx, cy); for (let k = -3; k <= 3; k++) line(x + k * 1.6, z - 4, x + k * 1.6 + 1.2, z + 4, yl, 0.8, groundH(x, z) + 0.05); } }
  }

  // ---------------------------------------------------------------- particles and rain
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const parts = [];
  function burst(p, { n = 12, color = '#ffffff', speed = 4, life = 0.7, size = 0.4, up = 2, add = true, grav = 6 } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.position.set(p.x, p.y, p.z); s.scale.setScalar(size); scene.add(s);
      const a = Math.random() * 6.28, b = Math.random() * 2 - 1;
      parts.push({ s, vx: Math.cos(a) * speed * Math.sqrt(1 - b * b), vy: up + b * speed * 0.6, vz: Math.sin(a) * speed * Math.sqrt(1 - b * b), life, max: life, size, grav });
    }
  }
  const rainGeo = new THREE.BufferGeometry(), RN = 1600, rainPos = new Float32Array(RN * 6); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c8d8f0', transparent: true, opacity: 0.45 })); rain.frustumCulled = false; scene.add(rain); rain.visible = false;
  for (let i = 0; i < RN; i++) { rainPos[i * 6] = (Math.random() - 0.5) * 60; rainPos[i * 6 + 1] = Math.random() * 30; rainPos[i * 6 + 2] = (Math.random() - 0.5) * 60; }

  const FN = 70, ffPos = new Float32Array(FN * 3), ffSeed = [];
  for (let i = 0; i < FN; i++) ffSeed.push([Math.random() * 40 - 20, Math.random() * 3 + 0.4, Math.random() * 40 - 20, Math.random() * 6.28]);
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({ map: dotTex, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#c8ff7a' });
  const fireflies = new THREE.Points(ffGeo, ffMat); fireflies.frustumCulled = false; world.add(fireflies);
  // ---------------------------------------------------------------- time of day and weather
  const K = [ // hour: sky top, horizon, sun colour, sun power, ambient
    [0, '#060a1e', '#1a2440', '#8aa0ff', 0.25, 0.35], [4.5, '#0a1028', '#2a3050', '#8aa0ff', 0.2, 0.35], [6, '#3a5aa8', '#f0a878', '#ffb070', 1.4, 0.7],
    [8, '#4a8ae8', '#cfe6f8', '#fff4e0', 2.6, 1.1], [16, '#4a8ae8', '#cfe6f8', '#fff4e0', 2.6, 1.1], [18.2, '#3a4a98', '#f08a5a', '#ff9a5a', 1.4, 0.75],
    [19.6, '#0c1430', '#2a2a50', '#8aa0ff', 0.25, 0.38], [24, '#060a1e', '#1a2440', '#8aa0ff', 0.25, 0.35],
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  let night = 0;
  function setTime(hour, rainy, pos) {
    let i = 0; while (i < K.length - 2 && hour > K[i + 1][0]) i++;
    const [h0, t0, z0, s0, p0, a0] = K[i], [h1, t1, z1, s1, p1, a1] = K[i + 1], f = Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
    skyU.top.value.copy(ca.set(t0).lerp(cb.set(t1), f)); skyU.hor.value.copy(ca.set(z0).lerp(cb.set(z1), f)); skyU.sunCol.value.copy(ca.set(s0).lerp(cb.set(s1), f));
    const ang = ((hour - 6) / 12) * Math.PI, sd = new THREE.Vector3(Math.cos(ang) * 0.8, Math.sin(ang), 0.35).normalize();
    night = Math.max(0, Math.min(1, -sd.y * 4 + 0.2)); skyU.night.value = night;
    const lightDir = sd.y > 0 ? sd : sd.clone().negate();             // the moon lights the night
    skyU.sunDir.value.copy(sd);
    sun.intensity = (p0 + (p1 - p0) * f) * (rainy ? 0.45 : 1); sun.color.copy(skyU.sunCol.value);
    hemi.intensity = (a0 + (a1 - a0) * f) * (rainy ? 0.8 : 1);
    if (rainy) { skyU.top.value.lerp(ca.set('#5a6070'), 0.7); skyU.hor.value.lerp(ca.set('#8a90a0'), 0.7); }
    scene.fog.color.copy(skyU.hor.value); scene.fog.near = rainy ? 60 : 160; scene.fog.far = rainy ? 520 : 1100;
    sun.position.set(pos.x + lightDir.x * 120, pos.y + lightDir.y * 120, pos.z + lightDir.z * 120); sun.target.position.copy(pos); sun.target.updateMatrixWorld();
    rain.visible = rainy && !inside.visible;
  }

  // ---------------------------------------------------------------- the map picture
  let mapCanvas = null;
  function mapPicture() {
    if (mapCanvas) return mapCanvas;
    const c = document.createElement('canvas'); c.width = c.height = N1; const g = c.getContext('2d'), img = g.createImageData(N1, N1);
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const x = -W.half + i * W.cell, z = -W.half + j * W.cell, h = HGRID[j * N1 + i], n = normalAt(x, z), sl = Math.acos(Math.min(1, n[1])) * 57.3;
      let cc = h < 0 ? [0.25, 0.5, 0.75 - Math.min(0.3, -h / 100)] : colorAt(x, z, h, sl);
      const shade = 0.75 + (n[0] * -0.5 + n[2] * -0.5 + n[1]) * 0.3, k = (j * N1 + i) * 4;
      img.data[k] = Math.min(255, cc[0] * shade * 255); img.data[k + 1] = Math.min(255, cc[1] * shade * 255); img.data[k + 2] = Math.min(255, cc[2] * shade * 255); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0); mapCanvas = c; return c;
  }

  // ---------------------------------------------------------------- each frame
  let t = 0, quality = 1;
  function frame(dt, focus) {
    t += dt; grassU.uTime.value = t; windU.uTime.value = t; waterU.uTime.value = t;
    ffMat.color.set(night > 0.4 ? '#c8ff7a' : '#fff6d0'); ffMat.opacity = night > 0.4 ? 0.9 : 0.35; ffMat.size = night > 0.4 ? 0.35 : 0.12;
    for (let i = 0; i < FN; i++) { const [x, y, z, ph] = ffSeed[i]; ffPos[i * 3] = focus.x + x + Math.sin(t * 0.4 + ph) * 2; ffPos[i * 3 + 1] = groundH(focus.x + x, focus.z + z) + y + Math.sin(t * 0.9 + ph) * 0.5; ffPos[i * 3 + 2] = focus.z + z + Math.cos(t * 0.3 + ph) * 2; } ffGeo.attributes.position.needsUpdate = true; sky.position.copy(camera.position);      // the sky dome travels with you, so it is never cut off grassU.uPlayer.value.set(focus.x, focus.y, focus.z);
    waterTex.offset.set(t * 0.004, t * 0.003);
    for (const f of places.fires) f.scale.setScalar(1.5 + Math.sin(t * 13 + f.position.x) * 0.15);
    for (const s of places.gloom || []) s.position.y += Math.sin(t * 0.8 + s.userData.a * 3) * 0.02;
    clouds.position.x = (t * 2) % 600;
    // hide far chunks
    for (const c of chunks.values()) { const [cx, cz] = c.userData.c; c.visible = Math.hypot(cx - camera.position.x, cz - camera.position.z) < 900; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; } p.vy -= p.grav * dt; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; p.s.material.opacity = p.life / p.max; }
    if (rain.visible) { for (let i = 0; i < RN; i++) { let y = rainPos[i * 6 + 1] - dt * 26; if (y < 0) y += 30; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y + 0.7; rainPos[i * 6 + 3] = rainPos[i * 6]; rainPos[i * 6 + 5] = rainPos[i * 6 + 2]; } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, camera.position.y - 12, camera.position.z); }
    composer.render(dt);
  }
  function resize(w, h, dpr) { const pr = Math.min(dpr, 2) * quality; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); grade.uniforms.uVig.value = 0.38; composer.setSize(w, h); pixel.uniforms.uRes.value.set(w * pr, h * pr); pixel.uniforms.uPix.value = Math.max(3, Math.round(3 * pr)); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function setInside(on) { world.visible = !on; inside.visible = on; sky.visible = !on; scene.fog.near = on ? 30 : 160; scene.fog.far = on ? 140 : 1100; if (on) { scene.fog.color.set('#0a0e16'); scene.background = new THREE.Color('#0a0e16'); } else scene.background = null; }
  return { renderer, scene, camera, world, inside, places, frame, resize, setTime, updateGrass, burst, glowSprite, fireTex, mapPicture, setInside, mesh, dotTex,
    setQuality(qv) { quality = qv; sun.shadow.mapSize.set(qv < 1 ? 1024 : 2048, qv < 1 ? 1024 : 2048); }, get night() { return night; } };
}
