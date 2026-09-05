'use strict';
/*
 * Минималистичный загрузчик .env — без внешней зависимости.
 * Читает KEY=VALUE построчно, пропускает пустые строки и комментарии (#...),
 * не перезаписывает переменные, уже заданные в окружении процесса.
 */

const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  const target = envPath || path.join(__dirname, '..', '.env');
  if (!fs.existsSync(target)) return;

  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

module.exports = { loadEnv };
