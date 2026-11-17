// The wanted meter and the Vigia Patrol cars that answer it: heat rises when combat.js reports a
// hit, decays once no cruiser has had eyes on Nico for WANTED.sightTimeout seconds, and the star
// count that comes out of it decides how many cars are out looking. Cars free-roam straight at
// their target (arcade chase, not the road graph) and fire when they get a clean angle; a stopped
// one may put an officer on the ground via combat.js's own cop enemies.
import { WANTED } from './config.js';
import { VEHICLE_MODELS, createVehicle, stepVehicle } from './vehicles.js';

const POLICE_MODEL = VEHICLE_MODELS.find((m) => m.id === 'vigia');
const SIGHT_RANGE = 44;
const FIRE_RANGE = 26;
const DEPLOY_RANGE = 9;

export function createPoliceSystem(scene, world, rng, audio, combat) {
  const cars = [];
  let heat = 0;
  let minHeat = 0;
  let sinceSeen = 999;
  let spawnTimer = 0;
  let wasWanted = false;
  let currentStars = 0;

  function starsFromHeat(h) { return Math.min(WANTED.max, Math.floor(h / WANTED.pipScale)); }

  function spawnCar(px, pz) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(32, 55);
    const x = Math.max(-world.bound + 4, Math.min(world.bound - 4, px + Math.sin(angle) * dist));
    const z = Math.max(-world.bound + 4, Math.min(world.bound - 4, pz + Math.cos(angle) * dist));
    const vehicle = createVehicle(scene, POLICE_MODEL, x, z, angle + Math.PI);
    cars.push({ vehicle, siren: audio.createSirenLoop(), fireTimer: rng.range(0.5, 1.3), deployed: false, despawnTimer: null, lightPhase: rng.next() * 10 });
  }

  function despawnAll() {
    for (const c of cars) scene.remove(c.vehicle.group);
    cars.length = 0;
  }

  function targetPoint(player) {
    if (player.inVehicle) return { x: player.inVehicle.x, z: player.inVehicle.z };
    return { x: player.x, z: player.z };
  }

  function update(dt, player) {
    heat = Math.max(minHeat, heat);
    const t = targetPoint(player);
    let seen = false;
    for (const c of cars) {
      if (Math.hypot(c.vehicle.x - t.x, c.vehicle.z - t.z) < SIGHT_RANGE) { seen = true; break; }
    }
    sinceSeen = seen ? 0 : sinceSeen + dt;
    if (heat > minHeat) {
      const decay = sinceSeen > WANTED.sightTimeout ? WANTED.decayPerSecond * 2.4 : WANTED.decayPerSecond * 0.3;
      heat = Math.max(minHeat, heat - decay * dt);
    }
    currentStars = starsFromHeat(heat);
    if (wasWanted && currentStars === 0) despawnAll();
    wasWanted = currentStars > 0;

    spawnTimer -= dt;
    const desiredCars = currentStars === 0 ? 0 : Math.min(currentStars + 1, 6);
    if (currentStars > 0 && cars.length < desiredCars && spawnTimer <= 0) {
      spawnCar(t.x, t.z);
      spawnTimer = WANTED.spawnCooldown;
    }

    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      const v = c.vehicle;
      c.lightPhase += dt * 9;
      for (const lb of v.group.userData.lightBar ?? []) lb.material.emissiveIntensity = currentStars > 0 ? (1.3 + Math.sin(c.lightPhase) * 1.3) : 0;
      if (v.wrecked) {
        c.siren.update(dt, false);
        c.despawnTimer = (c.despawnTimer ?? 2.5) - dt;
        if (c.despawnTimer <= 0) { scene.remove(v.group); cars.splice(i, 1); }
        continue;
      }
      const dx = t.x - v.x, dz = t.z - v.z;
      const dist = Math.hypot(dx, dz);
      const desiredHeading = Math.atan2(dx, dz);
      let diff = desiredHeading - v.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const steer = Math.max(-1, Math.min(1, diff * 1.7));
      const throttle = currentStars === 0 ? 0 : (dist < 6 ? 0.15 : 1);
      stepVehicle(v, dt, throttle, steer, false, world);
      v.sirenOn = currentStars > 0;
      c.siren.update(dt, v.sirenOn, 1);

      c.fireTimer -= dt;
      if (currentStars > 0 && dist < FIRE_RANGE && c.fireTimer <= 0) {
        const dot = (dx / (dist || 1)) * Math.sin(v.heading) + (dz / (dist || 1)) * Math.cos(v.heading);
        if (dot > 0.45) { combat.policeShoot(v, player); c.fireTimer = rng.range(0.9, 1.7); }
      }
      if (!c.deployed && !player.inVehicle && currentStars >= 2 && dist < DEPLOY_RANGE) {
        c.deployed = true;
        combat.spawnEnemy(v.x + rng.range(-2, 2), v.z + rng.range(-2, 2), 'cop');
      }
    }
  }

  return {
    update,
    cars,
    addHeat(amount) { heat = Math.min(WANTED.max * WANTED.pipScale, heat + amount); },
    forceMinStars(n) { minHeat = n * WANTED.pipScale; if (heat < minHeat) heat = minHeat; },
    releaseMinStars() { minHeat = 0; },
    get stars() { return currentStars; },
    get heat() { return heat; },
  };
}
