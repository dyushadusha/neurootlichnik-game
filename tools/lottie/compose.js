'use strict';
/* =========================================================
   СБОРКА СТИКЕРА ИЗ ЕДИНОГО ЯЗЫКА ДВИЖЕНИЯ
   =========================================================
   Весь набор держится на одной системе движения — поэтому 50
   анимаций читаются как один пак, а не как случайные файлы.

   Слой-стек каждой анимации (сверху вниз):
     1. акценты  — искры, кольца удара, частицы (вылетают позже
                   основного объёма — follow-through);
     2. иконка   — основной объём с пружиной и squash & stretch;
     3. тень     — фирменное смещение из style.css бренда
                   (--doodle-shadow: 5px 5px 0 ink); при «подскоке»
                   отъезжает дальше, что читается как высота.
   ========================================================= */

const fs = require('fs');
const path = require('path');
const L = require('./lib');
const M = require('./motion');
const { ICONS, baseStyle, shadowStyle, BRAND } = require('./icons');

const DOODLES_DIR = path.join(__dirname, '..', '..', 'assets', 'doodles');

// ---------- иконка как масштабируемая группа ----------
/* Вся геометрия нарисована в боксе 200×200 — здесь она ужимается
   под нужный кегль. Обводка масштабируется вместе с формой, поэтому
   вес линии остаётся одинаковым и на 512, и на 100 пикселях. */
function iconGroup(iconKey, style, size, nm = 'icon', { mirror = false } = {}) {
  const def = typeof iconKey === 'function' ? { fit: 1, draw: iconKey } : ICONS[iconKey];
  if (!def) throw new Error('Неизвестная иконка: ' + iconKey);
  // fit уравнивает не габарит, а видимую массу: круг при том же
  // размере выглядит крупнее квадрата, а звезда — легче обоих
  const k = L.round4((size / 200) * 100 * (def.fit || 1));
  const items = def.draw(style);
  /* Внутри группы Lottie рисует ПЕРВЫЙ элемент поверх остальных.
     Иконки же описаны в естественном порядке рисования — сначала
     основная форма, потом детали поверх неё, — поэтому список
     разворачиваем: так зрачок оказывается на глазу, а галочка на
     бейдже, а не под ними. */
  return L.groupItem(nm, items.slice().reverse(), { s: [mirror ? -k : k, k] });
}

// ---------- фирменный дудл из assets/doodles ----------
const doodleCache = new Map();
function loadDoodle(name, targetSize) {
  const key = `${name}:${targetSize}`;
  if (doodleCache.has(key)) return doodleCache.get(key);
  const svg = fs.readFileSync(path.join(DOODLES_DIR, `${name}.svg`), 'utf8');
  const subpaths = L.extractPathsFromSvg(svg).flatMap((d) => L.parseSvgPath(d));
  const bbox = L.bboxOfSubpaths(subpaths);
  const cx = bbox.minX + bbox.w / 2;
  const cy = bbox.minY + bbox.h / 2;
  const scale = targetSize / Math.max(bbox.w, bbox.h);
  const out = L.transformSubpaths(subpaths, { scale, dx: -cx * scale, dy: -cy * scale });
  doodleCache.set(key, out);
  return out;
}

// ---------- акценты ----------
/* Искра: вылетает с задержкой после основного удара, вырастает
   пружиной, чуть довoрачивается и гаснет. */
function sparkLayer({ pos, size = 70, t0 = 12, spin = 22, color = BRAND.lime, op }) {
  const sp = loadDoodle('sparkle', size);
  const group = L.groupItem('spark', [
    ...sp.map((s, i) => L.pathShapeItem(s, `s${i}`)),
    L.fillItem(color),
  ]);
  return L.shapeLayer('Spark', [group], {
    op,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp(pos),
      r: L.animProp(M.seq(M.bake({ t0, dur: 34, from: -spin, to: spin, curve: M.curves.easeOut, step: 4 }))),
      s: L.animProp(
        M.seq(
          M.hold(0, [0, 0]),
          M.hold(t0, [0, 0]),
          M.bake({ t0, dur: 16, from: [0, 0], to: [100, 100], curve: M.curves.spring({ bounces: 2, decay: 5 }), lag: 2 }),
          M.bake({ t0: t0 + 22, dur: 16, from: [100, 100], to: [0, 0], curve: M.curves.easeIn, step: 3 })
        )
      ),
      o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 3, 100), M.hold(t0 + 24, 100), M.hold(t0 + 38, 0))),
    },
  });
}

/* Кольцо удара — расходится и растворяется в кадре приземления. */
function ringLayer({ pos, t0 = 10, size = 150, grow = 2.4, color = BRAND.ink, width = 9, op }) {
  const ring = M.impactRing({ t0, dur: 24, from: 40, to: 40 * grow * 2.6 });
  const group = L.groupItem('ring', [
    L.ellipseItem({ p: [0, 0], s: [size, size] }),
    L.strokeItem(color, width),
  ]);
  return L.shapeLayer('Impact ring', [group], {
    op,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp(pos),
      s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0 - 1, [0, 0]), ring.scale)),
      o: L.animProp(M.seq(M.hold(0, 0), ring.opacity)),
    },
  });
}

/* Лучи удара — короткие штрихи, разлетающиеся из центра. */
function burstLayers({ pos, count = 8, t0 = 10, radius = 200, len = 40, width = 12, color = BRAND.ink, op }) {
  const layers = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 360) / count - 90;
    const rad = (angle * Math.PI) / 180;
    const dir = [Math.cos(rad), Math.sin(rad)];
    const near = [pos[0] + dir[0] * radius * 0.55, pos[1] + dir[1] * radius * 0.55];
    const far = [pos[0] + dir[0] * radius, pos[1] + dir[1] * radius];
    const start = t0 + (i % 2) * 2;
    const group = L.groupItem('ray', [L.rectItem({ p: [0, 0], s: [width, len], r: width / 2 }), L.fillItem(color)]);
    layers.push(
      L.shapeLayer(`Burst ${i}`, [group], {
        op,
        ks: {
          a: L.staticProp([0, 0]),
          // штрих летит наружу и одновременно укорачивается — читается как импульс
          p: L.animProp(M.seq(M.hold(0, near), M.hold(start, near), M.bake({ t0: start, dur: 18, from: near, to: far, curve: M.curves.expoOut, step: 2 }))),
          r: L.staticProp(angle + 90),
          s: L.animProp(
            M.seq(
              M.hold(0, [0, 0]),
              M.hold(start, [100, 130]),
              M.bake({ t0: start, dur: 20, from: [100, 130], to: [60, 30], curve: M.curves.easeOut, step: 3 })
            )
          ),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(start, 100), M.hold(start + 16, 0))),
        },
      })
    );
  }
  return layers;
}

// =========================================================
// ДВИЖЕНИЕ ОСНОВНОГО ОБЪЁМА
// =========================================================
/* Возвращает { s, r, p } — готовые анимированные свойства слоя. */
function entranceMotion(kind, { pos, op, settle = 34, iconScale = 100 } = {}) {
  const S = iconScale;
  switch (kind) {
    // мягкое пружинное появление с замахом — база набора
    case 'pop':
      return {
        s: M.seq(
          M.popIn({ t0: 0, dur: 30, to: S, lag: 3, bounces: 2.2, decay: 5.2 }),
          M.breathe({ t0: settle, t1: op, base: S, amp: S * 0.025, cycles: 1 })
        ),
        r: M.seq(M.wobble({ t0: 2, dur: 38, amp: 10 }), M.sway({ t0: settle, t1: op, amp: 1.6, cycles: 1 })),
        p: M.seq(M.hold(0, pos)),
      };

    // замах внутрь, затем выстрел — для «энергичных» иконок
    case 'anticipate':
      return {
        s: M.seq(
          M.popInAnticipated({ t0: 0, dur: 34, to: S, lag: 3 }),
          M.breathe({ t0: settle + 4, t1: op, base: S, amp: S * 0.03, cycles: 1 })
        ),
        r: M.seq(M.wobble({ t0: 6, dur: 40, amp: 14 }), M.sway({ t0: settle + 4, t1: op, amp: 2, cycles: 1 })),
        p: M.seq(M.hold(0, pos)),
      };

    // падение сверху с отскоком и сплющиванием на посадке
    case 'drop': {
      const from = [pos[0], pos[1] - 260];
      const land = 26;
      return {
        s: M.seq(
          M.hold(0, [S * 0.86, S * 1.18]),
          M.bake({ t0: 6, dur: 20, from: [S * 0.86, S * 1.18], to: [S, S], curve: M.curves.easeOut, step: 3 }),
          M.squash({ t: land, amount: 0.26, recover: 24, base: S }),
          M.breathe({ t0: settle + 16, t1: op, base: S, amp: S * 0.022, cycles: 1 })
        ),
        r: M.seq(M.hold(0, -6), M.wobble({ t0: land, dur: 40, amp: 9 }), M.sway({ t0: settle + 16, t1: op, amp: 1.4, cycles: 1 })),
        p: M.seq(M.hold(0, from), M.drop({ t0: 0, dur: land, from, to: pos })),
      };
    }

    // «штамп»: замах вверх, резкий удар вниз, тряска
    case 'stamp': {
      const high = [pos[0], pos[1] - 120];
      const hit = 16;
      return {
        s: M.seq(
          M.hold(0, [S * 1.34, S * 1.34]),
          M.bake({ t0: 0, dur: hit, from: [S * 1.34, S * 1.34], to: [S * 1.02, S * 0.9], curve: M.curves.expoIn, step: 2 }),
          M.squash({ t: hit, amount: 0.3, recover: 26, base: S }),
          M.breathe({ t0: settle + 16, t1: op, base: S, amp: S * 0.02, cycles: 1 })
        ),
        r: M.seq(M.hold(0, 8), M.bake({ t0: 0, dur: hit, from: 8, to: 0, curve: M.curves.expoIn, step: 2 }), M.wobble({ t0: hit, dur: 34, amp: 7 })),
        p: M.seq(M.hold(0, high), M.bake({ t0: 0, dur: hit, from: high, to: pos, curve: M.curves.expoIn, step: 2 })),
      };
    }

    // разворот «в профиль»: X проходит через ноль — эффект флипа
    case 'flip':
      return {
        s: M.seq(
          M.hold(0, [0, S * 0.9]),
          M.bake({ t0: 0, dur: 34, from: [0, S * 0.9], to: [S, S], curve: M.curves.spring({ bounces: 2.4, decay: 5 }), lag: 4 }),
          M.breathe({ t0: settle + 6, t1: op, base: S, amp: S * 0.022, cycles: 1 })
        ),
        r: M.seq(M.wobble({ t0: 8, dur: 36, amp: 8 }), M.sway({ t0: settle + 6, t1: op, amp: 1.4, cycles: 1 })),
        p: M.seq(M.hold(0, pos)),
      };

    // наплыв из крупного плана с растяжкой вместо мото-блюра
    case 'zoom':
      return {
        s: M.seq(
          M.hold(0, [S * 2.3, S * 2.3]),
          M.bake({ t0: 0, dur: 26, from: [S * 2.3, S * 2.3], to: [S, S], curve: M.curves.spring({ bounces: 1.9, decay: 5.6 }), lag: 3 }),
          M.breathe({ t0: settle, t1: op, base: S, amp: S * 0.024, cycles: 1 })
        ),
        r: M.seq(M.hold(0, -10), M.wobble({ t0: 4, dur: 36, amp: 10 })),
        p: M.seq(M.hold(0, pos)),
      };

    default:
      throw new Error('Unknown entrance: ' + kind);
  }
}

/* Прозрачность появления — общая для всех входов. */
function entranceOpacity(kind, op) {
  if (kind === 'drop' || kind === 'stamp') return M.seq(M.hold(0, 100));
  return M.seq(M.hold(0, 0), M.hold(2, 100), M.hold(op, 100));
}

// =========================================================
// ГЛАВНАЯ СБОРКА
// =========================================================
function buildSticker({
  canvas = 512,
  iconSize = 330,
  icon,
  sw = 13,
  entrance = 'pop',
  op = 120,
  center,
  shadow = true,
  shadowOffset = 12,
  accents = {},
  before = [], // слои поверх иконки
  after = [], // слои под иконкой (над тенью)
  iconStyleOverride = {},
  patchMotion, // (motion, ctx) => motion — точечная правка ритма под иконку
}) {
  const CX = canvas / 2;
  const CY = canvas / 2;
  const pos = center || [CX, CY];

  const style = { ...baseStyle(sw), ...iconStyleOverride };
  let motion = entranceMotion(entrance, { pos, op });
  if (patchMotion) motion = patchMotion(motion, { pos, op, M });
  const opacity = entranceOpacity(entrance, op);

  const layers = [];

  // --- акценты ---
  if (accents.burst) {
    layers.push(
      ...burstLayers({
        pos,
        op,
        count: accents.burst.count || 8,
        t0: accents.burst.t0 != null ? accents.burst.t0 : 12,
        radius: accents.burst.radius || iconSize * 0.72,
        len: accents.burst.len || iconSize * 0.13,
        width: accents.burst.width || iconSize * 0.036,
        color: accents.burst.color || BRAND.ink,
      })
    );
  }
  if (accents.ring) {
    layers.push(
      ringLayer({
        pos,
        op,
        t0: accents.ring.t0 != null ? accents.ring.t0 : 12,
        size: accents.ring.size || iconSize * 0.5,
        color: accents.ring.color || BRAND.ink,
        width: accents.ring.width || 9,
      })
    );
  }
  (accents.sparks || []).forEach((sp) => {
    layers.push(
      sparkLayer({
        op,
        pos: [pos[0] + sp[0], pos[1] + sp[1]],
        size: sp[2] || iconSize * 0.2,
        t0: sp[3] != null ? sp[3] : 14,
        spin: sp[4] != null ? sp[4] : 22,
      })
    );
  });

  layers.push(...before);

  // --- основной объём ---
  layers.push(
    L.shapeLayer('Icon', [iconGroup(icon, style, iconSize)], {
      op,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(motion.p),
        s: L.animProp(motion.s),
        r: L.animProp(motion.r),
        o: L.animProp(opacity),
      },
    })
  );

  layers.push(...after);

  // --- фирменная смещённая тень ---
  if (shadow) {
    const shOff = shadowOffset;
    const shPos = motion.p.map((k) => ({ ...k, v: [k.v[0] + shOff, k.v[1] + shOff] }));
    layers.push(
      L.shapeLayer('Shadow', [iconGroup(icon, shadowStyle(sw), iconSize)], {
        op,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(shPos),
          s: L.animProp(motion.s),
          r: L.animProp(motion.r),
          o: L.animProp(opacity),
        },
      })
    );
  }

  return layers;
}

module.exports = {
  buildSticker,
  iconGroup,
  loadDoodle,
  sparkLayer,
  ringLayer,
  burstLayers,
  entranceMotion,
  entranceOpacity,
};
