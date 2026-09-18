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

    def sub(self, u0, u1):
        """Половина участка как самостоятельная система координат."""
        f = Frame.__new__(Frame)
        f.A = np.array(self.xy(u0, 0.0))
        f.B = np.array(self.xy(u1, 0.0))
        f.C = np.array(self.xy(u1, 1.0))
        f.D = np.array(self.xy(u0, 1.0))
        f.poly = Polygon([f.A, f.B, f.C, f.D])
        f.L = math.dist(f.A, f.B)
        f.W = (math.dist(f.A, f.D) + math.dist(f.B, f.C)) / 2.0
        f.site = self.poly
        return f


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


def road_axis(frame, uv_pts, closed=False):
    pts = [frame.xy(u, v) for u, v in uv_pts]
    return LineString(smooth(pts, closed=closed) if len(pts) > 2 else pts)


def road_band(frame, uv_pts, width, closed=False):
    return band([frame.xy(u, v) for u, v in uv_pts], width, closed)


def ring_line(frame, uv, radius):
    x, y = frame.xy(*uv)
    return Point(x, y).buffer(radius, 64).exterior


def parking_along(frame, spec, items):
    """Парковочная зона вдоль фасада здания: один ряд мест и проезд 6 м,
    длинное узкое пятно, развёрнутое по зданию."""
    host = next((i for i in items if i['n'] == spec['along']), None)
    if host is None:
        return None
    a = math.radians(host['angle'])
    ex = (math.cos(a), math.sin(a))
    ey = (-math.sin(a), math.cos(a))
    hull = host['whole'].convex_hull
    c = hull.centroid
    pts = list(hull.exterior.coords)
    du = [(x - c.x) * ex[0] + (y - c.y) * ex[1] for x, y in pts]
    dv = [(x - c.x) * ey[0] + (y - c.y) * ey[1] for x, y in pts]
    half_v = max(abs(min(dv)), abs(max(dv)))
    sw, sl = C.PARK_STALL
    n = spec['count']
    L = n * sw
    depth = sl + C.AISLE_W
    sgn = 1.0 if spec.get('side', 'front') == 'back' else -1.0
    off = half_v + spec.get('gap', 8.0) + depth / 2.0
    cx = c.x + ey[0] * off * sgn + ex[0] * spec.get('shift', 0.0)
    cy = c.y + ey[1] * off * sgn + ex[1] * spec.get('shift', 0.0)

    def place(g):
        return translate(rotate(g, host['angle'], origin=(0, 0)), cx, cy)

    lot = place(Polygon([(-L / 2 - 1.5, -depth / 2 - 0.8), (L / 2 + 1.5, -depth / 2 - 0.8),
                         (L / 2 + 1.5, depth / 2 + 0.8), (-L / 2 - 1.5, depth / 2 + 0.8)]))
    stalls = []
    row_y = -depth / 2 + sl / 2 if sgn < 0 else depth / 2 - sl / 2
    for i in range(n):
        dx = -L / 2 + sw * (i + 0.5)
        for lx in (dx - sw / 2, dx + sw / 2):
            stalls.append(place(Polygon([(lx - 0.06, row_y - sl / 2), (lx + 0.06, row_y - sl / 2),
                                         (lx + 0.06, row_y + sl / 2), (lx - 0.06, row_y + sl / 2)])))
        ey_line = row_y - sl / 2 if sgn < 0 else row_y + sl / 2
        stalls.append(place(Polygon([(dx - sw / 2, ey_line - 0.06), (dx + sw / 2, ey_line - 0.06),
                                     (dx + sw / 2, ey_line + 0.06), (dx - sw / 2, ey_line + 0.06)])))
    return lot, stalls, n


def parking_lot(frame, spec):
    """Парковочная зона: ряды машиномест 2,5x5,3 с проездом 6 м."""
    sw, sl = C.PARK_STALL
    cols, rows = spec['cols'], spec['rows']
    aisle = C.AISLE_W if spec.get('aisle', True) else 0.0
    w = cols * sw
    d = rows * sl + aisle
    if spec.get('xy'):
        x, y = spec['xy']
        ang = spec.get('ang', 0.0)
    else:
        x, y = frame.xy(*spec['uv'])
        ang = frame.angle(*spec['uv']) + spec.get('rot', 0.0)

    def place(g):
        return translate(rotate(g, ang, origin=(0, 0)), x, y)

    lot = place(Polygon([(-w / 2 - 1.2, -d / 2 - 0.8), (w / 2 + 1.2, -d / 2 - 0.8),
                         (w / 2 + 1.2, d / 2 + 0.8), (-w / 2 - 1.2, d / 2 + 0.8)]))
    stalls = []
    for j in range(rows):
        # ряды прижаты к краям, проезд посередине (или вдоль одного края)
        dy = (-d / 2 + sl / 2) if j == 0 else (d / 2 - sl / 2)
        for i in range(cols):
            dx = -w / 2 + sw * (i + 0.5)
            edge = -1 if j == 0 else 1
            y0, y1 = dy - sl / 2, dy + sl / 2
            for lx in (dx - sw / 2, dx + sw / 2):     # боковые линии разметки
                stalls.append(place(Polygon([(lx - 0.06, y0), (lx + 0.06, y0),
                                             (lx + 0.06, y1), (lx - 0.06, y1)])))
            ly = dy - sl / 2 if edge < 0 else dy + sl / 2
            stalls.append(place(Polygon([(dx - sw / 2, ly - 0.06),
                                         (dx + sw / 2, ly - 0.06),
                                         (dx + sw / 2, ly + 0.06),
                                         (dx - sw / 2, ly + 0.06)])))
    return lot, stalls, cols * rows


# ------------------------------------------------------- расстановка --------
def fire_gap(a, b):
    if a == b == 'V':
        return C.FIRE_GAP_V_V
    if a == b == 'III':
        return C.FIRE_GAP_III_III
    return C.FIRE_GAP_V_III


BUILT = ('volume', 'canopy', 'barrel')   # застройка и противопожарные разрывы


def fit_size(it):
    """Подгоняет габарит под заданную площадь. Площадь считается по сумме
    этажей: пятно застройки = площадь / этажность."""
    target = it.get('area')
    if not target:
        return
    target = float(target) / max(1, it.get('floors', 1))
    w, d = it['size']
    for _ in range(6):
        parts = shapes.make(it['shape'], w, d, 0.0, 0.0, 0.0)
        got = unary_union([sp['poly'] for t, sp in parts if t in BUILT]).area
        if got < 1.0:
            break
        k = math.sqrt(target / got)
        w, d = w * k, d * k
        if abs(k - 1.0) < 0.002:
            break
    it['size'] = (round(w, 2), round(d, 2))


def align_to_roads(items, axes):
    """Разворачивает здания параллельно ближайшему проезду или дорожке:
    длинная сторона вдоль дороги, главный вход — к ней."""
    if not axes:
        return
    net = unary_union(axes)
    for it in items:
        if it.get('fixed') or it.get('no_align'):
            continue
        c = Point(it['center'])
        p, _ = nearest_points(net, c)
        vx, vy = p.x - c.x, p.y - c.y
        n = math.hypot(vx, vy)
        if n < 0.5:
            continue
        it['angle'] = math.degrees(math.atan2(vx / n, -vy / n))


def materialize(frame, it):
    """Собирает части объекта по его положению и разворачивает по границе."""
    cx, cy = it['center']
    it['parts'] = shapes.make(it['shape'], it['size'][0], it['size'][1],
                              it['angle'], cx, cy)
    ent = [sp['pt'] for t, sp in it['parts'] if t == 'entrance']
    it['entrance'] = ent[0] if ent else (cx, cy)
    vol = [s['poly'] for t, s in it['parts'] if t in BUILT]
    allp = [s['poly'] for t, s in it['parts'] if 'poly' in s]
    it['poly'] = unary_union(vol) if vol else unary_union(allp)
    it['whole'] = unary_union(allp)
    return it


def setback_of(it):
    """Отступ от границы участка: у деревянных объектов больше."""
    return C.SETBACK_WOOD if it['fire'] == 'V' else C.SETBACK


def move(it, dx, dy):
    it['center'] = (it['center'][0] + dx, it['center'][1] + dy)
    it['poly'] = translate(it['poly'], dx, dy)


def pull_inside(it, inner, step=1.5, iters=200):
    for _ in range(iters):
        if inner.contains(it['poly']):
            return
        c = it['poly'].centroid
        if inner.contains(c):             # центр внутри — отходим от ближней границы
            a, _b = nearest_points(inner.exterior, c)
            vx, vy = c.x - a.x, c.y - a.y
        else:                             # центр снаружи — идём к середине области
            t = inner.representative_point()
            vx, vy = t.x - c.x, t.y - c.y
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


def settle(frame, items, iters=600):
    """Автоматическая расстановка: объекты расталкиваются до нормативных
    разрывов, не выходят из своей области и одновременно притягиваются к
    заданной композицией точке. Так замысел сохраняется, а коллизии уходят."""
    movable = [i for i in items if not i.get('fixed')]
    for it in movable:
        it['anchor'] = (it.get('place_xy') or it.get('anchor_xy')
                        or it['frame'].xy(*it['uv']))
    for step_i in range(iters):
        k = 1.0 - step_i / float(iters)
        moved = 0.0
        for a in range(len(items)):
            for b in range(a + 1, len(items)):
                A, B = items[a], items[b]
                if A['kind'] == 'building' and B['kind'] == 'building':
                    need = fire_gap(A['fire'], B['fire'])
                    got = A['poly'].distance(B['poly'])
                else:
                    need, got = 3.0, A['whole'].distance(B['whole'])
                if got >= need - 0.02:
                    continue
                ca, cb = A['poly'].centroid, B['poly'].centroid
                vx, vy = cb.x - ca.x, cb.y - ca.y
                n = math.hypot(vx, vy) or 1.0
                push = min(need - got, 2.5) * 0.5
                for it, sgn in ((A, -1), (B, 1)):
                    if it.get('fixed'):
                        continue
                    moved += _try_move(it, sgn * push * vx / n, sgn * push * vy / n)
        for it in movable:                # притяжение к точке композиции
            c = it['poly'].centroid
            ax, ay = it['anchor']
            dx, dy = ax - c.x, ay - c.y
            n = math.hypot(dx, dy)
            if n < 0.6:
                continue
            pull = min(n, 1.2) * 0.35 * k
            _try_move(it, pull * dx / n, pull * dy / n, keep_gaps=items)
        if moved < 0.02 and step_i > 60:
            break


LEASH = 20.0        # насколько объект может отойти от заданной точки, м


def _try_move(it, dx, dy, keep_gaps=None):
    """Двигает объект, если он остаётся в своей области и (для притяжения)
    не создаёт новых нарушений разрывов."""
    bnd = it.get('bound')
    cand = translate(it['poly'], dx, dy)
    a = it.get('anchor')
    if a is not None:                     # поводок: далеко от замысла не уходим
        c = cand.centroid
        if math.hypot(c.x - a[0], c.y - a[1]) > it.get('leash', LEASH):
            cur = it['poly'].centroid
            if math.hypot(c.x - a[0], c.y - a[1]) > math.hypot(cur.x - a[0], cur.y - a[1]):
                return 0.0
    if bnd is not None:
        if not (bnd.contains(cand) or
                cand.difference(bnd).area < it['poly'].difference(bnd).area - 1e-9):
            return 0.0
    if keep_gaps is not None:
        for o in keep_gaps:
            if o is it:
                continue
            need = (fire_gap(it['fire'], o['fire'])
                    if it['kind'] == 'building' and o['kind'] == 'building' else 3.0)
            if cand.distance(o['poly']) < need - 0.02:
                return 0.0
    move(it, dx, dy)
    return abs(dx) + abs(dy)


def relax(frame, items, inner, iters=300):
    bounds = {id(i): i.get('bound', frame.poly.buffer(-setback_of(i) + 0.2))
              for i in items}
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
                    sl = it.get('slide')
                    if sl in ('u', 'v'):
                        f = it.get('frame', frame)
                        t = math.radians(f.angle(*it['uv']))
                        if sl == 'v':
                            t += math.pi / 2.0
                        pr = dx * math.cos(t) + dy * math.sin(t)
                        dx, dy = pr * math.cos(t), pr * math.sin(t)
                    bnd = bounds[id(it)]
                    cand = translate(it['poly'], dx, dy)
                    # вне своей области двигаемся только в сторону её границы
                    free = (bnd.contains(cand) or
                            cand.difference(bnd).area < it['poly'].difference(bnd).area)
                    if free:
                        move(it, dx, dy)
                        moved += step
        if moved < 0.01:
            break


# ------------------------------------------------------------- дорожки ------
def path_network(frame, items, ctx):
    """Сеть пешеходных связей: непрерывный прогулочный хребет по территории,
    кольца вокруг узлов и кратчайшие отводы от него ко входу каждого объекта.
    Все элементы объединяются в один контур, примыкания скругляются."""
    blocked = unary_union([unary_union([sp['poly'] for t, sp in i['parts']
                                        if t in ('volume', 'barrel', 'platform',
                                                 'court', 'water')])
                           for i in items]).buffer(0.2)

    axes = [LineString(smooth(C.SPINE_XY))]
    for n_obj, rad in C.RING_AROUND:      # кольцо строго вокруг объекта
        host = next((i for i in items if i['n'] == n_obj), None)
        if host is None:
            continue
        c = host['whole'].centroid
        axes.append(Point(c.x, c.y).buffer(rad, 64).exterior)
    for ray in getattr(C, 'PATH_RAYS', []):   # дорожки-лучи от центра композиции
        host = next((i for i in items if i['n'] == ray['n']), None)
        if host is None:
            continue
        c = host['whole'].centroid
        for j in range(ray['count']):
            a = math.radians(ray.get('phase', 0.0) + 360.0 * j / ray['count'])
            axes.append(LineString([
                (c.x + ray['r0'] * math.cos(a), c.y + ray['r0'] * math.sin(a)),
                (c.x + ray['r1'] * math.cos(a), c.y + ray['r1'] * math.sin(a))]))
    for ln in getattr(C, 'PATH_EXTRA_XY', []):   # прогулочные связи-аллеи
        axes.append(LineString(smooth(ln)))
    for ln in ctx.get('extra_axes', []):
        axes.append(ln)
    trunk = unary_union(axes + [ctx['lane'], ctx['apron']])

    for it in items:                      # отвод от сети ко входу
        e = Point(it['entrance'])
        p, _ = nearest_points(trunk, e)
        if e.distance(p) < 0.6:
            continue
        axes.append(LineString([(p.x, p.y), (e.x, e.y)]))

    strips = []
    for ln in axes:
        g = ln.buffer(C.PATH_W / 2.0, cap_style=2, join_style=1).difference(blocked)
        if not g.is_empty:
            strips.append(g)
    if not strips:
        return [], axes
    merged = unary_union(strips).buffer(1.1, join_style=1).buffer(-1.1, join_style=1)
    merged = merged.difference(blocked)
    return [merged], axes


def place_column(frame, items, spec):
    """Расставляет ряд объектов вдоль западной границы сверху вниз,
    выдерживая противопожарные разрывы между ними."""
    order = [i for n in spec['ids'] for i in items if i['n'] == n]
    if not order:
        return
    depths = []
    for it in order:
        f = it['frame']
        parts = shapes.make(it['shape'], it['size'][0], it['size'][1],
                            it.get('rot', 0.0), 0.0, 0.0)
        g = unary_union([sp['poly'] for t, sp in parts if t in BUILT])
        depths.append(g.bounds[3] - g.bounds[1])
    gaps = [fire_gap(order[k]['fire'], order[k + 1]['fire']) * 1.10
            for k in range(len(order) - 1)]
    need = sum(depths) + sum(gaps)
    v0, v1 = spec['v']
    avail = (v1 - v0) * frame.W
    y = v0 * frame.W + max((avail - need) / 2.0, 0.0)
    frame.col_need, frame.col_avail = need, avail
    site = getattr(frame, 'site', frame.poly)
    half = frame.poly.buffer(1.5)   # объекты ряда остаются в своей половине
    for k, it in enumerate(order):
        v = (y + depths[k] / 2.0) / frame.W
        it['uv'] = (_fit_u(frame, it, v, site, spec['u'], half), v)
        it['slide'] = 'v'
        y += depths[k] + (gaps[k] if k < len(gaps) else 0.0)


def _fit_u(frame, it, v, site, u_start, half=None):
    """Сдвигает объект от западной границы ровно настолько, чтобы выдержать
    его собственный отступ: граница участка идёт наклонно."""
    bound = site.buffer(-setback_of(it))
    if half is not None:
        bound = bound.intersection(half)
    u = u_start
    for _ in range(60):
        cx, cy = frame.xy(u, v)
        parts = shapes.make(it['shape'], it['size'][0], it['size'][1],
                            frame.angle(u, v) + it.get('rot', 0.0), cx, cy)
        g = unary_union([sp['poly'] for t, sp in parts if t in BUILT])
        if bound.contains(g):
            return u
        u += 0.012
    return u


FRAME_REF = [None]


def build(frame, variant='A'):
    """Собирает вариант: запад — комплекс, восток — лес (A) или домики (B)."""
    west = frame.sub(0.0, C.SPLIT_U)
    east = frame.sub(C.SPLIT_U, 1.0)
    FRAME_REF[0] = west
    site = frame.poly

    items = [dict(o) for o in C.PROGRAM_BASE]
    for it in items:
        it['frame'] = west
    if variant == 'B':
        g = C.COTTAGE_GRID
        k = 0
        for row in g['rows']:
            for col in g['cols']:
                k += 1
                # дома параллельны западной границе, вход — к проезду
                rot = 90.0 if col < 0.5 else 270.0
                it = C.B(16, 'Гостевой дом', (col, row), C.COTTAGE_SIZE, C.COTTAGE_H,
                         'V', shape='cottage', wall=3.2, roof='gable',
                         area=C.COTTAGE_AREA, rot=rot)
                it['fix_angle'] = (C.COTTAGE_ANGLE_W if col < 0.5
                                   else C.COTTAGE_ANGLE_E)
                it['no_align'] = True
                it['group'] = 'Гостевые дома'
                it['frame'] = east
                items.append(it)

    for it in items:
        fit_size(it)
    if getattr(C, 'BATH_COLUMN', None):
        place_column(west, [i for i in items if i['frame'] is west], C.BATH_COLUMN)
    place = getattr(C, 'PLACE', {})
    for it in items:
        f = it['frame']
        if it['n'] in place:                 # точка и разворот заданы по схеме
            x, y, ang = place[it['n']]
            it['center'] = (x, y)
            it['angle'] = ang
            it['place_xy'] = (x, y)
            # от точки схемы объект отходит не дальше поводка
            it['leash'] = getattr(C, 'PLACE_LEASH', {}).get(it['n'], 8.0)
            it['no_align'] = True      # разворот задан схемой
        else:
            it['center'] = f.xy(*it['uv'])
            it['angle'] = (it['fix_angle'] if it.get('fix_angle') is not None
                           else f.angle(*it['uv']) + it.get('rot', 0.0))
        materialize(f, it)

    sh = getattr(C, 'COTTAGE_SHIFT_XY', None)
    if variant == 'B' and sh:             # ряды домиков сдвинуты как единое целое
        for it in items:
            if it['n'] != 16:
                continue
            cx, cy = it['center']
            it['center'] = (cx + sh[0], cy + sh[1])
            it['anchor_xy'] = it['center']
            it['leash'] = 12.0
            materialize(it['frame'], it)

    # Главная дорога — замкнутое кольцо вокруг всей застройки,
    # с юга к нему подходят два въезда. Контур задан в метрах по схеме.
    roads, road_axes, entry_polys = [], [], []
    ring_xy = getattr(C, 'RING_ROAD_XY', None)
    if variant == 'A' and getattr(C, 'RING_ROAD_A_XY', None):
        ring_xy = C.RING_ROAD_A_XY
    lane = None
    if ring_xy:
        roads.append(band(ring_xy, C.ROAD_W, closed=True))
        road_axes.append(LineString(smooth(ring_xy, closed=True)))
        lane = roads[0]
    drives = getattr(C, 'ENTRY_DRIVES_XY', [])
    if variant == 'A' and getattr(C, 'ENTRY_DRIVES_A_XY', None):
        drives = C.ENTRY_DRIVES_A_XY
    for drive in drives:
        g = band(drive, C.ROAD_W)
        entry_polys.append(g)
        roads.append(g)
        road_axes.append(LineString(smooth(drive)))
    if lane is None:
        lane = entry_polys[0]
    for r in getattr(C, 'SPUR_ROADS_XY', []):
        roads.append(band(r, C.DRIVE_W))
        road_axes.append(LineString(smooth(r)))
    if variant == 'B':
        for r in getattr(C, 'COTTAGE_SPURS_XY', []):
            roads.append(band(r, C.DRIVE_W))
            road_axes.append(LineString(smooth(r)))

    spine_axis = LineString(smooth(C.SPINE_XY))
    align_to_roads(items, road_axes + [spine_axis])   # параллельно дорогам
    for it in items:
        materialize(it['frame'], it)

    inner = site.buffer(-C.SETBACK)
    for it in items:                      # объект не выходит за свою половину
        half = (west if it['frame'] is west else east).poly.buffer(1.5)
        if it.get('place_xy'):
            half = site.buffer(1.5)
        it['bound'] = half.intersection(site.buffer(-setback_of(it)))
        if not (it.get('fixed') or it.get('place_xy')):
            pull_inside(it, it['bound'])
    settle(frame, items)
    for it in items:
        materialize(it['frame'], it)
    ways = unary_union(roads)
    for it in items:
        if it.get('fixed'):
            continue
        if it['kind'] == 'building' and it['whole'].distance(ways) < 1.0:
            d0 = it['center']
            probe = dict(it, poly=it['whole'])
            push_off(probe, ways, it['bound'], clearance=1.2)
            move(it, probe['center'][0] - d0[0], probe['center'][1] - d0[1])
            materialize(it['frame'], it)
    settle(frame, items, iters=300)
    for it in items:
        materialize(it['frame'], it)

    for _ in range(12):                   # развести площадки и корты между собой
        moved = False
        for it in items:
            if it['kind'] == 'building' or it.get('fixed'):
                continue
            others = unary_union([o['whole'] for o in items if o is not it])
            if it['whole'].distance(others) >= 3.0:
                continue
            d0 = it['center']
            probe = dict(it, poly=it['whole'])
            push_off(probe, others, it['bound'], clearance=3.5, iters=25)
            if probe['center'] != d0:
                move(it, probe['center'][0] - d0[0], probe['center'][1] - d0[1])
                materialize(it['frame'], it)
                moved = True
        if not moved:
            break

    for it in items:                      # спутники: открытый корт у падел-центра
        if not it.get('anchor_to'):
            continue
        host = next((h for h in items if h['n'] == it['anchor_to']), None)
        if host is None:
            continue
        a = math.radians(host['angle'])
        du, dv = it['anchor_off']
        it['center'] = (host['center'][0] + du * math.cos(a) - dv * math.sin(a),
                        host['center'][1] + du * math.sin(a) + dv * math.cos(a))
        it['angle'] = host['angle']
        materialize(it['frame'], it)

    lots, stalls, nstall = [], [], 0
    # парковки комплекса не выходят за свою половину участка
    park_bound = site.buffer(-1.0)
    obst = [i['poly'] for i in items if i['kind'] == 'building'] + list(roads)
    specs = list(C.PARKING)
    walks = []
    cp = getattr(C, 'COTTAGE_PARK', None)
    if variant == 'B' and cp:
        # У каждого гостевого дома свой карман на 2 м/м и съезд с кольцевой.
        ring_axis = LineString(smooth(ring_xy, closed=True)) if ring_xy else None
        rows = {}
        for it in items:
            if it['n'] != 16:
                continue
            ex, ey = it['entrance']
            cx, cy = it['center']
            if ring_axis is None:
                continue
            # карман — уширение проезжей части у самой кромки кольца,
            # развёрнутое к дому: объезда вокруг стоянки нет.
            q, _ = nearest_points(ring_axis, Point(ex, ey))
            vx, vy = ex - q.x, ey - q.y
            nv = math.hypot(vx, vy) or 1.0
            ux, uy = vx / nv, vy / nv
            off = min(cp['off'], nv - 3.8)    # карман не наезжает на дом
            px, py = q.x + ux * off, q.y + uy * off
            specs.append(dict(name='Стоянка гостевого дома', xy=(px, py),
                              ang=math.degrees(math.atan2(uy, ux)) - 90.0,
                              cols=cp['cols'], rows=1, aisle=False,
                              fixed=True, pocket=True, quiet=True))
            rows.setdefault(round(ex - cx, 1) > 0, []).append((ex, ey))
        for side, pts in rows.items():    # аллея вдоль ряда домов
            pts.sort(key=lambda t: t[1])
            off = cp['walk'] * (1.0 if side else -1.0)
            walks.append(LineString([(x + off, y) for x, y in pts]))
    for spec in specs:
        if spec.get('along'):
            res = parking_along(west, spec, items)
            if res is None:
                continue
            lot, st, n = res
            obs = [i['whole'] for i in items] + list(roads) + lots
            d = _clear_of(lot, obs, park_bound, clearance=2.0)
        else:
            lot, st, n = parking_lot(west, spec)
            d = ((0.0, 0.0) if spec.get('fixed')
                 else _clear_of(lot, obst + lots, park_bound))
        lots.append(translate(lot, *d))
        stalls += [translate(x, *d) for x in st]
        nstall += n

    kppg = [i['poly'] for i in items if i['n'] == 1]
    blobs = [g.buffer(C.PAVED_AROUND['drive']) for g in entry_polys]
    blobs += [g.buffer(C.PAVED_AROUND['kpp']) for g in kppg]
    blobs += [l.buffer(C.PAVED_AROUND['parking'])
              for l, sp in zip(lots, specs) if not sp.get('pocket')]
    apron = unary_union(blobs).buffer(1.2).buffer(-1.2).intersection(
        site.buffer(-C.SETBACK + 3.0))
    for g in kppg:
        apron = apron.difference(g)
    roads.append(apron)

    ctx = dict(lane=lane, apron=apron, loop=None, extra_axes=walks,
               rings=[ring_line(west, uv, r) for uv, r in C.RINGS])
    paths, path_axes = path_network(west, items, ctx)

    trails = []
    trail_src = (getattr(C, 'FOREST_TRAILS_B_XY', []) if variant == 'B'
                 else getattr(C, 'FOREST_TRAILS_XY', []))
    # тропа не ложится на проезды, парковки, дорожки и здания
    hard_for_trails = unary_union(list(roads) + list(lots) + list(paths) +
                                  [i['whole'] for i in items]).buffer(1.2)
    trail_bound = site.buffer(-3.0)        # тропа не подходит к границе ближе 3 м
    for tr in trail_src:
        g = band(tr, C.TRAIL_W).intersection(trail_bound).difference(hard_for_trails)
        for q in (g.geoms if g.geom_type.startswith('Multi') else [g]):
            if not q.is_empty and q.area > 6.0:
                trails.append(q)

    merged_roads = unary_union(roads).buffer(1.4, join_style=1).buffer(-1.4, join_style=1)
    roads = [merged_roads] if not merged_roads.is_empty else roads

    # забор сплошной стеной с разрывами на въездах
    ring = list(site.buffer(-0.6).exterior.coords)
    gaps = []
    for ax in road_axes:
        inter = ax.intersection(site.buffer(-0.6).exterior)
        for g in (inter.geoms if hasattr(inter, 'geoms') else [inter]):
            if not g.is_empty and g.geom_type == 'Point':
                gaps.append(((g.x, g.y), C.ROAD_W + 6.0))
    fence = [model3d.fence_wall(ring, gaps)]

    occupied = unary_union([i['whole'] for i in items] + lots).buffer(1.0)
    furn = furniture(road_axes, path_axes, occupied, site.buffer(-2.0))
    for lot in lots:                          # освещение парковочных зон
        b = lot.bounds
        for px, py in [(b[0], b[1]), (b[2], b[1]), (b[0], b[3]), (b[2], b[3])]:
            furn.append(('lamp', dict(pt=(px, py), h=6.5, kind='road')))

    hard = unary_union(roads + paths + trails + lots + [i['whole'] for i in items])
    # деревья не подходят к зданиям ближе 6 м и к покрытиям ближе 2.5 м
    built = unary_union([i['whole'] for i in items]).buffer(6.0)
    green = site.buffer(-2.0).difference(
        unary_union(roads + paths + lots).buffer(2.5)).difference(built)
    return dict(park_specs=specs, items=items, roads=roads, paths=paths,
                lots=lots, stalls=stalls,
                nstall=nstall, green=green, hard=hard, inner=inner, furn=furn,
                trails=trails, fence=fence,
                west=west, east=east, variant=variant)


def furniture(axes_roads, axes_paths, blocked, site):
    """Освещение и МАФ: высокие опоры вдоль проездов, низкие столбики на
    дорожках, скамьи на прогулочных маршрутах."""
    out = []

    def put(line, step, off, kind, h, bench_every=None):
        d = step * 0.5
        k = 0
        while d < line.length:
            p = line.interpolate(d)
            q = line.interpolate(min(d + 1.0, line.length))
            dx, dy = q.x - p.x, q.y - p.y
            n = math.hypot(dx, dy) or 1.0
            side = 1 if (k % 2 == 0 or kind == 'path') else -1
            x = p.x - dy / n * off * side
            y = p.y + dx / n * off * side
            pt = Point(x, y)
            if site.contains(pt) and not blocked.contains(pt):
                out.append(('lamp', dict(pt=(x, y), h=h, kind=kind)))
                if bench_every and k % bench_every == 0:
                    bx = p.x + dy / n * (C.PATH_W / 2.0 + 1.0) * side
                    by = p.y - dx / n * (C.PATH_W / 2.0 + 1.0) * side
                    if site.contains(Point(bx, by)) and not blocked.contains(Point(bx, by)):
                        out.append(('bench', dict(pt=(bx, by),
                                                  ang=math.degrees(math.atan2(dy, dx)))))
            d += step
            k += 1

    for ln in axes_roads:
        put(ln, 26.0, 4.6, 'road', 6.5)
    for ln in axes_paths:
        if ln.length < 25.0:              # короткие отводы не обставляем
            continue
        put(ln, 20.0, 2.0, 'path', 1.05, bench_every=4 if ln.length > 60 else None)
    return out


def _clear_of(lot, obstacles, bounds, clearance=1.2):
    """Ищет ближайшее свободное положение кармана: спиральный перебор смещений
    до первого, где нет пересечений с зданиями и проездами."""
    obs = unary_union([o.buffer(clearance) for o in obstacles]) if obstacles else None

    def ok(dx, dy):
        cand = translate(lot, dx, dy)
        if not bounds.contains(cand):
            return False
        return obs is None or not cand.intersects(obs)

    def overlap(dx, dy):
        cand = translate(lot, dx, dy)
        pen = 0.0 if bounds.contains(cand) else 1e6
        if obs is not None:
            pen += cand.intersection(obs).area
        return pen

    if ok(0.0, 0.0):
        return 0.0, 0.0
    best, best_pen = (0.0, 0.0), overlap(0.0, 0.0)
    for r in [2, 4, 6, 8, 11, 14, 18, 22, 26, 30, 35, 42, 50, 60]:
        for k in range(24):
            a = 2 * math.pi * k / 24
            dx, dy = r * math.cos(a), r * math.sin(a)
            if ok(dx, dy):
                return dx, dy
            pen = overlap(dx, dy) + r * 0.01
            if pen < best_pen:
                best, best_pen = (dx, dy), pen
    return best


# -------------------------------------------------------------- проверки ----
def checks(frame, m):
    site, inner = frame.poly, m['inner']
    msgs = []
    for it in m['items']:
        if not site.buffer(0.05).contains(it['whole']):
            msgs.append('ВЫХОД ЗА ГРАНИЦУ: %s' % it['name'])
        elif it['kind'] == 'building':
            sb = setback_of(it)
            if not site.buffer(-sb + 0.05).contains(it['poly']):
                msgs.append('Отступ от границы < %.0f м: %s' % (sb, it['name']))
    for lot, spec in zip(m['lots'], m.get('park_specs', C.PARKING)):
        for it in m['items']:
            if it['kind'] == 'building' and lot.intersects(it['poly'].buffer(-0.1)):
                msgs.append('Парковка «%s» накладывается на %s' % (spec['name'], it['name']))
    # Связность сети: проезды, дорожки и парковки должны образовывать одно
    # целое. Объекты работают перемычками — дорожка, упирающаяся в террасу
    # бани, связана через неё с соседней дорожкой.
    move = [g.buffer(0.35) for g in m['roads'] + m['paths'] + m['lots']]
    bridges = [i['whole'].buffer(0.35) for i in m['items']]
    net = unary_union(move + bridges)
    blobs = list(net.geoms) if net.geom_type.startswith('Multi') else [net]
    used = [b for b in blobs if any(b.intersects(g) for g in move)]
    comps = len(used)
    if comps > 1:
        msgs.append('Сеть движения распадается на %d несвязанных кусков' % comps)
    m['net_components'] = comps

    for a in range(len(m['items'])):
        for b in range(a + 1, len(m['items'])):
            A, B = m['items'][a], m['items'][b]
            ov = A['whole'].intersection(B['whole']).area
            if ov > 1.0:
                msgs.append('Объекты накладываются (%.0f м²): %s / %s'
                            % (ov, A['name'], B['name']))

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
    """ТЭП: (наименование, величина, доля от участка или None, единица).

    Покрытия разложены по видам, доли считаются без двойного счёта —
    каждый квадратный метр попадает ровно в одну строку."""
    site = frame.poly
    foot = unary_union([i['poly'] for i in m['items']])
    taken = foot

    def layer(geoms):
        g = unary_union(list(geoms)).difference(taken) if geoms else Polygon()
        return g

    roads_g = layer(list(m['roads']) + list(m['lots']))
    taken = unary_union([taken, roads_g])
    paths_g = layer(m['paths'])
    taken = unary_union([taken, paths_g])
    trails_g = layer(m.get('trails', []))
    taken = unary_union([taken, trails_g])
    decks_g = layer([sp['poly'] for i in m['items'] for t, sp in i['parts']
                     if t in ('deck', 'platform', 'court')])
    taken = unary_union([taken, decks_g])
    green = site.difference(taken)
    s = site.area
    rows = [('Площадь участка', s, 100.0, 'м²'),
            ('Застройка (здания)', foot.area, 100 * foot.area / s, 'м²'),
            ('Проезды и парковки', roads_g.area, 100 * roads_g.area / s, 'м²'),
            ('Пешеходные дорожки', paths_g.area, 100 * paths_g.area / s, 'м²'),
            ('Лесные тропы', trails_g.area, 100 * trails_g.area / s, 'м²'),
            ('Террасы, настилы, площадки', decks_g.area, 100 * decks_g.area / s, 'м²'),
            ('Озеленение / лес', green.area, 100 * green.area / s, 'м²'),
            ('Машиноместа', m['nstall'], None, 'м/м')]
    return rows


def explication(m):
    rows, seen = [], {}
    for it in m['items']:
        key = it.get('group') or it['name']
        if key in seen:
            seen[key]['count'] += 1
            seen[key]['area'] += (it['poly'].area if it['kind'] == 'building'
                                  else it['whole'].area)
            continue
        area = it['poly'].area if it['kind'] == 'building' else it['whole'].area
        r = dict(n=it['n'], name=key, size=it['size'], h=it['h'], count=1,
                 area=area, kind=it['kind'])
        seen[key] = r
        rows.append(r)
    rows.sort(key=lambda r: (r['n'] == 0, r['n']))
    return rows


# --------------------------------------------------------------- экспорт ----
def draw_part(md, t, sp, it):
    """Одна часть объекта в 3D."""
    if t == 'volume':
        md.prism(sp['poly'], '11 Здания - стены', sp['z0'], sp['wall'] - sp['z0'])
        md.tris(model3d.wall_fill_tris(sp['poly'], sp['roof'], sp['wall'], sp['ridge']),
                '11 Здания - стены')
        md.tris(model3d.roof_tris(sp['poly'], sp['roof'], sp['wall'], sp['ridge'],
                                  sp.get('over', 0.9)), '12 Здания - кровли')
    elif t == 'canopy':
        md.tris(model3d.roof_tris(sp['poly'], sp['roof'], sp['wall'], sp['ridge'],
                                  sp.get('over', 1.1)), '13 Навесы')
        for x, y, r in sp.get('cols', []):
            md.prism(Point(x, y).buffer(r, 12), '14 Колонны, трубы', sp['z0'],
                     sp['wall'] - sp['z0'])
    elif t == 'column':
        for x, y, r in sp['pts']:
            md.prism(Point(x, y).buffer(r, 10), '14 Колонны, трубы', 0.0, sp['h'])
    elif t == 'chimney':
        md.prism(sp['poly'], '14 Колонны, трубы', 0.0, sp['h'])
    elif t == 'barrel':
        md.tris(model3d.barrel_tris(sp['cx'], sp['cy'], sp.get('z0', 0.0), sp['r'],
                                    sp['length'], sp['ang']), '11 Здания - стены')
    elif t == 'plinth':
        md.prism(sp['poly'], '18 Цоколь', 0.0, sp['h'])
    elif t == 'water':
        rim = sp['poly'].buffer(sp.get('rim', 0.6)).difference(sp['poly'])
        md.prism(rim, '07 Террасы и настилы', 0.0, 0.4)
        md.prism(sp['poly'], '10 Вода', -0.4, 0.35)
    elif t == 'tub':
        z0 = sp.get('z0', 0.0)
        md.prism(sp['poly'].buffer(0.12), '14 Колонны, трубы', z0, sp['h'])
        md.prism(sp['poly'], '10 Вода', z0 + sp['h'] - 0.25, 0.2)
    elif t == 'equip':
        md.prism(sp['poly'], '16 Оборудование', 0.0, sp.get('h', 1.0))
    elif t == 'entrance':
        return
    elif t == 'glass':
        md.prism(sp['poly'], '19 Остекление', sp['z0'], sp['h'])
        md.tris(model3d.frame_tris(sp['poly'], sp['z0'], sp['h']), '23 Переплёты')
    elif t == 'rail':
        md.tris(model3d.rail_tris(sp['line'], sp.get('h', 1.05)), '20 Ограждения')
    elif t == 'lamp':
        md.tris(model3d.lamp_tris(sp['pt'][0], sp['pt'][1], sp.get('h', 6.0),
                                  sp.get('kind', 'road')), '21 Освещение')
    elif t == 'bench':
        md.tris(model3d.bench_tris(sp['pt'][0], sp['pt'][1], sp.get('ang', 0.0)),
                '22 МАФ')
    elif t in ('deck', 'platform', 'court'):
        h = {'deck': 0.5, 'platform': 0.2, 'court': 0.12}[t]
        md.prism(sp['poly'], model3d.SLAB_LAYER[t], 0.0, sp.get('h', h))


def to_3dm(frame, m, path):
    md = model3d.Model()
    md.curve(frame.poly, '01 Граница участка')
    md.curve(m['inner'], '02 Линия отступа')

    for g in m.get('fence', []):
        md.prism(g, '03 Забор', 0.0, 2.2)

    for g in m['roads']:
        md.prism(g, '04 Проезды', -0.12, 0.14)
    for g in m['paths']:
        md.prism(g, '06 Дорожки', -0.06, 0.1)
    for g in m.get('trails', []):
        md.prism(g, '24 Лесные тропы', -0.04, 0.08)
    for g in m['lots']:
        md.prism(g, '05 Парковка', -0.12, 0.14)
    for g in m['stalls']:
        md.curve(g, '05 Парковка', 0.03)

    for it in m['items']:
        for t, sp in it['parts']:
            draw_part(md, t, sp, it)
        c = it['poly'].centroid
        md.dot('%d. %s' % (it['n'], it['name']), c.x, c.y, it['h'] + 2.0)

    for t, sp in m.get('furn', []):
        draw_part(md, t, sp, None)
    for x, y in m['trees']:
        rnd = (abs(hash((round(x), round(y)))) % 1000) / 1000.0
        md.tris(model3d.tree_tris(x, y, 12.0 + rnd * 8.0, 1.9 + rnd * 1.5),
                '15 Озеленение')
    return md.f.Write(path, 7), len(m['trees']), len(md.f.Objects)


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
    for g in m.get('trails', []):
        draw(g, facecolor='#b3a184', edgecolor='none', zorder=3)
    for g in m['lots']:
        draw(g, facecolor=K['park'], edgecolor='#7a7a82', lw=0.6, zorder=4)
    for g in m['stalls']:
        draw(g, facecolor='none', edgecolor='#ffffff', lw=0.6, zorder=5)

    order = {'platform': 6, 'plinth': 7, 'deck': 8, 'court': 7, 'water': 8,
             'tub': 9, 'canopy': 9, 'volume': 11, 'barrel': 11, 'chimney': 12,
             'column': 12, 'equip': 10, 'glass': 13}
    style = {'platform': (K['plat'], '#8a9a72'), 'deck': (K['terr'], '#9a7748'),
             'court': (K['court'], '#25503a'), 'water': (K['water'], '#3f7fa5'),
             'tub': (K['water'], '#7a5a34'), 'canopy': (K['canopy'], '#a08d6d'),
             'volume': (K['bld'], K['bld_e']), 'barrel': ('#6b4e2e', '#3a2a17'),
             'plinth': ('#9b988f', '#6d6a63'), 'chimney': ('#8d8378', '#4b443c'),
             'column': ('#a98a63', '#6b563a'), 'equip': ('#9aa0a6', '#5d6166'),
             'glass': ('#7fc0e0', '#3f7fa5')}
    for t, sp in m.get('furn', []):
        ax.plot([sp['pt'][0]], [sp['pt'][1]], marker='o', ms=1.8,
                color='#4a4f55' if t == 'lamp' else '#8a6a3a', zorder=11)
    for it in m['items']:
        for t, sp in it['parts']:
            if t == 'entrance':
                ax.plot([sp['pt'][0]], [sp['pt'][1]], marker='^', ms=4,
                        color='#cc2222', zorder=13)
                continue
            if t == 'rail':
                xs = [p[0] for p in sp['line']]
                ys = [p[1] for p in sp['line']]
                ax.plot(xs, ys, color='#6b563a', lw=1.0, zorder=12)
                continue
            if t in ('lamp', 'bench'):
                ax.plot([sp['pt'][0]], [sp['pt'][1]], marker='o', ms=2.2,
                        color='#4a4f55' if t == 'lamp' else '#8a6a3a', zorder=12)
                continue
            fc, ec = style.get(t, (K['plat'], '#777777'))
            if t == 'column':
                for x, y, r in sp['pts']:
                    ax.add_patch(plt.Circle((x, y), r, facecolor=fc, edgecolor=ec,
                                            lw=0.6, zorder=12))
                continue
            draw(sp['poly'], facecolor=fc, edgecolor=ec, lw=0.9, zorder=order.get(t, 6))
            for x, y, r in sp.get('cols', []):
                ax.add_patch(plt.Circle((x, y), r, facecolor='#a98a63',
                                        edgecolor='#6b563a', lw=0.6, zorder=12))
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
            ('Площадки', K['plat'], '#8a9a72', 1.0),
            ('Корты', K['court'], '#25503a', 1.0),
            ('Проезды', K['road'], 'none', 0),
            ('Парковка (%d м/м)' % m['nstall'], K['park'], '#7a7a82', 0.6),
            ('Пешеходные дорожки', K['path'], 'none', 0),
            ('Лесные тропы', '#b3a184', 'none', 0),
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
    for name, a, pct, unit in teп(frame, m):
        panel.text(0, y, '%-28s %7.0f %-3s %s'
                   % (name[:28], a, unit, '' if pct is None else '%4.1f%%' % pct),
                   fontsize=7.4, family='monospace', va='top')
        y -= 0.0185
    fig.savefig(path, bbox_inches='tight')
    plt.close(fig)


def to_zoning_png(frame, m, path, title):
    """Схема функционального зонирования."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import PathPatch, Patch
    from matplotlib.path import Path as MPath

    fig, ax = plt.subplots(figsize=(15, 11), dpi=150)
    ax.set_facecolor('#f4f3ea')

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
                codes += [MPath.MOVETO] + [MPath.LINETO] * (len(pts) - 2) + [MPath.CLOSEPOLY]
            ax.add_patch(PathPatch(MPath(verts, codes), **kw))

    draw(frame.poly, facecolor='#e8eadb', edgecolor='#cc2222', lw=2.5, zorder=1)
    handles = []
    for name, color, uv in C.ZONES:
        poly = Polygon([frame.xy(u, v) for u, v in uv]).intersection(frame.poly)
        draw(poly, facecolor=color, edgecolor=color, lw=1.2, alpha=0.30, zorder=2)
        c = poly.centroid
        ax.text(c.x, c.y, name.upper(), ha='center', va='center', fontsize=9,
                color='#2b2f25', zorder=6, weight='bold',
                bbox=dict(boxstyle='round,pad=0.35', fc='#ffffffcc', ec='none'))
        handles.append(Patch(facecolor=color, alpha=0.45, label=name))

    for g in m['roads']:
        draw(g, facecolor='#8c8c92', edgecolor='none', zorder=3, alpha=0.75)
    for g in m['paths']:
        draw(g, facecolor='#cfc6b4', edgecolor='none', zorder=3, alpha=0.8)
    for it in m['items']:
        draw(it['poly'], facecolor='#5a3c1c', edgecolor='#2e1f0e', lw=0.6, zorder=5)
        c = it['poly'].centroid
        ax.text(c.x, c.y, str(it['n']), ha='center', va='center', fontsize=7,
                color='white', zorder=7)

    minx, miny, maxx, maxy = frame.poly.bounds
    ax.set_xlim(minx - 14, maxx + 14)
    ax.set_ylim(miny - 14, maxy + 14)
    ax.set_aspect('equal')
    ax.grid(True, color='#ffffff', lw=0.4, alpha=0.7)
    ax.set_title(title, fontsize=15, pad=12)
    ax.set_xlabel('X, м (восток)')
    ax.set_ylabel('Y, м (север)')
    ax.legend(handles=handles, loc='lower right', fontsize=8.5, framealpha=0.95)
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
    for name, a, pct, unit in teп(frame, m):
        lines.append('%-34s %9.0f %-4s %s'
                     % (name, a, unit.replace('м²', 'м2'),
                        '' if pct is None else '%5.1f %%' % pct))
    lines += ['', 'Объектов на плане: %d (позиций в экспликации: %d)'
              % (len(m['items']), len(explication(m))),
              'Дорожек в сети: %d, связных кусков сети: %d'
              % (len(m['paths']), m.get('net_components', 0)),
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

    titles = {'A': 'БОР 495 — генплан, вариант 1: комплекс и лес',
              'B': 'БОР 495 — генплан, вариант 2: комплекс и гостевые дома'}
    for v in (['A', 'B'] if a.variant == 'both' else [a.variant]):
        m = build(frame, v)
        m['trees'] = scatter_trees(m['green'])
        msgs = checks(frame, m)
        base = os.path.join(OUT, 'BOR495_genplan_%s%s' % (v, a.suffix))
        ok, ntree, nobj = to_3dm(frame, m, base + '.3dm')
        to_png(frame, m, base + '.png', titles[v])
        to_zoning_png(frame, m, base + '_zoning.png',
                      'БОР 495 — функциональное зонирование (%s)' % v)
        print(report(frame, m, msgs, base + '.txt', titles[v]))
        print('\n3dm: %s (%s), объектов %d, деревьев %d\n' % (base + '.3dm', ok, nobj, ntree))
    if is_placeholder:
        print('!!! Участок — заглушка')


if __name__ == '__main__':
    main()
