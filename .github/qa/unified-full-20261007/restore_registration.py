"""Restore pinned public landmark runtime for a bounded neutral-mesh experiment."""
from pathlib import Path
import json,urllib.request,hashlib,concurrent.futures
R=Path(__file__).resolve().parent;lock=json.loads((R/'REGISTRATION-SOURCE-LOCK.json').read_text())
def one(row):
 p=R/'source'/row['path'];p.parent.mkdir(parents=True,exist_ok=True)
 b=p.read_bytes()if p.exists()else urllib.request.urlopen(row['url'],timeout=90).read()
 assert len(b)==row['bytes']and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
 if not p.exists():p.write_bytes(b)
 return{'path':row['path'],'bytes':len(b),'sha256':row['sha256']}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows=list(pool.map(one,lock['files']))
(R/'research/registration-source-receipt.json').write_text(json.dumps({'files':rows,'noPrivatePhotos':True,'geometryLandmarkProposalOnly':True},indent=2));print('Verified',len(rows),'registration dependencies')
