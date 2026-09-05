#!/usr/bin/env node
'use strict';
/*
 * Поиск потенциальных клиентов (архитектурные бюро, дизайн-студии) через
 * 2GIS Catalog API 3.0 и сохранение их в data/leads.csv.
 *
 * Нужен бесплатный API-ключ 2GIS для приложений — получить можно на
 * https://dev.2gis.ru/ (раздел "Каталог", ключ для Places API). Задайте его
 * в tools/outreach/.env как TWOGIS_API_KEY=... (см. .env.example).
 *
 * Документация эндпоинта (может обновляться разработчиком API):
 *   https://docs.2gis.com/ru/api/search/places/overview
 *
 * Использование:
 *   node tools/outreach/discover-2gis.js --cities "Москва,Казань" \
 *     --query "архитектурное бюро" --out tools/outreach/data/leads.csv
 *
 * Опции:
 *   --cities "A,B,C"   список городов через запятую (по умолчанию — из
 *                      config.json или встроенный список из lib/cities.js)
 *   --query "текст"    поисковый запрос (по умолчанию — несколько вариантов:
 *                      "архитектурное бюро", "дизайн-студия интерьера",
 *                      "архитектурная мастерская")
 *   --radius <м>        радиус поиска вокруг центра города (по умолчанию 30000)
 *   --max-pages <n>     сколько страниц выдачи забирать на город+запрос (по умолчанию 5)
 *   --page-size <n>     размер страницы (по умолчанию 12 — лимит бесплатного ключа)
 *   --out <path>        путь к leads.csv (по умолчанию tools/outreach/data/leads.csv)
 *   --config <path>     JSON с { "cities": {"Город": [lon,lat]}, "categories": [...] }
 *   --help              показать эту справку
 */

const path = require('path');
const fs = require('fs');
const { loadEnv } = require('./lib/env');
const { parseArgs } = require('./lib/cli');
const { sleep } = require('./lib/http');
const { readLeads, writeLeads, mergeLeads, ensureDataDir } = require('./lib/store');
const BUILTIN_CITIES = require('./lib/cities');

loadEnv();

const DEFAULT_CATEGORIES = [
  'архитектурное бюро',
  'дизайн-студия интерьера',
  'архитектурная мастерская',
];

function printHelpAndExit(code) {
  const help = fs.readFileSync(__filename, 'utf8').split('*/')[0];
  console.log(help.replace(/^#!.*\n/, '').replace(/\/\*\n?/, ''));
  process.exit(code);
}

function loadConfig(configPath) {
  const explicit = Boolean(configPath);
  const resolved = path.resolve(configPath || path.join(__dirname, 'config.json'));
  if (!fs.existsSync(resolved)) {
    if (explicit) {
      console.error(`Файл конфига не найден: ${resolved}`);
      process.exit(1);
    }
    return {};
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

async function search2gis({ query, lon, lat, radius, page, pageSize, apiKey }) {
  const url = new URL('https://catalog.api.2gis.com/3.0/items');
  url.searchParams.set('q', query);
  url.searchParams.set('location', `${lon},${lat}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('type', 'branch');
  url.searchParams.set('fields', 'items.contact_groups,items.point,items.address,items.reviews');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url, { headers: { 'User-Agent': 'NeuroOtlichnikOutreachBot/1.0' } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`2GIS API вернул ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  if (body.meta && body.meta.code && body.meta.code !== 200) {
    throw new Error(`2GIS API meta.code=${body.meta.code}: ${JSON.stringify(body.meta).slice(0, 300)}`);
  }
  return body.result || { items: [], total: 0 };
}

function extractContacts(item) {
  let email = '';
  let website = '';
  let phone = '';
  for (const group of item.contact_groups || []) {
    for (const contact of group.contacts || []) {
      if (contact.type === 'email' && !email) email = contact.value;
      if ((contact.type === 'website' || contact.type === 'homepage') && !website) {
        website = contact.value;
      }
      if (contact.type === 'phone' && !phone) phone = contact.value;
    }
  }
  return { email, website, phone };
}

function toLead(item, query, city) {
  const { email, website, phone } = extractContacts(item);
  return {
    company: item.name || '',
    city,
    address: (item.address && item.address.name) || item.address_name || '',
    website,
    phone,
    email,
    email_source: email ? '2gis' : '',
    category: query,
    source: '2gis',
    source_id: item.id || '',
    notes: '',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: ['help'] });
  if (args.help) printHelpAndExit(0);

  const apiKey = process.env.TWOGIS_API_KEY;
  if (!apiKey) {
    console.error(
      'Не задан TWOGIS_API_KEY. Получите бесплатный ключ на https://dev.2gis.ru/ и добавьте его в tools/outreach/.env'
    );
    process.exit(1);
  }

  const config = loadConfig(args.config);
  const cityCoords = { ...BUILTIN_CITIES, ...(config.cities || {}) };

  const cityNames = args.cities
    ? args.cities.split(',').map((c) => c.trim()).filter(Boolean)
    : Object.keys(config.cities || {}).length
    ? Object.keys(config.cities)
    : Object.keys(BUILTIN_CITIES);

  const categories = args.query
    ? [args.query]
    : config.categories && config.categories.length
    ? config.categories
    : DEFAULT_CATEGORIES;

  const radius = Number(args.radius || 30000);
  const maxPages = Number(args['max-pages'] || 5);
  const pageSize = Number(args['page-size'] || 12);
  const outPath = path.resolve(args.out || path.join(__dirname, 'data', 'leads.csv'));

  ensureDataDir();
  const existing = readLeads(outPath);
  const collected = [];

  for (const city of cityNames) {
    const coords = cityCoords[city];
    if (!coords) {
      console.warn(`Пропускаю город "${city}" — нет координат. Добавьте их в config.json ("cities").`);
      continue;
    }
    const [lon, lat] = coords;

    for (const query of categories) {
      console.log(`→ 2GIS: "${query}" в городе ${city}`);
      for (let page = 1; page <= maxPages; page++) {
        let result;
        try {
          result = await search2gis({ query, lon, lat, radius, page, pageSize, apiKey });
        } catch (err) {
          console.error(`  ошибка на странице ${page}: ${err.message}`);
          break;
        }
        const items = result.items || [];
        if (!items.length) break;
        for (const item of items) collected.push(toLead(item, query, city));
        console.log(`  страница ${page}: ${items.length} организаций (всего в выдаче: ${result.total ?? '?'})`);
        if (items.length < pageSize) break; // это была последняя страница
        await sleep(400); // не долбим API слишком часто
      }
      await sleep(400);
    }
  }

  const merged = mergeLeads(existing, collected);
  writeLeads(outPath, merged);
  console.log(
    `\nГотово: найдено за этот запуск ${collected.length} записей, всего в файле ${merged.length} → ${outPath}`
  );
  console.log('Дальше: node tools/outreach/enrich-emails.js — чтобы найти недостающие email на сайтах компаний.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
