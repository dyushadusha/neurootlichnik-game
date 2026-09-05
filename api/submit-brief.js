// =============================================================
// Serverless-функция (Vercel) — принимает заявку с калькулятора
// в brief.html и пересылает её в Telegram.
//
// Настройка (переменные окружения проекта в Vercel, не в коде):
//   TELEGRAM_BOT_TOKEN — токен бота, полученный у @BotFather (/newbot)
//   TELEGRAM_CHAT_ID   — куда слать: id личного чата (узнать через
//                        @userinfobot) или id группы/канала
//   ALLOWED_ORIGIN     — домен вашего сайта (необязательно,
//                        по умолчанию разрешены все источники)
//
// После деплоя впишите публичный адрес этой функции
// (https://<ваш-проект>.vercel.app/api/submit-brief) в константу
// SUBMIT_ENDPOINT внутри brief.html.
// =============================================================

module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};

  // Honeypot — обычные посетители это поле не видят и не заполняют.
  // Если оно заполнено, значит заявку прислал бот — тихо игнорируем.
  if (body.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = String(body.name || '').trim();
  const contact = String(body.contact || '').trim();
  if (!name || !contact) {
    res.status(400).json({ error: 'Не хватает имени или контакта' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    res.status(500).json({ error: 'Бот не настроен на сервере (нет TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)' });
    return;
  }

  // brief.html уже собирает готовый читаемый текст заявки (summaryText) —
  // переиспользуем его, чтобы не дублировать расшифровку значений формы
  // (типа "interior" → "Интерьер") ещё раз здесь.
  const summary = String(body.summaryText || '').trim();
  const text = '🆕 ' + (summary || `Новая заявка от ${name} (${contact})`);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!tgRes.ok) {
      res.status(502).json({ error: 'Telegram отклонил сообщение' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Не удалось отправить в Telegram' });
  }
};
