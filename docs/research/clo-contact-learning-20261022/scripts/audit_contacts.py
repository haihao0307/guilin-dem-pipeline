"""Read-only geometric analysis of the frozen R02 public negative packet.

Uses numpy longdouble segment/triangle arithmetic independently of app JS.
No position is changed and no solver is executed. Legacy filter is a
counterfactual eligibility audit, not an assertion that response ran.
"""
import gzip, json, hashlib, pathlib, collections, platform, sys, os
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[4]
def rooted(value):
    return (ROOT/pathlib.Path(value)).resolve()
APP=rooted(os.environ.get('APP','kaopu-tailor-workbench/clo-learning-r02'))
SOURCE=rooted(os.environ.get('DONE','docs/handoffs/clo-learning-r02-20261022/acceptance/public/public-browser-smoke.packet-4-done-request-2.json.gz'))
FIXTURE=APP/'evidence/fixtures/BROWSER_FAILED_LENGTH100_OPENINGM40.json.gz'
OUT=rooted(os.environ.get('OUT','contact-learning-output/clo-contact-learning-20261022'))
OUT.mkdir(parents=True,exist_ok=True)
raw=SOURCE.read_bytes()
if hashlib.sha256(raw).hexdigest()!='bab71beee5c7a177e77199e1766af65c64972f5c026d16dc24b060ce7d86382e':
    raise ValueError('Frozen public done packet bytes mismatch')
wrapper=json.loads(gzip.decompress(raw)); packet=wrapper['packet']
if wrapper['sourceHead']!='c5c99dd6e7fb2124435653843c618bc6a4e4c47b' or packet['type']!='done' or packet['requestId']!=2:
    raise ValueError('Frozen public done packet identity mismatch')
fixture=json.loads(gzip.decompress(FIXTURE.read_bytes()))['packet']
spec=packet['spec']; rec=packet['record']; ps=np.array(rec['positionsMm'],dtype=np.longdouble)
groups=rec['materialToSolverGroup']; panels={p['id']:p for p in spec['panels']}
faces=[]; offsets={}; neighbours=[{i} for i in range(len(ps))]; off=0
for p in spec['panels']:
    offsets[p['id']]=off
    for i,t in enumerate(p['triangles']):
        ids=[off+j for j in t]
        faces.append(dict(panel=p['id'],localTriangle=i,localVertices=t,ids=ids))
        for j in range(3):
            a,b=ids[j],ids[(j+1)%3]; neighbours[a].add(b); neighbours[b].add(a)
    off+=len(p['uvMm'])
group_neighbours={}
for i,ns in enumerate(neighbours):
    group_neighbours.setdefault(groups[i],set()).update(groups[j] for j in ns)

def segtri(a,b,x,y,z):
    d=b-a;e1=y-x;e2=z-x;p=np.cross(d,e2);det=np.dot(e1,p)
    if abs(det)<np.longdouble('1e-10'):return None
    t=a-x;u=np.dot(t,p)/det;q=np.cross(t,e1);v=np.dot(d,q)/det;s=np.dot(e2,q)/det
    if u < -np.longdouble('1e-8') or u>1+np.longdouble('1e-8') or v < -np.longdouble('1e-8') or u+v>1+np.longdouble('1e-8') or not (s>np.longdouble('1e-7') and s<1-np.longdouble('1e-7')):return None
    return dict(pointMm=[float(x) for x in a+s*d],edgeT=float(s),triangleBarycentric=[float(1-u-v),float(u),float(v)],determinant=float(det))

def segdist(p,a,b):
    d=b-a;t=np.clip(np.dot(p-a,d)/np.dot(d,d),0,1)
    return float(np.linalg.norm(p-a-t*d))

def face_info(f):
    p=panels[f['panel']]; uvs=np.array([p['uvMm'][i] for i in f['localVertices']]); center=uvs.mean(axis=0)
    near=[]
    for seam in spec['seams']:
        for side in ('a','b'):
            e=seam[side]
            if e['panelId']!=p['id']:continue
            ids=p['edges'][e['edge']]; pts=np.array([p['uvMm'][i] for i in ids]); ds=[segdist(center,a,b) for a,b in zip(pts,pts[1:])]
            near.append(dict(seam=seam['id'],edge=e['edge'],side=side,centroidDistanceMm=min(ds),sharedMaterialVertices=sorted(set(ids)&set(f['localVertices']))))
    near.sort(key=lambda x:x['centroidDistanceMm'])
    return {**f,'solverGroups':[groups[i] for i in f['ids']], 'uvCentroidMm':center.tolist(), 'nearestSeams':near[:3]}

def closest_triangle(p,a,b,c):
    # Ericson Voronoi regions; this independent distance calculation uses longdouble.
    ab=b-a;ac=c-a;ap=p-a;d1=np.dot(ab,ap);d2=np.dot(ac,ap)
    if d1<=0 and d2<=0:return a
    bp=p-b;d3=np.dot(ab,bp);d4=np.dot(ac,bp)
    if d3>=0 and d4<=d3:return b
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0:return a+d1/(d1-d3)*ab
    cp=p-c;d5=np.dot(ab,cp);d6=np.dot(ac,cp)
    if d6>=0 and d5<=d6:return c
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0:return a+d2/(d2-d6)*ac
    va=d3*d6-d5*d4
    if va<=0 and d4-d3>=0 and d5-d6>=0:return b+(d4-d3)/((d4-d3)+(d5-d6))*(c-b)
    den=1/(va+vb+vc);return a+vb*den*ab+vc*den*ac

rows=[]
for ia,ib in packet['intersections']['selfPairs']:
    a,b=faces[ia],faces[ib]; aa=ps[a['ids']];bb=ps[b['ids']]; hits=[]
    for label,source,target in [('A',aa,bb),('B',bb,aa)]:
        for i in range(3):
            h=segtri(source[i],source[(i+1)%3],*target)
            if h:hits.append({'edgeFrom':label,'edgeLocal':i,**h})
    unique=[]
    for h in hits:
        pt=np.array(h['pointMm'])
        if all(np.linalg.norm(pt-np.array(u))>1e-7 for u in unique):unique.append(h['pointMm'])
    # Production proper-edge test excludes segment endpoints. Include exact
    # coincident shared endpoints to measure the observed line interval.
    for x in aa:
        if any(np.linalg.norm(x-y)<1e-9 for y in bb):
            if all(np.linalg.norm(x-np.array(u,dtype=np.longdouble))>1e-7 for u in unique):unique.append([float(v) for v in x])
    # Evaluate exactly the legacy group-neighbour predicate for all directed
    # vertex/face combinations in this pair, and the 0.6 mm distance condition.
    eligible=[]; skipped=[]
    for name,source,target in [('A_to_B',a,b),('B_to_A',b,a)]:
        for i in sorted(set(groups[j] for j in source['ids'])):
            item={'direction':name,'representativeVertex':i,'sourceFaceVertices':[j for j in source['ids'] if groups[j]==i]}
            if any(groups[j] in group_neighbours[groups[i]] for j in target['ids']):skipped.append(item);continue
            q=closest_triangle(ps[i],*ps[target['ids']]);dist=float(np.linalg.norm(ps[i]-q))
            eligible.append({**item,'pointTriangleDistanceMm':dist,'withinLegacyThickness':dist<0.6})
    group_shared=sorted(set(groups[i] for i in a['ids'])&set(groups[i] for i in b['ids']))
    rows.append(dict(pair=[ia,ib],a=face_info(a),b=face_info(b),independentLongdoubleProperHits=hits,uniqueIntersectionPointsMm=unique,
        intersectionSpanMm=max((float(np.linalg.norm(np.array(x)-np.array(y))) for x in unique for y in unique),default=0),
        sharedMaterialVertices=sorted(set(a['ids'])&set(b['ids'])),sharedSolverGroups=group_shared,
        legacyCounterfactual={'topologyVerticesSkipped':skipped,'eligibleVertexFace':eligible,'noEligibleVertexFace':not eligible,'eligibleWithinThicknessCount':sum(x['withinLegacyThickness'] for x in eligible)}))

# Contact graph components: exact face-sharing, no distance-based merging.
components=[];remain=set(range(len(rows)))
while remain:
    todo=[remain.pop()];comp=[];used=set()
    while todo:
        i=todo.pop();comp.append(i);used.update(rows[i]['pair'])
        more={j for j in remain if set(rows[j]['pair'])&used};remain-=more;todo.extend(more)
    components.append({'pairs':[rows[i]['pair'] for i in comp],'faces':sorted(used)})
pairtypes=collections.Counter(tuple(sorted((r['a']['panel'],r['b']['panel']))) for r in rows)
report={'schema':'kaopu.contact-readonly-audit/1','source':os.path.relpath(SOURCE,ROOT), 'sourceSHA256':hashlib.sha256(raw).hexdigest(),
    'sourceHead':wrapper['sourceHead'],'fixtureComparison':{k:packet[k]==fixture[k] for k in ('spec','analytic','record','intersections')},
    'runtime':{'python':sys.version,'numpy':np.__version__,'platform':platform.platform(),'longdoubleMantissaBits':np.finfo(np.longdouble).nmant,'longdoubleEpsilon':str(np.finfo(np.longdouble).eps)},
    'checks':{'sourceUnchanged':raw==SOURCE.read_bytes(),'properSegmentInteriorTolerance':1e-7,'barycentricTolerance':1e-8,'determinantTolerance':1e-10,'legacyStaticThicknessMm':0.6},
    'runtimeSelfContact':rec['trial']['runtimeSelfContact'],'continuousCollision':rec['trial']['continuousCollision'],
    'summary':{'reportedPairs':len(rows),'longdoubleProperHitPairs':sum(bool(x['independentLongdoubleProperHits']) for x in rows),
        'panelPairs': [{'panels':list(k),'count':v} for k,v in pairtypes.items()],
        'samePanelPairs':sum(r['a']['panel']==r['b']['panel'] for r in rows),
        'pairsSharingMaterialVertex':sum(bool(r['sharedMaterialVertices']) for r in rows),
        'pairsSharingSolverGroup':sum(bool(r['sharedSolverGroups']) for r in rows),
        'legacyNoEligibleVertexFacePairs':sum(r['legacyCounterfactual']['noEligibleVertexFace'] for r in rows),
        'legacyPairsWithWithinThicknessEligible':sum(r['legacyCounterfactual']['eligibleWithinThicknessCount']>0 for r in rows),
        'faceSharingComponents':len(components),
        'minimumIntersectionSpanMm':min(r['intersectionSpanMm'] for r in rows),
        'maximumIntersectionSpanMm':max(r['intersectionSpanMm'] for r in rows)},
    'components':components,'rows':rows,
    'limits':['Final frozen geometry only; no trajectory or stage-of-first-intersection evidence.',
        'Counterfactual legacy vertex-face eligibility only; old positions and response execution not supplied.',
        'Longdouble repeat is stronger arithmetic corroboration, not exact-predicate certification.',
        'Nearest source seam is spatial/material association, not proven causation.',
        'No solver, gate, input, geometry or existing fixture was modified.']}
out=OUT/'CONTACT_AUDIT.json';out.write_text(json.dumps(report,indent=2)+'\n')
if not all(report['fixtureComparison'].values()) or not report['checks']['sourceUnchanged']:
    raise ValueError('Reference inputs or matching fixture changed')
if len(rows)!=packet['intersections']['selfStrictTriangleIntersectionCount'] or any(not r['independentLongdoubleProperHits'] for r in rows):
    raise ValueError('Reported frozen intersections were not independently confirmed')
print(json.dumps(report['summary'],indent=2))
for r in rows:
    print(r['pair'], r['a']['panel'],r['b']['panel'], 'seams',r['a']['nearestSeams'][0]['seam'],r['b']['nearestSeams'][0]['seam'],'span',round(r['intersectionSpanMm'],7),'shared',r['sharedSolverGroups'],'eligible',r['legacyCounterfactual']['eligibleVertexFace'])
