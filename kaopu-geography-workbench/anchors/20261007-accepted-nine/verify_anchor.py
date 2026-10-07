"""Verify the recorded byte-exact R17 source baseline without rendering claims."""
from pathlib import Path
import argparse, hashlib, json, re
parser=argparse.ArgumentParser()
parser.add_argument('root', type=Path, help='Materialized kaopu-geography-workbench directory')
parser.add_argument('--manifest',type=Path,default=Path(__file__).with_name('accepted-nine-r17.json'))
args=parser.parse_args()
m=json.loads(args.manifest.read_text()); verified=[]; missing=[]; errors=[]
for row in m['files']:
    p=args.root/row['path']
    if not p.is_file():
        missing.append(row['path'])
        if row['bytesLocallyVerified']: errors.append('Required file missing: '+row['path'])
        continue
    b=p.read_bytes()
    blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    if blob!=row['gitBlobSha1']: errors.append('Blob mismatch: '+row['path'])
    if row.get('sha256') and hashlib.sha256(b).hexdigest()!=row['sha256']: errors.append('SHA-256 mismatch: '+row['path'])
    verified.append(row['path'])
page=(args.root/'index.html').read_text()
for key,row in m['cards'].items():
    match=re.search(r'<button class="card" data-scene="'+re.escape(key)+r'".*?</button>',page,re.S)
    if not match or hashlib.sha256(match.group().encode()).hexdigest()!=row['htmlSha256']: errors.append('Card mismatch: '+key)
print(json.dumps({'anchor':m['anchorId'],'verifiedFiles':len(verified),'notMaterialized':missing,'acceptedCards':len(m['cards']),'errors':errors,'passed':not errors,'realRenderTested':False},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
