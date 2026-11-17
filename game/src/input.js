// Keyboard (WASD / arrows) plus a touch joystick on the left half of the screen.
// Exposes a single movement vector and edge-triggered action keys.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    // Current movement vector, length 0..1, in world axes.
    moveX: 0,
    moveY: 0,
    // Touch joystick state, in CSS pixels relative to the canvas.
    joy: { active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 },
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
    // Touch or pen on the left half starts the joystick; mouse clicks are menu clicks.
    if (event.pointerType !== 'mouse' && pos.x < canvas.clientWidth * 0.55) {
      input.joy.active = true;
      input.joy.id = event.pointerId;
      input.joy.baseX = pos.x;
      input.joy.baseY = pos.y;
      input.joy.dx = 0;
      input.joy.dy = 0;
      canvas.setPointerCapture(event.pointerId);
    } else {
      input.clicked = { x: pos.x, y: pos.y };
    }
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', (event) => {
    const pos = canvasPos(event);
    input.pointer.x = pos.x;
    input.pointer.y = pos.y;
    if (input.joy.active && event.pointerId === input.joy.id) {
      const max = 56;
      let dx = (pos.x - input.joy.baseX) / max;
      let dy = (pos.y - input.joy.baseY) / max;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
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
