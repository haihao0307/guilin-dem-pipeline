#!/usr/bin/env python3
"""Fetch exact public upstream files, or copy verified bytes from an audit cache."""
from pathlib import Path
import argparse, hashlib, json, urllib.request, concurrent.futures, datetime

parser=argparse.ArgumentParser()
parser.add_argument('--from-cache',type=Path)
parser.add_argument('--verify-only',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent
lock=json.loads((root/'SOURCE_LOCK_AUDIT.json').read_text())
def valid(data,item):
    return (len(data)==item['bytes']
        and hashlib.sha256(data).hexdigest()==item['sha256']
        and hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==item['gitBlobSHA1'])
def obtain(item):
    relative=Path(item['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid locked source path')
    target=root/relative
    if target.is_file() and valid(target.read_bytes(),item):
        return {'path':item['path'],'state':'verified'}
    if args.verify_only:
        raise ValueError('Missing or mismatched source: '+item['path'])
    if args.from_cache:
        data=(args.from_cache/relative).read_bytes()
    else:
        if not item['url'].startswith('https://raw.githubusercontent.com/haihao0307/'):
            raise ValueError('Unexpected source host/owner')
        with urllib.request.urlopen(item['url'],timeout=45) as response:
            data=response.read()
    if not valid(data,item):
        raise ValueError('Source digest mismatch: '+item['path'])
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
    return {'path':item['path'],'state':'copied' if args.from_cache else 'downloaded'}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result=list(pool.map(obtain,lock['files']))
derived=[]
for item in lock.get('derivedFiles',[]):
    relative=Path(item['path']);source_path=Path(item['from'])
    if relative.is_absolute() or source_path.is_absolute() or '..' in relative.parts or '..' in source_path.parts:
        raise ValueError('Invalid derived source path')
    data=(root/source_path).read_bytes()
    for replacement in item['replacements']:
        before=replacement['before'].encode();after=replacement['after'].encode()
        if data.count(before)!=replacement['occurrences']:
            raise ValueError('Derived dependency source changed')
        data=data.replace(before,after)
    if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise ValueError('Derived dependency does not match original measured package')
    target=root/relative
    if args.verify_only:
        if not target.is_file() or target.read_bytes()!=data:
            raise ValueError('Missing or mismatched derived dependency')
    else:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    derived.append({'path':item['path'],'sha256':item['sha256'],'state':'verified'})
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':len(result),'derivedFiles':len(derived),'bytes':sum(x['bytes']for x in lock['files']),'allLockedHashesMatched':True,'sourceAuthority':'public fixed GitHub commits','operation':'local verification only; no network' if args.verify_only else 'copy from verified local cache' if args.from_cache else 'download missing locked source files','results':result,'derived':derived}
(root/'SOURCE_VERIFY_RECEIPT.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({k:v for k,v in receipt.items()if k not in ('results','derived')},indent=2))
