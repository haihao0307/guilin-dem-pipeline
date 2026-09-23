"""Read-only Teacher -> lossless field package. No fitted/simplified geometry."""
import argparse, hashlib, json, pathlib, re, struct
import numpy as np
H=lambda b:hashlib.sha256(b).hexdigest()
CANON=[4.018869392019651e-25,9.196000441341807e-27,.3344832021025874,0,-.007651661288734102,.33439567067819953,0,0,-.33439567067819953,-.007651661288734102,4.01992137143553e-25,0,-.0014978089825586807,.041525995927149784,1.9936752444659914e-8,1]
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();src=pathlib.Path(a.source);out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
 raw=src.read_bytes()
 if src.suffix=='.glb':
  assert H(raw)=='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe','Wrong teacher binary'
  assert raw[:4]==b'glTF'; n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);off=20+n;length=struct.unpack_from('<I',raw,off)[0];buffers=[raw[off+8:off+8+length]]
 else:
  g=json.loads(raw);buffers=[(src.parent/b['uri']).read_bytes() for b in g['buffers']]
 payload=bytearray();fields=[];arrays=[];hashes=[]
 def store(b,typ,width,count,source_id=None):
  while len(payload)%8:payload.append(0)
  entry={'id':len(fields),'offset':len(payload),'byteLength':len(b),'componentType':typ,'width':width,'count':count,'sha256':H(b),'sourceAccessor':source_id};payload.extend(b);fields.append(entry);return entry['id']
 for i,x in enumerate(g['accessors']):
  assert 'sparse' not in x,'Sparse data must be implemented before this source can be used';bv=g['bufferViews'][x['bufferView']];width=NC[x['type']];size=np.dtype(DT[x['componentType']]).itemsize*width;offset=bv.get('byteOffset',0)+x.get('byteOffset',0);stride=bv.get('byteStride',size);b=buffers[bv['buffer']];packed=b''.join(b[offset+j*stride:offset+j*stride+size] for j in range(x['count']));assert len(packed)==x['count']*size;hashes.append(H(packed));store(packed,x['componentType'],width,x['count'],i);fields[-1]['normalized']=x.get('normalized',False);arrays.append(np.frombuffer(packed,dtype=DT[x['componentType']]).reshape(x['count'],width))
 assert len(fields)==603 and H(''.join(hashes).encode())=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63','Source accessor identity mismatch'
 semantic=H(json.dumps({k:g.get(k) for k in ['nodes','scenes','scene','skins','meshes','animations','materials','textures','samplers']},sort_keys=True,separators=(',',':')).encode());assert semantic=='aaeeb9e50cc5a0b6ed4a59efa8fd9e14929e09c20549e68c3e92f5b66ad90360'
 parent={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};joints=g['skins'][0]['joints'];jset=set(joints)
 def family(i):return re.sub(r'\.\d+$','',re.sub(r'_\d+$','',g['nodes'][i].get('name','')))
 groups=[];assigned={}
 def assign(i,group):
  assert i not in assigned;assigned[i]=group['id'];group['nodes'].append(i)
  for c in g['nodes'][i].get('children',[]):
   if c in jset and family(c)==family(i):assign(c,group)
 for i in joints:
  if i in assigned:continue
  p=parent.get(i)
  if p not in jset or family(p)!=family(i):
   group={'id':len(groups),'sourceName':g['nodes'][i]['name'],'rootNode':i,'family':family(i),'nodes':[],'biologicalLabel':None,'semanticStatus':'AUTHOR_CONTROL_GROUP_NOT_ANATOMICAL_APPROVAL'};groups.append(group);assign(i,group)
 assert len(assigned)==len(joints)
 local=[]
 for n in g['nodes']:
  if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
  else:
   x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,:3]*=np.array(n.get('scale',[1,1,1]))[None,:];m[:3,3]=n.get('translation',[0,0,0])
  local.append(m)
 world={}
 def wm(i):
  if i not in world:world[i]=(wm(parent[i]) if i in parent else np.eye(4))@local[i]
  return world[i]
 for i in range(len(local)):wm(i)
 canonical=np.array(CANON).reshape(4,4).T;inverse=np.linalg.inv(canonical);ibm=arrays[g['skins'][0]['inverseBindMatrices']].reshape(-1,4,4).transpose(0,2,1).astype(float);skin=np.array([canonical@world[j]@ibm[k] for k,j in enumerate(joints)])
 geometry=[];stats=[];allpos=[];roundtrip=0
 for mi,m in enumerate(g['meshes']):
  for pi,p in enumerate(m['primitives']):
   attrs=p['attributes'];pos=arrays[attrs['POSITION']].astype(float);idx=arrays[p['indices']].reshape(-1,3);ji=arrays[attrs['JOINTS_0']].astype(int);weights=arrays[attrs['WEIGHTS_0']].astype(float);groupweights=np.zeros((len(pos),len(groups)),dtype='<f8')
   for k in range(4):
    ids=np.array([assigned[joints[j]] for j in ji[:,k]]);groupweights[np.arange(len(pos)),ids]+=weights[:,k]
   assert np.max(np.abs(groupweights.sum(axis=1)-weights.sum(axis=1)))<1e-12
   gf=store(groupweights.tobytes(),'FLOAT64',len(groups),len(pos));hp=np.c_[pos,np.ones(len(pos))];surf=sum(np.einsum('nij,nj->ni',skin[ji[:,k]],hp)*weights[:,k,None] for k in range(4));cp=surf[:,:3];allpos.append(cp)
   pf=store(cp.astype('<f8').tobytes(),'FLOAT64',3,len(cp));geom={'sourceMesh':mi,'sourcePrimitive':pi,'name':m['name'],'vertexFields':attrs,'faceField':p['indices'],'materialId':p.get('material'),'mode':p.get('mode',4),'morphTargets':p.get('targets',[]),'groupWeightField':gf,'canonicalRestPositionField':pf,'bounds':[cp.min(0).tolist(),cp.max(0).tolist()]};geometry.append(geom)
   for group in groups:
    v=groupweights[:,group['id']];mask=v>0;t=v[idx].mean(axis=1);stats.append({'mesh':mi,'group':group['id'],'supportVertices':int(mask.sum()),'supportTriangles':int((t>0).sum()),'mixedVertices':int(((v>0)&(v<weights.sum(1)-1e-12)).sum()),'weightSum':float(v.sum()),'bounds':None if not mask.any() else [cp[mask].min(0).tolist(),cp[mask].max(0).tolist()]})
   back=np.c_[cp,np.ones(len(cp))]@inverse.T;forth=back@canonical.T;roundtrip=max(roundtrip,float(np.max(abs(forth[:,:3]-cp))))
 graph=[{'id':i,'sourceName':n.get('name',''),'parent':parent.get(i),'children':n.get('children',[]),'kind':'joint' if i in jset else 'mesh' if 'mesh'in n else 'node','meshId':n.get('mesh'),'skinId':n.get('skin'),'restMatrix':local[i].T.flatten().tolist(),'sourceTRS':{k:n[k] for k in ['translation','rotation','scale'] if k in n},'sourceMatrix':n.get('matrix'),'canonicalPivot':(canonical@world[i])[:3,3].tolist(),'pivotParentDistance':None if i not in parent else float(np.linalg.norm((canonical@world[i])[:3,3]-(canonical@world[parent[i]])[:3,3]))}for i,n in enumerate(g['nodes'])]
 motion=[]
 for anim in g['animations']:
  tracks=[]
  for c in anim['channels']:
   s=anim['samplers'][c['sampler']];tracks.append({'nodeId':c['target'].get('node'),'property':c['target']['path'],'timeField':s['input'],'valueField':s['output'],'interpolation':s.get('interpolation','LINEAR')})
  motion.append({'name':anim.get('name',''),'tracks':tracks})
 positions=np.concatenate(allpos);sections=[]
 for i in range(200):
  u=(i+.5)/200;x=u-.5;segments=[]
  for geom in geometry:
   mi=geom['sourceMesh'];p=allpos[mi];ids=arrays[geom['faceField']].reshape(-1,3);v=p[ids];hitfaces=np.where((v[:,:,0].min(1)<=x)&(v[:,:,0].max(1)>x))[0]
   for face in hitfaces:
    tri=v[face];hits=[]
    for edge in range(3):
     aa,bb=edge,(edge+1)%3;va,vb=tri[aa,0],tri[bb,0]
     if (va<x<=vb) or (vb<x<=va):
      t=(x-va)/(vb-va);bary=np.zeros(3);bary[aa]=1-t;bary[bb]=t;hits.append((bary,bary@tri))
    if len(hits)==2:segments.append({'mesh':mi,'triangle':int(face),'barycentric':[h[0].tolist() for h in hits],'endpoints':[h[1].tolist() for h in hits]})
  sections.append({'u':u,'x':x,'segments':segments})
 section_text=json.dumps(sections,separators=(',',':'));(out/'section-field.json').write_text(section_text)
 package={'schema':'kaopu.canonical-fish-teacher/1.0','version':'FISH_CANONICAL_R004','sourceArrayAggregate':H(''.join(hashes).encode()),'sourceSemanticHash':semantic,'canonicalTransform':CANON,'physicalLengthMeasured':None,'naturalSkeletonVerified':False,'fields':fields,'objectGraph':graph,'rootNodes':g['scenes'][g.get('scene',0)]['nodes'],'surfaces':geometry,'skeletonGraphs':[{'jointNodes':s['joints'],'inverseBindField':s['inverseBindMatrices'],'rootNode':s.get('skeleton')}for s in g['skins']],'controlGroups':groups,'groupSupport':stats,'motionFields':motion,'materialFields':g['materials'],'textureBindings':g['textures'],'samplerFields':g.get('samplers',[]),'sections':{'stations':200,'segmentCount':sum(len(s['segments'])for s in sections),'file':'section-field.json','sha256':H(section_text.encode()),'status':'ALL_SOURCE_SURFACES_NOT_BODY_ONLY'},'bounds':[positions.min(0).tolist(),positions.max(0).tolist()],'semanticApproval':False,'generatorReady':False}
 (out/'teacher-fields.bin').write_bytes(payload);(out/'teacher-package.json').write_text(json.dumps(package,ensure_ascii=False,separators=(',',':')));(out/'source-json-preserved.json').write_text(json.dumps(g,ensure_ascii=False,separators=(',',':')))
 read=(out/'teacher-fields.bin').read_bytes()
 for f in fields:assert H(read[f['offset']:f['offset']+f['byteLength']])==f['sha256']
 report={'version':package['version'],'rawAccessorCount':603,'rawArrayRoundtrip':True,'fields':len(fields),'nodes':len(graph),'joints':len(joints),'controlGroups':len(groups),'groupPartitionComplete':len(assigned)==98,'vertices':int(sum(len(p)for p in allpos)),'triangles':int(sum(len(arrays[s['faceField']])//3 for s in geometry)),'motionTracks':sum(len(m['tracks'])for m in motion),'sections':package['sections'],'canonicalRoundtripMax':roundtrip,'sourceSha256':H(raw),'sourceUnchanged':H(src.read_bytes())==H(raw),'semanticApproval':False,'biologicalTruth':False,'productionReady':False}
 (out/'EXTRACTION_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':main()
