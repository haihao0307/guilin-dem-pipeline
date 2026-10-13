"""Build one self-contained web page from F01 native assets, no user photograph."""
import base64,gzip,hashlib,json,os,subprocess,shutil
from pathlib import Path
p=Path(__file__).resolve().parent; old=Path(os.environ.get('HAIR_F01',p.parent/'f01'));build=p/'.build';build.mkdir(exist_ok=True);site=p/'site';site.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((old/'BUILD_MANIFEST.json').read_text())
for name in ['head.json.gz','Foundation.mjs','three.module.js']:
    data=(old/'site'/name).read_bytes();assert sha(data)==manifest['files'][name]['sha256'],name
    if name=='Foundation.mjs':shutil.copy2(old/'site'/name,p/'src/LegacyFoundation.mjs')
    if name=='three.module.js':shutil.copy2(old/'site'/name,build/name)
for f in (p/'src').glob('*.mjs'):shutil.copy2(f,build/f.name)
esbuild=os.environ.get('ESBUILD','esbuild')
for entry,out in [('Worker.mjs','worker.js'),('App.mjs','app.js')]:subprocess.run([esbuild,str(build/entry),'--bundle','--format=iife','--minify','--legal-comments=inline','--outfile='+str(build/out)],check=True)
head=(old/'site/head.json.gz').read_bytes();source=os.environ.get('GITHUB_SHA','local-F02')
boot={'version':'F02','source':source,'headGz':base64.b64encode(head).decode(),'headSHA':manifest['headSHA256'],'headCompressedSHA':sha(head),'worker':(build/'worker.js').read_text()}
html=(p/'index.template.html').read_text().replace('__BOOT__',json.dumps(boot,ensure_ascii=False).replace('<','\\u003c')).replace('__APP__',(build/'app.js').read_text().replace('</script','<\\/script'))
(site/'index.html').write_text(html);shutil.copy2(site/'index.html',p/'preview.html')
shutil.copytree(old/'site/licenses',site/'licenses',dirs_exist_ok=True)
sources={str(f.relative_to(p)):sha(f.read_bytes()) for f in sorted((p/'src').glob('*.mjs'))}
m={'version':'F02','source':source,'baseline':'4a745de3d7818df8c1ee8e8f083d91956275152a','headSHA256':manifest['headSHA256'],'headCompressedSHA256':sha(head),'htmlSHA256':sha((site/'index.html').read_bytes()),'htmlBytes':(site/'index.html').stat().st_size,'sources':sources,'referencePhotoPublic':False,'imageGenerationUsed':False,'physicsChanged':False,'oldF01Changed':False,'ready':'candidate-awaiting-public-browser'}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));print(json.dumps(m,indent=2))
