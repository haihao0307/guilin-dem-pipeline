"""Independent source/recipe/package audit; does not import extraction code.

Point tests are finite vertex and centroid samples, not a global Hausdorff proof.
"""
import collections, hashlib, json, math, pathlib, re, struct, time, zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
REPORT={'schema':'hk-three-buildings-independent-qa/1','passed':False,'checks':[],'buildings':[]}
def save(): (OUT/'PACKAGE_QA.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
def check(name,ok,detail=None):
    REPORT['checks'].append({'name':name,'passed':bool(ok),'detail':detail});save()
    if not ok:raise AssertionError(name+': '+str(detail))
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text())
def minus(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm2(a):return dot(a,a)
def mix(a,b,t):return [x+t*(y-x) for x,y in zip(a,b)]
def dist2(p,tri):
    # Ericson closest-point region test, independent from the recipe decoder.
    a,b,c=tri;ab=minus(b,a);ac=minus(c,a);ap=minus(p,a);d1=dot(ab,ap);d2=dot(ac,ap)
    if d1<=0 and d2<=0:return norm2(ap)
    bp=minus(p,b);d3=dot(ab,bp);d4=dot(ac,bp)
    if d3>=0 and d4<=d3:return norm2(bp)
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0:return norm2(minus(p,mix(a,b,d1/(d1-d3))))
    cp=minus(p,c);d5=dot(ab,cp);d6=dot(ac,cp)
    if d6>=0 and d5<=d6:return norm2(cp)
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0:return norm2(minus(p,mix(a,c,d2/(d2-d6))))
    va=d3*d6-d5*d4
    if va<=0 and d4-d3>=0 and d5-d6>=0:return norm2(minus(p,mix(b,c,(d4-d3)/((d4-d3)+(d5-d6)))))
    den=va+vb+vc
    if abs(den)<1e-30:return min(norm2(ap),norm2(bp),norm2(cp))
    v=vb/den;w=vc/den;q=[a[i]+ab[i]*v+ac[i]*w for i in range(3)]
    return norm2(minus(p,q))
def triangles(values):return [[values[j:j+3] for j in range(i,i+9,3)] for i in range(0,len(values),9)]
def area(tris):return sum(math.sqrt(norm2(cross(minus(t[1],t[0]),minus(t[2],t[0]))))*.5 for t in tris)
def surface_distance(a,b):
    samples=[p for t in a for p in t+[[sum(t[j][i] for j in range(3))/3 for i in range(3)]]]
    return math.sqrt(max((min(dist2(p,t) for t in b) for p in samples),default=0)),len(samples)
def matmul(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
IDENTITY=[[1.0 if i==j else 0.0 for j in range(4)] for i in range(4)]
def source_positions(gltf,origin):
    doc=read(gltf);bufs=[(gltf.parent/b['uri']).read_bytes() for b in doc['buffers']]
    def accessor(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];fmt={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];f='<'+fmt*width;size=struct.calcsize(f)
        offset=a.get('byteOffset',0)+v.get('byteOffset',0);stride=v.get('byteStride',size)
        return [struct.unpack_from(f,bufs[v['buffer']],offset+i*stride) for i in range(a['count'])]
    output=[]
    def walk(i,parent):
        n=doc['nodes'][i]
        if 'matrix' in n:m=[[n['matrix'][4*j+i] for j in range(4)] for i in range(4)]
        else:
            check('no unsupported source TRS',not any(k in n for k in ['translation','rotation','scale']))
            m=IDENTITY
        world=matmul(parent,m)
        if 'mesh' in n:
            for p in doc['meshes'][n['mesh']]['primitives']:
                check('source triangle primitive',p.get('mode',4)==4)
                verts=accessor(p['attributes']['POSITION']);ids=[x[0] for x in accessor(p['indices'])] if 'indices'in p else range(len(verts))
                for k in ids:
                    q=list(verts[k])+[1];v=[dot(row,q) for row in world]
                    output.extend([v[0]-origin[0],v[1]-origin[2],v[2]+origin[1]])
        for c in n.get('children',[]):walk(c,world)
    for i in doc['scenes'][doc.get('scene',0)]['nodes']:walk(i,IDENTITY)
    return output
def funcs(text):
    found={}
    for m in re.finditer(r'^\w+\s+(\w+)\([^\n]*\)\s*\{',text,re.M):
        pos=m.end();depth=1
        while depth:
            depth+=(text[pos]=='{')-(text[pos]=='}');pos+=1
        found[m[1]]=text[m.start():pos]
    return found
try:
    start=time.perf_counter();manifest=read(ROOT/'geometry/buildings.json')
    check('three distinct models',len(manifest['buildings'])==3 and len({x['id'] for x in manifest['buildings']})==3)
    for building in manifest['buildings']:
        bid=building['id'];g=ROOT/'geometry';provenance=read(g/(bid+'.provenance.json'));score=read(g/(bid+'.score.json'))
        for rel in provenance['sourceRelativePaths']:
            f=g/rel;check(bid+' original '+f.name,sha(f.read_bytes())==provenance['sourceFileSha256'][f.name])
        original=g/'original'/bid/(bid+'.gltf');source=read(g/(bid+'.source-preview.json'))['positions']
        decoded=source_positions(original,building['georeference']['originEastingNorthingHeight'])
        check(bid+' independently decoded source equals preview',len(source)==len(decoded) and max(abs(a-b) for a,b in zip(source,decoded))<1e-8)
        reconstructed=read(g/(bid+'.reconstructed-preview.json'));src=triangles(source);dst=triangles(reconstructed['positions'])
        audit=read(g/(bid+'.extraction-audit.json'));groups=reconstructed['groups'];coverage=collections.Counter(i for p in audit['patches'] for i in p['sourceTriangles'])
        check(bid+' source coverage exactly once',set(coverage)==set(range(len(src))) and set(coverage.values())=={1})
        check(bid+' patch/group count',len(audit['patches'])==len(groups)==len(score['reconstruction']['operations']))
        patches=[];max_dist=0;sample_count=0
        for patch,group in zip(audit['patches'],groups):
            a=[src[i] for i in patch['sourceTriangles']];b=dst[group['start']//3:(group['start']+group['count'])//3]
            ab,n=surface_distance(a,b);ba,m=surface_distance(b,a);sample_count+=n+m;max_dist=max(max_dist,ab,ba)
            aa,bb=area(a),area(b);error=abs(aa-bb);ok=max(ab,ba)<.0003 and error<max(.0001,aa*1e-5)
            patches.append({'id':patch['id'],'sourceToRecipeSamplesMaxM':ab,'recipeToSourceSamplesMaxM':ba,'sourceAreaM2':aa,'recipeAreaM2':bb,'passed':ok})
        check(bid+' sampled geometry and patch area',all(x['passed'] for x in patches),{'maxSampleDistanceM':max_dist,'samples':sample_count})
        source_size=sum((g/p).stat().st_size for p in provenance['sourceRelativePaths']);recipe=(g/(bid+'.score.json')).read_bytes()
        REPORT['buildings'].append({'id':bid,'sourceTriangles':len(src),'reconstructedTriangles':len(dst),'sourceBytes':source_size,
            'originalSourceZipMemberBytes':provenance['existingZipCompressedMemberBytes'],'recipeBytes':len(recipe),'recipeDeflateBytes':len(zlib.compress(recipe,9)),
            'maxFiniteSampleDistanceM':max_dist,'finiteSampleCount':sample_count,'sourceAreaM2':area(src),'reconstructedAreaM2':area(dst),'patches':patches})
    lock=read(ROOT/'qa/material-original-function-hashes.json');bodies=funcs((ROOT/'viewer/mothers/kaopu-original.glsl').read_text())
    check('exact frozen mother function bodies',set(lock['functions'])<=set(bodies) and all(sha(bodies[k].encode())==v for k,v in lock['functions'].items()),{'functions':len(lock['functions']),'sourceCommit':lock['sourceCommit']})
    stone=funcs((ROOT/'viewer/mothers/context-stone.glsl').read_text())
    check('exact frozen stone function bodies',set(lock['stoneFunctions'])==set(stone) and all(sha(stone[k].encode())==v for k,v in lock['stoneFunctions'].items()),{'functions':len(stone)})
    check('stone attribution retained',(ROOT/'viewer/provenance/STONE_NOTICE.md').is_file())
    for name,expected in lock['moduleSha256'].items():check('frozen '+name,sha((ROOT/'viewer/provenance'/name).read_bytes())==expected)
    check('CSDI rights notice included',(ROOT/'LICENSE_SCOPE.md').is_file())
    check('Three licence included',(ROOT/'viewer/vendor/THREE-LICENSE.txt').is_file())
    REPORT['bytes']={'sharedReconstructor':(ROOT/'geometry/reconstruct.mjs').stat().st_size,'sharedThreeModule':(ROOT/'viewer/vendor/three.module.js').stat().st_size,'materialClosure':(ROOT/'viewer/mothers/kaopu-original.glsl').stat().st_size}
    REPORT['wallSeconds']=time.perf_counter()-start;REPORT['passed']=True
except Exception as e:
    REPORT['error']=repr(e);save();raise
finally:save()
print(json.dumps({k:v for k,v in REPORT.items() if k not in ['checks','buildings']},indent=2))
