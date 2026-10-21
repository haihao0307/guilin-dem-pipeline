import json,math,heapq,hashlib,argparse,itertools
from pathlib import Path
from collections import defaultdict


def normkey(e):
 if e['t']<1e-10:return ('v',e['edge'][0])
 if e['t']>1-1e-10:return ('v',e['edge'][1])
 return tuple(sorted(e['edge']))
def analyze(q,domain,si,nativeanchors=None):
 d=q[domain];s=d['sections'][si];vs={v['id']:v for v in d['vertexSemantics']};nodes={};adj=defaultdict(list);ss=[]
 for seg in s['segments']:
  if not all(vs[i]['csType']==[0] for i in seg['vertexIDs']):continue
  ends=seg['endpoints'];keys=[]
  for e in ends:
   k=normkey(e);keys.append(k);nodes[k]=dict(e)
   if domain=='native':
    a,b=e['edge'];t=e['t'];nodes[k]['sample']={x:vs[a]['sample'][x]*(1-t)+vs[b]['sample'][x]*t for x in ['u','v','red','inner']}
  a,b=keys;adj[a].append((b,seg));adj[b].append((a,seg));ss.append(seg)
 if domain=='native':
  outer=[k for k,n in nodes.items() if n['mouthMM'][1]<-1 and abs(n['sample']['v'])<.1 and n['sample']['red']>.9 and n['attributes']['l19Oral'][0]<.001]
  inner=[k for k,n in nodes.items() if n['mouthMM'][1]<-1 and abs(n['sample']['v'])<.1 and n['sample']['red']>.9 and n['attributes']['l19Oral'][0]>.999]
  start=min(outer,key=lambda k:abs(nodes[k]['sample']['v']));end=min(inner,key=lambda k:abs(nodes[k]['sample']['v']))
 else:
  start=min(nodes,key=lambda k:math.dist(nodes[k]['position'],nativeanchors[0]));end=min(nodes,key=lambda k:math.dist(nodes[k]['position'],nativeanchors[1]))
 dist={start:0};prior={};serial=itertools.count();h=[(0,next(serial),start)];found=False
 while h:
  val,_,k=heapq.heappop(h)
  if val!=dist[k]:continue
  if k==end:found=True;break
  for j,seg in adj[k]:
   x=val+seg['lengthMM']
   if x<dist.get(j,math.inf):dist[j]=x;prior[j]=(k,seg);heapq.heappush(h,(x,next(serial),j))
 if not found:return {'connected':False,'u':s['u'],'start':nodes[start],'end':nodes[end],'reachable':len(dist)},None
 seq=[end];segs=[];k=end
 while k!=start:k,seg=prior[k];seq.append(k);segs.append(seg)
 seq.reverse();segs.reverse();points=[nodes[k] for k in seq];front=[e['mouthMM'][2] for e in points];up=[e['mouthMM'][1] for e in points]
 def angle(a,b):return math.degrees(math.acos(max(-1,min(1,sum(x*y for x,y in zip(a,b))))))
 angles=[angle(a['triangleNormal'],b['triangleNormal']) for a,b in zip(segs,segs[1:])]
 sharp=sorted(zip(angles,range(len(angles))),reverse=True)[:3]
 oral=[e['attributes']['l19Oral'][0] for e in points];mids=[i for i,x in enumerate(oral) if .01<x<.99]
 peak=max(range(len(up)),key=lambda i:up[i]);cum=[0]
 for seg in segs:cum.append(cum[-1]+seg['lengthMM'])
 r={'connected':True,'u':s['u'],'start':points[0],'end':points[-1],'startEndEuclideanMM':math.dist(points[0]['mouthMM'],points[-1]['mouthMM']),'arcLengthMM':dist[end],'segments':len(segs),'peakMouthMM':points[peak]['mouthMM'],'peakOral':oral[peak],'peakArcMM':cum[peak],'frontRangeMM':[min(front),max(front)],'upRangeMM':[min(up),max(up)],'faceNormalStart':segs[0]['triangleNormalMouth'],'faceNormalEnd':segs[-1]['triangleNormalMouth'],'normalEndToEndTurnDegrees':angle(segs[0]['triangleNormal'],segs[-1]['triangleNormal']),'maximumAdjacentNormalTurnDegrees':max(angles),'topTurns':[{'degrees':a,'beforeTriangle':segs[i]['triangle'],'afterTriangle':segs[i+1]['triangle'],'mouthMM':points[i+1]['mouthMM'],'oral':oral[i+1],'sample':points[i+1].get('sample')} for a,i in sharp], 'mixedOralNodes':len(mids),'mixedOralArcRangeMM':[cum[min(mids)],cum[max(mids)]] if mids else None,'mixedOralMouthPoints':[points[i]['mouthMM'] for i in mids], 'triangles':[seg['triangle'] for seg in segs],'pathPoints':[{'mouthMM':e['mouthMM'],'oral':e['attributes']['l19Oral'][0],'sample':e.get('sample')} for e in points], 'vertexIDs':sorted({v for seg in segs for v in seg['vertexIDs']}),'nonmanifoldSectionNodes':sum(len(adj[k])!=2 for k in seq[1:-1])}
 return r,[points[0]['position'],points[-1]['position']]
if __name__ == '__main__':
 parser=argparse.ArgumentParser(description='Measure existing indexed lower-return sections. No anatomical thickness or aesthetic verdict.')
 parser.add_argument('--evidence',type=Path,required=True)
 parser.add_argument('--tags',nargs='+',required=True)
 parser.add_argument('--output',type=Path,required=True)
 args=parser.parse_args()
 result={'schema':'kaopu/lip-edge-indexed-return-sections@1','method':'Independent native and actual-draw edge-connected triangle-plane paths. Native anchors use fixed v/red/oral selection; actual draw anchors are nearest to those positions. No global prefix correspondence inferred.','interpretation':'Section arc and anchor separation are not tissue thickness. A smaller angular jump alone is not visual acceptance.','files':{},'sections':{}}
 for tag in args.tags:
  path=args.evidence/(tag+'-geometry.json');raw=path.read_bytes();q=json.loads(raw)
  result['files'][tag]={'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
  ds={}
  for domain in ['native','draw']:
   assert len(q[domain]['sections'])==3 and all(s['totalSegments']>0 and not s['truncated'] for s in q[domain]['sections'])
   rr=[]
   for i in range(3):
    r,a=analyze(q,domain,i,ds.get('anchors',[None]*3)[i] if domain=='draw' else None)
    assert r['connected'] and r['nonmanifoldSectionNodes']==0,(tag,domain,i)
    rr.append(r)
    if domain=='native':ds.setdefault('anchors',[]).append(a)
   ds[domain]=rr
  del ds['anchors'];result['sections'][tag]=ds
  print(json.dumps({'tag':tag,'native':[{'u':r['u'],'peakMouthMM':r['peakMouthMM'],'maximumAdjacentNormalTurnDegrees':r['maximumAdjacentNormalTurnDegrees'],'arcLengthMM':r['arcLengthMM']} for r in ds['native']]}))
 args.output.write_text(json.dumps(result,indent=2)+'\n')
