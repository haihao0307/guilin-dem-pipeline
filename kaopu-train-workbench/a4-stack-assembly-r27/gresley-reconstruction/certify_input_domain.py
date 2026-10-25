"""Conservative interval enclosure for the central closure, not outside gear proof.

Directed Decimal rounding encloses the formulas of gresley_solver.js for every
pair of outside spindle positions in [4.02, 4.18] m, independently of phase.
The selected assembly branch has no tangent/sqrt failure throughout that box.
This proves central geometric feasibility conditional on that input box only.
It does not prove the upstream nonlinear outside solver's continuum of phases.
"""
import json
from decimal import Decimal as D, localcontext, ROUND_FLOOR, ROUND_CEILING
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PREC = 60

def rnd(fn, mode):
    with localcontext() as c:
        c.prec = PREC
        c.rounding = mode
        return +fn()

class I:
    def __init__(self, lo, hi=None):
        def dec(x):
            return D.from_float(x) if isinstance(x, float) else D(x)
        self.lo, self.hi = dec(lo), dec(lo if hi is None else hi)
    def __add__(a,b):
        b = b if isinstance(b,I) else I(b)
        return I(rnd(lambda:a.lo+b.lo, ROUND_FLOOR),rnd(lambda:a.hi+b.hi, ROUND_CEILING))
    __radd__ = __add__
    def __neg__(a): return I(a.hi.copy_negate(),a.lo.copy_negate())
    def __sub__(a,b): return a + -(b if isinstance(b,I) else I(b))
    def __rsub__(a,b): return I(b) + -a
    def __mul__(a,b):
        b = b if isinstance(b,I) else I(b)
        vs=[(x,y) for x in (a.lo,a.hi) for y in (b.lo,b.hi)]
        return I(min(rnd(lambda:x*y,ROUND_FLOOR) for x,y in vs),max(rnd(lambda:x*y,ROUND_CEILING) for x,y in vs))
    __rmul__=__mul__
    def __truediv__(a,b):
        b = b if isinstance(b,I) else I(b)
        assert not (b.lo<=0<=b.hi), 'Interval denominator crosses zero'
        return a*I(rnd(lambda:1/b.hi,ROUND_FLOOR),rnd(lambda:1/b.lo,ROUND_CEILING))
    def sq(a):
        if a.lo<=0<=a.hi:
            return I(0,max(rnd(lambda:a.lo*a.lo,ROUND_CEILING),rnd(lambda:a.hi*a.hi,ROUND_CEILING)))
        return a*a
    def sqrt(a):
        assert a.lo>0, 'Square-root interval is not strictly positive'
        with localcontext() as c:
            c.prec=PREC
            # Decimal.sqrt is correctly rounded. Widen by one representable step.
            return I(c.next_minus(c.sqrt(a.lo)),c.next_plus(c.sqrt(a.hi)))
    def js(a): return [float(a.lo),float(a.hi)]

def add(a,b): return [x+y for x,y in zip(a,b)]
def sub(a,b): return [x-y for x,y in zip(a,b)]
def mul(a,s): return [x*s for x in a]
def circle(c,r,d,s,branch):
    v=sub(d,c); distance=(v[0].sq()+v[1].sq()).sqrt()
    a=(r.sq()-s.sq()+distance.sq())/(2*distance)
    h2=r.sq()-a.sq()
    u=[x/distance for x in v]
    return add(add(c,mul(u,a)),mul([-u[1],u[0]],branch*h2.sqrt())),h2

def certify(cells=64):
    ref=json.loads((ROOT/'REFERENCE_CONSTRUCTORS.json').read_text())
    P={k:[I(v[0]),I(v[2])] for k,v in ref['pins'].items()}
    r={k:I(v) for k,v in ref['lengths'].items()}
    ratio=I(ref['ratio']); eq_ratio=I(ref['equalRatio'])
    qa=json.loads((ROOT/'NUMERICAL_QA.json').read_text())
    offL=I(qa['outsideInputOffsets']['left']); offR=I(qa['outsideInputOffsets']['right'])
    minimum={'right_circle_height_squared':D('Infinity'),'left_circle_height_squared':D('Infinity'),'middle_slider_height_squared':D('Infinity')}
    out_lo=D('Infinity');out_hi=D('-Infinity');xlo=D('Infinity');xhi=D('-Infinity')
    for i in range(cells):
        rz=I(D('4.02')+D('.16')*i/cells,D('4.02')+D('.16')*(i+1)/cells)
        R=[P['R'][0],rz+offR]
        A,hR=circle(P['O'],r['long'],R,r['rightLink'],ref['rightBranch'])
        C=sub(P['O'],mul(sub(A,P['O']),ratio))
        for j in range(cells):
            lz=I(D('4.02')+D('.16')*j/cells,D('4.02')+D('.16')*(j+1)/cells)
            L=[P['L'][0],lz+offL]
            B,hL=circle(C,r['equalLeft'],L,r['leftLink'],ref['leftBranch'])
            E=sub(C,mul(sub(B,C),eq_ratio))
            hm=r['middleLink'].sq()-(P['M'][0]-E[0]).sq()
            Mz=E[1]+ref['middleBranch']*hm.sqrt()
            minimum['right_circle_height_squared']=min(minimum['right_circle_height_squared'],hR.lo)
            minimum['left_circle_height_squared']=min(minimum['left_circle_height_squared'],hL.lo)
            minimum['middle_slider_height_squared']=min(minimum['middle_slider_height_squared'],hm.lo)
            out_lo=min(out_lo,Mz.lo);out_hi=max(out_hi,Mz.hi);xlo=min(xlo,E[0].lo);xhi=max(xhi,E[0].hi)
    return {'pass':True,'scope':'conditional central-linkage geometric existence and nonsingularity over an independent outside-input rectangle','input_spindle_z_box_m':{'left':[4.02,4.18],'right':[4.02,4.18]},'subboxes':cells*cells,'arithmetic':'60-digit Decimal directed outward rounding, sqrt widened by adjacent Decimal values','minimum_certified_radicands_m2':{k:str(v) for k,v in minimum.items()},'enclosed_middle_front_z_m':[str(out_lo),str(out_hi)],'enclosed_middle_equal_end_x_m':[str(xlo),str(xhi)],'outside_solver_continuous_all_phase_proof':False,'actual_outside_samples_inside_box':all(4.02<4.1+qa['qRanges'][s][0]<4.1+qa['qRanges'][s][1]<4.18 for s in ['left','right']),'installation_truth_or_collision_clearance_proved':False}

if __name__=='__main__':
    result=certify()
    (ROOT/'CONDITIONAL_DOMAIN_CERTIFICATE.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
