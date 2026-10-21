#!/usr/bin/env python3
"""Package original evidence bytes with a per-file manifest for Git retention.

This preserves file contents, including original browser PNGs and gzipped
observations. Only the archive wrapper metadata is normalized. It makes no
claims about acceptance; reviewers decide from the contained original data.
"""
import argparse
import hashlib
import io
import json
import tarfile
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--spec', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
spec = json.loads(Path(args.spec).read_text())
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
assert not output.exists(), 'Never overwrite a retained evidence archive'
items = {}
for entry in spec['entries']:
    source, prefix = Path(entry['source']).resolve(), entry['prefix']
    assert not Path(prefix).is_absolute() and '..' not in Path(prefix).parts
    if entry.get('membersFromZIP'):
        assert source.is_dir()
        with zipfile.ZipFile(entry['membersFromZIP']) as original_zip:
            names = [name for name in original_zip.namelist() if not name.endswith('/')]
        assert len(set(names)) == len(names)
        paths = []
        for name in sorted(names):
            assert not Path(name).is_absolute() and '..' not in Path(name).parts
            member = source / name
            assert member.resolve().is_relative_to(source) and member.is_file()
            paths.append(member)
    else:
        paths = sorted(source.rglob('*')) if source.is_dir() else [source]
    for file in paths:
        if not file.is_file():
            continue
        assert not file.is_symlink(), 'Evidence symlink rejected'
        relative = file.relative_to(source).as_posix() if source.is_dir() else ''
        name = (prefix.rstrip('/') + ('/' + relative if relative else ''))
        assert name and name not in items and not name.endswith('.transfer.json')
        items[name] = file
manifest = {'schema': 'tailor-original-evidence-archive@1',
            'scope': spec['scope'], 'identity': spec.get('identity', {}),
            'contentsUnmodified': True, 'files': []}
with tarfile.open(output, 'w:xz', preset=6) as archive:
    for name, file in sorted(items.items()):
        data = file.read_bytes()
        info = tarfile.TarInfo(name)
        info.size, info.mode, info.mtime = len(data), 0o644, 0
        archive.addfile(info, io.BytesIO(data))
        manifest['files'].append({'path': name, 'bytes': len(data),
                                  'sha256': hashlib.sha256(data).hexdigest()})
    raw = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    info = tarfile.TarInfo('EVIDENCE_CONTENTS.json')
    info.size, info.mode, info.mtime = len(raw), 0o644, 0
    archive.addfile(info, io.BytesIO(raw))
data = output.read_bytes()
receipt = {'file': str(output), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
           'gitBlobSHA': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest(),
           'fileCount': len(items), 'originalBytes': sum(x['bytes'] for x in manifest['files']),
           'manifest': manifest}
output.with_suffix(output.suffix + '.receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'manifest'}))
