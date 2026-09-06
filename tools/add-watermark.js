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
const { addWatermark, DEFAULTS } = require('./lib/watermark');

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 1 || !args.logo || !args.out) {
    console.log(
      'Использование: node tools/add-watermark.js <image> --logo <logo> --out <result> ' +
      `[--percent ${DEFAULTS.percent}] [--margin ${DEFAULTS.margin}] [--opacity ${DEFAULTS.opacity}]`
    );
    process.exit(args.help ? 0 : 1);
  }

  const imagePath = path.resolve(args._[0]);
  const logoPath = path.resolve(args.logo);
  const outPath = path.resolve(args.out);

  const result = await addWatermark(imagePath, logoPath, {
    percent: args.percent,
    margin: args.margin,
    opacity: args.opacity,
  });

  const fs = require('fs');
  fs.writeFileSync(outPath, result.buffer);

  if (result.overflowsBottom) {
    console.warn('⚠ Логотип с текущим --percent/--margin выходит за нижнюю границу изображения.');
  }

  console.log(`Готово: ${outPath}`);
  console.log(`  Изображение: ${result.baseWidth}x${result.baseHeight}`);
  console.log(`  Логотип: ${result.logoWidth}x${result.logoHeight}, позиция ${result.left},${result.top}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
