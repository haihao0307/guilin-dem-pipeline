from pathlib import Path
import sys,json,concurrent.futures,functools
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pattern_catalogue import *
ROOT=Path(__file__).resolve().parents[1];BODY=json.loads((ROOT/'examples/body-anny-cm.json').read_text())
@functools.lru_cache(maxsize=256)
def run(s):
 r=generatePattern({'bodyCm':BODY,'design':json.loads(s)});return {'geometryHash':r['geometryHash'],'valid':r['validation']['analytic2DPass'],'errors':r['validation']['errors'],'panels':len(r['panels']),'seams':len(r['seams'])}
def case(item):
 p=item['path'];default=item['default'];base={'style':'Shirt'}
 if p.startswith('meta.'):base={'style':'MetaGarmentDress'}
 elif p.startswith('waistband.'):base={'style':'StraightWB'}
 elif p.startswith('left.'):
  base={'style':'AsymmetricShirt','left.sleeve.sleeveless':False,'left.sleeve.length':.8}
  if p.startswith('left.shirt.'):base={'style':'AsymmetricShirt'}
 elif p.startswith('sleeve.'):base={'style':'LongSleeve'}
 elif p.startswith('skirt.'):base={'style':'Skirt2'}
 elif p.startswith('flare-skirt.'):
  base={'style':'SkirtCircle'}
  if '.skirt-many-panels.' in p:base={'style':'SkirtManyPanels'}
  elif '.asymm.' in p:base={'style':'AsymmSkirtCircle'}
  elif '.cut.' in p:base={'style':'SkirtCircle','flare-skirt.cut.add':True}
 elif p.startswith('godet-skirt.'):base={'style':'GodetSkirt'}
 elif p.startswith('pencil-skirt.'):base={'style':'PencilSkirt'}
 elif p.startswith('levels-skirt.'):base={'style':'SkirtLevels','levels-skirt.num_levels':2}
 elif p.startswith('pants.'):base={'style':'Pants'}
 if '.cuff.' in p:
  pre=p.split('.cuff.')[0];base[pre+'.cuff.type']='CuffBandSkirt'
 if 'armhole_shape' in p:
  pre=p.rsplit('.',1)[0];base[pre+'.sleeveless']=True
 if 'standing_shoulder' in p:
  pre=p.rsplit('.',1)[0];base[pre+'.standing_shoulder']=True;base[pre+'.sleeve_angle']=50
 if 'collar.' in p:
  pre='left.collar' if p.startswith('left.') else 'collar'
  if 'component.' in p:
   base[pre+'.component.style']='Hood2Panels' if 'hood_' in p else 'SimpleLapel'
  elif 'bezier' in p:
   side='b' if p.rsplit('.',1)[-1].startswith('b') else 'f';base[pre+'.'+side+'_collar']='Bezier2NeckHalf';base['collar.bc_depth']=.3
  elif 'angle' in p:
   side='b' if '.bc_' in p else 'f';base[pre+'.'+side+'_collar']='CircleArcNeckHalf';base['collar.bc_depth']=.3
  elif 'flip_curve' in p:
   side='b' if '.b_' in p else 'f';base[pre+'.'+side+'_collar']='CurvyNeckHalf';base['collar.bc_depth']=.3
 if p=='shirt.strapless':base={'style':'FittedShirt'}
 if p=='left.shirt.strapless':base={'style':'FittedShirt','left.enable_asym':True}
 if p.endswith('smoothing_coeff'):
  pre=p.rsplit('.',1)[0];base[pre+'.sleeveless']=True;base[pre+'.armhole_shape']='ArmholeAngle'
 # Baseline value can be preset-specific; compare the control at its baseline value with one alternate.
 normalized=normalize_design(base);cur=dict(_leaves(normalized))[p]['v'] if '_leaves' in globals() else None
 def get(d,p):
  for k in p.split('.'):d=d[k]
  return d['v']
 cur=get(normalized,p)
 rng=item['samplingRange'];typ=item['type']
 if typ=='bool':alt=not cur
 elif typ.startswith('select'):alt=next(x for x in rng if x!=cur)
 else:
  lo,hi=min(rng),max(rng);alt=cur+(hi-lo)*.15
  if alt>hi:alt=cur-(hi-lo)*.15
  if typ=='int':alt=min(hi,max(lo,round(alt)));alt=alt if alt!=cur else min(hi,cur+1) if cur<hi else cur-1
  if 'angle' in p:alt=hi
  if 'standing_shoulder_len' in p:alt=8
  if p.endswith('length') and cur==.9:alt=.75
 row={'parameter':p,'baseDesign':base,'baselineValue':cur,'changedValue':alt}
 try:
  a=run(json.dumps(base,sort_keys=True));changed={**base,p:alt};b=run(json.dumps(changed,sort_keys=True));row.update(baseline=a,changed=b,geometryChanged=a['geometryHash']!=b['geometryHash'],status='changed' if a['geometryHash']!=b['geometryHash'] else 'upstream-inactive-or-clamped')
 except BaseException as e:row.update(status='rejected',exception=type(e).__name__,message=str(e))
 return row
if __name__=='__main__':
 rows=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=2) as pool:
  for row in pool.map(case,parameterSchema()['parameters']):
   rows.append(row);print(json.dumps(row),flush=True);(ROOT/'reports/parameter-audit.json').write_text(json.dumps({'parameterCount':122,'meaning':'One activated-context differential per schema leaf. Not a continuous-domain proof. Rejections and upstream clamping are explicit.','cases':rows},indent=2))
