class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = on ? 0.18 : 0;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone({ freq = 220, dur = 0.12, type = 'sine', gain = 0.3, slide = 0, delay = 0, detune = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.14, gain = 0.25, delay = 0, low = 400 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  chord(freqs, { dur = 0.5, type = 'sine', gain = 0.12, delay = 0, spread = 0.04 } = {}) {
    freqs.forEach((f, i) => this.tone({ freq: f, dur, type, gain, delay: delay + i * spread }));
  }

  click() { this.tone({ freq: 180, dur: 0.05, type: 'square', gain: 0.08 }); }
  move() { this.tone({ freq: 95, dur: 0.04, type: 'triangle', gain: 0.09 }); }
  hit() { this.noise({ dur: 0.11, gain: 0.22, low: 700 }); this.tone({ freq: 110, dur: 0.09, type: 'sawtooth', gain: 0.12, slide: -60 }); }
  crit() { this.noise({ dur: 0.2, gain: 0.3, low: 1400 }); this.tone({ freq: 300, dur: 0.18, type: 'square', gain: 0.14, slide: -180 }); }
  miss() { this.tone({ freq: 150, dur: 0.08, type: 'sine', gain: 0.08, slide: 90 }); }
  heal() { this.chord([392, 523, 659], { dur: 0.35, type: 'sine', gain: 0.1 }); }
  hurt() { this.noise({ dur: 0.2, gain: 0.26, low: 350 }); this.tone({ freq: 70, dur: 0.24, type: 'triangle', gain: 0.16, slide: -20 }); }
  death() { this.chord([110, 130.8, 155.6], { dur: 1.1, type: 'sawtooth', gain: 0.09 }); this.noise({ dur: 0.8, gain: 0.18, low: 200 }); }
  echo() {
    this.chord([146.8, 174.6, 207.7, 293.7], { dur: 1.8, type: 'sine', gain: 0.1, spread: 0.12 });
    this.chord([293.7, 349.2, 415.3], { dur: 1.4, type: 'triangle', gain: 0.045, delay: 0.25, spread: 0.1 });
    this.tone({ freq: 73.4, dur: 2, type: 'sine', gain: 0.12 });
  }
  descend() { this.tone({ freq: 110, dur: 0.8, type: 'sine', gain: 0.13, slide: -40 }); this.noise({ dur: 0.5, gain: 0.1, low: 600 }); }
  loot() { this.tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.1 }); this.tone({ freq: 990, dur: 0.12, type: 'triangle', gain: 0.08, delay: 0.08 }); }
  trap() { this.noise({ dur: 0.3, gain: 0.3, low: 1000 }); this.tone({ freq: 90, dur: 0.2, type: 'sawtooth', gain: 0.12, slide: -40 }); }
  victory() { this.chord([261.6, 329.6, 392, 523.2], { dur: 1.6, type: 'sine', gain: 0.13, spread: 0.14 }); }
}

export const audio = new AudioEngine();
