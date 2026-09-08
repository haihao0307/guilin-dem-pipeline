"""Create and verify the frozen public R10 source package, using tracked bytes only."""
from pathlib import Path
import hashlib, io, json, subprocess, tempfile, zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REV = '4899a5bfbcb252fe55aad6d412a28c76a582c739'
HTML = 'workbenches/landscape-surface-r10/index.html'
EXPECTED = '528788f5961fb9a61bc2a7d2ecdde13d658c51f778b742b13fb26eeb428678e9'
NAME = 'LandscapeMother_Full_R10_20260908.zip'
sha = lambda b: hashlib.sha256(b).hexdigest()
encode = lambda v: (json.dumps(v, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
archive = subprocess.check_output(['git', 'archive', '--format=zip', REV], cwd=ROOT)
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    payload = {'SOURCE/' + n: source.read(n) for n in source.namelist() if not n.endswith('/')}
assert len(payload) == 264
assert sha(payload['SOURCE/' + HTML]) == EXPECTED
payload['START_HERE.md'] = (HERE / 'README.md').read_bytes()
payload['PACKAGE_BUILDER.py'] = Path(__file__).read_bytes()
manifest = {'sourceCommit': REV, 'status': 'paused-awaiting-user-learning-material',
            'visualApproved': False, 'productionReady': False,
            'files': [{'path': p, 'bytes': len(b), 'sha256': sha(b)} for p, b in sorted(payload.items())]}
payload['MANIFEST.json'] = encode(manifest)
target = HERE / NAME
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    for p, b in sorted(payload.items()):
        item = zipfile.ZipInfo(p, (2026, 9, 8, 0, 0, 0))
        item.compress_type = zipfile.ZIP_DEFLATED
        item.external_attr = 0o100644 << 16
        out.writestr(item, b, compresslevel=9)
with tempfile.TemporaryDirectory(prefix='landscape-r10-verify-') as tmp:
    with zipfile.ZipFile(target) as package:
        assert package.testzip() is None
        for p, b in payload.items():
            assert package.read(p) == b
            assert not Path(p).is_absolute() and '..' not in Path(p).parts
        package.extractall(tmp)
    extracted = Path(tmp) / 'SOURCE'
    subprocess.run(['python', str(extracted / 'workbenches/landscape-surface-r10/build.py')], check=True, cwd=extracted)
    assert sha((extracted / HTML).read_bytes()) == EXPECTED
    for p, b in payload.items():
        if p.startswith('SOURCE/'):
            assert (Path(tmp) / p).read_bytes() == b, p
report = {'sourceCommit': REV, 'archive': NAME, 'bytes': target.stat().st_size,
          'sha256': sha(target.read_bytes()), 'sourceFiles': 264, 'archiveFiles': len(payload),
          'htmlSHA256': EXPECTED, 'crcPassed': True, 'allPayloadHashesPassed': True,
          'extractedR10RebuildIdentical': True, 'allExtractedSourceFilesUnchanged': True,
          'status': 'paused-awaiting-user-learning-material'}
(HERE / 'PACKAGE.json').write_bytes(encode(report))
print(json.dumps(report, indent=2))
