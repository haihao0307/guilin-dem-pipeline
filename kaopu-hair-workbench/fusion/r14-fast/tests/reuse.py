"""Restore the exact already-verified HTML; never rebuild or change the renderer.
An incomplete CI job is not promoted to success: its partial report is retained,
then a fresh real browser finishes every missing cache/retry/mobile check.
"""
from pathlib import Path
import shutil,json,hashlib
p=Path('kaopu-hair-workbench/fusion/r14-fast');a=Path('/tmp/l02-exact-candidate')
for n in ['site/index.html','bundle.js','ASSET_MANIFEST.json','BUILD_MANIFEST.json','evidence/candidate/report.json']:
    assert (a/n).is_file(),n
h=hashlib.sha256((a/'site/index.html').read_bytes()).hexdigest()
assert h=='bd1668502411fa074796ef8d851e75aa0044862d6b5ec9ee0c393438b2f0433c'
r=json.loads((a/'evidence/candidate/report.json').read_text())
assert r['success'] is False and len(r['checks'])==24 and all(c['pass'] for c in r['checks'])
assert 'page.reload: Timeout 30000ms exceeded.' in r['failure']
for style in ['textured-fringe','side-flow','curtain-layer']:
    assert r['pixels'][style]['changedChannels']==0
    assert r['arraySHA'][style]==r['arraySHA']['reference'][style]
shutil.copytree(a,p,dirs_exist_ok=True)
shutil.copytree(a/'evidence/candidate',p/'evidence/prior-partial',dirs_exist_ok=True)
m=json.loads((p/'ASSET_MANIFEST.json').read_text())
for spec in m['assets'].values():
    for chunk in spec['chunks']:
        b=(p/'site'/chunk['path']).read_bytes();assert len(b)==chunk['bytes'] and hashlib.sha256(b).hexdigest()==chunk['sha256']
for item in json.loads((p/'UNCHANGED_RUNTIME.json').read_text())['files']:
    assert hashlib.sha256((p/item['path']).read_bytes()).hexdigest()==item['sha256']
(p/'evidence/exact-runtime-reuse.json').write_text(json.dumps({'sourceRun':38339825323,'artifact':11787075837,'htmlSha256':h,'reusedCompletedChecks':24,'priorFailurePreserved':True,'rendererModified':False,'residualChecksMustPassFreshBrowser':True},indent=2))
print('Exact original renderer restored; partial failed-job evidence kept, not promoted.')
