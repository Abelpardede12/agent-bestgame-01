// SWARMHOLD — arena survival. State machine: menu -> play -> levelup -> over.
// Fixed timestep (60 Hz) so the game plays the same on every machine.
import { ARENA, STEP } from './config.js';
import { createRng } from './rng.js';
import { createInput } from './input.js';
import { spawnEnemy, spawnInterval, updateEnemies } from './enemies.js';
import { makeWeapons, updateWeapons, updateProjectiles } from './weapons.js';
import { xpForLevel, updateGems, applyChoice } from './xp.js';
import { render, resize, toWorld, menuButtonRect, restartButtonRect, levelCardRects } from './render.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

export function createState(seed) {
  const rng = createRng(seed);
  return {
    rng,
    time: 0,
    kills: 0,
    score: 0,
    best: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevels: 0,
    choices: [],
    damageMul: 1,
    wave: 1,
    screen: 'menu',
    player: { x: ARENA.w / 2, y: ARENA.h / 2, r: 16, hp: 100, maxHp: 100, speed: 225, magnet: 95 },
    faceX: 1,
    faceY: 0,
    enemies: [],
    projectiles: [],
    gems: [],
    particles: [],
    weapons: makeWeapons(),
    spawnTimer: 0.6,
    shake: 0,
    flashRed: 0,
    muted: false,
    frozen: false,
  };
}

function startGame(state) {
  const best = state.best;
  const fresh = createState((Math.random() * 0xffffffff) >>> 0);
  fresh.best = best;
  fresh.screen = 'play';
  fresh.muted = state.muted;
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
  setStatus('Game started. Survive the swarm!');
}

function stepWorld(state, dt, moveX, moveY, fx) {
  const p = state.player;
  // Move the Warden.
  p.x = Math.max(p.r + 4, Math.min(ARENA.w - p.r - 4, p.x + moveX * p.speed * dt));
  p.y = Math.max(p.r + 4, Math.min(ARENA.h - p.r - 4, p.y + moveY * p.speed * dt));
  if (moveX !== 0 || moveY !== 0) {
    state.faceX = moveX;
    state.faceY = moveY;
  }
  state.time += dt;
  state.wave = Math.floor(state.time / 30) + 1;
  // Escalating spawns.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy(state);
    state.spawnTimer = spawnInterval(state);
  }
  updateEnemies(state, dt);
  updateWeapons(state, dt, fx);
  updateProjectiles(state, dt);
  updateGems(state, dt, fx);
  // Particles fade and drift.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  state.shake = Math.max(0, state.shake - dt * 30);
  state.flashRed = Math.max(0, state.flashRed - dt);
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function inRect(pt, r) {
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}

function handleInput(state, input) {
  if (input.consumePressed('KeyM')) {
    state.muted = !state.muted;
    setMuted(state.muted);
  }
  const click = input.consumeClick();
  const worldClick = click ? toWorld(click.x, click.y) : null;

  if (state.screen === 'menu') {
    if (input.consumePressed('Enter') || input.consumePressed('Space')
      || (worldClick && inRect(worldClick, menuButtonRect()))) {
      unlockAudio();
      sfx('click');
      startGame(state);
    }
    return;
  }
  if (state.screen === 'levelup') {
    let picked = -1;
    if (input.consumePressed('Digit1')) picked = 0;
    else if (input.consumePressed('Digit2')) picked = 1;
    else if (input.consumePressed('Digit3')) picked = 2;
    else if (worldClick) {
      const rects = levelCardRects();
      for (let i = 0; i < rects.length; i += 1) {
        if (inRect(worldClick, rects[i])) { picked = i; break; }
      }
    }
    if (picked >= 0 && picked < state.choices.length) {
      sfx('click');
      applyChoice(state, state.choices[picked]);
      setStatus('Level ' + state.level + '. Keep surviving!');
    }
    return;
  }
  if (state.screen === 'over') {
    if (input.consumePressed('KeyR') || input.consumePressed('Enter') || input.consumePressed('Space')
      || (worldClick && inRect(worldClick, restartButtonRect()))) {
      unlockAudio();
      sfx('click');
      startGame(state);
    }
    return;
  }
  // Playing: nothing to click; movement comes from the input vector.
}

// --- Screenshot modes: deterministic staged scenes of the real game. ---
// ?shot=menu | ?shot=play | ?shot=over (seed via &seed=N, default 7).
// The world is simulated forward with a simple autopilot, then frozen, so the
// frame is exactly what a short real game looks like.

function autopilot(state) {
  const p = state.player;
  // Flee the nearest close enemy.
  let threat = null;
  let threatDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < threatDist) { threatDist = d; threat = e; }
  }
  if (threat && threatDist < 130) {
    const d = threatDist || 1;
    return { x: (p.x - threat.x) / d, y: (p.y - threat.y) / d };
  }
  // Otherwise chase the nearest gem.
  let gem = null;
  let gemDist = Infinity;
  for (const g of state.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < gemDist) { gemDist = d; gem = g; }
  }
  if (gem) {
    const d = gemDist || 1;
    return { x: (gem.x - p.x) / d, y: (gem.y - p.y) / d };
  }
  // Drift in a slow circle near the middle so the scene stays lively.
  const a = state.time * 0.7;
  return { x: Math.cos(a), y: Math.sin(a) * 0.6 };
}

function stageShot(state, name) {
  const noop = () => {};
  if (name === 'menu') {
    // A few shamblers drifting behind the title overlay.
    for (let i = 0; i < 7; i += 1) spawnEnemy(state);
    for (let t = 0; t < 4; t += STEP) {
      updateEnemies(state, STEP);
      state.time += STEP;
    }
    state.screen = 'menu';
    return;
  }
  state.screen = 'play';
  if (name === 'levelup') {
    // Simulate until the first level-up pauses the game, then freeze on the cards.
    for (let t = 0; t < 60; t += STEP) {
      stepWorld(state, STEP, autopilot(state).x, autopilot(state).y, noop);
      if (state.screen === 'levelup') break;
    }
    state.frozen = true;
    return;
  }
  const limit = name === 'over' ? 600 : 22;
  const standStill = name === 'over';
  for (let t = 0; t < limit; t += STEP) {
    const mv = standStill ? { x: 0, y: 0 } : autopilot(state);
    stepWorld(state, STEP, mv.x, mv.y, noop);
    // Auto-accept level-ups so the play shot shows a leveled-up Warden.
    while (state.screen === 'levelup' && state.choices.length > 0) {
      applyChoice(state, state.choices[0]);
    }
    if (state.screen === 'over') break;
  }
  if (name === 'play' && state.screen === 'over') {
    // The Warden died during staging: retry a shorter, safer run so the
    // play shot shows live gameplay, not a game-over screen.
    const retry = createState(seed + 101);
    retry.screen = 'play';
    for (let t = 0; t < 14; t += STEP) {
      stepWorld(retry, STEP, autopilot(retry).x, autopilot(retry).y, noop);
      while (retry.screen === 'levelup' && retry.choices.length > 0) {
        applyChoice(retry, retry.choices[0]);
      }
      if (retry.screen === 'over') break;
    }
    if (retry.screen === 'play') {
      Object.keys(retry).forEach((k) => { state[k] = retry[k]; });
      state.screen = 'play';
    }
  }
  if (name === 'over' && state.screen !== 'over') {
    // Fallback: force the end screen if the Warden somehow survived.
    state.player.hp = 0;
    state.screen = 'over';
    state.score = Math.floor(state.time) + state.kills * 10;
    state.best = Math.max(state.best, state.score);
  }
  if (name === 'play' && state.screen !== 'play') state.screen = 'play';
  if (name === 'play') {
    // Make sure a few XP gems are lying on the ground in the frame.
    while (state.gems.length < 5) {
      const a = state.rng.range(0, Math.PI * 2);
      const d = state.rng.range(60, 220);
      state.gems.push({
        x: Math.max(12, Math.min(ARENA.w - 12, state.player.x + Math.cos(a) * d)),
        y: Math.max(12, Math.min(ARENA.h - 12, state.player.y + Math.sin(a) * d)),
        value: 1,
        bob: state.rng.range(0, Math.PI * 2),
      });
    }
  }
  state.frozen = true;
}

function main() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  const state = createState(seed);
  const input = createInput(canvas);
  resize(canvas);
  window.addEventListener('resize', () => resize(canvas));

  if (shot) stageShot(state, shot);

  let last = performance.now();
  let acc = 0;
  let statusTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (!state.frozen) {
      handleInput(state, input);
      if (state.screen === 'play') {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          const before = state.screen;
          stepWorld(state, STEP, input.moveX, input.moveY, sfx);
          acc -= STEP;
          steps += 1;
          if (state.screen === 'over' && before === 'play') {
            sfx('over');
            setStatus('Game over. Score ' + state.score + '. Press R to restart.');
          }
        }
        if (steps === 5) acc = 0;
      } else if (state.screen === 'menu') {
        // Attract mode: the swarm drifts behind the title.
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          updateEnemies(state, STEP);
          state.time += STEP;
          acc -= STEP;
          steps += 1;
        }
        if (steps === 5) acc = 0;
        if (state.enemies.length < 5 && Math.random() < 0.02) spawnEnemy(state);
      }
      statusTimer += dt;
      if (statusTimer > 1) {
        statusTimer = 0;
        if (state.screen === 'play') {
          setStatus('Level ' + state.level + ', ' + Math.floor(state.time) + ' seconds, ' + state.kills + ' kills, HP ' + Math.ceil(state.player.hp) + '.');
        }
      }
    }
    render(canvas, state, input);
  }
  requestAnimationFrame(frame);
}

main();
