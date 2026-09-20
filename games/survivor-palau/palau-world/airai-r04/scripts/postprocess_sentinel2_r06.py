#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, hashlib, json
from pathlib import Path
from shapely.geometry import box, shape

CONTEXT=[134.49,7.27,134.64,7.42]
CORE=[134.535,7.315,134.605,7.385]
ANCHOR=[134.5667427743189,7.349032638038719]


def sha256(p:Path)->str:
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1<<20),b''): h.update(b)
    return h.hexdigest()


def write_json(p:Path,obj):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def num(v):
    try: return float(v)
    except Exception: return None


def scene_row(f,core_geom):
    p=f.get('properties',{}) or {}
    geom=f.get('geometry')
    overlap=0.0
    if geom:
        try:
            g=shape(geom)
            if g.is_valid and not g.is_empty:
                overlap=float(g.intersection(core_geom).area/core_geom.area)
        except Exception:
            overlap=0.0
    assets=f.get('assets',{}) or {}
    wanted=['blue','green','red','nir','scl','coastal']
    present=[k for k in wanted if k in assets]
    cloud=num(p.get('eo:cloud_cover'))
    nodata=num(p.get('s2:nodata_pixel_percentage'))
    shadow=num(p.get('s2:cloud_shadow_percentage'))
    thin=num(p.get('s2:thin_cirrus_percentage'))
    high=num(p.get('s2:high_proba_clouds_percentage'))
    med=num(p.get('s2:medium_proba_clouds_percentage'))
    sun_elev=num(p.get('view:sun_elevation'))
    sun_az=num(p.get('view:sun_azimuth'))
    solar_zen=(90.0-sun_elev) if sun_elev is not None else None
    # Ranking heuristic only. It is not a radiometric uncertainty model.
    penalty=0.0
    for val,w in ((cloud,1.0),(nodata,0.5),(shadow,0.8),(thin,0.5),(high,0.7),(med,0.3)):
        if val is not None: penalty += w*val
    if solar_zen is not None: penalty += max(0.0,solar_zen-35.0)*0.7
    if overlap < 0.999: penalty += (1.0-overlap)*100.0
    if not all(k in assets for k in ('blue','green','red','nir')): penalty += 50.0
    mgrs=''.join(str(p.get(k,'')) for k in ('mgrs:utm_zone','mgrs:latitude_band','mgrs:grid_square'))
    return {
      'id':f.get('id'),'datetime':p.get('datetime'),'platform':p.get('platform'),'collection':f.get('collection'),
      'cloudCoverPct':cloud,'nodataPct':nodata,'cloudShadowPct':shadow,'thinCirrusPct':thin,
      'highProbabilityCloudPct':high,'mediumProbabilityCloudPct':med,
      'sunElevationDeg':sun_elev,'sunAzimuthDeg':sun_az,'meanSolarZenithDeg':solar_zen,
      'coreFootprintOverlapFraction':overlap,'mgrs':mgrs or None,'processingBaseline':p.get('s2:processing_baseline'),
      'productUri':p.get('s2:product_uri'),'assetsPresent':present,'allRequiredOpticalAssets':all(k in assets for k in ('blue','green','red','nir')),
      'rankingPenaltyLowerIsBetter':round(penalty,6),
      'thumbnail':(assets.get('thumbnail') or {}).get('href'),
    }


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--intake',type=Path,required=True); ap.add_argument('--results',type=Path,required=True); a=ap.parse_args()
    intake=a.intake.resolve(); results=a.results.resolve(); results.mkdir(parents=True,exist_ok=True)
    search_p=intake/'metadata/sentinel2/search.json'; payload_p=intake/'metadata/sentinel2/search_payload.json'
    doc=json.loads(search_p.read_text())
    feats=doc.get('features',[])
    core=box(*CORE)
    rows=[scene_row(f,core) for f in feats]
    rows.sort(key=lambda r:(r['rankingPenaltyLowerIsBetter'], r['datetime'] or ''))
    fully=[r for r in rows if r['coreFootprintOverlapFraction']>=0.999]
    lowcloud=[r for r in fully if r['cloudCoverPct'] is not None and r['cloudCoverPct']<10]
    asset_sets={}
    for f in feats:
        keys=tuple(sorted((f.get('assets') or {}).keys()))
        asset_sets[str(keys)]=asset_sets.get(str(keys),0)+1
    report={
      'schema':'kaopu.palau.sentinel2-scene-metadata-r06/1.1',
      'contextBBoxWGS84':CONTEXT,'coreBBoxWGS84':CORE,'userConfirmedAnchorWGS84':ANCHOR,
      'source':{
        'catalog':'Element 84 Earth Search STAC v1','collection':'sentinel-2-c1-l2a',
        'searchFile':'metadata/sentinel2/search.json','searchSha256':sha256(search_p),
        'searchPayloadFile':'metadata/sentinel2/search_payload.json','searchPayloadSha256':sha256(payload_p) if payload_p.exists() else None,
        'featureCountReturned':len(feats)
      },
      'sceneSummary':{
        'fullCoreCoverageCount':len(fully),'fullCoreCoverageCloudLt10Count':len(lowcloud),
        'bestSceneByMetadata':rows[0] if rows else None,
        'topCandidates':rows[:12],
        'assetKeySetCounts':asset_sets,
      },
      'methodBoundary':{
        'productMeaning':'Sentinel-2 Level-2A is atmospherically corrected bottom-of-atmosphere surface reflectance with Scene Classification support.',
        'metadataRole':'Scene discovery and optical-quality screening only in R06.',
        'sunGeometry':'Earth Search STAC view:sun_elevation and view:sun_azimuth are retained; solar zenith is derived as 90 - sun elevation for ranking only.',
        'notYetPerformed':['water-column correction','sunglint correction from image pixels','turbidity masking from image pixels','satellite-derived bathymetry inversion','ENC-calibrated depth regression'],
        'important':'Low scene-level cloud percentage does not prove cloud-free or optically clear water over the reef core; pixel assets must be inspected before any shallow-water depth inference.'
      },
      'candidateGridMutation':False,
      'candidateGridReason':'Scene metadata alone is not a depth observation. No Sentinel-derived depth is injected into the candidate bathymetry grid in R06.',
      'palauWorldContract':'Any future Sentinel-derived shallow-water term must enter the same PalauWorld.sample() evidence conductor with source identity, mask, uncertainty and validity domain; no separate LOD world.'
    }
    write_json(results/'SENTINEL2_SCENE_METADATA_R06.json',report)
    csvp=results/'tables/SENTINEL2_TOP_SCENES_R06.csv'; csvp.parent.mkdir(parents=True,exist_ok=True)
    fields=['id','datetime','platform','mgrs','cloudCoverPct','nodataPct','cloudShadowPct','thinCirrusPct','sunElevationDeg','sunAzimuthDeg','meanSolarZenithDeg','coreFootprintOverlapFraction','rankingPenaltyLowerIsBetter','allRequiredOpticalAssets']
    with csvp.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for r in rows[:20]: w.writerow({k:r.get(k) for k in fields})
    ep=results/'AIRAI_REEF_EVIDENCE_REPORT.json'
    if ep.exists():
        e=json.loads(ep.read_text()); e['sentinel2R06']=report; write_json(ep,e)
    ip=results/'index.html'
    if ip.exists():
        html=ip.read_text(encoding='utf-8')
        best=report['sceneSummary']['bestSceneByMetadata']
        summary=("<section><h2>Sentinel-2 R06 场景元数据</h2><pre>"+
                 json.dumps({'returned':len(feats),'fullCoreCoverage':len(fully),'fullCoreCoverageCloudLt10':len(lowcloud),'bestScene':best},ensure_ascii=False,indent=2)+
                 "</pre><p>这一层只筛选可用影像，不把卫星影像元数据当水深。像元级云、薄云、耀斑、浑浊与水柱校正完成前，不进入候选水深场。</p></section>")
        if 'Sentinel-2 R06 场景元数据' not in html:
            html=html.replace('</main>',summary+'\n</main>')
            ip.write_text(html,encoding='utf-8')
    print(json.dumps({'sceneCount':len(feats),'fullCore':len(fully),'cloudLt10':len(lowcloud),'best':rows[0] if rows else None},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
