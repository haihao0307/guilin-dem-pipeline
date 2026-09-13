import gzip, hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'site/dist/r3-8/data/soil/soil-context.json'
OUT=ROOT/'site/dist/r3-8/data/soil-pairs'

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    m=json.loads(SOURCE.read_text(encoding='utf-8'))
    pairs={}
    for x in m['layers']:
        pairs.setdefault((x['property'],x['depth']),{})[x['statistic']]=x
    OUT.mkdir(parents=True,exist_ok=True)
    records=[]; total_raw=total_gz=0
    for (prop,depth),pair in sorted(pairs.items()):
        q=pair['Q0.5']; u=pair['uncertainty']
        qb=(SOURCE.parent/q['path']).resolve().read_bytes()
        ub=(SOURCE.parent/u['path']).resolve().read_bytes()
        if len(qb)!=len(ub) or len(qb)%2: raise RuntimeError(f'pair mismatch {prop} {depth}')
        samples=len(qb)//2
        shuffled=qb[0::2]+qb[1::2]+ub[0::2]+ub[1::2]
        packed=gzip.compress(shuffled,compresslevel=9,mtime=0)
        safe_depth=depth.replace('/','-')
        name=f'{prop}-{safe_depth}.s2gz'
        (OUT/name).write_bytes(packed)
        restored=gzip.decompress(packed)
        n=samples
        rq=bytearray(n*2); ru=bytearray(n*2)
        rq[0::2]=restored[0:n]; rq[1::2]=restored[n:2*n]
        ru[0::2]=restored[2*n:3*n]; ru[1::2]=restored[3*n:4*n]
        if bytes(rq)!=qb or bytes(ru)!=ub: raise RuntimeError(f'roundtrip failed {prop} {depth}')
        records.append({
            'property':prop,'depth':depth,'path':name,
            'codec':'i16le-pair-byte-shuffle-gzip-v1','samples':samples,
            'rows':q['rows'],'columns':q['columns'],
            'compressedBytes':len(packed),'compressedSha256':sha(packed),
            'decodedBytes':len(qb)+len(ub),
            'valueSha256':q['sha256'],'uncertaintySha256':u['sha256'],
            'valueNoData':q['noData'],'uncertaintyNoData':u['noData']
        })
        total_raw+=len(qb)+len(ub); total_gz+=len(packed)
    manifest={
        'schema':'wenzhou-soil-pair-payloads/v1',
        'sourceSchema':m['schema'],'sourceIdentity':m['sourceIdentity'],
        'codec':'i16le-pair-byte-shuffle-gzip-v1',
        'layout':'value-low,value-high,uncertainty-low,uncertainty-high; each samples bytes; gzip wrapped',
        'lossless':True,'pairCount':len(records),
        'rawBytes':total_raw,'compressedBytes':total_gz,
        'reduction':1-total_gz/total_raw,'pairs':records
    }
    (OUT/'soil-pairs.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'pairs':len(records),'rawBytes':total_raw,'compressedBytes':total_gz,'reduction':manifest['reduction']},ensure_ascii=False))

if __name__=='__main__': main()
