'use strict';
/*
 * Крошечный парсер аргументов командной строки в духе остальных tools/*.js
 * этого репозитория: поддерживает --flag value и --flag (булевы флаги).
 */

function parseArgs(argv, { booleanFlags = [] } = {}) {
  const args = { _: [] };
  const boolSet = new Set(booleanFlags);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (boolSet.has(key)) {
        args[key] = true;
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          args[key] = true; // флаг без значения
        } else {
          args[key] = next;
          i++;
        }
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

module.exports = { parseArgs };
