"""Reproducible, fail-closed patch of the user's accepted Weather Mother V061 HQ.
No external assets. Only the isolated V062 candidate directory is generated.
"""
from pathlib import Path
import hashlib,json,re,sys
HERE=Path(__file__).resolve().parent
BASE=Path(sys.argv[1]) if len(sys.argv)>1 else HERE.parent/'v061-hq'
SHA={'index.html':'84fa548bc7b08ce13f4eb483d2df55ee8f25708b216ff5f2e3522ccd019f7851','engine.js':'ed7cfa28cc953c0173212f9d6b7535d0d0570135be37ec1810935a30454d131e','field-worker.js':'ee6c47d4e5b41b984038c28538b5118916a746ee80a4ae1526c0c8c59b4803a7','cloud.glsl':'f9f7593501a611272c6e8ce34c6d5373b0fb2f798cf43ce1286f508b6ef94d64'}
S={}
for name,sha in SHA.items():
 b=(BASE/name).read_bytes();assert hashlib.sha256(b).hexdigest()==sha,f'Unrecognized baseline {name}'
 S[name]=b.decode()
def replace(name,old,new):
 assert S[name].count(old)==1, f'Patch anchor mismatch in {name}: {old[:90]}'
 S[name]=S[name].replace(old,new)
for name in S:S[name]=S[name].replace('0.6.1','0.6.2').replace('061hq-r3','062loop-r1').replace('HQ','LOOP')
# Preserve every original workbench control. Add loop and measurement controls near top.
panel='''<details open id="loopSection"><summary>连续形态循环</summary>
<label class="check"><input id="loopEnabled" type="checkbox" checked>同一种子无缝演化</label>
<div class="row"><label for="loopSeconds">周期 秒</label><input id="loopSeconds" type="range" min="12" max="300" step="1" value="60"><output></output></div>
<div class="row"><label for="loopAmount">变化幅度</label><input id="loopAmount" type="range" min="0" max="1" step=".01" value=".6"><output></output></div>
<div class="row"><label for="loopPhase">循环进度</label><input id="loopPhase" type="range" min="0" max="100" step=".1" value="0"><output>0%</output></div>
<div class="buttons"><button id="loopPause">冻结形态</button><button id="loopRestart">回到循环起点</button></div>
<p class="hint">云体在生长与消散间连续变化；种子身份保持。周期按 1×、内部演化 1× 计算。漂移与日照独立，全局暂停可冻结画面。</p></details>
<details id="perfSection"><summary>性能与空区优化</summary><label class="check"><input id="fastEmpty" type="checkbox" checked>保守空区排除，保留原采样数</label>
<pre id="perfReadout" class="hint" style="white-space:pre-wrap">等待有效帧样本…</pre><button id="perfReset">重新测量</button>
<p class="hint">显示完成帧的实际速率及 P95 耗时。GPU 计时不受支持时显示不可用。优化不删除光照，也不偷偷降低分辨率。</p></details>
<details id="lightningSection"><summary>雷电事件</summary><label class="check"><input id="lightningEnabled" type="checkbox">雷暴自动放电，包含闪光</label>
<div class="row"><label for="lightningRate">每分钟事件</label><input id="lightningRate" type="range" min="0" max="20" step="1" value="6"><output></output></div>
<div class="row"><label for="lightningPower">闪电亮度</label><input id="lightningPower" type="range" min="0" max="2" step=".01" value=".9"><output></output></div>
<button id="lightningOnce">演示一次局部放电</button><p class="hint">分支电光与云内照亮共用同一事件。台风眼、眼墙和雨带的规则已整理，台风流体仿真尚未实现。</p></details>'''
replace('index.html','<details open><summary>风与运动</summary>',panel+'<details open><summary>风与运动</summary>')
replace('index.html','<script src="engine.js?v=062loop-r1"','<script src="motion.js?v=062loop-r1"></script><script src="engine.js?v=062loop-r1"')
replace('index.html','视觉候选 · 待人工验收','V062 循环候选 · 保留 V061 基线')
# Conservative occupied-cell mask, constructed from nonzero scalar support.
worker_helper='''
function occupancyField(data,dims,lo,hi){
 const size=dims.map(n=>Math.ceil(n/4)),[ox,oy,oz]=size,[nx,ny,nz]=dims;
 let a=new Uint8Array(ox*oy*oz);const spacing=hi.map((v,k)=>(v-lo[k])/size[k]);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(data[(z*ny+y)*nx+x])a[((Math.floor(z/4)*oy+Math.floor(y/4))*ox+Math.floor(x/4))]=255;
 // Detailed density applies at most .55 km per axis after flowPos. One extra
 // occupied cell covers trilinear interpolation and all boundary rounding.
 const radius=spacing.map(v=>Math.ceil(.56/v)+1);
 for(let axis=0;axis<3;axis++){const out=new Uint8Array(a.length),r=radius[axis],stride=[1,ox,ox*oy][axis];
  for(let z=0;z<oz;z++)for(let y=0;y<oy;y++)for(let x=0;x<ox;x++){const pos=[x,y,z],k=(z*oy+y)*ox+x;let v=0;for(let j=Math.max(-r,-pos[axis]);j<=Math.min(r,size[axis]-1-pos[axis]);j++)if(a[k+j*stride]){v=255;break;}out[k]=v;}a=out;
 }
 let occupied=0;for(const v of a)if(v)occupied++;
 return{data:a,size,radius,occupied,total:a.length,detailWarpBoundKm:.56};
}
'''
replace('field-worker.js','self.onmessage=({data:c})=>{try{',worker_helper+'\nself.onmessage=({data:c})=>{try{')
# Increase acceleration intervals, never alter or crop the accepted density support.
S['field-worker.js']=S['field-worker.js'].replace('r[k]-2.6','r[k]-3.8').replace('r[k]+2.6','r[k]+3.8')
replace('field-worker.js','self.postMessage({id:c.id,kind:c.kind,data:out,groups,lobes:lobes.length,borderMax:border,supportSafe,seed:c.seed,spacing,tau,shadowSize},[out.buffer,tau.buffer]);',
'''const occupancy=occupancyField(out,c.dims,c.min,c.max);
self.postMessage({id:c.id,kind:c.kind,data:out,groups,lobes:lobes.length,borderMax:border,supportSafe,seed:c.seed,spacing,tau,shadowSize,occupancy},[out.buffer,tau.buffer,occupancy.data.buffer]);''')
# Renderer extension: exact periodic coordinates, conservative empty-space gate,
# sample-footprint-limited micro detail and localized lightning.
replace('cloud.glsl','uniform vec2 uRes,uSurface;', '''uniform vec2 uRes,uSurface;
uniform vec3 uLoop,uOccupancySize;uniform float uFastEmpty,uMicroFilter;
uniform sampler3D uOccupancy;uniform vec4 uLightning;
uniform vec4 uBoltA[15],uBoltB[15];uniform int uBoltCount;
float sampleFootprint=0.;
vec3 periodicSignal(){float t=6.28318530718*fract(uLoop.y);return vec3(cos(t)-1.,sin(t),sin(2.*t));}
vec3 cycleWarp(vec3 q,float t){return vec3(sin(q.z*.74+t)*cos(q.y*.61-2.*t),sin(q.x*.68+2.*t)*cos(q.z*.53+t),sin(q.y*.59-t)*cos(q.x*.67+2.*t));}
''')
replace('cloud.glsl','q+=curl*turbulence;if(uEffects.x>.5)', '''if(uLoop.x>.5){float t=6.28318530718*fract(uLoop.y);vec3 cy=cycleWarp(q,t),c0=cycleWarp(q,0.);q+=(cy-c0)*uLoop.z*(.34+turbulence*.65);}else q+=curl*turbulence;if(uEffects.x>.5)''')
replace('cloud.glsl','float densityAt(vec3 p,bool detail){vec3 q=flowPos(p);float b;', '''float densityAt(vec3 p,bool detail){vec3 q=flowPos(p);float b;
if(uFastEmpty>.5&&uBlend>.999){vec3 uv=(q-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return 0.;ivec3 cell=ivec3(clamp(floor(uv*uOccupancySize),vec3(0),uOccupancySize-1.));if(texelFetch(uOccupancy,cell,0).r<.5)return 0.;}
''')
replace('cloud.glsl','float broad=fb(q*2.2+vec3(0.,-uEvolution*.004,0.)),billow=', '''vec3 evolve=uLoop.x>.5?periodicSignal()*vec3(.52,.38,.23)*uLoop.z:vec3(0.,-uEvolution*.004,0.);
float broad=fb(q*2.2+evolve),billow=''')
replace('cloud.glsl','fine=fb(q*19.7+3.),edge=', 'fine=mix(.5,fb(q*19.7+3.),mix(1.,1.-smoothstep(.04,.16,sampleFootprint),uMicroFilter)),edge=')
replace('cloud.glsl','float flash=uEffects.w*exp(-pow(fract(uTime*.11)-.30,2.)/.00006);L+=vec3(.6,.76,1.2)*flash*exp(-dot(p-vec3(.7,4.8,0.),p-vec3(.7,4.8,0.))*.09);return L;', '''vec3 flashDelta=p-uWind-uLightning.xyz;float flashFalloff=exp(-length(flashDelta)*.68)/(1.+dot(flashDelta,flashDelta)*.22);L+=vec3(1.35,1.75,2.65)*uLightning.w*flashFalloff;return L;''')
bolt='''
vec4 boltRadiance(vec3 ro,vec3 rd,float opaque){vec3 radiance=vec3(0);float nearest=1e4;if(uLightning.w<.002)return vec4(0,0,0,1e4);
for(int k=0;k<15;k++){if(k>=uBoltCount)break;vec3 a=uBoltA[k].xyz+uWind,b=uBoltB[k].xyz+uWind,v=b-a,o=ro-a;float vv=dot(v,v),rv=dot(rd,v),s=clamp((dot(o,v)-rv*dot(o,rd))/max(vv-rv*rv,1e-6),0.,1.);vec3 p=a+s*v;float t=dot(p-ro,rd);if(t<=0.||t>=opaque)continue;float d=length(ro+rd*t-p),w=max(.003,t*.48/uRes.y*.75),core=exp(-d*d/(w*w)),halo=exp(-d*d/(w*w*30.))*.07;
radiance+=(vec3(4.5,5.2,6.4)*core+vec3(.5,.9,2.)*halo)*uBoltA[k].w*uLightning.w;if(core+halo>.001)nearest=min(nearest,t);}
return vec4(radiance,nearest);}
'''
replace('cloud.glsl','void main(){vec2 xy=',bolt+'\nvoid main(){vec2 xy=')
replace('cloud.glsl','float tr=1.,moment=0.;vec3 light=vec3(0);', 'float tr=1.,moment=0.,boltTr=1.;bool boltCrossed=false;vec3 light=vec3(0);vec4 bolt=boltRadiance(ro,rd,opaque);')
replace('cloud.glsl','vec3 p=ro+rd*t;float d=densityAt(p,true);', 'if(!boltCrossed&&t>=bolt.a){boltTr=tr;boltCrossed=true;}vec3 p=ro+rd*t;sampleFootprint=max(t*.96/uRes.y,len*.35);float d=densityAt(p,true);')
replace('cloud.glsl','vec3 col=light+tr*bg+bow(rd,tr);', 'if(!boltCrossed)boltTr=tr;vec3 col=light+tr*bg+bow(rd,tr)+bolt.rgb*boltTr;')
# Runtime wiring.
replace('engine.js',"const hdr=!!gl.getExtension('EXT_color_buffer_float');", "const Motion=window.WeatherMotion;if(!Motion){fail('循环模块未加载','motion');return;}const profiler=new Motion.FrameStats(gl);\nconst hdr=!!gl.getExtension('EXT_color_buffer_float');")
replace('engine.js',"'evolution','silver','groundLight'];", "'evolution','silver','groundLight','loopSeconds','loopAmount','lightningRate','lightningPower'];")
replace('engine.js','silver:1,groundLight:1},target=', 'silver:1,groundLight:1,loopSeconds:60,loopAmount:.6,lightningRate:6,lightningPower:.9},target=')
replace('engine.js','let windOffset=[0,0,0]', 'let loopPhase=0,loopPlaying=true,previousPhase=0,forcedFlash=-1e9,previousFlash=0,lightningEvent=null;\nlet windOffset=[0,0,0]')
replace('engine.js','oldShadowTex=gl.createTexture();', 'oldShadowTex=gl.createTexture(),occupancyTex=gl.createTexture();let occupancySize=[1,1,1],occupancyReady=false;')
replace('engine.js','function setShadow(tex,data,size){', 'set3D(occupancyTex,new Uint8Array([255]),[1,1,1]);\nfunction setShadow(tex,data,size){')
replace('engine.js','uniform float uValid;', 'uniform float uValid,uMotionTrust;')
replace('engine.js','weight=.89*valid;', 'weight=.89*valid*uMotionTrust;')
replace('engine.js',"k==='count'?Math.round(v):v.toFixed(2)","(k==='count'||k==='loopSeconds'||k==='lightningRate')?Math.round(v):v.toFixed(2)")
replace('engine.js',"function setWeather(id){if(!presets[id])", "function setWeather(id){$('lightningEnabled').checked=id==='storm';if(!presets[id])")
replace('engine.js',"const params=new URLSearchParams(location.search),boot=window.WeatherMotherBoot||{};", "const params=new URLSearchParams(location.search),boot=window.WeatherMotherBoot||{};if(params.get('loop')==='0')$('loopEnabled').checked=false;")
replace('engine.js',"$('mountains').checked=weather==='mountain';$('rainbow').checked=weather==='rainbow';fitView();", "$('mountains').checked=weather==='mountain';$('rainbow').checked=weather==='rainbow';$('lightningEnabled').checked=weather==='storm';fitView();")
replace('engine.js',"function pause(){playing=false;", "function pause(){profiler.reset();playing=false;")
replace('engine.js',"function play(){playing=true;", "function play(){profiler.reset();playing=true;")
controls='''
$('loopEnabled').onchange=()=>{invalidate();};
$('loopPause').onclick=()=>{loopPlaying=!loopPlaying;$('loopPause').textContent=loopPlaying?'冻结形态':'继续循环';invalidate();};
function setPhase(p){loopPhase=((p%1)+1)%1;previousPhase=loopPhase;$('loopPhase').value=loopPhase*100;$('loopPhase').nextElementSibling.textContent=(loopPhase*100).toFixed(1)+'%';invalidate();}
$('loopRestart').onclick=()=>setPhase(0);
$('loopPhase').oninput=e=>{loopPlaying=false;$('loopPause').textContent='继续循环';setPhase(+e.target.value/100);};
$('fastEmpty').onchange=invalidate;$('perfReset').onclick=()=>{profiler.reset();invalidate();};
$('lightningEnabled').onchange=invalidate;$('lightningOnce').onclick=()=>{forcedFlash=time;if(!playing)play();invalidate();};
'''
replace('engine.js',"addEventListener('resize',invalidate);", controls+"\naddEventListener('resize',invalidate);")
replace('engine.js',"if(gpuFence){if(gl.getSyncParameter(gpuFence,gl.SYNC_STATUS)!==gl.SIGNALED)return;gl.deleteSync(gpuFence);gpuFence=null;}", "profiler.poll();if(gpuFence){if(gl.getSyncParameter(gpuFence,gl.SYNC_STATUS)!==gl.SIGNALED)return;profiler.complete(now);gl.deleteSync(gpuFence);gpuFence=null;}")
replace('engine.js','lastData=d.data;oldGroups=groups;', '''lastData=d.data;if(d.occupancy){set3D(occupancyTex,d.occupancy.data,d.occupancy.size);gl.bindTexture(gl.TEXTURE_3D,occupancyTex);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);occupancySize=d.occupancy.size;occupancyReady=true;qa.occupancy={bytes:d.occupancy.data.byteLength,occupied:d.occupancy.occupied,total:d.occupancy.total,warpBoundKm:d.occupancy.detailWarpBoundKm};}oldGroups=groups;''')
replace('engine.js','evolutionTime+=simDt*state.evolution;const a=', 'evolutionTime+=simDt*state.evolution;if(loopPlaying)loopPhase=Motion.phaseAdvance(loopPhase,simDt,state.loopSeconds,state.evolution);const a=')
replace('engine.js','dirty=false;resize();const tick=performance.now();', '''dirty=false;resize();const tick=performance.now();profiler.begin();
lightningEvent=Motion.lightning(time,seed,state.lightningRate,state.lightningPower,$('lightningEnabled').checked,forcedFlash);
if(lightningEvent.strength>.001||previousFlash>.001)historyValid=false;
''')
replace('engine.js','[4,oldShadowTex]])', '[4,oldShadowTex],[8,occupancyTex]])')
replace('engine.js',"i(prog,'uOldShadow',4);", "i(prog,'uOldShadow',4);i(prog,'uOccupancy',8);v3(prog,'uOccupancySize',occupancySize);f(prog,'uFastEmpty',$('fastEmpty').checked&&occupancyReady?1:0);f(prog,'uMicroFilter',1);v3(prog,'uLoop',[$('loopEnabled').checked?1:0,loopPhase,state.loopAmount]);v4(prog,'uLightning',[...lightningEvent.origin,lightningEvent.strength]);const bolts=Motion.boltSegments(seed,lightningEvent.eventId,lightningEvent.origin);i(prog,'uBoltCount',bolts.length);gl.uniform4fv(loc(prog,'uBoltA[0]'),new Float32Array(bolts.flatMap(a=>[a[0],a[1],a[2],a[6]])));gl.uniform4fv(loc(prog,'uBoltB[0]'),new Float32Array(bolts.flatMap(a=>[a[3],a[4],a[5],0])));")
replace('engine.js',"f(resolve,'uValid',hdr&&historyValid&&$('temporal').checked?1:0);", "f(resolve,'uValid',hdr&&historyValid&&$('temporal').checked?1:0);const phaseDelta=Math.min(Math.abs(loopPhase-previousPhase),1-Math.abs(loopPhase-previousPhase));f(resolve,'uMotionTrust',Math.exp(-phaseDelta*state.loopAmount*60));")
replace('engine.js','gpuFence=gl.fenceSync(', 'profiler.end();previousPhase=loopPhase;previousFlash=lightningEvent.strength;\ngpuFence=gl.fenceSync(')
replace('engine.js','qa.independentWindAndCloudSpeed=true;', "qa.independentWindAndCloudSpeed=true;qa.loop={enabled:$('loopEnabled').checked,playing:loopPlaying,phase:loopPhase,periodSeconds:state.loopSeconds,amplitude:state.loopAmount,scope:'material-space shape only; drift and lighting independent'};qa.flash={strength:lightningEvent.strength,eventId:lightningEvent.eventId};qa.fastEmpty=$('fastEmpty').checked;qa.performance=profiler.read();$('loopPhase').value=loopPhase*100;$('loopPhase').nextElementSibling.textContent=(loopPhase*100).toFixed(1)+'%';")
replace('engine.js',"fpsFrames=0;fpsStart=now;$('status').textContent=", "fpsFrames=0;fpsStart=now;const pr=qa.performance,fmt=v=>v===null?'不可用':v.toFixed(1);$('perfReadout').textContent='完成帧率 '+(playing?fmt(pr.renderedFPS)+' FPS':'暂停')+'\\n帧耗时 P50 / P95 '+fmt(pr.frameP50ms)+' / '+fmt(pr.frameP95ms)+' ms\\nGPU P50 / P95 '+fmt(pr.gpuP50ms)+' / '+fmt(pr.gpuP95ms)+' ms\\n采样 '+steps+' 步 · '+w+'×'+h+'\\n保守空区 '+($('fastEmpty').checked?'开启':'关闭');$('status').textContent=")
replace('engine.js','window.WeatherMother={qa,setWeather,setKind,set:', 'window.WeatherMother={qa,setWeather,setKind,setLoopPhase:setPhase,triggerLightning:()=>{forcedFlash=time;invalidate();},setTestTime:(v)=>{time=v;invalidate();},resetMeasurements:()=>profiler.reset(),set:')
replace('engine.js','distance,blend,windOffset:[...windOffset]}),reset:', 'distance,blend,windOffset:[...windOffset],loopPhase,loopPlaying}),reset:')
# Extend explicit scopes and QA state without declaring physical weather simulation.
for name,text in S.items():(HERE/name).write_text(text)
files={}
for name in [*SHA,'motion.js']:
 b=(HERE/name).read_bytes();files[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(HERE/'MANIFEST.json').write_text(json.dumps({'productionLine':'Weather Mother','version':'0.6.2-loop','baseline':'0.6.1-hq-r3','baselineSHA256':SHA,'files':files,'totalRuntimeBytes':sum(x['bytes'] for x in files.values()),'storedImageAssets':0,'status':'BUILT_UNVERIFIED','manualVisualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'fluidSimulation':False},ensure_ascii=False,indent=2)+'\n')
print('Weather Mother V062 built:',sum(x['bytes'] for x in files.values()),'bytes')
