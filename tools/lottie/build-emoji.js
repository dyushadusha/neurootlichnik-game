'use strict';
/* =========================================================
   КАСТОМНЫЕ ЭМОДЗИ — 20 штук, канвас 100×100, 60 fps
   =========================================================
   Канвас — те же 512×512, что и у стикеров: Telegram требует этот
   размер для ВСЕХ анимированных .tgs, включая кастомные эмодзи
   (100×100 — это про статичные картинки-эмодзи, не про анимацию).
   Отличается не размер файла, а рисунок: Telegram показывает эмодзи
   в размере строки текста, поэтому силуэт крупнее, обводка толще,
   вход короче и почти нет мелких акцентов — на 20 пикселях они
   всё равно не прочитаются.
   ========================================================= */

const path = require('path');
const L = require('./lib');
const M = require('./motion');
const C = require('./compose');
const { BRAND } = require('./icons');

const OUT_DIR = path.join(__dirname, '..', '..', 'assets', 'lottie');
const SIZE = 512;
const FR = 60;
const OP = 76; // ~1,3 c — эмодзи должен «отыграть» быстро
const ICON = 340; // крупнее, чем у реакций: эмодзи в строке текста мелкие, силуэт должен читаться
const SW = 17; // обводка целиком снаружи (см. icons.paint) — вдвое толще, чем у реакций

function emoji(nm, opts) {
  L.resetLayerIndex();
  const layers = C.buildSticker({
    canvas: SIZE,
    op: OP,
    iconSize: ICON,
    sw: SW,
    shadowOffset: 14,
    ...opts,
  });
  L.writeJson(path.join(OUT_DIR, `emoji-${nm}.json`), L.animation({ w: SIZE, h: SIZE, fr: FR, op: OP, nm: `emoji-${nm}`, layers }));
}

/* Микро-искра сбоку — единственный акцент, который читается
   в размере строки. Задаётся в координатах канваса 100×100. */
function tinySpark(dx, dy, t0 = 16) {
  return { sparks: [[dx, dy, 92, t0, 24]] };
}

const SET = [
  // --- базовая реакция на текст ---
  ['check', { icon: 'checkPlain', entrance: 'anticipate', ...tinySpark(126, -120) }],
  ['cross', { icon: 'cross', entrance: 'anticipate' }],
  ['star', { icon: 'star', entrance: 'pop', ...tinySpark(134, -112) }],
  ['heart', { icon: 'heart', entrance: 'pop', patch: 'beat' }],
  ['fire', { icon: 'fire', entrance: 'pop', patch: 'flicker' }],
  ['spark', { icon: 'spark', entrance: 'pop' }],
  ['bolt', { icon: 'bolt', entrance: 'anticipate' }],

  // --- навигация и акценты в постах ---
  ['arrow-up', { icon: 'arrowUp', entrance: 'drop' }],
  ['arrow-right', { icon: 'arrowRight', entrance: 'anticipate' }],
  ['pin', { icon: 'pin', entrance: 'drop' }],
  ['question', { icon: 'question', entrance: 'pop' }],
  ['percent', { icon: 'percent', entrance: 'flip' }],
  ['clock', { icon: 'clock', entrance: 'pop', patch: 'tick' }],
  ['dots', { icon: 'dots', entrance: 'pop', patch: 'wave' }],
  ['eye', { icon: 'eye', entrance: 'pop', patch: 'blink' }],

  // --- профиль студии: архитектура и нейровизуализация ---
  ['cube', { icon: 'cube', entrance: 'flip' }],
  ['house', { icon: 'house', entrance: 'drop' }],
  ['camera', { icon: 'camera', entrance: 'pop' }],
  ['palette', { icon: 'palette', entrance: 'pop' }],
  ['bulb', { icon: 'bulb', entrance: 'anticipate', ...tinySpark(126, -128) }],
];

/* Индивидуальные ритмы: эмодзи должен «жить» в строке, а не
   застывать после появления. */
const PATCHES = {
  beat: (mo) => ({ ...mo, s: M.seq(M.popIn({ t0: 0, dur: 26, from: 62, to: 100, lag: 3 }), M.heartbeat({ t0: 30, t1: OP, base: 100, amp: 0.13 })) }),
  flicker: (mo) => ({
    ...mo,
    s: M.seq(M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 4 }), M.breathe({ t0: 28, t1: OP, base: 100, amp: 6, cycles: 2, phaseLag: 0.5 })),
    r: M.seq(M.wobble({ t0: 2, dur: 26, amp: 9 }), M.jitter({ t0: 28, t1: OP, amp: 4, seed: 11, step: 5 })),
  }),
  blink: (mo) => ({ ...mo, s: M.seq(M.popIn({ t0: 0, dur: 26, from: 62, to: 100, lag: 3 }), M.blink({ t0: 30, t1: OP, at: [40, 62], dur: 7 })) }),
  tick: (mo) => ({ ...mo, r: M.seq(M.wobble({ t0: 2, dur: 30, amp: 12 }), M.sway({ t0: 34, t1: OP, amp: 7, cycles: 2 })) }),
  wave: (mo) => ({ ...mo, s: M.seq(M.popIn({ t0: 0, dur: 24, from: 62, to: 100, lag: 3 }), M.breathe({ t0: 28, t1: OP, base: 100, amp: 5, cycles: 2 })) }),
};

function buildAll() {
  for (const [nm, opts] of SET) {
    const { patch, ...rest } = opts;
    emoji(nm, { ...rest, ...(patch ? { patchMotion: PATCHES[patch] } : {}) });
  }
}

module.exports = { buildAll };

if (require.main === module) {
  console.log('Эмодзи:');
  buildAll();
}
