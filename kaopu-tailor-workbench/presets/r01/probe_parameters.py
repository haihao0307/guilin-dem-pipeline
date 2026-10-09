"""Single-field, same-body empirical probes; no claim of exhaustive or physical coverage."""
from pathlib import Path
import copy,gzip,importlib,json,math,sys,tempfile,time,zipfile
from build import P, SOURCE, audit, canonical_geometry, encoded, write

def get(d,path):
    for k in path.split('.'):d=d[k]
    return d['v']
def put(d,path,val):
    keys=path.split('.')
    for k in keys[:-1]:d=d[k]
    d[keys[-1]]['v']=val
def choices(p,x):
    if p['type']=='bool': return [not x]
    if p['type'].startswith('select'): return [v for v in (p['choices'] or p['samplingRange']) if v!=x]
    lo,hi=min(p['samplingRange']),max(p['samplingRange']); span=hi-lo
    out=[]
    for sign in [1,-1]:
        for f in [.04,.15]:
            v=x+sign*(max(1,round(span*f)) if p['type']=='int' else max(span*f,1e-4))
            if lo<=v<=hi and v!=x and v not in out:out.append(v)
    return out

def delta(a,b):
    pa={p['id']:p for p in a['panels']};pb={p['id']:p for p in b['panels']}
    affected=[];max_move=0.;same=True
    for k in sorted(set(pa)|set(pb)):
        if k not in pa or k not in pb:affected.append(k);same=False;continue
        aa,bb=pa[k],pb[k]
        if len(aa['verticesMm'])!=len(bb['verticesMm']):same=False
        else:
            max_move=max(max_move,max((math.dist(x,y) for x,y in zip(aa['verticesMm'],bb['verticesMm'])),default=0))
        av={'v':aa['verticesMm'],'e':[{q:e[q] for q in ['endpoints','kind','controlPointsMm','arc'] if q in e} for e in aa['edges']],'p':aa['placement']}
        bv={'v':bb['verticesMm'],'e':[{q:e[q] for q in ['endpoints','kind','controlPointsMm','arc'] if q in e} for e in bb['edges']],'p':bb['placement']}
        if encoded(av)!=encoded(bv):affected.append(k)
    return {'changedPanels':affected,'panelCountDelta':len(b['panels'])-len(a['panels']),
      'seamCountDelta':len(b['seams'])-len(a['seams']),'sameVertexCounts':same,
      'maximumCorrespondingBoundaryVertexMoveMm':max_move if same else None}

def main():
    started=time.monotonic(); data=json.loads(gzip.decompress((P/'qa/probe-contexts.json.gz').read_bytes()))
    contexts={c['id']:c for c in data['contexts']}; atlas=json.loads((P/'parameter-atlas.json').read_text())
    body=json.loads((P/'reference-body.json').read_text())['bodyCm']; cache={}; all_attempts=[]
    archive=SOURCE/'browser/pattern-runtime.zip'
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(archive) as z:z.extractall(tmp)
        sys.path.insert(0,tmp); g=importlib.import_module('pattern_catalogue')
        def baseline(cid):
            if cid not in cache:
                try:
                    result=g.generatePattern({'bodyCm':body,'design':contexts[cid]['design']});audit(result);cache[cid]=result
                except Exception as e:cache[cid]={'contextError':str(e)}
            return cache[cid]
        for p in atlas['parameters']:
            status='no-effect-in-tested-contexts';evidence=None;attempts=[]
            if time.monotonic()-started>480:p.update(status='budget-not-tested',evidence=None);continue
            candidates=p['candidateContexts']
            # The first real preset is preferred. Technical contexts explicitly enable rare controls.
            candidates=candidates[:3]+[c for c in candidates if c.startswith('probe-')]+candidates[3:6]
            for cid in dict.fromkeys(candidates):
                a=baseline(cid)
                if 'contextError' in a:
                    attempts.append({'context':cid,'baselineError':a['contextError']});continue
                old=get(a['design'],p['path'])
                for value in choices(p,old)[:4]:
                    design=copy.deepcopy(a['design']);put(design,p['path'],value)
                    try:
                        b=g.generatePattern({'bodyCm':body,'design':design});audit(b)
                        changed=canonical_geometry(a)!=canonical_geometry(b)
                        attempt={'context':cid,'from':old,'to':value,'paperValid':True,'geometryChanged':changed}
                        attempts.append(attempt)
                        if changed:
                            evidence={**attempt,**delta(a,b),'beforeRecipeHash':a['recipeHash'],'afterRecipeHash':b['recipeHash'],
                              'onlyOneDesignFieldChanged':True,'sameBody':True,'backend':'native pinned official generator',
                              'allChoicesTested':False,'physicalEffectCertified':False}
                            status='observed-effect';break
                    except Exception as e:attempts.append({'context':cid,'from':old,'to':value,'error':str(e)})
                if evidence:break
            if not any(a.get('paperValid') for a in attempts):status='no-valid-perturbation' if attempts else 'no-enabled-context'
            p.update(status=status,evidence=evidence,attemptCount=len(attempts))
            all_attempts.append({'path':p['path'],'status':status,'attempts':attempts})
            print('PROBE',p['path'],status,'context='+(evidence['context'] if evidence else '-'),flush=True)
    observed=sum(p['status']=='observed-effect' for p in atlas['parameters'])
    atlas.update({'observedParameterEffects':observed,'fieldCount':len(atlas['parameters']),
      'allParametersMastered':False,'allParameterDomainsCertified':False,
      'scope':'One-field perturbations on fixed reference-body paper. Not all option combinations, body shapes, fabrics or sewn garments.',
      'seconds':time.monotonic()-started})
    write('parameter-atlas.json',atlas);write('qa/parameter-attempts.json',all_attempts)
    summary={'observedEffects':observed,'fields':len(atlas['parameters']),
      'unresolved':[{'path':p['path'],'status':p['status']} for p in atlas['parameters'] if p['status']!='observed-effect'],
      'allDomainsCertified':False,'seconds':atlas['seconds']}
    write('PARAMETER_REPORT.json',summary);print('P01_PARAMETER_SUMMARY',json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
