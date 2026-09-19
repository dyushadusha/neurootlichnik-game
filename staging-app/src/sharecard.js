/* =========================================================
   КАРТОЧКА ДЛЯ ШЕРИНГА — единица роста продукта
   ---------------------------------------------------------
   Это то, что человек отправляет жене, родителям и в чат
   "смотрим квартиры". Каждая отправка — реклама сервиса,
   поэтому на карточке обязательно: цифры (ради них шлют),
   картинка "было/стало" (ради неё смотрят) и наш адрес
   (ради него мы это делаем).

   Размер 1080×1350 — вертикаль, которую не обрезают ни
   Telegram, ни WhatsApp, ни истории.
   ========================================================= */
(function () {
  const W = 1080;
  const H = 1350;
  const INK = '#2a2a2a';
  const ACCENT = '#dbfc3b';
  const PAPER = '#ffffff';

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Рисуем изображение "по обложке" в заданный прямоугольник.
  function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }

  function pill(ctx, text, x, y, bg, fg) {
    ctx.font = '600 26px InterTight, sans-serif';
    const padX = 20;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 46;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 23);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + h / 2 + 1);
  }

  /* totals — итоги объекта, before/after — Blob'ы одной комнаты. */
  async function build({ totals, beforeBlob, afterBlob, isDemo }) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // --- Верх: было и стало одной полосой ---
    const imgY = 150;
    const imgH = 500;
    const [before, after] = await Promise.all([
      loadImage(URL.createObjectURL(beforeBlob)),
      loadImage(URL.createObjectURL(afterBlob))
    ]);
    drawCover(ctx, before, 0, imgY, W / 2, imgH);
    drawCover(ctx, after, W / 2, imgY, W / 2, imgH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W / 2, imgY);
    ctx.lineTo(W / 2, imgY + imgH);
    ctx.stroke();
    pill(ctx, 'Было', 30, imgY + 30, INK, PAPER);
    pill(ctx, 'Стало', W / 2 + 30, imgY + 30, ACCENT, INK);

    // --- Шапка ---
    ctx.fillStyle = INK;
    ctx.font = '700 58px KicaBold, InterTight, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Сколько стоит вход', 60, 92);
    ctx.font = '300 30px KicaLight, InterTight, sans-serif';
    ctx.fillStyle = '#6b6b6b';
    ctx.fillText('цена квартиры вместе с ремонтом', 60, 132);

    // --- Цифры ---
    let y = imgY + imgH + 80;
    const line = (label, value, bold) => {
      ctx.font = '600 32px InterTight, sans-serif';
      ctx.fillStyle = '#6b6b6b';
      ctx.fillText(label, 60, y);
      ctx.font = bold
        ? '700 56px KicaBold, InterTight, sans-serif'
        : '700 40px KicaBold, InterTight, sans-serif';
      ctx.fillStyle = INK;
      const w = ctx.measureText(value).width;
      ctx.fillText(value, W - 60 - w, y + (bold ? 6 : 2));
      y += bold ? 104 : 76;
    };

    if (totals.listingText) line('Квартира по объявлению', totals.listingText);
    line(`Ремонт${totals.area ? ` · ${totals.area} м²` : ''}`, totals.renovationText);

    // Разделитель перед главной цифрой
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(60, y - 40);
    ctx.lineTo(W - 60, y - 40);
    ctx.stroke();
    y += 14;

    if (totals.entryText) {
      // Подсветка главной цифры — ради неё карточку и отправляют.
      ctx.fillStyle = ACCENT;
      ctx.fillRect(40, y - 62, W - 80, 96);
      line('Цена входа', totals.entryText, true);
      if (totals.renovationShare) {
        ctx.font = '600 30px InterTight, sans-serif';
        ctx.fillStyle = '#6b6b6b';
        ctx.fillText(`Ремонт — ${totals.renovationShare}% от всей суммы`, 60, y - 24);
      }
    } else {
      line('Срок работ', `≈ ${totals.days} дней`, true);
    }

    // --- Состав объекта и срок: заполняют паузу перед подвалом
    //     и снимают вопрос "а это вообще про что" ---
    ctx.font = '600 30px InterTight, sans-serif';
    ctx.fillStyle = '#6b6b6b';
    const roomsWord = (n) => {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'комната';
      if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'комнаты';
      return 'комнат';
    };
    const roomsCount = totals.rooms ? totals.rooms.length : 0;
    if (roomsCount) {
      ctx.fillText(`${roomsCount} ${roomsWord(roomsCount)} · ${totals.area} м²`, 60, y + 24);
    }
    if (totals.days) {
      ctx.fillText(`Срок работ ≈ ${totals.days} дней`, 60, y + 72);
    }

    // --- Подвал: оговорка и адрес ---
    ctx.font = '300 26px KicaLight, InterTight, sans-serif';
    ctx.fillStyle = '#8a8a8a';
    ctx.fillText('Предварительный расчёт по фото. Точная смета — после замера.', 60, H - 96);
    ctx.font = '700 34px KicaBold, InterTight, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText('Нейро Отличник · neurootlichnik.ru', 60, H - 48);

    if (isDemo) {
      // Правый верхний угол: там пусто и бейдж ничего не перекрывает.
      pill(ctx, 'ДЕМО-РЕЖИМ', W - 250, 46, ACCENT, INK);
    }

    return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  window.NS_ShareCard = { build };
})();
