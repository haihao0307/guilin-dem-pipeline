from pathlib import Path
import json,hashlib,struct
root=Path(__file__).resolve().parents[1]
layout=json.loads((root/'reports/checkpoint-layout.json').read_text());p=root/'assets/checkpoints/stage2/RoboCloth/145/Ours_epoch112.ckpt'
manifest={'source_commit':'6d0d33c1687c9241deb92c19f1d39ea70849cb51','asset_commit':'438cdade7a02dd7e0085760279ec283139b39098','checkpoint_sha256':'399bff700d97838f114292e5596ebb59add3325254cb2a5fb6d171e1b6226f98','checkpoint_bytes':p.stat().st_size,'inference_tensors':{},'source_files':{}}
with p.open('rb') as f:
 for k,v in layout['tensors'].items():
  if not k.startswith('material.'):continue
  q=v['zip']; f.seek(q['data_offset']);h=hashlib.sha256();remaining=q['size']
  while remaining:
   chunk=f.read(min(4*1024**2,remaining));h.update(chunk);remaining-=len(chunk)
  manifest['inference_tensors'][k]={**v,'sha256':h.hexdigest()}
 for k in ['factor']:
  v=manifest['inference_tensors']['material.'+k];f.seek(v['zip']['data_offset']);expected=f.read(v['zip']['size']);actual=(root/'reports/range-factor.bin').read_bytes();assert expected==actual
manifest['inference_bytes']=sum(x['zip']['size'] for x in manifest['inference_tensors'].values());manifest['excluded_training_bytes']=p.stat().st_size-manifest['inference_bytes']
for p in sorted((root/'upstream').rglob('*')):
 if p.is_file():manifest['source_files'][str(p.relative_to(root/'upstream'))]={'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()}
(root/'reports/source-asset-manifest.json').write_text(json.dumps(manifest,indent=2));print({k:v for k,v in manifest.items() if not isinstance(v,dict)})
# Never persist expiring CDN redirect query strings in public evidence.
headers=(root/'reports/range-headers.txt').read_text();headers='\n'.join(x.split('?')[0]+'?[ephemeral redirect omitted]' if x.lower().startswith('location:') else x for x in headers.splitlines())
(root/'reports/range-headers-sanitized.txt').write_text(headers)
