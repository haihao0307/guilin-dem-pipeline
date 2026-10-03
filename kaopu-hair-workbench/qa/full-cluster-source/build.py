from pathlib import Path
import json,base64,hashlib,os
ROOT=Path(__file__).parent.parent
ORIG=ROOT/'teacher-original'
modules={str(p.relative_to(ORIG/'js/app')).removesuffix('.js'):p.read_text() for p in sorted((ORIG/'js/app').rglob('*.js')) if p.name!='main.js'}
paths=['data/models/bunnyUV.json','data/models/cloth.json']+[str(p.relative_to(ORIG)) for p in sorted((ORIG/'data/textures').glob('*.png'))]
assets={p:('data:image/png;base64,'+base64.b64encode((ORIG/p).read_bytes()).decode() if p.endswith('.png') else (ORIG/p).read_text()) for p in paths}
manifest={str(p.relative_to(ORIG)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(ORIG.rglob('*')) if p.is_file()}
bundle={'commit':'cca0432bef548a9853f34d89788c5d2761e57d56','modules':modules,'assets':assets,'sha256':manifest,'license':(ORIG/'LICENCE.md').read_text()}
# Script data is escaped to make arbitrary embedded strings safe inside HTML.
escape=lambda s:s.replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
bundle_json=escape(json.dumps(bundle,separators=(',',':')))
original_host=(ROOT/'src/host.js').read_text()
startup="createFrame('teacher');setTimeout(()=>createFrame('candidate'),150);"
assert original_host.count(startup)==1
host=original_host.replace(startup,'')
# Readiness stays truthful: the teacher renderer exists only after explicit opening.
host=host.replace('if(!loadedMesh.teacher||!loadedMesh.candidate)', 'if(!loadedMesh.candidate||(window.rabbitTeacherStarted&&!loadedMesh.teacher))')
host=host.replace('if(loadedMesh.teacher===mesh&&loadedMesh.candidate===mesh&&ready.teacher&&ready.candidate)', 'if(loadedMesh.candidate===mesh&&ready.candidate&&(!window.rabbitTeacherStarted||(loadedMesh.teacher===mesh&&ready.teacher)))')
host=host.replace('if(ready.teacher&&ready.candidate)', 'if(ready.candidate&&(!window.rabbitTeacherStarted||ready.teacher))')
host+='\n'+(ROOT/'full-cluster/src/rabbit-lifecycle.js').read_text()
html=(ROOT/'src/workbench.html').read_text().replace('/*__BUNDLE__*/', 'window.WORKBENCH_BUNDLE='+bundle_json+';window.ensureRabbitBundle=()=>Promise.resolve(WORKBENCH_BUNDLE);').replace('/*__FRAME_RUNTIME__*/','window.FRAME_RUNTIME='+escape(json.dumps((ROOT/'full-cluster/src/studio-lighting.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-lighting-adapter.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-fur-shader-adapter.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-frame.js').read_text()))+';').replace('/*__HOST_RUNTIME__*/',host)

# Existing r03 geometry/shaders/host preserved. Its reference panel uses the already
# licensed, embedded Wootton macro photo; official r03 entry is not replaced.
S=ROOT/'baselines/r03-restored/src'
reference=(ROOT/'references/anemone-macro/wootton-magnifica-original.jpg').read_bytes()
panel=(ROOT/'full-cluster/src/anemone-panel.html').read_text().replace('/*__ANEMONE_REFERENCE__*/','data:image/jpeg;base64,'+base64.b64encode(reference).decode())
panel=panel.replace('OIST 原始三联照片左部：Heteractis magnifica 的密集长指状触手及埋入其中的小丑鱼','Neville Wootton 拍摄的 Heteractis magnifica 野外近摄')
panel=panel.replace('© OIST, 2022','Neville Wootton').replace('licenses/by/4.0','licenses/by/2.0').replace('CC BY 4.0','CC BY 2.0').replace('OIST 官方缩略图左部，CSS 裁切<br>720×240 展示图，原图 4283×1429','马尔代夫野外近摄 · 2082×1314').replace('https://www.oist.jp/image/heteractis-and-stichodactyla-giant-sea-anemones','https://commons.wikimedia.org/wiki/File:Heteractis_magnifica,_tent%C3%A1culos.jpg').replace('查看原始大学来源','查看原始摄影来源')
panel=panel.replace('<span>短毛可编辑','<button id="speciesKuko">KuKo · 原版触手 <small>TEACHER / Day 114</small></button><span>短毛可编辑',1)
nav,panel=panel.split('<section id="anemoneModule"',1); panel='<section id="anemoneModule"'+panel
html=html.replace('content="2026-10-03-seddi-baseline-r02"','content="2026-10-03-bounded-layout-side-light-studio"',1)
css=(S/'anemone.css').read_text()+'\n.reference-photo img{width:100%;object-fit:cover}\n'+(ROOT/'kuko-adapt/src/style.css').read_text()+'\n'+(ROOT/'full-cluster/src/style.css').read_text()+'\n'+(ROOT/'full-cluster/src/catalog.css').read_text()
html=html.replace('</style>',css+'\n</style>',1).replace('<body>','<body data-module="home">',1)
html=html.replace('<div class="layout">',nav+panel+(ROOT/'kuko-adapt/src/panel.html').read_text()+'<div id="rabbitModule"><div class="layout">',1).replace('<input id="importFile"','</div><input id="importFile"',1)
runtime=(S/'anemone-core.js').read_text()+'\n'+'\n'.join((ROOT/'full-cluster/src'/n).read_text() for n in ['anemone-current.js','anemone-safe-layout.js','studio-lighting.js','anemone-renderer.js','anemone-host.js'])
runtime+='\nwindow.KUKO_EXPERIMENT_SOURCE='+escape(json.dumps((ROOT/'kuko-adapt/src/experiment.glsl').read_text()))+';\nwindow.KUKO_TEACHER_SOURCE='+escape(json.dumps((ROOT/'kuko/src/teacher.frag').read_text()))+';\n'+(ROOT/'kuko-adapt/src/runtime.js').read_text()
runtime+='\n'+(ROOT/'full-cluster/src/studio-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-appearance.js').read_text()+'\n'+(ROOT/'full-cluster/src/object-lighting-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/catalog-ui.js').read_text()+'\nplatform.select("home");'
html=('<script>'+runtime.replace('</script','<\\/script')+'</script>\n</body>').join(html.rsplit('</body>',1))
# One self-contained offline file and an object-lazy online shell share the same code.
output=ROOT/'dist/KAOPU-整株海葵-轻透四色.html';output.write_text(html)
standalone=ROOT/'dist/kuko-anemone-standalone.html';standalone.write_text(html)
assetdir=ROOT/'dist/catalog-assets';assetdir.mkdir(exist_ok=True)
bundle_bytes=bundle_json.encode();bundle_sha=hashlib.sha256(bundle_bytes).hexdigest()
bundle_name='rabbit-'+bundle_sha[:16]+'.json';(assetdir/bundle_name).write_bytes(bundle_bytes)
photo_sha=hashlib.sha256(reference).hexdigest();photo_name='wootton-'+photo_sha[:16]+'.jpg';(assetdir/photo_name).write_bytes(reference)
stub={k:bundle[k] for k in ['commit','sha256','license']}
loader=""";window.ensureRabbitBundle=(()=>{let pending=null;return()=>{if(WORKBENCH_BUNDLE.modules)return Promise.resolve(WORKBENCH_BUNDLE);if(!pending)pending=(async()=>{const response=await fetch('./catalog-assets/"""+bundle_name+"""');if(!response.ok)throw Error('资源 HTTP '+response.status);const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!=='"""+bundle_sha+"""')throw Error('兔子资源完整性校验失败');Object.assign(WORKBENCH_BUNDLE,JSON.parse(new TextDecoder().decode(bytes)));return WORKBENCH_BUNDLE;})().catch(e=>{pending=null;throw e});return pending;};})();"""
public=html.replace('window.WORKBENCH_BUNDLE='+bundle_json+';window.ensureRabbitBundle=()=>Promise.resolve(WORKBENCH_BUNDLE);','window.WORKBENCH_BUNDLE='+escape(json.dumps(stub,separators=(',',':')))+loader,1)
photo_data='data:image/jpeg;base64,'+base64.b64encode(reference).decode()
assert public.count(photo_data)==1
public=public.replace('src="'+photo_data+'"','data-reference-src="./catalog-assets/'+photo_name+'"',1)
public_path=ROOT/'dist/kuko-anemone-candidate.html';public_path.write_text(public)
receipt={'timestamp':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'bytes':len(public.encode()),'sha256':hashlib.sha256(public.encode()).hexdigest(),'standaloneBytes':len(html.encode()),'standaloneSha256':hashlib.sha256(html.encode()).hexdigest(),'rabbitBundleBytes':len(bundle_bytes),'rabbitBundleSha256':bundle_sha,'rabbitBundleFile':'catalog-assets/'+bundle_name,'referenceFile':'catalog-assets/'+photo_name,'referenceBytes':len(reference),'referenceSha256':photo_sha,'teacherSha256':hashlib.sha256((ROOT/'kuko/src/teacher.frag').read_bytes()).hexdigest(),'originalTeacherFunctionsUnchanged':True,'adapters':['lazy object initialization','separate same-origin immutable online assets','DPR and input adapters','candidate visual fur-mask remap','R13 two-side-light material adapters','fixed certified radial initial layout and bounded regional microflow'],'geometryModel':'bounded-radial-prefix-1','lightingModel':'r13-two-side-rgb-v1','lightingSourceBlob':'d241380ef267d5afbbcc0633d2b0666d44e6cb29','visualAcceptance':False,'productionReady':False,'videoEmbedded':False,'gameSynced':False}
(ROOT/'full-cluster/qa/build.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
