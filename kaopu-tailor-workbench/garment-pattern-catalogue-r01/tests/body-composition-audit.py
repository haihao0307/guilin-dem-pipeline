from pathlib import Path
import sys,json,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from pattern_catalogue import *
BODY=json.loads((ROOT/'examples/body-anny-cm.json').read_text())
def run(job):
 kind,name,design=job;b=BODY.copy()
 if kind=='body-change':
  for k in ['waist','bust','hips']:b[k]+=2
  b['leg_circ']+=1;b['arm_length']+=1
 row={'kind':kind,'name':name,'design':design}
 try:
  p=generatePattern({'bodyCm':b,'design':design});row.update(ok=p['validation']['analytic2DPass'],panels=len(p['panels']),seams=len(p['seams']),warnings=p['validation']['warnings'],errors=p['validation']['errors'],geometryHash=p['geometryHash'])
  if kind=='body-change':row['geometryChanged']=p['geometryHash']!=json.loads((ROOT/f'examples/{name}-default.json').read_text())['geometryHash']
 except BaseException as e:row.update(ok=False,exception=type(e).__name__,message=str(e))
 return row
if __name__=='__main__':
 jobs=[('body-change',s['id'],s['defaultDesign']) for s in listStyles()]
 for u in ['Shirt','FittedShirt']:
  for l in ['Pants','Skirt2','PencilSkirt','SkirtManyPanels','SkirtCircle','AsymmSkirtCircle','GodetSkirt','SkirtLevels']:
   for wb in [None,'StraightWB','FittedWB']:
    jobs.append(('composition',f'{u}+{wb}+{l}',{'meta.upper':u,'meta.bottom':l,'meta.wb':wb}))
 rows=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=2) as ex:
  for row in ex.map(run,jobs):
   rows.append(row);print(json.dumps(row),flush=True);(ROOT/'reports/body-composition-audit.json').write_text(json.dumps({'plannedCases':len(jobs),'cases':rows},indent=2))
