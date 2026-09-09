from pathlib import Path
import json,hashlib,math
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[1]
S=Path('G:/DEM/Wenzhou_3D_Lab_R3_20260909/site')
D=S/'dist/r3-1/data'
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
locks=read(R/'evidence/R3_FIXED_FILE_LOCK.json')
for f in locks:assert (S/f['path']).stat().st_size==f['bytes'] and digest(S/f['path'])==f['sha256'],f['path']
c=read(D/'terrain.json');land=read(D/'land.json');rivers=read(D/'rivers.json')
for p in c['patches']:
 for field,sha in [('measurementFile','measurementSha256'),('validCellFile','validCellSha256')]:
  f=S/'dist'/p[field].lstrip('/') if p[field].startswith('/') else D/p[field]
  assert digest(f)==p[sha]
  assert f.stat().st_size==(p['rows']*p['columns']*2 if field=='measurementFile' else (p['rows']-1)*(p['columns']-1))
for file,sha in [('landFile','landSha256'),('riversFile','riversSha256')]:assert digest(D/c['hydrography'][file])==c['hydrography'][sha]
polys=[Polygon(p[0],p[1:]) for p in land['polygons']]
assert all(p.is_valid for p in polys)
region=unary_union(polys)
assert abs(region.area/1e6-land['areaKm2'])<.1
# Rounded coast/intersection endpoints can differ by <= sqrt(2)*0.001 m
# between independently rounded records. Use 3 mm for this numeric check only.
tolerant=region.buffer(.003)
outside=0;total=0;classes={}
for f in rivers['features']:
 assert f['id']=='osm-way-'+str(f['osmWayId'])
 classes[f['kind']]=classes.get(f['kind'],0)+1
 for line in f['landDisplayLines']:
  for xy in line[::max(1,len(line)//8)]:
   total+=1;outside+=not tolerant.covers(Point(xy))
assert outside==0,outside
qa={'passed':True,'r3FilesUnchanged':len(locks),'patchHashesChecked':len(c['patches'])*2,'validLandPolygonCount':len(polys),'landAreaKm2':region.area/1e6,'riverFeatureCount':len(rivers['features']),'riverClasses':classes,'sampledDisplayRiverVerticesInsideLand':total,'outsideLandVertices':outside,'coordinateToleranceM':.003,'physicalAccuracyEstablished':False,'marineRemovedByPolygonNotElevation':True,'sourceDEMUnmodified':True,'waterLevel':None,'seaSurfaceCreated':False,'freshCompleteRiverSnapshot':False}
(R/'HYDRO_QA_R3_1.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
unique={}
for p in c['patches']:
 for key in ['measurementFile','validCellFile']:
  f=S/'dist'/p[key].lstrip('/') if p[key].startswith('/') else D/p[key];unique[str(f)]=f
data=sum(f.stat().st_size for f in unique.values())+sum((D/f).stat().st_size for f in ['terrain.json','land.json','rivers.json'])
newfiles=[f for f in (S/'dist/r3-1').rglob('*') if f.is_file()]
size={'unit':'decimal bytes, MB=1000000 bytes','r3TerrainAndRulesBytes':7717525,'r3WholeViewerBytes':9907780,'r3GzipArchiveBytes':2874944,'r3_1PersistentMeasurementRulesAndHydroBytes':data,'r3_1RouteAdditionalBytes':sum(f.stat().st_size for f in newfiles),'wholeSiteIncludingPreservedR3Bytes':sum(f.stat().st_size for f in (S/'dist').rglob('*') if f.is_file()),'fullCanonicalArchiveAndIndexBytes':62412887,'globalLandIngestionZipBytes':925678592,'globalZipPublished':False,'peakBrowserRAMBytes':None,'actualNetworkTransferBytes':None}
(R/'SIZE_REPORT_R3_1.json').write_text(json.dumps(size,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'qa':qa,'sizes':size},ensure_ascii=False))
