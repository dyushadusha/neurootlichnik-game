'use strict';
/* =========================================================
   NEURO OTLICHNIK — общая библиотека для сборки Lottie JSON
   =========================================================
   Никаких внешних зависимостей: чистый JS + fs.
   Поддерживает:
     - точный парсинг SVG path "d" (M L H V C Z, абсолютные и
       относительные варианты) в формат кривых Lottie (v/i/o),
       включая составные контуры (буквы с "дырками" — О, А, Р…)
     - билдеры нативных фигур (эллипс, прямоугольник, звезда/полигон)
     - билдеры заливки/обводки/трансформации/группы/trim path
     - хелпер для кейфреймов с плавным easing или "hold"
   ========================================================= */

const fs = require('fs');
const path = require('path');

// ---------- цвет ----------
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [round4(r), round4(g), round4(b), alpha];
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Фирменная палитра Нейро Отличника
const BRAND = {
  lime: '#dbfc3b',
  ink: '#2a2a2a',
  white: '#ffffff',
};

// ---------- SVG path "d" -> Lottie bezier ----------
function parseSvgPath(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0;
  const next = () => parseFloat(tokens[i++]);

  let cur = { x: 0, y: 0 };
  let subpaths = [];
  let nodes = null;

  const pushNode = (x, y, inCtrl, outCtrlForPrev) => {
    if (outCtrlForPrev && nodes && nodes.length) {
      nodes[nodes.length - 1].out = outCtrlForPrev;
    }
    nodes.push({ x, y, in: inCtrl || null, out: null });
  };

  let cmd = null;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }
    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    if (C === 'M') {
      if (nodes && nodes.length) subpaths.push(nodes);
      let x = next();
      let y = next();
      if (isRel) { x += cur.x; y += cur.y; }
      cur = { x, y };
      nodes = [{ x, y, in: null, out: null }];
      cmd = isRel ? 'l' : 'L'; // последующие пары после M трактуются как L
    } else if (C === 'L') {
      let x = next();
      let y = next();
      if (isRel) { x += cur.x; y += cur.y; }
      pushNode(x, y, null, null);
      cur = { x, y };
    } else if (C === 'H') {
      let x = next();
      if (isRel) x += cur.x;
      pushNode(x, cur.y, null, null);
      cur = { x, y: cur.y };
    } else if (C === 'V') {
      let y = next();
      if (isRel) y += cur.y;
      pushNode(cur.x, y, null, null);
      cur = { x: cur.x, y };
    } else if (C === 'C') {
      let x1 = next(), y1 = next();
      let x2 = next(), y2 = next();
      let x = next(), y = next();
      if (isRel) {
        x1 += cur.x; y1 += cur.y;
        x2 += cur.x; y2 += cur.y;
        x += cur.x; y += cur.y;
      }
      pushNode(x, y, { x: x2, y: y2 }, { x: x1, y: y1 });
      cur = { x, y };
    } else if (C === 'Z') {
      if (nodes && nodes.length) subpaths.push(nodes);
      nodes = null;
    } else {
      throw new Error('Unsupported SVG path command: ' + cmd);
    }
  }
  if (nodes && nodes.length) subpaths.push(nodes);

  return subpaths.map((ns) => {
    const v = ns.map((n) => [round4(n.x), round4(n.y)]);
    const o = ns.map((n) => (n.out ? [round4(n.out.x - n.x), round4(n.out.y - n.y)] : [0, 0]));
    const inT = ns.map((n) => (n.in ? [round4(n.in.x - n.x), round4(n.in.y - n.y)] : [0, 0]));
    return { v, i: inT, o, c: true };
  });
}

function bboxOfSubpaths(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sp of subpaths) {
    for (const [x, y] of sp.v) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function transformSubpaths(subpaths, { scale = 1, dx = 0, dy = 0 } = {}) {
  return subpaths.map((sp) => ({
    v: sp.v.map(([x, y]) => [round4(x * scale + dx), round4(y * scale + dy)]),
    i: sp.i.map(([x, y]) => [round4(x * scale), round4(y * scale)]),
    o: sp.o.map(([x, y]) => [round4(x * scale), round4(y * scale)]),
    c: sp.c,
  }));
}

// Читает <path d="..."> из svg-файла в порядке появления, с "nm" из соседних атрибутов не парсим — просто список d.
function extractPathsFromSvg(svgContent) {
  const re = /<path[^>]*\sd="([^"]+)"[^>]*\/?>/g;
  const out = [];
  let m;
  while ((m = re.exec(svgContent))) {
    out.push(m[1].replace(/&quot;/g, '"'));
  }
  return out;
}

function readSvgViewBox(svgContent) {
  const m = svgContent.match(/viewBox="([\d.\s-]+)"/);
  if (!m) return null;
  const [minX, minY, w, h] = m[1].trim().split(/\s+/).map(Number);
  return { minX, minY, w, h };
}

// ---------- Lottie shape items ----------
function pathShapeItem(subpath, nm = 'Path') {
  return {
    ty: 'sh',
    ks: { a: 0, k: { i: subpath.i, o: subpath.o, v: subpath.v, c: subpath.c } },
    nm,
    ix: 1,
  };
}

function ellipseItem({ p = [0, 0], s = [50, 50] } = {}, nm = 'Ellipse') {
  return { ty: 'el', p: { a: 0, k: p }, s: { a: 0, k: s }, nm, d: 1 };
}

function rectItem({ p = [0, 0], s = [50, 50], r = 0 } = {}, nm = 'Rect') {
  return { ty: 'rc', p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: r }, nm, d: 1 };
}

/* Звезда/многоугольник (sy: 1 = звезда, 2 = многоугольник).

   Telegram НЕ поддерживает в .tgs параметрический Star Shape (ty:"sr") —
   такой файл бот @Stickers отклоняет целиком. Поэтому звезда считается
   здесь по вершинам и отдаётся обычным контуром (ty:"sh"), который
   поддерживается везде. Сигнатура осталась прежней, так что все места
   вызова не меняются.

   os/is — скругление внешних и внутренних углов в процентах: тангенсы
   направляются по касательной к окружности вершины. */
function starItem({ p = [0, 0], pt = 5, or_ = 50, ir = 25, os = 0, is = 0, rot = 0, sy = 1 } = {}, nm = 'Star') {
  const total = sy === 2 ? pt : pt * 2;
  const v = [];
  const inT = [];
  const outT = [];
  for (let i = 0; i < total; i++) {
    const outer = sy === 2 || i % 2 === 0;
    const r = outer ? or_ : ir;
    const round = (outer ? os : is) / 100;
    const ang = ((rot + (i * 360) / total) * Math.PI) / 180;
    const cx = Math.cos(ang) * r;
    const cy = Math.sin(ang) * r;
    v.push([round4(p[0] + cx), round4(p[1] + cy)]);
    // касательная к окружности в этой вершине
    const tx = -Math.sin(ang);
    const ty = Math.cos(ang);
    const len = round ? r * round * (Math.PI / total) : 0;
    inT.push([round4(-tx * len), round4(-ty * len)]);
    outT.push([round4(tx * len), round4(ty * len)]);
  }
  return { ty: 'sh', ks: { a: 0, k: { i: inT, o: outT, v, c: true } }, nm, ix: 1 };
}

/* rule: 1 — nonzero (по умолчанию), 2 — even-odd. Чётно-нечётное
   правило нужно, когда фигура собрана из внешнего и внутреннего
   контуров и середина должна остаться прозрачной (кольцо, ноль). */
function fillItem(hex, opacity = 100, rule = 1, nm = 'Fill') {
  return { ty: 'fl', c: { a: 0, k: hexToRgba(hex) }, o: isAnim(opacity) ? opacity : { a: 0, k: opacity }, r: rule, nm };
}

function strokeItem(hex, width, opacity = 100, nm = 'Stroke') {
  return {
    ty: 'st',
    c: { a: 0, k: hexToRgba(hex) },
    o: { a: 0, k: opacity },
    w: { a: 0, k: width },
    lc: 2,
    lj: 2,
    ml: 4,
    nm,
  };
}

function trimItem({ s = 0, e = 100, o = 0 } = {}, nm = 'Trim') {
  return {
    ty: 'tm',
    s: isAnim(s) ? s : { a: 0, k: s },
    e: isAnim(e) ? e : { a: 0, k: e },
    o: isAnim(o) ? o : { a: 0, k: o },
    m: 1,
    nm,
  };
}

function isAnim(v) {
  return v && typeof v === 'object' && 'a' in v;
}

function transformItem({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return {
    ty: 'tr',
    p: isAnim(p) ? p : { a: 0, k: p },
    a: isAnim(a) ? a : { a: 0, k: a },
    s: isAnim(s) ? s : { a: 0, k: s },
    r: isAnim(r) ? r : { a: 0, k: r },
    o: isAnim(o) ? o : { a: 0, k: o },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
    nm: 'Transform',
  };
}

function groupItem(nm, items, transform) {
  const it = [...items, transformItem(transform)];
  return { ty: 'gr', it, nm, np: it.length, cix: 2, bm: 0, ix: 1, mn: 'ADBE Vector Group' };
}

// ---------- keyframes ----------
function dimOf(v) {
  return Array.isArray(v) ? v.length : 1;
}
function asArr(v) {
  return Array.isArray(v) ? v : [v];
}
function easeOut() {
  return { x: [0.42], y: [0] };
}
function easeIn() {
  return { x: [0.58], y: [1] };
}

/* Easing пишется одним значением, как это делает Bodymovin.

   ВАЖНО про rlottie (движок Telegram, он строже lottie-web):
   • вырожденные ручки (x = 0 или x = 1) он не переваривает — свойство
     застревает на стартовом значении, а поскольку почти все входы
     стартуют с нулевого масштаба, стикер выходит полностью пустым;
     поэтому строго линейная кривая задаётся как cubic-bezier
     (1/3, 1/3, 2/3, 2/3) — математически то же самое, но валидно;
   • у ПОСЛЕДНЕГО ключа не должно быть i/o вообще — он терминатор
     (только t и s). С easing на нём rlottie ломает всё свойство. */
function linearOut() {
  return { x: [0.333], y: [0.333] };
}
function linearIn() {
  return { x: [0.667], y: [0.667] };
}

/* list: [{t, v, hold?, linear?}] -> массив ключей Lottie.
   linear:true нужен для «запечённых» кривых из motion.js — форма
   движения уже задана плотными сэмплами, и лишний ease между ними
   только размазал бы пружину. */
function keyframes(list) {
  const last = list.length - 1;
  return list.map((kfr, idx) => {
    const val = asArr(kfr.v);
    // последний ключ — терминатор: только время и значение
    if (idx === last) return { t: kfr.t, s: val };
    if (kfr.hold) return { t: kfr.t, s: val, h: 1 };
    const obj = kfr.linear
      ? { t: kfr.t, s: val, o: linearOut(), i: linearIn() }
      : { t: kfr.t, s: val, o: easeOut(), i: easeIn() };
    obj.e = asArr(list[idx + 1].v);
    return obj;
  });
}

function staticProp(v) {
  return { a: 0, k: v };
}
/* Свойство с единственным ключом lottie-web разбирает некорректно
   (у последнего ключа нет пары для интерполяции — трансформация
   слоя уходит в NaN и он просто не рисуется). Поэтому такой список
   схлопываем в статическое значение. */
function animProp(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('animProp: пустой список ключей');
  if (list.length === 1) return staticProp(list[0].v);
  return { a: 1, k: keyframes(list) };
}

// ---------- layer / animation ----------
let __ind = 1;
function resetLayerIndex() {
  __ind = 1;
}
/* parent — индекс родительского слоя. Ребёнок наследует трансформацию
   родителя и добавляет свою поверх: так делается вторичное движение
   (кисточка на шапочке, блик на грани), когда деталь должна ехать
   вместе с объектом, но жить с собственной задержкой. */
function shapeLayer(nm, shapes, { ks = {}, ip = 0, op = 180, st = 0, parent } = {}) {
  const ind = __ind++;
  const layer = {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: ks.o || staticProp(100),
      r: ks.r || staticProp(0),
      p: ks.p || staticProp([0, 0]),
      a: ks.a || staticProp([0, 0]),
      s: ks.s || staticProp([100, 100]),
    },
    ao: 0,
    shapes,
    ip,
    op,
    st,
    bm: 0,
  };
  if (parent != null) layer.parent = parent;
  return layer;
}

/* Индекс, который получит следующий созданный слой — нужен, чтобы
   назначить родителя ещё до его создания. */
function nextLayerIndex() {
  return __ind;
}

function animation({ w, h, fr = 60, op = 180, nm, layers }) {
  return {
    v: '5.9.0',
    fr,
    ip: 0,
    op,
    w,
    h,
    nm,
    ddd: 0,
    assets: [],
    layers, // layers[0] — самый верхний (передний) слой, как в панели AE
    markers: [],
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  ✓ ${path.relative(process.cwd(), file)}  (${kb} KB)`);
}

module.exports = {
  BRAND,
  round4,
  nextLayerIndex,
  hexToRgba,
  parseSvgPath,
  bboxOfSubpaths,
  transformSubpaths,
  extractPathsFromSvg,
  readSvgViewBox,
  pathShapeItem,
  ellipseItem,
  rectItem,
  starItem,
  fillItem,
  strokeItem,
  trimItem,
  transformItem,
  groupItem,
  staticProp,
  animProp,
  keyframes,
  shapeLayer,
  animation,
  writeJson,
  resetLayerIndex,
};
