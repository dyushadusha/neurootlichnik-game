/* =========================================================
   ЗВУК
   Готовых файлов музыки/эффектов нет, поэтому звуки и лёгкая
   фоновая мелодия генерируются прямо в браузере (Web Audio API) —
   ничего не нужно скачивать, всё работает "из коробки".
   Браузеры запрещают включать звук до первого касания
   экрана — поэтому всё запускается только через Audio.init(),
   которую мы вызываем по кнопке "Играть".
   ========================================================= */

const GameAudio = (function () {
  let ctx = null;
  let musicNodes = null;
  let masterGain = null;

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

  function currentVolume() {
    const s = Settings.get();
    return s.sfxOn ? s.sfxVolume / 100 : 0;
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

  // Простая тихая фоновая "подушка" из двух расстроенных тонов —
  // не мелодия в привычном смысле, а мягкий эмбиент-фон.
  function startMusic() {
    if (!ctx || musicNodes) return;
    const s = Settings.get();
    if (!s.musicOn) return;

    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.05;
    musicGain.connect(masterGain);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 220;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 220 * 1.5;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(musicGain.gain);

    osc1.connect(musicGain);
    osc2.connect(musicGain);
    osc1.start();
    osc2.start();
    lfo.start();

    musicNodes = { osc1, osc2, lfo, musicGain };
  }

  function stopMusic() {
    if (!musicNodes) return;
    musicNodes.osc1.stop();
    musicNodes.osc2.stop();
    musicNodes.lfo.stop();
    musicNodes = null;
  }

  function setMusicOn(on) {
    if (on) startMusic();
    else stopMusic();
  }

  return { init, playCorrect, playWrong, playVictory, startMusic, stopMusic, setMusicOn };
})();
