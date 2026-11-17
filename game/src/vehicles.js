// Costa Aurelia's cars: their models, the low-poly mesh built for each, and the arcade driving
// model shared by the player, traffic and police. One vehicle is a plain object (position, heading,
// speed, steering) plus the three.js group that shows it; nothing here owns a list of vehicles,
// callers (world.js, traffic.js, police.js) keep their own.
import * as THREE from 'three';

export const VEHICLE_MODELS = [
  { id: 'alcazar', name: 'Alcazar Coupe', colors: [0xd8453a, 0x274b9e, 0xe8c34a], topSpeed: 34, accel: 16, turn: 2.6, length: 4.4, width: 1.9, height: 1.25, kind: 'car' },
  { id: 'marea', name: 'Marea Convertible', colors: [0xeeeeee, 0xc98a3f, 0x5fae8f], topSpeed: 31, accel: 14, turn: 2.9, length: 4.2, width: 1.85, height: 1.1, kind: 'car' },
  { id: 'cantera', name: 'Cantera Hauler', colors: [0x6b6f72, 0x8a6a3f], topSpeed: 22, accel: 9, turn: 1.8, length: 5.6, width: 2.1, height: 1.9, kind: 'truck' },
  { id: 'solano', name: 'Solano Taxi', colors: [0xf2c200], topSpeed: 29, accel: 13, turn: 2.5, length: 4.3, width: 1.85, height: 1.3, kind: 'car' },
  { id: 'vigia', name: 'Vigia Patrol', colors: [0xf5f5f5], topSpeed: 33, accel: 17, turn: 2.8, length: 4.5, width: 1.9, height: 1.35, kind: 'police' },
];

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

function windowMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x9fd3e8, roughness: 0.2, metalness: 0.1, emissive: 0x1a2c33, emissiveIntensity: 0.4 });
}

/** Builds the three.js group for a vehicle model in a given colour; returns { group, wheels: [...] }. */
export function buildVehicleMesh(model, color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.length, model.height * 0.6, model.width), bodyMat);
  body.position.y = model.height * 0.42;
  body.castShadow = true;
  group.add(body);

  const cabinW = model.width * 0.86;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.length * 0.52, model.height * 0.5, cabinW), windowMaterial());
  cabin.position.set(-model.length * 0.04, model.height * 0.78, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2b8, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1414, emissive: 0xff2020, emissiveIntensity: 1.1 });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), headlightMat);
    hl.position.set(model.length / 2 - 0.05, model.height * 0.42, side * model.width * 0.32);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), tailMat);
    tl.position.set(-model.length / 2 + 0.05, model.height * 0.42, side * model.width * 0.32);
    group.add(tl);
  }

  const wheels = [];
  const wx = model.length / 2 - 0.65;
  const wz = model.width / 2 - 0.05;
  for (const [sx, sz] of [[wx, wz], [wx, -wz], [-wx, wz], [-wx, -wz]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(sx, 0.34, sz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  if (isPolice) {
    const barMat1 = new THREE.MeshStandardMaterial({ color: 0x1a1aff, emissive: 0x3333ff, emissiveIntensity: 2 });
    const barMat2 = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0xff3333, emissiveIntensity: 2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, cabinW * 0.9), new THREE.MeshStandardMaterial({ color: 0x111 }));
    bar.position.set(-model.length * 0.02, model.height + 0.02, 0);
    group.add(bar);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, cabinW * 0.42), barMat1);
    l1.position.set(-model.length * 0.02, model.height + 0.1, cabinW * 0.22);
    group.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, cabinW * 0.42), barMat2);
    l2.position.set(-model.length * 0.02, model.height + 0.1, -cabinW * 0.22);
    group.add(l2);
    group.userData.lightBar = [l1, l2];
  }

  group.userData.model = model;
  return { group, wheels };
}

let nextVehicleId = 1;

/** A fresh vehicle state + mesh, placed at (x,z) facing `heading` radians (0 = +Z). */
export function createVehicle(scene, model, x, z, heading, colorOverride) {
  const color = colorOverride ?? model.colors[Math.floor(Math.random() * model.colors.length)];
  const isPolice = model.kind === 'police';
  const { group, wheels } = buildVehicleMesh(model, color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const vehicle = {
    id: nextVehicleId++,
    model,
    group,
    wheels,
    isPolice,
    x, z, heading,
    speed: 0,
    steer: 0,
    occupied: false,
    driver: null,
    health: isPolice ? 140 : 100,
    wrecked: false,
    skidCooldown: 0,
    sirenOn: false,
  };
  return vehicle;
}

const FRICTION = 10;
const STEER_RATE = 3.2;

/**
 * Advances a vehicle's arcade physics one step. `throttle` -1..1 (back..forward), `steerInput` -1..1
 * (left..right), `handbrake` boolean. Collision against `world.buildingBoxes` keeps it out of
 * buildings; `bounds` clamps it to the playable city plus a margin.
 */
export function stepVehicle(vehicle, dt, throttle, steerInput, handbrake, world) {
  const m = vehicle.model;
  const speedFrac = Math.abs(vehicle.speed) / m.topSpeed;
  const targetSteer = steerInput * m.turn * (1 - speedFrac * 0.55);
  vehicle.steer += (targetSteer - vehicle.steer) * Math.min(1, STEER_RATE * dt);

  if (handbrake) {
    vehicle.speed *= Math.max(0, 1 - dt * 4.5);
  } else if (throttle !== 0) {
    vehicle.speed += throttle * m.accel * dt;
  } else {
    const sign = Math.sign(vehicle.speed);
    vehicle.speed -= sign * FRICTION * dt;
    if (Math.sign(vehicle.speed) !== sign) vehicle.speed = 0;
  }
  vehicle.speed = Math.max(-m.topSpeed * 0.45, Math.min(m.topSpeed, vehicle.speed));

  const turnFactor = Math.min(1, Math.abs(vehicle.speed) / 3);
  vehicle.heading += vehicle.steer * dt * turnFactor * Math.sign(vehicle.speed || 1);

  const dx = Math.sin(vehicle.heading) * vehicle.speed * dt;
  const dz = Math.cos(vehicle.heading) * vehicle.speed * dt;
  let nx = vehicle.x + dx;
  let nz = vehicle.z + dz;

  if (world) {
    const half = m.width / 2 + 0.3;
    const resolved = world.resolveBoxCollision(nx, nz, half, m.length / 2 + 0.3, vehicle.heading);
    nx = resolved.x; nz = resolved.z;
    if (resolved.hit) vehicle.speed *= 0.3;
  }

  const skidding = Math.abs(vehicle.steer) > 1.6 && Math.abs(vehicle.speed) > 8;
  vehicle.x = nx; vehicle.z = nz;
  vehicle.group.position.set(vehicle.x, 0, vehicle.z);
  vehicle.group.rotation.y = vehicle.heading;
  const wheelSpin = vehicle.speed * dt * 2.2;
  for (const w of vehicle.wheels) w.rotation.x += wheelSpin;
  for (const w of vehicle.wheels.slice(0, 2)) w.rotation.y = vehicle.steer * 0.35;

  return { skidding };
}
