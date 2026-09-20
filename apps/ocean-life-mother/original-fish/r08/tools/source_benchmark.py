from __future__ import annotations
import argparse, hashlib, json, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from skimage.measure import find_contours
import trimesh

ACCEPTED={
'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0':6137560,
'5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe':58908280}
DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def read_glb(path:Path):
 raw=path.read_bytes(); sha=hashlib.sha256(raw).hexdigest()
 if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,4)[0]!=2 or struct.unpack_from('<I',raw,8)[0]!=len(raw): raise ValueError('invalid GLB')
 if sha not in ACCEPTED or ACCEPTED[sha]!=len(raw): raise ValueError('exact FISH-REF-002 source required')
 off=12; g=None; binv=None
 while off+8<=len(raw):
  n,t=struct.unpack_from('<II',raw,off); s=off+8; e=s+n
  if t==0x4E4F534A:g=json.loads(raw[s:e].decode().rstrip('\x00 \t\r\n'))
  elif t==0x004E4942:binv=memoryview(raw)[s:e]
  off=e
 if g is None or binv is None: raise ValueError('missing JSON/BIN')
 return raw,sha,g,binv

def acc(g,binv,i):
 a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]; dt=np.dtype(DT[a['componentType']]).newbyteorder('<'); c=NC[a['type']]
 o=bv.get('byteOffset',0)+a.get('byteOffset',0); stride=bv.get('byteStride',dt.itemsize*c); out=np.empty((a['count'],c),dt)
 for k in range(a['count']):out[k]=np.frombuffer(binv,dt,c,o+k*stride)
 if a.get('normalized'):
  info=np.iinfo(dt); out=out.astype(float)/(info.max if info.min==0 else info.max); out=np.maximum(out,-1)
 return out

def qmat(q):
 x,y,z,w=q; n=x*x+y*y+z*z+w*w; s=2/n if n else 0; m=np.eye(4)
 m[:3,:3]=[[1-s*(y*y+z*z),s*(x*y-z*w),s*(x*z+y*w)],[s*(x*y+z*w),1-s*(x*x+z*z),s*(y*z-x*w)],[s*(x*z-y*w),s*(y*z+x*w),1-s*(x*x+y*y)]]
 return m

def local(n):
 if 'matrix'in n:return np.array(n['matrix'],float).reshape(4,4,order='F')
 t=np.eye(4);t[:3,3]=n.get('translation',[0,0,0]);s=np.eye(4);s[:3,:3]=np.diag(n.get('scale',[1,1,1]));return t@qmat(n.get('rotation',[0,0,0,1]))@s

def worlds(g):
 p=[-1]*len(g['nodes'])
 for i,n in enumerate(g['nodes']):
  for c in n.get('children',[]):p[c]=i
 l=[local(n) for n in g['nodes']]; cache={}
 def w(i):
  if i not in cache:cache[i]=l[i] if p[i]<0 else w(p[i])@l[i]
  return cache[i]
 return [w(i) for i in range(len(l))],p

def group(n):
 if n in {'_rootJoint','Hips_01'}:return'root'
 if n.startswith('Spine')or n=='Head_05':return'axial'
 if 'UpperJaw'in n:return'upper_jaw'
 if 'LoweJaw'in n:return'lower_jaw'
 if n.startswith('Eye.'):return'eye'
 if n.startswith('Side.')and'Fin'not in n:return'operculum_candidate'
 if n.startswith('SideFin'):return'pectoral_fin'
 if n.startswith('LowerFin')and'Back'not in n:return'pelvic_fin'
 if n.startswith('UpperFin'):return'dorsal_fin'
 if n.startswith('LowerBackFin'):return'anal_fin'
 if n.startswith('UpperTail'):return'caudal_upper'
 if n.startswith('LowerTail'):return'caudal_lower'
 return'unclassified'

def meshes(path):
 sc=trimesh.load(path,force='scene'); out={}
 for node in sc.graph.nodes_geometry:
  T,name=sc.graph[node]; m=sc.geometry[name].copy();m.apply_transform(T)
  key='body'if name.startswith('FishC')else'eyes'if name.startswith('EyesC')else'cornea'if name.startswith('CorneaC')else name;out[key]=m
 return out

def basis(name):
 H=np.array([0.,1,0]);L=np.array([1.,0,0]);D=np.array([0.,0,1.])
 if name=='side_left':return H,D,np.array([1.,0,0])
 if name=='front':return L,D,np.array([0.,-1,0])
 if name=='top':return H,-L,np.array([0.,0,-1])
 v=-np.array([-1.,1,.25]);v/=np.linalg.norm(v);x=H-v*np.dot(H,v);x/=np.linalg.norm(x);y=np.cross(v,x);y*=1 if np.dot(y,D)>0 else-1;return x,y,v

def view_metrics(ms,name,size=(960,640)):
 sx,sy,vd=basis(name); P={k:np.c_[m.vertices@sx,m.vertices@sy,m.vertices@vd]for k,m in ms.items()};A=np.concatenate(list(P.values()));mn=A[:,:2].min(0);mx=A[:,:2].max(0);ext=np.maximum(mx-mn,1e-9);scale=min(size[0]*.88/ext[0],size[1]*.88/ext[1]);ctr=(mn+mx)/2
 def pix(p):return np.c_[(p[:,0]-ctr[0])*scale+size[0]/2,size[1]/2-(p[:,1]-ctr[1])*scale,p[:,2]]
 im=Image.new('L',size,0);d=ImageDraw.Draw(im)
 for k,m in ms.items():
  q=pix(P[k])
  for f in m.faces:d.polygon([(float(q[i,0]),float(q[i,1]))for i in f],fill=255)
 a=np.asarray(im)>0;y,x=np.nonzero(a);cs=find_contours(a.astype(float),.5);c=max(cs,key=len);idx=np.linspace(0,len(c)-1,256,endpoint=False).astype(int);cont=[[round(float(c[i,1]/size[0]),6),round(float(c[i,0]/size[1]),6)]for i in idx]
 return {'imageSize':list(size),'silhouetteAreaPixels':int(a.sum()),'silhouetteAreaRatio':round(float(a.mean()),6),'silhouetteBBoxPixels':[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)],'silhouetteCentroidNormalized':[round(float(x.mean()/size[0]),6),round(float(y.mean()/size[1]),6)],'projectionFit':{'min':mn.round(6).tolist(),'max':mx.round(6).tolist(),'center':ctr.round(6).tolist(),'scale':round(float(scale),6)},'contourSamples':256,'contourSha256':hashlib.sha256(json.dumps(cont,separators=(',',':')).encode()).hexdigest()}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('glb',type=Path);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 raw,sha,g,binv=read_glb(a.glb);ms=meshes(a.glb);body=ms['body'];L=float(body.bounds[1,1]-body.bounds[0,1]);wm,parent=worlds(g);skin=g['skins'][0];meshnode=next(i for i,n in enumerate(g['nodes'])if n.get('mesh')==0);MW=wm[meshnode]
 ibm=acc(g,binv,skin['inverseBindMatrices']).astype(float).reshape(-1,4,4).transpose(0,2,1);j=[]
 for li,ni in enumerate(skin['joints']):
  p=(MW@np.r_[np.linalg.inv(ibm[li])[:3,3],1])[:3];name=g['nodes'][ni].get('name',f'node_{ni}')
  j.append({'skinJointIndex':li,'nodeIndex':ni,'name':name,'parent':parent[ni],'group':group(name),'normalized':[round(float(p[0]/L),6),round(float((p[1]-body.bounds[0,1])/L),6),round(float(p[2]/L),6)]})
 prim=g['meshes'][0]['primitives'][0];J=acc(g,binv,prim['attributes']['JOINTS_0']).astype(int);W=acc(g,binv,prim['attributes']['WEIGHTS_0']).astype(float);W/=np.maximum(W.sum(1,keepdims=True),1e-12);I=acc(g,binv,prim['indices']).reshape(-1).astype(int).reshape(-1,3);names=[g['nodes'][n].get('name',f'node_{n}')for n in skin['joints']];dom=np.take_along_axis(J,np.argmax(W,1)[:,None],1)[:,0];vg=np.array([group(names[i])for i in dom]);fg=[]
 for f in I:
  v,c=np.unique(vg[f],return_counts=True);fg.append(v[np.argmax(c)])
 full={'schema':'kaopu.original-fish.source-benchmark/1.0','referenceId':'FISH-REF-002','input':{'filename':a.glb.name,'bytes':len(raw),'sha256':sha},'coordinateFrame':{'sceneAxes':{'lateral':'+/-X','tailToHead':'+Y','ventralToDorsal':'+Z'},'bodyLengthSourceUnits':round(L,6),'tailY':round(float(body.bounds[0,1]),6),'snoutY':round(float(body.bounds[1,1]),6)},'sourceCounts':{'nodes':len(g['nodes']),'meshes':len(g['meshes']),'bodyVertices':len(body.vertices),'bodyTriangles':len(body.faces),'eyesVertices':len(ms['eyes'].vertices),'corneaVertices':len(ms['cornea'].vertices),'skinJoints':len(skin['joints']),'animations':len(g['animations']),'animationChannels':sum(len(x['channels'])for x in g['animations']),'materials':len(g['materials']),'images':len(g['images'])},'views':{v:view_metrics(ms,v)for v in ['side_left','three_quarter','front','top']},'skeleton':{'jointCount':len(j),'groupCounts':{x:sum(z['group']==x for z in j)for x in sorted({z['group']for z in j})},'bindInventorySha256':hashlib.sha256(json.dumps(j,separators=(',',':')).encode()).hexdigest()},'skinInfluence':{'faceDominantGroupCounts':{x:int(np.count_nonzero(np.array(fg)==x))for x in sorted(set(fg))}},'restartGate':{'sourceReferenceRendered':True,'fixedViewCalibrationComplete':True,'silhouetteBaselinesComplete':True,'skeletonInventoryComplete':True,'skinInfluenceInventoryComplete':True,'anatomicalPartitionAccepted':False,'nativeCandidateAllowed':False}}
 out=a.out/'SOURCE_BENCHMARK_R01_SUMMARY.json';out.write_text(json.dumps(full,ensure_ascii=False,indent=2)+'\n');print(out)
if __name__=='__main__':main()
