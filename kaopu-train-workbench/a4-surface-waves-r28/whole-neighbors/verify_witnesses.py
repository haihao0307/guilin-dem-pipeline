"""Replay existing points only. Exit 1 intentionally preserves clearance failure.
Use --verify-only for verifier exit 0 when exact-field witness replay succeeds.
"""
import sys,json,hashlib
sys.dont_write_bytecode=True
import numpy as np
from analytic_fields import *
R=json.load(open(HERE/'WITNESSES.json'));F=json.load(open(HERE/'FRAMES.json'))
manifest=json.load(open(HERE/'INPUT_SHA256.json'))
for name,h in manifest.items():assert hashlib.sha256((HERE/'..'/name).read_bytes()).hexdigest()==h,name+' changed'
rows=[]
for row in R['results']:
 w=row['witness']
 if not w:continue
 values=[transformed_scalar(id,np.array(w['xyz']),F[w['phaseIndex']]) for id in row['pair']]
 assert all(v<-1e-8 for v in values),(row['pair'],values)
 assert max(abs(a-b) for a,b in zip(values,w['fieldValues']))<1e-11
 rows.append({'pair':row['pair'],'values':values})
# Independent retained Python cylinder primitive confirms the piston result.
sys.path.insert(0,str((HERE/'../reference').resolve()))
import cylinder_actuation_assembly as ref
piston=next(r for r in R['results'] if r['pair']==['stack_candidate/spindle/M','actuation/middle_piston'])
w=piston['witness'];f=F[w['phaseIndex']]['parts']['actuation/middle_piston'];point=np.array(f['inverseRows'])@w['xyz']+f['inverseOffset']
referenceValue=float(ref.fields(point,.4)['middle_piston'][0]);assert abs(referenceValue-w['fieldValues'][1])<1e-12
out={'witnessReplayPassed':True,'retainedInputHashesMatch':True,'negativePairsReplayed':len(rows),'independentPythonPistonValue':referenceValue,'wholeTrainClearancePassed':False,'expectedExitCode':0 if '--verify-only' in sys.argv else 1}
json.dump(out,open(HERE/'REPLAY_QA.json','w'),indent=2);print(json.dumps(out,indent=2))
sys.exit(out['expectedExitCode'])
