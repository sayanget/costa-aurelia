// Background traffic: cars that follow the road graph edge by edge, keep a lane offset to their
// own side of the street, slow (and honk) for whatever is ahead of them — the player on foot, a
// slower car, or the player's own vehicle — and never need to know anything about missions or police.
import { CITY } from './config.js';
import { VEHICLE_MODELS, createVehicle } from './vehicles.js';

const LANE_OFFSET = 2.3;
const CAR_MODELS = VEHICLE_MODELS.filter((m) => m.id !== 'vigia');

function rightOf(dx, dz) { return { x: dz, z: -dx }; }

function pickNextNode(graph, fromId, toNode, rng) {
  const options = toNode.neighbors.filter((id) => id !== fromId);
  const pool = options.length > 0 ? options : toNode.neighbors;
  if (pool.length === 0) return null;
  return graph.nodes.get(rng.pick(pool));
}

function placeOnEdge(t, fromNode, toNode) {
  const dx = (toNode.x - fromNode.x) / t.length;
  const dz = (toNode.z - fromNode.z) / t.length;
  const off = rightOf(dx, dz);
  const x = fromNode.x + dx * t.length * t.progress + off.x * LANE_OFFSET;
  const z = fromNode.z + dz * t.length * t.progress + off.z * LANE_OFFSET;
  t.vehicle.x = x; t.vehicle.z = z;
  t.vehicle.heading = Math.atan2(dx, dz);
  t.vehicle.group.position.set(x, 0, z);
  t.vehicle.group.rotation.y = t.vehicle.heading;
}

export function createTraffic(scene, world, rng, count) {
  const cars = [];
  const graph = world.roadGraph;
  const allNodes = [...graph.nodes.values()];

  function spawnOne() {
    const fromNode = rng.pick(allNodes);
    const toNode = pickNextNode(graph, null, fromNode, rng);
    if (!toNode) return null;
    const model = rng.pick(CAR_MODELS);
    const vehicle = createVehicle(scene, model, fromNode.x, fromNode.z, 0, rng.pick(model.colors));
    const t = {
      vehicle, fromNode, toNode, length: CITY.blockSize, progress: rng.next(),
      speed: model.topSpeed * 0.45, honkCooldown: 0,
    };
    placeOnEdge(t, fromNode, toNode);
    return t;
  }

  for (let i = 0; i < count; i++) {
    const t = spawnOne();
    if (t) cars.push(t);
  }

  function obstacleAheadDistance(t, dirX, dirZ) {
    let closest = Infinity;
    for (const other of cars) {
      if (other === t) continue;
      const dx = other.vehicle.x - t.vehicle.x, dz = other.vehicle.z - t.vehicle.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 14) continue;
      const dot = (dx / (dist || 1)) * dirX + (dz / (dist || 1)) * dirZ;
      if (dot > 0.75) closest = Math.min(closest, dist);
    }
    return closest;
  }

  function update(dt, player, audio) {
    for (const t of cars) {
      if (t.vehicle.occupied) continue; // handed off to Nico (or wrecked and left for police) — no AI while that lasts
      const dirX = Math.sin(t.vehicle.heading), dirZ = Math.cos(t.vehicle.heading);
      const target = t.vehicle.model.topSpeed * 0.45;
      let desired = target;

      const aheadCar = obstacleAheadDistance(t, dirX, dirZ);
      if (aheadCar < 9) desired = Math.min(desired, (aheadCar - 3) * 1.8);

      if (!player.inVehicle) {
        const dx = player.x - t.vehicle.x, dz = player.z - t.vehicle.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 7) {
          const dot = (dx / (dist || 1)) * dirX + (dz / (dist || 1)) * dirZ;
          if (dot > 0.6) {
            desired = 0;
            t.honkCooldown -= dt;
            if (t.honkCooldown <= 0 && dist < 5) { audio.honk(); t.honkCooldown = 2; }
          }
        }
      }

      desired = Math.max(0, desired);
      t.speed += Math.max(-10, Math.min(8, desired - t.speed)) * dt * 3;
      t.speed = Math.max(0, t.speed);

      t.progress += (t.speed * dt) / t.length;
      if (t.progress >= 1) {
        const next = pickNextNode(graph, t.fromNode.id, t.toNode, rng);
        if (next) {
          t.fromNode = t.toNode;
          t.toNode = next;
          t.progress = 0;
        } else {
          t.progress = 1;
          t.speed = 0;
        }
      }
      placeOnEdge(t, t.fromNode, t.toNode);
      const spin = t.speed * dt * 2.2;
      for (const w of t.vehicle.wheels) w.rotation.x += spin;
    }
  }

  function release(vehicle) {
    const i = cars.findIndex((c) => c.vehicle === vehicle);
    if (i >= 0) cars.splice(i, 1);
  }

  return { cars, update, release, get vehicles() { return cars.map((c) => c.vehicle); } };
}
