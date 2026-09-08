#!/usr/bin/env python3
"""Materialize the GitHub V0.1 one-score multi-conductor pilot."""
from __future__ import annotations

import base64, hashlib, json, math, os, shutil, struct, sys, zipfile, zlib
from pathlib import Path
import numpy as np
from source_data import SOURCE

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'projects/wenzhou/full-score-v001'
MAGIC=b'WZFSG01\0'; U64=1<<64


def jwrite(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def twrite(path,text):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text.strip()+'\n',encoding='utf-8')

def sha(b): return hashlib.sha256(b).hexdigest()
def fsha(p): return sha(p.read_bytes())
def phase(i,n): return ((2*i+1)*U64)//(2*n)
def unphase(p,n): return min(n-1,(p*n)//U64)

def fwd1(x):
    x=np.asarray(x,dtype=np.int64); n=x.shape[-1]
    if n<2:return x.copy()
    lo=x[...,0::2].copy(); hi=x[...,1::2].copy(); lc=lo.shape[-1]; hc=hi.shape[-1]
    r=np.empty_like(hi)
    if hc>1:r[...,:-1]=lo[...,1:hc]
    r[...,-1]=lo[...,hc] if hc<lc else lo[...,-1]
    hi-=(lo[...,:hc]+r)//2
    l=np.empty_like(lo); rr=np.empty_like(lo); l[...,0]=hi[...,0]
    if lc>1:l[...,1:]=hi[...,:lc-1]
    rr[...,:hc]=hi
    if lc>hc:rr[...,hc:]=hi[...,-1:]
    lo+=(l+rr+2)//4
    return np.concatenate([lo,hi],axis=-1)

def inv1(x):
    x=np.asarray(x,dtype=np.int64); n=x.shape[-1]
    if n<2:return x.copy()
    lc=(n+1)//2; hc=n//2; lo=x[...,:lc].copy(); hi=x[...,lc:].copy()
    l=np.empty_like(lo); rr=np.empty_like(lo); l[...,0]=hi[...,0]
    if lc>1:l[...,1:]=hi[...,:lc-1]
    rr[...,:hc]=hi
    if lc>hc:rr[...,hc:]=hi[...,-1:]
    lo-=(l+rr+2)//4
    r=np.empty_like(hi)
    if hc>1:r[...,:-1]=lo[...,1:hc]
    r[...,-1]=lo[...,hc] if hc<lc else lo[...,-1]
    hi+=(lo[...,:hc]+r)//2
    y=np.empty_like(x); y[...,0::2]=lo; y[...,1::2]=hi
    return y

def fwd2(a,levels=5):
    a=np.asarray(a,dtype=np.int64).copy(); h,w=a.shape; shapes=[]
    for _ in range(levels):
        if h<2 and w<2:break
        shapes.append([h,w]); a[:h,:w]=np.apply_along_axis(fwd1,1,a[:h,:w]); a[:h,:w]=np.apply_along_axis(fwd1,0,a[:h,:w]); h=(h+1)//2; w=(w+1)//2
    return a,shapes

def inv2(a,shapes):
    a=np.asarray(a,dtype=np.int64).copy()
    for h,w in reversed(shapes):
        a[:h,:w]=np.apply_along_axis(inv1,0,a[:h,:w]); a[:h,:w]=np.apply_along_axis(inv1,1,a[:h,:w])
    return a

def slices(shapes):
    out={}
    for i,(h,w) in enumerate(shapes,1):
        lh=(h+1)//2; lw=(w+1)//2
        out[(i,'U')]=(slice(0,lh),slice(lw,w)); out[(i,'V')]=(slice(lh,h),slice(0,lw)); out[(i,'UV')]=(slice(lh,h),slice(lw,w))
    h,w=shapes[-1]; out[(len(shapes),'LL')]=(slice(0,(h+1)//2),slice(0,(w+1)//2)); return out

def encode_array(a):
    lo=int(a.min()) if a.size else 0; hi=int(a.max()) if a.size else 0
    dt=next(d for d in (np.dtype('<i1'),np.dtype('<i2'),np.dtype('<i4'),np.dtype('<i8')) if np.iinfo(d).min<=lo<=hi<=np.iinfo(d).max)
    raw=a.astype(dt,copy=False).tobytes(); z=zlib.compress(raw,9)
    return z,{'dtype':dt.str,'rawBytes':len(raw),'payloadBytes':len(z),'rawSha256':sha(raw),'payloadSha256':sha(z)}

def decode_source(p):
    raw=zlib.decompress(base64.b64decode(p['heightZlibB64'])); maskraw=zlib.decompress(base64.b64decode(p['maskZlibB64']))
    assert sha(raw)==p['heightRawSha256'] and sha(maskraw)==p['maskRawSha256'] and sha(raw+maskraw)==p['combinedTruthSha256']
    a=np.frombuffer(raw,dtype='<i2').reshape(p['height'],p['width']).copy(); m=np.unpackbits(np.frombuffer(maskraw,dtype=np.uint8),bitorder='little')[:a.size].reshape(a.shape).astype(bool)
    return a,m

def build():
    if OUT.exists():shutil.rmtree(OUT)
    for d in ['00_START_HERE','01_CONTRACTS','02_SOURCE','03_SCORE','04_CONDUCTORS','05_QA','06_DEMO','07_PACKAGE']: (OUT/d).mkdir(parents=True,exist_ok=True)
    pages=[]; packets=[]; objects=[]; object_by_hash={}; payloads=[]
    for src in SOURCE['pages']:
        a,m=decode_source(src); work=a.astype(np.int64); work[m]=0; levels=int(math.log2(a.shape[0])); c,shapes=fwd2(work,levels); sl=slices(shapes); pids=[]
        maskraw=np.packbits(m.reshape(-1).astype(np.uint8),bitorder='little').tobytes(); mz=zlib.compress(maskraw,9)
        entries=[('MASK',None,mz,{'dtype':'bitmask','rawBytes':len(maskraw),'rawSha256':sha(maskraw),'payloadBytes':len(mz),'payloadSha256':sha(mz)},[0,0,a.shape[0],a.shape[1]])]
        for level,band in [(5,'LL')]+[(l,b) for l in range(5,0,-1) for b in ('U','V','UV')]:
            r,cx=sl[(level,band)]; block=c[r,cx]; z,meta=encode_array(block); entries.append((band,level,z,meta,[r.start or 0,cx.start or 0,block.shape[0],block.shape[1]]))
        for band,level,z,meta,window in entries:
            pid=f"{src['pageId']}/"+(band if band=='MASK' else f'L{level}/{band}')
            ph=meta['payloadSha256']
            if ph not in object_by_hash:
                object_by_hash[ph]=len(objects); objects.append({'objectId':f'O{len(objects):03d}','payloadSha256':ph,'payloadBytes':len(z),'references':0}); payloads.append(z)
            obj=objects[object_by_hash[ph]]; obj['references']+=1
            packets.append({'packetId':pid,'pageId':src['pageId'],'band':band,'level':level,'window':window,'objectId':obj['objectId'],**meta}); pids.append(pid)
        pages.append({'pageId':src['pageId'],'role':src['role'],'sourceRowOffset':src['sourceRowOffset'],'sourceColumnOffset':src['sourceColumnOffset'],'shape':[int(a.shape[0]),int(a.shape[1])],'nodata':src['nodata'],'nodataCount':src['nodataCount'],'truthSha256':src['combinedTruthSha256'],'shapes':shapes,'packetIds':pids,'valleyPolylinesPixels':src['valleyPolylinesPixels']})
    identity={'source':SOURCE['sourceCanonical'],'pages':[{'pageId':p['pageId'],'truthSha256':p['truthSha256']} for p in pages],'packets':[{'id':p['packetId'],'raw':p['rawSha256']} for p in packets]}; scoreid=sha(json.dumps(identity,sort_keys=True,separators=(',',':')).encode())
    header={'schema':'wenzhou-full-score/github-v0.1.0','scoreId':scoreid,'pageCount':len(pages),'packetCount':len(packets),'payloadObjectCount':len(objects),'transform':'reversible integer CDF 5/3','levels':int(math.log2(SOURCE['pageSize'])),'baseSpacingMeters':12.5,'address':'EarthID + Domain + SpectralPage + UPhase Q0.64 + VPhase Q0.64'}; hraw=json.dumps(header,sort_keys=True,separators=(',',':')).encode(); off=len(MAGIC)+4+len(hraw)
    byid={o['objectId']:o for o in objects}
    for o,z in zip(objects,payloads):o['offset']=off;off+=len(z)
    for p in packets:p['offset']=byid[p['objectId']]['offset']
    score=OUT/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.wzscore'
    with score.open('wb') as f:f.write(MAGIC);f.write(struct.pack('<I',len(hraw)));f.write(hraw);[f.write(z) for z in payloads]
    index={'schema':'wenzhou-full-score-index/github-v0.1.0','header':header,'scoreFile':score.name,'scoreFileBytes':score.stat().st_size,'scoreFileSha256':fsha(score),'pages':pages,'packets':packets,'payloadObjects':objects}
    jwrite(OUT/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json',index)
    return index

def read_packet(f,p):
    f.seek(p['offset']); raw=zlib.decompress(f.read(p['payloadBytes'])); assert sha(raw)==p['rawSha256']
    if p['band']=='MASK':return np.unpackbits(np.frombuffer(raw,dtype=np.uint8),bitorder='little')[:SOURCE['pageSize']**2].reshape(SOURCE['pageSize'],SOURCE['pageSize']).astype(bool)
    return np.frombuffer(raw,dtype=np.dtype(p['dtype'])).astype(np.int64).reshape(p['window'][2:])

def reconstruct(index,page,ids):
    lookup={p['packetId']:p for p in index['packets']}; c=np.zeros(tuple(page['shape']),dtype=np.int64); mask=None
    with (OUT/'03_SCORE'/index['scoreFile']).open('rb') as f:
        for pid in ids:
            p=lookup[pid]; b=read_packet(f,p)
            if p['band']=='MASK':mask=b
            else:r,c0,h,w=p['window'];c[r:r+h,c0:c0+w]=b
    assert mask is not None; a=inv2(c,page['shapes']);a[mask]=page['nodata'];return a.astype(np.int16)

def conductors(index):
    lookup={p['packetId']:p for p in index['packets']}; pages=index['pages']
    def choose(name):
        ids=[]
        for page in pages:
            pp=[lookup[x] for x in page['packetIds']]
            if page['nodataCount'] or name in ('exact-truth','archive-scan'):chosen=pp
            elif name=='visual-overview':chosen=[p for p in pp if p['band'] in ('MASK','LL') or (p['level'] or 0)>=4]
            elif name=='visual-focus':chosen=[p for p in pp if p['band'] in ('MASK','LL') or (p['level'] or 0)>=2]
            elif name=='hydrology-analysis':chosen=[p for p in pp if p['band'] in ('MASK','LL') or (p['level'] or 0)>=3 or ((p['level'] or 0)==2 and p['band'] in ('U','V'))]
            elif name=='physics-corridor':chosen=[p for p in pp if p['band'] in ('MASK','LL') or (p['level'] or 0)>=2 or ((p['level'] or 0)==1 and p['band'] in ('U','V'))]
            ids += [p['packetId'] for p in chosen]
        if name=='archive-scan':ids=sorted(ids,key=lambda x:lookup[x]['offset'])
        return ids
    titles={'visual-overview':'Visual overview','visual-focus':'Visual focus','hydrology-analysis':'Hydrology analysis','physics-corridor':'Physics corridor','exact-truth':'Exact truth','archive-scan':'Archive scan'}
    out={}; total=sum(p['payloadBytes'] for p in index['packets'])
    for name in titles:
        ids=choose(name); d={'schema':'wenzhou-conductor/github-v0.1.0','conductorId':name,'title':titles[name],'scoreId':index['header']['scoreId'],'scoreSha256':index['scoreFileSha256'],'packetIds':ids,'packetCount':len(ids),'logicalPayloadBytes':sum(lookup[x]['payloadBytes'] for x in ids),'logicalPayloadFraction':sum(lookup[x]['payloadBytes'] for x in ids)/total,'payloadEmbedded':False}
        jwrite(OUT/f'04_CONDUCTORS/{name}.json',d);out[name]=d
    jwrite(OUT/'04_CONDUCTORS/REGISTRY.json',{'scoreId':index['header']['scoreId'],'conductors':[{k:v[k] for k in ('conductorId','title','packetCount','logicalPayloadBytes','logicalPayloadFraction')} for v in out.values()]});return out

def qa(index,conds):
    lookup={p['packetId']:p for p in index['packets']}; src={p['pageId']:decode_source(p)[0] for p in SOURCE['pages']}; report=[]; failures=[]
    for name,d in conds.items():
        rows=[]
        for page in index['pages']:
            ids=[x for x in d['packetIds'] if lookup[x]['pageId']==page['pageId']]; a=reconstruct(index,page,ids);t=src[page['pageId']];valid=t!=page['nodata'];diff=a[valid].astype(float)-t[valid].astype(float); exact=set(ids)==set(page['packetIds'])
            if page['nodataCount'] and not exact:failures.append('NoData guard')
            if name=='exact-truth' and np.any(diff):failures.append('exact mismatch')
            rows.append({'pageId':page['pageId'],'role':page['role'],'exactPageSelected':exact,'maxAbsMeters':float(np.max(np.abs(diff))),'rmseMeters':float(np.sqrt(np.mean(diff*diff))),'changedSamples':int(np.count_nonzero(diff))})
        report.append({'conductorId':name,'logicalPayloadFraction':d['logicalPayloadFraction'],'pages':rows})
    rng=np.random.default_rng(20260908); W=SOURCE['sourceCanonical']['width'];H=SOURCE['sourceCanonical']['height']; addr=True
    for _ in range(20000):
        r=int(rng.integers(H));c=int(rng.integers(W));u=phase(c,W);v=phase(r,H)
        if (unphase(v,H),unphase(u,W))!=(r,c):addr=False;break
    passed=not failures and addr
    q={'schema':'wenzhou-full-score-qa/github-v0.1.0','passed':passed,'realCanonicalPages':2,'exactTruthRoundtrip':not any('exact' in x for x in failures),'addressRoundtripSamples':20000,'addressRoundtripPassed':addr,'nodataGuardPassed':not any('NoData' in x for x in failures),'conductors':report,'failures':failures,'productionIntegration':False,'visualAcceptance':False,'productionReady':False};jwrite(OUT/'05_QA/QA.json',q);return q

def demo(index,conds,qa):
    pages=[]
    for s in SOURCE['pages']:
        a,m=decode_source(s); factor=max(1,a.shape[0]//16); small=a.reshape(16,factor,16,factor).mean((1,3));pages.append({'pageId':s['pageId'],'role':s['role'],'min':s['minimum'],'max':s['maximum'],'values':small.round().astype(int).tolist(),'nodataCount':s['nodataCount']})
    data=json.dumps({'scoreId':index['header']['scoreId'],'scoreBytes':index['scoreFileBytes'],'pages':pages,'conductors':[{k:v[k] for k in ('conductorId','title','logicalPayloadFraction')} for v in conds.values()],'qa':qa['passed']},ensure_ascii=False)
    html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wenzhou Full Score V0.1</title><style>body{margin:0;background:#071019;color:#e8f1f7;font:15px system-ui;padding:24px}main{max-width:1050px;margin:auto}h1{font-size:clamp(26px,5vw,48px)}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.c{border:1px solid #294151;background:#0b1822;border-radius:14px;padding:14px}canvas{width:100%;image-rendering:pixelated;background:#03080c;border-radius:8px}select{padding:10px;background:#102431;color:white;border:1px solid #35566c;border-radius:8px}.ok{color:#8de0bd}.mono{font:12px monospace;word-break:break-all;color:#91b7cf}</style><main><h1>一份权威总谱，多指挥演奏</h1><p>GitHub V0.1 真实小谱页验证。两块 12.5 米 Canonical 窗口共享同一份可逆总谱。</p><p class="ok">精确往返、20,000 次谱地址往返、NoData 守卫均已通过。</p><label>指挥 <select id="c"></select></label><div class="g" id="g"></div><p class="mono" id="id"></p></main><script type="application/json" id="d">'''+data.replace('</script>','<\/script>')+'''</script><script>const D=JSON.parse(d.textContent),s=document.querySelector('#c'),g=document.querySelector('#g');D.conductors.forEach(x=>s.add(new Option(x.title+' · '+(x.logicalPayloadFraction*100).toFixed(1)+'%',x.conductorId)));function draw(){g.innerHTML='';D.pages.forEach(p=>{let x=document.createElement('div');x.className='c';x.innerHTML='<h2>'+p.role+'</h2><canvas width="256" height="256"></canvas><p>源 NoData：'+p.nodataCount+'</p>';g.append(x);let cv=x.querySelector('canvas'),q=cv.getContext('2d'),im=q.createImageData(16,16);p.values.flat().forEach((v,i)=>{let t=Math.max(0,Math.min(1,(v-p.min)/Math.max(1,p.max-p.min))),o=i*4;im.data[o]=30+190*t;im.data[o+1]=65+120*(1-Math.abs(t-.5)*1.4);im.data[o+2]=95-55*t;im.data[o+3]=255});let tmp=document.createElement('canvas');tmp.width=16;tmp.height=16;tmp.getContext('2d').putImageData(im,0,0);q.imageSmoothingEnabled=false;q.drawImage(tmp,0,0,256,256)})}s.onchange=draw;id.textContent='Score ID '+D.scoreId+' · '+D.scoreBytes+' bytes';draw()</script>'''
    twrite(OUT/'06_DEMO/index.html',html)

def docs(index,qa):
    c=SOURCE['sourceCanonical']; twrite(OUT/'00_START_HERE/README.md',f'''# Wenzhou Full Score Multi-Conductor V0.1

This fixed pilot stores one authoritative reversible terrain score and six reference-only conductors.

Score ID: `{index['header']['scoreId']}`

Score SHA256: `{index['scoreFileSha256']}`

Real source windows: two 32 by 32 windows from the R2.2.1 canonical cold store. No resampling.

Run `python 05_QA/verify.py` after checkout.
''');
    jwrite(OUT/'01_CONTRACTS/CONTRACT.json',{'schema':'wenzhou-one-score-multi-conductor/github-v0.1.0','canonical':c,'scoreId':index['header']['scoreId'],'address':index['header']['address'],'voices':['terrain truth','NoData mask','derived valley constraint','provenance','conductor indexes'],'externalVoices':['soil','land cover','bathymetry','tide','current'],'rules':{'oneAuthoritativeScore':True,'conductorPayloadEmbedded':False,'cameraChangesIdentity':False,'proceduralDetailIsTruth':False,'fullDomainConverted':False},'status':{'qaPassed':qa['passed'],'productionIntegration':False,'visualAcceptance':False,'productionReady':False}})
    twrite(OUT/'00_START_HERE/NEXT_ACTION.md','''# Next action

Expand from the two golden pages to adjacent pages, validate shared edges and request cancellation, then calibrate visual and hydrology conductors before full-domain conversion.
''')
    twrite(OUT/'05_QA/verify.py','''#!/usr/bin/env python3
import json,hashlib,sys
from pathlib import Path
r=Path(__file__).resolve().parents[1];q=json.loads((r/'05_QA/QA.json').read_text());i=json.loads((r/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json').read_text());p=r/'03_SCORE'/i['scoreFile'];ok=q['passed'] and p.stat().st_size==i['scoreFileBytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==i['scoreFileSha256'];print(json.dumps({'passed':ok,'scoreId':i['header']['scoreId'],'scoreBytes':p.stat().st_size},indent=2));sys.exit(0 if ok else 2)
''')

def package():
    files=[p for p in sorted(OUT.rglob('*')) if p.is_file() and '07_PACKAGE' not in p.parts];man={'schema':'wenzhou-full-score-package/github-v0.1.0','payloads':[{'path':str(p.relative_to(OUT)),'bytes':p.stat().st_size,'sha256':fsha(p)} for p in files]};jwrite(OUT/'07_PACKAGE/MANIFEST.json',man)
    zip_path=OUT/'07_PACKAGE/WENZHOU_FULL_SCORE_MULTICONDUCTOR_GITHUB_V0_1_0_FULL_PACKAGE.zip'
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(OUT.rglob('*')):
            if p.is_file() and p!=zip_path:z.write(p,arcname=f'{OUT.name}/{p.relative_to(OUT)}')
    (zip_path.with_suffix('.zip.sha256')).write_text(f'{fsha(zip_path)}  {zip_path.name}\n')
    with zipfile.ZipFile(zip_path) as z: assert z.testzip() is None
    return zip_path

def main():
    index=build();conds=conductors(index);q=qa(index,conds);assert q['passed'];demo(index,conds,q);docs(index,q);z=package();print(json.dumps({'passed':True,'scoreId':index['header']['scoreId'],'scoreBytes':index['scoreFileBytes'],'package':str(z),'packageBytes':z.stat().st_size,'packageSha256':fsha(z)},indent=2))
if __name__=='__main__':main()
