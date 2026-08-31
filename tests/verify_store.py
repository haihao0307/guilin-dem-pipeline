"""Verify every canonical numeric shard, chunk, and row-major sample without TIFF."""
from __future__ import annotations
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
STREAM_SHA='91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a'
MANIFEST_SHA='1c20ea78351a7827a033c7a4eef6176f5939efdc16abf436ba95863e34c34e78'
W,H,C=11983,17685,512

def file_sha(p:Path)->str:
    d=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(8<<20),b''):d.update(b)
    return d.hexdigest()

def require(condition:bool,message:str)->None:
    if not condition:raise ValueError(message)

def verify(root:Path)->dict:
    root=root.resolve();p=root/'CANONICAL_ELEVATION_MANIFEST.json'
    require(file_sha(p)==MANIFEST_SHA,'Frozen manifest hash mismatch')
    m=json.loads(p.read_text(encoding='utf-8'))
    require(m['aoi']['source_window']==[2438,949,W,H],'AOI mismatch')
    require(m['canonical_row_major_stream']['sha256']==STREAM_SHA,'Stream identity mismatch')
    require(m['spatial_reference']['native_spacing_m']==[12.5,12.5],'Spacing changed')
    require(m['spatial_reference']['crs']=='EPSG:32649','CRS changed')
    require(m['spatial_reference']['dtype']=='int16' and m['spatial_reference']['nodata']==0,'Encoding changed')
    require(m['logical_chunks']['overlap_samples']==m['logical_chunks']['padding_samples']==0,'Overlap/padding')
    for k in ['compression','resampling','quantization','interpolation']:
        require(m['canonical_row_major_stream'][k]=='none',f'Forbidden transform: {k}')
    ss={s['file']:s for s in m['physical_shards']['shards']}
    require(len(ss)==7 and sum(s['bytes'] for s in ss.values())==W*H*2,'Shard count/total mismatch')
    maps={}
    for name,s in ss.items():
        p=root/name
        require(p.is_file() and not p.is_symlink(),f'Missing/linked shard: {name}')
        require(p.stat().st_size==s['bytes'] and file_sha(p)==s['sha256'],f'Shard identity: {name}')
        maps[name]=np.memmap(p,dtype='uint8',mode='r')
    cc={};occupied={k:[] for k in ss}
    for c in m['chunks']:
        r,col=c['matrix_index'];w,h=min(C,W-col*C),min(C,H-r*C)
        require((r,col) not in cc and w>0 and h>0,'Duplicate/outside chunk')
        require(c['grid']==[w,h] and c['aoi_window']==[col*C,r*C,w,h],'Chunk dimensions/placement')
        require(c['source_window']==[2438+col*C,949+r*C,w,h],'Source placement')
        start,size=c['shard_byte_offset'],c['bytes']
        require(size==w*h*2 and 0<=start and start+size<=ss[c['shard']]['bytes'],'Byte range')
        raw=memoryview(maps[c['shard']])[start:start+size]
        require(hashlib.sha256(raw).hexdigest()==c['sha256'],f"Chunk identity: {c['id']}")
        occupied[c['shard']].append((start,start+size));cc[(r,col)]=c
    require(len(cc)==840,'Chunk count')
    for name,intervals in occupied.items():
        cursor=0
        for start,end in sorted(intervals):
            require(start==cursor,'Gap/overlap in shard');cursor=end
        require(cursor==ss[name]['bytes'],'Unused shard bytes')
    digest=hashlib.sha256();count=nodata=total=0;lo,hi=32767,-32768
    for r in range(math.ceil(H/C)):
        height=min(C,H-r*C);band=np.empty((height,W),dtype='<i2')
        for col in range(math.ceil(W/C)):
            c=cc[(r,col)];values=np.frombuffer(maps[c['shard']],dtype='<i2',count=c['bytes']//2,offset=c['shard_byte_offset']).reshape(height,c['grid'][0])
            band[:,col*C:col*C+c['grid'][0]]=values
        raw=band.tobytes(order='C');digest.update(raw);total+=len(raw)
        good=band!=0;n=int(np.count_nonzero(good));count+=n;nodata+=band.size-n
        if n:lo=min(lo,int(band[good].min()));hi=max(hi,int(band[good].max()))
    require(total==423838710 and digest.hexdigest()==STREAM_SHA,'Reconstructed stream mismatch')
    require(count==211915846 and nodata==3509 and [lo,hi]==[-6,2093],'Sample statistics mismatch')
    return {'schema':'guilin-clean-store-verification/v1','passed':True,'source_tiff_read':False,
        'new_tiff_pixel_comparison_performed':False,'original_pixel_comparison_attestation':'payload/canonical/VALIDATION_RECEIPT.json',
        'canonical_stream_sha256':digest.hexdigest(),'canonical_data_bytes':total,'sample_count':W*H,
        'valid_sample_count':count,'nodata_sample_count':nodata,'elevation_range_m':[lo,hi],
        'shard_count':7,'verified_chunk_count':840,'overlap_samples':0,'padding_samples':0,
        'compression':'none','resampling':'none','row_major_reconstruction_hash_matched':True,
        'original_expected_shard_hashes_matched':True,'native_spacing_m':[12.5,12.5],
        'visualAcceptance':False,'productionReady':False}

def main()->int:
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('--store',type=Path,required=True);a.add_argument('--receipt',type=Path);o=a.parse_args()
    result=verify(o.store);text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if o.receipt:o.receipt.parent.mkdir(parents=True,exist_ok=True);o.receipt.write_text(text,encoding='utf-8')
    print(text);return 0
if __name__=='__main__':raise SystemExit(main())
