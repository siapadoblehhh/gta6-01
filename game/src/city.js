// Solmar, the city itself: a 5x5 grid of blocks on a sun-soaked coast, with a
// beach and a pier to the south. Builds every mesh once, and hands back the
// collision boxes, the road network and the named places missions use.
import * as THREE from 'three';
import { CITY, WORLD } from './config.js';
import { pick, range } from './random.js';

const ROAD_CENTERS = [-150, -90, -30, 30, 90, 150];
const BLOCK_CENTERS = [-120, -60, 0, 60, 120];

// Every place is a point the player can actually stand on: the lot in front
// of a building, the road outside it, the beach — never the middle of a
// building's footprint, where the collision boxes would keep the player out.
export const LANDMARKS = {
  depot: { x: -120, z: 136, name: 'Sunset Courier depot' },
  marina: { x: 60, z: 162, name: 'Marina' },
  garage: { x: 120, z: 90, name: "Big Lou's garage" },
  hideout: { x: 120, z: -90, name: 'Hideout' },
  bank: { x: 0, z: -90, name: 'Meridian Bank' },
  hotel: { x: -60, z: 90, name: 'Palma Hotel' },
  fishMarket: { x: -120, z: 90, name: 'Fish market' },
  lighthouse: { x: 120, z: 196, name: 'Lighthouse pier' },
  hospital: { x: -120, z: -60, name: 'Solmar General' },
  plaza: { x: 0, z: 16, name: 'Plaza del Sol' },
};

// Two shared window textures, drawn once from the seeded rng so the same
// seed paints the same city: a light map the plaster colour shows through,
// and a dark emissive map where only the lit windows glow after dark.
function makeWindowTextures(rng) {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 128;
  mapCanvas.height = 256;
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = 128;
  emissiveCanvas.height = 256;
  const m = mapCanvas.getContext('2d');
  const e = emissiveCanvas.getContext('2d');
  m.fillStyle = '#a8adb5';
  m.fillRect(0, 0, 128, 256);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = rng() < 0.28;
      m.fillStyle = lit ? '#ffd98a' : '#2c3542';
      m.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
      if (lit) {
        e.fillStyle = '#ffd98a';
        e.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
      }
    }
  }
  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 2);
  const emissive = new THREE.CanvasTexture(emissiveCanvas);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = THREE.RepeatWrapping;
  emissive.wrapT = THREE.RepeatWrapping;
  emissive.repeat.set(1, 2);
  return { map, emissive };
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const material = new THREE.MeshLambertMaterial({ color, ...(opts.material || {}) });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCity(world) {
  const { scene, rng } = world;
  const colliders = [];
  const { map: windowTexture, emissive: windowEmissive } = makeWindowTextures(rng);
  const windowMaterials = [];
  const lampHeads = [];

  // Ground: asphalt everywhere, sidewalks on the blocks, sand and sea south.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.ground + 60, WORLD.ground + 60),
    new THREE.MeshLambertMaterial({ color: CITY.road }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.ground + 60, 26),
    new THREE.MeshLambertMaterial({ color: CITY.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, 172);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.ground + 60, 160),
    new THREE.MeshLambertMaterial({ color: CITY.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 265);
  scene.add(sea);

  // Sidewalk slabs, one per block, and dashed centre lines down every road.
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const slab = box(WORLD.block, 0.3, WORLD.block, CITY.sidewalk, bx, 0.15, bz, { cast: false });
      scene.add(slab);
    }
  }
  const dashGeo = new THREE.BoxGeometry(1.2, 0.1, 4);
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  for (const c of ROAD_CENTERS) {
    for (let t = -150; t <= 150; t += 12) {
      const dashX = new THREE.Mesh(dashGeo, dashMat);
      dashX.position.set(t, 0.06, c);
      scene.add(dashX);
      const dashZ = new THREE.Mesh(dashGeo, dashMat);
      dashZ.rotation.y = Math.PI / 2;
      dashZ.position.set(c, 0.06, t);
      scene.add(dashZ);
    }
  }

  // Buildings: every block gets one to three towers, except the plaza (a park)
  // and the depot block (a low depot hall instead).
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === 0 && bz === 0) continue; // Plaza del Sol: park, no towers.
      if (bx === -120 && bz === 120) continue; // Depot block: hall below.
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 12, 26);
        const d = range(rng, 12, 26);
        const h = range(rng, 9, 30);
        const x = bx + range(rng, -10, 10);
        const z = bz + range(rng, -10, 10);
        const color = pick(rng, CITY.buildingColors);
        const material = new THREE.MeshLambertMaterial({
          color,
          map: windowTexture,
          emissive: 0xffc46b,
          emissiveMap: windowEmissive,
          emissiveIntensity: 0,
        });
        windowMaterials.push(material);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        tower.position.set(x, h / 2 + 0.3, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);
        const roof = box(w + 0.6, 0.8, d + 0.6, pick(rng, CITY.roofColors), x, h + 0.7, z);
        scene.add(roof);
        colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      }
    }
  }

  // The depot hall: low, wide, with a teal awning over the door. The hall
  // itself stands at the block's centre; the depot's mission point is the lot
  // in front of it, south of the hall.
  const depot = box(30, 7, 18, 0x4f8f8a, -120, 3.8, 120);
  scene.add(depot);
  const awning = box(12, 0.6, 6, 0xe86a4a, -120, 4.6, 109);
  scene.add(awning);
  colliders.push({ x0: -135, x1: -105, z0: 111, z1: 129 });

  // The park: palms, benches and a fountain ring at the plaza.
  const palmTrunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const palmCrownGeo = new THREE.SphereGeometry(2.6, 8, 6);
  function palm(x, z) {
    const trunk = new THREE.Mesh(palmTrunkGeo, new THREE.MeshLambertMaterial({ color: CITY.palmTrunk }));
    trunk.position.set(x, 3.8, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(palmCrownGeo, new THREE.MeshLambertMaterial({ color: CITY.palmLeaf }));
    crown.scale.y = 0.55;
    crown.position.set(x, 7.6, z);
    crown.castShadow = true;
    scene.add(crown);
  }
  for (let i = 0; i < 26; i += 1) {
    const edge = pick(rng, ['n', 's', 'e', 'w']);
    const t = range(rng, -150, 150);
    if (edge === 'n') palm(t, -156);
    else if (edge === 's') palm(t, 156);
    else if (edge === 'e') palm(156, t);
    else palm(-156, t);
  }
  for (let i = 0; i < 8; i += 1) palm(range(rng, -18, 18), range(rng, -18, 18));
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x7fb8c9 }),
  );
  fountain.position.set(0, 0.9, 0);
  fountain.castShadow = true;
  scene.add(fountain);
  colliders.push({ x0: -6, x1: 6, z0: -6, z1: 6 });

  // The pier and the lighthouse at its end.
  const pier = box(8, 1, 42, 0x8a6a44, LANDMARKS.lighthouse.x, 0.6, 178);
  pier.receiveShadow = true;
  scene.add(pier);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 18, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  tower.position.set(LANDMARKS.lighthouse.x, 9.6, 196);
  tower.castShadow = true;
  scene.add(tower);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0xfff2b0, emissiveIntensity: 1 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), lampMat);
  lamp.position.set(LANDMARKS.lighthouse.x, 19.4, 196);
  scene.add(lamp);
  lampHeads.push(lampMat);
  colliders.push({ x0: LANDMARKS.lighthouse.x - 3, x1: LANDMARKS.lighthouse.x + 3, z0: 193, z1: 199 });

  // Streetlights along the roads; their heads glow after dark.
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const c of ROAD_CENTERS) {
    for (let t = -120; t <= 120; t += 60) {
      for (const [x, z] of [[c + 8, t], [t, c + 8]]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3, z);
        scene.add(pole);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x444444, emissive: 0xffe9a8, emissiveIntensity: 0 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(x, 6.2, z);
        scene.add(head);
        lampHeads.push(headMat);
      }
    }
  }

  return {
    colliders,
    roads: ROAD_CENTERS,
    landmarks: LANDMARKS,
    // Night falls: windows and lamps light up, and the sea darkens with them.
    setNight(frac) {
      for (const m of windowMaterials) m.emissiveIntensity = frac * 0.9;
      for (const m of lampHeads) m.emissiveIntensity = frac * 1.6;
    },
  };
}

// Circle (a person or a car) against the building boxes: push it out and say
// how hard it hit, so the caller can turn a hard hit into damage.
export function collideCircle(pos, radius, colliders) {
  let hit = 0;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-6) {
      pos.x = c.x1 + radius;
      hit = 1;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    pos.x += dx * push;
    pos.z += dz * push;
    hit = Math.max(hit, 1 - d / radius);
  }
  return hit;
}

export function clampToCity(pos, radius) {
  const half = 163;
  pos.x = Math.max(-half + radius, Math.min(half - radius, pos.x));
  pos.z = Math.max(-half + radius, Math.min(half - radius, pos.z));
}
