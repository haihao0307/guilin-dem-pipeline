"""Build source-traceable V200 vector numbers, not rendered images or persisted meshes."""
from pathlib import Path
import json,gzip,hashlib,argparse,math,heapq
import numpy as np,shapely
from shapely.geometry import shape,box,LineString,Point,mapping
from shapely.ops import unary_union,polygonize_full
from shapely.strtree import STRtree
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--polygons',required=True);p.add_argument('--output',required=True);a=p.parse_args()
s=Path(a.source);out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
co=json.loads((s/'WENZHOU_COASTLINE_EPSG32651.geojson').read_text())['features'];rr=json.loads((s/'WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson').read_text())['features'];wf=json.loads(Path(a.polygons).read_text())['features'];aoi=box(187912.5,3019612.5,407350,3243587.5)
coast=[f['geometry']['coordinates'] for f in co if f['geometry']['type']=='LineString'];lines=[LineString(c).intersection(aoi) for c in coast];lines=[l for l in lines if not l.is_empty]
polys,cuts,dangles,invalid=polygonize_full(unary_union([aoi.boundary,*lines]));segments=[];oriented=[]
for c in coast:
 for p0,p1 in zip(c,c[1:]):
  if p0==p1:continue
  segments.append(LineString([p0,p1]));oriented.append((p0,p1))
tree=STRtree(segments);ocean=[];land=[]
for face in polys.geoms:
 p=face.representative_point();i=int(tree.nearest(p));q0,q1=oriented[i];side=(q1[0]-q0[0])*(p.y-q0[1])-(q1[1]-q0[1])*(p.x-q0[0]);(ocean if side<0 else land).append(face)
marine_geoms=[shape(f['geometry']).intersection(aoi) for f in wf if f.get('properties',{}).get('natural') in ('bay','strait')]
closed_islands=[g for g in land if g.distance(aoi.boundary)>1e-5]
sea=unary_union([*ocean,*marine_geoms]).difference(unary_union(closed_islands));shapely.prepare(sea)
def rings(poly):return [list(poly.exterior.coords),*[list(r.coords) for r in poly.interiors]]
def polys_of(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for q in getattr(g,'geoms',[]) for p in polys_of(q)]
inland=[];reservoirs=0;others=0;areas=[]
for f in wf:
 pr=f.get('properties',{});tags=pr.get('tags',pr)
 if tags.get('water')=='reservoir' or tags.get('landuse')=='reservoir' or tags.get('reservoir_type') or '水库' in str(tags.get('name','')) or 'reservoir' in str(tags.get('name:en','')).lower():
  reservoirs+=1;continue
 if tags.get('water')=='river' or tags.get('waterway') in ('riverbank','tidal_channel') or tags.get('tidal')=='yes':
  geom=shape(f['geometry']).intersection(aoi)
  if not geom.is_valid:geom=shapely.make_valid(geom)
  inland.extend(rings(p) for p in polys_of(geom))
 else:others+=1
node_index={};nodes=[];edges=[];rivers=[]
def node(xy):
 k=(float(xy[0]),float(xy[1]))
 if k not in node_index:node_index[k]=len(nodes);nodes.append(k);edges.append([])
 return node_index[k]
for f in rr:
 if f['geometry']['type']!='LineString':continue
 pr=f.get('properties',{});c=f['geometry']['coordinates'];ids=[node(v) for v in c]
 for i,j in zip(ids,ids[1:]):
  d=math.dist(nodes[i],nodes[j]);edges[i].append((j,d));edges[j].append((i,d))
 kind=pr.get('waterway','stream');width=pr.get('width') or pr.get('est_width');observed=False
 try:width=float(str(width).split()[0]);observed=width>0
 except (ValueError,TypeError):width=None
 if not observed:width={'river':18.,'canal':5.,'stream':2.5,'tidal_channel':10.}.get(kind,2.5)
 rivers.append({'id':pr.get('source_way_id'),'name':pr.get('name',''),'kind':kind,'widthM':min(5000,max(.3,width)),'widthSource':'OSM tag' if observed else 'unmeasured visual candidate','coords':c,'nodes':ids})
xy=np.asarray(nodes);seeds=np.flatnonzero(shapely.intersects_xy(sea,xy[:,0],xy[:,1]));distance=np.full(len(nodes),np.inf);heap=[]
for i in seeds:distance[i]=0;heap.append((0.,int(i)))
heapq.heapify(heap)
while heap:
 d,i=heapq.heappop(heap)
 if d!=distance[i]:continue
 for j,w in edges[i]:
  q=d+w
  if q<distance[j]:distance[j]=q;heapq.heappush(heap,(q,j))
for r in rivers:r['tidalDistancesM']=[round(float(distance[i]),3) if math.isfinite(distance[i]) else -1 for i in r.pop('nodes')]
islands=[]
for g in land:
 if 2e4<g.area<1e8 and g.distance(aoi.boundary)>1:
  cen=g.centroid;islands.append([cen.x,cen.y,math.sqrt(g.area/math.pi),g.area])
islands=sorted(islands,key=lambda x:-x[3])[:24]
v={'schema':'wenzhou-v7-source-vectors-1','crs':'EPSG:32651','coastlines':coast,'ocean':[rings(p) for p in polys_of(sea)],'inlandRiverWater':inland,'rivers':rivers,'riverCount':len(rivers),'opticalIslands':[x[:3] for x in islands],'reservoirsExcluded':reservoirs,'otherStaticWaterNotRendered':others,'graphNodes':len(nodes),'marineSeedNodes':len(seeds),'connectedNodes':int(np.isfinite(distance).sum()),'manualBridges':0,'absoluteTidalReachVerified':False,'marineCoverageKind':'source bay and strait polygons minus closed coastline islands; offshore beyond source faces remains unknown','oceanAreaKm2':sea.area/1e6,'polygonization':{'oceanFaces':len(ocean),'landFaces':len(land),'cuts':len(cuts.geoms),'dangles':len(dangles.geoms),'invalid':len(invalid.geoms)},'sourceHashes':{q.name:hashlib.sha256(q.read_bytes()).hexdigest() for q in [s/'WENZHOU_COASTLINE_EPSG32651.geojson',s/'WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson',Path(a.polygons)]},'attribution':'© OpenStreetMap contributors; ODbL 1.0; modern observations with candidate historical filtering'}
b=json.dumps(v,ensure_ascii=False,separators=(',',':')).encode();out.write_bytes(gzip.compress(b,compresslevel=6,mtime=0));report={k:v[k] for k in ['riverCount','reservoirsExcluded','graphNodes','marineSeedNodes','connectedNodes','manualBridges','polygonization','sourceHashes']};report.update({'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()});out.with_suffix('.qa.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
