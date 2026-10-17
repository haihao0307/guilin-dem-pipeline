import json,hashlib
from pathlib import Path
r=Path(__file__).resolve().parents[1]
for k,s in json.loads((r/'provenance/PUBLIC_RUNTIME_LOCK.json').read_text()).items():
 for f,h in s['runtimeFiles'].items():assert hashlib.sha256((r/f).read_bytes()).hexdigest()==h,f
 c=json.loads((r/f'source-assets/{k}/object.json').read_text())['content'];assert hashlib.sha256(json.dumps(c,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==s['contentSHA256']
print('PASS both complete licensed runtime payload locks')
