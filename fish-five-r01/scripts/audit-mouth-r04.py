"""Read-only original oral rig audit. Writes only R04 sidecar, never source scores/archives."""
import pathlib, importlib.util, json, gzip, hashlib, re, struct, zlib, zipfile, heapq
from collections import Counter, defaultdict
from datetime import datetime, timezone
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('source_reader',ROOT/'scripts/prepare-sources.py')
prep=importlib.util.module_from_spec(spec);spec.loader.exec_module(prep)
sha=lambda b:hashlib.sha256(b).hexdigest()
def bounds(v):return {'min':v.min(0).tolist(),'max':v.max(0).tolist()} if len(v) else None
def unit(v):return v/max(np.linalg.norm(v),1e-15)
def qmul(a,b):return np.r_[a[3]*b[:3]+b[3]*a[:3]+np.cross(a[:3],b[:3]),a[3]*b[3]-np.dot(a[:3],b[:3])]
def logs(q,rest):
 out=[]
 for x in q:
  d=qmul(unit(x),np.r_[-unit(rest)[:3],unit(rest)[3]])
  if d[3]<0:d=-d
  mag=np.linalg.norm(d[:3]);out.append(d[:3]*(2*np.arctan2(mag,d[3])/mag) if mag>1e-12 else np.zeros(3))
 return np.array(out)

def topology(ps):
 v=np.concatenate([p['p'] for p in ps]); offsets=np.cumsum([0]+[len(p['p']) for p in ps])
 _,first,alias=np.unique(np.round(v,7),axis=0,return_index=True,return_inverse=True);uv=v[first]
 tri=np.concatenate([alias[p['ix'].reshape(-1,3)+offsets[i]] for i,p in enumerate(ps)])
 edges=np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1)
 edges=edges[edges[:,0]!=edges[:,1]];unique,count=np.unique(edges,axis=0,return_counts=True);boundary=unique[count==1]
 adj=defaultdict(set)
 for a,b in boundary:adj[int(a)].add(int(b));adj[int(b)].add(int(a))
 seen=set();rows=[]
 for a in adj:
  if a in seen:continue
  todo=[a];seen.add(a);comp=[]
  while todo:
   x=todo.pop();comp.append(x)
   for y in adj[x]:
    if y not in seen:seen.add(y);todo.append(y)
  pts=uv[comp]
  if pts[:,0].min()<-.30:
   rows.append({'vertices':len(comp),'edges':sum(len(adj[x]) for x in comp)//2,'closedSimpleLoop':all(len(adj[x])==2 for x in comp),'bounds':bounds(pts),'centroid':pts.mean(0).tolist(),'classification':'UNCLASSIFIED_HEAD_BOUNDARY; can be eye/UV/geometric seam, not proof of a mouth cavity'})
 return {'weldToleranceBodyLengths':1e-7,'uniqueSourcePositions':len(uv),'boundaryEdges':len(boundary),'nonManifoldEdges':int(np.sum(count>2)),'headBoundaryComponents':rows,'closedMouthCavityProof':'UNKNOWN; boundary topology alone cannot establish anatomical identity'},alias,offsets

def channel_audit(s,ni,parentFrame):
 clips=[]
 for a in s.g.get('animations',[]):
  rows=[]
  for c in a['channels']:
   if c['target'].get('node')!=ni:continue
   sm=a['samplers'][c['sampler']];t=s.acc(sm['input']).ravel().astype(float);v=s.acc(sm['output']).astype(float)
   row={'path':c['target']['path'],'interpolation':sm.get('interpolation','LINEAR'),'times':t.tolist(),'values':v.tolist(),'componentRange':np.ptp(v,axis=0).tolist()}
   if row['path']=='rotation':
    lg=logs(v,np.array(s.nodes[ni].get('rotation',[0,0,0,1])));canon=lg@parentFrame.T
    row.update({'rotationLogDeltaCanonical':canon.tolist(),'maxAngleFromBindRad':float(np.max(np.linalg.norm(lg,axis=1))),'maxAngleFromFirstRad':float(np.max(np.linalg.norm(logs(v,v[0]),axis=1)))})
   rows.append(row)
  if rows:clips.append({'name':a.get('name'),'channels':rows})
 return clips

def skin_weights(s,p,nodes):
 if p['skin'] is None:return np.zeros(len(p['p']))
 originalNodes=np.array(s.g['skins'][p['skin']]['joints'])[p['joint']]
 return np.sum(p['weight']*np.isin(originalNodes,nodes),axis=1)
def descendants(s,ni):
 result=[ni]
 for k in result:result.extend(s.nodes[k].get('children',[]))
 return result

def triangle_weight_gradient(ps,weights,alias,offsets):
 points=np.concatenate([p['p'] for p in ps]);weight=np.concatenate(weights)
 _,first=np.unique(alias,return_index=True);v=points[first];w=weight[first];grad=np.zeros((len(first),3));areas=np.zeros(len(first))
 for k,p in enumerate(ps):
  for tri in alias[p['ix'].reshape(-1,3)+offsets[k]]:
   vv=v[tri];edge=np.array([vv[1]-vv[0],vv[2]-vv[0]]);area=np.linalg.norm(np.cross(*edge))
   if area<1e-13:continue
   g=np.linalg.lstsq(edge,w[tri[1:]]-w[tri[0]],rcond=None)[0]
   for i in tri:grad[i]+=area*g;areas[i]+=area
 grad/=np.maximum(areas[:,None],1e-15);mapped=grad[alias]
 return [mapped[offsets[i]:offsets[i+1]] for i in range(len(ps))]

def constrained_source_field(ps,sourceWeights,alias,offsets,gain=6.):
 """Keep source-supported region only; original source weights retained separately."""
 points=np.concatenate([p['p'] for p in ps]);weight=np.concatenate(sourceWeights).copy()
 _,first=np.unique(alias,return_index=True);groupPoints=points[first];gw=np.array([weight[np.where(alias==k)[0]].min() for k in range(len(first))])
 triangles=np.concatenate([alias[p['ix'].reshape(-1,3)+offsets[i]] for i,p in enumerate(ps)])
 mixed=np.any(gw[triangles]>0,axis=1)&np.any(gw[triangles]==0,axis=1)
 vt=groupPoints[triangles];e1=vt[:,1]-vt[:,0];e2=vt[:,2]-vt[:,0];area=np.linalg.norm(np.cross(e1,e2),axis=1);scale=np.sum(e1*e1+e2*e2,axis=1)
 thin=area/np.maximum(scale,1e-20)<1e-5;zero=np.unique(triangles[mixed|thin].ravel());gw[zero]=0
 adj=[{} for _ in first]
 for a,b,c in triangles:
  for i,j in [(a,b),(b,c),(c,a)]:
   if i!=j:adj[i][j]=adj[j][i]=float(np.linalg.norm(groupPoints[i]-groupPoints[j]))
 heap=[(float(v),i) for i,v in enumerate(gw)];heapq.heapify(heap)
 while heap:
  value,i=heapq.heappop(heap)
  if value>gw[i]+1e-13:continue
  for j,length in adj[i].items():
   cap=value+gain*length
   if cap<gw[j]-1e-13:gw[j]=cap;heapq.heappush(heap,(cap,j))
 result=gw[alias];gradient=np.zeros((len(gw),3));areas=np.zeros(len(gw))
 for tri in triangles:
  v=groupPoints[tri];edge=np.array([v[1]-v[0],v[2]-v[0]]);area=np.linalg.norm(np.cross(*edge));
  if area<1e-13:continue
  grad=np.linalg.lstsq(edge,gw[tri[1:]]-gw[tri[0]],rcond=None)[0]
  for i in tri:gradient[i]+=area*grad;areas[i]+=area
 gradient/=np.maximum(areas[:,None],1e-15)
 return [result[offsets[i]:offsets[i+1]] for i in range(len(ps))],[gradient[alias[offsets[i]:offsets[i+1]]] for i in range(len(ps))],{'method':'Engineering derived native-support-only zero-cross-triangle hinge and source-edge Lipschitz cap; source skinny triangles held zero; no body recruitment','zeroHingeUniquePositions':len(zero),'sourceSkinnyTrianglesHeld':int(np.sum(thin)),'sourceSkinnyRelativeAreaThreshold':1e-5,'maxWeight':float(gw.max()),'positiveAddresses':int(np.sum(result>1e-8)),'edgeGradientCapPerBL':gain,'sourceNativeWeightsUnchanged':True}

def test_rotation(ps,weights,pivot,axis,angles):
 result=[]
 for angle in angles:
  c=np.cos(angle);sn=np.sin(angle);deformed=[];maxStrain=0;maxMove=0;maxArea=0;minArea=1e10
  for p,w in zip(ps,weights):
   old=p['p'];r=old-pivot;rot=r*c+np.cross(axis,r)*sn+np.outer(r@axis,axis)*(1-c)+pivot
   now=old+w[:,None]*(rot-old);deformed.append(now);maxMove=max(maxMove,float(np.max(np.linalg.norm(now-old,axis=1))))
   tri=p['ix'].reshape(-1,3);a=old[tri];b=now[tri]
   for i,j in [(0,1),(1,2),(2,0)]:
    l=np.linalg.norm(a[:,i]-a[:,j],axis=1);nl=np.linalg.norm(b[:,i]-b[:,j],axis=1);ok=l>1e-8
    maxStrain=max(maxStrain,float(np.max(np.maximum(nl[ok]/l[ok],l[ok]/np.maximum(nl[ok],1e-12)))))
   ar=np.linalg.norm(np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]),axis=1);nr=np.linalg.norm(np.cross(b[:,1]-b[:,0],b[:,2]-b[:,0]),axis=1);ok=ar>1e-12
   if np.any(ok):maxArea=max(maxArea,float(np.max(nr[ok]/ar[ok])));minArea=min(minArea,float(np.min(nr[ok]/ar[ok])))
  result.append({'angleRad':angle,'maxVertexDisplacementBL':maxMove,'maxEdgeStretchOrCompressionRatio':maxStrain,'maxTriangleAreaRatio':maxArea,'minTriangleAreaRatio':minArea})
 return result

def original_fbx_audit():
 file=pathlib.Path('C:/Users/Administrator/Downloads/muskellunge+fish+3d+model.zip');raw=file.read_bytes()
 with zipfile.ZipFile(file) as z:entry=next(n for n in z.namelist() if n.lower().endswith('.fbx'));b=z.read(entry)
 version=struct.unpack_from('<I',b,23)[0];header='<QQQB' if version>=7500 else '<IIIB';headerSize=struct.calcsize(header);pos=27
 def prop(pos):
  typ=chr(b[pos]);pos+=1
  scal={'Y':'h','C':'?','I':'i','F':'f','D':'d','L':'q'}
  if typ in scal:fmt='<'+scal[typ];return struct.unpack_from(fmt,b,pos)[0],pos+struct.calcsize(fmt)
  if typ in ('S','R'):
   n=struct.unpack_from('<I',b,pos)[0];pos+=4;v=b[pos:pos+n];return v.decode('utf8','replace') if typ=='S' else {'bytes':n},pos+n
  if typ in ('f','d','l','i','b','c'):
   n,encoding,size=struct.unpack_from('<III',b,pos);pos+=12
   return {'arrayType':typ,'count':n,'encoding':encoding,'compressedBytes':size},pos+size
  raise ValueError('FBX property '+typ)
 def node(pos):
  end,n,propsSize,nameLen=struct.unpack_from(header,b,pos);pos+=headerSize
  if end==0:return None,pos
  name=b[pos:pos+nameLen].decode('utf8','replace');pos+=nameLen;props=[]
  for _ in range(n):v,pos=prop(pos);props.append(v)
  children=[]
  while pos<end-headerSize:
   child,nextpos=node(pos)
   if child is None:break
   children.append(child);pos=nextpos
  return {'name':name,'props':props,'children':children},end
 nodes=[]
 while pos<len(b)-headerSize:
  n,nextpos=node(pos)
  if n is None:break
  nodes.append(n);pos=nextpos
 objects=next(x for x in nodes if x['name']=='Objects')['children'];counts=Counter(x['name'] for x in objects)
 return {'container':str(file),'containerSha256':sha(raw),'fbxEntry':entry,'fbxSha256':sha(b),'fbxVersion':version,'objectCounts':dict(counts),'models':[x['props'] for x in objects if x['name']=='Model'],'nativeSkinOrShape':any(x['name']=='Deformer' for x in objects),'nativeAnimation':any(x['name'].startswith('Animation') for x in objects)}

def legacy_metadata():
 file=ROOT.parent/'local-r14/dist/KAOPU_FISH_DENSE_HABITAT_R14.html';raw=file.read_bytes();html=raw.decode('utf8');match=re.search(r'<script id="fishData"[^>]*data-bytes="(\d+)">([^<]+)</script>',html);encoded=match[2]
 alphabet=''.join(chr(i) for i in range(33,127) if chr(i) not in '<>&\'"`\\')[:85];lookup={c:i for i,c in enumerate(alphabet)}
 def prefix(size):
  result=bytearray()
  for i in range(0,((size+3)//4)*5,5):
   value=0
   for c in encoded[i:i+5]:value=value*85+lookup[c]
   result.extend(value.to_bytes(4,'big'))
  return result[:size]
 header=prefix(16);assert header[:8]==b'KFS13PK1';length=struct.unpack_from('<I',header,8)[0];meta=json.loads(prefix(16+length)[16:].decode('utf8'))
 return meta,{'sourceStandalone':'local-r14/dist/KAOPU_FISH_DENSE_HABITAT_R14.html','sourceHtmlSha256':sha(raw),'sourceCarrierTextSha256':sha(encoded.encode('ascii')),'metadataExtraction':'Actual immutable R14 KFS13PK1 carrier metadata decoded from retained source; no runtime/browser required','sourceScoreBytes':int(match[1])}

def run():
 manifest=json.loads((ROOT/'data/scores.json').read_text(encoding='utf8'));items=[];frozen={r['file']:sha((ROOT/'data'/r['file']).read_bytes()) for r in manifest['items']}
 for id,s in prep.selected():
  row=next(x for x in manifest['items'] if x['id']==id);sc=json.loads(gzip.decompress((ROOT/'data'/row['file']).read_bytes()));rot=np.array(sc['canonical']['rotationRows']);cen=np.array(sc['canonical']['centerProjected']);L=sc['canonical']['sourceLength'];can=lambda x:(np.asarray(x)@rot.T-cen)/L
  ps=prep.source_primitives(s,id)
  error=0
  for original,scorePrimitive in zip(ps,sc['primitives']):
   original['p']=can(original['p']);v=np.array(scorePrimitive['positions']).reshape(-1,3);error=max(error,float(np.max(np.abs(v-original['p']))));assert np.array_equal(original['ix'],scorePrimitive['indices'])
  top,alias,offsets=topology(ps)
  oralNodes=[18,21] if id=='tuna-yellow-label' else list(range(10,17)) if id=='tuna-blue-label' else [36] if id=='herring' else []
  nodes=[]
  for ni in oralNodes:
   pivot=can(s.world(ni)[:3,3]);parent=s.parents.get(ni);parentLinear=rot@(s.world(parent)[:3,:3] if parent is not None else np.eye(3));parentFrame=np.column_stack([unit(parentLinear[:,k]) for k in range(3)]);localLinear=rot@s.world(ni)[:3,:3];localFrame=np.column_stack([unit(localLinear[:,k]) for k in range(3)])
   clip=channel_audit(s,ni,parentFrame);dw=[skin_weights(s,p,[ni]) for p in ps];sw=[skin_weights(s,p,descendants(s,ni)) for p in ps];weights=np.concatenate(sw);allp=np.concatenate([p['p'] for p in ps]);members=allp[weights>1e-8];axis=localFrame[:,int(np.argmax(np.abs(localFrame[2,:])))];axis=unit(axis)
   if len(members) and np.cross(axis,members.mean(0)-pivot)[1]>0:axis=-axis
   spread=defaultdict(list)
   for k,w in zip(alias,weights):spread[int(k)].append(float(w))
   maxspread=max(max(x)-min(x) for x in spread.values())
   constrained,gradients,fieldReport=constrained_source_field(ps,sw,alias,offsets)
   directGradients=triangle_weight_gradient(ps,dw,alias,offsets);subtreeGradients=triangle_weight_gradient(ps,sw,alias,offsets)
   sparse=[]
   for i,(p,dw0,sw0) in enumerate(zip(ps,dw,sw)):
    selected=np.where((dw0>0)|(sw0>0)|(np.linalg.norm(subtreeGradients[i],axis=1)>0)|(np.linalg.norm(directGradients[i],axis=1)>0))[0];sparse.append({'primitive':i,'vertexCount':len(p['p']),'sourceMesh':p['mesh'],'sourceNode':p['node'],'indices':selected.tolist(),'directWeight':dw0[selected].tolist(),'subtreeWeight':sw0[selected].tolist(),'directGradient':directGradients[i][selected].ravel().tolist(),'subtreeGradient':subtreeGradients[i][selected].ravel().tolist(),'constrainedSubtreeWeight':constrained[i][selected].tolist(),'constrainedGradient':gradients[i][selected].ravel().tolist()})
   trials=[0.,.015,.03,.05,.075] if id.startswith('tuna') else [0.,.01,.02,.03]
   for a in clip:
    for c in a['channels']:
     if c['path']=='rotation':
      signed=np.array(c['rotationLogDeltaCanonical'])@axis;t=np.array(c['times']);c.update({'signedAngleCanonical':signed.tolist(),'signedMinRad':float(signed.min()),'signedMaxRad':float(signed.max()),'signedPeakToPeakRad':float(np.ptp(signed)),'timeOfSignedMin':float(t[signed.argmin()]),'timeOfSignedMax':float(t[signed.argmax()]),'clipDurationSeconds':float(t[-1]-t[0]),'timingMeaning':'Original authored clip; not biological respiration frequency calibration'})
   nodes.append({'node':ni,'name':s.nodes[ni].get('name'),'parentNode':parent,'pivotCanonical':pivot.tolist(),'parentFrameCanonicalColumns':parentFrame.T.tolist(),'jointFrameCanonicalColumns':localFrame.T.tolist(),'nativeRestQuaternion':s.nodes[ni].get('rotation',[0,0,0,1]),'localSourceAxisCandidateIndex':int(np.argmax(np.abs(localFrame[2,:]))),'axisCanonical':axis.tolist(),'openingAxisCanonical':axis.tolist(),'axisEvidence':'Source joint rest local basis nearest lateral axis; sign chosen to lower weighted head support, engineering motion candidate','directPositiveVertices':int(np.sum(np.concatenate(dw)>0)),'subtreePositiveVertices':int(np.sum(weights>0)),'weightedSourceBounds':bounds(members),'maxSamePositionSubtreeWeightSpread':maxspread,'sparseBindings':sparse,'nativeClips':clip,'engineeringLbsRotationTrials':test_rotation(ps,sw,pivot,axis,trials),'constrainedField':fieldReport,'constrainedLbsRotationTrials':test_rotation(ps,constrained,pivot,axis,trials),'activation':'Measured lower-head bone only; anatomical lip separation not established, HOLD_LOCAL until source mouth visual proof' if id=='herring' else 'Lower jaw subtree candidate; upper/lip nodes are source measurement only, do not double apply parent transforms'})
  supported=id in ('tuna-yellow-label','tuna-blue-label')
  status='NATIVE_JAW_SKIN_AND_ANIMATION' if id=='tuna-yellow-label' else 'NATIVE_JAW_LIP_SKIN_STATIC_CLIPS' if id=='tuna-blue-label' else 'HOLD_LOCAL_MEASURED_LOWER_HEAD_BONE_CANDIDATE' if id=='herring' else 'UNSUPPORTED_ORAL_STRUCTURE_UNCONFIRMED'
  items.append({'id':id,'sourceScoreFile':row['file'],'sourceScoreSha256':frozen[row['file']],'sourceEntrySha256':s.row['sourceEntrySha256'],'sourceLabel':s.row['label'],'identity':'SOURCE_LABEL_ONLY; species identification unconfirmed','maxCanonicalSurfaceMappingError':error,'topology':top,'morphTargetCount':sum(len(p.get('targets',[])) for m in s.g['meshes'] for p in m['primitives']),'nativeOpercularNamedJoints':[{'node':i,'name':n.get('name')} for i,n in enumerate(s.nodes) if re.search(r'(^|[_ .])(gill|operc|branch)',n.get('name',''),re.I)],'oralNodes':nodes,'status':status,'confidence':'HIGH_SOURCE_RIG' if id.startswith('tuna') else 'MEDIUM_GEOMETRIC_LOWER_HEAD_BONE_NOT_NAMED_JAW' if id=='herring' else 'LOW_ANATOMICAL_IDENTIFICATION','openingSupported':supported,'sourceMouthCavity':'UNKNOWN; no new cavity geometry authorized','ventilationPolicy':'RAM_GAPE_ENGINEERING; avoid full rhythmic sealing while forward swimming' if id.startswith('tuna') else 'BUCCAL_OPERCULAR_ENGINEERING_CANDIDATE; actual species rate unmeasured','limitations':'No original named jaw, lip, opercular bone, oral shape key or oral animation; whole head source weights cannot identify an independent mouth opening without further source measurement' if not supported else 'Native binding supports deformation, not proof of biological angle/frequency or full cavity; edge/area numeric trials need actual GPU/reference review'})
  if id.startswith('tuna'):
   lower=next(n for n in nodes if n['node']==(21 if id=='tuna-yellow-label' else 13));maximum=.03 if id=='tuna-yellow-label' else .05;measured=next(t for t in lower['constrainedLbsRotationTrials'] if t['angleRad']==maximum)
   items[-1]['productionRecommendation']={'lowerJawNode':lower['node'],'lowerJawName':lower['name'],'pivotCanonical':lower['pivotCanonical'],'axisCanonical':lower['axisCanonical'],'signedMinAngleRad':0.,'signedMaxAngleRad':maximum,'field':'constrainedSubtreeWeight','gradient':'constrainedGradient','bindings':lower['sparseBindings'],'upperPolicy':'Retain original upper jaw/upper lip at rest; no independent upper transform recommended','lipPolicy':'Lower lip is already included in jaw subtree; never add direct plus subtree or rotate lower lip again','openingBiasDuringForwardSwim':'Small nonzero engineering gape optional within tested positive range; exact resting gap unmeasured','frequencyHz':'UNMEASURED; own slowly varying physiology-clock engineering timing, independent of tail phase','numericAtSignedMax':measured,'restZeroIdentity':True,'visualAcceptance':False,'status':'NUMERIC_CANDIDATE_REQUIRES_ACTUAL_GPU_REFERENCE_QA'}
 original=original_fbx_audit();meta,legacy=legacy_metadata()
 items.insert(0,{'id':'barracuda','identity':'User workbench label 海狼; original archive filename muskellunge, biological identity unresolved','original':original,'status':'EXISTING_R14_DERIVED_JAW_GILL_FIELDS','confidence':'HIGH_EXISTING_ENGINEERING_METADATA; not native source rig','openingSupported':True,'metadataSource':legacy,'jaw':meta['continuum']['jaw'],'gill':meta['continuum']['gill'],'bodySourceXM':meta['continuum']['body']['sourceXM'],'bodyEndXM':meta['continuum']['body']['endXM'],'limitations':'Archive FBX topology is static; existing harmonic jaw/gill fields are source-sampled engineering controls, not native animation or biologically measured degrees/Hz. Reuse existing fields, do not create geometry.'})
 papers=[{'id':'buccal-primary','url':'https://doi.org/10.1242/jeb.35.4.807','title':'Hughes & Shelton 1958, The Mechanism of Gill Ventilation in Three Freshwater Teleosts','scope':'Primary measurements in three freshwater species, not these six source specimens','finding':'Buccal and opercular movements coordinated with a phase lag; do not force synchronous mouth and gill oscillation','modelRateHz':'UNMEASURED'}, {'id':'gill-flow-primary','url':'https://doi.org/10.1242/jeb.079517','title':'2013 Hydrodynamic resistance and flow patterns in the gills of a tilapine fish','scope':'Primary tilapia isolated gill-flow experiment; generic double-pump principle, not specimen animation calibration','finding':'Oral/opercular valves with coupled pressure chambers give largely one-way pulsatile ventilation'}, {'id':'ram-primary','url':'https://doi.org/10.1002/jmor.20082','retrievedAt':'https://pubmed.ncbi.nlm.nih.gov/23023918/','title':'Wegner et al. 2013 Structural adaptations for ram ventilation: gill fusions in scombrids and billfishes','scope':'Primary 28 scombrid and 7 billfish species anatomical study','finding':'Ram ventilators including tunas adapted to fast continuous ventilatory flow; a swimming tuna mouth policy should retain small gape rather than force recurrent complete closure'}, {'id':'yellowfin-primary','url':'https://escholarship.org/content/qt9hn1c0qn/qt9hn1c0qn_noSplash_3350e35906fe6cd75cd71ee5d15cd73a.pdf','title':'2019 Ontogenetic changes in cutaneous and branchial ionocytes and morphology in yellowfin tuna larvae','scope':'Larval development study; cannot apply larval rates or dimensions to adult model','finding':'Yellowfin morphology develops ram-ventilation supporting gill fusions; exact source-label identity and size unknown'}]
 taskId=json.loads((ROOT/'TASK_ANCHOR_R04.json').read_text(encoding='utf8'))['taskId']
 result={'taskId':taskId,'schema':'FISH_SCOREMAKER_ORAL_SOURCE_AUDIT_R04','measuredAt':datetime.now(timezone.utc).isoformat(),'coordinateSystem':'Current canonical score positions; X head -0.5/tail +0.5, Y up, Z lateral. Body lengths, physical metres unconfirmed. Barracuda legacy units use its own metadata, never mix pivots.','method':'Original glTF worldJoint * inverseBind rest, unchanged original addresses; native direct and descendant skin weights. Numerical tests use weighted rigid LBS p+w*(R(p-pivot)+pivot-p), not angle*w rotation.','restPreserved':True,'noNewGeometry':True,'eyesUnchanged':True,'scoresUnchanged':all(sha((ROOT/'data'/f).read_bytes())==h for f,h in frozen.items()),'specimens':items,'research':papers,'productionReady':False,'visualAcceptance':False}
 assert result['scoresUnchanged']
 dest=ROOT/'data/oral-r04.json';dest.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
 runtime={'taskId':taskId,'schema':'FISH_SCOREMAKER_ORAL_RUNTIME_R04','specimens':[]}
 for item in items:
  entry={'id':item['id'],'status':item['status'],'sourceScoreSha256':item.get('sourceScoreSha256'),'sourceEntrySha256':item.get('sourceEntrySha256') or item.get('original',{}).get('fbxSha256')}
  if item['id']=='barracuda':entry.update({'jaw':item['jaw'],'gill':item['gill'],'metadataSource':item['metadataSource'],'limitations':item['limitations']})
  elif 'productionRecommendation' in item:
   recommendation=item['productionRecommendation'];entry['productionRecommendation']={k:recommendation[k] for k in ['lowerJawNode','lowerJawName','pivotCanonical','axisCanonical','signedMinAngleRad','signedMaxAngleRad','field','gradient','upperPolicy','lipPolicy','numericAtSignedMax','restZeroIdentity','status']}
   entry['productionRecommendation']['bindings']=[{k:b[k] for k in ['primitive','vertexCount','indices','constrainedSubtreeWeight','constrainedGradient']} for b in recommendation['bindings']]
  else:entry['limitations']=item['limitations']
  runtime['specimens'].append(entry)
 runtimePath=ROOT/'data/oral-runtime-r04.json';runtimePath.write_text(json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
 print(json.dumps({'bytes':dest.stat().st_size,'scoresUnchanged':result['scoresUnchanged'],'specimens':[{'id':x['id'],'status':x['status'],'nodes':[(n['name'],n['directPositiveVertices'],n['constrainedField'],n['constrainedLbsRotationTrials'][2]) for n in x.get('oralNodes',[])]} for x in items]},ensure_ascii=False))
if __name__=='__main__':run()
