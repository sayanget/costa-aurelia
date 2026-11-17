// Every tuning number, name and colour that is not derived from the world layout itself. Distances
// are in metres (three.js units); angles in radians; the Z axis runs north (-Z) to south (+Z) and the
// X axis runs west (-X) to east (+X), matching the minimap's compass.

export const SAVE_KEY = 'costa-aurelia-save-v1';

export const CITY = {
  blocks: 9, // blocks each way; roads run on every grid line, so there are blocks+1 lines
  blockSize: 34, // metres between road centrelines
  roadWidth: 9,
  sidewalkWidth: 2.2,
};
export const CITY_HALF = (CITY.blocks * CITY.blockSize) / 2;

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9,
  radius: 0.45,
  eyeHeight: 1.6,
  maxHealth: 100,
  punchRange: 1.8,
  punchDamage: 18,
  punchCooldown: 0.55,
};

export const WEAPON = {
  name: 'Flare Pistol',
  range: 55,
  damage: 26,
  cooldown: 0.32,
  clip: 9,
  reloadTime: 1.4,
};

export const VEHICLE_PHYSICS = {
  enterRadius: 3.2,
};

export const WANTED = {
  max: 5,
  decayPerSecond: 3.2, // of 100-scale heat
  pipScale: 20, // heat per star
  sightTimeout: 7, // seconds unseen before heat starts decaying faster
  spawnCooldown: 3.5,
};

export const MONEY = {
  start: 180,
};

export const CAMERA = {
  footOffset: { height: 2.7, back: 4.6 },
  driveOffset: { height: 3.6, back: 7.2 },
  smoothing: 7.5,
  mouseSensitivity: 0.0022,
  minPitch: -0.75,
  maxPitch: 0.95,
};

export const DAY = {
  // A single golden-hour moment, with a slow drift so the light never sits perfectly still.
  sunAngle: 0.52,
  cycleSpeed: 0.004,
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  enter: ['KeyF', 'KeyE'],
  reload: ['KeyR'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  pause: ['Escape'],
};
