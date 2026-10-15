"""Independent checks of analytic cutting pieces and declared sewing topology.

No material solve, body fit, or manufactured seam allowance is inferred here.
"""
import collections, hashlib, json, math
import numpy as np
from scipy.integrate import quad

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def curve(panel, edge):
    a,b=[np.array(panel['verticesMm'][i],float) for i in edge['endpoints']]
    if edge['kind']=='line':
        return lambda t:a+(b-a)*t, lambda t:b-a
    if edge['kind'] in ('quadratic','cubic'):
        controls=[a,*[np.array(x,float) for x in edge['controlPointsMm']],b]
        n=len(controls)-1
        def at(t):
            return sum(math.comb(n,i)*(1-t)**(n-i)*t**i*p for i,p in enumerate(controls))
        def derivative(t):
            return sum(n*math.comb(n-1,i)*(1-t)**(n-1-i)*t**i*(controls[i+1]-controls[i]) for i in range(n))
        return at,derivative
    if edge['kind']=='circle':
        arc=edge['arc'];c=np.array(arc['centerMm'],float);r=arc['radiusMm']
        theta=math.radians(arc['startAngleDegrees']);sweep=math.radians(arc['sweepDegrees'])
        def at(t):
            angle=theta+sweep*t
            return c+r*np.array([math.cos(angle),math.sin(angle)])
        def derivative(t):
            angle=theta+sweep*t
            return r*sweep*np.array([-math.sin(angle),math.cos(angle)])
        return at,derivative
    raise ValueError(f"Unsupported analytic edge kind {edge['kind']}")

def audit(pattern):
    errors=[];warnings=[];panels={};used=collections.defaultdict(list);rows=[]
    def error(code,**detail):errors.append({'code':code,**detail})
    if pattern.get('schema')!='kaopu-analytic-sewing-pattern@1' or pattern.get('units')!='mm':
        error('PATTERN_SCHEMA_OR_UNITS')
    try: canonical(pattern)
    except (TypeError,ValueError):error('NONFINITE_OR_UNSERIALIZABLE')
    for p in pattern.get('panels',[]):
        pid=p['id']
        if pid in panels:error('DUPLICATE_PANEL',panel=pid)
        panels[pid]=p
        if not p['edges'] or len(p['verticesMm'])<3:error('EMPTY_PANEL',panel=pid);continue
        if p['boundary']!=list(range(len(p['edges']))):error('BOUNDARY_ORDER',panel=pid)
        area=0.;max_length=0.;max_end=0.;lengths=[]
        for i,e in enumerate(p['edges']):
            try:
                if e['index']!=i or e['id']!=f'e{i}':raise ValueError('Edge identity differs from boundary order')
                if any(type(k) is not int or not 0<=k<len(p['verticesMm']) for k in e['endpoints']):raise ValueError('Invalid vertex reference')
                at,der=curve(p,e)
                endpoint=max(math.dist(at(t),p['verticesMm'][e['endpoints'][t]]) for t in (0,1))
                max_end=max(max_end,endpoint)
                if endpoint>1e-5:error('CURVE_ENDPOINT_MISMATCH',panel=pid,edge=i,mm=endpoint)
                next_edge=p['edges'][(i+1)%len(p['edges'])]
                gap=math.dist(p['verticesMm'][e['endpoints'][1]],p['verticesMm'][next_edge['endpoints'][0]])
                if gap>1e-5:error('OPEN_BOUNDARY',panel=pid,edge=i,mm=gap)
                length,estimate=quad(lambda t:float(np.linalg.norm(der(t))),0,1,epsabs=1e-7,epsrel=1e-10,limit=150)
                max_length=max(max_length,abs(length-e['lengthMm']))
                if length<=1e-5:error('DEGENERATE_EDGE',panel=pid,edge=i)
                if abs(length-e['lengthMm'])>1e-4:error('INDEPENDENT_EDGE_LENGTH',panel=pid,edge=i,mm=abs(length-e['lengthMm']))
                lengths.append(length)
                area+=quad(lambda t:float(np.cross(at(t),der(t)))/2,0,1,epsabs=1e-6,epsrel=1e-10,limit=150)[0]
            except (ValueError,KeyError,IndexError,TypeError) as exc:error('INVALID_CURVE',panel=pid,edge=i,message=str(exc))
        if abs(area)<1e-3:error('DEGENERATE_ANALYTIC_AREA',panel=pid)
        rows.append({'panelId':pid,'analyticAreaMm2':area,'perimeterMm':sum(lengths),
            'edgeCount':len(p['edges']),'maxIndependentLengthDifferenceMm':max_length,'maxEndpointDifferenceMm':max_end})
    ids=set();graph={pid:set() for pid in panels};seam_rows=[]
    for s in pattern.get('seams',[]):
        if s['id'] in ids:error('DUPLICATE_SEAM',seam=s['id'])
        ids.add(s['id']);resolved=[]
        for side in ('a','b'):
            end=s[side];pid=end['panelId'];idx=end['edge']
            if pid not in panels or type(idx) is not int or not 0<=idx<len(panels[pid]['edges']):
                error('MISSING_SEAM_REFERENCE',seam=s['id'],side=side);continue
            if type(end.get('reverse')) is not bool:error('MISSING_SEAM_DIRECTION',seam=s['id'],side=side)
            used[(pid,idx)].append(s['id']);resolved.append(panels[pid]['edges'][idx])
        if len(resolved)!=2:continue
        a,b=resolved;la,lb=a['lengthMm'],b['lengthMm'];g=s.get('gathering')
        for field,wanted in [('lengthAMm',la),('lengthBMm',lb),('easeMm',la-lb),('lengthRatioAOverB',la/lb)]:
            if not math.isclose(s[field],wanted,rel_tol=1e-9,abs_tol=1e-6):error('SEAM_MEASUREMENT_MISMATCH',seam=s['id'],field=field)
        if s['a']==s['b']:error('SELF_PAIRED_EDGE',seam=s['id'])
        if s['direction'] not in ('same','opposite') or (s['a']['reverse']==s['b']['reverse'])!=(s['direction']=='same'):
            error('SEAM_DIRECTION_CONFLICT',seam=s['id'])
        if s['isDart']!=(s['a']['panelId']==s['b']['panelId']):error('DART_IDENTITY',seam=s['id'])
        if not g:error('MISSING_GATHERING_PROVENANCE',seam=s['id'])
        else:
            if any(not math.isfinite(g[k]) or g[k]<=0 for k in ('ruffleCoefficientA','ruffleCoefficientB','projectedLengthAMm','projectedLengthBMm')):
                error('INVALID_GATHERING',seam=s['id'])
            mismatch=g['projectedLengthAMm']-g['projectedLengthBMm']
            if abs(mismatch)>3:warnings.append({'code':'PROJECTED_LENGTH_REVIEW','seam':s['id'],'differenceMm':mismatch})
        x,y=s['a']['panelId'],s['b']['panelId'];graph[x].add(y);graph[y].add(x)
        seam_rows.append({'seamId':s['id'],'a':s['a'],'b':s['b'],'direction':s['direction'],
            'lengthAMm':la,'lengthBMm':lb,'easeMm':la-lb,'gathering':g,'isDart':s['isDart'],
            'stageId':s['stageId'],'sourceStitchIndex':s['sourceStitchIndex']})
    for (pid,idx),seams in used.items():
        if len(seams)>1:error('EDGE_SEWN_MULTIPLE_TIMES',panel=pid,edge=idx,seams=seams)
    free=[]
    for pid,p in panels.items():
        for e in p['edges']:
            if (pid,e['index']) not in used:free.append({'panelId':pid,'edge':e['index'],'lengthMm':e['lengthMm'],'label':e.get('label')})
    # Connectivity comes only from declared sewing edges, never from spatial proximity.
    components=[];unseen=set(panels)
    while unseen:
        stack=[min(unseen)];component=[]
        while stack:
            pid=stack.pop()
            if pid not in unseen:continue
            unseen.remove(pid);component.append(pid);stack.extend(sorted(graph[pid]&unseen))
        components.append(sorted(component))
    if len(components)!=1:error('DISCONNECTED_SEWING_COMPONENTS',components=components)
    if not pattern.get('validation',{}).get('analytic2DPass'):error('SOURCE_2D_VALIDATION_FAILED',details=pattern.get('validation'))
    if not pattern.get('validation',{}).get('intersectionCheckRun'):error('SOURCE_CROSSING_CHECK_SKIPPED')
    return {'schema':'kaopu-pattern-structural-audit@1','passed':not errors,'errors':errors,'warnings':warnings,
        'panels':rows,'seams':seam_rows,'freeBoundaries':free,'connectedComponents':components,
        'freeBoundaryMeaning':'unsewn source edges retained; not proof of finished hem or manufacturing opening',
        'continuousCurveIntersectionCertified':False,'physicalFitCertified':False,'manufacturingCertified':False}
