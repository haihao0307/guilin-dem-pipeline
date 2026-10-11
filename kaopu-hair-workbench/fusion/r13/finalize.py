from pathlib import Path
import json,os,hashlib
p=Path(__file__).parent
m=json.loads((p/'BUILD_MANIFEST.json').read_text())
for name in ['candidate','public']:
 r=json.loads((p/'evidence'/name/'report.json').read_text());assert r['success'];m[name+'Checks']=len(r['checks'])
assert hashlib.sha256((p/'public-lite.html').read_bytes()).hexdigest()==m['htmlSha256']
m.update(publicBrowserVerified=True,publicPreview=os.environ['PUBLIC_URL'],validation='Actual Chromium/SwiftShader; 1280x1000 desktop 64k and 390x844 mobile viewport 36k. Not actual-device FPS or cinematic acceptance.')
(p/'PUBLIC_URL.txt').write_text(os.environ['PUBLIC_URL']+'\n');(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
