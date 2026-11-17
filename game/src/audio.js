// Every sound in Costa Aurelia is synthesised at runtime with the Web Audio API: no audio files,
// so nothing to vendor and nothing to fetch. Each function fires one short, cheap sound graph that
// tears itself down when it finishes; the engine and siren loops hold their nodes and are told to
// update, not retriggered every frame.
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function resumeAudio() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
  return c;
}

function noiseBuffer(c, duration) {
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createAudio() {
  const master = getCtx().createGain();
  master.gain.value = 0.55;
  master.connect(getCtx().destination);

  function tone(freq, duration, type = 'sine', gainPeak = 0.3, slideTo = null) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, c.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(gainPeak, c.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  function punch() {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.12);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    tone(120, 0.1, 'sine', 0.3, 60);
  }

  function gunshot() {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.2);
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.6, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    tone(220, 0.08, 'sawtooth', 0.25, 90);
  }

  function scream() {
    tone(900, 0.28, 'sawtooth', 0.12, 500);
  }

  function honk() {
    tone(330, 0.3, 'square', 0.18, 320);
  }

  function hit() {
    tone(180, 0.15, 'triangle', 0.25, 90);
  }

  function uiClick() {
    tone(660, 0.07, 'sine', 0.18, 880);
  }

  function pickup() {
    tone(520, 0.08, 'sine', 0.2, 880);
    setTimeout(() => tone(880, 0.1, 'sine', 0.18, 1200), 70);
  }

  function missionDone() {
    tone(440, 0.14, 'sine', 0.22, 660);
    setTimeout(() => tone(660, 0.18, 'sine', 0.22, 990), 120);
  }

  // Engine: a persistent oscillator + noise bed whose pitch and gain track vehicle speed.
  function createEngineLoop() {
    const c = getCtx();
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const gain = c.createGain();
    gain.gain.value = 0;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.connect(filter).connect(gain).connect(master);
    osc.frequency.value = 60;
    osc.start();
    let active = false;
    return {
      set(running, speedFrac) {
        if (running && !active) { active = true; }
        if (!running && active) { active = false; }
        const g = running ? 0.07 + speedFrac * 0.1 : 0;
        gain.gain.linearRampToValueAtTime(g, c.currentTime + 0.08);
        osc.frequency.linearRampToValueAtTime(55 + speedFrac * 260, c.currentTime + 0.08);
        filter.frequency.linearRampToValueAtTime(300 + speedFrac * 1200, c.currentTime + 0.08);
      },
      stop() { gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.1); },
    };
  }

  function createSirenLoop() {
    const c = getCtx();
    const osc = c.createOscillator();
    osc.type = 'sine';
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    let t = 0;
    return {
      update(dt, on, volume = 1) {
        t += dt;
        const freq = 600 + Math.sin(t * 6) * 260;
        osc.frequency.setValueAtTime(freq, c.currentTime);
        gain.gain.linearRampToValueAtTime(on ? 0.14 * volume : 0, c.currentTime + 0.1);
      },
    };
  }

  function createAmbience() {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 4);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = c.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { setVolume(v) { gain.gain.value = v * 0.05; } };
  }

  return {
    setMasterVolume(v) { master.gain.value = v; },
    punch, gunshot, scream, honk, hit, uiClick, pickup, missionDone,
    createEngineLoop, createSirenLoop, createAmbience,
  };
}
