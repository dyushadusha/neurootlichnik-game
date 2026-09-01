/* =========================================================
   ЛОГИКА ИГРЫ «НАЙДИ 5 ОТЛИЧИЙ»
   Экраны: главное меню -> (настройки) -> игра -> победа.
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
    document.documentElement.dataset.tgColorScheme = tg.colorScheme; // тема из настроек всё равно главнее
    applyViewportHeight();
    tg.onEvent('viewportChanged', applyViewportHeight);
  } else {
    applyViewportHeight();
    window.addEventListener('resize', applyViewportHeight);
  }

  // ---------- Экраны ----------
  const startScreen = document.getElementById('startScreen');
  const rulesScreen = document.getElementById('rulesScreen');
  const settingsScreen = document.getElementById('settingsScreen');
  const gameScreen = document.getElementById('gameScreen');
  const victoryScreen = document.getElementById('victoryScreen');
  const mascotBtn = document.getElementById('mascotBtn');
  const mascotBubble = document.getElementById('mascotBubble');
  const hintBtn = document.getElementById('hintBtn');

  function showScreen(screen) {
    [startScreen, rulesScreen, settingsScreen, gameScreen, victoryScreen].forEach((s) => {
      s.hidden = s !== screen;
    });
    mascotBtn.hidden = screen !== gameScreen;
    hintBtn.hidden = screen !== gameScreen;
    if (screen !== gameScreen) {
      mascotBubble.hidden = true;
    }
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
  const victoryTimeEl = document.getElementById('victoryTime');
  const hintCountEl = document.getElementById('hintCount');

  const HINTS_PER_LEVEL = 3;
  let hintsLeft = HINTS_PER_LEVEL;

  function resetLevel() {
    found.fill(false);
    foundCount = 0;
    foundCountEl.textContent = `0/${level.differences.length}`;
    timerEl.textContent = '00:00';
    document.querySelectorAll('.hotspot-marker, .hint-marker').forEach((m) => m.remove());
    hintsLeft = HINTS_PER_LEVEL;
    hintCountEl.textContent = String(hintsLeft);
    hintBtn.disabled = false;
  }

  function startLevel() {
    resetLevel();
    startTimer();
  }

  // ---------- Таймер (считаем "на скорость", без обратного отсчёта) ----------
  function startTimer() {
    startTime = Date.now();
    clearInterval(timerInterval);
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
    if (gameScreen.hidden) return; // игра ещё не началась / уже пройдена

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
      GameAudio.playWrong();
      hapticWrong();
    }
  }

  function markFound(index) {
    found[index] = true;
    foundCount++;
    foundCountEl.textContent = `${foundCount}/${level.differences.length}`;
    addMarker(index);
    GameAudio.playCorrect();
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
    GameAudio.playVictory();
    showScreen(victoryScreen);
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

  document.getElementById('backToMenuBtn').addEventListener('click', () => {
    showScreen(startScreen);
  });

  // ---------- Подсказка: подсвечивает одно не найденное отличие ----------
  hintBtn.addEventListener('click', () => {
    if (hintsLeft <= 0) return;
    const remainingIndexes = level.differences
      .map((d, i) => i)
      .filter((i) => !found[i]);
    if (remainingIndexes.length === 0) return;

    hintsLeft--;
    hintCountEl.textContent = String(hintsLeft);
    if (hintsLeft === 0) hintBtn.disabled = true;

    const pick = remainingIndexes[Math.floor(Math.random() * remainingIndexes.length)];
    showHint(pick);
    GameAudio.playHint();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
  });

  function showHint(index) {
    const d = level.differences[index];
    const markers = [];
    document.querySelectorAll('.hotspots-layer').forEach((layer) => {
      const marker = document.createElement('div');
      marker.className = 'hint-marker';
      marker.style.left = d.x + '%';
      marker.style.top = d.y + '%';
      layer.appendChild(marker);
      markers.push(marker);
    });
    setTimeout(() => markers.forEach((m) => m.remove()), 1600);
  }

  // ---------- Маскот: карточка со случайным фактом ----------
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

  // ---------- Главное меню и настройки ----------
  const themeButtons = document.querySelectorAll('[data-theme-option]');
  const musicToggle = document.getElementById('musicToggle');
  const sfxToggle = document.getElementById('sfxToggle');
  const sfxVolume = document.getElementById('sfxVolume');

  function syncSettingsUI() {
    const s = Settings.get();
    themeButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeOption === s.theme));
    });
    musicToggle.checked = s.musicOn;
    sfxToggle.checked = s.sfxOn;
    sfxVolume.value = s.sfxVolume;
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      Settings.set({ theme: btn.dataset.themeOption });
      syncSettingsUI();
    });
  });

  musicToggle.addEventListener('change', () => {
    Settings.set({ musicOn: musicToggle.checked });
    GameAudio.setMusicOn(musicToggle.checked);
  });

  sfxToggle.addEventListener('change', () => {
    Settings.set({ sfxOn: sfxToggle.checked });
  });

  sfxVolume.addEventListener('input', () => {
    Settings.set({ sfxVolume: Number(sfxVolume.value) });
  });

  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    syncSettingsUI();
    showScreen(settingsScreen);
  });

  document.getElementById('backFromSettingsBtn').addEventListener('click', () => {
    showScreen(startScreen);
  });

  document.getElementById('openRulesBtn').addEventListener('click', () => {
    showScreen(rulesScreen);
  });

  document.getElementById('backFromRulesBtn').addEventListener('click', () => {
    showScreen(startScreen);
  });

  function beginGame() {
    GameAudio.init();
    GameAudio.setMusicOn(Settings.get().musicOn);
    showScreen(gameScreen);
    startLevel();
  }

  document.getElementById('playBtn').addEventListener('click', beginGame);
  document.getElementById('playFromRulesBtn').addEventListener('click', beginGame);

  syncSettingsUI();
  showScreen(startScreen);
})();
