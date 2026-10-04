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
# Optional lens pan is additive; old JSON files default to a centered lens.
host=host.replace('size:1,combRadius:50','size:1,pan:[0,0],combRadius:50')
host=host.replace('s.size>2.5','s.size>6').replace('const s=data.state;', 'const s={...data.state,pan:data.state?.pan??[0,0]};')
host=host.replace("['angles',2,-1e4,1e4]","['angles',2,-1e4,1e4],['pan',2,-2,2]")
host=host.replace('candidate.size=1;baseline.angles=[0,0];baseline.size=1;', 'candidate.size=1;candidate.pan=[0,0];baseline.angles=[0,0];baseline.size=1;baseline.pan=[0,0];')
host=host.replace('values:{angles:[0,0],size:1}', 'values:{angles:[0,0],size:1,pan:[0,0]}')
host=host.replace('angles:s.angles,size:s.size,', 'angles:s.angles,size:s.size,pan:s.pan,')
host=host.replace('candidate.angles=d.angles;candidate.size=d.size;baseline.angles=d.angles;baseline.size=d.size;', 'candidate.angles=d.angles;candidate.size=d.size;candidate.pan=d.pan??[0,0];baseline.angles=d.angles;baseline.size=d.size;baseline.pan=candidate.pan.slice();')
host=host.replace('values:{angles:d.angles,size:d.size}', 'values:{angles:d.angles,size:d.size,pan:d.pan??[0,0]}')
# Readiness stays truthful: the teacher renderer exists only after explicit opening.
host=host.replace('if(!loadedMesh.teacher||!loadedMesh.candidate)', 'if(!loadedMesh.candidate||(window.rabbitTeacherStarted&&!loadedMesh.teacher))')
host=host.replace('if(loadedMesh.teacher===mesh&&loadedMesh.candidate===mesh&&ready.teacher&&ready.candidate)', 'if(loadedMesh.candidate===mesh&&ready.candidate&&(!window.rabbitTeacherStarted||(loadedMesh.teacher===mesh&&ready.teacher)))')
host=host.replace('if(ready.teacher&&ready.candidate)', 'if(ready.candidate&&(!window.rabbitTeacherStarted||ready.teacher))')
host=(ROOT/'full-cluster/src/rabbit-load-progress.js').read_text()+'\n'+host+'\n'+(ROOT/'full-cluster/src/rabbit-lifecycle.js').read_text()
host=host.replace('function createFrame(role){', 'function createFrame(role){window.FRAME_EPOCHS=window.FRAME_EPOCHS||{};window.FRAME_EPOCHS[role]=(window.FRAME_EPOCHS[role]||0)+1;')
host=host.replace("if(!d?.kaopu||!['teacher','candidate'].includes(d.role)||","if(!d?.kaopu||d.epoch!==window.FRAME_EPOCHS?.[d.role]||!['teacher','candidate'].includes(d.role)||")
html=(ROOT/'src/workbench.html').read_text().replace('/*__BUNDLE__*/', 'window.WORKBENCH_BUNDLE='+bundle_json+';window.ensureRabbitBundle=()=>Promise.resolve(WORKBENCH_BUNDLE);').replace('/*__FRAME_RUNTIME__*/','window.FRAME_RUNTIME='+escape(json.dumps((ROOT/'full-cluster/src/rabbit-lighting-rig-frozen.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-lighting-adapter.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-fur-shader-adapter.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-startup-adapter.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-frame.js').read_text()))+';').replace('/*__HOST_RUNTIME__*/',host)

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
css=(S/'anemone.css').read_text()+'\n.reference-photo img{width:100%;object-fit:cover}\n'+(ROOT/'kuko-adapt/src/style.css').read_text()+'\n'+(ROOT/'full-cluster/src/style.css').read_text()+'\n'+(ROOT/'full-cluster/src/catalog.css').read_text()+'\n'+(ROOT/'full-cluster/src/fiber-catalog.css').read_text()
html=html.replace('</style>',css+'\n</style>',1).replace('<body>','<body data-module="home">',1)
html=html.replace('<div class="layout">',nav+panel+(ROOT/'kuko-adapt/src/panel.html').read_text()+'<div id="rabbitModule"><div class="layout">',1).replace('<input id="importFile"','</div><input id="importFile"',1)
runtime=(S/'anemone-core.js').read_text()+'\n'+'\n'.join((ROOT/'full-cluster/src'/n).read_text() for n in ['anemone-current.js','anemone-safe-layout.js','studio-lighting.js','anemone-renderer.js','anemone-host.js'])
runtime+='\nwindow.KUKO_EXPERIMENT_SOURCE='+escape(json.dumps((ROOT/'kuko-adapt/src/experiment.glsl').read_text()))+';\nwindow.KUKO_TEACHER_SOURCE='+escape(json.dumps((ROOT/'kuko/src/teacher.frag').read_text()))+';\n'+(ROOT/'kuko-adapt/src/runtime.js').read_text()
runtime+='\n'+(ROOT/'full-cluster/src/studio-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/rabbit-appearance.js').read_text()+'\n'+(ROOT/'full-cluster/src/object-lighting-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/catalog-ui.js').read_text()+'\n'+(ROOT/'full-cluster/src/fiber-catalog.js').read_text()+'\nplatform.select("home");'
fiber_html=(ROOT/'full-cluster/fiber-study/index.html').read_text()
assert hashlib.sha256(fiber_html.encode()).hexdigest()=='cfe95c28d27a1ee80ca65feda27c1806489f12fb7cdf9a3d3cd64c6ca57f9e8d'
fiber_embed='window.FIBER_MODULE_HTML='+escape(json.dumps(fiber_html))+';'
runtime=fiber_embed+'\n'+runtime
html=('<script>'+runtime.replace('</script','<\\/script')+'</script>\n</body>').join(html.rsplit('</body>',1))
for token,name in [('RABBIT','rabbit-render.jpg'),('ANEMONE','anemone-render.jpg'),('FIBER','fiber-render.jpg')]:
    html=html.replace('/*__'+token+'_PREVIEW__*/','data:image/jpeg;base64,'+base64.b64encode((ROOT/'references/previews'/name).read_bytes()).decode())
# Compact only CSS whitespace/comments; never rewrite teacher modules or shaders.
import re
style_start=html.index('<style>')+len('<style>');style_end=html.index('</style>',style_start)
style=html[style_start:style_end];style=re.sub(r'/\*[\s\S]*?\*/','',style);style=re.sub(r'\s*([{}:;,])\s*',r'\1',style)
html=html[:style_start]+style+html[style_end:]
# One self-contained offline file and an object-lazy online shell share the same code.
output=ROOT/'dist/KAOPU-整株海葵-轻透四色.html';output.write_text(html)
standalone=ROOT/'dist/kuko-anemone-standalone.html';standalone.write_text(html)
assetdir=ROOT/'dist/catalog-assets';assetdir.mkdir(exist_ok=True)
online_bundle={**bundle,'assets':dict(bundle['assets']),'assetMeta':{}}
for name in ['bunnyalpha_base.png','bunnyalpha_tip.png']:
    path='data/textures/'+name;raw=(ORIG/path).read_bytes();digest=hashlib.sha256(raw).hexdigest();filename=name.removesuffix('.png')+'-'+digest[:16]+'.png'
    (assetdir/filename).write_bytes(raw);online_bundle['assets'][path]='./catalog-assets/'+filename;online_bundle['assetMeta'][path]={'bytes':len(raw),'sha256':digest}
online_bundle_json=escape(json.dumps(online_bundle,separators=(',',':')))
bundle_bytes=online_bundle_json.encode();bundle_sha=hashlib.sha256(bundle_bytes).hexdigest()
bundle_name='rabbit-'+bundle_sha[:16]+'.json';(assetdir/bundle_name).write_bytes(bundle_bytes)
photo_sha=hashlib.sha256(reference).hexdigest();photo_name='wootton-'+photo_sha[:16]+'.jpg';(assetdir/photo_name).write_bytes(reference)
stub={k:bundle[k] for k in ['commit','sha256','license']}
loader=""";window.ensureRabbitBundle=(()=>{let pending=null;return()=>{if(WORKBENCH_BUNDLE.modules)return Promise.resolve(WORKBENCH_BUNDLE);if(!pending)pending=(async()=>{const bytes=await rabbitLoadProgress.fetchBytes('./catalog-assets/"""+bundle_name+"""',"""+str(len(bundle_bytes))+""",'下载原始兔子必要资源','"""+bundle_sha+"""');rabbitLoadProgress.emit({stage:'parse',message:'解析原始模型与着色器',loaded:0,total:1});await new Promise(resolve=>setTimeout(resolve,0));Object.assign(WORKBENCH_BUNDLE,JSON.parse(new TextDecoder().decode(bytes)));return WORKBENCH_BUNDLE;})().catch(e=>{pending=null;throw e});return pending;};})();"""
public=html.replace('window.WORKBENCH_BUNDLE='+bundle_json+';window.ensureRabbitBundle=()=>Promise.resolve(WORKBENCH_BUNDLE);','window.WORKBENCH_BUNDLE='+escape(json.dumps(stub,separators=(',',':')))+loader,1)
public=public.replace(fiber_embed,'',1)
assert 'window.FIBER_MODULE_HTML=' not in public
module_dir=ROOT/'dist/c4d-fiber-study';module_dir.mkdir(exist_ok=True);(module_dir/'index.html').write_text(fiber_html)
photo_data='data:image/jpeg;base64,'+base64.b64encode(reference).decode()
assert public.count(photo_data)==1
public=public.replace('src="'+photo_data+'"','data-reference-src="./catalog-assets/'+photo_name+'"',1)
public_path=ROOT/'dist/kuko-anemone-candidate.html';public_path.write_text(public)
receipt={'timestamp':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'bytes':len(public.encode()),'sha256':hashlib.sha256(public.encode()).hexdigest(),'standaloneBytes':len(html.encode()),'standaloneSha256':hashlib.sha256(html.encode()).hexdigest(),'rabbitBundleBytes':len(bundle_bytes),'rabbitBundleSha256':bundle_sha,'rabbitBundleFile':'catalog-assets/'+bundle_name,'referenceFile':'catalog-assets/'+photo_name,'referenceBytes':len(reference),'referenceSha256':photo_sha,'teacherSha256':hashlib.sha256((ROOT/'kuko/src/teacher.frag').read_bytes()).hexdigest(),'originalTeacherFunctionsUnchanged':True,'adapters':['verified staged download with in-page retry','deferred original static shell masks','4096 RGBA8 tiled noise with no quality reduction','lazy object initialization','separate same-origin immutable online assets','DPR and input adapters','candidate visual fur-mask remap','R13 two-side-light material adapters','fixed certified radial initial layout with continuous-bound shared sway and regional microflow'],'deferredOriginalMaskBytes':sum((ORIG/'data/textures'/name).stat().st_size for name in ['bunnyalpha_base.png','bunnyalpha_tip.png']),'geometryModel':'bounded-shared-yaw-2','lightingModel':'r13-two-side-rgb-v1','lightingSourceBlob':'d241380ef267d5afbbcc0633d2b0666d44e6cb29','visualAcceptance':False,'productionReady':False,'videoEmbedded':False,'gameSynced':False,'rabbitAnchorCommit':'21e4a025b82fa8a32c1323ed83d3bee186150d76','rabbitFrameRuntimeSha256':'019a2371d87139af19c5fbc4048a87eb490586143271b4528ab8158ed52435d7','fiberSha256':'cfe95c28d27a1ee80ca65feda27c1806489f12fb7cdf9a3d3cd64c6ca57f9e8d'}
(ROOT/'full-cluster/qa/build.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
