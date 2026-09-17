# -*- coding: utf-8 -*-
"""Генератор генплана «БОР 495»: .3dm для Rhino 7 + план PNG + ТЭП/проверки.

Запуск:  python3 genplan.py [--site FILE] [--variant A|B|both]
  --site  XML КПТ/выписки ЕГРН либо текстовый список координат.
          Без него берётся PLACEHOLDER-участок из config.py.
"""
import argparse
import math
import os

import numpy as np
import rhino3dm as r3
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, unary_union

import config as C
import kpt

OUT = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- геометрия --
def placeholder_site(size=None):
    """Прямоугольник-заглушка вместо кадастрового контура."""
    L, W = size if size else (C.PLACEHOLDER_SITE['length'], C.PLACEHOLDER_SITE['width'])
    p = Polygon([(0, 0), (L, 0), (L, W), (0, W)])
    p = rotate(p, C.PLACEHOLDER_SITE['azimuth_deg'], origin=(0, 0))
    return p


def load_site(path, size=None, order='egrn'):
    if path is None:
        return placeholder_site(size), True
    ext = os.path.splitext(path)[1].lower()
    pts = (kpt.load_kpt_xml(path, C.CAD_NUMBER) if ext == '.xml'
           else kpt.load_xy_text(path, swap=(order == 'egrn')))
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    # переносим в локальные координаты, чтобы модель стояла у начала координат
    cx, cy = poly.exterior.coords[0]
    C.BASE_POINT = (cx, cy)
    return translate(poly, -cx, -cy), False


class Frame(object):
    """Локальная система координат участка: (u,v) -> (x,y), билинейно по 4 углам.

    Композиция снята с исходной схемы (косая перспектива) после проективного
    выпрямления и хранится в нормированных координатах:
      u: 0 — западный торец (въезд), 1 — восточный торец;
      v: 0 — северная граница (вдоль неё стоит ряд бань), 1 — южная граница.
    Билинейное отображение переносит её на любой четырёхугольный контур:
    вдоль каждой стороны координата линейна, поэтому расстановка ряда
    считается в метрах честно.
    """

    def __init__(self, poly, entry_hint=None):
        self.poly = poly
        c = self._corners(poly)
        # A — западный конец северной стороны, дальше по часовой: B, C, D
        north = sorted(c, key=lambda p: -p[1])[:2]
        A, B = sorted(north, key=lambda p: p[0])
        rest = [p for p in c if p is not A and p is not B]
        C = min(rest, key=lambda p: math.dist(p, B))
        D = [p for p in rest if p is not C][0]
        self.A, self.B, self.C, self.D = (np.array(p, float) for p in (A, B, C, D))
        self.L = math.dist(A, B)
        self.W = (math.dist(A, D) + math.dist(B, C)) / 2.0
        self.rect = poly.minimum_rotated_rectangle

    @staticmethod
    def _corners(poly):
        """Четыре угла контура; для многоугольной границы — описанный прямоугольник."""
        ring = list(poly.exterior.coords)[:-1]
        if len(ring) != 4:
            simple = poly.simplify(2.0)
            ring = list(simple.exterior.coords)[:-1]
        if len(ring) != 4:
            ring = list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
        return [tuple(p) for p in ring]

    def xy(self, u, v):
        p = ((1 - u) * (1 - v) * self.A + u * (1 - v) * self.B +
             u * v * self.C + (1 - u) * v * self.D)
        return float(p[0]), float(p[1])

    def angle(self, u, v):
        """Направление оси u в точке — здания разворачиваются вдоль границы."""
        d = ((1 - v) * (self.B - self.A) + v * (self.C - self.D))
        return math.degrees(math.atan2(d[1], d[0]))

    @property
    def angle_deg(self):
        return self.angle(0.5, 0.0)


def rect_at(frame, uv, size, rot=0.0):
    """Прямоугольник size=(вдоль оси, поперёк) с центром в uv."""
    w, d = size
    x, y = frame.xy(*uv)
    p = Polygon([(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)])
    p = rotate(p, frame.angle(*uv) + rot, origin=(0, 0))
    return translate(p, x, y)


def smooth(pts, closed=False, iters=3):
    """Сглаживает ломаную по Чайкину — из осевых линий получаются плавные кривые."""
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


def ring_band(frame, uv, radius, width):
    """Кольцевая дорожка вокруг площадки."""
    x, y = frame.xy(*uv)
    return Point(x, y).buffer(radius).exterior.buffer(width / 2.0)


def road_band(frame, uv_pts, width, closed=False, curve=True):
    pts = [frame.xy(u, v) for u, v in uv_pts]
    if curve and len(pts) > 2:
        pts = smooth(pts, closed=closed)
    return LineString(pts).buffer(width / 2.0, cap_style=2, join_style=1)


def parking_lot(frame, spec):
    """Ряды машиномест + проезд. Возвращает (полигон площадки, места, N)."""
    sw, sl = C.PARK_STALL
    cols, rows = spec['cols'], spec['rows']
    w = cols * sw
    d = rows * sl
    lot = rect_at(frame, spec['uv'], (w + 1.0, d + 1.0), spec.get('rot', 0.0))
    x, y = frame.xy(*spec['uv'])
    stalls = []
    for i in range(cols):
        for j in range(rows):
            dx = -w / 2 + sw * (i + 0.5)
            dy = -d / 2 + sl * (j + 0.5)
            s = Polygon([(-sw / 2 + 0.1, -sl / 2 + 0.1), (sw / 2 - 0.1, -sl / 2 + 0.1),
                         (sw / 2 - 0.1, sl / 2 - 0.1), (-sw / 2 + 0.1, sl / 2 - 0.1)])
            s = translate(s, dx, dy)
            s = rotate(s, frame.angle(*spec['uv']) + spec.get('rot', 0.0), origin=(0, 0))
            stalls.append(translate(s, x, y))
    return lot, stalls, cols * rows


# ----------------------------------------------------------------- сборка ---
def fire_gap(a, b):
    if a == b == 'V':
        return C.FIRE_GAP_V_V
    if a == b == 'III':
        return C.FIRE_GAP_III_III
    return C.FIRE_GAP_V_III


def place_facade_row(frame, items):
    """Раскладывает фасадный ряд вдоль «банной» границы с нормативными разрывами.

    Ряд центрируется в отведённом диапазоне; если длины участка не хватает,
    объекты всё равно ставятся встык-с-разрывом, а дефицит уходит в отчёт.
    """
    row = [i for n in C.ROW_FACADE for i in items if i['n'] == n]
    if not row:
        return
    gaps = [fire_gap(row[k]['fire'], row[k + 1]['fire']) for k in range(len(row) - 1)]
    need = sum(i['size'][0] for i in row) + sum(gaps)
    u0, u1 = C.ROW_FACADE_U
    avail = (u1 - u0) * frame.L
    start = u0 * frame.L + max((avail - need) / 2.0, 0.0)
    frame.row_need, frame.row_avail = need, avail

    x = start
    for k, it in enumerate(row):
        w, d = it['size']
        u = (x + w / 2.0) / frame.L
        v = (C.SETBACK + d / 2.0) / frame.W
        it['uv'] = (u, v)
        it['slide'] = 'u'
        it['poly'] = rect_at(frame, (u, v), it['size'], it['rot'])
        x += w + (gaps[k] if k < len(gaps) else 0.0)


def relax(frame, items, inner, iters=400):
    """Разводит здания до нормативных разрывов.

    Итеративно раздвигает пары, у которых разрыв меньше требуемого, и держит
    всё внутри линии отступа. Объекты фасадного ряда двигаются только вдоль
    длинной оси участка, КПП зафиксирован у въезда.
    """
    B_ = [i for i in items if i['kind'] == 'building' and not i.get('fixed')]
    for _ in range(iters):
        moved = 0.0
        for a in range(len(B_)):
            for b in range(a + 1, len(B_)):
                A, Bb = B_[a], B_[b]
                need = fire_gap(A['fire'], Bb['fire'])
                got = A['poly'].distance(Bb['poly'])
                if got >= need - 0.02:
                    continue
                d = need - got
                ca, cb = A['poly'].centroid, Bb['poly'].centroid
                vx, vy = cb.x - ca.x, cb.y - ca.y
                n = math.hypot(vx, vy) or 1.0
                vx, vy = vx / n, vy / n
                step = min(d, 2.0) * 0.5
                _shift(frame, A, -vx * step, -vy * step, inner)
                _shift(frame, Bb, vx * step, vy * step, inner)
                moved += step
        if moved < 0.01:
            break
    for it in items:                      # объекты-спутники за своим зданием
        if it.get('anchor_to'):
            host = next(i for i in items if i['n'] == it['anchor_to'])
            hc = host['poly'].centroid
            du, dv = it['anchor_off']
            a = math.radians(frame.angle(*host['uv']))
            ex = (math.cos(a), math.sin(a))
            ey = (-math.sin(a), math.cos(a))
            x = hc.x + ex[0] * du + ey[0] * dv
            y = hc.y + ex[1] * du + ey[1] * dv
            it['poly'] = translate(
                rotate(Polygon([(-it['size'][0] / 2, -it['size'][1] / 2),
                                (it['size'][0] / 2, -it['size'][1] / 2),
                                (it['size'][0] / 2, it['size'][1] / 2),
                                (-it['size'][0] / 2, it['size'][1] / 2)]),
                       frame.angle(*host['uv']), origin=(0, 0)), x, y)


def _shift(frame, it, dx, dy, inner):
    if it.get('slide') == 'u':            # ряд — только вдоль границы
        a = math.radians(frame.angle(*it['uv']))
        ex = (math.cos(a), math.sin(a))
        t = dx * ex[0] + dy * ex[1]
        dx, dy = ex[0] * t, ex[1] * t
    cand = translate(it['poly'], dx, dy)
    if not inner.buffer(0.05).contains(cand):
        return
    it['poly'] = cand


def _clear_of(lot, obstacles, bounds, step=1.0, iters=80):
    """Сдвигает парковку с пятен застройки. Возвращает суммарный сдвиг (dx,dy)."""
    dx = dy = 0.0
    cur = lot
    for _ in range(iters):
        hit = [o for o in obstacles if cur.intersects(o.buffer(1.0))]
        if not hit:
            break
        vx = vy = 0.0
        c = cur.centroid
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


def pull_inside(geom, inner, step=1.5, iters=200):
    """Втягивает пятно внутрь линии отступа (участок — не прямоугольник)."""
    cur = geom
    for _ in range(iters):
        if inner.contains(cur):
            break
        a, b = nearest_points(inner.exterior, cur.centroid)
        c = cur.centroid
        vx, vy = a.x - c.x, a.y - c.y
        n = math.hypot(vx, vy) or 1.0
        if inner.contains(c):             # центр внутри — тянем к центроиду участка
            ic = inner.centroid
            vx, vy = ic.x - c.x, ic.y - c.y
            n = math.hypot(vx, vy) or 1.0
        cur = translate(cur, step * vx / n, step * vy / n)
    return cur


def push_off(geom, obstacle, bounds, clearance=1.0, iters=40, step=1.0):
    """Отодвигает пятно от препятствия (проезда) на нужный просвет."""
    cur = geom
    for _ in range(iters):
        if cur.distance(obstacle) >= clearance - 0.01:
            break
        a, b = nearest_points(obstacle, cur)
        vx, vy = b.x - a.x, b.y - a.y
        n = math.hypot(vx, vy)
        if n < 1e-6:                      # пятно лежит прямо на проезде
            c = cur.centroid
            a2, _ = nearest_points(obstacle, c)
            vx, vy = c.x - a2.x, c.y - a2.y
            n = math.hypot(vx, vy) or 1.0
        cand = translate(cur, step * vx / n, step * vy / n)
        if not bounds.contains(cand):
            break
        cur = cand
    return cur


def build(frame, variant='A'):
    items = [dict(o) for o in C.PROGRAM_BASE]
    if variant in ('A', 'B'):
        items.append(dict(C.HOTEL))
    if variant == 'B':
        k = 100
        pitch = C.COTTAGE_SIZE[0] + fire_gap(C.COTTAGE_FIRE, C.COTTAGE_FIRE)
        for u0, u1, v, nmax in C.COTTAGE_ROWS:
            span = (u1 - u0) * frame.L
            n = max(1, min(nmax, int((span + pitch - C.COTTAGE_SIZE[0]) // pitch)))
            x0 = u0 * frame.L + (span - ((n - 1) * pitch)) / 2.0
            v = min(v, (frame.W - C.SETBACK - C.COTTAGE_SIZE[1] / 2.0) / frame.W)
            for i in range(n):
                u = (x0 + i * pitch) / frame.L
                it = C.B(16, 'Гостевой домик', (u, v),
                         C.COTTAGE_SIZE, C.COTTAGE_H, C.COTTAGE_FIRE)
                it['slide'] = 'u'
                it['group'] = 'Гостевые домики'
                items.append(it)
                k += 1
    place_facade_row(frame, items)
    for it in items:
        if 'poly' not in it:
            if it['kind'] == 'stage':     # амфитеатр — круглый
                x, y = frame.xy(*it['uv'])
                it['poly'] = Point(x, y).buffer(it['size'][0] / 2.0)
            else:
                it['poly'] = rect_at(frame, it['uv'], it['size'], it['rot'])

    roads = [road_band(frame, C.ENTRY_DRIVE, C.ROAD_W),
             road_band(frame, C.ROW_LANE, C.ROAD_W)]
    roads += [road_band(frame, r, C.DRIVE_W) for r in C.SPUR_ROADS]
    if variant == 'B':
        roads.append(road_band(frame, [(0.28, 0.855), (0.40, 0.905), (0.52, 0.915),
                                       (0.64, 0.895), (0.70, 0.855)], C.DRIVE_W))
    paths = [road_band(frame, p, C.PATH_W) for p in C.PATHS]
    paths += [ring_band(frame, uv, r, C.PATH_W) for uv, r in C.RINGS]

    inner = frame.poly.buffer(-C.SETBACK)
    for it in items:
        if not inner.contains(it['poly']):
            it['poly'] = pull_inside(it['poly'], inner)
    relax(frame, items, inner)

    ways = unary_union(roads)
    for it in items:                      # ничего не стоит на проезде
        if it['kind'] == 'building' and it['poly'].distance(ways) < 1.0:
            it['poly'] = push_off(it['poly'], ways, inner, clearance=1.0)
    relax(frame, items, inner, iters=120)

    lots, stalls, nstall = [], [], 0
    obst = [i['poly'] for i in items if i['kind'] == 'building']
    for spec in C.PARKING:
        lot, st, n = parking_lot(frame, spec)
        dx, dy = _clear_of(lot, obst, frame.poly.buffer(-1.0))
        lots.append(translate(lot, dx, dy))
        stalls += [translate(x, dx, dy) for x in st]
        nstall += n

    pa = getattr(C, 'PAVED_AROUND', None)
    if pa:            # въездная площадь замащивается по факту: проезд + КПП + парковки
        kpp = [i['poly'] for i in items if i['n'] == 1]
        blobs = [road_band(frame, C.ENTRY_DRIVE, C.ROAD_W).buffer(pa['drive'])]
        blobs += [l.buffer(pa['parking']) for l in lots]
        blobs += [g.buffer(pa['kpp']) for g in kpp]
        entry = unary_union(blobs[:1] + [b for b in blobs[len(blobs) - len(kpp):]]
                            + ([lots[0].buffer(pa['parking'])] if lots else []))
        pieces = [entry.convex_hull]
        pieces += [l.buffer(pa['parking']).convex_hull for l in lots[1:]]
        for piece in pieces:
            apron = piece.intersection(inner)
            for g in kpp:
                apron = apron.difference(g)
            roads.append(apron)

    return dict(items=items, roads=roads, paths=paths, lots=lots,
                stalls=stalls, nstall=nstall)


# --------------------------------------------------------------- проверки ---
def checks(frame, m):
    site = frame.poly
    inner = site.buffer(-C.SETBACK)
    msgs = []
    buildings = [i for i in m['items'] if i['kind'] == 'building']

    for it in m['items']:
        tol_site = site.buffer(0.05)
        if not tol_site.contains(it['poly']):
            msgs.append('ВЫХОД ЗА ГРАНИЦУ: %s' % it['name'])
        elif it['kind'] == 'building' and not inner.buffer(0.05).contains(it['poly']):
            msgs.append('Отступ < %.0f м от границы: %s' % (C.SETBACK, it['name']))

    for lot, spec in zip(m['lots'], C.PARKING):
        for it in m['items']:
            if it['kind'] == 'building' and lot.intersects(it['poly'].buffer(-0.1)):
                msgs.append('Парковка «%s» накладывается на %s' % (spec['name'], it['name']))

    for a in range(len(buildings)):
        for b in range(a + 1, len(buildings)):
            A, B_ = buildings[a], buildings[b]
            need = fire_gap(A['fire'], B_['fire'])
            got = A['poly'].distance(B_['poly'])
            if got < need - 0.05:
                msgs.append('Противопожарный разрыв %.1f м < %.0f м: %s / %s'
                            % (got, need, A['name'], B_['name']))
    return msgs, inner


def teп(frame, m):
    site = frame.poly
    foot = unary_union([i['poly'] for i in m['items'] if i['kind'] == 'building'])
    hard = unary_union(m['roads'] + m['paths'] + m['lots'] +
                       [i['poly'] for i in m['items'] if i['kind'] != 'building'])
    hard = hard.difference(foot)
    green = site.difference(unary_union([foot, hard]))
    s = site.area
    return [('Площадь участка', s, 100.0),
            ('Площадь застройки (пятна)', foot.area, 100 * foot.area / s),
            ('Проезды, парковки, площадки', hard.area, 100 * hard.area / s),
            ('Озеленение / лес', green.area, 100 * green.area / s)]


# ----------------------------------------------------------------- экспорт --
LAYERS = [('01_Граница_участка', (220, 30, 30)), ('02_Линия_отступа', (255, 150, 0)),
          ('03_Забор', (120, 80, 40)), ('04_Проезды', (90, 90, 95)),
          ('05_Парковка', (130, 130, 140)), ('06_Дорожки', (175, 165, 150)),
          ('07_Здания_3D', (190, 140, 80)), ('08_Пятна_застройки', (120, 80, 40)),
          ('09_Площадки', (90, 130, 90)), ('10_Подписи', (20, 20, 20))]


def to_3dm(frame, m, inner, path):
    f = r3.File3dm()
    f.Settings.ModelUnitSystem = r3.UnitSystem.Meters
    idx = {}
    for name, col in LAYERS:
        lay = r3.Layer()
        lay.Name = name
        lay.Color = (col[0], col[1], col[2], 255)
        idx[name] = f.Layers.Add(lay)

    def att(layer):
        a = r3.ObjectAttributes()
        a.LayerIndex = idx[layer]
        return a

    def curve(poly, layer, z=0.0):
        rings = [poly.exterior] + list(poly.interiors)
        for ring in rings:
            pts = [r3.Point3d(x, y, z) for x, y in ring.coords]
            f.Objects.AddPolyline(pts, att(layer))

    def shape(geom, layer, z=0.0):
        if geom.is_empty:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            curve(g, layer, z)

    curve(frame.poly, '01_Граница_участка')
    shape(inner, '02_Линия_отступа')
    # забор по границе с отступом 0.3 м внутрь, высота 2.2 м
    fence = frame.poly.buffer(-0.3).exterior
    fpts = list(fence.coords)
    for i in range(len(fpts) - 1):
        a, b = fpts[i], fpts[i + 1]
        f.Objects.AddPolyline([r3.Point3d(a[0], a[1], 0), r3.Point3d(b[0], b[1], 0),
                               r3.Point3d(b[0], b[1], 2.2), r3.Point3d(a[0], a[1], 2.2),
                               r3.Point3d(a[0], a[1], 0)], att('03_Забор'))

    for g in m['roads']:
        shape(g, '04_Проезды')
    for g in m['paths']:
        shape(g, '06_Дорожки')
    for g in m['lots']:
        shape(g, '05_Парковка')
    for g in m['stalls']:
        shape(g, '05_Парковка')

    for it in m['items']:
        lay = '08_Пятна_застройки' if it['kind'] == 'building' else '09_Площадки'
        shape(it['poly'], lay)
        if it['h'] > 0:
            pts = [r3.Point3d(x, y, 0) for x, y in it['poly'].exterior.coords]
            pc = r3.PolylineCurve(pts)
            ext = r3.Extrusion.Create(pc, it['h'], True)
            if ext:
                f.Objects.AddExtrusion(ext, att('07_Здания_3D'))
        c = it['poly'].centroid
        label = ('%d. %s' % (it['n'], it['name'])) if it['n'] else it['name']
        f.Objects.AddTextDot(label, r3.Point3d(c.x, c.y, it['h'] + 1.0),
                             att('10_Подписи'))

    ok = f.Write(path, 7)
    return ok


def explication(m):
    """Экспликация строится из того же перечня, что и чертёж, — 1:1 с планом."""
    rows, seen = [], {}
    for it in m['items']:
        key = it.get('group') or it['name']
        if key in seen:
            r = seen[key]
            r['count'] += 1
            r['area'] += it['poly'].area
            continue
        r = dict(n=it['n'], name=key, size=it['size'], h=it['h'],
                 count=1, area=it['poly'].area, kind=it['kind'])
        seen[key] = r
        rows.append(r)
    rows.sort(key=lambda r: (r['n'] == 0, r['n']))
    return rows


def to_png(frame, m, inner, path, title):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    from matplotlib.path import Path
    from matplotlib.patches import PathPatch

    fig, (ax, panel) = plt.subplots(
        1, 2, figsize=(19, 12), dpi=150, gridspec_kw={'width_ratios': [3.1, 1.25]})
    ax.set_facecolor('#eef1e8')
    panel.axis('off')

    def draw(geom, target=ax, **kw):
        if geom.is_empty:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            verts, codes = [], []
            for ring in [g.exterior] + list(g.interiors):
                pts = list(ring.coords)
                verts += pts
                codes += [Path.MOVETO] + [Path.LINETO] * (len(pts) - 2) + [Path.CLOSEPOLY]
            target.add_patch(PathPatch(Path(verts, codes), **kw))

    C_SITE, C_SET = '#cc2222', '#ff9900'
    C_ROAD, C_PARK, C_PATH = '#8c8c92', '#b9b9c2', '#cfc6b4'
    C_BLD, C_BLD_E = '#b07a3c', '#5a3c1c'
    C_COURT, C_PLAT, C_STAGE = '#3d7a53', '#9fbf7f', '#c9b07a'
    C_GREEN = '#e3e9d8'

    draw(frame.poly, facecolor=C_GREEN, edgecolor=C_SITE, lw=2.5, zorder=1)
    draw(inner, facecolor='none', edgecolor=C_SET, lw=0.9, ls='--', zorder=2)
    for g in m['roads']:
        draw(g, facecolor=C_ROAD, edgecolor='none', zorder=3)
    for g in m['paths']:
        draw(g, facecolor=C_PATH, edgecolor='none', zorder=3)
    for g in m['lots']:
        draw(g, facecolor=C_PARK, edgecolor='#7a7a82', lw=0.6, zorder=4)
    for g in m['stalls']:
        draw(g, facecolor='none', edgecolor='#ffffff', lw=0.6, zorder=5)

    for it in m['items']:
        fc, ec = {'building': (C_BLD, C_BLD_E), 'court': (C_COURT, '#25503a'),
                  'stage': (C_STAGE, '#6a5a34')}.get(it['kind'], (C_PLAT, '#5f7a4a'))
        draw(it['poly'], facecolor=fc, edgecolor=ec, lw=1.0, zorder=6)
        c = it['poly'].centroid
        ax.text(c.x, c.y, str(it['n']), ha='center', va='center', fontsize=8.5,
                color='white', zorder=7,
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

    # ---- экспликация ----
    rows = explication(m)
    y = 0.985
    panel.text(0.0, y, 'ЭКСПЛИКАЦИЯ', fontsize=12, weight='bold', va='top')
    y -= 0.030
    panel.text(0.0, y, '%-3s %-26s %9s' % ('№', 'наименование', 'S, м²'),
               fontsize=7.6, family='monospace', va='top', color='#555555')
    y -= 0.018
    for r in rows:
        nm = r['name'] + (' (%d шт.)' % r['count'] if r['count'] > 1 else '')
        panel.text(0.0, y, '%-3s %-26s %9.0f' % (r['n'], nm[:26], r['area']),
                   fontsize=7.6, family='monospace', va='top')
        y -= 0.0185
    panel.text(0.0, y - 0.004, '%-30s %9.0f' % ('ИТОГО пятен застройки',
               sum(r['area'] for r in rows)), fontsize=7.6, family='monospace',
               va='top', weight='bold')
    y -= 0.048

    panel.text(0.0, y, 'УСЛОВНЫЕ ОБОЗНАЧЕНИЯ', fontsize=12, weight='bold', va='top')
    y -= 0.030
    keys = [('Граница участка', 'none', C_SITE, 2.0),
            ('Линия отступа 3 м', 'none', C_SET, 1.0),
            ('Застройка', C_BLD, C_BLD_E, 1.0),
            ('Концертная площадка', C_STAGE, '#6a5a34', 1.0),
            ('Спортивный корт', C_COURT, '#25503a', 1.0),
            ('Детская площадка', C_PLAT, '#5f7a4a', 1.0),
            ('Проезды', C_ROAD, 'none', 0),
            ('Парковка (%d м/м)' % m['nstall'], C_PARK, '#7a7a82', 0.6),
            ('Пешеходные дорожки', C_PATH, 'none', 0),
            ('Озеленение / лес', C_GREEN, '#b8c3a5', 0.6)]
    for name, fc, ec, lw in keys:
        panel.add_patch(Rectangle((0.0, y - 0.016), 0.09, 0.016, facecolor=fc,
                                  edgecolor=ec, lw=lw, transform=panel.transAxes,
                                  clip_on=False))
        panel.text(0.115, y - 0.004, name, fontsize=8.2, va='top')
        y -= 0.026
    y -= 0.022

    panel.text(0.0, y, 'ТЭП', fontsize=12, weight='bold', va='top')
    y -= 0.030
    for name, a, pct in teп(frame, m):
        panel.text(0.0, y, '%-28s %7.0f м²  %4.1f%%' % (name[:28], a, pct),
                   fontsize=7.4, family='monospace', va='top')
        y -= 0.0185
    panel.set_xlim(0, 1)
    panel.set_ylim(0, 1)

    fig.savefig(path, bbox_inches='tight')
    plt.close(fig)


def report(frame, m, msgs, path, title):
    lines = [title, '=' * len(title), '',
             'Кадастровый номер: %s' % C.CAD_NUMBER,
             'Привязка (BASE_POINT): %s' % (str(C.BASE_POINT) if C.BASE_POINT else 'локальные координаты'),
             'Габариты участка (описанный прямоугольник): %.1f x %.1f м'
             % (frame.L, frame.W), '',
             'ТЕХНИКО-ЭКОНОМИЧЕСКИЕ ПОКАЗАТЕЛИ', '-' * 34]
    for name, a, pct in teп(frame, m):
        lines.append('%-32s %9.0f м2   %5.1f %%' % (name, a, pct))
    if hasattr(frame, 'row_need'):
        lines += ['', 'Фасадный фронт (объекты %s):' % C.ROW_FACADE,
                  '  требуется по нормам разрывов: %.0f м' % frame.row_need,
                  '  есть по длине участка:        %.0f м%s'
                  % (frame.row_avail,
                     '   ДЕФИЦИТ %.0f м' % (frame.row_need - frame.row_avail)
                     if frame.row_need > frame.row_avail else '   ок')]
    lines += ['', 'ЭКСПЛИКАЦИЯ', '-' * 34]
    for r in explication(m):
        nm = r['name'] + (' (%d шт.)' % r['count'] if r['count'] > 1 else '')
        lines.append('%-3s %-30s %6.0f x %-5.0f  %7.0f м2  h=%.1f м'
                     % (r['n'], nm, r['size'][0], r['size'][1], r['area'], r['h']))
    lines += ['', 'Машиномест: %d' % m['nstall'],
              'Объектов на плане: %d (позиций в экспликации: %d)'
              % (len(m['items']), len(explication(m))), '',
              'ПРОВЕРКИ', '-' * 34]
    lines += (['  нарушений не найдено'] if not msgs else ['  ! ' + s for s in msgs])
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', default=None)
    ap.add_argument('--placeholder', action='store_true',
                    help='считать на условном прямоугольнике вместо реального контура')
    ap.add_argument('--variant', default='both', choices=['A', 'B', 'both'])
    ap.add_argument('--site-size', default=None,
                    help='LxW, м — размер участка-заглушки, напр. 200x95')
    ap.add_argument('--suffix', default='')
    ap.add_argument('--site-order', default='egrn', choices=['egrn', 'xy'],
                    help="egrn: X=север,Y=восток (как в выписке); xy: X=восток,Y=север")
    a = ap.parse_args()

    size = None
    if a.site_size:
        size = tuple(float(t) for t in a.site_size.lower().split('x'))
    order = a.site_order
    site_path = a.site
    if site_path is None and not a.placeholder and not a.site_size:
        site_path = os.path.join(OUT, C.DEFAULT_SITE)
        order = C.DEFAULT_SITE_ORDER
    site, is_placeholder = load_site(site_path, size, order)
    frame = Frame(site, C.ENTRY_HINT)
    variants = ['A', 'B'] if a.variant == 'both' else [a.variant]
    titles = {'A': 'БОР 495 — генплан, вариант 1 (с гостиницей)',
              'B': 'БОР 495 — генплан, вариант 2 (с гостевыми домиками)'}
    for v in variants:
        m = build(frame, v)
        msgs, inner = checks(frame, m)
        base = os.path.join(OUT, 'BOR495_genplan_%s%s' % (v, a.suffix))
        ok = to_3dm(frame, m, inner, base + '.3dm')
        to_png(frame, m, inner, base + '.png', titles[v])
        txt = report(frame, m, msgs, base + '.txt', titles[v])
        print(txt)
        print('\n3dm записан: %s (%s)\n' % (base + '.3dm', ok))
    if is_placeholder:
        print('!!! Участок — ЗАГЛУШКА (%.0f x %.0f м). Подставьте кадастровый контур: '
              'python3 genplan.py --site kpt.xml'
              % (C.PLACEHOLDER_SITE['length'], C.PLACEHOLDER_SITE['width']))


if __name__ == '__main__':
    main()
