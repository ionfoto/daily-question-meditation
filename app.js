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

  const input = document.getElementById("reflectionInput");
  const block = document.getElementById("reflectionBlock");
  const done = document.getElementById("reflectionDone");
  const sendBtn = document.getElementById("sendBtn");

  // Черновик хранится по дате; флаг «отправлено» прячет поле до следующих суток.
  const draftKey = `reflection:${dateKey()}`;
  const sentKey = `reflection-sent:${dateKey()}`;

  const showSent = () => {
    block.classList.add("hidden");
    done.classList.remove("hidden");
  };

  if (localStorage.getItem(sentKey)) {
    showSent();
    return;
  }

  // Восстанавливаем черновик (на случай, если переключались между вкладками).
  input.value = localStorage.getItem(draftKey) || "";
  input.addEventListener("input", () => {
    localStorage.setItem(draftKey, input.value);
  });

  sendBtn.addEventListener("click", () => {
    if (!input.value.trim()) { input.focus(); return; }
    // Написанное исчезает: помечаем день как отправленный и стираем черновик.
    localStorage.setItem(sentKey, "1");
    localStorage.removeItem(draftKey);
    input.value = "";
    showSent();
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
  ITEM_H: 34,
  MAX_MIN: 60,

  init() {
    this.el = {
      display: document.getElementById("timerDisplay"),
      circle: document.getElementById("breathCircle"),
      picker: document.getElementById("minutePicker"),
      pickerList: document.getElementById("pickerList"),
      soundRow: document.getElementById("soundRow"),
      setup: document.getElementById("setupControls"),
      runningControls: document.getElementById("runningControls"),
      startBtn: document.getElementById("startBtn"),
      stopBtn: document.getElementById("stopBtn"),
    };

    this.buildPicker();

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
  },

  // Прокручиваемый пикер минут в стиле часов iPhone.
  buildPicker() {
    const list = this.el.pickerList;
    list.innerHTML = "";
    for (let m = 1; m <= this.MAX_MIN; m++) {
      const li = document.createElement("li");
      li.textContent = m;
      li.dataset.min = m;
      list.appendChild(li);
    }

    const clampIdx = () =>
      Math.min(this.MAX_MIN - 1, Math.max(0, Math.round(list.scrollTop / this.ITEM_H)));

    // Подсветка текущего значения во время прокрутки.
    const refresh = () => {
      const idx = clampIdx();
      const m = idx + 1;
      if (m !== this.minutes) {
        this.minutes = m;
        if (navigator.vibrate) navigator.vibrate(4);
      }
      [...list.children].forEach((li, i) =>
        li.classList.toggle("on", i === idx)
      );
    };

    // Точная «доводка» после остановки прокрутки — чтобы значение
    // вставало ровно по центру и не съезжало (как в часах iOS).
    let settleTimer = null;
    const settle = () => {
      const idx = clampIdx();
      const target = idx * this.ITEM_H;
      if (Math.abs(list.scrollTop - target) > 0.5) {
        list.scrollTo({ top: target, behavior: "smooth" });
      }
      refresh();
    };

    list.addEventListener("scroll", () => {
      window.requestAnimationFrame(refresh);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 90);
    });

    // Стартовое значение.
    requestAnimationFrame(() => {
      list.scrollTop = (this.minutes - 1) * this.ITEM_H;
      refresh();
    });
  },

  updateDisplay(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    this.el.display.textContent = `${m}:${s}`;
  },

  start() {
    // Разблокировать аудио строго внутри касания (требование iOS).
    ambient.unlock();

    // Отсчёт по «реальному времени», чтобы таймер не сбивался при блокировке экрана.
    this.endTime = Date.now() + this.minutes * 60 * 1000;
    this.running = true;
    this.updateDisplay(this.minutes * 60);

    this.el.setup.classList.add("hidden");
    this.el.runningControls.classList.remove("hidden");
    this.el.circle.classList.add("breathing");

    // Мягкий колокольчик начала + плавное нарастание фонового звука.
    ambient.bell(0.4);
    if (this.sound !== "none") {
      setTimeout(() => { if (this.running) ambient.start(this.sound, 4); }, 500);
    }

    this.interval = setInterval(() => this.tick(), 500);
  },

  tick() {
    if (!this.running) return;
    const left = Math.round((this.endTime - Date.now()) / 1000);
    this.updateDisplay(Math.max(0, left));
    if (left <= 0) this.finish();
  },

  finish() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    this.updateDisplay(0);
    // Плавное затухание фона, затем хрустальный колокольчик.
    ambient.fadeOutStop(3.5);
    setTimeout(() => ambient.bell(0.7), 3200);
    this.el.circle.classList.remove("breathing");
    setTimeout(() => this.reset(), 9000);
  },

  reset() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    ambient.fadeOutStop(1.2);
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
  ambient.init();
  meditation.init();
  runCalc.init();

  // При возврате в приложение пересчитываем таймер по реальному времени.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) meditation.tick();
  });

  // Регистрация service worker для офлайн-работы.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // Когда активируется новая версия — один раз перезагружаем страницу.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
});
