#!/usr/bin/env node
/*
 * Генератор уровней для игры «Найди 5 отличий».
 *
 * Берёт два рендера одинакового размера (оригинал и версию с внесёнными
 * отличиями), находит зоны, которые реально отличаются, группирует их в
 * кластеры, отбирает 5 самых заметных и печатает готовый объект уровня в
 * формате src/levels.js (см. GAME_OVERVIEW.md, раздел 4 и 6).
 *
 * Использование:
 *   node tools/generate-level.js <imageA> <imageB> [опции]
 *
 * Опции:
 *   --id <n>          id уровня в выводе (по умолчанию: следующий свободный
 *                      в src/levels.js)
 *   --threshold <n>   чувствительность сравнения пикселей, 0-255 (по
 *                      умолчанию 40; меньше — чувствительнее)
 *   --min-area <n>    минимальный размер кластера в пикселях, чтобы не
 *                      считался шумом (по умолчанию ~0.006% площади картинки)
 *   --dilate <n>      на сколько пикселей "склеивать" близкие фрагменты
 *                      одного отличия перед кластеризацией (по умолчанию
 *                      подбирается по размеру картинки)
 *   --debug <path>    сохранить PNG с подсветкой найденных отличий и
 *                      кружками попадания — для визуальной проверки
 *   --write           не просто напечатать код уровня, а сразу:
 *                        1) скопировать картинки в assets/level-N-a/b.<ext>
 *                        2) дописать уровень в src/levels.js
 *   --help            показать эту справку
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..');
const LEVELS_PATH = path.join(REPO_ROOT, 'src', 'levels.js');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets');

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('\n')
    .filter((l) => l.startsWith(' *') && l !== ' */')
    .map((l) => l.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help.trim());
  process.exit(code);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        args[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          args[a.slice(2)] = next;
          i++;
        } else {
          args[a.slice(2)] = true;
        }
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- Работа с src/levels.js ----------

function loadLevelsFile() {
  const content = fs.readFileSync(LEVELS_PATH, 'utf8');
  const markerIdx = content.indexOf('const LEVELS');
  const header = markerIdx === -1 ? '' : content.slice(0, markerIdx);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(content + '\nthis.__LEVELS__ = LEVELS;', sandbox, { filename: LEVELS_PATH });
  return { header, levels: sandbox.__LEVELS__ || [] };
}

function nextLevelId(levels) {
  return levels.reduce((max, l) => Math.max(max, l.id), 0) + 1;
}

function serializeLevels(levels) {
  const items = levels.map((lvl) => {
    const diffs = lvl.differences
      .map((d) => `      { x: ${d.x}, y: ${d.y}, r: ${d.r} }`)
      .join(',\n');
    return (
      `  {\n` +
      `    id: ${lvl.id},\n` +
      `    imageA: '${lvl.imageA}',\n` +
      `    imageB: '${lvl.imageB}',\n` +
      `    differences: [\n${diffs}\n    ]\n` +
      `  }`
    );
  });
  return `const LEVELS = [\n${items.join(',\n')}\n];\n`;
}

// ---------- Пиксельный дифф ----------

async function loadRGBA(imgPath) {
  const { data, info } = await sharp(imgPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function buildDiffMask(a, b, threshold) {
  const { width, height } = a;
  const mask = new Uint8Array(width * height);
  let diffCount = 0;
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const dr = Math.abs(a.data[p] - b.data[p]);
    const dg = Math.abs(a.data[p + 1] - b.data[p + 1]);
    const db = Math.abs(a.data[p + 2] - b.data[p + 2]);
    const diff = Math.max(dr, dg, db);
    if (diff > threshold) {
      mask[i] = 1;
      diffCount++;
    }
  }
  return { mask, diffCount };
}

// Прямоугольная дилатация через префиксные суммы: O(width*height)
// независимо от радиуса. Нужна, чтобы склеить соседние, но не строго
// смежные фрагменты одного и того же отличия (например, сглаженные края).
function boxDilate(mask, width, height, radius) {
  if (radius <= 0) return mask;

  const horiz = new Uint8Array(width * height);
  const rowPrefix = new Int32Array(width + 1);
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    rowPrefix[0] = 0;
    for (let x = 0; x < width; x++) {
      rowPrefix[x + 1] = rowPrefix[x] + mask[rowOff + x];
    }
    for (let x = 0; x < width; x++) {
      const lo = Math.max(0, x - radius);
      const hi = Math.min(width, x + radius + 1);
      horiz[rowOff + x] = rowPrefix[hi] - rowPrefix[lo] > 0 ? 1 : 0;
    }
  }

  const out = new Uint8Array(width * height);
  const colPrefix = new Int32Array(height + 1);
  for (let x = 0; x < width; x++) {
    colPrefix[0] = 0;
    for (let y = 0; y < height; y++) {
      colPrefix[y + 1] = colPrefix[y] + horiz[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(height, y + radius + 1);
      out[y * width + x] = colPrefix[hi] - colPrefix[lo] > 0 ? 1 : 0;
    }
  }
  return out;
}

// Размечает связные области (4-связность) в dilatedMask, затем считает
// статистику (центроид, bbox, площадь) только по пикселям исходной mask,
// попавшим в каждую область — дилатация используется лишь для склейки.
function clusterize(mask, dilatedMask, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let nextLabel = 0;
  const clusters = [];

  for (let start = 0; start < dilatedMask.length; start++) {
    if (dilatedMask[start] !== 1 || labels[start] !== -1) continue;

    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = start;
    labels[start] = nextLabel;

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % width;
      const y = (idx / width) | 0;

      if (x > 0 && dilatedMask[idx - 1] === 1 && labels[idx - 1] === -1) {
        labels[idx - 1] = nextLabel; queue[qTail++] = idx - 1;
      }
      if (x < width - 1 && dilatedMask[idx + 1] === 1 && labels[idx + 1] === -1) {
        labels[idx + 1] = nextLabel; queue[qTail++] = idx + 1;
      }
      if (y > 0 && dilatedMask[idx - width] === 1 && labels[idx - width] === -1) {
        labels[idx - width] = nextLabel; queue[qTail++] = idx - width;
      }
      if (y < height - 1 && dilatedMask[idx + width] === 1 && labels[idx + width] === -1) {
        labels[idx + width] = nextLabel; queue[qTail++] = idx + width;
      }
    }

    clusters.push({ area: 0, sumX: 0, sumY: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    nextLabel++;
  }

  for (let idx = 0; idx < mask.length; idx++) {
    if (mask[idx] !== 1) continue;
    const label = labels[idx];
    if (label === -1) continue; // не должно случаться, mask ⊆ dilatedMask
    const x = idx % width;
    const y = (idx / width) | 0;
    const c = clusters[label];
    c.area++;
    c.sumX += x;
    c.sumY += y;
    if (x < c.minX) c.minX = x;
    if (x > c.maxX) c.maxX = x;
    if (y < c.minY) c.minY = y;
    if (y > c.maxY) c.maxY = y;
  }

  return clusters.filter((c) => c.area > 0);
}

function clustersToDifferences(clusters, width, height) {
  return clusters.map((c) => {
    const cx = c.sumX / c.area;
    const cy = c.sumY / c.area;
    const rxPercent = ((c.maxX - c.minX) / 2 / width) * 100;
    const ryPercent = ((c.maxY - c.minY) / 2 / height) * 100;
    const rRaw = Math.hypot(rxPercent, ryPercent) * 1.15; // небольшой запас
    return {
      x: Math.round(clamp((cx / width) * 100, 0, 100) * 10) / 10,
      y: Math.round(clamp((cy / height) * 100, 0, 100) * 10) / 10,
      r: Math.round(clamp(rRaw, 4, 14) * 10) / 10,
      area: c.area
    };
  });
}

// ---------- Отладочная картинка ----------

async function writeDebugImage(imageBPath, mask, width, height, chosen, outPath) {
  const overlay = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    if (mask[i] === 1) {
      overlay[p] = 255; overlay[p + 1] = 0; overlay[p + 2] = 0; overlay[p + 3] = 90;
    }
  }

  const circles = chosen
    .map((d, i) => {
      const cx = (d.x / 100) * width;
      const cy = (d.y / 100) * height;
      const rr = (d.r / 100) * Math.min(width, height);
      return (
        `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#DBFC3B" stroke-width="4"/>` +
        `<text x="${cx}" y="${cy - rr - 8}" fill="#DBFC3B" font-size="28" text-anchor="middle" font-family="sans-serif">${i + 1}</text>`
      );
    })
    .join('');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${circles}</svg>`
  );

  await sharp(imageBPath)
    .ensureAlpha()
    .composite([
      { input: overlay, raw: { width, height, channels: 4 }, blend: 'over' },
      { input: svg, blend: 'over' }
    ])
    .png()
    .toFile(outPath);
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 2) printHelpAndExit(args.help ? 0 : 1);

  const [imageAArg, imageBArg] = args._;
  const imageAPath = path.resolve(imageAArg);
  const imageBPath = path.resolve(imageBArg);

  for (const p of [imageAPath, imageBPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Файл не найден: ${p}`);
      process.exit(1);
    }
  }

  const threshold = args.threshold !== undefined ? Number(args.threshold) : 40;

  const [a, b] = await Promise.all([loadRGBA(imageAPath), loadRGBA(imageBPath)]);

  if (a.width !== b.width || a.height !== b.height) {
    console.error(
      `Картинки разного размера: ${imageAArg} — ${a.width}x${a.height}, ` +
      `${imageBArg} — ${b.width}x${b.height}. По условиям игры это должен ` +
      `быть один и тот же рендер с точечными правками — приведите обе ` +
      `картинки к одному размеру.`
    );
    process.exit(1);
  }
  const { width, height } = a;

  const ratio = width / height;
  if (Math.abs(ratio - 4 / 3) > 0.02) {
    console.warn(
      `⚠ Соотношение сторон ${width}x${height} (${ratio.toFixed(3)}) не 4:3. ` +
      `Вёрстка игры сейчас рассчитана на 4:3 — либо откадрируйте картинки, ` +
      `либо предупредите отдельно, чтобы поправить game.js.`
    );
  }

  const { mask, diffCount } = buildDiffMask(a, b, threshold);
  if (diffCount === 0) {
    console.error('Отличий не найдено — картинки идентичны при заданном --threshold.');
    process.exit(1);
  }

  const dilateRadius = args.dilate !== undefined
    ? Number(args.dilate)
    : Math.max(3, Math.round(Math.min(width, height) * 0.008));
  const dilatedMask = boxDilate(mask, width, height, dilateRadius);

  const minArea = args['min-area'] !== undefined
    ? Number(args['min-area'])
    : Math.max(30, Math.round(width * height * 0.00006));

  let clusters = clusterize(mask, dilatedMask, width, height)
    .filter((c) => c.area >= minArea)
    .sort((x, y) => y.area - x.area);

  if (clusters.length < 5) {
    console.warn(
      `⚠ Найдено только ${clusters.length} отличий (нужно 5). Попробуйте ` +
      `уменьшить --threshold (сейчас ${threshold}) или --min-area (сейчас ${minArea}), ` +
      `либо картинки действительно отличаются меньше чем в 5 местах.`
    );
  }
  const dropped = clusters.length - Math.min(clusters.length, 5);
  const kept = clusters.slice(0, 5);
  if (dropped > 0) {
    console.warn(`⚠ Найдено ${clusters.length} отличий, оставлены 5 самых крупных, отброшено ${dropped}.`);
  }

  let differences = clustersToDifferences(kept, width, height);
  differences.sort((p, q) => (p.y - q.y) || (p.x - q.x));
  differences = differences.map(({ x, y, r }) => ({ x, y, r })); // убрать служебное area

  const { header, levels: existingLevels } = loadLevelsFile();
  const id = args.id !== undefined ? Number(args.id) : nextLevelId(existingLevels);

  let imageA = `assets/level-${id}-a${path.extname(imageAPath)}`;
  let imageB = `assets/level-${id}-b${path.extname(imageBPath)}`;

  if (args.debug) {
    await writeDebugImage(imageBPath, mask, width, height, differences, path.resolve(args.debug));
    console.log(`Отладочная картинка сохранена: ${args.debug}`);
  }

  const newLevel = { id, imageA, imageB, differences };
  const levelCode = serializeLevels([newLevel]).replace(/^const LEVELS = \[\n/, '').replace(/\n\];\n$/, '');

  if (args.write) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.copyFileSync(imageAPath, path.join(ASSETS_DIR, path.basename(imageA)));
    fs.copyFileSync(imageBPath, path.join(ASSETS_DIR, path.basename(imageB)));

    const updatedLevels = existingLevels.concat([newLevel]);
    fs.writeFileSync(LEVELS_PATH, header + serializeLevels(updatedLevels));

    console.log(`✔ Уровень ${id} добавлен в src/levels.js, картинки скопированы в assets/.`);
  } else {
    console.log(`\nГотовый уровень (id: ${id}) — вставьте объект в массив LEVELS в src/levels.js:\n`);
    console.log(levelCode + ',');
    console.log(`\n(картинки не скопированы — используйте --write, чтобы сделать это автоматически:\n  предполагаемые пути: ${imageA}, ${imageB})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
