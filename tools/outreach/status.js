#!/usr/bin/env node
'use strict';
/*
 * Печатает сводку по воронке рассылки: сколько лидов, с email/без, сколько
 * черновиков готово, сколько отправлено сегодня/всего, ошибок, отписок.
 * Тот же отчёт отдаёт кнопка "Статус" в bot.js.
 *
 * Использование:
 *   node tools/outreach/status.js
 */

const path = require('path');
const { buildReport } = require('./lib/status');

const { text } = buildReport(path.join(__dirname, 'data'));
console.log(text);
