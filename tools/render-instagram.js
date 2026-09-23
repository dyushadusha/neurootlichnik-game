/* =========================================================
   Сохраняет всё оформление Instagram в PNG (папки out/):
     instagram/highlights/out/ — обложки кружков, заставки, сторис
     instagram/posts/out/      — слайды 12 постов + captions.md
     instagram/profile/out/    — аватар и макет профиля
   Запуск: npm run render-instagram
   Нужен Playwright (npm i -D playwright, или глобально).
   ========================================================= */
const path = require('path');
const fs = require('fs');
const http = require('http');
const vm = require('vm');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const IG = path.join(ROOT, 'instagram');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf' };

// Мини-сервер: шрифты и fetch() не работают через file://
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// Какая страница → какие элементы → куда сохранить
const PAGES = [
  {
    page: 'instagram/highlights/render.html',
    out: 'highlights/out',
    selector: '[id^="cover-"], [id^="story-"], [id^="intro-"], #cta, [id^="preview-"], [id^="hs-"]',
    file(id) {
      const m = id.match(/^(cover|story)-(dark|lime|white)-(.+)$/);
      if (m) return `${m[1] === 'cover' ? 'covers' : 'covers-story'}/${m[2]}/${m[3]}.png`;
      if (id.startsWith('intro-')) return `intro/${id.slice(6)}.jpg`;
      const s = id.match(/^hs-(.+)-(\d+)$/);
      if (s) return `stories/${s[1]}/${s[2]}.jpg`;
      if (id === 'cta') return 'cta.jpg';
      return `${id}.png`;
    }
  },
  {
    page: 'instagram/posts/render.html',
    out: 'posts/out',
    selector: '[id^="post-"]',
    file(id) { const m = id.match(/^post-(.+)-(\d+)$/); return `${m[1]}/${m[2]}.jpg`; }
  },
  {
    page: 'instagram/profile/render.html',
    out: 'profile/out',
    selector: '[data-shot]',
    file(id) { return `${id}.png`; }
  }
];

// Описания постов → один файл, чтобы копировать в Instagram
function writeCaptions() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(IG, 'posts/data.js'), 'utf8') + '\nthis.POSTS = POSTS;', ctx);
  const posts = ctx.POSTS;
  let md = '# Описания постов — копируйте как есть\n\n' +
    'Публикуйте **снизу вверх**: сначала пост 12, последним — пост 1. Затем закрепите посты 1, 2, 3.\n\n';
  [...posts].reverse().forEach((p, i) => {
    md += `---\n\n## Шаг ${i + 1}: пост ${p.id}${p.pin ? ' 📌 закрепить' : ''}\n\n` +
      `Картинки: \`posts/out/${p.id}/\` (${p.slides.length} слайдов, по порядку)  \n` +
      `Для кого: ${p.audience}  \nБоль: ${p.pain}\n\n` + '```\n' + p.caption + '\n```\n\n';
  });
  fs.writeFileSync(path.join(IG, 'posts/out/captions.md'), md);
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const only = process.argv[2]; // можно рендерить одну страницу: node tools/render-instagram.js posts
  for (const P of PAGES) {
    if (only && !P.page.includes(only)) continue;
    if (!fs.existsSync(path.join(ROOT, P.page))) continue;
    const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
    await page.goto(`http://localhost:${server.address().port}/${P.page}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
    const OUT = path.join(IG, P.out);
    fs.rmSync(OUT, { recursive: true, force: true });
    const ids = await page.$$eval(P.selector, els => els.map(e => e.id || e.dataset.shot));
    for (const id of ids) {
      const file = path.join(OUT, P.file(id));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const loc = page.locator(`[id="${id}"], [data-shot="${id}"]`).first();
      // Слайды с фото — в JPG (Instagram всё равно пережимает), иконки и аватары — в PNG
      await loc.screenshot(file.endsWith('.jpg') ? { path: file, type: 'jpeg', quality: 92 } : { path: file });
    }
    console.log(`✓ ${P.page}: ${ids.length} картинок`);
    await page.close();
  }
  if (!only || 'posts'.includes(only)) writeCaptions();
  await browser.close();
  server.close();
})();
