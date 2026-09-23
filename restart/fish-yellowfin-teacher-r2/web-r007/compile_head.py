"""Read-only head/eye teacher evidence; engineering probes are not approved anatomy.
Pose interpolation follows glTF 2.0 C.3/C.4, with shortest-arc quaternion signs.
Original arrays, source topology, weights, transforms and clip keys remain untouched.
"""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4','FLOAT64':'<f8'}
NAMES=['Head_05','UpperJaw_06','LoweJaw_09','Eye.L_07','Eye.R_08','Side.L_010','Side.R_011']
H=lambda b:hashlib.sha256(b).hexdigest()
def compose(trs):
 x,y,z,w=trs.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 m[:3,:3]*=np.asarray(trs.get('scale',[1,1,1]))[None,:];m[:3,3]=trs.get('translation',[0,0,0]);return m

def slerp(a,b,t):
 dot=float(a@b);direction=1 if dot>=0 else -1;cos=dot*direction;sq=1-cos*cos
 if sq>np.finfo(float).eps:
  sin=math.sqrt(sq);angle=math.atan2(sin,cos);v=a*(math.sin((1-t)*angle)/sin)+b*(direction*math.sin(t*angle)/sin)
 else:
  v=a*(1-t)+b*(t*direction);v=v/np.linalg.norm(v)
 return v

def compile_head(folder,parts_folder,out):
 c,p,o=map(Path,[folder,parts_folder,out]);o.mkdir(parents=True,exist_ok=True)
 pkg=json.loads((c/'teacher-package.json').read_text());raw=(c/'teacher-fields.bin').read_bytes();parts=json.loads((p/'parts.json').read_text())
 assert pkg['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  d=pkg['fields'][i];return np.frombuffer(raw[d['offset']:d['offset']+d['byteLength']],dtype=DT[d['componentType']]).reshape(d['count'],d['width']).astype(float)
 graph=pkg['objectGraph'];name_to_id={n['sourceName']:n['id']for n in graph};ids=[name_to_id[n]for n in NAMES];head_id=ids[0]
 canonical=np.array(pkg['canonicalTransform']).reshape(4,4).T;tracks=pkg['motionFields'][0]['tracks'];track_arrays={}
 for i,t in enumerate(tracks):
  assert t['interpolation']in ['LINEAR','STEP'];track_arrays[i]=(field(t['timeField']).ravel(),field(t['valueField']))
 keys=sorted(set(float(x) for a,_ in track_arrays.values()for x in a));times=sorted(keys+[(a+b)/2 for a,b in zip(keys,keys[1:])]);assert len(keys)==105 and len(times)==209
 def pose(t):
  values=[{k:np.array(v,dtype=float)for k,v in n['sourceTRS'].items()}for n in graph]
  if t is not None:
   for i,tr in enumerate(tracks):
    a,b=track_arrays[i];j=int(np.searchsorted(a,t,side='right'))
    if j==0:v=b[0]
    elif j==len(a):v=b[-1]
    else:
     f=(t-a[j-1])/(a[j]-a[j-1]);v=b[j-1]if tr['interpolation']=='STEP'else slerp(b[j-1],b[j],f)if tr['property']=='rotation'else b[j-1]*(1-f)+b[j]*f
    values[tr['nodeId']][tr['property']]=v
  local=[np.array(n['sourceMatrix']).reshape(4,4).T if n['sourceMatrix'] is not None else compose(values[n['id']])for n in graph];world={}
  def visit(i):
   if i not in world:world[i]=(visit(graph[i]['parent']) if graph[i]['parent']is not None else np.eye(4))@local[i]
   return world[i]
  for i in range(len(graph)):visit(i)
  return values,world
 skin=pkg['skeletonGraphs'][0];ibm=field(skin['inverseBindField']).reshape(-1,4,4).transpose(0,2,1)
 geo=[]
 for s in pkg['surfaces']:
  a=s['vertexFields'];w=field(a['WEIGHTS_0']);w=(w/w.sum(1,keepdims=True)).astype(np.float32).astype(float)
  geo.append((np.c_[field(a['POSITION']),np.ones(pkg['fields'][a['POSITION']]['count'])],field(a['JOINTS_0']).astype(int),w,field(s['faceField']).astype(int).reshape(-1,3)))
 probes=[x for x in parts['parts']if x['id']in ['eye_l','eye_r','cornea_l','cornea_r']]
 def sample(t):
  values,world=pose(t);bone_matrices=np.array([canonical@world[i]@ibm[j]for j,i in enumerate(skin['jointNodes'])]);surfaces=[]
  for pos,js,w,faces in geo:
   surfaces.append(sum(np.einsum('nij,nj->ni',bone_matrices[js[:,k]],pos)*w[:,k,None]for k in range(4))[:,:3])
  markers=[]
  for probe in probes:
   s=surfaces[probe['mesh']];tri=s[geo[probe['mesh']][3][probe['sourceTriangles']]];areas=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5;center=(tri.mean(1)*areas[:,None]).sum(0)/areas.sum()
   markers.append({'id':probe['id'],'areaCentroid':center.tolist(),'area':float(areas.sum())})
  return {'time':t,'rest':t is None,'nodes':[{'id':i,'localTRS':{k:v.tolist()for k,v in values[i].items()},'canonicalMatrix':(canonical@world[i]).T.ravel().tolist()}for i in ids],'surfaceProbes':markers}
 samples=[sample(t)for t in times];rest=sample(None);controls=[]
 for name,i in zip(NAMES,ids):
  g=next(g for g in pkg['controlGroups']if i in g['nodes']);refs=[];signs=0
  for k,t in enumerate(tracks):
   if t['nodeId']!=i:continue
   time,val=track_arrays[k];row={**t,'sourceKeyCount':len(time),'sourceValueSha256':pkg['fields'][t['valueField']]['sha256']}
   if t['property']=='rotation':signs=int(np.count_nonzero(np.sum(val[:-1]*val[1:],axis=1)<0));row['quaternionSignCrossings']=signs
   refs.append(row)
  qs=np.array([next(n for n in s['nodes']if n['id']==i)['localTRS']['rotation']for s in samples]);qs/=np.linalg.norm(qs,axis=1,keepdims=True);angles=2*np.arccos(np.clip(abs(qs@qs[0]),0,1))*180/math.pi
  controls.append({'sourceNode':i,'sourceName':name,'groupId':g['id'],'parentNode':graph[i]['parent'],'sourceTrackRefs':refs,'sourceSupport':[x for x in pkg['groupSupport']if x['group']==g['id']],'maxSampledLocalAngleFromClipStartDeg':float(angles.max()),'quaternionSignCrossings':signs,'biologicalLabel':None,'operculumApproved':False})
 result={'schema':'kaopu.teacher-head-evidence/1.0','version':'FISH_HEAD_R007','sourceArrayAggregate':pkg['sourceArrayAggregate'],'sourceBinarySha256':H(raw),'headNode':head_id,'controls':controls,'probeDefinitions':[{'id':x['id'],'mesh':x['mesh'],'sourceTriangles':x['sourceTriangles'],'definition':'CURRENT_SOURCE_TRIANGLE_AREA_WEIGHTED_CENTROID','notAnatomicalOrbitalCenter':True}for x in probes],'mouthInterfaceSeamIds':[i for i,s in enumerate(parts['seams'])if sorted([s['a']['part'],s['b']['part']])==['head','mouth_inner']],'times':times,'restSample':rest,'samples':samples,'interpolationSpecification':'https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#interpolation','interpolationPolicy':'CLAMP_NON_LOOP_SOURCE_SAMPLES; shortest-arc SLERP; sign of quaternion is not rotation direction','landmarkApproval':False,'anatomicalPartitionApproved':False,'stageAComplete':False,'independentGenerator':False,'productionReady':False}
 assert len(result['mouthInterfaceSeamIds'])==24
 report={'version':result['version'],'sourceKeyTimes':len(keys),'sampleTimes':len(samples),'restSamples':1,'headControls':len(controls),'sourceTrackRefs':sum(len(x['sourceTrackRefs'])for x in controls),'surfaceProbes':len(probes),'mouthSeamEdges':24,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'sourceCoordinatesModified':False,'newAnimationCreated':False,'sideControlsNamedAsOperculum':False,'probeCentroidsNamedAsOrbitalCenters':False,'rotationSummary':[{'sourceName':x['sourceName'],'maxSampledLocalAngleFromClipStartDeg':x['maxSampledLocalAngleFromClipStartDeg'],'quaternionSignCrossings':x['quaternionSignCrossings']}for x in controls],'biologicalApproval':False,'productionReady':False}
 (o/'head-evidence.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));(o/'HEAD_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));return result
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--canonical',required=True);a.add_argument('--parts',required=True);a.add_argument('--out',required=True);v=a.parse_args();compile_head(v.canonical,v.parts,v.out)
