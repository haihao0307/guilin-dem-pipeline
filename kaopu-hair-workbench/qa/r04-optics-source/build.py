from pathlib import Path
import json,base64,hashlib,os
ROOT=Path(__file__).parent
ORIG=ROOT/'teacher-original'
modules={str(p.relative_to(ORIG/'js/app')).removesuffix('.js'):p.read_text() for p in sorted((ORIG/'js/app').rglob('*.js')) if p.name!='main.js'}
paths=['data/models/bunnyUV.json','data/models/cloth.json']+[str(p.relative_to(ORIG)) for p in sorted((ORIG/'data/textures').glob('*.png'))]
assets={p:('data:image/png;base64,'+base64.b64encode((ORIG/p).read_bytes()).decode() if p.endswith('.png') else (ORIG/p).read_text()) for p in paths}
manifest={str(p.relative_to(ORIG)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(ORIG.rglob('*')) if p.is_file()}
bundle={'commit':'cca0432bef548a9853f34d89788c5d2761e57d56','modules':modules,'assets':assets,'sha256':manifest,'license':(ORIG/'LICENCE.md').read_text()}
# Script data is escaped to make arbitrary embedded strings safe inside HTML.
escape=lambda s:s.replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
html=(ROOT/'src/workbench.html').read_text().replace('/*__BUNDLE__*/', 'window.WORKBENCH_BUNDLE='+escape(json.dumps(bundle,separators=(',',':')))+';').replace('/*__FRAME_RUNTIME__*/','window.FRAME_RUNTIME='+escape(json.dumps((ROOT/'src/frame.js').read_text()))+';').replace('/*__HOST_RUNTIME__*/',(ROOT/'src/host.js').read_text())

# Frozen r02 rabbit source stays unchanged; r03 adds an isolated module wrapper.
reference=(ROOT/'references/anemone/../anemone-macro/wootton-magnifica-original.jpg').read_bytes()
panel=(ROOT/'src/anemone-panel.html').read_text().replace('/*__ANEMONE_REFERENCE__*/','data:image/jpeg;base64,'+base64.b64encode(reference).decode())
nav,panel=panel.split('<section id="anemoneModule"',1)
panel='<section id="anemoneModule"'+panel
html=html.replace('content="2026-10-03-seddi-baseline-r02"','content="2026-10-03-anemone-r04-optics-stage"',1)
html=html.replace('</style>','\n'+(ROOT/'src/anemone.css').read_text()+'\n</style>',1)
html=html.replace('<body>','<body data-module="anemone">',1)
html=html.replace('本版是离线封装与交互工作台，尚未实现独立程序兔子、长发动力学、触手或引擎蒙皮绑定。','兔子模块保留原始参考资产；海葵见上方页签。尚未实现独立程序兔子、长发动力学或引擎蒙皮绑定。')
html=html.replace('当前没有独立动态阴影、长发物理、碰撞、骨骼蒙皮、触手或 Unity/Unreal 导出。','该兔子模块没有独立动态阴影、长发物理、碰撞、骨骼蒙皮或 Unity/Unreal 导出；海葵为独立程序模块。')
html=html.replace('<div class="layout">',nav+panel+'<div id="rabbitModule"><div class="layout">',1)
html=html.replace('<input id="importFile"','</div><input id="importFile"',1)
runtime='\n'.join((ROOT/'src'/name).read_text() for name in ['anemone-core.js','anemone-optics.js','anemone-renderer.js','anemone-host.js'])
html=('<script>'+runtime.replace('</script','<\\/script')+'</script>\n</body>').join(html.rsplit('</body>',1))
output=ROOT/os.environ.get('HAIR_BUILD_OUTPUT','dist/KAOPU-r04-材质内测.html')
output.write_text(html)
(ROOT/'source-manifest.json').write_text(json.dumps({'commit':bundle['commit'],'sha256':manifest},indent=2))
print('Built',len(html.encode()),'bytes')
