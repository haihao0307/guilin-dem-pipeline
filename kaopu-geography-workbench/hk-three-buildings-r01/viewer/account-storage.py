"""Repeatable ledger: shared code once, per-building recipes and optional evidence separately."""
from pathlib import Path
import json,gzip,hashlib
root=Path(__file__).resolve().parent.parent
path=root/'viewer/provenance/storage-accounting.json'
receipt=json.loads(path.read_text())
for category in ['sharedRuntimeOnce','perBuildingRecipes','sharedInstanceManifest','readOnlyReferencePreviews']:
    records=[]
    for old in receipt[category]['files']:
        data=(root/old['path']).read_bytes()
        records.append({'path':old['path'],'bytes':len(data),'gzipBytes':len(gzip.compress(data,compresslevel=6,mtime=0)),'sha256':hashlib.sha256(data).hexdigest()})
    receipt[category]={'files':records,'bytes':sum(x['bytes']for x in records),'gzipMemberBytes':sum(x['gzipBytes']for x in records)}
path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:{'bytes':v['bytes'],'gzipMemberBytes':v['gzipMemberBytes']}for k,v in receipt.items()if isinstance(v,dict)and 'bytes'in v},indent=2))
