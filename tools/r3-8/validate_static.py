from pathlib import Path
import gzip,hashlib,json,subprocess
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/'site/dist/r3-8'
VERIFIED_R38_RUNTIME='3018da201a2ef6b5d122522e85bbbb5b91f8a34d'
FROZEN_PATHS=['site/dist/r3','site/dist/vendor',*[f'site/dist/r3-{i}' for i in range(1,8)]]
errors=[]
def check(ok,label):
    if not ok:errors.append(label)
def digest(b):return hashlib.sha256(b).hexdigest()
def tree_sha(rev,path):
    r=subprocess.run(['git','rev-parse',f'{rev}:{path}'],cwd=ROOT,capture_output=True,text=True)
    return r.stdout.strip() if r.returncode==0 else None

def decode_soil_pairs():
    base=SITE/'data/soil-pairs'
    m=json.loads((base/'soil-pairs.json').read_text(encoding='utf-8'))
    check(m['schema']=='wenzhou-soil-pair-payloads/v1','soil pair schema')
    check(m['lossless'] is True and m['pairCount']==48,'48 lossless soil pairs')
    check(m['rawBytes']==170237184 and m['compressedBytes']==34571806,'soil pair byte contract')
    decoded={}
    for rec in m['pairs']:
        p=base/rec['path'];packed=p.read_bytes()
        check(len(packed)==rec['compressedBytes'] and digest(packed)==rec['compressedSha256'],f'packed {rec["property"]} {rec["depth"]}')
        b=gzip.decompress(packed);n=rec['samples']
        check(len(b)==n*4,'soil pair decoded length')
        q=bytearray(n*2);u=bytearray(n*2)
        q[0::2]=b[0:n];q[1::2]=b[n:2*n]
        u[0::2]=b[2*n:3*n];u[1::2]=b[3*n:4*n]
        qb,ub=bytes(q),bytes(u)
        check(digest(qb)==rec['valueSha256'],f'value sha {rec["property"]} {rec["depth"]}')
        check(digest(ub)==rec['uncertaintySha256'],f'uncertainty sha {rec["property"]} {rec["depth"]}')
        decoded[(rec['property'],rec['depth'],'Q0.5')]=qb
        decoded[(rec['property'],rec['depth'],'uncertainty')]=ub
    return m,decoded

def evidence_index():
    base=SITE/'data/evidence-gzip'
    m=json.loads((base/'index.json').read_text(encoding='utf-8'))
    check(m['schema']=='wenzhou-r3.9-evidence-gzip/v1','evidence gzip schema')
    check(m['lossless'] is True and m['fileCount']==41,'41 lossless WRB/JRC gzip payloads')
    check(m['rawBytes']==37239384 and m['packedBytes']==3424064,'evidence gzip byte contract')
    return base,m,{(r['family'],r['logicalPath']):r for r in m['records']}

def read_env(base,index,family,rec,dtype):
    er=index.get((family,rec['path']))
    check(er is not None,f'evidence gzip record {family}/{rec["path"]}')
    if er is None:return np.array([],dtype=dtype)
    packed=(base/er['packedPath']).read_bytes()
    check(len(packed)==er['packedBytes'] and digest(packed)==er['packedSha256'],f'packed evidence {family}/{rec["path"]}')
    raw=gzip.decompress(packed)
    check(len(raw)==rec['bytes'] and len(raw)==er['rawBytes'],'evidence decoded bytes')
    check(digest(raw)==rec['sha256'] and digest(raw)==er['rawSha256'],f'evidence decoded sha {family}/{rec["path"]}')
    return np.frombuffer(raw,dtype=dtype)

soil=json.loads((SITE/'data/soil/soil-context.json').read_text(encoding='utf-8'))
check(soil['schema']=='wenzhou-r3.8-soil-profile/r1','profile schema')
check(len(soil['layers'])==96,'96 property/stat/depth semantics')
check(len({(x['property'],x['statistic'],x['depth']) for x in soil['layers']})==96,'unique soil axes')
pair_manifest,soil_bytes=decode_soil_pairs()
for r in soil['layers']:
    key=(r['property'],r['depth'],r['statistic']);b=soil_bytes.get(key)
    check(b is not None,f'pair covers {key}')
    if b is None:continue
    check(len(b)==r['bytes'] and digest(b)==r['sha256'],f'pair preserves legacy sha {key}')
    a=np.frombuffer(b,dtype='<i2');check(a.size==1003*884,'soil shape')
    check(r['geotransform']==[190250,250,0,3242000,0,-250],'soil frame')
    if r['statistic']=='uncertainty':check(r['conventionalUnit']=='relative index' and r['conversionFactor']==1,'uncertainty units')
check(soil['truthBoundary']['mayOverrideCanonicalDem'] is False,'soil height boundary')

env_base,env_manifest,env_index=evidence_index()
w=json.loads((SITE/'data/wrb/wrb-context.json').read_text(encoding='utf-8'))
stack=np.stack([read_env(env_base,env_index,'wrb',r,'u1') for r in w['probabilityLayers']])
official=read_env(env_base,env_index,'wrb',w['outputs']['officialMostProbable'],'u1');mask=official!=255
derived=read_env(env_base,env_index,'wrb',w['outputs']['postAlignmentArgmax'],'u1')
difference=read_env(env_base,env_index,'wrb',w['outputs']['classificationDisagreement'],'u1')
check(np.array_equal(derived[mask],stack[:,mask].argmax(axis=0)),'WRB argmax')
check(np.array_equal(difference[mask],(official[mask]!=derived[mask]).astype('u1')),'WRB difference')
check(np.count_nonzero(difference[mask])==32142,'WRB audit count')
water=json.loads((SITE/'data/water/water-context.json').read_text(encoding='utf-8'))
check(len(water['layers'])==6,'water six products')
check(water['sourceNativeResolutionM']==30 and water['displayResolutionM']==250,'water source vs display scale')
for r in water['layers']:
    a=read_env(env_base,env_index,'water',r,'u1');check(a.size==1003*884,'water shape')
    check(sorted(map(int,np.unique(a)))==r['rawValues'],'water source codes')
    if r['product'] in ['seasonality','extent']:check('2022-2024' in r['period'],'partial water timeline')
    if r['product']=='change':check(any(x['value']=='254' and 'Unable to compute' in x['label'] for x in r['palette']),'change missing-data semantics')
check(all(v is False for v in water['truthBoundary'].values()),'water truth boundary')

frozen_trees={p:{'anchor':tree_sha(VERIFIED_R38_RUNTIME,p),'head':tree_sha('HEAD',p)} for p in FROZEN_PATHS}
frozen_ok=all(v['anchor'] is not None and v['anchor']==v['head'] for v in frozen_trees.values())
check(frozen_ok,'historical runtime tree identities changed since verified R3.8 candidate')
print(json.dumps({'passed':not errors,'soilLayers':96,'soilPairs':pair_manifest['pairCount'],'soilPairCompressedBytes':pair_manifest['compressedBytes'],'wrbProbabilityLayers':30,'waterLayers':6,'evidenceGzipFiles':env_manifest['fileCount'],'evidenceGzipPackedBytes':env_manifest['packedBytes'],'historicalFreezeAnchor':VERIFIED_R38_RUNTIME,'frozenR3ThroughR37':frozen_ok,'frozenTreeIdentities':frozen_trees,'errors':errors},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
