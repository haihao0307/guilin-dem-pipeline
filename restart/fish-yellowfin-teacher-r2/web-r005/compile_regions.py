"""Teacher-index connectivity, source seam graph and appendage-excluded sections.
This analysis never welds, edits or discards the source vertices/triangles.
Names are model-observation candidates, not natural-anatomy approval.
"""
import argparse, collections, hashlib, json, pathlib
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
DEFINITIONS=[
 ('head','头颌外表面',0,[1]),('mouth_inner','口腔内表面',0,[9]),
 ('trunk','轴向躯干 / 尾柄表面',0,[6,13]),
 ('dorsal_front','前背鳍表面（候选）',0,[2,14]),('dorsal_rear','后背鳍表面（候选）',0,[5]),
 ('pectoral_l','L 侧胸鳍表面（候选）',0,[0]),('pectoral_r','R 侧胸鳍表面（候选）',0,[11]),
 ('pelvic_l','L 侧腹鳍表面（候选）',0,[3]),('pelvic_r','R 侧腹鳍表面（候选）',0,[12]),
 ('anal','腹侧后鳍表面（候选）',0,[4]),('finlets_d','背侧小鳍条带',0,[10]),('finlets_v','腹侧小鳍条带',0,[7]),
 ('tail','尾鳍表面',0,[8,15]),('eye_l','L 眼球',1,[0,1]),('eye_r','R 眼球',1,[2,3]),
 ('cornea_l','L 角膜',2,[0,1]),('cornea_r','R 角膜',2,[2,3])]
def compile_regions(folder,out):
 folder=pathlib.Path(folder);out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
 p=json.loads((folder/'teacher-package.json').read_text());binary=(folder/'teacher-fields.bin').read_bytes();h=lambda x:hashlib.sha256(x).hexdigest()
 assert p['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  f=p['fields'][i];return np.frombuffer(binary[f['offset']:f['offset']+f['byteLength']],dtype=DT[f['componentType']]).reshape(f['count'],f['width'])
 surfaces=[];inventories=[]
 for s in p['surfaces']:
  pos=field(s['vertexFields']['POSITION']);cp=field(s['canonicalRestPositionField']);idx=field(s['faceField']).reshape(-1,3);par=np.arange(len(pos))
  def find(a):
   while par[a]!=a:par[a]=par[par[a]];a=par[a]
   return a
  for tri in idx:
   a=find(tri[0])
   for b in tri[1:]:par[find(b)]=a
  labels=np.array([find(a)for a in range(len(pos))]);fl=labels[idx[:,0]]
  components=sorted([np.flatnonzero(fl==a)for a in np.unique(fl)],key=lambda a:int(a.min()))
  surfaces.append(dict(pos=pos,canonical=cp,idx=idx,components=components,weights=field(s['groupWeightField'])))
  inventories.append({'mesh':s['sourceMesh'],'indexedIslands':len(components),'firstTriangleIds':[int(c.min())for c in components]})
 assert [x['indexedIslands']for x in inventories]==[16,4,4]
 parts=[];face_to_part=[np.full(len(s['idx']),-1,dtype=int)for s in surfaces]
 for part_index,(key,label,mi,ci) in enumerate(DEFINITIONS):
  s=surfaces[mi];faces=np.sort(np.concatenate([s['components'][c]for c in ci]));verts=np.unique(s['idx'][faces]);weights=s['weights'][verts].sum(0);top=np.argsort(weights)[::-1];bounds=[s['canonical'][verts].min(0).tolist(),s['canonical'][verts].max(0).tolist()]
  assert (face_to_part[mi][faces]==-1).all();face_to_part[mi][faces]=part_index
  parts.append({'id':key,'index':part_index,'label':label,'mesh':mi,'indexedIslandIds':ci,'sourceTriangles':faces.tolist(),'sourceVertices':verts.tolist(),'bounds':bounds,'centroid':s['canonical'][verts].mean(0).tolist(),'sourceControlSupport':[{'id':int(k),'name':p['controlGroups'][k]['sourceName'],'weightSum':float(weights[k])}for k in top if weights[k]>0],
  'labelBasis':'SOURCE_INDEX_CONNECTIVITY_PLUS_SPATIAL_AND_CONTROL_OBSERVATION','naturalAnatomyApproved':False})
 assert all((x>=0).all()for x in face_to_part)
 by_position=collections.defaultdict(list);boundary_count=0
 for part in parts:
  mi=part['mesh'];s=surfaces[mi];edges=collections.Counter()
  for tri in s['idx'][part['sourceTriangles']]:
   for j in range(3):edges[tuple(sorted((int(tri[j]),int(tri[(j+1)%3]))))]+=1
  for (a,b),count in edges.items():
   if count!=1:continue
   boundary_count+=1;va=tuple(float(x)for x in s['pos'][a]);vb=tuple(float(x)for x in s['pos'][b]);key=tuple(sorted((va,vb)));ab=[a,b]if va<=vb else[b,a]
   by_position[(mi,key)].append({'part':part['id'],'partIndex':part['index'],'mesh':mi,'vertices':ab})
 seams=[];unmatched=0
 for key,edges in by_position.items():
  unique={x['partIndex']for x in edges}
  if len(unique)<2:unmatched+=len(edges);continue
  for ia,a in enumerate(edges):
   for b in edges[ia+1:]:
    if a['partIndex']==b['partIndex']:continue
    sa,sb=surfaces[a['mesh']],surfaces[b['mesh']];assert np.array_equal(sa['pos'][a['vertices']],sb['pos'][b['vertices']]);gap=float(np.linalg.norm(sa['canonical'][a['vertices']]-sb['canonical'][b['vertices']],axis=1).max())
    seams.append({'a':a,'b':b,'canonicalRestEndpoints':sa['canonical'][a['vertices']].tolist(),'restGap':gap,'basis':'EXACT_SOURCE_POSITION_DUPLICATED_INDEX_BOUNDARY','biologicalAttachmentApproved':False})
 axial={part['id']:part for part in parts if part['id']in ['head','trunk']};stations=[];body_n=all_n=0;max_trace=0.
 for old in json.loads((folder/'section-field.json').read_text()):
  segments=[]
  for seg in old['segments']:
   all_n+=1;part=parts[face_to_part[seg['mesh']][seg['triangle']]]
   if part['id'] not in axial:continue
   seg={**seg,'partId':part['id']};s=surfaces[seg['mesh']];recovered=np.array(seg['barycentric'])@s['canonical'][s['idx'][seg['triangle']]]
   max_trace=max(max_trace,float(np.max(abs(recovered-np.array(seg['endpoints'])))));segments.append(seg);body_n+=1
  points=np.array([v for s in segments for v in s['endpoints']]);envelope=None
  if len(points):
   lo=points.min(0);hi=points.max(0);envelope={'dorsal':float(hi[1]),'ventral':float(lo[1]),'lateralMin':float(lo[2]),'lateralMax':float(hi[2]),'centerOfExtents':[(float(lo[i])+float(hi[i]))/2 for i in range(3)],'notMedialAxis':True}
  stations.append({'u':old['u'],'x':old['x'],'sourceSegmentCount':len(old['segments']),'axialSegmentCount':len(segments),'segments':segments,'axialSurfaceEnvelope':envelope})
 pairs=collections.Counter(tuple(sorted((s['a']['part'],s['b']['part'])))for s in seams)
 result={'version':'FISH_PARTS_R005','sourceArrayAggregate':p['sourceArrayAggregate'],'sourceInputFieldSha256':h(binary),'method':'INDEX_CONNECTED_PATCHES_WITH_EXACT_SOURCE_SEAM_PROVENANCE','inventory':inventories,'parts':parts,'faceToPart':[x.tolist()for x in face_to_part],'seams':seams,'seamPairs':[{'parts':list(k),'edges':v}for k,v in sorted(pairs.items())],
 'axialSurfaceParts':['head','trunk'],'axialScope':'Source head exterior and axial trunk patches, excluding mouth interior, eyes, cornea, fins, finlet strips and caudal fin. Not a claim of complete biological torso segmentation.',
 'provisionalLandmarks':[{'part':part['id'],'basis':'SOURCE_COMPONENT_CENTROID_NOT_ANATOMICAL_LANDMARK','position':part['centroid']}for part in parts if part['id'].startswith(('eye','cornea'))],
 'unresolved':['HEAD_NOT_SPLIT_INTO_JAW_OPERCULUM','EYE_CENTROID_NOT_MEASURED_ANATOMICAL_CENTER','AXIAL_EXTENT_MIDLINE_NOT_MEDIAL_AXIS','AUTHOR_RIG_NOT_NATURAL_SKELETON','UNKNOWN_PHYSICAL_LENGTH_AGE_GROWTH'],
 'anatomicalPartitionApproved':False,'stageAComplete':False,'productionReady':False}
 report={'version':result['version'],'sourceTriangles':sum(len(x['idx'])for x in surfaces),'assignedTriangles':sum(len(x['sourceTriangles'])for x in parts),'uniqueParts':len(parts),'rawIndexIslands':sum(x['indexedIslands']for x in inventories),'allTrianglesAssignedExactlyOnce':True,'sourceBinaryUnchanged':h((folder/'teacher-fields.bin').read_bytes())==h(binary),'exactSourceSeamEdges':len(seams),'seamPartPairs':len(pairs),'maxSeamRestGap':max(s['restGap']for s in seams),'boundaryEdges':boundary_count,'unmatchedOrSamePartBoundaryEdges':unmatched,'sectionStations':len(stations),'allSourceSectionSegments':all_n,'axialSectionSegments':body_n,'maxBarycentricTraceError':max_trace,'meshesSimplified':0,'jointsChanged':0,'semanticApproval':False,'stageAComplete':False,'productionReady':False}
 (out/'parts.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));(out/'axial-sections.json').write_text(json.dumps(stations,separators=(',',':')));(out/'PARTS_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));return result,report
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--package',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();compile_regions(a.package,a.out)
