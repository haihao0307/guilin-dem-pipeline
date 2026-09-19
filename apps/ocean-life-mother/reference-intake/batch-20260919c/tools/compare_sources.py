"""Look for evidence of common source content, not proof of ownership or infringement."""
import json,hashlib,io
from PIL import Image
import numpy as np
from audit_rights import ROOT,INPUT,load,acc
from scipy.spatial import cKDTree
PAIRS=[('鲨鱼018d30c9-2a16-749c-996f-30a900311e08.glb.glb','swimming_shark.glb'),('turtle.glb','model_72b_-_juvenile_green_sea_turtle.glb'),('manta_new.glb','model_84b_-_manta_ray_swimming.glb'),('temp_04_scaledup.glb','crayfish.glb'),('dace.glb','speckleddace_v4_03a.glb')]
def images(d,b):
 out=[]
 for v in d.get('images',[]):
  bv=d['bufferViews'][v['bufferView']];off=bv.get('byteOffset',0);im=Image.open(io.BytesIO(b[off:off+bv['byteLength']])).convert('RGBA');ar=np.asarray(im)
  out.append({'size':list(im.size),'hash':hashlib.sha256(ar.tobytes()).hexdigest(),'small':np.asarray(im.resize((128,128))).astype(float)/255})
 return out

def compare(a,b):
 A,BA,_=load(INPUT/a);B,BB,_=load(INPUT/b);IA=images(A,BA);IB=images(B,BB)
 equal=[{'a':i,'b':j,'dimensions':x['size']} for i,x in enumerate(IA)for j,y in enumerate(IB)if x['hash']==y['hash'] and x['size']==y['size']]
 nearest=[]
 for i,x in enumerate(IA):
  ds=[float(np.sqrt(np.mean((x['small']-y['small'])**2)))for y in IB];nearest.append({'imageA':i,'closestB':int(np.argmin(ds)) if ds else None,'thumbnailRMSE':min(ds)if ds else None})
 NA=set(n.get('name','') for n in A.get('nodes',[]));NB=set(n.get('name','')for n in B.get('nodes',[]))
 def positions(d,bin):
  return np.concatenate([acc(d,bin,p['attributes']['POSITION'])for m in d.get('meshes',[])for p in m['primitives']])
 pa=positions(A,BA);pb=positions(B,BB)
 # Same unmodified source-local frame only; not a universal duplicate detector.
 da=cKDTree(pb).query(pa)[0];db=cKDTree(pa).query(pb)[0]
 jointsA=set(A['nodes'][i].get('name','') for s in A.get('skins',[])for i in s['joints']);jointsB=set(B['nodes'][i].get('name','')for s in B.get('skins',[])for i in s['joints'])
 def anims(d,bin):
  out={}
  for an in d.get('animations',[]):
   track={}
   for c in an['channels']:
    n=c['target'].get('node');name=d['nodes'][n].get('name',str(n));s=an['samplers'][c['sampler']];ts=acc(d,bin,s['input']);ar=acc(d,bin,s['output'])
    track[(name,c['target']['path'])]=(ts,ar)
   out[an.get('name')]=track
  return out
 aa=anims(A,BA);ab=anims(B,BB);anim=[]
 for name in aa.keys()&ab.keys():
  x,y=aa[name],ab[name];both=x.keys()&y.keys();matches=[]
  for target in both:
   t,v=x[target];s,w=y[target]
   if t.shape==s.shape and v.shape==w.shape and np.allclose(t,s,atol=3e-6,rtol=0)and np.allclose(v,w,atol=3e-6,rtol=0):matches.append(target)
  anim.append({'name':name,'commonTargets':len(both),'equalWithin3e_6':len(matches),'targetsA':len(x),'targetsB':len(y)})
 return {'a':a,'b':b,'sourceA':A.get('asset'), 'sourceB':B.get('asset'),'decodedImageExactMatches':equal,'imageThumbnailDistances':nearest,'nodesCommonNames':len((NA&NB)-{''}),'jointNamesCounts':[len(jointsA),len(jointsB)],'jointNamesEqual':jointsA==jointsB,'jointNamesCommon':len(jointsA&jointsB),'positionNearestSourceFrame':{'AtoBmax':float(da.max()),'BtoAmax':float(db.max()),'AtoBmedian':float(np.median(da)),'BtoAmedian':float(np.median(db))},'sameNamedClips':anim,'ownershipEstablished':False}
if __name__=='__main__':
 rows=[compare(*p)for p in PAIRS];(ROOT/'qa/SOURCE_OVERLAP.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 for r in rows:print(json.dumps(r,ensure_ascii=False))
