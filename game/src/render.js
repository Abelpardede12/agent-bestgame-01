// All drawing: arena, entities, HUD, menus, and the touch joystick.
// The world is always 1280x720 logical units; this module scales it to the window.
import { ARENA } from './config.js';
import { ENEMY_TYPES } from './enemies.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

// Current letterbox transform: logical -> CSS pixels.
const view = { scale: 1, ox: 0, oy: 0, cssW: 1280, cssH: 720, dpr: 1 };

export function getView() {
  return view;
}

export function resize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const scale = Math.min(cssW / ARENA.w, cssH / ARENA.h);
  view.scale = scale;
  view.ox = (cssW - ARENA.w * scale) / 2;
  view.oy = (cssH - ARENA.h * scale) / 2;
  view.cssW = cssW;
  view.cssH = cssH;
  view.dpr = dpr;
}

// CSS pixel position -> logical world position.
export function toWorld(x, y) {
  return { x: (x - view.ox) / view.scale, y: (y - view.oy) / view.scale };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function menuButtonRect() {
  return { x: ARENA.w / 2 - 130, y: 500, w: 260, h: 64 };
}

export function restartButtonRect() {
  return { x: ARENA.w / 2 - 130, y: 512, w: 260, h: 64 };
}

export function levelCardRects() {
  const w = 300;
  const h = 190;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (ARENA.w - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: 265, w, h }));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function drawArena(ctx, state) {
  ctx.fillStyle = '#0e1226';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  // Faint grid so motion reads at a glance.
  ctx.strokeStyle = 'rgba(120, 140, 220, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= ARENA.w; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); }
  for (let y = 0; y <= ARENA.h; y += 64) { ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); }
  ctx.stroke();
  // Arena edge: a glowing ward-line the swarm crosses.
  ctx.strokeStyle = '#3d5a80';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, ARENA.w - 8, ARENA.h - 8);
  // Soft radial light in the middle where the Warden stands.
  const g = ctx.createRadialGradient(640, 360, 60, 640, 360, 560);
  g.addColorStop(0, 'rgba(80, 200, 220, 0.06)');
  g.addColorStop(1, 'rgba(80, 200, 220, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
}

function drawGems(ctx, state) {
  for (const g of state.gems) {
    const bob = Math.sin(g.bob) * 2;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-3, -3, 5, 5);
    ctx.restore();
  }
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    const def = ENEMY_TYPES[e.type];
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    ctx.fillStyle = flash ? '#ffffff' : def.color;
    if (e.type === 'brute') {
      // Big spiked brute.
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI * 2) / 8 + e.wobble * 0.2;
        const r = i % 2 === 0 ? e.r + 8 : e.r;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : def.dark;
      ctx.beginPath();
      ctx.arc(0, 0, e.r - 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'skitterer') {
      // Small quick skitterer with jittery legs.
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r * 0.7, Math.sin(a) * e.r * 0.7);
        ctx.lineTo(Math.cos(a) * (e.r + 7), Math.sin(a) * (e.r + 7));
        ctx.stroke();
      }
    } else {
      // Shambler: shambling blob.
      ctx.beginPath();
      ctx.arc(0, -2, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-e.r * 0.5, e.r * 0.55, e.r * 0.45, 0, Math.PI * 2);
      ctx.arc(e.r * 0.5, e.r * 0.55, e.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // Eyes, always facing the Warden.
    const p = state.player;
    const ea = Math.atan2(p.y - e.y, p.x - e.x);
    ctx.fillStyle = '#10131f';
    for (const side of [-1, 1]) {
      const ex = Math.cos(ea) * 4 + Math.cos(ea + Math.PI / 2) * side * 5;
      const ey = Math.sin(ea) * 4 + Math.sin(ea + Math.PI / 2) * side * 5;
      ctx.beginPath();
      ctx.arc(ex, ey, e.type === 'brute' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Health bar for hurt enemies.
    if (e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-w / 2, -e.r - 10, w, 5);
      ctx.fillStyle = '#ff5964';
      ctx.fillRect(-w / 2, -e.r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, state, time) {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.20)');
  glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fill();
  // Cloak.
  ctx.fillStyle = '#2ec4b6';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a7a70';
  ctx.beginPath();
  ctx.moveTo(-p.r, 6);
  ctx.quadraticCurveTo(0, p.r + 10, p.r, 6);
  ctx.closePath();
  ctx.fill();
  // Hood and face.
  ctx.fillStyle = '#0f5257';
  ctx.beginPath();
  ctx.arc(0, -4, p.r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8a3';
  ctx.beginPath();
  ctx.arc(-4, -5, 2.4, 0, Math.PI * 2);
  ctx.arc(4, -5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick: shows which way the Warden is moving.
  const face = Math.atan2(state.faceY || 0, state.faceX || 1);
  ctx.strokeStyle = '#ffe8a3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(face) * (p.r - 2), Math.sin(face) * (p.r - 2));
  ctx.lineTo(Math.cos(face) * (p.r + 8), Math.sin(face) * (p.r + 8));
  ctx.stroke();
  ctx.restore();
  // Orbit blades.
  if (state.weapons.blades.owned) {
    const b = state.weapons.blades;
    for (let i = 0; i < b.count; i += 1) {
      const a = b.angle + (i * Math.PI * 2) / b.count;
      const bx = p.x + Math.cos(a) * b.radius;
      const by = p.y + Math.sin(a) * b.radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#e0fbfc';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(5, 8);
      ctx.lineTo(-5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawProjectiles(ctx, state) {
  for (const pr of state.projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(Math.atan2(pr.vy, pr.vx));
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state) {
  // XP bar along the top.
  const xpFrac = Math.min(1, state.xp / state.xpNext);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, ARENA.w, 26);
  ctx.fillStyle = '#222a4a';
  ctx.fillRect(10, 8, ARENA.w - 20, 10);
  ctx.fillStyle = '#4cc9f0';
  ctx.fillRect(10, 8, (ARENA.w - 20) * xpFrac, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LV ' + state.level, 14, 42);
  // HP bar under the XP bar.
  const hpFrac = Math.max(0, state.player.hp / state.player.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, 10, 52, 220, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#222a4a';
  rr(ctx, 13, 55, 214, 12, 6);
  ctx.fill();
  ctx.fillStyle = hpFrac > 0.35 ? '#2ec4b6' : '#ff5964';
  if (hpFrac > 0) { rr(ctx, 13, 55, 214 * hpFrac, 12, 6); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px ' + FONT;
  ctx.fillText(Math.ceil(state.player.hp) + ' / ' + state.player.maxHp, 238, 61);
  // Time centre, kills right.
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px ' + FONT;
  ctx.fillText(fmtTime(state.time), ARENA.w / 2, 46);
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('☠ ' + state.kills + '   WAVE ' + state.wave, ARENA.w - 14, 44);
  // Weapon pips bottom-left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px ' + FONT;
  const owned = [];
  if (state.weapons.bolt.owned) owned.push('BOLT×' + state.weapons.bolt.count);
  if (state.weapons.blades.owned) owned.push('BLADES×' + state.weapons.blades.count);
  if (state.weapons.nova.owned) owned.push('NOVA');
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(owned.join('  ·  '), 14, ARENA.h - 14);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'right';
  ctx.fillText(state.muted ? 'M: SOUND OFF' : 'M: SOUND ON', ARENA.w - 14, ARENA.h - 14);
}

function drawMenu(ctx, state) {
  ctx.fillStyle = 'rgba(8, 10, 24, 0.72)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 84px ' + FONT;
  ctx.fillText('SWARMHOLD', ARENA.w / 2, 190);
  ctx.fillStyle = '#e0fbfc';
  ctx.font = 'bold 26px ' + FONT;
  ctx.fillText('Hold the arena. Outlast the swarm.', ARENA.w / 2, 240);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '18px ' + FONT;
  ctx.fillText('Move: WASD / arrows, or drag on the left half of the screen', ARENA.w / 2, 300);
  ctx.fillText('Weapons fire on their own — grab XP gems, level up, pick upgrades', ARENA.w / 2, 330);
  ctx.fillText('Survive as long as you can. Score = seconds alive + 10 per kill.', ARENA.w / 2, 360);
  const btn = menuButtonRect();
  ctx.fillStyle = '#2ec4b6';
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  ctx.fillStyle = '#062a28';
  ctx.font = 'bold 30px ' + FONT;
  ctx.textBaseline = 'middle';
  ctx.fillText('▶  START', ARENA.w / 2, btn.y + btn.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  if (state.best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('BEST SCORE: ' + state.best, ARENA.w / 2, 620);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '15px ' + FONT;
  ctx.fillText('Enter or click START to play  ·  M mutes sound', ARENA.w / 2, 660);
}

function drawLevelUp(ctx, state) {
  ctx.fillStyle = 'rgba(8, 10, 24, 0.66)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('LEVEL UP!', ARENA.w / 2, 190);
  ctx.fillStyle = '#e0fbfc';
  ctx.font = '20px ' + FONT;
  ctx.fillText('The Warden grows stronger — choose one:', ARENA.w / 2, 228);
  const rects = levelCardRects();
  state.choices.forEach((choice, i) => {
    const r = rects[i];
    ctx.fillStyle = '#1b2140';
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 3;
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillText(choice.icon, r.x + r.w / 2, r.y + 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(choice.title, r.x + r.w / 2, r.y + 98);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '16px ' + FONT;
    ctx.fillText(choice.desc, r.x + r.w / 2, r.y + 128);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('Press ' + (i + 1) + ' or click', r.x + r.w / 2, r.y + 162);
  });
}

function drawOver(ctx, state) {
  ctx.fillStyle = 'rgba(10, 4, 10, 0.78)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5964';
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('THE SWARM PREVAILS', ARENA.w / 2, 170);
  ctx.fillStyle = '#e0fbfc';
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText('SCORE  ' + state.score, ARENA.w / 2, 250);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '22px ' + FONT;
  ctx.fillText('Survived ' + fmtTime(state.time) + '   ·   ' + state.kills + ' kills   ·   Level ' + state.level, ARENA.w / 2, 300);
  ctx.fillText('Wave reached: ' + state.wave, ARENA.w / 2, 336);
  if (state.score >= state.best && state.score > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText('★ NEW BEST SCORE ★', ARENA.w / 2, 390);
  } else {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('Best score: ' + state.best, ARENA.w / 2, 390);
  }
  const btn = restartButtonRect();
  ctx.fillStyle = '#2ec4b6';
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  ctx.fillStyle = '#062a28';
  ctx.font = 'bold 28px ' + FONT;
  ctx.textBaseline = 'middle';
  ctx.fillText('↻  PLAY AGAIN', ARENA.w / 2, btn.y + btn.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '15px ' + FONT;
  ctx.fillText('Press R or click PLAY AGAIN to restart instantly', ARENA.w / 2, 630);
}

function drawJoystick(ctx, input) {
  if (!input.joy.active) return;
  const base = toWorld(input.joy.baseX, input.joy.baseY);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#e0fbfc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(base.x, base.y, 56 / view.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#2ec4b6';
  ctx.beginPath();
  ctx.arc(base.x + input.joy.dx * (40 / view.scale), base.y + input.joy.dy * (40 / view.scale), 24 / view.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function render(canvas, state, input) {
  const ctx = canvas.getContext('2d');
  const dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Letterbox background outside the arena.
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, view.cssW, view.cssH);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  // Screen shake while the Warden is being hit.
  if (state.shake > 0.2) {
    ctx.translate(state.rng.range(-state.shake, state.shake), state.rng.range(-state.shake, state.shake));
  }
  drawArena(ctx, state);
  drawGems(ctx, state);
  drawEnemies(ctx, state);
  if (state.screen !== 'menu') drawPlayer(ctx, state, state.time);
  drawProjectiles(ctx, state);
  drawParticles(ctx, state);
  if (state.screen === 'play' || state.screen === 'levelup') drawHud(ctx, state);
  if (state.screen === 'menu') drawMenu(ctx, state);
  else if (state.screen === 'levelup') drawLevelUp(ctx, state);
  else if (state.screen === 'over') drawOver(ctx, state);
  // Red flash when hurt.
  if (state.flashRed > 0) {
    ctx.fillStyle = 'rgba(255, 40, 60, ' + (state.flashRed * 1.4).toFixed(3) + ')';
    ctx.fillRect(-20, -20, ARENA.w + 40, ARENA.h + 40);
  }
  if (state.screen === 'play') drawJoystick(ctx, input);
}
