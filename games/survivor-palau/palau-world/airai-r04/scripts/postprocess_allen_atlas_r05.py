#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import xml.etree.ElementTree as ET
import geopandas as gpd
import requests
from shapely.geometry import box

CONTEXT=[134.49,7.27,134.64,7.42]
CORE=[134.535,7.315,134.605,7.385]
LAYERS={
  'geomorphic':'coral-atlas:geomorphic_data_verbose',
  'benthic':'coral-atlas:benthic_data_verbose',
}
WFS='https://allencoralatlas.org/geoserver/wfs'

def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1<<20),b''): h.update(b)
    return h.hexdigest()

def write_json(p,obj):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def clip(g,bounds):
    if g.crs is None: g=g.set_crs(4326)
    g=g.to_crs(4326)
    b=box(*bounds)
    x=g[g.geometry.notna() & ~g.geometry.is_empty & g.geometry.intersects(b)].copy()
    if len(x): x.geometry=x.geometry.intersection(b)
    return x[x.geometry.notna() & ~x.geometry.is_empty]

def area_km2(g):
    return 0.0 if g.empty else float(g.to_crs(32653).geometry.area.sum()/1e6)

def props(g):
    out={}
    for c in g.columns:
        if c==g.geometry.name: continue
        v=g[c].dropna().astype(str)
        if v.empty: continue
        n=int(v.nunique())
        if n<=30 or any(k in c.lower() for k in ('class','zone','label','habitat','region','type')):
            out[c]={'unique':n,'top':{str(k):int(x) for k,x in v.value_counts().head(30).items()}}
    return out

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--intake',type=Path,required=True); ap.add_argument('--results',type=Path,required=True); a=ap.parse_args()
    intake=a.intake.resolve(); results=a.results.resolve(); results.mkdir(parents=True,exist_ok=True)
    cap=intake/'metadata/allen/wfs_capabilities.xml'; maps=intake/'metadata/allen/maps.json'
    root=ET.parse(cap).getroot(); ns={'wfs':'http://www.opengis.net/wfs/2.0','ows':'http://www.opengis.net/ows/1.1'}
    service={
      'title':root.findtext('.//ows:ServiceIdentification/ows:Title',namespaces=ns),
      'accessConstraints':root.findtext('.//ows:ServiceIdentification/ows:AccessConstraints',namespaces=ns),
      'updateSequence':root.attrib.get('updateSequence'),
      'featureTypes':[ft.findtext('wfs:Name',namespaces=ns) for ft in root.findall('.//wfs:FeatureType',ns)],
    }
    mapmeta=json.loads(maps.read_text()); western=[m for m in mapmeta if m.get('region_name')=='Western Micronesia']
    sess=requests.Session(); sess.headers['User-Agent']='KAOPU-Palau-Airai-Allen-R05/1.0'
    summaries={}; source={}
    for role,layer in LAYERS.items():
        params={'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':layer,'outputFormat':'application/json','srsName':'EPSG:4326','bbox':','.join(map(str,CONTEXT))+',EPSG:4326','count':200000}
        r=sess.get(WFS,params=params,timeout=240); r.raise_for_status(); data=r.json()
        sp=results/f'vectors/ALLEN_{role.upper()}_CONTEXT_SOURCE_R05.geojson'; write_json(sp,data)
        g=gpd.read_file(sp); gc=clip(g,CONTEXT); gcore=clip(g,CORE)
        cp=results/f'vectors/ALLEN_{role.upper()}_CORE_R05.geojson'
        if gcore.empty: write_json(cp,{'type':'FeatureCollection','features':[]})
        else: gcore.to_file(cp,driver='GeoJSON')
        source[role]={'url':r.url,'featureCountReturned':len(data.get('features',[])),'bytes':sp.stat().st_size,'sha256':sha256(sp)}
        summaries[role]={'sourceLayer':layer,'contextFeatureCount':int(len(gc)),'coreFeatureCount':int(len(gcore)),'contextFeatureAreaKm2':area_km2(gc),'coreFeatureAreaKm2':area_km2(gcore),'properties':props(gcore if len(gcore) else gc)}
    authp=intake/'metadata/AUTH_GATED_SOURCES.json'; auth=json.loads(authp.read_text()) if authp.exists() else {}
    report={
      'schema':'kaopu.palau.allen-coral-atlas-r05/1.0','contextBBoxWGS84':CONTEXT,'coreBBoxWGS84':CORE,
      'service':service,'westernMicronesiaMapMetadata':western,'sourceFetch':source,'layers':summaries,
      'bathymetryAccess':{'documentedProduct':'10 m satellite-derived bathymetry GeoTIFF','automationAcquisitionStatus':auth.get('allenCoralAtlasBathymetry',{}).get('status','NOT_ACQUIRED'),'usedInCandidateDepthGrid':False},
      'methodBoundary':{'geomorphicNominalMappingDepth':'~15 m','benthicNominalMappingDepth':'~10 m','reefExtentServiceStatus':'Current WFS capabilities advertise benthic and geomorphic vector layers only.','important':'These shallow habitat vectors are not a complete mask for 60-70 m channels or all reef-interior water.'},
      'candidateGridMutation':False,'candidateGridReason':'Do not clip the bathymetry grid with shallow habitat polygons; that would erase legitimate deeper lagoon/channel water.'
    }
    write_json(results/'ALLEN_CORAL_ATLAS_R05.json',report)
    ep=results/'AIRAI_REEF_EVIDENCE_REPORT.json'
    if ep.exists():
        e=json.loads(ep.read_text()); e['allenCoralAtlasR05']=report; write_json(ep,e)
    print(json.dumps({'westernMicronesia':western,'layers':summaries},indent=2))
if __name__=='__main__': main()
