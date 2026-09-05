#!/usr/bin/env python3
"""Rebuild the exact standalone HTML from its editable inline source files."""
from pathlib import Path
import argparse, hashlib, json


def build(root: Path, output: Path) -> str:
    source = root / 'source'
    spec = json.loads((source / 'source-map.json').read_text(encoding='utf-8'))
    page = (source / 'page.template.html').read_bytes()
    for block in spec['blocks']:
        marker = block['marker'].encode('ascii')
        if page.count(marker) != 1:
            raise ValueError('Missing or duplicate marker: ' + block['marker'])
        page = page.replace(marker, (source / block['file']).read_bytes(), 1)
    digest = hashlib.sha256(page).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(page)
    return digest


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=Path('rebuilt/index.html'))
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    print(build(root, args.output.resolve()))
