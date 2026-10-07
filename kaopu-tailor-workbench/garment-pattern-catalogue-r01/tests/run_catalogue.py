import sys,json,time,traceback
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pattern_catalogue import *
ROOT=Path(__file__).resolve().parents[1];body=json.loads((ROOT/'examples/body-anny-cm.json').read_text());rows=[]
changes={'Shirt':{'shirt.length':1.35},'FittedShirt':{'collar.width':.3},'Pants':{'pants.length':.75},'Skirt2':{'skirt.length':.35},'PencilSkirt':{'pencil-skirt.length':.5},'SkirtManyPanels':{'flare-skirt.skirt-many-panels.n_panels':7},'SkirtCircle':{'flare-skirt.suns':1.2},'AsymmSkirtCircle':{'flare-skirt.asymm.front_length':.7},'GodetSkirt':{'godet-skirt.num_inserts':6},'SkirtLevels':{'levels-skirt.num_levels':3},'LongSleeve':{'sleeve.length':.8},'Strapless':{'collar.fc_depth':.5},'AsymmetricShirt':{'left.sleeve.length':.5},'Turtle':{'collar.component.depth':5},'SimpleLapel':{'collar.component.depth':5},'Hood2Panels':{'collar.component.hood_depth':1.2},'CuffBand':{'sleeve.cuff.cuff_len':.2},'CuffSkirt':{'sleeve.cuff.skirt_flare':1.5},'CuffBandSkirt':{'sleeve.cuff.skirt_fraction':.7},'StraightWB':{'waistband.width':.3},'FittedWB':{'waistband.width':.3},'MetaGarmentDress':{'skirt.length':.4},'MetaGarmentJumpsuit':{'pants.length':.8}}
for style in listStyles():
 row={'style':style['id']};a=None
 for case,design in [('default',{'style':style['id']}),('changed',{'style':style['id'],**changes[style['id']]})]:
  try:
   result=generatePattern({'bodyCm':body,'design':design});(ROOT/f'examples/{style["id"]}-{case}.json').write_text(json.dumps(result,separators=(',',':')))
   row[case]={'ok':result['validation']['analytic2DPass'],'panels':len(result['panels']),'seams':len(result['seams']),'darts':len(result['darts']),'generationMs':result['diagnostics']['generationMs'],'geometryHash':result['geometryHash'],'errors':result['validation']['errors']}
   if case=='default':a=result['geometryHash']
   else:row['geometryChanged']=a!=result['geometryHash']
  except BaseException as e:row[case]={'ok':False,'exception':type(e).__name__,'message':str(e)}
 rows.append(row);print(json.dumps(row),flush=True)
 (ROOT/'reports/catalogue-coverage.json').write_text(json.dumps({'sourceCommit':UPSTREAM_COMMIT,'body':'anny-adult-neutral-r01','cases':rows},indent=2))
