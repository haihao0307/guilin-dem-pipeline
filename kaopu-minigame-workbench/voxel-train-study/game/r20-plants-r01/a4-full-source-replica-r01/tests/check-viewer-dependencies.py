from pathlib import Path
import re,json
root=Path(__file__).resolve().parents[1]
entry=root/'index.html';html=entry.read_text();assert './src/full-a4-viewer.mjs'in html
seen=set()
def clean(p):return re.sub(r'//[^\n]*','',re.sub(r'/\*.*?\*/','',p.read_text(),flags=re.S))
def walk(p):
 if p in seen:return
 seen.add(p);assert p.is_file(),p
 for target in re.findall(r"\bimport\s+[\w*$ {},\n\r\t]+?\s+from\s*['\"]([^'\"]+)['\"]",clean(p)):
  if target=='three':q=root/'vendor/three.module.js'
  elif target.startswith('.'):q=(p.parent/target).resolve()
  else:raise AssertionError(target)
  walk(q)
walk(root/'src/full-a4-viewer.mjs')
s=(root/'src/full-a4-viewer.mjs').read_text();assert "restoreOriginal('a4')"in s and 'source.showAll()'in s;assert 'showClosures('not in s and 'showChassisCandidates('not in s
for p in seen:assert 'https://' not in ''.join(re.findall(r"\bimport\s+[\w*$ {},\n\r\t]+?\s+from\s*['\"]([^'\"]+)['\"]",clean(p)))
r={'status':'PASS_STATIC_ONLY','entry':'index.html','modulesChecked':len(seen),'defaultFullA4':True,'sourceTransformEditedByViewer':False,'browserRuntime':'NOT_RUN_SOCKET_STARTUP_BLOCKED'}
(root/'qa/VIEWER_STATIC_QA.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
