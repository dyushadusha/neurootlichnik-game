'use strict';
/* =========================================================
   ОТДЕЛЬНЫЙ ПАК: 20 логотипов — 10 КОРОТКИХ + 10 ДЛИННЫХ
   =========================================================
   Намеренно отдельный файл от build-logos.js и отдельные имена
   файлов (logo-short-*, logo-long-*) — это не довесок к старому
   набору логотипов, а свой пак ровно из 20 стикеров.

   КОРОТКИЙ логотип — только знак (глаза-бесконечность).
   ДЛИННЫЙ логотип — только леттеринг «Нейро Отличник», без знака.
   Друг с другом они нигде не смешиваются: в каждом файле — что-то
   одно, как и просили.
   ========================================================= */

const L = require('./lib');
const M = require('./motion');
const C = require('./compose');
const { baseStyle, shadowStyle, BRAND } = require('./icons');
const { brandMark, brandMarkSubpaths, wordmarkGlyphs } = require('./build-logos');

const OUT_DIR = require('path').join(__dirname, '..', '..', 'assets', 'lottie');
const FR = 60;

function emit(nm, { op, layers }) {
  L.writeJson(`${OUT_DIR}/${nm}.json`, L.animation({ w: 512, h: 512, fr: FR, op, nm, layers }));
}

/* Строка леттеринга как одна фигура — там, где буквы должны ехать
   жёстким блоком (качели, глитч), а не по отдельности. */
function flattenGlyphs(glyphs, nm = 'word') {
  return L.groupItem(nm, [
    ...glyphs.flatMap((g, i) => g.sub.map((sp, j) => L.pathShapeItem(sp, `p${i}_${j}`))),
    L.fillItem(BRAND.lime),
  ]);
}

/* Ламели-жалюзи закрывают контент и раскрываются от центра наружу —
   без масок (Telegram их запрещает), просто непрозрачные плашки,
   которые уезжают (scaleY→0). */
function shutterSlats({ centerY, height, width, op, count = 6, t0 = 14, stagger = 7, dur = 18 }) {
  const slatH = height / count;
  const top = centerY - height / 2;
  const palette = [BRAND.ink, BRAND.lime];
  const order = [...Array(count).keys()].sort((a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2));
  return order.map((i, seq) => {
    const y = top + slatH * (i + 0.5);
    const start = t0 + seq * stagger;
    return L.shapeLayer(
      `Slat ${i}`,
      [L.groupItem('s', [L.rectItem({ p: [0, 0], s: [width, slatH + 2] }), L.fillItem(palette[i % palette.length])])],
      {
        op,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp([256, y]),
          s: L.animProp(
            M.seq(
              M.hold(0, [100, 100]),
              M.hold(start, [100, 100]),
              M.bake({ t0: start, dur, from: [100, 100], to: [100, 0], curve: M.curves.expoIn, step: 2 })
            )
          ),
        },
      }
    );
  });
}

// =========================================================
// ==================  10 КОРОТКИХ (знак)  ===================
// =========================================================
const SHORT_ICON_SIZE = 300;

function shortSticker(nm, op, opts) {
  L.resetLayerIndex();
  emit(nm, { op, layers: C.buildSticker({ canvas: 512, op, icon: brandMark, iconSize: SHORT_ICON_SIZE, ...opts }) });
}

// 1. Подмигивание — знак читается как очки, правая линза моргает
function shortWink() {
  L.resetLayerIndex();
  const OP = 138;
  const k = SHORT_ICON_SIZE / 200;
  const holes = brandMarkSubpaths()[0].slice(1).map((sp) => L.bboxOfSubpaths([sp]));
  const lens = holes.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  const lensCx = (lens.minX + lens.w / 2) * k;
  const lensTop = lens.minY * k;
  const lensW = lens.w * k;
  const lensH = lens.h * k;

  const markInd = L.nextLayerIndex();
  const markLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize: SHORT_ICON_SIZE,
    entrance: 'pop',
    patchMotion: (mo) => ({
      ...mo,
      r: M.seq(M.wobble({ t0: 2, dur: 34, amp: 9 }), M.sway({ t0: 40, t1: OP, amp: 3.5, cycles: 2 })),
    }),
  });

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
  emit('logo-short-wink', { op: OP, layers: [lid, ...markLayers] });
}

// 2. Замах и упругий выстрел с искрами
function shortPop() {
  shortSticker('logo-short-pop', 118, {
    entrance: 'anticipate',
    accents: { sparks: [[150, -110, 60, 22, 28], [-120, -130, 44, 30, -24], [130, 120, 40, 38, 20]] },
  });
}

// 3. Падает сверху, сплющивается на посадке
function shortBounce() {
  shortSticker('logo-short-bounce', 132, {
    entrance: 'drop',
    accents: { burst: { count: 6, t0: 26, radius: 190, len: 38, width: 12 }, ring: { t0: 26, size: 170 } },
  });
}

// 4. Впечатывается штампом
function shortStamp() {
  shortSticker('logo-short-stamp', 124, {
    entrance: 'stamp',
    accents: { burst: { count: 10, t0: 16, radius: 196, len: 46, width: 14 }, ring: { t0: 16, size: 190 } },
  });
}

// 5. Разворот «в профиль» через ноль
function shortFlip() {
  shortSticker('logo-short-flip', 124, {
    entrance: 'flip',
    accents: { sparks: [[140, -118, 56, 26, 26], [-142, 96, 46, 34, -22]] },
  });
}

// 6. Маятник на невидимой нити
function shortSwing() {
  L.resetLayerIndex();
  const OP = 144;
  const CXY = [256, 256];
  const PIVOT = 190;
  const motion = {
    p: M.seq(M.hold(0, [CXY[0], CXY[1] - PIVOT])),
    s: M.seq(M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 })),
    r: M.seq(
      M.hold(0, 34),
      M.bake({ t0: 0, dur: 26, from: 34, to: -18, curve: M.curves.easeInOut, step: 2 }),
      M.wobble({ t0: 26, dur: 76, amp: -18, bounces: 2.6, decay: 2.6 }),
      M.sway({ t0: 102, t1: OP, amp: 2.6, cycles: 1 })
    ),
  };
  const layers = [
    L.shapeLayer('Mark', [C.iconGroup(brandMark, baseStyle(13), SHORT_ICON_SIZE)], {
      op: OP,
      ks: { a: L.staticProp([0, -PIVOT]), p: L.animProp(motion.p), s: L.animProp(motion.s), r: L.animProp(motion.r) },
    }),
    L.shapeLayer('Shadow', [C.iconGroup(brandMark, shadowStyle(13), SHORT_ICON_SIZE)], {
      op: OP,
      ks: {
        a: L.staticProp([0, -PIVOT]),
        p: L.animProp(motion.p.map((kf) => ({ ...kf, v: [kf.v[0] + 12, kf.v[1] + 12] }))),
        s: L.animProp(motion.s),
        r: L.animProp(motion.r),
      },
    }),
  ];
  emit('logo-short-swing', { op: OP, layers });
}

// 7. Расходящиеся кольца — «в эфире»
function shortPulse() {
  L.resetLayerIndex();
  const OP = 150;
  const CXY = [256, 256];
  const rings = [0, 50, 100].map((delay, i) =>
    L.shapeLayer(`Pulse ${i}`, [L.groupItem('r', [L.ellipseItem({ p: [0, 0], s: [230, 230] }), L.strokeItem(BRAND.ink, 10)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(CXY),
        s: L.animProp(M.seq(M.hold(0, [60, 60]), M.hold(delay, [60, 60]), M.bake({ t0: delay, dur: 74, from: [60, 60], to: [190, 190], curve: M.curves.easeOut, step: 3 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(delay, 70), M.bake({ t0: delay, dur: 74, from: 70, to: 0, curve: M.curves.easeOut, step: 4 }), M.hold(OP, 0))),
      },
    })
  );
  emit('logo-short-pulse', {
    op: OP,
    layers: [
      ...C.buildSticker({
        canvas: 512,
        op: OP,
        icon: brandMark,
        iconSize: 290,
        entrance: 'pop',
        patchMotion: (mo) => ({ ...mo, s: M.seq(M.popIn({ t0: 0, dur: 30, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 34, t1: OP, base: 100, amp: 3.4, cycles: 3 })) }),
      }),
      ...rings,
    ],
  });
}

// 8. Искры на орбите
function shortOrbit() {
  L.resetLayerIndex();
  const OP = 168;
  const CXY = [256, 256];
  const orbiters = [0, 0.33, 0.66].map((phase, i) => {
    const pts = M.orbit({ t0: 0, t1: OP, cx: CXY[0], cy: CXY[1], r: 168, turns: 1, phase, step: 4 });
    return L.shapeLayer(`Orbiter ${i}`, [L.groupItem('o', [L.starItem({ p: [0, 0], pt: 4, or_: 26 - i * 4, ir: 8, sy: 1 }), L.fillItem(i === 1 ? BRAND.ink : BRAND.lime)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(pts),
        r: L.animProp(M.seq(M.bake({ t0: 0, dur: OP, from: 0, to: 180, curve: M.curves.linear, step: 8 }))),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(20 + i * 6, [0, 0]), M.popIn({ t0: 20 + i * 6, dur: 20, to: 100, lag: 2 }))),
      },
    });
  });
  emit('logo-short-orbit', {
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

// 9. Глитч-сведение знака
function shortGlitch() {
  L.resetLayerIndex();
  const OP = 126;
  const CXY = [256, 256];
  const settle = 34;
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
  emit('logo-short-glitch', {
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
          p: M.seq(M.jitter({ t0: 0, t1: 22, base: CXY[0], amp: 14, seed: 5, step: 3 }).map((k) => ({ ...k, v: [k.v, CXY[1]] })), M.hold(24, CXY), M.hold(OP, CXY)),
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

// 10. Ламели-жалюзи закрывают знак и раскрываются от центра
function shortShutter() {
  L.resetLayerIndex();
  const OP = 112;
  const icon = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize: SHORT_ICON_SIZE,
    entrance: 'pop',
    shadow: false,
    patchMotion: (mo) => ({ ...mo, s: M.seq(M.hold(0, [100, 100]), M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 })) }),
  });
  const slats = shutterSlats({ centerY: 256, height: SHORT_ICON_SIZE * 1.3, width: SHORT_ICON_SIZE * 1.55, op: OP, count: 6, t0: 16, stagger: 7, dur: 18 });
  emit('logo-short-shutter', { op: OP, layers: [...slats, ...icon] });
}

// =========================================================
// =============  10 ДЛИННЫХ (только леттеринг)  =============
// =========================================================
/* Строка «Нейро Отличник» широкая (10.9:1) — в квадратном канвасе
   она всегда оставляет большие поля сверху/снизу: это не баг, а
   честная посадка длинного лого в квадрат, а не растяжка на весь
   канвас. Ширина берётся с запасом от края (не более ~440 из 512),
   чтобы боковые поля хватало даже под акценты/повороты. */
function longWordLayer(glyphs, pos, nm, ks) {
  return L.shapeLayer(nm, [flattenGlyphs(glyphs)], { ks: { a: L.staticProp([0, 0]), p: L.staticProp(pos), ...ks } });
}

// 1. Буквы влетают волной с пружиной
function longWave() {
  L.resetLayerIndex();
  const OP = 150;
  const glyphs = wordmarkGlyphs(440);
  const STAGGER = 2.2;
  const layers = glyphs.map((g, i) => {
    const t0 = i * STAGGER;
    const home = [256 + g.cx, 256 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(
          M.seq(
            M.hold(0, [home[0], home[1] + 50]),
            M.hold(t0, [home[0], home[1] + 50]),
            M.bake({ t0, dur: 26, from: [home[0], home[1] + 50], to: home, curve: M.curves.spring({ bounces: 2, decay: 5.2 }), step: 2 }),
            M.sway({ t0: 66, t1: OP, base: home[1], amp: 8, cycles: 1 }).map((k) => ({ ...k, v: [home[0], k.v] }))
          )
        ),
        s: L.animProp(M.seq(M.hold(0, [62, 62]), M.hold(t0, [62, 62]), M.popIn({ t0, dur: 22, from: 62, to: 100, lag: 2 }))),
      },
    });
  });
  emit('logo-long-wave', { op: OP, layers });
}

// 2. Знак-шторка (лаймовая полоса) проявляет строку
function longWipe() {
  L.resetLayerIndex();
  const OP = 140;
  const glyphs = wordmarkGlyphs(420);
  const textW = L.bboxOfSubpaths(glyphs.flatMap((g) => g.sub)).w;
  const SWIPE = 42;
  const left = 256 - textW / 2 - 22;
  const right = 256 + textW / 2 + 22;

  // полоса видна с самого первого кадра — иначе на нулевом кадре
  // (превью пака в Telegram) не видно вообще ничего: буквы ещё не
  // раскрыты, а полоса тоже спрятана до старта свайпа
  const band = L.shapeLayer('Band', [L.groupItem('b', [L.rectItem({ p: [0, 0], s: [24, 96], r: 10 }), L.fillItem(BRAND.lime)])], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(M.seq(M.bake({ t0: 0, dur: SWIPE, from: [left, 256], to: [right, 256], curve: M.curves.easeInOut, step: 2 }), M.hold(OP, [right, 256]))),
      o: L.animProp(
        M.seq(
          [{ t: 0, v: 100, hold: true }],
          [{ t: SWIPE - 6, v: 100, hold: true }],
          M.bake({ t0: SWIPE - 6, dur: 8, from: 100, to: 0, curve: M.curves.easeOut, step: 2 }),
          M.hold(OP, 0)
        )
      ),
    },
  });

  const glyphLayers = glyphs.map((g, i) => {
    const x = 256 + g.cx;
    const t0 = Math.max(0, Math.round(((x - left) / (right - left)) * SWIPE) - 2);
    const home = [x, 256 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(home),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 20, to: 100, lag: 2 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
      },
    });
  });
  emit('logo-long-wipe', { op: OP, layers: [band, ...glyphLayers] });
}

// 3. Печатная машинка с мигающим курсором
function longType() {
  L.resetLayerIndex();
  const OP = 160;
  const glyphs = wordmarkGlyphs(420);
  const textW = L.bboxOfSubpaths(glyphs.flatMap((g) => g.sub)).w;
  const STEP = 5;
  const typedAt = (i) => 14 + i * STEP;
  const doneAt = typedAt(glyphs.length - 1) + 8;

  const glyphLayers = glyphs.map((g, i) => {
    const t0 = typedAt(i);
    const home = [256 + g.cx, 256 + g.cy];
    return L.shapeLayer(`Glyph ${i}`, [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp(home),
        s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 12, to: 100, lag: 1, bounces: 1.8, decay: 6 }))),
        o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
      },
    });
  });

  const caretX = glyphs.map((g) => 256 + L.bboxOfSubpaths(g.sub).maxX + 18);
  const caretPos = M.seq(M.hold(0, [256 - textW / 2 - 8, 256]), ...glyphs.map((g, i) => M.hold(typedAt(i), [caretX[i], 256])));
  const caret = L.shapeLayer('Caret', [L.groupItem('c', [L.rectItem({ p: [0, 0], s: [16, textW * 0.11 + 26], r: 5 }), L.fillItem(BRAND.lime)])], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp(caretPos),
      o: L.animProp(
        M.seq(
          M.hold(0, 100),
          M.hold(doneAt, 100),
          ...[0, 1, 2].flatMap((n) => [
            { t: doneAt + n * 20, v: 100, hold: true },
            { t: doneAt + n * 20 + 10, v: 0, hold: true },
          ]),
          M.hold(OP, 100)
        )
      ),
    },
  });
  emit('logo-long-type', { op: OP, layers: [caret, ...glyphLayers] });
}

// 4. Пружинный поп — вся строка появляется одним куском
function longPop() {
  L.resetLayerIndex();
  const OP = 120;
  const glyphs = wordmarkGlyphs(420);
  const word = longWordLayer(glyphs, [256, 256], 'Word', {
    s: L.animProp(M.popIn({ t0: 0, dur: 30, from: 55, to: 100, lag: 3, bounces: 2.2, decay: 5.2 })),
    r: L.animProp(M.seq(M.wobble({ t0: 2, dur: 34, amp: 8 }), M.sway({ t0: 36, t1: OP, amp: 1.4, cycles: 1 }))),
  });
  emit('logo-long-pop', { op: OP, layers: [word] });
}

// 5. Падает сверху и сплющивается на посадке
function longDrop() {
  L.resetLayerIndex();
  const OP = 130;
  const glyphs = wordmarkGlyphs(420);
  const TRAVEL = 130; // поля здесь огромные (текст тонкий) — можно щедро
  const land = 24;
  const from = [256, 256 - TRAVEL];
  const to = [256, 256];
  const word = longWordLayer(glyphs, from, 'Word', {
    p: L.animProp(M.seq(M.hold(0, from), M.drop({ t0: 0, dur: land, from, to }))),
    s: L.animProp(
      M.seq(
        M.hold(0, [100, 82]),
        M.bake({ t0: 0, dur: land, from: [100, 82], to: [100, 100], curve: M.curves.easeOut, step: 2 }),
        M.squash({ t: land, amount: 0.12, recover: 22, base: 100 })
      )
    ),
    r: L.animProp(M.seq(M.hold(0, 0), M.wobble({ t0: land, dur: 34, amp: 5 }))),
  });
  emit('logo-long-drop', { op: OP, layers: [word] });
}

// 6. Разворот «в профиль» через нулевую ширину
function longFlip() {
  L.resetLayerIndex();
  const OP = 122;
  const glyphs = wordmarkGlyphs(420);
  const word = longWordLayer(glyphs, [256, 256], 'Word', {
    s: L.animProp(
      M.seq(
        M.hold(0, [34, 100]),
        M.bake({ t0: 0, dur: 32, from: [34, 100], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 }),
        M.breathe({ t0: 38, t1: OP, base: 100, amp: 2, cycles: 1 })
      )
    ),
    r: L.animProp(M.seq(M.wobble({ t0: 6, dur: 34, amp: 6 }))),
  });
  emit('logo-long-flip', { op: OP, layers: [word] });
}

// 7. Впечатывается штампом
function longStamp() {
  L.resetLayerIndex();
  const OP = 118;
  const glyphs = wordmarkGlyphs(400);
  const hit = 14;
  const high = [256, 256 - 46];
  const pos = [256, 256];
  const word = longWordLayer(glyphs, high, 'Word', {
    p: L.animProp(M.seq(M.hold(0, high), M.bake({ t0: 0, dur: hit, from: high, to: pos, curve: M.curves.expoIn, step: 2 }))),
    s: L.animProp(
      M.seq(
        M.hold(0, [112, 112]),
        M.bake({ t0: 0, dur: hit, from: [112, 112], to: [100, 92], curve: M.curves.expoIn, step: 2 }),
        M.squash({ t: hit, amount: 0.14, recover: 22, base: 100 })
      )
    ),
    r: L.animProp(M.seq(M.hold(0, 4), M.bake({ t0: 0, dur: hit, from: 4, to: 0, curve: M.curves.expoIn, step: 2 }), M.wobble({ t0: hit, dur: 28, amp: 4 }))),
  });
  const burst = [];
  const RADIUS = 60, LEN = 16, WIDTH = 7, COUNT = 8;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i * 360) / COUNT - 90;
    const rad = (angle * Math.PI) / 180;
    const dir = [Math.cos(rad), Math.sin(rad)];
    const near = [256 + dir[0] * RADIUS * 0.5, 256 + dir[1] * RADIUS * 0.5];
    const far = [256 + dir[0] * RADIUS, 256 + dir[1] * RADIUS];
    const start = hit + (i % 2) * 2;
    burst.push(
      L.shapeLayer(`Burst ${i}`, [L.groupItem('ray', [L.rectItem({ p: [0, 0], s: [WIDTH, LEN], r: WIDTH / 2 }), L.fillItem(BRAND.ink)])], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(M.seq(M.hold(0, near), M.hold(start, near), M.bake({ t0: start, dur: 14, from: near, to: far, curve: M.curves.expoOut, step: 2 }))),
          r: L.staticProp(angle + 90),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(start, [100, 120]), M.bake({ t0: start, dur: 16, from: [100, 120], to: [55, 30], curve: M.curves.easeOut, step: 3 }))),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(start, 100), M.hold(start + 14, 0))),
        },
      })
    );
  }
  emit('logo-long-stamp', { op: OP, layers: [...burst, word] });
}

// 8. Качается маятником целиком
function longSwing() {
  L.resetLayerIndex();
  const OP = 140;
  const glyphs = wordmarkGlyphs(320); // компактнее: рычаг+ширина вместе не должны выйти за края
  const PIVOT_Y = 256 - 46;
  const rot = M.seq(
    M.hold(0, 14),
    M.bake({ t0: 0, dur: 26, from: 14, to: -8, curve: M.curves.easeInOut, step: 2 }),
    M.wobble({ t0: 26, dur: 80, amp: -8, bounces: 2.6, decay: 2.6 }),
    M.sway({ t0: 106, t1: OP, amp: 1.4, cycles: 1 })
  );
  const scale = M.seq(M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 30, t1: OP, base: 100, amp: 1.6, cycles: 1 }));
  // anchor = pivotY - restY (см. вывод формулы в build-logos.js: мир = p - R(a),
  // при r=0 должно совпасть с истинным положением строки)
  const anchor = [0, PIVOT_Y - 256];
  const word = L.shapeLayer('Word', [flattenGlyphs(glyphs)], {
    op: OP,
    ks: { a: L.staticProp(anchor), p: L.staticProp([256, PIVOT_Y]), s: L.animProp(scale), r: L.animProp(rot) },
  });
  emit('logo-long-swing', { op: OP, layers: [word] });
}

// 9. Глитч-сведение строки из лаймового/графитового двойников
function longGlitch() {
  L.resetLayerIndex();
  const OP = 118;
  const glyphs = wordmarkGlyphs(340);
  const settle = 30;
  const ghost = (color, dir, delay) =>
    L.shapeLayer('Ghost word', [L.groupItem('gw', [...glyphs.flatMap((g, i) => g.sub.map((sp, j) => L.pathShapeItem(sp, `p${i}_${j}`))), L.fillItem(color)])], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(
          M.seq(
            M.hold(0, [256 + dir * 26, 256 - dir * 14]),
            M.jitter({ t0: 0, t1: delay, base: 256 + dir * 26, amp: 9, seed: dir > 0 ? 7 : 13, step: 3 }).map((k) => ({ ...k, v: [k.v, 256 - dir * 14] })),
            M.bake({ t0: delay, dur: settle - delay, from: [256 + dir * 26, 256 - dir * 14], to: [256, 256], curve: M.curves.expoOut, step: 2 })
          )
        ),
        o: L.animProp(M.seq(M.hold(0, 50), M.hold(settle - 4, 50), M.hold(settle, 0), M.hold(OP, 0))),
      },
    });
  const word = longWordLayer(glyphs, [256, 256], 'Word', {
    s: L.animProp(
      M.seq(
        M.hold(0, [112, 88]),
        M.hold(8, [88, 110]),
        M.hold(14, [106, 92]),
        M.bake({ t0: 16, dur: 18, from: [106, 92], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 })
      )
    ),
    p: L.animProp(M.seq(M.jitter({ t0: 0, t1: 18, base: 256, amp: 8, seed: 5, step: 3 }).map((k) => ({ ...k, v: [k.v, 256] })), M.hold(20, [256, 256]), M.hold(OP, [256, 256]))),
  });
  emit('logo-long-glitch', { op: OP, layers: [ghost(BRAND.lime, 1, 16), ghost(BRAND.ink, -1, 20), word] });
}

// 10. Две половины строки съезжаются с разных сторон
function longSplit() {
  L.resetLayerIndex();
  const OP = 128;
  // уже, чем остальные «длинные»: половина строки со своим локальным
  // центром сама по себе стоит не по центру канваса (её контент
  // выходит из общего центра слова), плюс на неё сверху накладывается
  // TRAVEL — на полноразмерных 420 сумма уходила за левый край на
  // самом первом кадре
  const glyphs = wordmarkGlyphs(280);
  const mid = Math.ceil(glyphs.length / 2);
  const leftGlyphs = glyphs.slice(0, mid);
  const rightGlyphs = glyphs.slice(mid);
  const TRAVEL = 85;
  const dur = 26;

  const piece = (subset, dir) => {
    const from = [256 + dir * TRAVEL, 256];
    const to = [256, 256];
    return L.shapeLayer(`Half ${dir}`, [flattenGlyphs(subset, 'half')], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(M.seq(M.hold(0, from), M.bake({ t0: 0, dur, from, to, curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 }))),
        s: L.animProp(M.seq(M.hold(0, [90, 90]), M.bake({ t0: 0, dur, from: [90, 90], to: [100, 100], curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 }))),
      },
    });
  };
  emit('logo-long-split', { op: OP, layers: [piece(leftGlyphs, -1), piece(rightGlyphs, 1)] });
}

const SHORT = [shortWink, shortPop, shortBounce, shortStamp, shortFlip, shortSwing, shortPulse, shortOrbit, shortGlitch, shortShutter];
const LONG = [longWave, longWipe, longType, longPop, longDrop, longFlip, longStamp, longSwing, longGlitch, longSplit];
const ALL = [...SHORT, ...LONG];

module.exports = { ALL, SHORT, LONG };

if (require.main === module) {
  console.log('Логопак (20: 10 коротких + 10 длинных):');
  ALL.forEach((fn) => fn());
}
