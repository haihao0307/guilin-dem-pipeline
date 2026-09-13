import gzip, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'site/dist/r3-8/data/soil/soil-context.json'

def main():
    m=json.loads(MANIFEST.read_text(encoding='utf-8'))
    pairs={}
    for x in m['layers']:
        pairs.setdefault((x['property'],x['depth']),{})[x['statistic']]=x
    total_raw=total_concat=total_shuffle=0
    rows=[]
    for (prop,depth),pair in sorted(pairs.items()):
        q=pair['Q0.5']; u=pair['uncertainty']
        qb=(MANIFEST.parent/q['path']).resolve().read_bytes()
        ub=(MANIFEST.parent/u['path']).resolve().read_bytes()
        if len(qb)!=len(ub) or len(qb)%2: raise RuntimeError('pair length mismatch')
        shuffled=qb[0::2]+qb[1::2]+ub[0::2]+ub[1::2]
        raw=len(qb)+len(ub)
        concat=len(gzip.compress(qb+ub,compresslevel=9,mtime=0))
        shuf=len(gzip.compress(shuffled,compresslevel=9,mtime=0))
        total_raw+=raw; total_concat+=concat; total_shuffle+=shuf
        rows.append({'property':prop,'depth':depth,'raw':raw,'concatGzip':concat,'shuffleGzip':shuf})
    print(json.dumps({'passed':True,'pairs':len(rows),'raw':total_raw,'concatGzip':total_concat,'shuffleGzip':total_shuffle,'concatReduction':1-total_concat/total_raw,'shuffleReduction':1-total_shuffle/total_raw,'rows':rows},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
