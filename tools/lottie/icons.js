'use strict';
/* =========================================================
   ИКОНКИ НАБОРА «НЕЙРО ОТЛИЧНИК»
   =========================================================
   Единая система, а не просто список картинок. Правила, которые
   держат 50 анимаций как один пак:

   1. ОБЩИЙ БОКС. Вся геометрия нарисована в боксе 200×200 с
      центром в (0,0) — координаты живут в -100…100. Дальше иконка
      масштабируется под канвас: 512 для реакций, 100 для эмодзи.

   2. ОПТИЧЕСКИЙ ВЕС. Габарит и «вес» — разные вещи: круг при том
      же размере выглядит крупнее квадрата, а звезда — легче обоих.
      Поэтому у каждой иконки есть `fit` — поправка масштаба,
      которая уравнивает именно видимую массу.

   3. ОБВОДКА СНАРУЖИ. Заливка кладётся поверх обводки (см. paint),
      иначе внутренняя половина штриха съедает лайм на тонких формах.

   4. БЛИК. У каждой иконки — белая капсула в верхней части: один и
      тот же приём по всему набору связывает его воедино и добавляет
      объёма. На слое тени блик становится графитовым и растворяется
      в силуэте.

   Каждая иконка — { fit, draw(style) → шейп-группы }. style задаёт
   заливку, обводку, цвет тёмных деталей и блика. Если передать все
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

/* Обводка в Lottie идёт по центру контура: половина ложится наружу,
   половина — внутрь, съедая заливку. На тонких формах (молния, ручки
   кубка, лучи звезды) внутренняя половина съедала почти весь лайм.
   Поэтому заливка кладётся ПОВЕРХ обводки, а ширина обводки удвоена:
   наружу выходит ровно та толщина, что задана, а лайм остаётся целым. */
function paint(style) {
  const out = [];
  if (style.fill) out.push(L.fillItem(style.fill));
  if (style.stroke && style.sw) out.push(L.strokeItem(style.stroke, style.sw * 2));
  return out;
}

// группа из одного или нескольких контуров с общей заливкой/обводкой
function shape(nm, d, style, transform) {
  const items = P(d).map((sp, i) => L.pathShapeItem(sp, `${nm}-${i}`));
  return L.groupItem(nm, [...items, ...paint(style)], transform);
}

// сплошная деталь тёмным (зрачок, перемычка, полоса) — без обводки
function detail(nm, items, style, transform) {
  return L.groupItem(nm, [...items, L.fillItem(style.ink)], transform);
}

// открытая линия (штрих без заливки) — галочки, стрелки, складки.
// По умолчанию это тёмная деталь поверх формы, но если линия и есть
// сама иконка (галочка, знак вопроса), цвет берётся основной.
function line(nm, d, style, width, transform, color) {
  const items = P(d, false).map((sp, i) => L.pathShapeItem(sp, `${nm}-${i}`));
  return L.groupItem(nm, [...items, L.strokeItem(color || style.ink, width)], transform);
}

/* Блик — один и тот же приём на весь набор: короткая белая капсула
   в верхней части формы, наклонённая по её силуэту. */
function gloss(style, { x = -34, y = -40, w = 20, h = 46, r = -32 } = {}) {
  return L.groupItem(
    'gloss',
    [L.rectItem({ p: [0, 0], s: [w, h], r: Math.min(w, h) / 2 }), L.fillItem(style.gloss)],
    { p: [x, y], r }
  );
}

/* Стиль по умолчанию: лаймовая заливка, графитовая обводка, белый блик. */
function baseStyle(sw = 13) {
  return { fill: BRAND.lime, stroke: BRAND.ink, ink: BRAND.ink, gloss: BRAND.white, sw };
}
/* Силуэт одним цветом — для смещённой тени. */
function shadowStyle(sw = 13, color = BRAND.ink) {
  return { fill: color, stroke: color, ink: color, gloss: color, sw };
}

// =========================================================
// ИКОНКИ
// =========================================================
const ICONS = {
  heart: {
    fit: 1,
    draw: (s) => [
      shape(
        'heart',
        'M0,82 C-46,44 -92,6 -92,-32 C-92,-64 -68,-84 -40,-84 C-22,-84 -7,-74 0,-59 ' +
          'C7,-74 22,-84 40,-84 C68,-84 92,-64 92,-32 C92,6 46,44 0,82 Z',
        s
      ),
      gloss(s, { x: -54, y: -38, w: 23, h: 48, r: -30 }),
    ],
  },

  /* Пламя: острый кончик, широкое основание и характерный вырез
     слева — без него силуэт читался как капля, а не как огонь. */
  fire: {
    fit: 1.04,
    draw: (s) => [
      shape(
        'flame',
        'M0,-96 C20,-62 42,-42 54,-18 C66,6 62,40 40,62 C20,82 -8,92 -30,84 ' +
          'C-56,74 -70,46 -66,18 C-62,-8 -46,-26 -32,-44 ' +
          'C-30,-18 -20,-2 -4,4 C-18,-24 -16,-62 0,-96 Z',
        s
      ),
      detail(
        'flame-core',
        P('M2,72 C18,54 32,36 32,16 C32,-2 20,-16 2,-26 C7,-2 -5,16 -20,22 C-18,42 -8,58 2,72 Z').map((sp, i) =>
          L.pathShapeItem(sp, `c${i}`)
        ),
        s
      ),
      gloss(s, { x: -40, y: -6, w: 21, h: 46, r: -14 }),
    ],
  },

  bolt: {
    fit: 1.02,
    draw: (s) => [
      shape('bolt', 'M26,-96 L-58,10 L-6,10 L-26,96 L58,-14 L8,-14 Z', s),
      gloss(s, { x: -16, y: -36, w: 18, h: 44, r: 38 }),
    ],
  },

  star: {
    fit: 1.06,
    draw: (s) => [
      L.groupItem('star', [L.starItem({ p: [0, 0], pt: 5, or_: 96, ir: 46, os: 6, is: 3, rot: -90 }), ...paint(s)]),
      gloss(s, { x: -28, y: -34, w: 19, h: 38, r: -26 }),
    ],
  },

  /* Четырёхлучевая искра: лучи заметно толще прежних — иначе почти
     весь объём уходил в обводку и лайма не оставалось. */
  spark: {
    fit: 1.06,
    draw: (s) => [
      L.groupItem('spark', [L.starItem({ p: [0, 0], pt: 4, or_: 96, ir: 42, os: 2, is: 0, rot: -90 }), ...paint(s)]),
      gloss(s, { x: -22, y: -26, w: 17, h: 32, r: -30 }),
    ],
  },

  check: {
    fit: 0.94,
    draw: (s) => [
      L.groupItem('check-badge', [L.ellipseItem({ p: [0, 0], s: [190, 190] }), ...paint(s)]),
      line('check-mark', 'M-46,2 L-14,36 L46,-36', s, 22),
      gloss(s, { x: -54, y: -52, w: 21, h: 46, r: -34 }),
    ],
  },

  /* Галочка и знак вопроса — сами по себе штрихи, поэтому обводка
     им рисуется вторым, более широким штрихом снизу: так они попадают
     в ту же систему «лайм + графитовый контур», что и все остальные. */
  checkPlain: {
    fit: 1.02,
    draw: (s) => [
      line('check-edge', 'M-70,4 L-20,56 L72,-56', s, 42 + s.sw * 2, undefined, s.stroke),
      line('check-fill', 'M-70,4 L-20,56 L72,-56', s, 42, undefined, s.fill),
    ],
  },

  cross: {
    fit: 1,
    draw: (s) => [
      shape('cross', 'M-64,-46 L-46,-64 L0,-18 L46,-64 L64,-46 L18,0 L64,46 L46,64 L0,18 L-46,64 L-64,46 L-18,0 Z', s),
      gloss(s, { x: -40, y: -36, w: 17, h: 30, r: 45 }),
    ],
  },

  arrowUp: {
    fit: 1,
    draw: (s) => [
      shape('arrow-up', 'M0,-92 L64,-16 L26,-16 L26,92 L-26,92 L-26,-16 L-64,-16 Z', s),
      gloss(s, { x: -13, y: 26, w: 17, h: 50, r: 0 }),
    ],
  },

  arrowRight: {
    fit: 1,
    draw: (s) => [
      shape('arrow-right', 'M92,0 L16,64 L16,26 L-92,26 L-92,-26 L16,-26 L16,-64 Z', s),
      gloss(s, { x: -36, y: -13, w: 17, h: 50, r: 90 }),
    ],
  },

  eye: {
    fit: 1,
    draw: (s) => [
      shape('eye', 'M-96,0 C-58,-56 -22,-74 0,-74 C22,-74 58,-56 96,0 C58,56 22,74 0,74 C-22,74 -58,56 -96,0 Z', s),
      detail('pupil', [L.ellipseItem({ p: [0, 0], s: [58, 58] })], s),
      L.groupItem('eye-glint', [L.ellipseItem({ p: [14, -16], s: [18, 18] }), L.fillItem(s.gloss)]),
    ],
  },

  /* Очки — форма фирменного знака: две линзы, перемычка, дужки.
     На ней строятся реакция «глаза» и подмигивание логотипа. */
  glasses: {
    fit: 1.14,
    draw: (s) => [
      L.groupItem('temple-l', [L.rectItem({ p: [0, 0], s: [40, 16], r: 8 }), ...paint(s)], { p: [-98, -14], r: -16 }),
      L.groupItem('temple-r', [L.rectItem({ p: [0, 0], s: [40, 16], r: 8 }), ...paint(s)], { p: [98, -14], r: 16 }),
      L.groupItem('bridge', [L.rectItem({ p: [0, -8], s: [40, 18], r: 9 }), ...paint(s)]),
      L.groupItem('lens-l', [L.rectItem({ p: [-48, 6], s: [86, 78], r: 34 }), ...paint(s)]),
      L.groupItem('lens-r', [L.rectItem({ p: [48, 6], s: [86, 78], r: 34 }), ...paint(s)]),
      detail('pupils', [L.ellipseItem({ p: [-48, 8], s: [32, 32] }), L.ellipseItem({ p: [48, 8], s: [32, 32] })], s),
      L.groupItem('glass-glint', [L.rectItem({ p: [0, 0], s: [12, 26], r: 6 }), L.fillItem(s.gloss)], { p: [-66, -10], r: -30 }),
    ],
  },

  clock: {
    fit: 0.94,
    draw: (s) => [
      L.groupItem('clock-face', [L.ellipseItem({ p: [0, 0], s: [180, 180] }), ...paint(s)]),
      detail('hands', [L.rectItem({ p: [0, -22], s: [15, 62], r: 7 }), L.rectItem({ p: [22, 8], s: [58, 15], r: 7 })], s),
      gloss(s, { x: -50, y: -50, w: 19, h: 42, r: -34 }),
    ],
  },

  pin: {
    fit: 1,
    draw: (s) => [
      shape('pin', 'M0,94 C-48,26 -66,-6 -66,-34 C-66,-70 -36,-96 0,-96 C36,-96 66,-70 66,-34 C66,-6 48,26 0,94 Z', s),
      detail('pin-hole', [L.ellipseItem({ p: [0, -36], s: [46, 46] })], s),
      gloss(s, { x: -40, y: -56, w: 17, h: 34, r: -32 }),
    ],
  },

  bulb: {
    fit: 0.98,
    draw: (s) => [
      L.groupItem('bulb-glass', [L.ellipseItem({ p: [0, -22], s: [150, 158] }), ...paint(s)]),
      detail('bulb-base', [L.rectItem({ p: [0, 74], s: [70, 30], r: 10 })], s),
      detail('bulb-spark', [L.starItem({ p: [0, -24], pt: 4, or_: 36, ir: 13, sy: 1 })], s),
      gloss(s, { x: -44, y: -58, w: 18, h: 38, r: -32 }),
    ],
  },

  cube: {
    fit: 1,
    draw: (s) => [
      shape('cube-top', 'M0,-88 L76,-44 L0,0 L-76,-44 Z', s),
      shape('cube-left', 'M-76,-44 L0,0 L0,88 L-76,44 Z', s),
      shape('cube-right', 'M76,-44 L76,44 L0,88 L0,0 Z', s),
      gloss(s, { x: -34, y: -46, w: 16, h: 30, r: 30 }),
    ],
  },

  house: {
    fit: 1,
    draw: (s) => [
      shape('house-body', 'M-68,-2 L68,-2 L68,86 L-68,86 Z', s),
      shape('house-roof', 'M-92,6 L0,-88 L92,6 Z', s),
      detail('house-door', [L.rectItem({ p: [0, 50], s: [46, 62], r: 8 })], s),
      gloss(s, { x: -32, y: -38, w: 16, h: 34, r: 44 }),
    ],
  },

  camera: {
    fit: 1,
    draw: (s) => [
      shape('camera-bump', 'M-54,-58 L-16,-58 L-10,-30 L-60,-30 Z', s),
      L.groupItem('camera-body', [L.rectItem({ p: [0, 16], s: [180, 126], r: 24 }), ...paint(s)]),
      L.groupItem('camera-lens', [L.ellipseItem({ p: [0, 16], s: [78, 78] }), L.strokeItem(s.ink, s.sw * 1.7)]),
      detail('camera-dot', [L.ellipseItem({ p: [58, -16], s: [20, 20] })], s),
      gloss(s, { x: -58, y: 0, w: 17, h: 34, r: -30 }),
    ],
  },

  palette: {
    fit: 0.98,
    draw: (s) => [
      shape(
        'palette',
        'M-6,-90 C48,-90 94,-52 94,-6 C94,28 68,46 44,46 L28,46 C14,46 6,54 6,64 ' +
          'C6,74 12,80 12,88 C12,94 6,96 -2,96 C-54,96 -94,54 -94,0 C-94,-52 -50,-90 -6,-90 Z',
        s
      ),
      detail(
        'palette-dots',
        [
          L.ellipseItem({ p: [-48, -18], s: [28, 28] }),
          L.ellipseItem({ p: [-2, -48], s: [28, 28] }),
          L.ellipseItem({ p: [46, -20], s: [28, 28] }),
        ],
        s
      ),
      gloss(s, { x: -64, y: 22, w: 16, h: 32, r: -18 }),
    ],
  },

  percent: {
    fit: 1,
    draw: (s) => [
      L.groupItem('pc-a', [L.ellipseItem({ p: [-46, -46], s: [70, 70] }), ...paint(s)]),
      L.groupItem('pc-b', [L.ellipseItem({ p: [46, 46], s: [70, 70] }), ...paint(s)]),
      detail('pc-slash', [L.rectItem({ p: [0, 0], s: [24, 190], r: 12 })], s, { r: 34 }),
      gloss(s, { x: -58, y: -60, w: 15, h: 26, r: -32 }),
    ],
  },

  question: {
    fit: 1.02,
    draw: (s) => {
      const d = 'M-40,-40 C-40,-72 -16,-90 8,-90 C38,-90 58,-70 58,-44 C58,-16 30,-10 18,6 C10,18 10,26 10,36';
      return [
        L.groupItem('q-dot', [L.ellipseItem({ p: [10, 78], s: [36, 36] }), ...paint(s)]),
        line('q-edge', d, s, 34 + s.sw * 2, undefined, s.stroke),
        line('q-fill', d, s, 34, undefined, s.fill),
      ];
    },
  },

  crown: {
    fit: 1,
    draw: (s) => [
      shape('crown', 'M-88,50 L-78,-46 L-30,-4 L0,-64 L30,-4 L78,-46 L88,50 Z', s),
      detail('crown-band', [L.rectItem({ p: [0, 66], s: [176, 32], r: 13 })], s),
      detail(
        'crown-gems',
        [
          L.ellipseItem({ p: [-46, 12], s: [22, 22] }),
          L.ellipseItem({ p: [0, 2], s: [24, 24] }),
          L.ellipseItem({ p: [46, 12], s: [22, 22] }),
        ],
        s
      ),
      gloss(s, { x: -62, y: 8, w: 16, h: 30, r: -8 }),
    ],
  },

  /* Кубок: ручки, ножка и подставка — полноценные лаймовые формы с
     обводкой. Раньше это были тонкие тёмные детали, и всё, кроме
     чаши, сливалось в одно пятно. */
  trophy: {
    fit: 1,
    draw: (s) => [
      shape('handle-l', 'M-48,-64 C-88,-64 -98,-18 -50,2 L-50,-24 C-72,-36 -68,-50 -48,-46 Z', s),
      shape('handle-r', 'M48,-64 C88,-64 98,-18 50,2 L50,-24 C72,-36 68,-50 48,-46 Z', s),
      shape('cup', 'M-52,-78 L52,-78 L46,-6 C46,22 24,40 0,40 C-24,40 -46,22 -46,-6 Z', s),
      shape('stem', 'M-20,34 L20,34 L24,64 L-24,64 Z', s),
      shape('base', 'M-58,60 L58,60 C64,60 68,66 68,72 L68,84 C68,90 64,94 58,94 L-58,94 C-64,94 -68,90 -68,84 L-68,72 C-68,66 -64,60 -58,60 Z', s),
      gloss(s, { x: -26, y: -48, w: 17, h: 36, r: -12 }),
    ],
  },

  rocket: {
    fit: 1,
    draw: (s) => [
      shape('fin-l', 'M-36,-4 L-78,54 L-36,42 Z', s),
      shape('fin-r', 'M36,-4 L78,54 L36,42 Z', s),
      shape('body', 'M0,-96 C26,-62 40,-22 40,20 C40,42 24,58 0,58 C-24,58 -40,42 -40,20 C-40,-22 -26,-62 0,-96 Z', s),
      detail('window', [L.ellipseItem({ p: [0, -22], s: [46, 46] })], s),
      gloss(s, { x: -22, y: 16, w: 16, h: 34, r: -6 }),
    ],
  },

  brain: {
    fit: 1,
    draw: (s) => [
      shape(
        'brain',
        'M-8,-84 C22,-96 58,-84 68,-58 C92,-50 98,-16 78,4 C88,28 70,58 44,62 ' +
          'C30,86 -8,90 -26,70 C-54,74 -78,50 -70,22 C-92,2 -84,-36 -58,-46 C-56,-74 -32,-92 -8,-84 Z',
        s
      ),
      line('brain-net', 'M-30,-46 L-4,-16 L-38,14 L-6,44', s, 13),
      line('brain-net-2', 'M-4,-16 L34,-30 M-4,-16 L30,26', s, 13),
      detail(
        'brain-nodes',
        [
          L.ellipseItem({ p: [-30, -46], s: [24, 24] }),
          L.ellipseItem({ p: [34, -30], s: [24, 24] }),
          L.ellipseItem({ p: [30, 26], s: [24, 24] }),
          L.ellipseItem({ p: [-6, 44], s: [24, 24] }),
        ],
        s
      ),
      gloss(s, { x: -58, y: -44, w: 16, h: 30, r: -34 }),
    ],
  },

  gem: {
    fit: 1,
    draw: (s) => [
      shape('gem', 'M-54,-58 L54,-58 L92,-14 L0,86 L-92,-14 Z', s),
      line('gem-facets', 'M-54,-58 L-24,-14 L0,86 M54,-58 L24,-14 L0,86 M-92,-14 L92,-14', s, 12),
      gloss(s, { x: -40, y: -40, w: 15, h: 26, r: 0 }),
    ],
  },

  gradcap: {
    fit: 1.04,
    draw: (s) => [
      shape('cap-body', 'M-46,-6 L46,-6 L42,36 C42,52 -42,52 -42,36 Z', s),
      shape('cap-board', 'M0,-76 L98,-28 L0,20 L-98,-28 Z', s),
      gloss(s, { x: -46, y: -34, w: 16, h: 32, r: 62 }),
    ],
  },

  /* Палец вверх: крупный кулак, отдельный большой палец и тёмный
     манжет снизу — без манжета силуэт читался как шахматная фигура. */
  thumbsUp: {
    fit: 1,
    draw: (s) => [
      L.groupItem('thumb', [L.rectItem({ p: [0, 0], s: [54, 108], r: 27 }), ...paint(s)], { p: [-42, -42], r: -10 }),
      L.groupItem('fist', [L.rectItem({ p: [14, 32], s: [118, 100], r: 28 }), ...paint(s)]),
      detail('cuff', [L.rectItem({ p: [14, 72], s: [118, 26], r: 12 })], s),
      line('knuckles', 'M-16,14 L58,14 M-16,42 L58,42', s, 10),
      gloss(s, { x: -46, y: -66, w: 17, h: 34, r: -10 }),
    ],
  },

  /* Ладонь с раздельными пальцами — сплошная «подушка» с двумя
     штрихами не читалась как рука. */
  clapHand: {
    fit: 1.02,
    draw: (s) => [
      L.groupItem('thumb', [L.rectItem({ p: [0, 0], s: [40, 74], r: 20 }), ...paint(s)], { p: [-54, 32], r: -32 }),
      L.groupItem('finger-1', [L.rectItem({ p: [-34, -28], s: [28, 78], r: 14 }), ...paint(s)]),
      L.groupItem('finger-2', [L.rectItem({ p: [-6, -40], s: [28, 90], r: 14 }), ...paint(s)]),
      L.groupItem('finger-3', [L.rectItem({ p: [22, -34], s: [28, 82], r: 14 }), ...paint(s)]),
      L.groupItem('finger-4', [L.rectItem({ p: [48, -16], s: [28, 62], r: 14 }), ...paint(s)]),
      L.groupItem('palm', [L.rectItem({ p: [4, 36], s: [118, 84], r: 26 }), ...paint(s)]),
      gloss(s, { x: -36, y: 28, w: 16, h: 32, r: -8 }),
    ],
  },

  dots: {
    fit: 0.96,
    draw: (s) => [
      L.groupItem('d1', [L.ellipseItem({ p: [-72, 0], s: [52, 52] }), ...paint(s)]),
      L.groupItem('d2', [L.ellipseItem({ p: [0, 0], s: [52, 52] }), ...paint(s)]),
      L.groupItem('d3', [L.ellipseItem({ p: [72, 0], s: [52, 52] }), ...paint(s)]),
    ],
  },

  /* «100» — оценка отличника. Нули собраны из внешнего и внутреннего
     контуров с чётно-нечётным правилом заливки, поэтому середина
     остаётся прозрачной, а не закрашивается лаймом. */
  hundred: {
    fit: 1.12,
    draw: (s) => {
      const ring = (nm, cx, rx, ry, irx, iry) =>
        L.groupItem(nm, [
          ...P(
            `M${cx},${-ry} C${cx + rx * 0.58},${-ry} ${cx + rx},${-ry * 0.55} ${cx + rx},0 ` +
              `C${cx + rx},${ry * 0.55} ${cx + rx * 0.58},${ry} ${cx},${ry} ` +
              `C${cx - rx * 0.58},${ry} ${cx - rx},${ry * 0.55} ${cx - rx},0 ` +
              `C${cx - rx},${-ry * 0.55} ${cx - rx * 0.58},${-ry} ${cx},${-ry} Z`
          ).map((sp, i) => L.pathShapeItem(sp, `o${i}`)),
          ...P(
            `M${cx},${-iry} C${cx + irx * 0.6},${-iry} ${cx + irx},${-iry * 0.5} ${cx + irx},0 ` +
              `C${cx + irx},${iry * 0.5} ${cx + irx * 0.6},${iry} ${cx},${iry} ` +
              `C${cx - irx * 0.6},${iry} ${cx - irx},${iry * 0.5} ${cx - irx},0 ` +
              `C${cx - irx},${-iry * 0.5} ${cx - irx * 0.6},${-iry} ${cx},${-iry} Z`
          ).map((sp, i) => L.pathShapeItem(sp, `i${i}`)),
          L.fillItem(s.fill, 100, 2),
          L.strokeItem(s.stroke, s.sw * 2),
        ]);
      return [
        shape('one', 'M-98,-40 L-64,-66 L-44,-66 L-44,66 L-78,66 L-78,-30 Z', s),
        ring('zero-a', 0, 40, 66, 14, 28),
        ring('zero-b', 66, 40, 66, 14, 28),
        gloss(s, { x: -86, y: -32, w: 15, h: 28, r: -18 }),
      ];
    },
  },
};

module.exports = { ICONS, baseStyle, shadowStyle, paint, shape, detail, line, gloss, P, BRAND };
