// Управление расслабляющими звуками через <audio> элементы с реальными файлами.
// Почему файлы, а не синтез Web Audio:
//  - медиа-элементы играют даже в беззвучном режиме iPhone (как музыка);
//  - продолжают звучать при погасшем/заблокированном экране и в фоне.
// На iOS громкость медиа-элемента менять нельзя, поэтому плавные переходы
// не используем — уровни выставлены прямо в самих файлах.

class Ambient {
  constructor() {
    this.els = {};
    this.bellEl = null;
    this.current = null;
  }

  init() {
    this.els.pad = document.getElementById("aud-pad");
    this.els.rain = document.getElementById("aud-rain");
    this.els.ocean = document.getElementById("aud-ocean");
    this.bellEl = document.getElementById("aud-bell");
  }

  _all() {
    return [this.els.pad, this.els.rain, this.els.ocean, this.bellEl].filter(Boolean);
  }

  // Разблокировка всех элементов строго внутри касания (требование iOS),
  // чтобы колокольчик в конце мог зазвучать даже без нового касания.
  unlock() {
    this._all().forEach((el) => {
      el.muted = true;
      const p = el.play();
      if (p && p.then) p.then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; });
      else el.muted = false;
    });
  }

  start(type) {
    // Остановить остальные фоновые звуки.
    Object.values(this.els).forEach((e) => {
      if (e) { try { e.pause(); e.currentTime = 0; } catch (_) {} }
    });
    if (type === "none") { this.current = null; this._mediaSession(false); return; }

    const el = this.els[type];
    if (!el) return;
    this.current = el;
    el.muted = false;
    el.loop = true;
    try { el.currentTime = 0; } catch (_) {}
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    this._mediaSession(true);
  }

  bell() {
    if (!this.bellEl) return;
    this.bellEl.muted = false;
    try { this.bellEl.currentTime = 0; } catch (_) {}
    const p = this.bellEl.play();
    if (p && p.catch) p.catch(() => {});
  }

  // Совместимое имя со старым кодом: останавливает фоновый звук.
  fadeOutStop() {
    Object.values(this.els).forEach((e) => {
      if (e) { try { e.pause(); } catch (_) {} }
    });
    this.current = null;
    this._mediaSession(false);
  }

  // Метаданные для экрана блокировки и удержания фонового воспроизведения.
  _mediaSession(active) {
    if (!("mediaSession" in navigator)) return;
    try {
      if (active) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Медитация",
          artist: "Вопрос дня",
        });
        navigator.mediaSession.playbackState = "playing";
      } else {
        navigator.mediaSession.playbackState = "paused";
      }
    } catch (_) {}
  }
}

const ambient = new Ambient();
