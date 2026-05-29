// Генератор расслабляющих звуков на Web Audio API.
// Звуки синтезируются прямо в браузере — не нужны аудиофайлы, всё работает офлайн.

class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.nodes = [];
    this.current = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // Плавно поднять громкость.
  _fadeIn(target = 0.6, time = 2.5) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + time);
  }

  // Плавно опустить громкость и остановить.
  fadeOutStop(time = 2) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + time);
    setTimeout(() => this._cleanup(), time * 1000 + 100);
  }

  _cleanup() {
    this.nodes.forEach((n) => {
      try { n.stop && n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    this.nodes = [];
    this.current = null;
  }

  // Буфер белого шума для дождя/океана.
  _noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  start(type) {
    this._ensureCtx();
    if (this.current === type) return;
    if (this.current) this._cleanup();
    this.current = type;

    if (type === "pad") this._pad();
    else if (type === "rain") this._noise(1200, 0.25, 0.5);
    else if (type === "ocean") this._noise(500, 0.18, 0.12);

    this._fadeIn();
  }

  // Мягкий эфир: аккорд из тихих синусоид с медленным «дыханием».
  _pad() {
    const freqs = [110, 164.81, 220, 277.18]; // мягкий мажорный аккорд
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;

      const g = this.ctx.createGain();
      g.gain.value = 0.0;

      // Медленное колебание громкости — эффект дыхания.
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.07;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      g.gain.value = 0.09;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);

      osc.start();
      lfo.start();
      this.nodes.push(osc, lfo);
    });
  }

  // Шумовая текстура (дождь/океан) с медленной модуляцией громкости.
  _noise(cutoff, level, lfoRate) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;

    const g = this.ctx.createGain();
    g.gain.value = level;

    // Медленные волны громкости — как набегающие волны / порывы дождя.
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = lfoRate;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = level * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);

    src.start();
    lfo.start();
    this.nodes.push(src, lfo);
  }

  // Мягкий колокольчик в начале и конце медитации.
  bell() {
    this._ensureCtx();
    const now = this.ctx.currentTime;
    [528, 792].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      const peak = i === 0 ? 0.5 : 0.25;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 4.2);
    });
  }
}

const ambient = new Ambient();
