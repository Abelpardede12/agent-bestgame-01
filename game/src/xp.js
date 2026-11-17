// XP gems, the level curve, and the level-up upgrade choices.
// Level-ups pause the game and offer 3 cards; pick with click/tap or keys 1/2/3.

// XP needed to go from `level` to `level + 1`.
export function xpForLevel(level) {
  return 5 + (level - 1) * 4 + Math.floor((level - 1) * (level - 1) * 0.6);
}

// Gems drift toward the Warden when close (magnet), and are collected on touch.
export function updateGems(state, dt, sfx) {
  const p = state.player;
  for (let i = state.gems.length - 1; i >= 0; i -= 1) {
    const g = state.gems[i];
    g.bob += dt * 4;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.magnet) {
      const pull = 520 * (1 - dist / (p.magnet + 40));
      g.x += (dx / (dist || 1)) * pull * dt;
      g.y += (dy / (dist || 1)) * pull * dt;
    }
    if (dist < p.r + 12) {
      state.gems.splice(i, 1);
      gainXp(state, g.value, sfx);
    }
  }
}

function gainXp(state, amount, sfx) {
  state.xp += amount;
  sfx('gem');
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = xpForLevel(state.level);
    state.pendingLevels += 1;
  }
  if (state.pendingLevels > 0 && state.screen === 'play') {
    state.pendingLevels -= 1;
    state.choices = rollChoices(state);
    state.screen = 'levelup';
    sfx('level');
  }
}

export const UPGRADE_POOL = [
  { id: 'damage', title: 'HEAVY BOLTS', desc: '+25% damage on all weapons', icon: '▲' },
  { id: 'speed', title: 'SWIFT BOOTS', desc: '+15% move speed', icon: '»' },
  { id: 'rate', title: 'RAPID TRIGGER', desc: 'Weapons fire 20% faster', icon: '✦' },
  { id: 'blades', title: 'ORBIT BLADES', desc: 'New weapon: blades circle you', icon: '◎' },
  { id: 'nova', title: 'NOVA PULSE', desc: 'New weapon: radial spark burst', icon: '✺' },
  { id: 'multishot', title: 'SPLIT BOLT', desc: '+1 bolt per volley', icon: '⁂' },
  { id: 'vitality', title: 'WARDEN’S VIGOR', desc: '+25 max HP and heal 25', icon: '♥' },
  { id: 'magnet', title: 'GEM LURE', desc: '+45% gem pickup range', icon: '◉' },
];

// Three distinct upgrades the Warden does not already max out.
export function rollChoices(state) {
  const rng = state.rng;
  const available = UPGRADE_POOL.filter((u) => {
    if (u.id === 'blades') return !state.weapons.blades.owned;
    if (u.id === 'nova') return !state.weapons.nova.owned;
    if (u.id === 'multishot') return state.weapons.bolt.count < 4;
    return true;
  });
  const picks = [];
  const pool = available.slice();
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

export function applyChoice(state, choice) {
  const p = state.player;
  const w = state.weapons;
  if (choice.id === 'damage') state.damageMul += 0.25;
  else if (choice.id === 'speed') p.speed *= 1.15;
  else if (choice.id === 'rate') {
    w.bolt.rate *= 0.8;
    w.nova.rate *= 0.8;
    w.blades.spin *= 1.2;
  } else if (choice.id === 'blades') {
    w.blades.owned = true;
    w.blades.level = 1;
  } else if (choice.id === 'nova') {
    w.nova.owned = true;
    w.nova.level = 1;
  } else if (choice.id === 'multishot') w.bolt.count += 1;
  else if (choice.id === 'vitality') {
    p.maxHp += 25;
    p.hp = Math.min(p.maxHp, p.hp + 25);
  } else if (choice.id === 'magnet') p.magnet *= 1.45;
  // A second level-up queued behind this one pops straight after.
  if (state.pendingLevels > 0) {
    state.pendingLevels -= 1;
    state.choices = rollChoices(state);
    state.screen = 'levelup';
  } else {
    state.screen = 'play';
  }
}
