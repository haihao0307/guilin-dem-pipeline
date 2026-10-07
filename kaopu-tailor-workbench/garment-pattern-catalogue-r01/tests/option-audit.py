from pathlib import Path
import sys,json,concurrent.futures,importlib.util
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from pattern_catalogue import *
body=json.loads((ROOT/'examples/body-anny-cm.json').read_text());aud=json.loads((ROOT/'reports/parameter-audit.json').read_text());bases={x['parameter']:x['baseDesign'] for x in aud['cases']}
def run(item):
 p,value=item;design={**bases[p],p:value};row={'parameter':p,'selection':value,'design':design}
 try:
  r=generatePattern({'bodyCm':body,'design':design});row.update(ok=r['validation']['analytic2DPass'],panels=len(r['panels']),seams=len(r['seams']),errors=r['validation']['errors'],geometryHash=r['geometryHash'])
 except BaseException as e:row.update(ok=False,exception=type(e).__name__,message=str(e))
 return row
if __name__=='__main__':
 jobs=[(x['path'],v) for x in parameterSchema()['parameters'] if x['type'].startswith('select') for v in x['samplingRange']];rows=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=2) as ex:
  for row in ex.map(run,jobs):
   rows.append(row);print(json.dumps(row),flush=True);(ROOT/'reports/option-audit.json').write_text(json.dumps({'plannedCases':len(jobs),'cases':rows},indent=2))
