'use strict';
/* =========================================================
   ЯЗЫК ДВИЖЕНИЯ «НЕЙРО ОТЛИЧНИК»
   =========================================================
   Lottie умеет только кубический безье между двумя ключами —
   этого не хватает для пружин, отскоков и затухающих колебаний.
   Поэтому сложные кривые здесь ЗАПЕКАЮТСЯ: функция сэмплируется
   по кадрам и превращается в плотный набор ключей с линейной
   интерполяцией. Так получается настоящая физика движения, а не
   «плоский» ease-in-out.

   Принципы, из которых складывается «дорогая» анимация:
     1. anticipation — короткий замах в обратную сторону;
     2. overshoot + settle — перелёт цели и затухающие колебания;
     3. squash & stretch — X и Y идут с лагом, объём «живой»;
     4. follow-through — вторичные детали стартуют позже и
        успокаиваются позже основного объёма;
     5. impact — на кадре удара вылетают лучи/кольца/пыль;
     6. idle — после посадки объект чуть дышит, а не замирает.
   ========================================================= */

// ---------- кривые (p: 0..1 → множитель, может выходить за 0..1) ----------
const curves = {
  linear: (p) => p,
  easeOut: (p) => 1 - Math.pow(1 - p, 3),
  easeIn: (p) => p * p * p,
  easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  expoOut: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  expoIn: (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),

  // перелёт цели с одним возвратом
  backOut:
    (k = 1.9) =>
    (p) =>
      1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2),
  backIn:
    (k = 1.9) =>
    (p) =>
      (k + 1) * p * p * p - k * p * p,

  /* Затухающая пружина — основная кривая набора.
     bounces — сколько раз перелетает цель, decay — как быстро гаснет. */
  spring:
    ({ bounces = 2.2, decay = 5.4 } = {}) =>
    (p) =>
      1 - Math.exp(-decay * p) * Math.cos(bounces * Math.PI * p),

  // «резиновый» вариант — заметнее колебания, для акцентных появлений
  elastic:
    ({ bounces = 3, decay = 4.2 } = {}) =>
    (p) =>
      1 - Math.exp(-decay * p) * Math.cos(bounces * Math.PI * p),

  // отскок как мячик (только вниз, без перелёта вверх)
  bounceOut: (p) => {
    const n = 7.5625;
    const d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },

  // замах назад, затем бросок вперёд с перелётом
  anticipate:
    ({ back = 0.22, at = 0.3, k = 1.7 } = {}) =>
    (p) => {
      if (p < at) {
        const q = p / at;
        return -back * Math.sin(q * Math.PI);
      }
      const q = (p - at) / (1 - at);
      return 1 + (k + 1) * Math.pow(q - 1, 3) + k * Math.pow(q - 1, 2);
    },
};

// ---------- утилиты ----------
function lerp(from, to, k) {
  if (Array.isArray(from)) return from.map((f, i) => round2(f + (to[i] - f) * k));
  return round2(from + (to - from) * k);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function clamp01(p) {
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/* Сводит несколько наборов ключей в один: сортирует по времени и
   убирает дубли (побеждает последний заданный ключ). */
function seq(...groups) {
  const flat = [].concat(...groups.filter(Boolean));
  const byTime = new Map();
  for (const k of flat) byTime.set(Math.round(k.t), { ...k, t: Math.round(k.t) });
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/* Один ключ-удержание значения. */
function hold(t, v) {
  return [{ t, v, linear: true }];
}

/* Запекание произвольной кривой в ключевые кадры.
   step — шаг сэмплирования в кадрах (2 кадра при 60 fps даёт
   плавность и не раздувает файл). */
function bake({ t0, dur, from, to, curve = curves.easeOut, step = 2, lag = 0 }) {
  const keys = [];
  const n = Math.max(1, Math.round(dur / step));
  const twoD = Array.isArray(from);
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / n) * dur;
    if (twoD && lag) {
      // squash & stretch: X отстаёт от Y на lag кадров
      const py = clamp01((t - t0) / dur);
      const px = clamp01((t - t0 - lag) / dur);
      keys.push({
        t,
        v: [
          round2(from[0] + (to[0] - from[0]) * curve(px)),
          round2(from[1] + (to[1] - from[1]) * curve(py)),
        ],
        linear: true,
      });
    } else {
      keys.push({ t, v: lerp(from, to, curve(clamp01((t - t0) / dur))), linear: true });
    }
  }
  keys[keys.length - 1].v = to;
  return keys;
}

// ---------- готовые движения ----------

/* Появление «поп»: из ничего в размер с пружиной и squash & stretch. */
function popIn({ t0 = 0, dur = 26, from = 0, to = 100, lag = 3, bounces = 2.2, decay = 5.4, step = 2 } = {}) {
  return bake({
    t0,
    dur,
    from: [from, from],
    to: [to, to],
    curve: curves.spring({ bounces, decay }),
    lag,
    step,
  });
}

/* Появление с замахом: объект сначала чуть сжимается, потом выстреливает. */
function popInAnticipated({ t0 = 0, dur = 30, from = 0, to = 100, lag = 3, step = 2 } = {}) {
  return bake({
    t0,
    dur,
    from: [from, from],
    to: [to, to],
    curve: curves.anticipate({ back: 0.18, at: 0.26, k: 1.8 }),
    lag,
    step,
  });
}

/* Падение сверху с приземлением: позиция летит вниз с ускорением,
   на кадре касания объект сплющивается и потом выпрямляется пружиной. */
function drop({ t0 = 0, dur = 22, from, to, step = 2 } = {}) {
  return bake({ t0, dur, from, to, curve: curves.bounceOut, step });
}

/* Сплющивание при ударе: [scaleX, scaleY] с сохранением объёма. */
function squash({ t: tImpact, amount = 0.22, recover = 18, base = 100, step = 2 } = {}) {
  const wide = [round2(base * (1 + amount)), round2(base * (1 - amount))];
  return seq(
    [{ t: tImpact, v: wide, linear: true }],
    bake({
      t0: tImpact,
      dur: recover,
      from: wide,
      to: [base, base],
      curve: curves.spring({ bounces: 2.4, decay: 5.2 }),
      step,
    })
  );
}

/* Затухающее качание вращением — «остаточная» энергия после удара. */
function wobble({ t0 = 0, dur = 40, amp = 12, bounces = 2.6, decay = 4.6, step = 2 } = {}) {
  const keys = [];
  const n = Math.max(1, Math.round(dur / step));
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    keys.push({
      t: t0 + p * dur,
      v: round2(amp * Math.exp(-decay * p) * Math.cos(bounces * Math.PI * p)),
      linear: true,
    });
  }
  keys[keys.length - 1].v = 0;
  return keys;
}

/* Бесшовное «дыхание» — синус, который в конце возвращается в старт.
   Даёт жизнь статичной фазе и склеивает цикл. */
function breathe({ t0, t1, base = 100, amp = 2.2, cycles = 1, phaseLag = 0.12, step = 3 } = {}) {
  const keys = [];
  const dur = t1 - t0;
  const n = Math.max(2, Math.round(dur / step));
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const y = base + amp * Math.sin(2 * Math.PI * cycles * p);
    const x = base + amp * Math.sin(2 * Math.PI * cycles * (p - phaseLag));
    keys.push({ t: t0 + p * dur, v: [round2(x), round2(y)], linear: true });
  }
  return keys;
}

/* Бесшовное покачивание одномерного свойства (поворот, позиция). */
function sway({ t0, t1, base = 0, amp = 4, cycles = 1, step = 3 } = {}) {
  const keys = [];
  const dur = t1 - t0;
  const n = Math.max(2, Math.round(dur / step));
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    keys.push({ t: t0 + p * dur, v: round2(base + amp * Math.sin(2 * Math.PI * cycles * p)), linear: true });
  }
  return keys;
}

/* Плавание по кругу — для орбит и «парящих» деталей. */
function orbit({ t0, t1, cx = 0, cy = 0, r = 60, turns = 1, phase = 0, step = 3 } = {}) {
  const keys = [];
  const dur = t1 - t0;
  const n = Math.max(4, Math.round(dur / step));
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const a = 2 * Math.PI * (turns * p + phase);
    keys.push({ t: t0 + p * dur, v: [round2(cx + Math.cos(a) * r), round2(cy + Math.sin(a) * r)], linear: true });
  }
  return keys;
}

/* Нерегулярное дрожание — огонь, глитч, «энергия». */
function jitter({ t0, t1, base = 0, amp = 6, seed = 1, step = 4 } = {}) {
  const keys = [];
  const dur = t1 - t0;
  const n = Math.max(2, Math.round(dur / step));
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    // первый и последний ключ совпадают — цикл склеивается без рывка
    const v = i === 0 || i === n ? base : base + (rnd() * 2 - 1) * amp;
    keys.push({ t: t0 + p * dur, v: round2(v), linear: true });
  }
  return keys;
}

/* Сердцебиение: два удара подряд и пауза — ритм «тук-тук … тук-тук».
   Заметно живее ровного дыхания, цикл склеивается бесшовно. */
function heartbeat({ t0, t1, base = 100, amp = 0.14, step = 2 } = {}) {
  const keys = [];
  const dur = t1 - t0;
  const n = Math.max(4, Math.round(dur / step));
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    // два затухающих удара в первой трети цикла
    const beat = Math.exp(-14 * p) * Math.sin(2 * Math.PI * 2.2 * p) + 0.55 * Math.exp(-14 * Math.max(0, p - 0.22)) * Math.sin(2 * Math.PI * 2.2 * Math.max(0, p - 0.22));
    const k = 1 + amp * beat;
    keys.push({ t: t0 + p * dur, v: [round2(base * (2 - k)), round2(base * k)], linear: true });
  }
  keys[keys.length - 1].v = [base, base];
  return keys;
}

/* Моргание: быстрое сжатие по вертикали в заданные моменты. */
function blink({ t0, t1, base = 100, at = [], dur = 7, step = 1 } = {}) {
  const keys = [{ t: t0, v: [base, base], linear: true }];
  for (const t of at) {
    keys.push({ t: t - 1, v: [base, base], linear: true });
    keys.push({ t: t + dur * 0.4, v: [round2(base * 1.04), round2(base * 0.06)], linear: true });
    keys.push({ t: t + dur, v: [base, base], linear: true });
  }
  keys.push({ t: t1, v: [base, base], linear: true });
  return keys;
}

/* Вспышка прозрачности: быстро проявилось — плавно ушло. */
function flash({ t0, rise = 4, hold: holdFor = 10, fall = 14, peak = 100 } = {}) {
  return seq(
    [{ t: t0, v: 0, linear: true }],
    bake({ t0, dur: rise, from: 0, to: peak, curve: curves.expoOut, step: 2 }),
    [{ t: t0 + rise + holdFor, v: peak, linear: true }],
    bake({ t0: t0 + rise + holdFor, dur: fall, from: peak, to: 0, curve: curves.easeOut, step: 3 })
  );
}

/* Разлетающееся кольцо удара: масштаб растёт, прозрачность падает. */
function impactRing({ t0, dur = 22, from = 20, to = 160 } = {}) {
  return {
    scale: bake({ t0, dur, from: [from, from], to: [to, to], curve: curves.expoOut, step: 2 }),
    opacity: seq(
      [{ t: t0, v: 0, linear: true }],
      [{ t: t0 + 2, v: 85, linear: true }],
      bake({ t0: t0 + 2, dur: dur - 2, from: 85, to: 0, curve: curves.easeOut, step: 3 })
    ),
  };
}

module.exports = {
  curves,
  seq,
  hold,
  heartbeat,
  blink,
  bake,
  popIn,
  popInAnticipated,
  drop,
  squash,
  wobble,
  breathe,
  sway,
  orbit,
  jitter,
  flash,
  impactRing,
  lerp,
  round2,
};
