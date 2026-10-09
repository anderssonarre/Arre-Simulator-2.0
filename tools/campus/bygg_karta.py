"""Bygger spelets campuskarta (js/data/campus.js) från osm-utdrag.json.

Kör:  python3 tools/campus/bygg_karta.py
Kräver Pillow (pip install pillow).

Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0. Utdraget är redan vridet så att
Wolffskavägen går nord–syd. 1 ruta i spelet = 1,7 meter.
"""
import json, math, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = json.load(open(os.path.join(HERE, 'osm-utdrag.json'), encoding='utf-8'))

M = 1.7  # meter per ruta
X0, Y0 = -155.0, -135.0  # kartans övre vänstra hörn i meter
N = 208  # rutor per sida
R = 6  # markupplösning: punkter per ruta (≈ 0,28 m)

# Markslag i marklagret
PAVING, GRASS, ASPHALT, PAINT, PARKING, CURB = 0, 1, 2, 3, 4, 5

# Hus: typ (fasad) och höjd i meter. Nycklar är OSM-id. Övriga får en typ efter OSM-taggen.
HOUSES = {
    'w88384513': ('w33', 17.5, 'W33 · Novia'),
    'r1308792': ('novia', 15.0, 'Novia, Wolffskavägen 27–31'),
    'r1308791': ('brickmodern', 16.0, 'Wolffskavägen 30'),
    'w88063246': ('oldbrick', 11.0, 'Tervahovi'),
    'w88077599': ('brickmodern', 9.0, 'Tritonia'),
    'w88085843': ('woodred', 8.0, 'Puuvillatalo'),
    'w88085877': ('woodred', 8.0, 'Puuvillakuja 4a'),
    'w88085916': ('woodred', 8.0, 'Puuvillakuja 4b'),
    'w88092038': ('fabriikki', 13.0, 'Fabriikki'),
    'w88092062': ('techno', 9.0, 'Technobothnia'),
    'w88105578': ('villa', 7.0, 'Leison Café'),
    'w88105579': ('brickmodern', 8.0, 'Muova'),
    'w88105583': ('wsc', 9.0, 'Wasa Sports Club'),
    'w1205306419': ('wsc', 9.0, 'Wasa Sports Club'),
    'w44779377': ('plaster', 4.5, 'Metsähallitus'),
    'w88384530': ('office', 14.0, 'Virastotalo'),
    'w88384495': ('apartment', 19.0, 'Fabriksgatan 3'),
    'w1227839365': ('apartment', 19.0, 'Kaptensgatan 32'),
    'w88384524': ('apartment', 16.0, ''),
    'w88384529': ('apartment', 16.0, ''),
}
DEFAULT_TYPE = {'residential': ('apartment', 15.0), 'commercial': ('office', 12.0), 'university': ('brickmodern', 9.0),
                'college': ('brickmodern', 12.0)}

ROAD_WIDTH = {'secondary': None, 'residential': 7.0, 'unclassified': 7.0, 'tertiary': 8.0, 'service': 4.5,
              'footway': 2.2, 'cycleway': 2.6, 'path': 1.6, 'pedestrian': 4.0, 'steps': 2.0, 'track': 3.0}
VEHICLE = {'secondary', 'residential', 'unclassified', 'tertiary', 'service', 'track'}


def tile(p):
    return ((p[0] - X0) / M, (p[1] - Y0) / M)


def px(p):
    return ((p[0] - X0) / M * R, (p[1] - Y0) / M * R)


def simplify(pts, eps=0.25):
    """Douglas–Peucker i meter."""
    if len(pts) < 3:
        return pts
    def d(p, a, b):
        ax, ay = a; bx, by = b; x, y = p
        L = math.hypot(bx - ax, by - ay) or 1e-9
        return abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / L
    i, dmax = 0, 0
    for k in range(1, len(pts) - 1):
        dd = d(pts[k], pts[0], pts[-1])
        if dd > dmax:
            i, dmax = k, dd
    if dmax > eps:
        return simplify(pts[:i + 1], eps)[:-1] + simplify(pts[i:], eps)
    return [pts[0], pts[-1]]


def simplify_ring(pts, eps=0.25):
    """Förenklar en sluten ring: delar den vid punkten längst från starten."""
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return pts
    far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    a = simplify(pts[:far + 1], eps)
    b = simplify(pts[far:] + [pts[0]], eps)
    return a[:-1] + b[:-1]


def clip(poly, xmin, ymin, xmax, ymax):
    """Sutherland–Hodgman mot kartans kant."""
    def cut(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a):
                    out.append(inter(a, b))
                out.append(b)
            elif inside(a):
                out.append(inter(a, b))
        return out
    def lerp(a, b, t):
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    p = poly
    for axis, lim, keep in ((0, xmin, 1), (0, xmax, -1), (1, ymin, 1), (1, ymax, -1)):
        if not p:
            break
        p = cut(p, lambda q: (q[axis] - lim) * keep >= 0,
                lambda a, b: lerp(a, b, (lim - a[axis]) / ((b[axis] - a[axis]) or 1e-9)))
    return p


ground = Image.new('L', (N * R, N * R), PAVING)
g = ImageDraw.Draw(ground)
els = SRC['element']


def rings(e, role=None):
    return [r['pts'] for r in e['rings'] if role is None or r['role'] == role]


# 1. Gräs och parker
for e in els:
    t = e['tags']
    if t.get('landuse') in ('grass', 'meadow') or t.get('leisure') in ('park', 'garden') or t.get('natural') == 'scrub':
        for r in rings(e, 'outer'):
            if len(r) > 2:
                g.polygon([px(p) for p in r], fill=GRASS)
# 2. Parkeringar
for e in els:
    if e['tags'].get('amenity') == 'parking':
        for r in rings(e, 'outer'):
            if len(r) > 2:
                g.polygon([px(p) for p in r], fill=PARKING)


def road_width(t):
    hw = t['highway']
    if hw == 'secondary':
        try:
            lanes = int(t.get('lanes', '2'))
        except ValueError:
            lanes = 2
        return max(7.5, lanes * 3.4)
    return ROAD_WIDTH.get(hw)


def draw_ways(kinds, cls):
    for e in els:
        t = e['tags']
        if t.get('highway') in kinds and t.get('area') != 'yes':
            w = road_width(t)
            if not w:
                continue
            pts = [px(p) for p in rings(e)[0]]
            if len(pts) > 1:
                g.line(pts, fill=cls, width=max(1, round(w / M * R)), joint='curve')
                r = w / M * R / 2
                for x, y in (pts[0], pts[-1]):
                    g.ellipse((x - r, y - r, x + r, y + r), fill=cls)


# 3. Gång- och cykelvägar, sedan körbanor ovanpå
draw_ways({'service', 'track'}, ASPHALT)
draw_ways({'footway', 'cycleway', 'path', 'pedestrian', 'steps'}, PAVING)
draw_ways({'secondary', 'residential', 'unclassified', 'tertiary'}, ASPHALT)

pix = ground.load()
W = N * R


def paint_line(pts, dash=3.0, gap=3.0, width=0.14):
    """Streckad mittlinje längs en väg."""
    run = 0.0
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, by - ay)
        steps = max(1, int(L / 0.1))
        for k in range(steps):
            s = run + L * k / steps
            if (s % (dash + gap)) < dash:
                x = ax + (bx - ax) * k / steps
                y = ay + (by - ay) * k / steps
                X, Y = px((x, y))
                if 0 <= X < W and 0 <= Y < W and pix[int(X), int(Y)] == ASPHALT:
                    pix[int(X), int(Y)] = PAINT
        run += L


for e in els:
    t = e['tags']
    if t.get('highway') in ('secondary', 'residential', 'unclassified') and t.get('area') != 'yes':
        paint_line(rings(e)[0])

# 4. Övergångsställen: där en gång- eller cykelväg korsar en gata (inte trottoarer längs gatan)
def seg_hit(a, b, c, d):
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = a, b, c, d
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-9:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1)) if 0 <= t <= 1 and 0 <= u <= 1 else None


streets = [(e['tags'], rings(e)[0]) for e in els if e['tags'].get('highway') in ('secondary', 'residential', 'unclassified')]
crossings = 0
done = []
for e in els:
    t = e['tags']
    if t.get('highway') not in ('footway', 'cycleway', 'path') or t.get('footway') == 'sidewalk':
        continue
    pts = rings(e)[0]
    for a, b in zip(pts, pts[1:]):
        for st, spts in streets:
            for c, d in zip(spts, spts[1:]):
                hit = seg_hit(a, b, c, d)
                if not hit:
                    continue
                fx, fy = b[0] - a[0], b[1] - a[1]
                rx, ry = d[0] - c[0], d[1] - c[1]
                fl, rl = math.hypot(fx, fy), math.hypot(rx, ry)
                if fl < 1e-6 or rl < 1e-6 or abs(fx * rx + fy * ry) / (fl * rl) > 0.7:
                    continue
                if any(math.hypot(hit[0] - x, hit[1] - y) < 4 for x, y in done):
                    continue
                done.append(hit)
                crossings += 1
                rx, ry = rx / rl, ry / rl
                # Vita balkar längs körriktningen, 3 m långa, 0,5 m breda med 0,5 m mellanrum tvärs över gatan.
                nx, ny = -ry, rx
                half = road_width(st) / 2 + 0.3
                for k in range(-int(half / 0.05), int(half / 0.05) + 1):
                    o = k * 0.05
                    for q in range(-30, 31):
                        w_ = q * 0.05
                        if int(math.floor((o + half) / 0.5)) % 2:
                            continue
                        x = hit[0] + nx * o + rx * w_
                        y = hit[1] + ny * o + ry * w_
                        X, Y = px((x, y))
                        if 0 <= X < W and 0 <= Y < W and pix[int(X), int(Y)] in (ASPHALT, PAINT):
                            pix[int(X), int(Y)] = PAINT

# 5. Kantsten mellan körbana och omgivning
edge = []
for y in range(1, W - 1):
    for x in range(1, W - 1):
        if pix[x, y] == ASPHALT and any(pix[x + dx, y + dy] in (PAVING, GRASS) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            edge.append((x, y))
for x, y in edge:
    pix[x, y] = CURB

# 6. Hus
houses = []
mask = Image.new('L', (N * R, N * R), 0)
mg = ImageDraw.Draw(mask)
for e in els:
    t = e['tags']
    if 'building' not in t or t['building'] in ('roof', 'carport'):
        continue
    typ, h, name = HOUSES.get(e['id'], (None, None, ''))
    if not typ:
        typ, h = DEFAULT_TYPE.get(t['building'], ('plaster', 7.0))
        lv = t.get('building:levels')
        if lv and lv.replace('.', '').isdigit():
            h = float(lv) * 3.3 + 1
        name = t.get('name', '')
    out_rings = []
    for r in e['rings']:
        pts = simplify_ring([list(p) for p in r['pts']])
        pts = clip(pts, X0 + 0.01, Y0 + 0.01, X0 + N * M - 0.01, Y0 + N * M - 0.01)
        if len(pts) < 3:
            continue
        if r['role'] == 'outer':
            mg.polygon([px(p) for p in pts], fill=255)
        out_rings.append({'inner': r['role'] == 'inner', 'pts': [[round(a, 3) for a in tile(p)] for p in pts]})
    for r in out_rings:
        if r['inner']:
            mg.polygon([((p[0]) * R, (p[1]) * R) for p in r['pts']], fill=0)
    if out_rings:
        houses.append({'id': e['id'], 'type': typ, 'h': round(h / M, 2), 'name': name, 'rings': out_rings})

# Ingen mark under husen ska synas som väg (spelar ingen roll visuellt, men håller datan ren)
mpix = mask.load()

# 7. Murar och häckar
walls = []
for e in els:
    t = e['tags']
    if t.get('barrier') in ('wall', 'retaining_wall', 'hedge', 'fence'):
        pts = [[round(a, 3) for a in tile(p)] for p in rings(e)[0]]
        h = {'wall': 0.6, 'retaining_wall': 0.5, 'hedge': 0.7, 'fence': 0.8}[t['barrier']] / M * 1.7
        walls.append({'kind': t['barrier'], 'h': round(h, 2), 'pts': pts})

# 8. Träd (inte på asfalt eller i hus)
trees = []
for e in els:
    t = e['tags']
    if t.get('natural') == 'tree':
        p = e['rings'][0]['pts'][0]
        X, Y = px(p)
        if 0 <= X < W and 0 <= Y < W and mpix[int(X), int(Y)] == 0 and pix[int(X), int(Y)] not in (ASPHALT, PAINT, CURB):
            tx, ty = tile(p)
            trees.append([round(tx, 2), round(ty, 2)])

# 9. Gatlampor i vajrar över Wolffskavägen och tvärgatan, ungefär var 35:e meter
lamps = []
for e in els:
    t = e['tags']
    if t.get('highway') in ('secondary', 'residential') and t.get('area') != 'yes':
        run = 0.0
        pts = rings(e)[0]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            L = math.hypot(bx - ax, by - ay)
            s = (35 - run % 35) % 35
            while s < L:
                x, y = ax + (bx - ax) * s / L, ay + (by - ay) * s / L
                tx, ty = tile((x, y))
                if 1 < tx < N - 1 and 1 < ty < N - 1 and all(math.hypot(tx - a, ty - b) > 8 for a, b in lamps):
                    lamps.append([round(tx, 2), round(ty, 2)])
                s += 35
            run += L

# 9c. Gator för bilarna: mittlinjer i rutor, och om gatan är enkelriktad.
roads = []
for e in els:
    t = e['tags']
    if t.get('highway') in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified') and t.get('area') != 'yes':
        pts = [[round(a, 2) for a in tile(p)] for p in simplify(rings(e)[0], 0.4)]
        if len(pts) > 1 and any(0 < x < N and 0 < y < N for x, y in pts):
            roads.append({'pts': pts, 'w': round(road_width(t) / M, 2), 'oneway': t.get('oneway') == 'yes'})

# 10. Packa marklagret: körlängder, "klass,antal;" i bas 36
runs = []
flat = list(ground.getdata())
cur, n = flat[0], 0
for v in flat:
    if v == cur:
        n += 1
    else:
        runs.append(str(cur) + format(n, 'x'))
        cur, n = v, 1
runs.append(str(cur) + format(n, 'x'))
packed = '.'.join(runs)

data = {
    'size': N, 'meterPerTile': M, 'groundRes': R, 'origin': [X0, Y0],
    'ground': packed, 'houses': houses, 'walls': walls, 'trees': trees, 'lamps': lamps, 'roads': roads,
}
js = ('// CAMPUSKARTA · genererad av tools/campus/bygg_karta.py, ändra inte för hand.\n'
      '// Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0 (https://www.openstreetmap.org/copyright).\n'
      "'use strict';\nconst CAMPUS = " + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'js', 'data', 'campus.js'), 'w', encoding='utf-8').write(js)
ground.point(lambda v: [210, 150, 90, 255, 120, 60][v] if v < 6 else 0).save(os.path.join(HERE, 'mark.png'))
print('hus', len(houses), 'murar', len(walls), 'träd', len(trees), 'lampor', len(lamps), 'övergångar', crossings,
      'kb', round(len(js) / 1024))
