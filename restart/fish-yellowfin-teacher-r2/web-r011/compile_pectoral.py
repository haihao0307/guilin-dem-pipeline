"""Read-only paired source-pectoral study. Neither fin is mirrored or re-rigged.
Source-index attachment aliases and original curves remain independently traceable.
"""
from pathlib import Path
import argparse, collections, hashlib, importlib.util, json
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
H=lambda b:hashlib.sha256(b).hexdigest()
def run(canonical,parts_path,head_path,out,head_code=None):
 c,p,h,o=map(Path,[canonical,parts_path,head_path,out]);o.mkdir(parents=True,exist_ok=True)
 code=Path(head_code) if head_code else Path(__file__).parent.parent/'web-r007/compile_head.py'
 spec=importlib.util.spec_from_file_location('r007_source_math',code);math=importlib.util.module_from_spec(spec);spec.loader.exec_module(math)
 pkg=json.loads((c/'teacher-package.json').read_text());raw=(c/'teacher-fields.bin').read_bytes();parts=json.loads((p/'parts.json').read_text());head=json.loads((h/'head-evidence.json').read_text())
 assert pkg['sourceArrayAggregate']==head['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  f=pkg['fields'][i];return np.frombuffer(raw[f['offset']:f['offset']+f['byteLength']],dtype=DT[f['componentType']]).reshape(f['count'],f['width'])
 graph=pkg['objectGraph'];canon=np.array(pkg['canonicalTransform']).reshape(4,4).T;tracks=pkg['motionFields'][0]['tracks'];curves=[(field(t['timeField']).astype(float).ravel(),field(t['valueField']).astype(float))for t in tracks]
 assert all(t['interpolation'] in ['LINEAR','STEP'] for t in tracks)
 def pose(t):
  trs=[{k:np.array(v,dtype=float)for k,v in n['sourceTRS'].items()}for n in graph]
  if t is not None:
   for tr,(a,b)in zip(tracks,curves):
    j=int(np.searchsorted(a,t,side='right'))
    if j==0:v=b[0]
    elif j==len(a):v=b[-1]
    else:
     u=(t-a[j-1])/(a[j]-a[j-1]);v=b[j-1]if tr['interpolation']=='STEP'else math.slerp(b[j-1],b[j],u)if tr['property']=='rotation'else b[j-1]*(1-u)+b[j]*u
    trs[tr['nodeId']][tr['property']]=v
  local=[np.array(n['sourceMatrix']).reshape(4,4).T if n['sourceMatrix']is not None else math.compose(trs[n['id']])for n in graph];world={}
  def visit(i):
   if i not in world:world[i]=(visit(graph[i]['parent'])if graph[i]['parent']is not None else np.eye(4))@local[i]
   return world[i]
  for n in graph:visit(n['id'])
  return world
 s=pkg['surfaces'][0];a=s['vertexFields'];pos=field(a['POSITION']).astype(float);hp=np.c_[pos,np.ones(len(pos))];faces=field(s['faceField']).reshape(-1,3);ji=field(a['JOINTS_0']).astype(int);w=field(a['WEIGHTS_0']).astype(float);w=(w/w.sum(1,keepdims=True)).astype(np.float32).astype(float)
 skin=pkg['skeletonGraphs'][0];ibm=field(skin['inverseBindField']).reshape(-1,4,4).transpose(0,2,1).astype(float)
 def deform(world):
  matrices=np.array([canon@world[i]@ibm[k]for k,i in enumerate(skin['jointNodes'])]);return sum(np.einsum('nij,nj->ni',matrices[ji[:,k]],hp)*w[:,k,None]for k in range(4))[:,:3]
 rest_world=pose(None);rest=deform(rest_world);body_node=next(n['id']for n in graph if n['sourceName']=='Spine_02');bm0=canon@rest_world[body_node];axes0=bm0[:3,:3]/np.linalg.norm(bm0[:3,:3],axis=0)
 definitions=[];control_ids=[]
 for part_id,group_name in [('pectoral_l','SideFin.L_012'),('pectoral_r','SideFin.R_022')]:
  part=next(x for x in parts['parts']if x['id']==part_id);assert part['mesh']==0 and len(part['sourceTriangles'])==219
  group=next(g for g in pkg['controlGroups']if g['sourceName']==group_name);assert len(group['nodes'])==6
  edges=[];aliases=collections.defaultdict(set)
  for si,seam in enumerate(parts['seams']):
   if {seam['a']['part'],seam['b']['part']}!={part_id,'trunk'}:continue
   fin=seam['a']if seam['a']['part']==part_id else seam['b'];trunk=seam['b']if seam['a']['part']==part_id else seam['a']
   assert np.array_equal(pos[fin['vertices']],pos[trunk['vertices']]);edges.append({'seamId':si,'finVertices':fin['vertices'],'trunkVertices':trunk['vertices']})
   for v in fin['vertices']:aliases[tuple(pos[v])].add(v)
  assert len(edges)==11
  root=[{'sourceVertex':min(v),'sourceAliases':sorted(v)}for v in sorted(aliases.values(),key=min)];mean=rest[[x['sourceVertex']for x in root]].mean(0);ids=np.array(part['sourceVertices']);tip=int(ids[np.argmax(np.linalg.norm(rest[ids]-mean,axis=1))])
  degrees=collections.Counter(tuple(pos[v])for e in edges for v in e['finVertices'])
  control=[{'node':i,'sourceName':graph[i]['sourceName'],'parent':graph[i]['parent'],'tracks':[t for t in tracks if t['nodeId']==i]}for i in group['nodes']];control_ids.extend(group['nodes'])
  definitions.append({'id':part_id,'label':part['label'],'mesh':0,'sourceTriangles':part['sourceTriangles'],'sourceVertices':part['sourceVertices'],'authorGroupId':group['id'],'authorGroupName':group_name,'sourceControlSupport':part['sourceControlSupport'],'controls':control,'rootVertices':root,'interfaceEdges':edges,'interfaceDegreeHistogram':dict(collections.Counter(degrees.values())),'tip':{'sourceVertex':tip,'sourceTriangles':[int(f)for f in part['sourceTriangles']if tip in faces[f]],'definition':'FROZEN_REST_SOURCE_VERTEX_FARTHEST_FROM_UNIQUE_INTERFACE_POSITION_MEAN'},'rootMeanDefinition':'MEAN_OF_EXACT_SOURCE_POSITION_GROUPS; ORIGINAL_VERTEX_ALIASES_RETAINED','anatomicalApproval':False})
 assert len(set(control_ids))==12 and sum(len(c['tracks'])for d in definitions for c in d['controls'])==36
 max_gap=0.;max_alias=0.;max_ortho=0.;head_error=0.
 def sample(t,hs):
  nonlocal max_gap,max_alias,max_ortho,head_error
  world=pose(t);surf=deform(world);bm=canon@world[body_node];axes=bm[:3,:3]/np.linalg.norm(bm[:3,:3],axis=0);rotation=axes@axes0.T;max_ortho=max(max_ortho,float(abs(rotation.T@rotation-np.eye(3)).max()));assert max_ortho<1e-6
  ref=np.array(next(n for n in hs['nodes']if n['id']==head['headNode'])['canonicalMatrix']).reshape(4,4).T;head_error=max(head_error,float(abs(ref-canon@world[head['headNode']]).max()))
  fins=[]
  for d in definitions:
   roots=surf[[x['sourceVertex']for x in d['rootVertices']]];mean=roots.mean(0);tip=surf[d['tip']['sourceVertex']];offset=(tip-mean)@rotation;tri=surf[faces[d['sourceTriangles']]];area=float(np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1).sum()*.5)
   gap=max(float(np.linalg.norm(surf[e['finVertices']]-surf[e['trunkVertices']],axis=1).max())for e in d['interfaceEdges']);max_gap=max(max_gap,gap)
   for group in d['rootVertices']:max_alias=max(max_alias,float(np.linalg.norm(surf[group['sourceAliases']]-surf[group['sourceVertex']],axis=1).max()))
   metrics={'rootMeanToTip':float(np.linalg.norm(tip-mean)),'bodyFrameTipLongitudinal':float(offset[0]),'bodyFrameTipVertical':float(offset[1]),'bodyFrameTipLateral':float(offset[2]),'sourceFinSurfaceArea':area,'interfaceMaxGap':gap}
   fins.append({'id':d['id'],'tip':tip.tolist(),'rootPoints':roots.tolist(),'rootVertexMean':mean.tolist(),'frameOffset':offset.tolist(),'metrics':metrics})
  return {'time':t,'rest':t is None,'bodyMatrix':bm.T.ravel().tolist(),'controlMatrices':[{'node':i,'matrix':(canon@world[i]).T.ravel().tolist()}for i in control_ids],'fins':fins}
 rest_sample=sample(None,head['restSample']);samples=[sample(x['time'],x)for x in head['samples']]
 for index,d in enumerate(definitions):
  d['summary']={k:{'min':min(v),'max':max(v),'minIndex':int(np.argmin(v)),'maxIndex':int(np.argmax(v))}for k in rest_sample['fins'][index]['metrics']for v in [[x['fins'][index]['metrics'][k]for x in samples]]}
 qa={'version':'FISH_PECTORAL_R011','sourceFinTriangles':[len(d['sourceTriangles'])for d in definitions],'sourceFinVertexIndices':[len(d['sourceVertices'])for d in definitions],'sourceAttachmentEdges':[len(d['interfaceEdges'])for d in definitions],'rootPositions':[len(d['rootVertices'])for d in definitions],'rootVertexAliases':[sum(len(x['sourceAliases'])for x in d['rootVertices'])for d in definitions],'tipSourceIndices':[d['tip']['sourceVertex']for d in definitions],'controls':12,'sourceTracks':36,'samples':len(samples),'restSamples':1,'maxInterfaceGap':max_gap,'maxAliasGap':max_alias,'maxFrameOrthogonalityError':max_ortho,'headSourceRegression':head_error,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'mirroredFinCreated':False,'newMotionCreated':False,'physicalLengthKnown':False,'anatomicalPartitionApproved':False,'stageAComplete':False,'independentGenerator':False,'productionReady':False}
 assert max_gap<1e-12 and head_error<1e-12
 data={'schema':'kaopu.source-pectoral-study/1.0','version':qa['version'],'sourceArrayAggregate':pkg['sourceArrayAggregate'],'sourceBinarySha256':H(raw),'bodyNode':body_node,'bodyName':graph[body_node]['sourceName'],'restBodyMatrix':bm0.T.ravel().tolist(),'definitions':definitions,'restSample':rest_sample,'samples':samples,'qa':qa,'limitations':['L/R labels preserve R005 source observations; they are not new biological approval.','Two source fins have different vertex-index counts; no mirroring or deletion makes them equal.','Frozen farthest vertices and source-interface means are engineering probes, not anatomical landmarks.','Body-frame offsets are source-deformation observations, not force, lift or biological angle.','All original vertices, triangles, skin weights, 4K textures and complete curves remain in the parent Teacher Package.','Normalized lengths and squared lengths do not imply known physical size, age or growth.']}
 (o/'pectoral-evidence.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')));(o/'PECTORAL_QA.json').write_text(json.dumps(qa,indent=2));print(json.dumps(qa,indent=2));return data
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--canonical',required=True);p.add_argument('--parts',required=True);p.add_argument('--head',required=True);p.add_argument('--out',required=True);p.add_argument('--head-code');a=p.parse_args();run(a.canonical,a.parts,a.head,a.out,a.head_code)
