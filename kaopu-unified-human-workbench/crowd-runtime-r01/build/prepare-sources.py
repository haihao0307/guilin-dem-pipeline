"""Restore exact pinned upstream build inputs; never downloads a moving head."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'build/sources.lock.json').read_text())

def restore(row):
    destination = ROOT / row['path']
    if destination.exists():
        data = destination.read_bytes()
        if len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']:
            return row['path']
    with urllib.request.urlopen(row['url'], timeout=60) as response:
        data = response.read()
    if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError('Pinned source mismatch: ' + row['path'])
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return row['path']

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    restored = list(pool.map(restore, LOCK['files']))
print(json.dumps({'verifiedFiles': len(restored)}))
