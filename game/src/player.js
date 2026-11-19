// Dana Cole on foot and behind the wheel: walking, running, stealing cars,
// driving with arcade physics, and the collisions that turn a bad drive into
// a crime or a hospital bill.
import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';
import { stepDrive, distance2D } from './cars.js';
import { collideCircle, clampToCity } from './city.js';
import { addCrime } from './police.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.3, 10), new THREE.MeshLambertMaterial({ color: 0xe86a4a }));
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 2.15;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshLambertMaterial({ color: 0x2e3138 }));
  cap.position.y = 2.22;
  group.add(cap);
  return group;
}

export function createPlayer(world) {
  const mesh = makePlayerMesh();
  const start = world.city.landmarks.depot;
  // On the open lot south of the hall, a short walk from the depot beacon.
  mesh.position.set(start.x, 0, start.z + 10);
  world.scene.add(mesh);
  const player = {
    mesh,
    pos: mesh.position,
    yaw: Math.PI * 0.75,
    camYaw: Math.PI * 0.75,
    camPitch: 0.32,
    health: PLAYER.health,
    cash: 0,
    inCar: null,
    invulnerable: 0,
    speed: 0,
  };
  world.player = player;
  return player;
}

export function updatePlayer(world, dt) {
  const { input, player } = world;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  // Camera orbit from the mouse drag, clamped so it never goes under the ground.
  const drag = input.takeDrag();
  player.camYaw -= drag.x * 0.005;
  player.camPitch = Math.max(0.08, Math.min(1.1, player.camPitch + drag.y * 0.004));

  if (player.inCar) {
    updateDriving(world, dt);
    return;
  }
  updateOnFoot(world, dt);
}

function updateOnFoot(world, dt) {
  const { input, player } = world;
  // Forward is the way the camera looks: away from the camera, toward the
  // player. Right is ninety degrees clockwise from that, seen from above.
  const fwdX = -Math.sin(player.camYaw);
  const fwdZ = -Math.cos(player.camYaw);
  const rightX = Math.cos(player.camYaw);
  const rightZ = -Math.sin(player.camYaw);
  let mx = 0;
  let mz = 0;
  if (input.isDown('forward')) { mx += fwdX; mz += fwdZ; }
  if (input.isDown('back')) { mx -= fwdX; mz -= fwdZ; }
  if (input.isDown('left')) { mx -= rightX; mz -= rightZ; }
  if (input.isDown('right')) { mx += rightX; mz += rightZ; }
  const len = Math.hypot(mx, mz);
  const speed = input.isDown('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (len > 0) {
    mx /= len;
    mz /= len;
    player.pos.x += mx * speed * dt;
    player.pos.z += mz * speed * dt;
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.yaw += dy * Math.min(1, 12 * dt);
    player.speed = speed;
    // A little walk bob.
    player.mesh.position.y = Math.abs(Math.sin(world.time * 10)) * 0.08;
  } else {
    player.speed = 0;
    player.mesh.position.y = 0;
  }
  player.mesh.rotation.y = player.yaw;
  collideCircle(player.pos, PLAYER.radius, world.city.colliders);
  clampToCity(player.pos, PLAYER.radius);
  // Shoulder-check the cars and the pedestrians.
  for (const car of world.cars) {
    const d = distance2D(player.pos, car.pos);
    if (d < CAR.radius + PLAYER.radius && d > 0.01) {
      const push = (CAR.radius + PLAYER.radius - d) / d;
      player.pos.x += (player.pos.x - car.pos.x) * push;
      player.pos.z += (player.pos.z - car.pos.z) * push;
    }
  }

  // E near a car: take it. Your own depot car is free; anything else is theft.
  if (input.wasPressed('enter')) {
    let best = null;
    let bestD = 4.5;
    for (const car of world.cars) {
      if (car.kind === 'police') continue;
      const d = distance2D(player.pos, car.pos);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      player.inCar = best;
      best.kind = 'player';
      player.mesh.visible = false;
      player.camYaw = best.yaw;
      if (best.stolen !== true && best.owned !== true) {
        best.stolen = true;
        addCrime(world, 1, 'Grand theft auto');
        world.toast('You stole the car — the cops noticed.');
      }
      world.audio.blip();
    }
  }

  collectPickups(world);
}

function updateDriving(world, dt) {
  const { input, player } = world;
  const car = player.inCar;
  const throttle = (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0);
  const steer = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);
  const hard = stepDrive(car, dt, throttle, steer, input.isDown('handbrake'), world.city.colliders);
  if (hard > 0 && player.invulnerable <= 0) {
    player.health -= 6 * hard;
    player.invulnerable = 0.6;
    world.audio.crash();
    if (player.health <= 0) world.wasted = true;
  }
  player.pos.copy(car.pos);

  // Car against car: shove apart, trade speed, and a police car counts as a crime.
  for (const other of world.cars) {
    if (other === car) continue;
    const d = distance2D(car.pos, other.pos);
    const min = CAR.radius * 2;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2 / d;
      const px = (car.pos.x - other.pos.x) * push;
      const pz = (car.pos.z - other.pos.z) * push;
      car.pos.x += px;
      car.pos.z += pz;
      other.pos.x -= px;
      other.pos.z -= pz;
      const exchange = car.speed * 0.3;
      car.speed -= exchange;
      other.speed += exchange * 0.5;
      if (other.kind === 'police' && Math.abs(car.speed) > 4) addCrime(world, 1, 'Hit a patrol car');
    }
  }
  // Car against pedestrian: they go down, and the law notices.
  for (const ped of world.traffic.peds) {
    if (ped.down > 0) continue;
    const d = distance2D(car.pos, ped.pos);
    if (d < CAR.radius + 0.8 && Math.abs(car.speed) > 3) {
      ped.down = 5;
      ped.mesh.rotation.z = Math.PI / 2;
      addCrime(world, 1, 'Hit a pedestrian');
      world.toast('You hit a pedestrian!');
      world.audio.crash();
    }
  }

  if (input.wasPressed('enter')) {
    const side = { x: Math.cos(car.yaw), z: -Math.sin(car.yaw) };
    player.inCar = null;
    player.mesh.visible = true;
    player.pos.set(car.pos.x + side.x * 3, 0, car.pos.z + side.z * 3);
    player.mesh.position.copy(player.pos);
    player.yaw = car.yaw;
    collideCircle(player.pos, PLAYER.radius, world.city.colliders);
  }
  collectPickups(world);
}

function collectPickups(world) {
  const { player } = world;
  const pos = player.inCar ? player.inCar.pos : player.pos;
  for (const pickup of world.pickups) {
    if (pickup.taken) continue;
    if (distance2D(pos, pickup.pos) < 3) {
      pickup.taken = true;
      pickup.mesh.visible = false;
      if (pickup.kind === 'cash') {
        player.cash += pickup.value;
        world.toast(`+$${pickup.value} cash`);
        world.audio.blip();
      } else {
        player.health = Math.min(PLAYER.health, player.health + 40);
        world.toast('Health +40');
        world.audio.blip();
      }
    }
  }
}
