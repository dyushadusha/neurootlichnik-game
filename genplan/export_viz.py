# -*- coding: utf-8 -*-
"""Отдельная сцена для визуализации: лес гуще, чем на презентационном плане.

Плотность леса задаётся геометрией, а не словами в промпте — генеративная
модель следует входной геометрии куда точнее, чем описанию.
"""
import json
import os

import config as C
import genplan as G
import export_scene

TREES = 900          # вместо 300 на обычной сцене
RMIN = 3.4           # плотнее посадка


def main():
    site, _ = G.load_site(os.path.join(G.OUT, C.DEFAULT_SITE), None, C.DEFAULT_SITE_ORDER)
    frame = G.Frame(site)
    titles = {'A': 'Вариант 1 — комплекс и лес',
              'B': 'Вариант 2 — комплекс и 10 гостевых домов'}
    out = {}
    for v in ('A', 'B'):
        m = G.build(frame, v)
        m['trees'] = G.scatter_trees(m['green'], count=TREES, rmin=RMIN)
        out[v] = export_scene.scene(frame, m, titles[v])
        print('вариант %s: деревьев %d' % (v, len(m['trees'])))
    path = os.path.join(G.OUT, 'scene_viz.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('scene_viz.json: %.0f КБ' % (os.path.getsize(path) / 1024.0))


if __name__ == '__main__':
    main()
