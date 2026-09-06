#!/usr/bin/env node
/*
 * Автоматически накладывает логотип-водяной знак на изображение.
 *
 * Логотип всегда масштабируется так, чтобы его ширина занимала заданный
 * процент от ширины исходного изображения (пропорции логотипа сохраняются),
 * и всегда размещается в верхнем правом углу с отступом от краёв.
 *
 * Использование:
 *   node tools/add-watermark.js <image> --logo <logo.svg|png> --out <result.png>
 *
 * Опции:
 *   --logo <path>      путь к логотипу (svg/png/webp/...), обязателен
 *   --out <path>       путь для результата, обязателен
 *   --percent <n>      ширина логотипа в % от ширины картинки, по умолчанию 15
 *   --margin <n>       отступ от верхнего и правого края в % от ширины картинки,
 *                        по умолчанию 4
 *   --opacity <n>      непрозрачность логотипа 0-1, по умолчанию 1
 */

const path = require('path');
const sharp = require('sharp');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--logo') { args.logo = argv[++i]; continue; }
    if (a === '--out') { args.out = argv[++i]; continue; }
    if (a === '--percent') { args.percent = Number(argv[++i]); continue; }
    if (a === '--margin') { args.margin = Number(argv[++i]); continue; }
    if (a === '--opacity') { args.opacity = Number(argv[++i]); continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    args._.push(a);
  }
  return args;
}

async function applyOpacity(buffer, opacity) {
  if (opacity >= 1) return buffer;
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let p = 3; p < data.length; p += 4) {
    data[p] = Math.round(data[p] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 1 || !args.logo || !args.out) {
    console.log(
      'Использование: node tools/add-watermark.js <image> --logo <logo> --out <result> ' +
      '[--percent 15] [--margin 4] [--opacity 1]'
    );
    process.exit(args.help ? 0 : 1);
  }

  const imagePath = path.resolve(args._[0]);
  const logoPath = path.resolve(args.logo);
  const outPath = path.resolve(args.out);

  const percent = args.percent !== undefined ? args.percent : 15;
  const marginPercent = args.margin !== undefined ? args.margin : 4;
  const opacity = args.opacity !== undefined ? args.opacity : 1;

  if (percent <= 0 || percent > 100) {
    console.error('--percent должен быть в диапазоне (0, 100].');
    process.exit(1);
  }

  const base = sharp(imagePath);
  const baseMeta = await base.metadata();
  const { width: baseWidth, height: baseHeight } = baseMeta;
  if (!baseWidth || !baseHeight) {
    throw new Error(`Не удалось определить размер изображения: ${imagePath}`);
  }

  const targetLogoWidth = Math.max(1, Math.round((baseWidth * percent) / 100));
  const margin = Math.round((baseWidth * marginPercent) / 100);

  let logoBuffer = await sharp(logoPath)
    .resize({ width: targetLogoWidth })
    .png()
    .toBuffer();

  logoBuffer = await applyOpacity(logoBuffer, opacity);

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoWidth = logoMeta.width;
  const logoHeight = logoMeta.height;

  const left = Math.max(0, baseWidth - logoWidth - margin);
  const top = margin;

  if (top + logoHeight > baseHeight) {
    console.warn('⚠ Логотип с текущим --percent/--margin выходит за нижнюю границу изображения.');
  }

  await base
    .composite([{ input: logoBuffer, left, top }])
    .toFile(outPath);

  console.log(`Готово: ${outPath}`);
  console.log(`  Изображение: ${baseWidth}x${baseHeight}`);
  console.log(`  Логотип: ${logoWidth}x${logoHeight} (${percent}% ширины, позиция ${left},${top})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
