# -*- coding: utf-8 -*-
"""Объёмно-планировочные решения объектов по визуализациям альбома.

Каждый объект собирается из частей в локальных координатах (метры, центр в
начале, ось X вдоль границы участка), затем ставится на место.

Типы частей:
  volume   — объём: poly, wall (карниз), roof (gable|hip|shed|flat|dome|cone|
             pagoda), ridge (конёк), z0, over (свес)
  canopy   — навес: та же кровля, но на колоннах, без стен
  column   — колонна: (x, y, r, h)
  chimney  — труба: poly, h
  deck     — терраса, настил      platform — площадка с покрытием
  water    — бассейн, купель      court    — спортивный корт
  tub      — деревянная купель    equip    — оборудование (шлагбаум, сетка)
"""
import math

from shapely.affinity import rotate, scale, translate
from shapely.geometry import LineString, Point, Polygon, box


# ------------------------------------------------------------- примитивы ----
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


def CAN(poly, wall, ridge, roof='gable', cols=(), z0=0.0, over=1.1):
    return ('canopy', dict(poly=poly, wall=wall, ridge=ridge, roof=roof, z0=z0,
                           over=over, cols=list(cols)))


def cols_ring(poly, n, r=0.32, inset=0.45):
    """Колонны по периметру пятна."""
    ring = poly.buffer(-inset).exterior if poly.buffer(-inset).area > 1 else poly.exterior
    L = ring.length
    return [(ring.interpolate(L * i / n).x, ring.interpolate(L * i / n).y, r)
            for i in range(n)]


def cols_line(x0, y0, x1, y1, n, r=0.32):
    return [(x0 + (x1 - x0) * i / (n - 1.0), y0 + (y1 - y0) * i / (n - 1.0), r)
            for i in range(n)]


# ------------------------------------------------------------------ КПП -----
def kpp(w, d):
    """Портал с двускатной кровлей над двумя полосами и здание охраны (стр. 2)."""
    gw, gd = w * 0.52, d * 0.86                      # портал
    gx = w * 0.16
    portal_cols = [(gx - gw / 2 + 0.7, -gd / 2 + 0.7, 0.42),
                   (gx + gw / 2 - 0.7, -gd / 2 + 0.7, 0.42),
                   (gx - gw / 2 + 0.7, gd / 2 - 0.7, 0.42),
                   (gx + gw / 2 - 0.7, gd / 2 - 0.7, 0.42)]
    parts = [
        V(_box(w * 0.34, d * 0.72, -w * 0.32, 0.0), 3.2, 4.3, 'shed'),   # охрана
        V(_box(w * 0.10, d * 0.34, -w * 0.13, -d * 0.10), 3.0, 3.4, 'flat'),  # тамбур
        CAN(_box(gw, gd, gx, 0.0), 4.6, 7.4, 'gable', portal_cols),
        ('platform', dict(poly=_box(w * 0.10, d * 0.5, gx, 0.0))),       # островок
        ('equip', dict(poly=_box(0.45, 0.45, gx - gw * 0.34, -d * 0.16), h=1.1)),
        ('equip', dict(poly=_box(0.45, 0.45, gx + gw * 0.34, -d * 0.16), h=1.1)),
        V(_box(w * 0.30, 0.45, w * 0.36, d * 0.30), 2.6, 2.8, 'flat'),   # стела с логотипом
        ('deck', dict(poly=_box(w * 0.40, d * 0.35, -w * 0.30, -d * 0.55))),
    ]
    return parts


# ------------------------------------------------------- административное ---
def admin(w, d):
    core = _box(w * 0.72, d * 0.52)
    return [
        V(core, 3.6, 7.6, 'hip'),
        CAN(_box(w * 0.26, d * 0.16, -w * 0.10, -d * 0.34), 3.2, 4.2, 'shed',
            cols_line(-w * 0.21, -d * 0.40, w * 0.02, -d * 0.40, 3)),
        ('deck', dict(poly=_box(w * 0.72, d * 0.18, 0.0, -d * 0.35))),
        ('chimney', dict(poly=_box(1.3, 1.3, w * 0.24, d * 0.12), h=8.6)),
    ]


# -------------------------------------------------------------- бани -------
def bath_petrovskaya(w, d):
    """Сруб с галереей на резных колоннах, пагодная кровля, круглый бассейн."""
    core = _oval(w * 0.60, d * 0.48)
    gal = core.buffer(3.0)
    return [
        CAN(gal, 3.5, 5.6, 'pagoda', cols_ring(gal, 14, 0.36, 0.5)),
        V(core, 3.8, 8.4, 'pagoda', over=0.4),
        ('chimney', dict(poly=_box(1.6, 1.6, -w * 0.20, d * 0.16), h=9.6)),
        ('deck', dict(poly=gal.buffer(2.6))),
        ('water', dict(poly=Point(0, -d * 0.24 - 6.4).buffer(4.6, 32), rim=0.7)),
        ('tub', dict(poly=Point(-w * 0.20, -d * 0.24 - 4.0).buffer(1.15, 16), h=1.2)),
        ('tub', dict(poly=Point(w * 0.21, -d * 0.24 - 4.2).buffer(1.05, 16), h=1.1)),
    ]


def bath_rybatskaya(w, d):
    """Скруглённый объём с зелёной эксплуатируемой кровлей и бассейном с водопадом."""
    core = _stadium(w * 0.64, d * 0.46, r=d * 0.23)
    return [
        V(core, 4.2, 4.8, 'flat', over=0.6),
        V(_box(w * 0.22, 1.2, w * 0.10, d * 0.02), 3.8, 4.0, 'flat'),   # каменная стена
        ('deck', dict(poly=_box(w * 0.70, d * 0.34, 0.0, -d * 0.36))),
        ('water', dict(poly=_oval(w * 0.42, d * 0.22, w * 0.04, -d * 0.36), rim=0.6)),
        ('chimney', dict(poly=_box(1.2, 1.2, -w * 0.26, d * 0.14), h=6.6)),
    ]


def bath_ohotnichya(w, d):
    """Сруб с высокой двускатной кровлей, открытая веранда, кострище."""
    core = _box(w * 0.54, d * 0.40)
    ver = _box(w * 0.54, d * 0.20, 0.0, -d * 0.30)
    return [
        V(core, 3.3, 9.0, 'gable', over=1.3),
        CAN(ver, 3.2, 6.6, 'gable', cols_line(-w * 0.25, -d * 0.38, w * 0.25, -d * 0.38, 5,
                                              0.34), over=1.1),
        ('chimney', dict(poly=_box(1.8, 1.8, w * 0.22, d * 0.16), h=10.2)),
        ('deck', dict(poly=_box(w * 0.62, d * 0.30, 0.0, -d * 0.30))),
        ('platform', dict(poly=Point(0, -d * 0.30 - 7.5).buffer(5.2, 32))),
        ('equip', dict(poly=Point(0, -d * 0.30 - 7.5).buffer(1.5, 16), h=0.5)),
    ]


def bath_belaya(w, d):
    """Современный объём с односкатной кровлей, панорамным остеклением и бассейном."""
    core = _box(w * 0.62, d * 0.42)
    return [
        V(core, 4.0, 6.4, 'shed', over=1.2),
        ('chimney', dict(poly=_box(1.7, 1.7, w * 0.26, d * 0.10), h=8.0)),
        ('deck', dict(poly=_box(w * 0.72, d * 0.36, 0.0, -d * 0.36))),
        ('water', dict(poly=_oval(w * 0.38, d * 0.20, -w * 0.06, -d * 0.36), rim=0.6)),
        ('tub', dict(poly=Point(w * 0.24, -d * 0.34).buffer(1.1, 16), h=1.1)),
    ]


def bath_bochka(w, d):
    """Центральный объём и две бочки под куполами, купель у крыльца."""
    core = _box(w * 0.34, d * 0.44)
    b1 = Point(-w * 0.32, d * 0.04).buffer(4.3, 28)
    b2 = Point(w * 0.34, -d * 0.02).buffer(3.7, 28)
    return [
        V(core, 3.5, 6.6, 'gable', over=1.0),
        V(b1, 5.6, 8.2, 'dome', over=0.25),
        V(b2, 4.8, 7.0, 'dome', over=0.25),
        ('chimney', dict(poly=Point(-w * 0.32, d * 0.04).buffer(0.55, 12), h=9.4)),
        ('deck', dict(poly=_box(w * 0.46, d * 0.26, 0.0, -d * 0.34))),
        ('tub', dict(poly=Point(w * 0.10, -d * 0.36).buffer(1.9, 20), h=1.3)),
    ]


# ----------------------------------------------------------- общественные ---
def restaurant(w, d):
    """Зал с колоннадой и широким выносом кровли, входной блок, терраса, пруд."""
    hall = _box(w * 0.74, d * 0.38, w * 0.10, d * 0.06)
    entry = _box(w * 0.20, d * 0.24, -w * 0.36, d * 0.02)
    colonnade = _box(w * 0.74, d * 0.12, w * 0.10, -d * 0.19)
    return [
        V(hall, 6.2, 8.6, 'hip', over=2.4),
        V(entry, 4.8, 6.2, 'flat', over=1.2),
        CAN(colonnade, 6.0, 6.6, 'shed',
            cols_line(w * 0.10 - w * 0.36, -d * 0.24, w * 0.10 + w * 0.36, -d * 0.24,
                      9, 0.45), over=1.4),
        CAN(_box(w * 0.18, d * 0.16, -w * 0.38, -d * 0.22), 4.6, 5.2, 'shed',
            cols_line(-w * 0.45, -d * 0.28, -w * 0.31, -d * 0.28, 3, 0.4)),
        ('deck', dict(poly=_box(w * 0.78, d * 0.16, w * 0.08, -d * 0.30))),
        ('water', dict(poly=_oval(w * 0.44, d * 0.18, w * 0.10, -d * 0.48), rim=0.8)),
        ('platform', dict(poly=_box(w * 0.30, d * 0.22, -w * 0.36, -d * 0.30))),
    ]


def padel(w, d):
    """Крытый корт под изогнутой кровлей с широким выносом, настил и лестница."""
    hall = _stadium(w * 0.86, d * 0.74, r=d * 0.18)
    return [
        V(hall, 7.2, 9.4, 'hip', over=2.2),
        ('court', dict(poly=_box(20.0, 10.0, 0.0, 0.0))),
        ('deck', dict(poly=_box(w * 0.40, d * 0.22, -w * 0.08, -d * 0.45))),
        ('equip', dict(poly=_box(0.3, 10.0, 0.0, 0.0), h=1.0)),          # сетка
    ]


def open_court(w, d):
    posts = [('equip', dict(poly=Point(sx * w / 2, sy * d / 2).buffer(0.18, 8), h=4.0))
             for sx in (-1, 1) for sy in (-1, 1)]
    return [('court', dict(poly=_box(w, d))),
            ('equip', dict(poly=_box(0.25, d * 0.92, 0.0, 0.0), h=1.0))] + posts


def concert(w, d):
    """Круглый навес сцены на колоннах, подиум, задняя стенка и ряды амфитеатра."""
    r = min(w, d) / 2.0
    stage = Point(0, 0).buffer(r * 0.42, 40)
    canopy = Point(0, 0).buffer(r * 0.52, 40)
    parts = [
        ('platform', dict(poly=stage, h=0.9)),
        CAN(canopy, 5.6, 6.8, 'cone', cols_ring(canopy, 8, 0.42, 0.6), z0=0.9),
        V(_sector(r * 0.44, 20, 160), 4.6, 5.0, 'flat', z0=0.9, over=0.3),   # задник
    ]
    for i in range(5):                       # ступени амфитеатра
        rr = r * (0.60 + 0.08 * i)
        parts.append(('platform', dict(poly=_sector(rr, 195, 345), h=0.18 + 0.16 * i)))
    return parts


def playground(w, d):
    """Круглый павильон, две башни с горками, качели, песочница (стр. 13)."""
    pav = Point(w * 0.30, 0.0).buffer(5.4, 32)
    t1 = _box(4.6, 4.6, -w * 0.32, d * 0.10)
    t2 = _box(3.8, 3.8, -w * 0.10, -d * 0.16)
    return [
        ('platform', dict(poly=_stadium(w, d, r=d * 0.42))),
        CAN(pav, 3.4, 5.4, 'cone', cols_ring(pav, 8, 0.28, 0.5)),
        V(t1, 4.4, 6.4, 'cone', z0=3.0, over=0.5),
        V(t2, 3.4, 5.0, 'cone', z0=2.2, over=0.5),
        ('column', dict(pts=[(-w * 0.32 - 1.6, d * 0.10 - 1.6, 0.22),
                             (-w * 0.32 + 1.6, d * 0.10 - 1.6, 0.22),
                             (-w * 0.32 - 1.6, d * 0.10 + 1.6, 0.22),
                             (-w * 0.32 + 1.6, d * 0.10 + 1.6, 0.22)], h=3.0)),
        ('column', dict(pts=[(-w * 0.10 - 1.3, -d * 0.16 - 1.3, 0.2),
                             (-w * 0.10 + 1.3, -d * 0.16 - 1.3, 0.2),
                             (-w * 0.10 - 1.3, -d * 0.16 + 1.3, 0.2),
                             (-w * 0.10 + 1.3, -d * 0.16 + 1.3, 0.2)], h=2.2)),
        ('equip', dict(poly=_box(5.0, 0.3, -w * 0.02, d * 0.26), h=2.6)),   # качели
        ('equip', dict(poly=Point(w * 0.06, -d * 0.30).buffer(2.6, 20), h=0.35)),
    ]


def utility(w, d):
    return [V(_box(w * 0.82, d * 0.62), 3.8, 6.6, 'gable', over=0.8),
            CAN(_box(w * 0.34, d * 0.20, 0.0, -d * 0.42), 3.4, 4.2, 'shed',
                cols_line(-w * 0.15, -d * 0.50, w * 0.15, -d * 0.50, 3, 0.2))]


def boiler(w, d):
    return [V(_box(w * 0.78, d * 0.56), 4.2, 6.4, 'gable', over=0.7),
            ('chimney', dict(poly=Point(w * 0.30, d * 0.18).buffer(0.55, 12), h=13.0))]


def hotel(w, d):
    """Г-образный корпус, три этажа, скатные кровли, входной навес и терраса."""
    bar = _box(w * 0.80, d * 0.44, -w * 0.06, d * 0.06)
    wing = _box(w * 0.22, d * 0.78, w * 0.32, -d * 0.06)
    return [
        V(bar, 9.6, 13.8, 'hip', over=1.4),
        V(wing, 9.2, 13.0, 'hip', over=1.4),
        CAN(_box(w * 0.16, d * 0.18, -w * 0.30, -d * 0.24), 4.4, 5.4, 'shed',
            cols_line(-w * 0.36, -d * 0.32, -w * 0.24, -d * 0.32, 3, 0.35)),
        ('deck', dict(poly=_box(w * 0.60, d * 0.18, -w * 0.12, -d * 0.26))),
        ('chimney', dict(poly=_box(1.4, 1.4, -w * 0.34, d * 0.14), h=15.0)),
    ]


def cottage(w, d):
    core = _box(w * 0.86, d * 0.60)
    return [
        V(core, 2.9, 5.6, 'gable', over=1.0),
        CAN(_box(w * 0.60, d * 0.18, 0.0, -d * 0.38), 2.7, 3.3, 'shed',
            cols_line(-w * 0.26, -d * 0.45, w * 0.26, -d * 0.45, 3, 0.2)),
        ('deck', dict(poly=_box(w * 0.70, d * 0.26, 0.0, -d * 0.38))),
        ('chimney', dict(poly=_box(0.9, 0.9, w * 0.28, d * 0.10), h=6.4)),
    ]


BUILDERS = {
    'kpp': kpp, 'admin': admin, 'bath_petrovskaya': bath_petrovskaya,
    'bath_rybatskaya': bath_rybatskaya, 'bath_ohotnichya': bath_ohotnichya,
    'bath_belaya': bath_belaya, 'bath_bochka': bath_bochka,
    'restaurant': restaurant, 'padel': padel, 'court': open_court,
    'concert': concert, 'playground': playground, 'utility': utility,
    'boiler': boiler, 'hotel': hotel, 'cottage': cottage,
}


def make(kind, w, d, angle_deg, cx, cy):
    """Собирает объект и ставит его на место (поворот + перенос)."""
    parts = BUILDERS.get(kind, utility)(w, d)
    out = []
    for t, spec in parts:
        s = dict(spec)
        if 'poly' in s:
            s['poly'] = translate(rotate(s['poly'], angle_deg, origin=(0, 0)), cx, cy)
        if s.get('cols'):
            s['cols'] = [_place(p, angle_deg, cx, cy) for p in s['cols']]
        if s.get('pts'):
            s['pts'] = [_place(p, angle_deg, cx, cy) for p in s['pts']]
        out.append((t, s))
    return out


def _place(p, ang, cx, cy):
    a = math.radians(ang)
    return (cx + p[0] * math.cos(a) - p[1] * math.sin(a),
            cy + p[0] * math.sin(a) + p[1] * math.cos(a), p[2])
