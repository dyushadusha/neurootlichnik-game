# -*- coding: utf-8 -*-
"""Страница на сцене для визуализации: плотный лес, окружающий массив
и подъездные дороги. Нужна только чтобы снять с неё кадр для рендера,
клиенту не отдаётся.

    python3 build_viz_page.py [выход.html]
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
THREE = ('/tmp/claude-0/-home-user-neurootlichnik-game/'
         'aed36ca8-5b0f-52e9-ba85-441dd269831d/scratchpad/three.min.js')
HEAD = ('<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n')


def main(out):
    html = open(os.path.join(HERE, 'viewer_template.html'), encoding='utf-8').read()
    html = html.replace('/*__SCENE__*/',
                        open(os.path.join(HERE, 'scene_viz.json'), encoding='utf-8').read())
    html = html.replace(
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">'
        '</script>',
        '<script>' + open(THREE, encoding='utf-8').read() + '</script>')
    open(out, 'w', encoding='utf-8').write(HEAD + html)
    print('%s — %.1f МБ' % (out, os.path.getsize(out) / 1048576.0))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1
         else os.path.join(HERE, 'BOR495_viz.html'))
