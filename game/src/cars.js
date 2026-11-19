// Cars: one mesh factory and one arcade driving model, shared by the player's
// cars, traffic and the police, so they all handle the same way.
import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircle, clampToCity } from './city.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10);

export function makeCarMesh(color, kind = 'civil') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 4.4), bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.55, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.55, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights: the front pair glows after dark.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat);
    head.position.set(x, 0.95, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x800000, emissiveIntensity: 0.6 }));
    tail.position.set(x, 0.95, -2.22);
    group.add(tail);
  }
  if (kind === 'police') {
    // Black-and-white patrol livery with a light bar.
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.5, 1.6), new THREE.MeshLambertMaterial({ color: 0x111417 }));
    door.position.set(0, 0.95, 0.2);
    group.add(door);
    const barMat = new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xff2020, emissiveIntensity: 1 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), barMat);
    bar.position.set(0, 2.05, -0.2);
    group.add(bar);
    group.userData.lightBar = barMat;
  }
  group.userData.headlights = headMat;
  return { group, wheels, headMat };
}

export function makeCar(color, kind, x, z, yaw) {
  const { group, wheels, headMat } = makeCarMesh(color, kind);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return {
    group,
    wheels,
    headMat,
    kind,
    pos: group.position,
    yaw,
    speed: 0,
    steer: 0,
    // Traffic AI state; the player and the police leave these alone.
    axis: 'x',
    lane: 0,
    dir: 1,
    cruise: 10,
    stuck: 0,
  };
}

// Arcade driving: accelerate, brake, reverse, steer more at low speed, and a
// little slide. Returns how hard the car hit something this step (0 = clean).
export function stepDrive(car, dt, throttle, steerInput, handbrake, colliders) {
  const prevSpeed = car.speed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverse * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerTarget = steerInput * CAR.steer * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, CAR.grip * dt);
  car.yaw += (car.steer * car.speed) / 4.4 * dt * (handbrake ? 1.6 : 1);
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  clampToCity(car.pos, CAR.radius);
  const hit = collideCircle(car.pos, CAR.radius, colliders);
  if (hit > 0) {
    // A wall eats the speed that drove into it; a hard hit costs health later.
    car.speed *= 1 - 0.55 * hit;
  }
  car.group.rotation.y = car.yaw;
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 1.8;
  return Math.abs(prevSpeed - car.speed) > 14 ? 1 : hit > 0.55 ? 0.6 : 0;
}

export function carForward(car) {
  return { x: Math.sin(car.yaw), z: Math.cos(car.yaw) };
}

export function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
