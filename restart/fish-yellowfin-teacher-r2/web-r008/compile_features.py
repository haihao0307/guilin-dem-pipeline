"""Source-backed mouth/eye surface feature correspondence. No inferred biological labels.
Selections are frozen in source index/barycentric space and followed through original Swim.
"""
import argparse, hashlib, json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'web-r007'))
from compile_head import compose, slerp, DT
H=lambda b:hashlib.sha256(b).hexdigest()

def closest_triangle(point,tri):
 """Exact triangle projection or one of its three bounded edge projections."""
 a,b,c=tri;ab=b-a;ac=c-a;normal=np.cross(ab,ac);nn=float(normal@normal);choices=[]
 if nn>1e-24:
  projected=point-normal*float((point-a)@normal)/nn
  uv=np.linalg.lstsq(np.column_stack((ab,ac)),projected-a,rcond=None)[0]
  bary=np.array([1-uv.sum(),uv[0],uv[1]])
  if (bary>=0).all():choices.append((bary,projected))
 for j in range(3):
  k=(j+1)%3;e=tri[k]-tri[j];den=float(e@e);t=np.clip(float((point-tri[j])@e)/den,0,1) if den else 0.
  w=np.zeros(3);w[j]=1-t;w[k]=t;choices.append((w,w@tri))
 return min(choices,key=lambda x:float(np.sum((x[1]-point)**2)))

def compile_features(canonical,parts_folder,head_folder,out):
 c,p,h,o=map(Path,[canonical,parts_folder,head_folder,out]);o.mkdir(parents=True,exist_ok=True)
 raw=(c/'teacher-fields.bin').read_bytes();pkg=json.loads((c/'teacher-package.json').read_text());parts=json.loads((p/'parts.json').read_text());head=json.loads((h/'head-evidence.json').read_text())
 assert pkg['sourceArrayAggregate']==head['sourceArrayAggregate']=='5c8abd79a95ad18412acc31a600cce7908cb82c31d1cf020a7927c26fa661e63'
 def field(i):
  d=pkg['fields'][i];return np.frombuffer(raw[d['offset']:d['offset']+d['byteLength']],dtype=DT[d['componentType']]).reshape(d['count'],d['width']).astype(float)
 graph=pkg['objectGraph'];canonical=np.array(pkg['canonicalTransform']).reshape(4,4).T;tracks=pkg['motionFields'][0]['tracks'];curves=[(field(t['timeField']).ravel(),field(t['valueField']))for t in tracks]
 skin=pkg['skeletonGraphs'][0];ibm=field(skin['inverseBindField']).reshape(-1,4,4).transpose(0,2,1);geo=[]
 for s in pkg['surfaces']:
  a=s['vertexFields'];w=field(a['WEIGHTS_0']);w=(w/w.sum(1,keepdims=True)).astype(np.float32).astype(float)
  geo.append((np.c_[field(a['POSITION']),np.ones(pkg['fields'][a['POSITION']]['count'])],field(a['JOINTS_0']).astype(int),w,field(s['faceField']).astype(int).reshape(-1,3)))
 def surface(time):
  values=[{k:np.array(v,dtype=float)for k,v in n['sourceTRS'].items()}for n in graph]
  if time is not None:
   for tr,(ts,vs)in zip(tracks,curves):
    j=int(np.searchsorted(ts,time,side='right'))
    if j==0:v=vs[0]
    elif j==len(ts):v=vs[-1]
    elif tr['interpolation']=='STEP':v=vs[j-1]
    else:
     t=(time-ts[j-1])/(ts[j]-ts[j-1]);v=slerp(vs[j-1],vs[j],t)if tr['property']=='rotation'else vs[j-1]*(1-t)+vs[j]*t
    values[tr['nodeId']][tr['property']]=v
  local=[np.array(n['sourceMatrix']).reshape(4,4).T if n['sourceMatrix']is not None else compose(values[n['id']])for n in graph];world={}
  def visit(i):
   if i not in world:world[i]=(visit(graph[i]['parent'])if graph[i]['parent']is not None else np.eye(4))@local[i]
   return world[i]
  bones=np.array([canonical@visit(i)@ibm[j]for j,i in enumerate(skin['jointNodes'])])
  return [sum(np.einsum('nij,nj->ni',bones[js[:,k]],pos)*w[:,k,None]for k in range(4))[:,:3]for pos,js,w,_ in geo]
 rest=surface(None);mouth=[]
 for seam_id in head['mouthInterfaceSeamIds']:
  seam=parts['seams'][seam_id];side=seam['a']if seam['a']['part']=='head'else seam['b']
  mouth.append({'seamId':seam_id,'mesh':side['mesh'],'sourceVertices':side['vertices']})
 rim_vertices=sorted(set(v for e in mouth for v in e['sourceVertices']));upper=max(rim_vertices,key=lambda v:(rest[0][v,1],-v));lower=min(rim_vertices,key=lambda v:(rest[0][v,1],v))
 head_faces=next(x['sourceTriangles']for x in parts['parts']if x['id']=='head')
 definitions=[]
 def vertex_anchor(key,label,v):
  fi=next(f for f in head_faces if v in geo[0][3][f]);ids=geo[0][3][fi];w=(ids==v).astype(float)
  definitions.append({'id':key,'label':label,'kind':'source_triangle_barycentric','mesh':0,'triangle':fi,'sourceVertices':ids.tolist(),'barycentric':w.tolist(),'selectionRule':'REST_MOUTH_INTERFACE_CANONICAL_Y_EXTREMUM','restPoint':rest[0][v].tolist(),'anatomicalLandmarkApproved':False})
 vertex_anchor('rim_upper','口沿参考点 A',upper);vertex_anchor('rim_lower','口沿参考点 B',lower)
 for eye in ['eye_l','eye_r']:
  probe=next(p for p in head['probeDefinitions']if p['id']==eye);center=np.array(next(p for p in head['restSample']['surfaceProbes']if p['id']==eye)['areaCentroid'])
  definitions.append({'id':eye,'label':('L'if eye.endswith('l')else'R')+' 眼源表面面积中心','kind':'area_centroid','mesh':probe['mesh'],'sourceTriangles':probe['sourceTriangles'],'restPoint':center.tolist(),'anatomicalLandmarkApproved':False})
  candidates=[]
  for fi in head_faces:
   w,pt=closest_triangle(center,rest[0][geo[0][3][fi]]);candidates.append((float(np.sum((pt-center)**2)),fi,w,pt))
  _,fi,w,pt=min(candidates,key=lambda x:(x[0],x[1]))
  definitions.append({'id':eye+'_head','label':('L'if eye.endswith('l')else'R')+' 眼对应头表面点','kind':'source_triangle_barycentric','mesh':0,'triangle':fi,'sourceVertices':geo[0][3][fi].tolist(),'barycentric':w.tolist(),'selectionRule':'NEAREST_HEAD_SOURCE_TRIANGLE_TO_REST_EYE_AREA_CENTROID_THEN_FREEZE_BARYCENTRIC','restPoint':pt.tolist(),'notDynamicNearestPoint':True,'anatomicalLandmarkApproved':False})
 measures=[{'id':'mouth_span','label':'口沿两参考点间距','a':'rim_upper','b':'rim_lower','notBiologicalGape':True},{'id':'eye_l_link','label':'L 眼与头表面对应','a':'eye_l','b':'eye_l_head','notOrbitalMeasurement':True},{'id':'eye_r_link','label':'R 眼与头表面对应','a':'eye_r','b':'eye_r_head','notOrbitalMeasurement':True}]
 def evaluate(time):
  surfaces=rest if time is None else surface(time);points={}
  for d in definitions:
   s=surfaces[d['mesh']]
   if d['kind']=='area_centroid':
    tri=s[geo[d['mesh']][3][d['sourceTriangles']]];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5;point=(tri.mean(1)*area[:,None]).sum(0)/area.sum()
   else:point=np.array(d['barycentric'])@s[d['sourceVertices']]
   points[d['id']]=point.tolist()
  length=sum(float(np.linalg.norm(surfaces[e['mesh']][e['sourceVertices'][1]]-surfaces[e['mesh']][e['sourceVertices'][0]]))for e in mouth)
  return {'time':time,'rest':time is None,'points':points,'distances':{d['id']:float(np.linalg.norm(np.array(points[d['a']])-points[d['b']]))for d in measures},'mouthSourcePolylineLength':length}
 samples=[evaluate(t)for t in head['times']];rest_sample=evaluate(None)
 for d in measures:
  values=[s['distances'][d['id']]for s in samples];imin=int(np.argmin(values));imax=int(np.argmax(values));d['sampledRange']={'min':values[imin],'max':values[imax],'minTime':samples[imin]['time'],'maxTime':samples[imax]['time'],'definition':'209_CLAMPED_ORIGINAL_SWIM_TIMES_ONLY'}
 # Exact duplicate source positions remain separate indices, not welded geometry.
 aliases={}
 for v in rim_vertices:aliases.setdefault(tuple(geo[0][0][v,:3]),[]).append(v)
 report={'version':'FISH_FEATURES_R008','anchors':len(definitions),'measurements':len(measures),'sourceCurveEdges':len(mouth),'sourceRimVertexIds':len(rim_vertices),'coincidentRimIndexGroups':sum(len(a)>1 for a in aliases.values()),'clampedTimes':len(samples),'restSamples':1,'sourceBinaryUnchanged':H(raw)==H((c/'teacher-fields.bin').read_bytes()),'sourceCoordinatesChanged':False,'newMotionCreated':False,'physicalLengthKnown':False,'anatomicalApproval':False,'productionReady':False}
 data={'schema':'kaopu.source-feature-correspondence/1.0','version':report['version'],'sourceArrayAggregate':pkg['sourceArrayAggregate'],'sourceBinarySha256':H(raw),'units':'FRACTION_OF_CANONICAL_TEACHER_LENGTH_NOT_METERS','anchors':definitions,'measurements':measures,'mouthCurve':mouth,'mouthCoincidentIndices':[x for x in aliases.values()if len(x)>1],'times':head['times'],'restSample':rest_sample,'samples':samples,'qa':report,'limits':['Reference rim span is not an approved biological mouth opening or gape angle.','Eye area center is not an anatomical eye center.','Rest-nearest head points retain source barycentric identity through animation, not dynamic nearest distance.','No real length, age or growth inferred; no source surface or original animation replaced.']}
 assert len(definitions)==6 and len(mouth)==24 and len(samples)==209 and all(abs(sum(d['barycentric'])-1)<1e-12 for d in definitions if 'barycentric'in d)
 (o/'feature-evidence.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')));(o/'FEATURE_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));print('RANGES',json.dumps(measures,ensure_ascii=False));return data
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--canonical',required=True);a.add_argument('--parts',required=True);a.add_argument('--head',required=True);a.add_argument('--out',required=True);v=a.parse_args();compile_features(v.canonical,v.parts,v.head,v.out)
