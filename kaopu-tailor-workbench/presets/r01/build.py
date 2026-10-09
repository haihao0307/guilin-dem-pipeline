"""P01: compile real paper, never solve or cache body-fitted clothes.
Run from a checkout containing the pinned, already integrated source archive.
Writes only this directory. Failed candidates are retained in the QA report.
"""
from pathlib import Path
import copy, gzip, hashlib, importlib, json, math, os, shutil, sys, tempfile, time, zipfile
P = Path(__file__).resolve().parent
ROOT = P.parent.parent
SOURCE = ROOT / 'garment-pattern-catalogue-r01'
def encoded(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
def sha(b): return hashlib.sha256(b).hexdigest()
def write(name, value):
    q=P/name; q.parent.mkdir(parents=True,exist_ok=True); q.write_bytes(encoded(value))
def compress(name, value):
    q=P/name; q.parent.mkdir(parents=True,exist_ok=True); q.write_bytes(gzip.compress(encoded(value),compresslevel=9,mtime=0))
def canonical_geometry(pattern):
    def rounded(x):
        if isinstance(x,float): return round(x,7)
        if isinstance(x,list): return [rounded(v) for v in x]
        if isinstance(x,dict): return {k:rounded(v) for k,v in x.items()}
        return x
    panels=[]
    for p in sorted(pattern['panels'],key=lambda x:x['id']):
        panels.append({'id':p['id'],'vertices':p['verticesMm'],'placement':p['placement'],
          'edges':[{k:e[k] for k in ['endpoints','kind','controlPointsMm','arc'] if k in e} for e in p['edges']]})
    seams=[{k:s[k] for k in ['a','b','direction','lengthAMm','lengthBMm','gathering','isDart']} for s in pattern['seams']]
    return sha(encoded(rounded({'panels':panels,'seams':sorted(seams,key=lambda x:encoded(x))})))
def audit(pattern):
    assert pattern['units']=='mm'
    assert pattern['validation']['analytic2DPass'] is True, pattern['validation']['errors']
    lookup={p['id']:p for p in pattern['panels']}; assert len(lookup)==len(pattern['panels'])
    referenced={}; gathered=0
    for s in pattern['seams']:
        for side in ['a','b']:
            r=s[side]; assert r['panelId'] in lookup
            panel=lookup[r['panelId']]; assert isinstance(r['edge'],int) and 0<=r['edge']<len(panel['edges'])
            assert isinstance(r['reverse'],bool)
            key=(r['panelId'],r['edge']); referenced[key]=referenced.get(key,0)+1
        assert s['direction'] in ['same','opposite']
        g=s.get('gathering')
        if g:
            assert g['ruffleCoefficientA']>0 and g['ruffleCoefficientB']>0
            gathered+=abs(g['ruffleCoefficientA']-g['ruffleCoefficientB'])>1e-8
    duplicate=[list(k) for k,n in referenced.items() if n>1]
    # This is a specification integrity failure, not a remeshing heuristic.
    assert not duplicate, {'multiplyReferencedSeamEdges':duplicate}
    for panel in pattern['panels']:
        assert panel['maxBoundaryGapMm']<1e-5
        assert abs(panel['signedAreaMm2'])>1e-3
        for edge in panel['edges']:
            assert edge['lengthMm']>0 and math.isfinite(edge['lengthMm'])
    return {'paperValid':True,'seamReferencesValid':True,'duplicateSeamEdgeReferences':duplicate,
      'freeBoundaryEdges':sum(len(p['edges']) for p in pattern['panels'])-len(referenced),
      'freeEdgesAreNotAutomaticallyMissingStitches':True,'gatheredSeams':int(gathered),
      'seamAllowanceIncluded':False,'fabricCalibrated':False,'physicalFitAccepted':False,'dynamicWearCertified':False}
def compile_library():
    document=json.loads((P/'recipes.json').read_text()); presets=document['presets']
    assert len(presets)==60 and len({r['id'] for r in presets})==60
    raw_body=(SOURCE/'examples/body-anny-cm.json').read_bytes(); body=json.loads(raw_body)
    manifest=json.loads((SOURCE/'browser/runtime-manifest.json').read_text())
    archive=SOURCE/'browser'/manifest['patternArchive']['file']
    assert sha(archive.read_bytes())==manifest['patternArchive']['sha256']
    locks={}
    source_files=['catalogue/catalogue-controls.mjs','catalogue/paper-preview.mjs',
      'garment-pattern-catalogue-r01/browser/pattern-engine.mjs',
      'garment-pattern-catalogue-r01/browser/runtime-manifest.json',
      'garment-pattern-catalogue-r01/browser/pattern-runtime.zip',
      'garment-pattern-catalogue-r01/examples/body-anny-cm.json']
    for path in source_files: locks[path]=sha((ROOT/path).read_bytes())
    (P/'vendor').mkdir(exist_ok=True)
    for path in source_files[:3]: shutil.copy2(ROOT/path,P/'vendor'/Path(path).name)
    # Notices stay with the inherited source; preserve a copy next to this adapter.
    shutil.copy2(SOURCE/'THIRD-PARTY-NOTICES.md',P/'vendor/THIRD-PARTY-NOTICES.md')
    write('SOURCE_LOCK.json',{'schema':'kaopu-tailor-preset-source-lock@1','sourceBaseline':document['sourceBaseline'],
      'sourceCommit':os.environ.get('GITHUB_SHA','local-unpublished'),'generatorCommit':document['generatorCommit'],'files':locks})
    body_profile={'schema':'kaopu-tailor-body-measurements@1','id':'original-anny-adult-reference',
      'revision':document['sourceBaseline'],'sourceSHA256':sha(raw_body),'units':'cm','bodyCm':body,
      'kind':'reference-body','liveCharacterConnected':False,'bodyGeometrySHA256':None}
    write('reference-body.json',body_profile)
    rows=[]; failures=[]; seen={}; t=time.perf_counter()
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(archive) as z:
            assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist())
            z.extractall(tmp)
        sys.path.insert(0,tmp)
        generator=importlib.import_module('pattern_catalogue')
        schema=generator.parameterSchema(); write('parameter-schema.json',schema)
        assert len(schema['parameters'])==122
        expected_styles={s['id'] for s in generator.listStyles()}
        assert {r['style'] for r in presets}==expected_styles
        for row in presets:
            entry=copy.deepcopy(row)
            try:
                request={'bodyCm':copy.deepcopy(body),'design':{'style':row['style'],**row['overrides']}}
                pattern=generator.generatePattern(request); check=audit(pattern); fingerprint=canonical_geometry(pattern)
                assert fingerprint not in seen, f"Duplicate real geometry with {seen.get(fingerprint)}"
                seen[fingerprint]=row['id']
                compress('data/'+row['id']+'.json.gz',pattern)
                entry.update({'paperValid':True,'recipeHash':pattern['recipeHash'],'geometryHash':pattern['geometryHash'],
                  'shapeFingerprint':fingerprint,'panelCount':len(pattern['panels']),'seamCount':len(pattern['seams']),
                  'dartCount':len(pattern['darts']),'audit':check,'paperWarnings':pattern['validation']['warnings'],
                  'curveKinds':sorted({e['kind'] for p in pattern['panels'] for e in p['edges']}),
                  'paperAsset':'data/'+row['id']+'.json.gz','thumbnail':'thumbs/'+row['id']+'.svg',
                  'generationMs':pattern['diagnostics']['generationMs']})
                print(row['id'],row['name'],'PASS',entry['panelCount'],'panels',entry['seamCount'],'seams',flush=True)
            except Exception as e:
                entry.update({'paperValid':False,'error':str(e),'physicalFitAccepted':False}); failures.append({'id':row['id'],'error':str(e)})
                print(row['id'],row['name'],'FAILED',repr(e),flush=True)
            rows.append(entry)
        # The same design on changed measurement input must rebuild paper. Synthetic dependency test only.
        changed=copy.deepcopy(body)
        angle_fields={'shoulder_incl','arm_pose_angle','hip_inclination'}
        for k in schema['requiredBodyCm']:
            if k not in angle_fields: changed[k]*=1.06
        r=presets[4]; a=generator.generatePattern({'bodyCm':body,'design':{'style':r['style'],**r['overrides']}})
        b=generator.generatePattern({'bodyCm':changed,'design':a['design']}); audit(b)
        dependency={'kind':'synthetic-6pct-measurement-dependency-test-not-a-real-character',
          'sameDesign':a['design']==b['design'],'differentRecipeHash':a['recipeHash']!=b['recipeHash'],
          'differentGeometry':canonical_geometry(a)!=canonical_geometry(b),'liveBodyIntegrationTested':False}
        assert dependency['sameDesign'] and dependency['differentRecipeHash'] and dependency['differentGeometry']
        repeat=generator.generatePattern({'bodyCm':body,'design':a['design']})
        assert canonical_geometry(a)==canonical_geometry(repeat)
    result={'schema':'kaopu-tailor-preset-library@1','version':'P01','referenceBody':body_profile,
      'sourceBaseline':document['sourceBaseline'],'sourceCommit':os.environ.get('GITHUB_SHA','local-unpublished'),
      'generatorCommit':document['generatorCommit'],'presetCount':len(rows),'originalStyleCount':len(expected_styles),
      'parameterCount':122,'notACompleteCatalogueOfAllPossibleClothing':True,'allFinishedGarmentsAccepted':False,
      'liveCharacterConnection':'bridge-available-not-connected','presets':rows}
    write('library.json',result)
    write('BUILD_REPORT.json',{'presetCount':len(rows),'passed':len(rows)-len(failures),'failed':failures,
      'uniquePaperGeometries':len(seen),'sourceStyleCoverage':sorted(expected_styles),'parameterCount':122,
      'bodyDependency':dependency,'repeatedGeometryStable':True,'seconds':time.perf_counter()-t,
      'clothSimulationRun':False,'physicalFitAccepted':False,'dynamicWearCertified':False})
    assert not failures, failures
    print('P01_BUILD_SUCCESS',len(rows),'distinct paper presets; no cloth solver invoked',flush=True)
if __name__=='__main__': compile_library()
