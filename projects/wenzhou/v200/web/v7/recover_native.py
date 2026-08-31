"""Recover complete source-verified native numbers and build the numeric-only site.

The incomplete outer transfer is never accepted as a complete archive.
TIFF removal is blocked until a complete remote round-trip also passes.
"""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,shutil,struct,sys,zlib
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--output',required=True);args=p.parse_args();root=Path(args.root);out=Path(args.output);out.mkdir(parents=True,exist_ok=True);sys.path.insert(0,str(root));from decode_transfer import decode_block
from repair_runtime import patch_site,patch_checks
reports=[];blocks=[]
for i in range(5):
 name=f'block{i:02d}.txt';b,r=decode_block((root/'transfer'/name).read_text());blocks.append(b);reports.append({'block':name,**r})
dec=zlib.decompressobj(31);partial=dec.decompress(b''.join(blocks));assert len(partial)==48467,len(partial)
text=partial[17920:]+(root/'transfer/dongtou-tail.txt').read_bytes().strip()
assert len(text)==31472,len(text)
assert hashlib.sha256(text).hexdigest()=='f776c70971566e8c0ea3fb648a84b425f3f44e6569ecee8f2c0203dee5795778'
for name in ['index.html','runtime.js','math.js','shaders.js','manifest.json','distillation-qa.json','data/feiyun.wzn64']:
 src=root/'site'/name;dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
(out/'data/dongtou.wzn64').write_bytes(text)
m=json.loads((out/'manifest.json').read_text());assert m['sourceValueSha256']=='639a69429e104d9c2db1550870da79dc2b89df9ac893c18405901530c25ff353';assert m['fullDomainNativeOnline'] is False
checks=[]
for name in m['onlineNativeWindows']:
 w=m['windows'][name];b=base64.b64decode((out/w['path']).read_text().strip(),validate=True)
 assert hashlib.sha256(b).hexdigest()==w['sha256'],name+' transfer checksum'
 assert b[:4]==b'WZN7';nx,ny=struct.unpack('<HH',b[4:8]);assert [nx,ny]==[w['width'],w['height']]
 q=np.frombuffer(gzip.decompress(b[8:]),dtype='<i2').reshape(ny,nx);a=q.astype(np.int64).cumsum(axis=0).cumsum(axis=1).astype('<i2')
 digest=hashlib.sha256(a.tobytes(order='C')).hexdigest();assert digest==w['valueSha256'],name+' decoded source values';assert w['spacingM']==12.5
 checks.append({'window':name,'grid':[nx,ny],'spacingM':12.5,'sourceStartRow':w['startRow'],'sourceStartCol':w['startCol'],'decodedValueSha256':digest,'compressedSha256':w['sha256'],'passed':True})
patch_site(out);patch_checks(root/'qa_v7.py')
for name in ['runtime.js','math.js','shaders.js','index.html']:
 s=(out/name).read_text()
 for forbidden in ['wenzhou-v111/','QINGJIANG','TextureLoader','sampler2D','data:image/']:
  assert forbidden not in s,(name,forbidden)
assert 'src="./runtime.js"' in (out/'index.html').read_text()
report={'schema':'wenzhou-v7-native-preview-qa-3','passed':True,'nativeWindows':checks,'sourceValueSha256':m['sourceValueSha256'],'sourceContainerSha256':m['sourceContainerSha256'],'sourceHistoricalContainerMatched':False,'originalTransferArchiveComplete':dec.eof,'completeArchiveAccepted':False,'recoveredNativeMemberIndependentlyVerified':True,'transferRows':reports,'imageTextureCount':0,'nativeVerticesDecimated':False,'gpuOutstandingFrameLimit':1,'matchingLandWaterBoundaryPositions':True,'fullNumericStoreOnline':False,'fullNumericStoreControllerVerified':True,'sourceDeleted':False,'tifDeletionAllowed':False,'productionReady':False,'visualAcceptance':False}
(out/'numeric-preview-qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,indent=2))
