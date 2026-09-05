'use strict';
/*
 * Извлечение email-адресов и читаемого текста из HTML-страницы сайта.
 * Чистые функции — без сети, легко тестируются на фикстурах.
 */

const cheerio = require('cheerio');

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Домены и локальные части, которые почти всегда мусор: аналитика,
// шаблонизаторы конструкторов сайтов, плейсхолдеры из вёрстки.
const JUNK_DOMAIN_SUBSTRINGS = [
  'sentry.io',
  'wixpress.com',
  'schema.org',
  'example.com',
  'example.org',
  'w3.org',
  'godaddy.com',
  'cloudflare.com',
  'googleapis.com',
  'gstatic.com',
  'yourdomain.com',
  'domain.com',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.gif',
];

const JUNK_LOCAL_PARTS = ['test', 'user', 'name', 'youremail', 'email'];

function isJunkEmail(email) {
  const lower = email.toLowerCase();
  const [local, domain] = lower.split('@');
  if (!domain) return true;
  if (JUNK_DOMAIN_SUBSTRINGS.some((s) => domain.includes(s))) return true;
  if (JUNK_LOCAL_PARTS.includes(local)) return true;
  return false;
}

function registrableDomain(hostname) {
  // Грубое приближение без полноценного списка публичных суффиксов:
  // берём последние два сегмента домена (для больш-ва .ru/.com/.рф этого
  // достаточно, чтобы сравнить "example.ru" с "www.example.ru").
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.');
  return parts.slice(-2).join('.');
}

/**
 * @param {string} html
 * @param {string} [siteUrl] — URL страницы, чтобы приоритизировать email на том же домене
 * @returns {{value: string, viaMailto: boolean, sameDomain: boolean}[]} без дублей, лучшие — первыми
 */
function extractEmails(html, siteUrl) {
  const $ = cheerio.load(html);
  const found = new Map(); // lowercased email -> {value, viaMailto, sameDomain}

  let siteDomain = null;
  if (siteUrl) {
    try {
      siteDomain = registrableDomain(new URL(siteUrl).hostname);
    } catch {
      siteDomain = null;
    }
  }

  const record = (raw, viaMailto) => {
    const value = raw.trim().replace(/[.,;:]+$/, '');
    if (!value || isJunkEmail(value)) return;
    const key = value.toLowerCase();
    const domain = key.split('@')[1];
    const sameDomain = Boolean(siteDomain && domain && registrableDomain(domain) === siteDomain);
    const prev = found.get(key);
    if (!prev || (viaMailto && !prev.viaMailto) || (sameDomain && !prev.sameDomain)) {
      found.set(key, { value, viaMailto: viaMailto || (prev && prev.viaMailto), sameDomain: sameDomain || (prev && prev.sameDomain) });
    }
  };

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const addr = href.replace(/^mailto:/i, '').split('?')[0];
    for (const m of addr.matchAll(EMAIL_RE)) record(m[0], true);
  });

  const bodyText = $('body').text();
  for (const m of bodyText.matchAll(EMAIL_RE)) record(m[0], false);
  // на всякий случай смотрим и в сыром HTML (email иногда лежит в атрибутах/скриптах)
  for (const m of html.matchAll(EMAIL_RE)) record(m[0], false);

  return Array.from(found.values()).sort((a, b) => {
    if (a.viaMailto !== b.viaMailto) return a.viaMailto ? -1 : 1;
    if (a.sameDomain !== b.sameDomain) return a.sameDomain ? -1 : 1;
    return 0;
  });
}

/** Читаемый текст страницы (для подбора «крючка» в generate-drafts.js), без тегов/скриптов. */
function extractVisibleText(html, maxLength = 4000) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength);
}

module.exports = { extractEmails, extractVisibleText, registrableDomain };
