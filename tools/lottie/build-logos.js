'use strict';
/* =========================================================
   ЛОГОТИПЫ — 12 анимаций знака и леттеринга бренда
   =========================================================
   Вся геометрия берётся из настоящих контуров бренда
   (assets/logo-icon.svg и assets/logo-full.svg) — знак не
   перерисован, а импортирован кривыми один в один.
   ========================================================= */

const fs = require('fs');
const path = require('path');
const L = require('./lib');
const M = require('./motion');
const C = require('./compose');
const { baseStyle, shadowStyle, paint, BRAND } = require('./icons');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'assets', 'lottie');
const FR = 60;

// ---------- импорт фирменных контуров ----------
/* Знак бренда, вписанный в общий бокс 200×200, — дальше он живёт
   по тем же правилам, что и любая иконка набора. */
let markCache = null;
function brandMarkSubpaths() {
  if (markCache) return markCache;
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'logo-icon.svg'), 'utf8');
  const groups = L.extractPathsFromSvg(svg).map((d) => L.parseSvgPath(d));
  const all = groups.flat();
  const bbox = L.bboxOfSubpaths(all);
  const scale = 200 / Math.max(bbox.w, bbox.h);
  const cx = bbox.minX + bbox.w / 2;
  const cy = bbox.minY + bbox.h / 2;
  markCache = groups.map((g) => L.transformSubpaths(g, { scale, dx: -cx * scale, dy: -cy * scale }));
  return markCache;
}

/* Иконка-знак в формате набора: style → шейп-группы.
   Знак нарисован тонкими лентами, поэтому иконочная обводка его
   попросту съедает — берём только заливку, как в оригинале. Для
   слоя тени сюда приходит ink, и получается плотный силуэт. */
function brandMark(style) {
  return brandMarkSubpaths().map((subpaths, i) =>
    L.groupItem(`mark-${i}`, [
      ...subpaths.map((sp, j) => L.pathShapeItem(sp, `p${j}`)),
      L.fillItem(style.fill),
    ])
  );
}

/* Буквы леттеринга: каждый <path> исходника — отдельная группа,
   отсортированная слева направо, чтобы пускать их волной. */
let wordCache = null;
function wordmarkGlyphs(targetW) {
  const key = `w${targetW}`;
  if (wordCache && wordCache.key === key) return wordCache.data;
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'logo-full.svg'), 'utf8');
  const glyphs = L.extractPathsFromSvg(svg)
    .map((d) => L.parseSvgPath(d))
    .map((sub) => ({ sub, bbox: L.bboxOfSubpaths(sub) }))
    // в экспорте попадаются микроскопические артефакты — отсеиваем
    .filter((g) => g.bbox.w > 4 && g.bbox.h > 4)
    .sort((a, b) => a.bbox.minX - b.bbox.minX);
  const all = glyphs.flatMap((g) => g.sub);
  const bbox = L.bboxOfSubpaths(all);
  const scale = targetW / bbox.w;
  const cx = bbox.minX + bbox.w / 2;
  const cy = bbox.minY + bbox.h / 2;
  const data = glyphs.map((g) => {
    const sub = L.transformSubpaths(g.sub, { scale, dx: -cx * scale, dy: -cy * scale });
    const b = L.bboxOfSubpaths(sub);
    return { sub, cx: b.minX + b.w / 2, cy: b.minY + b.h / 2 };
  });
  wordCache = { key, data };
  return data;
}

function emit(nm, { w = 512, h = 512, op, layers }) {
  L.writeJson(path.join(OUT_DIR, `${nm}.json`), L.animation({ w, h, fr: FR, op, nm, layers }));
}

/* Знак как обычный стикер — вся разница между вариантами только
   в типе входа и акцентах. */
function markSticker(nm, op, opts) {
  L.resetLayerIndex();
  emit(nm, {
    op,
    layers: C.buildSticker({ canvas: 512, op, icon: brandMark, iconSize: 300, ...opts }),
  });
}

// =========================================================
// 1. Подмигивание — знак читается как очки, и правый «глаз»
//    (тот, что со зрачком) прикрывается веком
// =========================================================
function iconWink() {
  L.resetLayerIndex();
  const OP = 138;
  const SIZE = 300;
  const k = SIZE / 200; // знак нарисован в боксе 200
  const CXY = [256, 256];

  /* Геометрия линз берётся из самого контура знака, а не на глаз:
     во внешнем контуре оправы отверстия — это и есть линзы. */
  const holes = brandMarkSubpaths()[0].slice(1).map((sp) => L.bboxOfSubpaths([sp]));
  const lens = holes.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b)); // правая, крупная
  const lensCx = (lens.minX + lens.w / 2) * k;
  const lensTop = lens.minY * k;
  const lensW = lens.w * k;
  const lensH = lens.h * k;

  const markInd = L.nextLayerIndex();
  const markLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize: SIZE,
    entrance: 'pop',
    patchMotion: (mo) => ({
      ...mo,
      // на подмигивании знак чуть кивает — как живое лицо
      r: M.seq(M.wobble({ t0: 2, dur: 34, amp: 9 }), M.sway({ t0: 40, t1: OP, amp: 3.5, cycles: 2 })),
      s: M.seq(M.popIn({ t0: 0, dur: 30, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 2.4, cycles: 1 })),
    }),
  });

  /* Веко — ребёнок знака: едет вместе с ним и закрывается по Y от
     верхнего края линзы. Эллипс смещён вниз на половину высоты,
     поэтому локальный ноль слоя лежит ровно на верхнем крае. */
  const lid = L.shapeLayer(
    'Wink lid',
    [L.groupItem('lid', [L.ellipseItem({ p: [0, lensH / 2], s: [lensW * 1.02, lensH * 1.04] }), L.fillItem(BRAND.lime)])],
    {
      op: OP,
      parent: markInd,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp([lensCx, lensTop]),
        s: L.animProp(
          M.seq(
            M.hold(0, [100, 0]),
            M.hold(44, [100, 0]),
            M.bake({ t0: 44, dur: 7, from: [100, 0], to: [100, 100], curve: M.curves.easeOut, step: 1 }),
            M.hold(62, [100, 100]),
            M.bake({ t0: 62, dur: 9, from: [100, 100], to: [100, 0], curve: M.curves.easeOut, step: 1 }),
            M.hold(OP, [100, 0])
          )
        ),
      },
    }
  );

  emit('logo-icon-wink', { op: OP, layers: [lid, ...markLayers] });
}

// =========================================================
// 2-9. Варианты входа знака
// =========================================================
function iconBounce() {
  markSticker('logo-icon-bounce', 132, {
    entrance: 'drop',
    accents: { burst: { count: 6, t0: 26, radius: 190, len: 38, width: 12 }, ring: { t0: 26, size: 170 } },
  });
}

function iconFlip() {
  markSticker('logo-icon-flip', 124, {
    entrance: 'flip',
    accents: { sparks: [[140, -118, 56, 26, 26], [-142, 96, 46, 34, -22]] },
  });
}

function iconStamp() {
  markSticker('logo-icon-stamp', 124, {
    entrance: 'stamp',
    accents: {
      burst: { count: 10, t0: 16, radius: 196, len: 46, width: 14 },
      ring: { t0: 16, size: 190 },
    },
  });
}

function iconSwing() {
  L.resetLayerIndex();
  const OP = 144;
  const CXY = [256, 256];
  const PIVOT = 190; // точка подвеса выше знака

  /* Знак висит на невидимой нити: якорь вынесен над ним, поэтому
     поворот читается как маятник, а не как вращение на месте. */
  const motion = {
    p: M.seq(M.hold(0, [CXY[0], CXY[1] - PIVOT])),
    s: M.seq(
      M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 3 }),
      M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 })
    ),
    r: M.seq(
      M.hold(0, 34),
      M.bake({ t0: 0, dur: 26, from: 34, to: -18, curve: M.curves.easeInOut, step: 2 }),
      M.wobble({ t0: 26, dur: 76, amp: -18, bounces: 2.6, decay: 2.6 }),
      M.sway({ t0: 102, t1: OP, amp: 2.6, cycles: 1 })
    ),
  };

  const layers = [
    L.shapeLayer('Mark', [C.iconGroup(brandMark, baseStyle(13), 300)], {
      op: OP,
      ks: { a: L.staticProp([0, -PIVOT]), p: L.animProp(motion.p), s: L.animProp(motion.s), r: L.animProp(motion.r) },
    }),
    L.shapeLayer('Shadow', [C.iconGroup(brandMark, shadowStyle(13), 300)], {
      op: OP,
      ks: {
        a: L.staticProp([0, -PIVOT]),
        p: L.animProp(motion.p.map((kf) => ({ ...kf, v: [kf.v[0] + 12, kf.v[1] + 12] }))),
        s: L.animProp(motion.s),
        r: L.animProp(motion.r),
      },
    }),
  ];
  emit('logo-icon-swing', { op: OP, layers });
}

function iconPop() {
  markSticker('logo-icon-pop', 118, {
    entrance: 'anticipate',
    accents: { sparks: [[150, -110, 60, 22, 28], [-120, -130, 44, 30, -24], [130, 120, 40, 38, 20]] },
  });
}

// =========================================================
// 10. Пульсирующие кольца — «в эфире», аватарка канала
// =========================================================
function iconPulse() {
  L.resetLayerIndex();
  const OP = 150;
  const CXY = [256, 256];
  const rings = [0, 50, 100].map((delay, i) =>
    L.shapeLayer(`Pulse ${i}`, [L.groupItem('r', [L.ellipseItem({ p: [0, 0], s: [230, 230] }), L.strokeItem(BRAND.ink, 10)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(CXY),
        // кольца стартуют с равным шагом — получается непрерывная волна
        s: L.animProp(M.seq(M.hold(0, [60, 60]), M.hold(delay, [60, 60]), M.bake({ t0: delay, dur: 74, from: [60, 60], to: [190, 190], curve: M.curves.easeOut, step: 3 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(delay, 70), M.bake({ t0: delay, dur: 74, from: 70, to: 0, curve: M.curves.easeOut, step: 4 }), M.hold(OP, 0))),
      },
    })
  );
  emit('logo-icon-pulse', {
    op: OP,
    layers: [
      ...C.buildSticker({
        canvas: 512,
        op: OP,
        icon: brandMark,
        iconSize: 290,
        entrance: 'pop',
        patchMotion: (mo) => ({
          ...mo,
          s: M.seq(M.popIn({ t0: 0, dur: 30, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 3.4, cycles: 3 })),
        }),
      }),
      ...rings,
    ],
  });
}

// =========================================================
// 11. Орбита — знак с вращающимися искрами (луп для аватара)
// =========================================================
function iconOrbit() {
  L.resetLayerIndex();
  const OP = 168;
  const CXY = [256, 256];
  const orbiters = [0, 0.33, 0.66].map((phase, i) => {
    const pts = M.orbit({ t0: 0, t1: OP, cx: CXY[0], cy: CXY[1], r: 168, turns: 1, phase, step: 4 });
    return L.shapeLayer(`Orbiter ${i}`, [
      L.groupItem('o', [L.starItem({ p: [0, 0], pt: 4, or_: 26 - i * 4, ir: 8, sy: 1 }), L.fillItem(i === 1 ? BRAND.ink : BRAND.lime)]),
    ], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(pts),
        r: L.animProp(M.seq(M.bake({ t0: 0, dur: OP, from: 0, to: 180, curve: M.curves.linear, step: 8 }))),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(20 + i * 6, [0, 0]), M.popIn({ t0: 20 + i * 6, dur: 20, to: 100, lag: 2 }))),
      },
    });
  });
  emit('logo-icon-orbit', {
    op: OP,
    layers: [
      ...orbiters,
      ...C.buildSticker({
        canvas: 512,
        op: OP,
        icon: brandMark,
        iconSize: 280,
        entrance: 'pop',
        patchMotion: (mo) => ({
          ...mo,
          s: M.seq(M.popIn({ t0: 0, dur: 30, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 2.6, cycles: 2 })),
          r: M.seq(M.wobble({ t0: 2, dur: 38, amp: 10 }), M.sway({ t0: 40, t1: OP, amp: 3, cycles: 1 })),
        }),
      }),
    ],
  });
}

// =========================================================
// 12. Глитч-сборка знака
// =========================================================
function iconGlitch() {
  L.resetLayerIndex();
  const OP = 126;
  const CXY = [256, 256];
  const settle = 34;
  // два смещённых «двойника» сходятся в один знак — эффект сведения каналов
  const ghost = (color, dir, delay) =>
    L.shapeLayer(`Ghost ${dir}`, [C.iconGroup(brandMark, { fill: color, stroke: color, ink: color, sw: 12 }, 290)], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(
          M.seq(
            M.hold(0, [CXY[0] + dir * 46, CXY[1] - dir * 20]),
            M.jitter({ t0: 0, t1: delay, base: CXY[0] + dir * 46, amp: 18, seed: dir > 0 ? 3 : 9, step: 3 }).map((k) => ({ ...k, v: [k.v, CXY[1] - dir * 20] })),
            M.bake({ t0: delay, dur: settle - delay, from: [CXY[0] + dir * 46, CXY[1] - dir * 20], to: CXY, curve: M.curves.expoOut, step: 2 })
          )
        ),
        s: L.staticProp([100, 100]),
        o: L.animProp(M.seq(M.hold(0, 55), M.hold(settle - 4, 55), M.hold(settle, 0), M.hold(OP, 0))),
      },
    });

  emit('logo-icon-glitch', {
    op: OP,
    layers: [
      ghost(BRAND.lime, 1, 20),
      ghost(BRAND.ink, -1, 24),
      ...C.buildSticker({
        canvas: 512,
        op: OP,
        icon: brandMark,
        iconSize: 290,
        entrance: 'pop',
        patchMotion: (mo) => ({
          ...mo,
          // знак «собирается» рывками, а не плавно выезжает
          p: M.seq(
            M.jitter({ t0: 0, t1: 22, base: CXY[0], amp: 14, seed: 5, step: 3 }).map((k) => ({ ...k, v: [k.v, CXY[1]] })),
            M.hold(24, CXY),
            M.hold(OP, CXY)
          ),
          s: M.seq(
            M.hold(0, [118, 82]),
            M.hold(8, [86, 116]),
            M.hold(14, [112, 92]),
            M.bake({ t0: 18, dur: 22, from: [112, 92], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 }),
            M.breathe({ t0: 44, t1: OP, base: 100, amp: 2.4, cycles: 1 })
          ),
        }),
      }),
    ],
  });
}

// =========================================================
// 13. Леттеринг — буквы влетают волной с пружиной
// =========================================================
function wordmarkWave() {
  L.resetLayerIndex();
  const W = 1600;
  const H = 420;
  const OP = 150;
  const glyphs = wordmarkGlyphs(W - 200);
  const STAGGER = 2.4;
  const layers = glyphs.map((g, i) => {
    const t0 = i * STAGGER;
    const home = [W / 2 + g.cx, H / 2 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [
      L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] }),
    ], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(
          M.seq(
            M.hold(0, [home[0], home[1] + 60]),
            M.hold(t0, [home[0], home[1] + 60]),
            M.bake({ t0, dur: 28, from: [home[0], home[1] + 60], to: home, curve: M.curves.spring({ bounces: 2, decay: 5.2 }), step: 2 }),
            // после сборки по строке проходит мягкая волна
            M.sway({ t0: 72, t1: OP, base: home[1], amp: 9, cycles: 1 }).map((k) => ({ ...k, v: [home[0], k.v] }))
          )
        ),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 26, to: 100, lag: 2 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 2, 100), M.hold(OP, 100))),
      },
    });
  });
  emit('logo-wordmark-wave', { w: W, h: H, op: OP, layers });
}

// =========================================================
// 14. Леттеринг — проявление за лаймовой шторкой
// =========================================================
function wordmarkWipe() {
  L.resetLayerIndex();
  const W = 1600;
  const H = 420;
  const OP = 140;
  const glyphs = wordmarkGlyphs(W - 200);
  const SWIPE = 46;

  // шторка едет по строке и «оставляет» за собой леттеринг
  const band = L.shapeLayer('Band', [
    L.groupItem('b', [L.rectItem({ p: [0, 0], s: [120, 460], r: 20 }), L.fillItem(BRAND.lime)]),
  ], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(M.seq(M.bake({ t0: 0, dur: SWIPE, from: [-140, H / 2], to: [W + 140, H / 2], curve: M.curves.easeInOut, step: 2 }), M.hold(OP, [W + 140, H / 2]))),
      r: L.staticProp(6),
      o: L.animProp(M.seq(M.hold(0, 100), M.hold(SWIPE - 6, 100), M.hold(SWIPE + 2, 0), M.hold(OP, 0))),
    },
  });

  const layers = glyphs.map((g, i) => {
    // буква появляется ровно в тот момент, когда шторка проходит мимо
    const x = W / 2 + g.cx;
    const t0 = Math.max(0, Math.round((x / W) * SWIPE) - 2);
    const home = [x, H / 2 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [
      L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] }),
    ], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(home),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 22, to: 100, lag: 2 }), M.breathe({ t0: 80, t1: OP, base: 100, amp: 1.8, cycles: 1 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
      },
    });
  });

  emit('logo-wordmark-wipe', { w: W, h: H, op: OP, layers: [band, ...layers] });
}

// =========================================================
// 15. Леттеринг — печатная машинка с лаймовым курсором
// =========================================================
function wordmarkType() {
  L.resetLayerIndex();
  const W = 1600;
  const H = 420;
  const OP = 160;
  const glyphs = wordmarkGlyphs(W - 220);
  const STEP = 5; // кадров на букву
  const typedAt = (i) => 10 + i * STEP;
  const doneAt = typedAt(glyphs.length - 1) + 8;

  const layers = glyphs.map((g, i) => {
    const t0 = typedAt(i);
    const home = [W / 2 + g.cx, H / 2 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [
      L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] }),
    ], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(home),
        // каждая буква «впечатывается»: короткий удар с перелётом
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 14, to: 100, lag: 1, bounces: 1.8, decay: 6 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
      },
    });
  });

  /* Курсор стоит у правого края последней набранной буквы. */
  const caretX = glyphs.map((g) => {
    const b = L.bboxOfSubpaths(g.sub);
    return W / 2 + b.maxX + 26;
  });
  const caretPos = M.seq(
    M.hold(0, [W / 2 - (W - 220) / 2 - 10, H / 2]),
    ...glyphs.map((g, i) => M.hold(typedAt(i), [caretX[i], H / 2]))
  );
  const caret = L.shapeLayer('Caret', [
    L.groupItem('c', [L.rectItem({ p: [0, 0], s: [26, 150], r: 6 }), L.fillItem(BRAND.lime)]),
  ], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(caretPos),
      s: L.animProp(M.seq(M.hold(0, [100, 100]), M.hold(OP, [100, 100]))),
      // после набора курсор мигает — узнаваемая деталь терминала
      o: L.animProp(
        M.seq(
          M.hold(0, 100),
          M.hold(doneAt, 100),
          ...[0, 1, 2, 3].flatMap((n) => [
            { t: doneAt + n * 22, v: 100, hold: true },
            { t: doneAt + n * 22 + 11, v: 0, hold: true },
          ]),
          M.hold(OP, 100)
        )
      ),
    },
  });

  emit('logo-wordmark-type', { w: W, h: H, op: OP, layers: [caret, ...layers] });
}

const ALL = [
  iconWink,
  iconPop,
  iconBounce,
  iconStamp,
  iconFlip,
  iconSwing,
  iconPulse,
  iconOrbit,
  iconGlitch,
  wordmarkWave,
  wordmarkWipe,
  wordmarkType,
];

module.exports = { ALL, brandMark, brandMarkSubpaths, wordmarkGlyphs };

if (require.main === module) {
  console.log('Логотипы:');
  ALL.forEach((fn) => fn());
}
