// Nico Rivas's three-job run against Amber Court and the Solstice Board. Each mission is a list of
// stages (goto / combat / chase); main.js calls start()/update() every frame and reads objective()
// and blip() for the HUD. Nothing here draws anything — it only tracks progress and asks its hooks
// to spawn enemies, spawn the chase car, hand out money and raise the wanted level.
import { CITY_HALF } from './config.js';
import { VEHICLE_MODELS, createVehicle, stepVehicle } from './vehicles.js';

const POINTS = {
  dockPickup: { x: -CITY_HALF * 0.74, z: -CITY_HALF * 0.78 },
  marinaDrop: { x: -CITY_HALF * 0.8, z: CITY_HALF * 0.08 },
  downtownFight: { x: CITY_HALF * 0.06, z: CITY_HALF * 0.04 },
  boardSpawn: { x: CITY_HALF * 0.72, z: CITY_HALF * 0.7 },
};

const FIXER_MODEL = VEHICLE_MODELS.find((m) => m.id === 'marea');

const MISSION_DEFS = [
  {
    key: 'runners_due',
    name: "Runner's Due",
    reward: 300,
    stages: [
      { type: 'goto', point: POINTS.dockPickup, radius: 5, text: 'Reach the Lowside Docks and grab the package.' },
      { type: 'goto', point: POINTS.marinaDrop, radius: 5, text: 'Deliver the package to Amber Court Marina.' },
    ],
  },
  {
    key: 'amber_court_message',
    name: 'A Message for Amber Court',
    reward: 450,
    stages: [
      { type: 'goto', point: POINTS.downtownFight, radius: 12, text: "Head downtown — Amber Court enforcers are waiting." },
      { type: 'combat', point: POINTS.downtownFight, count: 3, text: 'Take down the Amber Court enforcers.' },
    ],
  },
  {
    key: 'solstice_fixer',
    name: 'The Solstice Fixer',
    reward: 700,
    forcesStars: 3,
    stages: [
      { type: 'goto', point: POINTS.boardSpawn, radius: 14, text: "The Board's fixer is bolting for the hills. Find the car." },
      { type: 'chase', point: POINTS.boardSpawn, text: "Run down the fixer's car before it loses you." },
    ],
  },
];

export function createMissionSystem(scene, world, rng, combat, hooks) {
  let index = 0;
  let stageIndex = 0;
  let stageStarted = false;
  let enemyIds = [];
  let fixer = null;
  let done = false;

  function current() { return MISSION_DEFS[index] ?? null; }
  function stage() { const m = current(); return m ? m.stages[stageIndex] : null; }

  function playerPoint(player) {
    if (player.inVehicle) return { x: player.inVehicle.x, z: player.inVehicle.z };
    return { x: player.x, z: player.z };
  }

  function beginStage() {
    stageStarted = true;
    const s = stage();
    if (!s) return;
    if (s.type === 'combat') {
      enemyIds = [];
      for (let i = 0; i < s.count; i++) {
        const angle = (i / s.count) * Math.PI * 2;
        const e = combat.spawnEnemy(s.point.x + Math.sin(angle) * 5, s.point.z + Math.cos(angle) * 5, 'thug');
        enemyIds.push(e.id);
      }
    } else if (s.type === 'chase') {
      const heading = rng.range(0, Math.PI * 2);
      const vehicle = createVehicle(scene, FIXER_MODEL, s.point.x, s.point.z, heading, 0x151515);
      fixer = { vehicle, fleeTimer: 0 };
      const mission = current();
      if (mission.forcesStars) hooks.forceMinStars(mission.forcesStars);
    }
  }

  function advance(player) {
    const mission = current();
    if (!mission) return;
    stageIndex += 1;
    stageStarted = false;
    if (stageIndex >= mission.stages.length) {
      hooks.releaseMinStars();
      hooks.missionComplete(mission);
      index += 1;
      stageIndex = 0;
      if (index >= MISSION_DEFS.length) done = true;
    }
  }

  function update(dt, player) {
    const mission = current();
    if (!mission || done) return;
    if (!stageStarted) beginStage();
    const s = stage();
    if (!s) return;

    if (s.type === 'goto') {
      const p = playerPoint(player);
      const dist = Math.hypot(p.x - s.point.x, p.z - s.point.z);
      if (dist <= s.radius) advance(player);
    } else if (s.type === 'combat') {
      const alive = enemyIds.filter((id) => combat.enemies.some((e) => e.id === id && !e.dead));
      enemyIds = alive;
      if (alive.length === 0) advance(player);
    } else if (s.type === 'chase') {
      if (!fixer) return;
      const v = fixer.vehicle;
      if (v.wrecked) {
        fixer.despawnTimer = (fixer.despawnTimer ?? 2) - dt;
        if (fixer.despawnTimer <= 0) { scene.remove(v.group); fixer = null; advance(player); }
        return;
      }
      const p = playerPoint(player);
      const dx = p.x - v.x, dz = p.z - v.z;
      const dist = Math.hypot(dx, dz);
      // Flee away from the player when chased close; otherwise coast toward the map edge.
      const awayHeading = Math.atan2(-dx, -dz);
      const edgeHeading = Math.atan2(v.x, v.z) + Math.PI;
      const targetHeading = dist < 55 ? awayHeading : edgeHeading;
      let diff = targetHeading - v.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const steer = Math.max(-1, Math.min(1, diff * 1.4));
      stepVehicle(v, dt, 1, steer, false, world);
      if (player.inVehicle && dist < 3.6 && Math.abs(player.inVehicle.speed) > 10) {
        v.health -= dt * 60;
        if (v.health <= 0) v.wrecked = true;
      }
    }
  }

  return {
    update,
    objective() {
      const m = current();
      if (!m) return done ? 'All three jobs are done. Costa Aurelia stays quiet — for now.' : null;
      const s = stage();
      return `${m.name}: ${s ? s.text : ''}`;
    },
    blip() {
      const s = stage();
      if (!s) return null;
      if (s.type === 'chase') return fixer ? { x: fixer.vehicle.x, z: fixer.vehicle.z } : s.point;
      if (s.type === 'combat') {
        const alive = combat.enemies.filter((e) => enemyIds.includes(e.id) && !e.dead);
        if (alive.length) return { x: alive[0].x, z: alive[0].z };
      }
      return s.point;
    },
    isDone() { return done; },
    missionIndex() { return index; },
    chaseTarget() { return fixer ? fixer.vehicle : null; },
    loadIndex(i, s = 0) {
      index = Math.max(0, Math.min(MISSION_DEFS.length, i | 0));
      stageIndex = index < MISSION_DEFS.length ? Math.max(0, Math.min(MISSION_DEFS[index].stages.length - 1, s | 0)) : 0;
      stageStarted = false;
      done = index >= MISSION_DEFS.length;
    },
  };
}
