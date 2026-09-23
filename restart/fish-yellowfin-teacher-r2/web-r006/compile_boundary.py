"""Read-only R005 continuation: explain open axial endpoints using original edge identity.
No caps, welding, relabelled anatomy, geometry/rig edits or quantized output coordinates.
"""
import argparse, collections, hashlib, json
from pathlib import Path
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
H=lambda b:hashlib.sha256(b).hexdigest()
def run(canonical, parts_dir, out):
 c,p,o=map(Path,[canonical,parts_dir,out]);o.mkdir(parents=True,exist_ok=True)
 pkg=json.loads((c/'teacher-package.json').read_text());raw=(c/'teacher-fields.bin').read_bytes();parts=json.loads((p/'parts.json').read_text());stations=json.loads((p/'axial-sections.json').read_text())
 def field(i):
  f=pkg['fields'][i];return np.frombuffer(raw[f['offset']:f['offset']+f['byteLength']],dtype=DT[f['componentType']]).reshape(f['count'],f['width'])
 geo=[];edge_faces=collections.defaultdict(list)
 for s in pkg['surfaces']:
  pos=field(s['vertexFields']['POSITION']);faces=field(s['faceField']).reshape(-1,3);cp=field(s['canonicalRestPositionField']);geo.append((pos,faces,cp))
  for fi,tri in enumerate(faces):
   for k in range(3):
    ab=[int(tri[k]),int(tri[(k+1)%3])];key=(s['sourceMesh'],tuple(sorted(tuple(float(v) for v in pos[i]) for i in ab)))
    edge_faces[key].append({'mesh':s['sourceMesh'],'triangle':fi,'vertices':ab,'part':parts['parts'][parts['faceToPart'][s['sourceMesh']][fi]]['id']})
 diag=[];causes=collections.Counter();max_group_span=0.;max_trace_error=0.;classified=collections.Counter()
 for si,st in enumerate(stations):
  nodes=collections.defaultdict(list)
  for j,seg in enumerate(st['segments']):
   for k,pt in enumerate(seg['endpoints']):nodes[tuple(round(float(x),10) for x in pt)].append((j,k))
  degree1=[refs for refs in nodes.values() if len(refs)==1];branch=[refs for refs in nodes.values() if len(refs)>2]
  cls='EMPTY' if not st['segments'] else 'OPEN_OR_BRANCHING' if degree1 or branch else 'CLOSED_DEGREE2'
  classified[cls]+=1;ends=[]
  for refs in nodes.values():
   pts=np.array([st['segments'][j]['endpoints'][k] for j,k in refs]);max_group_span=max(max_group_span,float(abs(pts-pts[0]).max()))
  for refs in degree1+branch:
   j,k=refs[0];seg=st['segments'][j];mi=seg['mesh'];fi=seg['triangle'];bary=seg['barycentric'][k];pos,faces,cp=geo[mi];tri=faces[fi];active=np.flatnonzero(np.array(bary)>1e-10)
   recovered=np.array(bary)@cp[tri];max_trace_error=max(max_trace_error,float(abs(recovered-np.array(seg['endpoints'][k])).max()))
   neighbors=[];ab=[]
   if len(active)==2:
    ab=[int(tri[v]) for v in active];key=(mi,tuple(sorted(tuple(float(v) for v in pos[i]) for i in ab)));neighbors=[x for x in edge_faces[key] if x['triangle']!=fi]
   excluded=[x for x in neighbors if x['part'] not in parts['axialSurfaceParts']]
   if len(refs)>2:reason='BRANCH_OR_OVERLAP_DIAGNOSTIC'
   elif len(active)!=2:reason='SOURCE_VERTEX_EVENT_REQUIRES_REVIEW'
   elif len(neighbors)>1:reason='MULTIPLE_SOURCE_EDGE_NEIGHBORS'
   elif excluded:reason='EXCLUDED_BY_AXIAL_SCOPE'
   elif not neighbors:reason='NO_EXACT_SOURCE_EDGE_COUNTERPART'
   else:reason='INCLUDED_NEIGHBOR_ENDPOINT_REQUIRES_REVIEW'
   causes[reason]+=1;ends.append({'id':len(ends),'mesh':mi,'triangle':fi,'segment':j,'endpoint':k,'point':seg['endpoints'][k],'barycentric':bary,'sourceVertices':[int(v)for v in tri],'sourceEdgeVertices':ab,'part':seg['partId'],'degree':len(refs),'reason':reason,'sourceEdgeNeighbors':neighbors,'excludedNeighbors':excluded,'anatomicalConclusion':None})
  diag.append({'station':si,'u':st['u'],'x':st['x'],'classification':cls,'segments':len(st['segments']),'degreeOne':len(degree1),'branchNodes':len(branch),'ends':ends,'allLines':[x for seg in st['segments'] for x in seg['endpoints']]})
 pair_groups=[]
 for pair in parts['seamPairs']:
  pair_groups.append({'parts':pair['parts'],'seamIds':[i for i,s in enumerate(parts['seams']) if sorted([s['a']['part'],s['b']['part']])==pair['parts']]})
 assert sum(len(x['seamIds']) for x in pair_groups)==216
 head=next(x for x in parts['parts']if x['id']=='head')
 report={'version':'FISH_BOUNDARY_R006','stations':len(diag),'classificationCounts':dict(classified),'endpointReasonCounts':dict(causes),'openEndpointEvents':sum(x['degreeOne']for x in diag),'branchNodes':sum(x['branchNodes']for x in diag),'seamPairs':len(pair_groups),'seamEdges':216,'rawAccessorCount':603,'sourceTriangleCount':7944,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'maxTraceError':max_trace_error,'connectivityGroupingDecimals':10,'maxGroupedEndpointDistanceComponent':max_group_span,'sourceVerticesModified':False,'capsCreated':0,'anatomicalPartitionApproved':False,'stageAComplete':False,'productionReady':False}
 assert report['classificationCounts']=={'CLOSED_DEGREE2':37,'OPEN_OR_BRANCHING':130,'EMPTY':33},'R005 connectivity regression'
 assert report['maxTraceError']<1e-12 and report['sourceBinaryUnchanged']
 data={'schema':'kaopu.source-boundary-evidence/1.0','version':report['version'],'teacherArrayAggregate':pkg['sourceArrayAggregate'],'scope':parts['axialSurfaceParts'],'stations':diag,'seamPairs':pair_groups,'headControlEvidence':head['sourceControlSupport'],'qa':report,'limitations':['CLOSED_DEGREE2 does not establish tissue, solid volume or medial axis.','EXCLUDED_BY_AXIAL_SCOPE identifies an existing adjacent source face, not biological tissue.','NO_EXACT_SOURCE_EDGE_COUNTERPART is not proof of a real anatomical opening.','Rounded keys group diagnostic endpoints only; displayed positions and original fields are never rounded.','Head jaw/operculum labels and scientific landmarks remain unapproved.']}
 (o/'boundary-evidence.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 (o/'BOUNDARY_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));return data
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--canonical',required=True);a.add_argument('--parts',required=True);a.add_argument('--out',required=True);v=a.parse_args();run(v.canonical,v.parts,v.out)
