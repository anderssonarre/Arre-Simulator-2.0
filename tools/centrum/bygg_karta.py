"""Bygger kartan över Vasa centrum (js/data/centrum.js) från osm-utdrag.json.

Kör:  python3 tools/centrum/utdrag.py && python3 tools/centrum/bygg_karta.py
Kräver Pillow (pip install pillow).

Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0. Utdraget är vridet 21,7° så att gatunätet
går rakt. Lägena för Torget, Stadshuset, Trefaldighetskyrkan, Saluhallen, Rewell och stationen
är kontrollerade mot Google Maps. 1 ruta i spelet = 1,7 meter, som på campus.
"""
import json, math, os, hashlib, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
# Två kartor byggs med samma skript: python3 bygg_karta.py centrum  /  python3 bygg_karta.py bron
#   utdrag, X0/Y0 (övre vänstra hörnet i meter), N (rutor per sida), R (markupplösning),
#   utfil, konstantnamn och havspunkter (där vattnet fylls i, i meter).
KARTOR = {
    'centrum': ('osm-utdrag.json', -372.0, -390.0, 440, 4, 'centrum.js', 'CENTRUM', []),
    # Wolffskavägen från campus, över Brändöbron och ner längs Kyrkoesplanaden till centrum.
    'bron': ('osm-utdrag-bron.json', -430.0, 200.0, 530, 3, 'bron.js', 'BRON', [(-60, 475), (80, 475)]),
}
NAMN = sys.argv[1] if len(sys.argv) > 1 else 'centrum'
UTDRAG, X0, Y0, N, R, UTFIL, KONST, HAV = KARTOR[NAMN]
SRC = json.load(open(os.path.join(HERE, UTDRAG), encoding='utf-8'))
M = 1.7  # meter per ruta

PAVING, GRASS, ASPHALT, PAINT, PARKING, CURB, WATER = 0, 1, 2, 3, 4, 5, 6

# Kända hus: typ (fasad), höjd i meter och namn. Nycklar är OSM-id.
HOUSES = {
    'w139542091': ('church', 16.0, 'Trefaldighetskyrkan'),
    'w24559271': ('stadshus', 14.0, 'Vasa stadshus'),
    'w88900966': ('oldbrick', 10.0, 'Saluhallen'),
    'w28692713': ('city:#7d3f33', 49.0, 'Vasa vattentorn'),
    'w246675488': ('city:#e9e7e1:shop', 10.0, 'Rewell Center'),
    'w246675489': ('city:#e9e7e1:shop', 30.0, 'Sokos Hotel Vaakuna'),
    'w24559319': ('stadshus', 9.0, 'Vasa järnvägsstation'),
    'w24559282': ('city:#9fa19c:shop', 27.0, 'Sampotalo'),
    'w28512601': ('city:#b8b4ad:shop', 7.0, 'Hesburger'),
    # Arvids hus på bron-kartan: hörnhuset Kyrkoesplanaden 6 / Museigatan 8, åtta våningar.
    'w88206727': ('city:#d6cdb9', 27.4, 'Kyrkoesplanaden 6 / Museigatan 8'),
}
COLOURS = {'white': '#e8e6df', 'yellow': '#e3c983', 'beige': '#d9c7a3', 'maroon': '#8c4a3c', 'grey': '#a3a59f',
           'gray': '#a3a59f', 'coral': '#e0907a', 'bisque': '#efd9bd', 'darkgoldenrod': '#c89a45',
           'brown': '#8a5a40', 'red': '#a5503c', 'orange': '#e6a060', 'pink': '#e7b7b0'}
# Vanliga fasadfärger i centrum när kartan inte säger något (puts och tegel från 1900-talet).
PALETT = ['#d9d3c4', '#cfc5b0', '#e4dccb', '#c7b79a', '#b9ad9a', '#d6c19b', '#a9786a', '#c9b089']
SHOP = {'commercial', 'retail', 'hotel', 'office'}
DEFAULT_TYPE = {}

ROAD_WIDTH = {'primary': None, 'secondary': None, 'tertiary': 8.0, 'residential': 7.0, 'unclassified': 7.0,
              'living_street': 5.0, 'service': 4.5, 'footway': 2.2, 'cycleway': 2.6, 'path': 1.6,
              'pedestrian': 5.0, 'steps': 2.0, 'track': 3.0}
VEHICLE = {'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'track', 'living_street'}


def colour(t):
    c = (t.get('building:colour') or '').strip().lower()
    if c in COLOURS:
        return COLOURS[c]
    if len(c) == 7 and c.startswith('#'):
        return c
    return None


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
    if t.get('landuse') in ('grass', 'meadow', 'village_green') or t.get('leisure') in ('park', 'garden', 'playground') or t.get('natural') in ('scrub', 'wood', 'grassland'):
        for r in rings(e, 'outer'):
            if len(r) > 2:
                g.polygon([px(p) for p in r], fill=GRASS)
# 1b. Vatten: sjöar och dammar, och havet innanför kustlinjen (fylls från havspunkterna).
for e in els:
    t = e['tags']
    if t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('landuse') == 'basin':
        for r in rings(e, 'outer'):
            if len(r) > 2:
                g.polygon([px(p) for p in r], fill=WATER)
if HAV:
    coast = Image.new('L', (N * R, N * R), 0)
    cg = ImageDraw.Draw(coast)
    for e in els:
        if e['tags'].get('natural') == 'coastline':
            pts = [px(p) for p in rings(e)[0]]
            if len(pts) > 1:
                cg.line(pts, fill=255, width=3)
    for sx, sy in HAV:
        X, Y = px((sx, sy))
        if 0 <= X < N * R and 0 <= Y < N * R and coast.getpixel((int(X), int(Y))) == 0:
            ImageDraw.floodfill(coast, (int(X), int(Y)), 128, border=255)
    cpix, gpix = coast.load(), ground.load()
    for y in range(N * R):
        for x in range(N * R):
            if cpix[x, y] == 128 or (cpix[x, y] == 255 and gpix[x, y] != GRASS):
                gpix[x, y] = WATER

# 2. Parkeringar
for e in els:
    if e['tags'].get('amenity') == 'parking':
        for r in rings(e, 'outer'):
            if len(r) > 2:
                g.polygon([px(p) for p in r], fill=PARKING)


def road_width(t):
    hw = t['highway']
    if hw in ('primary', 'secondary'):
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
draw_ways({'primary', 'secondary', 'residential', 'unclassified', 'tertiary', 'living_street'}, ASPHALT)

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
    if t.get('highway') in ('primary', 'secondary', 'residential', 'unclassified', 'tertiary') and t.get('area') != 'yes':
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


streets = [(e['tags'], rings(e)[0]) for e in els if e['tags'].get('highway') in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified')]
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
    if 'building' not in t or t['building'] in ('roof', 'carport', 'bridge', 'elevator', 'construction'):
        continue
    typ, h, name = HOUSES.get(e['id'], (None, None, ''))
    if not typ:
        h = 9.0
        try:
            h = float(t['height'])
        except (KeyError, ValueError):
            lv = t.get('building:levels')
            if lv and lv.replace('.', '').isdigit():
                h = float(lv) * 3.3 + 1
        c = colour(t) or PALETT[int(hashlib.md5(e['id'].encode()).hexdigest(), 16) % len(PALETT)]
        shop = t['building'] in SHOP or any(k in t for k in ('shop', 'amenity'))
        typ = 'city:' + c + (':shop' if shop or h >= 12 else '')
        if t['building'] in ('garage', 'garages', 'shed', 'hut', 'kiosk', 'transformer_tower'):
            typ, h = 'city:#8f8c86', min(h, 3.5)
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
# Räcken längs broarna.
for e in els:
    t = e['tags']
    if t.get('bridge') == 'yes' and t.get('highway') and road_width(t):
        pts = rings(e)[0]
        off = road_width(t) / 2 + 0.25
        for side in (-1, 1):
            rail = []
            for i, (x, y) in enumerate(pts):
                a = pts[max(0, i - 1)]
                b = pts[min(len(pts) - 1, i + 1)]
                dx, dy = b[0] - a[0], b[1] - a[1]
                L = math.hypot(dx, dy) or 1
                rail.append([round(a_, 3) for a_ in tile((x - dy / L * off * side, y + dx / L * off * side))])
            walls.append({'kind': 'railing', 'h': round(1.0 / M, 2), 'pts': rail})

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
    if t.get('highway') in ('primary', 'secondary', 'tertiary', 'residential') and t.get('area') != 'yes':
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

# 9b. Platser: busshållplatser, kaféer, barer, butiker, bänkar och fontäner (för spelet)
pois = []
for e in els:
    t = e['tags']
    kind = None
    if t.get('highway') == 'bus_stop':
        kind = 'buss'
    elif t.get('amenity') in ('cafe', 'restaurant', 'fast_food', 'bar', 'pub', 'nightclub', 'bench', 'fountain', 'bank', 'pharmacy', 'library', 'cinema', 'theatre'):
        kind = t['amenity']
    elif 'shop' in t:
        kind = 'shop:' + t['shop']
    elif t.get('historic') in ('monument', 'memorial') or t.get('tourism') == 'artwork':
        kind = 'monument'
    if not kind:
        continue
    pts = e['rings'][0]['pts']
    if len(pts) != 1 and kind != 'monument':
        continue
    tx, ty = tile((sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)))
    if 1 < tx < N - 1 and 1 < ty < N - 1:
        pois.append({'kind': kind, 'name': t.get('name', ''), 'x': round(tx, 2), 'y': round(ty, 2)})

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
    'ground': packed, 'houses': houses, 'walls': walls, 'trees': trees, 'lamps': lamps, 'roads': roads, 'pois': pois,
}
js = ('// KARTA (' + NAMN + ') · genererad av tools/centrum/bygg_karta.py, ändra inte för hand.\n'
      '// Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0 (https://www.openstreetmap.org/copyright).\n'
      "'use strict';\nconst " + KONST + " = " + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'js', 'data', UTFIL), 'w', encoding='utf-8').write(js)
ground.point(lambda v: [210, 150, 90, 255, 120, 60, 30][v] if v < 7 else 0).save(os.path.join(HERE, 'mark-' + NAMN + '.png'))
print('platser', len(pois), 'hus', len(houses), 'murar', len(walls), 'träd', len(trees), 'lampor', len(lamps), 'övergångar', crossings,
      'kb', round(len(js) / 1024))
