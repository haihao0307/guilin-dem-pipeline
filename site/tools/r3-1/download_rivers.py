from pathlib import Path
import json, urllib.request, urllib.parse, time, hashlib
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1]
t=Transformer.from_crs(32651,4326,always_xy=True)
w,s,e,n=t.transform_bounds(190475,2991275,411250,3241862.5,densify_pts=50)
query=f'[out:json][timeout:120];way["waterway"="river"]({s-.02},{w-.02},{n+.02},{e+.02});out body geom;'
url='https://overpass-api.de/api/interpreter'
data=urllib.parse.urlencode({'data':query}).encode()
req=urllib.request.Request(url,data=data,headers={'User-Agent':'WenzhouTerrainResearch/3.1','Content-Type':'application/x-www-form-urlencoded'})
with urllib.request.urlopen(req,timeout=150) as r: raw=r.read()
d=json.loads(raw)
if d.get('remark'):raise RuntimeError(d['remark'])
assert len(d['elements'])>0
file=ROOT/'evidence/OSM_RIVERS_CURRENT.json';file.write_bytes(raw)
meta={'endpoint':url,'query':query,'downloadedAtUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'osmSnapshot':d.get('osm3s'),'elements':len(d['elements']),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'license':'ODbL 1.0','attribution':'OpenStreetMap contributors'}
(ROOT/'evidence/RIVER_SOURCE_LOCK.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(meta,ensure_ascii=False),flush=True)
