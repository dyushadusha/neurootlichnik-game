#!/usr/bin/env node
/*
 * Telegram-бот: автоматически ставит логотип «Нейро Отличник» на любую
 * присланную картинку. Логотип всегда занимает заданный процент от ширины
 * изображения и располагается в верхнем правом углу (см. tools/lib/watermark.js).
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN=xxxxx node tools/watermark-bot.js
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN   токен бота от @BotFather, обязателен
 *   LOGO_PATH            путь к файлу логотипа, по умолчанию assets/logo-full.svg
 *   WATERMARK_PERCENT    ширина логотипа в % от ширины картинки, по умолчанию 15
 *   WATERMARK_MARGIN     отступ от краёв в % от ширины картинки, по умолчанию 4
 *   WATERMARK_OPACITY    непрозрачность логотипа 0-1, по умолчанию 1
 *
 * Пользователь присылает боту фото или изображение файлом — бот отвечает
 * тем же изображением с наложенным логотипом (файлом, чтобы не терять
 * качество из-за сжатия Telegram).
 */

const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { addWatermark, DEFAULTS } = require('./lib/watermark');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('Не задан TELEGRAM_BOT_TOKEN. Получите токен у @BotFather и передайте его через переменную окружения.');
  process.exit(1);
}

const LOGO_PATH = path.resolve(process.env.LOGO_PATH || path.join(__dirname, '..', 'assets', 'logo-full.svg'));
const WATERMARK_OPTIONS = {
  percent: process.env.WATERMARK_PERCENT !== undefined ? Number(process.env.WATERMARK_PERCENT) : DEFAULTS.percent,
  margin: process.env.WATERMARK_MARGIN !== undefined ? Number(process.env.WATERMARK_MARGIN) : DEFAULTS.margin,
  opacity: process.env.WATERMARK_OPACITY !== undefined ? Number(process.env.WATERMARK_OPACITY) : DEFAULTS.opacity,
};

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('Бот запущен. Логотип:', LOGO_PATH);
console.log('Параметры водяного знака:', WATERMARK_OPTIONS);

async function downloadFileBuffer(fileId) {
  const chunks = [];
  const stream = bot.getFileStream(fileId);
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleIncomingImage(msg, fileId, originalFileName) {
  const chatId = msg.chat.id;
  try {
    await bot.sendChatAction(chatId, 'upload_photo');

    const imageBuffer = await downloadFileBuffer(fileId);
    const result = await addWatermark(imageBuffer, LOGO_PATH, WATERMARK_OPTIONS);

    const outName = originalFileName
      ? originalFileName.replace(/\.[^.]+$/, '') + '-watermark.png'
      : 'watermark.png';

    await bot.sendDocument(
      chatId,
      result.buffer,
      {},
      { filename: outName, contentType: 'image/png' }
    );

    if (result.overflowsBottom) {
      await bot.sendMessage(chatId, '⚠ При текущих настройках логотип выходит за нижний край изображения.');
    }
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, 'Не получилось наложить логотип на это изображение. Попробуйте другой файл.');
  }
}

bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Пришлите картинку — верну её с логотипом в верхнем правом углу.\n\n' +
    `Логотип занимает ${WATERMARK_OPTIONS.percent}% ширины изображения, отступ от краёв — ${WATERMARK_OPTIONS.margin}%.`
  );
});

bot.on('photo', (msg) => {
  const sizes = msg.photo;
  const largest = sizes[sizes.length - 1];
  handleIncomingImage(msg, largest.file_id);
});

bot.on('document', (msg) => {
  const doc = msg.document;
  if (!doc.mime_type || !doc.mime_type.startsWith('image/')) return;
  handleIncomingImage(msg, doc.file_id, doc.file_name);
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});
