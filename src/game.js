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
    fitGameImages();
  }

  // Игровые картинки всегда имеют соотношение сторон 4:3 (см. levels.js).
  // Вместо "ширина 100%, высота авто" (из-за чего картинки могли не влезать
  // по высоте и появлялся скролл) здесь высчитывается точный размер в
  // пикселях, чтобы обе картинки гарантированно поместились на экране.
  const GAME_BOTTOM_RESERVE_DEFAULT = 84; // место под плавающие кнопки маскота/подсказки
  const GAME_BOTTOM_RESERVE_MIN = 16; // минимум, если совсем не хватает высоты

  function fitGameImages() {
    const gameEl = document.getElementById('gameScreen');
    const imagesWrap = document.querySelector('.game__images');
    const imageBoxes = document.querySelectorAll('.game-image');
    if (!gameEl || gameEl.hidden || !imagesWrap || imageBoxes.length < 2) return;

    imageBoxes.forEach((el) => {
      el.style.width = '';
      el.style.height = '';
    });
    gameEl.style.setProperty('--game-bottom-reserve', GAME_BOTTOM_RESERVE_DEFAULT + 'px');

    const taglineEl = document.querySelector('.game__tagline');
    const metaEl = document.querySelector('.game__meta');
    const imagesGap = parseFloat(getComputedStyle(imagesWrap).rowGap) || 14;

    // Считает, сколько места остаётся под обе картинки при заданном
    // нижнем отступе (reserve), и какая точная ширина/высота у них выйдет,
    // если тянуть их на всю ширину экрана.
    function computeFit() {
      const gameStyles = getComputedStyle(gameEl);
      const paddingTop = parseFloat(gameStyles.paddingTop) || 0;
      const paddingBottom = parseFloat(gameStyles.paddingBottom) || 0;
      const paddingLeft = parseFloat(gameStyles.paddingLeft) || 0;
      const paddingRight = parseFloat(gameStyles.paddingRight) || 0;
      const columnGap = parseFloat(gameStyles.rowGap) || 16;
      const taglineH = taglineEl ? taglineEl.offsetHeight : 0;
      const metaH = metaEl ? metaEl.offsetHeight : 0;

      const totalAvailableHeight = gameEl.clientHeight - paddingTop - paddingBottom;
      const usedByOthers = taglineH + metaH + columnGap * 2; // 2 промежутка между 3 блоками
      const availableForImages = Math.max(160, totalAvailableHeight - usedByOthers);
      const availableWidth = gameEl.clientWidth - paddingLeft - paddingRight;

      const fullWidthHeight = availableWidth * (3 / 4); // высота, если картинки на всю ширину
      const neededForFullWidth = fullWidthHeight * 2 + imagesGap;

      return { availableForImages, availableWidth, fullWidthHeight, neededForFullWidth };
    }

    let fit = computeFit();

    // Если на всю ширину картинки не помещаются по высоте — сначала пробуем
    // ужать запас под плавающие кнопки (а не сами картинки), вплоть до
    // минимума. Так изображения остаются во всю ширину экрана чаще.
    if (fit.neededForFullWidth > fit.availableForImages) {
      const shortBy = fit.neededForFullWidth - fit.availableForImages;
      const newReserve = Math.max(GAME_BOTTOM_RESERVE_MIN, GAME_BOTTOM_RESERVE_DEFAULT - shortBy);
      gameEl.style.setProperty('--game-bottom-reserve', newReserve + 'px');
      fit = computeFit();
    }

    let widthEach = fit.availableWidth;
    let heightEach = fit.fullWidthHeight;

    // Если даже после урезания запаса снизу всё равно не хватает высоты —
    // вот теперь, в самом крайнем случае, уменьшаем сами картинки.
    if (fit.fullWidthHeight * 2 + imagesGap > fit.availableForImages) {
      heightEach = (fit.availableForImages - imagesGap) / 2;
      widthEach = heightEach * (4 / 3);
    }

    imageBoxes.forEach((el) => {
      el.style.width = widthEach + 'px';
      el.style.height = heightEach + 'px';
    });
  }

  // Шапка занимает часть экрана в обычном потоке (не наложена сверху),
  // поэтому экраны ниже нужно уменьшать ровно на её высоту — иначе всё
  // вместе оказывается выше экрана и появляется лишний скролл.
  function applyHeaderHeight() {
    const headerEl = document.querySelector('.app-header');
    if (headerEl) {
      document.documentElement.style.setProperty('--header-height', headerEl.offsetHeight + 'px');
    }
  }

  // В полноэкранном режиме Telegram (requestFullscreen) поверх страницы
  // остаются собственные полупрозрачные кнопки Telegram (закрыть/свернуть) —
  // они не часть страницы, но занимают место сверху. contentSafeAreaInset
  // как раз сообщает, сколько места они закрывают, — отступаем от них.
  function applyTelegramSafeArea() {
    if (!tg) return;
    const csi = tg.contentSafeAreaInset || {};
    const si = tg.safeAreaInset || {};
    let top = Math.max(csi.top || 0, si.top || 0);
    // На части версий Telegram contentSafeAreaInset/safeAreaInset приходят
    // нулевыми (или сильно заниженными) даже в полноэкранном режиме — а
    // свои полупрозрачные кнопки (Закрыть/свернуть/•••) Telegram всё равно
    // рисует поверх страницы. Раз довериться этим цифрам нельзя — в
    // полноэкранном режиме подстраховываемся минимальным отступом.
    if (tg.isFullscreen && top < 92) top = 92;
    document.documentElement.style.setProperty('--tg-safe-top', top + 'px');
    applyHeaderHeight(); // высота шапки меняется вместе с этим отступом
  }

  if (tg) {
    tg.ready();
    tg.expand();
    // Полноэкранный режим (Bot API 8.0+) — убирает "шапку" Telegram с
    // кнопкой "Закрыть" сверху, игра занимает весь экран целиком.
    // В старых клиентах Telegram такого метода нет — тогда просто пропускаем.
    if (tg.requestFullscreen) {
      try { tg.requestFullscreen(); } catch (e) {}
    }
    // Отключаем системный свайп вниз — иначе игрок может случайно
    // закрыть игру, проводя пальцем по картинкам во время поиска отличий.
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    document.documentElement.dataset.tgColorScheme = tg.colorScheme; // тема из настроек всё равно главнее
    applyViewportHeight();
    applyTelegramSafeArea();
    tg.onEvent('viewportChanged', applyViewportHeight);
    tg.onEvent('fullscreenChanged', applyTelegramSafeArea);
    tg.onEvent('safeAreaChanged', applyTelegramSafeArea);
    tg.onEvent('contentSafeAreaChanged', applyTelegramSafeArea);
    // Высота, флаг полноэкранного режима и безопасная зона от Telegram
    // иногда приходят с задержкой (или не сразу верны) — перепроверяем
    // несколько раз, а не один.
    [300, 800, 1500].forEach((delay) => {
      setTimeout(() => {
        applyViewportHeight();
        applyTelegramSafeArea();
      }, delay);
    });
  } else {
    applyViewportHeight();
    window.addEventListener('resize', applyViewportHeight);
  }
  applyHeaderHeight();

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
    mascotBtn.hidden = screen !== gameScreen && screen !== startScreen;
    hintBtn.hidden = screen !== gameScreen;
    if (screen !== gameScreen && screen !== startScreen) {
      mascotBubble.hidden = true;
    }
    if (screen === startScreen) maybeShowIntro();
  }

  // ---------- Состояние уровня ----------
  let currentLevelIndex = 0;
  let level = LEVELS[currentLevelIndex];
  let found = [];
  let foundCount = 0;
  let startTime = null;
  let timerInterval = null;
  let totalElapsedMs = 0; // сумма времени по всем уровням текущего прохождения

  const imageAEl = document.querySelector('[data-image="a"] img');
  const imageBEl = document.querySelector('[data-image="b"] img');

  const foundCountEl = document.getElementById('foundCount');
  const timerEl = document.getElementById('timer');
  const victoryTimeEl = document.getElementById('victoryTime');
  const hintCountEl = document.getElementById('hintCount');
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  const bestTimeLine = document.getElementById('bestTimeLine');
  const achievementsRow = document.getElementById('achievementsRow');
  const finalActionsEl = document.getElementById('finalActions');
  const victoryTitleEl = document.getElementById('victoryTitle');
  const victoryTimeLabelEl = document.getElementById('victoryTimeLabel');

  const HINTS_PER_LEVEL = 3;
  let hintsLeft = HINTS_PER_LEVEL;

  function loadLevel(index) {
    currentLevelIndex = index;
    level = LEVELS[currentLevelIndex];
    imageAEl.src = level.imageA;
    imageBEl.src = level.imageB;
    found = new Array(level.differences.length).fill(false);
    foundCount = 0;
    foundCountEl.textContent = `0/${level.differences.length}`;
    timerEl.textContent = '00:00';
    document.querySelectorAll('.hotspot-marker, .hint-marker').forEach((m) => m.remove());
    hintsLeft = HINTS_PER_LEVEL;
    hintCountEl.textContent = String(hintsLeft);
    hintBtn.disabled = false;
  }

  function startLevel(index) {
    loadLevel(index);
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
    const elapsed = Date.now() - startTime;
    totalElapsedMs += elapsed;
    victoryTimeEl.textContent = formatTime(elapsed);
    victoryTimeLabelEl.textContent = 'Ваше время:';
    GameAudio.playVictory();

    // Личный рекорд по уровню
    const { isNewRecord, best } = GameResults.submitTime(level.id, elapsed);
    bestTimeLine.textContent = isNewRecord
      ? '🎉 Новый рекорд!'
      : `Ваш рекорд: ${formatTime(best)}`;

    // Достижения, разблокированные в этот раз
    const newBadges = GameResults.evaluateAchievements({
      timeMs: elapsed,
      hintsUsed: HINTS_PER_LEVEL - hintsLeft
    });
    achievementsRow.innerHTML = '';
    newBadges.forEach((badge) => {
      const chip = document.createElement('span');
      chip.className = 'achievement-chip';
      chip.textContent = badge.label;
      achievementsRow.appendChild(chip);
    });

    // Следующий уровень, если он есть. Делиться результатом и получать
    // промокод предлагаем только после ПОСЛЕДНЕГО уровня, а не после каждого.
    const hasNext = currentLevelIndex < LEVELS.length - 1;
    nextLevelBtn.hidden = !hasNext;
    finalActionsEl.hidden = hasNext;
    victoryTitleEl.textContent = hasNext ? 'Уровень пройден!' : 'Все уровни пройдены! 🏆';

    if (!hasNext) {
      // На последнем уровне показываем и делимся ОБЩИМ временем по всем
      // уровням, а не временем последнего — так результатом можно делиться
      // как "прошёл всё за такое-то время".
      victoryTimeEl.textContent = formatTime(totalElapsedMs);
      victoryTimeLabelEl.textContent = 'Общее время:';
      const totalResult = GameResults.submitTime('total', totalElapsedMs);
      bestTimeLine.textContent = totalResult.isNewRecord
        ? '🎉 Новый общий рекорд!'
        : `Ваш лучший результат: ${formatTime(totalResult.best)}`;
    }

    // Сбрасываем состояние блока с промокодом на новый показ экрана
    document.getElementById('promoCodeText').hidden = true;
    document.getElementById('subscribeBtn').hidden = false;

    showScreen(victoryScreen);
  }

  nextLevelBtn.addEventListener('click', () => {
    if (currentLevelIndex < LEVELS.length - 1) {
      showScreen(gameScreen);
      startLevel(currentLevelIndex + 1);
      fitGameImages();
    }
  });

  // ---------- Поделиться результатом (картинкой, с текстом в запасе) ----------
  document.getElementById('shareBtn').addEventListener('click', async () => {
    const shared = await GameResults.shareResultImage(victoryTimeEl.textContent);
    if (shared) return;

    const text = `Я прошёл все уровни игры «Найди 5 отличий» за ${victoryTimeEl.textContent}! Попробуй и ты:`;
    const url = CONFIG.STUDIO_URL;

    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text));
    } else if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url);
      alert('Результат скопирован в буфер обмена!');
    }
  });

  // ---------- Бонус за подписку на канал ----------
  document.getElementById('subscribeBtn').addEventListener('click', () => {
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(CONFIG.TELEGRAM_CHANNEL_URL);
    } else {
      window.open(CONFIG.TELEGRAM_CHANNEL_URL, '_blank');
    }
    const promoEl = document.getElementById('promoCodeText');
    promoEl.textContent = `Промокод: ${CONFIG.PROMO_CODE}`;
    promoEl.hidden = false;
    document.getElementById('subscribeBtn').hidden = true;
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
    totalElapsedMs = 0;
    showScreen(gameScreen);
    startLevel(0);
    fitGameImages();
  }

  document.getElementById('playBtn').addEventListener('click', beginGame);
  document.getElementById('playFromRulesBtn').addEventListener('click', beginGame);

  // Браузеры (а особенно встроенный WebView Telegram на iOS) разрешают
  // включать звук только в ответ на "жест пользователя" — но не всегда
  // считают таким жестом именно pointerdown. Поэтому пробуем на нескольких
  // типах событий и НЕ снимаем слушатели после первого раза: GameAudio
  // сам защищён от повторного запуска (см. startMusic/ensureContext),
  // так что лишние повторные вызовы безопасны, а звук гарантированно
  // включится с первого же жеста, который браузер реально засчитает.
  function tryStartAudio() {
    GameAudio.init();
    GameAudio.setMusicOn(Settings.get().musicOn);
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, tryStartAudio, { passive: true });
  });

  syncSettingsUI();
  showScreen(startScreen);

  // ---------- Маскот-проводник: приветствие при первом визите ----------
  // Показываем только пока пользователь на главном экране — если он успел
  // быстро нажать "Играть" раньше, чем сработал таймер, пузырь мог бы
  // появиться поверх игры и закрыть собой часть картинки от тапов.
  function maybeShowIntro() {
    if (Settings.get().hasSeenIntro) return;
    if (startScreen.hidden) return; // не на главном экране — покажем в другой раз
    mascotFactEl.textContent = MASCOT_INTRO;
    mascotBubble.hidden = false;
    Settings.set({ hasSeenIntro: true });
  }
  setTimeout(maybeShowIntro, 700);
})();
