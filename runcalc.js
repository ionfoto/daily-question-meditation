// Калькулятор бега.
// Вся математика — чистые функции (RUN_MATH), считается на телефоне, офлайн.
// Внутри всё хранится в секундах и километрах; округление — только при показе.

const RUN_MATH = {
  // Прогноз Ригеля: T2 = T1 * (D2/D1)^1.06 — стандарт индустрии.
  riegel(t1Sec, d1Km, d2Km) {
    return t1Sec * Math.pow(d2Km / d1Km, 1.06);
  },

  // Дэниелс–Гилберт: кислородная стоимость скорости (v в м/мин).
  vo2(v) {
    return -4.6 + 0.182258 * v + 0.000104 * v * v;
  },

  // Доля VO2max, которую можно удерживать t минут.
  fvo2(tMin) {
    return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
  },

  // VDOT — «беговой уровень» по результату забега.
  vdot(distKm, timeSec) {
    const tMin = timeSec / 60;
    const v = (distKm * 1000) / tMin; // м/мин
    return this.vo2(v) / this.fvo2(tMin);
  },

  // Скорость на уровне VO2max (м/мин) — полином GoldenCheetah.
  vvdot(vdot) {
    return 29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot;
  },

  // Тренировочный темп (сек/км) как доля от vVDOT.
  trainPace(vdot, frac) {
    return 60000 / (this.vvdot(vdot) * frac);
  },
};

// Форматирование.
const RUN_FMT = {
  // Секунды -> «м:сс» или «ч:мм:сс».
  time(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const two = (n) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
  },

  // Темп (сек/км) -> «м:сс».
  pace(secPerKm) {
    let s = Math.round(secPerKm);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  },

  // Число с запятой (русский формат): 12,1.
  num(x, digits = 1) {
    return x.toFixed(digits).replace(".", ",");
  },
};

const runCalc = {
  DISTANCES: [
    { km: 5, name: "5 км" },
    { km: 10, name: "10 км" },
    { km: 21.0975, name: "21,1" },
    { km: 42.195, name: "42,2" },
  ],
  ZONES: [
    { key: "easy", name: "Лёгкий", frac: 0.72, color: "#5ed7d0" },
    { key: "mara", name: "Марафонский", frac: 0.85, color: "#6aa6ff" },
    { key: "thr", name: "Пороговый", frac: 0.90, color: "#9d8bff" },
    { key: "int", name: "Интервалы", frac: 0.98, color: "#c08bff" },
    { key: "rep", name: "Повторы", frac: 1.05, color: "#ff8f7d" },
  ],
  STORE_KEY: "runcalc:v1",

  distKm: 5,
  timeSec: 25 * 60,
  custom: false,
  el: {},

  init() {
    this.el = {
      distRow: document.getElementById("distRow"),
      customWrap: document.getElementById("customDistWrap"),
      customDist: document.getElementById("customDist"),
      tH: document.getElementById("tH"),
      tM: document.getElementById("tM"),
      tS: document.getElementById("tS"),
      pM: document.getElementById("pM"),
      pS: document.getElementById("pS"),
      timeField: document.getElementById("timeField"),
      paceField: document.getElementById("paceField"),
      speedLine: document.getElementById("speedLine"),
      predictRows: document.getElementById("predictRows"),
      vdotVal: document.getElementById("vdotVal"),
      vdotRows: document.getElementById("vdotRows"),
      splitsGrid: document.getElementById("splitsGrid"),
      splitsCard: document.getElementById("splitsCard"),
    };

    this.restore();
    this.buildDistChips();
    this.bindInputs();
    if (this.custom) this.el.customDist.value = Math.round(this.distKm * 10) / 10;
    this.setTimeFields(this.timeSec);
    this.setPaceFields(this.paceSec());
    this.markSolved("pace");
    this.render();
  },

  paceSec() {
    return this.timeSec / this.distKm;
  },

  // --- Кнопки дистанций ---
  buildDistChips() {
    const row = this.el.distRow;
    row.innerHTML = "";
    this.DISTANCES.forEach((d) => {
      const b = document.createElement("button");
      b.className = "sound-chip dist-chip";
      b.textContent = d.name;
      b.dataset.km = d.km;
      b.addEventListener("click", () => {
        if (navigator.vibrate) navigator.vibrate(4);
        this.custom = false;
        this.setDistance(d.km);
      });
      row.appendChild(b);
    });
    const own = document.createElement("button");
    own.className = "sound-chip dist-chip";
    own.textContent = "Своя";
    own.dataset.km = "custom";
    own.addEventListener("click", () => {
      if (navigator.vibrate) navigator.vibrate(4);
      this.custom = true;
      this.updateChips();
      this.el.customWrap.classList.remove("hidden");
      this.el.customDist.focus();
    });
    row.appendChild(own);
    this.updateChips();
  },

  updateChips() {
    const chips = this.el.distRow.querySelectorAll(".dist-chip");
    chips.forEach((c) => {
      const isOwn = c.dataset.km === "custom";
      const on = this.custom ? isOwn : !isOwn && Math.abs(parseFloat(c.dataset.km) - this.distKm) < 0.001;
      c.classList.toggle("selected", on);
    });
    this.el.customWrap.classList.toggle("hidden", !this.custom);
  },

  // Смена дистанции: темп бегуна сохраняется, время пересчитывается.
  setDistance(km) {
    if (!(km > 0)) return;
    const pace = this.paceSec();
    this.distKm = km;
    this.timeSec = pace * km;
    this.setTimeFields(this.timeSec);
    this.markSolved("time");
    this.updateChips();
    this.render();
  },

  // --- Поля ввода ---
  bindInputs() {
    const digitsOnly = (el, next) => {
      el.addEventListener("focus", () => el.select());
      el.addEventListener("input", () => {
        el.value = el.value.replace(/\D/g, "").slice(0, el.maxLength);
        if (next && el.value.length >= el.maxLength) next.focus();
      });
    };
    digitsOnly(this.el.tH, this.el.tM);
    digitsOnly(this.el.tM, this.el.tS);
    digitsOnly(this.el.tS, null);
    digitsOnly(this.el.pM, this.el.pS);
    digitsOnly(this.el.pS, null);

    const onTime = () => {
      const h = parseInt(this.el.tH.value, 10) || 0;
      const m = parseInt(this.el.tM.value, 10) || 0;
      const s = parseInt(this.el.tS.value, 10) || 0;
      const t = h * 3600 + m * 60 + s;
      if (t <= 0) return;
      this.timeSec = t;
      this.setPaceFields(this.paceSec());
      this.markSolved("pace");
      this.render();
    };
    const onPace = () => {
      const m = parseInt(this.el.pM.value, 10) || 0;
      const s = parseInt(this.el.pS.value, 10) || 0;
      const p = m * 60 + s;
      if (p <= 0) return;
      this.timeSec = p * this.distKm;
      this.setTimeFields(this.timeSec);
      this.markSolved("time");
      this.render();
    };
    [this.el.tH, this.el.tM, this.el.tS].forEach((el) => el.addEventListener("input", onTime));
    [this.el.pM, this.el.pS].forEach((el) => el.addEventListener("input", onPace));

    this.el.customDist.addEventListener("input", () => {
      const km = parseFloat(this.el.customDist.value.replace(",", "."));
      if (km > 0 && km < 1000) this.setDistance(km);
    });
  },

  setTimeFields(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    this.el.tH.value = h > 0 ? h : "";
    this.el.tM.value = m.toString().padStart(h > 0 ? 2 : 1, "0");
    this.el.tS.value = s.toString().padStart(2, "0");
  },

  setPaceFields(secPerKm) {
    const s = Math.round(secPerKm);
    this.el.pM.value = Math.floor(s / 60);
    this.el.pS.value = (s % 60).toString().padStart(2, "0");
  },

  // Подсветка рассчитанного (не редактируемого сейчас) поля.
  markSolved(which) {
    this.el.timeField.classList.toggle("solved", which === "time");
    this.el.paceField.classList.toggle("solved", which === "pace");
  },

  // --- Результаты ---
  render() {
    if (!(this.distKm > 0) || !(this.timeSec > 0)) return;
    const pace = this.paceSec();

    // Скорость.
    const kmh = 3600 / pace;
    this.el.speedLine.textContent = `${RUN_FMT.pace(pace)} /км · ${RUN_FMT.num(kmh)} км/ч`;

    // Прогноз Ригеля на стандартные дистанции.
    this.el.predictRows.innerHTML = "";
    this.DISTANCES.forEach((d) => {
      const row = document.createElement("div");
      row.className = "row-line";
      const cur = Math.abs(d.km - this.distKm) < 0.001;
      const t = cur ? this.timeSec : RUN_MATH.riegel(this.timeSec, this.distKm, d.km);
      row.innerHTML = `<span class="row-name">${d.name}${cur ? " · сейчас" : ""}</span><span class="row-val">${RUN_FMT.time(t)}</span>`;
      if (cur) row.classList.add("current");
      row.addEventListener("click", () => {
        if (cur) return;
        // Тап по прогнозу подставляет дистанцию и предсказанное время.
        this.custom = false;
        this.distKm = d.km;
        this.timeSec = t;
        this.setTimeFields(t);
        this.setPaceFields(this.paceSec());
        this.markSolved("time");
        this.updateChips();
        this.render();
        if (navigator.vibrate) navigator.vibrate(4);
      });
      this.el.predictRows.appendChild(row);
    });

    // VDOT и тренировочные темпы.
    const vdot = RUN_MATH.vdot(this.distKm, this.timeSec);
    const sane = vdot >= 20 && vdot <= 90;
    this.el.vdotVal.textContent = sane ? RUN_FMT.num(vdot) : "—";
    this.el.vdotRows.innerHTML = "";
    if (sane) {
      this.ZONES.forEach((z) => {
        const p = RUN_MATH.trainPace(vdot, z.frac);
        const row = document.createElement("div");
        row.className = "row-line";
        row.innerHTML =
          `<span class="row-name"><span class="zone-dot" style="background:${z.color}"></span>${z.name}</span>` +
          `<span class="row-val">${RUN_FMT.pace(p)} /км</span>`;
        this.el.vdotRows.appendChild(row);
      });
    }

    // Сплиты по километрам.
    const grid = this.el.splitsGrid;
    grid.innerHTML = "";
    const whole = Math.floor(this.distKm);
    for (let k = 1; k <= whole; k++) {
      const cell = document.createElement("div");
      cell.className = "split-cell";
      cell.innerHTML = `<span class="split-km">${k}</span><span class="split-t">${RUN_FMT.time(pace * k)}</span>`;
      grid.appendChild(cell);
    }
    if (this.distKm - whole > 0.001) {
      const cell = document.createElement("div");
      cell.className = "split-cell finish";
      cell.innerHTML = `<span class="split-km">Финиш</span><span class="split-t">${RUN_FMT.time(this.timeSec)}</span>`;
      grid.appendChild(cell);
    }

    this.save();
  },

  // --- Память ---
  save() {
    try {
      localStorage.setItem(this.STORE_KEY, JSON.stringify({ d: this.distKm, t: this.timeSec, c: this.custom }));
    } catch (e) {}
  },

  restore() {
    try {
      const raw = localStorage.getItem(this.STORE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v.d > 0 && v.t > 0) {
        this.distKm = v.d;
        this.timeSec = v.t;
        this.custom = !!v.c;
      }
    } catch (e) {}
  },
};

// Для проверки математики в Node (не влияет на браузер).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { RUN_MATH, RUN_FMT };
}
