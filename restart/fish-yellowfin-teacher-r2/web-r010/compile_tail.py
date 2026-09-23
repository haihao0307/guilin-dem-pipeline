"""Source tail patch, source attachment edges and unchanged authored motion.
Engineering observations only: an authored node/mesh border is not anatomical approval.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, collections
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
H=lambda b:hashlib.sha256(b).hexdigest()
def run(canonical,parts_path,head_path,out,head_code=None):
 c,p,h,o=map(Path,[canonical,parts_path,head_path,out]);o.mkdir(parents=True,exist_ok=True)
 code=Path(head_code) if head_code else Path(__file__).parent.parent/'web-r007/compile_head.py'
 spec=importlib.util.spec_from_file_location('source_head_r007',code);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 pkg=json.loads((c/'teacher-package.json').read_text());raw=(c/'teacher-fields.bin').read_bytes();parts=json.loads((p/'parts.json').read_text());head=json.loads((h/'head-evidence.json').read_text())
 assert pkg['sourceArrayAggregate']==head['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  f=pkg['fields'][i];return np.frombuffer(raw[f['offset']:f['offset']+f['byteLength']],dtype=DT[f['componentType']]).reshape(f['count'],f['width'])
 graph=pkg['objectGraph'];canon=np.array(pkg['canonicalTransform']).reshape(4,4).T;tracks=pkg['motionFields'][0]['tracks'];arr=[(field(t['timeField']).astype(float).ravel(),field(t['valueField']).astype(float))for t in tracks]
 def pose(t):
  trs=[{k:np.array(v,dtype=float)for k,v in n['sourceTRS'].items()}for n in graph]
  if t is not None:
   for tr,(a,b)in zip(tracks,arr):
    j=int(np.searchsorted(a,t,side='right'))
    if j==0:v=b[0]
    elif j==len(a):v=b[-1]
    else:
     u=(t-a[j-1])/(a[j]-a[j-1]);v=b[j-1]if tr['interpolation']=='STEP'else m.slerp(b[j-1],b[j],u)if tr['property']=='rotation'else b[j-1]*(1-u)+b[j]*u
    trs[tr['nodeId']][tr['property']]=v
  local=[np.array(n['sourceMatrix']).reshape(4,4).T if n['sourceMatrix']is not None else m.compose(trs[n['id']])for n in graph];world={}
  def visit(i):
   if i not in world:world[i]=(visit(graph[i]['parent'])if graph[i]['parent']is not None else np.eye(4))@local[i]
   return world[i]
  for n in graph:visit(n['id'])
  return world
 tail=next(x for x in parts['parts']if x['id']=='tail');assert tail['mesh']==0 and len(tail['sourceTriangles'])==750
 surface=pkg['surfaces'][0];a=surface['vertexFields'];pos=field(a['POSITION']).astype(float);hp=np.c_[pos,np.ones(len(pos))];faces=field(surface['faceField']).reshape(-1,3);ji=field(a['JOINTS_0']).astype(int);weights=field(a['WEIGHTS_0']).astype(float);weights=(weights/weights.sum(1,keepdims=True)).astype(np.float32).astype(float)
 skin=pkg['skeletonGraphs'][0];ibm=field(skin['inverseBindField']).reshape(-1,4,4).transpose(0,2,1).astype(float)
 def deform(world):
  matrices=np.array([canon@world[i]@ibm[k]for k,i in enumerate(skin['jointNodes'])]);return sum(np.einsum('nij,nj->ni',matrices[ji[:,k]],hp)*weights[:,k,None]for k in range(4))[:,:3]
 seam_ids=[i for i,s in enumerate(parts['seams'])if {s['a']['part'],s['b']['part']}=={'tail','trunk'}];assert len(seam_ids)==14
 aliases=collections.defaultdict(set);edges=[]
 for si in seam_ids:
  s=parts['seams'][si];x=s['a']if s['a']['part']=='tail'else s['b'];y=s['b']if s['a']['part']=='tail'else s['a'];edges.append({'seamId':si,'tailVertices':x['vertices'],'trunkVertices':y['vertices']})
  for v in x['vertices']:aliases[tuple(pos[v])].add(v)
 interface=[{'sourceVertex':min(v),'sourceAliases':sorted(v)}for _,v in sorted(aliases.items(),key=lambda kv:min(kv[1]))];root_ids=np.array([v['sourceVertex']for v in interface])
 roots={n['sourceName']:n['id']for n in graph};root=roots['Spine.008_079'];chain=[n['id']for n in graph if n['sourceName'].startswith(('UpperTail','LowerTail'))or n['sourceName']in ['Spine.005_076','Spine.006_077','Spine.007_078','Spine.008_079']];assert len(chain)==12
 controls=[{'node':i,'sourceName':graph[i]['sourceName'],'parent':graph[i]['parent'],'tracks':[t for t in tracks if t['nodeId']==i]}for i in chain];assert sum(len(x['tracks'])for x in controls)==36
 rest_world=pose(None);rest=deform(rest_world);ids=np.array(tail['sourceVertices']);upper=int(ids[np.argmax(rest[ids,1])]);lower=int(ids[np.argmin(rest[ids,1])]);aft=int(ids[np.argmax(rest[ids,0])]);anchors=[{'id':name,'mesh':0,'sourceVertex':v,'sourceTriangles':[int(f)for f in tail['sourceTriangles']if v in faces[f]],'definition':label}for name,v,label in [('upper',upper,'SOURCE_TAIL_REST_CANONICAL_Y_MAX'),('lower',lower,'SOURCE_TAIL_REST_CANONICAL_Y_MIN'),('aft',aft,'SOURCE_TAIL_REST_CANONICAL_X_MAX')]]
 rest_matrix=canon@rest_world[root];axes0=rest_matrix[:3,:3]/np.linalg.norm(rest_matrix[:3,:3],axis=0);max_gap=0.;max_alias=0.;max_ortho=0.;head_error=0.
 def sample(t,hs):
  nonlocal max_gap,max_alias,max_ortho,head_error
  world=pose(t);surf=deform(world);mat=canon@world[root];axes=mat[:3,:3]/np.linalg.norm(mat[:3,:3],axis=0);rotation=axes@axes0.T;max_ortho=max(max_ortho,float(abs(rotation.T@rotation-np.eye(3)).max()));assert max_ortho<1e-6
  ref=np.array(next(n for n in hs['nodes']if n['id']==head['headNode'])['canonicalMatrix']).reshape(4,4).T;head_error=max(head_error,float(abs(ref-canon@world[head['headNode']]).max()))
  points=surf[[upper,lower,aft]];interface_points=surf[root_ids];mean=interface_points.mean(0);offset=(points-mean)@rotation;tri=surf[faces[tail['sourceTriangles']]];area=float(np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1).sum()*.5)
  gap=max(float(np.linalg.norm(surf[e['tailVertices']]-surf[e['trunkVertices']],axis=1).max())for e in edges);max_gap=max(max_gap,gap)
  for group in interface:max_alias=max(max_alias,float(np.linalg.norm(surf[group['sourceAliases']]-surf[group['sourceVertex']],axis=1).max()))
  metrics={'upperLowerSpan':float(np.linalg.norm(points[0]-points[1])),'interfaceMeanToUpper':float(np.linalg.norm(points[0]-mean)),'interfaceMeanToLower':float(np.linalg.norm(points[1]-mean)),'upperFrameLateral':float(offset[0,2]),'lowerFrameLateral':float(offset[1,2]),'sourceTailSurfaceArea':area,'interfaceMaxGap':gap}
  return {'time':t,'rest':t is None,'rootMatrix':mat.T.ravel().tolist(),'controlMatrices':[{'node':i,'matrix':(canon@world[i]).T.ravel().tolist()}for i in chain],'anchorPoints':points.tolist(),'interfacePoints':interface_points.tolist(),'interfaceVertexMean':mean.tolist(),'frameOffsets':offset.tolist(),'metrics':metrics}
 rest_sample=sample(None,head['restSample']);samples=[sample(s['time'],s)for s in head['samples']];summary={k:{'min':min(s['metrics'][k]for s in samples),'max':max(s['metrics'][k]for s in samples),'minIndex':int(np.argmin([s['metrics'][k]for s in samples])),'maxIndex':int(np.argmax([s['metrics'][k]for s in samples]))}for k in rest_sample['metrics']}
 qa={'version':'FISH_TAIL_R010','tailTriangles':750,'tailSourceVertices':len(ids),'interfaceEdges':len(edges),'interfacePositions':len(interface),'interfaceSourceIndices':sum(len(x['sourceAliases'])for x in interface),'controls':len(chain),'sourceTracks':36,'anchors':3,'samples':len(samples),'restSamples':1,'maxInterfaceGap':max_gap,'maxAliasGap':max_alias,'maxFrameOrthogonalityError':max_ortho,'headSourceRegression':head_error,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'physicalLengthKnown':False,'anatomicalPartitionApproved':False,'stageAComplete':False,'independentGenerator':False,'productionReady':False}
 assert max_gap<1e-12 and head_error<1e-12
 data={'schema':'kaopu.source-tail-study/1.0','version':qa['version'],'sourceArrayAggregate':pkg['sourceArrayAggregate'],'sourceBinarySha256':H(raw),'mesh':0,'sourceTriangles':tail['sourceTriangles'],'sourceVertices':tail['sourceVertices'],'rootNode':root,'rootName':graph[root]['sourceName'],'restRootMatrix':rest_matrix.T.ravel().tolist(),'controls':controls,'anchors':anchors,'interfaceVertices':interface,'interfaceEdges':edges,'restSample':rest_sample,'samples':samples,'summary':summary,'qa':qa,'limitations':['Source tail/trunk boundary is not an independently verified anatomical peduncle boundary.','Source rest extrema and vertex mean are engineering probes, not anatomical landmarks.','Frame offsets remove rigid source-root motion; they are not observed swimming thrust or an invented new animation.','Lengths use normalized teacher length; areas use its square. Physical length, age and growth remain unknown.','All original source arrays, 4K textures and full animation curves remain in the parent Teacher Package.']}
 (o/'tail-evidence.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')));(o/'TAIL_QA.json').write_text(json.dumps(qa,indent=2));print(json.dumps(qa,indent=2));return data
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--canonical',required=True);p.add_argument('--parts',required=True);p.add_argument('--head',required=True);p.add_argument('--out',required=True);p.add_argument('--head-code');a=p.parse_args();run(a.canonical,a.parts,a.head,a.out,a.head_code)
