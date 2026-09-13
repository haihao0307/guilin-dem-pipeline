"""Validate only this small numeric core. Does not approve a rendered asset."""
from pathlib import Path
import hashlib, json, re
root = Path(__file__).resolve().parents[1]
expected = {'AGENTS.md','SKILL.md','platform.json','SOURCES.json','src/policy.js',
            'tests/policy.test.cjs','tools/validate.py'}
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
errors = []
if actual != expected:
    errors.append({'inventory': {'extra':sorted(actual-expected),'missing':sorted(expected-actual)}})
if any(p.is_symlink() for p in root.rglob('*')):
    errors.append('symlinks are not admitted in the clean core')
size = sum(p.stat().st_size for p in root.rglob('*') if p.is_file())
if size > 32768: errors.append('core exceeds current explicit 32 KiB maintenance budget')
c = json.loads((root/'platform.json').read_text(encoding='utf-8'))
for k in ['lodEnabled','textureSamplingEnabled','geometryCameraDependent','geometryDeviceDependent','motionQualitySwitching']:
    if c['rules'].get(k) is not False: errors.append(k)
if c['scope']['boundSourceAssets'] or c['scope']['regionalDataAutoImport']:
    errors.append('regional source binding is active')
if c['asset']['runtimeEntry'] is not None or c['asset']['publicationEnabled']:
    errors.append('unapproved runtime or publisher is active')
if any(c['approvals'].values()): errors.append('unjustified asset approval')
source = (root/'src/policy.js').read_bytes()
if hashlib.sha256(source).hexdigest() != '9f74b605b9912e69f810e13fd02e7718d7fc8ffb497955ed67b0f62cd61d30aa':
    errors.append('retained policy no longer matches the reviewed module')
forbidden = [r'\bfetch\s*\(', r'\b(?:import|require)\s*\(', r'\bsampler(?:2D|3D|Cube)\b',
             r'\b(?:texture|textureSample|texelFetch|texImage2D|DataTexture|TextureLoader)\s*\(']
text = source.decode('utf-8')
for pattern in forbidden:
    if re.search(pattern,text): errors.append({'forbiddenRuntimeApi':pattern})
result = {'schema':'landscape-mother-clean-core-check/1','files':len(actual),'bytes':size,
          'runtimeDemFiles':0,'textureFiles':0,'publisherFiles':0,'errors':errors,
          'assetBuilt':False,'browserExecuted':False,'visualApproved':False}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(1 if errors else 0)
