// Звук медитации на Web Audio API.
// - Плавное нарастание и затухание громкости (через GainNode).
// - Хрустальный колокольчик по завершении (синтез из негармоничных обертонов).
// - Выход прокидывается в скрытый <audio> через MediaStream, чтобы звук
//   играл в беззвучном режиме iPhone (медиа-канал не глушится переключателем).
//
// Фоновые текстуры (эфир/дождь/океан) берутся из готовых WAV-файлов и
// зацикливаются. На заблокированном экране Web Audio может приостановиться —
// это ограничение iOS.

const SOUND_FILES = {
  pad: "audio/pad.wav",
  rain: "audio/rain.wav",
  ocean: "audio/ocean.wav",
};

class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.streamDest = null;
    this.audioEl = null;
    this.useStream = false;
    this.buffers = {};
    this.source = null;
    this.soundGain = null;
  }

  init() {
    this.audioEl = document.getElementById("aud-stream");
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;

      if (typeof this.ctx.createMediaStreamDestination === "function" && this.audioEl) {
        try {
          this.streamDest = this.ctx.createMediaStreamDestination();
          this.master.connect(this.streamDest);
          this.audioEl.srcObject = this.streamDest.stream;
          this.useStream = true;
        } catch (e) {
          this.useStream = false;
        }
      }
      if (!this.useStream) this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // Вызывается строго по касанию (требование iOS): запускает медиа-элемент.
  unlock() {
    this._ensureCtx();
    if (this.useStream && this.audioEl) {
      const p = this.audioEl.play();
      if (p && p.catch) p.catch(() => {
        try { this.master.connect(this.ctx.destination); } catch (e) {}
      });
    }
  }

  async _load(type) {
    if (this.buffers[type]) return this.buffers[type];
    const resp = await fetch(SOUND_FILES[type]);
    const arr = await resp.arrayBuffer();
    const buf = await new Promise((res, rej) =>
      this.ctx.decodeAudioData(arr, res, rej)
    );
    this.buffers[type] = buf;
    return buf;
  }

  // Запуск фонового звука с плавным нарастанием.
  async start(type, fadeIn = 4) {
    this._ensureCtx();
    if (type === "none") { this._stopSource(0); return; }
    let buf;
    try { buf = await this._load(type); } catch (e) { return; }

    this._stopSource(0.4);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const g = this.ctx.createGain();
    g.gain.value = 0.0001;

    src.connect(g);
    g.connect(this.master);
    src.start();

    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + fadeIn);

    this.source = src;
    this.soundGain = g;
  }

  _stopSource(fadeOut = 0) {
    const src = this.source, g = this.soundGain;
    this.source = null; this.soundGain = null;
    if (!src) return;
    if (!this.ctx || fadeOut <= 0) {
      try { src.stop(); } catch (e) {}
      return;
    }
    const now = this.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + fadeOut);
      src.stop(now + fadeOut + 0.1);
    } catch (e) {
      try { src.stop(); } catch (_) {}
    }
  }

  // Плавно завершить фоновый звук.
  fadeOutStop(fadeOut = 4) {
    this._stopSource(fadeOut);
  }

  // Хрустальный колокольчик: негармоничные обертоны + лёгкое мерцание (delay).
  bell(level = 0.6) {
    this._ensureCtx();
    const now = this.ctx.currentTime;

    // Шина с обратной связью для «хрустального» мерцания.
    const wet = this.ctx.createGain();
    wet.gain.value = 0.35;
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.22;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.45;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(this.master);
    wet.connect(delay);
    wet.connect(this.master);

    // Негармоничные частотные соотношения, характерные для колокольчика/хрусталя.
    const base = 1046.5; // C6 — яркий, кристальный
    const partials = [
      { r: 1.0, a: 1.0, d: 5.0 },
      { r: 2.01, a: 0.6, d: 4.2 },
      { r: 2.78, a: 0.4, d: 3.4 },
      { r: 4.16, a: 0.28, d: 2.6 },
      { r: 5.43, a: 0.18, d: 2.0 },
      { r: 6.79, a: 0.12, d: 1.6 },
    ];

    partials.forEach((p) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * p.r;
      const g = this.ctx.createGain();
      const peak = level * p.a * 0.5;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
      osc.connect(g);
      g.connect(this.master);
      g.connect(wet);
      osc.start(now);
      osc.stop(now + p.d + 0.2);
    });
  }
}

const ambient = new Ambient();
