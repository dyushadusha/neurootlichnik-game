'use strict';
/*
 * Минимальный клиент Telegram Bot API — без внешних зависимостей, на fetch.
 * Достаточно для бота с меню на inline-кнопках и long polling'ом (не нужен
 * ни публичный HTTPS, ни вебхук — бот может жить на любом сервере/ПК,
 * лишь бы был исходящий интернет).
 *
 * Документация: https://core.telegram.org/bots/api
 */

const API_ROOT = 'https://api.telegram.org';

class TelegramClient {
  constructor(token) {
    if (!token) throw new Error('Не задан токен Telegram-бота');
    this.token = token;
    this.base = `${API_ROOT}/bot${token}`;
  }

  async call(method, params = {}) {
    const res = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => null);
    if (!body || !body.ok) {
      throw new Error(`Telegram API ${method} failed: ${body ? JSON.stringify(body) : res.status}`);
    }
    return body.result;
  }

  /** Долгий поллинг обновлений. timeoutSec — сколько секунд Telegram держит соединение открытым. */
  getUpdates(offset, timeoutSec = 30) {
    return this.call('getUpdates', { offset, timeout: timeoutSec, allowed_updates: ['message', 'callback_query'] });
  }

  sendMessage(chatId, text, { replyMarkup } = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
      parse_mode: undefined, // сознательно без Markdown/HTML — меньше шансов сломать спецсимволами из названий компаний
    });
  }

  answerCallbackQuery(callbackQueryId, text) {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false });
  }

  editMessageText(chatId, messageId, text, { replyMarkup } = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup,
    });
  }
}

/** Инлайн-клавиатура из массива рядов кнопок [{text, data}]. */
function inlineKeyboard(rows) {
  return {
    inline_keyboard: rows.map((row) => row.map((btn) => ({ text: btn.text, callback_data: btn.data }))),
  };
}

// Telegram режет сообщения длиннее 4096 символов кодовых точек UTF-16.
const TELEGRAM_MAX_MESSAGE = 4096;

function splitForTelegram(text, limit = TELEGRAM_MAX_MESSAGE) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

module.exports = { TelegramClient, inlineKeyboard, splitForTelegram };
