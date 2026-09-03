'use strict';
/* Собирает весь набор Lottie-анимаций Нейро Отличника одной командой:
     npm run generate-lottie
   Результат — в assets/lottie/*.json (см. assets/lottie/README.md). */

const logos = require('./build-logos');
const reactions = require('./build-reactions');

console.log('Логотипы:');
logos.buildLogoIconLoop();
logos.buildLogoWordmarkReveal();

console.log('Реакции:');
reactions.buildHeart();
reactions.buildFire();
reactions.buildThumbsUp();
reactions.buildStar();
reactions.buildLightbulb();
reactions.buildCheckmark();
reactions.buildConfetti();
reactions.buildGradCap();

console.log('\nГотово. Файлы лежат в assets/lottie/.');
