'use strict';
/* =========================================================
   Набор анимированных реакций Нейро Отличника.
   Все иконки — лайм (#dbfc3b) + графит (#2a2a2a), плотная
   обводка, флэт-геометрия — фирменный "дудл"-стиль бренда.
   Только векторные фигуры (без растров/текста) — совместимо
   с Telegram .tgs (см. assets/lottie/README.md).
   ========================================================= */

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'assets', 'lottie');
const DOODLES_DIR = path.join(ROOT, 'assets', 'doodles');

const W = 512, H = 512;
const CX = W / 2, CY = H / 2;
const FR = 60;

function centerAndScale(subpaths, targetSize) {
  const bbox = L.bboxOfSubpaths(subpaths);
  const cx = bbox.minX + bbox.w / 2;
  const cy = bbox.minY + bbox.h / 2;
  const scale = targetSize / Math.max(bbox.w, bbox.h);
  return L.transformSubpaths(subpaths, { scale, dx: -cx * scale, dy: -cy * scale });
}

function loadDoodle(name, targetSize) {
  const svg = fs.readFileSync(path.join(DOODLES_DIR, `${name}.svg`), 'utf8');
  const ds = L.extractPathsFromSvg(svg);
  const subpaths = ds.flatMap((d) => L.parseSvgPath(d));
  return centerAndScale(subpaths, targetSize);
}

function pathGroup(nm, subpaths, { fill, stroke, strokeWidth } = {}) {
  const items = subpaths.map((sp, i) => L.pathShapeItem(sp, `p${i}`));
  if (stroke) items.push(L.strokeItem(stroke, strokeWidth || 10));
  if (fill) items.push(L.fillItem(fill));
  return L.groupItem(nm, items);
}

// маленький акцент-искра (переиспользуем фирменный doodle) с миганием
function sparkleAccent(pos, size, delay, spin = 20) {
  const sp = loadDoodle('sparkle', size);
  const group = pathGroup('Sparkle', sp, { fill: L.BRAND.lime });
  return L.shapeLayer('Sparkle accent', [group], {
    op: 9999,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp(pos),
      r: L.animProp([
        { t: delay, v: 0 },
        { t: delay + 40, v: spin },
      ]),
      o: L.animProp([
        { t: delay, v: 0 },
        { t: delay + 6, v: 100 },
        { t: delay + 26, v: 100 },
        { t: delay + 40, v: 0 },
      ]),
      s: L.animProp([
        { t: delay, v: [40, 40] },
        { t: delay + 8, v: [110, 110] },
        { t: delay + 40, v: [70, 70] },
      ]),
    },
  });
}

function finish(nm, op, layers) {
  const anim = L.animation({ w: W, h: H, fr: FR, op, nm, layers });
  L.writeJson(path.join(OUT_DIR, `${nm}.json`), anim);
}

// ---------------------------------------------------------------
// 1. HEART — сердцебиение с искрой
// ---------------------------------------------------------------
function buildHeart() {
  L.resetLayerIndex();
  const d =
    'M100,178 C40,140 8,103 8,66 C8,34 32,10 62,10 C80,10 94,20 100,36 ' +
    'C106,20 120,10 138,10 C168,10 192,34 192,66 C192,103 160,140 100,178 Z';
  const sp = centerAndScale(L.parseSvgPath(d), 300);
  const heart = pathGroup('Heart', sp, { fill: L.BRAND.lime, stroke: L.BRAND.ink, strokeWidth: 16 });

  const OP = 100;
  const heartLayer = L.shapeLayer('Heart', [heart], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY + 10]),
      s: L.animProp([
        { t: 0, v: [92, 92] },
        { t: 8, v: [128, 128] },
        { t: 16, v: [100, 100] },
        { t: 24, v: [120, 120] },
        { t: 36, v: [100, 100] },
        { t: 100, v: [100, 100] },
      ]),
    },
  });

  const spark = sparkleAccent([CX + 108, CY - 118], 90, 10, 25);
  finish('reaction-heart', OP, [spark, heartLayer]);
}

// ---------------------------------------------------------------
// 2. FIRE — пламя с фликкером
// ---------------------------------------------------------------
function buildFire() {
  L.resetLayerIndex();
  const outerD =
    'M100,12 C130,50 158,78 158,118 C158,156 132,184 100,190 C68,184 42,156 42,118 ' +
    'C42,90 55,68 72,52 C70,80 80,98 96,104 C90,78 92,45 100,12 Z';
  const innerD =
    'M100,150 C112,132 122,118 122,102 C122,88 112,78 100,72 C104,90 98,104 88,110 C90,124 94,140 100,150 Z';

  const outer = centerAndScale(L.parseSvgPath(outerD), 300);
  const bboxOuter = L.bboxOfSubpaths(L.parseSvgPath(outerD));
  const scaleF = 300 / Math.max(bboxOuter.w, bboxOuter.h);
  const cx = bboxOuter.minX + bboxOuter.w / 2;
  const cy = bboxOuter.minY + bboxOuter.h / 2;
  const inner = L.transformSubpaths(L.parseSvgPath(innerD), { scale: scaleF, dx: -cx * scaleF, dy: -cy * scaleF });

  const outerGroup = pathGroup('Flame outer', outer, { fill: L.BRAND.lime, stroke: L.BRAND.ink, strokeWidth: 14 });
  const innerGroup = pathGroup('Flame inner', inner, { fill: L.BRAND.ink });

  const OP = 90;
  const flicker = [
    { t: 0, v: [100, 100] },
    { t: 10, v: [107, 95] },
    { t: 20, v: [96, 108] },
    { t: 32, v: [109, 96] },
    { t: 44, v: [98, 106] },
    { t: 58, v: [105, 98] },
    { t: 72, v: [98, 103] },
    { t: 90, v: [100, 100] },
  ];
  const sway = [
    { t: 0, v: -3 },
    { t: 18, v: 4 },
    { t: 40, v: -5 },
    { t: 64, v: 3 },
    { t: 90, v: -3 },
  ];

  const flameLayer = L.shapeLayer('Flame', [outerGroup, innerGroup], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY + 40]),
      r: L.animProp(sway),
      s: L.animProp(flicker),
    },
  });

  finish('reaction-fire', OP, [flameLayer]);
}

// ---------------------------------------------------------------
// 3. THUMBS UP
// ---------------------------------------------------------------
function buildThumbsUp() {
  L.resetLayerIndex();
  const palm = L.groupItem('Palm', [
    L.rectItem({ p: [14, 34], s: [110, 92], r: 30 }),
    L.strokeItem(L.BRAND.ink, 16),
    L.fillItem(L.BRAND.lime),
  ]);
  const thumb = L.groupItem(
    'Thumb',
    [L.rectItem({ p: [0, 0], s: [46, 104], r: 23 }), L.strokeItem(L.BRAND.ink, 16), L.fillItem(L.BRAND.lime)],
    { p: [-40, -46], r: -16 }
  );

  const OP = 100;
  const handLayer = L.shapeLayer('Hand', [thumb, palm], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX - 10, CY + 30]),
      r: L.animProp([
        { t: 0, v: -8 },
        { t: 14, v: 6 },
        { t: 26, v: -4 },
        { t: 36, v: 0 },
        { t: 100, v: 0 },
      ]),
      s: L.animProp([
        { t: 0, v: [55, 55] },
        { t: 14, v: [118, 118] },
        { t: 24, v: [96, 96] },
        { t: 34, v: [106, 106] },
        { t: 44, v: [100, 100] },
        { t: 100, v: [100, 100] },
      ]),
    },
  });

  const spark = sparkleAccent([CX + 90, CY - 96], 86, 12, -20);
  finish('reaction-thumbsup', OP, [spark, handLayer]);
}

// ---------------------------------------------------------------
// 4. STAR / WOW — мерцающая звезда
// ---------------------------------------------------------------
function buildStar() {
  L.resetLayerIndex();
  const star = L.groupItem('Star', [
    L.starItem({ p: [0, 0], pt: 5, or_: 150, ir: 62, os: 6, is: 0, rot: -90 }),
    L.strokeItem(L.BRAND.ink, 14),
    L.fillItem(L.BRAND.lime),
  ]);

  const OP = 110;
  const starLayer = L.shapeLayer('Star', [star], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY]),
      r: L.animProp([
        { t: 0, v: -10 },
        { t: 20, v: 8 },
        { t: 45, v: -6 },
        { t: 70, v: 5 },
        { t: 110, v: -10 },
      ]),
      s: L.animProp([
        { t: 0, v: [80, 80] },
        { t: 10, v: [112, 112] },
        { t: 22, v: [96, 96] },
        { t: 34, v: [106, 106] },
        { t: 46, v: [100, 100] },
        { t: 110, v: [100, 100] },
      ]),
    },
  });

  const spark1 = sparkleAccent([CX + 132, CY - 60], 60, 6, 30);
  const spark2 = sparkleAccent([CX - 128, CY + 76], 50, 34, -30);
  const spark3 = sparkleAccent([CX - 96, CY - 116], 44, 58, 22);
  finish('reaction-star', OP, [spark1, spark2, spark3, starLayer]);
}

// ---------------------------------------------------------------
// 5. LIGHTBULB — идея (нейро-инсайт)
// ---------------------------------------------------------------
function buildLightbulb() {
  L.resetLayerIndex();

  const bulb = L.groupItem('Bulb', [
    L.ellipseItem({ p: [0, -34], s: [172, 182] }),
    L.strokeItem(L.BRAND.ink, 16),
    L.fillItem(L.BRAND.lime),
  ]);
  const base = L.groupItem('Base', [L.rectItem({ p: [0, 78], s: [78, 30], r: 10 }), L.fillItem(L.BRAND.ink)]);
  const filament = L.groupItem('Filament', [
    L.starItem({ p: [0, -34], pt: 4, or_: 30, ir: 11, sy: 1 }),
    L.fillItem(L.BRAND.ink),
  ]);

  const bulbLayer = (op) =>
    L.shapeLayer('Bulb group', [filament, bulb, base], {
      op,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.staticProp([CX, CY + 20]),
        s: L.animProp([
          { t: 0, v: [70, 70] },
          { t: 10, v: [110, 110] },
          { t: 18, v: [98, 98] },
          { t: 26, v: [104, 104] },
          { t: 60, v: [100, 100] },
          { t: 90, v: [104, 104] },
          { t: op, v: [100, 100] },
        ]),
      },
    });

  const RAYS = 6;
  const OP = 130;
  const rayLayers = [];
  for (let k = 0; k < RAYS; k++) {
    const angle = (k * 360) / RAYS - 90;
    const rad = (angle * Math.PI) / 180;
    const dist = 158;
    const pos = [CX + Math.cos(rad) * dist, CY + 20 + Math.sin(rad) * dist];
    // rect по умолчанию вертикальный (ось совпадает с направлением -90°),
    // поэтому доворачиваем на (angle + 90), чтобы луч смотрел радиально наружу
    const rayRotation = angle + 90;
    const ray = L.groupItem('Ray', [
      L.rectItem({ p: [0, 0], s: [14, 46], r: 7 }),
      L.strokeItem(L.BRAND.ink, 8),
      L.fillItem(L.BRAND.lime),
    ]);
    const delay = 22 + k * 4;
    rayLayers.push(
      L.shapeLayer(`Ray ${k}`, [ray], {
        op: OP,
        ks: {
          a: L.staticProp([0, 0]),
          p: L.staticProp(pos),
          r: L.staticProp(rayRotation),
          o: L.animProp([
            { t: delay, v: 0 },
            { t: delay + 8, v: 100 },
            { t: delay + 30, v: 60 },
            { t: delay + 55, v: 100 },
            { t: OP, v: 70 },
          ]),
          s: L.animProp([
            { t: delay, v: [40, 40] },
            { t: delay + 10, v: [100, 100] },
          ]),
        },
      })
    );
  }

  finish('reaction-lightbulb', OP, [bulbLayer(OP), ...rayLayers]);
}

// ---------------------------------------------------------------
// 6. CHECKMARK — «Отлично!» бейдж
// ---------------------------------------------------------------
function buildCheckmark() {
  L.resetLayerIndex();
  const badge = L.groupItem('Badge', [
    L.ellipseItem({ p: [0, 0], s: [320, 320] }),
    L.strokeItem(L.BRAND.ink, 18),
    L.fillItem(L.BRAND.lime),
  ]);

  const checkD = 'M-76,6 L-22,64 L86,-64';
  const checkSub = L.parseSvgPath(checkD);
  checkSub.forEach((sp) => { sp.c = false; }); // открытая ломаная — иначе замкнётся в треугольник
  const checkItems = checkSub.map((sp, i) => L.pathShapeItem(sp, `c${i}`));

  const OP = 120;
  const DRAW_START = 18;
  const DRAW_END = 40;
  const checkGroup = L.groupItem('Check', [
    ...checkItems,
    L.trimItem({
      s: 0,
      e: L.animProp([
        { t: DRAW_START, v: 0 },
        { t: DRAW_END, v: 100 },
      ]),
      o: 0,
    }),
    L.strokeItem(L.BRAND.ink, 30),
  ]);

  const badgeLayer = L.shapeLayer('Badge', [badge], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY]),
      s: L.animProp([
        { t: 0, v: [60, 60] },
        { t: 14, v: [112, 112] },
        { t: 22, v: [98, 98] },
        { t: 30, v: [100, 100] },
        { t: 60, v: [100, 100] },
        { t: 90, v: [104, 104] },
        { t: OP, v: [100, 100] },
      ]),
    },
  });
  const checkLayer = L.shapeLayer('Checkmark', [checkGroup], {
    op: OP,
    ks: { a: L.staticProp([0, 0]), p: L.staticProp([CX, CY]) },
  });

  const spark1 = sparkleAccent([CX + 130, CY - 130], 60, DRAW_END + 2, 25);
  const spark2 = sparkleAccent([CX - 138, CY - 96], 46, DRAW_END + 14, -20);
  finish('reaction-perfect', OP, [checkLayer, badgeLayer, spark1, spark2]);
}

// ---------------------------------------------------------------
// 7. CONFETTI — праздничный залп
// ---------------------------------------------------------------
function buildConfetti() {
  L.resetLayerIndex();
  const OP = 100;

  const particleDefs = [
    { a: -80, d: 168, size: 22, shape: 'rect', color: 'lime', spin: 140, delay: 0 },
    { a: -45, d: 190, size: 18, shape: 'circle', color: 'ink', spin: 0, delay: 4 },
    { a: -10, d: 175, size: 24, shape: 'tri', color: 'lime', spin: -120, delay: 0 },
    { a: 20, d: 195, size: 16, shape: 'circle', color: 'lime', spin: 0, delay: 6 },
    { a: 55, d: 170, size: 22, shape: 'rect', color: 'ink', spin: -160, delay: 2 },
    { a: 90, d: 200, size: 18, shape: 'circle', color: 'lime', spin: 0, delay: 0 },
    { a: 125, d: 172, size: 22, shape: 'tri', color: 'lime', spin: 130, delay: 5 },
    { a: 160, d: 188, size: 18, shape: 'circle', color: 'ink', spin: 0, delay: 3 },
    { a: -160, d: 178, size: 22, shape: 'rect', color: 'lime', spin: -140, delay: 7 },
    { a: -125, d: 165, size: 16, shape: 'circle', color: 'lime', spin: 0, delay: 1 },
    { a: 200, d: 182, size: 20, shape: 'tri', color: 'ink', spin: 150, delay: 8 },
    { a: 235, d: 172, size: 18, shape: 'circle', color: 'lime', spin: 0, delay: 3 },
  ];

  const layers = particleDefs.map((p, idx) => {
    const rad = (p.a * Math.PI) / 180;
    const end = [Math.cos(rad) * p.d, Math.sin(rad) * p.d];
    const color = p.color === 'lime' ? L.BRAND.lime : L.BRAND.ink;
    let shapeItem;
    if (p.shape === 'rect') shapeItem = L.rectItem({ p: [0, 0], s: [p.size, p.size], r: 4 });
    else if (p.shape === 'circle') shapeItem = L.ellipseItem({ p: [0, 0], s: [p.size, p.size] });
    else shapeItem = L.starItem({ p: [0, 0], pt: 3, or_: p.size * 0.62, ir: p.size * 0.3, sy: 1 });
    const group = L.groupItem('Particle', [shapeItem, L.fillItem(color)]);

    const t0 = p.delay;
    const t1 = t0 + 6;
    const t2 = t0 + 46;
    const t3 = t0 + 62;
    return L.shapeLayer(`Particle ${idx}`, [group], {
      op: OP,
      ks: {
        a: L.staticProp([0, 0]),
        p: L.animProp([
          { t: t0, v: [CX, CY] },
          { t: t2, v: [CX + end[0], CY + end[1]] },
        ]),
        r: L.animProp([
          { t: t0, v: 0 },
          { t: t2, v: p.spin },
        ]),
        s: L.animProp([
          { t: t0, v: [20, 20] },
          { t: t1, v: [100, 100] },
          { t: t2, v: [86, 86] },
        ]),
        o: L.animProp([
          { t: t0, v: 0 },
          { t: t1, v: 100 },
          { t: t2, v: 100 },
          { t: t3, v: 0 },
        ]),
      },
    });
  });

  const pop = L.groupItem('Pop', [L.ellipseItem({ p: [0, 0], s: [60, 60] }), L.fillItem(L.BRAND.lime)]);
  const popLayer = L.shapeLayer('Pop flash', [pop], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.staticProp([CX, CY]),
      o: L.animProp([
        { t: 0, v: 100 },
        { t: 10, v: 0 },
        { t: OP, v: 0 },
      ]),
      s: L.animProp([
        { t: 0, v: [40, 40] },
        { t: 10, v: [160, 160] },
      ]),
    },
  });

  finish('reaction-confetti', OP, [popLayer, ...layers]);
}

// ---------------------------------------------------------------
// 8. GRAD CAP — «Отличник» (выпускная шапочка)
// ---------------------------------------------------------------
function buildGradCap() {
  L.resetLayerIndex();
  const OP = 130;

  const capTop = L.groupItem(
    'Cap top',
    [L.rectItem({ p: [0, 0], s: [196, 196], r: 16 }), L.strokeItem(L.BRAND.ink, 14), L.fillItem(L.BRAND.lime)],
    { r: 45 }
  );
  const band = L.groupItem('Band', [L.rectItem({ p: [0, 0], s: [96, 34], r: 14 }), L.fillItem(L.BRAND.ink)], {
    p: [0, 58],
  });

  const capLayer = L.shapeLayer('Cap', [band, capTop], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp([
        { t: 0, v: [CX, CY - 70] },
        { t: 20, v: [CX, CY + 6] },
        { t: 30, v: [CX, CY - 12] },
        { t: 40, v: [CX, CY] },
        { t: OP, v: [CX, CY] },
      ]),
      r: L.animProp([
        { t: 0, v: -18 },
        { t: 26, v: 6 },
        { t: 40, v: 0 },
        { t: OP, v: 0 },
      ]),
      s: L.animProp([
        { t: 0, v: [70, 70] },
        { t: 20, v: [108, 108] },
        { t: 40, v: [100, 100] },
        { t: OP, v: [100, 100] },
      ]),
      o: L.animProp([
        { t: 0, v: 0 },
        { t: 6, v: 100 },
        { t: OP, v: 100 },
      ]),
    },
  });

  // кисточка свисает от центра шапки и покачивается вокруг точки крепления
  const attach = [CX, CY];
  const thread = L.groupItem('Thread', [L.rectItem({ p: [0, 75], s: [7, 150], r: 4 }), L.fillItem(L.BRAND.ink)]);
  const bead = L.groupItem('Bead', [
    L.ellipseItem({ p: [0, 150], s: [26, 26] }),
    L.strokeItem(L.BRAND.ink, 8),
    L.fillItem(L.BRAND.lime),
  ]);
  const tasselLayer = L.shapeLayer('Tassel', [bead, thread], {
    op: OP,
    ks: {
      a: L.staticProp([0, 0]),
      p: L.animProp([
        { t: 0, v: attach },
        { t: 40, v: attach },
      ]),
      r: L.animProp([
        { t: 40, v: 2 },
        { t: 62, v: 28 },
        { t: 86, v: 6 },
        { t: 110, v: 22 },
        { t: OP, v: 2 },
      ]),
      o: L.animProp([
        { t: 0, v: 0 },
        { t: 40, v: 0 },
        { t: 46, v: 100 },
        { t: OP, v: 100 },
      ]),
    },
  });

  const spark = sparkleAccent([CX - 118, CY - 108], 70, 34, 24);
  finish('reaction-gradcap', OP, [tasselLayer, capLayer, spark]);
}

module.exports = {
  buildHeart,
  buildFire,
  buildThumbsUp,
  buildStar,
  buildLightbulb,
  buildCheckmark,
  buildConfetti,
  buildGradCap,
};

if (require.main === module) {
  console.log('Реакции:');
  buildHeart();
  buildFire();
  buildThumbsUp();
  buildStar();
  buildLightbulb();
  buildCheckmark();
  buildConfetti();
  buildGradCap();
}
