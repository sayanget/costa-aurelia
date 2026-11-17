// Background foot traffic: a low-poly walker per spawn that wanders between the world's sidewalk
// points and bolts away, screaming, when trouble (gunfire, a chase, Nico running them close) breaks
// out nearby. Purely decorative reaction — they carry no health and are not weapon targets.
import * as THREE from 'three';

function buildPedMesh(color) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89770, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.48, 4, 8), shirt);
  torso.position.y = 1.02;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin);
  head.position.y = 1.5;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e38 }));
  legs.position.y = 0.42;
  group.add(legs);
  return group;
}

const SHIRTS = [0x5577aa, 0xaa5577, 0x77aa55, 0xc9a73f, 0x8866cc, 0xcc6644];

export function createPedestrians(scene, world, rng, count) {
  const points = world.sidewalkPoints;
  const peds = [];

  function pickTarget() {
    const p = rng.pick(points);
    return { x: p.x + rng.range(-5, 5), z: p.z + rng.range(-5, 5) };
  }

  function spawnOne() {
    const home = rng.pick(points);
    const mesh = buildPedMesh(rng.pick(SHIRTS));
    const x = home.x + rng.range(-3, 3), z = home.z + rng.range(-3, 3);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return { mesh, x, z, heading: 0, target: pickTarget(), speed: rng.range(1.1, 1.9), fleeTimer: 0, walkCycle: rng.next() * 10, screamed: false };
  }

  for (let i = 0; i < count; i++) peds.push(spawnOne());

  function update(dt, player, alarmed, audio) {
    for (const p of peds) {
      const dxp = player.x - p.x, dzp = player.z - p.z;
      const distPlayer = Math.hypot(dxp, dzp);
      const scared = alarmed && distPlayer < 22;
      if (scared && p.fleeTimer <= 0) {
        p.fleeTimer = 2.2;
        if (!p.screamed && distPlayer < 14) { audio?.scream(); p.screamed = true; }
      }
      if (p.fleeTimer > 0) p.fleeTimer -= dt; else p.screamed = false;

      let speed = p.speed;
      let heading;
      if (p.fleeTimer > 0) {
        heading = Math.atan2(-dxp, -dzp);
        speed = p.speed * 2.3;
      } else {
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.3) p.target = pickTarget();
        heading = Math.atan2(dx, dz);
      }
      p.heading += Math.atan2(Math.sin(heading - p.heading), Math.cos(heading - p.heading)) * Math.min(1, dt * 6);
      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const resolved = world.resolveBoxCollision(nx, nz, 0.32);
      p.x = resolved.x; p.z = resolved.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.rotation.x = p.fleeTimer > 0 ? 0.18 : 0;
      p.walkCycle += dt * (p.fleeTimer > 0 ? 14 : 6);
      p.mesh.scale.y = 1 + Math.sin(p.walkCycle) * 0.015;
    }
  }

  return { peds, update };
}
