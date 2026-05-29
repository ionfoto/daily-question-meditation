// ===== Вопрос дня =====
// Один и тот же день показывает один и тот же вопрос; каждый новый день — следующий.

function dayIndex() {
  // Количество целых дней с эпохи в местном времени.
  const now = new Date();
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local / 86400000);
}

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDate() {
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const weekdays = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
  const d = new Date();
  const wd = weekdays[d.getDay()];
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function todaysQuestion() {
  return QUESTIONS[dayIndex() % QUESTIONS.length];
}

function initQuestion() {
  document.getElementById("todayDate").textContent = formatDate();
  document.getElementById("questionText").textContent = todaysQuestion();

  // Заметка/рефлексия сохраняется в localStorage по дате.
  const input = document.getElementById("reflectionInput");
  const hint = document.getElementById("savedHint");
  const storageKey = `reflection:${dateKey()}`;
  input.value = localStorage.getItem(storageKey) || "";

  let saveTimer = null;
  input.addEventListener("input", () => {
    localStorage.setItem(storageKey, input.value);
    clearTimeout(saveTimer);
    hint.textContent = "Сохранено";
    hint.classList.add("show");
    saveTimer = setTimeout(() => hint.classList.remove("show"), 1500);
  });
}

// ===== Навигация по вкладкам =====
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.screen;
      document.querySelectorAll(".screen").forEach((s) =>
        s.classList.toggle("active", s.id === target)
      );
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      // Уходя с медитации — глушим звук и сбрасываем таймер.
      if (target !== "screen-meditate") meditation.reset();
    });
  });
}

// ===== Медитация =====
const meditation = {
  minutes: 5,
  sound: "pad",
  remaining: 0,
  interval: null,
  running: false,

  el: {},

  init() {
    this.el = {
      display: document.getElementById("timerDisplay"),
      circle: document.getElementById("breathCircle"),
      minutesRow: document.getElementById("minutesRow"),
      soundRow: document.getElementById("soundRow"),
      setup: document.getElementById("setupControls"),
      runningControls: document.getElementById("runningControls"),
      startBtn: document.getElementById("startBtn"),
      stopBtn: document.getElementById("stopBtn"),
    };

    // Кнопки минут.
    const options = [3, 5, 10, 15, 20, 30];
    options.forEach((m) => {
      const b = document.createElement("button");
      b.className = "min-chip" + (m === this.minutes ? " selected" : "");
      b.innerHTML = `${m}<span class="unit">мин</span>`;
      b.addEventListener("click", () => {
        this.minutes = m;
        this.el.minutesRow.querySelectorAll(".min-chip").forEach((c) => c.classList.remove("selected"));
        b.classList.add("selected");
        this.updateDisplay(m * 60);
      });
      this.el.minutesRow.appendChild(b);
    });

    // Кнопки звука.
    const sounds = [
      { id: "pad", name: "Эфир" },
      { id: "rain", name: "Дождь" },
      { id: "ocean", name: "Океан" },
      { id: "none", name: "Тишина" },
    ];
    sounds.forEach((s) => {
      const b = document.createElement("button");
      b.className = "sound-chip" + (s.id === this.sound ? " selected" : "");
      b.textContent = s.name;
      b.addEventListener("click", () => {
        this.sound = s.id;
        this.el.soundRow.querySelectorAll(".sound-chip").forEach((c) => c.classList.remove("selected"));
        b.classList.add("selected");
      });
      this.el.soundRow.appendChild(b);
    });

    this.el.startBtn.addEventListener("click", () => this.start());
    this.el.stopBtn.addEventListener("click", () => this.reset());

    this.updateDisplay(this.minutes * 60);
  },

  updateDisplay(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    this.el.display.textContent = `${m}:${s}`;
  },

  start() {
    this.remaining = this.minutes * 60;
    this.running = true;
    this.updateDisplay(this.remaining);

    this.el.setup.classList.add("hidden");
    this.el.runningControls.classList.remove("hidden");
    this.el.circle.classList.add("breathing");

    // Звук + колокольчик начала.
    ambient.bell();
    if (this.sound !== "none") {
      setTimeout(() => { if (this.running) ambient.start(this.sound); }, 600);
    }

    this.interval = setInterval(() => {
      this.remaining--;
      this.updateDisplay(Math.max(0, this.remaining));
      if (this.remaining <= 0) this.finish();
    }, 1000);
  },

  finish() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    ambient.fadeOutStop(2);
    setTimeout(() => ambient.bell(), 400);
    this.el.circle.classList.remove("breathing");
    setTimeout(() => this.reset(), 4500);
  },

  reset() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    ambient.fadeOutStop(1);
    this.el.circle.classList.remove("breathing");
    this.el.setup.classList.remove("hidden");
    this.el.runningControls.classList.add("hidden");
    this.updateDisplay(this.minutes * 60);
  },
};

// ===== Запуск =====
document.addEventListener("DOMContentLoaded", () => {
  initQuestion();
  initTabs();
  meditation.init();

  // Регистрация service worker для офлайн-работы.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
