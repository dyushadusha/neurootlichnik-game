'use strict';
/* Собирает весь набор Lottie-анимаций Нейро Отличника одной командой:
     npm run generate-lottie
   Результат — в assets/lottie/ (см. assets/lottie/README.md). */

const logos = require('./build-logos');
const logoPack = require('./build-logo-pack');
const reactions = require('./build-reactions');
const emoji = require('./build-emoji');

console.log('Логотипы:');
logos.ALL.forEach((fn) => fn());

console.log('\nЛогопак (10 коротких + 10 длинных):');
logoPack.ALL.forEach((fn) => fn());

console.log('\nРеакции:');
reactions.ALL.forEach((fn) => fn());

console.log('\nЭмодзи:');
emoji.buildAll();

console.log('\nГотово. Файлы лежат в assets/lottie/.');
