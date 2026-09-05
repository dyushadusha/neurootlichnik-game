'use strict';
/*
 * Чтение ПУБЛИЧНЫХ Telegram-каналов через их веб-превью: https://t.me/s/<канал>.
 *
 * Почему именно так, а не через аккаунт-парсер (Telethon/GramJS):
 *  - не нужен ни номер, ни сессия, ни вход в аккаунт — нечего банить;
 *  - читаем ровно то, что Telegram и так отдаёт любому браузеру и поисковикам;
 *  - никаких участников чатов и никаких личных сообщений — только публичные
 *    посты, которые люди сами выложили в открытый канал.
 *
 * Ограничение метода: так видны только каналы (broadcast). Закрытые группы и
 * чаты, где превью выключено, отсюда недоступны — и это осознанно.
 */

const cheerio = require('cheerio');
const { politeGet } = require('./http');

/** Нормализует "@name", "https://t.me/name", "t.me/s/name" → "name". */
function normalizeChannelName(raw) {
  let name = String(raw || '').trim();
  name = name.replace(/^https?:\/\//i, '').replace(/^t\.me\//i, '').replace(/^s\//i, '');
  name = name.replace(/^@/, '');
  name = name.split(/[/?#]/)[0];
  return name;
}

function htmlToText(html) {
  if (!html) return '';
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  return cheerio.load(`<div>${withBreaks}</div>`)('div').text().replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Разбирает HTML страницы t.me/s/<канал>.
 * Селекторы — те, что Telegram отдаёт в веб-превью; на случай изменения вёрстки
 * парсер сделан терпимым (несколько запасных селекторов) и не падает, а
 * возвращает пустой список — вызывающий код сообщит об этом явно.
 *
 * @returns {{id: string, channel: string, link: string, text: string, date: string, author: string}[]}
 */
function parseChannelHtml(html, channel) {
  const $ = cheerio.load(html);
  const messages = [];

  $('.tgme_widget_message[data-post]').each((_, el) => {
    const node = $(el);
    const dataPost = node.attr('data-post') || '';

    // Текст самого поста; блок цитаты/ответа не берём — это чужой текст.
    const textNode = node.find('.tgme_widget_message_text').not('.tgme_widget_message_reply .tgme_widget_message_text').first();
    const text = htmlToText(textNode.html());
    if (!text) return;

    const link = node.find('.tgme_widget_message_date').attr('href') || (dataPost ? `https://t.me/${dataPost}` : '');
    const date = node.find('time[datetime]').attr('datetime') || '';
    const author =
      node.find('.tgme_widget_message_owner_name').first().text().trim() ||
      node.find('.tgme_widget_message_from_author').first().text().trim() ||
      '';

    messages.push({ id: dataPost, channel, link, text, date, author });
  });

  return messages;
}

/**
 * Скачивает последние публичные посты канала.
 * @returns {Promise<{ok: boolean, messages: array, reason?: string}>}
 */
async function fetchChannelMessages(rawChannel) {
  const channel = normalizeChannelName(rawChannel);
  if (!channel) return { ok: false, messages: [], reason: 'пустое имя канала' };

  const res = await politeGet(`https://t.me/s/${channel}`, { minDelayMs: 2000, timeoutMs: 15000 });

  if (res && res.blockedByRobots) {
    return { ok: false, messages: [], reason: 'robots.txt Telegram запрещает читать этот путь — радар не будет его обходить' };
  }
  if (!res || !res.ok || !res.text) {
    return { ok: false, messages: [], reason: `не удалось загрузить страницу (${(res && (res.error || res.status)) || 'нет ответа'})` };
  }

  const messages = parseChannelHtml(res.text, channel);
  if (!messages.length) {
    return {
      ok: false,
      messages: [],
      reason: 'постов не найдено — канал закрыт, не существует, или у него выключено веб-превью',
    };
  }
  return { ok: true, messages };
}

module.exports = { fetchChannelMessages, parseChannelHtml, normalizeChannelName };
