# -*- coding: utf-8 -*-
"""Собирает публичную веб-версию генплана для GitHub Pages.

На выходе каталог bor495/ в корне репозитория:
  index.html     — просмотрщик со вшитой сценой, без внешних зависимостей
  three.min.js   — библиотека рядом со страницей (CDN не нужен)
  plan-1.png / plan-2.png — планы для превью и скачивания
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'bor495')
THREE_SRC = ('/tmp/claude-0/-home-user-neurootlichnik-game/'
             'aed36ca8-5b0f-52e9-ba85-441dd269831d/scratchpad/three.min.js')

SITE_URL = 'https://dyushadusha.github.io/neurootlichnik-game/bor495/'
TITLE = 'БОР 495 — генеральный план'
DESCR = ('Загородный банный комплекс на участке 50:20:0041009:120, 54 720 м². '
         'Два варианта генплана в 3D: комплекс с лесом и комплекс с гостевыми домами.')

HEAD = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{descr}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{descr}">
<meta property="og:image" content="{url}plan-1.png">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><text y=%2226%22 font-size=%2226%22>&#127794;</text></svg>">
'''.format(title=TITLE, descr=DESCR, url=SITE_URL)


def main():
    html = open(os.path.join(HERE, 'viewer_template.html'), encoding='utf-8').read()
    scene = open(os.path.join(HERE, 'scene.json'), encoding='utf-8').read()
    html = html.replace('/*__SCENE__*/', scene)
    # three.js берём локально, чтобы страница не зависела от CDN
    html = html.replace(
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
        '<script src="three.min.js"></script>')
    html = HEAD + html

    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
    shutil.copyfile(THREE_SRC, os.path.join(OUT, 'three.min.js'))
    for src, dst in (('BOR495_genplan_A.png', 'plan-1.png'),
                     ('BOR495_genplan_B.png', 'plan-2.png')):
        shutil.copyfile(os.path.join(HERE, src), os.path.join(OUT, dst))
    open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print('  %-14s %7.0f КБ' % (f, os.path.getsize(p) / 1024.0))
    print('Готово:', SITE_URL)


if __name__ == '__main__':
    main()
