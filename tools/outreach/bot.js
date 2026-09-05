#!/usr/bin/env node
'use strict';
/*
 * Telegram-бот — «кнопка с телефона» поверх всего пайплайна рассылки.
 * Работает через long polling (не нужен ни публичный HTTPS, ни вебхук —
 * годится любой всегда включённый компьютер/VPS с доступом в интернет).
 *
 * Меню:
 *   📊 Статус          — сколько лидов/черновиков/отправлено (без сети)
 *   🔎 Найти лиды       — discover-2gis.js + discover-yandex.js (те ключи, что заданы)
 *   📧 Найти email      — enrich-emails.js (лимит из BOT_ENRICH_LIMIT)
 *   📝 Собрать черновики — generate-drafts.js
 *   ✉️ Отправить        — сначала показывает, сколько писем и кому уйдёт,
 *                         реальная отправка — только после явного подтверждения
 *
 * Доступ только для Telegram ID из TELEGRAM_ALLOWED_USER_IDS (см. .env.example) —
 * это единственная защита от того, что кто-то посторонний начнёт слать письма
 * от имени студии, относитесь к токену бота как к паролю.
 *
 * Запуск (на постоянно включённой машине/VPS):
 *   node tools/outreach/bot.js
 *   # или через pm2 / systemd, см. README.md
 */

const path = require('path');
const { loadEnv } = require('./lib/env');
const { TelegramClient, inlineKeyboard, splitForTelegram } = require('./lib/telegram');
const { runScript } = require('./lib/run-script');
const { buildReport } = require('./lib/status');

loadEnv();

const DATA_DIR = path.join(__dirname, 'data');

const BOT_SEND_LIMIT = Number(process.env.BOT_SEND_LIMIT || 15);
const BOT_SEND_DELAY_MS = Number(process.env.BOT_SEND_DELAY_MS || 15000);
const BOT_DAILY_CAP = Number(process.env.BOT_DAILY_CAP || 40);
const BOT_ENRICH_LIMIT = Number(process.env.BOT_ENRICH_LIMIT || 40);
const BOT_DISCOVER_MAX_PAGES = process.env.BOT_DISCOVER_MAX_PAGES || '2';
const BUSINESS_HOURS_START = Number(process.env.BUSINESS_HOURS_START || 9);
const BUSINESS_HOURS_END = Number(process.env.BUSINESS_HOURS_END || 19);
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Europe/Moscow';

function getAllowedIds() {
  return new Set(
    (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isBusinessHoursNow() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: BUSINESS_TZ }).format(new Date())
  );
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

const MENU = inlineKeyboard([
  [{ text: '📡 Проверить сигналы', data: 'radar' }],
  [{ text: '📊 Статус', data: 'status' }],
  [
    { text: '🔎 Найти лиды', data: 'discover' },
    { text: '📧 Найти email', data: 'enrich' },
  ],
  [{ text: '📝 Собрать черновики', data: 'draft' }],
  [{ text: '✉️ Отправить', data: 'send_prepare' }],
]);

function menuMessage() {
  return 'Что делаем?';
}

// Единственная блокировка на все тяжёлые команды — чтобы два тапа подряд
// не запустили два прогона одновременно и не подрались за один и тот же CSV.
let busyWith = null;

async function withBusyGuard(bot, chatId, label, fn) {
  if (busyWith) {
    await bot.sendMessage(chatId, `⏳ Уже выполняется: ${busyWith}. Дождитесь окончания и попробуйте снова.`);
    return;
  }
  busyWith = label;
  try {
    await fn();
  } finally {
    busyWith = null;
  }
}

async function sendLong(bot, chatId, text, opts) {
  const chunks = splitForTelegram(text);
  for (let i = 0; i < chunks.length; i++) {
    await bot.sendMessage(chatId, chunks[i], i === chunks.length - 1 ? opts : undefined);
  }
}

function tailLines(text, n) {
  const lines = text.trim().split('\n');
  return lines.slice(-n).join('\n');
}

async function handleStatus(bot, chatId) {
  const { text } = buildReport(DATA_DIR);
  await sendLong(bot, chatId, text, { replyMarkup: MENU });
}

async function handleRadar(bot, chatId) {
  await bot.sendMessage(chatId, '⏳ Смотрю, кто в каналах ищет визуализацию…');
  // --notify не передаём: сигналы придут в этот же чат ответом ниже,
  // иначе они продублируются самим радаром.
  const res = await runScript('radar-telegram.js', []);
  if (!res.ok) {
    await sendLong(bot, chatId, `Радар не отработал:\n${tailLines(res.stderr || res.stdout, 12)}`, { replyMarkup: MENU });
    return;
  }
  await sendLong(bot, chatId, res.stdout.trim() || 'Пусто — новых сигналов нет.', { replyMarkup: MENU });
}

async function handleDiscover(bot, chatId) {
  await bot.sendMessage(chatId, '⏳ Ищу компании через 2GIS/Yandex — это может занять несколько минут…');
  const reports = [];

  if (process.env.TWOGIS_API_KEY) {
    const res = await runScript('discover-2gis.js', ['--max-pages', BOT_DISCOVER_MAX_PAGES]);
    reports.push(`— 2GIS —\n${res.ok ? tailLines(res.stdout, 6) : `ошибка: ${tailLines(res.stderr || res.stdout, 6)}`}`);
  } else {
    reports.push('— 2GIS — пропущено (нет TWOGIS_API_KEY)');
  }

  if (process.env.YANDEX_MAPS_API_KEY) {
    const res = await runScript('discover-yandex.js', ['--max-pages', BOT_DISCOVER_MAX_PAGES]);
    reports.push(`— Yandex —\n${res.ok ? tailLines(res.stdout, 6) : `ошибка: ${tailLines(res.stderr || res.stdout, 6)}`}`);
  } else {
    reports.push('— Yandex — пропущено (нет YANDEX_MAPS_API_KEY)');
  }

  await sendLong(bot, chatId, reports.join('\n\n'), { replyMarkup: MENU });
}

async function handleEnrich(bot, chatId) {
  await bot.sendMessage(chatId, `⏳ Ищу email на сайтах (до ${BOT_ENRICH_LIMIT} компаний за раз) — не быстро, так и задумано…`);
  const res = await runScript('enrich-emails.js', ['--limit', String(BOT_ENRICH_LIMIT)]);
  const text = res.ok ? tailLines(res.stdout, 8) : `Ошибка: ${tailLines(res.stderr || res.stdout, 12)}`;
  await sendLong(bot, chatId, text, { replyMarkup: MENU });
}

async function handleDraft(bot, chatId) {
  await bot.sendMessage(chatId, '⏳ Собираю черновики писем…');
  const res = await runScript('generate-drafts.js', []);
  const text = res.ok ? tailLines(res.stdout, 10) : `Ошибка: ${tailLines(res.stderr || res.stdout, 12)}`;
  await sendLong(bot, chatId, text, { replyMarkup: MENU });
}

function parseDryRunCount(stdout) {
  const matches = stdout.match(/^\[DRY-RUN\] → (.+?)\s{2}\((.+?)\)/gm) || [];
  return matches.length;
}

async function handleSendPrepare(bot, chatId) {
  const res = await runScript('send-emails.js', ['--dry-run', '--limit', String(BOT_SEND_LIMIT)]);
  const count = parseDryRunCount(res.stdout);

  if (!count) {
    await bot.sendMessage(
      chatId,
      'Отправлять пока нечего: нет готовых черновиков без отправки/отписки. Сначала «📝 Собрать черновики».',
      { replyMarkup: MENU }
    );
    return;
  }

  const warn = isBusinessHoursNow()
    ? ''
    : `\n⚠️ Сейчас нерабочее время по ${BUSINESS_TZ} — письма вне 9:00–19:00 выглядят менее естественно для получателя. Можно отправить и сейчас, но лучше — в рабочие часы.\n`;

  await bot.sendMessage(
    chatId,
    `Готово к отправке: ${count} писем (лимит за раз: ${BOT_SEND_LIMIT}, пауза между письмами: ${Math.round(BOT_SEND_DELAY_MS / 1000)} с).${warn}\nПодтвердите отправку:`,
    {
      replyMarkup: inlineKeyboard([
        [{ text: `✅ Отправить ${count}`, data: `send_confirm:${count}` }],
        [{ text: '❌ Отмена', data: 'cancel' }],
      ]),
    }
  );
}

async function handleSendConfirm(bot, chatId, expectedCount) {
  await bot.sendMessage(chatId, `⏳ Отправляю (до ${BOT_SEND_LIMIT} писем, пауза ${Math.round(BOT_SEND_DELAY_MS / 1000)} с между письмами)…`);
  const res = await runScript(
    'send-emails.js',
    ['--send', '--limit', String(BOT_SEND_LIMIT), '--delay-ms', String(BOT_SEND_DELAY_MS), '--daily-cap', String(BOT_DAILY_CAP)],
    { timeoutMs: 25 * 60 * 1000 }
  );
  const text = res.ok ? res.stdout.trim() : `Отправка завершилась с ошибкой:\n${tailLines(res.stderr || res.stdout, 15)}`;
  await sendLong(bot, chatId, `📨 Отчёт об отправке\n\n${text}`, { replyMarkup: MENU });
}

async function routeCallback(bot, chatId, data) {
  if (data === 'status') return handleStatus(bot, chatId);
  if (data === 'radar') return withBusyGuard(bot, chatId, 'проверка сигналов', () => handleRadar(bot, chatId));
  if (data === 'discover') return withBusyGuard(bot, chatId, 'поиск лидов', () => handleDiscover(bot, chatId));
  if (data === 'enrich') return withBusyGuard(bot, chatId, 'поиск email', () => handleEnrich(bot, chatId));
  if (data === 'draft') return withBusyGuard(bot, chatId, 'сборка черновиков', () => handleDraft(bot, chatId));
  if (data === 'send_prepare') return withBusyGuard(bot, chatId, 'подготовка отправки', () => handleSendPrepare(bot, chatId));
  if (data === 'cancel') return bot.sendMessage(chatId, 'Отменено.', { replyMarkup: MENU });
  if (data.startsWith('send_confirm:')) {
    const n = Number(data.split(':')[1] || 0);
    return withBusyGuard(bot, chatId, 'отправка писем', () => handleSendConfirm(bot, chatId, n));
  }
  return bot.sendMessage(chatId, 'Не понял команду.', { replyMarkup: MENU });
}

async function pollLoop(bot, allowedIds) {
  let offset = 0;
  for (;;) {
    let updates;
    try {
      updates = await bot.getUpdates(offset, 30);
    } catch (err) {
      console.error('getUpdates error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;

      const msg = update.message;
      const cb = update.callback_query;
      const fromId = String((msg && msg.from && msg.from.id) || (cb && cb.from && cb.from.id) || '');
      const chatId = (msg && msg.chat.id) || (cb && cb.message && cb.message.chat.id);
      if (!chatId) continue;

      if (allowedIds.size && !allowedIds.has(fromId)) {
        console.error(`Отклонено сообщение от неразрешённого Telegram ID: ${fromId}`);
        continue;
      }

      try {
        if (cb) {
          await bot.answerCallbackQuery(cb.id, '');
          await routeCallback(bot, chatId, cb.data);
        } else if (msg && msg.text) {
          await bot.sendMessage(chatId, menuMessage(), { replyMarkup: MENU });
        }
      } catch (err) {
        console.error('Ошибка обработки апдейта:', err);
        try {
          await bot.sendMessage(chatId, `Что-то сломалось: ${err.message}`);
        } catch {
          /* даже сообщить об ошибке не вышло — просто едем дальше */
        }
      }
    }
  }
}

function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('Не задан TELEGRAM_BOT_TOKEN. Получите токен у @BotFather и добавьте в tools/outreach/.env');
    process.exit(1);
  }
  const allowedIds = getAllowedIds();
  if (!allowedIds.size) {
    console.error(
      'Не задан TELEGRAM_ALLOWED_USER_IDS — без него бот не ответит НИКОМУ (это защита по умолчанию). Узнайте свой Telegram ID (например, у @userinfobot) и добавьте в .env.'
    );
    process.exit(1);
  }

  const bot = new TelegramClient(token);
  console.log(`Бот запущен, разрешённые ID: ${Array.from(allowedIds).join(', ')}`);
  pollLoop(bot, allowedIds).catch((err) => {
    console.error('Бот упал:', err);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  routeCallback,
  parseDryRunCount,
  isBusinessHoursNow,
  getAllowedIds,
  MENU,
};
