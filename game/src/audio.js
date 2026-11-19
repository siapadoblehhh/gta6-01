// Sound, synthesized live with WebAudio: an engine hum that follows the
// speed, a two-tone siren while the cops are after you, and little blips for
// pickups, crashes and mission jingles. No audio files, no network. Everything
// is guarded: a browser with no audio just plays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.5, when = 0) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.14;
      return muted;
    },
    blip() {
      tone(880, 0.12, 'sine', 0.5);
      tone(1320, 0.16, 'sine', 0.4, 0.08);
    },
    crash() {
      tone(90, 0.25, 'sawtooth', 0.7);
      tone(55, 0.3, 'square', 0.4, 0.02);
    },
    jingle() {
      tone(523, 0.14, 'sine', 0.5);
      tone(659, 0.14, 'sine', 0.5, 0.12);
      tone(784, 0.3, 'sine', 0.5, 0.24);
    },
    update(world) {
      if (!ctx) return;
      try {
        const speed = world.player.inCar ? Math.abs(world.player.inCar.speed) : 0;
        if (engineGain) {
          engineGain.gain.value = world.player.inCar ? 0.05 + Math.min(0.12, speed * 0.003) : 0;
          engineOsc.frequency.value = 55 + speed * 4;
        }
        if (sirenGain) {
          const wanted = world.wanted.stars;
          sirenGain.gain.value = wanted > 0 ? 0.045 : 0;
          if (wanted > 0) sirenOsc.frequency.value = Math.sin(world.time * 6) > 0 ? 700 : 950;
        }
      } catch {
        // See above.
      }
    },
  };
}
