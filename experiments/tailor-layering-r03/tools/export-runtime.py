#!/usr/bin/env python3
"""Export hashes and only generated text needed to reconstruct this exact build.

The public runtime retains the original upstream Git blobs. Its new authored
files are already stored in the source commit. This read-only log capsule makes
index.html and provenance reviewable without granting the CI token write access.
It is not publication and cannot replace the complete acceptance matrix.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'


def main():
    provenance = json.loads((DIST / 'SOURCE_PROVENANCE.json').read_text())
    entries = []
    for file in sorted(DIST.rglob('*')):
        if not file.is_file():
            continue
        if file.is_symlink():
            raise SystemExit('Refusing a runtime symlink')
        data = file.read_bytes()
        entries.append({'path': file.relative_to(DIST).as_posix(), 'bytes': len(data),
                        'sha': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest(),
                        'sha256': hashlib.sha256(data).hexdigest()})
    generated = {name: base64.b64encode((DIST / name).read_bytes()).decode()
                 for name in ['index.html', 'SOURCE_PROVENANCE.json']}
    capsule = {'schema': 'tailor-layering-runtime-capsule@1',
               'sourceCommit': provenance['sourceCommit'], 'entries': entries,
               'generatedBase64': generated, 'publicationPerformed': False}
    raw = json.dumps(capsule, ensure_ascii=False, separators=(',', ':')).encode()
    output = ROOT / 'evidence' / 'runtime-capsule.json.gz'
    output.parent.mkdir(parents=True, exist_ok=True)
    packed = gzip.compress(raw, mtime=0)
    output.write_bytes(packed)
    encoded = base64.b64encode(packed).decode()
    print('R03_CAPSULE_BEGIN ' + hashlib.sha256(packed).hexdigest())
    for offset in range(0, len(encoded), 6000):
        print('R03_CAPSULE_PART ' + encoded[offset:offset + 6000])
    print('R03_CAPSULE_END ' + str(len(packed)))
    print(json.dumps({'files': len(entries), 'runtimeBytes': sum(row['bytes'] for row in entries),
                      'sourceCommit': capsule['sourceCommit'], 'capsuleBytes': len(packed)}))


if __name__ == '__main__':
    main()
