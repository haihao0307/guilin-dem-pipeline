"""Conditional full-input-domain frame openings from directed pin intervals.

No train/source geometry writes. The actual finite retained rod profile is
intersected with each fixed full-thickness frame slab. Where its endpoint and
all eye disks are proved away from the slab, the only crossing is its finite
capsule's interior strip. This strip has z=az+(x-ax)*slope ±width*sqrt(1+slope²).
All arithmetic in the section enclosure is directed 60-digit Decimal. These
are conservative domain bounds, NOT claimed globally minimal contours.
"""
import importlib.util,json,math,hashlib,argparse,subprocess,sys
from pathlib import Path
from decimal import Decimal as D
HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--model',type=Path)
parser.add_argument('--resolve-only',action='store_true')
parser.add_argument('--regenerate-pin-boxes',action='store_true')
args=parser.parse_args()
MODEL=args.model.resolve() if args.model else next((p for p in [HERE.parent,HERE.parent/'r29'] if (p/'scene.js').exists()),None)
if MODEL is None or not (MODEL/'scene.js').exists(): raise SystemExit('Model not found; supply --model /absolute/path/to/r29')
TOPOLOGY=next((p for p in [MODEL/'installation-topology-study',HERE.parent/'installation-topology-study',HERE.parent/'installation-topology-r29-study'] if (p/'side_offset_solver.js').exists()),None)
if TOPOLOGY is None: raise SystemExit('Side-offset solver package not found beside selected model')
if args.resolve_only:
    print(json.dumps({'model':str(MODEL),'topology':str(TOPOLOGY),'intervalModule':str(MODEL/'gresley-reconstruction/certify_input_domain.py'),'frameHosts':str(HERE/'FRAME_HOSTS.json'),'stackParts':str(MODEL/'stack-reconstruction/PARTS_REFERENCE.json'),'pinBoxes':str(TOPOLOGY/'CONDITIONAL_PIN_BOXES.json')}))
    raise SystemExit(0)
spec=importlib.util.spec_from_file_location('directed',MODEL/'gresley-reconstruction/certify_input_domain.py')
lib=importlib.util.module_from_spec(spec);spec.loader.exec_module(lib)
I=lib.I
hosts=json.loads((HERE/'FRAME_HOSTS.json').read_text())
parts=json.loads((MODEL/'stack-reconstruction/PARTS_REFERENCE.json').read_text())
boxes_path=TOPOLOGY/'CONDITIONAL_PIN_BOXES.json'
if args.regenerate_pin_boxes or not boxes_path.exists():
    subprocess.run([sys.executable,str(TOPOLOGY/'certify_input_box.py'),'--model',str(MODEL)],check=True)
domains=json.loads(boxes_path.read_text())

def part_x_bounds(part,pins):
    if part['kind']=='rod':keys=part['joints'];r=I(max(part['width'],part['eye']))
    elif part['kind']=='ring':keys=[part['joint']];r=I(part['outer'])
    else:keys=[part['joint']];r=I(part['radius'])
    return (I(min(pins[k][0].lo for k in keys))-r).lo,(I(max(pins[k][0].hi for k in keys))+r).hi

def outward_float(x,sign):return math.nextafter(float(x),-math.inf if sign<0 else math.inf)
def export_range(lo,hi):return [outward_float(lo,-1),outward_float(hi,+1)]

def run():
    result=[]
    for row in domains:
        coverage={h['id']:{} for h in hosts};crossings=0;excluded=0
        for cell in row['cells']:
            pins={k:[I(*b['x']),I(*b['z'])] for k,b in cell['pins'].items()}
            for h in hosts:
                slab=I(*h['slab'])
                for part in parts:
                    xmin,xmax=part_x_bounds(part,pins)
                    if xmax<slab.lo or xmin>slab.hi:excluded+=1;continue
                    assert part['kind']=='rod',('Unexpected non-lever frame-slab crossing',part['id'],cell['cell'],h['id'])
                    points=[pins[k] for k in part['joints']];a,b=points[:2]
                    if a[0].lo>b[0].hi:a,b=b,a
                    r=I(part['width']);eye=I(part['eye'])
                    assert (a[0]+r).hi<slab.lo and (b[0]-r).lo>slab.hi,('Finite capsule does not provably straddle slab',part['id'],cell['cell'])
                    assert all((p[0]+eye).hi<slab.lo or (p[0]-eye).lo>slab.hi for p in points),('Eye disk may cross slab',part['id'],cell['cell'])
                    slope=(b[1]-a[1])/(b[0]-a[0])
                    line=a[1]+(slab-a[0])*slope
                    radial=r*(1+slope.sq()).sqrt()
                    zlo=(line-radial).lo;zhi=(line+radial).hi
                    c=coverage[h['id']].setdefault(part['id'],{'zlo':D('Infinity'),'zhi':D('-Infinity'),'y':part['y'],'minWitness':None,'maxWitness':None,'cellCount':0})
                    if zlo<c['zlo']:c['zlo']=zlo;c['minWitness']=cell['cell']
                    if zhi>c['zhi']:c['zhi']=zhi;c['maxWitness']=cell['cell']
                    c['cellCount']+=1;crossings+=1
        openings=[]
        for h in hosts:
            for pid,b in coverage[h['id']].items():
                y=I(*b['y']);pad=I('.003001');expandedY=y+I(-pad.hi,pad.hi);expandedZ=I(b['zlo'],b['zhi'])+I(-pad.hi,pad.hi)
                yr=export_range(expandedY.lo,expandedY.hi);zr=export_range(expandedZ.lo,expandedZ.hi)
                ligaments={'below':yr[0]-.73,'above':1.68-yr[1],'behind':zr[0]-3.65,'ahead':6.10-zr[1]}
                assert min(ligaments.values())>0
                openings.append({'hostId':h['id'],'partId':pid,'frameSlab':h['slab'],'required':True,'minimumRectangularEnvelope':None,'conservativeDomainEnvelope':{'y':b['y'],'z':export_range(b['zlo'],b['zhi'])},'opening':{'y':yr,'z':zr},'exactDecimalZEnvelope':[str(b['zlo']),str(b['zhi'])],'inferredClearanceM':.003,'numericalPadM':.000001,'continuousCoverage':True,'coverageCondition':'independent outside spindle inputs in [4.02,4.18]^2; exact-real finite solver with config below','phaseContinuumProved':False,'projectionMethod':'directed interval enclosure of actual capsule strip over full X slab; every eye disk and finite end cap excluded by strict X bounds','minWitnessCell':b['minWitness'],'maxWitnessCell':b['maxWitness'],'cellsCrossing':b['cellCount'],'ligaments':ligaments,'historicalDimensions':False,'structuralAcceptance':False})
        result.append({'middleX':row['middleX'],'config':row['config'],'inputDomain':row['inputSpindleZBox'],'cells':len(row['cells']),'openings':openings,'framePartCellChecks':len(row['cells'])*len(hosts)*len(parts),'excludedFramePartCells':excluded,'analyticallyBoundedStripCells':crossings,'nonLeverFrameCrossings':0,'cellCoverageAllKeysVerified':len({tuple(c['cell']) for c in row['cells']})==4096,'upstreamAllPhaseInputBoxProof':False,'wholeTrainAcceptance':False,'structuralAcceptance':False})
    report={'conditionalFrameSectionEnclosurePass':True,'sourcePinBoxesSHA256':hashlib.sha256(boxes_path.read_bytes()).hexdigest(),'arithmetic':'60-digit directed-outward Decimal, correctly rounded sqrt widened one step; binary export nextafter outward','noGeometryWrites':True,'separateSlotsPreserveBetweenLeverLigament':True,'results':result}
    (HERE/'CONDITIONAL_APERTURE_CERTIFICATE.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':run()
