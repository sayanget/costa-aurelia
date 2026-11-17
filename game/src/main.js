// Boot and the one loop. Builds the city, Nico, traffic, pedestrians, police and the three jobs
// once from a seed, then every frame: read input, step whichever of Nico-on-foot or his car is
// active, step every system that isn't the player, follow with the camera, draw the HUD, paint.
//
// ?seed=N fixes the city and everyone in it. ?shot=cover|drive|chase|mission (with &seed=N) skips
// the title card, stages that scene, runs it forward for real on a fixed step and sets
// window.__shotReady once the frame behind it is painted, for a screenshot tool to wait on.
import * as THREE from 'three';
import { CAMERA, CITY_HALF, MONEY, PLAYER, VEHICLE_PHYSICS, WEAPON, DAY } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer, stepPlayer } from './player.js';
import { createCameraRig } from './camera.js';
import { VEHICLE_MODELS, createVehicle, stepVehicle } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPoliceSystem } from './police.js';
import { createCombatSystem } from './combat.js';
import { createMissionSystem } from './missions.js';
import { createHud } from './hud.js';
import { createUI } from './ui.js';
import { createAudio, resumeAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const viewport = document.getElementById('viewport');
const hudCanvas = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas: viewport, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0c184);
scene.fog = new THREE.FogExp2(0xe0ac76, 0.0045);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 700);

const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x4a4030, 1.7);
scene.add(hemi);
const fill = new THREE.AmbientLight(0xfff1dc, 0.6);
scene.add(fill);
const sun = new THREE.DirectionalLight(0xffdca0, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -140;
sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0015;
scene.add(sun, sun.target);

let sunAzimuth = 0;
function updateSun(dt) {
  sunAzimuth += DAY.cycleSpeed * dt;
  const elevation = DAY.sunAngle;
  const dist = 220;
  const horiz = Math.cos(elevation) * dist;
  sun.position.set(Math.sin(sunAzimuth) * horiz, Math.sin(elevation) * dist, Math.cos(sunAzimuth) * horiz);
  sun.target.position.set(0, 0, 0);
}
updateSun(0);

const rng = createRandom(seed);
const world = createWorld(scene, rng);

const n = Math.floor(world.roadGraph.n / 2);
const spawnNode = world.roadGraph.nodeAt(n, n);
const SPAWN = { x: spawnNode.x + 2, z: spawnNode.z + 2 };

const player = createPlayer(scene, SPAWN.x, SPAWN.z);
const cameraRig = createCameraRig(camera);
const input = createInput(viewport);
const audio = createAudio();
const ambience = audio.createAmbience();
const engineLoop = audio.createEngineLoop();
const combat = createCombatSystem(scene, audio);
const traffic = createTraffic(scene, world, rng, 20);
const pedestrians = createPedestrians(scene, world, rng, 26);

const STEALABLE_MODELS = VEHICLE_MODELS.filter((m) => m.id !== 'vigia');
function pickUniqueSpots(count) {
  const idx = world.parkedSpots.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, count).map((i) => world.parkedSpots[i]);
}
const parkedVehicles = pickUniqueSpots(18).map((spot) => {
  const model = rng.pick(STEALABLE_MODELS);
  return createVehicle(scene, model, spot.x, spot.z, spot.heading, rng.pick(model.colors));
});

const police = createPoliceSystem(scene, world, rng, audio, combat);
const missions = createMissionSystem(scene, world, rng, combat, {
  forceMinStars: (n2) => police.forceMinStars(n2),
  releaseMinStars: () => police.releaseMinStars(),
  missionComplete: (mission) => {
    state.money += mission.reward;
    audio.missionDone();
    showToast(`${mission.name} complete — +$${mission.reward}`, 4.5);
  },
});

const hud = createHud(hudCanvas);
const ui = createUI(overlay);

const state = { money: MONEY.start };
const settings = { volume: 0.55, sensitivity: 1 };
const baseSensitivity = CAMERA.mouseSensitivity;
let toast = null;
let gunfireAlarm = 0;
let running = false;
let paused = false;

function showToast(text, duration = 3) { toast = { text, timer: duration }; }

function applySettings(partial) {
  Object.assign(settings, partial);
  audio.setMasterVolume(settings.volume);
  CAMERA.mouseSensitivity = baseSensitivity * settings.sensitivity;
}
applySettings({});

function nearestEnterableVehicle() {
  let best = null, bestDist = VEHICLE_PHYSICS.enterRadius;
  for (const v of [...parkedVehicles, ...traffic.vehicles]) {
    if (v.wrecked || v.occupied) continue;
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (d < bestDist) { bestDist = d; best = v; }
  }
  return best;
}

function toggleVehicle() {
  if (player.inVehicle) {
    const v = player.inVehicle;
    v.occupied = false;
    player.inVehicle = null;
    const exitAngle = v.heading + Math.PI / 2;
    player.x = v.x + Math.sin(exitAngle) * 2.6;
    player.z = v.z + Math.cos(exitAngle) * 2.6;
    player.heading = v.heading;
  } else {
    const v = nearestEnterableVehicle();
    if (v) {
      v.occupied = true;
      player.inVehicle = v;
      traffic.release(v);
      audio.uiClick();
    }
  }
}

function respawn() {
  player.health = PLAYER.maxHealth;
  player.dead = false;
  player.hitFlash = 0;
  state.money = Math.max(0, state.money - 50);
  if (player.inVehicle) { player.inVehicle.occupied = false; player.inVehicle = null; }
  player.x = SPAWN.x;
  player.z = SPAWN.z;
  showToast('Patched up at the clinic — docked $50.', 3.5);
}

function tick(dt) {
  const mouse = input.consumeMouse();
  cameraRig.applyMouse(mouse.x, mouse.y);

  if (input.enterPressed()) toggleVehicle();

  if (player.inVehicle) {
    const v = player.inVehicle;
    const throttle = (input.forward() ? 1 : 0) - (input.back() ? 1 : 0);
    const steer = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
    stepVehicle(v, dt, throttle, steer, input.handbrake(), world);
    engineLoop.set(true, Math.min(1, Math.abs(v.speed) / v.model.topSpeed));
  } else {
    stepPlayer(player, dt, input, cameraRig.yaw, world);
    engineLoop.set(false, 0);
  }

  if (input.weapon1Pressed()) player.weapon = 'fists';
  if (input.weapon2Pressed()) player.weapon = 'flare';
  if (input.reloadPressed() && player.weapon === 'flare' && !player.reloading && player.ammo < WEAPON.clip) {
    player.reloading = true;
    player.reloadTimer = WEAPON.reloadTime;
  }
  if (player.reloading && player.reloadTimer <= 0) {
    player.reloading = false;
    player.ammo = WEAPON.clip;
  }

  if (!player.inVehicle && (input.fireHeld() || input.firePressed())) {
    if (player.weapon === 'fists') {
      combat.playerPunch(player, world, (amount) => { police.addHeat(amount); gunfireAlarm = 2.5; });
    } else if (player.weapon === 'flare' && (player.weaponCooldown ?? 0) <= 0) {
      if (player.ammo > 0) {
        const chaseTarget = missions.chaseTarget();
        combat.playerShoot(player, chaseTarget ? [chaseTarget] : []);
        police.addHeat(3);
        gunfireAlarm = 2.5;
      } else if (!player.reloading) {
        player.reloading = true;
        player.reloadTimer = WEAPON.reloadTime;
      }
    }
  }

  traffic.update(dt, player, audio);
  pedestrians.update(dt, player, gunfireAlarm > 0 || police.stars > 0, audio);
  combat.update(dt, player, world);
  police.update(dt, player);
  missions.update(dt, player);

  gunfireAlarm = Math.max(0, gunfireAlarm - dt);
  if (toast) { toast.timer -= dt; if (toast.timer <= 0) toast = null; }

  const cx = player.inVehicle ? player.inVehicle.x : player.x;
  const cz = player.inVehicle ? player.inVehicle.z : player.z;
  const ch = player.inVehicle ? player.inVehicle.model.height * 0.6 : PLAYER.eyeHeight;
  cameraRig.update(dt, cx, cz, ch, !!player.inVehicle);

  updateSun(dt);

  if (player.dead) respawn();
}

function buildHudState() {
  return {
    health: player.health,
    money: state.money,
    weapon: player.weapon,
    weaponName: WEAPON.name,
    ammo: player.ammo,
    clip: WEAPON.clip,
    reloading: player.reloading,
    hitFlash: player.hitFlash ?? 0,
    stars: police.stars,
    objective: missions.objective(),
    blip: missions.blip(),
    toast,
    driving: !!player.inVehicle,
    prompt: !player.inVehicle && nearestEnterableVehicle() ? 'Press F to get in' : (player.inVehicle ? 'Press F to get out' : null),
    px: player.inVehicle ? player.inVehicle.x : player.x,
    pz: player.inVehicle ? player.inVehicle.z : player.z,
    heading: player.inVehicle ? player.inVehicle.heading : player.heading,
    district: world.districtLabelAt(player.inVehicle ? player.inVehicle.x : player.x, player.inVehicle ? player.inVehicle.z : player.z),
    policeDots: police.cars.filter((c) => !c.vehicle.wrecked).map((c) => ({ x: c.vehicle.x, z: c.vehicle.z })),
  };
}

function doSave() {
  writeSave({
    money: state.money,
    completedMissions: missions.missionIndex(),
    unlockedVehicle: null,
    unlockedWeapon: null,
    unlockedDistrict: null,
    px: player.inVehicle ? player.inVehicle.x : player.x,
    pz: player.inVehicle ? player.inVehicle.z : player.z,
    savedAt: Date.now(),
  });
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  hud.resize();
}
window.addEventListener('resize', onResize);
onResize();

function togglePause(next) {
  paused = next;
  if (paused) {
    input.exitLock();
    ui.showPause({
      settings,
      onResume: () => togglePause(false),
      onSaveQuit: () => { doSave(); showTitleScreen(); },
      onSettingsChange: applySettings,
    });
  } else {
    ui.hide();
    input.requestLock();
  }
}

function beginPlay() {
  running = true;
  paused = false;
  ambience.setVolume(1);
  input.requestLock();
  statusEl.textContent = 'Costa Aurelia: exploring Nico\'s turf.';
}

function newGame() {
  state.money = MONEY.start;
  player.health = PLAYER.maxHealth;
  player.dead = false;
  player.weapon = 'flare';
  player.ammo = WEAPON.clip;
  player.reloading = false;
  if (player.inVehicle) { player.inVehicle.occupied = false; player.inVehicle = null; }
  player.x = SPAWN.x;
  player.z = SPAWN.z;
  player.heading = 0;
  missions.loadIndex(0);
  clearSave();
  ui.hide();
  beginPlay();
}

function continueGame() {
  const save = loadSave();
  if (!save) { newGame(); return; }
  state.money = save.money ?? MONEY.start;
  player.x = save.px ?? SPAWN.x;
  player.z = save.pz ?? SPAWN.z;
  player.health = PLAYER.maxHealth;
  player.dead = false;
  player.weapon = 'flare';
  player.ammo = WEAPON.clip;
  player.reloading = false;
  missions.loadIndex(save.completedMissions ?? 0);
  ui.hide();
  beginPlay();
}

function showTitleScreen() {
  running = false;
  paused = false;
  input.exitLock();
  ui.showTitle({
    hasSave: !!loadSave(),
    settings,
    onNewGame: () => { resumeAudio(); newGame(); },
    onContinue: () => { resumeAudio(); continueGame(); },
    onSettingsChange: applySettings,
  });
}

let autosaveTimer = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (running && input.pausePressed()) togglePause(!paused);

  if (running && !paused) {
    tick(dt);
    hud.draw(buildHudState());
    autosaveTimer -= dt;
    if (autosaveTimer <= 0) { doSave(); autosaveTimer = 12; }
  } else if (!running) {
    cameraRig.update(dt, player.x, player.z, PLAYER.eyeHeight, false);
  }

  renderer.render(scene, camera);
  input.endFrame();
}

function runShotMode(mode) {
  overlay.classList.add('hidden');
  player.weapon = 'flare';
  player.ammo = WEAPON.clip;

  if (mode === 'cover') {
    const spot = { x: CITY_HALF * 0.5, z: CITY_HALF * 0.78 };
    player.x = spot.x;
    player.z = spot.z;
    player.heading = Math.atan2(-spot.x, -spot.z);
    cameraRig.yaw = player.heading + 0.5;
    cameraRig.pitch = 0.14;
    missions.loadIndex(0);
  } else if (mode === 'drive') {
    const node = world.roadGraph.nodeAt(5, 3);
    const v = parkedVehicles[0];
    v.x = node.x; v.z = node.z; v.heading = 0; v.speed = v.model.topSpeed * 0.55;
    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.y = v.heading;
    v.occupied = true;
    player.inVehicle = v;
    input.forward = () => true;
    cameraRig.yaw = v.heading;
    missions.loadIndex(0);
  } else if (mode === 'chase') {
    const node = world.roadGraph.nodeAt(5, 5);
    const v = parkedVehicles[1];
    v.x = node.x; v.z = node.z; v.heading = Math.PI; v.speed = v.model.topSpeed * 0.7;
    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.y = v.heading;
    v.occupied = true;
    player.inVehicle = v;
    player.health = 9999;
    input.forward = () => true;
    cameraRig.yaw = v.heading;
    missions.loadIndex(2, 1);
    police.forceMinStars(3);
  } else if (mode === 'mission') {
    missions.loadIndex(1, 1);
    const target = { x: CITY_HALF * 0.06, z: CITY_HALF * 0.04 };
    player.x = target.x - 7;
    player.z = target.z - 6;
    player.heading = Math.atan2(target.x - player.x, target.z - player.z);
    player.health = 9999;
  }

  const FIXED_DT = 1 / 30;
  const steps = mode === 'chase' || mode === 'drive' ? 80 : 150;
  for (let i = 0; i < steps; i++) tick(FIXED_DT);

  if (mode === 'mission') {
    combat.playerPunch(player, world, (amount) => police.addHeat(amount));
    player.health = 58;
    player.hitFlash = 0.3;
  } else if (mode === 'chase') {
    player.health = PLAYER.maxHealth;
    // A cruiser placed just ahead in frame, so the chase reads at a glance even if the real
    // (randomly placed) pursuit is still catching up from off-screen.
    const v = player.inVehicle;
    const decoy = createVehicle(
      scene,
      VEHICLE_MODELS.find((m) => m.id === 'vigia'),
      v.x + Math.sin(v.heading) * 16 + Math.cos(v.heading) * 6,
      v.z + Math.cos(v.heading) * 16 - Math.sin(v.heading) * 6,
      v.heading + 0.15,
    );
    for (const lb of decoy.group.userData.lightBar ?? []) lb.material.emissiveIntensity = 2.4;
  }

  if (mode === 'cover') {
    camera.position.set(player.x - Math.sin(player.heading) * 16, 13, player.z - Math.cos(player.heading) * 16);
    camera.lookAt(player.x + Math.sin(player.heading) * 24, 2.2, player.z + Math.cos(player.heading) * 24);
  }

  hud.draw(buildHudState());
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    window.__shotReady = true;
    document.documentElement.dataset.shotReady = '1';
    statusEl.textContent = `Costa Aurelia: ${mode} shot staged.`;
  });
}

if (shotMode) {
  runShotMode(shotMode);
} else {
  showTitleScreen();
  requestAnimationFrame(frame);
}
