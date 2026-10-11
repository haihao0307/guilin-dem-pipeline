"""Extract authored CC0 tube centrelines, retaining all 14 original styles.
Not image tracing: connected OBJ components and three-vertex cross-sections.
"""
from pathlib import Path
from collections import defaultdict,Counter
import json,hashlib,base64,struct,math,sys,io
from PIL import Image

def extract(src,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    packs=[];audit=[]
    for fn in sorted(Path(src).rglob('mind_eyebrows_*.obj')):
        text=fn.read_text();assert '# license CC0' in text
        verts=[];faces=[]
        for line in text.splitlines():
            if line.startswith('v '):verts.append(tuple(map(float,line.split()[1:4])))
            elif line.startswith('f '):faces.append([int(v.split('/')[0])-1 for v in line.split()[1:]])
        parent=list(range(len(verts)))
        def find(a):
            while a!=parent[a]:parent[a]=parent[parent[a]];a=parent[a]
            return a
        for face in faces:
            for v in face[1:]:parent[find(v)]=find(face[0])
        groups=defaultdict(list)
        for i in range(len(verts)):groups[find(i)].append(i)
        points=[];counts=[];lengths=[];flips=0
        for ids in sorted(groups.values(),key=lambda x:x[0]):
            assert len(ids)%3==0 and len(ids)>=9 and ids==list(range(ids[0],ids[-1]+1)),(fn,ids[:5])
            centers=[];radii=[]
            for j in range(0,len(ids),3):
                ring=[verts[k] for k in ids[j:j+3]]
                c=tuple(sum(v[d] for v in ring)/3 for d in range(3));centers.append(c)
                radii.append(sum(math.dist(c,v) for v in ring)/3)
            if radii[0]<radii[-1]*.7:centers.reverse();radii.reverse();flips+=1
            assert all(math.isfinite(x) for p in centers for x in p)
            lengths.append(sum(math.dist(a,b) for a,b in zip(centers,centers[1:])))
            counts.append(len(centers));points.extend(x for p in centers for x in p)
        thumb=next(fn.parent.glob('*.thumb'));im=Image.open(thumb).convert('RGB');im.thumbnail((96,96));buf=io.BytesIO();im.save(buf,format='WEBP',quality=78)
        pack={'id':int(fn.stem[-2:]),'name':'Mindfront '+fn.stem[-2:], 'count':len(counts),'counts':base64.b64encode(bytes(counts)).decode(),'points':base64.b64encode(struct.pack('<'+'f'*len(points),*points)).decode(),'thumbnail':'data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode(),'sourceSha256':hashlib.sha256(fn.read_bytes()).hexdigest()}
        packs.append(pack);audit.append({'id':pack['id'],'source':fn.name,'sha256':pack['sourceSha256'],'vertices':len(verts),'faces':len(faces),'strands':len(counts),'rings':dict(Counter(counts)),'rootTipFlips':flips,'meanNativeArcLength':sum(lengths)/len(lengths),'license':'CC0','author':'Mindfront'})
    assert len(packs)==14
    (out/'BrowData.js').write_text('/* Mindfront, MakeHuman Eyebrows01, CC0. Original authored mesh centrelines; see provenance. */\nexport const BROW_LIBRARY='+json.dumps(packs,separators=(',',':'))+';\n')
    (out/'BROW_PROVENANCE.json').write_text(json.dumps({'sourcePage':'https://static.makehumancommunity.org/assets/assetpacks/eyebrows01.html','zipSha256':'5425891dce613bef85c7117f7843cd49d57d1fb28127e76d77d2a2eaccb4fe78','method':'OBJ connected components -> ordered triangular rings -> centrelines; no mesh pasted onto GNM','styles':audit},indent=2))
    print('14 styles,',sum(x['count'] for x in packs),'original strands; JS bytes',(out/'BrowData.js').stat().st_size)
if __name__=='__main__':extract(sys.argv[1],sys.argv[2])
