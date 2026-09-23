/* =========================================================
   ИКОНКИ ДЛЯ КРУЖКОВ «АКТУАЛЬНОГО»
   Все иконки — линии толщиной 12 в поле 200×200, цвет берётся
   из currentColor (задаётся вариантом обложки). Лёгкое «дрожание»
   линии, как у фирменных дудлов, добавляется фильтром #wobble
   в render.html. 'about' — это логотип-очки, он грузится из
   assets/logo-icon.svg отдельно.
   ========================================================= */
const ICONS = {
  // До/После — слайдер сравнения, как на сайте студии
  beforeafter: `
    <defs><clipPath id="ba-left"><rect x="36" y="52" width="64" height="96"/></clipPath></defs>
    <g clip-path="url(#ba-left)" stroke-width="7">
      <path d="M30 88 L66 52 M30 118 L96 52 M30 148 L100 78 M56 152 L100 108 M86 152 L100 138"/>
    </g>
    <path d="M100 52 H152 Q164 52 164 64 V136 Q164 148 152 148 H100 Z" fill="currentColor" stroke="none"/>
    <rect x="36" y="52" width="128" height="96" rx="12"/>
    <path d="M100 30 V170"/>
    <circle cx="100" cy="100" r="17" fill="var(--bg)"/>
    <path d="M94 93 L88 100 L94 107 M106 93 L112 100 L106 107" stroke-width="6"/>`,

  // Кейсы — рамка-фото с силуэтом зданий и вторая рамка позади
  portfolio: `
    <path d="M62 40 H158 Q168 40 168 50 V124"/>
    <rect x="32" y="62" width="118" height="98" rx="12"/>
    <path d="M50 160 V116 H72 V96 H94 V160 M94 160 V108 H116 V126 H132 V160" stroke-width="9"/>
    <circle cx="124" cy="88" r="8" fill="currentColor" stroke="none"/>`,

  // Цены — рубль в ценнике
  price: `
    <path d="M44 104 L96 40 H156 Q164 40 164 48 V108 L100 172 Q94 178 88 172 L44 128 Q38 122 44 104 Z" transform="rotate(8 100 100)"/>
    <circle cx="140" cy="62" r="7" fill="currentColor" stroke="none" transform="rotate(8 100 100)"/>
    <g transform="rotate(8 100 100)" stroke-width="10">
      <path d="M92 74 V146 M92 74 H112 Q128 74 128 92 Q128 108 112 108 H80 M80 126 H116"/>
    </g>`,

  // Услуги — дом, который «проявляется» нейросетью (искра)
  services: `
    <path d="M38 164 V96 L96 50 L138 84"/>
    <path d="M154 104 V164 H38"/>
    <path d="M80 164 V128 H112 V164" stroke-width="10"/>
    <path d="M152 26 Q156 52 180 56 Q156 60 152 86 Q148 60 124 56 Q148 52 152 26 Z" fill="currentColor" stroke-width="6"/>`,

  // Как работаем — планшет с чек-листом (как у маскота в руках)
  process: `
    <rect x="46" y="42" width="108" height="132" rx="14"/>
    <rect x="76" y="28" width="48" height="28" rx="8" fill="currentColor"/>
    <path d="M66 90 L76 100 L94 82 M108 92 H136 M66 132 L76 142 L94 124 M108 134 H136" stroke-width="10"/>`,

  // Отзывы — облачко с сердцем
  reviews: `
    <path d="M48 46 H152 Q170 46 170 64 V120 Q170 138 152 138 H96 L64 164 V138 H48 Q30 138 30 120 V64 Q30 46 48 46 Z"/>
    <path d="M100 122 C70 104 68 78 86 76 C94 75 99 81 100 86 C101 81 106 75 114 76 C132 78 130 104 100 122 Z" fill="currentColor" stroke-width="6"/>`,

  // Вопросы — большой рукописный вопрос
  faq: `
    <path d="M62 70 Q62 30 102 30 Q142 30 142 66 Q142 90 118 100 Q100 108 100 128 V134" stroke-width="16"/>
    <circle cx="100" cy="166" r="11" fill="currentColor" stroke="none"/>
    <path d="M150 128 L166 120 M152 148 L172 150 M40 124 L26 116" stroke-width="8"/>`,

  // Бонус — лупа «найди 5 отличий»
  game: `
    <circle cx="86" cy="86" r="52"/>
    <path d="M124 124 L166 166" stroke-width="20"/>
    <text x="86" y="110" text-anchor="middle" font-family="KicaBold" font-size="72" fill="currentColor" stroke="none">5</text>`,

  // Заявка — бумажный самолётик
  contact: `
    <path d="M28 98 L170 36 L138 164 L100 130 Z"/>
    <path d="M170 36 L100 130 L96 168 L120 146" />
    <path d="M40 150 Q30 166 50 176 M20 128 Q10 140 18 150" stroke-width="7" stroke-dasharray="2 14"/>`
};
