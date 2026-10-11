from pathlib import Path
import json,hashlib,os
p=Path(__file__).parent
m=json.loads((p/'BUILD_MANIFEST.json').read_text())
for mode in ['local','public']:
    r=json.loads((p/'evidence'/mode/'report.json').read_text());assert r['success'],r.get('failure');assert not r['errors'];m[mode+'Checks']=len(r['checks'])
assert hashlib.sha256((p/'public-lite.html').read_bytes()).hexdigest()==m['htmlSha256']
assert hashlib.sha256((p/'female.html').read_bytes()).hexdigest()==m['femaleHtmlSha256']
m['publicBrowserVerified']=True;m['publicPreview']=os.environ['R12_PUBLIC_URL'];m['femaleEntryVerifiedWithoutOriginalAssets']=True
m['validation']='Actual Chromium software WebGL: 1180x900 with 96k roots and 390x844 viewport with 36k roots. Not physical device performance, cinematic appearance, or original-female-model acceptance.'
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));(p/'PUBLIC_URL.txt').write_text(m['publicPreview']+'\n')
