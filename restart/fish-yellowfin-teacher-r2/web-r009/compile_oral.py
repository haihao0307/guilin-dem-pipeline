"""Read-only source mouth-interface geometry, not anatomical gape or growth.
Extends the R007 source-curve decoder; keeps all original indices and duplicate aliases.
"""
from pathlib import Path
import argparse, collections, hashlib, importlib.util, json, sys
import numpy as np
H=lambda b:hashlib.sha256(b).hexdigest()
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
def run(canonical,parts_path,head_path,out,head_code=None):
 c,p,h,o=map(Path,[canonical,parts_path,head_path,out]);o.mkdir(parents=True,exist_ok=True)
 code=Path(head_code) if head_code else Path(__file__).parent.parent/'web-r007/compile_head.py'
 spec=importlib.util.spec_from_file_location('source_head_r007',code);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 pkg=json.loads((c/'teacher-package.json').read_text());raw=(c/'teacher-fields.bin').read_bytes();parts=json.loads((p/'parts.json').read_text());head=json.loads((h/'head-evidence.json').read_text())
 assert pkg['sourceArrayAggregate']==head['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  f=pkg['fields'][i];return np.frombuffer(raw[f['offset']:f['offset']+f['byteLength']],dtype=DT[f['componentType']]).reshape(f['count'],f['width'])
 graph=pkg['objectGraph'];canon=np.array(pkg['canonicalTransform']).reshape(4,4).T;track=pkg['motionFields'][0]['tracks'];arr=[(field(t['timeField']).astype(float).ravel(),field(t['valueField']).astype(float))for t in track]
 def pose(t):
  trs=[{k:np.array(v,dtype=float)for k,v in n['sourceTRS'].items()}for n in graph]
  if t is not None:
   for tr,(a,b) in zip(track,arr):
    j=int(np.searchsorted(a,t,side='right'))
    if j==0:v=b[0]
    elif j==len(a):v=b[-1]
    else:
     u=(t-a[j-1])/(a[j]-a[j-1]);v=b[j-1] if tr['interpolation']=='STEP' else module.slerp(b[j-1],b[j],u) if tr['property']=='rotation' else b[j-1]*(1-u)+b[j]*u
    trs[tr['nodeId']][tr['property']]=v
  local=[np.array(n['sourceMatrix']).reshape(4,4).T if n['sourceMatrix'] is not None else module.compose(trs[n['id']])for n in graph];world={}
  def visit(i):
   if i not in world:world[i]=(visit(graph[i]['parent'])if graph[i]['parent']is not None else np.eye(4))@local[i]
   return world[i]
  for n in graph:visit(n['id'])
  return world
 skin=pkg['skeletonGraphs'][0];ibm=field(skin['inverseBindField']).reshape(-1,4,4).transpose(0,2,1).astype(float)
 surface=pkg['surfaces'][0];a=surface['vertexFields'];pos=field(a['POSITION']).astype(float);ji=field(a['JOINTS_0']).astype(int);w=field(a['WEIGHTS_0']).astype(float);w=(w/w.sum(1,keepdims=True)).astype(np.float32).astype(float)
 seam_ids=head['mouthInterfaceSeamIds'];assert len(seam_ids)==24
 aliases=collections.defaultdict(set);adj=collections.defaultdict(set);edge_records=[]
 for si in seam_ids:
  seam=parts['seams'][si];x=seam['a']if seam['a']['part']=='head'else seam['b'];y=seam['b']if seam['a']['part']=='head'else seam['a'];assert x['mesh']==y['mesh']==0
  va,vb=x['vertices'];ka,kb=tuple(pos[va]),tuple(pos[vb]);adj[ka].add(kb);adj[kb].add(ka)
  for key,vertex in [(ka,va),(kb,vb)]:aliases[key].add(vertex)
  edge_records.append({'sourceSeamId':si,'headVertices':x['vertices'],'innerVertices':y['vertices']})
 assert len(adj)==24 and all(len(v)==2 for v in adj.values()),'Not a single source cycle; stop rather than invent closure'
 start=min(adj,key=lambda k:min(aliases[k]));ordered=[start];previous=None;current=start
 while True:
  candidates=adj[current]-({previous}if previous is not None else set());nxt=min(candidates,key=lambda k:min(aliases[k]))
  if nxt==start:break
  assert nxt not in ordered,'Unexpected disconnected/crossing source graph';ordered.append(nxt);previous,current=current,nxt
 assert len(ordered)==24
 vertices=[{'headSourceVertex':min(aliases[k]),'headSourceAliases':sorted(aliases[k])}for k in ordered];ids=np.array([x['headSourceVertex']for x in vertices]);hp=np.c_[pos,np.ones(len(pos))]
 rest_world=pose(None);rest_head=canon@rest_world[head['headNode']];rest_axes=rest_head[:3,:3]/np.linalg.norm(rest_head[:3,:3],axis=0)
 max_ortho=0.;max_alias=0.;max_seam=0.;max_head=0.
 def sample(t,hs):
  nonlocal max_ortho,max_alias,max_seam,max_head
  world=pose(t);mat=canon@world[head['headNode']];axes=mat[:3,:3]/np.linalg.norm(mat[:3,:3],axis=0);rotation=axes@rest_axes.T;max_ortho=max(max_ortho,float(abs(rotation.T@rotation-np.eye(3)).max()));assert max_ortho<1e-6
  source_head=np.array(next(n for n in hs['nodes']if n['id']==head['headNode'])['canonicalMatrix']).reshape(4,4).T;max_head=max(max_head,float(abs(source_head-mat).max()))
  bs=np.array([canon@world[i]@ibm[k]for k,i in enumerate(skin['jointNodes'])]);surf=sum(np.einsum('nij,nj->ni',bs[ji[:,k]],hp)*w[:,k,None]for k in range(4))[:,:3]
  for x in vertices:max_alias=max(max_alias,float(np.linalg.norm(surf[x['headSourceAliases']]-surf[x['headSourceVertex']],axis=1).max()))
  for e in edge_records:max_seam=max(max_seam,float(np.linalg.norm(surf[e['headVertices']]-surf[e['innerVertices']],axis=1).max()))
  points=surf[ids];relative=(points-mat[:3,3])@rotation+rest_head[:3,3];lo=relative.min(0);hi=relative.max(0);center=points.mean(0)
  perimeter=float(np.linalg.norm(np.roll(points,-1,axis=0)-points,axis=1).sum());yz=relative[:,1:];area=float(abs(np.sum(yz[:,0]*np.roll(yz[:,1],-1)-yz[:,1]*np.roll(yz[:,0],-1)))*.5)
  eye={x['id']:x['areaCentroid']for x in hs['surfaceProbes']};metrics={'headFrameVerticalExtent':float(hi[1]-lo[1]),'headFrameLateralExtent':float(hi[2]-lo[2]),'headFrameLongitudinalExtent':float(hi[0]-lo[0]),'sourceRimPerimeter':perimeter,'headFrameYZProjectedArea':area,'eyeSurfaceCentroidSeparation':float(np.linalg.norm(np.array(eye['eye_l'])-eye['eye_r'])),'rimMeanToEyeL':float(np.linalg.norm(center-eye['eye_l'])),'rimMeanToEyeR':float(np.linalg.norm(center-eye['eye_r']))}
  return {'time':t,'rest':t is None,'headMatrix':mat.T.ravel().tolist(),'rimWorldPoints':points.tolist(),'rimHeadFramePoints':relative.tolist(),'rimVertexMean':center.tolist(),'eyeSurfaceProbes':hs['surfaceProbes'],'metrics':metrics}
 rest=sample(None,head['restSample']);samples=[sample(s['time'],s)for s in head['samples']];summary={k:{'min':min(s['metrics'][k]for s in samples),'max':max(s['metrics'][k]for s in samples),'minIndex':int(np.argmin([s['metrics'][k]for s in samples])),'maxIndex':int(np.argmax([s['metrics'][k]for s in samples]))}for k in rest['metrics']}
 qa={'version':'FISH_ORAL_R008','rimEdges':24,'cycleVertices':24,'sourceHeadVertexIds':sum(len(v['headSourceAliases'])for v in vertices),'samples':len(samples),'restSamples':1,'metrics':len(rest['metrics']),'maxHeadMatrixRegression':max_head,'maxFrameOrthogonalityError':max_ortho,'maxAliasPositionGap':max_alias,'maxHeadInnerSeamGap':max_seam,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'sourceVerticesWelded':0,'newGeometryCreated':False,'physicalLengthKnown':False,'biologicalGapeAngleMeasured':False,'anatomicalPartitionApproved':False,'stageAComplete':False,'independentGenerator':False,'productionReady':False}
 assert qa['maxHeadMatrixRegression']<1e-12 and qa['maxHeadInnerSeamGap']<1e-12
 result={'schema':'kaopu.source-oral-geometry/1.0','version':qa['version'],'sourceArrayAggregate':pkg['sourceArrayAggregate'],'sourceBinarySha256':H(raw),'headNode':head['headNode'],'rimMesh':0,'rimVertices':vertices,'rimEdges':edge_records,'restHeadMatrix':rest_head.T.ravel().tolist(),'probeDefinitions':head['probeDefinitions'],'definition':'EXACT_HEAD_TO_MOUTH_INNER_INTERFACE_CYCLE; source corner IDs preserved; lengths normalized; transported canonical head frame strips only rigid head motion; projected yz area is not anatomical mouth area.','restSample':rest,'samples':samples,'summary':summary,'qa':qa,'unresolved':['SOURCE_MOUTH_RIM_NOT_BIOLOGICAL_GAPE','PROJECTED_AREA_NOT_FLOW_AREA','VERTEX_MEAN_NOT_ANATOMICAL_CENTER','EYE_AREA_CENTROIDS_NOT_ORBIT_CENTERS','SIDE_CONTROLS_NOT_APPROVED_OPERCULUM','REAL_LENGTH_AGE_GROWTH_UNKNOWN']}
 (o/'oral-evidence.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));(o/'ORAL_QA.json').write_text(json.dumps(qa,indent=2));print(json.dumps(qa,indent=2));print('METRIC_RANGES',json.dumps(summary));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--canonical',required=True);p.add_argument('--parts',required=True);p.add_argument('--head',required=True);p.add_argument('--out',required=True);p.add_argument('--head-code');a=p.parse_args();run(a.canonical,a.parts,a.head,a.out,a.head_code)
