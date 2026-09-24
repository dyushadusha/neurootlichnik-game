/* =========================================================
   «АКТУАЛЬНОЕ» В INSTAGRAM — ЕДИНЫЙ СПИСОК КРУЖКОВ
   Порядок в массиве = порядок кружков в профиле слева направо.
   Меняете название/подзаголовок здесь → перезапускаете
   `npm run render-instagram` → все картинки пересобираются.
   Сторис внутри кружков — stories.js, логика — STRUCTURE.md.
   ========================================================= */
const HIGHLIGHTS = [
  {
    id: '01-start',
    name: 'Старт',
    icon: 'start',
    doodle: 'sparkle',
    title: 'Старт',
    hook: 'Кто мы, что делаем и как заказать — за 30 секунд. Начните отсюда'
  },
  {
    id: '02-raboty',
    name: 'Работы',
    icon: 'portfolio',
    doodle: 'check',
    title: 'Работы',
    hook: 'Фасады, интерьеры, кварталы и концепции — всё по моделям заказчиков'
  },
  {
    id: '03-video',
    name: 'Видео',
    icon: 'video',
    doodle: 'wave',
    title: 'AI-видео',
    hook: 'Оживляем проекты: пролёты, смена света и времени суток, ролики для презентаций'
  },
  {
    id: '04-o-nas',
    name: 'О нас',
    icon: 'about',
    doodle: 'spiral-a',
    title: 'О нас',
    hook: 'Первая в России студия нейровизуализации. Мы пришли из архитектуры — здесь нельзя «примерно»'
  },
  {
    id: '05-pdf',
    name: 'PDF',
    icon: 'pdf',
    doodle: 'arrow-curve',
    title: 'PDF-гид',
    hook: '«Из модели в кадр» — бесплатно в нашем Telegram-боте'
  },
  {
    id: '06-voprosy',
    name: 'Вопросы',
    icon: 'faq',
    doodle: 'squiggle-v',
    title: 'Частые вопросы',
    hook: 'ИИ не придумает лишних окон? А если нужны правки? Отвечаем на всё, что обычно спрашивают'
  },
  {
    id: '07-process',
    name: 'Процесс',
    icon: 'process',
    doodle: 'arrow-right',
    title: 'Процесс',
    hook: 'Что прислать, сколько ждать и как вносятся правки — от модели до финального кадра за 4 шага'
  },
  {
    id: '08-do-posle',
    name: 'До/После',
    icon: 'beforeafter',
    doodle: 'arrow-curve',
    title: 'До / После',
    hook: 'Скриншот из Archicad, Revit или SketchUp → готовый кадр. Смотрите сами'
  },
  {
    id: '09-uslugi',
    name: 'Услуги',
    icon: 'services',
    doodle: 'spiral-a',
    title: 'Услуги',
    hook: 'ИИ-рендеры, обновление рендеров и AI-видео — для архбюро, дизайнеров и девелоперов'
  },
  {
    id: '10-stoimost',
    name: 'Стоимость',
    icon: 'price',
    doodle: 'percent',
    title: 'Стоимость',
    hook: 'ИИ-визуализация — от 3 000 ₽ за кадр. Как считаем и что прислать для точного расчёта'
  }
];

/* Контакты — используются в сторис, призыве и на странице ссылок */
const CONTACTS = {
  manager: 'Андрей',
  telegram: '@dyushadusha',
  telegramUrl: 'https://t.me/dyushadusha',
  pdfBot: '@NeuroOtlichnikBot',
  site: 'neurootlichnik.ru'
};

/* Цветовые варианты обложек (фирменная палитра — 3 цвета) */
const VARIANTS = {
  dark:  { bg: '#2a2a2a', ink: '#dbfc3b', shadow: null },       // графит + лаймовая иконка (как сайт)
  lime:  { bg: '#dbfc3b', ink: '#2a2a2a', shadow: null },       // лайм + графитовая иконка
  white: { bg: '#ffffff', ink: '#2a2a2a', shadow: '#dbfc3b' }   // «стикер» как в игре: белый + лаймовая тень
};
