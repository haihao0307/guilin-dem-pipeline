"""Pack the built application into deterministic, SHA-verified public chunks."""
from pathlib import Path
import gzip
import hashlib
import json

root = Path(__file__).resolve().parents[1]
data = (root / 'dist/app.js').read_bytes()
compressed = gzip.compress(data, compresslevel=9, mtime=0)
(root / 'payload').mkdir(exist_ok=True)
parts = []
for index, offset in enumerate(range(0, len(compressed), 400000)):
    chunk = compressed[offset:offset + 400000]
    name = f'payload/app-{index:02}.bin'
    (root / name).write_bytes(chunk)
    parts.append({'path': name, 'bytes': len(chunk), 'sha256': hashlib.sha256(chunk).hexdigest()})
manifest = {'schema': 'crowd-runtime-app@1', 'compression': 'gzip',
            'runtimeBytes': len(data), 'runtimeSHA256': hashlib.sha256(data).hexdigest(),
            'compressedBytes': len(compressed), 'parts': parts}
(root / 'APP_MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))
