"""Compose the independent lab from the exact own-character bytes and a
readable own kernel. No previous geometry, specialist or page is changed.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent
BASE=ROOT.parents[1]/'kaopu-unified-human-workbench/skin-dna-r02-1/preview.html'
OUT=ROOT.parents[1]/'kaopu-unified-human-workbench/skin-surface-lab-r01';OUT.mkdir(parents=True,exist_ok=True)
def once(s,a,b):
 assert s.count(a)==1,('SSG build anchor changed',a[:100],s.count(a))
 return s.replace(a,b,1)
b=BASE.read_bytes();digest=hashlib.sha256(b).hexdigest()
assert digest=='19609ea6f60e3945e2c3caf9fad7fc6ff5cd2fdb037f7c6f317f87500798e2e3',digest
s=b.decode();anchor='window.__IDENTITY_QA__={model:()=>_e?.model,viewer:()=>Ue,controller:()=>_e};'
s=once(s,anchor,'window.__SSG_THREE__=st;'+anchor)
runtime=(ROOT/'surface-lab.js').read_text();kernel=(ROOT/'slope-kernel.js').read_text()
a=runtime.index('const GLSL=`');z=runtime.index('function patchOnce',a)
runtime=runtime[:a]+'const GLSL=window.KAOPU_SSG_KERNEL.declarations;\n'+runtime[z:]
a=runtime.index('f=patchOnce(f,anchor,`');z=runtime.index('`+anchor);',a)+len('`+anchor);')
runtime=runtime[:a]+'f=patchOnce(f,anchor,window.KAOPU_SSG_KERNEL.surface+anchor);'+runtime[z:]
runtime=once(runtime,'const result=generateField(seed);const next=new THREE.DataTexture(result.data,result.width,result.height,THREE.RGBAFormat,THREE.UnsignedByteType);','const result=window.KAOPU_SSG_KERNEL.pack(generateField(seed));const next=new THREE.DataArrayTexture(result.data,result.width,result.height,2);')
runtime=runtime.replace('ssg-field-v1','ssg-slope-array-v2').replace('/ssg-surface-lab-r01-v1','/ssg-surface-lab-r01-slope-v2')
runtime=once(runtime,'graphics:viewer?.skinRenderHealth?.inspect?.()','graphics:viewer?.skinRenderHealth?.report?.()')
a=runtime.index('function camera(kind)');z=runtime.index('\nfunction select(id)',a)
runtime=runtime[:a]+'''function camera(kind){
 if(!viewer)return;viewName=kind;originalAPI.view(kind==='body'?'body':'face');
 if(kind!=='body'){
  const d=viewer.camera.position.clone().sub(viewer.orbit.target),angle=kind==='side'?Math.PI*.47:kind==='three'?.50:kind==='macro'?.34:0;
  d.applyAxisAngle(new THREE.Vector3(0,1,0),angle-.34);viewer.camera.position.copy(viewer.orbit.target).add(d);viewer.camera.zoom=1.0;
  if(kind==='macro'){viewer.camera.zoom=3.1;viewer.camera.position.x+=.035;viewer.orbit.target.x+=.035;viewer.camera.position.y-=.019;viewer.orbit.target.y-=.019;}
 }
 viewer.camera.updateProjectionMatrix();viewer.orbit.update();viewer.resize();draw();root.querySelectorAll('[data-ssg-view]').forEach(b=>b.classList.toggle('selected',b.dataset.ssgView===kind));
}'''+runtime[z:]
runtime=once(runtime,"apply();camera('face');const health=viewer.skinRenderHealth.inspect();","apply();camera('three');const health=viewer.skinRenderHealth.inspect();")
runtime=once(runtime,'const api={version:VERSION,','const api={version:VERSION,kernel:window.KAOPU_SSG_KERNEL.version,inspect(){return viewer.skinRenderHealth.inspect();},debugShader(){return lastShader?.fragmentShader;},')
s=once(s,'</head>','<style>'+(ROOT/'lab.css').read_text()+'</style></head>')
s=once(s,'</body>','<script>\n'+kernel+'\n</script><script>\n'+runtime+'\n</script></body>')
s=once(s,'<title>SKIN / NATURE R02.1 · 六种肤质 · 总人物独立副本</title>','<title>KAOPU · 皮肤表面实验室 R01</title>')
(OUT/'preview.html').write_text(s);(OUT/'surface-runtime.js').write_text(runtime)
report={'version':'SKIN-SURFACE-LAB-R01','kernel':'ssg-slope-array-v2','baselineCommit':'7c406b142ac5732c999a87797251e38697b31f17','skillCommit':'853e5f02b8b6e557eaf28f461e49ae495a1b5d07','baselineSHA256':digest,'previewSHA256':hashlib.sha256(s.encode()).hexdigest(),'previewBytes':len(s.encode()),'compiledRuntimeSHA256':hashlib.sha256(runtime.encode()).hexdigest(),'code':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in ['build.py','surface-lab.js','slope-kernel.js','lab.css']},'geometryChanged':False,'externalSkinTextures':False,'extraFragmentSamplers':1,'generatedTextureLayers':2,'generatedTextureBaseBytes':8388608,'presets':6,'userVisualAccepted':False}
(OUT/'BUILD.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
