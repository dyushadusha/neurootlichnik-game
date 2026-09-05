'use strict';
/*
 * Запуск одного из CLI-скриптов этого набора (discover-2gis.js,
 * enrich-emails.js, generate-drafts.js, send-emails.js) как дочернего
 * процесса — используется ботом, чтобы не дублировать их логику и не
 * зависеть от одного сбойного шага: если один прогон упадёт, это не
 * уронит сам бот.
 */

const { execFile } = require('child_process');
const path = require('path');

const OUTREACH_DIR = path.join(__dirname, '..');

/**
 * @param {string} scriptFile — имя файла в tools/outreach/, напр. "enrich-emails.js"
 * @param {string[]} args
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, code: number }>}
 */
function runScript(scriptFile, args = [], { timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(OUTREACH_DIR, scriptFile), ...args],
      { cwd: OUTREACH_DIR, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          timedOut: Boolean(error && error.killed && error.signal),
        });
      }
    );
  });
}

module.exports = { runScript };
