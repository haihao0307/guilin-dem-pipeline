from pathlib import Path
import json,hashlib,argparse,zlib
from field_core import RegionalWorld,decode
from shapely import from_wkb
p=argparse.ArgumentParser();p.add_argument('--full',action='store_true');args=p.parse_args()
ROOT=Path(__file__).resolve().parent;w=RegionalWorld(ROOT)
used={k for f in w.fields.values()for t in f['tiles'].values()for k in[t['values'],t['masks']]}
used.update(f['storage_predictor']['lookup_blob']for f in w.fields.values()if f.get('value_mode')=='projection-residual')
for k in used:
 data=(ROOT/'objects'/k[:2]/(k+'.kfield')).read_bytes();assert hashlib.sha256(data).hexdigest()==k
 if args.full:decode(data)
rebuilt=0
for f in w.fields.values():
 if f.get('value_mode')=='projection-residual':
  assert f['basis_field']in w.fields
  if args.full:
   a=w._array(f);assert hashlib.sha256(a.tobytes()).hexdigest()==f['reconstructed_sha256'];rebuilt+=1
for n in ['land-domain','land-halo','coast-domain']:
 g=from_wkb(zlib.decompress((ROOT/'coast'/(n+'.wkb.z')).read_bytes()));assert g.is_valid and not g.is_empty
report={'passed':True,'full':args.full,'verified_objects':len(used),'fields':len(w.fields),'full_factored_fields_reconstructed':rebuilt,'source_archives_needed':False,'scope':'hashes, exact field reconstruction and valid regional geometry; not physical accuracy'}
(ROOT/'CORE_INTEGRITY_QA.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
