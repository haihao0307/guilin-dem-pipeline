"""Convert the pinned R03 runtime fields into the existing KAOPU hierarchical hat spectrum.
Only storage changes. All delivered Float32 samples, masks, and source weights round-trip exactly.
New transport extension: exact zero omission + Float64 byte planes + gzip. No source TIFF or mesh is delivered.
"""
import re,json,base64,gzip,hashlib,numpy as np,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'hong-kong-main-city-r07/terrain-kaopu'
SOURCE=ROOT/'hong-kong-map-sea-r03/publish-final/index.html'
if not SOURCE.exists():SOURCE=ROOT/'hong-kong-map-sea-r03/index.html'
raw=SOURCE.read_bytes();s=raw.decode()
assert hashlib.sha256(raw).hexdigest()=='54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117','Pinned R03 source mismatch'
sha=lambda b:hashlib.sha256(b).hexdigest()
def extract(name):
 m=re.search(r'window\.'+name+r'\s*=\s*',s);return json.JSONDecoder().raw_decode(s[m.end():])[0]
bg=extract('HK_MAP_DATA');detail=extract('HK_DETAIL_DATA')
detail['patches']=[p for p in detail['patches'] if p['id']!='hung_hom']
def axis(n,k):return np.unique(np.r_[np.arange(0,n,k),n-1])
def interpolate(c,xs,ys,w,h):
 xx=np.arange(w);yy=np.arange(h);xi=np.minimum(np.searchsorted(xs,xx,'right')-1,len(xs)-2);yi=np.minimum(np.searchsorted(ys,yy,'right')-1,len(ys)-2)
 u=(xx-xs[xi])/(xs[xi+1]-xs[xi]);v=(yy-ys[yi])/(ys[yi+1]-ys[yi])
 return (c[yi[:,None],xi[None,:]]*(1-u)+c[yi[:,None],xi[None,:]+1]*u)*(1-v[:,None])+(c[yi[:,None]+1,xi[None,:]]*(1-u)+c[yi[:,None]+1,xi[None,:]+1]*u)*v[:,None]

def encode(id,p,group):
 start=time.perf_counter();old={k:base64.b64decode(p[k])for k in ['heights','mask','weight']if k in p};decoded={k:gzip.decompress(v)for k,v in old.items()}
 h,w=p['height'],p['width']; a=np.frombuffer(decoded['heights'],'<f4').reshape(h,w);pred=np.zeros(a.shape,dtype='float64');coeff=[];levels=[];offset=0
 for stride in [8,4,2,1]:
  xs,ys=axis(w,stride),axis(h,stride);c=a[np.ix_(ys,xs)].astype('float64')-pred[np.ix_(ys,xs)];pred+=interpolate(c,xs,ys,w,h)
  levels.append({'stepM':p['step']*stride,'xs':xs.tolist(),'ys':ys.tolist(),'shapeRC':list(c.shape),'offsetScalar':offset});offset+=c.size;coeff.append(c.astype('<f8').tobytes())
 result=pred.astype('<f4').tobytes();assert result==decoded['heights'],id+' height mismatch'
 c=b''.join(coeff);raw_coeff=np.frombuffer(c,'<u8');nonzero=raw_coeff!=0;bitmap=np.packbits(nonzero,bitorder='little').tobytes();planes=np.frombuffer(c,'uint8').reshape(-1,8)[nonzero].T.tobytes();payload=bitmap+planes;channels={};off=len(payload)
 for k in ['mask','weight']:
  if k in decoded:channels[k]={'offsetBytes':off,'bytes':len(decoded[k]),'sha256':sha(decoded[k])};payload+=decoded[k];off+=len(decoded[k])
 encoded=gzip.compress(payload,compresslevel=9,mtime=0);url='packets/'+id+'.spectrum.gz';(OUT/url).write_bytes(encoded)
 entry={'id':id,'group':group,'x0':p['x0'],'y0':p['y0'],'step':p['step'],'width':w,'height':h,'levels':levels,'coefficients':{'encoding':'little-endian Float64; lossless byte-plane permutation','scalars':offset,'decodedBytes':len(c),'decodedSHA256':sha(c)},'transport':{'url':url,'encoding':'gzip(sparse-f64-byteplanes + uint8-mask + optional uint8-source-weight)','coefficientStorage':{'kind':'zero-bitset-f64-byteplanes','bitmapBytes':len(bitmap),'storedScalars':int(nonzero.sum())},'bytes':len(encoded),'sha256':sha(encoded),'expandedBytes':len(payload)},'channels':channels,'roundTrip':{'sourceFloat32SHA256':sha(decoded['heights']),'reconstructedFloat32SHA256':sha(result),'maxAbsHeightErrorM':0,'equalFloat32Bits':True,'equalMaskBytes':True,'equalWeightBytes':True if 'weight'in decoded else None,'units':'metres','notNative0p5mLosslessClaim':True},'previous':{'base64Chars':sum(len(p[k])for k in old),'gzipPayloadBytes':sum(map(len,old.values())),'decodedArraysBytes':sum(map(len,decoded.values()))},'sourceArrayBytes':{k:len(v)for k,v in decoded.items()}}
 for k in old:p[k]={'kaopuArray':id+'/'+k}
 print(id,'old_gzip',entry['previous']['gzipPayloadBytes'],'new',len(encoded),'ms',round((time.perf_counter()-start)*1000),flush=True);return entry
entries=[encode('background-30m',bg,'background30m')]
for p in detail['patches']:
 for key,l in p['levels'].items():entries.append(encode(p['id']+'-'+key+'m',l,'localHighPrecision'))
existing=json.loads((ROOT/'hong-kong-main-city-r03/terrain/data/manifest.json').read_text())
manifest={'schema':'kaopu.hk.height-spectrum-bundle/0.1','formatStatus':'Local transport adapter of existing HK hierarchical hat-spectrum; not a newly declared universal KAOPU standard','mother':{'id':'kaopu.hk.separable-bilinear-hat-spectrum','version':'0.1','implementation':'../../hong-kong-main-city-r03/terrain/data/runtime/height-spectrum.mjs','existingSchema':'kaopu.hk.cedd-local-height-spectrum/0.1','basis':'Same additive separable bilinear hat basis; strides 8,4,2,1 in source-display node coordinates','differences':['Generalized grid spacing to 30m/5m/2m','Explicit lossless mask/source-weight channels','Sparse zero-bitset + byte-plane Float64 gzip transport; exact coefficient bits reconstructed','Same finest Float32 nodes and same triangle topology; runtime grids are discardable view caches']},'identity':{'object':'hong-kong-authored-terrain-fields','view':'main-city-r07','worldTime':'fictional historical setting; source observation epochs separately retained'},'coordinateReference':existing['coordinateReference'],'sourceHost':{'path':'hong-kong-map-sea-r03/publish-final/index.html','bytes':len(raw),'sha256':sha(raw)},'sourcePreservation':{'background':'The existing R03 fictional water-removal/station edits are preserved exactly. Original Copernicus source is retained separately.','detail':'The exact old R03 2m/5m display fields, including synthetic transitions, are converted. These were already downsampled from native 0.5m sources; no claim to reconstruct native 0.5m measurements.','fullRoute0p5mCoverage':False,'newlyResampled':False,'heightQuantizationAdded':False,'coastMaskModified':False,'oldVersionsModified':False},'background':bg,'detail':detail,'fields':entries,'retainedIncrement':{'manifestURL':'../../hong-kong-main-city-r03/terrain/data/manifest.json','schema':existing['schema'],'patchCount':len(existing['patches']),'runtimeGridStepsM':[2],'nativeSpacingM':.5,'compressedCoefficientBytes':sum(x['coefficients']['gzipBytes']for x in existing['patches']),'manifestBytes':(ROOT/'hong-kong-main-city-r03/terrain/data/manifest.json').stat().st_size,'note':'Existing four KAOPU CEDD patches reused byte-for-byte via existing installCEDDTerrain; not fetched twice by this bundle.'}}
manifest['releaseScope']={'status': 'user-authorized reduced release', 'excludedLocalPatches': ['hung_hom'], 'includedConvertedFields': 9, 'includedOldLocalPatches': 4, 'retainedKowloonIncrementPatches': 4, 'excludedRuntimeGridStepsM': [2, 5], 'replacement': 'Existing 30m background; local high precision pending', 'noAlternateEncodingOrLegacyAutoload': True, 'sourceMessageId': 'Sentinel_5a6dbb27ca8481919d92083d1728b919'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
(OUT/'tests/python-roundtrip.json').write_text(json.dumps({'passed':True,'fields':len(entries),'allFloat32BitsEqual':True,'masksAndWeightsPreserved':True,'newHeightQuantization':False,'native0p5mPreservedClaim':False,'compressedBytesByGroup':{g:sum(e['transport']['bytes']for e in entries if e['group']==g)for g in ['background30m','localHighPrecision']}},indent=2)+'\n')
