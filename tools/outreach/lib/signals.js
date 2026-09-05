'use strict';
/*
 * Детектор «сигналов спроса» в тексте поста: человек ищет визуализацию.
 *
 * Логика простая и намеренно прозрачная — никакой чёрной коробки: набор
 * фраз намерения (кто-то ИЩЕТ подрядчика), набор предметных слов (речь
 * именно про визуализацию/рендер) и стоп-слова (это не заказ, а резюме,
 * вакансия в штат или реклама курсов). Правила легко править под себя в
 * radar.json — если радар шумит, добавьте стоп-слово, если пропускает —
 * добавьте фразу.
 */

const DEFAULT_RULES = {
  // Фразы «я ищу исполнителя» — сами по себе ещё не про нас
  intent: [
    'ищу',
    'ищем',
    'нужен',
    'нужна',
    'нужно',
    'требуется',
    'посоветуйте',
    'подскажите',
    'порекомендуйте',
    'кто делает',
    'кто может сделать',
    'ищу подрядчика',
    'есть заказ',
    'нужен подрядчик',
    'возьмётся',
    'возьмется',
  ],
  // Предметная область — про визуализацию
  subject: [
    'визуализац',
    'визуализатор',
    'рендер',
    '3d',
    '3д',
    'exterior',
    'интерьер',
    'экстерьер',
    'фасад',
    'подача',
    'ракурс',
    'архвиз',
    'archviz',
  ],
  // Усилители — почти наверняка платный заказ с дедлайном
  strong: [
    'бюджет',
    'оплата',
    'гонорар',
    'тендер',
    'конкурс',
    'дедлайн',
    'срочно',
    'к пятнице',
    'коммерческое предложение',
    'смета',
  ],
  // Это НЕ клиент: люди ищут работу, зовут в штат, продают курсы
  exclude: [
    'ищу работу',
    'ищу заказы',
    'резюме',
    'портфолио прикладываю',
    'выполню',
    'делаю визуализацию',
    'мои работы',
    'вакансия',
    'в штат',
    'курс',
    'обучение',
    'вебинар',
    'марафон',
    'набор на курс',
    'реклама',
    'партнерск',
  ],
  minScore: 3,
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Сопоставление с начала слова, но с любым окончанием: "визуализац" находит
// и "визуализацию", и "визуализации". Без привязки к началу слова стоп-слово
// "курс" срабатывало бы внутри "конкурса" и убивало валидные сигналы.
function hitsFor(haystack, words) {
  return (words || []).filter((word) => {
    const term = normalize(word);
    if (!term) return false;
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}`, 'u').test(haystack);
  });
}

/**
 * @param {string} text — текст поста
 * @param {object} [rules] — переопределения DEFAULT_RULES (из radar.json)
 * @returns {{matched: boolean, score: number, intent: string[], subject: string[], strong: string[], excluded: string[]}}
 */
function matchSignal(text, rules = {}) {
  const cfg = { ...DEFAULT_RULES, ...rules };
  const haystack = normalize(text);

  const excluded = hitsFor(haystack, cfg.exclude);
  const intent = hitsFor(haystack, cfg.intent);
  const subject = hitsFor(haystack, cfg.subject);
  const strong = hitsFor(haystack, cfg.strong);

  // Без предметной области сигнала нет вообще: "ищу дизайнера логотипа" — не наш клиент.
  // Без фразы намерения — это, скорее всего, чей-то отчёт о работе, а не запрос.
  const score = subject.length ? intent.length * 2 + subject.length + strong.length * 2 : 0;
  const matched = Boolean(subject.length && intent.length && !excluded.length && score >= cfg.minScore);

  return { matched, score, intent, subject, strong, excluded };
}

module.exports = { matchSignal, DEFAULT_RULES, normalize };
