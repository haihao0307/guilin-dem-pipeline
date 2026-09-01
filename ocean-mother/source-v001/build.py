from pathlib import Path
import sys,zipfile,hashlib,json,shutil,subprocess
SOURCE=Path(__file__).resolve().parent
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
Z=Path('weather-mother/distributions/Weather_Mother_Clean_V1.0.0.zip')
assert len(Z.read_bytes())==37906 and hashlib.sha256(Z.read_bytes()).hexdigest()=='596b963fef0cc2eafe7855178ae9f93c3e2aef2b78bdf98dd5e9e49c1a443bae'
with zipfile.ZipFile(Z) as z:
 assert z.testzip() is None
 m=json.loads(z.read('Weather_Mother_Clean_V1.0.0/MANIFEST.json'))
 for name,f in m['files'].items():
  b=z.read('Weather_Mother_Clean_V1.0.0/'+name);assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'],name
 (OUT/'weather').mkdir(exist_ok=True)
 for n in z.namelist():
  if not n.endswith('/'):(OUT/'weather'/Path(n).name).write_bytes(z.read(n))
for name in ['index.html','studio.css','ocean.js']:shutil.copyfile(SOURCE/name,OUT/name)
subprocess.check_call([sys.executable,str(SOURCE/'shaders.py'),str(OUT)])
water=(OUT/'water.frag').read_text().replace('float patch=','float foamPattern=').replace('.38,.72,patch)','.38,.72,foamPattern)')
(OUT/'water.frag').write_text(water)
b=(OUT/'weather/engine.js').read_text()
state=b[b.index('const state='):b.index('let seed=')].replace('const state=','let state=')
pres=b[b.index('const presets='):b.index('const descriptions=')]
getenv=b[b.index('function getEnvironment(){'):b.index('\nwindow.WeatherMother={qa,packageVersion:')]
js="""/* Ocean adapter. getEnvironment body and default state below are extracted verbatim from
Weather Mother Clean V1.0; frozen source files in weather/ remain byte-identical. */
(function(root){'use strict';const normal=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
"""+state+pres+"""
let seed=4217,kind='Cu',weather='fair',time=0,evolutionTime=0,playing=true,loopPhase=0,windOffset=[0,0,0];
const switches={windLink:false};const $=k=>({checked:!!switches[k]});
"""+getenv+"""
function tick(dt){if(!playing)return;const d=dt*state.timeScale;time+=d;evolutionTime+=d*state.evolution;loopPhase=(loopPhase+d*state.evolution/state.loopSeconds)%1;const e=getEnvironment();windOffset=windOffset.map((v,k)=>v+e.cloud.velocityMps[k]*.001*d)}
function set(k,v){if(typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid weather value');state[k]=v}
function setWeather(k){if(!Object.hasOwn(presets,k))throw Error('Unknown weather');weather=k;Object.assign(state,presets[k]);kind=presets[k].kind}
root.OceanWeather={getEnvironment,tick,set,setWeather,presets,setSeed:v=>seed=v>>>0,setKind:v=>kind=v,pause:()=>playing=false,play:()=>playing=true,snapshot:()=>({...state,seed,kind,weather,time,evolutionTime,playing,loopPhase,windOffset:[...windOffset]}),reset:()=>{time=0;evolutionTime=0;loopPhase=0;windOffset=[0,0,0]}};
})(window);
"""
(OUT/'weather-contract.js').write_text(js)
s=(OUT/'ocean.js').read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:75],s.count(a));s=s.replace(a,b)
rep('function frame(now){requestAnimationFrame(frame);try{','function frame(now){if(qa.errors.length)return;requestAnimationFrame(frame);try{')
rep('const dt=Math.min(Math.max(0,(now-last)/1000),.35);last=now;if(!paused){','const dt=Math.max(0,(now-last)/1000);last=now;if(!paused&&qa.ready){')
rep('common(seaProgram,now,s,e,c);','gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);common(seaProgram,now,s,e,c);')
rep('Math.min(1,dt*2);currentA[k]','(paused?1:Math.min(1,dt*2));currentA[k]')
rep('Math.min(1,dt*2)}','(paused?1:Math.min(1,dt*2))}')
rep('qa.lastBakeMs=now-bakeStart;','qa.lastBakeMs=now-bakeStart;qa.atlasHour=s.hour;qa.atlasKind=s.kind;')
rep('setView:(yaw,pitch,height)=>','getReadiness:()=>({baking,envForce,envDirty,envMix,lightBusy,pendingVolume:!!pendingVolume}),setView:(yaw,pitch,height)=>')
(OUT/'ocean.js').write_text(s)
v=(OUT/'ocean.vert').read_text().replace('max(16.,d*1.48)','max(16.,d*tanFov*aspect*1.35)');(OUT/'ocean.vert').write_text(v)
README='''# Ocean Mother V0.1

独立海洋工作台，输入固定为 Weather Mother Clean V1.0.0。天气原件位于 weather/，全部按原始 ZIP manifest 校验；不修改共享仓库天气内核，不接入其他 DEM 或温州资产。

运行：将此目录以 HTTP/HTTPS 静态托管，打开 index.html。无需 npm、CDN、API 密钥、图片或外部模型。WebGL2 必需。

已实现：单画布海面与天空；24 个定向 Gerstner 几何波及 12 层抗混叠微波法线；解析深水色散；Fresnel 反射、太阳高光、波峰压缩泡沫外观；六个海况；独立风力、云速和海浪演示速度；天气光照同一时钟。云辐射缓存在浏览器显存由原版密度/光照函数生成，天空和海水倒影共用；未存图片素材。

适配范围：这是海面视角的远景天空环境缓存，分条生成后完整交换。近云的视差反射和穿云飞行不在本版。天气反射缓存与海浪采用不同更新频率，首次生成以及换天气需要等待云缓存。阴雨等海况只接入云形、风和光色，降雨粒子、闪电、雪粒子及彩虹未迁移到海洋画布。原完整天气工作台单独保留链接。

水色与泡沫属于图形近似。没有 FFT 海浪谱、流体求解、真实岸线、海底、潮汐、破碎浪或船舶交互。操作采样值由 UI 定义，不能作为实测天气或真实海洋地理。3A 视觉和用户显卡帧率仍待验收。

技术来源：NVIDIA GPU Gems Chapter 1 Effective Water Simulation from Physical Models；Khronos EXT_disjoint_timer_query_webgl2；用户 Weather Mother 交接包。新增海面实现为本轮代码，来源包只提供天气侧。
'''
(OUT/'README.md').write_text(README)
meta={'productionLine':'Ocean Mother','version':'0.1.0','weatherPackage':'1.0.0-clean','weatherZipSHA256':hashlib.sha256(Z.read_bytes()).hexdigest(),'weatherSourceRef':'2619725efe236d2df8f2a55031bdae9e60a51555','weatherEnvironmentFunctionSHA256':hashlib.sha256(getenv.encode()).hexdigest(),'weatherFilesUnmodified':True,'storedImageAssets':0,'singleCanvas':True,'cloudReflection':'shared progressive hemisphere radiance cache; distant-environment approximation','newWaterModel':'24 directional Gerstner components and 12 filtered micro-slope harmonics','seaPresets':['breeze','calm','swell','golden','gale','lagoon'],'fullFluidSolverImplemented':False,'oceanBathymetryImplemented':False,'aaaQualityApproved':False,'visualAcceptance':False,'productionReady':False}
files={}
for p in sorted(OUT.rglob('*')):
 if p.is_file():
  data=p.read_bytes();files[str(p.relative_to(OUT))]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
meta['files']=files;meta['sourceBytes']=sum(f['bytes'] for f in files.values());meta['status']='BUILT_PENDING_BROWSER_QA'
(OUT/'MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('Ocean Mother built',meta['sourceBytes'],'bytes, weather unchanged')
