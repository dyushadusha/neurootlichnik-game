# -*- coding: utf-8 -*-
"""Автономный файл: сцена, three.js и статичный план внутри одного HTML.

Статичный план нужен для случая, когда файл открывают вложением в мессенджере:
системный просмотрщик на iOS не выполняет скрипты, и без него виден пустой фон.
"""
import os
import sys

import fallback

HERE = os.path.dirname(os.path.abspath(__file__))
THREE = ('/tmp/claude-0/-home-user-neurootlichnik-game/'
         'aed36ca8-5b0f-52e9-ba85-441dd269831d/scratchpad/three.min.js')
HEAD = ('<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,'
        'viewport-fit=cover">\n')


def main(out):
    html = open(os.path.join(HERE, 'viewer_template.html'), encoding='utf-8').read()
    html = html.replace('/*__SCENE__*/',
                        open(os.path.join(HERE, 'scene.json'), encoding='utf-8').read())
    html = html.replace(
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
        '<script>' + open(THREE, encoding='utf-8').read() + '</script>')
    html = fallback.inject(html)
    open(out, 'w', encoding='utf-8').write(HEAD + html)
    print('%s — %.1f МБ' % (out, os.path.getsize(out) / 1048576.0))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'BOR495_genplan.html'))
