'use strict';
/* Анимированные логотипы Нейро Отличника — из настоящих контуров
   assets/logo-icon.svg и assets/logo-full.svg (никаких растров/шрифтов —
   только векторные фигуры, поэтому пакет совместим с Telegram .tgs). */

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'assets', 'lottie');

// ---------------------------------------------------------------
// 1. logo-icon-loop — знак «бесконечность/очки» Нейро Отличника:
//    контур прорисовывается (trim path), затем заливается лаймом
//    и мягко «дышит» в бесконечном цикле.
// ---------------------------------------------------------------
function buildLogoIconLoop() {
  L.resetLayerIndex();
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'logo-icon.svg'), 'utf8');
  const vb = L.readSvgViewBox(svg);
  const ds = L.extractPathsFromSvg(svg); // [большая фигура, маленькая капля]

  const W = 512, H = 512;
  const PAD = 70;
  const targetW = W - PAD * 2;
  const targetH = H - PAD * 2;
  const scale = Math.min(targetW / vb.w, targetH / vb.h);
  const drawnW = vb.w * scale;
  const drawnH = vb.h * scale;
  const dx = (W - drawnW) / 2 - vb.minX * scale;
  const dy = (H - drawnH) / 2 - vb.minY * scale;

  const allSubpaths = ds.map((d) => L.transformSubpaths(L.parseSvgPath(d), { scale, dx, dy }));

  const FR = 60;
  const DRAW_END = 55; // прорисовка контура
  const FILL_END = 78; // заливка проявляется
  const LOOP_START = 78;
  const LOOP_END = 220; // цикл дыхания
  const OP = LOOP_END;

  const shapeItems = [];
  allSubpaths.forEach((subpaths, gi) => {
    const pathItems = subpaths.map((sp, i) => L.pathShapeItem(sp, `Path ${gi}-${i}`));
    shapeItems.push(
      L.groupItem(`Contour ${gi + 1}`, [
        ...pathItems,
        L.trimItem({
          s: 0,
          e: L.animProp([
            { t: 0, v: 0 },
            { t: DRAW_END, v: 100 },
          ]),
          o: 0,
        }),
        L.strokeItem(L.BRAND.ink, 10, 100),
        L.fillItem(
          L.BRAND.lime,
          L.animProp([
            { t: DRAW_END, v: 0 },
            { t: FILL_END, v: 100 },
          ])
        ),
      ])
    );
  });

  const layer = L.shapeLayer('Neuro Otlichnik Icon', shapeItems, {
    op: OP,
    ks: {
      a: L.staticProp([W / 2, H / 2]),
      p: L.staticProp([W / 2, H / 2]),
      s: L.animProp([
        { t: 0, v: [88, 88] },
        { t: DRAW_END, v: [100, 100] },
        { t: LOOP_START, v: [100, 100] },
        { t: LOOP_START + 70, v: [104, 104] },
        { t: LOOP_END, v: [100, 100] },
      ]),
    },
  });

  const anim = L.animation({ w: W, h: H, fr: FR, op: OP, nm: 'neuro-otlichnik-logo-icon-loop', layers: [layer] });
  L.writeJson(path.join(OUT_DIR, 'logo-icon-loop.json'), anim);
}

// ---------------------------------------------------------------
// 2. logo-wordmark-reveal — полный леттеринг «NEURO OTLICHNIK»
//    (assets/logo-full.svg), буквы проявляются волной слева направо.
// ---------------------------------------------------------------
function buildLogoWordmarkReveal() {
  L.resetLayerIndex();
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'logo-full.svg'), 'utf8');
  const vb = L.readSvgViewBox(svg);
  const ds = L.extractPathsFromSvg(svg);

  // Каждый <path> = одна буква/группа букв. В экспорте попадаются
  // микроскопические артефакты (площадь ~0) — отфильтровываем их.
  const glyphs = ds
    .map((d) => L.parseSvgPath(d))
    .map((subpaths) => ({ subpaths, bbox: L.bboxOfSubpaths(subpaths) }))
    .filter((g) => g.bbox.w > 4 && g.bbox.h > 4)
    .sort((a, b) => a.bbox.minX - b.bbox.minX);

  const W = 1600, H = 420;
  const PAD = 90;
  const targetW = W - PAD * 2;
  const targetH = H - PAD * 2;
  const scale = Math.min(targetW / vb.w, targetH / vb.h);
  const drawnW = vb.w * scale;
  const drawnH = vb.h * scale;
  const dx = (W - drawnW) / 2 - vb.minX * scale;
  const dy = (H - drawnH) / 2 - vb.minY * scale;

  const FR = 60;
  const STAGGER = 2.6; // кадров между стартом соседних букв
  const RISE = 22; // кадров на подъём + проявление одной буквы
  const lastStart = (glyphs.length - 1) * STAGGER;
  const revealEnd = Math.ceil(lastStart + RISE);
  const HOLD = revealEnd + 45;
  const OP = HOLD + 20;

  const layers = glyphs.map((g, idx) => {
    const subpaths = L.transformSubpaths(g.subpaths, { scale, dx, dy });
    const pathItems = subpaths.map((sp, i) => L.pathShapeItem(sp, `p${i}`));
    const group = L.groupItem('Glyph', [...pathItems, L.fillItem(L.BRAND.lime, 100)]);

    const start = idx * STAGGER;
    const cx = g.bbox.minX * scale + dx + (g.bbox.w * scale) / 2;
    const cy = g.bbox.minY * scale + dy + (g.bbox.h * scale) / 2;

    return L.shapeLayer(`Glyph ${idx}`, [group], {
      op: OP,
      ks: {
        a: L.staticProp([cx, cy]),
        p: L.animProp([
          { t: start, v: [cx, cy + 34] },
          { t: start + RISE, v: [cx, cy] },
        ]),
        o: L.animProp([
          { t: start, v: 0 },
          { t: start + RISE, v: 100 },
        ]),
      },
    });
  });

  const anim = L.animation({ w: W, h: H, fr: FR, op: OP, nm: 'neuro-otlichnik-logo-wordmark-reveal', layers });
  L.writeJson(path.join(OUT_DIR, 'logo-wordmark-reveal.json'), anim);
}

module.exports = { buildLogoIconLoop, buildLogoWordmarkReveal };

if (require.main === module) {
  console.log('Логотипы:');
  buildLogoIconLoop();
  buildLogoWordmarkReveal();
}
