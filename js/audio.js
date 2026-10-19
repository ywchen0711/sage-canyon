// Sound, made on the fly with WebAudio: a quiet piano that plays a few notes now and then while you explore (more at
// dawn, softer at night), wind, drums and strings when enemies are after you, a low hum in shrines, and the effects.
let ac = null, master = null, musicBus = null, sfxBus = null, wind = null, muted = false, vol = 0.8;
try { muted = localStorage.getItem('sc.mute') === '1'; vol = +(localStorage.getItem('sc.vol') || 0.8); } catch (e) { /* ignore */ }
function ctx() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); master = ac.createGain(); master.gain.value = muted ? 0 : vol * 0.5; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    // a little room for the piano
    const d = ac.createDelay(1); d.delayTime.value = 0.32; const fb = ac.createGain(); fb.gain.value = 0.35; const wet = ac.createGain(); wet.gain.value = 0.25;
    musicBus.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export const unlock = () => { ctx(); };
export function setMuted(m) { muted = m; try { localStorage.setItem('sc.mute', m ? '1' : '0'); } catch (e) { /* ignore */ } if (master) master.gain.value = m ? 0 : vol * 0.5; }
export const isMuted = () => muted;
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
function note(midi, t, dur, { type = 'triangle', vol = 0.3, bus = musicBus, attack = 0.005 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain(), o2 = ac.createOscillator(), g2 = ac.createGain();
  o.type = type; o.frequency.value = freq(midi); o2.type = 'sine'; o2.frequency.value = freq(midi) * 2; g2.gain.value = 0.25;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function noise(t, dur, { vol = 0.3, f = 800, q = 1, type = 'bandpass', bus = sfxBus, decay = true } = {}) {
  const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = buf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); return { s, g, fl };
}
// ---------------------------------------------------------------- music: a mood picks how notes are chosen
const SCALE = [0, 2, 4, 7, 9];          // pentatonic
let mood = 'field', nextAt = 0, step = 0, combatT = 0;
export function setMood(m) { mood = m; }
export function combat(boss = false) { combatT = 2.5; if (boss) mood = mood === 'boss' ? mood : 'boss'; }
export function tick(dt, night) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  if (!wind) { const w = noise(t, 4, { vol: 0.04, f: 400, q: 0.6, type: 'lowpass', bus: master, decay: false }); w.s.loop = true; wind = w; }
  if (wind) wind.fl.frequency.value = 300 + Math.sin(t * 0.3) * 150;
  combatT -= dt;
  const m = combatT > 0 ? (mood === 'boss' ? 'boss' : 'battle') : mood === 'boss' ? 'field' : mood;
  if (t < nextAt) return;
  if (m === 'battle' || m === 'boss') {
    const bpm = m === 'boss' ? 150 : 132, beat = 60 / bpm; step++;
    noise(t, 0.12, { vol: step % 4 === 0 ? 0.35 : 0.15, f: step % 4 === 0 ? 120 : 2400, q: 1, type: step % 4 === 0 ? 'lowpass' : 'highpass', bus: musicBus });
    if (step % 2 === 0) note((m === 'boss' ? 38 : 45) + [0, 0, 3, 5, 0, 0, 7, 6][(step / 2) % 8], t, beat * 1.8, { type: 'sawtooth', vol: 0.06 });
    if (step % 8 === 0) note((m === 'boss' ? 62 : 69) + [0, 3, 7, 5][(step / 8) % 4], t, beat * 7, { type: 'triangle', vol: 0.08, attack: 0.2 });
    nextAt = t + beat / 2;
  } else if (m === 'shrine') {
    note(50 + SCALE[Math.floor(Math.random() * 5)] + 12 * Math.floor(Math.random() * 2), t, 5, { type: 'sine', vol: 0.12, attack: 1.2 }); nextAt = t + 2.5 + Math.random() * 2;
  } else if (m === 'village') {
    const base = 60, ph = step++ % 16, mel = [0, 4, 7, 9, 7, 4, 2, 4, 0, 4, 7, 12, 9, 7, 4, 2];
    note(base + mel[ph], t, 0.6, { vol: 0.18 }); if (ph % 4 === 0) note(base - 12 + [0, 5, 7, 5][(ph / 4) % 4], t, 1.4, { type: 'sine', vol: 0.14 }); nextAt = t + 0.38;
  } else {
    // the open world: a phrase of a few soft piano notes, then a long rest (shorter by day)
    if (!tick.phrase || tick.phrase.length === 0) {
      if (Math.random() < 0.55) { nextAt = t + (night ? 6 : 3) + Math.random() * 5; tick.phrase = []; return; }
      const root = 60 + [0, 2, 5, 7][Math.floor(Math.random() * 4)] - (night ? 12 : 0); let k = Math.floor(Math.random() * 5);
      tick.phrase = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => { k = Math.max(0, Math.min(9, k + Math.floor(Math.random() * 5) - 2)); return root + SCALE[k % 5] + 12 * Math.floor(k / 5); });
    }
    const n = tick.phrase.shift(); note(n, t, 2.2, { vol: night ? 0.1 : 0.16 }); if (Math.random() < 0.3) note(n - 12, t, 2.6, { type: 'sine', vol: 0.08 });
    nextAt = t + 0.3 + Math.random() * 0.35;
  }
}
// ---------------------------------------------------------------- effects
export function sfx(k) {
  if (!ctx() || muted) return; const t = ac.currentTime, S = { bus: sfxBus };
  switch (k) {
    case 'swing': noise(t, 0.16, { vol: 0.25, f: 1800, q: 0.8 }); break;
    case 'hit': noise(t, 0.12, { vol: 0.4, f: 600, q: 1.5 }); note(45, t, 0.12, { type: 'square', vol: 0.12, ...S }); break;
    case 'break': for (let i = 0; i < 4; i++) noise(t + i * 0.04, 0.2, { vol: 0.3, f: 3000 - i * 400, q: 3 }); break;
    case 'shoot': noise(t, 0.12, { vol: 0.25, f: 2500, q: 2 }); note(84, t, 0.08, { type: 'sine', vol: 0.12, ...S }); break;
    case 'boom': noise(t, 1.0, { vol: 0.8, f: 180, q: 0.7, type: 'lowpass' }); break;
    case 'laser': noise(t, 0.4, { vol: 0.35, f: 1200, q: 4 }); note(80, t, 0.3, { type: 'sawtooth', vol: 0.12, ...S }); break;
    case 'lockon': note(88, t, 0.12, { type: 'square', vol: 0.06, ...S }); note(92, t + 0.15, 0.12, { type: 'square', vol: 0.06, ...S }); break;
    case 'alert': note(79, t, 0.1, { type: 'square', vol: 0.1, ...S }); note(84, t + 0.1, 0.18, { type: 'square', vol: 0.1, ...S }); break;
    case 'hurt': noise(t, 0.2, { vol: 0.4, f: 400, q: 1 }); note(52, t, 0.2, { type: 'square', vol: 0.15, ...S }); break;
    case 'block': noise(t, 0.12, { vol: 0.4, f: 2200, q: 6 }); break;
    case 'parry': [84, 91, 96].forEach((n, i) => note(n, t + i * 0.05, 0.3, { type: 'sine', vol: 0.18, ...S })); break;
    case 'pick': note(79, t, 0.1, { vol: 0.2, ...S }); note(86, t + 0.07, 0.16, { vol: 0.2, ...S }); break;
    case 'jingle': [72, 76, 79, 84].forEach((n, i) => note(n, t + i * 0.1, 0.5, { vol: 0.2, ...S })); break;
    case 'orb': [67, 72, 76, 79, 84, 88].forEach((n, i) => note(n, t + i * 0.14, 1.2, { type: 'sine', vol: 0.18, ...S })); break;
    case 'tower': [48, 55, 60, 64, 67, 72].forEach((n, i) => note(n, t + i * 0.25, 2.5, { type: 'triangle', vol: 0.16, attack: 0.1, ...S })); break;
    case 'glide': noise(t, 0.3, { vol: 0.2, f: 600, q: 0.5 }); break;
    case 'splash': noise(t, 0.5, { vol: 0.35, f: 900, q: 0.5, type: 'lowpass' }); break;
    case 'rune': note(76, t, 0.15, { type: 'sine', vol: 0.15, ...S }); note(83, t + 0.08, 0.25, { type: 'sine', vol: 0.15, ...S }); break;
    case 'magnet': note(55, t, 0.6, { type: 'sawtooth', vol: 0.05, ...S }); break;
    case 'ice': noise(t, 0.4, { vol: 0.3, f: 4000, q: 2 }); note(91, t, 0.3, { type: 'sine', vol: 0.12, ...S }); break;
    case 'stasis': note(71, t, 0.5, { type: 'square', vol: 0.06, ...S }); note(66, t + 0.1, 0.6, { type: 'square', vol: 0.06, ...S }); break;
    case 'cook': [60, 64, 67, 72, 76].forEach((n, i) => note(n, t + i * 0.12, 0.4, { vol: 0.16, ...S })); break;
    case 'step': noise(t, 0.06, { vol: 0.05, f: 900, q: 1 }); break;
    case 'heart': [72, 76, 79, 84, 88, 91].forEach((n, i) => note(n, t + i * 0.12, 1, { type: 'sine', vol: 0.2, ...S })); break;
    case 'orbs': [64, 67, 71, 76].forEach((n, i) => note(n, t + i * 0.1, 0.6, { type: 'sine', vol: 0.16, ...S })); break;
    default: break;
  }
}
