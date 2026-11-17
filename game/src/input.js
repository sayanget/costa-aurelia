// Keyboard, mouse-look (pointer lock) and click state, read once a frame by whoever needs it
// (player.js, vehicles.js, combat.js, ui.js). Nothing here knows about game rules.
import { KEYS } from './config.js';

export function createInput(canvas) {
  const down = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let firePressed = false;
  let fireHeld = false;
  let aimHeld = false;
  const justPressed = new Set();

  function isDown(codes) { return codes.some((c) => down.has(c)); }

  window.addEventListener('keydown', (e) => {
    if (!down.has(e.code)) justPressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => { down.clear(); fireHeld = false; aimHeld = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) { fireHeld = true; firePressed = true; }
    if (e.button === 2) aimHeld = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) fireHeld = false;
    if (e.button === 2) aimHeld = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  });

  return {
    get pointerLocked() { return document.pointerLockElement === canvas; },
    requestLock() { canvas.requestPointerLock?.(); },
    exitLock() { if (document.pointerLockElement === canvas) document.exitPointerLock?.(); },
    forward: () => isDown(KEYS.forward),
    back: () => isDown(KEYS.back),
    left: () => isDown(KEYS.left),
    right: () => isDown(KEYS.right),
    run: () => isDown(KEYS.run),
    handbrake: () => isDown(KEYS.handbrake),
    enterPressed: () => justPressed.has('KeyF') || justPressed.has('KeyE'),
    reloadPressed: () => justPressed.has('KeyR'),
    weapon1Pressed: () => justPressed.has('Digit1'),
    weapon2Pressed: () => justPressed.has('Digit2'),
    pausePressed: () => justPressed.has('Escape'),
    firePressed: () => firePressed,
    fireHeld: () => fireHeld,
    aimHeld: () => aimHeld,
    consumeMouse() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    endFrame() {
      justPressed.clear();
      firePressed = false;
    },
  };
}
