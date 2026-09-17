# -*- coding: utf-8 -*-
"""Генплан «БОР 495»: 3D-модель для Rhino 7 + план PNG + ТЭП и проверки.

Запуск:
    python3 genplan.py                    # реальный контур, оба варианта
    python3 genplan.py --site kpt.xml     # по XML КПТ / выписки ЕГРН
    python3 genplan.py --variant A
"""
import argparse
import math
import os
import random

import numpy as np
import rhino3dm as r3
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, unary_union

import config as C
import kpt
import model3d
import shapes

OUT = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- участок ---
def placeholder_site(size=None):
    L, W = size if size else (126.5, 63.2)
    return rotate(Polygon([(0, 0), (L, 0), (L, W), (0, W)]), 18.0, origin=(0, 0))


def load_site(path, size=None, order='egrn'):
    if path is None:
        return placeholder_site(size), True
    ext = os.path.splitext(path)[1].lower()
    pts = (kpt.load_kpt_xml(path, C.CAD_NUMBER) if ext == '.xml'
           else kpt.load_xy_text(path, swap=(order == 'egrn')))
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    cx, cy = poly.exterior.coords[0]
    C.BASE_POINT = (cx, cy)
    return translate(poly, -cx, -cy), False


class Frame(object):
    """Координаты участка (u,v) -> (x,y), билинейно по четырём углам.

    u: 0 — западный торец (въезд), 1 — восточный; v: 0 — северная граница
    (вдоль неё ряд бань), 1 — южная. Вдоль каждой стороны координата линейна,
    поэтому расстановка считается в метрах честно.
    """

    def __init__(self, poly, entry_hint=None):
        self.poly = poly
        c = self._corners(poly)
        north = sorted(c, key=lambda p: -p[1])[:2]
        A, B = sorted(north, key=lambda p: p[0])
        rest = [p for p in c if p is not A and p is not B]
        C_ = min(rest, key=lambda p: math.dist(p, B))
        D = [p for p in rest if p is not C_][0]
        self.A, self.B, self.C, self.D = (np.array(p, float) for p in (A, B, C_, D))
        self.L = math.dist(A, B)
        self.W = (math.dist(A, D) + math.dist(B, C_)) / 2.0

    @staticmethod
    def _corners(poly):
        ring = list(poly.exterior.coords)[:-1]
        if len(ring) != 4:
            ring = list(poly.simplify(2.0).exterior.coords)[:-1]
        if len(ring) != 4:
            ring = list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
        return [tuple(p) for p in ring]

    def xy(self, u, v):
        p = ((1 - u) * (1 - v) * self.A + u * (1 - v) * self.B +
             u * v * self.C + (1 - u) * v * self.D)
        return float(p[0]), float(p[1])

    def angle(self, u, v):
        d = (1 - v) * (self.B - self.A) + v * (self.C - self.D)
        return math.degrees(math.atan2(d[1], d[0]))


# ------------------------------------------------------------- геометрия ----
def smooth(pts, closed=False, iters=3):
    p = list(pts)
    if closed and p[0] == p[-1]:
        p = p[:-1]
    for _ in range(iters):
        out = []
        n = len(p)
        rng = range(n) if closed else range(n - 1)
        if not closed:
            out.append(p[0])
        for i in rng:
            a, b = p[i], p[(i + 1) % n]
            out.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            out.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        if not closed:
            out.append(p[-1])
        p = out
    if closed:
        p.append(p[0])
    return p


def band(pts_xy, width, closed=False, curve=True):
    pts = list(pts_xy)
    if curve and len(pts) > 2:
        pts = smooth(pts, closed=closed)
    return LineString(pts).buffer(width / 2.0, cap_style=2, join_style=1)


def road_band(frame, uv_pts, width, closed=False):
    return band([frame.xy(u, v) for u, v in uv_pts], width, closed)


def ring_line(frame, uv, radius):
    x, y = frame.xy(*uv)
    return Point(x, y).buffer(radius, 64).exterior


def parking_lot(frame, spec):
    sw, sl = C.PARK_STALL
    cols, rows = spec['cols'], spec['rows']
    w, d = cols * sw, rows * sl
    x, y = frame.xy(*spec['uv'])
    ang = frame.angle(*spec['uv']) + spec.get('rot', 0.0)
    lot = translate(rotate(Polygon([(-w / 2 - 1, -d / 2 - 3), (w / 2 + 1, -d / 2 - 3),
                                    (w / 2 + 1, d / 2 + 1), (-w / 2 - 1, d / 2 + 1)]),
                           ang, origin=(0, 0)), x, y)
    stalls = []
    for i in range(cols):
        for j in range(rows):
            dx = -w / 2 + sw * (i + 0.5)
            dy = -d / 2 + sl * (j + 0.5)
            s = translate(Polygon([(-sw / 2 + .1, -sl / 2 + .1), (sw / 2 - .1, -sl / 2 + .1),
                                   (sw / 2 - .1, sl / 2 - .1), (-sw / 2 + .1, sl / 2 - .1)]),
                          dx, dy)
            stalls.append(translate(rotate(s, ang, origin=(0, 0)), x, y))
    return lot, stalls, cols * rows


# ------------------------------------------------------- расстановка --------
def fire_gap(a, b):
    if a == b == 'V':
        return C.FIRE_GAP_V_V
    if a == b == 'III':
        return C.FIRE_GAP_III_III
    return C.FIRE_GAP_V_III


def materialize(frame, it):
    """Собирает части объекта по его положению и разворачивает по границе."""
    cx, cy = it['center']
    parts = shapes.make(it['shape'], it['size'][0], it['size'][1], it['angle'], cx, cy)
    it['parts'] = parts
    vol = [g for t, g in parts if t == 'building']
    it['poly'] = unary_union(vol) if vol else unary_union([g for _, g in parts])
    return it


def move(it, dx, dy):
    it['center'] = (it['center'][0] + dx, it['center'][1] + dy)
    it['poly'] = translate(it['poly'], dx, dy)


def pull_inside(it, inner, step=1.5, iters=200):
    for _ in range(iters):
        if inner.contains(it['poly']):
            return
        c = it['poly'].centroid
        tgt = inner.centroid if not inner.contains(c) else None
        if tgt is None:
            a, _b = nearest_points(inner.exterior, c)
            vx, vy = a.x - c.x, a.y - c.y
        else:
            vx, vy = tgt.x - c.x, tgt.y - c.y
        n = math.hypot(vx, vy) or 1.0
        move(it, step * vx / n, step * vy / n)


def push_off(it, obstacle, bounds, clearance=1.0, iters=40, step=1.0):
    for _ in range(iters):
        if it['poly'].distance(obstacle) >= clearance - 0.01:
            return
        a, b = nearest_points(obstacle, it['poly'])
        vx, vy = b.x - a.x, b.y - a.y
        n = math.hypot(vx, vy)
        if n < 1e-6:
            c = it['poly'].centroid
            a2, _ = nearest_points(obstacle, c)
            vx, vy = c.x - a2.x, c.y - a2.y
            n = math.hypot(vx, vy) or 1.0
        cand = translate(it['poly'], step * vx / n, step * vy / n)
        if not bounds.contains(cand):
            return
        move(it, step * vx / n, step * vy / n)


def relax(frame, items, inner, iters=300):
    movable = [i for i in items if i['kind'] == 'building' and not i.get('fixed')]
    for _ in range(iters):
        moved = 0.0
        for a in range(len(movable)):
            for b in range(a + 1, len(movable)):
                A, B = movable[a], movable[b]
                need = fire_gap(A['fire'], B['fire'])
                got = A['poly'].distance(B['poly'])
                if got >= need - 0.02:
                    continue
                ca, cb = A['poly'].centroid, B['poly'].centroid
                vx, vy = cb.x - ca.x, cb.y - ca.y
                n = math.hypot(vx, vy) or 1.0
                step = min(need - got, 2.0) * 0.5
                for it, sgn in ((A, -1), (B, 1)):
                    dx, dy = sgn * step * vx / n, sgn * step * vy / n
                    if it.get('slide') == 'u':
                        t = math.radians(frame.angle(*it['uv']))
                        pr = dx * math.cos(t) + dy * math.sin(t)
                        dx, dy = pr * math.cos(t), pr * math.sin(t)
                    if inner.buffer(0.05).contains(translate(it['poly'], dx, dy)):
                        move(it, dx, dy)
                        moved += step
        if moved < 0.01:
            break


# ------------------------------------------------------------- дорожки ------
def path_network(frame, items, ctx):
    """Строит пешеходную сеть по узлам: у каждой дорожки реальные начало и конец."""
    by_n = {i['n']: i for i in items}

    def resolve(node):
        if node == 'hub':
            return ctx['rings'][0]
        if node == 'ring11':
            return ctx['rings'][1]
        if node == 'lane':
            return ctx['lane']
        if node == 'plaza':
            return ctx['apron']
        if node == 'loopS':
            return ctx['loop']
        it = by_n.get(node)
        if it is None:
            return None
        deck = [g for t, g in it['parts'] if t in ('terrace', 'platform')]
        return unary_union(deck + [it['poly']])

    def snap(geom, toward):
        g = geom.boundary if hasattr(geom, 'exterior') else geom
        p, _ = nearest_points(g, Point(toward))
        return (p.x, p.y)

    out = []
    for a, b, vias in C.PATH_LINKS:
        ga, gb = resolve(a), resolve(b)
        if ga is None or gb is None:
            continue
        pts = [frame.xy(u, v) for u, v in vias]
        first = pts[0] if pts else gb.centroid.coords[0]
        last = pts[-1] if pts else ga.centroid.coords[0]
        line = [snap(ga, first)] + pts + [snap(gb, last)]
        out.append(band(line, C.PATH_W))
    out.append(ctx['loop'].buffer(C.PATH_W / 2.0))
    for ring in ctx['rings']:
        out.append(ring.buffer(C.PATH_W / 2.0))
    return out


# --------------------------------------------------------------- сборка -----
FRAME_REF = [None]


def build(frame, variant='A'):
    FRAME_REF[0] = frame
    items = [dict(o) for o in C.PROGRAM_BASE]
    if variant in ('A', 'B'):
        items.append(dict(C.HOTEL))
    if variant == 'B':
        pitch = C.COTTAGE_SIZE[0] + fire_gap(C.COTTAGE_FIRE, C.COTTAGE_FIRE)
        for u0, u1, v, nmax in C.COTTAGE_ROWS:
            span = (u1 - u0) * frame.L
            n = max(1, min(nmax, int((span + pitch - C.COTTAGE_SIZE[0]) // pitch)))
            x0 = u0 * frame.L + (span - (n - 1) * pitch) / 2.0
            vv = min(v, (frame.W - C.SETBACK - C.COTTAGE_SIZE[1] / 2.0) / frame.W)
            for i in range(n):
                it = C.B(16, 'Гостевой домик', ((x0 + i * pitch) / frame.L, vv),
                         C.COTTAGE_SIZE, C.COTTAGE_H, C.COTTAGE_FIRE,
                         shape='cottage', wall=3.0, roof='gable')
                it['slide'] = 'u'
                it['group'] = 'Гостевые домики'
                items.append(it)

    for it in items:
        it['center'] = frame.xy(*it['uv'])
        it['angle'] = frame.angle(*it['uv'])
        materialize(frame, it)

    roads = [road_band(frame, C.ENTRY_DRIVE, C.ROAD_W),
             road_band(frame, C.ROW_LANE, C.ROAD_W)]
    lane = roads[1]
    roads += [road_band(frame, r, C.DRIVE_W) for r in C.SPUR_ROADS]
    if variant == 'B':
        roads.append(road_band(frame, [(0.470, 0.760), (0.600, 0.830), (0.700, 0.855),
                                       (0.800, 0.840), (0.860, 0.800)], C.DRIVE_W))

    inner = frame.poly.buffer(-C.SETBACK)
    for it in items:
        pull_inside(it, inner)
    relax(frame, items, inner)
    ways = unary_union(roads)
    for it in items:                      # ни объём, ни терраса, ни бассейн не лезут на проезд
        whole = unary_union([g for _, g in it['parts']])
        if it['kind'] == 'building' and whole.distance(ways) < 1.0:
            d0 = it['center']
            probe = dict(it, poly=whole)
            push_off(probe, ways, inner.buffer(6.0), clearance=1.2)
            move(it, probe['center'][0] - d0[0], probe['center'][1] - d0[1])
            materialize(FRAME_REF[0], it)
    relax(frame, items, inner, iters=120)
    for it in items:
        materialize(frame, it)

    lots, stalls, nstall = [], [], 0
    obst = [i['poly'] for i in items if i['kind'] == 'building']
    for spec in C.PARKING:
        lot, st, n = parking_lot(frame, spec)
        d = _clear_of(lot, obst, frame.poly.buffer(-1.0))
        lots.append(translate(lot, *d))
        stalls += [translate(x, *d) for x in st]
        nstall += n

    kppg = [i['poly'] for i in items if i['n'] == 1]
    blobs = [roads[0].buffer(C.PAVED_AROUND['drive'])]
    blobs += [g.buffer(C.PAVED_AROUND['kpp']) for g in kppg]
    blobs += [lots[0].buffer(C.PAVED_AROUND['parking'])] if lots else []
    apron = unary_union(blobs).convex_hull.intersection(inner)
    for g in kppg:
        apron = apron.difference(g)
    roads.append(apron)
    for lot in lots[1:]:
        roads.append(lot.buffer(C.PAVED_AROUND['parking']).convex_hull.intersection(inner))

    ctx = dict(lane=lane, apron=apron,
               loop=LineString([frame.xy(u, v) for u, v in smooth(C.LOOP_SOUTH, True)]),
               rings=[ring_line(frame, uv, r) for uv, r in C.RINGS])
    paths = path_network(frame, items, ctx)

    hard = unary_union(roads + paths + lots +
                       [g for i in items for t, g in i['parts']])
    green = frame.poly.buffer(-2.0).difference(hard.buffer(2.5))
    return dict(items=items, roads=roads, paths=paths, lots=lots, stalls=stalls,
                nstall=nstall, green=green, hard=hard, inner=inner)


def _clear_of(lot, obstacles, bounds, step=1.0, iters=80):
    dx = dy = 0.0
    cur = lot
    for _ in range(iters):
        hit = [o for o in obstacles if cur.intersects(o.buffer(1.0))]
        if not hit:
            break
        c = cur.centroid
        vx = vy = 0.0
        for o in hit:
            oc = o.centroid
            ax, ay = c.x - oc.x, c.y - oc.y
            n = math.hypot(ax, ay) or 1.0
            vx += ax / n
            vy += ay / n
        n = math.hypot(vx, vy) or 1.0
        nx, ny = step * vx / n, step * vy / n
        cand = translate(cur, nx, ny)
        if not bounds.contains(cand):
            break
        cur, dx, dy = cand, dx + nx, dy + ny
    return dx, dy


# -------------------------------------------------------------- проверки ----
def checks(frame, m):
    site, inner = frame.poly, m['inner']
    msgs = []
    for it in m['items']:
        whole = unary_union([g for _, g in it['parts']])
        if not site.buffer(0.05).contains(whole):
            msgs.append('ВЫХОД ЗА ГРАНИЦУ: %s' % it['name'])
        elif it['kind'] == 'building' and not inner.buffer(0.05).contains(it['poly']):
            msgs.append('Отступ < %.0f м от границы: %s' % (C.SETBACK, it['name']))
    for lot, spec in zip(m['lots'], C.PARKING):
        for it in m['items']:
            if it['kind'] == 'building' and lot.intersects(it['poly'].buffer(-0.1)):
                msgs.append('Парковка «%s» накладывается на %s' % (spec['name'], it['name']))
    bl = [i for i in m['items'] if i['kind'] == 'building']
    for a in range(len(bl)):
        for b in range(a + 1, len(bl)):
            A, B = bl[a], bl[b]
            need = fire_gap(A['fire'], B['fire'])
            got = A['poly'].distance(B['poly'])
            if got < need - 0.05:
                msgs.append('Противопожарный разрыв %.1f м < %.0f м: %s / %s'
                            % (got, need, A['name'], B['name']))
    return msgs


def teп(frame, m):
    site = frame.poly
    foot = unary_union([i['poly'] for i in m['items']])
    hard = unary_union(m['roads'] + m['paths'] + m['lots'] +
                       [g for i in m['items'] for t, g in i['parts']
                        if t in ('terrace', 'platform', 'court')]).difference(foot)
    water = unary_union([g for i in m['items'] for t, g in i['parts'] if t == 'water'])
    green = site.difference(unary_union([foot, hard, water]))
    s = site.area
    return [('Площадь участка', s, 100.0),
            ('Застройка (здания)', foot.area, 100 * foot.area / s),
            ('Покрытия, террасы, площадки', hard.area, 100 * hard.area / s),
            ('Вода (бассейны)', water.area, 100 * water.area / s),
            ('Озеленение / лес', green.area, 100 * green.area / s)]


def explication(m):
    rows, seen = [], {}
    for it in m['items']:
        key = it.get('group') or it['name']
        if key in seen:
            seen[key]['count'] += 1
            seen[key]['area'] += (it['poly'].area if it['kind'] == 'building'
                                  else unary_union([g for _, g in it['parts']]).area)
            continue
        area = (it['poly'].area if it['kind'] == 'building'
                else unary_union([g for _, g in it['parts']]).area)
        r = dict(n=it['n'], name=key, size=it['size'], h=it['h'], count=1,
                 area=area, kind=it['kind'])
        seen[key] = r
        rows.append(r)
    rows.sort(key=lambda r: (r['n'] == 0, r['n']))
    return rows


# --------------------------------------------------------------- экспорт ----
def to_3dm(frame, m, path):
    md = model3d.Model()
    md.curve(frame.poly, '01 Граница участка')
    md.curve(m['inner'], '02 Линия отступа')

    fence = frame.poly.buffer(-0.3).exterior.coords
    for a, b in zip(fence, list(fence)[1:]):
        md.f.Objects.AddPolyline(
            [r3.Point3d(a[0], a[1], 0), r3.Point3d(b[0], b[1], 0),
             r3.Point3d(b[0], b[1], 2.2), r3.Point3d(a[0], a[1], 2.2),
             r3.Point3d(a[0], a[1], 0)], md.att('03 Забор'))

    for g in m['roads']:
        md.prism(g, *reversed(model3d.SLAB['road'][::-1]), z0=-0.12) if False else \
            md.prism(g, model3d.SLAB['road'][0], -0.12, model3d.SLAB['road'][1])
    for g in m['paths']:
        md.prism(g, model3d.SLAB['path'][0], -0.06, model3d.SLAB['path'][1])
    for g in m['lots']:
        md.prism(g, model3d.SLAB['parking'][0], -0.12, model3d.SLAB['parking'][1])
    for g in m['stalls']:
        md.curve(g, '05 Парковка', 0.02)

    for it in m['items']:
        for t, g in it['parts']:
            if t == 'building':
                md.prism(g, '11 Здания - стены', 0.0, it['wall'])
                model3d.roof(md, g, it['wall'], max(it['h'], it['wall'] + 0.5),
                             it['roof'])
            elif t == 'canopy':
                model3d.canopy(md, g, max(it['wall'], 3.0))
            elif t == 'water':
                model3d.pool(md, g)
            elif t in ('terrace', 'platform', 'court'):
                lay, th = model3d.SLAB[t]
                md.prism(g, lay, 0.0, th)
        c = it['poly'].centroid
        md.dot('%d. %s' % (it['n'], it['name']), c.x, c.y, it['h'] + 1.5)

    n = model3d.trees(md, m['green'], count=300)
    ok = md.f.Write(path, 7)
    return ok, n, len(md.f.Objects)


def to_png(frame, m, path, title):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import PathPatch, Rectangle
    from matplotlib.path import Path

    fig, (ax, panel) = plt.subplots(
        1, 2, figsize=(19, 12), dpi=150, gridspec_kw={'width_ratios': [3.1, 1.25]})
    ax.set_facecolor('#eef1e8')
    panel.axis('off')
    panel.set_xlim(0, 1)
    panel.set_ylim(0, 1)

    def draw(geom, **kw):
        if geom.is_empty:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            if not hasattr(g, 'exterior'):
                continue
            verts, codes = [], []
            for ring in [g.exterior] + list(g.interiors):
                pts = list(ring.coords)
                verts += pts
                codes += [Path.MOVETO] + [Path.LINETO] * (len(pts) - 2) + [Path.CLOSEPOLY]
            ax.add_patch(PathPatch(Path(verts, codes), **kw))

    K = dict(site='#e3e9d8', road='#8c8c92', park='#b9b9c2', path='#cfc6b4',
             bld='#b07a3c', bld_e='#5a3c1c', terr='#d8b98c', water='#7fc4e8',
             plat='#c9d3ae', court='#3d7a53', canopy='#e0d3bb', tree='#6d9e63')

    draw(frame.poly, facecolor=K['site'], edgecolor='#cc2222', lw=2.5, zorder=1)
    draw(m['inner'], facecolor='none', edgecolor='#ff9900', lw=0.9, ls='--', zorder=2)
    for x, y in m.get('trees', []):
        ax.add_patch(plt.Circle((x, y), 2.6, color=K['tree'], alpha=0.5, zorder=2))
    for g in m['roads']:
        draw(g, facecolor=K['road'], edgecolor='none', zorder=3)
    for g in m['paths']:
        draw(g, facecolor=K['path'], edgecolor='none', zorder=3)
    for g in m['lots']:
        draw(g, facecolor=K['park'], edgecolor='#7a7a82', lw=0.6, zorder=4)
    for g in m['stalls']:
        draw(g, facecolor='none', edgecolor='#ffffff', lw=0.6, zorder=5)

    order = {'platform': 6, 'terrace': 7, 'court': 7, 'water': 8, 'canopy': 9,
             'building': 10}
    style = {'platform': (K['plat'], '#8a9a72'), 'terrace': (K['terr'], '#9a7748'),
             'court': (K['court'], '#25503a'), 'water': (K['water'], '#3f7fa5'),
             'canopy': (K['canopy'], '#a08d6d'), 'building': (K['bld'], K['bld_e'])}
    for it in m['items']:
        for t, g in it['parts']:
            fc, ec = style.get(t, (K['plat'], '#777777'))
            draw(g, facecolor=fc, edgecolor=ec, lw=0.9, zorder=order.get(t, 6))
        c = it['poly'].centroid
        ax.text(c.x, c.y, str(it['n']), ha='center', va='center', fontsize=8.5,
                color='white', zorder=12,
                bbox=dict(boxstyle='circle,pad=0.22', fc='#222222', ec='none'))

    minx, miny, maxx, maxy = frame.poly.bounds
    pad = 14
    ax.set_xlim(minx - pad, maxx + pad)
    ax.set_ylim(miny - pad, maxy + pad)
    ax.set_aspect('equal')
    ax.grid(True, color='#ffffff', lw=0.4, alpha=0.6)
    ax.set_title(title, fontsize=15, pad=12)
    ax.set_xlabel('X, м (восток)')
    ax.set_ylabel('Y, м (север)')
    x0, y0 = minx - pad + 8, miny - pad + 8
    ax.plot([x0, x0 + 50], [y0, y0], color='black', lw=3)
    ax.text(x0 + 25, y0 + 3, '50 м', ha='center', fontsize=10)
    nx_, ny_ = minx - pad + 8, maxy - 6
    ax.annotate('С', xy=(nx_, ny_), xytext=(nx_, ny_ - 24), ha='center', fontsize=12,
                arrowprops=dict(arrowstyle='-|>', color='black', lw=1.4))

    rows = explication(m)
    y = 0.985
    panel.text(0, y, 'ЭКСПЛИКАЦИЯ', fontsize=12, weight='bold', va='top')
    y -= 0.030
    panel.text(0, y, '%-3s %-26s %8s' % ('№', 'наименование', 'S, м²'),
               fontsize=7.6, family='monospace', va='top', color='#555555')
    y -= 0.018
    for r in rows:
        nm = r['name'] + (' (%d шт.)' % r['count'] if r['count'] > 1 else '')
        panel.text(0, y, '%-3s %-26s %8.0f' % (r['n'], nm[:26], r['area']),
                   fontsize=7.6, family='monospace', va='top')
        y -= 0.0185
    panel.text(0, y - 0.004, '%-30s %8.0f' % ('ИТОГО по экспликации',
               sum(r['area'] for r in rows)), fontsize=7.6, family='monospace',
               va='top', weight='bold')
    y -= 0.050
    panel.text(0, y, 'УСЛОВНЫЕ ОБОЗНАЧЕНИЯ', fontsize=12, weight='bold', va='top')
    y -= 0.030
    keys = [('Граница участка', 'none', '#cc2222', 2.0),
            ('Линия отступа 3 м', 'none', '#ff9900', 1.0),
            ('Здания', K['bld'], K['bld_e'], 1.0),
            ('Навесы', K['canopy'], '#a08d6d', 1.0),
            ('Террасы, настилы', K['terr'], '#9a7748', 1.0),
            ('Бассейны, купели', K['water'], '#3f7fa5', 1.0),
            ('Площадки', K['plat'], '#8a9a72', 1.0),
            ('Корты', K['court'], '#25503a', 1.0),
            ('Проезды', K['road'], 'none', 0),
            ('Парковка (%d м/м)' % m['nstall'], K['park'], '#7a7a82', 0.6),
            ('Пешеходные дорожки', K['path'], 'none', 0),
            ('Озеленение / лес', K['site'], '#b8c3a5', 0.6)]
    for name, fc, ec, lw in keys:
        panel.add_patch(Rectangle((0, y - 0.016), 0.09, 0.016, facecolor=fc,
                                  edgecolor=ec, lw=lw, transform=panel.transAxes,
                                  clip_on=False))
        panel.text(0.115, y - 0.004, name, fontsize=8.2, va='top')
        y -= 0.026
    y -= 0.022
    panel.text(0, y, 'ТЭП', fontsize=12, weight='bold', va='top')
    y -= 0.030
    for name, a, pct in teп(frame, m):
        panel.text(0, y, '%-28s %7.0f м²  %4.1f%%' % (name[:28], a, pct),
                   fontsize=7.4, family='monospace', va='top')
        y -= 0.0185
    fig.savefig(path, bbox_inches='tight')
    plt.close(fig)


def report(frame, m, msgs, path, title):
    lines = [title, '=' * len(title), '',
             'Кадастровый номер: %s' % C.CAD_NUMBER,
             'Привязка: %s' % (str(C.BASE_POINT) if C.BASE_POINT else 'локальные координаты'),
             'Участок: %.0f м2, габарит %.1f x %.1f м' % (frame.poly.area, frame.L, frame.W),
             '', 'ЭКСПЛИКАЦИЯ', '-' * 60]
    for r in explication(m):
        nm = r['name'] + (' (%d шт.)' % r['count'] if r['count'] > 1 else '')
        lines.append('%-3s %-32s %5.0f x %-5.0f %7.0f м2  h=%.1f м'
                     % (r['n'], nm, r['size'][0], r['size'][1], r['area'], r['h']))
    lines += ['', 'ТЕХНИКО-ЭКОНОМИЧЕСКИЕ ПОКАЗАТЕЛИ', '-' * 60]
    for name, a, pct in teп(frame, m):
        lines.append('%-34s %9.0f м2  %5.1f %%' % (name, a, pct))
    lines += ['', 'Машиномест: %d' % m['nstall'],
              'Объектов на плане: %d (позиций в экспликации: %d)'
              % (len(m['items']), len(explication(m))),
              'Дорожек в сети: %d, все с привязкой начала и конца' % len(m['paths']),
              '', 'ПРОВЕРКИ', '-' * 60]
    lines += (['  нарушений не найдено'] if not msgs else ['  ! ' + s for s in msgs])
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return '\n'.join(lines)


def scatter_trees(green, count=300, seed=12, rmin=6.0):
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = green.bounds
    pts = []
    tries = 0
    while len(pts) < count and tries < count * 60:
        tries += 1
        x, y = rnd.uniform(minx, maxx), rnd.uniform(miny, maxy)
        if not green.contains(Point(x, y)):
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < rmin ** 2 for a, b in pts):
            continue
        pts.append((x, y))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', default=None)
    ap.add_argument('--site-order', default='egrn', choices=['egrn', 'xy'])
    ap.add_argument('--site-size', default=None)
    ap.add_argument('--placeholder', action='store_true')
    ap.add_argument('--variant', default='both', choices=['A', 'B', 'both'])
    ap.add_argument('--suffix', default='')
    a = ap.parse_args()

    size = tuple(float(t) for t in a.site_size.lower().split('x')) if a.site_size else None
    order, site_path = a.site_order, a.site
    if site_path is None and not a.placeholder and not size:
        site_path = os.path.join(OUT, C.DEFAULT_SITE)
        order = C.DEFAULT_SITE_ORDER
    site, is_placeholder = load_site(site_path, size, order)
    frame = Frame(site)

    titles = {'A': 'БОР 495 — генплан, вариант 1 (с гостиницей)',
              'B': 'БОР 495 — генплан, вариант 2 (с гостевыми домиками)'}
    for v in (['A', 'B'] if a.variant == 'both' else [a.variant]):
        m = build(frame, v)
        m['trees'] = scatter_trees(m['green'])
        msgs = checks(frame, m)
        base = os.path.join(OUT, 'BOR495_genplan_%s%s' % (v, a.suffix))
        ok, ntree, nobj = to_3dm(frame, m, base + '.3dm')
        to_png(frame, m, base + '.png', titles[v])
        print(report(frame, m, msgs, base + '.txt', titles[v]))
        print('\n3dm: %s (%s), объектов %d, деревьев %d\n' % (base + '.3dm', ok, nobj, ntree))
    if is_placeholder:
        print('!!! Участок — заглушка')


if __name__ == '__main__':
    main()
