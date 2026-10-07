from pathlib import Path
import json,numpy as np
R=Path(__file__).resolve().parent;O=R/'research';c=json.loads((R/'baseline/kaopu-unified-human-workbench/assets/canonical.json').read_text());F=np.array(c['faces']).reshape(-1,3);U=json.loads((R/'frozen/neck-cotangent.json').read_text())['unknown'];part=F[np.isin(F,U).any(1)];edges={}
for f in part:
 for a,b in zip(f,np.roll(f,-1)):edges.setdefault(tuple(sorted([int(a),int(b)])),[]).append((int(a),int(b)))
nxt={ev[0][0]:ev[0][1]for ev in edges.values()if len(ev)==1};loops=[]
while nxt:
 start=next(iter(nxt));v=start;loop=[]
 while v in nxt:loop.append(v);v=nxt.pop(v)
 assert v==start;loops.append(loop)
def volume(V):
 tri=V[part];value=np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6
 for loop in loops:
  p=V[loop];center=p.mean(0);value+=np.einsum('ij,ij->i',np.roll(p,-1,axis=0),np.cross(p,center)).sum()/6
 return value
rows=[]
for p in sorted((O/'candidate-cases').glob('*-vertices.bin')):
 old=np.fromfile(O/'baseline-cases'/p.name,dtype='<f4').reshape(-1,3).astype(float);new=np.fromfile(p,dtype='<f4').reshape(-1,3).astype(float);a=volume(old);b=volume(new);rows.append({'case':p.stem,'beforeML':a*1e6,'afterML':b*1e6,'deltaML':(b-a)*1e6,'relativePercent':(b/a-1)*100})
report={'boundaryLoops':list(map(len,loops)),'method':'Signed affected-patch volume capped by identical fixed-boundary centroid fans; not whole-body volume','rows':rows,'volumeIsNotExactlyPreserved':True,'interpretation':'A small local volume loss accompanies removal of the ridge; do not compensate by reinstating the old bulge.'};(O/'neck-volume-report.json').write_text(json.dumps(report,indent=2));print('range%',min(r['relativePercent']for r in rows),max(r['relativePercent']for r in rows))
