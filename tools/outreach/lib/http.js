'use strict';
/*
 * Вежливый HTTP-клиент для обхода чужих сайтов при поиске контактных email.
 *
 * Принципы:
 *  - представляемся честным User-Agent со ссылкой на контакты студии;
 *  - проверяем robots.txt перед первым запросом к домену и кэшируем результат;
 *  - выдерживаем паузу между запросами к одному и тому же домену;
 *  - ограничиваем время ожидания ответа, чтобы один зависший сайт не вешал весь прогон.
 */

const USER_AGENT =
  'NeuroOtlichnikOutreachBot/1.0 (+https://neurootlichnik.ru; contact: info@neurootlichnik.ru)';

const robotsCache = new Map(); // host -> { disallowAll, disallowedPaths }
const lastRequestAtByHost = new Map(); // host -> timestamp ms

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, { timeoutMs = 10000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*', ...headers },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Простейший парсер robots.txt: нас интересует только группа для '*'
// (или для нашего конкретного UA, если она задана) и список Disallow.
function parseRobots(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let currentAgentApplies = false;
  let matchedSpecific = false;
  const disallowed = [];

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    if (!rest.length) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      const ua = value.toLowerCase();
      if (ua === '*') {
        currentAgentApplies = !matchedSpecific;
      } else if (USER_AGENT.toLowerCase().includes(ua)) {
        currentAgentApplies = true;
        matchedSpecific = true;
      } else {
        currentAgentApplies = false;
      }
    } else if (key === 'disallow' && currentAgentApplies && value) {
      disallowed.push(value);
    }
  }
  return { disallowAll: disallowed.includes('/'), disallowedPaths: disallowed };
}

async function getRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = { disallowAll: false, disallowedPaths: [] };
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, { timeoutMs: 6000 });
    if (res.ok) {
      const text = await res.text();
      rules = parseRobots(text);
    }
  } catch {
    // robots.txt недоступен — считаем, что ограничений нет
  }
  robotsCache.set(origin, rules);
  return rules;
}

function isAllowedByRobots(rules, pathname) {
  if (rules.disallowAll) return false;
  return !rules.disallowedPaths.some((p) => pathname.startsWith(p));
}

/**
 * Скачивает страницу с уважением к robots.txt и паузой между запросами
 * к одному домену. Возвращает { ok, status, text, finalUrl } или null,
 * если запрос запрещён/не удался.
 */
async function politeGet(url, { minDelayMs = 1200, timeoutMs = 10000 } = {}) {
  const parsed = new URL(url);
  const origin = `${parsed.protocol}//${parsed.host}`;
  const robots = await getRobots(origin);
  if (!isAllowedByRobots(robots, parsed.pathname)) {
    return { ok: false, blockedByRobots: true };
  }

  const host = parsed.host;
  const last = lastRequestAtByHost.get(host) || 0;
  const wait = last + minDelayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAtByHost.set(host, Date.now());

  try {
    const res = await fetchWithTimeout(url, { timeoutMs });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { politeGet, fetchWithTimeout, sleep, hostOf, USER_AGENT };
