# -*- coding: utf-8 -*-
"""Объёмно-планировочные решения объектов по присланным визуализациям.

Локальные координаты: центр в начале, ось X — вдоль длинной стороны,
сторона -Y — ГЛАВНЫЙ ФАСАД (вход). Поворот объекта на площадке задаётся
полем rot: 0 — вход на юг, 90 — на восток, 180 — на север, 270 — на запад.

Части:
  volume — объём (poly, wall, roof, ridge, z0, over)
  canopy — навес/веранда на колоннах          column — стойки
  barrel — лежачая бочка                      chimney — труба
  plinth — каменный цоколь                    deck — терраса, настил
  platform — площадка   water — бассейн   tub — купель
  court — корт          equip — оборудование  entrance — точка главного входа
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


def CAN(poly, wall, ridge, roof='shed', cols=(), z0=0.0, over=0.6):
    return ('canopy', dict(poly=poly, wall=wall, ridge=ridge, roof=roof, z0=z0,
                           over=over, cols=list(cols)))


def ENT(x, y):
    return ('entrance', dict(pt=(x, y)))


def cols_line(x0, y0, x1, y1, n, r=0.3, h=None):
    n = max(n, 2)
    return [(x0 + (x1 - x0) * i / (n - 1.0), y0 + (y1 - y0) * i / (n - 1.0), r)
            for i in range(n)]


def cols_ring(poly, n, r=0.3, inset=0.5):
    ring = poly.buffer(-inset).exterior if poly.buffer(-inset).area > 1 else poly.exterior
    L = ring.length
    return [(ring.interpolate(L * i / n).x, ring.interpolate(L * i / n).y, r)
            for i in range(n)]


def plinth(poly, h=0.7):
    return ('plinth', dict(poly=poly.buffer(0.4), h=h))


def steps(w, y, d=1.6, n=3):
    """Крыльцо: ступени перед входом (сплошной объём, не висит)."""
    return ('platform', dict(poly=_box(w, d, 0.0, y - d / 2.0), h=0.35))


# --------------------------------------------------------------------- КПП --
def kpp(w, d):
    """Здание у парковки: камень и дерево, односкатная кровля с выносом,
    крытое крыльцо на двух стойках (стр. «КПП у парковки»)."""
    core = _box(w * 0.86, d * 0.78)
    fy = -d * 0.39
    return [
        plinth(core, 0.45),
        V(core, 3.4, 4.5, 'shed', over=1.5),
        ('column', dict(pts=[(-w * 0.20, fy - 1.1, 0.26), (w * 0.14, fy - 1.1, 0.26)],
                        h=3.3)),
        ('deck', dict(poly=_box(w * 0.60, 2.4, -w * 0.03, fy - 1.2))),
        steps(3.4, fy - 2.4),
        ENT(-w * 0.03, fy),
    ]


# ------------------------------------------------------- административное ---
def admin(w, d):
    """Одноэтажный корпус: каменный цоколь, вальмовая кровля,
    центральный вход с навесом (стр. «административное здание»)."""
    core = _box(w * 0.90, d * 0.80)
    fy = -d * 0.40
    return [
        plinth(core, 0.85),
        V(core, 3.9, 7.0, 'hip', over=1.1),
        CAN(_box(w * 0.16, 3.2, 0.0, fy - 1.6), 3.7, 4.8, 'gable',
            cols_line(-w * 0.07, fy - 2.9, w * 0.07, fy - 2.9, 2, 0.30)),
        ('deck', dict(poly=_box(w * 0.22, 3.4, 0.0, fy - 1.7))),
        steps(w * 0.16, fy - 3.4),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.32, d * 0.22), h=8.0)),
        ENT(0.0, fy),
    ]


# ------------------------------------------------------------- ресторан -----
def restaurant(w, d):
    """Одноэтажный зал с высокими потолками под изогнутой кровлей на пилонах,
    входной блок с овальным навесом, терраса и пруд (стр. «ресторан»)."""
    hall = _box(w * 0.66, d * 0.50, w * 0.14, d * 0.04)
    entry = _box(w * 0.22, d * 0.34, -w * 0.30, d * 0.02)
    fy = d * 0.04 - d * 0.25
    return [
        V(hall, 6.6, 9.2, 'arch', over=2.6),
        V(entry, 5.2, 5.8, 'flat', over=0.8),
        ('column', dict(pts=cols_line(w * 0.14 - w * 0.29, fy - 0.6,
                                      w * 0.14 + w * 0.29, fy - 0.6, 9, 0.45), h=6.6)),
        CAN(_oval(w * 0.30, d * 0.22, -w * 0.30, -d * 0.22), 5.0, 5.4, 'flat',
            cols_line(-w * 0.41, -d * 0.26, -w * 0.19, -d * 0.26, 3, 0.36)),
        ('deck', dict(poly=_box(w * 0.68, d * 0.16, w * 0.14, fy - 2.6))),
        steps(w * 0.22, -d * 0.36),
        ('water', dict(poly=_oval(w * 0.52, d * 0.18, w * 0.10, -d * 0.52), rim=0.9)),
        ENT(-w * 0.30, -d * 0.19),
    ]


# --------------------------------------------------------------- гостиница --
def hotel(w, d):
    """Двухэтажный корпус: длинное крыло с галереей под изогнутой кровлей,
    вход с козырьком в стыке крыльев, терраса (стр. «отель»)."""
    bar = _box(w * 0.78, d * 0.40, -w * 0.06, d * 0.22)
    wing = _box(w * 0.30, d * 0.44, w * 0.28, -d * 0.18)
    fy = d * 0.02
    return [
        V(bar, 7.6, 10.4, 'arch', over=1.9),
        V(wing, 7.4, 10.0, 'arch', over=1.7),
        ('column', dict(pts=cols_line(-w * 0.42, fy - 0.4, w * 0.10, fy - 0.4, 8, 0.34),
                        h=7.4)),
        CAN(_box(w * 0.18, 4.4, w * 0.10, -d * 0.44), 4.4, 4.8, 'flat',
            cols_line(w * 0.02, -d * 0.50, w * 0.18, -d * 0.50, 3, 0.40)),
        ('deck', dict(poly=_box(w * 0.74, d * 0.12, -w * 0.06, fy - 2.6))),
        steps(w * 0.16, -d * 0.46),
        ('chimney', dict(poly=_box(1.2, 1.2, -w * 0.36, d * 0.38), h=12.6)),
        ENT(w * 0.10, -d * 0.40),
    ]


# ------------------------------------------------------------------ бани ----
def bath_petrovskaya(w, d):
    """Бревенчатый сруб: Г-образный план, сложная вальмовая кровля,
    крытая веранда на бревенчатых колоннах, каменный цоколь (референс)."""
    main = _box(w * 0.60, d * 0.46, -w * 0.13, d * 0.14)
    wing = _box(w * 0.34, d * 0.40, w * 0.26, -d * 0.02)
    fy = -d * 0.22
    ver = _box(w * 0.50, d * 0.16, -w * 0.10, fy - d * 0.08)
    core = main.union(wing)
    return [
        plinth(core.union(ver), 1.0),
        V(main, 3.7, 8.0, 'hip', over=1.3),
        V(wing, 3.7, 7.4, 'gable', over=1.4),
        CAN(ver, 3.5, 4.6, 'shed',
            cols_line(-w * 0.33, fy - d * 0.15, w * 0.13, fy - d * 0.15, 5, 0.32)),
        ('deck', dict(poly=ver.buffer(0.4))),
        steps(4.2, fy - d * 0.17),
        ('chimney', dict(poly=_box(1.4, 1.4, -w * 0.26, d * 0.26), h=9.2)),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.26, d * 0.10), h=8.4)),
        ('water', dict(poly=Point(w * 0.10, -d * 0.52).buffer(4.2, 32), rim=0.8)),
        ('tub', dict(poly=Point(-w * 0.34, -d * 0.44).buffer(1.15, 16), h=1.2)),
        ENT(-w * 0.10, fy),
    ]


def bath_log(w, d):
    """Рыбацкая и Охотничья — один типовой дом: брусовой объём под двускатной
    кровлей с большим выносом над крытой верандой, входной блок с фронтоном,
    каменный цоколь, три трубы (референс)."""
    core = _box(w * 0.70, d * 0.46, w * 0.08, d * 0.10)
    entry = _box(w * 0.22, d * 0.34, -w * 0.33, -d * 0.02)
    fy = d * 0.10 - d * 0.23
    ver = _box(w * 0.62, d * 0.16, w * 0.08, fy - d * 0.08)
    return [
        plinth(core.union(entry).union(ver), 0.65),
        V(core, 3.3, 6.8, 'gable', over=1.4),
        V(entry, 3.1, 5.8, 'gable', over=1.2),
        CAN(ver, 3.2, 4.2, 'shed',
            cols_line(w * 0.08 - w * 0.28, fy - d * 0.15,
                      w * 0.08 + w * 0.28, fy - d * 0.15, 6, 0.28)),
        ('deck', dict(poly=ver.buffer(0.35))),
        steps(3.6, fy - d * 0.16),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.06, d * 0.26), h=7.8)),
        ('chimney', dict(poly=_box(0.9, 0.9, w * 0.26, d * 0.26), h=7.6)),
        ('tub', dict(poly=Point(w * 0.36, -d * 0.40).buffer(1.2, 16), h=1.2)),
        ENT(-w * 0.33, -d * 0.19),
    ]


def bath_belaya(w, d):
    """Сруб из бревна под двускатной кровлей с большим выносом,
    каменный цоколь, крыльцо-терраса под свесом (референс)."""
    core = _box(w * 0.80, d * 0.62)
    fy = -d * 0.31
    return [
        plinth(core, 0.75),
        V(core, 3.2, 6.6, 'gable', over=1.9),
        ('column', dict(pts=cols_line(-w * 0.30, fy - 1.5, w * 0.30, fy - 1.5, 4, 0.26),
                        h=3.1)),
        ('deck', dict(poly=_box(w * 0.80, 3.0, 0.0, fy - 1.5))),
        steps(3.2, fy - 3.0),
        ('chimney', dict(poly=_box(1.0, 1.0, w * 0.22, d * 0.24), h=7.4)),
        ('tub', dict(poly=Point(-w * 0.36, -d * 0.46).buffer(1.15, 16), h=1.2)),
        ENT(0.0, fy),
    ]


def bath_bochka(w, d):
    """Объём под вальмовой кровлей, две ЛЕЖАЧИЕ бочки по торцам (ось поперёк
    фасада), терраса на колоннах и крыльцо со ступенями (3D-модель заказчика)."""
    core = _box(w * 0.56, d * 0.56)
    r = d * 0.20
    blen = d * 0.62
    fy = -d * 0.28
    return [
        plinth(core, 0.55),
        V(core, 3.5, 5.8, 'hip', over=1.2),
        ('barrel', dict(cx=-w * 0.34, cy=0.0, r=r, length=blen, ang=90.0, z0=0.0)),
        ('barrel', dict(cx=w * 0.34, cy=0.0, r=r, length=blen, ang=90.0, z0=0.0)),
        ('column', dict(pts=cols_line(-w * 0.24, fy - 1.6, w * 0.24, fy - 1.6, 5, 0.28),
                        h=3.4)),
        ('deck', dict(poly=_box(w * 0.62, 3.2, 0.0, fy - 1.6))),
        steps(3.6, fy - 3.2),
        ('tub', dict(poly=Point(0.0, fy - 5.0).buffer(1.6, 20), h=1.3)),
        ENT(0.0, fy),
    ]


# ---------------------------------------------------------------- спорт -----
def padel(w, d):
    """Крытый падл-центр: корт 20x10 с обходами, изогнутая кровля,
    входной настил со ступенями."""
    hall = _stadium(w * 0.92, d * 0.86, r=d * 0.20)
    fy = -d * 0.43
    return [
        V(hall, 7.0, 9.2, 'arch', over=1.8),
        ('court', dict(poly=_box(20.0, 10.0))),
        ('deck', dict(poly=_box(w * 0.34, 4.0, 0.0, fy - 2.0))),
        steps(4.0, fy - 4.0),
        ENT(0.0, fy),
    ]


def open_court(w, d):
    """Открытый падл-корт: игровое поле 20x10 м в ограждении 4 м."""
    fence = [('equip', dict(poly=_box(w, d).exterior.buffer(0.12), h=4.0))]
    return [('court', dict(poly=_box(w, d))),
            ('equip', dict(poly=_box(0.25, d * 0.92), h=1.0))] + fence + [ENT(0.0, -d / 2)]


def concert(w, d):
    """Сцена под шатровым навесом на колоннах и амфитеатр со ступенями."""
    r = min(w, d) / 2.0
    stage = Point(0, 0).buffer(r * 0.40, 40)
    canopy = Point(0, 0).buffer(r * 0.48, 40)
    parts = [('platform', dict(poly=stage, h=0.9)),
             ('column', dict(pts=cols_ring(canopy, 10, 0.34, 0.5), h=6.0)),
             CAN(canopy, 6.0, 10.5, 'cone', (), z0=0.9, over=0.5)]
    for i in range(4):
        parts.append(('platform', dict(poly=_sector(r * (0.58 + 0.105 * i), 200, 340),
                                       h=0.20 + 0.18 * i)))
    parts.append(ENT(0.0, -r * 0.92))
    return parts


def playground(w, d):
    """Детская площадка: покрытие, павильон, две башни на опорах, качели."""
    pav = Point(w * 0.30, 0.0).buffer(4.8, 32)
    return [
        ('platform', dict(poly=_stadium(w, d, r=d * 0.42))),
        CAN(pav, 3.4, 5.2, 'cone', cols_ring(pav, 8, 0.24, 0.45), over=0.4),
        V(_box(4.2, 4.2, -w * 0.30, d * 0.12), 4.2, 6.0, 'cone', z0=2.8, over=0.4),
        V(_box(3.4, 3.4, -w * 0.08, -d * 0.14), 3.2, 4.6, 'cone', z0=2.1, over=0.4),
        ('column', dict(pts=[(-w * 0.30 + sx * 1.5, d * 0.12 + sy * 1.5, 0.22)
                             for sx in (-1, 1) for sy in (-1, 1)], h=2.9)),
        ('column', dict(pts=[(-w * 0.08 + sx * 1.2, -d * 0.14 + sy * 1.2, 0.2)
                             for sx in (-1, 1) for sy in (-1, 1)], h=2.2)),
        ('equip', dict(poly=_box(4.6, 0.3, w * 0.02, d * 0.28), h=2.6)),
        ('equip', dict(poly=Point(w * 0.06, -d * 0.30).buffer(2.2, 20), h=0.35)),
        ENT(0.0, -d * 0.50),
    ]


# ------------------------------------------------------------ хозяйственные --
def utility(w, d):
    core = _box(w * 0.86, d * 0.70)
    fy = -d * 0.35
    return [plinth(core, 0.4),
            V(core, 3.9, 6.8, 'gable', over=0.9),
            CAN(_box(w * 0.36, 3.4, 0.0, fy - 1.7), 3.5, 4.0, 'shed',
                cols_line(-w * 0.16, fy - 3.2, w * 0.16, fy - 3.2, 3, 0.22)),
            ('platform', dict(poly=_box(w * 0.86, 5.0, 0.0, fy - 2.5), h=0.15)),
            ENT(0.0, fy)]


def boiler(w, d):
    core = _box(w * 0.80, d * 0.66)
    return [plinth(core, 0.4),
            V(core, 4.2, 6.6, 'gable', over=0.8),
            ('chimney', dict(poly=Point(w * 0.28, d * 0.20).buffer(0.55, 12), h=13.0)),
            ENT(0.0, -d * 0.33)]


def cottage(w, d):
    """Гостевой дом: сруб под двускатной кровлей с большим выносом,
    каменный цоколь, крытая терраса на колоннах, входной блок, купель."""
    core = _box(w * 0.72, d * 0.56, -w * 0.04, d * 0.08)
    entry = _box(w * 0.20, d * 0.26, w * 0.34, -d * 0.06)
    fy = d * 0.08 - d * 0.28
    ver = _box(w * 0.56, d * 0.18, -w * 0.06, fy - d * 0.09)
    return [
        plinth(core.union(entry).union(ver), 0.65),
        V(core, 3.2, 7.0, 'gable', over=1.5),
        V(entry, 3.0, 5.6, 'gable', over=1.1),
        CAN(ver, 3.1, 4.0, 'shed',
            cols_line(-w * 0.30, fy - d * 0.17, w * 0.18, fy - d * 0.17, 5, 0.26)),
        ('deck', dict(poly=ver.buffer(0.3))),
        steps(3.2, fy - d * 0.18),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.20, d * 0.26), h=8.2)),
        ('tub', dict(poly=Point(w * 0.36, -d * 0.40).buffer(1.1, 16), h=1.1)),
        ENT(w * 0.34, -d * 0.19),
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
        if t == 'entrance':
            p = s['pt']
            s['pt'] = (cx + p[0] * math.cos(a) - p[1] * math.sin(a),
                       cy + p[0] * math.sin(a) + p[1] * math.cos(a))
        if t == 'barrel':
            x, y = s['cx'], s['cy']
            s['cx'] = cx + x * math.cos(a) - y * math.sin(a)
            s['cy'] = cy + x * math.sin(a) + y * math.cos(a)
            s['ang'] = s['ang'] + angle_deg
            s['poly'] = rotate(_box(s['length'], 2 * s['r'], s['cx'], s['cy']),
                               s['ang'], origin=(s['cx'], s['cy']))
        out.append((t, s))
    return out


def _place(p, a, cx, cy):
    return (cx + p[0] * math.cos(a) - p[1] * math.sin(a),
            cy + p[0] * math.sin(a) + p[1] * math.cos(a), p[2])
