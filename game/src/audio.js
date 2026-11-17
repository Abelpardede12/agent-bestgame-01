// Tiny WebAudio synth: short bleeps only, no audio files. Created lazily on the
// first user gesture so browsers allow it; silent until then.
let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch (err) {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
}

// One short oscillator blip. `kind` picks the shape: shoot, gem, hit, level, over, click.
export function sfx(kind) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  let freq = 440;
  let end = 440;
  let dur = 0.07;
  let vol = 0.05;
  let type = 'square';
  if (kind === 'shoot') { freq = 720; end = 420; dur = 0.06; vol = 0.02; }
  else if (kind === 'gem') { freq = 880; end = 1320; dur = 0.08; vol = 0.04; type = 'sine'; }
  else if (kind === 'hit') { freq = 180; end = 90; dur = 0.12; vol = 0.07; type = 'sawtooth'; }
  else if (kind === 'level') { freq = 523; end = 1046; dur = 0.22; vol = 0.06; type = 'sine'; }
  else if (kind === 'over') { freq = 320; end = 60; dur = 0.6; vol = 0.08; type = 'sawtooth'; }
  else if (kind === 'click') { freq = 600; end = 600; dur = 0.04; vol = 0.03; }
  else if (kind === 'nova') { freq = 300; end = 900; dur = 0.18; vol = 0.05; type = 'sine'; }
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + dur);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}
