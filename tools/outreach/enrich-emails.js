#!/usr/bin/env node
'use strict';
/*
 * Дополняет data/leads.csv контактными email там, где их не дал 2GIS/Yandex:
 * заходит на сайт компании (главная + типовые страницы контактов), ищет
 * email в HTML, выбирает лучший кандидат. Заодно сохраняет фрагмент текста
 * главной страницы в data/site_snippets/ — по нему generate-drafts.js потом
 * подбирает релевантный «крючок» в письме (без повторного похода в сеть).
 *
 * Уважает robots.txt и делает паузы между запросами к одному домену
 * (см. lib/http.js) — так что прогон на сотни лидов небыстрый, это ожидаемо.
 *
 * Использование:
 *   node tools/outreach/enrich-emails.js [--in leads.csv] [--out leads.csv]
 *     [--limit 50] [--force]
 *
 * Опции:
 *   --in <path>     входной leads.csv (по умолчанию data/leads.csv)
 *   --out <path>    куда писать результат (по умолчанию тот же файл)
 *   --limit <n>     обработать не больше n лидов за запуск (удобно для проб)
 *   --force         повторно проверять лидов, у которых email уже есть
 *   --help
 */

const path = require('path');
const fs = require('fs');
const { parseArgs } = require('./lib/cli');
const { politeGet } = require('./lib/http');
const { readLeads, writeLeads } = require('./lib/store');
const { extractEmails, extractVisibleText } = require('./lib/emails');

const CONTACT_PATHS = ['', '/contacts', '/contact', '/kontakty', '/about', '/o-nas', '/o-kompanii', '/company'];
const SNIPPETS_DIR = path.join(__dirname, 'data', 'site_snippets');

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('*/')[0];
  console.log(help.replace(/^#!.*\n/, '').replace(/\/\*\n?/, ''));
  process.exit(code);
}

function normalizeWebsite(website) {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function safeDomainFileName(url) {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_');
  } catch {
    return 'unknown';
  }
}

function saveSnippet(domainFile, text) {
  if (!text) return;
  fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SNIPPETS_DIR, `${domainFile}.txt`), text, 'utf8');
}

async function findEmailForLead(lead) {
  const base = normalizeWebsite(lead.website);
  if (!base) return { email: '', source: '' };

  let baseOrigin;
  try {
    baseOrigin = new URL(base).origin;
  } catch {
    return { email: '', source: '' };
  }

  const domainFile = safeDomainFileName(base);
  let homepageTextSaved = false;

  for (const suffix of CONTACT_PATHS) {
    const url = `${baseOrigin}${suffix}`;
    const res = await politeGet(url);
    if (!res || !res.ok || !res.text) continue;

    if (!homepageTextSaved) {
      saveSnippet(domainFile, extractVisibleText(res.text));
      homepageTextSaved = true;
    }

    const candidates = extractEmails(res.text, url);
    if (candidates.length) {
      return { email: candidates[0].value, source: `site:${url}` };
    }
  }
  return { email: '', source: '' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: ['help', 'force'] });
  if (args.help) printHelpAndExit(0);

  const inPath = path.resolve(args.in || path.join(__dirname, 'data', 'leads.csv'));
  const outPath = path.resolve(args.out || inPath);
  const limit = args.limit ? Number(args.limit) : Infinity;

  const leads = readLeads(inPath);
  if (!leads.length) {
    console.error(`Нет лидов в ${inPath}. Сначала запустите discover-2gis.js или discover-yandex.js.`);
    process.exit(1);
  }

  let processed = 0;
  let found = 0;
  for (const lead of leads) {
    if (processed >= limit) break;
    if (lead.email && !args.force) continue;
    if (!lead.website) continue;

    processed++;
    process.stdout.write(`[${processed}] ${lead.company || lead.website} … `);
    try {
      const { email, source } = await findEmailForLead(lead);
      if (email) {
        lead.email = email;
        lead.email_source = source;
        found++;
        console.log(`нашёл ${email}`);
      } else {
        console.log('email не найден');
      }
    } catch (err) {
      console.log(`ошибка: ${err.message}`);
    }
  }

  writeLeads(outPath, leads);
  console.log(`\nОбработано лидов: ${processed}, найдено email: ${found}. Результат → ${outPath}`);
  console.log('Дальше: node tools/outreach/generate-drafts.js — чтобы собрать уникальные письма.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
