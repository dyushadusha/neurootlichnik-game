'use strict';
/* =========================================================
   СБОРКА .TGS ДЛЯ TELEGRAM
   =========================================================
   .tgs — это НЕ просто «gzip от Lottie». Telegram опознаёт формат
   по маркеру `"tgs": 1` в корне документа (его ставит плагин
   Bodymovin-TG) и отклоняет файл целиком, если внутри встречаются
   неподдерживаемые возможности. Полный список запрещённого:
   Merge Paths, Star Shapes, Gradient Strokes, Repeaters, Time
   Stretching / Remapping, Expressions, Images, Texts, Layer Effects,
   Masks, Mattes, Auto-Oriented Layers.

   Скрипт проверяет каждый файл по этому списку и по лимитам
   (до 3 секунд, 30/60 fps, канвас ровно 512×512 — в том числе
   у кастомных эмодзи, до 64 КБ в упакованном виде) и только
   потом пакует.

     node tools/lottie/make-tgs.js [папка-назначения]
   ========================================================= */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', '..', 'assets', 'lottie');
const DEST = process.argv[2] || path.join(__dirname, '..', '..', 'dist', 'tgs');

// то, что Telegram не переваривает: тип шейпа → человеческое имя
const FORBIDDEN_SHAPES = {
  sr: 'Star Shape',
  mm: 'Merge Paths',
  rp: 'Repeater',
  gs: 'Gradient Stroke',
  gf: 'Gradient Fill',
};

function findForbidden(data) {
  const problems = new Set();

  const walkShapes = (items) => {
    for (const it of items || []) {
      if (FORBIDDEN_SHAPES[it.ty]) problems.add(FORBIDDEN_SHAPES[it.ty]);
      if (it.ty === 'gr') walkShapes(it.it);
    }
  };

  for (const layer of data.layers || []) {
    if (layer.ty === 5) problems.add('Text layer');
    if (layer.ty === 2) problems.add('Image layer');
    if (layer.ty !== 4) problems.add(`Layer type ${layer.ty}`);
    if (layer.hasMask || (layer.masksProperties || []).length) problems.add('Mask');
    if (layer.tt != null || layer.td != null) problems.add('Matte');
    if ((layer.ef || []).length) problems.add('Layer effect');
    if (layer.ao) problems.add('Auto-orient');
    if (layer.sr != null && layer.sr !== 1) problems.add('Time stretching');
    if (layer.tm != null) problems.add('Time remapping');
    walkShapes(layer.shapes);
  }
  if ((data.assets || []).length) problems.add('Assets (images/precomps)');
  if ((data.chars || []).length || (data.fonts && (data.fonts.list || []).length)) problems.add('Fonts');
  return [...problems];
}

function convert(file) {
  const name = path.basename(file, '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const isEmoji = name.startsWith('emoji-');
  const square = data.w === data.h;

  const issues = findForbidden(data);
  const duration = (data.op - data.ip) / data.fr;
  if (duration > 3) issues.push(`длительность ${duration.toFixed(2)} с > 3 с`);
  if (data.fr !== 30 && data.fr !== 60) issues.push(`${data.fr} fps (нужно 30 или 60)`);
  // Telegram требует 512×512 для ЛЮБОЙ анимации .tgs, включая эмодзи
  if (!square || data.w !== 512) issues.push(`канвас ${data.w}×${data.h} (нужен 512×512)`);

  if (issues.length) return { name, skipped: true, issues };

  /* Маркер формата: по нему Telegram отличает .tgs от обычной Lottie.
     Без него @Stickers отвечает «такой формат файла не поддерживается». */
  const tgs = { tgs: 1, ...data };
  delete tgs.markers;

  const out = path.join(DEST, isEmoji ? 'emoji' : 'stickers', `${name}.tgs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(tgs), 'utf8'), { level: 9 });
  if (gz.length > 64 * 1024) return { name, skipped: true, issues: [`${(gz.length / 1024).toFixed(1)} КБ > 64 КБ`] };
  fs.writeFileSync(out, gz);
  return { name, size: gz.length, out };
}

// чистим папку назначения, иначе рядом с новыми останутся файлы
// прошлой сборки и в пак уедет устаревшая версия
fs.rmSync(DEST, { recursive: true, force: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json'));
const done = [];
const skipped = [];
for (const f of files) {
  const r = convert(path.join(SRC, f));
  (r.skipped ? skipped : done).push(r);
}

console.log(`Упаковано в .tgs: ${done.length} из ${files.length}`);
console.log(`Самый тяжёлый: ${(Math.max(...done.map((d) => d.size)) / 1024).toFixed(1)} КБ из 64 КБ`);
if (skipped.length) {
  console.log('\nНе для стикер-пака:');
  for (const s of skipped) console.log(`  · ${s.name} — ${s.issues.join('; ')}`);
}
console.log(`\nГотово: ${path.relative(process.cwd(), DEST)}`);
