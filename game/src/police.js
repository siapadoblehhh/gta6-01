// The law: a wanted level that rises with every crime, patrol cars that
// chase the player, and the two ways a run ends — busted or wasted.
import * as THREE from 'three';
import { CAR, POLICE } from './config.js';
import { makeCar, stepDrive, distance2D } from './cars.js';
import { pick } from './random.js';

export function addCrime(world, stars) {
  const { wanted } = world;
  wanted.stars = Math.min(5, wanted.stars + stars);
  wanted.lastCrime = world.time;
  wanted.coolTimer = 0;
}

function spawnPoliceCar(world, near) {
  const { scene, rng, city } = world;
  const road = pick(rng, city.roads);
  const axis = rng() < 0.5 ? 'x' : 'z';
  const x = axis === 'x' ? near.x + (rng() < 0.5 ? -60 : 60) : road;
  const z = axis === 'z' ? near.z + (rng() < 0.5 ? -60 : 60) : road;
  const car = makeCar(0xf2f2f2, 'police', Math.max(-150, Math.min(150, x)), Math.max(-150, Math.min(150, z)), rng() * Math.PI * 2);
  car.cruise = POLICE.chaseSpeed;
  scene.add(car.group);
  world.cars.push(car);
  world.police.push(car);
  return car;
}

export function createPolice(world) {
  world.wanted = { stars: 0, lastCrime: -1e9, coolTimer: 0 };
  world.police = [];
  world.busted = false;
  world.wasted = false;
  world.bustTimer = 0;
}

export function updatePolice(world, dt) {
  const { wanted, player } = world;
  const target = player.inCar ? player.inCar.pos : player.pos;
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;

  // Enough patrol cars for the wanted level; extras drive off and despawn.
  const want = POLICE.carsPerStar[Math.min(5, wanted.stars)];
  while (world.police.length < want) spawnPoliceCar(world, target);
  while (world.police.length > want) {
    const car = world.police.pop();
    world.scene.remove(car.group);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }

  // Cooling off: no crime for a while, and no patrol car in sight, and the
  // stars start to drop one at a time.
  const nearest = world.police.reduce((best, car) => Math.min(best, distance2D(car.pos, target)), 1e9);
  if (wanted.stars > 0 && world.time - wanted.lastCrime > POLICE.coolDown && nearest > 45) {
    wanted.coolTimer += dt;
    if (wanted.coolTimer > 8) {
      wanted.stars -= 1;
      wanted.coolTimer = 0;
      world.toast(wanted.stars === 0 ? 'You lost them.' : `Wanted level down to ${wanted.stars}.`);
    }
  } else {
    wanted.coolTimer = 0;
  }

  // The chase: steer at the player, ram on foot, and bust them if they stand
  // still long enough next to a patrol car.
  for (const car of world.police) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dy * 2.2));
    const throttle = dist > 6 ? 1 : 0.4;
    stepDrive(car, dt, throttle, steer, false, world.city.colliders);
    if (car.headMat) car.headMat.emissiveIntensity = 0.6 + 0.6 * Math.sin(world.time * 10);
    if (car.group.userData.lightBar) {
      car.group.userData.lightBar.emissive.setHex(Math.sin(world.time * 10) > 0 ? 0xff2020 : 0x2040ff);
    }
    // A ram hurts, on foot or in a car.
    if (dist < CAR.radius + 1.2 && Math.abs(car.speed) > 5) {
      if (player.invulnerable <= 0) {
        player.health -= POLICE.ramDamage * dt * 3;
        player.invulnerable = 0.4;
        world.audio.crash();
        if (player.health <= 0) world.wasted = true;
      }
      if (player.inCar) player.inCar.speed *= 0.92;
    }
    // Busted: on foot, next to a patrol car, not moving away.
    if (!player.inCar && dist < POLICE.bustDistance && playerSpeed < 2) {
      world.bustTimer += dt;
      if (world.bustTimer > 1.5) world.busted = true;
    } else {
      world.bustTimer = Math.max(0, world.bustTimer - dt * 2);
    }
    // A patrol car stuck on a wall for too long re-deploys near the player.
    if (Math.abs(car.speed) < 0.5) car.stuck += dt;
    else car.stuck = 0;
    if (car.stuck > 4) {
      car.pos.set(target.x + 50, 0, target.z - 50);
      car.stuck = 0;
    }
  }
}
