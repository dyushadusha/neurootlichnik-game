# -*- coding: utf-8 -*-
"""Собирает встраиваемую версию просмотрщика: разметка, стили и скрипт
отдельными файлами, всё внутри одного контейнера #bor495.

Источник один — viewer_template.html и scene.json, поэтому правки модели
и просмотрщика попадают во встраиваемую сборку автоматически.

    python3 build_embed.py     ->  ../web/
"""
import json
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'web')
THREE_SRC = ('/tmp/claude-0/-home-user-neurootlichnik-game/'
             'aed36ca8-5b0f-52e9-ba85-441dd269831d/scratchpad/three.min.js')

HTML = '''<!-- Просмотрщик генплана «БОР 495». Вставьте этот блок в страницу. -->
<div id="bor495">
  <div class="bor-stage"><canvas class="bor-canvas"></canvas></div>

  <section class="bor-title bor-card">
    <h1>БОР&nbsp;495 — генеральный план</h1>
    <div class="bor-sub bor-variant-name">Загородный банный комплекс. Вариант 1</div>
    <div class="bor-cad">50:20:0041009:120 · 54&nbsp;720 м² · периметр 948 м</div>
  </section>

  <nav class="bor-tools">
    <div class="bor-group bor-card">
      <h2>Вариант</h2>
      <div class="bor-row bor-variants">
        <button type="button" data-v="A" aria-pressed="true">1 · лес</button>
        <button type="button" data-v="B" aria-pressed="false">2 · дома</button>
      </div>
    </div>
    <div class="bor-group bor-card">
      <h2>Вид</h2>
      <div class="bor-row bor-views">
        <button type="button" data-view="axo">Аксонометрия</button>
        <button type="button" data-view="plan">План</button>
        <button type="button" data-view="entry">От въезда</button>
        <button type="button" data-view="orbit" aria-pressed="false">Облёт</button>
      </div>
    </div>
    <div class="bor-group bor-card">
      <h2>Слои</h2>
      <div class="bor-row bor-layers">
        <button type="button" data-layer="trees" aria-pressed="true">Лес</button>
        <button type="button" data-layer="labels" aria-pressed="true">Номера</button>
        <button type="button" data-layer="paving" aria-pressed="true">Покрытия</button>
      </div>
    </div>
  </nav>

  <aside class="bor-legend bor-card">
    <header><h2>Экспликация</h2><span class="bor-s bor-stalls"></span></header>
    <div class="bor-expl"></div>
    <div class="bor-tep"></div>
  </aside>

  <div class="bor-compass bor-card" title="Направление на север">
    <svg viewBox="-22 -22 44 44" width="44" height="44" aria-label="Север">
      <circle cx="0" cy="0" r="17" fill="none" stroke="var(--line)" stroke-width="1"></circle>
      <g class="bor-needle">
        <polygon points="0,-13 4.6,3.5 0,0.8 -4.6,3.5" fill="var(--accent)"></polygon>
        <polygon points="0,13 4.6,-3.5 0,-0.8 -4.6,-3.5" fill="none"
                 stroke="var(--ink-soft)" stroke-width="1"></polygon>
        <g class="bor-needle-label" transform="translate(0,-17)">
          <text x="0" y="3" text-anchor="middle" font-size="9.5" font-weight="600"
                fill="var(--ink)">С</text>
        </g>
      </g>
    </svg>
  </div>

  <div class="bor-readout bor-card"></div>
  <div class="bor-hint bor-card">Тянуть — поворот · колесо — приближение ·
    Shift+тянуть — сдвиг. С телефона: один палец — поворот, два — сдвиг и щипок.
    Клик по объекту — подлететь.</div>
</div>
'''

CSS = '''/* Просмотрщик генплана «БОР 495».
   Все правила ограничены контейнером #bor495 и со стилями сайта не пересекаются.
   Высота задаётся переменной --bor-height (по умолчанию 78vh, минимум 460px). */

#bor495{
  color-scheme:light;               /* сцена дневная, тёмную тему не включаем */
  --bor-height:78vh;
  --ink:#20231c; --ink-soft:#5c6152; --line:#d6d8c8; --panel:#fbfaf4;
  --panel-2:#f2f1e6; --accent:#b4761f; --accent-soft:#e8d7b6;
  --sky:#cfd8d0; --shadow:0 10px 30px rgba(32,35,28,.16);

  position:relative; overflow:hidden; isolation:isolate;
  height:max(var(--bor-height), 460px);
  background:var(--sky); color:var(--ink);
  font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:14px; line-height:1.4; -webkit-text-size-adjust:100%;
}
#bor495 *{box-sizing:border-box;}
#bor495 .bor-stage{position:absolute; inset:0;}
#bor495 .bor-canvas{display:block; width:100%; height:100%; touch-action:none;}
#bor495 .bor-card{background:var(--panel); border:1px solid var(--line);
                  border-radius:4px; box-shadow:var(--shadow);}

#bor495 .bor-title{position:absolute; left:16px; top:16px; z-index:5;
                   padding:14px 18px; max-width:min(360px, calc(100% - 32px));}
#bor495 .bor-title h1{font-family:Spectral,Georgia,serif; font-weight:600;
                      font-size:20px; margin:0 0 2px; letter-spacing:.01em;
                      line-height:1.2; color:var(--ink);}
#bor495 .bor-sub{font-size:12px; color:var(--ink-soft); line-height:1.45;}
#bor495 .bor-cad{margin-top:8px; font-size:11px; color:var(--ink-soft);
                 border-top:1px solid var(--line); padding-top:8px;
                 font-variant-numeric:tabular-nums;}

#bor495 .bor-tools{position:absolute; right:16px; top:16px; z-index:5;
                   display:flex; flex-direction:column; gap:8px;
                   max-width:min(230px, calc(100% - 32px));}
#bor495 .bor-group{padding:10px 12px;}
#bor495 .bor-group h2{font-size:10px; letter-spacing:.12em; text-transform:uppercase;
                      color:var(--ink-soft); margin:0 0 8px; font-weight:600;}
#bor495 .bor-row{display:flex; flex-wrap:wrap; gap:6px;}

#bor495 button{font:inherit; font-size:12px; padding:6px 10px; border-radius:3px;
               cursor:pointer; border:1px solid var(--line); background:var(--panel-2);
               color:var(--ink); transition:background .15s, border-color .15s;
               -webkit-tap-highlight-color:transparent;}
#bor495 button:hover{border-color:var(--accent);}
#bor495 button[aria-pressed="true"]{background:var(--accent-soft);
               border-color:var(--accent); color:var(--ink); font-weight:600;}
#bor495 button:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}

#bor495 .bor-legend{position:absolute; left:16px; bottom:16px; z-index:5;
                    width:min(330px, calc(100% - 32px)); max-height:60%;
                    display:flex; flex-direction:column;}
#bor495 .bor-legend header{display:flex; align-items:center;
                    justify-content:space-between; padding:10px 14px;
                    border-bottom:1px solid var(--line);}
#bor495 .bor-legend h2{font-size:10px; letter-spacing:.12em; text-transform:uppercase;
                    margin:0; color:var(--ink-soft); font-weight:600;}
#bor495 .bor-expl{overflow:auto; padding:6px 6px 10px;}
#bor495 .bor-item{display:grid; grid-template-columns:26px 1fr auto; gap:8px;
                  align-items:baseline; padding:4px 8px; border-radius:3px;
                  cursor:pointer; font-size:12px; background:none; border:none;
                  width:100%; text-align:left; color:var(--ink);}
#bor495 .bor-item:hover{background:var(--panel-2); border-color:transparent;}
#bor495 .bor-item .bor-n{font-variant-numeric:tabular-nums; color:var(--accent);
                         font-weight:600;}
#bor495 .bor-item .bor-s{font-variant-numeric:tabular-nums; color:var(--ink-soft);
                         font-size:11px;}
#bor495 .bor-tep{border-top:1px solid var(--line); padding:10px 14px;
                 display:grid; gap:3px;}
#bor495 .bor-tep div{display:flex; justify-content:space-between; gap:12px;
                 font-size:11.5px; color:var(--ink-soft);
                 font-variant-numeric:tabular-nums;}
#bor495 .bor-tep div b{color:var(--ink); font-weight:600;}

#bor495 .bor-compass{position:absolute; left:50%; transform:translateX(-50%);
                     top:16px; z-index:5; padding:4px 4px 0; line-height:0;}
#bor495 .bor-readout{position:absolute; left:50%; transform:translateX(-50%);
                     bottom:16px; z-index:6; padding:8px 14px; font-size:12.5px;
                     pointer-events:none; opacity:0; transition:opacity .18s;}
#bor495 .bor-readout.on{opacity:1;}
#bor495 .bor-hint{position:absolute; right:16px; bottom:16px; z-index:5;
                  padding:8px 12px; font-size:11px; color:var(--ink-soft);
                  max-width:min(220px, calc(100% - 32px)); line-height:1.5;}

@media (max-width:760px){
  #bor495{--bor-height:88vh;}
  #bor495 .bor-legend, #bor495 .bor-hint{display:none;}
  #bor495 .bor-compass{top:78px;}
  #bor495 .bor-title{left:8px; right:8px; max-width:none; padding:9px 12px;}
  #bor495 .bor-title h1{font-size:15px;}
  #bor495 .bor-sub{display:none;}
  #bor495 .bor-cad{margin-top:6px; padding-top:6px; font-size:10.5px;}
  #bor495 .bor-tools{left:8px; right:8px; top:auto; bottom:8px; max-width:none;
                     flex-direction:row; flex-wrap:wrap; gap:6px;}
  #bor495 .bor-group{flex:1 1 150px; padding:7px 9px;}
  #bor495 .bor-group h2{margin-bottom:6px;}
  #bor495 .bor-row{gap:5px;}
  #bor495 button{padding:5px 9px; font-size:11.5px;}
}
@media (prefers-reduced-motion:reduce){ #bor495 *{transition:none !important;} }
'''

JS_HEAD = '''/* Просмотрщик генплана «БОР 495».
 *
 * Нужен three.js r128 (глобальный THREE) и файл сцены bor495-scene.json.
 * Подключение:
 *     <script src="three.min.js"></script>
 *     <script src="bor495.js" data-scene="bor495-scene.json" defer></script>
 * Либо вручную:  BOR495.init(document.getElementById('bor495'), sceneObject);
 */
(function(global){
  "use strict";

  function boot(root, DATA){
'''

JS_TAIL = '''  }

  var API = {
    init: function(root, data){
      if (!root) throw new Error('BOR495: не найден контейнер');
      if (typeof THREE === 'undefined') throw new Error('BOR495: не подключён three.js');
      boot(root, data);
    },
    load: function(root, url){
      return fetch(url, {credentials:'same-origin'})
        .then(function(r){
          if (!r.ok) throw new Error('BOR495: сцена не загрузилась (' + r.status + ')');
          return r.json();
        })
        .then(function(data){ API.init(root, data); return data; });
    }
  };
  global.BOR495 = API;

  // Автозапуск: если у тега скрипта задан data-scene, грузим её сами.
  var tag = document.currentScript;
  if (tag && tag.dataset.scene){
    var url = tag.dataset.scene;
    var id = tag.dataset.target || 'bor495';
    var start = function(){
      var root = document.getElementById(id);
      if (root) API.load(root, url).catch(function(e){ console.error(e); });
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(window);
'''

DEMO = '''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>БОР 495 — генеральный план</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="bor495.css">
<meta name="color-scheme" content="light">
<style>body{margin:0;background:#f3f2ea;} #bor495{--bor-height:100vh;}</style>
</head>
<body>
__MARKUP__
<script src="three.min.js"></script>
<script src="bor495.js" data-scene="bor495-scene.json" defer></script>
</body>
</html>
'''

README = '''# Просмотрщик генплана «БОР 495» — встраивание на сайт

Файлы в этой папке:

| файл | что это |
|---|---|
| `bor495.html` | блок разметки, вставляется в страницу |
| `bor495.css` | стили, все правила внутри `#bor495` |
| `bor495.js` | логика просмотрщика, глобальный объект `BOR495` |
| `bor495-scene.json` | геометрия обоих вариантов генплана (~750 КБ) |
| `three.min.js` | three.js r128, можно заменить своей копией или CDN |
| `index.html` | готовый пример: откройте, чтобы проверить |

## Как вставить

1. Скопируйте `bor495.css`, `bor495.js`, `bor495-scene.json`, `three.min.js`
   на сайт (например, в `/assets/bor495/`).
2. В `<head>` страницы:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/bor495/bor495.css">
```

3. В нужное место страницы — содержимое `bor495.html`.
4. Перед `</body>`:

```html
<script src="/assets/bor495/three.min.js"></script>
<script src="/assets/bor495/bor495.js"
        data-scene="/assets/bor495/bor495-scene.json" defer></script>
```

Блок сам подхватит контейнер `#bor495`. Если контейнер называется иначе,
добавьте скрипту `data-target="ваш-id"`.

## Ручной запуск

```html
<script src="/assets/bor495/bor495.js"></script>
<script>
  BOR495.load(document.getElementById('bor495'), '/assets/bor495/bor495-scene.json');
  // или, если сцена уже в переменной:
  // BOR495.init(document.getElementById('bor495'), sceneObject);
</script>
```

## Настройка

* **Высота.** По умолчанию `78vh`, но не меньше 460 px. Меняется переменной:
  `#bor495{ --bor-height: 600px; }`
* **Тема.** Просмотрщик всегда светлый: сцена — дневная панорама участка,
  и во встроенных браузерах мессенджеров (Telegram и т. п.), которые
  принудительно включают тёмный режим, она не темнеет.
* **Шрифты.** Spectral и IBM Plex Sans подключаются с Google Fonts. Без них
  просмотрщик работает, подставится системный шрифт.

## Требования

* Браузер с WebGL — все актуальные десктопные и мобильные.
* Файл сцены грузится через `fetch`, поэтому страницу нужно открывать с
  сервера (по `http://` или `https://`), а не двойным кликом по файлу.
  Для проверки локально: `python3 -m http.server` в этой папке.
* Управление: мышь — тянуть поворот, колесо приближение, Shift+тянуть сдвиг;
  палец — один поворот, два сдвиг и щипок; клик по объекту — подлететь к нему.
'''


def extract(html):
    """Достаёт тело основного скрипта из шаблона просмотрщика."""
    m = re.search(r'<script>\n(.*)\n</script>\s*$', html, re.S)
    body = m.group(1)
    body = body[body.index('\n', body.index('"use strict";')) + 1:]
    body = body.rsplit('})();', 1)[0]           # снимаем внешнюю обёртку IIFE
    return body.rstrip()


def adapt(js):
    """Переводит скрипт с работы по всей странице на работу внутри контейнера."""
    rules = [
        ("var DATA = JSON.parse(document.getElementById('sceneData').textContent);\n", ''),
        ("var canvas = document.getElementById('c');",
         "var canvas = root.querySelector('.bor-canvas');\n"
         "  var boxW = function(){ return Math.max(1, root.clientWidth); };\n"
         "  var boxH = function(){ return Math.max(1, root.clientHeight); };"),
        ("Math.min(innerWidth || 1200, innerHeight || 800) < 760",
         "Math.min(boxW(), boxH()) < 760"),
        ("""  function vw(){ return innerWidth || document.documentElement.clientWidth ||
                        canvas.clientWidth || 1; }
  function vh(){ return innerHeight || document.documentElement.clientHeight ||
                        canvas.clientHeight || 1; }""",
         "  function vw(){ return boxW(); }\n  function vh(){ return boxH(); }"),
        
        ("new ResizeObserver(resize).observe(document.documentElement);",
         "new ResizeObserver(resize).observe(root);"),
        ("document.querySelectorAll('#variants button')", "root.querySelectorAll('.bor-variants button')"),
        ("document.getElementById('variantName')", "root.querySelector('.bor-variant-name')"),
    ]
    for a, b in rules:
        assert a in js, 'не найдено в шаблоне: ' + a[:60]
        js = js.replace(a, b)
    for name in ('expl', 'tep', 'stalls', 'variants', 'layers', 'views', 'readout'):
        js = js.replace("document.getElementById('%s')" % name,
                        "root.querySelector('.bor-%s')" % name)
    js = js.replace("document.getElementById('needleLabel')",
                    "root.querySelector('.bor-needle-label')")
    js = js.replace("document.getElementById('needle')",
                    "root.querySelector('.bor-needle')")
    js = js.replace("b.className = 'item';", "b.className = 'bor-item';")
    js = js.replace("'<span class=\"n\">'", "'<span class=\"bor-n\">'")
    js = js.replace("'</span><span class=\"s\">'", "'</span><span class=\"bor-s\">'")
    assert 'document.getElementById' not in js, 'остались обращения к id страницы'
    return '\n'.join(('  ' + ln if ln.strip() else ln) for ln in js.split('\n'))


def main():
    tpl = open(os.path.join(HERE, 'viewer_template.html'), encoding='utf-8').read()
    js = JS_HEAD + adapt(extract(tpl)) + JS_TAIL

    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, 'bor495.html'), 'w', encoding='utf-8').write(HTML)
    open(os.path.join(OUT, 'bor495.css'), 'w', encoding='utf-8').write(CSS)
    open(os.path.join(OUT, 'bor495.js'), 'w', encoding='utf-8').write(js)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(
        DEMO.replace('__MARKUP__', HTML))
    open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8').write(README)
    shutil.copyfile(os.path.join(HERE, 'scene.json'),
                    os.path.join(OUT, 'bor495-scene.json'))
    shutil.copyfile(THREE_SRC, os.path.join(OUT, 'three.min.js'))
    for f in sorted(os.listdir(OUT)):
        print('  %-20s %7.0f КБ' % (f, os.path.getsize(os.path.join(OUT, f)) / 1024.0))


if __name__ == '__main__':
    main()
