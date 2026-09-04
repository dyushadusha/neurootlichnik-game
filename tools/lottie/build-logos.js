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
// 10. Жалюзи — ламели закрывают знак и раскрываются от центра
// =========================================================
/* Плашки-ламели лежат СВЕРХУ уже готового, неподвижного контента и
   уезжают по одной (scaleY 100→0) — картинка не собирается, а
   раскрывается, как жалюзи или диафрагма камеры. Ни масок, ни
   мэтт-слоёв — Telegram их запрещает, поэтому эффект собран из
   обычных непрозрачных прямоугольников. */
function shutterSlats({ centerY, height, width, op, count = 6, t0 = 14, stagger = 7, dur = 18, colors }) {
  const slatH = height / count;
  const top = centerY - height / 2;
  const palette = colors || [BRAND.ink, BRAND.lime];
  // открываются от центра наружу — читается направленнее, чем подряд
  const order = [...Array(count).keys()].sort(
    (a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2)
  );
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

function iconShutter() {
  L.resetLayerIndex();
  const OP = 112;
  const SIZE = 300;

  const icon = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize: SIZE,
    entrance: 'pop',
    shadow: false,
    // знак уже на месте — раскрытие делают ламели, а не его вход
    patchMotion: (mo) => ({
      ...mo,
      s: M.seq(M.hold(0, [100, 100]), M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 })),
    }),
  });

  const slats = shutterSlats({ centerY: 256, height: SIZE * 1.3, width: SIZE * 1.55, op: OP, count: 6, t0: 16, stagger: 7, dur: 18 });
  emit('logo-icon-shutter', { op: OP, layers: [...slats, ...icon] });
}

// =========================================================
// ПОЛНЫЙ ЛОГОТИП: знак + леттеринг в одном квадратном канвасе
// =========================================================
/* Знак нарисован широким (2.8:1), строка леттеринга — ещё шире
   (10.9:1): друг под другом в 512×512 они всегда оставляют большие
   поля сверху/снизу — это не баг, а честная компоновка лого-блока,
   а не попытка растянуть его на весь квадрат. */
function lockupGeometry({ iconSize = 360, wordW = 400, gap = 44 } = {}) {
  const iconBBox = L.bboxOfSubpaths(brandMarkSubpaths().flat());
  const iconH = iconSize * (iconBBox.h / iconBBox.w);
  const glyphs = wordmarkGlyphs(wordW);
  const textBBox = L.bboxOfSubpaths(glyphs.flatMap((g) => g.sub));
  const totalH = iconH + gap + textBBox.h;
  const top = 256 - totalH / 2;
  const iconCenterY = top + iconH / 2;
  const textCenterY = top + iconH + gap + textBBox.h / 2;
  return { iconSize, iconH, glyphs, textCenterY, textH: textBBox.h, textW: textBBox.w, iconCenterY };
}

/* Строка леттеринга как ОДНА фигура — там, где буквы должны двигаться
   не по отдельности, а одним жёстким блоком вместе со знаком
   (глитч, жалюзи, штамп, качели, разъезд). */
function flattenGlyphs(glyphs, nm = 'word') {
  return L.groupItem(nm, [
    ...glyphs.flatMap((g, i) => g.sub.map((sp, j) => L.pathShapeItem(sp, `p${i}_${j}`))),
    L.fillItem(BRAND.lime),
  ]);
}

function wordLayer(glyphs, pos, nm, ks) {
  return L.shapeLayer(nm, [flattenGlyphs(glyphs)], { ks: { a: L.staticProp([0, 0]), p: L.staticProp(pos), ...ks } });
}

// =========================================================
// 1. Полное лого — пружинный поп, знак и следом волна букв
// =========================================================
function fullPop() {
  L.resetLayerIndex();
  const OP = 156;
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({});

  const iconLayers = C.buildSticker({ canvas: 512, op: OP, icon: brandMark, iconSize, entrance: 'pop', center: [256, iconCenterY], shadow: false });

  const textStart = 22;
  const STAGGER = 2.4;
  const glyphLayers = glyphs.map((g, i) => {
    const t0 = textStart + i * STAGGER;
    const home = [256 + g.cx, textCenterY + g.cy];
    return L.shapeLayer(
      `Glyph ${i}`,
      [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })],
      {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp(home),
          s: L.animProp(M.seq(M.hold(0, [62, 62]), M.popIn({ t0, dur: 20, from: 62, to: 100, lag: 2 }))),
        },
      }
    );
  });

  emit('logo-full-pop', { op: OP, layers: [...glyphLayers, ...iconLayers] });
}

// =========================================================
// 2. Полное лого — знак падает сверху, строка встаёт снизу, встреча
//    посередине
// =========================================================
function fullDrop() {
  L.resetLayerIndex();
  const OP = 140;
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({});
  const TRAVEL = 56; // с запасом внутри полей — не выходит за канвас
  const land = 24;

  const iconFrom = [256, iconCenterY - TRAVEL];
  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: [256, iconCenterY],
    shadow: false,
    patchMotion: (mo) => ({
      ...mo,
      s: M.seq(M.hold(0, [100, 118]), M.bake({ t0: 0, dur: land, from: [100, 118], to: [100, 100], curve: M.curves.easeOut, step: 2 }), M.squash({ t: land, amount: 0.1, recover: 20, base: 100 })),
      p: M.seq(M.hold(0, iconFrom), M.drop({ t0: 0, dur: land, from: iconFrom, to: [256, iconCenterY] })),
    }),
  });

  const wordTo = [256, textCenterY];
  const wordFrom = [256, textCenterY + TRAVEL];
  const word = wordLayer(glyphs, wordFrom, 'Word', {
    s: L.animProp(M.seq(M.hold(0, [100, 84]), M.bake({ t0: 0, dur: land, from: [100, 84], to: [100, 100], curve: M.curves.easeOut, step: 2 }))),
    p: L.animProp(M.seq(M.hold(0, wordFrom), M.bake({ t0: 0, dur: land, from: wordFrom, to: wordTo, curve: M.curves.bounceOut, step: 2 }))),
    r: L.staticProp(0),
  });

  emit('logo-full-drop', { op: OP, layers: [...iconLayers, word] });
}

// =========================================================
// 3. Полное лого — знак на месте, лаймовая шторка проявляет строку
// =========================================================
function fullWipe() {
  L.resetLayerIndex();
  const OP = 148;
  const { iconSize, iconCenterY, glyphs, textCenterY, textW } = lockupGeometry({});

  const iconLayers = C.buildSticker({ canvas: 512, op: OP, icon: brandMark, iconSize, entrance: 'pop', center: [256, iconCenterY], shadow: false });

  const SWIPE = 40;
  // уже, чем в оригинальном леттеринге: там шторка уезжает корпусом
  // за пределы широкого 1600-канваса, здесь ей просто некуда — правый
  // и левый край шторки должны оставаться внутри 512×512 даже когда
  // она стоит ровно у первой/последней буквы
  const left = 256 - textW / 2 - 24;
  const right = 256 + textW / 2 + 24;
  const band = L.shapeLayer(
    'Band',
    [L.groupItem('b', [L.rectItem({ p: [0, 0], s: [26, 100], r: 12 }), L.fillItem(BRAND.lime)])],
    {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(M.seq(M.bake({ t0: 20, dur: SWIPE, from: [left, textCenterY], to: [right, textCenterY], curve: M.curves.easeInOut, step: 2 }), M.hold(OP, [right, textCenterY]))),
        /* M.hold() из motion.js на самом деле не держит значение, а
           плавно ведёт к следующему ключу («linear»-маркер для запечённых
           кривых) — то есть hold(0,0)+hold(20,100) не прячет шторку до
           20-го кадра, а плавно проявляет её все эти 20 кадров, пока она
           ещё стоит за левым краем канваса. Настоящее удержание — только
           через литеральный { hold: true }. */
        o: L.animProp(
          M.seq(
            [{ t: 0, v: 0, hold: true }],
            [{ t: 20, v: 100, hold: true }],
            [{ t: 20 + SWIPE - 6, v: 100, hold: true }],
            M.bake({ t0: 20 + SWIPE - 6, dur: 8, from: 100, to: 0, curve: M.curves.easeOut, step: 2 }),
            M.hold(OP, 0)
          )
        ),
      },
    }
  );

  const glyphLayers = glyphs.map((g, i) => {
    const x = 256 + g.cx;
    const t0 = 20 + Math.max(0, Math.round(((x - left) / (right - left)) * SWIPE) - 2);
    const home = [x, textCenterY + g.cy];
    return L.shapeLayer(
      `Glyph ${i}`,
      [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })],
      {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp(home),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 20, to: 100, lag: 2 }))),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
        },
      }
    );
  });

  emit('logo-full-wipe', { op: OP, layers: [band, ...glyphLayers, ...iconLayers] });
}

// =========================================================
// 4. Полное лого — знак появляется, строка печатается построчно
// =========================================================
function fullType() {
  L.resetLayerIndex();
  const OP = 168;
  const { iconSize, iconCenterY, glyphs, textCenterY, textW } = lockupGeometry({});

  const iconLayers = C.buildSticker({ canvas: 512, op: OP, icon: brandMark, iconSize, entrance: 'anticipate', center: [256, iconCenterY], shadow: false });

  const STEP = 5;
  const startAt = 26;
  const typedAt = (i) => startAt + i * STEP;
  const doneAt = typedAt(glyphs.length - 1) + 8;

  const glyphLayers = glyphs.map((g, i) => {
    const t0 = typedAt(i);
    const home = [256 + g.cx, textCenterY + g.cy];
    return L.shapeLayer(
      `Glyph ${i}`,
      [L.groupItem('g', [...g.sub.map((sp, j) => L.pathShapeItem(sp, `p${j}`)), L.fillItem(BRAND.lime)], { p: [-g.cx, -g.cy] })],
      {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp(home),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(t0, [0, 0]), M.popIn({ t0, dur: 12, to: 100, lag: 1, bounces: 1.8, decay: 6 }))),
          o: L.animProp(M.seq(M.hold(0, 0), M.hold(t0, 0), M.hold(t0 + 1, 100), M.hold(OP, 100))),
        },
      }
    );
  });

  const caretX = glyphs.map((g) => {
    const b = L.bboxOfSubpaths(g.sub);
    return 256 + b.maxX + 20;
  });
  const caretPos = M.seq(M.hold(0, [256 - textW / 2 - 8, textCenterY]), ...glyphs.map((g, i) => M.hold(typedAt(i), [caretX[i], textCenterY])));
  const caret = L.shapeLayer(
    'Caret',
    [L.groupItem('c', [L.rectItem({ p: [0, 0], s: [16, textW * 0.09 + 30], r: 5 }), L.fillItem(BRAND.lime)])],
    {
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
    }
  );

  emit('logo-full-type', { op: OP, layers: [caret, ...glyphLayers, ...iconLayers] });
}

// =========================================================
// 5. Полное лого — знак и строка впечатываются одним ударом
// =========================================================
function fullStamp() {
  L.resetLayerIndex();
  const OP = 128;
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({});
  const WINDUP = 34;
  const hit = 15;

  const iconPos = [256, iconCenterY];
  const wordPos = [256, textCenterY];
  const iconHigh = [256, iconCenterY - WINDUP];
  const wordHigh = [256, textCenterY - WINDUP];

  const scaleCurve = M.seq(
    M.hold(0, [116, 116]),
    M.bake({ t0: 0, dur: hit, from: [116, 116], to: [102, 90], curve: M.curves.expoIn, step: 2 }),
    M.squash({ t: hit, amount: 0.18, recover: 24, base: 100 })
  );
  const rotCurve = M.seq(M.hold(0, 6), M.bake({ t0: 0, dur: hit, from: 6, to: 0, curve: M.curves.expoIn, step: 2 }), M.wobble({ t0: hit, dur: 30, amp: 6 }));

  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: iconPos,
    shadow: false,
    // радиус меньше, чем у одиночного знака: связка стоит выше в
    // канвасе (под ней ещё едет строка), лучи не должны бить в потолок
    accents: { burst: { count: 8, t0: hit, radius: 128, len: 24, width: 9 } },
    patchMotion: () => ({
      s: scaleCurve,
      r: rotCurve,
      p: M.seq(M.hold(0, iconHigh), M.bake({ t0: 0, dur: hit, from: iconHigh, to: iconPos, curve: M.curves.expoIn, step: 2 })),
    }),
  });

  const word = wordLayer(glyphs, wordHigh, 'Word', {
    s: L.animProp(scaleCurve),
    r: L.animProp(rotCurve),
    p: L.animProp(M.seq(M.hold(0, wordHigh), M.bake({ t0: 0, dur: hit, from: wordHigh, to: wordPos, curve: M.curves.expoIn, step: 2 }))),
  });

  emit('logo-full-stamp', { op: OP, layers: [...iconLayers, word] });
}

// =========================================================
// 6. Полное лого — знак и строка качаются вместе, как маятник
// =========================================================
function fullSwing() {
  L.resetLayerIndex();
  const OP = 150;
  // связка чуть компактнее обычной: рычаг от точки подвеса до строки
  // внизу и так длинный (высота знака + зазор + строка), а мотает
  // именно нижнюю точку сильнее всего — большая связка на этом рычаге
  // при повороте уходила бы за края канваса
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({ iconSize: 300, wordW: 340 });
  const PIVOT_Y = iconCenterY - 60; // точка подвеса чуть выше знака

  const rot = M.seq(
    M.hold(0, 12),
    M.bake({ t0: 0, dur: 26, from: 12, to: -7, curve: M.curves.easeInOut, step: 2 }),
    M.wobble({ t0: 26, dur: 80, amp: -7, bounces: 2.6, decay: 2.6 }),
    M.sway({ t0: 106, t1: OP, amp: 1.2, cycles: 1 })
  );
  const scale = M.seq(M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 }));
  const pivotWorld = [256, PIVOT_Y];

  /* Трансформ Lottie рисует контент точки (0,0) в p - R(a); чтобы в
     состоянии покоя (r=0) он совпал с истинным центром детали,
     анкор должен быть pivotY - restY (а не наоборот — на этом
     свихнулась первая версия и знак улетал за кадр). */
  const iconAnchor = [0, PIVOT_Y - iconCenterY];
  const wordAnchor = [0, PIVOT_Y - textCenterY];

  const iconLayer = L.shapeLayer('Mark', [C.iconGroup(brandMark, baseStyle(13), iconSize)], {
    op: OP,
    ks: { a: L.staticProp(iconAnchor), p: L.staticProp(pivotWorld), s: L.animProp(scale), r: L.animProp(rot) },
  });
  const iconShadow = L.shapeLayer('Mark shadow', [C.iconGroup(brandMark, shadowStyle(13), iconSize)], {
    op: OP,
    ks: {
      a: L.staticProp([iconAnchor[0] - 12, iconAnchor[1] - 12]),
      p: L.staticProp(pivotWorld),
      s: L.animProp(scale),
      r: L.animProp(rot),
    },
  });
  const wordLayerRig = L.shapeLayer('Word', [flattenGlyphs(glyphs)], {
    op: OP,
    ks: { a: L.staticProp(wordAnchor), p: L.staticProp(pivotWorld), s: L.animProp(scale), r: L.animProp(rot) },
  });

  emit('logo-full-swing', { op: OP, layers: [iconLayer, wordLayerRig, iconShadow] });
}

// =========================================================
// 7. Полное лого — искры облетают всю связку по орбите
// =========================================================
function fullOrbit() {
  L.resetLayerIndex();
  const OP = 172;
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({});
  const CY = (iconCenterY + textCenterY) / 2;
  const R = Math.max(180, (textCenterY - iconCenterY) + 70);

  const orbiters = [0, 0.33, 0.66].map((phase, i) => {
    const pts = M.orbit({ t0: 0, t1: OP, cx: 256, cy: CY, r: R, turns: 1, phase, step: 4 });
    return L.shapeLayer(
      `Orbiter ${i}`,
      [L.groupItem('o', [L.starItem({ p: [0, 0], pt: 4, or_: 24 - i * 3, ir: 7, sy: 1 }), L.fillItem(i === 1 ? BRAND.ink : BRAND.lime)])],
      {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(pts),
          r: L.animProp(M.seq(M.bake({ t0: 0, dur: OP, from: 0, to: 180, curve: M.curves.linear, step: 8 }))),
          s: L.animProp(M.seq(M.hold(0, [0, 0]), M.hold(22 + i * 6, [0, 0]), M.popIn({ t0: 22 + i * 6, dur: 20, to: 100, lag: 2 }))),
        },
      }
    );
  });

  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: [256, iconCenterY],
    shadow: false,
    patchMotion: (mo) => ({ ...mo, r: M.seq(M.wobble({ t0: 2, dur: 36, amp: 8 }), M.sway({ t0: 40, t1: OP, amp: 2.4, cycles: 1 })) }),
  });
  const word = wordLayer(glyphs, [256, textCenterY], 'Word', {
    s: L.animProp(M.seq(M.hold(0, [62, 62]), M.popIn({ t0: 10, dur: 22, from: 62, to: 100, lag: 2 }))),
  });

  emit('logo-full-orbit', { op: OP, layers: [...orbiters, word, ...iconLayers] });
}

// =========================================================
// 8. Полное лого — глитч-сведение знака и строки из двойников
// =========================================================
function fullGlitch() {
  L.resetLayerIndex();
  const OP = 130;
  // знак и строка чуть компактнее обычной: у двойников есть свой
  // боковой разлёт (offset+jitter) поверх собственной ширины — на
  // полноразмерной связке сумма уходила за края канваса
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({ iconSize: 320, wordW: 340 });
  const settle = 32;
  const OFFSET = 28;
  const JITTER = 10;

  const ghostIcon = (color, dir, delay) =>
    L.shapeLayer('Ghost icon', [C.iconGroup(brandMark, { fill: color, stroke: color, ink: color, sw: 12 }, iconSize)], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp(
          M.seq(
            M.hold(0, [256 + dir * OFFSET, iconCenterY - dir * 18]),
            M.jitter({ t0: 0, t1: delay, base: 256 + dir * OFFSET, amp: JITTER, seed: dir > 0 ? 3 : 9, step: 3 }).map((k) => ({ ...k, v: [k.v, iconCenterY - dir * 18] })),
            M.bake({ t0: delay, dur: settle - delay, from: [256 + dir * OFFSET, iconCenterY - dir * 18], to: [256, iconCenterY], curve: M.curves.expoOut, step: 2 })
          )
        ),
        o: L.animProp(M.seq(M.hold(0, 50), M.hold(settle - 4, 50), M.hold(settle, 0), M.hold(OP, 0))),
      },
    });

  const ghostWord = (color, dir, delay) =>
    L.shapeLayer(
      'Ghost word',
      [L.groupItem('gw', [...glyphs.flatMap((g, i) => g.sub.map((sp, j) => L.pathShapeItem(sp, `p${i}_${j}`))), L.fillItem(color)])],
      {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.animProp(
            M.seq(
              M.hold(0, [256 + dir * OFFSET, textCenterY - dir * 12]),
              M.jitter({ t0: 0, t1: delay, base: 256 + dir * OFFSET, amp: JITTER, seed: dir > 0 ? 7 : 13, step: 3 }).map((k) => ({ ...k, v: [k.v, textCenterY - dir * 12] })),
              M.bake({ t0: delay, dur: settle - delay, from: [256 + dir * OFFSET, textCenterY - dir * 12], to: [256, textCenterY], curve: M.curves.expoOut, step: 2 })
            )
          ),
          o: L.animProp(M.seq(M.hold(0, 50), M.hold(settle - 4, 50), M.hold(settle, 0), M.hold(OP, 0))),
        },
      }
    );

  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: [256, iconCenterY],
    shadow: false,
    patchMotion: () => ({
      p: M.seq(M.jitter({ t0: 0, t1: 20, base: 256, amp: 12, seed: 5, step: 3 }).map((k) => ({ ...k, v: [k.v, iconCenterY] })), M.hold(22, [256, iconCenterY]), M.hold(OP, [256, iconCenterY])),
      s: M.seq(
        M.hold(0, [114, 84]),
        M.hold(8, [86, 112]),
        M.hold(14, [108, 90]),
        M.bake({ t0: 16, dur: 20, from: [108, 90], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 }),
        M.breathe({ t0: 40, t1: OP, base: 100, amp: 2, cycles: 1 })
      ),
      r: M.seq(M.hold(0, 0)),
    }),
  });

  const word = wordLayer(glyphs, [256, textCenterY], 'Word', {
    s: L.animProp(
      M.seq(
        M.hold(0, [114, 84]),
        M.hold(8, [86, 112]),
        M.hold(14, [108, 90]),
        M.bake({ t0: 16, dur: 20, from: [108, 90], to: [100, 100], curve: M.curves.spring({ bounces: 2.2, decay: 5 }), step: 2 })
      )
    ),
  });

  emit('logo-full-glitch', {
    op: OP,
    layers: [ghostIcon(BRAND.lime, 1, 18), ghostIcon(BRAND.ink, -1, 22), ghostWord(BRAND.lime, -1, 20), ghostWord(BRAND.ink, 1, 24), word, ...iconLayers],
  });
}

// =========================================================
// 9. Полное лого — жалюзи раскрывают уже готовую связку
// =========================================================
function fullShutter() {
  L.resetLayerIndex();
  const OP = 118;
  const { iconSize, iconCenterY, glyphs, textCenterY, textW } = lockupGeometry({});

  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: [256, iconCenterY],
    shadow: false,
    patchMotion: (mo) => ({ ...mo, s: M.seq(M.hold(0, [100, 100]), M.breathe({ t0: 30, t1: OP, base: 100, amp: 2, cycles: 1 })) }),
  });
  const word = wordLayer(glyphs, [256, textCenterY], 'Word');

  const blockCenterY = (iconCenterY + textCenterY) / 2;
  const blockHeight = textCenterY - iconCenterY + 140;
  const blockWidth = Math.max(iconSize, textW) * 1.15;

  const slats = shutterSlats({ centerY: blockCenterY, height: blockHeight, width: blockWidth, op: OP, count: 7, t0: 18, stagger: 6, dur: 18 });

  emit('logo-full-shutter', { op: OP, layers: [...slats, word, ...iconLayers] });
}

// =========================================================
// 10. Полное лого — знак и строка съезжаются с разных сторон
// =========================================================
function fullSplit() {
  L.resetLayerIndex();
  const OP = 136;
  const { iconSize, iconCenterY, glyphs, textCenterY } = lockupGeometry({});
  const TRAVEL = 74;
  const dur = 26;

  const iconPos = [256, iconCenterY];
  const iconFrom = [256 - TRAVEL, iconCenterY];
  const iconLayers = C.buildSticker({
    canvas: 512,
    op: OP,
    icon: brandMark,
    iconSize,
    entrance: 'pop',
    center: iconPos,
    shadow: false,
    patchMotion: (mo) => ({
      ...mo,
      s: M.seq(M.hold(0, [90, 90]), M.bake({ t0: 0, dur, from: [90, 90], to: [100, 100], curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 }), M.breathe({ t0: dur + 6, t1: OP, base: 100, amp: 2, cycles: 1 })),
      p: M.seq(M.hold(0, iconFrom), M.bake({ t0: 0, dur, from: iconFrom, to: iconPos, curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 })),
    }),
  });

  const wordPos = [256, textCenterY];
  const wordFrom = [256 + TRAVEL, textCenterY];
  const word = wordLayer(glyphs, wordFrom, 'Word', {
    s: L.animProp(M.seq(M.hold(0, [90, 90]), M.bake({ t0: 0, dur, from: [90, 90], to: [100, 100], curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 }))),
    p: L.animProp(M.seq(M.hold(0, wordFrom), M.bake({ t0: 0, dur, from: wordFrom, to: wordPos, curve: M.curves.spring({ bounces: 1.8, decay: 5.6 }), step: 2 }))),
  });

  emit('logo-full-split', { op: OP, layers: [...iconLayers, word] });
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
  iconShutter,
  fullPop,
  fullDrop,
  fullWipe,
  fullType,
  fullStamp,
  fullSwing,
  fullOrbit,
  fullGlitch,
  fullShutter,
  fullSplit,
  wordmarkWave,
  wordmarkWipe,
  wordmarkType,
];

module.exports = { ALL, brandMark, brandMarkSubpaths };

if (require.main === module) {
  console.log('Логотипы:');
  ALL.forEach((fn) => fn());
}
