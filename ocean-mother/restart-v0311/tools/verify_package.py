#!/usr/bin/env python3
"""Verify every manifest entry, detect extras, and optionally repack deterministically."""
from pathlib import Path
import argparse, hashlib, json, re, tempfile, zipfile
from build_single_html import build


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify(root: Path) -> dict:
    m = json.loads((root / 'MANIFEST.json').read_text(encoding='utf-8'))
    expected = set(m['files']) | {'MANIFEST.json'}
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and 'rebuilt' not in p.relative_to(root).parts}
    if actual != expected:
        raise ValueError({'missing': sorted(expected-actual), 'extra': sorted(actual-expected)})
    for rel, spec in m['files'].items():
        data = (root / rel).read_bytes()
        if len(data) != spec['bytes'] or sha(data) != spec['sha256']:
            raise ValueError('Hash mismatch: ' + rel)
    with tempfile.TemporaryDirectory() as td:
        rebuilt = Path(td) / 'index.html'
        digest = build(root, rebuilt)
        if rebuilt.read_bytes() != (root / 'index.html').read_bytes():
            raise ValueError('Source reconstruction is not byte-identical')
    page = (root / 'index.html').read_text(encoding='utf-8')
    token = re.search(r'const ORIGINAL_DEEP_HTML=("(?:[^"\\]|\\.)*");', page)
    if not token:
        raise ValueError('Original deep source missing')
    if json.loads(token.group(1)).encode() != (root / 'frozen-deep/Original_Deep_V001.html').read_bytes():
        raise ValueError('Frozen deep extraction mismatch')
    qa = json.loads((root / 'evidence/R01811_RECOVERY_QA_INHERITED.json').read_text())
    if qa['htmlSha256'] != digest:
        raise ValueError('Inherited QA belongs to another build')
    if any(Path(p).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.glb','.gltf','.fbx','.exr','.hdr'} for p in expected):
        raise ValueError('Unexpected visual asset')
    return {'passed': True, 'filesIncludingManifest': len(expected), 'htmlSha256': digest,
            'sourceRoundtrip': True, 'inheritedQAHashMatched': True,
            'browserRerunPerformed': False, 'visualApproved': False, 'productionApproved': False}


def repack(root: Path, output: Path) -> None:
    if root == output or root in output.parents:
        raise ValueError('Place the output ZIP outside the package root')
    m = json.loads((root / 'MANIFEST.json').read_text())
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in sorted(set(m['files']) | {'MANIFEST.json'}):
            info = zipfile.ZipInfo(m['packageName'] + '/' + rel, (2026,9,5,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100644 << 16)
            z.writestr(info, (root / rel).read_bytes(), compresslevel=9)
    with zipfile.ZipFile(output) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP CRC failure')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--repack', type=Path)
    args = ap.parse_args()
    root = args.root.resolve()
    result = verify(root)
    if args.repack:
        repack(root, args.repack.resolve())
        result['zipSha256'] = sha(args.repack.read_bytes())
    print(json.dumps(result, ensure_ascii=False, indent=2))
