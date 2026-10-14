"""F06 derives from the complete native P01 platform, never from head.json.gz."""
import os,json,hashlib,subprocess,urllib.request,shutil
from pathlib import Path
p=Path(__file__).resolve().parent;build=p/'.build';build.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
source={'commit':'d413d108704af47cf531ee8c25d93f682c3176e3','path':'kaopu-unified-human-workbench/review-platform-r01-20261014/preview.html','sha256':'69da0a547349639d6a1245c46ff46c6420c9bdf45cb4b84bfba7fa549743664e'}
source['url']='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+source['commit']+'/'+source['path']
baseline=Path(os.environ['NATIVE_PERSON_HTML']).read_bytes() if os.environ.get('NATIVE_PERSON_HTML') else urllib.request.urlopen(source['url'],timeout=120).read()
assert sha(baseline)==source['sha256'],'Native complete-person source changed'
three=Path(os.environ.get('NATIVE_THREE',p/'vendor/three.module.js')).read_bytes();assert sha(three)=='ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb','Native platform Three.js source changed'
# The Three.js module can be supplied from the verified native platform. The
# source digest is recorded; native geometry/materials stay in their own runtime.
for f in (p/'src').rglob('*.mjs'):
 dest=build/f.relative_to(p/'src');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(f.read_bytes())
(build/'three.module.js').write_bytes(three)
esbuild=os.environ.get('ESBUILD','esbuild')
for entry,out in [('Worker.mjs','worker.js'),('NativeApp.mjs','app.js')]:subprocess.run([esbuild,str(build/entry),'--bundle','--format=iife','--minify','--legal-comments=inline','--outfile='+str(build/out)],check=True)
revision=os.environ.get('GITHUB_SHA','local-F06');boot={'version':'F06','source':revision,'worker':(build/'worker.js').read_text(encoding='utf-8'),'panel':(p/'panel.html').read_text(encoding='utf-8')}
insert='<style>'+(p/'style.css').read_text(encoding='utf-8')+'</style><script>window.__HAIR_F06_BOOT__='+json.dumps(boot,ensure_ascii=False).replace('<','\\u003c')+';</script><script>'+(build/'app.js').read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>'
html=baseline.decode('utf-8');assert html.count('</body>')==1;html=html.replace('</body>',insert+'</body>');(p/'preview.html').write_text(html,encoding='utf-8')
m={'version':'F06','source':revision,'nativeCompletePerson':source,'nativeCharacter':'P01','nativeCanonicalTopology':'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de','nativeVertices':25417,'nativeTriangles':50624,'rootBank':'b0f64ef','activeRoots':3067,'guides':192,'htmlSHA256':sha((p/'preview.html').read_bytes()),'htmlBytes':(p/'preview.html').stat().st_size,'threeSHA256':sha(three),'sourceFiles':{f.relative_to(p).as_posix():sha(f.read_bytes())for f in sorted((p/'src').rglob('*.mjs'))},'standaloneHeadResourceUsed':False,'personMeshReplaced':False,'newPhysics':False,'photoFitting':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2),encoding='utf-8');(p/'NATIVE_PERSON_SOURCE.json').write_text(json.dumps(source,indent=2),encoding='utf-8');print(json.dumps({k:m[k]for k in ['version','source','htmlSHA256','htmlBytes','nativeCharacter','nativeVertices','nativeTriangles']},indent=2))
