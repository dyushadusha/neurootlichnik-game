/* =========================================================
   ЗВУК
   Звуковые эффекты (правильно/неправильно/победа/подсказка) генерируются
   прямо в браузере (Web Audio API) — ничего скачивать не нужно.
   Фоновая музыка — настоящий mp3-файл (assets/music/background.mp3),
   проигрывается обычным <audio> в цикле.
   Браузеры запрещают включать звук до первого касания
   экрана — поэтому всё запускается только через Audio.init()/
   startMusic(), которые мы вызываем по кнопке "Играть" и по самому
   первому касанию где угодно на странице (см. game.js).
   ========================================================= */

const GameAudio = (function () {
  let ctx = null;
  let masterGain = null;
  let musicEl = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  function init() {
    ensureContext();
  }

  // Человеческий слух воспринимает громкость не линейно, а примерно как
  // квадрат — если отдавать в звук ползунок "как есть", то верхняя
  // половина шкалы почти не отличается на слух, и кажется, что ползунок
  // сломан. Возводим в квадрат, чтобы шкала ощущалась ровной.
  function perceptualVolume(percent0to100) {
    const t = Math.max(0, Math.min(100, percent0to100)) / 100;
    return t * t;
  }

  function currentVolume() {
    const s = Settings.get();
    return s.sfxOn ? perceptualVolume(s.sfxVolume) : 0;
  }

  // Короткий синтезированный звук — серия нот с затуханием.
  function playTone(freqs, duration, type) {
    if (!ctx) return;
    const vol = currentVolume();
    if (vol <= 0) return;
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const start = now + i * (duration / freqs.length);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol * 0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration / freqs.length);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(start);
      osc.stop(start + duration / freqs.length + 0.05);
    });
  }

  function playCorrect() {
    playTone([660, 880], 0.25, 'sine');
  }

  function playWrong() {
    playTone([180], 0.15, 'sine');
  }

  function playVictory() {
    playTone([523, 659, 784, 1046], 0.6, 'triangle');
  }

  function playHint() {
    playTone([440, 660], 0.2, 'triangle');
  }

  // Настоящая фоновая музыка — обычный <audio>, зациклен, негромкая
  // громкость, чтобы не перебивать звуковые эффекты и не раздражать.
  function ensureMusicEl() {
    if (!musicEl) {
      musicEl = new Audio('assets/music/background.mp3');
      musicEl.loop = true;
      musicEl.volume = perceptualVolume(Settings.get().musicVolume ?? 55);
      musicEl.preload = 'auto';
    }
    return musicEl;
  }

  function startMusic() {
    const s = Settings.get();
    if (!s.musicOn) return;
    const el = ensureMusicEl();
    // play() возвращает промис — без настоящего жеста пользователя браузер
    // может его отклонить, тогда просто попробуем ещё раз по следующему
    // касанию (см. tryStartAudio в game.js). Ошибку тут не считаем багом.
    el.play().catch(() => {});
  }

  function stopMusic() {
    if (musicEl) musicEl.pause();
  }

  function setMusicOn(on) {
    if (on) startMusic();
    else stopMusic();
  }

  function setMusicVolume(volume0to100) {
    if (musicEl) musicEl.volume = perceptualVolume(volume0to100);
  }

  return {
    init,
    playCorrect,
    playWrong,
    playVictory,
    playHint,
    startMusic,
    stopMusic,
    setMusicOn,
    setMusicVolume
  };
})();
