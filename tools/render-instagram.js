/* =========================================================
   Сохраняет всё из instagram/highlights/render.html в PNG:
     instagram/highlights/out/covers/<вариант>/…      — обложки 1080×1080
     instagram/highlights/out/covers-story/<вариант>/… — обложки 1080×1920
     instagram/highlights/out/intro/…                  — заставки сторис
     instagram/highlights/out/cta.png                  — финальный слайд
     instagram/highlights/out/preview-<вариант>.png    — превью профиля
   Запуск: npm run render-instagram
   Нужен Playwright (npm i -D playwright, или глобально).
   ========================================================= */
const path = require('path');
const fs = require('fs');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'instagram/highlights/out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };

// Мини-сервер: шрифты и fetch() не работают через file://
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
  await page.goto(`http://localhost:${server.address().port}/instagram/highlights/render.html`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });

  fs.rmSync(OUT, { recursive: true, force: true });
  const ids = await page.$$eval('[id^="cover-"], [id^="story-"], [id^="intro-"], #cta, [id^="preview-"]', els => els.map(e => e.id));
  for (const id of ids) {
    let rel;
    const m = id.match(/^(cover|story)-(dark|lime|white)-(.+)$/);
    if (m) rel = `${m[1] === 'cover' ? 'covers' : 'covers-story'}/${m[2]}/${m[3]}.png`;
    else if (id.startsWith('intro-')) rel = `intro/${id.slice(6)}.png`;
    else rel = `${id}.png`;
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.locator('#' + id).screenshot({ path: file });
    console.log('✓', rel);
  }
  await browser.close();
  server.close();
})();
