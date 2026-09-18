from pathlib import Path
import numpy as np,json,base64,gzip,hashlib
R=Path(__file__).resolve().parents[1];d=json.loads((R/'FISH_REF001_FIELD_STUDY.json').read_text());all_max=0.;out=bytearray();tables=[];seen={};qerrors=[]
for p in d['patches']:
 for name,f in p['fields'].items():
  rebuilt={};orig={}
  for axis in ['rows','cols']:
   a=np.asarray(f[axis],dtype='float64');orig[axis]=a.copy();scale=np.max(np.abs(a),axis=1)/32767;scale[scale==0]=1.
   q=np.round(a/scale[:,None]).clip(-32767,32767).astype('<i2');rec=q*scale[:,None];rebuilt[axis]=rec
   key=hashlib.sha256(q.tobytes()+scale.tobytes()).hexdigest();entry={'offset':len(out),'count':int(q.size),'length':int(q.shape[1]),'scales':scale.tolist()}
   if key not in seen:out.extend(q.tobytes());seen[key]=entry
   f[axis]=seen[key]
  diff=rebuilt['rows'].T@rebuilt['cols']-orig['rows'].T@orig['cols'];qerrors.append({'patch':p['id'],'channel':name,'maxAdditionalQuantizationError':float(np.max(np.abs(diff)))})
d['coefficientEncoding']='scaled-int16-le; explicit lossy factor quantization';d['coefficientBytes']=base64.b64encode(out).decode();t=json.dumps(d,separators=(',',':')).encode();(R/'FISH_REF001_FIELD_COMPACT.json').write_bytes(t);(R/'research/compact.json.gz').write_bytes(gzip.compress(t,mtime=0));(R/'qa/quantization.json').write_text(json.dumps({'bytes':len(t),'gzipBytes':len(gzip.compress(t,mtime=0)),'coefficientBinaryBytes':len(out),'float64JSONBytes':(R/'FISH_REF001_FIELD_STUDY.json').stat().st_size,'referenceBytes':18644040,'gates':{'lossless':False,'fieldFitAcceptance':False},'errors':qerrors},indent=2));print('compact bytes',len(t),'gzip',len(gzip.compress(t,mtime=0)))
