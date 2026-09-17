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


def GLASS(poly, z0, h):
    return ('glass', dict(poly=poly, z0=z0, h=h))


def RAIL(line, h=1.05):
    return ('rail', dict(line=list(line), h=h))


def win_band(x0, x1, y, t=0.42, z0=1.0, h=1.7):
    """Ленточное остекление вдоль фасада."""
    return GLASS(box(min(x0, x1), y - t / 2.0, max(x0, x1), y + t / 2.0), z0, h)


def win_row(x0, x1, y, n, w=1.5, t=0.42, z0=1.0, h=1.6):
    """Ряд отдельных окон по фасаду."""
    out = []
    for i in range(n):
        cx = x0 + (x1 - x0) * (i + 0.5) / n
        out.append(GLASS(box(cx - w / 2, y - t / 2, cx + w / 2, y + t / 2), z0, h))
    return out


def door(cx, y, w=1.6, t=0.44, h=2.3):
    return GLASS(box(cx - w / 2, y - t / 2, cx + w / 2, y + t / 2), 0.1, h)


def plinth(poly, h=0.7):
    return ('plinth', dict(poly=poly.buffer(0.4), h=h))


def steps(w, y, d=1.6, n=3):
    """Крыльцо: ступени перед входом (сплошной объём, не висит)."""
    return ('platform', dict(poly=_box(w, d, 0.0, y - d / 2.0), h=0.35))


# --------------------------------------------------------------------- КПП --
def kpp(w, d):
    """Здание у парковки: каменные пилоны, дерево, односкатная кровля с большим
    выносом над крыльцом на двух стойках, витражи между пилонами."""
    core = _box(w * 0.86, d * 0.78)
    fy = -d * 0.39
    por = _box(w * 0.56, 2.6, -w * 0.02, fy - 1.3)
    return [
        plinth(core, 0.45),
        V(core, 3.4, 4.6, 'shed', over=1.6),
        CAN(por, 3.3, 3.9, 'shed',
            cols_line(-w * 0.26, fy - 2.4, w * 0.22, fy - 2.4, 3, 0.24), over=0.5),
        win_band(-w * 0.34, w * 0.10, fy + 0.1, z0=1.0, h=1.9),
        door(w * 0.24, fy + 0.1, 1.8),
        ('deck', dict(poly=por.buffer(0.3))),
        steps(3.4, fy - 2.6),
        ENT(w * 0.24, fy - 0.4),
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
        CAN(_box(w * 0.18, 3.4, 0.0, fy - 1.7), 3.7, 5.0, 'gable',
            cols_line(-w * 0.08, fy - 3.1, w * 0.08, fy - 3.1, 2, 0.32)),
        ('deck', dict(poly=_box(w * 0.24, 3.6, 0.0, fy - 1.8))),
        steps(w * 0.16, fy - 3.6),
        door(0.0, fy + 0.05, 2.2),
        *win_row(-w * 0.43, -w * 0.10, fy + 0.05, 4, 2.0, z0=0.9, h=2.1),
        *win_row(w * 0.10, w * 0.43, fy + 0.05, 4, 2.0, z0=0.9, h=2.1),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.32, d * 0.22), h=8.0)),
        ENT(0.0, fy),
    ]


# ------------------------------------------------------------- ресторан -----
def restaurant(w, d):
    """Одноэтажный зал с высокими потолками под изогнутой кровлей на пилонах,
    сплошное остекление между пилонами, входной блок с овальным навесом,
    терраса с ограждением и пруд (референс «ресторан»)."""
    hall = _box(w * 0.64, d * 0.48, w * 0.15, d * 0.06)
    entry = _box(w * 0.22, d * 0.34, -w * 0.28, d * 0.04)
    fy = d * 0.06 - d * 0.24
    pil = cols_line(w * 0.15 - w * 0.29, fy - 0.9, w * 0.15 + w * 0.29, fy - 0.9, 9, 0.42)
    return [
        V(hall, 6.6, 9.4, 'arch', over=2.6),
        V(entry, 5.2, 5.8, 'flat', over=0.9),
        ('column', dict(pts=pil, h=6.6)),
        win_band(w * 0.15 - w * 0.30, w * 0.15 + w * 0.30, fy + 0.15, t=0.26,
                 z0=0.6, h=5.2),
        win_band(-w * 0.37, -w * 0.19, -d * 0.12, t=0.44, z0=0.6, h=3.6),
        door(-w * 0.28, -d * 0.13, 2.4),
        CAN(_oval(w * 0.30, d * 0.22, -w * 0.28, -d * 0.22), 5.0, 5.4, 'flat',
            cols_line(-w * 0.39, -d * 0.27, -w * 0.17, -d * 0.27, 3, 0.34), over=0.5),
        ('deck', dict(poly=_box(w * 0.66, d * 0.15, w * 0.15, fy - 2.4))),
        RAIL([(w * 0.15 - w * 0.33, fy - 3.4), (w * 0.15 + w * 0.33, fy - 3.4)], 1.0),
        steps(w * 0.20, -d * 0.36),
        ('water', dict(poly=_oval(w * 0.50, d * 0.17, w * 0.12, -d * 0.52), rim=0.9)),
        ENT(-w * 0.28, -d * 0.20),
    ]


def hotel(w, d):
    """Двухэтажный корпус: длинное крыло с галереей-балконом на колоннах под
    изогнутой кровлей, сплошное остекление обоих этажей, поперечное крыло,
    входной блок со стеклянным козырьком (референс «отель»)."""
    bar = _box(w * 0.72, d * 0.34, -w * 0.10, d * 0.24)
    wing = _box(w * 0.28, d * 0.40, w * 0.28, -d * 0.14)
    fy = d * 0.24 - d * 0.17
    gal = _box(w * 0.72, 3.4, -w * 0.10, fy - 1.7)
    cols = cols_line(-w * 0.44, fy - 3.2, w * 0.24, fy - 3.2, 9, 0.30)
    return [
        V(bar, 7.6, 10.6, 'arch', over=1.7),
        V(wing, 7.4, 10.2, 'arch', over=1.6),
        CAN(gal, 3.9, 4.15, 'flat', cols, over=0.35),          # галерея-балкон
        RAIL([(-w * 0.44, fy - 3.3), (w * 0.24, fy - 3.3)], 1.05),
        win_band(-w * 0.44, w * 0.24, fy + 0.12, t=0.46, z0=0.7, h=2.9),
        win_band(-w * 0.44, w * 0.24, fy + 0.12, t=0.46, z0=4.4, h=2.6),
        win_band(w * 0.16, w * 0.40, -d * 0.32, t=0.44, z0=0.7, h=2.9),
        door(w * 0.28, -d * 0.33, 2.6),
        CAN(_box(w * 0.20, 4.2, w * 0.28, -d * 0.42), 4.4, 4.6, 'flat',
            cols_line(w * 0.19, -d * 0.50, w * 0.37, -d * 0.50, 3, 0.26), over=0.4),
        ('deck', dict(poly=_box(w * 0.72, d * 0.12, -w * 0.10, fy - 3.6))),
        steps(w * 0.16, -d * 0.46),
        ('chimney', dict(poly=_box(1.2, 1.2, -w * 0.34, d * 0.36), h=12.8)),
        ENT(w * 0.28, -d * 0.38),
    ]


def bath_petrovskaya(w, d):
    """Бревенчатый сруб: Г-образный план, сложная вальмовая кровля, крытая
    веранда на бревенчатых колоннах с балюстрадой, каменный цоколь,
    окна с обвязкой, две каменные трубы (референс «Петровская»)."""
    main = _box(w * 0.58, d * 0.46, -w * 0.14, d * 0.14)
    wing = _box(w * 0.34, d * 0.40, w * 0.25, -d * 0.02)
    fy = -d * 0.22
    ver = _box(w * 0.48, d * 0.17, -w * 0.11, fy - d * 0.09)
    core = main.union(wing)
    return [
        plinth(core.union(ver), 1.0),
        V(main, 3.7, 8.2, 'hip', over=1.4),
        V(wing, 3.7, 7.6, 'gable', over=1.5),
        CAN(ver, 3.9, 5.2, 'shed',
            cols_line(-w * 0.33, fy - d * 0.16, w * 0.11, fy - d * 0.16, 6, 0.34),
            z0=1.0, over=0.7),
        RAIL([(-w * 0.34, fy - d * 0.17), (w * 0.12, fy - d * 0.17)], 1.0),
        *win_row(-w * 0.40, w * 0.02, fy + 0.15, 4, 1.4, z0=1.1, h=1.5),
        *win_row(w * 0.12, w * 0.38, -d * 0.22, 2, 1.4, z0=1.1, h=1.5),
        door(-w * 0.11, fy + 0.15, 1.8),
        ('deck', dict(poly=ver.buffer(0.45))),
        steps(4.4, fy - d * 0.18),
        ('chimney', dict(poly=_box(1.4, 1.4, -w * 0.28, d * 0.26), h=9.4)),
        ('chimney', dict(poly=_box(1.1, 1.1, w * 0.25, d * 0.12), h=8.6)),
        ('water', dict(poly=Point(w * 0.10, d * 0.52).buffer(4.2, 32), rim=0.8)),
        ('tub', dict(poly=Point(-w * 0.30, d * 0.44).buffer(1.15, 16), h=1.2)),
        ('deck', dict(poly=_box(w * 0.52, d * 0.20, 0.0, d * 0.46))),
        ENT(-w * 0.11, fy),
    ]


def bath_log(w, d):
    """Рыбацкая и Охотничья — один типовой дом: брусовой объём под двускатной
    кровлей, крытая веранда на колоннах с ограждением, входной блок с
    фронтоном, каменный цоколь, панорамные окна, две трубы (референс)."""
    core = _box(w * 0.68, d * 0.46, w * 0.09, d * 0.10)
    entry = _box(w * 0.22, d * 0.34, -w * 0.32, -d * 0.02)
    fy = d * 0.10 - d * 0.23
    ver = _box(w * 0.60, d * 0.17, w * 0.09, fy - d * 0.09)
    return [
        plinth(core.union(entry).union(ver), 0.65),
        V(core, 3.3, 6.9, 'gable', over=1.5),
        V(entry, 3.1, 5.9, 'gable', over=1.3),
        CAN(ver, 3.6, 4.8, 'shed',
            cols_line(w * 0.09 - w * 0.27, fy - d * 0.16,
                      w * 0.09 + w * 0.27, fy - d * 0.16, 6, 0.28), z0=0.65, over=0.6),
        RAIL([(w * 0.09 - w * 0.28, fy - d * 0.17),
              (w * 0.09 + w * 0.28, fy - d * 0.17)], 1.0),
        *win_row(w * 0.09 - w * 0.26, w * 0.09 + w * 0.26, fy + 0.12, 4, 1.8,
                 z0=0.9, h=1.8),
        win_band(-w * 0.41, -w * 0.23, -d * 0.18, t=0.42, z0=0.9, h=2.0),
        door(-w * 0.32, -d * 0.19, 1.8),
        ('deck', dict(poly=ver.buffer(0.4))),
        steps(3.6, fy - d * 0.18),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.04, d * 0.26), h=7.9)),
        ('chimney', dict(poly=_box(0.9, 0.9, w * 0.26, d * 0.26), h=7.7)),
        ('tub', dict(poly=Point(w * 0.26, d * 0.42).buffer(1.2, 16), h=1.2)),
        ('deck', dict(poly=_box(w * 0.46, d * 0.18, w * 0.10, d * 0.42))),
        ENT(-w * 0.32, -d * 0.19),
    ]


def bath_belaya(w, d):
    """Сруб из бревна под двускатной кровлей с большим выносом, каменный
    цоколь, крыльцо-терраса под свесом на четырёх стойках (референс)."""
    core = _box(w * 0.78, d * 0.60)
    fy = -d * 0.30
    por = _box(w * 0.70, 2.8, 0.0, fy - 1.4)
    return [
        plinth(core.union(por), 0.75),
        V(core, 3.2, 6.8, 'gable', over=2.0),
        CAN(por, 3.5, 3.9, 'shed',
            cols_line(-w * 0.31, fy - 2.6, w * 0.31, fy - 2.6, 4, 0.26), z0=0.75, over=0.4),
        RAIL([(-w * 0.32, fy - 2.7), (w * 0.32, fy - 2.7)], 1.0),
        *win_row(-w * 0.32, w * 0.32, fy + 0.12, 3, 1.5, z0=1.0, h=1.5),
        door(-w * 0.16, fy + 0.12, 1.7),
        ('deck', dict(poly=por.buffer(0.3))),
        steps(3.0, fy - 2.8),
        ('chimney', dict(poly=_box(1.0, 1.0, w * 0.22, d * 0.24), h=7.6)),
        ('tub', dict(poly=Point(-w * 0.24, d * 0.44).buffer(1.15, 16), h=1.2)),
        ('deck', dict(poly=_box(w * 0.44, d * 0.18, 0.0, d * 0.44))),
        ENT(-w * 0.16, fy),
    ]


def bath_bochka(w, d):
    """Объём под вальмовой кровлей, две ВЕРТИКАЛЬНЫЕ бочки-парные по торцам,
    крытая терраса на колоннах с ограждением, крыльцо; купель вынесена на
    приватную сторону, к лесу (референс «Бочка»)."""
    core = _box(w * 0.54, d * 0.52)
    r = min(d * 0.20, w * 0.16)
    fy = -d * 0.26
    ver = _box(w * 0.54, d * 0.16, 0.0, fy - d * 0.09)
    b1 = Point(-w * 0.36, d * 0.04).buffer(r, 28)
    b2 = Point(w * 0.36, d * 0.04).buffer(r * 0.92, 28)
    return [
        plinth(core.union(b1).union(b2), 0.55),
        V(core, 3.5, 6.0, 'hip', over=1.3),
        V(b1, 6.2, 7.8, 'dome', over=0.25),
        V(b2, 5.6, 7.0, 'dome', over=0.25),
        CAN(ver, 3.7, 4.1, 'shed',
            cols_line(-w * 0.24, fy - d * 0.16, w * 0.24, fy - d * 0.16, 5, 0.28),
            z0=0.55, over=0.5),
        RAIL([(-w * 0.25, fy - d * 0.17), (w * 0.25, fy - d * 0.17)], 1.0),
        *win_row(-w * 0.20, w * 0.20, fy + 0.10, 2, 1.6, z0=1.0, h=1.7),
        door(0.0, fy + 0.10, 2.0),
        ('deck', dict(poly=ver.buffer(0.35))),
        steps(3.4, fy - d * 0.18),
        ('tub', dict(poly=Point(0.0, d * 0.40).buffer(1.7, 20), h=1.3)),
        ('deck', dict(poly=_box(w * 0.40, d * 0.16, 0.0, d * 0.38))),
        ENT(0.0, fy),
    ]

def padel(w, d):
    """Крытый падл-центр: корт 20x10 с обходами, изогнутая кровля,
    витражный фасад, входной настил со ступенями."""
    hall = _stadium(w * 0.92, d * 0.86, r=d * 0.20)
    fy = -d * 0.43
    return [
        V(hall, 7.0, 9.4, 'arch', over=1.8),
        ('court', dict(poly=_box(20.0, 10.0))),
        win_band(-w * 0.33, w * 0.33, fy + 1.4, t=0.46, z0=0.8, h=5.0),
        door(0.0, fy + 1.3, 2.6),
        ('deck', dict(poly=_box(w * 0.34, 4.0, 0.0, fy - 1.6))),
        steps(4.0, fy - 3.6),
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
    """Гостевой дом 300 м²: сруб под двускатной кровлей с большим выносом,
    каменный цоколь, крытая терраса на колоннах с ограждением, входной блок,
    панорамные окна, труба и купель."""
    core = _box(w * 0.70, d * 0.56, -w * 0.05, d * 0.08)
    entry = _box(w * 0.20, d * 0.26, w * 0.33, -d * 0.06)
    fy = d * 0.08 - d * 0.28
    ver = _box(w * 0.54, d * 0.18, -w * 0.07, fy - d * 0.10)
    return [
        plinth(core.union(entry).union(ver), 0.65),
        V(core, 3.2, 7.2, 'gable', over=1.6),
        V(entry, 3.0, 5.8, 'gable', over=1.2),
        CAN(ver, 3.5, 4.6, 'shed',
            cols_line(-w * 0.30, fy - d * 0.18, w * 0.16, fy - d * 0.18, 5, 0.26),
            z0=0.65, over=0.5),
        RAIL([(-w * 0.31, fy - d * 0.19), (w * 0.17, fy - d * 0.19)], 1.0),
        *win_row(-w * 0.30, w * 0.14, fy + 0.12, 3, 1.8, z0=0.9, h=1.8),
        win_band(w * 0.24, w * 0.42, -d * 0.19, t=0.42, z0=0.9, h=2.0),
        door(w * 0.33, -d * 0.20, 1.8),
        ('deck', dict(poly=ver.buffer(0.35))),
        steps(3.2, fy - d * 0.19),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.18, d * 0.26), h=8.4)),
        ('tub', dict(poly=Point(-w * 0.28, d * 0.42).buffer(1.1, 16), h=1.1)),
        ('deck', dict(poly=_box(w * 0.40, d * 0.16, -w * 0.20, d * 0.42))),
        ENT(w * 0.33, -d * 0.19),
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
