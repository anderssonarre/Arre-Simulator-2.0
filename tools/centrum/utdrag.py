"""Gör om rå Overpass-data (osm-centrum.json) till ett utdrag i meter, vridet så att
gatunätet i Vasa centrum går rakt (samma format som tools/campus/osm-utdrag.json).

Kör:  python3 tools/centrum/utdrag.py

Rådatan (osm-centrum.json, ligger inte i git) hämtas från Overpass API med frågan:
  [out:json][timeout:120];(way(63.0912,21.6040,63.0998,21.6250);
  relation["building"](...samma ruta);relation["type"="multipolygon"](...);
  node["natural"="tree"](...);node["amenity"](...);node["shop"](...);node["tourism"](...);
  node["highway"](...);node["historic"](...);node["leisure"](...););out geom;
Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0.
"""
import json, math, os

import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Två kartor: centrum (runt torget) och bron (Wolffskavägen från campus över Brändöbron
# och Kyrkoesplanaden ner till centrum, i samma vridning som campuskartan).
KARTOR = {
    'centrum': ('osm-centrum.json', 'osm-utdrag.json', 63.09572, 21.61578, 21.7, 420),
    'bron': ('osm-bron.json', 'osm-utdrag-bron.json', 63.1055, 21.595, 42.7, 1200),
    # Vasklot runt Wärtsilä Smart Technology Hub (origo: Frilundsvägen 5 på Google Maps).
    'vasklot': ('osm-vasklot.json', 'osm-utdrag-vasklot.json', 63.0920302, 21.5616613, 5.0, 700),
}
NAMN = sys.argv[1] if len(sys.argv) > 1 else 'centrum'
SRC_FIL, UT_FIL, LAT0, LON0, VRID, HALF = KARTOR[NAMN]
RAW = json.load(open(os.path.join(HERE, SRC_FIL), encoding='utf-8'))
KX = math.cos(math.radians(LAT0)) * 111320
KY = 110540
C, S = math.cos(math.radians(VRID)), math.sin(math.radians(VRID))


def proj(lat, lon):
    x, y = (lon - LON0) * KX, -(lat - LAT0) * KY
    return [round(x * C - y * S, 2), round(x * S + y * C, 2)]


KEEP = ('building', 'highway', 'landuse', 'leisure', 'amenity', 'natural', 'barrier', 'railway', 'shop',
        'tourism', 'historic', 'man_made', 'place', 'area:highway', 'waterway', 'water')
out = []
for e in RAW['elements']:
    t = e.get('tags', {})
    if not any(k in t for k in KEEP):
        continue
    rings = []
    if e['type'] == 'node':
        rings = [{'role': 'outer', 'pts': [proj(e['lat'], e['lon'])]}]
    elif e['type'] == 'way' and 'geometry' in e:
        rings = [{'role': 'outer', 'pts': [proj(p['lat'], p['lon']) for p in e['geometry']]}]
    elif e['type'] == 'relation':
        # Multipolygon: sätt ihop medlemmarnas linjer till slutna ringar.
        parts = {'outer': [], 'inner': []}
        for m in e.get('members', []):
            if m.get('type') == 'way' and 'geometry' in m and m.get('role') in parts:
                parts[m['role']].append([proj(p['lat'], p['lon']) for p in m['geometry'] if p])
        for role, segs in parts.items():
            segs = [s for s in segs if len(s) > 1]
            while segs:
                ring = segs.pop(0)
                grown = True
                while ring[0] != ring[-1] and grown:
                    grown = False
                    for i, s in enumerate(segs):
                        if s[0] == ring[-1]:
                            ring += s[1:]
                        elif s[-1] == ring[-1]:
                            ring += s[::-1][1:]
                        elif s[-1] == ring[0]:
                            ring = s + ring[1:]
                        elif s[0] == ring[0]:
                            ring = s[::-1] + ring[1:]
                        else:
                            continue
                        segs.pop(i)
                        grown = True
                        break
                rings.append({'role': role, 'pts': ring})
    if not rings:
        continue
    pts = [p for r in rings for p in r['pts']]
    if not any(abs(x) < HALF and abs(y) < HALF * 1.3 for x, y in pts) and t.get('natural') != 'coastline':
        continue
    out.append({'id': e['type'][0] + str(e['id']), 'tags': t, 'rings': rings})

meta = {
    'källa': '© OpenStreetMap-bidragsgivare, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    'origo': {'lat': LAT0, 'lon': LON0},
    'enhet': 'meter, x österut och y söderut, vriden %.1f°' % VRID,
    'hämtad': RAW.get('osm3s', {}).get('timestamp_osm_base', '')[:10],
}
json.dump({'meta': meta, 'element': out}, open(os.path.join(HERE, UT_FIL), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print(len(out), 'element')
