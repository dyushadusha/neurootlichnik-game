'use strict';
/*
 * Варианты частей письма. generate-drafts.js детерминированно выбирает по
 * одному варианту каждого блока для каждого лида (по хэшу от компании) и
 * подставляет факты — так писем становится N_subject × N_opening × N_cta
 * текстово различных комбинаций, и при этом ни одна не звучит как рыба
 * из мгновенно узнаваемого шаблона рассылки.
 */

const { pickIndex } = require('./hash');

const SUBJECTS = [
  ({ company }) => `Рендеры для ${company} — быстрее классической визуализации`,
  ({ company }) => `${company}: визуализация по вашей BIM/CAD-модели за пару дней`,
  () => 'Точная архитектурная визуализация без "фантазий" нейросети',
  ({ city }) => `Для архитекторов${city ? ` из ${city}` : ''}: рендер со 100%-й геометрией`,
  ({ company }) => `Коротко про визуализацию для ${company}`,
];

const OPENINGS = [
  ({ company }) => `Добрый день! Пишу из студии «Нейро Отличник» — увидели ${company} и подумали, что вам может пригодиться то, чем мы занимаемся.`,
  ({ company }) => `Здравствуйте! Меня зовут Нейро Отличник (это и правда имя нашей студии) — коротко расскажу, чем мы можем быть полезны ${company}.`,
  () => `Добрый день! Мы — студия архитектурной нейровизуализации «Нейро Отличник», делаем рендеры по BIM/CAD-моделям заказчика.`,
  ({ company }) => `Здравствуйте! Пишу без долгих предисловий: ${company} наверняка периодически нужны визуализации к срокам, которые «вчера».`,
];

// «Крючок» — под конкретную специализацию, если удалось её угадать по сайту
// компании (см. lib/emails.js#extractVisibleText + generate-drafts.js).
const HOOK_BY_PRODUCT = {
  'default': ({ brand }) => brand.differentiator,
  'residential': ({ brand }) => `Для жилых проектов чаще всего важна продающая картинка к старту продаж — делаем такую визуализацию быстро и без искажения геометрии проекта.`,
  'pitch': ({ brand }) => `Для конкурсных подач умеем отдавать 10–30 ракурсов за 2–3 дня — без потери точности геометрии под дедлайн тендера.`,
  'bim': ({ brand }) => `Работаем напрямую из BIM/CAD в визуал — без пересборки сцены и с гарантией 100% попадания в геометрию модели.`,
  'facade': ({ brand }) => `Умеем "освежать" фасадные рендеры и делать реконцепцию облика объекта без пересчёта всей сцены.`,
  'interior': ({ brand }) => `Делаем интерьерные визуализации — от жилых интерьеров до коммерческих пространств — с той же точностью по геометрии.`,
  'video': ({ brand }) => `Также делаем презентационные видео для инвесторов и тендеров на основе тех же точных рендеров.`,
  'before-after': ({ brand }) => `Если нужно просто "освежить" уже готовые рендеры без пересчёта сцены — это дешевле и быстрее визуализации с нуля.`,
};

const VALUE_COMBOS = [
  ({ brand }) => [brand.valueProps.speed, brand.valueProps.accuracy],
  ({ brand }) => [brand.valueProps.price, brand.valueProps.accuracy],
  ({ brand }) => [brand.valueProps.speed, brand.valueProps.price],
  ({ brand }) => [brand.valueProps.integration, brand.valueProps.accuracy],
];

const CTAS = [
  ({ brand }) => `Если интересно — можем сделать один тестовый ракурс по вашей модели бесплатно, чтобы вы сами оценили точность. Пришлёте референс?`,
  ({ brand }) => `Пришлите модель или пару рендеров, которые нужно "освежить" — за день скажем сроки и стоимость.`,
  ({ brand }) => `Готовы показать портфолио по вашему типу объектов — просто ответьте на это письмо.`,
  ({ brand }) => `Если сейчас не актуально — не страшно, будем рады, если вспомните о нас, когда понадобится быстрая визуализация.`,
];

const SIGN_OFFS = ['С уважением,', 'Хорошего дня!', 'Будем на связи,', 'Спасибо за внимание,'];

function pick(seed, salt, arr, ctx) {
  return arr[pickIndex(seed, salt, arr.length)](ctx);
}

/**
 * @param {object} ctx — { company, city, website, hookProductId, brand }
 * @returns {{ subject: string, text: string }}
 */
function buildEmail(ctx) {
  const seed = `${ctx.company}|${ctx.website || ctx.city}`;
  const brand = ctx.brand;

  const subject = pick(seed, 'subject', SUBJECTS, ctx);
  const opening = pick(seed, 'opening', OPENINGS, ctx);
  const hookFn = HOOK_BY_PRODUCT[ctx.hookProductId] || HOOK_BY_PRODUCT.default;
  const hook = hookFn({ brand });
  const values = pick(seed, 'values', VALUE_COMBOS, ctx);
  const cta = pick(seed, 'cta', CTAS, ctx);
  const signOff = SIGN_OFFS[pickIndex(seed, 'signoff', SIGN_OFFS.length)];

  const lines = [
    opening,
    '',
    hook,
    '',
    `Коротко по цифрам: ${values[0]}; ${values[1]}.`,
    `Ориентир по цене: ${brand.pricingAnchor}.`,
    '',
    cta,
    '',
    signOff,
    brand.brand,
    brand.website,
    `Telegram-канал: ${brand.telegramChannel}`,
    '',
    brand.unsubscribeNote,
  ];

  return { subject, text: lines.join('\n') };
}

module.exports = { buildEmail };
