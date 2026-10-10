"""Apply the previously reviewed handoff, then lock parameter input during native solves."""
from pathlib import Path
import base64,gzip,hashlib,json,subprocess,re
P=Path(__file__).resolve().parent
ROOT=P.parents[2]
parts=[(P/'handoff-r0431'/f'patch-{i}.b64').read_text().strip() for i in range(1,5)]
patch=gzip.decompress(base64.b64decode(''.join(parts),validate=True))
assert hashlib.sha256(patch).hexdigest()=='cbb9d95a8501cac56a5bf0327d2fa823fd83900afb3f8e8c87ff2dd021369136'
if not (P/'parameter-request-r0431.mjs').exists():
 subprocess.run(['git','apply','--check','-'],input=patch,cwd=ROOT,check=True)
 subprocess.run(['git','apply','-'],input=patch,cwd=ROOT,check=True)
f=P/'parameters-r043.mjs';s=f.read_text()
if 'workerLocked=false' not in s:
 s=s.replace('busy=false,epoch=0','busy=false,workerLocked=false,epoch=0')
 s=s.replace('input.disabled=busy','input.disabled=busy||workerLocked')
 s=s.replace('if(busy)return','if(busy||workerLocked)return').replace('if(busy)throw','if(busy||workerLocked)throw')
 s=s.replace('waistEaseCm,busy,sourceProgram','waistEaseCm,busy:busy||workerLocked,workerLocked,sourceProgram')
 s=s.replace('.disabled=busy;','.disabled=busy||workerLocked;')
 s=s.replace('return{load,state,generate,synchronize,restoreRequest:', 'return{load,state,generate,synchronize,lock:value=>{const next=!!value;if(next!==workerLocked){workerLocked=next;setBusy(busy);}},restoreRequest:')
 f.write_text(s)
f=P/'app.mjs';s=f.read_text()
if "editor?.lock(['meshing'" not in s:
 s=s.replace("function controls(){const busy=", "function controls(){editor?.lock(['meshing','solving','auditing','paused'].includes(phase));const busy=")
s=s.replace("release:'R04.3.1-local-candidate'","release:'R04.3.1'")
f.write_text(s)
f=P/'index.html';s=re.sub(r'R04\.3(?!\.)','R04.3.1',f.read_text());f.write_text(s)
(P/'R0431_PATCH_PROOF.json').write_text(json.dumps({'handoffPatchSHA256':hashlib.sha256(patch).hexdigest(),'source':'previous local handoff applied on current native branch without reverting newer numerical corrections','extraFix':'parameter editor locks during native solve/audit/pause; request cannot drift while its garment is being computed','bodyModified':False,'sourcePapersModified':False,'reviewThresholdsModified':False,'all60GarmentsAccepted':False},indent=2))
print('HANDOFF_AND_SOLVE_LOCK_APPLIED')
