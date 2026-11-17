// Enemy types, wave scaling, spawn logic and chase AI.
// The arena is a fixed 1280x720 world; enemies walk in from outside its edges.
import { ARENA } from './config.js';

export const ENEMY_TYPES = {
  shambler: { hp: 18, speed: 62, radius: 15, damage: 8, xp: 1, color: '#7ee081', dark: '#3f7d44', score: 1 },
  skitterer: { hp: 10, speed: 132, radius: 11, damage: 5, xp: 1, color: '#ffd166', dark: '#a97b12', score: 1 },
  brute: { hp: 90, speed: 44, radius: 26, damage: 18, xp: 4, color: '#ef476f', dark: '#8f1d3a', score: 3 },
};

function pickType(rng, elapsed) {
  const roll = rng.next();
  const bruteChance = elapsed > 90 ? 0.14 : elapsed > 45 ? 0.07 : 0.0;
  const skitChance = elapsed > 20 ? 0.34 : 0.18;
  if (roll < bruteChance) return 'brute';
  if (roll < bruteChance + skitChance) return 'skitterer';
  return 'shambler';
}

export function spawnEnemy(state) {
  const rng = state.rng;
  const type = pickType(rng, state.time);
  const def = ENEMY_TYPES[type];
  const side = Math.floor(rng.next() * 4);
  const margin = 40;
  let x;
  let y;
  if (side === 0) { x = rng.range(0, ARENA.w); y = -margin; }
  else if (side === 1) { x = ARENA.w + margin; y = rng.range(0, ARENA.h); }
  else if (side === 2) { x = rng.range(0, ARENA.w); y = ARENA.h + margin; }
  else { x = -margin; y = rng.range(0, ARENA.h); }
  // Health and speed creep with time so the swarm keeps getting scarier.
  const hpScale = 1 + state.time / 75;
  const speedScale = 1 + Math.min(0.5, state.time / 240);
  state.enemies.push({
    type,
    x,
    y,
    r: def.radius,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed * speedScale * rng.range(0.9, 1.1),
    damage: def.damage,
    xp: def.xp,
    touchCd: 0,
    wobble: rng.range(0, Math.PI * 2),
    flash: 0,
  });
}

// How often a new enemy walks in. Starts gentle, ramps to a flood.
export function spawnInterval(state) {
  return Math.max(0.28, 1.15 - state.time * 0.008);
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.touchCd = Math.max(0, e.touchCd - dt);
    // Chase the Warden, with a little wobble so the swarm feels alive.
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.wobble += dt * 3;
    const wob = Math.sin(e.wobble) * 0.35;
    const nx = dx / dist;
    const ny = dy / dist;
    const mx = nx - ny * wob;
    const my = ny + nx * wob;
    const mlen = Math.hypot(mx, my) || 1;
    e.x += (mx / mlen) * e.speed * dt;
    e.y += (my / mlen) * e.speed * dt;
    // Touching the Warden hurts, at most once per second per enemy.
    if (dist < e.r + p.r + 2 && e.touchCd <= 0) {
      e.touchCd = 1.0;
      hurtPlayer(state, e.damage);
      state.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, r: 26, color: '#ff5964' });
    }
    if (e.hp <= 0) {
      killEnemy(state, i);
    }
  }
}

export function hurtPlayer(state, amount) {
  if (state.screen !== 'play') return;
  state.player.hp -= amount;
  state.shake = Math.max(state.shake, 6);
  state.flashRed = 0.18;
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.screen = 'over';
    state.score = Math.floor(state.time) + state.kills * 10;
    state.best = Math.max(state.best, state.score);
  }
}

function killEnemy(state, index) {
  const e = state.enemies[index];
  state.enemies.splice(index, 1);
  state.kills += 1;
  // Burst of particles, then XP gems scatter on the ground.
  for (let i = 0; i < 8; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const sp = state.rng.range(40, 160);
    state.particles.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.35, max: 0.35, r: state.rng.range(2, 5), color: ENEMY_TYPES[e.type].color,
    });
  }
  for (let i = 0; i < e.xp; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const d = state.rng.range(6, 26);
    state.gems.push({
      x: Math.max(12, Math.min(ARENA.w - 12, e.x + Math.cos(a) * d)),
      y: Math.max(12, Math.min(ARENA.h - 12, e.y + Math.sin(a) * d)),
      value: 1,
      bob: state.rng.range(0, Math.PI * 2),
    });
  }
}
