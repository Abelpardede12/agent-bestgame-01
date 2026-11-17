// Auto-fire weapons. The Warden never aims: bolts seek the nearest shambler,
// blades orbit the Warden, and the nova bursts outward. Upgrades tune them.
import { ARENA } from './config.js';
export function makeWeapons() {
  return {
    bolt: { owned: true, level: 1, cooldown: 0, rate: 0.72, damage: 14, count: 1, speed: 560 },
    blades: { owned: false, level: 0, damage: 10, count: 2, radius: 78, angle: 0, spin: 3.4 },
    nova: { owned: false, level: 0, cooldown: 0, rate: 2.6, damage: 22, count: 10 },
  };
}

function nearestEnemy(state, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

export function updateWeapons(state, dt, sfx) {
  const w = state.weapons;
  const p = state.player;
  const dmgMul = state.damageMul;

  // Bolt: fires at the nearest enemy.
  if (w.bolt.owned) {
    w.bolt.cooldown -= dt;
    if (w.bolt.cooldown <= 0) {
      const target = nearestEnemy(state, p.x, p.y);
      if (target) {
        w.bolt.cooldown = w.bolt.rate;
        const spread = 0.16;
        for (let i = 0; i < w.bolt.count; i += 1) {
          const base = Math.atan2(target.y - p.y, target.x - p.x);
          const off = (i - (w.bolt.count - 1) / 2) * spread;
          const a = base + off;
          state.projectiles.push({
            x: p.x, y: p.y,
            vx: Math.cos(a) * w.bolt.speed, vy: Math.sin(a) * w.bolt.speed,
            damage: w.bolt.damage * dmgMul, r: 6, life: 1.1, pierce: 0,
          });
        }
        sfx('shoot');
      } else {
        w.bolt.cooldown = 0.12;
      }
    }
  }

  // Orbiting blades: spin around the Warden and shred anything they touch.
  if (w.blades.owned) {
    w.blades.angle += w.blades.spin * dt;
    for (let i = 0; i < w.blades.count; i += 1) {
      const a = w.blades.angle + (i * Math.PI * 2) / w.blades.count;
      const bx = p.x + Math.cos(a) * w.blades.radius;
      const by = p.y + Math.sin(a) * w.blades.radius;
      for (const e of state.enemies) {
        if (e.bladeCd === undefined) e.bladeCd = 0;
        if (e.bladeCd > 0) continue;
        if (Math.hypot(e.x - bx, e.y - by) < e.r + 12) {
          e.hp -= w.blades.damage * dmgMul;
          e.flash = 0.12;
          e.bladeCd = 0.35;
        }
      }
    }
    for (const e of state.enemies) e.bladeCd = Math.max(0, (e.bladeCd || 0) - dt);
  }

  // Nova: a ring of sparks bursts outward on a timer.
  if (w.nova.owned) {
    w.nova.cooldown -= dt;
    if (w.nova.cooldown <= 0) {
      w.nova.cooldown = w.nova.rate;
      for (let i = 0; i < w.nova.count; i += 1) {
        const a = (i * Math.PI * 2) / w.nova.count + state.rng.next() * 0.2;
        state.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
          damage: w.nova.damage * dmgMul, r: 5, life: 0.7, pierce: 1,
        });
      }
      sfx('nova');
    }
  }
}

export function updateProjectiles(state, dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const pr = state.projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    let dead = pr.life <= 0 || pr.x < -20 || pr.x > ARENA.w + 20 || pr.y < -20 || pr.y > ARENA.h + 20;
    for (let j = state.enemies.length - 1; j >= 0 && !dead; j -= 1) {
      const e = state.enemies[j];
      if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
        e.hp -= pr.damage;
        e.flash = 0.12;
        // Knock the enemy back a touch so hits feel physical.
        const d = Math.hypot(e.x - pr.x, e.y - pr.y) || 1;
        e.x += ((e.x - pr.x) / d) * 6;
        e.y += ((e.y - pr.y) / d) * 6;
        if (pr.pierce > 0) pr.pierce -= 1;
        else dead = true;
      }
    }
    if (dead) state.projectiles.splice(i, 1);
  }
}
