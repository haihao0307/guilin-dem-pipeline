import gzip, hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'site/dist/r3-8/data'
OUT=DATA/'evidence-gzip'

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    wrb=json.loads((DATA/'wrb/wrb-context.json').read_text(encoding='utf-8'))
    water=json.loads((DATA/'water/water-context.json').read_text(encoding='utf-8'))
    families=[('wrb',DATA/'wrb',list(wrb['probabilityLayers'])+list(wrb['outputs'].values())),('water',DATA/'water',list(water['layers']))]
    records=[];raw_total=packed_total=0
    for family,base,recs in families:
        seen=set()
        for rec in recs:
            logical=rec['path']
            if logical in seen: continue
            seen.add(logical)
            source=base/logical
            raw=source.read_bytes()
            if len(raw)!=rec['bytes'] or sha(raw)!=rec['sha256']:
                raise RuntimeError(f'source contract mismatch: {family}/{logical}')
            packed=gzip.compress(raw,compresslevel=9,mtime=0)
            rel=Path(family)/(logical+'.gz')
            out=OUT/rel;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(packed)
            restored=gzip.decompress(packed)
            if restored!=raw: raise RuntimeError(f'roundtrip failed: {family}/{logical}')
            records.append({'family':family,'logicalPath':logical,'packedPath':rel.as_posix(),'codec':'gzip-v1','rawBytes':len(raw),'rawSha256':sha(raw),'packedBytes':len(packed),'packedSha256':sha(packed)})
            raw_total+=len(raw);packed_total+=len(packed)
    manifest={'schema':'wenzhou-r3.9-evidence-gzip/v1','codec':'gzip-v1','lossless':True,'fileCount':len(records),'rawBytes':raw_total,'packedBytes':packed_total,'reduction':1-packed_total/raw_total,'records':records}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'fileCount':len(records),'rawBytes':raw_total,'packedBytes':packed_total,'reduction':manifest['reduction']},ensure_ascii=False))

if __name__=='__main__': main()
