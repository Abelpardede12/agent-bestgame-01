// Keyboard (WASD / arrows) plus a touch joystick that can start anywhere on
// the screen: a drag becomes the joystick, a tap stays a click (menus, cards).
// Exposes a single movement vector and edge-triggered action keys.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    // Current movement vector, length 0..1, in world axes.
    moveX: 0,
    moveY: 0,
    // Touch joystick state, in CSS pixels relative to the canvas.
    joy: { active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 },
    // Touch that has not yet decided: drag past the threshold -> joystick,
    // release before that -> click.
    pending: { id: -1, x: 0, y: 0 },
    // Keys pressed since the last consume (edge-triggered).
    pressed: new Set(),
    // Last pointer position in CSS pixels (for clicks on menus).
    pointer: { x: 0, y: 0, down: false },
    clicked: null,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function recomputeMove() {
    let x = 0;
    let y = 0;
    if (keys.has('left')) x -= 1;
    if (keys.has('right')) x += 1;
    if (keys.has('up')) y -= 1;
    if (keys.has('down')) y += 1;
    if (input.joy.active) {
      x += input.joy.dx;
      y += input.joy.dy;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    input.moveX = x;
    input.moveY = y;
  }

  window.addEventListener('keydown', (event) => {
    const action = KEYMAP[event.code];
    if (action) {
      keys.add(action);
      recomputeMove();
      event.preventDefault();
      return;
    }
    if (['Digit1', 'Digit2', 'Digit3', 'KeyR', 'Enter', 'Space', 'KeyM', 'Escape'].includes(event.code)) {
      input.pressed.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) {
      keys.delete(action);
      recomputeMove();
    }
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recomputeMove();
  });

  function canvasPos(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const pos = canvasPos(event);
    input.pointer.x = pos.x;
    input.pointer.y = pos.y;
    input.pointer.down = true;
    if (event.pointerType === 'mouse') {
      // Mouse clicks are menu clicks; the mouse never drives the joystick.
      input.clicked = { x: pos.x, y: pos.y };
    } else if (!input.joy.active && input.pending.id === -1) {
      // Touch or pen anywhere: wait to see whether it is a tap or a drag.
      input.pending.id = event.pointerId;
      input.pending.x = pos.x;
      input.pending.y = pos.y;
      canvas.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', (event) => {
    const pos = canvasPos(event);
    input.pointer.x = pos.x;
    input.pointer.y = pos.y;
    if (!input.joy.active && input.pending.id === event.pointerId) {
      // Dragged far enough: this touch is the joystick now, wherever it began.
      if (Math.hypot(pos.x - input.pending.x, pos.y - input.pending.y) > 12) {
        input.joy.active = true;
        input.joy.id = event.pointerId;
        input.joy.baseX = input.pending.x;
        input.joy.baseY = input.pending.y;
        input.joy.dx = 0;
        input.joy.dy = 0;
        input.pending.id = -1;
      }
    }
    if (input.joy.active && event.pointerId === input.joy.id) {
      const max = 56;
      let dx = (pos.x - input.joy.baseX) / max;
      let dy = (pos.y - input.joy.baseY) / max;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (len < 0.12) { dx = 0; dy = 0; }
      input.joy.dx = dx;
      input.joy.dy = dy;
      recomputeMove();
    }
  });
  function endPointer(event) {
    if (input.joy.active && event.pointerId === input.joy.id) {
      input.joy.active = false;
      input.joy.dx = 0;
      input.joy.dy = 0;
      recomputeMove();
    } else if (input.pending.id === event.pointerId) {
      // Released without dragging: it was a tap, so it counts as a click.
      const pos = canvasPos(event);
      input.clicked = { x: pos.x, y: pos.y };
      input.pending.id = -1;
    }
    input.pointer.down = false;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  input.consumePressed = function consumePressed(code) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
    return false;
  };
  input.consumeClick = function consumeClick() {
    const click = input.clicked;
    input.clicked = null;
    return click;
  };
  input.clearTransient = function clearTransient() {
    input.pressed.clear();
    input.clicked = null;
  };
  return input;
}
