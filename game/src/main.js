// Solmar Sunset: boot and the one loop. The world is a plain object every
// module reads and writes; this file wires the modules, runs the fixed-step
// loop, moves the sun through its day, and owns the screens (title, play,
// paused, busted, wasted, complete). ?shot=start|play|night|end stages one
// fixed scene instead of running the loop, paints twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { BEST_KEY, PLAYER, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { buildCity } from './city.js';
import { makeCar } from './cars.js';
import { createTraffic } from './traffic.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8f0);
scene.fog = new THREE.Fog(0x9fc8e0, 120, 340);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
camera.position.set(-60, 40, 170);

const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.camera.far = 500;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a44, 0.9);
scene.add(hemi);

const world = {
  scene,
  camera,
  renderer,
  rng: createRandom(seed),
  time: 0,
  dayFrac: 0.08,
  screen: 'title',
  completedShown: false,
  cameraOverride: null,
  toast() {},
  announce(message) {
    statusEl.textContent = message;
  },
};

// The day: the sun circles, the sky warms at dawn and dusk and cools at noon,
// and after dark the windows and streetlights come on.
const SKY_NOON = new THREE.Color(0x7ec8f0);
const SKY_DAWN = new THREE.Color(0xff9a5c);
const SKY_NIGHT = new THREE.Color(0x0d1626);
const skyColor = new THREE.Color();
function setDayFrac(frac) {
  world.dayFrac = ((frac % 1) + 1) % 1;
  const angle = world.dayFrac * Math.PI * 2;
  const up = Math.sin(angle);
  sun.position.set(Math.cos(angle) * 160, Math.max(12, up * 160), 80);
  sun.intensity = 0.45 + 1.9 * Math.max(0, up);
  sun.color.setHex(up > 0.55 ? 0xfff2d8 : 0xffb070);
  hemi.intensity = 0.38 + 0.6 * Math.max(0, up);
  if (up > 0) skyColor.lerpColors(SKY_DAWN, SKY_NOON, Math.min(1, up * 1.6));
  else skyColor.copy(SKY_NIGHT);
  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);
  const night = 1 - Math.max(0, Math.min(1, up * 1.4 + 0.3));
  world.city.setNight(night);
  for (const car of world.cars) {
    if (car.headMat) car.headMat.emissiveIntensity = night * 1.4;
  }
}
world.setDayFrac = setDayFrac;

world.city = buildCity(world);
world.traffic = createTraffic(world);
world.cars = [...world.traffic.cars];
createPlayer(world);
createPolice(world);
createMissions(world);

// The player's own car at the depot, a coupe to borrow by the plaza, and two
// more parked cars around town for anyone who likes to borrow things.
function parkCar(color, x, z, yaw, owned) {
  const car = makeCar(color, 'parked', x, z, yaw);
  car.owned = owned;
  world.scene.add(car.group);
  world.cars.push(car);
  return car;
}
parkCar(0x2e6da4, -108, 142, Math.PI * 0.7, true);
parkCar(0xb03a2e, 20, 20, Math.PI * 0.25, false);
parkCar(0xd9a441, 60, 84, 0, false);
parkCar(0x5a7d5a, 66, 150, Math.PI, false);

// Cash bundles and health packs, scattered on the sidewalks by the seed.
world.pickups = [];
function addPickup(kind, x, z, value) {
  let mesh;
  if (kind === 'cash') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: 0xd9a441, emissive: 0x8a6a10, emissiveIntensity: 0.5 }));
  } else {
    const group = new THREE.Group();
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.1), new THREE.MeshLambertMaterial({ color: 0xc02020 }));
    crossA.position.z = 0.62;
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.1), new THREE.MeshLambertMaterial({ color: 0xc02020 }));
    crossB.position.z = 0.62;
    group.add(boxMesh, crossA, crossB);
    mesh = group;
  }
  mesh.position.set(x, 1, z);
  mesh.castShadow = true;
  world.scene.add(mesh);
  world.pickups.push({ mesh, pos: mesh.position, kind, value, taken: false });
}
{
  const spots = [
    [-60, -120], [60, -120], [-120, 0], [120, 0], [-60, 120], [60, -60],
    [0, 120], [-120, -120], [90, 30], [-30, -30],
  ];
  for (let i = 0; i < 8; i += 1) addPickup('cash', spots[i][0], spots[i][1], 50);
  addPickup('health', -90, 90, 0);
  addPickup('health', 90, -90, 0);
  addPickup('health', 0, 150, 0);
}

world.audio = createAudio();
world.input = createInput(canvas);
const hud = createHud(world);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage off: the best haul lasts this visit only.
  }
}
let best = readBest();
try {
  const save = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  if (save && typeof save === 'object') {
    if (Number.isFinite(save.cash)) world.player.cash = save.cash;
    if (Number.isInteger(save.mission)) world.missions.index = Math.min(5, save.mission);
  }
} catch {
  // A corrupt save starts fresh.
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const { player } = world;
  if (world.cameraOverride) {
    camera.position.copy(world.cameraOverride.pos);
    camera.lookAt(world.cameraOverride.lookAt);
    return;
  }
  const target = player.inCar ? player.inCar.pos : player.pos;
  const dist = player.inCar ? 15 : 10.5;
  const height = player.inCar ? 5.5 : 4.2;
  const cx = target.x + Math.sin(player.camYaw) * Math.cos(player.camPitch) * dist;
  const cz = target.z + Math.cos(player.camYaw) * Math.cos(player.camPitch) * dist;
  const cy = target.y + height + Math.sin(player.camPitch) * dist * 0.7;
  const k = Math.min(1, 8 * dt);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (Math.max(2.2, cy) - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(target.x, target.y + 2.2, target.z);
}

function respawn(lost) {
  const { player } = world;
  if (player.inCar) player.inCar = null;
  player.mesh.visible = true;
  player.health = PLAYER.health;
  player.invulnerable = 2;
  player.cash = Math.max(0, player.cash - lost);
  const hospital = world.city.landmarks.hospital;
  // On the street outside the hospital, never inside a building.
  player.pos.set(hospital.x, 0, hospital.z + 30);
  player.mesh.position.copy(player.pos);
  player.yaw = 0;
  player.camYaw = 0;
  world.wanted.stars = 0;
  world.wanted.coolTimer = 0;
  world.busted = false;
  world.wasted = false;
  world.bustTimer = 0;
  for (const car of [...world.police]) {
    world.scene.remove(car.group);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }
  world.police.length = 0;
  world.missions.status = 'idle';
  world.missions.beacon.visible = false;
}

function startGame() {
  world.screen = 'play';
  hud.setScreen('play');
  world.audio.unlock();
  world.announce('Playing. Walk to the depot beacon to start the first job. Steal a car with E.');
}

function step(dt) {
  world.time += dt;
  world.dayFrac = (world.dayFrac + dt / 300) % 1;
  setDayFrac(world.dayFrac);
  updatePlayer(world, dt);
  world.traffic.update(dt);
  updatePolice(world, dt);
  updateMissions(world, dt);
  world.audio.update(world);
  for (const pickup of world.pickups) {
    if (!pickup.taken) pickup.mesh.rotation.y += dt * 1.5;
  }
  if (world.player.cash > best) {
    best = world.player.cash;
    saveBest(best);
  }
  if (world.busted || world.wasted) {
    const lost = Math.floor(world.player.cash * 0.15);
    world.screen = world.busted ? 'busted' : 'wasted';
    hud.setScreen(world.screen, { lost, best });
    world.announce(world.busted ? 'Busted by the Solmar PD.' : 'Wasted. Dana is out cold.');
    respawn(lost);
  } else if (world.missions.index >= 5 && !world.completedShown) {
    world.completedShown = true;
    world.screen = 'complete';
    hud.setScreen('complete', { cash: world.player.cash, best });
    world.announce('Every job finished. Solmar is yours.');
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  const { input } = world;
  if (input.wasPressed('pause') && (world.screen === 'play' || world.screen === 'paused')) {
    world.screen = world.screen === 'play' ? 'paused' : 'play';
    hud.setScreen(world.screen);
    world.announce(world.screen === 'paused' ? 'Paused.' : 'Playing.');
  }
  if (input.wasPressed('mute')) {
    const muted = world.audio.toggleMute();
    world.toast(muted ? 'Sound off' : 'Sound on');
  }
  if (input.wasPressed('confirm') && world.screen === 'title') startGame();
  else if (input.wasPressed('confirm') && (world.screen === 'busted' || world.screen === 'wasted' || world.screen === 'complete')) {
    world.screen = 'play';
    hud.setScreen('play');
    world.announce('Back on the streets of Solmar.');
  }
  if (world.screen === 'play') {
    let acc = dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
      if (world.screen !== 'play') break;
    }
  } else if (world.screen === 'title') {
    // The title's backdrop: traffic rolls and the sun creeps, the city alive
    // behind the menu.
    world.time += dt;
    world.traffic.update(dt);
    const t = world.time * 0.05;
    world.cameraOverride = {
      pos: new THREE.Vector3(Math.sin(t) * 120, 55, Math.cos(t) * 120 + 20),
      lookAt: new THREE.Vector3(0, 4, 0),
    };
  }
  updateCamera(dt);
  if (world.screen !== 'title') world.cameraOverride = null;
  hud.update(dt);
  input.endFrame();
  renderer.render(scene, camera);
}

function runShot(name) {
  const sceneInfo = stageShot(name, world);
  hud.setScreen(sceneInfo.screen, { cash: sceneInfo.cash ?? 0, best });
  hud.update(0);
  updateCamera(0);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

let last = performance.now();
if (shot) {
  runShot(shot);
} else {
  hud.setScreen('title', { best });
  world.announce('Solmar Sunset. Press Enter to start.');
  requestAnimationFrame(frame);
}

// A handle for the playtest harness and the finalist review.
window.__solmar = world;
