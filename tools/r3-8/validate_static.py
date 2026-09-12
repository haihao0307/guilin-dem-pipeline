from pathlib import Path
import hashlib,json,subprocess
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/'site/dist/r3-8'
errors=[]
def check(ok,label):
    if not ok:errors.append(label)
def read(base,rec,dtype):
    p=(base/rec['path']).resolve();check(p.is_relative_to((ROOT/'site/dist').resolve()),'path escapes runtime')
    b=p.read_bytes();check(len(b)==rec['bytes'] and hashlib.sha256(b).hexdigest()==rec['sha256'],str(p))
    return np.frombuffer(b,dtype=dtype)
soil=json.loads((SITE/'data/soil/soil-context.json').read_text(encoding='utf-8'))
check(soil['schema']=='wenzhou-r3.8-soil-profile/r1','profile schema')
check(len(soil['layers'])==96,'96 property/stat/depth payloads')
check(len({(x['property'],x['statistic'],x['depth']) for x in soil['layers']})==96,'unique soil axes')
for r in soil['layers']:
    a=read(SITE/'data/soil',r,'<i2');check(a.size==1003*884,'soil shape')
    check(r['geotransform']==[190250,250,0,3242000,0,-250],'soil frame')
    if r['statistic']=='uncertainty':check(r['conventionalUnit']=='relative index' and r['conversionFactor']==1,'uncertainty units')
check(soil['truthBoundary']['mayOverrideCanonicalDem'] is False,'soil height boundary')
w=json.loads((SITE/'data/wrb/wrb-context.json').read_text(encoding='utf-8'))
stack=np.stack([read(SITE/'data/wrb',r,'u1') for r in w['probabilityLayers']])
official=read(SITE/'data/wrb',w['outputs']['officialMostProbable'],'u1');mask=official!=255
derived=read(SITE/'data/wrb',w['outputs']['postAlignmentArgmax'],'u1')
difference=read(SITE/'data/wrb',w['outputs']['classificationDisagreement'],'u1')
check(np.array_equal(derived[mask],stack[:,mask].argmax(axis=0)),'WRB argmax')
check(np.array_equal(difference[mask],(official[mask]!=derived[mask]).astype('u1')),'WRB difference')
check(np.count_nonzero(difference[mask])==32142,'WRB audit count')
water=json.loads((SITE/'data/water/water-context.json').read_text(encoding='utf-8'))
check(len(water['layers'])==6,'water six products')
check(water['sourceNativeResolutionM']==30 and water['displayResolutionM']==250,'water source vs display scale')
for r in water['layers']:
    a=read(SITE/'data/water',r,'u1');check(a.size==1003*884,'water shape')
    check(sorted(map(int,np.unique(a)))==r['rawValues'],'water source codes')
    if r['product'] in ['seasonality','extent']:check('2022-2024' in r['period'],'partial water timeline')
    if r['product']=='change':check(any(x['value']=='254' and 'Unable to compute' in x['label'] for x in r['palette']),'change missing-data semantics')
check(all(v is False for v in water['truthBoundary'].values()),'water truth boundary')
frozen=subprocess.run(['git','diff','--exit-code','bb01ee52b21cfbd3406ace8e9e8f81c7ad4ad92b','--',*[f'site/dist/r3-{i}' for i in range(1,8)],'site/dist/r3','site/dist/vendor'],cwd=ROOT,capture_output=True)
check(frozen.returncode==0,'historical runtime changed')
print(json.dumps({'passed':not errors,'soilLayers':96,'wrbProbabilityLayers':30,'waterLayers':6,'frozenR3ThroughR37':frozen.returncode==0,'errors':errors},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
