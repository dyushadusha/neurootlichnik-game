#!/usr/bin/env node
'use strict';
/*
 * Собирает уникальный черновик письма для каждого лида из data/leads.csv,
 * у которого есть email. Персонализация — не просто «Здравствуйте,
 * {company}»: письмо составляется из нескольких независимо выбираемых
 * блоков (тема, вступление, «крючок» под специализацию, аргументы, CTA),
 * выбор детерминирован по хэшу от компании — то есть при повторном запуске
 * для тех же лидов получаются те же письма, но разные лиды получают разные
 * комбинации текста.
 *
 * «Крючок» под специализацию подбирается по ключевым словам, найденным на
 * сайте компании на этапе enrich-emails.js (data/site_snippets/*.txt) — если
 * снипшот есть и в нём находятся слова вроде «жк», «тендер», «bim» и т.п.
 *
 * Черновики кладутся в data/drafts/<id>.json, сводка — в data/drafts_index.csv
 * для ручной проверки перед отправкой (это НЕ автоматическая отправка).
 *
 * Использование:
 *   node tools/outreach/generate-drafts.js [--in leads.csv] [--force]
 *
 * Опции:
 *   --in <path>   входной leads.csv (по умолчанию data/leads.csv)
 *   --force       перегенерировать письма даже для уже отправленных/готовых лидов
 *   --help
 */

const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { parseArgs } = require('./lib/cli');
const { readLeads, readLedger, readSuppressed } = require('./lib/store');
const { buildEmail } = require('./lib/templates');

const DATA_DIR = path.join(__dirname, 'data');
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');
const SNIPPETS_DIR = path.join(DATA_DIR, 'site_snippets');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json');
const SUPPRESSED_PATH = path.join(DATA_DIR, 'suppressed.txt');
const BRAND_PATH = path.join(__dirname, 'brand.json');

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('*/')[0];
  console.log(help.replace(/^#!.*\n/, '').replace(/\/\*\n?/, ''));
  process.exit(code);
}

function safeDomainFileName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '_');
  } catch {
    return null;
  }
}

function detectHookProductId(website, products) {
  if (!website) return 'default';
  const file = safeDomainFileName(website);
  if (!file) return 'default';
  const snippetPath = path.join(SNIPPETS_DIR, `${file}.txt`);
  if (!fs.existsSync(snippetPath)) return 'default';
  const text = fs.readFileSync(snippetPath, 'utf8').toLowerCase();

  let best = { id: 'default', hits: 0 };
  for (const product of products) {
    if (!product.keywords || !product.keywords.length) continue;
    const hits = product.keywords.reduce((n, kw) => n + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (hits > best.hits) best = { id: product.id, hits };
  }
  return best.hits > 0 ? best.id : 'default';
}

function slugFor(lead) {
  const base = (lead.email || `${lead.company}-${lead.city}`).toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `lead-${Date.now()}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: ['help', 'force'] });
  if (args.help) printHelpAndExit(0);

  const inPath = path.resolve(args.in || path.join(DATA_DIR, 'leads.csv'));
  const leads = readLeads(inPath);
  if (!leads.length) {
    console.error(`Нет лидов в ${inPath}. Сначала запустите discover-2gis.js / discover-yandex.js.`);
    process.exit(1);
  }

  const brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf8'));
  const ledger = readLedger(LEDGER_PATH);
  const suppressed = readSuppressed(SUPPRESSED_PATH);

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });

  const indexRows = [];
  let generated = 0;
  let skippedNoEmail = 0;
  let skippedSuppressed = 0;
  let skippedAlreadyHandled = 0;

  for (const lead of leads) {
    if (!lead.email) {
      skippedNoEmail++;
      continue;
    }
    const emailLower = lead.email.toLowerCase();
    if (suppressed.has(emailLower)) {
      skippedSuppressed++;
      continue;
    }
    const ledgerEntry = ledger[emailLower];
    if (ledgerEntry && ledgerEntry.status === 'sent' && !args.force) {
      skippedAlreadyHandled++;
      continue;
    }

    const hookProductId = detectHookProductId(lead.website, brand.products);
    const { subject, text } = buildEmail({
      company: lead.company || 'коллеги',
      city: lead.city,
      website: lead.website,
      hookProductId,
      brand,
    });

    const slug = slugFor(lead);
    const draft = {
      slug,
      to: lead.email,
      company: lead.company,
      city: lead.city,
      website: lead.website,
      hookProductId,
      subject,
      text,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(DRAFTS_DIR, `${slug}.json`), JSON.stringify(draft, null, 2), 'utf8');
    indexRows.push({ slug, company: lead.company, city: lead.city, email: lead.email, hook: hookProductId, subject });
    generated++;
  }

  const csv = stringify(indexRows, { header: true, columns: ['slug', 'company', 'city', 'email', 'hook', 'subject'] });
  fs.writeFileSync(path.join(DATA_DIR, 'drafts_index.csv'), csv);

  console.log(`Готово: черновиков создано/обновлено — ${generated}`);
  console.log(`Пропущено без email: ${skippedNoEmail}, в списке отписавшихся: ${skippedSuppressed}, уже отправлено: ${skippedAlreadyHandled}`);
  console.log(`\nПроверьте письма глазами: ${path.join(DATA_DIR, 'drafts_index.csv')} и файлы в ${DRAFTS_DIR}`);
  console.log('Дальше: node tools/outreach/send-emails.js --dry-run — посмотреть, что будет отправлено, без реальной отправки.');
}

main();
