// Nico Rivas on foot: a simple stylised body, WASD movement relative to the camera, collision
// against the city's buildings. Driving is handed off entirely to vehicles.js; player.js only
// tracks whether Nico is in a car and hides the body while he is.
import * as THREE from 'three';
import { PLAYER } from './config.js';

function buildBodyMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xcf9a6d, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xd9803a, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);

  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.6, 4, 8), pants);
  legs.position.y = 0.5;
  legs.castShadow = true;
  group.add(legs);

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.45, 4, 6);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.38, 1.18, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.38, 1.18, 0);
  group.add(armR);

  group.userData.armR = armR;
  group.userData.armL = armL;
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = buildBodyMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x, z, heading: 0,
    vx: 0, vz: 0,
    health: PLAYER.maxHealth,
    inVehicle: null,
    punchCooldown: 0,
    money: 0,
    weapon: 'fists',
    ammo: 0,
    reloadTimer: 0,
    walkCycle: 0,
    dead: false,
  };
}

/** Moves the player on foot from input relative to `camYaw` (the camera's facing); no-op in a vehicle. */
export function stepPlayer(player, dt, input, camYaw, world) {
  if (player.inVehicle) { player.mesh.visible = false; return; }
  player.mesh.visible = true;

  const fwd = (input.forward() ? 1 : 0) - (input.back() ? 1 : 0);
  const strafe = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;

  let moving = false;
  if (fwd !== 0 || strafe !== 0) {
    const len = Math.hypot(fwd, strafe) || 1;
    const nf = fwd / len, ns = strafe / len;
    const dirX = Math.sin(camYaw) * nf + Math.cos(camYaw) * ns;
    const dirZ = Math.cos(camYaw) * nf - Math.sin(camYaw) * ns;
    player.x += dirX * speed * dt;
    player.z += dirZ * speed * dt;
    player.heading = Math.atan2(dirX, dirZ);
    moving = true;
  }

  const resolved = world.resolveBoxCollision(player.x, player.z, PLAYER.radius);
  player.x = resolved.x;
  player.z = resolved.z;

  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;

  if (moving) {
    player.walkCycle += dt * (input.run() ? 11 : 7);
    const swing = Math.sin(player.walkCycle) * 0.5;
    player.mesh.userData.armR.rotation.x = swing;
    player.mesh.userData.armL.rotation.x = -swing;
  } else {
    player.walkCycle = 0;
    player.mesh.userData.armR.rotation.x *= 0.8;
    player.mesh.userData.armL.rotation.x *= 0.8;
  }

  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);
}
