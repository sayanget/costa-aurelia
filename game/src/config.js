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
  friction: 9, // flat deceleration (units/s^2) applied with no throttle, before engine braking
  engineBraking: 0.7, // extra decel proportional to current speed, so lifting off at speed scrubs off fast
  steerRate: 4.4, // how fast the steer angle itself turns toward the input
  steerSpeedFalloff: 0.6, // how much top-speed steering authority is traded for stability
  minSteerFactor: 0.4,
  turnSpeedThreshold: 1.8, // speed at which heading change reaches full rate (low = snappier off the line)
  handbrakeDecel: 6.5,
  lowSpeedAccelBoost: 1.35, // extra punch off a standing start, tapering out by mid-speed
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
  // Driving: distance and FOV both ride the car's speed fraction (0..1 of topSpeed) — tight and
  // narrow when crawling, pulled back and a touch wider once it's really moving.
  driveOffset: { height: 3.1, backMin: 6.2, backMax: 9.6, fovMin: 62, fovMax: 76 },
  driveLookAhead: { min: 3, max: 10 },
  driveRecenter: 2.4, // how fast a mouse nudge drifts back to dead-behind-the-car
  driveMaxOffset: 1.25,
  cornerLateral: 0.3, // small lateral push while turning, keyed off yaw rate
  cornerRoll: 0.03, // matching bank, in radians per rad/s of yaw rate
  smoothing: 8,
  lookSmoothing: 6,
  mouseSensitivity: 0.0022,
  minPitch: -0.6,
  maxPitch: 0.85,
};

export const DAY = {
  // A single golden-hour moment, with a slow drift so the light never sits perfectly still. The sun
  // sits a little higher than a true horizon-grazing sunset so the tall downtown faces still catch
  // direct light and read as glass towers rather than one flat dark mass.
  sunAngle: 0.62,
  cycleSpeed: 0.004,
};

export const SKY = {
  stops: ['#2f3f68', '#6b6f93', '#e2935f', '#f9c988'],
};

export const FOG = {
  // A warm coastal haze that tints the horizon gold, but kept thin enough that the skyline stays
  // crisp and nearby streets don't wash out to a flat mauve at this golden-hour angle.
  color: 0xe8b483,
  density: 0.0023,
};

export const LIGHT = {
  sunColor: 0xffd49a,
  sunIntensity: 1.5,
  hemiSky: 0xcfdfff,
  // A warmer, brighter ground bounce lifts the faces that point away from the low sun, so the tall
  // downtown towers keep their form in shadow instead of falling to a flat black cut-out.
  hemiGround: 0x7a6650,
  hemiIntensity: 1.9,
  fillColor: 0xfff1dc,
  fillIntensity: 1.0,
  exposure: 1.16,
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
