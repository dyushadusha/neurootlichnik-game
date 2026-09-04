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
// 1. Прорисовка контура и заливка (обновлённая классика)
// =========================================================
function iconDraw() {
  L.resetLayerIndex();
  const OP = 150;
  const DRAW = 54;
  const FILL = 74;
  const CXY = [256, 256];
  const groups = brandMarkSubpaths().map((subpaths, gi) =>
    L.groupItem(`contour-${gi}`, [
      ...subpaths.map((sp, j) => L.pathShapeItem(sp, `p${j}`)),
      L.trimItem({ s: 0, e: L.animProp(M.seq(M.hold(0, 0), M.bake({ t0: 0, dur: DRAW, from: 0, to: 100, curve: M.curves.easeInOut, step: 2 }))), o: 0 }),
      L.strokeItem(BRAND.ink, 7),
      L.fillItem(BRAND.lime, L.animProp(M.seq(M.hold(DRAW, 0), M.bake({ t0: DRAW, dur: FILL - DRAW, from: 0, to: 100, curve: M.curves.easeOut, step: 2 })))),
    ])
  );
  emit('logo-icon-draw', {
    op: OP,
    layers: [
      L.shapeLayer('Mark', [L.groupItem('icon', groups.slice().reverse(), { s: [150, 150] })], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp(CXY),
          s: L.animProp(M.seq(M.hold(0, [88, 88]), M.bake({ t0: DRAW, dur: 26, from: [88, 88], to: [100, 100], curve: M.curves.spring({ bounces: 2, decay: 5 }), step: 2 }), M.breathe({ t0: 84, t1: OP, base: 100, amp: 2.6, cycles: 1 }))),
        },
      }),
    ],
  });
}

// =========================================================
// 2-9. Варианты входа знака
// =========================================================
function iconBounce() {
  markSticker('logo-icon-bounce', 132, {
    entrance: 'drop',
    accents: { burst: { count: 6, t0: 26, radius: 220, len: 38, width: 12 }, ring: { t0: 26, size: 170 } },
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
      burst: { count: 10, t0: 16, radius: 250, len: 46, width: 14 },
      ring: { t0: 16, size: 190 },
    },
  });
}

function iconZoom() {
  markSticker('logo-icon-zoom', 120, {
    entrance: 'zoom',
    accents: { ring: { t0: 10, size: 180 } },
  });
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
          s: M.seq(M.popIn({ t0: 0, dur: 30, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 3.4, cycles: 3 })),
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
    const pts = M.orbit({ t0: 0, t1: OP, cx: CXY[0], cy: CXY[1], r: 190, turns: 1, phase, step: 4 });
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
          s: M.seq(M.popIn({ t0: 0, dur: 30, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 2.6, cycles: 2 })),
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
// 15. Лок-ап — знак и леттеринг собираются вместе
// =========================================================
function lockup() {
  L.resetLayerIndex();
  const W = 1600;
  const H = 560;
  const OP = 156;
  const glyphs = wordmarkGlyphs(1120);
  const wordY = H / 2 + 96;
  const markPos = [W / 2, H / 2 - 96];

  const glyphLayers = glyphs.map((g, i) => {
    const t0 = 26 + i * 2.2;
    const home = [W / 2 + g.cx, wordY + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [
      L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] }),
    ], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(M.seq(M.hold(0, [home[0], home[1] + 46]), M.hold(t0, [home[0], home[1] + 46]), M.bake({ t0, dur: 26, from: [home[0], home[1] + 46], to: home, curve: M.curves.spring({ bounces: 2, decay: 5.4 }), step: 2 }))),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 24, to: 100, lag: 2 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 2, 100), M.hold(OP, 100))),
      },
    });
  });

  emit('logo-lockup', {
    w: W,
    h: H,
    op: OP,
    layers: [
      ...glyphLayers,
      ...C.buildSticker({
        canvas: W,
        op: OP,
        icon: brandMark,
        iconSize: 330,
        center: markPos,
        entrance: 'drop',
        shadowOffset: 10,
        accents: { ring: { t0: 26, size: 150 } },
      }),
    ],
  });
}

const ALL = [
  iconDraw,
  iconBounce,
  iconFlip,
  iconStamp,
  iconZoom,
  iconPop,
  iconPulse,
  iconOrbit,
  iconGlitch,
  wordmarkWave,
  wordmarkWipe,
  lockup,
];

module.exports = { ALL, brandMark, brandMarkSubpaths };

if (require.main === module) {
  console.log('Логотипы:');
  ALL.forEach((fn) => fn());
}
