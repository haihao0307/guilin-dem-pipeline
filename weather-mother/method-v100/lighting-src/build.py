from pathlib import Path
import json,hashlib,os,sys
SRC=Path(__file__).resolve().parent
P=Path(sys.argv[1]) if len(sys.argv)>1 else SRC.parent
R=Path(sys.argv[2]) if len(sys.argv)>2 else P/'lighting'
R.mkdir(parents=True,exist_ok=True)
LOCK={'runtime.js':'19b25c6d21d05ad97c9b40ab3f9a691dd1498ccfffca2c0050b614612158d383','view.glsl':'c968eceaa2617dfe63cae2479a6f1de1ef49b4e87b312e8de21cb9cb7fa8558f','guard.js':'5b8d8075ea36b68afa17f6b09e194a4dbe1153d0707c6fffc3f65de487330864','state.js':'1390c932fe60baea9267685c43e386d7e797f91da32e4d44aa07011bc7a24734','policy.json':'80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3','policy.schema.json':'b6f2d496a12f48c58b26051907b67ae247d193db1d3aed31ea4ae3ec084efa6e','profile.json':'0338651dd846ab941c9e07e18dd995add790958ad0f35758edac9541d62850a5','profile.schema.json':'5b91645690002570cd4107883243e7ca1c32f0c7e6ecdfdf027931557884db29'}
for n,h in LOCK.items():assert hashlib.sha256((P/n).read_bytes()).hexdigest()==h,'Source identity changed: '+n
s=(P/'runtime.js').read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:90],s.count(a))
 s=s.replace(a,b)
def section(a,b,new):
 global s
 x=s.index(a);y=s.index(b,x);s=s[:x]+new+s[y:]
s=s.replace("version:'wm-method-0.1.0'","version:'wm-lighting-0.1.1'")
rep("async function read(p){let r=await fetch(p);", "async function read(p){if(['policy.json','policy.schema.json','profile.json','profile.schema.json'].includes(p))p='../'+p;let r=await fetch(p);")
rep("await read('../clean-v1/'+name)","await read('../../clean-v1/'+name)")
section('const lightValues=','const n=v=>',"""const Studio=window.WeatherStudio;if(!Studio)throw Error('Studio module missing');
const lightValues=Studio.preset('daylight').lights;let studioPreset='daylight',studioExposure=1,rotation=0,lightingPlaying=false,quality='fine',gpuFence=null;
""")
section('function setLight(k,changes){','function range(',"""function setLight(k,changes){guard.check('mutate',history.profile);if(!Number.isInteger(k)||k<0||k>2)throw Error('Invalid light');Studio.validateLight(changes);Object.assign(lightValues[k],changes);studioPreset='custom';syncLighting();frameNeeded=true;info()}
function syncLighting(){for(let k=0;k<3;k++){const v=lightValues[k],fields={['lightOn'+k]:v.enabled,['lightColor'+k]:v.color,['lightPower'+k]:v.power,['lightAz'+k]:v.azimuth,['lightEl'+k]:v.elevation,['lightSize'+k]:v.size};for(const[id,x]of Object.entries(fields)){const el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=x;else el.value=x;if(el.nextElementSibling?.tagName==='OUTPUT')el.nextElementSibling.textContent=Number(x).toFixed(el.step<1?2:0);}}if($('studioExposure')){$('studioExposure').value=studioExposure;$('studioExposure').nextElementSibling.textContent=studioExposure.toFixed(2);}if($('lightRotation')){$('lightRotation').value=rotation;$('lightRotation').nextElementSibling.textContent=rotation.toFixed(0)+'°';}document.querySelectorAll('[data-lighting]').forEach(b=>b.classList.toggle('active',b.dataset.lighting===studioPreset));}
function setLighting(id){guard.check('mutate',history.profile);const v=Studio.preset(id);v.lights.forEach(Studio.validateLight);for(let k=0;k<3;k++)Object.assign(lightValues[k],v.lights[k]);studioPreset=id;studioExposure=v.exposure;rotation=0;lightingPlaying=false;$('rotateLights').textContent='旋转灯组';setMode('studio_beauty');syncLighting();frameNeeded=true;info()}
function setExposure(v){guard.check('mutate',history.profile);if(!Number.isFinite(v)||v<.4||v>2)throw Error('Exposure range');studioExposure=v;syncLighting();frameNeeded=true;info()}
function setRotation(v){guard.check('mutate',history.profile);rotation=Studio.wrapAngle(v);syncLighting();frameNeeded=true;}
function setQuality(v){if(!['balanced','fine','inspection'].includes(v))throw Error('Unknown render quality');guard.check('mutate',history.profile);quality=v;$('quality').value=v;resize();frameNeeded=true;info();}
""")
rep("qa.renderer='native pixel ratio capped 960x640; 144 view samples, six coarse shadow samples per active light';qa.colorConversion='linear to sRGB piecewise v1; neutral fixed clamp, beauty c/(1+c)';", "qa.renderer='neutral retains 144 samples and original 960x640 cap; studio 144/224/384 samples, 12 cone-depth intervals per light';qa.colorConversion='neutral legacy clamp; studio rational HDR shoulder v1, then piecewise linear-to-sRGB';")
rep("qa.lightUnits='relative directional radiance; no lux or Kelvin calibration';", "qa.lightUnits='relative directional radiance, sRGB controls converted to linear; angular cone approximation, no lux or Kelvin calibration';")
rep("mode=m;running=false;", "mode=m;running=false;if(m!=='studio_beauty'){lightingPlaying=false;$('rotateLights').textContent='旋转灯组';}document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));")
rep("range(box,'lightEl'+k,'仰角 °',5,85,1,l.elevation,v=>setLight(k,{elevation:v}));", "range(box,'lightEl'+k,'仰角 °',5,85,1,l.elevation,v=>setLight(k,{elevation:v}));range(box,'lightSize'+k,'柔光角 °',0,12,.5,l.size,v=>setLight(k,{size:v}));")
rep("$('mode').onchange=e=>setMode(e.target.value);", """document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelectorAll('[data-lighting]').forEach(b=>b.onclick=()=>setLighting(b.dataset.lighting));
$('rotateLights').onclick=()=>{if(mode!=='studio_beauty')setMode('studio_beauty');lightingPlaying=!lightingPlaying;last=performance.now();$('rotateLights').textContent=lightingPlaying?'停止旋转':'旋转灯组';frameNeeded=true;};
$('togglePanel').onclick=()=>$('panel').classList.toggle('closed');if(innerWidth<700)$('panel').classList.add('closed');
range($('presentation'),'studioExposure','展示曝光',.4,2,.05,1,setExposure);range($('presentation'),'lightRotation','灯组旋转 °',-180,180,1,0,setRotation);$('quality').onchange=e=>setQuality(e.target.value);
$('mode').onchange=e=>setMode(e.target.value);""")
rep("value.presentation={mode,diag,lights:lightValues,", "value.presentation={version:Studio.version,mode,diag,preset:studioPreset,exposure:studioExposure,rotationDegrees:rotation,quality,lights:JSON.parse(JSON.stringify(lightValues)),")
section('function resize(){','function linearHex(',"""function resize(){const cap=mode==='neutral_inspection'?[960,640]:quality==='inspection'?[1920,1200]:quality==='fine'?[1440,900]:[960,640];const scale=Math.min(1,cap[0]/innerWidth,cap[1]/innerHeight),w=Math.max(2,Math.round(innerWidth*scale)),h=Math.max(2,Math.round(innerHeight*scale));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;frameNeeded=true;}qa.nativeRenderSize=[w,h];qa.displaySize=[innerWidth,innerHeight];}
""")
rep("const dt=(now-last)/1000;last=now;if(document.hidden)return;if(running&&qa.ready)", "const dt=(now-last)/1000;if(document.hidden){last=now;return;}if(gpuFence){if(gl.clientWaitSync(gpuFence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(gpuFence);gpuFence=null;}last=now;if(lightingPlaying&&mode==='studio_beauty'){rotation=Studio.wrapAngle(rotation+dt*8);syncLighting();frameNeeded=true;}if(running&&qa.ready)")
rep("ii('uSteps',144);", "const samples=mode==='studio_beauty'?{balanced:144,fine:224,inspection:384}[quality]:144;ii('uSteps',samples);qa.samples=samples;f('studioExposure',studioExposure);")
rep("lights.flatMap(l=>dir(l.azimuth,l.elevation))", "lights.flatMap(l=>dir(l.azimuth+(neutral?0:rotation),l.elevation))")
rep("gl.drawArrays(gl.TRIANGLES,0,3);qa.frames++;", "gl.uniform1fv(loc('lightSize[0]'),new Float32Array(lights.map(l=>(l.size||0)*Math.PI/180)));gl.drawArrays(gl.TRIANGLES,0,3);gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();qa.frames++;")
rep("qa.camera=cam;", "qa.camera=cam;qa.presentationVersion=Studio.version;qa.lightPreset=studioPreset;qa.lightRotationDegrees=rotation;qa.exposure=neutral?1:studioExposure;")
rep("getPresentation:()=>({mode,diag,lights:JSON.parse(JSON.stringify(lightValues))})", "getPresentation:()=>({version:Studio.version,mode,diag,preset:studioPreset,exposure:studioExposure,rotationDegrees:rotation,quality,lights:JSON.parse(JSON.stringify(lightValues))})")
rep("setMode,setLight,setDriver:", "setMode,setLight,setLighting,setExposure,setRotation,setQuality,setDriver:")
rep("resize();setMode('neutral_inspection');", "const params=new URLSearchParams(location.search);setLighting(params.get('lighting')||'daylight');setQuality(params.get('quality')||'fine');if(params.get('mode'))setMode(params.get('mode'));resize();")
(R/'runtime.js').write_text(s)
for n in ['view.glsl','studio.js','index.html']:(R/n).write_bytes((SRC/n).read_bytes())
head=os.environ.get('GITHUB_SHA','LOCAL_UNPUBLISHED')
html=(R/'index.html').read_text().replace('BUILD_ID',head[:12]);(R/'index.html').write_text(html)
manifest={'version':'wm-lighting-0.1.1','sourceHead':head,'baselineRef':'a8082f84fef9cff9987124b2d863520320ef756f','parentRuntime':LOCK,'files':{},'dependencies':{'../'+k:{'sha256':v} for k,v in LOCK.items() if k not in ['runtime.js','view.glsl']},'writeScope':['weather-mother/method-v100/lighting-src','weather-mother/method-v100/lighting','.github/workflows/weather-mother-lighting-v101.yml'],'neutralAlgorithmPreserved':True,'sourceDensityUnchanged':True,'sourcePolicyUnchanged':True,'cloudDynamicsChanged':False,'storedImageAssets':0,'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False,'userHardwarePerformanceVerified':False,'status':'BUILT_UNVERIFIED'}
for n in ['index.html','runtime.js','view.glsl','studio.js']:
 b=(R/n).read_bytes();manifest['files'][n]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
manifest['runtimeBytes']=sum(v['bytes'] for v in manifest['files'].values());(R/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Built',manifest['runtimeBytes'],'bytes; no source or policy rewrite')
