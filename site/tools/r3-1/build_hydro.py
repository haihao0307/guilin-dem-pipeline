from pathlib import Path
import json,hashlib,zipfile,io,time,shutil,math
import numpy as np
import shapefile
import shapely
from shapely.geometry import shape,box,Point,mapping,LineString,Polygon
from shapely.ops import transform,unary_union
from pyproj import Transformer,CRS

ROOT=Path(__file__).resolve().parents[1]
R3=Path('G:/DEM/Wenzhou_3D_Lab_R3_20260909')
OUT=R3/'site/dist/r3-1/data';OUT.mkdir(parents=True,exist_ok=True)
RAW=Path('G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/OSM_WATERWAYS_SOURCE_WGS84.geojson')
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
tr=Transformer.from_crs(4326,32651,always_xy=True);inv=Transformer.from_crs(32651,4326,always_xy=True)
area=box(190475,2991275,411250,3241862.5)
bounds=inv.transform_bounds(*area.bounds,densify_pts=50)
land_lock=json.loads((ROOT/'evidence/LAND_SOURCE_LOCK.json').read_text(encoding='utf-8'))
assert sha(ROOT/'evidence/land-polygons-split-4326.zip')==land_lock['sha256']
start=time.perf_counter();land_parts=[];selected=0
with zipfile.ZipFile(ROOT/'evidence/land-polygons-split-4326.zip') as z:
 entries={ext:next(n for n in z.namelist() if n.lower().endswith(ext)) for ext in ('.shp','.shx','.dbf','.prj')}
 crs=CRS.from_wkt(z.read(entries['.prj']).decode());assert crs.to_epsg()==4326
 with shapefile.Reader(shp=z.open(entries['.shp']),shx=io.BytesIO(z.read(entries['.shx'])),dbf=io.BytesIO(z.read(entries['.dbf']))) as reader:
  for rec in reader.iterShapes(bbox=bounds):
   poly=shape(rec.__geo_interface__)
   assert poly.is_valid,'Preprocessed source polygon is invalid; do not repair silently'
   proj=transform(tr.transform,poly).intersection(area)
   if not proj.is_empty:
    land_parts.append(proj);selected+=1
land=unary_union(land_parts)
assert land.is_valid and 0<land.area<area.area
print('Land faces',selected,'regional area km2',land.area/1e6,flush=True)

# Limit serialized coordinate quantization to 1 mm in the projected frame.
def rounded_ring(ring):return [[round(x,3),round(y,3)] for x,y in ring.coords]
polys=list(land.geoms) if land.geom_type=='MultiPolygon' else [land]
serialized=[[rounded_ring(p.exterior),*[rounded_ring(h) for h in p.interiors]] for p in polys]
shore=land.boundary.difference(area.boundary.buffer(.01))
def lines(g):
 if g.is_empty:return []
 if g.geom_type=='LineString':return [g]
 if g.geom_type in ('MultiLineString','GeometryCollection'):return [l for item in g.geoms for l in lines(item)]
 return []
coastlines=[[[round(x,3),round(y,3)] for x,y in l.coords] for l in lines(shore)]
land_data={'schema':'wenzhou-planimetric-land-domain/r3.1','id':'WZ-OSM-LAND-R3-1','frame':'EPSG:32651','units':'m','source':land_lock,
 'rule':'Union of preprocessed OSM land polygons, transformed from EPSG:4326 then intersected with DEM outer bounds. Overlapping split polygons unioned before display.',
 'polygons':serialized,'coastlines':coastlines,'domainBounds':list(area.bounds),'areaKm2':land.area/1e6,
 'semantics':'Plan-view land classification from mapped coastline. Not sea level, tidal state, bathymetry, or proof of hydrological connectivity.',
 'coordinateQuantizationMaxM':math.sqrt(2)*.0005,'sourcePhysicalUncertaintyM':None,
 'rendering':'Polygons are persistent 2D region rules. Alpha texture and rendered surfaces are generated only at runtime and discarded.'}
write(OUT/'land.json',land_data)

# The live endpoint timed out. Use the explicitly dated archived OSM measurement
# snapshot, without importing any old renderer, draping buffer or production code.
raw=json.loads(RAW.read_text(encoding='utf-8-sig'))
riverlock={'path':str(RAW),'sha256':sha(RAW),'bytes':RAW.stat().st_size,'metadata':raw['metadata'],
 'freshRequest':'Overpass API 504; current snapshot not obtained','freshness':'Mixed dated archive; not claimed current or complete',
 'originalField':'Source WGS84 geometry, not prior draped display output','license':'ODbL 1.0','attribution':'OpenStreetMap contributors'}
write(ROOT/'evidence/RIVER_SOURCE_LOCK.json',riverlock)
river_records=[];named_geometries={};classes={};seen=set();excluded_zero=0
for f in raw['features']:
 prop=f['properties'];wid=prop['source_way_id'];assert wid not in seen;seen.add(wid)
 kind=prop.get('waterway');classes[kind]=classes.get(kind,0)+1
 assert prop.get('source_geometry_preserved') is True
 geom=shape(f['geometry']);assert geom.geom_type=='LineString' and geom.is_valid
 clipped=transform(tr.transform,geom).intersection(area)
 # Preserve canonical mapped line parts in data. Land-only display intersections
 # are distinct and do not erase the original source reference.
 original_lines=lines(clipped)
 visible_lines=lines(clipped.intersection(land))
 if not original_lines:continue
 name=prop.get('name')
 rec={'id':f'osm-way-{wid}','osmWayId':wid,'name':name,'kind':kind,'lines':[[[round(x,3),round(y,3)] for x,y in l.coords] for l in original_lines],
 'landDisplayLines':[[[round(x,3),round(y,3)] for x,y in l.coords] for l in visible_lines],
 'snapshot':prop.get('source_origin'),'sourceNodeIdsKnown':bool(prop.get('source_node_ids'))}
 river_records.append(rec)
 if name and visible_lines:named_geometries.setdefault(name,[]).extend(visible_lines)
river_data={'schema':'wenzhou-mapped-waterway-curves/r3.1','frame':'EPSG:32651','unit':'m','source':riverlock,
 'semantics':{'geometry':'Mapped centreline polyline; source shape retained within requested domain','width':None,'waterLevel':None,'riverBed':None,'flowDirection':None,'physicalConnections':'unknown; coincident drawing is not proof','landDisplayLines':'Derived intersection for display only; original mapped line/source ID retained'},
 'features':river_records,'sourceClassCounts':classes,'coordinateQuantizationMaxM':math.sqrt(2)*.0005}
write(OUT/'rivers.json',river_data)
print('Waterways',len(river_records),classes,flush=True)

contract=json.loads((R3/'site/dist/r3/data/terrain.json').read_text(encoding='utf-8'))
contract['version']='R3.1';contract['object']['revision']='R3.1'
for p in contract['patches']:
 p['measurementFile']='/r3/data/'+p['measurementFile'];p['validCellFile']='/r3/data/'+p['validCellFile']
H,W=contract['source']['shape'];grid=np.memmap(R3/'decoded-source.i16',dtype='<i2',mode='r',shape=(H,W));ND=contract['source']['noData']
assert sha(R3/'decoded-source.i16')==contract['source']['decodedGridSha256']
def nodes(a,b,s):
 v=np.arange(a,b+1,s,dtype='i4');return np.append(v,b).astype('i4') if v[-1]!=b else v
def window(c,span,limit):
 a=max(0,min(c-span//2,limit-span-1));return a,min(limit-1,a+span)
focus=[]
for ident,name in [('oujiang','瓯江'),('feiyun','飞云江'),('aojiang','鳌江')]:
 assert name in named_geometries,f'Missing named source: {name}'
 # Source-defined eastern extent gives a reproducible focus, not an asserted
 # surveyed river mouth. UI says near-view, not exact estuary boundary.
 e,n=max((xy for g in named_geometries[name] for xy in g.coords),key=lambda p:p[0])
 r=int((3241862.5-n)/12.5);c=int((e-190475)/12.5)
 ra,rb=window(r,1600,H);ca,cb=window(c,1600,W);rr,cc=nodes(ra,rb,4),nodes(ca,cb,4)
 values=np.asarray(grid[np.ix_(rr,cc)],dtype='<i2');valid=np.empty((len(rr)-1,len(cc)-1),dtype='u1')
 for j,(r0,r1) in enumerate(zip(rr[:-1],rr[1:])):
  bad=np.any(grid[r0:r1+1,ca:cb+1]==ND,axis=0);prefix=np.concatenate(([0],np.cumsum(bad,dtype='i4')))
  valid[j]=(prefix[cc[1:]-ca+1]-prefix[cc[:-1]-ca]==0)
 pid='river-'+ident; data=OUT/(pid+'.i16');mask=OUT/(pid+'.support.u8');data.write_bytes(values.tobytes());mask.write_bytes(valid.tobytes())
 vv=values[values!=ND]
 contract['patches'].append({'id':pid,'label':name+'近景','rowIndices':rr.tolist(),'columnIndices':cc.tolist(),'rows':len(rr),'columns':len(cc),
 'measurementFile':data.name,'measurementSha256':sha(data),'validCellFile':mask.name,'validCellSha256':sha(mask),'stepM':50,
 'heightRangeM':[int(vv.min()),int(vv.max())],'validCells':int(valid.sum()),'excludedCells':int(valid.size-valid.sum()),'frame':'EPSG:32651','source':'canonical-dem-r1',
 'canonicalRule':'wz-dem-bilinear-centres-r1','boundaryPolicy':'Original NoData support remains mandatory; coastline clips display separately','displayApproximation':{},
 'focusRule':'Easternmost source-mapped land-intersecting point of named waterway; not surveyed mouth position'})
 focus.append({'patch':pid,'name':name,'position':[e,n],'sourceWayIds':[f['osmWayId'] for f in river_records if f['name']==name]})
contract['hydrography']={'landFile':'land.json','landSha256':sha(OUT/'land.json'),'riversFile':'rivers.json','riversSha256':sha(OUT/'rivers.json'),'riverFocus':focus,
 'classification':'Mapped OSM land domain clips display only; original DEM integers and NoData untouched','seaSurfaceCreated':False,'seaLevel':None,
 'drawing':'River curves are map annotations, not measured river surfaces. Runtime anchors can follow display terrain with explicit visual lift.'}
contract['userFutureCameraTarget']={'eyeHeightAboveSurfaceM':1.6,'status':'Deferred by user; no metre-scale terrain precision inferred'}
write(OUT/'terrain.json',contract)
qa={'schema':'wenzhou-hydrography-preparation/r3.1','landGeometryValid':land.is_valid,'landPolygonsSelected':selected,'landUnionPieces':len(polys),'landAreaKm2':land.area/1e6,
 'mappedCoastlineSource':'FOSSGIS preprocessed land polygons; broken historical coastline NOT used for clipping',
 'waterwayFeatures':len(river_records),'sourceClassCounts':classes,'riverFreshness':'Archived mixed snapshot, explicitly not current/complete',
 'sourceDemUnchanged':True,'seaLevelInvented':False,'sourceGeometryPreserved':True,'sourceNodesMissingMeansConnectivityUnknown':True,'seconds':round(time.perf_counter()-start,2)}
write(ROOT/'HYDRO_PREP_QA_R3_1.json',qa);print(json.dumps(qa,ensure_ascii=False),flush=True)
