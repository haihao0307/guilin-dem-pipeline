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
html=(ROOT/'src/workbench.html').read_text().replace('/*__BUNDLE__*/', 'window.WORKBENCH_BUNDLE='+escape(json.dumps(bundle,separators=(',',':')))+';').replace('/*__FRAME_RUNTIME__*/','window.FRAME_RUNTIME='+escape(json.dumps((ROOT/'src/frame.js').read_text()))+';').replace('/*__HOST_RUNTIME__*/',(ROOT/'src/host.js').read_text())

# Existing r03 geometry/shaders/host preserved. Its reference panel uses the already
# licensed, embedded Wootton macro photo; official r03 entry is not replaced.
S=ROOT/'baselines/r03-restored/src'
reference=(ROOT/'references/anemone-macro/wootton-magnifica-original.jpg').read_bytes()
panel=(S/'anemone-panel.html').read_text().replace('/*__ANEMONE_REFERENCE__*/','data:image/jpeg;base64,'+base64.b64encode(reference).decode())
panel=panel.replace('OIST 原始三联照片左部：Heteractis magnifica 的密集长指状触手及埋入其中的小丑鱼','Neville Wootton 拍摄的 Heteractis magnifica 野外近摄')
panel=panel.replace('© OIST, 2022','Neville Wootton').replace('licenses/by/4.0','licenses/by/2.0').replace('CC BY 4.0','CC BY 2.0').replace('OIST 官方缩略图左部，CSS 裁切<br>720×240 展示图，原图 4283×1429','马尔代夫野外近摄 · 2082×1314').replace('https://www.oist.jp/image/heteractis-and-stichodactyla-giant-sea-anemones','https://commons.wikimedia.org/wiki/File:Heteractis_magnifica,_tent%C3%A1culos.jpg').replace('查看原始大学来源','查看原始摄影来源')
panel=panel.replace('<span>短毛可编辑','<button id="speciesKuko">KuKo · 原版触手 <small>TEACHER / Day 114</small></button><span>短毛可编辑',1)
nav,panel=panel.split('<section id="anemoneModule"',1); panel='<section id="anemoneModule"'+panel
html=html.replace('content="2026-10-03-seddi-baseline-r02"','content="2026-10-03-kuko-day114-teacher-baseline"',1)
css=(S/'anemone.css').read_text()+'\n.reference-photo img{width:100%;object-fit:cover}\n'+(ROOT/'kuko/src/style.css').read_text()
html=html.replace('</style>',css+'\n</style>',1).replace('<body>','<body data-module="kuko">',1)
html=html.replace('<div class="layout">',nav+panel+(ROOT/'kuko/src/panel.html').read_text()+'<div id="rabbitModule"><div class="layout">',1).replace('<input id="importFile"','</div><input id="importFile"',1)
runtime='\n'.join((S/n).read_text() for n in ['anemone-core.js','anemone-renderer.js','anemone-host.js'])
runtime+='\nwindow.KUKO_TEACHER_SOURCE='+escape(json.dumps((ROOT/'kuko/src/teacher.frag').read_text()))+';\n'+(ROOT/'kuko/src/runtime.js').read_text()
html=('<script>'+runtime.replace('</script','<\\/script')+'</script>\n</body>').join(html.rsplit('</body>',1))
output=ROOT/'dist/KAOPU-KuKo-Day114-原版对照.html';output.write_text(html)
receipt={'timestamp':'2026-10-03T09:09:00Z','bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'teacherSha256':hashlib.sha256((ROOT/'kuko/src/teacher.frag').read_bytes()).hexdigest(),'originalTeacherFunctionsUnchanged':True,'adapters':['WebGL2 precision and uniforms','mainImage entry point','shared time and resolution'],'visualAcceptance':False,'productionReady':False,'videoEmbedded':False,'gameSynced':False}
(ROOT/'kuko/qa/build.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
