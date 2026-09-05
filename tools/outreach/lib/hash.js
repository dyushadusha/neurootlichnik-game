'use strict';
/* Детерминированный хэш строки (djb2) — чтобы выбирать вариант письма
 * стабильно для одного и того же лида, но по-разному для разных. */

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Индекс в диапазоне [0, length) для (seed, salt). */
function pickIndex(seed, salt, length) {
  if (length <= 1) return 0;
  return djb2(`${seed}::${salt}`) % length;
}

module.exports = { djb2, pickIndex };
