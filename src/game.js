/* =========================================================
   ЛОГИКА ИГРЫ «НАЙДИ 5 ОТЛИЧИЙ»
   Этап 1: один уровень, базовое обнаружение тапов/кликов.
   (Несколько уровней и нативная кнопка Telegram "Дальше"
   будут добавлены следующим шагом.)
   ========================================================= */
(function () {
  // window.Telegram.WebApp существует только внутри Telegram.
  // При обычном открытии в браузере — tg будет null, и все
  // Telegram-функции ниже просто пропускаются.
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  // ---------- Подгонка высоты под интерфейс Telegram ----------
  function applyViewportHeight() {
    const h = (tg && (tg.viewportStableHeight || tg.viewportHeight)) || window.innerHeight;
    document.documentElement.style.setProperty('--tg-viewport-height', h + 'px');
  }

  if (tg) {
    tg.ready();
    tg.expand();
    document.documentElement.dataset.tgColorScheme = tg.colorScheme; // фирменная тёмная тема всё равно главнее
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0a0a0c');
    if (tg.setHeaderColor) { try { tg.setHeaderColor('#141519'); } catch (e) {} }
    applyViewportHeight();
    tg.onEvent('viewportChanged', applyViewportHeight);
  } else {
    applyViewportHeight();
    window.addEventListener('resize', applyViewportHeight);
  }

  // ---------- Состояние уровня ----------
  const level = LEVELS[0];
  const found = new Array(level.differences.length).fill(false);
  let foundCount = 0;
  let startTime = null;
  let timerInterval = null;

  const imageAEl = document.querySelector('[data-image="a"] img');
  const imageBEl = document.querySelector('[data-image="b"] img');
  imageAEl.src = level.imageA;
  imageBEl.src = level.imageB;

  const foundCountEl = document.getElementById('foundCount');
  const timerEl = document.getElementById('timer');
  const victoryScreen = document.getElementById('victoryScreen');
  const victoryTimeEl = document.getElementById('victoryTime');

  // ---------- Таймер (считаем "на скорость", без обратного отсчёта) ----------
  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 250);
  }
  function updateTimer() {
    timerEl.textContent = formatTime(Date.now() - startTime);
  }
  function stopTimer() {
    clearInterval(timerInterval);
  }
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  // ---------- Обработка тапа/клика по картинке ----------
  // pointerup одинаково работает и для касания пальцем, и для клика мышкой.
  document.querySelectorAll('.game-image').forEach((wrapper) => {
    wrapper.addEventListener('pointerup', (e) => handleTap(e, wrapper));
  });

  function handleTap(e, wrapper) {
    const img = wrapper.querySelector('img');
    const rect = img.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const hitIndex = level.differences.findIndex((d, i) => {
      if (found[i]) return false;
      const dx = xPercent - d.x;
      const dy = yPercent - d.y;
      return Math.sqrt(dx * dx + dy * dy) <= d.r;
    });

    if (hitIndex !== -1) {
      markFound(hitIndex);
    } else {
      shake(wrapper);
      hapticWrong();
    }
  }

  function markFound(index) {
    found[index] = true;
    foundCount++;
    foundCountEl.textContent = `${foundCount}/${level.differences.length}`;
    addMarker(index);
    hapticCorrect();
    if (foundCount === level.differences.length) {
      finishLevel();
    }
  }

  // Отмечаем найденное отличие кружком на ОБЕИХ картинках сразу.
  function addMarker(index) {
    const d = level.differences[index];
    document.querySelectorAll('.hotspots-layer').forEach((layer) => {
      const marker = document.createElement('div');
      marker.className = 'hotspot-marker';
      marker.style.left = d.x + '%';
      marker.style.top = d.y + '%';
      layer.appendChild(marker);
    });
  }

  function shake(wrapper) {
    wrapper.classList.add('shake');
    setTimeout(() => wrapper.classList.remove('shake'), 350);
  }

  function hapticCorrect() {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  }
  function hapticWrong() {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
  }

  // ---------- Победа ----------
  function finishLevel() {
    stopTimer();
    victoryTimeEl.textContent = formatTime(Date.now() - startTime);
    victoryScreen.hidden = false;
    // На экране победы уже есть свой герой крупным планом —
    // прячем плавающего маскота, чтобы не перекрывал кнопки.
    mascotBtn.hidden = true;
    mascotBubble.hidden = true;
  }

  // ---------- Поделиться результатом ----------
  document.getElementById('shareBtn').addEventListener('click', () => {
    const text = `Я нашёл 5 отличий за ${victoryTimeEl.textContent} в игре от Нейро Отличник! Попробуй и ты:`;
    const url = 'https://neurootlichnik.ru/';

    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text));
    } else if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url);
      alert('Результат скопирован в буфер обмена!');
    }
  });

  // ---------- Маскот: карточка со случайным фактом ----------
  const mascotBtn = document.getElementById('mascotBtn');
  const mascotBubble = document.getElementById('mascotBubble');
  const mascotFactEl = document.getElementById('mascotFact');
  let lastFactIndex = -1;

  function showRandomFact() {
    let index = Math.floor(Math.random() * MASCOT_FACTS.length);
    if (MASCOT_FACTS.length > 1 && index === lastFactIndex) {
      index = (index + 1) % MASCOT_FACTS.length;
    }
    lastFactIndex = index;
    mascotFactEl.textContent = MASCOT_FACTS[index];
  }

  mascotBtn.addEventListener('click', () => {
    showRandomFact();
    mascotBubble.hidden = false;
  });
  document.getElementById('mascotNext').addEventListener('click', showRandomFact);
  document.getElementById('mascotClose').addEventListener('click', () => {
    mascotBubble.hidden = true;
  });

  startTimer();
})();
