"""R04.2: correct a proven front/back classification bug, not a new cloth system.
Old /back|btorso|_b_/ failed on *_sleeve_b and *_cuff_b, causing front/back
pieces to be placed on the same plane and sewed flat before arm attachment.
Only classification metadata changes; material coordinates, triangle/stitch
order, solver mathematics, source character and static gates stay unchanged.
"""
from pathlib import Path
import gzip,hashlib,json,re
P=Path(__file__).resolve().parent
old='/back|btorso|_b_/'
new='/back|btorso|_b(?:_|$)/'
proof={'schema':'kaopu-panel-side-fix@1','oldRegex':old,'correctedRegex':new,'runtimeBaseline':'1a5f98ff4e345f466b4050f9a6e723f21c04ef18','replacedNumericalSolver':False,'qualityThresholdsChanged':False,'sourcePaperChanged':False,'personChanged':False,'files':{},'affected':[]}
for name in ['native-adapter.mjs','budget-probe.mjs']:
 p=P/'native/kaopu-tailor-workbench/catalogue'/name;s=p.read_text();before=s
 if old in s:
  assert s.count(old)==1
  s=s.replace(old,new)
 else:assert s.count(new)==1
 assert s.replace(new,old)==before.replace(new,old)
 p.write_text(s)
 proof['files'][name]={'beforeSHA256':hashlib.sha256(before.encode()).hexdigest(),'afterSHA256':hashlib.sha256(s.encode()).hexdigest(),'onlyRoleRegexChanged':True}
for path in sorted((P/'assets/papers').glob('*.json.gz')):
 d=json.loads(gzip.decompress(path.read_bytes()))
 changed=[{'panelId':p['id'],'was':'front','now':'back','originalTranslationMm':p['placement']['translationMm']} for p in d['panels'] if re.search(r'_b$',p['id'])]
 if changed:proof['affected'].append({'id':path.name.split('.')[0],'panels':changed,'paperSHA256':hashlib.sha256(path.read_bytes()).hexdigest()})
assert len(proof['affected'])==18
proof['affectedPresetCount']=len(proof['affected']);proof['affectedPanelCount']=sum(len(r['panels']) for r in proof['affected'])
(P/'SIDE_FIX_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
print('SIDE_CLASSIFICATION_CORRECTED',proof['affectedPresetCount'],proof['affectedPanelCount'],flush=True)
