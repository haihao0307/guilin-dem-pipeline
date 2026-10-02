"""Exact source-address fish factory compiler; original ZIPs are read only."""
import json, pathlib, zipfile, io, base64, posixpath, hashlib, gzip, math, re
import numpy as np
import heapq
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WD={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
sha=lambda b:hashlib.sha256(b).hexdigest()
def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape((4,4),order='F')
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 m[:3,:3]*=n.get('scale',[1,1,1]);m[:3,3]=n.get('translation',[0,0,0]);return m
class Source:
 def __init__(self,row):
  pieces=row['container'].split('!');raw=pathlib.Path(pieces[0]).read_bytes()
  for p in pieces[1:]:raw=zipfile.ZipFile(io.BytesIO(raw)).read(p)
  z=zipfile.ZipFile(io.BytesIO(raw));self.files={n:z.read(n) for n in z.namelist() if not n.endswith('/')};self.parent=posixpath.dirname(row['entry']);self.g=json.loads(self.files[row['entry']].decode('utf-8-sig'));self.row=row
  self.buffers=[self.uri(b['uri']) for b in self.g.get('buffers',[])];self.nodes=self.g.get('nodes',[]);self.parents={c:i for i,n in enumerate(self.nodes) for c in n.get('children',[])};self.worlds={};self.arrays={}
 def uri(self,u):
  if u.startswith('data:'):return base64.b64decode(u.split(',',1)[1])
  from urllib.parse import unquote
  return self.files[posixpath.normpath(posixpath.join(self.parent,unquote(u)))]
 def acc(self,i):
  if i in self.arrays:return self.arrays[i]
  a=self.g['accessors'][i];v=self.g['bufferViews'][a['bufferView']];d=np.dtype(DT[a['componentType']]);w=WD[a['type']]
  ar=np.ndarray((a['count'],w),dtype=d,buffer=self.buffers[v['buffer']],offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*d.itemsize),d.itemsize)).copy()
  if a.get('normalized') and a['componentType']!=5126:ar=np.maximum(ar.astype(float)/np.iinfo(d).max,-1)
  self.arrays[i]=ar;return ar
 def world(self,i):
  if i not in self.worlds:self.worlds[i]=(self.world(self.parents[i]) if i in self.parents else np.eye(4))@matrix(self.nodes[i])
  return self.worlds[i]
 def dump(self):
  print('\nSOURCE',self.row['label'])
  for i,n in enumerate(self.nodes):
   if 'mesh' in n or re.search(r'head|tail|eye|fin|spine|body|bone',n.get('name',''),re.I):print(i,n.get('name'),{k:n[k] for k in ['mesh','skin','children'] if k in n},np.round(self.world(i)[:3,3],5).tolist())
  for i,m in enumerate(self.g['meshes']):
   print('MESH',i,m.get('name'),[(len(self.acc(p['attributes']['POSITION'])),np.round(self.acc(p['attributes']['POSITION']).min(0),4).tolist(),np.round(self.acc(p['attributes']['POSITION']).max(0),4).tolist(),p.get('material')) for p in m['primitives']])
def selected():
 inv=json.loads((ROOT.parent/'species-intake-r01/LOCAL_INVENTORY.json').read_text(encoding='utf8'))['models']
 for id,label in [('herring','school_of_herring'),('tuna-yellow-label','黄鳍金枪鱼TUNA'),('tuna-blue-label','bluefin-tuna'),('colorful','彩色珊瑚鱼3'),('picasso','毕加索炮弹鱼Picasso Fish')]:
  yield id,Source(next(r for r in inv if r['label']==label and not r.get('duplicateOf')))
def source_primitives(s,id):
 out=[]
 for ni,node in enumerate(s.nodes):
  if 'mesh' not in node:continue
  mi=node['mesh']
  if id=='herring' and mi not in (0,1):continue
  if id=='colorful' and mi==7:continue # separate 322-vertex scene enclosing sphere, not fish anatomy
  for pi,p in enumerate(s.g['meshes'][mi]['primitives']):
   a=p['attributes'];pos=s.acc(a['POSITION']).astype(float);no=s.acc(a['NORMAL']).astype(float);joint=None;weight=None
   if 'skin' in node:
    sk=s.g['skins'][node['skin']];ib=s.acc(sk['inverseBindMatrices']);mats=np.array([s.world(j)@ib[k].reshape((4,4),order='F') for k,j in enumerate(sk['joints'])]);joint=s.acc(a['JOINTS_0']).astype(int);weight=s.acc(a['WEIGHTS_0']).astype(float)
    blend=np.sum(mats[joint]*weight[:,:,None,None],axis=1);wp=np.einsum('nij,nj->ni',blend,np.c_[pos,np.ones(len(pos))])[:,:3];wn=np.einsum('nij,nj->ni',np.linalg.inv(blend[:,:3,:3]).transpose(0,2,1),no)
   else:
    m=s.world(ni);wp=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];wn=no@np.linalg.inv(m[:3,:3])
   wn/=np.maximum(np.linalg.norm(wn,axis=1)[:,None],1e-12)
   out.append({'p':wp,'n':wn,'uv':s.acc(a['TEXCOORD_0']).astype(float),'ix':s.acc(p['indices']).ravel().astype(int),'material':p.get('material',0),'mesh':mi,'node':ni,'name':s.g['meshes'][mi].get('name'),'joint':joint,'weight':weight,'skin':node.get('skin')})
 return out
def texture_payload(s):
 images=[]
 for im in s.g.get('images',[]):
  if 'uri' in im:b=s.uri(im['uri'])
  else:
   v=s.g['bufferViews'][im['bufferView']];b=s.buffers[v['buffer']][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  mime=im.get('mimeType') or ('image/png' if b[:8]==b'\x89PNG\r\n\x1a\n' else 'image/jpeg')
  from PIL import Image
  sourceImage=Image.open(io.BytesIO(b)).convert('RGBA');pixels=np.asarray(sourceImage);pixelhash=sha(pixels.tobytes());out=io.BytesIO();sourceImage.save(out,format='WEBP',lossless=True,exact=True,method=6);candidate=out.getvalue();decoded=np.asarray(Image.open(io.BytesIO(candidate)).convert('RGBA'))
  if not np.array_equal(pixels,decoded):raise RuntimeError('Lossless texture pixel comparison failed')
  delivery=candidate if len(candidate)<len(b) else b;deliveryMime='image/webp' if delivery is candidate else mime
  images.append({'uri':'data:'+deliveryMime+';base64,'+base64.b64encode(delivery).decode(),'mimeType':deliveryMime,'sha256':sha(delivery),'bytes':len(delivery),'sourceSha256':sha(b),'sourceBytes':len(b),'sourcePixelSha256':pixelhash,'losslessPixelVerified':True,'resolution':list(sourceImage.size)})
 return [{**images[t['source']],'sourceIndex':t['source'],'sampler':s.g.get('samplers',[{}])[t.get('sampler',0)] if s.g.get('samplers') else {}} for t in s.g.get('textures',[])]
def smooth(t):
 t=np.clip(t,0,1);return t*t*t*(10+t*(-15+6*t))
def gait_reference(s,central):
 rows=[];nodeSet={j['node'] for j in central}
 if not s.g.get('animations'):return {'sourceAnimationAvailable':False,'calibration':'AUTHORED_ENGINEERING_GAIT_REQUIRES_VISUAL_REVIEW'}
 clip=s.g['animations'][0]
 for ch in clip['channels']:
  ni=ch['target'].get('node');path=ch['target']['path']
  if ni not in nodeSet or path!='rotation':continue
  samp=clip['samplers'][ch['sampler']];t=s.acc(samp['input']).ravel();q=s.acc(samp['output']).astype(float)
  if len(t)<8 or len(q)!=len(t):continue
  q/=np.maximum(np.linalg.norm(q,axis=1)[:,None],1e-12);q[q@q[0]<0]*=-1
  grid=np.linspace(t[0],t[-1],601);series=np.array([np.interp(grid,t,q[:,k]) for k in range(4)]).T;series-=series.mean(0);sig=series[:,np.argmax(np.std(series,axis=0))];energy=abs(np.fft.rfft(sig));energy[0]=0;freq=np.fft.rfftfreq(len(grid),grid[1]-grid[0]);k=int(np.argmax(energy));angle=2*np.arccos(np.clip(abs(q@q[0]),0,1))
  rows.append({'node':ni,'name':s.nodes[ni].get('name'),'duration':float(t[-1]-t[0]),'dominantQuaternionFrequencyHz':float(freq[k]),'maxRelativeRestAngleRadians':float(angle.max()),'interpolation':samp.get('interpolation','LINEAR')})
 return {'sourceAnimationAvailable':True,'clip':clip.get('name'),'localCentralJointMeasurements':rows,'meaning':'Reference local channel frequency/angle, not biological gait calibration or procedural playback','calibration':'SOURCE_ANIMATION_REFERENCE_ONLY'}
def herring_fin_charts(ps,fins):
 p=ps[0];v=p['p'];par=list(range(len(v)))
 def find(k):
  while par[k]!=k:par[k]=par[par[k]];k=par[k]
  return k
 for a,b,c in p['ix'].reshape(-1,3):par[find(b)]=find(a);par[find(c)]=find(a)
 groups={}
 for k in range(len(v)):groups.setdefault(find(k),[]).append(k)
 labels=np.zeros(len(v),int)
 for members in groups.values():
  q=v[members];lo=q.min(0);hi=q.max(0);fid=0
  if hi[0]-lo[0]<.18 and lo[1]>.09 and lo[0]>-.10 and hi[0]<.08:fid=5
  elif hi[0]-lo[0]<.18 and lo[0]>.12 and hi[0]<.30 and lo[1]<-.04 and hi[1]<0:fid=6
  elif hi[0]-lo[0]<.10 and lo[0]>-.025 and hi[0]<.09 and hi[1]<-.045:fid=3 if q[:,2].mean()>.032 else 4
  elif hi[0]-lo[0]<.18 and lo[0]>-.28 and hi[0]<-.10 and hi[1]<0 and lo[1]>-.06:fid=1 if q[:,2].mean()>0 else 2
  if fid:labels[members]=fid
 # Propagate anatomical identity to every duplicate material address without welding geometry.
 tags={}
 for k,fid in enumerate(labels):
  if fid:tags[tuple(np.round(v[k],7))]=int(fid)
 for k,point in enumerate(v):labels[k]=tags.get(tuple(np.round(point,7)),int(labels[k]))
 labels[v[:,0]>.30]=7
 weights=np.zeros(len(v))
 for f in fins:
  fid=f['id'];ids=np.where(labels==fid)[0]
  if not len(ids):continue
  q=v[ids];direction=np.array([0,0,1 if fid==1 else -1]) if fid<3 else np.array([0,-1,0]) if fid in (3,4,6) else np.array([0,1,0]) if fid==5 else np.array([1,0,0]);d=q@direction;threshold=float(np.quantile(d,.08));rootIds=ids[d<threshold+.006];root=np.median(v[rootIds],axis=0);f['root']=root.tolist();f['measurement']='Original indexed source fin UV-chart islands, exact-position seam propagation, measured inward hinge band';f['sourceChartVertices']=len(ids);f['outward']=direction.tolist();weights[ids]=smooth((d-threshold)/(.020 if fid<7 else .08))
 return labels,weights
def fit_source_eye(points,side):
 # Measure the original flattened ocular surface in its own frame; never inflate depth to its tangent radius.
 values,axes=np.linalg.eigh(np.cov(points.T));normal=axes[:,np.argmin(values)]
 if normal[2]*side<0:normal=-normal
 x=np.cross([0.,1.,0.],normal);x/=np.linalg.norm(x);y=np.cross(normal,x);frame=np.array([x,y,normal]);local=points@frame.T;lo=local.min(0);hi=local.max(0);radii=(hi-lo)/2;center=((lo+hi)/2)@frame
 return {'center':center.tolist(),'normal':normal.tolist(),'radius':float(max(radii[:2])),'localRadii':radii.tolist(),'sourceFrame':{'x':x.tolist(),'y':y.tolist(),'normal':normal.tolist()},'sourceBoundMin':points.min(0).tolist(),'sourceBoundMax':points.max(0).tolist(),'sourceLocalBoundMin':lo.tolist(),'sourceLocalBoundMax':hi.tolist(),'ocularFit':'Original eye spatial cluster PCA normal, exact extrema in tangent/normal frame; ellipsoid adaptation stays within original measured local bounds','sourcePointCount':len(points)}
def compile_score(id,s):
 ps=source_primitives(s,id);points=np.concatenate([p['p'] for p in ps])
 if id=='herring':axis=s.world(33)[:3,3]-s.world(34)[:3,3]
 elif id in ('tuna-yellow-label','tuna-blue-label'):axis=np.array([0.,0.,-1.])
 else:axis=np.array([-1.,0.,0.])
 axis/=np.linalg.norm(axis);up=np.array([0.,1.,0.]);up-=axis*np.dot(axis,up);up/=np.linalg.norm(up);lat=np.cross(axis,up);rot=np.array([axis,up,lat]);rp=points@rot.T;lo=rp.min(0);hi=rp.max(0);L=hi[0]-lo[0];center=np.array([(lo[0]+hi[0])/2,np.median(rp[:,1]),np.median(rp[:,2])]);can=lambda p:(np.asarray(p)@rot.T-center)/L
 for p in ps:p['p']=can(p['p']);p['n']=p['n']@rot.T
 allp=np.concatenate([p['p'] for p in ps]);jrows=[]
 for ni,node in enumerate(s.nodes):
  if any(ni in sk['joints'] for sk in s.g.get('skins',[])) and (id!='herring' or ni in range(28,37)):
   jrows.append({'node':ni,'name':node.get('name',str(ni)),'position':can(s.world(ni)[:3,3]).tolist(),'parent':s.parents.get(ni)})
 jpos={j['node']:np.array(j['position']) for j in jrows};families={i:[] for i in range(1,8)}
 if id=='tuna-yellow-label':
  for j in jrows:
   nm=j['name'];nid=j['node'];fid=1 if 'SideFin.L' in nm else 2 if 'SideFin.R' in nm else 3 if 'LowerFin.L' in nm else 4 if 'LowerFin.R' in nm else 6 if 'LowerBackFin' in nm else 7 if 'Tail' in nm else 5 if 'UpperFin' in nm else 0
   if fid:families[fid].append(nid)
 elif id=='tuna-blue-label':
  for j in jrows:
   nm=j['name'];nid=j['node'];fid=1 if 'Flipper_L_Front' in nm else 2 if 'Flipper_R_Front' in nm else 3 if 'Bottom_Flipper_L' in nm else 4 if 'Bottom_Flipper_R' in nm else 5 if 'Top_Fin' in nm else 6 if 'Bottom_Fin' in nm else 7 if 'Tail_Fin' in nm else 0
   if fid:families[fid].append(nid)
 elif id=='colorful':families={1:[37],2:[31],3:[34],4:[28],5:[20,22,24,26],6:[21,23,25,27],7:[18,19]}
 kinds={1:'pectoral-left',2:'pectoral-right',3:'pelvic-left',4:'pelvic-right',5:'dorsal',6:'anal',7:'caudal'}
 fins=[]
 for fid in range(1,8):
  nodes=families[fid];root=np.mean([jpos[j] for j in nodes if s.parents.get(j) not in nodes],axis=0) if nodes else np.array([-.12 if fid<5 else .03 if fid<7 else .31,0.,0.])
  if not nodes:
   sel=allp[(allp[:,0]>.30)] if fid==7 else allp[(allp[:,0]>-.24)&(allp[:,0]<.16)]
   if fid<5:root[2]=(1 if fid%2 else -1)*np.quantile(abs(sel[:,2]),.7);root[1]=np.quantile(sel[:,1],.25 if fid>2 else .45)
   elif fid<7:root[1]=np.quantile(sel[:,1],.75 if fid==5 else .25)
  fins.append({'id':fid,'name':kinds[fid],'kind':kinds[fid],'root':root.tolist(),'axis':[0,1,0] if fid in (1,2,7) else [1,0,0],'sourceNodes':nodes,'measurement':'source named rig and weighted surface' if nodes else 'source cross-sectional thin-surface measurement; engineering derived rig'})
 # Cubic axial center/radius charts fitted to every material address, exact residual retained.
 xs=np.linspace(-.48,.48,25);rows=[]
 for x in xs:
  q=allp[abs(allp[:,0]-x)<.035]
  if len(q)>4:rows.append([x,np.median(q[:,1]),np.median(q[:,2]),max(np.quantile(abs(q[:,1]-np.median(q[:,1])),.7),.002),max(np.quantile(abs(q[:,2]-np.median(q[:,2])),.7),.002)])
 rows=np.array(rows);coef=np.array([np.polynomial.polynomial.polyfit(rows[:,0],rows[:,i],3) for i in range(1,5)])
 def base_eval(p):
  f=np.array([np.polynomial.polynomial.polyval(p[:,0],c) for c in coef]).T;theta=np.arctan2(p[:,1]-f[:,0],p[:,2]-f[:,1]);b=np.c_[p[:,0],f[:,0]+np.maximum(abs(f[:,2]),.001)*np.sin(theta),f[:,1]+np.maximum(abs(f[:,3]),.001)*np.cos(theta)];return b,np.c_[p[:,0]+.5,theta]
 herringBindings=herring_fin_charts(ps,fins) if id=='herring' else None
 for p in ps:
  ar=p['p'];fids=np.zeros(len(ar),int);weights=np.zeros(len(ar));sk=s.g['skins'][p['skin']] if p['skin'] is not None else None
  if sk is not None:
   nd=np.array(sk['joints'])[p['joint']]
   for f in fins:
    w=np.sum(p['weight']*np.isin(nd,f['sourceNodes']),axis=1);replace=w>weights;weights[replace]=w[replace];fids[replace]=f['id']
  if id=='colorful' and p['mesh'] in [0,1,2,3]:fids[:]={0:4,1:2,2:3,3:1}[p['mesh']];weights[:]=1
  if id=='picasso':
   # Source side-body establishes each cross section's thickness and height; thin outward sheets are fins.
   for k,v in enumerate(ar):
    x,y,z=v;q=allp[abs(allp[:,0]-x)<.035];wide=np.quantile(abs(q[:,2]),.8) if len(q) else .03;core=q[abs(q[:,2])>wide*.5];bottom,top=np.quantile(core[:,1],[.08,.92]) if len(core)>5 else [-.06,.06]
    if x>.30 and abs(z)<max(.016,wide*.8):fids[k]=7;weights[k]=smooth((x-.30)/.08)
    elif abs(z)<max(.012,wide*.38) and y>top+.004 and x>-.25:fids[k]=5;weights[k]=smooth((y-top-.004)/.03)
    elif abs(z)<max(.012,wide*.38) and y<bottom-.004 and x>-.2:fids[k]=6;weights[k]=smooth((bottom-y-.004)/.03)
    elif -.30<x<.08 and abs(z)>wide*1.25:fids[k]=1 if z>0 else 2;weights[k]=smooth((abs(z)-wide*1.15)/.025)
  if id=='herring' and p['mesh']==0:fids,weights=herringBindings
  # Root distance keeps independently driven fins off body skin, with a smooth nonnegative band.
  for f in fins:
   mask=fids==f['id'];root=np.array(f['root']);direction=np.array([0,0,1 if f['id']%2 else -1]) if f['id']<5 else np.array([0,1 if f['id']==5 else -1,0]) if f['id']<7 else np.array([1,0,0]);distance=(ar-root)@direction
   if id not in ('herring','picasso'):weights[mask]*=smooth(distance[mask]/.035)
  p['finId']=fids;p['finWeight']=weights
 # Shared source addresses receive identical derived motion bindings. Geometry itself is untouched.
 groups={}
 for pi,p in enumerate(ps):
  for k,v in enumerate(p['p']):groups.setdefault(tuple(np.round(v,7)),[]).append((pi,k))
 seamGroups=0
 for members in groups.values():
  if len(members)<2:continue
  seamGroups+=1;ids={ps[a]['finId'][b] for a,b in members};fid=next(iter(ids)) if len(ids)==1 else 0;w=min(ps[a]['finWeight'][b] for a,b in members) if fid else 0
  for a,b in members:ps[a]['finId'][b]=fid;ps[a]['finWeight'][b]=w
 textures=texture_payload(s);eyes=[]
 eyeMeshes={'herring':[1],'tuna-yellow-label':[1],'tuna-blue-label':[0],'colorful':[4,5],'picasso':[]}[id]
 ocularPoints=np.concatenate([p['p'] for p in ps if p['mesh'] in eyeMeshes]) if eyeMeshes else np.empty((0,3));ocularLabels=None
 if len(ocularPoints):
  centers=np.array([ocularPoints[np.argmin(ocularPoints[:,2])],ocularPoints[np.argmax(ocularPoints[:,2])]])
  for iteration in range(12):
   ocularLabels=np.argmin(np.linalg.norm(ocularPoints[:,None]-centers[None],axis=2),axis=1);centers=np.array([ocularPoints[ocularLabels==k].mean(0) for k in range(2)])
 for side in (-1,1):
  eye=ocularPoints[ocularLabels==(0 if side<0 else 1)] if eyeMeshes else np.empty((0,3))
  if len(eye):
   ec=(eye.min(0)+eye.max(0))/2;radius=float(np.max(np.ptp(eye,axis=0))/2);evidence='exact original eye/cornea mesh extent';state='SOURCE_OCULAR_MESH'
  else:
   # Select source head-side dark pigment samples, not a generic eye location.
   from PIL import Image
   p=ps[0];image=Image.open(io.BytesIO(base64.b64decode(textures[p['material']]['uri'].split(',')[1]))).convert('RGB');a=np.array(image);uv=p['uv'];rgb=a[np.clip((uv[:,1]*a.shape[0]).astype(int),0,a.shape[0]-1),np.clip((uv[:,0]*a.shape[1]).astype(int),0,a.shape[1]-1)].astype(float);v=p['p'];mask=(v[:,0]<-.10)&(v[:,0]>-.38)&(v[:,1]>0)&(v[:,2]*side>.035);cand=np.where(mask)[0]
   if len(cand):
    dark=cand[np.argsort(rgb[cand].mean(1))[:max(8,len(cand)//12)]];ec=np.median(v[dark],axis=0);nearest=dark[np.argmin(np.linalg.norm(v[dark]-ec,axis=1))];ec=v[nearest];radius=.016;evidence='original head-side UV pigment samples, dark-patch median nearest exact source vertex';state='SOURCE_TEXTURE_PATCH_MEASUREMENT'
   else:raise RuntimeError('No measurable source eye region '+id)
  eyeRow={'side':side,'center':ec.tolist(),'normal':[0,0,side],'radius':radius,'sourceEvidence':evidence,'state':state,'sourceMeshIds':eyeMeshes,'gazeYawLimit':.047,'gazePitchLimit':.023}
  if len(eye):eyeRow.update(fit_source_eye(eye,side))
  if id=='picasso':
   if s.row['sourceId']!='b0c77ae46a5368750d9ffdf924b144ade925fb439a93244bb4931d85803e579f':raise RuntimeError('Picasso measured source-eye address recipe does not match current original source')
   plus={'center':[-.3547531622,.1008931012,.0515058339],'normal':[-.3039538555,.1695381461,.9374800642],'sourceUV':[.0496560228,.1490525608]};minus={'center':[-.3483108360,.1009124852,-.0511026624],'normal':[-.3162896629,.1424912848,-.9379003587],'sourceUV':[.6358500772,.2724361186]}
   eyeRow.update(plus if side>0 else minus);normal=np.array(eyeRow['normal']);x=np.cross([0.,1.,0.],normal);x/=np.linalg.norm(x);y=np.cross(normal,x);eyeRow.update({'radius':.020,'localRadii':[.020,.020,.009],'sourceFrame':{'x':x.tolist(),'y':y.tolist(),'normal':normal.tolist()},'state':'VISUALLY_SOURCE_MAPPED_OCULAR_PATCH','sourceEvidence':'Actual source visible black eye patches and original triangle ray-hit point, interpolated original normal/UV; neutral source, both lateral camera views. Reproducible scripts/measure-eye.mjs. Prior dark-body-pigment median rejected.','radiusEvidence':'12 pixel observed patch radius / approx590pixel original body projected length; .020L tangent and .009L depth new-eye engineering adaptation, not source globe anatomy','recommendedEmbedAlongNormal':-.007})
  eyes.append(eyeRow)
 primitives=[];maxerr=0;floaterr=0
 for p in ps:
  b,address=base_eval(p['p']);res=p['p']-b;maxerr=max(maxerr,float(np.max(abs(b+res-p['p']))));floaterr=max(floaterr,float(np.max(abs((b.astype('f4')+res.astype('f4')).astype(float)-p['p']))))
  primitives.append({'positions':p['p'].ravel().tolist(),'base':b.ravel().tolist(),'residual':res.ravel().tolist(),'paramAddress':address.ravel().tolist(),'normals':p['n'].ravel().tolist(),'uvs':p['uv'].ravel().tolist(),'indices':p['ix'].tolist(),'material':p['material'],'finId':p['finId'].tolist(),'finWeight':p['finWeight'].tolist(),'sourceMesh':p['mesh'],'sourceNode':p['node'],'name':p['name'],'ocular':p['mesh'] in eyeMeshes})
 sourceSpine=[j for j in jrows if (id=='herring' and j['node'] in range(28,34)) or (id=='colorful' and j['node'] in range(11,18)) or (id.startswith('tuna') and re.search('spine|head',j['name'],re.I))]
 proceduralSpine=[{'name':'continuous-section-'+str(k),'u':float(x+.5),'position':[float(x),float(np.polynomial.polynomial.polyval(x,coef[0])),float(np.polynomial.polynomial.polyval(x,coef[1]))],'parent':k-1 if k else None,'derivedFrom':'measured cubic source axial chart'} for k,x in enumerate(np.linspace(-.42,.40,17))]
 score={'schema':'FISH_SOURCE_CHART_RESIDUAL_1','id':id,'label':s.row['label'],'primitives':primitives,'materials':s.g['materials'],'textures':textures,'rig':{'spine':sourceSpine,'proceduralSpine':proceduralSpine,'sourceJoints':jrows,'fins':fins},'eyes':eyes,'canonical':{'rotationRows':rot.tolist(),'centerProjected':center.tolist(),'sourceLength':float(L),'bodyLength':1,'axis':'X head -0.5 to tail +0.5; Y dorsal; Z lateral','physicalMetres':'UNCONFIRMED'},'parameterization':{'kind':'CUBIC_AXIAL_RADIAL_CHART_PLUS_FULL_SOURCE_RESIDUAL','coefficients':coef.tolist(),'addressOrder':'u=x+0.5, theta=atan2(y-centerY,z-centerZ)','allOriginalAddressesRetained':True,'residualMeaning':'Exact source detail field, never a primitive fish substitute','maxReconstructionError':maxerr,'maxFloat32ReconstructionError':floaterr},'source':{'sourceId':s.row['sourceId'],'containerSha256':s.row['containerSha256'],'entrySha256':s.row['sourceEntrySha256'],'asset':s.row['asset'],'licenseText':s.row['licenseText'],'title':s.row['asset'].get('extras',{}).get('title'),'identity':'SOURCE LABEL; bluefin/yellowfin biological identities unconfirmed','clips':s.row['animationClips'],'selectedMeshes':[p['mesh'] for p in ps],'removedSceneGeometry':{'herring':'Other five fish and 25-vertex external ground plane','colorful':'Separate322-vertex enclosing scene sphere'}.get(id,'none')}}
 meta={'id':id,'label':s.row['label'],'vertices':sum(len(p['p']) for p in ps),'triangles':sum(len(p['ix'])//3 for p in ps),'source':score['source'],'canonical':score['canonical'],'parameterization':score['parameterization'],'eyes':eyes,'fins':fins,'bindingVertexCounts':{str(i):sum(int(np.sum((p['finId']==i)&(p['finWeight']>0))) for p in ps) for i in range(8)},'samePositionGroups':seamGroups,'allPositionsNormalsFinite':all(np.isfinite(p['p']).all() and np.isfinite(p['n']).all() for p in ps),'sourceIndicesAndUvRetained':True,'noOriginalWrites':True,'productionReady':False}
 score['gaitReference']=gait_reference(s,sourceSpine);meta['gaitReference']=score['gaitReference']
 return score,meta
def main(only=None):
 (ROOT/'data').mkdir(exist_ok=True);(ROOT/'evidence').mkdir(exist_ok=True);items=[];reports=[]
 if only:
  items=[i for i in json.loads((ROOT/'data/scores.json').read_text(encoding='utf8'))['items'] if i['id'] not in only]
  reports=[i for i in json.loads((ROOT/'evidence/SOURCE_REBUILD_REPORT.json').read_text(encoding='utf8'))['fiveScores'] if i['id'] not in only]
 for id,s in selected():
  if only and id not in only:continue
  score,meta=compile_score(id,s);meta['bindingR02']=refine_fin_bindings_r02(score);meta['bindingVertexCounts']={str(i):sum(int(np.sum((np.array(p['finId'])==i)&(np.array(p['finWeight'])>0))) for p in score['primitives']) for i in range(8)}
  raw=json.dumps(score,ensure_ascii=False,separators=(',',':')).encode();gz=gzip.compress(raw,9,mtime=0);file=id+'.score.json.gz';(ROOT/'data'/file).write_bytes(gz);(ROOT/'data'/(id+'.metadata.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8');items.append({'id':id,'label':meta['label'],'file':file,'metadataFile':id+'.metadata.json','vertices':meta['vertices'],'triangles':meta['triangles'],'bytes':len(gz),'sha256':sha(gz)});reports.append(meta);print(id,meta['vertices'],meta['triangles'],len(gz),meta['bindingVertexCounts'],flush=True)
 order=['herring','tuna-yellow-label','tuna-blue-label','colorful','picasso'];items.sort(key=lambda i:order.index(i['id']));reports.sort(key=lambda i:order.index(i['id']))
 (ROOT/'data/scores.json').write_text(json.dumps({'schema':'FISH_FIVE_SOURCE_SCORES_1','items':items},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (ROOT/'evidence/SOURCE_REBUILD_REPORT.json').write_text(json.dumps({'checkedAt':datetime.now(timezone.utc).isoformat(),'stage':'SOURCE_PARAMETRIC_COMPILATION','fiveScores':reports,'pass':all(r['allPositionsNormalsFinite'] and r['parameterization']['maxFloat32ReconstructionError']<2e-7 for r in reports),'sourceSkinRest':'worldJoint * inverseBind * originalVertex; normals inverse transpose of blended linear transform','noOriginalWrites':True,'sourceTexturePixelsRetainedLosslessly':True,'sourceTextureByteHashesRetained':True,'noPrimitiveSubstitution':True,'anatomicalRigBindingsRequireVisualReview':True,'productionReady':False},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def revise_eyes_only():
 manifest=json.loads((ROOT/'data/scores.json').read_text(encoding='utf8'));report=json.loads((ROOT/'evidence/SOURCE_REBUILD_REPORT.json').read_text(encoding='utf8'))
 for item in manifest['items']:
  file=ROOT/'data'/item['file'];score=json.loads(gzip.decompress(file.read_bytes()));ps=score['primitives'];ocular=np.concatenate([np.array(p['positions']).reshape(-1,3) for p in ps if p['ocular']]) if item['id']!='picasso' else np.empty((0,3))
  if len(ocular):
   centers=np.array([ocular[np.argmin(ocular[:,2])],ocular[np.argmax(ocular[:,2])]])
   for iteration in range(12):labels=np.argmin(np.linalg.norm(ocular[:,None]-centers[None],axis=2),axis=1);centers=np.array([ocular[labels==k].mean(0) for k in range(2)])
   for eye in score['eyes']:eye.update(fit_source_eye(ocular[labels==(0 if eye['side']<0 else 1)],eye['side']))
  else:
   for eye in score['eyes']:
    normal=np.array(eye['normal']);x=np.cross([0.,1.,0.],normal);x/=np.linalg.norm(x);y=np.cross(normal,x);eye.update({'localRadii':[.020,.020,.009],'sourceFrame':{'x':x.tolist(),'y':y.tolist(),'normal':normal.tolist()},'recommendedEmbedAlongNormal':-.007,'radiusEvidence':'12 pixel observed patch radius / approx590pixel original body projected length; .020L tangent and .009L depth new-eye engineering adaptation, not source globe anatomy'})
  gz=gzip.compress(json.dumps(score,ensure_ascii=False,separators=(',',':')).encode(),9,mtime=0);file.write_bytes(gz);item['sha256']=sha(gz);item['bytes']=len(gz)
  metaPath=ROOT/'data'/item['metadataFile'];meta=json.loads(metaPath.read_text(encoding='utf8'));meta['eyes']=score['eyes'];metaPath.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  for row in report['fiveScores']:
   if row['id']==item['id']:row['eyes']=score['eyes']
  print(item['id'],[(eye['localRadii'],eye['center']) for eye in score['eyes']],flush=True)
 report['sourceOcularShapeRevised']='Exact source ocular cluster local bounds; tangent radius never substituted for ocular depth. Picasso source UV patch engineering eyes kept .009L thickness.';report['checkedAt']=datetime.now(timezone.utc).isoformat();(ROOT/'data/scores.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8');(ROOT/'evidence/SOURCE_REBUILD_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def fin_topology(score):
 positions=np.concatenate([np.array(p['positions']).reshape(-1,3) for p in score['primitives']]);labels=np.concatenate([np.array(p['finId'],int) for p in score['primitives']]);weights=np.concatenate([np.array(p['finWeight'],float) for p in score['primitives']]);offset=0;triangles=[]
 for p in score['primitives']:triangles.extend((np.array(p['indices'],int).reshape(-1,3)+offset).tolist());offset+=len(p['positions'])//3
 triangles=np.array(triangles,int);_,first,inverse=np.unique(np.round(positions,7),axis=0,return_index=True,return_inverse=True);points=positions[first];fid=labels[first];w=weights[first];tri=inverse[triangles];edges=np.unique(np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1),axis=0);edges=edges[edges[:,0]!=edges[:,1]];length=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1);adj=[[] for _ in points]
 for (a,b),d in zip(edges,length):adj[a].append((int(b),float(d)));adj[b].append((int(a),float(d)))
 return positions,triangles,points,fid,w,tri,edges,length,adj,inverse
def refine_fin_bindings_r02(score):
 pos,triRaw,p,fid,w,tri,edges,length,adj,inv=fin_topology(score);old=w.copy();different=np.any(fid[tri]!=fid[tri[:,0]][:,None],axis=1);boundary=np.zeros(len(p),bool);boundary[np.unique(tri[different])]=True
 # Every cross-class original triangle is entirely body-fixed for fin motion. Exact source topology is not edited.
 w[boundary]=0.;zeroSeeds=boundary|(w<=.02)
 rootDetails=[]
 for f in score['rig']['fins']:
  id=f['id'];members=np.where(fid==id)[0]
  if not len(members):continue
  sources=members[zeroSeeds[members]]
  if not len(sources):
   root=np.array(f['root']);dist=np.linalg.norm(p[members]-root,axis=1);sources=members[dist<=np.quantile(dist,.12)];w[sources]=0
  # Smooth geodesic hinge band anchored in measured triangle boundaries, independent of UV islands.
  dist=np.full(len(p),np.inf);dist[sources]=0.;heap=[(0.,int(k)) for k in sources];heapq.heapify(heap)
  while heap:
   d,k=heapq.heappop(heap)
   if d!=dist[k]:continue
   for j,L in adj[k]:
    if fid[j]!=id:continue
    nd=d+L
    if nd<dist[j]:dist[j]=nd;heapq.heappush(heap,(nd,j))
  band=.045 if id<5 else .060 if id<7 else .065;target=np.minimum(w[members],smooth(dist[members]/band));target[~np.isfinite(dist[members])]=0.;w[members]=target
  # Lipschitz envelope: limiter only reduces weights, so no new body skin is recruited into a fin.
  gain=3.0 if score['id']=='picasso' else 6.0 if score['id']=='colorful' else 12.0;heap=[(float(w[k]),int(k)) for k in members];heapq.heapify(heap)
  while heap:
   value,k=heapq.heappop(heap)
   if value!=w[k]:continue
   for j,L in adj[k]:
    if fid[j]!=id:continue
    nv=value+gain*L
    if nv<w[j]:w[j]=nv;heapq.heappush(heap,(nv,j))
  roots=p[sources];previousRoot=list(f['root'])
  if score['id']=='picasso':
   # Static source has no anatomical joint. Replace the former generic X pivot with an actual zero-hinge source address.
   c=np.median(roots,axis=0);f['root']=roots[np.argmin(np.linalg.norm(roots-c,axis=1))].tolist()
  active=members[w[members]>1e-8]
  if len(active):f['tip']=p[active[np.argmax(np.linalg.norm(p[active]-np.array(f['root']),axis=1))]].tolist()
  f['bindingR02']={'kind':'TOPOLOGY_ZERO_HINGE_PLUS_GEODESIC_C2_FIELD','zeroHingeSourceAddresses':len(sources),'transitionBodyLengths':band,'maxEdgeWeightGradientPerBodyLength':gain,'previousRoot':previousRoot,'rootMeaning':'Static source exact zero-hinge vertex, engineering-derived joint' if score['id']=='picasso' else 'Source rig/chart measured root retained; topology-root support constrained separately','axisMeaning':'Existing source-derived fin orientation retained; static axis is an engineering hinge candidate, no native rig or biological measurement claimed','bodySkinRecruitment':False};rootDetails.append({'id':id,**f['bindingR02'],'activeAddresses':int(np.sum(w[members]>1e-8))})
 # Edge slope alone misses skinny source triangles. Constrain the actual barycentric surface-field gradient too.
 gradient=np.zeros((len(p),3));areaSum=np.zeros(len(p));triP=p[tri];e1=triP[:,1]-triP[:,0];e2=triP[:,2]-triP[:,0];cross=np.cross(e1,e2);a2=np.linalg.norm(cross,axis=1);g11=np.einsum('ij,ij->i',e1,e1);g12=np.einsum('ij,ij->i',e1,e2);g22=np.einsum('ij,ij->i',e2,e2);den=g11*g22-g12*g12;valid=den>1e-20
 def triangle_gradient():
  d1=w[tri[:,1]]-w[tri[:,0]];d2=w[tri[:,2]]-w[tri[:,0]];c1=np.zeros(len(tri));c2=c1.copy();c1[valid]=(d1[valid]*g22[valid]-d2[valid]*g12[valid])/den[valid];c2[valid]=(d2[valid]*g11[valid]-d1[valid]*g12[valid])/den[valid];result=e1*c1[:,None]+e2*c2[:,None];result[different]=0;return result
 cap=3. if score['id']=='picasso' else 6. if score['id']=='colorful' else 4.
 for iteration in range(120):
  tg=triangle_gradient();norm=np.linalg.norm(tg,axis=1);bad=(norm>cap*(1+1e-6))&valid
  if not np.any(bad):break
  q=w[tri[bad]];minimum=q.min(1);factor=np.minimum(1,cap/norm[bad]);target=minimum[:,None]+(q-minimum[:,None])*factor[:,None];np.minimum.at(w,tri[bad].ravel(),target.ravel())
 # Finish with a uniform per-fin scale only for any remaining constrained skinny-face gradients.
 tg=triangle_gradient();norm=np.linalg.norm(tg,axis=1)
 for f in score['rig']['fins']:
  if 'bindingR02' not in f:continue
  mask=(fid[tri[:,0]]==f['id'])&~different;maximum=float(norm[mask].max()) if np.any(mask) else 0.;factor=min(1.,cap/max(maximum,1e-12));w[fid==f['id']]*=factor;f['bindingR02']['triangleGradientFinalScale']=factor;f['bindingR02']['triangleSurfaceGradientCap']=cap
 tg=triangle_gradient()
 for k in range(3):np.add.at(gradient,tri[:,k],tg*a2[:,None]);np.add.at(areaSum,tri[:,k],a2)
 gradient/=np.maximum(areaSum[:,None],1e-20);gradient[boundary]=0;offset=0
 for primitive in score['primitives']:
  n=len(primitive['positions'])//3;indices=inv[offset:offset+n];primitive['finWeight']=w[indices].tolist();primitive['finGradient']=gradient[indices].ravel().tolist();offset+=n
 rootDetails=[]
 for f in score['rig']['fins']:
  if 'bindingR02' in f:rootDetails.append({'id':f['id'],**f['bindingR02'],'finalActiveAddresses':int(np.sum((fid==f['id'])&(w>1e-8)))})
 return {'crossClassTriangles':int(different.sum()),'crossClassActiveTrianglesAfter':int(np.sum(different&np.any(w[tri]>0,axis=1))),'weightsOnlyReduced':bool((w<=old+1e-12).all()),'rootDetails':rootDetails,'sourceTriangleGradientMax':float(np.linalg.norm(tg,axis=1).max()),'vertexGradientMax':float(np.linalg.norm(gradient,axis=1).max()),'finGradientFinite':bool(np.isfinite(gradient).all())}
if __name__=='__main__':
 import sys
 if '--inspect' in sys.argv:
  for id,s in selected():s.dump()
 if '--bounds' in sys.argv:
  for id,s in selected():
   print(id,[(p['mesh'],np.round(p['p'].min(0),5).tolist(),np.round(p['p'].max(0),5).tolist()) for p in source_primitives(s,id)])
 if len(sys.argv)==1:main()
 if '--only' in sys.argv:main(set(sys.argv[sys.argv.index('--only')+1].split(',')))
 if '--eyes-only' in sys.argv:revise_eyes_only()
