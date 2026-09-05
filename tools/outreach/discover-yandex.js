#!/usr/bin/env node
'use strict';
/*
 * Альтернативный/дополнительный источник лидов — Яндекс Geosearch API
 * (он же "Search API", поиск по организациям). Даёт название, адрес, сайт
 * и телефон, но обычно НЕ даёт email — его придётся искать отдельным шагом
 * (node tools/outreach/enrich-emails.js).
 *
 * Нужен бесплатный API-ключ — оформляется в кабинете Яндекс.Карт для
 * бизнеса: https://developer.tech.yandex.ru/services (продукт "API
 * Геосправочника / Search API"). Задайте его в tools/outreach/.env как
 * YANDEX_MAPS_API_KEY=... (см. .env.example).
 *
 * Документация (может обновляться разработчиком API):
 *   https://yandex.ru/dev/maps/geosearch/
 *
 * Использование и опции — те же, что у discover-2gis.js:
 *   node tools/outreach/discover-yandex.js --cities "Москва,Казань" \
 *     --query "архитектурное бюро" --out tools/outreach/data/leads.csv
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

const RESULTS_PER_PAGE = 50; // максимум, который отдаёт Yandex Geosearch за раз

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

async function searchYandex({ query, lon, lat, spn, skip, apiKey }) {
  const url = new URL('https://search-maps.yandex.ru/v1/');
  url.searchParams.set('text', query);
  url.searchParams.set('lang', 'ru_RU');
  url.searchParams.set('type', 'biz');
  url.searchParams.set('ll', `${lon},${lat}`);
  url.searchParams.set('spn', spn);
  url.searchParams.set('results', String(RESULTS_PER_PAGE));
  url.searchParams.set('skip', String(skip));
  url.searchParams.set('apikey', apiKey);

  const res = await fetch(url, { headers: { 'User-Agent': 'NeuroOtlichnikOutreachBot/1.0' } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`Yandex Geosearch вернул ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.features || [];
}

function toLead(feature, query, city) {
  const meta = feature.properties && feature.properties.CompanyMetaData;
  const phones = (meta && meta.Phones) || [];
  return {
    company: (meta && meta.name) || feature.properties.name || '',
    city,
    address: (meta && meta.address) || feature.properties.description || '',
    website: (meta && meta.url) || '',
    phone: phones[0] ? phones[0].formatted || phones[0].number || '' : '',
    email: '',
    email_source: '',
    category: query,
    source: 'yandex',
    source_id: (meta && meta.id) || '',
    notes: '',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanFlags: ['help'] });
  if (args.help) printHelpAndExit(0);

  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    console.error(
      'Не задан YANDEX_MAPS_API_KEY. Оформите ключ на https://developer.tech.yandex.ru/services и добавьте его в tools/outreach/.env'
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

  const spn = args.spn || '0.4,0.4'; // окно поиска вокруг точки, в градусах
  const maxPages = Number(args['max-pages'] || 3);
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
      console.log(`→ Yandex: "${query}" в городе ${city}`);
      for (let p = 0; p < maxPages; p++) {
        const skip = p * RESULTS_PER_PAGE;
        let features;
        try {
          features = await searchYandex({ query, lon, lat, spn, skip, apiKey });
        } catch (err) {
          console.error(`  ошибка на смещении ${skip}: ${err.message}`);
          break;
        }
        if (!features.length) break;
        for (const f of features) collected.push(toLead(f, query, city));
        console.log(`  получено ${features.length} организаций (skip=${skip})`);
        if (features.length < RESULTS_PER_PAGE) break;
        await sleep(400);
      }
      await sleep(400);
    }
  }

  const merged = mergeLeads(existing, collected);
  writeLeads(outPath, merged);
  console.log(
    `\nГотово: найдено за этот запуск ${collected.length} записей, всего в файле ${merged.length} → ${outPath}`
  );
  console.log('Дальше: node tools/outreach/enrich-emails.js — чтобы найти email на сайтах компаний (Yandex их не даёт).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
