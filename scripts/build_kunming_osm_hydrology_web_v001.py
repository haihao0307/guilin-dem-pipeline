#!/usr/bin/env python3
from __future__ import annotations
import argparse, gzip, hashlib, json, math, re
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely.geometry import shape, box, Polygon, MultiPolygon, LineString, MultiLineString, GeometryCollection
from shapely.ops import transform
import shapely

BOUNDS=(243875.0,2719987.5,317525.0,2821175.0)
LEFT,BOTTOM,RIGHT,TOP=BOUNDS
CX=(LEFT+RIGHT)/2; CY=(BOTTOM+TOP)/2
WORLD_W=RIGHT-LEFT; WORLD_H=TOP-BOTTOM
ELEV_MIN=1280.53662109375; ELEV_MAX=2788.21044921875; ELEV_MEAN=1994.944580078125; ELEV_SPAN=ELEV_MAX-ELEV_MIN
SOURCE_DEM_SHA='af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50'
CROP_DEM_SHA='9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2'
ARTIFACT_SHA='919b1bb0d06b1fb479e0681deeb3c4fc2867dc78ee229a0a5af3723ba20e4c01'
CROP=box(*BOUNDS)
TRANSFORMER=Transformer.from_crs('EPSG:4326','EPSG:32648',always_xy=True)
CLASS_ID={'river':0,'stream':1,'canal':2,'drain':3,'ditch':4,'tidal_channel':5,'flowline':6}
AREA_CLASS={'lake':0,'reservoir':1,'river':2,'pond':3,'basin':4,'canal':5,'oxbow':6,'lagoon':7,'wastewater':8}

def sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()
def tf_geom(g):return transform(TRANSFORMER.transform,g)
def world(x,y):return x-CX,y-CY

def parse_width(tags,cls):
    raw=(tags or {}).get('width')
    if raw:
        m=re.search(r'[-+]?\d+(?:\.\d+)?',str(raw))
        if m:
            v=float(m.group(0))*(0.3048 if 'ft' in str(raw).lower() else 1.0)
            if .5<=v<=5000:return v
    return {'river':28.0,'stream':8.0,'canal':12.0,'drain':4.0,'ditch':3.0,'tidal_channel':18.0,'flowline':22.0}.get(cls,6.0)

def iter_polys(g):
    if isinstance(g,Polygon):yield g
    elif isinstance(g,MultiPolygon):yield from g.geoms
    elif isinstance(g,GeometryCollection):
        for q in g.geoms:yield from iter_polys(q)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--artifact-dir',type=Path,required=True)
    ap.add_argument('--height-image',type=Path,required=True)
    ap.add_argument('--output-dir',type=Path,required=True)
    args=ap.parse_args()
    art=args.artifact_dir/'distilled'; out=args.output_dir; data=out/'data'; data.mkdir(parents=True,exist_ok=True)
    height=np.asarray(Image.open(args.height_image).convert('RGB'),dtype=np.uint8)
    hnorm=((height[...,0].astype(np.uint16)<<8)|height[...,1].astype(np.uint16)).astype(np.float64)/65535.0
    hi,wi=hnorm.shape
    def sample_height(x,y):
        u=min(1,max(0,(x-LEFT)/WORLD_W));v=min(1,max(0,(TOP-y)/WORLD_H));px=u*(wi-1);py=v*(hi-1)
        x0=int(math.floor(px));y0=int(math.floor(py));x1=min(wi-1,x0+1);y1=min(hi-1,y0+1);tx=px-x0;ty=py-y0
        n=hnorm[y0,x0]*(1-tx)*(1-ty)+hnorm[y0,x1]*tx*(1-ty)+hnorm[y1,x0]*(1-tx)*ty+hnorm[y1,x1]*tx*ty
        return ELEV_MIN+n*ELEV_SPAN
    def read(rel):return json.loads((art/rel).read_text(encoding='utf-8'))
    waterways=read('osm-current/waterways.geojson')['features'];waterareas=read('osm-current/water_areas.geojson')['features'];ohmways=read('ohm-history/waterways.geojson')['features']
    osm_summary=read('osm-current/SUMMARY.json');ohm_summary=read('ohm-history/SUMMARY.json');hist_review=read('HISTORICAL_REVIEW.json')
    named_rivers=[]
    def build_lines(features,historical=False):
        records=[];feature_count=0;segment_count=0
        for f in features:
            tags=f.get('properties',{}).get('tags') or {};cls=tags.get('waterway','stream');g=tf_geom(shape(f['geometry'])).intersection(CROP)
            if g.is_empty:continue
            if isinstance(g,LineString):parts=[g]
            elif isinstance(g,MultiLineString):parts=list(g.geoms)
            elif isinstance(g,GeometryCollection):parts=[x for x in g.geoms if isinstance(x,LineString)]
            else:parts=[]
            local=0
            for line in parts:
                if line.length<2:continue
                line=line.simplify(8.0,preserve_topology=True);coords=list(line.coords)
                if len(coords)<2:continue
                distance=0.0;width=parse_width(tags,cls);cid=CLASS_ID.get(cls,1)
                for (x0,y0),(x1,y1) in zip(coords,coords[1:]):
                    dx=x1-x0;dz=y1-y0;ln=math.hypot(dx,dz)
                    if ln<.5:continue
                    nx=-dz/ln;nz=dx/ln;wx0,wz0=world(x0,y0);wx1,wz1=world(x1,y1);hy0=sample_height(x0,y0)-ELEV_MEAN+2.6;hy1=sample_height(x1,y1)-ELEV_MEAN+2.6
                    vertices=[((wx0,hy0,wz0),-1,distance),((wx0,hy0,wz0),1,distance),((wx1,hy1,wz1),-1,distance+ln),((wx1,hy1,wz1),-1,distance+ln),((wx0,hy0,wz0),1,distance),((wx1,hy1,wz1),1,distance+ln)]
                    for p,side,d in vertices:records.extend([p[0],p[1],p[2],nx,nz,float(side),d,width,float(cid)])
                    distance+=ln;local+=1
            if local:
                feature_count+=1;segment_count+=local;name=tags.get('name:zh') or tags.get('name') or tags.get('name:en')
                if name:
                    c=g.centroid;named_rivers.append({'name':name,'class':cls,'osmId':f['properties'].get('osm_id'),'lengthKm':round(g.length/1000,2),'x':round(c.x-CX,1),'z':round(c.y-CY,1),'historicalCandidate':historical})
        return records,feature_count,segment_count
    river_records,river_feature_count,river_segment_count=build_lines(waterways,False)
    ohm_records,ohm_feature_count,ohm_segment_count=build_lines(ohmways,True)
    water_records=[];water_feature_count=0;water_tri_count=0;named_areas=[]
    for f in waterareas:
        geom=shape(f['geometry'])
        if geom.geom_type not in ('Polygon','MultiPolygon'):continue
        g=tf_geom(geom).intersection(CROP)
        if g.is_empty:continue
        tags=f.get('properties',{}).get('tags') or {};cls=tags.get('water') or ('reservoir' if tags.get('landuse')=='reservoir' else 'water');cid=AREA_CLASS.get(cls,9);feature_area=0.;feature_tri=0
        for poly in iter_polys(g):
            if poly.area<30:continue
            poly=poly.simplify(6.25,preserve_topology=True)
            if not poly.is_valid:poly=poly.buffer(0)
            if poly.is_empty:continue
            coords=list(poly.exterior.coords);step=max(1,len(coords)//64);hs=[sample_height(x,y) for x,y in coords[::step]];rp=poly.representative_point();hs.append(sample_height(rp.x,rp.y));level=float(np.percentile(hs,35))+1.8
            for tri in shapely.constrained_delaunay_triangles(poly).geoms:
                if tri.area<=0 or not poly.covers(tri.representative_point()):continue
                for x,y in list(tri.exterior.coords)[:3]:
                    wx,wz=world(x,y);water_records.extend([wx,level-ELEV_MEAN,wz,float(cid)])
                feature_tri+=1
            feature_area+=poly.area
        if feature_tri:
            water_feature_count+=1;water_tri_count+=feature_tri;name=tags.get('name:zh') or tags.get('name') or tags.get('name:en')
            if name:
                c=g.centroid;named_areas.append({'name':name,'class':cls,'osmId':f['properties'].get('osm_id'),'areaKm2':round(feature_area/1e6,4),'x':round(c.x-CX,1),'z':round(c.y-CY,1)})
    def unique(items,metric):
        items.sort(key=lambda x:x[metric],reverse=True);seen=set();out=[]
        for x in items:
            k=(x['name'],x['class'])
            if k not in seen:seen.add(k);out.append(x)
        return out
    named_areas=unique(named_areas,'areaKm2');named_rivers=unique(named_rivers,'lengthKm')
    def write(name,records):
        raw=data/name;np.asarray(records,dtype='<f4').tofile(raw);gz=raw.with_suffix(raw.suffix+'.gz');gz.write_bytes(gzip.compress(raw.read_bytes(),compresslevel=9));raw.unlink();return gz
    river_gz=write('rivers.f32',river_records);area_gz=write('water_areas.f32',water_records);ohm_gz=write('ohm_candidates.f32',ohm_records)
    binary={
      'rivers':{'file':'data/'+river_gz.name,'compression':'gzip','strideFloats':9,'vertexCount':len(river_records)//9,'compressedBytes':river_gz.stat().st_size,'compressedSha256':sha(river_gz)},
      'waterAreas':{'file':'data/'+area_gz.name,'compression':'gzip','strideFloats':4,'vertexCount':len(water_records)//4,'compressedBytes':area_gz.stat().st_size,'compressedSha256':sha(area_gz)},
      'ohmCandidates':{'file':'data/'+ohm_gz.name,'compression':'gzip','strideFloats':9,'vertexCount':len(ohm_records)//9,'compressedBytes':ohm_gz.stat().st_size,'compressedSha256':sha(ohm_gz)}}
    meta={
      'schemaVersion':'kunming_osm_hydrology_web@1.0.0','generatedAtUtc':datetime.now(timezone.utc).isoformat(),
      'sourceArtifact':{'name':'kunming-hydrology-knowledge-v001','runId':32925496927,'artifactId':9591349015,'sha256':ARTIFACT_SHA},
      'authoritativeDem':{'sha256':CROP_DEM_SHA,'sourceSha256':SOURCE_DEM_SHA,'crs':'EPSG:32648','pixelSpacingMeters':12.5,'grid':[5892,8095],'bounds':list(BOUNDS),'widthMeters':WORLD_W,'heightMeters':WORLD_H,'areaKm2':7452.459375,'compression':'NONE','resampled':False,'elevation':{'min':ELEV_MIN,'max':ELEV_MAX,'mean':ELEV_MEAN}},
      'browserTerrain':{'heightTexture':[2048,2814],'surfaceTexture':[2048,2814],'meshDesktop':[896,1231],'meshCompatibility':[640,879],'proceduralNoise':False,'verticalScale':1.0},
      'osmCurrent':{'retrievedAtUtc':'2026-08-26T03:11:27.527968+00:00','endpoint':'https://overpass-api.de/api/interpreter','rawSha256':'2147f3927b7f9af6faadef9cd36e4e526b74fdfcec5fb6712526d033328e6be9','sourceCounts':osm_summary['counts'],'sourceElementCount':osm_summary['elementCount'],'webClippedWaterwayFeatures':river_feature_count,'webRiverSegments':river_segment_count,'webWaterAreaFeatures':water_feature_count,'webWaterTriangles':water_tri_count,'acceptedHistoricalTruth':False,'role':'modern OSM reference only','attribution':'© OpenStreetMap contributors, ODbL 1.0'},
      'openHistoricalMap':{'sourceCounts':ohm_summary['counts'],'sourceElementCount':ohm_summary['elementCount'],'webCandidateFeatures':ohm_feature_count,'webCandidateSegments':ohm_segment_count,'dateTaggedFeatureCount':ohm_summary['dateTaggedFeatureCount'],'acceptedHistoricalTruthCount':0,'defaultVisible':False},
      'historical':{'targetEpoch':[1940,1945],'acceptedHistoricalTruthCount':0,'status':'source verification pending','nextPriority':hist_review['nextHistoricalPriority']},
      'displayRules':{'handDrawnWaterCount':0,'riverCenterlinesFixed':True,'widthSliderChangesLateralWidthOnly':True,'lakeShorelinesFixed':True,'wavesChangeMaterialOnly':True,'flowAnimationUsesStoredOsmWayDirection':True,'modernOsmLabelRequired':True},
      'binary':binary,'namedWaterAreas':named_areas[:120],'namedWaterways':named_rivers[:160]}
    (data/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    report={'status':'complete','riverFeatureCount':river_feature_count,'riverSegmentCount':river_segment_count,'waterAreaFeatureCount':water_feature_count,'waterTriangleCount':water_tri_count,'ohmCandidateFeatureCount':ohm_feature_count,'ohmCandidateSegmentCount':ohm_segment_count,'historicalVerifiedCount':0,'handDrawnWaterCount':0,'binary':binary}
    (out/'BUILD_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
