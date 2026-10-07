"""Restore bounded, public-teacher-only neutral/open-mouth ray evidence."""
from pathlib import Path
import gzip,json,hashlib
R=Path(__file__).resolve().parent.parent;D=R/'fixtures/head-landmarks';p=D/'observations.json.gz'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='8d561140fc82dfe2d87fad1cc287a39d0f671cf158de0e96d7bc202331a9fa0c'
data=json.loads(gzip.decompress(p.read_bytes()));provenance=json.loads((D/'PROVENANCE.json').read_text());allowed={x['file']:x for x in provenance['files']};assert set(data)==set(allowed)
for name,value in data.items():
 assert Path(name).name==name
 b=json.dumps(value,separators=(',',':')).encode();assert hashlib.sha256(b).hexdigest()==allowed[name]['sha256'];(D/name).write_bytes(b)
print({'verifiedPublicTeacherObservations':len(data),'privatePhotos':False})
