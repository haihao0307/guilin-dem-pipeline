"""Conditional enclosure certificate. Does NOT certify the outside phase solver.

Reuses the retained central finite equations and Decimal-directed arithmetic.
For EVERY independent outside spindle input in [4.02,4.18]^2, subdivisions
bound all pin XZ locations. All non-coaxial candidate pairs are then separated
by finite interval AABBs; coaxial holes/seats and axial gaps are checked from
explicit constant profiles. Intentional material unions are enumerated, never
used as substitutes for a spindle bearing. The uncut candidate is NOT certified.
"""
import importlib.util,json
from pathlib import Path
from decimal import Decimal as D
P=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('source_intervals',P.parent/'gresley-reconstruction/certify_input_domain.py')
lib=importlib.util.module_from_spec(spec);spec.loader.exec_module(lib)
I,add,sub,mul,circle=lib.I,lib.add,lib.sub,lib.mul,lib.circle
source=json.loads((P/'SOURCE_PROFILES.json').read_text());ref=source['reference'];profiles=source['profiles']
design=json.loads((P/'TERMINAL_EYE_CANDIDATE.json').read_text())
parts=json.loads((P/'PARTS_REFERENCE.json').read_text());pairs=json.loads((P/'PAIR_RELATIONS.json').read_text())
qa=json.loads((P.parent/'gresley-reconstruction/NUMERICAL_QA.json').read_text())
fixed={k:[I(v[0]),I(v[2])] for k,v in ref['pins'].items()}
r={k:I(v) for k,v in ref['lengths'].items()};ratio=I(ref['ratio']);eq=I(ref['equalRatio'])
offL=I(qa['outsideInputOffsets']['left']);offR=I(qa['outsideInputOffsets']['right'])
variable=[q for q in pairs if q['type']=='separated_enclosures']
assert not any('FAIL' in q['type'] or 'UNRESOLVED' in q['type'] for q in pairs)
# Recheck every constant relation, using exact Decimal encodings of stored floats.
constant_counts={};minimum_axial=D('Infinity');minimum_radial=D('Infinity')
for q in pairs:
 a,b=[parts[i] for i in q['indices']];typ=q['type'];constant_counts[typ]=constant_counts.get(typ,0)+1
 if typ in ('separated_axially','nominal_axial_boundary'):
  gap=max(D.from_float(a['y'][0])-D.from_float(b['y'][1]),D.from_float(b['y'][0])-D.from_float(a['y'][1]))
  assert gap>=0,(q['ids'],gap)
  if gap>0:minimum_axial=min(minimum_axial,gap)
 elif typ in ('coaxial_radial_clearance','nominal_coaxial_boundary'):
  assert a['joint']==b['joint'];gap=max(D.from_float(a['inner'])-D.from_float(b['outer']),D.from_float(b['inner'])-D.from_float(a['outer']))
  assert gap>=0
  if gap>0:minimum_radial=min(minimum_radial,gap)
 elif typ in ('retained_bore_clearance','nominal_bushing_seat'):
  if a['kind']!='rod':a,b=b,a
  assert b['joint'] in a['joints'] and b['outer']<=a['bore']
 elif typ in ('EXPLICIT_terminal_bore_clearance','nominal_terminal_bushing_seat'):
  if a['kind']!='spindle':a,b=b,a
  assert a['terminalBore'] and a['joint']==b['joint'] and b['outer']<=a['terminalBore']
 elif typ=='proposed_eye_and_drilled_stem_union':
  assert a['body']==b['body'] and {a['kind'],b['kind']}=={'spindle','ring'}
 elif typ!='separated_enclosures':raise AssertionError(typ)

def features(part,points):
 if part['kind']=='ring':ps=[points[part['joint']]];radius=I(part['outer'])
 elif part['kind']=='rod':ps=[points[k] for k in part['joints']];radius=I(max(part['width'],part['eye']))
 else:
  front=points[part['joint']];ps=[[front[0],front[1]-I(profiles['spindles'][part['joint']]['length'])],front];radius=I(part['radius'])
 return ps,radius

def bound(feature):
 ps,radius=feature
 return [I(min(v[j].lo for v in ps))-radius for j in range(2)],[I(max(v[j].hi for v in ps))+radius for j in range(2)]

def separating_projection(fa,fb):
 # Optional directions are exact binary-float constants, not uncertain geometry.
 # Their projections and norm are then evaluated with directed Decimal bounds.
 pa,ra=fa;pb,rb=fb
 mid=lambda p:[float((v.lo+v.hi)/2) for v in p]
 aa=[mid(p) for p in pa];bb=[mid(p) for p in pb];axes=[]
 for ps in (aa,bb):
  if len(ps)>1:
   v=[ps[1][j]-ps[0][j] for j in range(2)];axes.append([-v[1],v[0]])
 axes += [[p[j]-q[j] for j in range(2)] for p in aa for q in bb]
 for axis in axes:
  if sum(v*v for v in axis)<1e-20:continue
  n=[I(v) for v in axis];length=(n[0].sq()+n[1].sq()).sqrt()
  def project(ps,r):
   vs=[p[0]*n[0]+p[1]*n[1] for p in ps];extent=r*length
   return I(min(v.lo for v in vs))-extent,I(max(v.hi for v in vs))+extent
  a,b=project(pa,ra),project(pb,rb);gap=max((a[0]-b[1]).lo,(b[0]-a[1]).lo)
  if gap>0:return (I(gap)/length).lo
 return D('-Infinity')

def certify(cells=64):
 min_projection=D('Infinity');minimum={k:D('Infinity') for k in ['right_circle','left_circle','middle_slider']};worst=None
 for i in range(cells):
  rz=I(D('4.02')+D('.16')*i/cells,D('4.02')+D('.16')*(i+1)/cells);R=[fixed['R'][0],rz+offR]
  A,hR=circle(fixed['O'],r['long'],R,r['rightLink'],ref['rightBranch']);C=sub(fixed['O'],mul(sub(A,fixed['O']),ratio))
  for j in range(cells):
   lz=I(D('4.02')+D('.16')*j/cells,D('4.02')+D('.16')*(j+1)/cells);L=[fixed['L'][0],lz+offL]
   B,hL=circle(C,r['equalLeft'],L,r['leftLink'],ref['leftBranch']);E=sub(C,mul(sub(B,C),eq))
   hm=r['middleLink'].sq()-(fixed['M'][0]-E[0]).sq();M=[fixed['M'][0],E[1]+ref['middleBranch']*hm.sqrt()]
   points={'O':fixed['O'],'R':R,'L':L,'A':A,'C':C,'B':B,'E':E,'M':M}
   feat=[features(part,points) for part in parts];boxes=[bound(f) for f in feat]
   for name,v in [('right_circle',hR),('left_circle',hL),('middle_slider',hm)]:minimum[name]=min(minimum[name],v.lo)
   for pair in variable:
    a,b=[boxes[k] for k in pair['indices']]
    gap=max((a[0][axis]-b[1][axis]).lo for axis in range(2))
    gap=max(gap,max((b[0][axis]-a[1][axis]).lo for axis in range(2)))
    if gap<=0:gap=separating_projection(*[feat[k] for k in pair['indices']])
    assert gap>0,(i,j,pair['ids'],str(gap))
    if gap<min_projection:min_projection=gap;worst={'subbox':[i,j],'ids':pair['ids']}
 return {'conditionalNominalCentralGeometryPass':True,'candidate':design['label'],'inputSpindleZBoxM':{'left':[4.02,4.18],'right':[4.02,4.18]},'subboxes':cells*cells,'arithmetic':'60-digit Decimal, directed outward arithmetic, correctly rounded sqrt widened one Decimal step','allPairs':len(pairs),'variableEnclosurePairs':len(variable),'constantRelationCounts':constant_counts,'minimumCertifiedProjectionSeparationM':str(min_projection),'worstProjectionPair':worst,'minimumConstantAxialSeparationM':str(minimum_axial),'minimumConstantBearingRadialSeparationM':str(minimum_radial),'minimumCertifiedCentralRadicandsM2':{k:str(v) for k,v in minimum.items()},'baselineChanged':False,'terminalBoresExplicitlyRequired':True,'allOutsidePhaseInputsProvenInBox':False,'wholeLocomotiveOrStructuralAcceptance':False,'scope':'Nominal central assembly only, conditional on stated outside input box; no outside continuous phase proof, fixed support, strength, tolerance, locking, valve guide or whole-train clearance claim.'}
if __name__=='__main__':
 result=certify();(P/'CONDITIONAL_STACK_CERTIFICATE.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
