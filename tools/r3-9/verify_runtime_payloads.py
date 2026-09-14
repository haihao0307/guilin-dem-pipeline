"""Verify existing transport bytes; remove only proven duplicate WSP1 experiment files."""
import argparse, gzip, hashlib, json, struct, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'site/dist/r3-8/data'
def sha(b): return hashlib.sha256(b).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def checked(p,n,h):
    if p.is_symlink() or not p.is_file(): raise ValueError(f'Not an ordinary file: {p}')
    b=p.read_bytes()
    if len(b)!=n or sha(b)!=h: raise ValueError(f'Hash or size mismatch: {p}')
    return b
def require(ok,msg):
    if not ok: raise ValueError(msg)
def semantic_records(obj):
    if isinstance(obj,dict):
        if {'path','bytes','sha256'}<=obj.keys(): yield obj
        for v in obj.values(): yield from semantic_records(v)
    elif isinstance(obj,list):
        for v in obj: yield from semantic_records(v)
def decode_wsp(blob):
    require(blob[:4]==b'WSP1','WSP1 magic')
    pos=8;hn=struct.unpack_from('<I',blob,4)[0];h=json.loads(blob[pos:pos+hn]);pos+=hn
    streams=[]
    for key in ['value','uncertainty']:
        n=struct.unpack_from('<I',blob,pos)[0];pos+=4
        raw=zlib.decompress(blob[pos:pos+n]);pos+=n
        require(len(raw)==h[key]['rawBytes'] and sha(raw)==h[key]['sha256'],'WSP1 decoded source mismatch')
        streams.append(raw)
    require(pos==len(blob),'WSP1 trailing bytes')
    return h,streams

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--remove-duplicate-experiment',action='store_true');args=ap.parse_args()
    soil=read(BASE/'soil-pairs/soil-pairs.json');semantic=read(BASE/'soil/soil-context.json')
    expected={(r['property'],r['depth'],r['statistic']):r for r in semantic['layers']}
    require(len(expected)==96 and len(soil['pairs'])==48,'Soil semantic inventory')
    old=BASE/'soil-paired';old_index=old/'soil-pair-context.json';old_records={};deletions=[]
    if old.exists():
        archive=read(old_index);require(len(archive['pairs'])==48,'WSP1 inventory')
        old_records={(r['property'],r['depth']):r for r in archive['pairs']}
    soil_bytes=0;old_bytes=0
    for r in soil['pairs']:
        p=BASE/'soil-pairs'/r['path'];require(p.resolve().parent==(BASE/'soil-pairs').resolve(),'Soil path escape')
        b=checked(p,r['compressedBytes'],r['compressedSha256']);raw=gzip.decompress(b);n=r['samples']
        require(n==1003*884 and len(raw)==n*4,'Soil dimensions')
        q=bytearray(n*2);u=bytearray(n*2)
        q[0::2]=raw[:n];q[1::2]=raw[n:2*n];u[0::2]=raw[2*n:3*n];u[1::2]=raw[3*n:]
        for key,data,digest in [('Q0.5',q,r['valueSha256']),('uncertainty',u,r['uncertaintySha256'])]:
            source=expected[(r['property'],r['depth'],key)]
            require(sha(data)==digest==source['sha256'] and len(data)==source['bytes'],'Soil channel is not source-exact')
        soil_bytes+=len(b)
        if old_records:
            prior=old_records[(r['property'],r['depth'])];name=f"{r['property']}-{r['depth']}.wsp1"
            require(prior['path']==name,'Unexpected WSP1 path')
            p=old/name;wb=checked(p,prior['bytes'],prior['sha256']);header,(vq,vu)=decode_wsp(wb)
            require(header['property']==r['property'] and header['depth']==r['depth'] and vq==q and vu==u,'WSP1 is not an exact duplicate')
            deletions.append(p);old_bytes+=len(wb)
    require(soil_bytes==soil['compressedBytes'],'Soil total')
    env=read(BASE/'evidence-gzip/index.json');env_bytes=0
    require(len(env['records'])==41,'Environment inventory')
    semantic_env={}
    for family in ['wrb','water']:
        for r in semantic_records(read(BASE/family/(family+'-context.json'))):semantic_env[(family,r['path'])]=r
    for r in env['records']:
        p=BASE/'evidence-gzip'/r['packedPath'];require((BASE/'evidence-gzip').resolve() in p.resolve().parents,'Environment path escape')
        b=checked(p,r['packedBytes'],r['packedSha256']);raw=gzip.decompress(b);source=semantic_env[(r['family'],r['logicalPath'])]
        require(len(raw)==r['rawBytes']==source['bytes'] and sha(raw)==r['rawSha256']==source['sha256'],'Environment decoded source mismatch')
        env_bytes+=len(b)
    require(env_bytes==env['packedBytes'],'Environment total')
    records=ROOT/'records/R3_9';records.mkdir(parents=True,exist_ok=True)
    report={'schema':'wenzhou-runtime-integrity/v1','passed':True,'soilPairs':48,'soilSemanticChannels':96,'environmentPayloads':41,'soilPackedBytes':soil_bytes,'environmentPackedBytes':env_bytes,'allDecodedOriginalHashesMatch':True,'newDataGenerated':False}
    if old_records:
        require(len(deletions)==48 and set(old.iterdir())==set(deletions+[old_index]),'Unexpected file in experimental directory; refusing deletion')
        if args.remove_duplicate_experiment:
            # All 96 channels have already been compared byte-for-byte above.
            for p in deletions+[old_index]:p.unlink()
            old.rmdir()
            cleanup={'schema':'wenzhou-wsp1-duplicate-cleanup/v1','passed':True,'removedDuplicateBodies':48,'removedBodyBytes':old_bytes,'removedIndexes':1,'byteForByteIdenticalToRetainedPairs':True,'retainedCodec':soil['codec'],'retainedSoilBytes':soil_bytes,'frozenExperimentCommit':'d4a4a9bb569aa1019a8e4afe9d745a0d7a921ec6','historicalCommitsOrReleasesDeleted':False}
            (records/'WSP1_DUPLICATE_CLEANUP.json').write_text(json.dumps(cleanup,indent=2)+'\n',encoding='utf-8')
        report['duplicateExperimentCompared']=True
    # Keep the repeated integrity report deterministic, independent of cleanup timing.
    report.pop('duplicateExperimentCompared',None)
    (records/'TRANSPORT_INTEGRITY.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
