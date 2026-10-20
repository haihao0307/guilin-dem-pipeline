#!/usr/bin/env python3
"""Restore the pinned original cloth dependency closure without editing it."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--from-cache', type=Path, help='Exact MP05 R10 source directory')
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
lock = json.loads((root / 'sources.lock.json').read_text())

def matches(data, row):
    return (len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
            and hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['gitBlobSHA1'])

def restore(row):
    path = Path(row['path'])
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('Unsafe locked path')
    output = root / 'upstream' / path
    if output.is_file() and matches(output.read_bytes(), row):
        return 'verified'
    if args.verify_only:
        raise ValueError('Source mismatch or missing file: ' + str(path))
    if args.from_cache:
        data = (args.from_cache / path).read_bytes()
    else:
        if not row['url'].startswith('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'):
            raise ValueError('Unexpected upstream source')
        with urllib.request.urlopen(row['url'], timeout=45) as response:
            data = response.read()
    if not matches(data, row):
        raise ValueError('Digest mismatch: ' + str(path))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    return 'restored'

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    states = list(pool.map(restore, lock['files']))
print(json.dumps({'files': len(states), 'sourceBytes': sum(row['bytes'] for row in lock['files']),
                  'allHashesMatched': True, 'modifiedOriginalSources': False}))
