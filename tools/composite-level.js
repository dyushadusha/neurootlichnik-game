#!/usr/bin/env node
/*
 * Собирает финальный imageB из отдельных, независимых друг от друга правок.
 *
 * Проблема, которую решает этот скрипт: если гонять 5 правок ПОДРЯД (каждая
 * поверх результата предыдущей), генеративная модель на каждом шаге слегка
 * пере-рендеривает всю картинку — за 5 проходов это даёт заметную деградацию
 * качества и накопление случайных отличий вне маски.
 *
 * Вместо этого каждая из 5 правок делается НЕЗАВИСИМО от одного и того же
 * чистого оригинала (imageA), и этот скрипт склеивает финальный результат
 * сам: берёт imageA как основу и для каждой пары (результат правки, маска
 * правки) вставляет в основу только те пиксели, что внутри маски. Так итог
 * гарантированно совпадает с оригиналом everywhere, кроме ровно 5 областей.
 *
 * Использование:
 *   node tools/composite-level.js <imageA> \
 *     --edit <editResult1> --mask <mask1> \
 *     --edit <editResult2> --mask <mask2> \
 *     ... (ровно 5 пар edit/mask) \
 *     --out <finalImageB.png>
 *
 * Опции:
 *   --min-area <n>   минимальная доля площади маски (0-1), ниже — считается
 *                     промахом ("объект не найден"), по умолчанию 0.0005
 *   --max-area <n>   максимальная доля площади маски (0-1), выше — считается
 *                     промахом ("маска слишком широкая"), по умолчанию 0.18
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function parseArgs(argv) {
  const args = { edits: [], masks: [], _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--edit') { args.edits.push(argv[++i]); continue; }
    if (a === '--mask') { args.masks.push(argv[++i]); continue; }
    if (a === '--out') { args.out = argv[++i]; continue; }
    if (a === '--min-area') { args.minArea = Number(argv[++i]); continue; }
    if (a === '--max-area') { args.maxArea = Number(argv[++i]); continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    args._.push(a);
  }
  return args;
}

async function loadRGBA(imgPath) {
  const { data, info } = await sharp(imgPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function loadMaskGray(imgPath, width, height) {
  const { data, info } = await sharp(imgPath)
    .resize(width, height, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) {
    throw new Error(`Маска ${imgPath} не привелась к размеру ${width}x${height}`);
  }
  return data; // 1 channel per pixel
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 1 || !args.out || args.edits.length === 0) {
    console.log(
      'Использование: node tools/composite-level.js <imageA> --edit <r1> --mask <m1> [--edit <r2> --mask <m2> ...] --out <finalB.png>'
    );
    process.exit(args.help ? 0 : 1);
  }
  if (args.edits.length !== args.masks.length) {
    console.error(`Число --edit (${args.edits.length}) и --mask (${args.masks.length}) не совпадает.`);
    process.exit(1);
  }

  const baseImagePath = path.resolve(args._[0]);
  const base = await loadRGBA(baseImagePath);
  const { width, height } = base;
  const composite = Buffer.from(base.data); // копия оригинала — стартовая точка

  const minAreaFrac = args.minArea !== undefined ? args.minArea : 0.0005;
  const maxAreaFrac = args.maxArea !== undefined ? args.maxArea : 0.18;
  const totalPixels = width * height;

  const report = [];

  for (let i = 0; i < args.edits.length; i++) {
    const editPath = path.resolve(args.edits[i]);
    const maskPath = path.resolve(args.masks[i]);

    const edit = await loadRGBA(editPath);
    if (edit.width !== width || edit.height !== height) {
      throw new Error(
        `Правка #${i + 1} (${editPath}) имеет размер ${edit.width}x${edit.height}, ` +
        `а оригинал ${width}x${height} — размеры должны совпадать.`
      );
    }
    const mask = await loadMaskGray(maskPath, width, height);

    let maskedPixels = 0;
    for (let p = 0; p < totalPixels; p++) {
      const alpha = mask[p] / 255; // 0..1, поддержка мягких краёв маски
      if (alpha <= 0) continue;
      maskedPixels++;
      const rgbaIdx = p * 4;
      for (let c = 0; c < 3; c++) {
        const baseVal = composite[rgbaIdx + c];
        const editVal = edit.data[rgbaIdx + c];
        composite[rgbaIdx + c] = Math.round(baseVal * (1 - alpha) + editVal * alpha);
      }
      // альфа-канал оригинала не трогаем (обычно 255 у непрозрачных рендеров)
    }

    const areaFrac = maskedPixels / totalPixels;
    const status = areaFrac < minAreaFrac
      ? 'СЛИШКОМ МАЛЕНЬКАЯ (объект не найден?)'
      : areaFrac > maxAreaFrac
        ? 'СЛИШКОМ БОЛЬШАЯ (промах маски?)'
        : 'OK';
    report.push({ index: i + 1, areaFrac, status, maskPath });
  }

  console.log('Проверка масок:');
  let hasProblem = false;
  for (const r of report) {
    const pct = (r.areaFrac * 100).toFixed(2);
    console.log(`  #${r.index}: ${pct}% площади — ${r.status}`);
    if (r.status !== 'OK') hasProblem = true;
  }

  const outPath = path.resolve(args.out);
  await sharp(composite, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outPath);

  console.log(`\nФинальная картинка сохранена: ${outPath}`);
  if (hasProblem) {
    console.log('\n⚠ Есть подозрительные маски (см. выше) — проверь эти правки глазами перед использованием уровня.');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
