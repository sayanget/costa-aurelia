// Costa Aurelia itself: the road grid, every building, the water's edge and each district's props,
// built once from a seed. Exposes the road graph (traffic.js, pedestrians.js, police.js walk it),
// the building boxes (collision, for anyone moving) and a few lookups the rest of the game needs.
import * as THREE from 'three';
import { CITY, CITY_HALF } from './config.js';
import { DISTRICT_INFO, districtAt } from './districts.js';

function windowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#11131a';
  ctx.fillRect(0, 0, size, size);
  for (let y = 4; y < size; y += 10) {
    for (let x = 4; x < size; x += 8) {
      ctx.fillStyle = Math.random() < 0.55 ? 'rgba(255,214,130,0.95)' : 'rgba(40,46,60,0.9)';
      ctx.fillRect(x, y, 4, 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function roadLineTexture() {
  const w = 64, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#55565c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(240,220,160,0.9)';
  ctx.fillRect(w / 2 - 2, 6, 4, 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, CITY.blocks * 3);
  return tex;
}

function buildRoadGraph() {
  const nodes = new Map();
  const n = CITY.blocks + 1;
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const x = -CITY_HALF + ix * CITY.blockSize;
      const z = -CITY_HALF + iz * CITY.blockSize;
      const id = `${ix}_${iz}`;
      nodes.set(id, { id, ix, iz, x, z, neighbors: [] });
    }
  }
  const edges = [];
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const a = nodes.get(`${ix}_${iz}`);
      if (ix + 1 < n) {
        const b = nodes.get(`${ix + 1}_${iz}`);
        edges.push({ a: a.id, b: b.id, length: CITY.blockSize });
        a.neighbors.push(b.id); b.neighbors.push(a.id);
      }
      if (iz + 1 < n) {
        const b = nodes.get(`${ix}_${iz + 1}`);
        edges.push({ a: a.id, b: b.id, length: CITY.blockSize });
        a.neighbors.push(b.id); b.neighbors.push(a.id);
      }
    }
  }
  return {
    nodes, edges, n,
    nodeAt(ix, iz) { return this.nodes.get(`${ix}_${iz}`); },
    randomNode(rng) { const list = [...this.nodes.values()]; return rng.pick(list); },
  };
}

function addPalm(group, x, z, rng) {
  const trunkH = rng.range(3, 5.2);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, trunkH, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
  trunk.position.set(x, trunkH / 2, z);
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 4), frondMat);
    frond.position.set(x, trunkH + 0.4, z);
    frond.rotation.z = Math.PI / 2.4;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.position.x += Math.cos((i / 6) * Math.PI * 2) * 0.9;
    frond.position.z += Math.sin((i / 6) * Math.PI * 2) * 0.9;
    group.add(frond);
  }
}

function addStreetlamp(group, x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6 }));
  pole.position.set(x, 2.1, z);
  group.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd27a, emissiveIntensity: 1.6 }));
  lamp.position.set(x, 4.15, z);
  group.add(lamp);
  const light = new THREE.PointLight(0xffcf8a, 6, 10, 2);
  light.position.set(x, 4.1, z);
  group.add(light);
}

function addContainer(group, x, z, rng) {
  const colors = [0xb23b2f, 0x2f6ba2, 0xc7902f, 0x3f7a4d];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.4, 2.3), new THREE.MeshStandardMaterial({ color: rng.pick(colors), roughness: 0.75, metalness: 0.2 }));
  mesh.position.set(x, 1.2, z);
  mesh.rotation.y = rng.bool() ? Math.PI / 2 : 0;
  group.add(mesh);
  return mesh;
}

function addHedgeYard(group, x, z, rng) {
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 1 }));
  hedge.position.set(x, 0.45, z);
  group.add(hedge);
  if (rng.bool(0.5)) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshStandardMaterial({ color: 0x2fa7c9, roughness: 0.1, metalness: 0.1, emissive: 0x114455, emissiveIntensity: 0.3 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x + 2, 0.02, z + 2);
    group.add(pool);
  }
}

export function createWorld(scene, rng) {
  const buildingBoxes = [];
  const parkedSpots = [];
  const sidewalkPoints = [];
  const buildingsGroup = new THREE.Group();
  const propsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  scene.add(buildingsGroup, propsGroup, roadsGroup);

  const winTex = windowTexture();
  const lineTex = roadLineTexture();
  const lineTexV = roadLineTexture();
  lineTexV.rotation = Math.PI / 2;

  // Ground plinth per district (one big plane per row band keeps draw calls low, coloured per cell below it).
  const groundGeo = new THREE.PlaneGeometry(CITY.blockSize * 1.02, CITY.blockSize * 1.02);
  for (let cx = 0; cx < CITY.blocks; cx++) {
    for (let cz = 0; cz < CITY.blocks; cz++) {
      const district = districtAt(cx, cz);
      const info = DISTRICT_INFO[district];
      const cxW = -CITY_HALF + CITY.blockSize * (cx + 0.5);
      const czW = -CITY_HALF + CITY.blockSize * (cz + 0.5);
      const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: info.ground, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(cxW, -0.02, czW);
      ground.receiveShadow = true;
      buildingsGroup.add(ground);

      const lotHalf = (CITY.blockSize - CITY.roadWidth) / 2;
      const footHalf = lotHalf - CITY.sidewalkWidth;
      if (footHalf > 2) {
        const w = rng.range(footHalf * 0.9, footHalf * 1.7);
        const d = rng.range(footHalf * 0.9, footHalf * 1.7);
        const h = rng.range(info.heightRange[0], info.heightRange[1]);
        const bx = cxW + rng.range(-0.6, 0.6);
        const bz = czW + rng.range(-0.6, 0.6);
        if (district !== 'hillside' || rng.bool(0.8)) {
          const color = rng.pick(info.buildings);
          const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
          const winMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.5, metalness: 0.2 });
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [winMat, winMat, bodyMat, bodyMat, winMat, winMat]);
          body.position.set(bx, h / 2, bz);
          body.castShadow = true;
          body.receiveShadow = true;
          buildingsGroup.add(body);
          const halfW = w / 2 + 0.15, halfD = d / 2 + 0.15;
          buildingBoxes.push({ minX: bx - halfW, maxX: bx + halfW, minZ: bz - halfD, maxZ: bz + halfD });
        }

        if (info.prop === 'palm' && rng.bool(0.7)) addPalm(propsGroup, cxW + lotHalf * rng.pick([-1, 1]) * 0.92, czW + lotHalf * rng.pick([-1, 1]) * 0.92, rng);
        if (info.prop === 'container' && rng.bool(0.6)) addContainer(propsGroup, cxW + rng.range(-lotHalf * 0.6, lotHalf * 0.6), czW + rng.range(-lotHalf * 0.6, lotHalf * 0.6), rng);
        if (info.prop === 'hedge') addHedgeYard(propsGroup, bx, bz, rng);
        if (info.prop === 'streetlamp' && rng.bool(0.35)) addStreetlamp(propsGroup, cxW + lotHalf * 0.95, czW + lotHalf * 0.95);
      }
      sidewalkPoints.push({ x: cxW + lotHalf * 0.95, z: czW, district });
      parkedSpots.push({ x: cxW, z: czW + lotHalf * 0.6, heading: rng.bool() ? 0 : Math.PI });
    }
  }

  // Roads: a strip along every grid line, lane markings down the middle.
  const roadLen = CITY.blocks * CITY.blockSize + CITY.roadWidth;
  for (let i = 0; i <= CITY.blocks; i++) {
    const pos = -CITY_HALF + i * CITY.blockSize;
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadWidth), new THREE.MeshStandardMaterial({ map: lineTex, color: 0xaaaaaa, roughness: 0.95 }));
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.rotation.z = Math.PI / 2;
    hRoad.position.set(0, 0.01, pos);
    hRoad.receiveShadow = true;
    roadsGroup.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadWidth), new THREE.MeshStandardMaterial({ map: lineTexV, color: 0xaaaaaa, roughness: 0.95 }));
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(pos, 0.011, 0);
    vRoad.receiveShadow = true;
    roadsGroup.add(vRoad);
  }

  // Water beyond the north, west and east edges: docks, marina and beach all front the sea.
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f6f86, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.92 });
  const waterSize = CITY_HALF * 1.6;
  const edges = [
    { x: 0, z: -CITY_HALF - waterSize / 2 - 2, w: CITY_HALF * 2 + waterSize, d: waterSize },
    { x: -CITY_HALF - waterSize / 2 - 2, z: 0, w: waterSize, d: CITY_HALF * 2 + waterSize },
    { x: CITY_HALF + waterSize / 2 + 2, z: 0, w: waterSize, d: CITY_HALF * 2 + waterSize },
  ];
  const waterMeshes = [];
  for (const e of edges) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.d, 1, 1), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(e.x, -0.3, e.z);
    scene.add(water);
    waterMeshes.push(water);
  }

  const roadGraph = buildRoadGraph();
  const bound = CITY_HALF + CITY.roadWidth;

  function resolveBoxCollision(x, z, radius) {
    let hit = false;
    let rx = x, rz = z;
    for (const b of buildingBoxes) {
      const cx = Math.max(b.minX, Math.min(rx, b.maxX));
      const cz = Math.max(b.minZ, Math.min(rz, b.maxZ));
      const dx = rx - cx, dz = rz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = radius - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
        hit = true;
      }
    }
    rx = Math.max(-bound, Math.min(bound, rx));
    rz = Math.max(-bound, Math.min(bound, rz));
    return { x: rx, z: rz, hit };
  }

  return {
    roadGraph,
    buildingBoxes,
    parkedSpots,
    sidewalkPoints,
    waterMeshes,
    bound,
    resolveBoxCollision,
    districtLabelAt(x, z) {
      const cx = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((x + CITY_HALF) / CITY.blockSize)));
      const cz = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((z + CITY_HALF) / CITY.blockSize)));
      return DISTRICT_INFO[districtAt(cx, cz)].label;
    },
  };
}
