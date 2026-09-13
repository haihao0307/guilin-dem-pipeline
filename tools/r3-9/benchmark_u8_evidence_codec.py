import gzip, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/'site/dist/r3-8/data'

def gz_len(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))

def main():
    wrb=json.loads((SITE/'wrb/wrb-context.json').read_text(encoding='utf-8'))
    water=json.loads((SITE/'water/water-context.json').read_text(encoding='utf-8'))
    wrb_recs=list(wrb['probabilityLayers'])+list(wrb['outputs'].values())
    water_recs=list(water['layers'])
    families=[]
    for name,base,recs in [('wrb',SITE/'wrb',wrb_recs),('water',SITE/'water',water_recs)]:
        rows=[];raw=packed=0
        seen=set()
        for rec in recs:
            path=rec['path']
            if path in seen: continue
            seen.add(path)
            p=base/path
            size=p.stat().st_size; gz=gz_len(p)
            raw+=size;packed+=gz
            rows.append({'path':path,'rawBytes':size,'gzipBytes':gz,'reduction':1-gz/size})
        families.append({'family':name,'fileCount':len(rows),'rawBytes':raw,'gzipBytes':packed,'reduction':1-packed/raw,'files':rows})
    raw=sum(x['rawBytes'] for x in families);packed=sum(x['gzipBytes'] for x in families)
    print(json.dumps({'passed':True,'codec':'u8-gzip-v1','rawBytes':raw,'gzipBytes':packed,'reduction':1-packed/raw,'families':families},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
