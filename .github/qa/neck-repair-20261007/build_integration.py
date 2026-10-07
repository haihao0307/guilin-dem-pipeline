from pathlib import Path
import hashlib,json,shutil,gzip
R=Path(__file__).resolve().parent;O=R/'research';A=R/'candidate';sha=lambda b:hashlib.sha256(b).hexdigest()
basefp=json.loads((R/'baseline/kaopu-unified-human-workbench/assets/adapter-fingerprint.json').read_text());kernel=R/'frozen' if (R/'frozen/neck-cotangent.bin.gz').exists() else O;meta=json.loads((kernel/'neck-cotangent.json').read_text());meta.pop('unknown');meta.pop('boundary');meta['vertexCount']=25417;packed=(kernel/'neck-cotangent.bin.gz').read_bytes();raw=gzip.decompress(packed);meta['binary']={'rawBytes':len(raw),'rawSHA256':sha(raw),'compressedBytes':len(packed),'compressedSHA256':sha(packed),'layout':'uint32 unknown indices; uint32 boundary indices; row-major float32 unknown-by-boundary weights; little endian'};meta['sourceCommit']='cdf2ac931e444875dd400eafada7ee118702147f';meta['generatorSHA256']=sha((R/'build_probe.py').read_bytes());meta['scope']='Authored30mm geodesic neck band,1116 vertices;9947 protected face/oral vertices unchanged';metadata=(json.dumps(meta,indent=2)+'\n').encode()
for folder in ['kaopu-unified-human-workbench','kaopu-skin-workbench']:
 dest=A/folder;(dest/'src').mkdir(parents=True,exist_ok=True);(dest/'assets').mkdir(exist_ok=True)
 # Keep untouched dependencies available locally/CI without publishing copies.
 for f in (R/'baseline'/folder).rglob('*'):
  if not f.is_file():continue
  target=dest/f.relative_to(R/'baseline'/folder)
  if target.exists():continue
  target.parent.mkdir(parents=True,exist_ok=True);target.symlink_to(f.resolve())
 def write(rel,b):
  p=dest/rel
  if p.is_symlink():p.unlink()
  p.write_bytes(b if isinstance(b,bytes)else b.encode())
 write('src/NeckSurface.js',(R/'NeckSurface.js').read_bytes());write('assets/neck-surface.json',metadata);write('assets/neck-surface.bin.gz',packed)
 s=(R/'baseline'/folder/'src/UnifiedModel.js').read_text().replace('fingerprint=null){','fingerprint=null,neckSurface=null){').replace('this.adapterFingerprint=fingerprint.id;','this.adapterFingerprint=fingerprint.id;this.acceptedParameterFingerprints=fingerprint.acceptedParameterFingerprints||[];this.neckSurface=neckSurface;if(neckSurface&&neckSurface.topologySha256!==canonical.topologySha256)throw Error(\'Neck topology mismatch\');').replace("if(!Array.from(pos).every(Number.isFinite))", "if(this.neckSurface)this.neckSurface.apply(pos);\n  if(!Array.from(pos).every(Number.isFinite))").replace('neckFairingMaxMM:this.neckFairingMaxMM,revision:', 'neckFairingMaxMM:this.neckFairingMaxMM,neckSurfaceMaxMM:this.neckSurface?.maxDisplacementMM||0,neckSurfaceVertices:this.neckSurface?.unknownCount||0,revision:')
 s=s.replace('raw.adapterFingerprint!==model.adapterFingerprint)', '(raw.adapterFingerprint!==model.adapterFingerprint&&!model.acceptedParameterFingerprints.includes(raw.adapterFingerprint)))').replace('s.mhr={amount:n,channel};return s;', "s.mhr={amount:n,channel};if(raw.adapterFingerprint!==model.adapterFingerprint)Object.defineProperty(s,'migrationFrom',{value:raw.adapterFingerprint});return s;")
 write('src/UnifiedModel.js',s)
 app=(R/'baseline'/folder/'src/app.js').read_text()
 if folder=='kaopu-unified-human-workbench':
  loader=(R/'baseline'/folder/'src/R01Assets.js').read_text();loader="import{loadNeckSurface}from'./NeckSurface.js';\n"+loader;loader=loader.replace('[am,c,mhr]=await Promise.all(', '[am,c,mhr,neckSurface]=await Promise.all(').replace('fingerprint.inputs.mhrProjection,422148)]);','fingerprint.inputs.mhrProjection,422148),loadNeckSurface(fingerprint,{read:(...args)=>this.bytes(...args),inflate:(...args)=>this.inflate(...args)})]);').replace('return{am,ab,gb,c,mhr,fingerprint};','return{am,ab,gb,c,mhr,fingerprint,neckSurface};');loader=loader.replace("'./NeckSurface.js'","'./NeckSurface.js?neck=20261007-r1'").replace('./assets/adapter-fingerprint.json','./assets/adapter-fingerprint.json?neck=20261007-r1');write('src/R01Assets.js',loader);app=app.replace('const {am,ab,gb,c,mhr,fingerprint}=', 'const {am,ab,gb,c,mhr,fingerprint,neckSurface}=')
 else:
  app="import{loadNeckSurface}from'./NeckSurface.js';\n"+app;app=app.replace('const [am,c,mhr]=await Promise.all(', 'const [am,c,mhr,neckSurface]=await Promise.all(').replace('fingerprint.inputs.mhrProjection)]);','fingerprint.inputs.mhrProjection),loadNeckSurface(fingerprint,{read:checkedFetch})]);')
 app=app.replace('c,mhr,fingerprint);model.compute(state);','c,mhr,fingerprint,neckSurface);model.compute(state);').replace("$('status').textContent='已恢复同一角色档案';", "$('status').textContent=candidate.migrationFrom?'已迁移旧版档案：脸与体型参数保留，已应用新版颈部连接':'已恢复同一角色档案';")
 app=app.replace('view,pixelAudit:',"view,camera:()=>camera?{position:camera.position.toArray(),target:orbit.target.toArray()}:null,setCamera:(position,target)=>{if(!camera)return;if(![position,target].every(v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<20)))throw Error('Invalid camera');camera.position.fromArray(position);orbit.target.fromArray(target);camera.updateProjectionMatrix();orbit.update();render();},pixelAudit:");app=app.replace('局部平顺最大 ${m.neckFairingMaxMM.toFixed(2)} mm', '局部平顺最大 ${m.neckFairingMaxMM.toFixed(2)} mm\\n颈面修复最大 ${m.neckSurfaceMaxMM.toFixed(2)} mm');app=app.replace("'./UnifiedModel.js'","'./UnifiedModel.js?neck=20261007-r1'").replace("'./R01Assets.js'","'./R01Assets.js?neck=20261007-r1'").replace("'./NeckSurface.js'","'./NeckSurface.js?neck=20261007-r1'").replace('./assets/adapter-fingerprint.json','./assets/adapter-fingerprint.json?neck=20261007-r1');write('src/app.js',app)
 inputs={**basefp['inputs'],'unifiedImplementation':sha((dest/'src/UnifiedModel.js').read_bytes()),'neckSurfaceImplementation':sha((R/'NeckSurface.js').read_bytes()),'neckSurface':sha(raw),'neckSurfaceCompressed':sha(packed),'neckSurfaceMeta':sha(metadata)};fp={'schema':'kaopu-unified-adapter/2','id':sha(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()),'inputs':inputs,'acceptedParameterFingerprints':[basefp['id']],'parameterMigration':'Only the pinned preceding R01 parameter contract is accepted. Fixed face/body identity parameters survive; the authored neck surface is intentionally repaired and UI reports migration.'};write('assets/adapter-fingerprint.json',json.dumps(fp,indent=2)+'\n')
 # Assertions prevent a text-patch typo from silently leaving the old route.
 assert 'fingerprint,neckSurface);model.compute' in app
 print(folder,fp['id'],len(packed))
for folder in ['kaopu-anny-workbench','kaopu-face-workbench']:
 target=A/folder
 if not target.exists():target.symlink_to((R/'baseline'/folder).resolve(),target_is_directory=True)
rows=[]
for p in sorted(A.rglob('*')):
 if p.is_file()and not p.is_symlink():
  b=p.read_bytes();rel=str(p.relative_to(A));old=R/'baseline'/rel;rows.append({'path':rel,'local':str(p),'bytes':len(b),'sha256':sha(b),'gitBlobSHA':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'expectedOldGitBlobSHA':hashlib.sha1(b'blob '+str(old.stat().st_size).encode()+b'\0'+old.read_bytes()).hexdigest()if old.exists()else None})
(R/'INTEGRATION-MANIFEST.json').write_text(json.dumps(rows,indent=2))
