/* =========================================================
   РЕЗУЛЬТАТЫ ИГРОКА
   - Личный рекорд (лучшее время) — хранится в localStorage.
   - Достижения — простые условия, разблокируются один раз.
   - Генерация картинки-результата для "Поделиться".
   ========================================================= */
const GameResults = (function () {
  const BEST_KEY = 'neuroOtlichnikBest';
  const ACHIEV_KEY = 'neuroOtlichnikAchievements';
  const WINS_KEY = 'neuroOtlichnikWins';
  const PROMO_CLAIMED_KEY = 'neuroOtlichnikPromoClaimed';
  const CURRENT_LEVEL_KEY = 'neuroOtlichnikCurrentLevel';

  // ---------- Незавершённый прогон — чтобы не начинать с уровня 1 каждый раз ----------
  function getCurrentLevelIndex() {
    try {
      const raw = localStorage.getItem(CURRENT_LEVEL_KEY);
      return raw === null ? null : parseInt(raw, 10);
    } catch (e) {
      return null;
    }
  }

  function setCurrentLevelIndex(index) {
    try {
      localStorage.setItem(CURRENT_LEVEL_KEY, String(index));
    } catch (e) {}
  }

  // Прогон закончен (все уровни пройдены) — при следующем "Играть"
  // снова начинаем с самого начала.
  function clearCurrentLevelIndex() {
    try {
      localStorage.removeItem(CURRENT_LEVEL_KEY);
    } catch (e) {}
  }

  // ---------- Промокод за подписку — выдаём только один раз ----------
  // Без этого можно было проходить уровни по кругу и каждый раз заново
  // "получать" промокод за одну и ту же подписку.
  function hasClaimedPromo() {
    try {
      return localStorage.getItem(PROMO_CLAIMED_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function claimPromo() {
    try {
      localStorage.setItem(PROMO_CLAIMED_KEY, '1');
    } catch (e) {}
  }

  // ---------- Личный рекорд ----------
  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getBestTime(levelId) {
    return loadBest()[levelId] || null;
  }

  // Сколько из перечисленных уровней игрок уже когда-либо проходил —
  // для прогресса на главном экране (по сохранённому рекорду времени).
  function getCompletedCount(levelIds) {
    const best = loadBest();
    return levelIds.filter((id) => best[id] != null).length;
  }

  // Возвращает { isNewRecord, best } — best всегда лучшее время после этой попытки.
  function submitTime(levelId, ms) {
    const best = loadBest();
    const prev = best[levelId];
    const isNewRecord = !prev || ms < prev;
    if (isNewRecord) {
      best[levelId] = ms;
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(best));
      } catch (e) {}
    }
    return { isNewRecord, best: isNewRecord ? ms : prev };
  }

  // ---------- Достижения ----------
  const ACHIEVEMENTS = [
    { id: 'first_win', label: '🏆 Первая победа', check: (ctx) => ctx.isFirstEverWin },
    { id: 'lightning', label: '⚡ Молния (меньше 20 сек)', check: (ctx) => ctx.timeMs < 20000 },
    { id: 'no_hints', label: '🎯 Без подсказок', check: (ctx) => ctx.hintsUsed === 0 }
  ];

  function loadUnlocked() {
    try {
      return JSON.parse(localStorage.getItem(ACHIEV_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function incrementWins() {
    const n = (parseInt(localStorage.getItem(WINS_KEY), 10) || 0) + 1;
    try {
      localStorage.setItem(WINS_KEY, String(n));
    } catch (e) {}
    return n;
  }

  // Принимает { timeMs, hintsUsed }, сам определяет "первая ли это победа".
  // Возвращает массив ВПЕРВЫЕ разблокированных в этот раз достижений.
  function evaluateAchievements({ timeMs, hintsUsed }) {
    const winNumber = incrementWins();
    const ctx = { timeMs, hintsUsed, isFirstEverWin: winNumber === 1 };
    const unlocked = loadUnlocked();
    const newly = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!unlocked.includes(a.id) && a.check(ctx)) {
        unlocked.push(a.id);
        newly.push(a);
      }
    });
    try {
      localStorage.setItem(ACHIEV_KEY, JSON.stringify(unlocked));
    } catch (e) {}
    return newly;
  }

  // ---------- Картинка-результат для шеринга ----------
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function ensureFontsLoaded() {
    const specs = [
      '700 60px KicaBold', '700 150px KicaBold', '600 32px InterTight', '400 60px Pershotravneva'
    ];
    try {
      await Promise.all(specs.map((s) => document.fonts.load(s)));
    } catch (e) {}
  }

  // Перекрашивает лаймовое PNG/SVG-изображение в сплошной цвет, сохраняя
  // прозрачность — так настоящий логотип можно сделать тёмно-серым,
  // чтобы он был виден на любом фоне (лайм на лайме не читается).
  function recolorImage(img, color) {
    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = color;
    octx.fillRect(0, 0, off.width, off.height);
    return off;
  }

  // Лёгкое зерно поверх картинки — рисуем один раз на маленьком холсте
  // и растягиваем, так быстрее, чем считать шум на весь размер.
  function drawGrain(ctx, w, h) {
    const tileW = 220;
    const tileH = Math.round((tileW * h) / w);
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = tileW;
    noiseCanvas.height = tileH;
    const nctx = noiseCanvas.getContext('2d');
    const imageData = nctx.createImageData(tileW, tileH);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    nctx.putImageData(imageData, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.drawImage(noiseCanvas, 0, 0, w, h);
    ctx.restore();
  }

  // Полутоновая (halftone) точечная заливка справа от диагональной линии,
  // соединяющей (x1,0)-(x2,H) — тот же приём, что и на баннере игры.
  // x1,y1 -> x2,y2: диагональная линия, точки рисуются только правее неё
  // и только ниже startY (выше — чистый белый фон, там точек быть не должно).
  function drawHalftone(ctx, w, h, topX, botX, startY) {
    const step = 30;
    ctx.fillStyle = 'rgba(42,42,42,0.28)';
    for (let gy = Math.ceil(startY / step) * step; gy < h; gy += step) {
      const t = (gy - startY) / (h - startY);
      const lineX = topX + (botX - topX) * t;
      for (let gx = Math.floor(lineX / step) * step; gx < w; gx += step) {
        const dist = gx - lineX;
        if (dist < -10) continue;
        const size = Math.max(2, Math.min(9, dist / 40));
        ctx.beginPath();
        ctx.arc(gx, gy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  async function buildResultImageBlob(timeText, userName) {
    await ensureFontsLoaded();

    // Формат как экран телефона (9:16) — удобно шерить в сторис/каналы.
    const W = 1080;
    const H = 1920;
    const ink = '#2a2a2a';
    const accent = '#dbfc3b';

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Диагональная лаймовая "лента" в нижней части — динамика вместо плоского фона.
    // Выше diagY0 — чистый белый фон. Ниже — лайм справа от диагональной линии,
    // идущей от (lineTopX, diagY0) до (lineBotX, H).
    const diagY0 = H * 0.42;
    const lineTopX = W * 0.62;
    const lineBotX = W * 0.08;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(lineTopX, diagY0);
    ctx.lineTo(W, diagY0);
    ctx.lineTo(W, H);
    ctx.lineTo(lineBotX, H);
    ctx.closePath();
    ctx.fill();

    drawHalftone(ctx, W, H, lineTopX, lineBotX, diagY0);

    // Толстая рамка — фирменный приём
    const inset = 32;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 14;
    roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, 48);
    ctx.stroke();

    // Настоящий логотип, перекрашенный в тёмно-серый (виден на любом фоне)
    try {
      const logoImg = await loadImage('assets/logo-full.svg');
      const logoCanvas = recolorImage(logoImg, ink);
      const logoW = W * 0.62;
      const logoH = logoCanvas.height * (logoW / logoCanvas.width);
      ctx.save();
      ctx.translate(W * 0.08 + logoW / 2, 130 + logoH / 2);
      ctx.rotate((-2 * Math.PI) / 180);
      ctx.drawImage(logoCanvas, -logoW / 2, -logoH / 2, logoW, logoH);
      ctx.restore();
    } catch (e) {
      /* если логотип не загрузился — просто продолжаем без него */
    }

    // Рукописный тег-лайн
    ctx.fillStyle = ink;
    ctx.font = '400 46px Pershotravneva, cursive';
    ctx.textAlign = 'left';
    ctx.fillText('нашёл все отличия!', W * 0.08, 300);

    // Крупный бейдж с результатом. Если известно имя игрока — бейдж выше,
    // чтобы крупно, шрифтом KicaBold, поместилось "ОТЛИЧНИК: ИМЯ" —
    // персонализация должна бросаться в глаза, а не прятаться мелким текстом.
    const badgeX = W * 0.08;
    const badgeW = W * 0.84;
    const badgeY = 360;
    const badgeH = userName ? 560 : 430;
    ctx.fillStyle = accent;
    roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 40);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 10;
    roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 40);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '700 36px KicaBold, sans-serif';
    ctx.fillText('ВСЕ УРОВНИ ПРОЙДЕНЫ', W / 2, badgeY + 90);

    if (userName) {
      ctx.font = '700 32px KicaBold, sans-serif';
      ctx.fillText('🎓 ОТЛИЧНИК', W / 2, badgeY + 155);

      // Имя может быть длинным — подбираем самый крупный размер, который
      // помещается по ширине бейджа, а не просто уменьшаем его заранее.
      const maxNameWidth = badgeW * 0.88;
      let nameSize = 84;
      ctx.font = `700 ${nameSize}px KicaBold, sans-serif`;
      while (ctx.measureText(userName).width > maxNameWidth && nameSize > 32) {
        nameSize -= 4;
        ctx.font = `700 ${nameSize}px KicaBold, sans-serif`;
      }
      ctx.fillText(userName, W / 2, badgeY + 250);

      ctx.font = '700 130px KicaBold, sans-serif';
      ctx.fillText(timeText, W / 2, badgeY + 440);
    } else {
      ctx.font = '700 160px KicaBold, sans-serif';
      ctx.fillText(timeText, W / 2, badgeY + 300);
    }
    ctx.textAlign = 'left';

    // Маскот — бОльшая часть выходит за нижний край кадра
    try {
      const mascotImg = await loadImage('assets/mascot-hero.webp');
      const mh = H * 0.5;
      const mw = mascotImg.width * (mh / mascotImg.height);
      ctx.drawImage(mascotImg, W - mw - 40, H - mh + 40, mw, mh);
    } catch (e) {
      /* если картинка не загрузилась — просто пропускаем, остальное всё равно готово */
    }

    // Подпись внизу — на лаймовой ленте, тёмно-серым (контраст сохранён)
    ctx.fillStyle = ink;
    ctx.font = '600 30px InterTight, sans-serif';
    ctx.fillText('Игра «Найди 5 отличий» от студии', W * 0.08, H - 130);
    ctx.font = '700 42px KicaBold, sans-serif';
    ctx.fillText('neurootlichnik.ru', W * 0.08, H - 80);

    drawGrain(ctx, W, H);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // Пытается поделиться картинкой через нативное меню "Поделиться".
  // Возвращает true, если получилось (или пользователь открыл меню шеринга).
  async function shareResultImage(timeText, userName) {
    let blob;
    try {
      blob = await buildResultImageBlob(timeText, userName);
    } catch (e) {
      return false;
    }
    if (!blob) return false;

    const file = new File([blob], 'neuro-otlichnik-result.png', { type: 'image/png' });
    const shareText = userName
      ? `Я, ${userName}, прошёл(-ла) все уровни игры «Найди 5 отличий» за ${timeText}!`
      : `Я прошёл все уровни игры «Найди 5 отличий» за ${timeText}!`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Нейро Отличник',
          text: shareText
        });
        return true;
      } catch (e) {
        return false; // пользователь отменил — не считаем это ошибкой, просто не получилось
      }
    }

    // Нет поддержки шеринга файлом — просто скачиваем картинку, чтобы её можно было
    // переслать вручную.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neuro-otlichnik-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  }

  return {
    getBestTime,
    getCompletedCount,
    submitTime,
    evaluateAchievements,
    shareResultImage,
    hasClaimedPromo,
    claimPromo,
    getCurrentLevelIndex,
    setCurrentLevelIndex,
    clearCurrentLevelIndex
  };
})();
