// The HUD: wanted stars, cash, health, the mission panel, the speedometer,
// the minimap and the toasts — all plain DOM over the canvas, plus the title,
// pause and end overlays. The minimap is a little canvas that redraws the
// city, the player, the police and the objective every frame.
import { missionObjective, missionTimer } from './missions.js';

const MAP_SIZE = 180;
const MAP_SCALE = MAP_SIZE / 340;

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'),
    stars: $('stars'),
    cash: $('cash'),
    health: $('health-fill'),
    healthText: $('health-text'),
    missionTitle: $('mission-title'),
    missionText: $('mission-text'),
    missionTimer: $('mission-timer'),
    speed: $('speed'),
    prompt: $('prompt'),
    toasts: $('toasts'),
    map: $('minimap'),
    title: $('title-screen'),
    pause: $('pause-screen'),
    end: $('end-screen'),
    endTitle: $('end-title'),
    endText: $('end-text'),
    best: $('best'),
  };
  const mapCtx = els.map.getContext('2d');
  let lastStars = -1;
  let lastCash = -1;
  let lastHealth = -1;
  let toastTimer = 0;

  function showToast(text) {
    els.toasts.textContent = text;
    els.toasts.style.opacity = '1';
    toastTimer = 3;
  }

  function drawMinimap() {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#141a20';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea at the bottom edge.
    ctx.fillStyle = '#1d5f6e';
    ctx.fillRect(0, MAP_SIZE - 14, MAP_SIZE, 14);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (const road of world.city.roads) {
      const c = (road + 170) * MAP_SCALE;
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, c);
      ctx.lineTo(MAP_SIZE, c);
      ctx.stroke();
    }
    const toMap = (p) => ({ x: (p.x + 170) * MAP_SCALE, y: (p.z + 170) * MAP_SCALE });
    // Cash pickups.
    ctx.fillStyle = '#d9a441';
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const q = toMap(pickup.pos);
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    // Mission beacon.
    const m = world.missions;
    if (m.beacon.visible) {
      const q = toMap(m.beacon.position);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - 7);
      ctx.lineTo(q.x + 6, q.y);
      ctx.lineTo(q.x, q.y + 7);
      ctx.lineTo(q.x - 6, q.y);
      ctx.closePath();
      ctx.fill();
    }
    // Police as red dots.
    ctx.fillStyle = '#ff4040';
    for (const car of world.police) {
      const q = toMap(car.pos);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player as a white arrow, turned to their heading.
    const p = toMap(world.player.pos);
    const heading = world.player.inCar ? world.player.inCar.yaw : world.player.yaw;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) els.toasts.style.opacity = '0';
    }
    const { player, wanted } = world;
    if (wanted.stars !== lastStars) {
      lastStars = wanted.stars;
      els.stars.textContent = '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars);
      els.stars.style.color = wanted.stars > 0 ? '#ff5040' : '#c8ccd2';
    }
    if (player.cash !== lastCash) {
      lastCash = player.cash;
      els.cash.textContent = `$${player.cash.toLocaleString('en-US')}`;
    }
    const hp = Math.max(0, Math.round(player.health));
    if (hp !== lastHealth) {
      lastHealth = hp;
      els.health.style.width = `${hp}%`;
      els.healthText.textContent = `${hp}`;
    }
    const obj = missionObjective(world);
    els.missionTitle.textContent = obj.title;
    els.missionText.textContent = obj.distance > 0 ? `${obj.text} — ${obj.distance}m` : obj.text;
    const timer = missionTimer(world);
    els.missionTimer.textContent = timer > 0 ? `⏱ ${Math.ceil(timer)}s` : '';
    els.speed.textContent = player.inCar ? `${Math.round(Math.abs(player.inCar.speed) * 3.6)} km/h` : '';
    // Context prompt: what E does right now.
    let prompt = '';
    if (!player.inCar) {
      let best = null;
      let bestD = 4.5;
      for (const car of world.cars) {
        if (car.kind === 'police') continue;
        const dx = car.pos.x - player.pos.x;
        const dz = car.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) prompt = best.owned ? 'E — Get in your car' : 'E — Steal car';
    } else {
      prompt = 'E — Get out    •    Space — Handbrake';
    }
    els.prompt.textContent = prompt;
    drawMinimap();
  }

  function setScreen(screen, data = {}) {
    els.title.style.display = screen === 'title' ? 'flex' : 'none';
    els.pause.style.display = screen === 'paused' ? 'flex' : 'none';
    els.end.style.display = screen === 'busted' || screen === 'wasted' || screen === 'complete' ? 'flex' : 'none';
    els.hud.style.display = screen === 'play' ? 'block' : 'none';
    if (screen === 'busted') {
      els.endTitle.textContent = 'Busted!';
      els.endText.textContent = `The Solmar PD caught Dana. You lost $${data.lost || 0} and woke up at the hospital.`;
    } else if (screen === 'wasted') {
      els.endTitle.textContent = 'Wasted';
      els.endText.textContent = `Dana is out cold. You lost $${data.lost || 0} and woke up at the hospital.`;
    } else if (screen === 'complete') {
      els.endTitle.textContent = 'The Big Score — done!';
      els.endText.textContent = `Every job finished. Dana earned $${data.cash || 0} in Solmar. Free roam is open — the city is yours.`;
    }
    if (data.best !== undefined) els.best.textContent = `Best haul: $${data.best.toLocaleString('en-US')}`;
  }

  world.toast = showToast;
  return { update, setScreen };
}
