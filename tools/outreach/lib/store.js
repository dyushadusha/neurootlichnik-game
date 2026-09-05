'use strict';
/*
 * Хранилище лидов и служебных данных рассылки.
 *
 * Схема одной записи лида (лежит в leads.csv):
 *   company        — название компании
 *   city           — город
 *   address        — адрес (если есть)
 *   website        — сайт (нормализованный, с протоколом)
 *   phone          — телефон (если есть)
 *   email          — контактный email (может быть пустым до этапа enrich)
 *   email_source   — откуда взят email: "2gis" | "yandex" | "site:<url>" | "manual"
 *   category       — категория из источника (напр. "Архитектурное бюро")
 *   source         — "2gis" | "yandex" | "manual"
 *   source_id      — id записи в источнике (для дедупликации при повторном запуске)
 *   notes          — свободное поле
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const LEAD_COLUMNS = [
  'company',
  'city',
  'address',
  'website',
  'phone',
  'email',
  'email_source',
  'category',
  'source',
  'source_id',
  'notes',
];

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function atomicWrite(filePath, content) {
  ensureDataDir();
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

function readLeads(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  return rows.map((row) => {
    const lead = {};
    for (const col of LEAD_COLUMNS) lead[col] = row[col] || '';
    return lead;
  });
}

function writeLeads(filePath, leads) {
  const rows = leads.map((lead) => {
    const row = {};
    for (const col of LEAD_COLUMNS) row[col] = lead[col] || '';
    return row;
  });
  const csv = stringify(rows, { header: true, columns: LEAD_COLUMNS });
  atomicWrite(filePath, csv);
}

// Слияние новых лидов с уже существующими: дедуп по (source, source_id),
// а если source_id нет — по (website || (company+city)) в нижнем регистре.
function mergeLeads(existing, incoming) {
  const keyOf = (l) => {
    if (l.source && l.source_id) return `${l.source}:${l.source_id}`;
    const site = (l.website || '').toLowerCase().replace(/\/+$/, '');
    if (site) return `site:${site}`;
    return `name:${(l.company || '').toLowerCase()}:${(l.city || '').toLowerCase()}`;
  };
  const byKey = new Map(existing.map((l) => [keyOf(l), l]));
  for (const lead of incoming) {
    const key = keyOf(lead);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, lead);
    } else {
      // дополняем уже известную запись новыми полями, не затирая найденный email
      byKey.set(key, { ...lead, ...prev, email: prev.email || lead.email, email_source: prev.email_source || lead.email_source });
    }
  }
  return Array.from(byKey.values());
}

// --- Ledger отправленных писем (data/ledger.json): email -> {status, at, error} ---

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readLedger(filePath) {
  return readJson(filePath, {});
}

function writeLedger(filePath, ledger) {
  atomicWrite(filePath, JSON.stringify(ledger, null, 2));
}

// --- Suppression list (data/suppressed.txt): по одному email на строку ---

function readSuppressed(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  return new Set(
    lines.map((l) => l.trim().toLowerCase()).filter(Boolean).filter((l) => !l.startsWith('#'))
  );
}

function addSuppressed(filePath, email) {
  ensureDataDir();
  const set = readSuppressed(filePath);
  set.add(email.toLowerCase());
  const lines = Array.from(set).sort();
  atomicWrite(filePath, `${lines.join('\n')}\n`);
}

module.exports = {
  LEAD_COLUMNS,
  DATA_DIR,
  ensureDataDir,
  readLeads,
  writeLeads,
  mergeLeads,
  readJson,
  readLedger,
  writeLedger,
  readSuppressed,
  addSuppressed,
};
