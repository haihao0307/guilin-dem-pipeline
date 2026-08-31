"""Weather Mother V063. Pinned V062 source, additive optics, no baseline writes."""
from pathlib import Path
import hashlib,json,sys
R=Path(__file__).resolve().parent
B=Path(sys.argv[1]) if len(sys.argv)>1 else R.parent/'v062-loop'
LOCK={'index.html':'16025fcb733fff7f362d1b75a475796b5ba7190ee60eb611030d03378e4606ff','engine.js':'268aa2945427848091bce465df3101419161da48ee9a50b0448011cf1db96a35','field-worker.js':'8c4402977790dc2e9c6116f6f4ac8d75b88bda967183f2df077970663a44aa4e','cloud.glsl':'d0d28a6321d26cf83e2380dac032aee1741bdd87a58cda4883110dab642b0626','motion.js':'29c24326ac67ab6823bc411d26fd7f19ba45ea4f933be8ab305f1bd456fceb1d'}
S={}
for n,sha in LOCK.items():
 b=(B/n).read_bytes();assert hashlib.sha256(b).hexdigest()==sha, 'Baseline changed: '+n
 S[n]=b.decode().replace('0.6.2','0.6.3').replace('062loop-r1','063optics-r1')
def rep(n,a,b):
 assert S[n].count(a)==1,(n,'anchor',a[:100],S[n].count(a))
 S[n]=S[n].replace(a,b)
def section(n,a,b,new):
 x=S[n].index(a);y=S[n].index(b,x);S[n]=S[n][:x]+new+S[n][y:]
rep('index.html','<option value="high">高空冰云</option>', '<option value="high">高空冰云</option><option value="iridescent">七彩薄云 · 虹彩</option><option value="irisEdge">七彩云缘 · 日照</option><option value="lenticular">山前荚状云</option><option value="mackerel">鱼鳞状卷积云</option><option value="dawn">晨光低云</option><option value="sunset">落日积云</option><option value="fogbank">湿雾云海</option><option value="nightstorm">夜间雷暴</option>')
panel='''<details open id="irisSection"><summary>七彩云 · 云体虹彩</summary>
<label class="check"><input id="iridescence" type="checkbox">启用近太阳方向的云体虹彩</label>
<div class="row"><label for="iriStrength">彩色强度</label><input id="iriStrength" type="range" min="0" max="2" step=".02" value="0"><output></output></div>
<div class="row"><label for="dropletRadius">滴半径 μm</label><input id="dropletRadius" type="range" min="1" max="16" step=".1" value="6"><output></output></div>
<div class="row"><label for="dropletSpread">粒径离散</label><input id="dropletSpread" type="range" min="0" max="1" step=".02" value=".12"><output></output></div>
<button id="aimIris">对准七彩云观察角度</button>
<p class="hint">多波段衍射外观近似。色彩取决于日照角、滴径和云体光学厚度，随观察方向变化。没有彩色图片贴片。</p></details>'''
rep('index.html','<details open id="loopSection">',panel+'<details open id="loopSection">')
rep('index.html','<pre id="perfReadout"', '<label class="check"><input id="skipEmpty" type="checkbox" checked>距离下界跳过确定为空的采样区</label><pre id="perfReadout"')
rep('index.html','<button id="lightningOnce">', '<div class="row"><label for="dischargeMode">放电类型</label><select id="dischargeMode"><option value="auto">混合事件</option><option value="intra">云内放电</option><option value="ground">云地放电</option></select></div><button id="lightningOnce">')
rep('index.html','分支电光与云内照亮共用同一事件。台风眼、眼墙和雨带的规则已整理，台风流体仿真尚未实现。','连续分叉通道、短促复击与多点云内照亮。闪电仍待参考校准；台风眼、眼墙及雨带只有规则，尚无台风仿真。')
rep('index.html','<script src="motion.js?v=063optics-r1"></script>', '<script src="motion.js?v=063optics-r1"></script><script src="optics.js?v=063optics-r1"></script>')
S['index.html']=S['index.html'].replace('V062 循环候选','V063 虹彩候选')
helper='''
function occupancyDistance(mask,size){const [nx,ny,nz]=size,n=mask.length,dist=new Uint8Array(n),queue=new Int32Array(n);dist.fill(255);let head=0,tail=0;
 for(let k=0;k<n;k++)if(mask[k]){dist[k]=0;queue[tail++]=k;}
 while(head<tail){const k=queue[head++],x=k%nx,y=Math.floor(k/nx)%ny,z=Math.floor(k/(nx*ny)),nd=dist[k]+1;
 for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy&&!dz)continue;let xx=x+dx,yy=y+dy,zz=z+dz;if(xx<0||xx>=nx||yy<0||yy>=ny||zz<0||zz>=nz)continue;let j=(zz*ny+yy)*nx+xx;if(nd<dist[j]){dist[j]=nd;queue[tail++]=j;}}}
 return dist;}
'''
rep('field-worker.js','function occupancyField(',helper+'\nfunction occupancyField(')
rep('field-worker.js','return{data:a,size,radius,occupied,total:a.length,detailWarpBoundKm:.56};','const distance=occupancyDistance(a,size);return{data:a,distance,size,radius,occupied,total:a.length,detailWarpBoundKm:.56};')
rep('field-worker.js','[out.buffer,tau.buffer,occupancy.data.buffer]);','[out.buffer,tau.buffer,occupancy.data.buffer,occupancy.distance.buffer]);')
rep('field-worker.js',"if(c.kind==='Cu'||c.kind==='Cb'){",'''if(c.case==='iridescent'){
const start=lobes.length;for(let k=0;k<18+c.count*3;k++){let x=(random()-.5)*13,z=(random()-.5)*7,ph=x*.40+z*.22;let y=4.0+.16*Math.sin(ph);lobe(x,y,z,1.3+random()*.85,.14+random()*.075,.85+random()*.50,.18);}group(start);
}else if(c.case==='lenticular'){
const start=lobes.length;for(let j=0;j<3;j++)for(let k=0;k<5;k++){let a=k*.72,x=(k-2)*.52+.25*j,y=3.55+j*.47+.05*Math.sin(a);lobe(x,y,-.25*j,2.45-j*.28,.22,.94+j*.06,.20);}group(start);
}else if(c.case==='mackerel'){
const start=lobes.length;for(let row=0;row<6;row++)for(let j=0;j<7+c.count;j++){let x=(j-(6+c.count)*.5)*1.17,z=(row-2.5)*1.68+.3*Math.sin(j*.74),y=6.+.13*Math.sin(j*.68+row*.55),r=.33+random()*.13;lobe(x+(random()-.5)*.22,y,z,r,.20+random()*.06,r*1.15,.05);}group(start);
}else if(c.kind==='Cu'||c.kind==='Cb'){''')
rep('engine.js','const Motion=window.WeatherMotion;', 'const Optics=window.WeatherOptics;if(!Optics){fail("光学模块未加载","optics");return;}const Motion=window.WeatherMotion;')
rep('engine.js',"'lightningRate','lightningPower'];", "'lightningRate','lightningPower','iriStrength','dropletRadius','dropletSpread'];")
rep('engine.js','lightningRate:6,lightningPower:.9},target=', 'lightningRate:6,lightningPower:.9,iriStrength:0,dropletRadius:6,dropletSpread:.12},target=')
rep('engine.js','lightningEvent=null;', 'lightningEvent=null,manualDischarge=0,channelKey="",channelData=null;')
rep('engine.js','function set3D(','''Object.assign(presets,{
iridescent:{kind:'Ac',density:.32,count:5,detail:.43,hour:17.0,rain:0,fog:0,humidity:74,instability:.10,snow:0,iriStrength:1.35,dropletRadius:4.8,dropletSpread:.08,shear:.12},
irisEdge:{kind:'Cu',density:.50,count:2,detail:.60,hour:17.0,rain:0,fog:.01,humidity:70,instability:.34,snow:0,iriStrength:1.25,dropletRadius:5.4,dropletSpread:.14},
lenticular:{kind:'Ac',density:.55,count:3,detail:.22,hour:16.2,rain:0,fog:.03,humidity:79,instability:.10,snow:0,wind:22,cloudSpeed:3,shear:.35},
mackerel:{kind:'Cc',density:.48,count:5,detail:.40,hour:15.2,rain:0,fog:.02,humidity:64,instability:.18,snow:0},
dawn:{kind:'Sc',density:.55,count:5,hour:6.55,rain:0,fog:.09,humidity:82,instability:.18,snow:0},
sunset:{kind:'Cu',density:.78,count:4,hour:17.55,rain:0,fog:.04,humidity:65,instability:.54,snow:0},
fogbank:{kind:'St',density:.42,count:7,hour:7.4,rain:0,fog:.62,humidity:97,instability:.08,snow:0},
nightstorm:{kind:'Cb',density:1.00,count:4,hour:21.3,rain:.68,fog:.10,humidity:94,instability:.95,snow:0}});
Object.assign(descriptions,{iridescent:'七彩薄云：日光在薄云微粒附近产生虹彩，色带依附云体并随角度变化。',irisEdge:'七彩云缘：保留积云重量，彩色只进入透光云缘。',lenticular:'层叠透镜状高积云，表现稳定气流中的荚状组织。',mackerel:'细小云胞排列成起伏的波带，保留高空透光感。',dawn:'清晨低云，暖色初照与冷色背光连续过渡。',sunset:'落日侧照积云，保留亮缘和有层次的冷色暗部。',fogbank:'低层云与湿雾衔接，图形近似的云海案例。',nightstorm:'夜间深对流，云内放电与云地短促复击共用事件时钟。'});
function set3D(''')
rep('engine.js','occupancyReady=false;', 'occupancyReady=false;const distanceTex=gl.createTexture(),irisTex=gl.createTexture(),boltTex=gl.createTexture();let distanceReady=false;')
rep('engine.js','function setShadow(tex,data,size){', '''set3D(distanceTex,new Uint8Array([0]),[1,1,1]);
function numeric2D(tex,width,height,data,linear){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,linear?gl.RGBA16F:gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,data);}
const irisLUT=Optics.makeDiffractionLUT();numeric2D(irisTex,irisLUT.width,irisLUT.height,irisLUT.data,true);numeric2D(boltTex,320,1,new Float32Array(1280),false);qa.opticsLutBytes=irisLUT.data.byteLength;qa.opticsModel=irisLUT.method;
function setShadow(tex,data,size){''')
rep('engine.js','worker.postMessage({id:job,kind,seed,count:', 'worker.postMessage({id:job,kind,case:weather,seed,count:')
rep('engine.js',"function fitView(){if(weather==='rainbow')", "function fitView(){if(weather==='iridescent'||weather==='irisEdge'){const s=solar(target.hour);yaw=Math.atan2(-s[0],-s[2]);pitch=clamp(-Math.asin(s[1]),-.28,.1);distance=weather==='iridescent'?12:8.5;}else if(weather==='rainbow')")
rep('engine.js',"Object.assign(target,presets[bw]);", "Object.assign(target,{iriStrength:0},presets[bw]);$('iridescence').checked=target.iriStrength>0;")
rep('engine.js',"$('lightningEnabled').checked=weather==='storm';", "$('lightningEnabled').checked=weather==='storm'||weather==='nightstorm';")
rep('engine.js',"function setWeather(id){$('lightningEnabled').checked=id==='storm';", "function setWeather(id){$('lightningEnabled').checked=id==='storm'||id==='nightstorm';")
rep('engine.js','Object.assign(target,presets[id]);', "Object.assign(target,{iriStrength:0},presets[id]);$('iridescence').checked=target.iriStrength>0;channelKey='';")
rep('engine.js',"$('fastEmpty').onchange=invalidate;", "$('skipEmpty').onchange=invalidate;$('iridescence').onchange=()=>{if($('iridescence').checked&&target.iriStrength===0)target.iriStrength=1;outputs();invalidate();};$('aimIris').onclick=()=>{const s=solar(state.hour);yaw=Math.atan2(-s[0],-s[2]);pitch=clamp(-Math.asin(s[1]),-.28,.1);distance=kind==='Cu'?8.5:12;invalidate();};$('dischargeMode').onchange=()=>{channelKey='';invalidate();};$('fastEmpty').onchange=invalidate;")
rep('engine.js',"$('lightningOnce').onclick=()=>{forcedFlash=time;", "$('lightningOnce').onclick=()=>{manualDischarge++;channelKey='';forcedFlash=time;")
rep('engine.js','occupancySize=d.occupancy.size;occupancyReady=true;', '''occupancySize=d.occupancy.size;occupancyReady=true;if(d.occupancy.distance){set3D(distanceTex,d.occupancy.distance,d.occupancy.size);gl.bindTexture(gl.TEXTURE_3D,distanceTex);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);distanceReady=true;qa.distanceFieldBytes=d.occupancy.distance.byteLength;}''')
rep('engine.js',"lightningEvent=Motion.lightning(time,seed,state.lightningRate,state.lightningPower,$('lightningEnabled').checked,forcedFlash);", "lightningEvent=Optics.lightning(time,seed,state.lightningRate,state.lightningPower,$('lightningEnabled').checked,forcedFlash,$('dischargeMode').value,manualDischarge);if(lightningEvent.key!==channelKey&&lightningEvent.kind!=='none'){channelKey=lightningEvent.key;channelData=Optics.channel(seed,lightningEvent.eventId,lightningEvent.origin,lightningEvent.kind);numeric2D(boltTex,320,1,channelData.data,false);}")
rep('engine.js','[8,occupancyTex]])','[8,occupancyTex],[9,distanceTex]])')
section('engine.js','const bolts=Motion.boltSegments','const activeGroups=', '''i(prog,'uDistance',9);f(prog,'uSkipEmpty',$('skipEmpty').checked&&distanceReady?1:0);bind2(10,irisTex);i(prog,'uIrisLUT',10);bind2(11,boltTex);i(prog,'uBoltData',11);v4(prog,'uIris',[$('iridescence').checked?state.iriStrength:0,state.dropletRadius,state.dropletSpread,seed%10000]);i(prog,'uBoltCount',channelData?channelData.count:0);if(channelData)gl.uniform4fv(loc(prog,'uFlashNodes[0]'),channelData.nodeData);''')
rep('engine.js','qa.flash={strength:lightningEvent.strength,eventId:lightningEvent.eventId};', "qa.flash={strength:lightningEvent.strength,eventId:lightningEvent.eventId,kind:lightningEvent.kind,segments:channelData?channelData.count:0};qa.iridescence={enabled:$('iridescence').checked,strength:state.iriStrength,radiusMicrometres:state.dropletRadius,spread:state.dropletSpread,model:'nine-band diffraction appearance approximation'};qa.skipEmpty=$('skipEmpty').checked&&distanceReady&&!$('mountains').checked&&!$('aircraft').checked;qa.weatherCase=weather;qa.weatherCaseCount=Object.keys(presets).length;")
rep('engine.js',"'\\n保守空区 '+($('fastEmpty').checked?'开启':'关闭');", "'\\n保守空区 '+($('fastEmpty').checked?'开启':'关闭')+' · 距离跳步 '+(qa.skipEmpty?'开启':'安全回退');")
rep('engine.js','triggerLightning:()=>{forcedFlash=time;', "triggerLightning:()=>{manualDischarge++;channelKey='';forcedFlash=time;")
rep('motion.js','this.disjointSamples=0;this.beginCpu=0;', 'this.disjointSamples=0;this.beginCpu=0;this.epoch=0;')
rep('motion.js','this.queue.push(this.active);','this.queue.push({query:this.active,epoch:this.epoch});')
rep('motion.js','reset(){this.lastComplete=null;', 'reset(){this.epoch++;this.lastComplete=null;')
rep('motion.js','for(const q of this.queue)g.deleteQuery(q);','for(const q of this.queue)g.deleteQuery(q.query);')
rep('motion.js','g.getQueryParameter(this.queue[0],g.QUERY_RESULT_AVAILABLE)', 'g.getQueryParameter(this.queue[0].query,g.QUERY_RESULT_AVAILABLE)')
rep('motion.js','const q=this.queue.shift(),ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);if(Number.isFinite(ms)', 'const item=this.queue.shift(),q=item.query,ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);if(item.epoch===this.epoch&&Number.isFinite(ms)')
rep('cloud.glsl','uniform vec4 uBoltA[15],uBoltB[15];uniform int uBoltCount;', 'uniform sampler3D uDistance;uniform float uSkipEmpty;uniform sampler2D uIrisLUT,uBoltData;uniform vec4 uIris,uFlashNodes[4];uniform int uBoltCount;')
rep('cloud.glsl','float densityAt(','''// Conservative occupied-cell distance divided by a global bound on flowPos.
float emptyTravel(vec3 p){if(uSkipEmpty<.5||uBlend<.999||uEffects.x>.5||uEffects.y>.5)return 0.;vec3 q=flowPos(p),uv=(q-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return 0.;ivec3 cell=ivec3(clamp(floor(uv*uOccupancySize),vec3(0),uOccupancySize-1.));float d=floor(texelFetch(uDistance,cell,0).r*255.+.5);if(d<2.)return 0.;vec3 spacing=(uMax-uMin)/uOccupancySize;float lower=max(0.,d-1.)*min(spacing.x,min(spacing.y,spacing.z));float turb=uFlow.w*min(uFlow.x/30.,2.)*.16,amp=uLoop.z*(.34+turb*.65),L=(1.+1.8*abs(uShear)/max(uCloudTop-uCloudBase,.5))*(uLoop.x>.5?1.+4.*amp:1.+2.*turb);return max(0.,lower-.0002)/max(L*1.02,1.);}
float densityAt(''')
rep('cloud.glsl','vec3 incident(','''vec3 irisTint(vec3 p,vec3 rd,float tau,float d){if(uIris.x<=0.||uSun.y<=0.)return vec3(1);float angle=acos(clamp(dot(rd,uSun),-1.,1.)),gate=(1.-smoothstep(radians(24.),radians(39.),angle))*smoothstep(radians(.4),radians(1.7),angle);if(gate<=0.)return vec3(1);
vec3 q=flowPos(p);float r=clamp(uIris.y*(1.+.38*(nv(q*.66+uIris.w*.003)-.5)),1.,16.);vec3 rgb=texture(uIrisLUT,vec2(angle/radians(40.),(r-1.)/15.)).rgb;float uniformity=1.-uIris.z*.94,thin=exp(-tau*.60)*(1.-smoothstep(.60,1.4,d));float strength=clamp(uIris.x*gate*thin*uniformity,0.,.94);return mix(vec3(1),rgb,strength);}
vec3 incident(''')
rep('cloud.glsl','vec3 L=ambient+powder*(sunlight*(direct*(.36+.58*ph)', 'vec3 tint=irisTint(p,rd,tau,d);vec3 L=ambient+powder*(sunlight*(tint*direct*(.36+.58*ph)')
section('cloud.glsl','vec3 flashDelta=p-uWind-uLightning.xyz;','return L;}', 'if(uLightning.w>.001){for(int k=0;k<4;k++){vec3 delta=p-uWind-uFlashNodes[k].xyz;float falloff=exp(-length(delta)*.85)/(1.+dot(delta,delta)*.35);L+=vec3(1.25,1.40,1.65)*uLightning.w*falloff*uFlashNodes[k].w;}}')
section('cloud.glsl','vec4 boltRadiance(', 'void main(){', '''vec4 boltRadiance(vec3 ro,vec3 rd,float opaque){float best=0.,distance=1e4;if(uLightning.w<.002)return vec4(0,0,0,1e4);vec2 region=bounds(ro,rd,uLightning.xyz+uWind-vec3(4.8,6.2,4.),uLightning.xyz+uWind+vec3(4.8,2.,4.));if(region.x>=region.y||region.y<0.)return vec4(0,0,0,1e4);
for(int k=0;k<160;k++){if(k>=uBoltCount)break;vec4 A=texelFetch(uBoltData,ivec2(k*2,0),0),B=texelFetch(uBoltData,ivec2(k*2+1,0),0);vec3 a=A.xyz+uWind,b=B.xyz+uWind,v=b-a,o=ro-a;float vv=dot(v,v),rv=dot(rd,v),s=clamp((dot(o,v)-rv*dot(o,rd))/max(vv-rv*rv,1e-7),0.,1.);vec3 p=a+s*v;float t=dot(p-ro,rd);if(t<=0.||t>=opaque)continue;float d=length(ro+rd*t-p),pixel=t*.96/uRes.y,w=max(.0001,pixel*.46),core=exp(-d*d/(w*w)),bloom=exp(-d*d/(w*w*12.))*.012,value=(core+bloom)*A.w; if(value>best){best=value;distance=t;}}
return vec4(vec3(5.0,5.35,5.9)*best*uLightning.w,distance);}

''')
rep('cloud.glsl','int span=0;float edge=merged[0].x;', 'int span=0;float cursor=0.,edge=merged[0].x;')
rep('cloud.glsl','if(span>=nc||tr<.004)break;float len=', 'if(span>=nc||tr<.004)break;edge=merged[span].x+cursor*ds;float len=')
rep('cloud.glsl','if(len<=1e-6){span++;if(span<nc)edge=merged[span].x;continue;}', 'if(len<=1e-6){span++;cursor=0.;if(span<nc)edge=merged[span].x;continue;}')
rep('cloud.glsl','vec3 p=ro+rd*t;sampleFootprint=', 'vec3 p=ro+rd*t;float safe=emptyTravel(p),jump=min(floor(safe/max(ds,1e-5)),floor((merged[span].y-edge)/max(ds,1e-5)));if(jump>=2.){cursor+=jump;continue;}sampleFootprint=')
rep('cloud.glsl','edge+=len;if(edge>=merged[span].y-1e-5){span++;if(span<nc)edge=merged[span].x;}', 'cursor+=1.;edge+=len;if(edge>=merged[span].y-1e-5){span++;cursor=0.;if(span<nc)edge=merged[span].x;}')
for n,text in S.items():(R/n).write_text(text)
files={}
for n in [*LOCK,'optics.js']:
 b=(R/n).read_bytes();files[n]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(R/'MANIFEST.json').write_text(json.dumps({'productionLine':'Weather Mother','version':'0.6.3-optics','baselineRuntime':'bf2aaa5d853af4f114c68d5bbafb99ea47134ef5','baselineSHA256':LOCK,'files':files,'totalRuntimeBytes':sum(f['bytes'] for f in files.values()),'storedImageAssets':0,'status':'BUILT_UNVERIFIED','manualVisualAcceptance':False,'aaaQualityApproved':False,'productionReady':False},ensure_ascii=False,indent=2)+'\n')
print('V063 built',sum(f['bytes'] for f in files.values()),'bytes')
