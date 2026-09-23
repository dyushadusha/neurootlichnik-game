/* =========================================================
   ДВИЖОК СЛАЙДОВ INSTAGRAM «НЕЙРО ОТЛИЧНИК»
   Один набор шаблонов для постов-каруселей (1080×1440, 3:4)
   и для сторис (1080×1920). Стили — instagram/brand.css.

   Слайд описывается объектом { type, theme, ... }:
     cover   — обложка поста: title, kicker, sub, img | mascot
     text    — заголовок + абзац/пункты: title, text, bullets, mascot
     compare — «раньше / с нами»: title, rows [[тема, раньше, с нами]]
     ba      — до/после: title, before, after, caption
     photo   — работа на весь слайд: img, tag, caption
     grid    — 4 работы 2×2: title, imgs
     steps   — шаги: title, steps [[заголовок, текст]]
     qa      — вопрос-ответ: q, a
     cta     — призыв: title, text, keyword
   theme: 'dark' | 'lime' | 'white' (по умолчанию dark)
   ========================================================= */
const IG = (() => {
  const A = '../../assets/';     // фирменные ассеты игры
  const SRC = '../source/';      // рендеры и маскоты с сайта студии
  let LOGO = '';                 // logo-full.svg, подгружается в init()

  async function init() {
    LOGO = (await (await fetch(A + 'logo-full.svg')).text())
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace('<svg', '<svg style="width:100%;height:auto;display:block"');
  }
  const logo = color => LOGO.replace(/#dbfc3b/gi, color);
  const img = f => /\//.test(f) ? f : SRC + f;
  const esc = s => String(s ?? '');
  // **жирный** → лаймовая подсветка
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>').replace(/\n/g, '<br>');

  // Прозрачный маскот из игры или «бумажный» с сайта (белый фон → multiply)
  function mascotHtml(m, cls = '') {
    if (!m) return '';
    const [file, style = ''] = Array.isArray(m) ? m : [m];
    const transparent = file.startsWith('mascot-');
    const src = transparent ? A + file : img(file);
    return `<img class="s-mascot ${transparent ? '' : 's-mascot--paper'} ${cls}" src="${src}" style="${style}" alt="">`;
  }

  function footer(o, theme, s) {
    if (o.story) return '';
    const ink = theme === 'dark' ? '#dbfc3b' : '#2a2a2a';
    const last = o.idx === o.total - 1;
    const busy = s.mascot || s.type === 'cta'; // справа маскот — не перекрываем его подписью
    return `<div class="s-foot">
      <div class="s-foot__logo">${logo(ink)}</div>
      ${busy ? '' : `<div class="s-foot__right">${last ? '' : '<span class="s-hand">листайте →</span>'}<span class="s-num">${o.idx + 1}/${o.total}</span></div>`}
    </div>`;
  }

  const T = {
    cover(s) {
      if (s.img) return `
        <img class="s-bg" src="${img(s.img)}" alt="">
        <div class="s-shade"></div>
        <div class="s-cover s-cover--photo">
          ${s.kicker ? `<div class="s-kicker">${md(s.kicker)}</div>` : ''}
          <div class="s-title s-title--xl">${md(s.title)}</div>
          ${s.sub ? `<div class="s-sub">${md(s.sub)}</div>` : ''}
        </div>`;
      return `
        <div class="s-cover">
          ${s.kicker ? `<div class="s-kicker">${md(s.kicker)}</div>` : ''}
          <div class="s-title s-title--xl">${md(s.title)}</div>
          ${s.sub ? `<div class="s-sub">${md(s.sub)}</div>` : ''}
          ${s.inset ? `<div class="s-inset">${s.inset.map(f => `<img src="${img(f)}" alt="">`).join('')}</div>` : ''}
        </div>
        ${mascotHtml(s.mascot)}`;
    },
    text(s) {
      return `<div class="s-body">
          ${s.kicker ? `<div class="s-kicker">${md(s.kicker)}</div>` : ''}
          <div class="s-title">${md(s.title)}</div>
          ${s.text ? `<div class="s-text">${md(s.text)}</div>` : ''}
          ${s.bullets ? `<ul class="s-list">${s.bullets.map(b => `<li>${md(b)}</li>`).join('')}</ul>` : ''}
          ${s.image ? `<img class="s-inline-img" src="${img(s.image)}" alt="">` : ''}
        </div>${mascotHtml(s.mascot)}`;
    },
    compare(s) {
      return `<div class="s-body">
          <div class="s-title">${md(s.title)}</div>
          <div class="s-cmp">
            <div class="s-cmp__head"><span></span><span>Раньше</span><span>С нами</span></div>
            ${s.rows.map(([k, a, b]) => `<div class="s-cmp__row"><span class="s-cmp__k">${md(k)}</span><span class="s-cmp__a">${md(a)}</span><span class="s-cmp__b">${md(b)}</span></div>`).join('')}
          </div>
          ${s.text ? `<div class="s-text">${md(s.text)}</div>` : ''}
        </div>${mascotHtml(s.mascot)}`;
    },
    ba(s) {
      return `<div class="s-body s-body--ba">
          ${s.title ? `<div class="s-title s-title--sm">${md(s.title)}</div>` : ''}
          <div class="s-ba">
            <div class="s-ba__item"><img src="${img(s.before)}" alt=""><span class="s-tag">${s.beforeLabel || 'ДО'}</span></div>
            <div class="s-ba__item"><img src="${img(s.after)}" alt=""><span class="s-tag s-tag--lime">${s.afterLabel || 'ПОСЛЕ'}</span></div>
          </div>
          ${s.caption ? `<div class="s-text s-text--sm">${md(s.caption)}</div>` : ''}
        </div>`;
    },
    photo(s) {
      return `<img class="s-bg" src="${img(s.img)}" alt="" style="${s.pos ? `object-position:${s.pos}` : ''}">
        <div class="s-shade s-shade--soft"></div>
        ${s.tag ? `<span class="s-tag s-tag--lime s-tag--corner">${md(s.tag)}</span>` : ''}
        ${s.caption ? `<div class="s-photo-cap">${md(s.caption)}</div>` : ''}`;
    },
    grid(s) {
      return `<div class="s-body">
          <div class="s-title s-title--sm">${md(s.title)}</div>
          <div class="s-grid">${s.imgs.map(f => `<img src="${img(f)}" alt="">`).join('')}</div>
          ${s.text ? `<div class="s-text s-text--sm">${md(s.text)}</div>` : ''}
        </div>`;
    },
    steps(s) {
      return `<div class="s-body">
          <div class="s-title">${md(s.title)}</div>
          <div class="s-steps">${s.steps.map(([h, t], i) => `
            <div class="s-step"><span class="s-step__n">${i + 1}</span><div><b>${md(h)}</b>${t ? `<p>${md(t)}</p>` : ''}</div></div>`).join('')}
          </div>
        </div>${mascotHtml(s.mascot)}`;
    },
    qa(s) {
      return `<div class="s-body">
          <div class="s-kicker">${md(s.kicker || 'Вопрос')}</div>
          <div class="s-bubble">${md(s.q)}</div>
          <div class="s-answer">${md(s.a)}</div>
        </div>${mascotHtml(s.mascot)}`;
    },
    cta(s) {
      return `<div class="s-body s-body--cta">
          <div class="s-title s-title--xl">${md(s.title)}</div>
          ${s.text ? `<div class="s-text">${md(s.text)}</div>` : ''}
          ${s.keyword ? `<div class="s-key">Напишите в директ<br><span>«${s.keyword}»</span></div>` : ''}
          ${s.link ? `<div class="s-hand s-hand--big">${md(s.link)}</div>` : ''}
        </div>${mascotHtml(s.mascot || 'mascot-hero.webp', 's-mascot--cta')}`;
    }
  };

  function slide(s, o) {
    const theme = s.theme || 'dark';
    return `<div class="slide slide--${theme} ${o.story ? 'slide--story' : ''} slide--${s.type} ${s.mascot ? 'has-mascot' : ''}" id="${o.id}">
      ${T[s.type](s)}
      ${footer(o, theme, s)}
    </div>`;
  }

  return { init, slide, logo, md };
})();
