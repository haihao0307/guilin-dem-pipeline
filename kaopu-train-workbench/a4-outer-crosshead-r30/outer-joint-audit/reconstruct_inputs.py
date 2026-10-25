"""Restore exact audit JSON bytes from bounded Git transport chunks; no math changes."""
from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent
for e in json.loads((P/'TRANSPORT_INDEX.json').read_text()):
 b=b''.join((P/n).read_bytes()for n in e['chunks'])
 assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256']
 target=(P/e['path']).resolve();assert P in target.parents
 target.write_bytes(b)
print('Exact audit transport reconstruction verified')
