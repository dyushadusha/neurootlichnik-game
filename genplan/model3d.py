# -*- coding: utf-8 -*-
"""Геометрический движок: объёмы, скатные кровли, колонны, вода, деревья.

Всё считается в метрах. Кровли собираются как треугольные сетки — один и тот
же результат идёт и в .3dm для Rhino, и в JSON для веб-просмотра.
"""
import math
import random

import rhino3dm as r3
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon

LAYERS = [
    ('01 Граница участка',    (220, 30, 30)),
    ('02 Линия отступа',      (255, 150, 0)),
    ('03 Забор',              (120, 80, 40)),
    ('04 Проезды',            (95, 95, 100)),
    ('05 Парковка',           (135, 135, 145)),
    ('06 Дорожки',            (198, 186, 166)),
    ('07 Террасы и настилы',  (176, 129, 79)),
    ('08 Площадки',           (170, 180, 140)),
    ('09 Корты',              (45, 120, 80)),
    ('10 Вода',               (70, 150, 200)),
    ('11 Здания - стены',     (196, 160, 116)),
    ('12 Здания - кровли',    (90, 80, 78)),
    ('13 Навесы',             (150, 120, 90)),
    ('14 Колонны, трубы',     (140, 110, 80)),
    ('15 Озеленение',         (60, 120, 60)),
    ('16 Оборудование',       (110, 110, 115)),
    ('17 Подписи',            (25, 25, 25)),
    ('18 Цоколь',             (138, 136, 130)),
]

SLAB_LAYER = {'road': '04 Проезды', 'parking': '05 Парковка', 'path': '06 Дорожки',
              'deck': '07 Террасы и настилы', 'platform': '08 Площадки',
              'court': '09 Корты', 'plinth': '18 Цоколь'}


# --------------------------------------------------------------- утилиты ----
def obb(poly):
    """Ориентированный габарит: центр, угол длинной оси, полудлина, полуширина."""
    rect = poly.minimum_rotated_rectangle
    c = list(rect.exterior.coords)[:4]
    e = [(c[i], c[(i + 1) % 4]) for i in range(4)]
    lens = [math.dist(a, b) for a, b in e]
    i = int(max(range(4), key=lambda k: lens[k]))
    (ax, ay), (bx, by) = e[i]
    ang = math.atan2(by - ay, bx - ax)
    cen = rect.centroid
    return (cen.x, cen.y), ang, lens[i] / 2.0, lens[(i + 1) % 4] / 2.0


def _to_world(cen, ang, pts):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cen[0] + u * ca - w * sa, cen[1] + u * sa + w * ca, z) for u, w, z in pts]


def quad(a, b, c, d):
    return [(a, b, c), (a, c, d)]


def roof_tris(foot, kind, z_eave, ridge, over=0.9):
    """Треугольники кровли. gable/hip/shed строятся по ориентированному
    габариту (настоящий конёк), pagoda/dome/cone — по контуру пятна."""
    if kind == 'arch':
        return arch_tris(foot, z_eave, ridge, max(over, 1.4))
    if kind in ('dome', 'cone', 'pagoda'):
        return _ring_roof(foot, kind, z_eave, ridge, over)

    cen, ang, hl, hw = obb(foot)
    hl += over
    hw += over
    tris = []
    if kind == 'shed':
        p = _to_world(cen, ang, [(-hl, -hw, z_eave), (hl, -hw, z_eave),
                                 (hl, hw, ridge), (-hl, hw, ridge)])
        tris += quad(*p)
        lo = _to_world(cen, ang, [(-hl, -hw, z_eave - 0.35), (hl, -hw, z_eave - 0.35),
                                  (hl, hw, ridge - 0.35), (-hl, hw, ridge - 0.35)])
        tris += quad(lo[3], lo[2], lo[1], lo[0])
        return tris

    if kind == 'gable':
        r0, r1 = -hl, hl
    else:                                   # hip: конёк короче свеса на полуширину
        r0, r1 = -hl + hw, hl - hw
        if r1 <= r0:
            r0 = r1 = 0.0

    p = _to_world(cen, ang, [(-hl, -hw, z_eave), (hl, -hw, z_eave),
                             (hl, hw, z_eave), (-hl, hw, z_eave),
                             (r0, 0.0, ridge), (r1, 0.0, ridge)])
    e0, e1, e2, e3, k0, k1 = p
    tris += quad(e0, e1, k1, k0)            # южный скат
    tris += quad(e2, e3, k0, k1)            # северный скат
    if kind == 'hip':
        tris += [(e1, e2, k1), (e3, e0, k0)]
    else:                                   # фронтоны
        tris += [(e1, e2, k1), (e3, e0, k0)]
    lo = [(x, y, z - 0.3) for x, y, z in p]
    tris += quad(lo[1], lo[0], lo[3], lo[2])
    return tris


def arch_tris(foot, z_eave, ridge, over=1.6, seg=14):
    """Изогнутая кровля-«крыло»: дуга поперёк длинной оси (ресторан, отель)."""
    cen, ang, hl, hw = obb(foot)
    hl += over
    hw += over
    prof = []
    for i in range(seg + 1):
        t = i / float(seg)
        w = -hw + 2 * hw * t
        z = z_eave + (ridge - z_eave) * math.sin(math.pi * t) ** 0.85
        prof.append((w, z))
    tris = []
    for (w0, z0), (w1, z1) in zip(prof, prof[1:]):
        p = _to_world(cen, ang, [(-hl, w0, z0), (hl, w0, z0), (hl, w1, z1), (-hl, w1, z1)])
        tris += quad(*p)
        lo = _to_world(cen, ang, [(-hl, w0, z0 - 0.45), (hl, w0, z0 - 0.45),
                                  (hl, w1, z1 - 0.45), (-hl, w1, z1 - 0.45)])
        tris += quad(lo[3], lo[2], lo[1], lo[0])
    for sgn in (-1, 1):                       # торцы
        pts = _to_world(cen, ang, [(sgn * hl, w, z) for w, z in prof])
        base = _to_world(cen, ang, [(sgn * hl, w, z - 0.45) for w, z in prof])
        for i in range(len(pts) - 1):
            tris += quad(pts[i], pts[i + 1], base[i + 1], base[i])
    return tris


def barrel_tris(cx, cy, z0, r, length, ang_deg, seg=20):
    """Лежачая бочка: цилиндр вдоль оси ang_deg (Баня Бочка)."""
    a = math.radians(ang_deg)
    ex = (math.cos(a), math.sin(a))
    zc = z0 + r
    tris = []
    ring = []
    for i in range(seg + 1):
        t = 2 * math.pi * i / seg
        ring.append((r * math.cos(t), r * math.sin(t)))
    def pt(sign, w, z):
        return (cx + ex[0] * sign * length / 2.0 - ex[1] * w,
                cy + ex[1] * sign * length / 2.0 + ex[0] * w, zc + z)
    for i in range(seg):
        w0, z0_ = ring[i]
        w1, z1_ = ring[i + 1]
        tris += quad(pt(-1, w0, z0_), pt(1, w0, z0_), pt(1, w1, z1_), pt(-1, w1, z1_))
    for sign in (-1, 1):                      # донья
        c = pt(sign, 0, 0)
        for i in range(seg):
            tris.append((c, pt(sign, *ring[i]), pt(sign, *ring[i + 1])))
    return tris


def _ring_roof(foot, kind, z_eave, ridge, over):
    outer = foot.buffer(over, join_style=1)
    if outer.geom_type != 'Polygon':
        outer = max(outer.geoms, key=lambda g: g.area)
    rin = _inradius(outer)
    steps = {'cone': 1, 'pagoda': 2}.get(kind, 4)
    rings = []
    for i in range(steps + 1):
        t = i / float(steps)
        shrink = outer.buffer(-t * rin * (0.98 if kind != 'cone' else 1.2), join_style=1)
        if kind == 'dome':
            z = z_eave + math.sin(t * math.pi / 2) * (ridge - z_eave)
        else:
            z = z_eave + (ridge - z_eave) * (t ** (0.7 if kind == 'pagoda' else 1.0))
        if shrink.is_empty or shrink.geom_type != 'Polygon' or shrink.area < 0.5:
            c = outer.centroid
            rings.append([(c.x, c.y, ridge)])
            break
        rings.append([(x, y, z) for x, y in shrink.exterior.coords])
    rings = _align(rings)
    tris = []
    for a, b in zip(rings, rings[1:]):
        for i in range(len(a) - 1):
            tris += quad(a[i], a[i + 1], b[i + 1], b[i])
    top = rings[-1]
    cx = sum(p[0] for p in top) / len(top)
    cy = sum(p[1] for p in top) / len(top)
    cz = sum(p[2] for p in top) / len(top)
    for i in range(len(top) - 1):
        tris.append(((cx, cy, cz), top[i], top[i + 1]))
    return tris


def _inradius(poly):
    lo, hi = 0.0, max(poly.bounds[2] - poly.bounds[0],
                      poly.bounds[3] - poly.bounds[1]) / 2.0 + 1.0
    for _ in range(22):
        mid = (lo + hi) / 2.0
        if poly.buffer(-mid).is_empty:
            hi = mid
        else:
            lo = mid
    return lo


def _resample(ring, n, start=None):
    pts = list(ring)
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    if start is not None:
        k = min(range(len(pts) - 1),
                key=lambda i: (pts[i][0] - start[0]) ** 2 + (pts[i][1] - start[1]) ** 2)
        pts = pts[k:-1] + pts[:k + 1]
    seg = [0.0]
    for a, b in zip(pts, pts[1:]):
        seg.append(seg[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = seg[-1] or 1.0
    out, j = [], 0
    for i in range(n):
        t = total * i / float(n)
        while j < len(seg) - 2 and seg[j + 1] < t:
            j += 1
        span = (seg[j + 1] - seg[j]) or 1.0
        f = (t - seg[j]) / span
        a, b = pts[j], pts[j + 1]
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
                    a[2] + (b[2] - a[2]) * f))
    out.append(out[0])
    return out


def _align(rings, n=None):
    n = n or max(40, max(len(r) for r in rings))
    base = _resample(rings[0], n)
    out = [base]
    for r in rings[1:]:
        if len(r) == 1:
            out.append([tuple(r[0])] * (n + 1))
        else:
            out.append(_resample(r, n, start=base[0]))
    return out


def ring_points(cx, cy, r, n=16, z=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / n),
             cy + r * math.sin(2 * math.pi * i / n), z) for i in range(n)]


# ------------------------------------------------------------------ модель --
class Model(object):
    def __init__(self):
        self.f = r3.File3dm()
        self.f.Settings.ModelUnitSystem = r3.UnitSystem.Meters
        self.idx = {}
        for name, col in LAYERS:
            lay = r3.Layer()
            lay.Name = name
            lay.Color = (col[0], col[1], col[2], 255)
            self.idx[name] = self.f.Layers.Add(lay)

    def att(self, layer):
        a = r3.ObjectAttributes()
        a.LayerIndex = self.idx[layer]
        return a

    def curve(self, geom, layer, z=0.0):
        if geom.is_empty:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            if not hasattr(g, 'exterior'):
                continue
            for ring in [g.exterior] + list(g.interiors):
                self.f.Objects.AddPolyline([r3.Point3d(x, y, z) for x, y in ring.coords],
                                           self.att(layer))

    def prism(self, geom, layer, z0=0.0, h=0.2):
        if geom.is_empty or h <= 0:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            if not hasattr(g, 'exterior') or g.area < 0.05:
                continue
            pts = [r3.Point3d(x, y, z0) for x, y in g.exterior.coords]
            ext = r3.Extrusion.Create(r3.PolylineCurve(pts), h, True)
            if ext:
                self.f.Objects.AddExtrusion(ext, self.att(layer))

    def tris(self, triangles, layer):
        if not triangles:
            return
        m = r3.Mesh()
        for t in triangles:
            ids = [m.Vertices.Add(p[0], p[1], p[2]) for p in t]
            m.Faces.AddFace(ids[0], ids[1], ids[2])
        m.Normals.ComputeNormals()
        self.f.Objects.AddMesh(m, self.att(layer))

    def dot(self, text, x, y, z, layer='17 Подписи'):
        self.f.Objects.AddTextDot(text, r3.Point3d(x, y, z), self.att(layer))


# --------------------------------------------------------------- деревья ----
def tree_tris(x, y, h, r, seg=10):
    """Хвойное дерево: ствол и две яруса кроны."""
    tris = []
    base = h * 0.32
    for lvl, (z0, z1, rr) in enumerate([(base, h * 0.72, r),
                                        (h * 0.62, h, r * 0.62)]):
        for i in range(seg):
            a0 = 2 * math.pi * i / seg
            a1 = 2 * math.pi * (i + 1) / seg
            tris.append(((x + rr * math.cos(a0), y + rr * math.sin(a0), z0),
                         (x + rr * math.cos(a1), y + rr * math.sin(a1), z0),
                         (x, y, z1)))
    tr = 0.22
    for i in range(seg):
        a0 = 2 * math.pi * i / seg
        a1 = 2 * math.pi * (i + 1) / seg
        p0 = (x + tr * math.cos(a0), y + tr * math.sin(a0))
        p1 = (x + tr * math.cos(a1), y + tr * math.sin(a1))
        tris += quad((p0[0], p0[1], 0), (p1[0], p1[1], 0),
                     (p1[0], p1[1], base), (p0[0], p0[1], base))
    return tris


def scatter(green, count, seed=7, rmin=6.0):
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = green.bounds
    pts, tries = [], 0
    while len(pts) < count and tries < count * 60:
        tries += 1
        x, y = rnd.uniform(minx, maxx), rnd.uniform(miny, maxy)
        if not green.contains(Point(x, y)):
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < rmin ** 2 for a, b in pts):
            continue
        pts.append((x, y))
    return pts
