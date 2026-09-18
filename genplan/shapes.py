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


def tub_on_base(cx, cy, r, h=1.2):
    """Чан на круглом основании — стоит на земле, а не висит."""
    return [('plinth', dict(poly=Point(cx, cy).buffer(r + 0.45, 20), h=0.25)),
            ('tub', dict(poly=Point(cx, cy).buffer(r, 18), h=h, z0=0.25))]


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
    """Одноэтажный зал с высокими потолками, прямоугольный в плане, плоская
    кровля с ровным выносом на пилонах, сплошное остекление главного фасада,
    тёмный верхний объём-вставка, терраса и пруд (референс)."""
    hall = _stadium(w * 0.92, d * 0.62, r=d * 0.12)
    hall = translate(hall, 0.0, d * 0.08)
    upper = _box(w * 0.30, d * 0.22, -w * 0.18, d * 0.16)
    fy = d * 0.08 - d * 0.31
    pil = cols_line(-w * 0.42, fy - 0.8, w * 0.42, fy - 0.8, 11, 0.40)
    return [
        V(hall, 6.6, 7.0, 'flat', over=2.2),
        V(upper, 8.6, 9.0, 'flat', over=0.5),
        ('column', dict(pts=pil, h=6.6)),
        win_band(-w * 0.43, w * 0.43, fy + 0.15, z0=0.5, h=5.4),
        GLASS(_box(w * 0.14, 0.3, -w * 0.30, fy + 0.10), 3.4, 0.9),
        door(w * 0.06, fy + 0.12, 2.6),
        ('deck', dict(poly=_box(w * 0.92, d * 0.14, 0.0, fy - 2.2))),
        steps(w * 0.20, fy - 4.2),
        ('water', dict(poly=_oval(w * 0.56, d * 0.16, 0.0, d * 0.52), rim=0.9)),
        ENT(w * 0.06, fy),
    ]

def hotel(w, d):
    """Двухэтажный корпус с ПЛОСКИМИ разноуровневыми кровлями и парапетами,
    сплошное остекление обоих этажей, галерея-балкон на колоннах, поперечное
    крыло ниже основного, входной блок со стеклянным козырьком (референс)."""
    bar = _stadium(w * 0.84, d * 0.42, r=d * 0.10)
    bar = translate(bar, -w * 0.06, d * 0.26)
    wing = _stadium(w * 0.34, d * 0.46, r=d * 0.09)
    wing = translate(wing, w * 0.30, -d * 0.16)
    core = _box(w * 0.26, d * 0.24, w * 0.02, d * 0.14)      # верхний объём
    fy = d * 0.24 - d * 0.17
    gal = _box(w * 0.72, 3.4, -w * 0.10, fy - 1.7)
    cols = cols_line(-w * 0.44, fy - 3.2, w * 0.24, fy - 3.2, 9, 0.30)
    return [
        V(bar, 7.6, 8.1, 'flat', over=0.9),
        V(wing, 4.4, 4.9, 'flat', over=0.9),
        V(core, 10.4, 10.9, 'flat', over=0.7),               # третий уровень
        CAN(gal, 3.9, 4.15, 'flat', cols, over=0.35),
        RAIL([(-w * 0.44, fy - 3.3), (w * 0.24, fy - 3.3)], 1.05),
        RAIL([(w * 0.16, -d * 0.34), (w * 0.40, -d * 0.34)], 1.05),   # кровля крыла
        win_band(-w * 0.44, w * 0.24, fy + 0.12, z0=0.7, h=2.9),
        win_band(-w * 0.44, w * 0.24, fy + 0.12, z0=4.4, h=2.6),
        win_band(w * 0.16, w * 0.40, -d * 0.32, z0=0.7, h=2.9),
        door(w * 0.28, -d * 0.33, 2.6),
        CAN(_box(w * 0.20, 4.2, w * 0.28, -d * 0.42), 4.4, 4.6, 'flat',
            cols_line(w * 0.19, -d * 0.50, w * 0.37, -d * 0.50, 3, 0.26), over=0.4),
        ('deck', dict(poly=_box(w * 0.72, d * 0.12, -w * 0.10, fy - 3.6))),
        steps(w * 0.16, -d * 0.46),
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
        *tub_on_base(-w * 0.30, d * 0.44, 1.15),
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
        *tub_on_base(w * 0.26, d * 0.42, 1.2),
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
        *tub_on_base(-w * 0.24, d * 0.44, 1.15),
        ('deck', dict(poly=_box(w * 0.44, d * 0.18, 0.0, d * 0.44))),
        ENT(-w * 0.16, fy),
    ]


def bath_bochka(w, d):
    """По 3D-модели заказчика: объём под вальмовой кровлей с широким свесом,
    две ВЕРТИКАЛЬНЫЕ бочки на круглых бетонных основаниях по передним углам,
    крытая веранда вдоль фасада на тонких стойках с ограждением, крыльцо."""
    core = _box(w * 0.56, d * 0.54)
    r = min(d * 0.19, w * 0.155)
    fy = -d * 0.27
    ver = _box(w * 0.56, d * 0.17, 0.0, fy - d * 0.09)
    b1 = Point(-w * 0.34, -d * 0.16).buffer(r, 28)
    b2 = Point(w * 0.34, -d * 0.16).buffer(r * 0.95, 28)
    return [
        plinth(core, 0.5),
        ('plinth', dict(poly=b1.buffer(0.35), h=0.55)),
        ('plinth', dict(poly=b2.buffer(0.35), h=0.55)),
        V(core, 3.6, 5.4, 'hip', over=1.6),
        V(b1, 5.6, 6.6, 'dome', z0=0.55, over=0.18),
        V(b2, 5.2, 6.1, 'dome', z0=0.55, over=0.18),
        CAN(ver, 3.6, 3.9, 'shed',
            cols_line(-w * 0.24, fy - d * 0.17, w * 0.24, fy - d * 0.17, 6, 0.18),
            z0=0.5, over=0.4),
        RAIL([(-w * 0.25, fy - d * 0.18), (w * 0.25, fy - d * 0.18)], 1.0),
        *win_row(-w * 0.20, w * 0.20, fy + 0.10, 2, 1.6, z0=1.0, h=1.7),
        door(0.0, fy + 0.10, 2.0),
        ('deck', dict(poly=ver.buffer(0.35))),
        steps(3.4, fy - d * 0.19),
        steps(2.4, fy - d * 0.19),
        *tub_on_base(0.0, d * 0.40, 1.7),
        ('deck', dict(poly=_box(w * 0.40, d * 0.16, 0.0, d * 0.38))),
        ENT(0.0, fy),
    ]

def padel(w, d):
    """Крытый падел-центр по референсу: корт 20x10 под изогнутой кровлей с
    озеленённым карнизом, сплошное остекление в ритме деревянных колонн,
    глухая реечная стена с логотипом в торце, широкий настил со ступенями."""
    hall = _stadium(w * 0.96, d * 0.92, r=d * 0.22)
    fy = -d * 0.43
    cols = cols_line(-w * 0.42, fy + 0.6, w * 0.42, fy + 0.6, 10, 0.34)
    return [
        V(hall, 7.0, 9.4, 'arch', over=2.2),
        ('court', dict(poly=_box(20.0, 10.0))),
        ('column', dict(pts=cols, h=7.0)),
        win_band(-w * 0.42, w * 0.42, fy + 0.6, z0=0.5, h=6.0),
        V(_box(1.2, d * 0.62, -w * 0.46, 0.0), 6.6, 7.0, 'flat', over=0.2),
        ('equip', dict(poly=_box(0.5, d * 0.70, w * 0.46, 0.0), h=6.4)),
        door(w * 0.10, fy + 0.5, 2.8),
        ('deck', dict(poly=_box(w * 0.86, 5.2, 0.0, fy - 2.6))),
        steps(w * 0.30, fy - 5.2),
        ENT(w * 0.10, fy),
    ]

def open_court(w, d):
    """Открытый падл-корт: игровое поле 20x10 м в ограждении 4 м."""
    fence = [('equip', dict(poly=_box(w, d).exterior.buffer(0.12), h=4.0))]
    return [('court', dict(poly=_box(w, d))),
            ('equip', dict(poly=_box(0.25, d * 0.92), h=1.0))] + fence + [ENT(0.0, -d / 2)]


def concert(w, d):
    """Концертная площадка по референсу: круглый плоский навес на массивных
    деревянных колоннах, реечная задняя стена с вывеской, приподнятый подиум
    сцены со ступенями и террасы зрительских скамей со столбиками света."""
    r = min(w, d) / 2.0
    stage = Point(0, r * 0.10).buffer(r * 0.46, 40)
    canopy = Point(0, r * 0.10).buffer(r * 0.56, 40)
    back = _sector(r * 0.50, 20, 160, 0.0, r * 0.10)
    parts = [
        ('platform', dict(poly=stage, h=0.95)),
        ('column', dict(pts=cols_ring(canopy, 8, 0.45, 0.6), h=6.4)),
        CAN(canopy, 6.4, 8.6, 'cone', (), z0=0.0, over=0.9),
        V(back, 5.4, 5.8, 'flat', z0=0.95, over=0.2),
        GLASS(_box(r * 0.5, 0.3, 0.0, r * 0.40), 3.2, 1.4),      # вывеска
        ('platform', dict(poly=_box(r * 0.9, 1.6, 0.0, -r * 0.34), h=0.55)),
        ('platform', dict(poly=_box(r * 1.0, 1.6, 0.0, -r * 0.46), h=0.25)),
    ]
    for i in range(3):                       # террасы со скамьями
        rr = r * (0.78 + 0.17 * i)
        parts.append(('platform', dict(poly=_sector(rr, 205, 335, 0.0, r * 0.10),
                                       h=0.18 + 0.16 * i)))
        for k in range(5 + i):
            a = math.radians(214 + (312 - 214) * k / float(4 + i))
            bx = rr * 0.92 * math.cos(a)
            by = r * 0.10 + rr * 0.92 * math.sin(a)
            parts.append(('bench', dict(pt=(bx, by), ang=math.degrees(a) + 90.0)))
    parts.append(ENT(0.0, -r * 0.95))
    return parts

def playground(w, d):
    """Детская площадка: открытая, без крупных кровель. Два игровых помоста
    на опорах с ограждением и верёвочным мостом, трубчатая горка, скалодром,
    качели, карусель, песочница с бортом, домик-теремок с маленькой двускаткой,
    скамьи по периметру, стела и столбики освещения."""
    base = _stadium(w, d, r=d * 0.44)
    t1 = Point(-w * 0.33, d * 0.10).buffer(3.4, 24)      # большой помост
    t2 = Point(-w * 0.06, d * 0.06).buffer(2.8, 24)      # малый помост
    ring = Point(w * 0.30, d * 0.02).buffer(4.6, 32)     # круг карусели
    house = _box(4.0, 3.4, w * 0.44, -d * 0.24)          # домик-теремок
    sand = Point(w * 0.05, -d * 0.28).buffer(3.2, 24)    # песочница
    parts = [
        ('platform', dict(poly=base, h=0.12)),
        # помост 1: опоры, настил, ограждение — без кровли
        ('column', dict(pts=[(-w * 0.33 + 2.2 * math.cos(a), d * 0.10 + 2.2 * math.sin(a),
                              0.26) for a in [0.8, 2.4, 4.0, 5.6]], h=2.6)),
        ('deck', dict(poly=t1, h=2.6)),
        RAIL([(p[0], p[1]) for p in cols_ring(t1, 13, 0.1, 0.35)], 1.1),
        # помост 2
        ('column', dict(pts=[(-w * 0.06 + 1.8 * math.cos(a), d * 0.06 + 1.8 * math.sin(a),
                              0.24) for a in [0.8, 2.4, 4.0, 5.6]], h=2.0)),
        ('deck', dict(poly=t2, h=2.0)),
        RAIL([(p[0], p[1]) for p in cols_ring(t2, 11, 0.1, 0.3)], 1.0),
        # верёвочный мост между помостами
        ('deck', dict(poly=_box(w * 0.26, 1.4, -w * 0.195, d * 0.08), h=2.0)),
        RAIL([(-w * 0.31, d * 0.08 + 0.7), (-w * 0.08, d * 0.08 + 0.7)], 0.9),
        RAIL([(-w * 0.31, d * 0.08 - 0.7), (-w * 0.08, d * 0.08 - 0.7)], 0.9),
        # трубчатая горка с большого помоста
        ('equip', dict(poly=_box(1.1, 5.4, -w * 0.33 - 3.6, d * 0.10 - 2.4), h=2.4)),
        # скалодром у малого помоста
        ('equip', dict(poly=_box(3.2, 1.2, -w * 0.06 + 2.6, d * 0.06 - 1.6), h=2.2)),
        # качели: две стойки и перекладина
        ('column', dict(pts=[(w * 0.05, d * 0.22, 0.16), (w * 0.15, d * 0.22, 0.16)],
                        h=2.6)),
        ('equip', dict(poly=_box(w * 0.12, 0.26, w * 0.10, d * 0.22), h=2.7)),
        # карусель: круглый настил с поручнем, открытая
        ('platform', dict(poly=ring, h=0.30)),
        ('equip', dict(poly=Point(w * 0.30, d * 0.02).buffer(0.35, 12), h=1.6)),
        # домик-теремок с маленькой кровлей
        V(house, 2.0, 3.0, 'gable', over=0.35),
        ('equip', dict(poly=_box(0.9, 3.0, w * 0.44 - 2.6, -d * 0.24 - 1.6), h=1.4)),
        # песочница с деревянным бортом
        ('platform', dict(poly=sand, h=0.3)),
        # стела с названием
        V(_box(5.0, 0.5, -w * 0.44, -d * 0.30), 2.0, 2.2, 'flat', over=0.1),
        ENT(-w * 0.50, -d * 0.10),
    ]
    for k in range(6):                       # скамьи и фонари по периметру
        ax = -w * 0.40 + w * 0.80 * k / 5.0
        parts.append(('bench', dict(pt=(ax, -d * 0.42), ang=0.0)))
        if k % 2 == 0:
            parts.append(('lamp', dict(pt=(ax, d * 0.42), h=4.0, kind='park')))
    for k in range(4):
        a = math.radians(30 + 75 * k)
        parts.append(('bench', dict(pt=(w * 0.30 + 6.4 * math.cos(a),
                                        d * 0.02 + 6.4 * math.sin(a)),
                                    ang=math.degrees(a) + 90.0)))
    return parts

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
    каменный цоколь, входной блок со стороны проезда (-Y), крытая терраса на
    колоннах в сад (+Y), панорамные окна, труба и купель у террасы."""
    core = _box(w * 0.72, d * 0.52, 0.0, d * 0.07)
    entry = _box(w * 0.24, d * 0.22, w * 0.20, -d * 0.30)
    ver = _box(w * 0.54, d * 0.18, -w * 0.08, d * 0.42)
    fy = -d * 0.19                      # линия уличного фасада
    gy = d * 0.33                       # линия садового фасада
    return [
        plinth(core.union(entry).union(ver), 0.65),
        V(core, 3.2, 7.2, 'gable', over=1.6),
        V(entry, 3.0, 5.2, 'gable', over=1.0),
        CAN(ver, 3.5, 4.6, 'shed',
            cols_line(-w * 0.32, d * 0.50, w * 0.16, d * 0.50, 5, 0.26),
            z0=0.65, over=0.5),
        RAIL([(-w * 0.33, d * 0.51), (w * 0.17, d * 0.51)], 1.0),
        win_band(-w * 0.32, w * 0.16, gy, t=0.42, z0=0.9, h=2.0),
        *win_row(-w * 0.34, -w * 0.04, fy, 3, 1.8, z0=0.9, h=1.8),
        door(w * 0.20, -d * 0.41, 1.8),
        ('deck', dict(poly=ver.buffer(0.35))),
        ('platform', dict(poly=_box(w * 0.28, 1.6, w * 0.20, -d * 0.47), h=0.35)),
        ('chimney', dict(poly=_box(0.9, 0.9, -w * 0.24, d * 0.12), h=8.4)),
        *tub_on_base(w * 0.32, d * 0.42, 1.1),
        ENT(w * 0.20, -d * 0.50),
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
        if 'line' in s:                      # ограждения тоже переносятся
            s['line'] = [(cx + p[0] * math.cos(a) - p[1] * math.sin(a),
                          cy + p[0] * math.sin(a) + p[1] * math.cos(a))
                         for p in s['line']]
        if t in ('entrance', 'bench', 'lamp'):
            p = s['pt']
            s['pt'] = (cx + p[0] * math.cos(a) - p[1] * math.sin(a),
                       cy + p[0] * math.sin(a) + p[1] * math.cos(a))
            if 'ang' in s:
                s['ang'] = s['ang'] + angle_deg
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
