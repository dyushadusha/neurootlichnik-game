# -*- coding: utf-8 -*-
"""Экспорт сцены генплана в компактный JSON для веб-просмотра (three.js)."""
import json
import math

from shapely.geometry import Point
from shapely.ops import unary_union

import config as C
import genplan as G
import model3d


def poly_json(g, tol=0.25, nd=2):
    out = []
    for p in (g.geoms if g.geom_type.startswith('Multi') else [g]):
        if not hasattr(p, 'exterior') or p.area < 0.4:
            continue
        p = p.simplify(tol)
        if p.is_empty or not hasattr(p, 'exterior'):
            continue
        ext = [[round(x, nd), round(y, nd)] for x, y in p.exterior.coords]
        holes = [[[round(x, nd), round(y, nd)] for x, y in r.coords] for r in p.interiors]
        out.append({'e': ext, 'h': holes})
    return out


def scene(frame, m, title):
    s = {'title': title, 'site': poly_json(frame.poly, 0.05),
         'inner': poly_json(m['inner'], 0.2), 'slabs': [], 'water': [],
         'walls': [], 'roofs': [], 'canopies': [], 'trees': [], 'labels': [],
         'stalls': [], 'tep': [[n, round(a), round(p, 1)] for n, a, p in G.teп(frame, m)],
         'expl': [[r['n'], r['name'], round(r['area']), r['count']]
                  for r in G.explication(m)],
         'stallCount': m['nstall']}

    for g in m['roads']:
        s['slabs'] += [dict(p=p, t='road') for p in poly_json(g, 0.35)]
    for g in m['lots']:
        s['slabs'] += [dict(p=p, t='parking') for p in poly_json(g, 0.2)]
    for g in m['paths']:
        s['slabs'] += [dict(p=p, t='path') for p in poly_json(g, 0.3)]
    for g in m['stalls']:
        s['stalls'] += [[round(x, 2), round(y, 2)] for x, y in g.exterior.coords[:-1]]

    for it in m['items']:
        for t, g in it['parts']:
            if t == 'building':
                for p in poly_json(g, 0.15):
                    s['walls'].append(dict(p=p, z=0.0, h=round(it['wall'], 2)))
                rings, capped = model3d.roof_rings(
                    g, it['wall'], max(it['h'], it['wall'] + 0.6), it['roof'])
                s['roofs'].append(dict(
                    r=[[[round(x, 2), round(y, 2), round(z, 2)] for x, y, z in ring]
                       for ring in rings], c=capped))
            elif t == 'canopy':
                for p in poly_json(g, 0.15):
                    s['canopies'].append(dict(p=p, h=round(max(it['wall'], 3.0), 2)))
            elif t == 'water':
                s['water'] += poly_json(g, 0.15)
            elif t in ('terrace', 'platform', 'court'):
                for p in poly_json(g, 0.2):
                    s['slabs'].append(dict(p=p, t=t))
        c = it['poly'].centroid
        s['labels'].append([round(c.x, 1), round(c.y, 1), round(it['h'] + 2.0, 1),
                            it['n'], it['name']])

    for x, y in m['trees']:
        rnd = (abs(hash((round(x), round(y)))) % 1000) / 1000.0
        s['trees'].append([round(x, 1), round(y, 1),
                           round(11.0 + rnd * 8.0, 1), round(1.8 + rnd * 1.4, 1)])
    return s


def main():
    import os
    site, _ = G.load_site(os.path.join(G.OUT, C.DEFAULT_SITE), None, C.DEFAULT_SITE_ORDER)
    frame = G.Frame(site)
    titles = {'A': 'Вариант 1 — с гостиницей', 'B': 'Вариант 2 — с гостевыми домиками'}
    out = {}
    for v in ('A', 'B'):
        m = G.build(frame, v)
        m['trees'] = G.scatter_trees(m['green'])
        out[v] = scene(frame, m, titles[v])
    path = os.path.join(G.OUT, 'scene.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('scene.json: %.0f КБ' % (os.path.getsize(path) / 1024.0))


if __name__ == '__main__':
    main()
