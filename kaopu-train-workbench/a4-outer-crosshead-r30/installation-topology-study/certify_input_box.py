"""Conditional enclosure only: not a proof of outside solver phase containment.
Uses the existing audited directed-Decimal interval primitive without editing it.
Per-cell exported binary floats are widened by nextafter, not rounded inward.
"""
from pathlib import Path
from decimal import Decimal as D
import json, runpy, math, argparse
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--model',type=Path);args=parser.parse_args()
MODEL=args.model.resolve() if args.model else next((p for p in [ROOT.parent/'r29',ROOT.parent] if (p/'scene.js').exists()),None)
if MODEL is None: raise SystemExit('Model not found; supply --model /absolute/path/to/r29')
ns=runpy.run_path(str(MODEL/'gresley-reconstruction/certify_input_domain.py'))
I,circle,add,sub,mul=(ns[n] for n in ['I','circle','add','sub','mul'])
def widened(v): return [math.nextafter(float(v.lo),-math.inf),math.nextafter(float(v.hi),math.inf)]
def certify(ref,cells=64):
 cfg=ref['config'];m=I(cfg['middleX']);O=[I(x) for x in ref['nominal']['O']];r={k:I(v) for k,v in ref['lengths'].items()};off=I(cfg['inputFrontDatumZ']-cfg['outsideSpindleDatumZ'])
 minimum=[D('Infinity')]*3;glo={k:[D('Infinity'),D('Infinity')] for k in ref['pins']};ghi={k:[D('-Infinity'),D('-Infinity')] for k in ref['pins']};rows=[]
 for i in range(cells):
  rz=I(D('4.02')+D('.16')*i/cells,D('4.02')+D('.16')*(i+1)/cells);R=[I(ref['nominal']['R'][0]),rz+off]
  A,hR=circle(O,r['long'],R,r['rightLink'],1);C=sub(O,mul(sub(A,O),I(.5)))
  for j in range(cells):
   lz=I(D('4.02')+D('.16')*j/cells,D('4.02')+D('.16')*(j+1)/cells);L=[I(ref['nominal']['L'][0]),lz+off]
   B,hL=circle(C,r['equalLeft'],L,r['leftLink'],-1);E=sub(C,sub(B,C));hm=r['middleLink'].sq()-(m-E[0]).sq();M=[m,E[1]-hm.sqrt()]
   P={'O':O,'R':R,'L':L,'A':A,'C':C,'B':B,'E':E,'M':M};minimum=[min(a,b.lo) for a,b in zip(minimum,[hR,hL,hm])]
   for k,point in P.items():
    for a in range(2):glo[k][a]=min(glo[k][a],point[a].lo);ghi[k][a]=max(ghi[k][a],point[a].hi)
   rows.append({'cell':[i,j],'pins':{k:{'x':widened(p[0]),'z':widened(p[1])} for k,p in P.items()}})
 global_pins={k:{'x':[str(glo[k][0]),str(ghi[k][0])],'z':[str(glo[k][1]),str(ghi[k][1])]} for k in glo}
 summary={'middleX':cfg['middleX'],'config':cfg,'pass':True,'scope':'conditional exact-real central formulas with retained binary input constants, NOT outside all-phase proof or whole-train clearance','inputSpindleZBox':{'left':[4.02,4.18],'right':[4.02,4.18]},'subboxes':cells*cells,'minimumRadicandsM2':[str(v) for v in minimum],'globalPins':global_pins,'arithmetic':'60-digit Decimal directed arithmetic; sqrt widened by one Decimal step; float exports widened by nextafter','runtimeRoundingErrorCertified':False,'outsideAllPhaseInputContainmentProved':False,'wholeAcceptance':False}
 return summary,{'middleX':cfg['middleX'],'config':cfg,'scope':summary['scope'],'planeY':cfg['planeY'],'inputSpindleZBox':summary['inputSpindleZBox'],'cells':rows}
if __name__=='__main__':
 refs=json.loads((ROOT/'CANDIDATE_REFERENCES.json').read_text());results=[certify(ref) for ref in refs]
 (ROOT/'CONDITIONAL_DOMAIN_CERTIFICATE.json').write_text(json.dumps([r[0] for r in results],indent=2)+'\n')
 (ROOT/'CONDITIONAL_PIN_BOXES.json').write_text(json.dumps([r[1] for r in results],separators=(',',':'))+'\n')
 print(json.dumps([{'middleX':r[0]['middleX'],'subboxes':r[0]['subboxes'],'minimumRadicandsM2':r[0]['minimumRadicandsM2'],'M':r[0]['globalPins']['M'],'wholeAcceptance':False} for r in results],indent=2))
