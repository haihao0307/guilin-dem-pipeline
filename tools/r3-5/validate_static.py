#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
manifest_path=ROOT/'site/dist/r3-5/data/osm/osm-context.json'
required=[ROOT/'site/dist/r3-5/index.html',ROOT/'site/dist/r3-5/bootstrap.js',ROOT/'site/dist/r3-5/osm-evidence.js',ROOT/'site/dist/r3-5/style.css',manifest_path]
checks={};errors=[]
for p in required:
    checks[f'exists:{p.relative_to(ROOT)}']=p.is_file()
    if not p.is_file():errors.append(f'missing {p}')
if errors:
    print(json.dumps({'passed':False,'checks':checks,'errors':errors},indent=2));raise SystemExit(2)

d=json.loads(manifest_path.read_text(encoding='utf-8'))
checks.update({
 'schema':d.get('schema')=='wenzhou-r3.5-osm-browser-bundle/r1',
 'source-release-sha':d.get('sourceReleaseAssetSha256')=='f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101',
 'source-corrected-report-sha':d.get('sourceCorrectedReportSha256')=='d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364',
 'external-mapped-observation':d.get('sourceIdentity')=='external_mapped_observation',
 'not-canonical':d.get('canonicalTruth') is False,
 'not-survey-grade':d.get('surveyGradeGeometry') is False,
 'not-individual-physical-truth':d.get('individualPhysicalTruth') is False,
 'not-production-ready':d.get('productionReady') is False,
 'source-road-candidates':d.get('sourceCandidateCounts',{}).get('roadLineStringHighway')==177578,
 'source-building-candidates':d.get('sourceCandidateCounts',{}).get('buildingMultiPolygonUniqueIdentity')==68359,
 'patch-count-17':d.get('patchCount')==17 and len(d.get('patches',[]))==17,
 'bundle-under-48MiB':0<d.get('totalBytes',0)<48*1024*1024,
})
expected={'overview','mountains','river-oujiang','river-feiyun','river-aojiang',*[f'query-{i:02d}' for i in range(1,13)]}
checks['patch-id-set']={p.get('id') for p in d.get('patches',[])}==expected
recalc_total=0
for rec in d.get('patches',[]):
    pid=rec['id'];q=rec.get('quantization',{})
    checks[f'{pid}-quantization']=q.get('type')=='uint16-bounds-relative' and 0<q.get('maxStepM',99)<4
    checks[f'{pid}-road-width-boundary']=rec.get('roads',{}).get('physicalWidthKnown') is False and rec.get('roads',{}).get('screenLineWidthOnly') is True
    checks[f'{pid}-building-height-boundary']=rec.get('buildings',{}).get('heightClaim')=='unknown-not-generated'
    if pid=='overview':checks['overview-no-buildings']=rec.get('buildings',{}).get('ringCount')==0 and 'buildingXY' not in rec.get('files',{})
    for key,item in rec.get('files',{}).items():
        p=ROOT/'site/dist/r3-5/data/osm'/Path(item['path']).name
        ok=p.is_file() and p.stat().st_size==item['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256']
        checks[f'{pid}-{key}-identity']=ok
        if p.is_file():
            recalc_total+=p.stat().st_size
            if key.endswith('XY'):checks[f'{pid}-{key}-shape']=p.stat().st_size%4==0
            if key.endswith('Parts'):checks[f'{pid}-{key}-shape']=p.stat().st_size%16==0
checks['total-bytes-recomputed']=recalc_total==d.get('totalBytes')

html=(ROOT/'site/dist/r3-5/index.html').read_text(encoding='utf-8')
js=(ROOT/'site/dist/r3-5/osm-evidence.js').read_text(encoding='utf-8')
boot=(ROOT/'site/dist/r3-5/bootstrap.js').read_text(encoding='utf-8')
checks.update({
 'title-r35':'R3.5' in html,
 'osm-road-toggle':'id="show-osm-roads"' in html,
 'osm-building-toggle':'id="show-osm-buildings"' in html,
 'osm-card':'id="osm-card"' in html,
 'osm-attribution':'© OpenStreetMap contributors' in html and 'ODbL' in html,
 'inherits-r34-style':'../r3-4/style.css' in html,
 'bootstrap-inherits-r34':"await import('../r3-4/bootstrap.js')" in boot,
 'bootstrap-installs-osm-first':boot.index('installOsmObjectEvidence()')<boot.index("await import('../r3-4/bootstrap.js')"),
 'line-segments-only':'new THREE.LineSegments' in js,
 'display-surface-anchor':"display-surface-anchor-only" in js and "current-display-triangles" in js,
 'road-width-claim-none':"physicalWidthClaim='none'" in js and "osmRoadWidthClaim:'none-screen-style-only'" in js,
 'building-height-unknown':"heightClaim='unknown-not-generated'" in js and "osmBuildingHeightClaim:'unknown-not-generated'" in js,
 'no-extrusion-geometry':not re.search(r'ExtrudeGeometry|BoxGeometry|CylinderGeometry',js),
 'no-terrain-height-write':not re.search(r'\.setY\(|position\.setY|attributes\.position\.setY',js),
})
for k,v in checks.items():
    if not v:errors.append(k)
print(json.dumps({'schema':'wenzhou-r3.5-static-qa/r1','passed':not errors,'checks':checks,'errors':errors,'boundary':'OSM roads remain centerline-style mapped observations with no physical-width claim; building MultiPolygons remain flat footprint-boundary observations with no generated height.'},ensure_ascii=False,indent=2))
raise SystemExit(1 if errors else 0)
