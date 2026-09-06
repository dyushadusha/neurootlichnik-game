/*
 * Общая логика наложения логотипа-водяного знака на изображение.
 *
 * Логотип масштабируется так, чтобы его ширина занимала заданный процент
 * от ширины исходного изображения (пропорции логотипа сохраняются), и
 * всегда размещается в верхнем правом углу с отступом от краёв.
 *
 * Используется и в CLI-инструменте (tools/add-watermark.js), и в
 * Telegram-боте (tools/watermark-bot.js).
 */

const sharp = require('sharp');

const DEFAULTS = {
  percent: 15, // ширина логотипа в % от ширины изображения
  margin: 4, // отступ от верхнего и правого края в % от ширины изображения
  opacity: 1, // непрозрачность логотипа 0-1
};

async function applyOpacity(buffer, opacity) {
  if (opacity >= 1) return buffer;
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let p = 3; p < data.length; p += 4) {
    data[p] = Math.round(data[p] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * @param {string|Buffer} image  путь к изображению или буфер с ним
 * @param {string|Buffer} logo   путь к логотипу или буфер с ним
 * @param {object} [options]
 * @param {number} [options.percent]  ширина логотипа в % от ширины изображения
 * @param {number} [options.margin]   отступ от краёв в % от ширины изображения
 * @param {number} [options.opacity]  непрозрачность логотипа 0-1
 * @returns {Promise<Buffer>} PNG-буфер результата
 */
async function addWatermark(image, logo, options = {}) {
  const percent = options.percent !== undefined ? options.percent : DEFAULTS.percent;
  const marginPercent = options.margin !== undefined ? options.margin : DEFAULTS.margin;
  const opacity = options.opacity !== undefined ? options.opacity : DEFAULTS.opacity;

  if (percent <= 0 || percent > 100) {
    throw new Error('percent должен быть в диапазоне (0, 100].');
  }

  const base = sharp(image);
  const baseMeta = await base.metadata();
  const { width: baseWidth, height: baseHeight } = baseMeta;
  if (!baseWidth || !baseHeight) {
    throw new Error('Не удалось определить размер изображения.');
  }

  const targetLogoWidth = Math.max(1, Math.round((baseWidth * percent) / 100));
  const margin = Math.round((baseWidth * marginPercent) / 100);

  let logoBuffer = await sharp(logo)
    .resize({ width: targetLogoWidth })
    .png()
    .toBuffer();

  logoBuffer = await applyOpacity(logoBuffer, opacity);

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoWidth = logoMeta.width;
  const logoHeight = logoMeta.height;

  const left = Math.max(0, baseWidth - logoWidth - margin);
  const top = margin;

  const outBuffer = await base
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();

  return {
    buffer: outBuffer,
    baseWidth,
    baseHeight,
    logoWidth,
    logoHeight,
    left,
    top,
    overflowsBottom: top + logoHeight > baseHeight,
  };
}

module.exports = { addWatermark, DEFAULTS };
