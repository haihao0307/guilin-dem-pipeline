"""Build plus bounded GPU submissions and explicit adaptive cloud sampling."""
from pathlib import Path
import sys,json,hashlib,shutil
from build_v056 import build,replace
b,s,o=map(Path,sys.argv[1:4]);build(b,s,o)
p=o/'runtime.js';text=p.read_text()
text=replace(text,'function draw(){let g=S.gl,now=performance.now();',"function draw(){let g=S.gl,now=performance.now();if(S.gpuFence){let status=g.clientWaitSync(S.gpuFence,0,0);if(status===g.TIMEOUT_EXPIRED)return false;g.deleteSync(S.gpuFence);S.gpuFence=null;if(status===g.WAIT_FAILED)throw Error('GPU frame completion failed');}")
text=replace(text,'g.flush();S.lastDraw=now;',"S.gpuFence=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);g.flush();S.lastDraw=now;")
text=replace(text,'installMobileShell(S,surface,record);',"installMobileShell(S,surface,record);const firstWeather=S.weather.getState();document.querySelectorAll('[data-weather]').forEach(e=>e.classList.toggle('active',e.dataset.weather===firstWeather.caseId));$('weatherCase').value=firstWeather.caseId;")
text=replace(text,'S.targetHeight=m.baseM+m.verticalExtentM*.38;S.theta=.58;S.phi=.16;S.r=Math.max(10000,Math.min(32000,m.verticalExtentM*1.2));','S.targetHeight=m.baseM+m.verticalExtentM*.5;S.theta=.58;S.phi=.28;S.r=Math.max(20000,Math.min(42000,m.verticalExtentM*2));')
text="import{createRenderTargets}from'./render-targets.mjs';\n"+text
text=replace(text,'S.gl=g;S.sky=createSky(g);','S.gl=g;S.sky=createSky(g);S.targets=createRenderTargets(g);')
text=replace(text,'let left=0;g.viewport(0,0,w,h);','S.targets.begin(w,h);let left=0;g.viewport(0,0,w,h);')
text=replace(text,'S.cloudRendered=S.weather.draw({','S.cloudRendered=S.targets.drawCloud(S.weather,{')
text=replace(text,'viewStream:S.stream?.stats,sky:', 'renderTargets:S.targets?.stats,viewStream:S.stream?.stats,sky:')
p.write_text(text)
shutil.copyfile(s/'render-targets.mjs',o/'render-targets.mjs')
w=o/'weather-scene.mjs';code=w.read_text()
code=replace(code,'uniform sampler3D uDensity;','uniform sampler3D uDensity;\nuniform highp sampler2D uSceneDepth;')
code=replace(code,'float begin=max(hit.x,0.0),end=hit.y;', 'float begin=max(hit.x,0.0),end=hit.y;float sceneZ=texture(uSceneDepth,uv).r;if(sceneZ<0.999999){float viewDistance=exp2(sceneZ*2.0/uLogFar)-1.0;end=min(end,viewDistance/max(0.0001,dot(rd,uForward)));}')
code=replace(code,'logFar, moving = false })','logFar, moving = false, sceneDepth = null, cameraAspect = null })')
code=replace(code,"gl.uniform1i(uniform('uDensity'), 0);","gl.uniform1i(uniform('uDensity'), 0);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,sceneDepth);gl.uniform1i(uniform('uSceneDepth'),2);gl.activeTexture(gl.TEXTURE0);")
code=replace(code,"gl.uniform1f(uniform('uAspect'), viewport[2] / viewport[3]);","gl.uniform1f(uniform('uAspect'), cameraAspect || viewport[2] / viewport[3]);")
code=replace(code,'gl.enable(gl.DEPTH_TEST);\n    gl.depthFunc(gl.LEQUAL);','gl.disable(gl.DEPTH_TEST);\n    gl.depthFunc(gl.LEQUAL);')
code=replace(code,'gl.enable(gl.BLEND);','gl.disable(gl.BLEND);')
w.write_text(code)
h=o/'index.html';html=h.read_text().replace('</style>','@media(hover:none){#panel button:hover:not(.active){background:#173740e6}}\n</style>');h.write_text(html)
m=json.loads((o/'BUILD.json').read_text());m['gpuSubmission']={'maxFramesInFlight':1,'blockingFinish':False,'clientWaitTimeoutNs':0}
m['scientificStatus']['seasonalSelection']='deterministic rule scenarios; tropical cyclones require manual selection'
m['cloudSampling']={'balancedScale':0.5,'gestureScale':0.35,'highScale':1,'sceneDepthClipsRay':True,'composite':'depth-aware bilinear','terrainAndSkyFullResolution':True}
m['performanceApproved']=False
m['schema']='wenzhou-mobile-view-stream-build-1'
m['baselineSourceFiles']=m.pop('sourceFiles',{})
m['baselineSourcePayloadSha256']=m.pop('sourcePayloadSha256',None)
for f in [h,p,w,o/'render-targets.mjs']:m['files'][f.name]={'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
(o/'BUILD.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n')
