// Keyboard and mouse-drag input, kept in one place. Keys are read as a set of
// actions ("forward", "left", ...) so the rest of the game never touches a
// key code. Mouse drag orbits the camera; the game never asks for pointer lock,
// so it works the same in a real browser and a headless one.
import { KEYS } from './config.js';

const ACTIONS = ['forward', 'back', 'left', 'right', 'run', 'enter', 'handbrake', 'pause', 'confirm', 'mute'];

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function actionFor(code) {
    for (const action of ACTIONS) {
      if (KEYS[action].includes(code)) return action;
    }
    return null;
  }

  function onKeyDown(event) {
    const action = actionFor(event.code);
    if (!action) return;
    if (event.code === 'Space') event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }

  function onKeyUp(event) {
    const action = actionFor(event.code);
    if (action) held.delete(action);
  }

  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseMove(event) {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    isDown(action) {
      return held.has(action);
    },
    // True once, on the frame the key went down; reading it consumes it, so
    // a frame that runs several fixed steps never sees one press twice.
    wasPressed(action) {
      const was = pressed.has(action);
      pressed.delete(action);
      return was;
    },
    // Camera orbit deltas accumulated since the last frame, in pixels.
    takeDrag() {
      const out = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return out;
    },
    endFrame() {
      pressed.clear();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
