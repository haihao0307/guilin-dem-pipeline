from __future__ import annotations
import hashlib, json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent
expected_html = 'ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'
html = root / 'SOURCE_SNAPSHOT/workbenches/landscape-surface-r5/index.html'
required = [
    '00_START_HERE.md','01_CURRENT_STATE.md','02_SOURCE_LOCKS.json',
    '03_NONNEGOTIABLES.md','04_NEXT_WORK.md','05_KARST_LIVING_PROCESS.md',
    '06_MICROSCOPE_SUBSTANCE_METHOD.md','07_PUBLIC_ENTRIES.md',
    '08_FAILED_AND_ARCHIVED_ROUTES.md','09_PACKAGE_SCOPE.md',
    '10_USER_DECISIONS.md','CURRENT.json','PACKAGE_MANIFEST.json'
]
missing = [p for p in required if not (root / p).is_file()]
if missing:
    raise SystemExit('missing: ' + ', '.join(missing))
got = hashlib.sha256(html.read_bytes()).hexdigest()
if got != expected_html:
    raise SystemExit(f'accepted workbench hash mismatch: {got}')
current = json.loads((root/'CURRENT.json').read_text(encoding='utf-8'))
assert current['singleAuthoritativePackage'] is True
assert current['acceptedMasterCommit'] == '039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90'
manifest = json.loads((root/'PACKAGE_MANIFEST.json').read_text(encoding='utf-8'))
for item in manifest['files']:
    p = root / item['path']
    if not p.is_file():
        raise SystemExit('manifest missing file: ' + item['path'])
    h = hashlib.sha256(p.read_bytes()).hexdigest()
    if h != item['sha256']:
        raise SystemExit('manifest hash mismatch: ' + item['path'])
print(json.dumps({
    'ok': True,
    'files': len(manifest['files']),
    'acceptedWorkbenchSha256': got,
    'singleAuthoritativePackage': True
}, ensure_ascii=False, indent=2))
