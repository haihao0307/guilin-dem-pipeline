#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
required=[
 ROOT/'site/dist/r3-6/index.html',
 ROOT/'site/dist/r3-6/bootstrap.js',
 ROOT/'site/dist/r3-6/osm-runtime.js',
 ROOT/'site/dist/r3-5/data/osm/osm-context.json',
]
checks={};errors=[]
for p in required:
    ok=p.is_file();checks[f'exists:{p.relative_to(ROOT)}']=ok
    if not ok:errors.append(f'missing {p}')
if errors:
    print(json.dumps({'passed':False,'checks':checks,'errors':errors},indent=2));raise SystemExit(2)

html=(ROOT/'site/dist/r3-6/index.html').read_text(encoding='utf-8')
boot=(ROOT/'site/dist/r3-6/bootstrap.js').read_text(encoding='utf-8')
js=(ROOT/'site/dist/r3-6/osm-runtime.js').read_text(encoding='utf-8')
manifest=json.loads((ROOT/'site/dist/r3-5/data/osm/osm-context.json').read_text(encoding='utf-8'))
checks.update({
 'title-r36':'R3.6' in html,
 'bootstrap-optimized-first':boot.index('installOptimizedOsmRuntime()')<boot.index("await import('../r3-4/bootstrap.js')"),
 'bootstrap-bypasses-r35-hook':"../r3-5/bootstrap.js" not in boot,
 'reuses-r35-style':'../r3-5/style.css' in html,
 'reuses-r35-manifest':"const MANIFEST_URL='../r3-5/data/osm/osm-context.json'" in js,
 'reuses-r35-data-base':"../r3-5/data/osm/" in js,
 'no-r36-osm-data-copy':not (ROOT/'site/dist/r3-6/data/osm').exists(),
 'source-release-sha-lock':"f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101" in js,
 'corrected-report-sha-lock':"d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364" in js,
 'manifest-r2':manifest.get('schema')=='wenzhou-r3.5-osm-browser-bundle/r2',
 'manifest-not-canonical':manifest.get('canonicalTruth') is False,
 'manifest-not-survey':manifest.get('surveyGradeGeometry') is False,
 'manifest-not-physical':manifest.get('individualPhysicalTruth') is False,
 'manifest-not-production':manifest.get('productionReady') is False,
 'indexed-geometry':"setIndex(new THREE.BufferAttribute" in js and "new THREE.LineSegments" in js,
 'typed-position-arrays':'new Float32Array(vertexCount*3)' in js,
 'typed-index-arrays':'Uint16Array:Uint32Array' in js,
 'abort-controller':'new AbortController()' in js and "currentController.abort('superseded-view')" in js,
 'fetch-signal':'fetch(url,{signal})' in js,
 'cpu-abort-check':'throwIfAborted(signal)' in js and 'CPU_CHECK_INTERVAL=2048' in js,
 'main-thread-yield':'setTimeout(r,0)' in js and 'CPU_YIELD_BUDGET_MS=6' in js,
 'small-payload-cache':'PAYLOAD_CACHE_LIMIT=2' in js,
 'runtime-index-marker':"osmRuntime:'indexed-r36'" in js and 'osmIndexed:true' in js,
 'same-road-width-boundary':"physicalWidthClaim='none'" in js and "osmRoadWidthClaim:'none-screen-style-only'" in js,
 'same-building-height-boundary':"heightClaim='unknown-not-generated'" in js and "osmBuildingHeightClaim:'unknown-not-generated'" in js,
 'same-no-synthetic-closure':"syntheticPatchClosure=false" in js and "osmBuildingSyntheticPatchClosure:false" in js,
 'same-display-anchor':"current-display-triangles" in js,
 'no-extrusion':not re.search(r'ExtrudeGeometry|BoxGeometry|CylinderGeometry',js),
 'no-simplification':not re.search(r'simplif|Douglas|Visvalingam|decimat',js,re.I),
 'no-terrain-height-write':not re.search(r'\.setY\(|position\.setY|attributes\.position\.setY',js),
 'r35-segment-source-counts':manifest.get('sourceCandidateCounts',{}).get('roadLineStringHighway')==177578 and manifest.get('sourceCandidateCounts',{}).get('buildingMultiPolygonUniqueIdentity')==68359,
})
for k,v in checks.items():
    if not v:errors.append(k)
print(json.dumps({
 'schema':'wenzhou-r3.6-static-qa/r1',
 'passed':not errors,
 'checks':checks,
 'errors':errors,
 'boundary':'R3.6 reuses the exact R3.5 r2 evidence bytes and changes runtime representation/cancellation only; road width, building height, synthetic-closure and truth-status semantics remain unchanged.'
},ensure_ascii=False,indent=2))
raise SystemExit(1 if errors else 0)
