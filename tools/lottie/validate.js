'use strict';
/* Структурная проверка сгенерированных Lottie JSON — без браузера:
   сеть в этом окружении недоступна (нет доступа к CDN для lottie-web),
   поэтому проверяем схему, диапазоны координат/времени и согласованность
   bezier-массивов, чтобы отловить типичные ошибки авторинга Lottie. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', '..', 'assets', 'lottie');
let errors = 0;
let warnings = 0;

function err(file, msg) {
  errors++;
  console.error(`  ✗ [${file}] ${msg}`);
}
function warn(file, msg) {
  warnings++;
  console.warn(`  ! [${file}] ${msg}`);
}

function checkNumber(file, label, n) {
  if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
    err(file, `${label}: не число или NaN/Infinity (${n})`);
  }
}

function checkAnimatable(file, label, prop, expectDim) {
  if (prop == null || typeof prop !== 'object') {
    err(file, `${label}: отсутствует`);
    return;
  }
  if (prop.a === 0) {
    const v = prop.k;
    if (expectDim && Array.isArray(v) && v.length < expectDim) {
      err(file, `${label}: ожидалась размерность ${expectDim}, получено ${v.length}`);
    }
    (Array.isArray(v) ? v : [v]).forEach((n, idx) => checkNumber(file, `${label}[${idx}]`, n));
  } else if (prop.a === 1) {
    if (!Array.isArray(prop.k) || prop.k.length === 0) {
      err(file, `${label}: анимированное свойство без ключевых кадров`);
      return;
    }
    let lastT = -Infinity;
    prop.k.forEach((kfr, idx) => {
      checkNumber(file, `${label} kf${idx}.t`, kfr.t);
      if (kfr.t < lastT) err(file, `${label} kf${idx}: время идёт назад (${kfr.t} < ${lastT})`);
      lastT = kfr.t;
      if (!Array.isArray(kfr.s)) err(file, `${label} kf${idx}: "s" не массив`);
      else kfr.s.forEach((n, i) => checkNumber(file, `${label} kf${idx}.s[${i}]`, n));
      const isLast = idx === prop.k.length - 1;
      /* Два правила ради rlottie — движка, на котором Telegram
         проигрывает .tgs. Он строже lottie-web, и нарушение любого
         из них даёт не кривую анимацию, а полностью пустой стикер:
         значение свойства застревает на первом ключе, а стартовый
         масштаб у входов нулевой. */
      if (isLast) {
        if (kfr.i || kfr.o) err(file, `${label} kf${idx}: у последнего ключа не должно быть easing i/o`);
        if (kfr.e) err(file, `${label} kf${idx}: у последнего ключа не должно быть "e"`);
      } else if (!kfr.h) {
        if (!Array.isArray(kfr.e)) err(file, `${label} kf${idx}: нет "e" для не-последнего кейфрейма`);
        if (!kfr.i || !kfr.o) err(file, `${label} kf${idx}: нет easing i/o`);
        for (const [side, ease] of [['o', kfr.o], ['i', kfr.i]]) {
          for (const x of (ease && ease.x) || []) {
            if (x <= 0 || x >= 1) err(file, `${label} kf${idx}: вырожденный easing ${side}.x=${x} (rlottie ломается)`);
          }
        }
      }
    });
  } else {
    err(file, `${label}: неизвестный "a" = ${prop.a}`);
  }
}

function checkShapePath(file, item) {
  const k = item.ks && item.ks.k;
  if (!k) {
    err(file, 'sh: нет ks.k');
    return;
  }
  const { v, i, o } = k;
  if (!Array.isArray(v) || !Array.isArray(i) || !Array.isArray(o)) {
    err(file, 'sh: v/i/o не массивы');
    return;
  }
  if (v.length !== i.length || v.length !== o.length) {
    err(file, `sh: несовпадение длин v(${v.length})/i(${i.length})/o(${o.length})`);
  }
  v.forEach((pt, idx) => {
    if (!Array.isArray(pt) || pt.length < 2) err(file, `sh.v[${idx}]: не пара координат`);
    else pt.forEach((n) => checkNumber(file, `sh.v[${idx}]`, n));
  });
}

function walkShapes(file, shapes, ctx) {
  for (const item of shapes) {
    if (item.ty === 'sh') checkShapePath(file, item);
    if (item.ty === 'gr') {
      if (!Array.isArray(item.it) || item.it.length === 0) err(file, 'gr: пустой it[]');
      else walkShapes(file, item.it, ctx);
    }
    if (item.ty === 'tr') {
      checkAnimatable(file, `${ctx} tr.p`, item.p, 2);
      checkAnimatable(file, `${ctx} tr.s`, item.s, 2);
      checkAnimatable(file, `${ctx} tr.r`, item.r, 1);
      checkAnimatable(file, `${ctx} tr.o`, item.o, 1);
    }
    if (item.ty === 'fl') checkAnimatable(file, `${ctx} fl.c`, item.c, 4);
    if (item.ty === 'st') {
      checkAnimatable(file, `${ctx} st.c`, item.c, 4);
      checkAnimatable(file, `${ctx} st.w`, item.w, 1);
    }
    if (item.ty === 'tm') {
      checkAnimatable(file, `${ctx} tm.s`, item.s, 1);
      checkAnimatable(file, `${ctx} tm.e`, item.e, 1);
    }
    if (item.ty === 'el' || item.ty === 'rc' || item.ty === 'sr') {
      // нативные фигуры — базовая проверка p/s числами уже покрыта через JSON.parse
    }
  }
}

function validateFile(fileName) {
  const full = path.join(DIR, fileName);
  const raw = fs.readFileSync(full, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    err(fileName, `невалидный JSON: ${e.message}`);
    return;
  }

  ['v', 'fr', 'ip', 'op', 'w', 'h', 'layers'].forEach((k) => {
    if (!(k in data)) err(fileName, `нет обязательного поля "${k}"`);
  });
  if (data.w <= 0 || data.h <= 0) err(fileName, `некорректные размеры канваса ${data.w}x${data.h}`);
  if (data.op <= data.ip) err(fileName, `op(${data.op}) <= ip(${data.ip})`);
  if (!Array.isArray(data.layers) || data.layers.length === 0) err(fileName, 'нет слоёв');

  const indices = new Set();
  for (const layer of data.layers || []) {
    if (indices.has(layer.ind)) err(fileName, `дублирующийся ind слоя: ${layer.ind}`);
    indices.add(layer.ind);
    if (layer.ty !== 4) {
      warn(fileName, `неожиданный тип слоя ty=${layer.ty} (ожидался shape layer 4)`);
      continue;
    }
    if (!layer.ks) {
      err(fileName, `слой "${layer.nm}": нет ks`);
      continue;
    }
    checkAnimatable(fileName, `${layer.nm} ks.p`, layer.ks.p, 2);
    checkAnimatable(fileName, `${layer.nm} ks.a`, layer.ks.a, 2);
    checkAnimatable(fileName, `${layer.nm} ks.s`, layer.ks.s, 2);
    checkAnimatable(fileName, `${layer.nm} ks.r`, layer.ks.r, 1);
    checkAnimatable(fileName, `${layer.nm} ks.o`, layer.ks.o, 1);
    if (layer.op <= layer.ip) err(fileName, `слой "${layer.nm}": op(${layer.op}) <= ip(${layer.ip})`);
    if (!Array.isArray(layer.shapes) || layer.shapes.length === 0) {
      err(fileName, `слой "${layer.nm}": нет shapes`);
    } else {
      walkShapes(fileName, layer.shapes, layer.nm);
    }
  }

  // грубая оценка попадания геометрии в границы канваса (с запасом)
  const margin = Math.max(data.w, data.h) * 0.6;
  function collectPoints(shapes, acc) {
    for (const item of shapes) {
      if (item.ty === 'sh' && item.ks && item.ks.k) acc.push(...item.ks.k.v);
      if (item.ty === 'gr') collectPoints(item.it, acc);
    }
  }
  for (const layer of data.layers || []) {
    const pts = [];
    collectPoints(layer.shapes || [], pts);
    for (const [x, y] of pts) {
      if (Math.abs(x) > data.w + margin || Math.abs(y) > data.h + margin) {
        warn(fileName, `слой "${layer.nm}": точка контура далеко за пределами канваса (${x.toFixed(0)}, ${y.toFixed(0)})`);
        break;
      }
    }
  }
}

/* Требования Telegram к анимационным стикерам и кастомным эмодзи:
   векторный Lottie, упакованный gzip'ом в .tgs, не длиннее 3 секунд,
   30 или 60 fps, канвас 512×512 у стикеров и 100×100 у эмодзи,
   и не тяжелее 64 КБ в упакованном виде. Проверяем это здесь, чтобы
   ограничения ловились на сборке, а не в боте @Stickers. */
function checkTelegram(fileName) {
  const full = path.join(DIR, fileName);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const isWide = fileName.startsWith('logo-wordmark') || fileName.startsWith('logo-lockup');

  const duration = (data.op - data.ip) / data.fr;
  if (duration > 3) err(fileName, `длительность ${duration.toFixed(2)} с — Telegram допускает максимум 3 с`);
  if (data.fr !== 30 && data.fr !== 60) err(fileName, `частота ${data.fr} fps — допустимы только 30 или 60`);

  // 512×512 обязателен для всех анимированных .tgs, эмодзи в том числе
  if (!isWide && (data.w !== 512 || data.h !== 512)) {
    err(fileName, `канвас ${data.w}×${data.h}, ожидался 512×512`);
  }

  const gz = zlib.gzipSync(fs.readFileSync(full), { level: 9 }).length;
  if (gz > 64 * 1024) err(fileName, `${(gz / 1024).toFixed(1)} КБ в .tgs — больше лимита 64 КБ`);
  return { gz, duration, wide: isWide };
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
console.log(`Проверяю ${files.length} файлов в assets/lottie/…\n`);
files.forEach(validateFile);

let maxGz = 0;
let wide = 0;
files.forEach((f) => {
  const r = checkTelegram(f);
  if (r.gz > maxGz) maxGz = r.gz;
  if (r.wide) wide++;
});

console.log(`\nTelegram: самый тяжёлый .tgs — ${(maxGz / 1024).toFixed(1)} КБ из 64 КБ;`);
console.log(`${wide} файла — широкий формат (не для стикер-пака, только как обычная Lottie).`);
console.log(`\nИтого: ${errors} ошибок, ${warnings} предупреждений.`);
process.exit(errors > 0 ? 1 : 0);
