/* =========================================================
   НЕЙРО СТЕЙДЖИНГ — каталог стилей и типов помещений
   ---------------------------------------------------------
   Это единственный файл, который правится "руками" при
   добавлении нового стиля. Ни в какой другой код лезть
   не нужно: интерфейс строится из этих массивов сам.

   Поле prompt — то, что уйдёт в модель генерации, когда
   заглушка будет заменена на настоящий пайплайн.
   ========================================================= */

const ROOM_TYPES = [
  { id: 'living',  label: 'Гостиная' },
  { id: 'kitchen', label: 'Кухня' },
  { id: 'bedroom', label: 'Спальня' },
  { id: 'bath',    label: 'Санузел' },
  { id: 'kids',    label: 'Детская' },
  { id: 'empty',   label: 'Пустая комната' }
];

const STYLE_PRESETS = [
  {
    id: 'scandi',
    label: 'Скандинавский',
    hint: 'Светлое дерево, белые стены, много воздуха',
    swatch: ['#f2efe8', '#d9c7a7', '#8a8175'],
    prompt: 'scandinavian interior, light oak floor, white walls, linen textiles, soft daylight'
  },
  {
    id: 'modern',
    label: 'Современный',
    hint: 'Нейтральные тона, прямые линии, мягкий свет',
    swatch: ['#e6e4df', '#9a9a95', '#3d3d3a'],
    prompt: 'modern contemporary interior, neutral palette, clean lines, indirect lighting'
  },
  {
    id: 'japandi',
    label: 'Джапанди',
    hint: 'Минимум предметов, тёплый минимализм',
    swatch: ['#efe9df', '#c2a98b', '#5c554c'],
    prompt: 'japandi interior, warm minimalism, natural wood, paper lamps, muted tones'
  },
  {
    id: 'classic',
    label: 'Неоклассика',
    hint: 'Молдинги, паркет ёлочкой, благородные цвета',
    swatch: ['#efe7dc', '#b8a68c', '#404a52'],
    prompt: 'neoclassical interior, wall mouldings, herringbone parquet, elegant furniture'
  },
  {
    id: 'loft',
    label: 'Лофт',
    hint: 'Кирпич, бетон, металл, тёплый свет',
    swatch: ['#d8cfc6', '#8d6f5c', '#4a4744'],
    prompt: 'loft interior, exposed brick, concrete, black metal frames, warm lamps'
  },
  {
    id: 'rental',
    label: 'Под сдачу',
    hint: 'Бюджетно и опрятно — то, что реально делают',
    swatch: ['#f0eeea', '#cfd6d3', '#6f7672'],
    prompt: 'simple affordable rental renovation, clean white walls, laminate floor, basic furniture'
  }
];

/* Режим выдачи: что именно нужно клиенту на выходе.

   ВАЖНО про площадки. Авито и Циан запрещают надписи и графику поверх
   изображения, поэтому подпись НЕ выжигается в кадр. Их правило другое:
   первым в галерее идёт реальный снимок, визуализация добавляется
   отдельными кадрами после него и помечается в ОПИСАНИИ объявления.
   Поэтому для режима "для объявления" мы отдаём готовый текст пометки,
   который риелтор вставляет в описание. */
const OUTPUT_MODES = [
  {
    id: 'listing',
    label: 'Для объявления',
    note: 'Отдадим готовый текст пометки для описания: надписи поверх фото площадки не пропускают',
    watermark: false,
    disclosure: 'Часть кадров — визуализация возможного ремонта, а не фотографии текущего состояния квартиры. Реальные снимки — первыми в галерее.'
  },
  {
    id: 'presentation',
    label: 'Для презентации',
    note: 'Чистый кадр для КП, соцсетей и показов — пометка не нужна',
    watermark: false,
    disclosure: ''
  }
];

window.NS_PRESETS = { ROOM_TYPES, STYLE_PRESETS, OUTPUT_MODES };
