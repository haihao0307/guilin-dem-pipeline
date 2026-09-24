#!/usr/bin/env python3
from pathlib import Path
import argparse,base64,gzip,hashlib,json
sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path('ops/stone-money-r0153/source-chunks'));p.add_argument('--out',type=Path,default=Path('STONE_MONEY_ISLAND_R015_3_REAL_3D.html'));a=p.parse_args();m=json.loads((a.root/'manifest.json').read_text());parts=[]
 for item in m['chunks']:
  t=(a.root/item['path']).read_text().strip()
  if len(t)!=item['chars'] or sha(t.encode())!=item['sha256']:raise SystemExit('chunk identity mismatch: '+item['path'])
  parts.append(t)
 text=''.join(parts)
 if len(text)!=m['base64Chars']:raise SystemExit('base64 length mismatch')
 z=base64.b64decode(text,validate=True)
 if len(z)!=m['gzipBytes'] or sha(z)!=m['gzipSHA256']:raise SystemExit('gzip identity mismatch')
 raw=gzip.decompress(z)
 if len(raw)!=m['rawBytes'] or sha(raw)!=m['rawSHA256']:raise SystemExit('raw source identity mismatch')
 a.out.write_bytes(raw);print(json.dumps({'state':'EXACT_SOURCE_RECONSTRUCTED','bytes':len(raw),'sha256':sha(raw),'chunks':len(parts)},indent=2))
if __name__=='__main__':main()
