from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parent
manifest=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
for item in manifest['files']:
    p=root/item['path']
    assert p.is_file(), item['path']
    assert p.stat().st_size==item['bytes'], item['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'], item['path']
base=root/'SOURCE_SNAPSHOT/workbenches/landscape-surface-r5/index.html'
k2=root/'SOURCE_SNAPSHOT/workbenches/landscape-surface-r5-k2/index.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'
assert hashlib.sha256(k2.read_bytes()).hexdigest()=='919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709'
state=json.loads((root/'CURRENT_STATE.json').read_text(encoding='utf-8'))
assert state['macroGeometryChanged'] is False
assert state['visualApproved'] is False
print(json.dumps({'ok':True,'files':len(manifest['files']),'candidateSha256':state['latestCandidateSha256']},ensure_ascii=False,indent=2))
