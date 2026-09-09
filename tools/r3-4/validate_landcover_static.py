from __future__ import annotations

from pathlib import Path
import hashlib,json,shutil,subprocess,sys

ROOT=Path(__file__).resolve().parents[2]
R34=ROOT/'site'/'dist'/'r3-4'
DATA=R34/'data'/'worldcover'
MANIFEST=DATA/'worldcover-2021-context.json'
TERRAIN=ROOT/'site'/'dist'/'r3-1'/'data'/'terrain.json'
SOURCE_RELEASE_SHA='f558037e82ce38fac604291c6dc0327c931488c5167c7015e0dbdeae5a9ba0ad'
ALLOWED={0,10,20,30,40,50,60,70,80,90,95,100}
checks:dict[str,object]={};errors:list[str]=[]

def require(name:str,condition:bool,detail:str='')->None:
    checks[name]=bool(condition)
    if not condition:errors.append(name+((': '+detail) if detail else ''))

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

for p in [R34/'index.html',R34/'bootstrap.js',R34/'landcover-evidence.js',R34/'style.css',MANIFEST,TERRAIN]:require(f'exists:{p.relative_to(ROOT)}',p.is_file())

if MANIFEST.is_file() and TERRAIN.is_file():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'));t=json.loads(TERRAIN.read_text(encoding='utf-8'))
    require('manifest-schema',m.get('schema')=='wenzhou-r3.4-worldcover-browser-bundle/r1')
    require('source-release-sha',m.get('sourceReleaseAssetSha256')==SOURCE_RELEASE_SHA)
    require('source-dataset',m.get('sourceDataset')=='ESA WorldCover 2021 v200')
    require('source-external-observation',m.get('sourceIdentity')=='external_observation')
    require('source-native-10m',m.get('sourceNativeResolutionM')==10)
    require('source-crs-32651',m.get('sourceCrs')=='EPSG:32651')
    require('not-canonical-truth',m.get('canonicalTruth') is False)
    require('not-individual-object-truth',m.get('individualObjectTruth') is False)
    require('not-production-ready',m.get('productionReady') is False)
    classes={int(k) for k in m.get('classCodes',{})}
    require('class-code-domain',classes==ALLOWED,str(sorted(classes)))
    terrain_ids=[p['id'] for p in t.get('patches',[])]
    patch_map={p['id']:p for p in m.get('patches',[])}
    require('all-17-terrain-patches',set(patch_map)==set(terrain_ids),str(sorted(set(terrain_ids)-set(patch_map))))
    total=0
    for pid in terrain_ids:
        meta=patch_map.get(pid)
        if not meta:continue
        f=R34/meta['path'].removeprefix('./')
        require(pid+'-exists',f.is_file())
        if f.is_file():
            require(pid+'-bytes',f.stat().st_size==meta['bytes'])
            require(pid+'-shape',f.stat().st_size==meta['rows']*meta['columns'])
            require(pid+'-sha256',sha(f)==meta['sha256'])
            total+=f.stat().st_size
            values=set(f.read_bytes())
            require(pid+'-class-domain',values<=ALLOWED,str(sorted(values-ALLOWED)))
        require(pid+'-not-canonical',meta.get('canonicalTruth') is False)
        require(pid+'-not-object-truth',meta.get('individualObjectTruth') is False)
        if pid.startswith('query-'):
            require(pid+'-native-10m',meta['resolutionM']==10 and meta['resampling']=='near' and meta['representation']=='native-10m-crop' and meta['exactNativeObservationCrop'] is True and meta['displayAggregation'] is False)
        elif pid.startswith('river-'):
            require(pid+'-20m-mode',meta['resolutionM']==20 and meta['resampling']=='mode' and meta['displayAggregation'] is True)
        elif pid=='mountains':require('mountains-40m-mode',meta['resolutionM']==40 and meta['resampling']=='mode' and meta['displayAggregation'] is True)
        elif pid=='overview':require('overview-80m-mode',meta['resolutionM']==80 and meta['resampling']=='mode' and meta['displayAggregation'] is True)
    require('manifest-total-bytes',total==m.get('totalBytes'),f'{total} != {m.get("totalBytes")}')
    require('browser-bundle-under-64MiB',total<=64*1024*1024,str(total))

if all((R34/x).is_file() for x in ['index.html','bootstrap.js','landcover-evidence.js']):
    index=(R34/'index.html').read_text(encoding='utf-8');boot=(R34/'bootstrap.js').read_text(encoding='utf-8');js=(R34/'landcover-evidence.js').read_text(encoding='utf-8')
    require('inherits-r32-style','href="../r3-2/style.css"' in index)
    require('inherits-r33-style','href="../r3-3/style.css"' in index)
    require('single-r34-bootstrap','src="./bootstrap.js"' in index)
    require('landcover-toggle-default-off','id="show-landcover" type="checkbox"' in index and 'id="show-landcover" type="checkbox" checked' not in index)
    require('explicit-worldcover-boundary','单棵树、单栋建筑或田块边界真值' in index)
    require('explicit-aggregated-resolution','河流近景使用 20 米 mode 聚合，山地 40 米、全域 80 米' in index)
    require('bootstrap-installs-r34-first','installLandcoverEvidence();' in boot)
    require('bootstrap-inherits-r33',"await import('../r3-3/bootstrap.js')" in boot)
    require('release-sha-lock',SOURCE_RELEASE_SHA in js)
    require('landcover-visual-lift-3p5cm','const VISUAL_LIFT_M=0.035' in js)
    require('height-claim-none',"landcoverHeightClaim:'none'" in js and "heightClaim='none'" not in js)
    require('data-texture-byte-class','new THREE.DataTexture' in js and 'THREE.RedFormat' in js and 'THREE.UnsignedByteType' in js)
    require('nearest-texture-filter','THREE.NearestFilter' in js)
    require('row-orientation-explicit','flippedForGpu' in js and 'source-row0-north-reversed-to-gpu-row0-south' in js)
    require('projected-en-mapping','uOriginEN.x+vLocalXZ.x*1000.0' in js and 'uOriginEN.y-vLocalXZ.y*1000.0' in js)
    require('preserves-land-mask','uLandMask' in js and 'if(land<.5)discard' in js)
    require('no-height-displacement','p.y +=' not in js and 'position.y +=' not in js)
    require('no-object-generator','new THREE.InstancedMesh' not in js and 'new THREE.BoxGeometry' not in js and 'new THREE.CylinderGeometry' not in js and 'new THREE.ConeGeometry' not in js)
    node=shutil.which('node')
    if node:
        for name,path in [('bootstrap',R34/'bootstrap.js'),('landcover',R34/'landcover-evidence.js')]:
            r=subprocess.run([node,'--check',str(path)],capture_output=True,text=True)
            require('node-'+name+'-syntax',r.returncode==0,(r.stderr or r.stdout).strip())

out={'schema':'wenzhou-r3.4-landcover-static-qa/r1','passed':not errors,'checks':checks,'errors':errors,'boundary':'WorldCover is external categorical observation. 10m query crops remain source-resolution class observations; 20/40/80m mode products are display aggregations. No terrain height or individual object truth is created.'}
print(json.dumps(out,ensure_ascii=False,indent=2));sys.exit(0 if not errors else 1)
