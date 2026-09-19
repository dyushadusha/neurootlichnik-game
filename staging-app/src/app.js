/* =========================================================
   НЕЙРО СТЕЙДЖИНГ — вся логика интерфейса
   ---------------------------------------------------------
   Один файл на весь сценарий: главная → настройка → обработка
   → результат → тарифы → история. Экраны переключаются
   функцией show(), ничего больше про навигацию знать не нужно.
   ========================================================= */
(function () {
  const { ROOM_TYPES, STYLE_PRESETS, OUTPUT_MODES, OBJECT_STATES, QUALIFY_QUESTIONS } = window.NS_PRESETS;
  const cfg = window.NS_CONFIG;
  const store = window.NS_Store;
  const tg = window.Telegram?.WebApp;

  const $ = (id) => document.getElementById(id);
  const screens = ['homeScreen', 'setupScreen', 'processScreen', 'resultScreen', 'projectScreen', 'quoteScreen', 'plansScreen', 'historyScreen'];

  // Текущее состояние: что выбрал пользователь и что получилось.
  const state = {
    beforeBlob: null,
    beforeUrl: null,
    afterBlob: null,
    afterUrl: null,
    roomId: ROOM_TYPES[0].id,
    area: window.NS_PRICING.defaultArea[ROOM_TYPES[0].id],
    height: window.NS_PRICING.defaultHeight,
    styleId: STYLE_PRESETS[0].id,
    modeId: OUTPUT_MODES[0].id,
    stateId: OBJECT_STATES[0].id,
    lastJobId: null,
    screen: 'homeScreen'
  };

  /* ================= Навигация ================= */

  function show(id) {
    screens.forEach((s) => { $(s).hidden = s !== id; });
    state.screen = id;
    window.scrollTo(0, 0);
    // Системная кнопка "назад" в Telegram — показываем везде, кроме главной.
    if (tg?.BackButton) {
      if (id === 'homeScreen') tg.BackButton.hide();
      else tg.BackButton.show();
    }
  }

  function haptic(type = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch { /* вне Telegram молчим */ }
  }

  let toastTimer = null;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ================= Шапка и баланс ================= */

  function renderCredits() {
    const left = store.getCredits();
    $('creditsValue').textContent = left;
    // Склонение рядом с числом: "1 кадр", "2 кадра", "5 кадров".
    $('creditsWord').textContent = plural(left, 'кадр', 'кадра', 'кадров');
  }
  document.addEventListener('ns:credits', renderCredits);

  /* ================= Экран настройки ================= */

  function buildRoomChips() {
    const box = $('roomChips');
    box.innerHTML = '';
    ROOM_TYPES.forEach((room) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = room.label;
      b.setAttribute('aria-pressed', String(room.id === state.roomId));
      b.addEventListener('click', () => {
        state.roomId = room.id;
        // Типовая площадь для выбранного помещения — чтобы не вводить руками.
        state.area = window.NS_PRICING.defaultArea[room.id] || state.area;
        $('areaInput').value = state.area;
        haptic();
        buildRoomChips();
      });
      box.appendChild(b);
    });
  }

  function buildStateChips() {
    const box = $('stateChips');
    box.innerHTML = '';
    OBJECT_STATES.forEach((st) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = st.label;
      b.setAttribute('aria-pressed', String(st.id === state.stateId));
      b.addEventListener('click', () => {
        state.stateId = st.id;
        haptic();
        buildStateChips();
      });
      box.appendChild(b);
    });
    const active = OBJECT_STATES.find((st) => st.id === state.stateId);
    $('stateHint').textContent = active ? active.hint : '';
  }

  function buildStyleCards() {
    const box = $('styleCards');
    box.innerHTML = '';
    STYLE_PRESETS.forEach((style) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'style-card';
      b.setAttribute('aria-pressed', String(style.id === state.styleId));
      b.innerHTML = `
        <span class="style-card__swatch">${style.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="style-card__name">${style.label}</span>
        <span class="style-card__hint">${style.hint}</span>`;
      b.addEventListener('click', () => {
        state.styleId = style.id;
        haptic();
        buildStyleCards();
      });
      box.appendChild(b);
    });
  }

  function buildModeSegmented() {
    const box = $('modeSegmented');
    box.innerHTML = '';
    OUTPUT_MODES.forEach((mode) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'segmented__option';
      b.textContent = mode.label;
      b.setAttribute('aria-pressed', String(mode.id === state.modeId));
      b.addEventListener('click', () => {
        state.modeId = mode.id;
        haptic();
        buildModeSegmented();
      });
      box.appendChild(b);
    });
    const active = OUTPUT_MODES.find((m) => m.id === state.modeId);
    $('modeHint').textContent = active ? active.note : '';
  }

  function refreshBalanceHint() {
    const left = store.getCredits();
    $('balanceHint').textContent = left > 0
      ? `На балансе ${left} ${plural(left, 'кадр', 'кадра', 'кадров')}`
      : 'Кадры закончились — пополните баланс на экране тарифов';
    $('renderBtn').textContent = left > 0
      ? `Сделать ремонт · ${cfg.CREDITS_PER_RENDER} кадр`
      : 'Пополнить баланс';
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  async function openSetup(blob) {
    if (state.beforeUrl) URL.revokeObjectURL(state.beforeUrl);
    state.beforeBlob = blob;
    state.beforeUrl = URL.createObjectURL(blob);
    $('setupPreview').src = state.beforeUrl;
    // Новое фото — новый объект: подставляем типовую площадь того
    // помещения, которое выбрано сейчас, иначе смета посчитается
    // по площади от предыдущего кадра.
    state.area = window.NS_PRICING.defaultArea[state.roomId] || state.area;
    $('areaInput').value = state.area;
    $('heightInput').value = state.height;
    buildRoomChips();
    buildStateChips();
    buildStyleCards();
    buildModeSegmented();
    refreshBalanceHint();
    show('setupScreen');
  }

  /* ================= Обработка ================= */

  const FACTS = [
    'Хороший кадр — это на 80% свет и только на 20% всё остальное.',
    'Объявление с визуализацией ремонта собирает заметно больше откликов, чем «убитая» квартира без обработки.',
    'Мы не выдумываем метраж: стены, окна и двери остаются ровно там, где были на вашем фото.',
    'Покупатель редко умеет представлять ремонт по голым стенам — за него это делает картинка.',
    'Кадр «для объявления» всегда уходит с подписью «визуализация» — так спокойнее и вам, и площадке.'
  ];

  let factTimer = null;
  function startFacts() {
    let i = Math.floor(Math.random() * FACTS.length);
    $('processFact').textContent = FACTS[i];
    clearInterval(factTimer);
    factTimer = setInterval(() => {
      i = (i + 1) % FACTS.length;
      $('processFact').textContent = FACTS[i];
    }, 4200);
  }

  function setProgress(pct, stage) {
    $('progressFill').style.width = pct + '%';
    $('processPercent').textContent = Math.round(pct) + '%';
    if (stage) $('processStage').textContent = stage;
  }

  async function runRender() {
    // Нет кадров — вместо генерации ведём на тарифы.
    if (store.getCredits() < cfg.CREDITS_PER_RENDER) {
      buildPlans();
      show('plansScreen');
      return;
    }

    const mode = OUTPUT_MODES.find((m) => m.id === state.modeId);
    setProgress(0, 'Готовим кадр');
    startFacts();
    show('processScreen');
    haptic('medium');

    try {
      const { before, after } = await window.NS_Pipeline.render(
        state.beforeBlob,
        { styleId: state.styleId, roomId: state.roomId, modeId: state.modeId, watermark: !!mode?.watermark },
        setProgress
      );

      // Кадр списываем только после успешной генерации — за брак не платят.
      store.spendCredit();

      const jobId = 'job_' + Date.now();
      state.lastJobId = jobId;
      await store.saveJob({
        id: jobId, beforeBlob: before, afterBlob: after,
        styleId: state.styleId, roomId: state.roomId, modeId: state.modeId,
        area: state.area, height: state.height, stateId: state.stateId
      });

      // Комната сразу становится частью объекта: продукт считает
      // квартиру целиком, а не отдельные кадры.
      window.NS_Project.addRoom({
        jobId, roomId: state.roomId, styleId: state.styleId,
        stateId: state.stateId, area: state.area, height: state.height
      });

      showResult(before, after, {
        styleId: state.styleId, roomId: state.roomId, modeId: state.modeId,
        area: state.area, height: state.height, stateId: state.stateId
      });
      haptic('heavy');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не получилось обработать кадр');
      show('setupScreen');
    } finally {
      clearInterval(factTimer);
    }
  }

  /* ================= Результат ================= */

  function showResult(beforeBlob, afterBlob, meta) {
    if (state.afterUrl) URL.revokeObjectURL(state.afterUrl);
    state.afterBlob = afterBlob;
    state.afterUrl = URL.createObjectURL(afterBlob);
    const beforeUrl = URL.createObjectURL(beforeBlob);

    $('compareBefore').src = beforeUrl;
    $('compareAfter').src = state.afterUrl;
    setCompare(50);

    const style = STYLE_PRESETS.find((s) => s.id === meta.styleId);
    const room = ROOM_TYPES.find((r) => r.id === meta.roomId);
    $('resultMeta').textContent = `${room ? room.label : ''} · стиль «${style ? style.label : ''}»`;

    renderEstimate(meta);

    // Пометка нужна только тем, кто понесёт кадр на площадку объявлений.
    const mode = OUTPUT_MODES.find((m) => m.id === (meta.modeId || state.modeId));
    const disclosure = mode && mode.disclosure;
    $('disclosureBox').hidden = !disclosure;
    if (disclosure) $('disclosureText').textContent = disclosure;

    show('resultScreen');
  }

  // Смета считается из площади, высоты и уровня отделки (его задаёт стиль).
  function renderEstimate(meta) {
    const area = Number(meta.area || state.area);
    const height = Number(meta.height || state.height);
    const roomId = meta.roomId || state.roomId;
    const styleId = meta.styleId || state.styleId;

    const stateId = meta.stateId || state.stateId;
    const est = window.NS_Estimate.calculate({ roomId, styleId, area, height, stateId });
    state.lastEstimate = est;

    $('estimateSegment').textContent = est.segmentLabel;
    const box = $('estimateLines');
    box.innerHTML = '';
    est.lines.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'estimate-line';
      row.innerHTML = `
        <span class="estimate-line__name">${line.label}
          ${line.qty ? `<span class="estimate-line__qty">${line.qty} ${line.unit}</span>` : ''}
        </span>
        <span class="estimate-line__sum">${line.sumText}</span>`;
      box.appendChild(row);
    });

    const overhead = document.createElement('div');
    overhead.className = 'estimate-line';
    overhead.innerHTML = `
      <span class="estimate-line__name">Вывоз мусора и расходники
        <span class="estimate-line__qty">${est.overheadPercent}% от работ</span>
      </span>
      <span class="estimate-line__sum">${est.overheadText}</span>`;
    box.appendChild(overhead);

    $('estimateTotal').textContent = est.totalText;
    $('estimateRange').textContent = `${est.perSquareText} · вилка после замера: ${est.rangeText} · срок ≈ ${est.days} дней`;
    $('estimateNote').textContent = `Расчёт предварительный: по фото и заявленной площади, по прайсу «${est.region}». Точная смета — после замера.`;
  }

  function estimateAsText() {
    if (!state.lastEstimate) return '';
    const room = ROOM_TYPES.find((r) => r.id === state.roomId);
    const style = STYLE_PRESETS.find((s) => s.id === state.styleId);
    return window.NS_Estimate.asText(state.lastEstimate, {
      roomLabel: room ? room.label : 'Помещение',
      styleLabel: style ? style.label : '',
      area: state.area
    });
  }

  function setCompare(percent) {
    const clamped = Math.min(100, Math.max(0, percent));
    $('compareClip').style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    $('compareHandle').style.left = clamped + '%';
  }

  function initCompareDrag() {
    const box = $('compare');
    let dragging = false;

    const apply = (clientX) => {
      const rect = box.getBoundingClientRect();
      setCompare(((clientX - rect.left) / rect.width) * 100);
    };

    box.addEventListener('pointerdown', (e) => {
      // Без preventDefault браузер на десктопе начинает "тащить картинку"
      // (нативный drag-and-drop) и обрывает жест на первом же движении.
      e.preventDefault();
      dragging = true;
      try { box.setPointerCapture(e.pointerId); } catch { /* не критично */ }
      apply(e.clientX);
    });
    box.addEventListener('pointermove', (e) => { if (dragging) apply(e.clientX); });
    box.addEventListener('pointerup', () => { dragging = false; });
    box.addEventListener('pointercancel', () => { dragging = false; });
    box.addEventListener('dragstart', (e) => e.preventDefault());
  }

  function downloadResult() {
    if (!state.afterBlob) return;
    const a = document.createElement('a');
    a.href = state.afterUrl;
    a.download = `neuro-staging-${state.styleId}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Кадр сохранён');
  }

  async function shareResult() {
    if (!state.afterBlob) return;
    const file = new File([state.afterBlob], 'neuro-staging.jpg', { type: 'image/jpeg' });
    // Нативное «Поделиться» есть на телефонах; на десктопе — просто скачиваем.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: 'Ремонт этой квартиры — Нейро Стейджинг' });
        return;
      } catch { /* пользователь передумал — это не ошибка */ }
    }
    downloadResult();
  }

  /* ================= Объект: квартира целиком ================= */

  async function buildProject() {
    const project = window.NS_Project.read();
    const t = window.NS_Project.totals();
    state.lastTotals = t;

    $('listingPriceInput').value = project.listingPrice || '';

    const box = $('roomsList');
    box.innerHTML = '';
    if (!t.rooms.length) {
      const empty = document.createElement('p');
      empty.className = 'rooms-empty';
      empty.textContent = 'Пока ни одной комнаты. Добавьте фото — посчитаем ремонт и цену входа.';
      box.appendChild(empty);
    }

    for (const room of t.rooms) {
      const saved = await store.loadJob(room.jobId);
      const roomType = ROOM_TYPES.find((r) => r.id === room.roomId);
      const style = STYLE_PRESETS.find((s) => s.id === room.styleId);

      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        ${saved ? `<img src="${URL.createObjectURL(saved.after)}" alt="" />` : ''}
        <span class="room-card__body">
          <span class="room-card__name">${roomType ? roomType.label : 'Комната'}, ${room.area} м²</span>
          <span class="room-card__meta">${style ? style.label : ''} · ${room.estimate.segmentLabel}</span>
        </span>
        <span class="room-card__sum">${room.estimate.totalText}</span>
        <button class="room-card__remove" type="button" aria-label="Убрать комнату">×</button>`;
      card.querySelector('.room-card__remove').addEventListener('click', () => {
        window.NS_Project.removeRoom(room.jobId);
        haptic();
        buildProject();
      });
      box.appendChild(card);
    }

    $('totalsListingRow').hidden = !t.listingText;
    if (t.listingText) $('totalsListing').textContent = t.listingText;
    $('totalsRenovationLabel').textContent = t.area ? `Ремонт · ${t.area} м²` : 'Ремонт';
    $('totalsRenovation').textContent = t.renovationText;

    $('totalsEntryBox').hidden = !t.entryText;
    if (t.entryText) {
      $('totalsEntry').textContent = t.entryText;
      $('totalsShare').textContent = t.renovationShare
        ? `Ремонт — ${t.renovationShare}% от всей суммы` : '';
    }
    $('totalsDays').textContent = t.rooms.length
      ? `Срок работ по объекту ≈ ${t.days} дней${t.perSquareText ? ` · ${t.perSquareText}` : ''}`
      : '';

    $('shareCardBtn').disabled = !t.rooms.length;
    $('quoteFromProjectBtn').disabled = !state.lastEstimate;
    show('projectScreen');
  }

  // Карточка, которой делятся: ради цифр её отправляют,
  // ради картинки открывают, а нас находят по подписи внизу.
  async function shareProjectCard() {
    const t = window.NS_Project.totals();
    if (!t.rooms.length) return;

    // Берём самую дорогую комнату — она выглядит убедительнее всего.
    const lead = t.rooms.slice().sort((a, b) => b.estimate.total - a.estimate.total)[0];
    const saved = await store.loadJob(lead.jobId);
    if (!saved) { toast('Кадр не найден — сделайте его заново'); return; }

    toast('Собираем карточку…');
    let blob;
    try {
      blob = await window.NS_ShareCard.build({
        totals: t, beforeBlob: saved.before, afterBlob: saved.after,
        isDemo: cfg.MODE === 'mock'
      });
    } catch (err) {
      console.error(err);
      toast('Не получилось собрать карточку');
      return;
    }

    const file = new File([blob], 'cena-vhoda.jpg', { type: 'image/jpeg' });
    const text = t.entryText
      ? `Квартира ${t.listingText} + ремонт ${t.renovationText} = ${t.entryText}`
      : `Ремонт этой квартиры — ${t.renovationText}`;

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch { /* передумали */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cena-vhoda.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Карточка сохранена');
  }

  /* ================= Ответ клиенту ================= */

  // Сообщение, которое менеджер отправляет в тот же чат, где пришла
  // заявка. Здесь нет деталей сметы: клиенту нужны вилка, срок и
  // следующий шаг, а разбор позиций — повод для замера.
  function quoteMessage() {
    const est = state.lastEstimate;
    if (!est) return '';
    const room = ROOM_TYPES.find((r) => r.id === state.roomId);
    const style = STYLE_PRESETS.find((s) => s.id === state.styleId);
    const co = cfg.COMPANY;
    return [
      `Здравствуйте! Посмотрели ваше фото — вот как эта комната может выглядеть после ремонта.`,
      ``,
      `${room ? room.label : 'Помещение'}, ${state.area} м², стиль «${style ? style.label : ''}».`,
      `Ориентировочная стоимость работ и материалов: ${est.rangeText}.`,
      `Срок: около ${est.days} дней.`,
      ``,
      `Это предварительный расчёт по фотографии. Точная смета — после замера: он бесплатный и занимает около 40 минут. Когда вам удобно?`,
      ``,
      `${co.name}, ${co.phone}`
    ].join('\n');
  }

  function openQuote() {
    const est = state.lastEstimate;
    if (!est) return;
    const co = cfg.COMPANY;
    $('quoteBrand').textContent = `${co.name} · ${co.city} · ${co.phone}`;
    $('quoteImage').src = state.afterUrl;
    $('quoteRange').textContent = est.rangeText;
    $('quoteDays').textContent = `≈ ${est.days} дней`;
    $('quoteText').textContent = quoteMessage();
    buildQualify();
    show('quoteScreen');
  }

  // Чек-лист: три вопроса, которые отсекают выезд к тому,
  // кто "просто узнавал цену".
  function buildQualify() {
    const box = $('qualifyList');
    box.innerHTML = '';
    QUALIFY_QUESTIONS.forEach((q) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'qualify-item';
      item.setAttribute('aria-pressed', 'false');
      item.innerHTML = `
        <span class="qualify-item__box" aria-hidden="true"></span>
        <span class="qualify-item__label">${q.label}
          <span class="qualify-item__bad">${q.bad}</span>
        </span>`;
      item.addEventListener('click', () => {
        const next = item.getAttribute('aria-pressed') !== 'true';
        item.setAttribute('aria-pressed', String(next));
        item.querySelector('.qualify-item__box').textContent = next ? '✓' : '';
        haptic();
      });
      box.appendChild(item);
    });
  }

  async function shareQuote() {
    const text = quoteMessage();
    if (!state.afterBlob) return;
    const file = new File([state.afterBlob], 'remont.jpg', { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch { /* передумали — не ошибка */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Сообщение скопировано — картинку приложите вручную');
    } catch {
      toast('Скопируйте текст вручную');
    }
  }

  /* ================= Тарифы ================= */

  function buildPlans() {
    const box = $('planCards');
    box.innerHTML = '';
    cfg.PLANS.forEach((plan) => {
      const perFrame = Math.round(plan.price / plan.credits);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'plan' + (plan.popular ? ' plan--popular' : '');
      b.innerHTML = `
        ${plan.popular ? '<span class="plan__badge">Выгодно</span>' : ''}
        <div class="plan__title">${plan.title}</div>
        <div class="plan__price">${plan.price.toLocaleString('ru-RU')} ₽</div>
        <div class="plan__per">${plan.credits} кадров · ${perFrame} ₽ за кадр</div>
        <div class="plan__note">${plan.note}</div>`;
      b.addEventListener('click', () => {
        // В демоверсии оплата условная: просто начисляем кадры.
        store.addCredits(plan.credits);
        refreshBalanceHint();
        haptic('medium');
        toast(`Начислено ${plan.credits} кадров (демо-оплата)`);
        show(state.beforeBlob ? 'setupScreen' : 'homeScreen');
      });
      box.appendChild(b);
    });
  }

  /* ================= История ================= */

  async function buildHistory() {
    const box = $('historyList');
    box.innerHTML = '';
    const jobs = store.listJobs();
    $('historyEmpty').hidden = jobs.length > 0;

    for (const job of jobs) {
      const saved = await store.loadJob(job.id);
      if (!saved) continue;
      const style = STYLE_PRESETS.find((s) => s.id === job.styleId);
      const room = ROOM_TYPES.find((r) => r.id === job.roomId);
      const thumbUrl = URL.createObjectURL(saved.after);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'history-item';
      item.innerHTML = `
        <img src="${thumbUrl}" alt="" />
        <span>
          <span class="history-item__name">${room ? room.label : 'Комната'} · ${style ? style.label : ''}</span>
          <span class="history-item__date">${new Date(job.createdAt).toLocaleString('ru-RU')}</span>
        </span>`;
      item.addEventListener('click', () => {
        state.styleId = job.styleId;
        showResult(saved.before, saved.after, job);
      });
      box.appendChild(item);
    }
    show('historyScreen');
  }

  /* ================= Запуск ================= */

  function refreshProjectButton() {
    const has = window.NS_Project.read().rooms.length > 0;
    $('openProjectBtn').hidden = !has;
  }
  document.addEventListener('ns:project', refreshProjectButton);

  function init() {
    renderCredits();
    refreshProjectButton();
    initCompareDrag();

    $('photoInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await openSetup(file);
      e.target.value = ''; // чтобы повторный выбор того же файла снова сработал
    });

    // Демо-кадр: берём готовый рендер из ассетов студии, чтобы можно
    // было пройти сценарий, даже если фото под рукой нет.
    $('demoBtn').addEventListener('click', async () => {
      try {
        const res = await fetch('../assets/level-3-a.webp');
        state.roomId = 'kitchen';
        await openSetup(await res.blob());
      } catch {
        toast('Не удалось загрузить пример');
      }
    });

    $('openHistoryBtn').addEventListener('click', buildHistory);
    $('creditsChip').addEventListener('click', () => { buildPlans(); show('plansScreen'); });
    $('renderBtn').addEventListener('click', runRender);
    $('downloadBtn').addEventListener('click', downloadResult);
    $('shareBtn').addEventListener('click', shareResult);
    $('retryStyleBtn').addEventListener('click', () => { refreshBalanceHint(); show('setupScreen'); });
    $('openQuoteBtn').addEventListener('click', openQuote);
    $('toProjectBtn').addEventListener('click', buildProject);
    $('openProjectBtn').addEventListener('click', buildProject);
    $('quoteFromProjectBtn').addEventListener('click', openQuote);
    $('shareCardBtn').addEventListener('click', shareProjectCard);
    $('photoInputProject').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await openSetup(file);
      e.target.value = '';
    });
    $('listingPriceInput').addEventListener('input', (e) => {
      window.NS_Project.setListingPrice(parseFloat(e.target.value));
      const t = window.NS_Project.totals();
      $('totalsListingRow').hidden = !t.listingText;
      if (t.listingText) $('totalsListing').textContent = t.listingText;
      $('totalsEntryBox').hidden = !t.entryText;
      if (t.entryText) {
        $('totalsEntry').textContent = t.entryText;
        $('totalsShare').textContent = t.renovationShare
          ? `Ремонт — ${t.renovationShare}% от всей суммы` : '';
      }
    });
    $('resetProjectBtn').addEventListener('click', () => {
      window.NS_Project.reset();
      haptic();
      buildProject();
    });
    $('shareQuoteBtn').addEventListener('click', shareQuote);
    $('copyQuoteBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(quoteMessage());
        toast('Сообщение скопировано');
      } catch {
        toast('Скопируйте текст вручную');
      }
    });
    $('areaInput').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v) && v > 0) state.area = v;
    });
    $('heightInput').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v) && v > 0) state.height = v;
    });
    $('copyEstimateBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(estimateAsText());
        toast('Смета скопирована — вставьте в КП');
      } catch {
        toast('Не удалось скопировать — выделите текст вручную');
      }
    });
    $('copyDisclosureBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('disclosureText').textContent);
        toast('Текст скопирован');
      } catch {
        toast('Скопируйте текст вручную');
      }
    });
    $('managerBtn').addEventListener('click', () => window.open(cfg.MANAGER_URL, '_blank'));

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => show(btn.dataset.back));
    });

    buildPlans();

    if (tg) {
      tg.ready();
      tg.expand();
      tg.BackButton?.onClick(() => show('homeScreen'));
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
