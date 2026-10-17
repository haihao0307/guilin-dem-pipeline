"""Read-only provenance verification; no extraction or execution of downloaded archive scripts."""
from pathlib import Path
import hashlib, io, json, subprocess, urllib.request, zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for relative, digest in json.loads((HERE / 'FILES.sha256.json').read_text()).items():
    assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == digest, 'Uploaded source differs: ' + relative
URL = 'https://github.com/haihao0307/guilin-dem-pipeline/releases/download/train-game-math-r01-20261009/GAME_TEACHER_MATH_HANDOFF_R01.zip'
SHA256 = '6506bbd7a4436e56bda79e441905547fac68def858af8589e82452adfe80e286'
with urllib.request.urlopen(URL, timeout=60) as response:
    data = response.read(10_000_001)
assert len(data) == 2_607_050, f'Unexpected package bytes: {len(data)}'
assert hashlib.sha256(data).hexdigest() == SHA256, 'Archive SHA256 mismatch'
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    assert sum(i.file_size for i in archive.infolist()) < 100_000_000, 'Unexpected uncompressed size'
    assert archive.testzip() is None, 'Archive CRC failed'
    entries = [{'path': i.filename, 'bytes': i.file_size} for i in archive.infolist()]
    for filename in ['assembly_rules.mjs', 'verify_rules.mjs']:
        expected = (HERE / 'source' / filename).read_bytes()
        matching = [n for n in archive.namelist() if n.endswith('/' + filename) or n == filename]
        assert matching and any(archive.read(n) == expected for n in matching), f'Archive/source mismatch: {filename}'
protected = {
    'kaopu-minigame-workbench/index.html': 'd3303611d4ad0f18fd5343248f56f4750f866563',
    'kaopu-minigame-workbench/voxel-train-study': 'e4236493018d971daa4f1155b4c5fae934f8227c',
    'kaopu-minigame-workbench/storm-orb-study': '71b23e6b09aad5c1518700aaed4ffaea7c78df15',
    'kaopu-minigame-workbench/lost-found-bureau': '2643563d327736929161216c409f389b5951679f',
}
for path, expected in protected.items():
    actual = subprocess.check_output(['git', 'rev-parse', 'HEAD:' + path], text=True).strip()
    assert actual == expected, f'Protected tree changed: {path}'
report = {
    'status': 'PASS', 'scope': 'download identity, archive CRC, source-byte identity and protected Git trees',
    'archive_bytes': len(data), 'archive_sha256': SHA256, 'crc': 'PASS', 'entries': entries,
    'protected': protected, 'source_commit': '7ef7fd8d584f1fea32bedf5973d9d1b0e5777086',
    'baseline_commit': 'de9808faf63535f55363b90479001d157b40cfa2',
    'tested_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'public_game_deployed': False, 'browser_visual_acceptance': False,
    'physical_device_tested': False, 'real_railway_control': False,
}
Path('evidence').mkdir(exist_ok=True)
Path('evidence/receipt.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
