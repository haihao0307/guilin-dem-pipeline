"""R03.A source-constrained tensor-product field fit (research only).
Source faces/UVs are observation apparatus. Output: separable scalar curve
coefficients and bounded parameter-domain intervals, not source triangles,
source images or source vertex attributes. Not an anatomical species kernel yet.
"""
import sys,json,numpy as np,hashlib,time,os
from pathlib import Path
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.ndimage import distance_transform_edt,gaussian_filter
from numba import njit
from source import g,acc,image,raw
OUT=Path(os.environ.get('KAOPU_R03_ROOT',str(Path(__file__).resolve().parents[1])));ROOT=OUT/'research';ROOT.mkdir(parents=True,exist_ok=True);(OUT/'qa').mkdir(exist_ok=True)
@njit(cache=True)
def raster(p,n,uv,tan,faces,box,W,H):
 arr=np.zeros((H,W,10),np.float64);valid=np.zeros((H,W),np.uint8);multiplicity=np.zeros((H,W),np.int16)
 for f in faces:
  tex=uv[f]; xy=np.empty((3,2))
  for k in range(3):
   xy[k,0]=(tex[k,0]-box[0])/(box[2]-box[0])*(W-1)
   xy[k,1]=(tex[k,1]-box[1])/(box[3]-box[1])*(H-1)
  a=xy[0];b=xy[1];c=xy[2];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-10:continue
  for y in range(max(0,int(np.ceil(xy[:,1].min()))),min(H-1,int(np.floor(xy[:,1].max())))+1):
   for x in range(max(0,int(np.ceil(xy[:,0].min()))),min(W-1,int(np.floor(xy[:,0].max())))+1):
    l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
    l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;l3=1-l1-l2
    if min(l1,l2,l3)<-1e-7:continue
    lamb=np.array([l1,l2,l3]);vpos=np.zeros(3)
    for k in range(3):vpos+=lamb[k]*p[f[k]]
    # Flag multiply-covered parametric chart. Do not call it a bijection.
    if valid[y,x] and np.sqrt(((arr[y,x,:3]-vpos)**2).sum())>1e-4:multiplicity[y,x]+=1
    arr[y,x,:3]=vpos
    for k in range(3):
     for d in range(3):arr[y,x,3+d]+=lamb[k]*n[f[k],d]
     for d in range(4):arr[y,x,6+d]+=lamb[k]*tan[f[k],d]
    valid[y,x]=1
 return arr,valid,multiplicity

def srgb(a):return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
def sample(im,UV,color=False):
 h,w=im.shape[:2];xy=np.mod(UV,1)*[w,h]-.5;i=np.floor(xy).astype(int);d=xy-i;r=np.zeros((len(UV),4))
 for ox,oy in [(0,0),(1,0),(0,1),(1,1)]:
  c=im[(i[:,1]+oy)%h,(i[:,0]+ox)%w].astype(float)/255
  if color:c[:,:3]=srgb(c[:,:3])
  r+=c*((d[:,0] if ox else 1-d[:,0])*(d[:,1] if oy else 1-d[:,1]))[:,None]
 return r

def unit(a):return a/np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-9)
def lowrank(a,valid,rank,epsilon,channel):
 nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True)
 fill=a[tuple(nearest)]
 # Extension is outside observed domain only. Never claimed as observed data.
 U,s,V=np.linalg.svd(fill,full_matrices=False)
 rank=min(rank,len(s));A=(U[:,:rank]*s[:rank]).T;B=V[:rank,:]
 # Float32 roundtrip is explicit; original source is retained immutable.
 A=A.astype('float32');B=B.astype('float32');pred=A.T@B
 err=pred[valid]-a[valid]
 return {'rank':rank,'rows':list(map(list,A.tolist())),'cols':list(map(list,B.tolist()))},pred,{'channel':channel,'rmse':float(np.sqrt(np.mean(err**2))),'max':float(np.max(np.abs(err))),'units':epsilon}

def intervals(mask):
 out=[]
 for row in mask:
  a=np.r_[False,row,False].astype(int);starts=np.where(np.diff(a)==1)[0];ends=np.where(np.diff(a)==-1)[0]-1;out.append(np.column_stack([starts,ends]).ravel().tolist())
 return out

def main():
 ims=[np.asarray(image(i)) for i in range(4)];patches=[];reports=[];reference=[]
 for mi,m in enumerate(g['meshes']):
  pr=m['primitives'][0];at=pr['attributes'];p=acc(at['POSITION']);n=acc(at['NORMAL']);uv=acc(at['TEXCOORD_0']);tan=acc(at['TANGENT']);fa=acc(pr['indices']).reshape(-1,3)
  rr=fa[:,[0,1,1,2,0,2]].ravel();cc=fa[:,[1,0,2,1,2,0]].ravel();nc,lab=connected_components(coo_matrix((np.ones(len(rr)),(rr,cc)),shape=(len(p),len(p))).tocsr())
  np.savez(ROOT/f'components{mi}.npz',labels=lab)
  for component in range(nc):
   # Positive source halves: actual source pairs are measured below; not assumed biological symmetry.
   if mi==0 and component>=7:continue
   ids=np.where(lab==component)[0]
   # All nonempty source chart components remain in the fit.
   fs=fa[np.isin(fa[:,0],ids)]
   box=np.r_[uv[ids].min(0),uv[ids].max(0)].astype(float)
   W,H=(288,128) if len(ids)>1000 else ((32,24) if len(ids)<25 else (80,80)) if mi==0 else (56,56)
   geom,mask,multi=raster(p,n,uv,tan,fs,box,W,H);valid=mask.astype(bool) & (multi==0)
   yy,xx=np.mgrid[0:H,0:W];UV=np.stack([box[0]+xx/(W-1)*(box[2]-box[0]),box[1]+yy/(H-1)*(box[3]-box[1])],-1)
   bc=sample(ims[0],UV.reshape(-1,2),True).reshape(H,W,4);mr=sample(ims[1],UV.reshape(-1,2)).reshape(H,W,4);em=sample(ims[2],UV.reshape(-1,2),True).reshape(H,W,4)[...,:3];nm=sample(ims[3],UV.reshape(-1,2)).reshape(H,W,4)[...,:3]*2-1
   ns=unit(geom[...,3:6]);ts=unit(geom[...,6:9]-ns*np.sum(ns*geom[...,6:9],axis=-1,keepdims=True));bs=unit(np.cross(ns,ts))*np.sign(geom[...,9:10]);detail=unit(ts*nm[...,0:1]+bs*nm[...,1:2]+ns*nm[...,2:3])
   fields={};errors=[];pred=np.zeros((H,W,17));values=np.concatenate([geom[...,:3],bc,mr[...,1:2],detail,em,ns],-1)
   names=['x','y','z','red','green','blue','alpha','roughness','nx','ny','nz','er','eg','eb','sx','sy','sz']
   for k,name in enumerate(names):
    rank=(36 if len(ids)>1000 else 14) if k<3 else ((64 if len(ids)>1000 else 28) if k<6 else (28 if len(ids)>1000 else 16) if k<11 else 10 if k<14 else 24)
    fields[name],pred[...,k],e=lowrank(values[...,k],valid,rank,'source-unit' if k<3 else 'linear',name);errors.append(e)
   mirrored=mi==0
   patch={'id':f'patch-{mi}-{component}','kind':('body-and-median-fins' if component==0 and mi==0 else 'eyes' if mi==1 else 'paired-fins'),'width':W,'height':H,'mirrorX':mirrored,'domain':intervals(valid),'fields':fields}
   patches.append(patch)
   errors3=np.linalg.norm(pred[...,:3]-geom[...,:3],axis=-1)[valid]
   report={'id':patch['id'],'sourceComponent':component,'sourceMesh':mi,'samples':int(valid.sum()),'chartMulticoverPixels':int((multi>0).sum()),'geometryErrorSourceUnits':{'rms':float(np.sqrt(np.mean(errors3**2))),'p95':float(np.quantile(errors3,.95)),'max':float(errors3.max())},'fieldErrors':errors}
   if mirrored:
    other=p[lab==component+7].copy();other[:,0]*=-1
    from scipy.spatial import cKDTree
    report['sourceMirrorPairMaxError']=float(cKDTree(p[ids]).query(other)[0].max())
   reports.append(report);print(patch['id'],report['geometryErrorSourceUnits'],flush=True)
   if component==0 and mi==0:
    np.savez_compressed(ROOT/'main_chart_reference.npz',values=values,mask=valid,box=box)
   pts=values[valid];ref=pts.copy();reference.append(ref)
   if mirrored:ref=ref.copy();ref[:,[0,8,14]]*=-1;reference.append(ref)
 doc={'schema':'kaopu-source-chart-field-study/0.1','generator':'separable-cubic-curve-field/0.1','referenceId':'FISH-REF-001','sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceLengthUnits':float(.35603609),'coordinateFrame':'source-local preserved; X width Y up +Z head','semanticStatus':'source chart transfer; not yet a universal anatomical kernel','license':'CC-BY-NC-4.0 source-derived study; commercialClearance false','author':'DigitalLife3D','patches':patches,'material':{'metalness':0,'specularFactor':.42124199697207376},'gates':{'originalMeshesInRuntime':False,'originalTextureFilesInRuntime':False,'fishTriangleBuffersInRuntime':False,'anatomicalCorrespondenceAccepted':False,'nativeMotionAccepted':False,'visualAcceptance':False,'growthEvidence':False,'productionReady':False}}
 text=json.dumps(doc,separators=(',',':'));(OUT/'FISH_REF001_FIELD_STUDY.json').write_text(text)
 np.concatenate(reference).astype('float32').tofile(ROOT/'reference_surfels.bin')
 qa={'method':'source-UV reference charts re-expressed as separable cubic scalar fields; not anatomical species abstraction','notes':['All source connected components represented, with observed source symmetry paired','Chart multicover flagged; observed source map not assumed bijective','Body and fins not yet semantically split; no jaw/gill motion accepted','Grid interpolation errors and spherical appearance need independent heldout testing','source unit is not independently measured biological metre'],'patches':reports,'jsonBytes':len(text.encode()),'float32FieldCount':sum(sum((len(v['rows'][0])+len(v['cols'][0]))*v['rank'] for v in p['fields'].values()) for p in patches),'acceptance':doc['gates']}
 import gzip
 compressed=gzip.compress(text.encode(),mtime=0);(ROOT/'field-study.json.gz').write_bytes(compressed);qa['gzipBytes']=len(compressed)
 (OUT/'qa/fit-r03.json').write_text(json.dumps(qa,indent=2))
 print('bytes',len(text),len(compressed))
if __name__=='__main__':main()
