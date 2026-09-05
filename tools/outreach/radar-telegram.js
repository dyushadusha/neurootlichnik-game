#!/usr/bin/env node
'use strict';
/*
 * Радар спроса в Telegram: обходит публичные каналы из radar.json, находит
 * посты, где человек ИЩЕТ визуализацию («ищу визуализатора», «нужен рендер
 * фасада к пятнице», «посоветуйте, кто делает подачу на конкурс»), и
 * присылает их вам в Telegram с готовым черновиком личного ответа.
 *
 * Чего этот скрипт НЕ делает — намеренно:
 *   - не собирает участников чатов;
 *   - не отправляет никому ни одного сообщения от вашего имени;
 *   - не заходит в аккаунт (ни номера, ни сессии — нечего банить).
 * Он только читает публичные посты и показывает их вам. Отвечаете вы сами,
 * руками — в этом весь смысл: человеку отвечает человек, и быстро.
 *
 * Использование:
 *   node tools/outreach/radar-telegram.js                 # показать найденное в консоли
 *   node tools/outreach/radar-telegram.js --notify        # + прислать в Telegram
 *   node tools/outreach/radar-telegram.js --all           # не только новые, но и уже виденные
 *
 * Опции:
 *   --config <path>   путь к radar.json (по умолчанию tools/outreach/radar.json)
 *   --notify          прислать найденные сигналы в Telegram (нужен TELEGRAM_BOT_TOKEN)
 *   --all             не фильтровать уже показанные ранее посты
 *   --max-age <часы>  игнорировать посты старше N часов (по умолчанию из конфига или 48)
 *   --help
 *
 * Запуск по расписанию (чтобы сигналы приходили сами) — см. README.md,
 * раздел «Радар спроса».
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const { parseArgs } = require('./lib/cli');
const { fetchChannelMessages, normalizeChannelName } = require('./lib/tg-web');
const { matchSignal } = require('./lib/signals');
const { buildSignalReply } = require('./lib/templates');
const { TelegramClient, splitForTelegram } = require('./lib/telegram');
const { readJson, ensureDataDir } = require('./lib/store');

loadEnv();

const DATA_DIR = path.join(__dirname, 'data');
const SEEN_PATH = path.join(DATA_DIR, 'radar_seen.json');
const SIGNALS_PATH = path.join(DATA_DIR, 'signals.jsonl');
const BRAND_PATH = path.join(__dirname, 'brand.json');

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('*/')[0];
  console.log(help.replace(/^#!.*\n/, '').replace(/\/\*\n?/, ''));
  process.exit(code);
}

function loadRadarConfig(configPath) {
  const resolved = path.resolve(configPath || path.join(__dirname, 'radar.json'));
  if (!fs.existsSync(resolved)) {
    console.error(
      `Нет файла ${resolved}.\nСкопируйте пример и впишите свои каналы:\n  cp tools/outreach/radar.example.json tools/outreach/radar.json`
    );
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const channels = (config.channels || []).map(normalizeChannelName).filter(Boolean);
  if (!channels.length) {
    console.error(`В ${resolved} не указано ни одного канала (поле "channels").`);
    process.exit(1);
  }
  return { ...config, channels };
}

function isFresh(dateIso, maxAgeHours) {
  if (!dateIso || !maxAgeHours) return true;
  const ts = Date.parse(dateIso);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts <= maxAgeHours * 3600 * 1000;
}

function formatSignal(signal, brand) {
  const when = signal.date ? new Date(signal.date).toLocaleString('ru-RU') : 'дата неизвестна';
  const preview = signal.text.length > 600 ? `${signal.text.slice(0, 600)}…` : signal.text;
  return [
    `📡 Сигнал из @${signal.channel} (${when})`,
    signal.link,
    '',
    preview,
    '',
    `— черновик ответа (проверьте и отправьте сами) —`,
    buildSignalReply({ brand, seed: signal.id || signal.link }),
  ].join('\n');
}

function appendSignals(signals) {
  if (!signals.length) return;
  ensureDataDir();
  const lines = signals.map((s) => JSON.stringify(s)).join('\n');
  fs.appendFileSync(SIGNALS_PATH, `${lines}\n`, 'utf8');
}

function saveSeen(seen) {
  ensureDataDir();
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2), 'utf8');
}

async function notifyTelegram(messages) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.TELEGRAM_NOTIFY_CHAT_ID ||
    (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',')[0].trim();

  if (!token || !chatId) {
    console.error(
      'Уведомления пропущены: нужны TELEGRAM_BOT_TOKEN и TELEGRAM_NOTIFY_CHAT_ID (или первый ID из TELEGRAM_ALLOWED_USER_IDS) в .env'
    );
    return;
  }

  const bot = new TelegramClient(token);
  for (const text of messages) {
    for (const chunk of splitForTelegram(text)) {
      try {
        await bot.sendMessage(chatId, chunk);
      } catch (err) {
        console.error(`Не удалось отправить уведомление: ${err.message}`);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: ['help', 'notify', 'all'] });
  if (args.help) printHelpAndExit(0);

  const config = loadRadarConfig(args.config);
  const brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf8'));
  const maxAgeHours = Number(args['max-age'] || config.maxAgeHours || 48);

  const seen = readJson(SEEN_PATH, {});
  const found = [];
  let scanned = 0;

  for (const channel of config.channels) {
    const res = await fetchChannelMessages(channel);
    if (!res.ok) {
      console.error(`@${channel}: ${res.reason}`);
      continue;
    }
    scanned += res.messages.length;

    for (const msg of res.messages) {
      const key = msg.id || msg.link;
      if (!args.all && seen[key]) continue;
      if (!isFresh(msg.date, maxAgeHours)) continue;

      const verdict = matchSignal(msg.text, config.rules);
      if (!verdict.matched) continue;

      found.push({
        ...msg,
        score: verdict.score,
        matchedWords: [...verdict.intent, ...verdict.subject, ...verdict.strong],
        foundAt: new Date().toISOString(),
      });
    }

    // Помечаем просмотренными все посты канала, а не только совпавшие, —
    // иначе каждый запуск заново прогонял бы правила по всей ленте.
    for (const msg of res.messages) seen[msg.id || msg.link] = true;
  }

  found.sort((a, b) => b.score - a.score);
  saveSeen(seen);
  appendSignals(found);

  console.log(`Просмотрено постов: ${scanned}, найдено сигналов: ${found.length}`);
  for (const signal of found) {
    console.log(`\n${'—'.repeat(50)}\n${formatSignal(signal, brand)}`);
  }

  if (args.notify && found.length) {
    await notifyTelegram(found.map((s) => formatSignal(s, brand)));
    console.log(`\nОтправлено в Telegram: ${found.length} сигналов.`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { formatSignal, isFresh };
