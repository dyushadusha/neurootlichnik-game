# -*- coding: utf-8 -*-
"""Объёмно-планировочные решения объектов по присланным визуализациям.

Части объекта задаются в локальных координатах (метры, центр в начале,
ось X — вдоль длинной стороны), затем объект поворачивается и ставится на место.

Типы частей:
  volume  — объём (poly, wall, roof, ridge, z0, over)
  canopy  — навес/веранда на колоннах (та же кровля, cols — колонны)
  barrel  — лежачая бочка (cx, cy, r, len, ang)
  column  — стойки        chimney — труба
  plinth  — каменный цоколь            deck — терраса, настил
  platform — площадка     water — бассейн   tub — купель
  court   — корт          equip — оборудование
"""
import math

from shapely.affinity import rotate, scale, translate
from shapely.geometry import Point, Polygon, box


def _box(w, d, cx=0.0, cy=0.0):
    return box(cx - w / 2.0, cy - d / 2.0, cx + w / 2.0, cy + d / 2.0)


def _oval(w, d, cx=0.0, cy=0.0):
    return scale(Point(cx, cy).buffer(1.0, 48), w / 2.0, d / 2.0, origin=(cx, cy))


def _stadium(w, d, r=None):
    r = min(r if r is not None else d / 2.0, d / 2.0 - 0.01)
    return _box(max(w - 2 * r, 0.1), max(d - 2 * r, 0.1)).buffer(r, join_style=1,
                                                                 quad_segs=24)


def _sector(r, a0, a1, cx=0.0, cy=0.0, steps=40):
    pts = [(cx, cy)]
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return Polygon(pts)


def V(poly, wall, ridge, roof='gable', z0=0.0, over=0.9):
    return ('volume', dict(poly=poly, wall=wall, ridge=ridge, roof=roof, z0=z0, over=over))


def CAN(poly, wall, ridge, roof='shed', cols=(), z0=0.0, over=1.0):
    return ('canopy', dict(poly=poly, wall=wall, ridge=ridge, roof=roof, z0=z0,
                           over=over, cols=list(cols)))


def cols_line(x0, y0, x1, y1, n, r=0.3):
    n = max(n, 2)
    return [(x0 + (x1 - x0) * i / (n - 1.0), y0 + (y1 - y0) * i / (n - 1.0), r)
            for i in range(n)]


def cols_ring(poly, n, r=0.3, inset=0.5):
    ring = poly.buffer(-inset).exterior if poly.buffer(-inset).area > 1 else poly.exterior
    L = ring.length
    return [(ring.interpolate(L * i / n).x, ring.interpolate(L * i / n).y, r)
            for i in range(n)]


def plinth(poly, h=0.8):
    return ('plinth', dict(poly=poly.buffer(0.35), h=h))


# --------------------------------------------------------------------- КПП --
def kpp(w, d):
    """Небольшое здание у парковки: камень и дерево, односкатная кровля
    с большим выносом, крытое крыльцо на двух стойках."""
    core = _box(w * 0.80, d * 0.72)
    return [
        plinth(core, 0.5),
        V(core, 3.3, 4.6, 'shed', over=1.6),
        CAN(_box(w * 0.34, d * 0.22, -w * 0.18, -d * 0.44), 3.1, 3.5, 'shed',
            cols_line(-w * 0.32, -d * 0.52, -w * 0.04, -d * 0.52, 3, 0.26)),
        ('deck', dict(poly=_box(w * 0.9, d * 0.22, 0.0, -d * 0.45))),
    ]


# ------------------------------------------------------- административное ---
def admin(w, d):
    """Одноэтажный корпус: каменный цоколь, вальмовая кровля, центральный вход."""
    core = _box(w * 0.88, d * 0.62)
    return [
        plinth(core, 0.9),
        V(core, 3.9, 7.2, 'hip', over=1.0),
        CAN(_box(w * 0.14, d * 0.16, 0.0, -d * 0.36), 3.7, 4.6, 'gable',
            cols_line(-w * 0.07, -d * 0.43, w * 0.07, -d * 0.43, 2, 0.32)),
        ('deck', dict(poly=_box(w * 0.22, d * 0.14, 0.0, -d * 0.39))),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.30, d * 0.14), h=8.2)),
    ]


# -------------------------------------------------------------- рестор
def restaurant(w, d):
    """Зал под изогнутой кровлей на пилонах, входной блок с овальным навесом,
    терраса вдоль фасада и пруд перед ним."""
    hall = _box(w * 0.62, d * 0.44, w * 0.16, d * 0.02)
    entry = _box(w * 0.20, d * 0.30, -w * 0.26, d * 0.04)
    return [
        V(hall, 5.4, 8.4, 'arch', over=2.2),
        V(entry, 4.6, 5.4, 'flat', over=0.6),
        CAN(_oval(w * 0.26, d * 0.26, -w * 0.30, -d * 0.12), 4.4, 5.0, 'flat',
            cols_line(-w * 0.40, -d * 0.18, -w * 0.20, -d * 0.18, 3, 0.36)),
        ('column', dict(pts=cols_line(w * 0.16 - w * 0.30, -d * 0.20,
                                      w * 0.16 + w * 0.30, -d * 0.20, 10, 0.42),
                        h=5.4)),
        ('deck', dict(poly=_box(w * 0.66, d * 0.16, w * 0.16, -d * 0.28))),
        ('water', dict(poly=_oval(w * 0.50, d * 0.20, w * 0.12, -d * 0.48), rim=0.9)),
    ]


# ------------------------------------------------------------------ отель ---
def hotel(w, d):
    """Двухэтажный корпус: длинное крыло с галереей под изогнутой кровлей,
    вход в торце с козырьком, терраса вдоль южного фасада."""
    bar = _box(w * 0.74, d * 0.34, -w * 0.08, d * 0.16)
    wing = _box(w * 0.26, d * 0.40, w * 0.30, -d * 0.16)
    return [
        V(bar, 7.4, 10.2, 'arch', over=1.8),
        V(wing, 7.0, 9.6, 'arch', over=1.6),
        CAN(_box(w * 0.14, d * 0.14, w * 0.44, -d * 0.36), 3.6, 4.2, 'flat',
            cols_line(w * 0.38, -d * 0.42, w * 0.50, -d * 0.42, 2, 0.3)),
        ('column', dict(pts=cols_line(-w * 0.42, d * 0.00, w * 0.26, d * 0.00, 9, 0.34),
                        h=7.2)),
        ('deck', dict(poly=_box(w * 0.74, d * 0.14, -w * 0.08, -d * 0.06))),
        ('chimney', dict(poly=_box(1.2, 1.2, -w * 0.38, d * 0.28), h=12.0)),
    ]


# -------------------------------------------------------------- бани -------
def bath_petrovskaya(w, d):
    """Бревенчатый сруб: Г-образный план, сложная вальмовая кровля,
    крытая веранда на бревенчатых колоннах, каменный цоколь, крыльцо."""
    main = _box(w * 0.62, d * 0.42, -w * 0.10, d * 0.06)
    wing = _box(w * 0.30, d * 0.46, w * 0.26, -d * 0.04)
    ver = _box(w * 0.34, d * 0.18, -w * 0.02, -d * 0.28)
    core = main.union(wing)
    return [
        plinth(core.union(ver), 1.0),
        V(main, 3.6, 8.2, 'hip', over=1.4),
        V(wing, 3.6, 7.6, 'gable', over=1.5),
        CAN(ver, 3.4, 5.4, 'shed', cols_line(-w * 0.17, -d * 0.36, w * 0.15, -d * 0.36,
                                             5, 0.34), over=1.2),
        ('deck', dict(poly=_box(w * 0.44, d * 0.16, -w * 0.02, -d * 0.36))),
        ('chimney', dict(poly=_box(1.4, 1.4, -w * 0.26, d * 0.18), h=9.4)),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.22, d * 0.14), h=8.6)),
        ('water', dict(poly=Point(w * 0.02, -d * 0.60).buffer(4.4, 32), rim=0.8)),
        ('tub', dict(poly=Point(-w * 0.26, -d * 0.46).buffer(1.15, 16), h=1.2)),
    ]


def bath_log(w, d):
    """Рыбацкая и Охотничья — один типовой дом: брусовой объём под двускатной
    кровлей с большим выносом, крытая веранда на колоннах, входной блок
    с отдельным фронтоном, каменный цоколь."""
    core = _box(w * 0.66, d * 0.44, w * 0.06, d * 0.04)
    entry = _box(w * 0.20, d * 0.30, -w * 0.34, -d * 0.02)
    ver = _box(w * 0.50, d * 0.16, w * 0.10, -d * 0.26)
    return [
        plinth(core.union(entry).union(ver), 0.7),
        V(core, 3.2, 6.6, 'gable', over=1.6),
        V(entry, 3.0, 5.8, 'gable', over=1.4),
        CAN(ver, 3.1, 4.4, 'shed', cols_line(w * 0.10 - w * 0.22, -d * 0.32,
                                             w * 0.10 + w * 0.22, -d * 0.32, 5, 0.3)),
        ('deck', dict(poly=_box(w * 0.56, d * 0.16, w * 0.08, -d * 0.30))),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.06, d * 0.18), h=7.6)),
        ('chimney', dict(poly=_box(0.9, 0.9, w * 0.22, d * 0.18), h=7.4)),
        ('tub', dict(poly=Point(w * 0.30, -d * 0.40).buffer(1.2, 16), h=1.2)),
    ]


def bath_belaya(w, d):
    """Сруб под двускатной кровлей с большим выносом, каменный цоколь,
    крыльцо-терраса под свесом."""
    core = _box(w * 0.74, d * 0.52)
    return [
        plinth(core, 0.8),
        V(core, 3.1, 6.4, 'gable', over=1.8),
        ('deck', dict(poly=_box(w * 0.74, d * 0.16, 0.0, -d * 0.34))),
        ('chimney', dict(poly=_box(1.0, 1.0, w * 0.18, d * 0.16), h=7.2)),
        ('tub', dict(poly=Point(-w * 0.28, -d * 0.44).buffer(1.15, 16), h=1.2)),
    ]


def bath_bochka(w, d):
    """Объём под вальмовой кровлей с двумя лежачими бочками по торцам,
    терраса на колоннах и крыльцо со ступенями."""
    core = _box(w * 0.52, d * 0.52)
    r1, r2 = d * 0.19, d * 0.17
    return [
        plinth(core, 0.6),
        V(core, 3.4, 5.6, 'hip', over=1.5),
        ('barrel', dict(cx=-w * 0.36, cy=d * 0.02, r=r1, length=d * 0.52,
                        ang=90.0, z0=0.0)),
        ('barrel', dict(cx=w * 0.36, cy=-d * 0.02, r=r2, length=d * 0.46,
                        ang=90.0, z0=0.0)),
        CAN(_box(w * 0.52, d * 0.16, 0.0, -d * 0.34), 3.2, 3.6, 'shed',
            cols_line(-w * 0.24, -d * 0.40, w * 0.24, -d * 0.40, 5, 0.3)),
        ('deck', dict(poly=_box(w * 0.60, d * 0.18, 0.0, -d * 0.34))),
        ('tub', dict(poly=Point(w * 0.06, -d * 0.48).buffer(1.6, 20), h=1.3)),
    ]


# ------------------------------------------------------- прочие объекты -----
def padel(w, d):
    hall = _stadium(w * 0.86, d * 0.74, r=d * 0.18)
    return [V(hall, 7.2, 9.4, 'arch', over=2.0),
            ('court', dict(poly=_box(20.0, 10.0))),
            ('deck', dict(poly=_box(w * 0.40, d * 0.20, -w * 0.08, -d * 0.45))),
            ('equip', dict(poly=_box(0.3, 10.0), h=1.0))]


def open_court(w, d):
    posts = [('equip', dict(poly=Point(sx * w / 2, sy * d / 2).buffer(0.18, 8), h=4.0))
             for sx in (-1, 1) for sy in (-1, 1)]
    return [('court', dict(poly=_box(w, d))),
            ('equip', dict(poly=_box(0.25, d * 0.92), h=1.0))] + posts


def concert(w, d):
    r = min(w, d) / 2.0
    stage = Point(0, 0).buffer(r * 0.42, 40)
    canopy = Point(0, 0).buffer(r * 0.52, 40)
    parts = [('platform', dict(poly=stage, h=0.9)),
             CAN(canopy, 5.6, 7.0, 'cone', cols_ring(canopy, 8, 0.4, 0.6), z0=0.9),
             V(_sector(r * 0.44, 20, 160), 4.6, 5.0, 'flat', z0=0.9, over=0.3)]
    for i in range(5):
        parts.append(('platform', dict(poly=_sector(r * (0.60 + 0.08 * i), 195, 345),
                                       h=0.18 + 0.16 * i)))
    return parts


def playground(w, d):
    pav = Point(w * 0.30, 0.0).buffer(5.2, 32)
    return [
        ('platform', dict(poly=_stadium(w, d, r=d * 0.42))),
        CAN(pav, 3.4, 5.4, 'cone', cols_ring(pav, 8, 0.26, 0.5)),
        V(_box(4.4, 4.4, -w * 0.32, d * 0.10), 4.2, 6.2, 'cone', z0=3.0, over=0.5),
        V(_box(3.6, 3.6, -w * 0.10, -d * 0.16), 3.2, 4.8, 'cone', z0=2.2, over=0.5),
        ('column', dict(pts=[(-w * 0.32 + sx * 1.5, d * 0.10 + sy * 1.5, 0.2)
                             for sx in (-1, 1) for sy in (-1, 1)], h=3.0)),
        ('column', dict(pts=[(-w * 0.10 + sx * 1.2, -d * 0.16 + sy * 1.2, 0.18)
                             for sx in (-1, 1) for sy in (-1, 1)], h=2.2)),
        ('equip', dict(poly=_box(5.0, 0.3, -w * 0.02, d * 0.26), h=2.6)),
        ('equip', dict(poly=Point(w * 0.05, -d * 0.30).buffer(2.4, 20), h=0.35)),
    ]


def utility(w, d):
    core = _box(w * 0.82, d * 0.62)
    return [plinth(core, 0.4),
            V(core, 3.8, 6.8, 'gable', over=1.0),
            CAN(_box(w * 0.34, d * 0.20, 0.0, -d * 0.42), 3.4, 4.0, 'shed',
                cols_line(-w * 0.15, -d * 0.50, w * 0.15, -d * 0.50, 3, 0.22))]


def boiler(w, d):
    core = _box(w * 0.78, d * 0.60)
    return [plinth(core, 0.4),
            V(core, 4.2, 6.6, 'gable', over=0.8),
            ('chimney', dict(poly=Point(w * 0.28, d * 0.16).buffer(0.55, 12), h=13.0))]


def cottage(w, d):
    """Гостевой дом: сруб под двускатной кровлей с большим выносом,
    каменный цоколь, крытая терраса на колоннах."""
    core = _box(w * 0.74, d * 0.56)
    ver = _box(w * 0.52, d * 0.18, 0.0, -d * 0.36)
    return [
        plinth(core.union(ver), 0.7),
        V(core, 3.2, 7.4, 'gable', over=1.5),
        CAN(ver, 3.0, 4.2, 'shed', cols_line(-w * 0.24, -d * 0.43, w * 0.24, -d * 0.43,
                                             4, 0.28)),
        ('deck', dict(poly=_box(w * 0.58, d * 0.20, 0.0, -d * 0.36))),
        ('chimney', dict(poly=_box(0.9, 0.9, w * 0.22, d * 0.14), h=8.4)),
        ('tub', dict(poly=Point(-w * 0.28, -d * 0.48).buffer(1.1, 16), h=1.1)),
    ]


BUILDERS = {
    'kpp': kpp, 'admin': admin, 'restaurant': restaurant, 'hotel': hotel,
    'bath_petrovskaya': bath_petrovskaya, 'bath_log': bath_log,
    'bath_belaya': bath_belaya, 'bath_bochka': bath_bochka,
    'padel': padel, 'court': open_court, 'concert': concert,
    'playground': playground, 'utility': utility, 'boiler': boiler,
    'cottage': cottage,
}


def make(kind, w, d, angle_deg, cx, cy):
    parts = BUILDERS.get(kind, utility)(w, d)
    out = []
    a = math.radians(angle_deg)
    for t, spec in parts:
        s = dict(spec)
        if 'poly' in s:
            s['poly'] = translate(rotate(s['poly'], angle_deg, origin=(0, 0)), cx, cy)
        if s.get('cols'):
            s['cols'] = [_place(p, a, cx, cy) for p in s['cols']]
        if s.get('pts'):
            s['pts'] = [_place(p, a, cx, cy) for p in s['pts']]
        if t == 'barrel':
            x, y = s['cx'], s['cy']
            s['cx'] = cx + x * math.cos(a) - y * math.sin(a)
            s['cy'] = cy + x * math.sin(a) + y * math.cos(a)
            s['ang'] = s['ang'] + angle_deg
            s['poly'] = _barrel_poly(s)
        out.append((t, s))
    return out


def _barrel_poly(s):
    """След бочки на земле — для площади застройки и проверок."""
    return rotate(_box(s['length'], 2 * s['r'], s['cx'], s['cy']), s['ang'],
                  origin=(s['cx'], s['cy']))


def _place(p, a, cx, cy):
    return (cx + p[0] * math.cos(a) - p[1] * math.sin(a),
            cy + p[0] * math.sin(a) + p[1] * math.cos(a), p[2])
