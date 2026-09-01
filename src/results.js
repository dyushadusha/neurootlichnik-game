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
    const specs = ['700 64px KicaBold', '700 150px KicaBold', '600 34px InterTight'];
    try {
      await Promise.all(specs.map((s) => document.fonts.load(s)));
    } catch (e) {}
  }

  async function buildResultImageBlob(timeText) {
    await ensureFontsLoaded();

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const inset = 36;
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 14;
    roundRectPath(ctx, inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, 48);
    ctx.stroke();

    // Лого-надпись
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = '700 60px KicaBold, sans-serif';
    const nText = 'НЕЙРО ';
    const oText = 'ОТЛИЧНИК';
    const startX = 90;
    const startY = 160;
    const nWidth = ctx.measureText(nText).width;
    const oWidth = ctx.measureText(oText).width;
    ctx.fillStyle = '#dbfc3b';
    ctx.fillRect(startX + nWidth - 6, startY - 50, oWidth + 24, 62);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillText(nText, startX, startY);
    ctx.fillText(oText, startX + nWidth + 6, startY);

    // Бейдж с результатом
    const badgeY = 320;
    const badgeH = 360;
    ctx.fillStyle = '#dbfc3b';
    roundRectPath(ctx, 90, badgeY, canvas.width - 180, badgeH, 40);
    ctx.fill();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 10;
    roundRectPath(ctx, 90, badgeY, canvas.width - 180, badgeH, 40);
    ctx.stroke();

    ctx.fillStyle = '#2a2a2a';
    ctx.textAlign = 'center';
    ctx.font = '700 42px KicaBold, sans-serif';
    ctx.fillText('НАЙДЕНО 5 ИЗ 5', canvas.width / 2, badgeY + 90);
    ctx.font = '700 140px KicaBold, sans-serif';
    ctx.fillText(timeText, canvas.width / 2, badgeY + 250);
    ctx.textAlign = 'left';

    // Маскот
    try {
      const mascotImg = await loadImage('assets/mascot-hero.webp');
      const mh = 420;
      const mw = mascotImg.width * (mh / mascotImg.height);
      ctx.drawImage(mascotImg, canvas.width - mw - 50, canvas.height - mh - 110, mw, mh);
    } catch (e) {
      /* если картинка не загрузилась — просто пропускаем, остальное всё равно готово */
    }

    // Подпись внизу
    ctx.fillStyle = '#2a2a2a';
    ctx.font = '600 32px InterTight, sans-serif';
    ctx.fillText('Игра «Найди 5 отличий» от студии', 90, canvas.height - 140);
    ctx.font = '700 40px KicaBold, sans-serif';
    ctx.fillText('neurootlichnik.ru', 90, canvas.height - 90);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // Пытается поделиться картинкой через нативное меню "Поделиться".
  // Возвращает true, если получилось (или пользователь открыл меню шеринга).
  async function shareResultImage(timeText) {
    let blob;
    try {
      blob = await buildResultImageBlob(timeText);
    } catch (e) {
      return false;
    }
    if (!blob) return false;

    const file = new File([blob], 'neuro-otlichnik-result.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Нейро Отличник',
          text: `Я нашёл 5 отличий за ${timeText} в игре от Нейро Отличник!`
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

  return { getBestTime, submitTime, evaluateAchievements, shareResultImage };
})();
