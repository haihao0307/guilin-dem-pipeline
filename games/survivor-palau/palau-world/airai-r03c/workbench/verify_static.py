#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import base64, gzip, hashlib, json

HERE = Path(__file__).resolve().parent
receipt = json.loads((HERE / 'BUILD_RECEIPT.json').read_text(encoding='utf-8'))
parts = sorted(HERE.glob('part-*.txt'))
assert len(parts) == receipt['parts'] == 8, (len(parts), receipt['parts'])
b64 = ''.join(p.read_text(encoding='ascii').strip() for p in parts)
gz = base64.b64decode(b64, validate=True)
html = gzip.decompress(gz)
sha = hashlib.sha256(html).hexdigest()
checks = {
    'fullHtmlBytes': len(html) == receipt['fullHtmlBytes'],
    'gzipBytes': len(gz) == receipt['gzipBytes'],
    'base64Bytes': len(b64) == receipt['base64Bytes'],
    'fullHtmlSha256': sha == receipt['fullHtmlSha256'],
    'worldId': b'PALAU_AIRAI_STONE_MONEY_R03C_FOCUSED' in html,
    'oneWorldQuery': b'window.PalauWorld=' in html and b'PalauWorld.sample' in html,
    'qaExport': b'window.__PALAU_R03C_QA__' in html,
    'noTraditionalLod': receipt['traditionalLOD'] is False,
    'sameWorldField': receipt['sameWorldField'] is True,
    'localTruthQuality': receipt['quantizationQA']['localInteriorRMSEM'] < 0.08,
    'visualNotPreapproved': receipt['visualAcceptance'] is False,
}
report = {
    'version': receipt['version'],
    'passed': all(checks.values()),
    'checks': checks,
    'fullHtmlSha256': sha,
    'bytes': len(html),
}
(HERE / 'STATIC_QA.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report['passed']:
    raise SystemExit(1)
