# -*- coding: utf-8 -*-
"""Сборка трёхмерной модели генплана в формате Rhino 7 (.3dm), метры.

Всё строится в реальном масштабе: плиты покрытий, стены, скатные кровли,
навесы на колоннах, чаши бассейнов, забор, деревья.
"""
import math
import random

import rhino3dm as r3
from shapely.geometry import Point, Polygon


# ------------------------------------------------------------------ слои ---
LAYERS = [
    ('01 Граница участка',   (220, 30, 30)),
    ('02 Линия отступа',     (255, 150, 0)),
    ('03 Забор',             (120, 80, 40)),
    ('04 Проезды',           (95, 95, 100)),
    ('05 Парковка',          (135, 135, 145)),
    ('06 Дорожки',           (198, 186, 166)),
    ('07 Террасы и настилы', (176, 129, 79)),
    ('08 Площадки',          (170, 180, 140)),
    ('09 Корты',             (45, 120, 80)),
    ('10 Вода',              (70, 150, 200)),
    ('11 Здания - стены',    (196, 160, 116)),
    ('12 Здания - кровли',   (90, 80, 78)),
    ('13 Навесы',            (150, 120, 90)),
    ('14 Озеленение',        (60, 120, 60)),
    ('15 Подписи',           (25, 25, 25)),
]

SLAB = {'road': ('04 Проезды', 0.12), 'parking': ('05 Парковка', 0.12),
        'path': ('06 Дорожки', 0.10), 'terrace': ('07 Террасы и настилы', 0.45),
        'platform': ('08 Площадки', 0.15), 'court': ('09 Корты', 0.10)}


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

    # ------------------------------------------------------------ примитивы --
    def curve(self, geom, layer, z=0.0):
        if geom.is_empty:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            if not hasattr(g, 'exterior'):
                continue
            for ring in [g.exterior] + list(g.interiors):
                pts = [r3.Point3d(x, y, z) for x, y in ring.coords]
                self.f.Objects.AddPolyline(pts, self.att(layer))

    def prism(self, geom, layer, z0=0.0, h=0.2):
        """Плита или объём: экструзия контура по высоте."""
        if geom.is_empty or h <= 0:
            return
        for g in (geom.geoms if geom.geom_type.startswith('Multi') else [geom]):
            if not hasattr(g, 'exterior') or g.area < 0.05:
                continue
            pts = [r3.Point3d(x, y, z0) for x, y in g.exterior.coords]
            ext = r3.Extrusion.Create(r3.PolylineCurve(pts), h, True)
            if ext:
                self.f.Objects.AddExtrusion(ext, self.att(layer))

    def mesh_from_rings(self, rings, layer):
        """Сшивает последовательные кольца точек в оболочку (кровля, купол)."""
        m = r3.Mesh()
        base = []
        for ring in rings:
            base.append([m.Vertices.Add(p[0], p[1], p[2]) for p in ring])
        for a, b in zip(base, base[1:]):
            n = min(len(a), len(b))
            for i in range(n - 1):
                m.Faces.AddFace(a[i], a[i + 1], b[i + 1], b[i])
        m.Normals.ComputeNormals()
        self.f.Objects.AddMesh(m, self.att(layer))

    def cap(self, ring, layer):
        """Замыкает верхнее кольцо плоской гранью (веером от центра)."""
        if len(ring) < 4:
            return
        cx = sum(p[0] for p in ring) / len(ring)
        cy = sum(p[1] for p in ring) / len(ring)
        cz = sum(p[2] for p in ring) / len(ring)
        m = r3.Mesh()
        c = m.Vertices.Add(cx, cy, cz)
        ids = [m.Vertices.Add(*p) for p in ring]
        for i in range(len(ids) - 1):
            m.Faces.AddFace(c, ids[i], ids[i + 1])
        m.Normals.ComputeNormals()
        self.f.Objects.AddMesh(m, self.att(layer))

    def dot(self, text, x, y, z, layer='15 Подписи'):
        self.f.Objects.AddTextDot(text, r3.Point3d(x, y, z), self.att(layer))


# ------------------------------------------------------------------ кровли --
def _ring(poly, z):
    return [(x, y, z) for x, y in poly.exterior.coords]


def _resample(ring, n, start=None):
    """Равномерно по длине пересэмплирует кольцо в n точек.

    Кольца карниза и конька имеют разное число вершин, поэтому сшивать их
    «по индексу» нельзя — скаты получаются перекрученными.
    """
    pts = list(ring)
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    if start is not None:                 # выравниваем начало по опорной точке
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
    n = n or max(48, max(len(r) for r in rings))
    base = _resample(rings[0], n)
    out = [base]
    for r in rings[1:]:
        if len(set((round(p[0], 3), round(p[1], 3)) for p in r)) == 1:
            out.append([tuple(r[0])] * (n + 1))      # шатёр: вершина
        else:
            out.append(_resample(r, n, start=base[0]))
    return out


def roof_rings(foot, z_eave, ridge_h, kind='hip', eave=0.8):
    """Кольца кровли снизу вверх. Один источник и для .3dm, и для веб-просмотра.

    Возвращает (rings, capped): плоская кровля — два кольца с парапетом,
    скатная — карниз и конёк, шатёр — карниз и точка, купол — несколько колец.
    """
    outer = foot.buffer(eave, join_style=1)
    if outer.geom_type != 'Polygon':
        outer = max(outer.geoms, key=lambda g: g.area)

    if kind == 'flat':
        return _align([_ring(outer, z_eave), _ring(outer, z_eave + 0.45)]), True

    if kind == 'dome':
        rings, steps = [], 4
        rin = _inradius(outer)
        for i in range(steps + 1):
            t = i / float(steps)
            shrink = outer.buffer(-t * rin * 0.95, join_style=1)
            if shrink.is_empty or shrink.geom_type != 'Polygon':
                break
            rings.append(_ring(shrink, z_eave + math.sin(t * math.pi / 2) * (ridge_h - z_eave)))
        return _align(rings), True

    inset = _inradius(outer) * (0.55 if kind == 'hip' else 0.85)
    top = outer.buffer(-inset, join_style=1)
    base = _ring(outer, z_eave)
    if (not top.is_empty) and top.geom_type == 'Polygon' and top.area > 1.0:
        return _align([base, _ring(top, ridge_h)]), True
    c = outer.centroid
    return _align([base, [(c.x, c.y, ridge_h)] * len(base)]), False


def roof(model, foot, z_eave, ridge_h, kind='hip', eave=0.8):
    rings, capped = roof_rings(foot, z_eave, ridge_h, kind, eave)
    if len(rings) < 2:
        return
    model.mesh_from_rings(rings, '12 Здания - кровли')
    if capped:
        model.cap(rings[-1], '12 Здания - кровли')


def _inradius(poly):
    """Грубая оценка «радиуса» пятна — насколько его можно ужать."""
    lo, hi = 0.0, max(poly.bounds[2] - poly.bounds[0],
                      poly.bounds[3] - poly.bounds[1]) / 2.0 + 1.0
    for _ in range(24):
        mid = (lo + hi) / 2.0
        if poly.buffer(-mid).is_empty:
            hi = mid
        else:
            lo = mid
    return lo


def canopy(model, foot, h, col=0.35):
    """Навес: плита на колоннах по углам."""
    model.prism(foot, '13 Навесы', h, 0.4)
    pts = list(foot.exterior.coords)[:-1]
    step = max(1, len(pts) // 8)
    for p in pts[::step]:
        c = Point(p).buffer(col, 8)
        model.prism(c, '13 Навесы', 0.0, h)


def pool(model, foot):
    """Чаша бассейна: борт и зеркало воды ниже уровня земли."""
    rim = foot.buffer(0.6).difference(foot)
    model.prism(rim, '07 Террасы и настилы', 0.0, 0.35)
    model.prism(foot, '10 Вода', -0.35, 0.3)


# --------------------------------------------------------------- озеленение --
def trees(model, area, count=260, seed=12, rmin=6.0):
    """Сосны и ели: ствол и крона-конус, вразброс по свободной территории."""
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = area.bounds
    placed = []
    tries = 0
    while len(placed) < count and tries < count * 60:
        tries += 1
        x = rnd.uniform(minx, maxx)
        y = rnd.uniform(miny, maxy)
        p = Point(x, y)
        if not area.contains(p):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < rmin ** 2 for px, py in placed):
            continue
        placed.append((x, y))
        hgt = rnd.uniform(11.0, 19.0)
        rad = rnd.uniform(1.8, 3.2)
        model.prism(Point(x, y).buffer(0.22, 6), '14 Озеленение', 0.0, hgt * 0.45)
        ring = [(x + rad * math.cos(a), y + rad * math.sin(a), hgt * 0.42)
                for a in [i * math.pi / 6 for i in range(13)]]
        apex = [(x, y, hgt)] * len(ring)
        model.mesh_from_rings([ring, apex], '14 Озеленение')
    return len(placed)
