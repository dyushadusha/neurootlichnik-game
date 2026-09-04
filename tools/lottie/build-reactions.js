'use strict';
/* =========================================================
   РЕАКЦИИ НА ПОСТ — 18 штук, канвас 512×512, 60 fps
   =========================================================
   Все построены на общем языке движения (motion.js + compose.js):
   пружинное появление с перелётом, squash & stretch, вторичное
   движение деталей и «живой» idle вместо статики.
   ========================================================= */

const path = require('path');
const L = require('./lib');
const M = require('./motion');
const C = require('./compose');
const { ICONS, baseStyle, shadowStyle, BRAND } = require('./icons');

const OUT_DIR = path.join(__dirname, '..', '..', 'assets', 'lottie');
const W = 512;
const H = 512;
const CX = W / 2;
const CY = H / 2;
const FR = 60;

function emit(nm, op, layers) {
  L.writeJson(path.join(OUT_DIR, `${nm}.json`), L.animation({ w: W, h: H, fr: FR, op, nm, layers }));
}

/* Обёртка: собрать стикер из иконки и сразу записать файл. */
function sticker(nm, op, opts) {
  L.resetLayerIndex();
  emit(nm, op, C.buildSticker({ canvas: W, op, ...opts }));
}

// =========================================================
// 1. СЕРДЦЕ — пружинное появление, дальше живое сердцебиение
// =========================================================
function heart() {
  sticker('reaction-heart', 120, {
    icon: 'heart',
    entrance: 'pop',
    iconSize: 320,
    accents: {
      ring: { t0: 11, size: 170 },
      sparks: [
        [128, -128, 78, 13, 26],
        [-136, -92, 58, 19, -22],
      ],
    },
    patchMotion: (mo) => ({
      ...mo,
      s: M.seq(M.popIn({ t0: 0, dur: 30, to: 100, lag: 3 }), M.heartbeat({ t0: 34, t1: 120, base: 100, amp: 0.11 })),
    }),
  });
}

// =========================================================
// 2. ОГОНЬ — «дышит» и дрожит, как настоящее пламя
// =========================================================
function fire() {
  sticker('reaction-fire', 110, {
    icon: 'fire',
    entrance: 'pop',
    iconSize: 300,
    center: [CX, CY + 14],
    accents: { sparks: [[110, -140, 52, 22, 30]] },
    patchMotion: (mo, { pos }) => ({
      s: M.seq(
        M.popIn({ t0: 0, dur: 26, to: 100, lag: 4 }),
        // пламя живёт неровным ритмом: вертикаль тянется, горизонталь поджимается
        M.breathe({ t0: 30, t1: 110, base: 100, amp: 5.5, cycles: 3, phaseLag: 0.5 })
      ),
      r: M.seq(M.wobble({ t0: 2, dur: 30, amp: 8 }), M.jitter({ t0: 30, t1: 110, amp: 3.5, seed: 7, step: 6 })),
      p: M.seq(
        M.hold(0, pos),
        M.bake({ t0: 30, dur: 80, from: pos, to: pos, curve: M.curves.linear, step: 8 })
      ),
    }),
  });
}

// =========================================================
// 3. ЛАЙК — замах и выброс большого пальца
// =========================================================
function thumbsUp() {
  sticker('reaction-thumbsup', 115, {
    icon: 'thumbsUp',
    entrance: 'anticipate',
    iconSize: 300,
    center: [CX + 6, CY + 10],
    accents: {
      burst: { count: 6, t0: 14, radius: 192, len: 44, width: 14 },
      sparks: [[112, -132, 62, 18, -24]],
    },
  });
}

// =========================================================
// 4. ЗВЕЗДА — наплыв из крупного плана и мерцание
// =========================================================
function star() {
  sticker('reaction-star', 118, {
    icon: 'star',
    entrance: 'zoom',
    iconSize: 320,
    accents: {
      ring: { t0: 10, size: 180 },
      sparks: [
        [146, -70, 62, 14, 30],
        [-140, 78, 54, 26, -28],
        [-104, -122, 46, 34, 24],
      ],
    },
  });
}

// =========================================================
// 5. ИДЕЯ — лампочка загорается, лучи вспыхивают волной
// =========================================================
function lightbulb() {
  L.resetLayerIndex();
  const OP = 126;
  const pos = [CX, CY + 16];
  const rays = [];
  const RAYS = 8;
  for (let i = 0; i < RAYS; i++) {
    const a = (i * 360) / RAYS - 90;
    const rad = (a * Math.PI) / 180;
    const near = [pos[0] + Math.cos(rad) * 150, pos[1] + Math.sin(rad) * 150];
    const far = [pos[0] + Math.cos(rad) * 186, pos[1] + Math.sin(rad) * 186];
    const t0 = 22 + i * 2;
    rays.push(
      L.shapeLayer(`Ray ${i}`, [
        L.groupItem('ray', [
          L.rectItem({ p: [0, 0], s: [16, 50], r: 8 }),
          L.strokeItem(BRAND.ink, 8),
          L.fillItem(BRAND.lime),
        ]),
      ], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(M.seq(M.hold(0, near), M.hold(t0, near), M.bake({ t0, dur: 18, from: near, to: far, curve: M.curves.spring({ bounces: 2, decay: 5 }), step: 2 }))),
          r: L.staticProp(a + 90),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 18, to: 100, lag: 2 }), M.breathe({ t0: t0 + 20, t1: OP, base: 100, amp: 9, cycles: 2 }))),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 4, 100), M.hold(OP, 100))),
        },
      })
    );
  }
  emit('reaction-lightbulb', OP, [
    ...rays,
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'bulb',
      entrance: 'pop',
      iconSize: 300,
      center: pos,
      accents: { ring: { t0: 16, size: 160 } },
    }),
  ]);
}

// =========================================================
// 6. ОТЛИЧНО — бейдж впечатывается как штамп
// =========================================================
function perfect() {
  sticker('reaction-perfect', 124, {
    icon: 'check',
    entrance: 'stamp',
    iconSize: 330,
    accents: {
      burst: { count: 10, t0: 16, radius: 196, len: 46, width: 14 },
      ring: { t0: 16, size: 200 },
      sparks: [
        [150, -140, 58, 24, 26],
        [-152, -108, 46, 32, -22],
      ],
    },
  });
}

// =========================================================
// 7. КОНФЕТТИ — залп частиц с пружиной и вращением
// =========================================================
function confetti() {
  L.resetLayerIndex();
  const OP = 108;
  const defs = [
    { a: -90, d: 196, s: 26, k: 'rect', c: 'lime', spin: 150, t: 0 },
    { a: -55, d: 214, s: 20, k: 'circle', c: 'ink', spin: 0, t: 3 },
    { a: -20, d: 200, s: 28, k: 'tri', c: 'lime', spin: -130, t: 1 },
    { a: 12, d: 222, s: 18, k: 'circle', c: 'lime', spin: 0, t: 5 },
    { a: 46, d: 198, s: 25, k: 'rect', c: 'ink', spin: -170, t: 2 },
    { a: 80, d: 228, s: 20, k: 'circle', c: 'lime', spin: 0, t: 0 },
    { a: 114, d: 200, s: 26, k: 'tri', c: 'lime', spin: 140, t: 4 },
    { a: 148, d: 212, s: 19, k: 'circle', c: 'ink', spin: 0, t: 2 },
    { a: 180, d: 204, s: 24, k: 'rect', c: 'lime', spin: -150, t: 6 },
    { a: 212, d: 192, s: 17, k: 'circle', c: 'lime', spin: 0, t: 1 },
    { a: 244, d: 210, s: 23, k: 'tri', c: 'ink', spin: 160, t: 7 },
    { a: 276, d: 196, s: 19, k: 'circle', c: 'lime', spin: 0, t: 3 },
    { a: 308, d: 220, s: 25, k: 'rect', c: 'lime', spin: 130, t: 5 },
    { a: 340, d: 202, s: 21, k: 'circle', c: 'ink', spin: 0, t: 2 },
  ];

  const layers = defs.map((p, i) => {
    const rad = (p.a * Math.PI) / 180;
    const end = [CX + Math.cos(rad) * p.d, CY + Math.sin(rad) * p.d];
    const mid = [CX + Math.cos(rad) * p.d * 0.7, CY + Math.sin(rad) * p.d * 0.7];
    const color = p.c === 'lime' ? BRAND.lime : BRAND.ink;
    let item;
    // вытянутая полоска — то, что и читается как конфетти;
    // квадратики и кружки одного размера выглядели как «пыль»
    if (p.k === 'rect') item = L.rectItem({ p: [0, 0], s: [p.s * 0.8, p.s * 2.7], r: p.s * 0.3 });
    else if (p.k === 'circle') item = L.ellipseItem({ p: [0, 0], s: [p.s * 1.15, p.s * 1.15] });
    else item = L.starItem({ p: [0, 0], pt: 3, or_: p.s * 1.05, ir: p.s * 0.5, sy: 1 });

    const t0 = p.t;
    return L.shapeLayer(`Particle ${i}`, [L.groupItem('p', [item, L.fillItem(color)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        // вылет с резким стартом и «оседанием» в конце — частица теряет энергию
        p: L.animProp(
          M.seq(
            M.hold(0, [CX, CY]),
            M.hold(t0, [CX, CY]),
            M.bake({ t0, dur: 30, from: [CX, CY], to: mid, curve: M.curves.expoOut, step: 2 }),
            M.bake({ t0: t0 + 30, dur: 34, from: mid, to: end, curve: M.curves.easeOut, step: 4 })
          )
        ),
        r: L.animProp(M.seq(M.hold(0, p.a), M.hold(t0, p.a), M.bake({ t0, dur: 60, from: p.a, to: p.a + p.spin, curve: M.curves.easeOut, step: 5 }))),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 16, to: 100, lag: 2 }), M.bake({ t0: t0 + 44, dur: 22, from: [100, 100], to: [55, 55], curve: M.curves.easeIn, step: 3 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 3, 100), M.hold(t0 + 46, 100), M.hold(t0 + 66, 0))),
      },
    });
  });

  // центральная вспышка в кадре залпа
  const flash = L.shapeLayer('Flash', [L.groupItem('f', [L.ellipseItem({ p: [0, 0], s: [90, 90] }), L.fillItem(BRAND.lime)])], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY]),
      s: L.animProp(M.seq(M.hold(0, [20, 20]), M.bake({ t0: 0, dur: 16, from: [20, 20], to: [180, 180], curve: M.curves.expoOut, step: 2 }))),
      o: L.animProp(M.seq(M.hold(0, 100), M.bake({ t0: 0, dur: 16, from: 100, to: 0, curve: M.curves.easeOut, step: 2 }), M.hold(OP, 0))),
    },
  });

  emit('reaction-confetti', OP, [flash, ...layers, ...C.burstLayers({ pos: [CX, CY], op: OP, count: 6, t0: 0, radius: 150, len: 34, width: 11, color: BRAND.ink })]);
}

// =========================================================
// 8. ОТЛИЧНИК — шапочка падает, кисточка догоняет с задержкой
// =========================================================
function gradcap() {
  L.resetLayerIndex();
  const OP = 132;
  const pos = [CX, CY + 6];
  const mo = C.entranceMotion('drop', { pos, op: OP });
  const opacity = C.entranceOpacity('drop', OP);

  const capInd = L.nextLayerIndex();
  const capLayer = L.shapeLayer('Cap', [C.iconGroup('gradcap', baseStyle(13), 330)], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(mo.p),
      s: L.animProp(mo.s),
      r: L.animProp(mo.r),
      o: L.animProp(opacity),
    },
  });

  /* Кисточка — ребёнок шапочки: едет вместе с ней, но раскачивается
     сама и успокаивается позже (классический follow-through). */
  const tassel = L.shapeLayer(
    'Tassel',
    [
      L.groupItem('bead', [L.ellipseItem({ p: [0, 128], s: [30, 30] }), L.strokeItem(BRAND.ink, 9), L.fillItem(BRAND.lime)]),
      L.groupItem('thread', [L.rectItem({ p: [0, 64], s: [8, 128], r: 4 }), L.fillItem(BRAND.ink)]),
    ],
    {
      op: OP,
      parent: capInd,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp([14, -44]),
        r: L.animProp(
          M.seq(
            M.hold(0, 24),
            M.wobble({ t0: 24, dur: 56, amp: 30, bounces: 2.8, decay: 3.4 }),
            M.sway({ t0: 80, t1: OP, amp: 5, cycles: 1 })
          )
        ),
      },
    }
  );

  const shadow = L.shapeLayer('Shadow', [C.iconGroup('gradcap', shadowStyle(13), 330)], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(mo.p.map((k) => ({ ...k, v: [k.v[0] + 12, k.v[1] + 12] }))),
      s: L.animProp(mo.s),
      r: L.animProp(mo.r),
      o: L.animProp(opacity),
    },
  });

  emit('reaction-gradcap', OP, [
    ...C.burstLayers({ pos: [CX, CY + 40], op: OP, count: 6, t0: 26, radius: 188, len: 40, width: 12 }),
    C.sparkLayer({ pos: [CX - 150, CY - 120], size: 60, t0: 30, spin: 24, op: OP }),
    tassel,
    capLayer,
    shadow,
  ]);
}

// =========================================================
// 9. АПЛОДИСМЕНТЫ — ладони сходятся и бьются друг о друга
// =========================================================
function clap() {
  L.resetLayerIndex();
  const OP = 112;
  const HIT = 18;
  const hands = [];
  for (const side of [-1, 1]) {
    const rest = [CX + side * 44, CY + 14];
    const wide = [CX + side * 120, CY + 30];
    hands.push(
      L.shapeLayer(side < 0 ? 'Hand L' : 'Hand R', [C.iconGroup('clapHand', baseStyle(13), 230, 'icon', { mirror: side > 0 })], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          // сходятся резко, на ударе сплющиваются, потом дважды хлопают
          p: L.animProp(
            M.seq(
              M.hold(0, wide),
              M.bake({ t0: 0, dur: HIT, from: wide, to: rest, curve: M.curves.expoIn, step: 2 }),
              M.bake({ t0: HIT, dur: 16, from: rest, to: [CX + side * 92, CY + 20], curve: M.curves.easeOut, step: 3 }),
              M.bake({ t0: HIT + 16, dur: 12, from: [CX + side * 92, CY + 20], to: rest, curve: M.curves.expoIn, step: 2 }),
              M.sway({ t0: HIT + 30, t1: OP, base: rest[0], amp: side * 14, cycles: 2 }).map((k) => ({ ...k, v: [k.v, rest[1]] }))
            )
          ),
          s: L.animProp(M.seq(M.hold(0, [100, 100]), M.squash({ t: HIT, amount: 0.2, recover: 20 }), M.squash({ t: HIT + 28, amount: 0.13, recover: 18 }))),
          r: L.animProp(M.seq(M.hold(0, side * 22), M.bake({ t0: 0, dur: HIT, from: side * 22, to: side * 6, curve: M.curves.expoIn, step: 2 }), M.wobble({ t0: HIT, dur: 34, amp: side * 10 }), M.sway({ t0: HIT + 34, t1: OP, amp: side * 4, cycles: 2 }))),
        },
      })
    );
  }
  emit('reaction-clap', OP, [
    ...C.burstLayers({ pos: [CX, CY + 10], op: OP, count: 8, t0: HIT, radius: 190, len: 42, width: 13 }),
    C.ringLayer({ pos: [CX, CY + 10], t0: HIT, size: 150, op: OP }),
    ...hands,
  ]);
}

// =========================================================
// 10. РАКЕТА — старт со сжатием, разгон и след
// =========================================================
function rocket() {
  L.resetLayerIndex();
  const OP = 126;
  const start = [CX, CY + 96];
  const peak = [CX, CY - 10];

  // след: штрихи, убегающие вниз
  const trail = [];
  for (let i = 0; i < 5; i++) {
    const t0 = 16 + i * 5;
    const x = CX + (i % 2 === 0 ? -26 : 26) * (0.5 + (i % 3) * 0.35);
    trail.push(
      L.shapeLayer(`Trail ${i}`, [L.groupItem('t', [L.rectItem({ p: [0, 0], s: [13, 62], r: 7 }), L.fillItem(i % 2 ? BRAND.ink : BRAND.lime)])], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(M.seq(M.hold(0, [x, CY + 96]), M.hold(t0, [x, CY + 96]), M.bake({ t0, dur: 40, from: [x, CY + 96], to: [x, CY + 196], curve: M.curves.easeOut, step: 3 }))),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [100, 130]), M.bake({ t0, dur: 40, from: [100, 130], to: [40, 30], curve: M.curves.easeOut, step: 4 }))),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 100), M.hold(t0 + 34, 0))),
        },
      })
    );
  }

  const motion = {
    p: M.seq(
      M.hold(0, start),
      // приседание перед стартом, затем выброс вверх
      M.bake({ t0: 0, dur: 10, from: start, to: [CX, CY + 118], curve: M.curves.easeOut, step: 2 }),
      M.bake({ t0: 10, dur: 26, from: [CX, CY + 118], to: peak, curve: M.curves.spring({ bounces: 1.7, decay: 5.4 }), step: 2 }),
      M.sway({ t0: 40, t1: OP, base: peak[1], amp: 12, cycles: 1 }).map((k) => ({ ...k, v: [CX, k.v] }))
    ),
    s: M.seq(
      M.hold(0, [100, 100]),
      M.bake({ t0: 0, dur: 10, from: [100, 100], to: [122, 80], curve: M.curves.easeOut, step: 2 }),
      M.bake({ t0: 10, dur: 12, from: [122, 80], to: [82, 126], curve: M.curves.expoOut, step: 2 }),
      M.bake({ t0: 22, dur: 22, from: [82, 126], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 }),
      M.breathe({ t0: 46, t1: OP, base: 100, amp: 2, cycles: 1 })
    ),
    r: M.seq(M.hold(0, 0), M.wobble({ t0: 14, dur: 40, amp: 9 }), M.sway({ t0: 54, t1: OP, amp: 3, cycles: 1 })),
  };

  const ind = L.nextLayerIndex();
  const body = L.shapeLayer('Rocket', [C.iconGroup('rocket', baseStyle(13), 300)], {
    op: OP,
    ks: { a: L.staticProp([0, 0]), p: L.animProp(motion.p), s: L.animProp(motion.s), r: L.animProp(motion.r) },
  });
  const shadow = L.shapeLayer('Shadow', [C.iconGroup('rocket', shadowStyle(13), 300)], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(motion.p.map((k) => ({ ...k, v: [k.v[0] + 12, k.v[1] + 12] }))),
      s: L.animProp(motion.s),
      r: L.animProp(motion.r),
    },
  });

  emit('reaction-rocket', OP, [
    C.sparkLayer({ pos: [CX + 140, CY - 130], size: 60, t0: 30, spin: 24, op: OP }),
    C.sparkLayer({ pos: [CX - 150, CY - 60], size: 46, t0: 40, spin: -20, op: OP }),
    body,
    shadow,
    ...trail,
  ]);
}

// =========================================================
// 11. НЕЙРО — мозг с пульсирующими связями
// =========================================================
function brain() {
  L.resetLayerIndex();
  const OP = 130;
  const pos = [CX, CY];
  // импульсы по узлам сети — каждый вспыхивает со своей фазой
  const nodes = [
    [-51, -78], [58, -51], [51, 44], [-10, 75],
  ];
  const pulses = nodes.map((n, i) =>
    L.shapeLayer(`Pulse ${i}`, [L.groupItem('p', [L.ellipseItem({ p: [0, 0], s: [46, 46] }), L.strokeItem(BRAND.lime, 8)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp([pos[0] + n[0] * 1.7, pos[1] + n[1] * 1.7]),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(34 + i * 9, [0, 0]), M.bake({ t0: 34 + i * 9, dur: 30, from: [30, 30], to: [190, 190], curve: M.curves.expoOut, step: 3 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(34 + i * 9, 90), M.bake({ t0: 34 + i * 9, dur: 30, from: 90, to: 0, curve: M.curves.easeOut, step: 3 }), M.hold(OP, 0))),
      },
    })
  );
  emit('reaction-brain', OP, [
    ...pulses,
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'brain',
      entrance: 'pop',
      iconSize: 320,
      accents: { sparks: [[150, -128, 56, 20, 26]] },
    }),
  ]);
}

// =========================================================
// 12. ГЛАЗА — фирменные очки: моргают и косятся по сторонам
// =========================================================
function eyes() {
  L.resetLayerIndex();
  const OP = 122;
  emit('reaction-eyes', OP, [
    C.sparkLayer({ pos: [CX + 176, CY - 104], size: 56, t0: 30, spin: 22, op: OP }),
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'glasses',
      entrance: 'pop',
      iconSize: 264,
      patchMotion: (mo) => ({
        ...mo,
        // очки надеваются пружиной, потом дважды моргают
        s: M.seq(M.popIn({ t0: 0, dur: 28, to: 100, lag: 3 }), M.blink({ t0: 34, t1: OP, at: [48, 88], dur: 9 })),
        r: M.seq(M.wobble({ t0: 2, dur: 34, amp: 11 }), M.sway({ t0: 38, t1: OP, amp: 2.4, cycles: 1 })),
      }),
    }),
  ]);
}

// =========================================================
// 13. КОРОНА — падает сверху и садится с бликами
// =========================================================
function crown() {
  sticker('reaction-crown', 128, {
    icon: 'crown',
    entrance: 'drop',
    iconSize: 320,
    center: [CX, CY + 10],
    accents: {
      burst: { count: 7, t0: 26, radius: 192, len: 40, width: 12 },
      sparks: [
        [-150, -104, 58, 32, -24],
        [152, -96, 50, 38, 26],
        [8, -150, 44, 44, 20],
      ],
    },
  });
}

// =========================================================
// 14. МОЛНИЯ — резкий удар с вспышкой
// =========================================================
function bolt() {
  L.resetLayerIndex();
  const OP = 112;
  const flashLayer = L.shapeLayer('Flash', [L.groupItem('f', [L.ellipseItem({ p: [0, 0], s: [240, 240] }), L.fillItem(BRAND.lime)])], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY]),
      s: L.animProp(M.seq(M.hold(0, [30, 30]), M.hold(14, [40, 40]), M.bake({ t0: 15, dur: 20, from: [60, 60], to: [190, 190], curve: M.curves.expoOut, step: 2 }))),
      o: L.animProp(M.seq(M.hold(0, 0), M.hold(14, 0), M.hold(16, 70), M.bake({ t0: 16, dur: 20, from: 70, to: 0, curve: M.curves.easeOut, step: 3 }), M.hold(OP, 0))),
    },
  });
  emit('reaction-bolt', OP, [
    ...C.burstLayers({ pos: [CX, CY], op: OP, count: 8, t0: 16, radius: 196, len: 48, width: 14 }),
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'bolt',
      entrance: 'stamp',
      iconSize: 300,
      accents: { ring: { t0: 16, size: 180 } },
    }),
    flashLayer,
  ]);
}

// =========================================================
// 15. КУБОК — вырастает с сиянием
// =========================================================
function trophy() {
  sticker('reaction-trophy', 126, {
    icon: 'trophy',
    entrance: 'anticipate',
    iconSize: 310,
    accents: {
      burst: { count: 8, t0: 20, radius: 194, len: 42, width: 12, color: BRAND.lime },
      ring: { t0: 20, size: 170 },
      sparks: [
        [140, -120, 58, 26, 26],
        [-146, -88, 48, 34, -22],
      ],
    },
  });
}

// =========================================================
// 16. СТО БАЛЛОВ — оценка отличника
// =========================================================
function hundred() {
  L.resetLayerIndex();
  const OP = 124;
  emit('reaction-hundred', OP, [
    ...C.burstLayers({ pos: [CX, CY], op: OP, count: 8, t0: 18, radius: 196, len: 44, width: 13 }),
    C.ringLayer({ pos: [CX, CY], t0: 18, size: 190, op: OP }),
    C.sparkLayer({ pos: [CX + 150, CY - 130], size: 58, t0: 26, spin: 26, op: OP }),
    C.sparkLayer({ pos: [CX - 156, CY - 112], size: 46, t0: 34, spin: -22, op: OP }),
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'hundred',
      entrance: 'stamp',
      iconSize: 300,
    }),
  ]);
}

// =========================================================
// 17. КРИСТАЛЛ — разворот с бликом по грани
// =========================================================
function gem() {
  L.resetLayerIndex();
  const OP = 122;
  const glint = L.shapeLayer('Glint', [L.groupItem('g', [L.rectItem({ p: [0, 0], s: [40, 300], r: 20 }), L.fillItem(BRAND.white)])], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(M.seq(M.hold(0, [CX - 150, CY]), M.hold(40, [CX - 150, CY]), M.bake({ t0: 40, dur: 26, from: [CX - 150, CY], to: [CX + 150, CY], curve: M.curves.easeInOut, step: 2 }), M.hold(OP, [CX + 150, CY]))),
      r: L.staticProp(24),
      o: L.animProp(M.seq(M.hold(0, 0), M.hold(40, 0), M.hold(46, 62), M.hold(60, 62), M.hold(66, 0), M.hold(OP, 0))),
    },
  });
  emit('reaction-gem', OP, [
    glint,
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'gem',
      entrance: 'flip',
      iconSize: 320,
      accents: { sparks: [[142, -110, 56, 22, 26], [-140, 34, 44, 30, -24]] },
    }),
  ]);
}

// =========================================================
// 18. ВАУ — звёздный взрыв с кольцами
// =========================================================
function wow() {
  L.resetLayerIndex();
  const OP = 116;
  emit('reaction-wow', OP, [
    ...C.burstLayers({ pos: [CX, CY], op: OP, count: 12, t0: 8, radius: 196, len: 52, width: 13, color: BRAND.ink }),
    C.ringLayer({ pos: [CX, CY], t0: 8, size: 150, op: OP, width: 12 }),
    C.ringLayer({ pos: [CX, CY], t0: 18, size: 150, op: OP, width: 8, color: BRAND.lime }),
    ...C.buildSticker({
      canvas: W,
      op: OP,
      icon: 'spark',
      entrance: 'zoom',
      iconSize: 300,
      accents: {
        sparks: [
          [150, -120, 56, 22, 28],
          [-150, 100, 48, 30, -26],
          [-120, -140, 42, 38, 22],
        ],
      },
    }),
  ]);
}

const ALL = [heart, fire, thumbsUp, star, lightbulb, perfect, confetti, gradcap, clap, rocket, brain, eyes, crown, bolt, trophy, hundred, gem, wow];

module.exports = { ALL };

if (require.main === module) {
  console.log('Реакции:');
  ALL.forEach((fn) => fn());
}
