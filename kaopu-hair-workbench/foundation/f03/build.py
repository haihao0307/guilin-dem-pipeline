"""Build F03. Frozen approved scalp is copied byte-for-byte, never reauthored."""
import base64,gzip,hashlib,json,os,subprocess,shutil
from pathlib import Path
p=Path(__file__).resolve().parent
f01=Path(os.environ.get('HAIR_F01',p.parent/'f01')); approved=Path(os.environ.get('HAIR_F021',p.parent/'f02-1'))
build=p/'.build';site=p/'site';(build/'approved').mkdir(parents=True,exist_ok=True);site.mkdir(exist_ok=True);(p/'src/approved').mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
frozen=json.loads((approved/'BUILD_MANIFEST.json').read_text());assert frozen['htmlSHA256']=='afb12cd47db9d8fe4df36765d42bc029e6d7a298ee25f393d7f03e3436729e68'
for name in ['BoundaryKernel.mjs','F02Boundary.mjs','EarClearance.mjs','LegacyFoundation.mjs']:
    src=approved/'src'/name;assert sha(src.read_bytes())==frozen['sources']['src/'+name]
    shutil.copy2(src,p/'src/approved'/name)
manifest=json.loads((f01/'BUILD_MANIFEST.json').read_text())
for name in ['head.json.gz','three.module.js','SurfaceQuery.mjs']:
    raw=(f01/'site'/name).read_bytes();assert sha(raw)==manifest['files'][name]['sha256']
    if name=='three.module.js':(build/name).write_bytes(raw)
    if name=='SurfaceQuery.mjs':(p/'src'/name).write_bytes(raw)
    if name=='head.json.gz':head=raw
for f in (p/'src').rglob('*.mjs'):
    dest=build/f.relative_to(p/'src');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
a=build/'App.mjs';lines=a.read_text().splitlines();assert all(s.startswith('import ') for s in lines[:3]);a.write_text('\n'.join(lines[:3])+'\n(async()=>{\n'+'\n'.join(lines[3:])+'\n})();')
esbuild=os.environ.get('ESBUILD','esbuild')
for entry,out in [('Worker.mjs','worker.js'),('App.mjs','app.js')]:subprocess.run([esbuild,str(build/entry),'--bundle','--format=iife','--minify','--legal-comments=inline','--outfile='+str(build/out)],check=True)
source=os.environ.get('GITHUB_SHA','local-F03')
boot={'version':'F03','source':source,'scalpLock':'F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3','headGz':base64.b64encode(head).decode(),'headSHA':manifest['headSHA256'],'headCompressedSHA':sha(head),'worker':(build/'worker.js').read_text()}
html=(p/'index.template.html').read_text().replace('__BOOT__',json.dumps(boot,ensure_ascii=False).replace('<','\\u003c').replace('&','\\u0026')).replace('__APP__',(build/'app.js').read_text().replace('</script','<\\/script'))
(site/'index.html').write_text(html);shutil.copy2(site/'index.html',p/'preview.html');shutil.copytree(f01/'site/licenses',site/'licenses',dirs_exist_ok=True)
(p/'head.json').write_bytes(gzip.decompress(head))
m={'version':'F03','source':source,'approvedBaseline':'111066a5058a2937420c25565f7b1fbd0d5d81a2','scalpLock':boot['scalpLock'],'headSHA256':manifest['headSHA256'],'htmlSHA256':sha((site/'index.html').read_bytes()),'htmlBytes':(site/'index.html').stat().st_size,'sources':{str(f.relative_to(p)):sha(f.read_bytes()) for f in sorted((p/'src').rglob('*.mjs'))},'approvedScalpByteIdentical':True,'oldWorkbenchesChanged':False,'denseHair':False,'physicsAdvanced':False,'imageGenerationUsed':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));print(json.dumps(m,indent=2))
