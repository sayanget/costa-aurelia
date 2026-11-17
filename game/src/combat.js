// Fists and the flare pistol: foot enemies (Amber Court enforcers), the hit tests for both of
// Nico's attacks, and the little particle bursts and tracers that sell a hit. Police gunfire at the
// player is also routed through damagePlayer so the HUD and hit-flash react the same way either way.
import * as THREE from 'three';
import { PLAYER, WEAPON } from './config.js';

function buildEnemyMesh(color) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98465, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.68;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.6, 4, 8), new THREE.MeshStandardMaterial({ color: 0x24262e }));
  legs.position.y = 0.5;
  group.add(legs);
  group.userData.torsoMat = shirt;
  group.userData.baseColor = color;
  return group;
}

export function createCombatSystem(scene, audio) {
  const enemies = [];
  const particles = [];
  const tracers = [];
  let nextId = 1;

  function spawnEnemy(x, z, kind = 'thug') {
    const color = kind === 'cop' ? 0x25407a : 0x5c2a4a;
    const mesh = buildEnemyMesh(color);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = {
      id: nextId++, kind, mesh, x, z, heading: 0,
      health: 60, maxHealth: 60, state: 'idle', armed: kind === 'cop' || Math.random() < 0.4,
      attackCooldown: 0, flashTimer: 0, dead: false, deadTimer: 0,
    };
    enemies.push(enemy);
    return enemy;
  }

  function spark(x, y, z, color) {
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      scene.add(p);
      particles.push({ mesh: p, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, life: 0.4 });
    }
  }

  function tracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    tracers.push({ line, life: 0.12 });
  }

  function damagePlayer(player, amount) {
    if (player.dead) return;
    player.health = Math.max(0, player.health - amount);
    player.hitFlash = 0.35;
    audio.hit();
    if (player.health <= 0) player.dead = true;
  }

  function playerPunch(player, world, onHitWanted) {
    if (player.punchCooldown > 0 || player.inVehicle) return false;
    player.punchCooldown = PLAYER.punchCooldown;
    audio.punch();
    player.punchSwing = 0.3;
    const dirX = Math.sin(player.heading), dirZ = Math.cos(player.heading);
    let hitAny = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x, dz = e.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > PLAYER.punchRange) continue;
      const dot = (dx / (dist || 1)) * dirX + (dz / (dist || 1)) * dirZ;
      if (dot < 0.5) continue;
      e.health -= PLAYER.punchDamage;
      e.flashTimer = 0.15;
      e.x += dirX * 0.4; e.z += dirZ * 0.4;
      spark(e.x, 1.3, e.z, 0xffcc66);
      hitAny = true;
      if (e.health <= 0 && !e.dead) { e.dead = true; e.deadTimer = 2.5; onHitWanted?.(10); }
      else onHitWanted?.(4);
    }
    return hitAny;
  }

  function playerShoot(player, extraTargets = []) {
    if (player.inVehicle) return false;
    if (player.ammo <= 0) return false;
    player.weaponCooldown = WEAPON.cooldown;
    player.ammo -= 1;
    audio.gunshot();
    player.muzzleFlash = 0.08;
    const originX = player.x, originZ = player.z, originY = 1.3;
    const dirX = Math.sin(player.heading), dirZ = Math.cos(player.heading);
    let best = null, bestDist = WEAPON.range;
    const all = [...enemies.filter((e) => !e.dead), ...extraTargets];
    for (const t of all) {
      const dx = t.x - originX, dz = t.z - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist > WEAPON.range) continue;
      const dot = (dx / (dist || 1)) * dirX + (dz / (dist || 1)) * dirZ;
      if (dot < 0.86) continue;
      if (dist < bestDist) { bestDist = dist; best = t; }
    }
    if (best) {
      best.health -= WEAPON.damage;
      best.flashTimer = 0.15;
      spark(best.x, 1.2, best.z, 0xff6644);
      tracer(originX, originY, originZ, best.x, 1.1, best.z);
      if (best.health <= 0) {
        if (best.dead !== undefined) { if (!best.dead) best.dead = true, best.deadTimer = 2.5; }
        else if (best.wrecked !== undefined) best.wrecked = true;
      }
    } else {
      tracer(originX, originY, originZ, originX + dirX * WEAPON.range, 1.1, originZ + dirZ * WEAPON.range);
    }
    return true;
  }

  function update(dt, player, world, onPlayerSpotted) {
    for (const e of enemies) {
      if (e.dead) {
        e.deadTimer -= dt;
        e.mesh.rotation.z = Math.min(Math.PI / 2, e.mesh.rotation.z + dt * 4);
        e.mesh.position.y = Math.max(-0.3, e.mesh.position.y - dt * 0.3);
        if (e.deadTimer <= 0) { scene.remove(e.mesh); e.gone = true; }
        continue;
      }
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        e.mesh.userData.torsoMat.emissive = new THREE.Color(0xff3333);
        e.mesh.userData.torsoMat.emissiveIntensity = e.flashTimer > 0 ? 1.2 : 0;
      }
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 16 && !player.dead) {
        e.state = 'chase';
        onPlayerSpotted?.();
      } else if (dist > 24) e.state = 'idle';

      if (e.state === 'chase') {
        e.heading = Math.atan2(dx, dz);
        const meleeRange = e.armed ? 10 : 1.4;
        if (dist > meleeRange) {
          const speed = 3.3;
          const nx = e.x + Math.sin(e.heading) * speed * dt;
          const nz = e.z + Math.cos(e.heading) * speed * dt;
          const r = world.resolveBoxCollision(nx, nz, 0.4);
          e.x = r.x; e.z = r.z;
        }
        e.attackCooldown -= dt;
        if (dist <= meleeRange && e.attackCooldown <= 0) {
          e.attackCooldown = e.armed ? 1.4 : 0.9;
          if (e.armed && dist > 1.6) {
            audio.gunshot();
            // Muzzle flash at the shooter's hand, so return fire reads as coming from the enemy.
            spark(e.x + Math.sin(e.heading) * 0.4, 1.3, e.z + Math.cos(e.heading) * 0.4, 0xffe08a);
            tracer(e.x, 1.3, e.z, player.x, 1.3, player.z);
            damagePlayer(player, 9);
          } else {
            audio.hit();
            damagePlayer(player, 7);
          }
        }
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) enemies.splice(i, 1);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy -= dt * 6;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0, p.life / 0.4));
      if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) { scene.remove(t.line); tracers.splice(i, 1); }
    }

    if (player.hitFlash > 0) player.hitFlash = Math.max(0, player.hitFlash - dt);
    if (player.muzzleFlash > 0) player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
    if (player.punchSwing > 0) player.punchSwing = Math.max(0, player.punchSwing - dt);
    player.weaponCooldown = Math.max(0, (player.weaponCooldown ?? 0) - dt);
  }

  function policeShoot(vehicle, player) {
    if (player.dead) return;
    const originY = vehicle.model.height + 0.3;
    audio.gunshot();
    spark(vehicle.x + Math.sin(vehicle.heading) * 0.6, originY, vehicle.z + Math.cos(vehicle.heading) * 0.6, 0xffe08a);
    tracer(vehicle.x, originY, vehicle.z, player.x, 1.1, player.z);
    damagePlayer(player, 7);
  }

  return { enemies, spawnEnemy, playerPunch, playerShoot, policeShoot, damagePlayer, update };
}
