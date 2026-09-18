# -*- coding: utf-8 -*-
"""Сцена под нейрорендер: та же геометрия генплана, но окружение достроено.

Всё, что генеративная модель должна увидеть, задаётся геометрией, а не
словами в промпте — так она следует картинке, а не фантазирует:
  * лес внутри участка гуще и НИЖЕ (в реальности там не корабельные сосны);
  * участок окружён лесным массивом снаружи забора;
  * вдоль южной и восточной границ проходят подъездные дороги.
"""
import json
import math
import os
import random

from shapely.geometry import LineString, Point

import config as C
import genplan as G
import export_scene

TREES_IN = 900            # деревьев внутри участка
RMIN_IN = 3.4             # шаг посадки внутри, м
H_IN = (7.0, 12.0)        # высота деревьев внутри, м — ниже прежних 12..20

TREES_OUT = 3600          # деревьев в окружающем массиве
RMIN_OUT = 5.2
H_OUT = (13.0, 20.0)      # снаружи лес взрослый и выше
BELT = 300.0              # ширина лесного пояса вокруг участка, м

ROAD_W = 8.0              # подъездная дорога, м
ROAD_OFF = 22.0           # её отступ наружу от границы, м


def scatter(poly, count, rmin, seed):
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = poly.bounds
    pts, tries = [], 0
    while len(pts) < count and tries < count * 40:
        tries += 1
        x, y = rnd.uniform(minx, maxx), rnd.uniform(miny, maxy)
        if not poly.contains(Point(x, y)):
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < rmin ** 2 for a, b in pts):
            continue
        pts.append((x, y))
    return pts


def trees_json(pts, hlo, hhi, seed):
    rnd = random.Random(seed)
    out = []
    for x, y in pts:
        t = rnd.random()
        out.append([round(x, 1), round(y, 1),
                    round(hlo + (hhi - hlo) * t, 1),
                    round(1.4 + 1.6 * t, 1)])
    return out


def access_roads(site):
    """Подъездные дороги вдоль южной и восточной границ, снаружи забора."""
    ring = list(site.exterior.coords)[:-1]
    nw = min(ring, key=lambda p: p[0] - p[1])
    ne = max(ring, key=lambda p: p[0] + p[1])
    se = max(ring, key=lambda p: p[0] - p[1])
    sw = min(ring, key=lambda p: p[0] + p[1])

    def band(a, b, nx, ny, extend):
        ax, ay = a[0] + nx * ROAD_OFF, a[1] + ny * ROAD_OFF
        bx, by = b[0] + nx * ROAD_OFF, b[1] + ny * ROAD_OFF
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1.0
        dx, dy = dx / n, dy / n
        line = LineString([(ax - dx * extend, ay - dy * extend),
                           (bx + dx * extend, by + dy * extend)])
        return line.buffer(ROAD_W / 2.0, cap_style=2)

    south = band(sw, se, 0.0, -1.0, 260.0)          # вдоль низа, наружу на юг
    east = band(ne, se, 1.0, 0.0, 260.0)            # вдоль правой стороны
    return [south, east]


def main():
    site, _ = G.load_site(os.path.join(G.OUT, C.DEFAULT_SITE), None, C.DEFAULT_SITE_ORDER)
    frame = G.Frame(site)
    titles = {'A': 'Вариант 1 — комплекс и лес',
              'B': 'Вариант 2 — комплекс и 10 гостевых домов'}

    roads = access_roads(site)
    belt = site.buffer(BELT).difference(site.buffer(6.0))
    for r in roads:                                  # лес не растёт на дороге
        belt = belt.difference(r.buffer(5.0))
    out_pts = scatter(belt, TREES_OUT, RMIN_OUT, seed=77)

    out = {}
    for v in ('A', 'B'):
        m = G.build(frame, v)
        m['trees'] = []                              # свои деревья ставим ниже
        s = export_scene.scene(frame, m, titles[v])
        s['trees'] = (trees_json(scatter(m['green'], TREES_IN, RMIN_IN, 12), *H_IN, seed=5) +
                      trees_json(out_pts, *H_OUT, seed=9))
        for r in roads:
            s['slabs'] += [dict(p=p, t='road') for p in export_scene.poly_json(r, 0.4)]
        out[v] = s
        print('вариант %s: деревьев внутри %d, снаружи %d, подъездных дорог %d'
              % (v, TREES_IN, len(out_pts), len(roads)))

    path = os.path.join(G.OUT, 'scene_viz.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('scene_viz.json: %.0f КБ' % (os.path.getsize(path) / 1024.0))


if __name__ == '__main__':
    main()
