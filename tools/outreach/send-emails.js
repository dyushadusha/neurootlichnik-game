#!/usr/bin/env node
'use strict';
/*
 * Отправляет черновики из data/drafts/*.json через SMTP.
 *
 * ПО УМОЛЧАНИЮ РЕЖИМ DRY-RUN: скрипт только печатает, что отправил бы,
 * и ничего не пишет в ledger. Реальная отправка — только с флагом --send.
 *
 * Идемпотентность: data/ledger.json помнит, кому уже отправлено, поэтому
 * повторный запуск не продублирует письма. Перед отправкой проверяется
 * data/suppressed.txt (те, кто попросил больше не писать, или отбившиеся
 * адреса) — им письмо не уйдёт, даже если черновик для них есть.
 *
 * Настройки SMTP — в tools/outreach/.env (см. .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS,
 *   FROM_NAME, FROM_EMAIL, REPLY_TO (необязательно)
 *
 * Использование:
 *   node tools/outreach/send-emails.js --dry-run
 *   node tools/outreach/send-emails.js --send --limit 20 --delay-ms 10000
 *
 * Опции:
 *   --send            реально отправлять письма (без него — только dry-run)
 *   --limit <n>        максимум писем за один запуск (по умолчанию 30)
 *   --delay-ms <n>     пауза между письмами, мс (по умолчанию 8000 — 8 секунд)
 *   --daily-cap <n>    сколько писем максимум отправлять в сутки суммарно (по умолчанию 80)
 *   --force-resend     отправить повторно даже тем, кому по ledger уже отправлено
 *   --help
 *
 * Зачем лимиты по умолчанию: резкий залп из сотен писем с одного личного
 * почтового ящика почти гарантированно улетит в спам и может привести к
 * блокировке аккаунта. Для рассылок на сотни/тысячи адресов в месяц лучше
 * использовать транзакционный сервис (Unisender, SendPulse, Mailgun и т.п.)
 * с прогретым доменом — см. README.md.
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { loadEnv } = require('./lib/env');
const { parseArgs } = require('./lib/cli');
const { sleep } = require('./lib/http');
const { readLedger, writeLedger, readSuppressed } = require('./lib/store');

loadEnv();

const DATA_DIR = path.join(__dirname, 'data');
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json');
const SUPPRESSED_PATH = path.join(DATA_DIR, 'suppressed.txt');

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('*/')[0];
  console.log(help.replace(/^#!.*\n/, '').replace(/\/\*\n?/, ''));
  process.exit(code);
}

function loadDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8')));
}

function countSentToday(ledger) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(ledger).filter((e) => e.status === 'sent' && (e.at || '').startsWith(today)).length;
}

function buildTransporter() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Не заданы переменные окружения: ${missing.join(', ')}. Заполните tools/outreach/.env (см. .env.example).`);
    process.exit(1);
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanFlags: ['help', 'send', 'dry-run', 'force-resend'],
  });
  if (args.help) printHelpAndExit(0);

  const dryRun = !args.send;
  const limit = Number(args.limit || 30);
  const delayMs = Number(args['delay-ms'] || 8000);
  const dailyCap = Number(args['daily-cap'] || 80);

  const drafts = loadDrafts();
  if (!drafts.length) {
    console.error(`Нет черновиков в ${DRAFTS_DIR}. Сначала запустите generate-drafts.js.`);
    process.exit(1);
  }

  const ledger = readLedger(LEDGER_PATH);
  const suppressed = readSuppressed(SUPPRESSED_PATH);
  let sentTodayBefore = countSentToday(ledger);

  const transporter = dryRun ? null : buildTransporter();
  const fromName = process.env.FROM_NAME || 'Нейро Отличник';
  const fromEmail = process.env.FROM_EMAIL;
  const replyTo = process.env.REPLY_TO || fromEmail;

  let sent = 0;
  let skippedSuppressed = 0;
  let skippedAlready = 0;
  let failed = 0;

  console.log(dryRun ? 'Режим: DRY-RUN (ничего реально не отправляется)\n' : `Режим: ОТПРАВКА (лимит ${limit} писем, пауза ${delayMs} мс)\n`);

  for (const draft of drafts) {
    if (sent >= limit) {
      console.log(`Достигнут лимит на этот запуск (--limit ${limit}), останавливаюсь.`);
      break;
    }
    if (!dryRun && sentTodayBefore + sent >= dailyCap) {
      console.log(`Достигнут дневной лимит (--daily-cap ${dailyCap}), останавливаюсь.`);
      break;
    }

    const email = draft.to.toLowerCase();
    if (suppressed.has(email)) {
      skippedSuppressed++;
      continue;
    }
    const entry = ledger[email];
    if (entry && entry.status === 'sent' && !args['force-resend']) {
      skippedAlready++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY-RUN] → ${draft.to}  (${draft.company})\n    Тема: ${draft.subject}`);
      sent++;
      continue;
    }

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: draft.to,
        replyTo,
        subject: draft.subject,
        text: draft.text,
        headers: {
          'List-Unsubscribe': `<mailto:${fromEmail}?subject=stop>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      ledger[email] = { status: 'sent', at: new Date().toISOString(), subject: draft.subject, slug: draft.slug };
      sent++;
      console.log(`✓ отправлено → ${draft.to} (${draft.company})`);
    } catch (err) {
      ledger[email] = { status: 'failed', at: new Date().toISOString(), error: err.message };
      failed++;
      console.log(`✗ ошибка отправки → ${draft.to}: ${err.message}`);
    }
    writeLedger(LEDGER_PATH, ledger); // сохраняем после каждого письма — безопасно при обрыве

    if (sent < limit) await sleep(delayMs);
  }

  console.log(
    `\nИтого: ${dryRun ? 'показано' : 'отправлено'} ${sent}, пропущено (отписка) ${skippedSuppressed}, пропущено (уже отправлено) ${skippedAlready}, ошибок ${failed}.`
  );
  if (dryRun) console.log('Когда проверите черновики — запустите с флагом --send.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
