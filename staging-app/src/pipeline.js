/* =========================================================
   ПАЙПЛАЙН ГЕНЕРАЦИИ — точка подмены
   ---------------------------------------------------------
   Сейчас работает ЗАГЛУШКА: кадр обрабатывается прямо в
   телефоне (тонировка под выбранный стиль + подпись). Это
   нужно, чтобы вся механика продукта — загрузка, выбор,
   ожидание, "было/стало", списание кадров — щупалась на
   реальных фото и без единого рубля на GPU.

   Когда выберем модель, здесь появится второй режим:
   запрос на наш сервер, который держит очередь и ходит в
   модель. Интерфейс функции не меняется — значит, весь
   остальной код останется как есть.

   Переключатель — NS_CONFIG.MODE: 'mock' | 'remote'.
   ========================================================= */
(function () {
  const MAX_SIDE = 1600; // больше на телефоне не нужно, а памяти ест много

  // Тонировка под каждый стиль: [фильтр CSS, цвет подмешивания, сила]
  const LOOKS = {
    scandi:  { filter: 'brightness(1.10) contrast(1.04) saturate(0.88)', tint: '#f6efe2', alpha: 0.18 },
    modern:  { filter: 'brightness(1.05) contrast(1.10) saturate(0.82)', tint: '#e9e9e6', alpha: 0.14 },
    japandi: { filter: 'brightness(1.06) contrast(1.02) saturate(0.90)', tint: '#e8d9c3', alpha: 0.20 },
    classic: { filter: 'brightness(1.04) contrast(1.08) saturate(0.95)', tint: '#e7dcc9', alpha: 0.16 },
    loft:    { filter: 'brightness(0.98) contrast(1.16) saturate(0.92)', tint: '#c9a98c', alpha: 0.18 },
    rental:  { filter: 'brightness(1.12) contrast(1.00) saturate(0.80)', tint: '#f1f2f0', alpha: 0.16 }
  };

  function loadImage(blobOrUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось открыть изображение'));
      img.src = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    });
  }

  function fitSize(w, h) {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  // Приводим любое входящее фото к нормальному размеру и формату.
  async function normalize(blob) {
    const img = await loadImage(blob);
    const { w, h } = fitSize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  function drawWatermark(ctx, w, h) {
    // Подпись по нижнему краю: обязательна для кадров в объявления.
    const pad = Math.round(Math.min(w, h) * 0.03);
    const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.032));
    ctx.font = `600 ${fontSize}px InterTight, sans-serif`;
    const text = 'ВИЗУАЛИЗАЦИЯ · НЕ ФОТОГРАФИЯ';
    const metrics = ctx.measureText(text);
    const boxW = metrics.width + pad * 1.6;
    const boxH = fontSize + pad;
    const x = w - boxW - pad;
    const y = h - boxH - pad;

    ctx.fillStyle = 'rgba(42,42,42,0.82)';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = '#dbfc3b';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pad * 0.8, y + boxH / 2);
  }

  function drawDemoBadge(ctx, w, h) {
    // Явно помечаем, что это заглушка, чтобы демо-кадр никто
    // случайно не принял за результат настоящей генерации.
    const pad = Math.round(Math.min(w, h) * 0.03);
    const fontSize = Math.max(13, Math.round(Math.min(w, h) * 0.028));
    ctx.font = `700 ${fontSize}px KicaBold, InterTight, sans-serif`;
    const text = 'ДЕМО-РЕЖИМ';
    const boxW = ctx.measureText(text).width + pad * 1.4;
    const boxH = fontSize + pad * 0.9;
    // Левый нижний угол: сверху сидят метки "Было/Стало", справа — подпись.
    const y = h - boxH - pad;
    ctx.fillStyle = '#dbfc3b';
    ctx.fillRect(pad, y, boxW, boxH);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
    ctx.strokeRect(pad, y, boxW, boxH);
    ctx.fillStyle = '#2a2a2a';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + pad * 0.7, y + boxH / 2);
  }

  /* ---------- Режим 1: заглушка прямо в телефоне ---------- */
  async function renderMock(beforeBlob, { styleId, watermark }, onProgress) {
    const steps = [
      [12, 'Читаем геометрию помещения'],
      [34, 'Определяем окна и источники света'],
      [58, 'Подбираем материалы под стиль'],
      [79, 'Расставляем мебель'],
      [94, 'Сводим свет и цвет']
    ];
    for (const [pct, label] of steps) {
      onProgress?.(pct, label);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 450));
    }

    const img = await loadImage(beforeBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    const look = LOOKS[styleId] || LOOKS.modern;

    ctx.filter = look.filter;
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    // Подмешиваем цвет стиля.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = look.alpha;
    ctx.fillStyle = look.tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Лёгкая виньетка — чтобы кадр читался "срежиссированным".
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.25,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (watermark) drawWatermark(ctx, canvas.width, canvas.height);
    drawDemoBadge(ctx, canvas.width, canvas.height);

    onProgress?.(100, 'Готово');
    return await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  /* ---------- Режим 2: наш сервер (появится позже) ---------- */
  async function renderRemote(beforeBlob, params, onProgress) {
    const form = new FormData();
    form.append('photo', beforeBlob, 'before.jpg');
    form.append('style', params.styleId);
    form.append('room', params.roomId);
    form.append('mode', params.modeId);
    if (window.Telegram?.WebApp?.initData) {
      form.append('initData', window.Telegram.WebApp.initData);
    }

    onProgress?.(8, 'Отправляем кадр в обработку');
    const started = await fetch(`${window.NS_CONFIG.API_BASE}/api/jobs`, { method: 'POST', body: form });
    if (!started.ok) throw new Error('Сервер не принял задание');
    const { jobId } = await started.json();

    // Опрашиваем статус, пока задание не выполнится.
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`${window.NS_CONFIG.API_BASE}/api/jobs/${jobId}`);
      if (!res.ok) continue;
      const data = await res.json();
      onProgress?.(data.progress ?? 50, data.stage || 'Обрабатываем');
      if (data.status === 'done') {
        const file = await fetch(data.resultUrl);
        return await file.blob();
      }
      if (data.status === 'failed') throw new Error(data.error || 'Обработка не удалась');
    }
    throw new Error('Слишком долго — попробуйте ещё раз');
  }

  async function render(beforeBlob, params, onProgress) {
    const normalized = await normalize(beforeBlob);
    const result = window.NS_CONFIG.MODE === 'remote'
      ? await renderRemote(normalized, params, onProgress)
      : await renderMock(normalized, params, onProgress);
    return { before: normalized, after: result };
  }

  window.NS_Pipeline = { render, normalize };
})();
