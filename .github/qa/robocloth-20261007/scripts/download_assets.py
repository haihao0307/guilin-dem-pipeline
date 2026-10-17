import json,pathlib,urllib.request,hashlib,time
root=pathlib.Path(__file__).resolve().parents[1]
tree=json.loads((root/'reports/assets-tree.json').read_text())
selected=[a for a in tree if a['type']=='file' and (a['path']=='checkpoints/stage2/RoboCloth/145/Ours_epoch112.ckpt' or a['path'].startswith(('render_assets/cloth_on_bar/','renders/cloth_on_bar/')))]
for a in selected:
 p=root/'assets'/a['path'];p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists() or p.stat().st_size != a['size']:
  print('download',a['path'],a['size'],flush=True)
  urllib.request.urlretrieve('https://huggingface.co/datasets/koalapenguin/RoboCloth-assets/resolve/438cdade7a02dd7e0085760279ec283139b39098/'+a['path'],str(p))
 h=hashlib.file_digest(p.open('rb'),'sha256').hexdigest();expected=a.get('lfs',{}).get('oid');assert not expected or h==expected,(h,expected)
 print('verified',a['path'],h,flush=True)
 a.update(sha256=h,license='CC-BY-4.0',local_path=str(p.relative_to(root)))
(root/'reports/selected-assets.json').write_text(json.dumps(selected,indent=2))
