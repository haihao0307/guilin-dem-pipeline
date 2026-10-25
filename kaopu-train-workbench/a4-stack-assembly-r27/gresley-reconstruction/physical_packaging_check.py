"""Read retained central source constructors; prove one existing overlap witness.
No shifting/layering of rods, creating hardware, or whole-train conclusions.
"""
import json, math
from pathlib import Path
P=Path(__file__).resolve().parent
ref=json.loads((P/'REFERENCE_CONSTRUCTORS.json').read_text())
def norm(v):return math.sqrt(sum(x*x for x in v))
def sub(a,b):return [x-y for x,y in zip(a,b)]
def capsule(p,a,b,r):
    pa=sub(p,a); ba=sub(b,a)
    h=max(0,min(1,sum(x*y for x,y in zip(pa,ba))/sum(x*x for x in ba)))
    return norm([x-h*y for x,y in zip(pa,ba)])-r
def flat_rod(p,a,b,extra):
    # Exact retained mFlatRod structure and dimensions for both central levers.
    q=p.copy();q[1]=a[1]
    body=min(capsule(q,a,b,.024),norm(sub(q,a))-.033,norm(sub(q,b))-.033,norm(sub(q,extra))-.033)
    holes=min(norm(sub(q,a))-.0135,norm(sub(q,b))-.0135,norm(sub(q,extra))-.0135)
    return max(body,-holes,abs(p[1]-a[1])-.012)
pts=ref['pins']; witness=pts['C'].copy();witness[2]+=.02
f1=flat_rod(witness,pts['A'],pts['C'],pts['O'])
f2=flat_rod(witness,pts['B'],pts['E'],pts['C'])
assert f1<-.006 and f2<-.006
out={'existing_source_collision':True,'modified_geometry':False,'at_theta':.4,'objects':['valve/gresley_two_to_one_lever','valve/gresley_equal_lever'],'witness_m':witness,'source_scalar_values_m':[f1,f2],'guaranteed_common_interior_ball_radius_m':.006,'reason':'Both distinct rigid lever eye annuli share center C and the identical Y = 1.48 +/- 0.012 m slab. This is volumetric rod-on-rod overlap, not just shared pin contact. Each retained scalar is 1-Lipschitz; both are below -0.006 m at the witness.','missing_physical_constraint':'An authoritative axial layer/clevis/spacer/bearing arrangement that separates the lever plates while keeping pin topology is absent from the retained central constructors. No such arrangement was invented.','finite_pin_center_closure_remains_valid':True,'whole_physical_acceptance':False}
(P/'PHYSICAL_PACKAGING_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
