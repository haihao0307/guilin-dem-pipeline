"""Regenerate every authored preset and freeze independently checked cutting records."""
import argparse, concurrent.futures, copy, gzip, hashlib, importlib.metadata, json, os, pathlib, sys, time, traceback, zipfile
ROOT=pathlib.Path(__file__).resolve().parent
WORKBENCH=ROOT.parents[1]
sys.path.insert(0,str(WORKBENCH/'garment-pattern-catalogue-r01'))
from validate_pattern import audit,canonical,digest
from sewing_plan import build_sewing_plan
BASELINE='ca6f090c5652bbe848e909f755b0ac5e80b4c969'

def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(canonical(value)+'\n',encoding='utf-8')

def generate_one(job):
    # Upstream changes cwd during generation; separate processes isolate that state.
    from pattern_catalogue import generatePattern,generateOfficialOracleCm
    row,body,variant=job;started=time.perf_counter();pid=row['id']
    design={'style':row['style'],**copy.deepcopy(row['overrides'])}
    request={'bodyCm':body['bodyCm'],'design':design}
    if variant:request['design'].update(variant)
    try:
        pattern=generatePattern(request);check=audit(pattern)
        # Recreate the official assembly independently in the same numeric backend.
        oracle=generateOfficialOracleCm(request)
        def normalized(value):
            p=value['pattern'];return {'panels':p['panels'],'stitches':sorted(p['stitches'],key=canonical)}
        equivalent=normalized(pattern['officialOracleCm'])==normalized(oracle)
        if not equivalent:check['errors'].append({'code':'OFFICIAL_REPLAY_MISMATCH'});check['passed']=False
        frozen=json.loads(gzip.decompress((WORKBENCH/'presets/r01/data'/f'{pid}.json.gz').read_bytes()))
        # Assembly iterates Python sets: seam list order is not a topology identity.
        # Keep each A/B endpoint, orientation and dart flag; normalize order only.
        source_topology=sorted([(s['a'],s['b'],s['direction'],s['isDart']) for s in frozen['seams']],key=canonical)
        topology=sorted([(s['a'],s['b'],s['direction'],s['isDart']) for s in pattern['seams']],key=canonical)
        same_topology=source_topology==topology
        if not variant and not same_topology:check['errors'].append({'code':'BASELINE_TOPOLOGY_CHANGED'});check['passed']=False
        plan=build_sewing_plan(request,pattern)
        result={'id':pid,'name':row['name'],'category':row['category'],'style':row['style'],
            'intent':row['intent'],'passed':check['passed'],'panelCount':len(pattern['panels']),
            'seamCount':len(pattern['seams']),'dartCount':len(pattern['darts']),
            'recipeHash':pattern['recipeHash'],'geometryHash':pattern['geometryHash'],
            'sourceRecipeHash':frozen['recipeHash'],'sourceGeometryHash':frozen['geometryHash'],
            'sourceTopologyPreserved':same_topology,'sameBackendOfficialReplayEqual':equivalent,
            'warnings':check['warnings'],'errors':check['errors'],'seconds':time.perf_counter()-started,
            'bodyIdentity':{k:v for k,v in body.items() if k!='bodyCm'},'request':request,
            'pattern':pattern,'audit':check,'sewingPlan':plan}
        return result
    except BaseException as exc:
        if isinstance(exc,(KeyboardInterrupt,SystemExit)):raise
        return {'id':pid,'name':row['name'],'category':row['category'],'passed':False,
            'errors':[{'code':'GENERATION_ERROR','type':type(exc).__name__,'message':str(exc)}],
            'traceback':traceback.format_exc(),'seconds':time.perf_counter()-started}

def verify_inputs():
    lock=json.loads((ROOT/'SOURCE_LOCK.json').read_text(encoding='utf8'))
    for p,wanted in lock['files'].items():
        if hashlib.sha256((WORKBENCH/p).read_bytes()).hexdigest()!=wanted:raise ValueError(f'Pinned input changed: {p}')
    generator=WORKBENCH/'garment-pattern-catalogue-r01'
    with zipfile.ZipFile(generator/'browser/pattern-runtime.zip') as archive:
        for member in archive.infolist():
            target=(generator/member.filename).resolve()
            if not target.is_relative_to(generator.resolve()):raise ValueError('Unsafe runtime archive path')
            if member.is_dir():continue
            expected=archive.read(member)
            if target.exists():
                if target.read_bytes()!=expected:raise ValueError(f'Pinned runtime source changed: {member.filename}')
            else:
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(expected)
    wanted={'numpy':'1.26.4','scipy':'1.12.0','PyYAML':'6.0.1','svgpathtools':'1.7.2','svgwrite':'1.4.3'}
    actual={name:importlib.metadata.version(name) for name in wanted}
    if actual!=wanted:raise ValueError(f'Use pinned native dependencies: {actual}')
    return actual

def build(out,workers,body_file=None):
    started=time.perf_counter()
    dependencies=verify_inputs()
    recipes=json.loads((WORKBENCH/'presets/r01/recipes.json').read_text(encoding='utf-8'))
    body=json.loads((body_file or WORKBENCH/'presets/r01/reference-body.json').read_text(encoding='utf-8'))
    if body.get('schema')!='kaopu-tailor-body-measurements@1' or body.get('units')!='cm':raise ValueError('A versioned complete body measurement profile in cm is required')
    if not body.get('id') or not body.get('revision') or not body.get('sourceSHA256'):raise ValueError('Body identity is incomplete')
    if body.get('kind')!='reference-body' and not body.get('bodyGeometrySHA256'):raise ValueError('A character body requires bodyGeometrySHA256')
    if len(recipes['presets'])!=60 or len({p['id'] for p in recipes['presets']})!=60:raise ValueError('Expected all 60 distinct source presets')
    prior=json.loads((WORKBENCH/'presets/r04/R0434_BROWSER_REPORT.json').read_text(encoding='utf-8'))
    prior={x['id']:x for x in prior['styles']};rows=[];output_hashes={}
    out.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
        jobs=[(row,body,None) for row in recipes['presets']]
        for result in pool.map(generate_one,jobs):
            pid=result['id'];pattern=result.pop('pattern',None);check=result.pop('audit',None);plan=result.pop('sewingPlan',None)
            if pattern:
                ticket={'schema':'kaopu-frozen-pattern-set@1','id':pid,'name':result['name'],
                    'sourceBaseline':BASELINE,'bodyIdentity':result['bodyIdentity'],'request':result['request'],
                    'recipeHash':result['recipeHash'],'geometryHash':result['geometryHash'],
                    'cacheIdentity':digest({'schema':'kaopu-pattern-cache-key@1','recipeHash':result['recipeHash'],
                        'geometryHash':result['geometryHash'],'bodyIdentity':result['bodyIdentity'],'auditVersion':1}),
                    'pattern':pattern,'structuralAudit':check,
                    'assemblyGraph':{'nodes':[p['id'] for p in pattern['panels']],'seams':check['seams'],
                        'components':check['connectedComponents'],'freeBoundaries':check['freeBoundaries']},
                    'sewingPlan':plan,
                    'downstream':{'patternStructuralReady':result['passed'],'physicalFitStatus':'deferred',
                        'slot':{'上装':'upper','裤装':'lower','半裙':'lower','连衣裙':'full-body','连体裤':'full-body'}[result['category']],
                        'layerOrder':None,'layerOrderMeaning':'assigned only by a future outfit; no spatial inference',
                        'crossGarmentSewingAllowed':False,'seamAllowanceMm':0,'manufacturingReady':False,
                        'bodyMutationAllowed':False,'requiresFreshSolveForChangedPattern':True}}
                ticket['contentSHA256']=digest(ticket)
                filename=f'patterns/{pid}.json';write_json(out/filename,ticket)
                result.update(asset=filename,contentSHA256=ticket['contentSHA256'],
                    freeBoundaryCount=len(check['freeBoundaries']),
                    interfaceGroupCount=len(plan['groups']),groupLengthReviewCount=len(plan['groupLengthReview']),
                    declaredGatheringOperations=sum(bool(g['constructionDeclarations']) for g in plan['groups']),
                    maxLengthDifferenceMm=max(p['maxIndependentLengthDifferenceMm'] for p in check['panels']))
                output_hashes[filename]=hashlib.sha256((out/filename).read_bytes()).hexdigest()
            old=prior[pid]
            result['deferredCloth']={'baselineStaticPassed':old['staticPassed'],'baselineFailures':old['physicalFailures'],
                'baseline':'R0434 saved report; not a new solve','currentSolveRun':False}
            rows.append(result)
            print(f"{len(rows):02d}/60 {pid} {'PASS' if result['passed'] else 'FAIL'} {result['seconds']:.2f}s",flush=True)
            write_json(out/'progress.json',{'completed':len(rows),'total':60,'passed':sum(r['passed'] for r in rows)})
    categories={c:{'total':sum(r['category']==c for r in rows),'passed':sum(r['category']==c and r['passed'] for r in rows)} for c in dict.fromkeys(r['category'] for r in rows)}
    report={'schema':'kaopu-pattern-batch@1','sourceRepository':'haihao0307/guilin-dem-pipeline','sourceBaseline':BASELINE,
        'generatorCommit':recipes['generatorCommit'],'count':len(rows),'passedCount':sum(r['passed'] for r in rows),
        'allPatternsStructurallyPassed':all(r['passed'] for r in rows),'bodyIdentity':{k:v for k,v in body.items() if k!='bodyCm'},
        'categories':categories,'rows':rows,'seconds':time.perf_counter()-started,'workers':workers,'nativeDependencies':dependencies,
        'checks':['fresh-source-generation','analytic-source-2d-validation','independent-curve-endpoints',
            'independently-integrated-edge-lengths','analytic-area','closed-boundary','unique-seam-edge-references',
            'seam-direction-and-ease','gathering-provenance','connected-assembly-graph','same-backend-official-replay',
            'original-topology-preservation','source-multiedge-operation-groups','frozen-pattern-export'],
        'scope':'paper generation and structural handoff only; no material/body/self-contact solve',
        'continuousParameterDomainCertified':False,'allGarmentsAccepted':False,
        'physicalSolveRun':False,'manufacturingReady':False,'outputSHA256':output_hashes}
    write_json(out/'catalogue.json',report)
    pack={'schema':'kaopu-pattern-batch-pack@1','catalogue':report,
        'patterns':[json.loads((out/r['asset']).read_text(encoding='utf-8')) for r in rows if r.get('asset')]}
    write_json(out/'all-patterns.json',pack)
    print(f"COMPLETE {report['passedCount']}/{report['count']} in {report['seconds']:.1f}s",flush=True)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=pathlib.Path,default=ROOT/'data')
    parser.add_argument('--workers',type=int,default=4);parser.add_argument('--body',type=pathlib.Path)
    args=parser.parse_args();report=build(args.out,max(1,min(8,args.workers)),args.body)
    sys.exit(0 if report['allPatternsStructurallyPassed'] else 1)
