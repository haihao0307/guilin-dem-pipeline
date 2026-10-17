from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1];entries=json.loads((root/'provenance/PUBLIC_SOURCE_PAYLOAD_LOCK.json').read_text())
for e in entries:
 p=root/e['path'];assert p.stat().st_size==e['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256'],e['path']
print('PASS complete licensed glTF runtime payload:',len(entries),'files')
