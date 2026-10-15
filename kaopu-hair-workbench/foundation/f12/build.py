"""F12 derives from the complete native P01 platform, never from head.json.gz."""
import os,json,hashlib,subprocess,urllib.request,shutil,gzip,base64
from pathlib import Path
p=Path(__file__).resolve().parent;build=p/'.build';build.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
source={'commit':'d413d108704af47cf531ee8c25d93f682c3176e3','path':'kaopu-unified-human-workbench/review-platform-r01-20261014/preview.html','sha256':'69da0a547349639d6a1245c46ff46c6420c9bdf45cb4b84bfba7fa549743664e'}
source['url']='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+source['commit']+'/'+source['path']
baseline=Path(os.environ['NATIVE_PERSON_HTML']).read_bytes() if os.environ.get('NATIVE_PERSON_HTML') else urllib.request.urlopen(source['url'],timeout=120).read()
assert sha(baseline)==source['sha256'],'Native complete-person source changed'
# Share the exact R07 skin implementation; preserve the frozen person source.
skin_builder=p.parents[3]/'Shared-Human-Skin-R02'/'build-skin-host.cjs'
skin_input=build/'native-skin-input.html';skin_output=build/'native-skin-host.html'
skin_input.write_bytes(baseline)
subprocess.run(['node',str(skin_builder),str(skin_input),str(skin_output)],check=True)
baseline=skin_output.read_bytes()
source['skinLayer']={'version':'SKIN-FULLBODY-R02','commit':'50f9dd769893584dedb62f0bc62db07ebcb1dcc0','hostSHA256':sha(baseline)}
three=Path(os.environ.get('NATIVE_THREE',p/'vendor/three.module.js')).read_bytes();assert sha(three)=='ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb','Native platform Three.js source changed'
# The Three.js module can be supplied from the verified native platform. The
# source digest is recorded; native geometry/materials stay in their own runtime.
for f in (p/'src').rglob('*.mjs'):
 dest=build/f.relative_to(p/'src');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(f.read_bytes())
(build/'three.module.js').write_bytes(three)
esbuild=os.environ.get('ESBUILD','esbuild')
for entry,out in [('Worker.mjs','worker.js'),('NativeApp.mjs','app.js')]:subprocess.run([esbuild,str(build/entry),'--bundle','--format=iife','--minify','--legal-comments=inline','--outfile='+str(build/out)],check=True)
revision=os.environ.get('GITHUB_SHA','local-F12');boot={'version':'F12','source':revision,'worker':(build/'worker.js').read_text(encoding='utf-8'),'panel':(p/'panel.html').read_text(encoding='utf-8')}
insert='<style>'+(p/'style.css').read_text(encoding='utf-8')+'</style><script>window.__HAIR_F12_BOOT__='+json.dumps(boot,ensure_ascii=False).replace('<','\\u003c')+';</script><script>'+(build/'app.js').read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>'
html=baseline.decode('utf-8');assert html.count('</body>')==1;html=html.replace('</body>',insert+'</body>')
runtime=html.encode('utf-8');packed=gzip.compress(runtime,compresslevel=9,mtime=0);payload=p/'payload';payload.mkdir(exist_ok=True)
parts=[]
for i in range(0,len(packed),400000):
 name='person-%02d.bin'%(i//400000);data=packed[i:i+400000];(payload/name).write_bytes(data);parts.append({'path':'payload/'+name,'bytes':len(data),'sha256':sha(data)})
ref=os.environ.get('NATIVE_PAYLOAD_REF','');prefix='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+ref+'/kaopu-hair-workbench/foundation/f12/' if ref else './'
config={'prefix':prefix,'parts':parts,'runtimeSHA256':sha(runtime),'runtimeBytes':len(runtime),'source':revision}
loader=r"""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>人物毛发工作台 F12</title><style>body{margin:0;background:#f4f3eb;color:#26463b;font:16px system-ui;display:grid;min-height:100vh;place-items:center}#loading{max-width:34em;padding:2em;line-height:1.8}button{font:inherit;padding:.5em 1em}</style><div id="loading">正在载入完整人物 P01…<br><span id="progress">准备人物数据</span></div><script>
const C=__CONFIG__;const hex=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
(async()=>{let done=0,next=0;const chunks=new Array(C.parts.length);async function part(i){const p=C.parts[i];for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(C.prefix+p.path,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);const b=await r.arrayBuffer();if(b.byteLength!==p.bytes||await hex(b)!==p.sha256)throw Error('人物数据校验失败');chunks[i]=new Uint8Array(b);document.getElementById('progress').textContent='人物数据 '+(++done)+' / '+C.parts.length;return;}catch(e){if(attempt===2)throw e;}}}await Promise.all(Array.from({length:3},async()=>{while(next<C.parts.length)await part(next++);}));const stream=new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'));const bytes=await new Response(stream).arrayBuffer();if(bytes.byteLength!==C.runtimeBytes||await hex(bytes)!==C.runtimeSHA256)throw Error('完整人物版本校验失败');const source=new TextDecoder().decode(bytes);document.open();document.write(source);document.close();})().catch(e=>{document.getElementById('loading').textContent='人物载入未完成：'+e.message;const b=document.createElement('button');b.textContent='重新载入';b.onclick=()=>location.reload();document.getElementById('loading').append(document.createElement('br'),b);});
</script></html>"""
(p/'preview.html').write_text(loader.replace('__CONFIG__',json.dumps(config,separators=(',',':'))),encoding='utf-8')
m={'version':'F12','source':revision,'nativeCompletePerson':source,'nativeCharacter':'P01','nativeCanonicalTopology':'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de','nativeVertices':25417,'nativeTriangles':50624,'rootBank':'b0f64ef','activeRoots':3067,'guides':192,'runtimeSHA256':sha(runtime),'runtimeBytes':len(runtime),'payloadCommit':ref or None,'compressedBytes':len(packed),'payloadParts':parts,'htmlSHA256':sha((p/'preview.html').read_bytes()),'htmlBytes':(p/'preview.html').stat().st_size,'threeSHA256':sha(three),'sourceFiles':{f.relative_to(p).as_posix():sha(f.read_bytes())for f in sorted((p/'src').rglob('*.mjs'))},'standaloneHeadResourceUsed':False,'personMeshReplaced':False,'newPhysics':False,'photoFitting':False,'manualReferenceStudy':{'sha256':'959b28381536f2b1fabb3683caaed71e8ccfbf8a994d2b7a344f1df0fecb2a91','view':'front','hiddenViews':'inferred','imagePublished':False},'rootSubregions':11,'photoBundleGroups':6,'shapeMethod':'continuous root-specific scalp-relative flow with gradual whorl turn, transverse frame offsets, and measured 3D bundle envelopes','rootGrownBundleVolumes':True,'styleRulesSchema':'kaopu/hair-style-rules@3','volumeSchema':'kaopu/root-grown-bundle-volumes@3','defaultVolumeClumps':43,'sectionsPerClump':65,'axialTwistImplemented':True,'materialCalibration':False,'actualDenseStrands':True,'defaultActualStrands':114171,'pointsPerStrand':49,'defaultDenseSegments':5480208,'denseSchema':'kaopu/native-dense-hair@2','strandRasterization':'individual indexed line curves; real strand-radius rasterization deferred'}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2),encoding='utf-8');(p/'NATIVE_PERSON_SOURCE.json').write_text(json.dumps(source,indent=2),encoding='utf-8');print(json.dumps({k:m[k]for k in ['version','source','htmlSHA256','htmlBytes','nativeCharacter','nativeVertices','nativeTriangles']},indent=2))
