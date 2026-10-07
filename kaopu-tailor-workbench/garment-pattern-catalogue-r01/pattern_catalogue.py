"""Live, pinned GarmentCode programs. Output is analytic paper, never a fitted shell.
MIT original: Maria Korosteleva. Adapter: local workbench integration, 2026.
"""
from pathlib import Path
import sys,json,copy,math,time,hashlib,contextlib,io,os
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'runtime'))
import numpy as np
import yaml
import pygarment as pyg
from assets.bodies.body_params import BodyParameters
from assets.garment_programs.meta_garment import MetaGarment
UPSTREAM_COMMIT='d449629979028123a5c4dc9e732a2ec19b7fce31'
DEFAULT=yaml.safe_load((ROOT/'runtime/assets/design_params/default.yaml').read_text())['design']
REQUIRED_BODY=['height','head_l','waist','waist_back_width','hips','hip_back_width','hips_line','bust','back_width','bust_points','bum_points','neck_w','waist_line','waist_over_bust_line','bust_line','shoulder_w','armscye_depth','arm_length','wrist','shoulder_incl','arm_pose_angle','hip_inclination','crotch_hip_diff','leg_circ']

class PatternError(ValueError):
    pass

def _set(d,path,val):
    p=path.split('.')
    for k in p[:-1]:d=d[k]
    d[p[-1]]['v']=val

def _leaves(d,prefix=''):
    for k,v in d.items():
        p=f'{prefix}.{k}' if prefix else k
        if isinstance(v,dict) and 'v' in v:yield p,v
        elif isinstance(v,dict):yield from _leaves(v,p)

def parameterSchema():
    """All original design controls; ranges are sampling ranges, not fit certificates."""
    return {'schema':'garmentcode-parameter-schema@1','sourceCommit':UPSTREAM_COMMIT,
      'bodyUnits':'cm; angles degrees','patternUnits':'mm','domainMeaning':'upstream sampling ranges only; 2D and 3D gates are separate',
      'activationNotes':[
       'shirt.length/width/flare affect Shirt; FittedShirt uses body-fitting rules instead',
       'shirt.strapless and left.shirt.strapless require FittedShirt',
       'left.* controls require left.enable_asym; original source then disables paneled collar components and shares global shirt length and collar depths',
       'Square/Angle armholes are source-supported only for sleeveless garments; sewn sleeves force ArmholeCurve',
       'smoothing_coeff affects ArmholeAngle; ArmholeCurve ignores that coefficient',
       'Bezier X/Y controls require Bezier2NeckHalf; angle and flip controls depend on the chosen neckline shape',
       'Turtle/Hood2Panels and SimpleLapel override some neckline choices in the original source',
       'Cuff detail controls require a selected cuff type; standing shoulder length requires standing_shoulder',
       'GodetSkirt and SkirtLevels also consume parameters of their selected base/level skirt families',
       'FittedShirt combinations force full lower rise; source clamps several geometric controls based on current body dimensions'
      ],'requiredBodyCm':REQUIRED_BODY,'tree':copy.deepcopy(DEFAULT),
      'parameters':[dict(path=p,default=v['v'],type=v['type'],samplingRange=copy.deepcopy(v['range']),choices=(list(dict.fromkeys(v['range']+([None] if v['type']=='select_null' else []))) if v['type'].startswith('select') else None),nullable=v['type']=='select_null',defaultProbability=v.get('default_prob'),physicalDomain=None) for p,v in _leaves(DEFAULT)]}

def _preset(upper=None,bottom=None,wb=None,**params):
    return {'meta.upper':upper,'meta.bottom':bottom,'meta.wb':wb,**params}

STYLE_DEFS=[
 ('Shirt','upper','bodice.py',_preset(upper='Shirt')),
 ('FittedShirt','upper','bodice.py',_preset(upper='FittedShirt')),
 ('Pants','lower','pants.py',_preset(bottom='Pants',wb='StraightWB',**{'pants.length':.9})),
 ('Skirt2','lower','skirt_paneled.py',_preset(bottom='Skirt2',wb='StraightWB')),
 ('PencilSkirt','lower','skirt_paneled.py',_preset(bottom='PencilSkirt',wb='FittedWB')),
 ('SkirtManyPanels','lower','skirt_paneled.py',_preset(bottom='SkirtManyPanels',wb='StraightWB')),
 ('SkirtCircle','lower','circle_skirt.py',_preset(bottom='SkirtCircle',wb='StraightWB')),
 ('AsymmSkirtCircle','lower','circle_skirt.py',_preset(bottom='AsymmSkirtCircle',wb='StraightWB')),
 ('GodetSkirt','lower','godet.py',_preset(bottom='GodetSkirt',wb='StraightWB')),
 ('SkirtLevels','lower','skirt_levels.py',_preset(bottom='SkirtLevels',wb='StraightWB')),
 ('LongSleeve','sleeve','sleeves.py',_preset(upper='Shirt',**{'sleeve.sleeveless':False,'sleeve.length':1.0})),
 ('Strapless','upper-variant','bodice.py',_preset(upper='FittedShirt',**{'shirt.strapless':True})),
 ('AsymmetricShirt','upper-variant','bodice.py',_preset(upper='Shirt',**{'left.enable_asym':True,'left.sleeve.sleeveless':False,'left.sleeve.length':.8})),
 ('Turtle','collar','collars.py',_preset(upper='Shirt',**{'collar.component.style':'Turtle'})),
 ('SimpleLapel','collar','collars.py',_preset(upper='Shirt',**{'collar.component.style':'SimpleLapel'})),
 ('Hood2Panels','collar','collars.py',_preset(upper='Shirt',**{'collar.component.style':'Hood2Panels'})),
 *[(s,'cuff','bands.py',_preset(upper='Shirt',**{'sleeve.sleeveless':False,'sleeve.length':1.,'sleeve.cuff.type':s})) for s in ['CuffBand','CuffSkirt','CuffBandSkirt']],
 *[(s,'waistband','bands.py',_preset(bottom='Pants',wb=s)) for s in ['StraightWB','FittedWB']],
 ('MetaGarmentDress','composition','meta_garment.py',_preset(upper='FittedShirt',bottom='Skirt2',wb='StraightWB')),
 ('MetaGarmentJumpsuit','composition','meta_garment.py',_preset(upper='FittedShirt',bottom='Pants',wb='StraightWB',**{'pants.length':.9})),
]

def listStyles():
    return [dict(id=i,family=f,sourceFile='assets/garment_programs/'+s,defaultDesign={'style':i},overrides=copy.deepcopy(p),
      sourceStatus='live-official-generator',patternValidation='see per-invocation validation',physicalValidation='not-certified',
      note='Component styles use an explicit parent garment; no standalone unsewable decoration') for i,f,s,p in STYLE_DEFS]

def normalize_design(given):
    given=copy.deepcopy(given or {})
    if not isinstance(given,dict):raise PatternError('design must be an object')
    d=copy.deepcopy(DEFAULT)
    style=given.pop('style',None)
    if style is not None:
        found=next((p for i,_,_,p in STYLE_DEFS if i==style),None)
        if found is None:raise PatternError(f'Unknown style: {style}')
        for p,v in found.items():_set(d,p,v)
    def apply(v,p=''):
        if p and p in known:
            val=v.get('v') if isinstance(v,dict) and 'v' in v else v
            meta=known[p];typ=meta['type']
            if typ in ['float','int']:
                if isinstance(val,bool) or not isinstance(val,(int,float)) or not math.isfinite(val):raise PatternError(f'{p} must be a finite number')
                if typ=='int' and int(val)!=val:raise PatternError(f'{p} must be an integer')
            elif typ=='bool':
                if not isinstance(val,bool):raise PatternError(f'{p} must be boolean')
            elif val not in meta['range'] and not (typ=='select_null' and val is None):raise PatternError(f'Unsupported selection {p}={val}')
            if typ in ['float','int'] and not min(meta['range'])<=val<=max(meta['range']):raise PatternError(f'{p} outside original sampling range {meta["range"]}')
            _set(d,p,val);return
        if not isinstance(v,dict):raise PatternError(f'Unknown design parameter: {p}')
        for k,x in v.items():
            nxt=f'{p}.{k}' if p else k
            if not any(q==nxt or q.startswith(nxt+'.') for q in known):raise PatternError(f'Unknown design parameter: {nxt}')
            apply(x,nxt)
    known=dict(_leaves(DEFAULT));apply(given)
    return d

def _walk(comp):
    yield comp
    if hasattr(comp,'_get_subcomponents'):
        for c in sorted(comp._get_subcomponents(),key=lambda x:x.name):yield from _walk(c)

def _jsonable(x):
    if isinstance(x,np.ndarray):return x.tolist()
    if isinstance(x,np.generic):return x.item()
    raise TypeError(type(x).__name__)

def _canon(x):return json.dumps(x,sort_keys=True,separators=(',',':'),default=_jsonable,allow_nan=False)

def _signed_area(poly):return sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(poly,poly[1:]+poly[:1]))/2

def _intersections(points):
    # Vectorized strict proper intersections. Contact/collinearity are separately retained for review.
    p=np.asarray(points,dtype=float);q=np.roll(p,-1,axis=0);v=q-p;n=len(p)
    cross=lambda a,b:a[...,0]*b[...,1]-a[...,1]*b[...,0]
    den=cross(v[:,None,:],v[None,:,:]);delta=p[None,:,:]-p[:,None,:]
    safe=np.where(np.abs(den)>1e-9,den,1.)
    t=cross(delta,v[None,:,:])/safe;u=cross(delta,v[:,None,:])/safe
    valid=(np.abs(den)>1e-9)&(t>1e-7)&(t<1-1e-7)&(u>1e-7)&(u<1-1e-7)
    valid=np.triu(valid,2);valid[0,-1]=False
    return np.argwhere(valid).tolist()

def _sample_curve(curve,length_mm,tol_mm=.1):
    points=[]
    def point(t):
        q=curve.point(t);return np.array([q.real*10,q.imag*10])
    def recurse(t0,t1,a,b,depth=0):
        d=b-a;ll=float(np.dot(d,d));dev=0.
        for f in [.25,.5,.75]:
            q=point(t0+(t1-t0)*f);u=float(np.dot(q-a,d))/ll if ll else 0
            dev=max(dev,float(np.linalg.norm(q-(a+max(0,min(1,u))*d))))
        if depth<18 and (dev>tol_mm or np.linalg.norm(d)>8):
            tm=(t0+t1)/2;m=point(tm);recurse(t0,tm,a,m,depth+1);recurse(tm,t1,m,b,depth+1)
        else:points.append(a.tolist())
    recurse(0,1,point(0),point(1));points.append(point(1).tolist());return points

def generatePattern(request):
    started=time.perf_counter()
    body=copy.deepcopy(request.get('bodyCm',{}))
    missing=[x for x in REQUIRED_BODY if x not in body]
    if missing:raise PatternError('Missing bodyCm fields: '+', '.join(missing))
    for k,v in body.items():
        if isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v):raise PatternError(f'Nonfinite bodyCm.{k}')
    for k in REQUIRED_BODY:
        if k not in ['shoulder_incl','arm_pose_angle','hip_inclination'] and body[k]<=0:raise PatternError(f'bodyCm.{k} must be positive')
    if body['height']-body['head_l']-body['waist_line']-body['hips_line']<=0:raise PatternError('Invalid body vertical proportions')
    design=normalize_design(request.get('design'))
    if not design['meta']['upper']['v'] and not design['meta']['bottom']['v']:raise PatternError('MetaGarment requires an upper or lower garment')
    if design['meta']['bottom']['v'] in ['SkirtCircle','AsymmSkirtCircle','SkirtManyPanels'] and not (design['meta']['upper']['v'] or design['meta']['wb']['v']):raise PatternError('Official heavy skirt rule requires an upper or waistband')
    # No hidden default anthropometry: all inputs supplied; official derived fields evaluated verbatim.
    bp=object.__new__(BodyParameters);bp.params=copy.deepcopy(body);bp.eval_dependencies()
    captured=io.StringIO()
    previous_cwd=os.getcwd()
    os.chdir(ROOT/'runtime')
    try:
      with contextlib.redirect_stdout(captured):
        garment=MetaGarment('generated',bp,copy.deepcopy(design))
        garment.assert_non_empty();garment.assert_skirt_waistband();garment.assert_total_length()
        assembled=garment.assembly()
    finally:
      os.chdir(previous_cwd)
    oracle=json.loads(_canon(assembled.spec))
    comps=list(_walk(garment));objects={c.name:c for c in comps if isinstance(c,pyg.Panel)}
    panels=[];errors=[];warnings=[];edge_lookup={}
    for name,p in sorted(oracle['pattern']['panels'].items()):
        obj=objects[name];vs=[[float(q)*10 for q in v] for v in p['vertices']]
        edges=[];poly=[];continuity=[]
        for j,e in enumerate(p['edges']):
            raw=copy.deepcopy(e);curve=copy.deepcopy(e.get('curvature'))
            if curve and curve['type']=='circle':curve['params'][0]*=10
            ob=obj.edges[j];c=ob.as_curve();length=float(ob.length())*10
            points=_sample_curve(c,length)
            poly.extend(points[:-1])
            edge={'id':f'e{j}','index':j,'endpoints':e['endpoints'],'kind':curve['type'] if curve else 'line',
              'curvature':curve,'curvatureCoordinates':('relative-to-chord' if curve['type']!='circle' else 'mm-radius-svg-flags') if curve else None,
              'sourceCurvatureCm':e.get('curvature'),'lengthMm':length,'label':e.get('label'),
              'sampledPointsMm':points,'samplingMaxNominalStepMm':8,'samplingChordDeviationMm':.1}
            if edge['kind'] in ['quadratic','cubic']:
                edge['controlPointsMm']=[[float(v.real)*10,float(v.imag)*10] for v in c.bpoints()[1:-1]]
            if edge['kind']=='circle':edge['arc']={'centerMm':[float(c.center.real)*10,float(c.center.imag)*10],'radiusMm':float(abs(c.radius.real))*10,'startAngleDegrees':float(c.theta),'sweepDegrees':float(c.delta)}
            gap=math.dist(vs[e['endpoints'][1]],vs[p['edges'][(j+1)%len(p['edges'])]['endpoints'][0]])
            continuity.append(gap)
            if length<1e-5:errors.append({'panel':name,'edge':j,'code':'DEGENERATE_EDGE'})
            if gap>1e-5:errors.append({'panel':name,'edge':j,'code':'OPEN_BOUNDARY','gapMm':gap})
            edges.append(edge);edge_lookup[(name,j)]=edge
        area=_signed_area(poly)
        crosses=_intersections(poly) if request.get('validateIntersections',True) else None
        if abs(area)<1e-3:errors.append({'panel':name,'code':'DEGENERATE_AREA'})
        if crosses:errors.append({'panel':name,'code':'SAMPLED_SELF_INTERSECTION','segmentPairs':crosses})
        panels.append({'id':name,'verticesMm':vs,'edges':edges,'boundary':list(range(len(edges))),
          'placement':{'translationMm':[v*10 for v in p['translation']],'rotationDegreesXYZ':p['rotation'],'rotationConvention':'intrinsic XYZ (scipy uppercase XYZ)',
          'matrix3':obj.rotation.as_matrix().tolist()},'grain':{'direction2D':[0,1],'source':'adapter local +Y convention; upstream provides no fabric grain field'},
          'role':p.get('label'),'seamAllowanceMm':0,'seamAllowanceSource':'not included in upstream cutting line',
          'signedAreaMm2':area,'winding':'ccw' if area>0 else 'cw','maxBoundaryGapMm':max(continuity),'selfIntersectionDiagnostic':{'method':'adaptive 0.1mm quarter/midpoint chord deviation, max8mm chords; strict proper crossings','crossings':crosses}})
    # Preserve gathering coefficients from live interfaces before reducing to serialized edge pairs.
    gather_map={}
    def coeff(interface,i):
        return next((float(sec['coeff']) for sec in interface.ruffle if sec['sec'][0]<=i<sec['sec'][1]),1.)
    for comp in comps:
        for rule in comp.stitching_rules.rules:
            for i,(ea,eb) in enumerate(zip(rule.int1.edges,rule.int2.edges)):
                key=(rule.int1.panel[i].name,ea.geometric_id,rule.int2.panel[i].name,eb.geometric_id)
                gather_map[key]={'ruffleCoefficientA':coeff(rule.int1,i),'ruffleCoefficientB':coeff(rule.int2,i),
                    'projectedLengthAMm':float(rule.int1.projecting_lengths()[i])*10,
                    'projectedLengthBMm':float(rule.int2.projecting_lengths()[i])*10,
                    'interfaceFlipA':bool(rule.int1.needsFlipping(i)),'interfaceFlipB':bool(rule.int2.needsFlipping(i))}
    # Original serialized stitching direction is opposite unless right_wrong explicitly requests same.
    seams=[]
    for i,s in enumerate(oracle['pattern']['stitches']):
        a,b=s[:2];ea=edge_lookup[(a['panel'],a['edge'])];eb=edge_lookup[(b['panel'],b['edge'])]
        same=len(s)>2 and s[2]=='right_wrong'
        dart=a['panel']==b['panel']
        seams.append({'id':f's{i}','a':{'panelId':a['panel'],'edge':a['edge'],'reverse':False},
          'b':{'panelId':b['panel'],'edge':b['edge'],'reverse':not same},'direction':'same' if same else 'opposite',
          'rightWrong':same,'lengthAMm':ea['lengthMm'],'lengthBMm':eb['lengthMm'],'easeMm':ea['lengthMm']-eb['lengthMm'],
          'lengthRatioAOverB':ea['lengthMm']/eb['lengthMm'],'gathering':gather_map.get((a['panel'],a['edge'],b['panel'],b['edge'])),'isDart':dart,'stageId':'darts' if dart else 'assembly','sourceStitchIndex':i})
    for seam in seams:
        g=seam['gathering']
        if g and abs(g['projectedLengthAMm']-g['projectedLengthBMm'])>3:
            warnings.append({'code':'PROJECTED_SEAM_LENGTH_MISMATCH','seam':seam['id'],
                'differenceMm':g['projectedLengthAMm']-g['projectedLengthBMm'],
                'meaning':'Exceeds upstream verbose warning threshold (3mm); retained unchanged for downstream assembly/fit review'})
    # Retain original high-level interface gathering and flipping, which serialized JSON drops.
    interfaces=[]
    for c in comps:
        for n,it in (sorted(c.interfaces.items()) if isinstance(c.interfaces,dict) else enumerate(c.interfaces)):
            interfaces.append({'component':c.name,'name':n,'edges':[{'panelId':p.name,'edge':e.geometric_id,'reverse':bool(it.needsFlipping(i))} for i,(p,e) in enumerate(zip(it.panel,it.edges))],
              'ruffleSections':copy.deepcopy(it.ruffle),'projectedLengthsMm':(it.projecting_lengths()*10).tolist(),'rightWrong':it.right_wrong})
    result={'schema':'kaopu-analytic-sewing-pattern@1','units':'mm','source':{'repository':'https://github.com/maria-korosteleva/GarmentCode','commit':UPSTREAM_COMMIT,'license':'MIT','generator':'official Python garment programs live execution','sourceGeometryModified':False,
      'runtimePatch':'wrappers.py optional rendering/system-info imports are lazy; original VisPattern class and all geometry code unchanged'},
      'bodyCm':body,'derivedBodyCm':bp.params,'design':design,'panels':panels,'seams':seams,'interfaces':interfaces,
      'darts':[s['id'] for s in seams if s['isDart']],
      'stages':[{'id':'darts','purpose':'close same-panel dart edge pairs'},{'id':'assembly','purpose':'stitch paired panel edges; downstream may subdivide stages'}],
      'officialOracleCm':oracle,'validation':{'analytic2DPass':(not errors) if request.get('validateIntersections',True) else None,'intersectionCheckRun':request.get('validateIntersections',True),'errors':errors,'warnings':warnings,'physicalFitStatus':'not-run','continuousDomainCertified':False,'originalRules':{'nonEmpty':True,'heavySkirtWaistSupport':True,'totalLength':True}},
      'diagnostics':{'stdout':captured.getvalue(),'generationMs':(time.perf_counter()-started)*1000}}
    result['recipeHash']=hashlib.sha256(_canon({'bodyCm':body,'design':design}).encode()).hexdigest()
    result['geometryHash']=hashlib.sha256(_canon({'panels':oracle['pattern']['panels'],'stitches':sorted(oracle['pattern']['stitches'],key=_canon)}).encode()).hexdigest()
    return json.loads(_canon(result))

def generateOfficialOracleCm(request):
    """Independently instantiate the official source classes in the current backend.
    No analytic-mm adapter or panel sampling is used on this path.
    """
    body=copy.deepcopy(request['bodyCm'])
    for k in REQUIRED_BODY:
        if k not in body or isinstance(body[k],bool) or not isinstance(body[k],(float,int)) or not math.isfinite(body[k]):
            raise PatternError(f'Missing or invalid bodyCm.{k}')
    bp=object.__new__(BodyParameters);bp.params=body;bp.eval_dependencies()
    design=normalize_design(request['design'])
    previous_cwd=os.getcwd();os.chdir(ROOT/'runtime')
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            garment=MetaGarment('generated',bp,copy.deepcopy(design))
            garment.assert_non_empty();garment.assert_skirt_waistband();garment.assert_total_length()
            oracle=garment.assembly().spec
        return json.loads(_canon(oracle))
    finally:os.chdir(previous_cwd)

if __name__=='__main__':
    request=json.load(sys.stdin)
    try:
        response=parameterSchema() if request.get('op')=='parameterSchema' else listStyles() if request.get('op')=='listStyles' else generatePattern(request)
        print(json.dumps(response,default=_jsonable,allow_nan=False))
    except BaseException as e:
        print(json.dumps({'error':{'type':type(e).__name__,'message':str(e)}}));sys.exit(1)
