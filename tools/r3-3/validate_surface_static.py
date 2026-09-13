from __future__ import annotations

from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
R33=ROOT/'site'/'dist'/'r3-3'
EVIDENCE=ROOT/'inputs'/'knowledge-r2-2'/'OBJECT_EVIDENCE_R2_2.json'
EXPECTED_EVIDENCE_SHA='642290d1076bd700634c1c719c890819b5035a3841e24f9c86f5a171b1875482'
checks:dict[str,object]={}
errors:list[str]=[]

def require(name:str,condition:bool,detail:str='')->None:
    checks[name]=bool(condition)
    if not condition: errors.append(name+((': '+detail) if detail else ''))

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

paths=[R33/'index.html',R33/'bootstrap.js',R33/'surface-evidence.js',R33/'style.css',EVIDENCE]
for p in paths:require(f'exists:{p.relative_to(ROOT)}',p.is_file())

if EVIDENCE.is_file():
    require('object-evidence-sha256',sha256(EVIDENCE)==EXPECTED_EVIDENCE_SHA,sha256(EVIDENCE))
    data=json.loads(EVIDENCE.read_text(encoding='utf-8'))
    require('evidence-scope-not-physical-objects',data.get('scope')=='Evidence records and query locations; not reconstructed physical objects')
    objects=data.get('objects',[])
    require('exactly-12-query-evidence-records',len(objects)==12,str(len(objects)))
    for i,obj in enumerate(objects,1):
        prefix=f'query-{i:02d}'
        require(prefix+'-kind',obj.get('kind')=='query-location')
        require(prefix+'-id',obj.get('id')==f'WZ-R1-COLOCATION-{i:02d}')
        soil=obj.get('measurements',{}).get('soil',{})
        support=soil.get('support',{})
        require(prefix+'-soil-support-model-grid',support.get('kind')=='model-prediction-grid')
        require(prefix+'-soil-spacing-250m',support.get('spacingM')==250)
        props=soil.get('properties',{})
        vals=[]
        for key in ('clay','sand','silt','soc'):
            prop=props.get(key,{})
            mean=prop.get('values',{}).get('mean')
            vals.append(mean)
            require(prefix+f'-{key}-model-prediction',prop.get('status')=='model-prediction')
            require(prefix+f'-{key}-depth-0-5cm',prop.get('depth')=='0-5cm')
            require(prefix+f'-{key}-finite',isinstance(mean,(int,float)))
        if all(isinstance(v,(int,float)) for v in vals[:3]):
            require(prefix+'-texture-fractions-sum-100',abs(sum(vals[:3])-100.0)<0.11,str(sum(vals[:3])))

if (R33/'index.html').is_file() and (R33/'bootstrap.js').is_file() and (R33/'surface-evidence.js').is_file():
    index=(R33/'index.html').read_text(encoding='utf-8')
    boot=(R33/'bootstrap.js').read_text(encoding='utf-8')
    surface=(R33/'surface-evidence.js').read_text(encoding='utf-8')
    require('inherits-r32-style','href="../r3-2/style.css"' in index)
    require('single-r33-bootstrap','src="./bootstrap.js"' in index)
    require('surface-toggle','id="show-surface"' in index)
    require('surface-card','id="surface-card"' in index)
    require('surface-warning-model-prediction','250 米预测格网' in index)
    require('surface-warning-no-height','不新增高度测量' in index)
    require('bootstrap-installs-surface-first',"installSurfaceEvidence();" in boot)
    require('bootstrap-inherits-r32',"await import('../r3-2/bootstrap.js')" in boot)
    require('surface-evidence-relative-path',"../../../inputs/knowledge-r2-2/OBJECT_EVIDENCE_R2_2.json" in surface)
    require('surface-evidence-sha-lock',EXPECTED_EVIDENCE_SHA in surface)
    require('surface-radius-48m','const SURFACE_RADIUS_M=48' in surface)
    require('surface-visual-lift-2cm','const VISUAL_LIFT_M=0.02' in surface)
    require('surface-no-height-claim',"surfaceHeightClaim='none'" in surface)
    require('surface-clones-display-geometry','terrain.geometry.clone()' in surface)
    require('surface-is-display-layer',"soil-model-appearance-demo" in surface)
    require('no-road-invention','road' not in surface.lower() and 'building' not in surface.lower() and 'vegetation' not in surface.lower())
    require('no-procedural-height-displacement','p.y +=' not in surface and 'position.y +=' not in surface)
    node=shutil.which('node')
    if node:
        for name,path in [('bootstrap',R33/'bootstrap.js'),('surface',R33/'surface-evidence.js')]:
            result=subprocess.run([node,'--check',str(path)],capture_output=True,text=True)
            require('node-'+name+'-syntax',result.returncode==0,(result.stderr or result.stdout).strip())
    else:
        checks['node-bootstrap-syntax']='not-run: node unavailable'
        checks['node-surface-syntax']='not-run: node unavailable'

out={
    'schema':'wenzhou-r3.3-surface-static-qa/r1',
    'passed':not errors,
    'checks':checks,
    'errors':errors,
    'boundary':'SoilGrids values are model predictions used only to parameterize a display-only appearance demo; no terrain height, road, building or vegetation truth is created.'
}
print(json.dumps(out,ensure_ascii=False,indent=2))
sys.exit(0 if not errors else 1)
