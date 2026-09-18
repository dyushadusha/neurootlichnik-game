# -*- coding: utf-8 -*-
"""Экспорт сцены генплана в компактный JSON для веб-просмотра (three.js)."""
import json
import os

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
        out.append({'e': [[round(x, nd), round(y, nd)] for x, y in p.exterior.coords],
                    'h': [[[round(x, nd), round(y, nd)] for x, y in r.coords]
                          for r in p.interiors]})
    return out


def scene(frame, m, title):
    s = {'title': title, 'site': poly_json(frame.poly, 0.05),
         'fence': [p for g in m.get('fence', []) for p in poly_json(g, 0.05)],
         'slabs': [], 'water': [], 'vols': [], 'roofs': [], 'cyls': [], 'barrels': [],
         'glass': [], 'rails': [], 'lamps': [], 'benches': [],
         'equip': [], 'trees': [], 'labels': [], 'stalls': [],
         'stallCount': m['nstall'],
         'tep': [[n, round(a), None if p is None else round(p, 1), u]
                 for n, a, p, u in G.teп(frame, m)],
         'expl': [[r['n'], r['name'], round(r['area']), r['count']]
                  for r in G.explication(m)]}

    for g in m['roads']:
        s['slabs'] += [dict(p=p, t='road') for p in poly_json(g, 0.35)]
    for g in m['lots']:
        s['slabs'] += [dict(p=p, t='parking') for p in poly_json(g, 0.2)]
    for g in m['paths']:
        s['slabs'] += [dict(p=p, t='path') for p in poly_json(g, 0.3)]
    for g in m.get('trails', []):
        s['slabs'] += [dict(p=p, t='trail') for p in poly_json(g, 0.25)]
    for g in m['stalls']:
        for q in (g.geoms if g.geom_type.startswith('Multi') else [g]):
            if q.is_empty or not hasattr(q, 'exterior') or q.area < 3.0:
                continue
            ring = list(q.exterior.coords)[:-1]
            if len(ring) == 4:
                s['stalls'] += [[round(x, 2), round(y, 2)] for x, y in ring]

    roof_tris, wall_tris = [], []
    for it in m['items']:
        for t, sp in it['parts']:
            if t == 'volume':
                for p in poly_json(sp['poly'], 0.12):
                    s['vols'].append(dict(p=p, z=round(sp['z0'], 2),
                                          h=round(sp['wall'] - sp['z0'], 2)))
                roof_tris += model3d.roof_tris(sp['poly'], sp['roof'], sp['wall'],
                                               sp['ridge'], sp.get('over', 0.9))
                wall_tris.extend(model3d.wall_fill_tris(sp['poly'], sp['roof'],
                                                        sp['wall'], sp['ridge']))
            elif t == 'canopy':
                roof_tris += model3d.roof_tris(sp['poly'], sp['roof'], sp['wall'],
                                               sp['ridge'], sp.get('over', 1.1))
                for x, y, r in sp.get('cols', []):
                    s['cyls'].append([round(x, 2), round(y, 2), round(r, 2),
                                      round(sp['z0'], 2), round(sp['wall'], 2), 0])
            elif t == 'column':
                for x, y, r in sp['pts']:
                    s['cyls'].append([round(x, 2), round(y, 2), round(r, 2), 0,
                                      round(sp['h'], 2), 0])
            elif t == 'entrance':
                continue
            elif t == 'bench':
                s['benches'].append([round(sp['pt'][0], 1), round(sp['pt'][1], 1),
                                     round(sp.get('ang', 0.0), 1)])
            elif t == 'lamp':
                s['lamps'].append([round(sp['pt'][0], 1), round(sp['pt'][1], 1),
                                   round(sp.get('h', 6.0), 2),
                                   0 if sp.get('kind') == 'road' else 1])
            elif t == 'glass':
                for p in poly_json(sp['poly'], 0.05):
                    s['glass'].append(dict(p=p, z=round(sp['z0'], 2),
                                           h=round(sp['h'], 2)))
            elif t == 'rail':
                s['rails'].append([[round(x, 2), round(y, 2)] for x, y in sp['line']]
                                  + [round(sp.get('h', 1.05), 2)])
            elif t == 'barrel':
                s['barrels'].append([round(sp['cx'], 2), round(sp['cy'], 2),
                                     round(sp['r'], 2), round(sp['length'], 2),
                                     round(sp['ang'], 2), round(sp.get('z0', 0.0), 2)])
            elif t == 'plinth':
                for p in poly_json(sp['poly'], 0.15):
                    s['slabs'].append(dict(p=p, t='plinth', z=round(sp['h'], 2)))
            elif t == 'chimney':
                c = sp['poly'].centroid
                r = max(0.5, (sp['poly'].area / 3.14) ** 0.5)
                s['cyls'].append([round(c.x, 2), round(c.y, 2), round(r, 2), 0,
                                  round(sp['h'], 2), 1])
            elif t == 'tub':
                c = sp['poly'].centroid
                r = (sp['poly'].area / 3.14159) ** 0.5
                s['cyls'].append([round(c.x, 2), round(c.y, 2), round(r, 2), 0,
                                  round(sp['h'], 2), 2])
            elif t == 'equip':
                for p in poly_json(sp['poly'], 0.1):
                    s['equip'].append(dict(p=p, h=round(sp.get('h', 1.0), 2)))
            elif t == 'water':
                s['water'] += poly_json(sp['poly'], 0.15)
            elif t in ('deck', 'platform', 'court'):
                for p in poly_json(sp['poly'], 0.18):
                    s['slabs'].append(dict(p=p, t=t, z=round(sp.get('h', 0.2), 2)))
        c = it['poly'].centroid
        s['labels'].append([round(c.x, 1), round(c.y, 1), round(it['h'] + 2.0, 1),
                            it['n'], it['name']])

    s['roofs'] = [round(v, 2) for tri in roof_tris for p in tri for v in p]
    s['wallfill'] = [round(v, 2) for tri in wall_tris for p in tri for v in p]

    for t, sp in m.get('furn', []):
        if t == 'lamp':
            s['lamps'].append([round(sp['pt'][0], 1), round(sp['pt'][1], 1),
                               round(sp.get('h', 6.0), 2),
                               0 if sp.get('kind') == 'road' else 1])
        elif t == 'bench':
            s['benches'].append([round(sp['pt'][0], 1), round(sp['pt'][1], 1),
                                 round(sp.get('ang', 0.0), 1)])
    for x, y in m['trees']:
        rnd = (abs(hash((round(x), round(y)))) % 1000) / 1000.0
        s['trees'].append([round(x, 1), round(y, 1),
                           round(12.0 + rnd * 8.0, 1), round(1.9 + rnd * 1.5, 1)])
    return s


def main():
    site, _ = G.load_site(os.path.join(G.OUT, C.DEFAULT_SITE), None, C.DEFAULT_SITE_ORDER)
    frame = G.Frame(site)
    titles = {'A': 'Вариант 1 — комплекс и лес',
              'B': 'Вариант 2 — комплекс и 10 гостевых домов'}
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
