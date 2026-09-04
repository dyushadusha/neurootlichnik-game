'use strict';
/* =========================================================
   ИКОНКИ НАБОРА «НЕЙРО ОТЛИЧНИК»
   =========================================================
   Вся геометрия нарисована в общем боксе 200×200 с центром в
   (0,0) — то есть координаты живут примерно в -100…100. Дальше
   любая иконка масштабируется группой под нужный канвас: 512×512
   для стикеров/реакций и 100×100 для кастомных эмодзи.

   Каждая иконка — функция style → массив шейп-групп. style задаёт
   заливку, обводку и цвет тёмных деталей. Если передать все три
   цвета одинаковыми (INK), получится сплошной силуэт — на нём
   строится фирменная смещённая тень (приём из style.css бренда:
   --doodle-shadow: 5px 5px 0 ink).
   ========================================================= */

const L = require('./lib');

const { BRAND } = L;

// ---------- служебное ----------
function P(d, closed = true) {
  const subpaths = L.parseSvgPath(d);
  if (!closed) subpaths.forEach((sp) => { sp.c = false; });
  return subpaths;
}

function paint(style) {
  const out = [];
  if (style.stroke && style.sw) out.push(L.strokeItem(style.stroke, style.sw));
  if (style.fill) out.push(L.fillItem(style.fill));
  return out;
}

// группа из одного или нескольких контуров с общей заливкой/обводкой
function shape(nm, d, style, transform) {
  const items = P(d).map((sp, i) => L.pathShapeItem(sp, `${nm}-${i}`));
  return L.groupItem(nm, [...items, ...paint(style)], transform);
}

// сплошная деталь тёмным (глаз, тень, полоса) — без обводки
function detail(nm, items, style, transform) {
  return L.groupItem(nm, [...items, L.fillItem(style.ink)], transform);
}

// открытая линия (штрих без заливки) — галочки, стрелки, усики.
// По умолчанию это тёмная деталь поверх формы, но если линия и есть
// сама иконка (галочка, знак вопроса), цвет берётся основной.
function line(nm, d, style, width, transform, color) {
  const items = P(d, false).map((sp, i) => L.pathShapeItem(sp, `${nm}-${i}`));
  return L.groupItem(nm, [...items, L.strokeItem(color || style.ink, width)], transform);
}

/* Стиль по умолчанию: лаймовая заливка, графитовая обводка. */
function baseStyle(sw = 13) {
  return { fill: BRAND.lime, stroke: BRAND.ink, ink: BRAND.ink, sw };
}
/* Силуэт одним цветом — для смещённой тени. */
function shadowStyle(sw = 13, color = BRAND.ink) {
  return { fill: color, stroke: color, ink: color, sw };
}

// =========================================================
// ИКОНКИ
// =========================================================
const ICONS = {
  heart: (s) => [
    shape(
      'heart',
      'M0,82 C-46,44 -92,6 -92,-32 C-92,-64 -68,-84 -40,-84 C-22,-84 -7,-74 0,-59 ' +
        'C7,-74 22,-84 40,-84 C68,-84 92,-64 92,-32 C92,6 46,44 0,82 Z',
      s
    ),
  ],

  fire: (s) => [
    shape(
      'flame',
      'M0,-92 C26,-56 58,-30 58,10 C58,48 32,80 0,92 C-32,80 -58,48 -58,10 ' +
        'C-58,-16 -46,-38 -30,-54 C-32,-24 -22,-6 -6,0 C-14,-30 -10,-64 0,-92 Z',
      s
    ),
    detail(
      'flame-core',
      P('M0,60 C13,41 25,25 25,8 C25,-7 15,-19 0,-27 C4,-6 -4,9 -15,15 C-13,31 -6,47 0,60 Z').map((sp, i) =>
        L.pathShapeItem(sp, `c${i}`)
      ),
      s
    ),
  ],

  bolt: (s) => [shape('bolt', 'M18,-96 L-56,14 L-8,14 L-24,96 L56,-16 L6,-16 Z', s)],

  star: (s) => [
    L.groupItem('star', [
      L.starItem({ p: [0, 0], pt: 5, or_: 98, ir: 42, os: 5, is: 2, rot: -90 }),
      ...paint(s),
    ]),
  ],

  spark: (s) => [
    L.groupItem('spark', [
      L.starItem({ p: [0, 0], pt: 4, or_: 96, ir: 26, os: 0, is: 0, rot: -90 }),
      ...paint(s),
    ]),
  ],

  check: (s) => [
    L.groupItem('check-badge', [L.ellipseItem({ p: [0, 0], s: [190, 190] }), ...paint(s)]),
    line('check-mark', 'M-46,2 L-14,36 L46,-36', s, 20),
  ],

  checkPlain: (s) => [line('check-mark', 'M-70,4 L-20,56 L72,-56', s, 30, undefined, s.fill)],

  cross: (s) => [
    shape(
      'cross',
      'M-64,-46 L-46,-64 L0,-18 L46,-64 L64,-46 L18,0 L64,46 L46,64 L0,18 L-46,64 L-64,46 L-18,0 Z',
      s
    ),
  ],

  arrowUp: (s) => [shape('arrow-up', 'M0,-92 L64,-16 L26,-16 L26,92 L-26,92 L-26,-16 L-64,-16 Z', s)],

  arrowRight: (s) => [shape('arrow-right', 'M92,0 L16,64 L16,26 L-92,26 L-92,-26 L16,-26 L16,-64 Z', s)],

  eye: (s) => [
    shape(
      'eye',
      'M-96,0 C-58,-56 -22,-74 0,-74 C22,-74 58,-56 96,0 C58,56 22,74 0,74 C-22,74 -58,56 -96,0 Z',
      s
    ),
    detail('pupil', [L.ellipseItem({ p: [0, 0], s: [58, 58] })], s),
  ],

  clock: (s) => [
    L.groupItem('clock-face', [L.ellipseItem({ p: [0, 0], s: [180, 180] }), ...paint(s)]),
    detail(
      'hands',
      [L.rectItem({ p: [0, -22], s: [13, 62], r: 6 }), L.rectItem({ p: [22, 8], s: [58, 13], r: 6 })],
      s
    ),
  ],

  pin: (s) => [
    shape(
      'pin',
      'M0,94 C-48,26 -66,-6 -66,-34 C-66,-70 -36,-96 0,-96 C36,-96 66,-70 66,-34 C66,-6 48,26 0,94 Z',
      s
    ),
    detail('pin-hole', [L.ellipseItem({ p: [0, -36], s: [46, 46] })], s),
  ],

  bulb: (s) => [
    L.groupItem('bulb-glass', [L.ellipseItem({ p: [0, -22], s: [150, 158] }), ...paint(s)]),
    detail('bulb-base', [L.rectItem({ p: [0, 74], s: [68, 28], r: 10 })], s),
    detail(
      'bulb-spark',
      [L.starItem({ p: [0, -24], pt: 4, or_: 34, ir: 12, sy: 1 })],
      s
    ),
  ],

  cube: (s) => [
    shape('cube-top', 'M0,-88 L76,-44 L0,0 L-76,-44 Z', s),
    shape('cube-left', 'M-76,-44 L0,0 L0,88 L-76,44 Z', s),
    shape('cube-right', 'M76,-44 L76,44 L0,88 L0,0 Z', s),
  ],

  house: (s) => [
    shape('house-body', 'M-68,-2 L68,-2 L68,86 L-68,86 Z', s),
    shape('house-roof', 'M-92,6 L0,-88 L92,6 Z', s),
    detail('house-door', [L.rectItem({ p: [0, 50], s: [44, 60], r: 8 })], s),
  ],

  camera: (s) => [
    shape('camera-bump', 'M-52,-56 L-16,-56 L-10,-30 L-58,-30 Z', s),
    L.groupItem('camera-body', [L.rectItem({ p: [0, 16], s: [180, 124], r: 22 }), ...paint(s)]),
    L.groupItem('camera-lens', [L.ellipseItem({ p: [0, 16], s: [76, 76] }), L.strokeItem(s.ink, s.sw)]),
    detail('camera-dot', [L.ellipseItem({ p: [58, -18], s: [18, 18] })], s),
  ],

  palette: (s) => [
    shape(
      'palette',
      'M-6,-90 C48,-90 94,-52 94,-6 C94,28 68,46 44,46 L28,46 C14,46 6,54 6,64 ' +
        'C6,74 12,80 12,88 C12,94 6,96 -2,96 C-54,96 -94,54 -94,0 C-94,-52 -50,-90 -6,-90 Z',
      s
    ),
    detail(
      'palette-dots',
      [
        L.ellipseItem({ p: [-46, -20], s: [26, 26] }),
        L.ellipseItem({ p: [-2, -46], s: [26, 26] }),
        L.ellipseItem({ p: [44, -22], s: [26, 26] }),
      ],
      s
    ),
  ],

  percent: (s) => [
    L.groupItem('pc-a', [L.ellipseItem({ p: [-46, -46], s: [66, 66] }), ...paint(s)]),
    L.groupItem('pc-b', [L.ellipseItem({ p: [46, 46], s: [66, 66] }), ...paint(s)]),
    detail('pc-slash', [L.rectItem({ p: [0, 0], s: [20, 190], r: 10 })], s, { r: 34 }),
  ],

  question: (s) => [
    line(
      'q-curve',
      'M-40,-40 C-40,-72 -16,-90 8,-90 C38,-90 58,-70 58,-44 C58,-16 30,-10 18,6 C10,18 10,26 10,36',
      s,
      24,
      undefined,
      s.fill
    ),
    L.groupItem('q-dot', [L.ellipseItem({ p: [10, 76], s: [26, 26] }), L.fillItem(s.fill)]),
  ],

  crown: (s) => [
    shape('crown', 'M-88,50 L-78,-46 L-30,-4 L0,-64 L30,-4 L78,-46 L88,50 Z', s),
    detail('crown-band', [L.rectItem({ p: [0, 66], s: [176, 30], r: 12 })], s),
    detail(
      'crown-gems',
      [
        L.ellipseItem({ p: [-46, 12], s: [20, 20] }),
        L.ellipseItem({ p: [0, 2], s: [22, 22] }),
        L.ellipseItem({ p: [46, 12], s: [20, 20] }),
      ],
      s
    ),
  ],

  trophy: (s) => [
    line('trophy-handle-l', 'M-46,-58 C-84,-58 -88,-14 -50,-6', s, 14),
    line('trophy-handle-r', 'M46,-58 C84,-58 88,-14 50,-6', s, 14),
    shape('trophy-cup', 'M-48,-76 L48,-76 L43,-8 C43,20 22,38 0,38 C-22,38 -43,20 -43,-8 Z', s),
    detail('trophy-stem', [L.rectItem({ p: [0, 56], s: [30, 44], r: 6 })], s),
    detail('trophy-base', [L.rectItem({ p: [0, 84], s: [110, 28], r: 12 })], s),
  ],

  rocket: (s) => [
    shape('rocket-fin-l', 'M-36,-4 L-76,54 L-36,42 Z', s),
    shape('rocket-fin-r', 'M36,-4 L76,54 L36,42 Z', s),
    shape('rocket-body', 'M0,-96 C26,-62 40,-22 40,20 C40,42 24,58 0,58 C-24,58 -40,42 -40,20 C-40,-22 -26,-62 0,-96 Z', s),
    detail('rocket-window', [L.ellipseItem({ p: [0, -22], s: [44, 44] })], s),
  ],

  brain: (s) => [
    shape(
      'brain',
      'M-8,-84 C22,-96 58,-84 68,-58 C92,-50 98,-16 78,4 C88,28 70,58 44,62 ' +
        'C30,86 -8,90 -26,70 C-54,74 -78,50 -70,22 C-92,2 -84,-36 -58,-46 C-56,-74 -32,-92 -8,-84 Z',
      s
    ),
    line('brain-net', 'M-30,-46 L-4,-16 L-38,14 L-6,44', s, 12),
    line('brain-net-2', 'M-4,-16 L34,-30 M-4,-16 L30,26', s, 12),
    detail(
      'brain-nodes',
      [
        L.ellipseItem({ p: [-30, -46], s: [22, 22] }),
        L.ellipseItem({ p: [34, -30], s: [22, 22] }),
        L.ellipseItem({ p: [30, 26], s: [22, 22] }),
        L.ellipseItem({ p: [-6, 44], s: [22, 22] }),
      ],
      s
    ),
  ],

  gem: (s) => [
    shape('gem', 'M-54,-58 L54,-58 L92,-14 L0,86 L-92,-14 Z', s),
    line('gem-facets', 'M-54,-58 L-24,-14 L0,86 M54,-58 L24,-14 L0,86 M-92,-14 L92,-14', s, 11),
  ],

  target: (s) => [
    L.groupItem('t-outer', [L.ellipseItem({ p: [0, 0], s: [186, 186] }), ...paint(s)]),
    L.groupItem('t-mid', [L.ellipseItem({ p: [0, 0], s: [116, 116] }), L.strokeItem(s.ink, s.sw)]),
    detail('t-bull', [L.ellipseItem({ p: [0, 0], s: [46, 46] })], s),
  ],

  gradcap: (s) => [
    shape('cap-body', 'M-46,-6 L46,-6 L42,36 C42,52 -42,52 -42,36 Z', s),
    shape('cap-board', 'M0,-76 L98,-28 L0,20 L-98,-28 Z', s),
  ],

  thumbsUp: (s) => [
    L.groupItem('fist', [L.rectItem({ p: [12, 30], s: [104, 86], r: 26 }), ...paint(s)]),
    L.groupItem('thumb', [L.rectItem({ p: [0, 0], s: [44, 100], r: 22 }), ...paint(s)], {
      p: [-42, -42],
      r: -16,
    }),
    line('knuckles', 'M-16,10 L44,10 M-16,42 L44,42', s, 9),
  ],

  /* Ладонь: подушка + отставленный большой палец + разделение
     пальцев. Зеркалится через iconGroup({mirror:true}). */
  clapHand: (s) => [
    L.groupItem('thumb', [L.rectItem({ p: [0, 0], s: [38, 66], r: 19 }), ...paint(s)], { p: [-50, 30], r: -28 }),
    L.groupItem('palm', [L.rectItem({ p: [0, 4], s: [94, 116], r: 30 }), ...paint(s)]),
    line('fingers', 'M-24,-44 L-24,20 M2,-50 L2,20 M28,-44 L28,20', s, 9),
  ],

  dots: (s) => [
    L.groupItem('d1', [L.ellipseItem({ p: [-62, 0], s: [50, 50] }), ...paint(s)]),
    L.groupItem('d2', [L.ellipseItem({ p: [0, 0], s: [50, 50] }), ...paint(s)]),
    L.groupItem('d3', [L.ellipseItem({ p: [62, 0], s: [50, 50] }), ...paint(s)]),
  ],
};

module.exports = { ICONS, baseStyle, shadowStyle, paint, shape, detail, line, P, BRAND };
