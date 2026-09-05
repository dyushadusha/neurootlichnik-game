'use strict';
/*
 * Сводный отчёт по всей воронке рассылки — читает только уже сохранённые
 * данные (leads.csv, drafts/, ledger.json, suppressed.txt), в сеть не ходит.
 * Используется и из CLI (status.js), и из Telegram-бота (bot.js) — чтобы
 * текст отчёта не расходился между двумя интерфейсами.
 */

const fs = require('fs');
const path = require('path');
const { readLeads, readLedger, readSuppressed } = require('./store');

function countSentOn(ledger, isoDatePrefix) {
  return Object.values(ledger).filter((e) => e.status === 'sent' && (e.at || '').startsWith(isoDatePrefix)).length;
}

/**
 * @param {string} dataDir — папка tools/outreach/data
 * @returns {{ text: string, stats: object }}
 */
function buildReport(dataDir) {
  const leads = readLeads(path.join(dataDir, 'leads.csv'));
  const ledger = readLedger(path.join(dataDir, 'ledger.json'));
  const suppressed = readSuppressed(path.join(dataDir, 'suppressed.txt'));

  const draftsDir = path.join(dataDir, 'drafts');
  const draftFiles = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json')) : [];

  const withEmail = leads.filter((l) => l.email).length;
  const withoutEmail = leads.length - withEmail;

  const ledgerValues = Object.values(ledger);
  const sentTotal = ledgerValues.filter((e) => e.status === 'sent').length;
  const failedTotal = ledgerValues.filter((e) => e.status === 'failed').length;
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = countSentOn(ledger, today);

  const sentEmails = new Set(Object.entries(ledger).filter(([, v]) => v.status === 'sent').map(([k]) => k));
  const readyToSend = draftFiles.filter((f) => {
    try {
      const draft = JSON.parse(fs.readFileSync(path.join(draftsDir, f), 'utf8'));
      const email = (draft.to || '').toLowerCase();
      return !sentEmails.has(email) && !suppressed.has(email);
    } catch {
      return false;
    }
  }).length;

  const byCity = {};
  for (const l of leads) {
    if (!l.city) continue;
    byCity[l.city] = (byCity[l.city] || 0) + 1;
  }
  const topCities = Object.entries(byCity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, n]) => `  ${city}: ${n}`)
    .join('\n');

  const stats = {
    leadsTotal: leads.length,
    withEmail,
    withoutEmail,
    draftsTotal: draftFiles.length,
    readyToSend,
    sentToday,
    sentTotal,
    failedTotal,
    suppressedTotal: suppressed.size,
  };

  const lines = [
    '📊 Статус рассылки',
    '',
    `Лидов найдено: ${stats.leadsTotal} (с email: ${stats.withEmail}, без email: ${stats.withoutEmail})`,
    topCities ? `По городам (топ-5):\n${topCities}` : null,
    '',
    `Черновиков собрано: ${stats.draftsTotal}`,
    `Готово к отправке прямо сейчас: ${stats.readyToSend}`,
    '',
    `Отправлено сегодня: ${stats.sentToday}`,
    `Отправлено всего: ${stats.sentTotal}`,
    `Ошибок отправки: ${stats.failedTotal}`,
    `В списке отписавшихся: ${stats.suppressedTotal}`,
  ].filter((l) => l !== null);

  return { text: lines.join('\n'), stats };
}

module.exports = { buildReport };
