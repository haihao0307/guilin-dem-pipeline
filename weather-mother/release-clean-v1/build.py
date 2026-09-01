"""Build one standalone Weather Mother distribution from the locked V062 runtime.
No baseline files are modified. The output folder must be empty.
"""
from pathlib import Path
import hashlib,json,re,sys
BASE=Path(sys.argv[1]); OUT=Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
assert not any(OUT.iterdir()), 'Output directory must be empty'
VERSION='1.0.0-clean'
LOCK={
 'index.html':'16025fcb733fff7f362d1b75a475796b5ba7190ee60eb611030d03378e4606ff',
 'engine.js':'268aa2945427848091bce465df3101419161da48ee9a50b0448011cf1db96a35',
 'field-worker.js':'8c4402977790dc2e9c6116f6f4ac8d75b88bda967183f2df077970663a44aa4e',
 'cloud.glsl':'d0d28a6321d26cf83e2380dac032aee1741bdd87a58cda4883110dab642b0626',
 'motion.js':'29c24326ac67ab6823bc411d26fd7f19ba45ea4f933be8ab305f1bd456fceb1d'}
src={}
for n,h in LOCK.items():
 b=(BASE/n).read_bytes();assert hashlib.sha256(b).hexdigest()==h,n+' source hash mismatch';src[n]=b.decode()
for n in ['cloud.glsl','field-worker.js','motion.js']:(OUT/n).write_text(src[n],encoding='utf-8')
engine=src['engine.js'].replace('0.6.2-hq',VERSION).replace('062loop-r1','clean-1.0.0')
snap="if(window.__WEATHER_QA_SNAP__){Object.assign(state,target);blend=1;window.__WEATHER_QA_SNAP__=false;invalidate();}"
assert engine.count(snap)==1;engine=engine.replace(snap,'')
test="setTestTime:(v)=>{time=v;invalidate();},"
assert engine.count(test)==1;engine=engine.replace(test,'')
restore=r'''
const configurationSwitches=['windLink','follow','temporal','mountains','aircraft','rainbow','cycle','loopEnabled','fastEmpty','lightningEnabled'];
function getConfiguration(){return{format:'weather-mother-configuration',schemaVersion:1,packageVersion:'1.0.0-clean',weather,kind,seed,controls:Object.fromEntries(keys.map(k=>[k,target[k]])),snow:target.snow,quality:$('quality').value,switches:Object.fromEntries(configurationSwitches.map(k=>[k,$(k).checked])),camera:{yaw,pitch,distance},playback:{playing,loopPlaying,time,evolutionTime,loopPhase,windOffset:[...windOffset]}};}
function applyConfiguration(x){
 const object=(v,n)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error(n+' must be an object');};
 const number=(v,lo,hi,n)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error('Invalid '+n);return v;};
 const bool=(v,n)=>{if(typeof v!=='boolean')throw Error('Invalid '+n);return v;};
 object(x,'configuration');if(x.format!=='weather-mother-configuration'||x.schemaVersion!==1)throw Error('Unsupported configuration format');
 if(!Object.prototype.hasOwnProperty.call(presets,x.weather))throw Error('Unknown weather case');
 if(!Array.from($('kind').options).some(o=>o.value===x.kind))throw Error('Unknown cloud genus');
 number(x.seed,0,4294967295,'seed');if(!Number.isInteger(x.seed))throw Error('Seed must be uint32');
 object(x.controls,'controls');const values={};for(const k of keys)values[k]=number(x.controls[k],+$(k).min,+$(k).max,k);
 number(x.snow,0,1,'snow');if(!Array.from($('quality').options).some(o=>o.value===x.quality))throw Error('Unknown quality');
 object(x.switches,'switches');for(const k of configurationSwitches)bool(x.switches[k],k);
 object(x.camera,'camera');number(x.camera.yaw,-1e6,1e6,'yaw');number(x.camera.pitch,-.28,1.25,'pitch');number(x.camera.distance,2.5,50,'distance');
 object(x.playback,'playback');const p=x.playback;bool(p.playing,'playing');bool(p.loopPlaying,'loopPlaying');number(p.time,0,1e12,'time');number(p.evolutionTime,0,1e12,'evolutionTime');number(p.loopPhase,0,1,'loopPhase');
 if(!Array.isArray(p.windOffset)||p.windOffset.length!==3)throw Error('Invalid windOffset');p.windOffset.forEach((v,k)=>number(v,-1e9,1e9,'windOffset'+k));
 clearTimeout(debounce);weather=x.weather;kind=x.kind;seed=x.seed;
 Object.assign(target,values,{snow:x.snow});Object.assign(state,target);
 for(const k of configurationSwitches)$(k).checked=x.switches[k];
 $('quality').value=x.quality;$('weather').value=weather;$('kind').value=kind;$('description').textContent=descriptions[weather];
 yaw=x.camera.yaw;pitch=x.camera.pitch;distance=x.camera.distance;
 playing=p.playing;loopPlaying=p.loopPlaying;cycling=x.switches.cycle;time=p.time;evolutionTime=p.evolutionTime;windOffset=[...p.windOffset];previousWind=[...windOffset];setPhase(p.loopPhase);
 $('pause').textContent=playing?'暂停演化':'继续演化';$('loopPause').textContent=loopPlaying?'冻结形态':'继续循环';
 forcedFlash=-1e9;previousFlash=0;pending=null;pendingLight=null;volumeReady=false;qa.ready=false;blend=1;last=performance.now();profiler.reset();outputs();rebuild();invalidate();return true;
}
function getEnvironment(){
 const a=(state.hour-12)/12*Math.PI,l=Math.PI/6,sun=normal([-Math.sin(a),Math.cos(l)*Math.cos(a),Math.sin(l)*Math.cos(a)]),mass=1/(Math.max(sun[1],0)+.07),bearing=state.direction*Math.PI/180,dir=[-Math.sin(bearing),0,Math.cos(bearing)],gust=1+state.gust*(.65*Math.sin(time*.39)+.35*Math.sin(time*.13+1.3)),speed=$('windLink').checked?state.wind:state.cloudSpeed;
 return{format:'weather-mother-environment',schemaVersion:1,units:{length:'metre',velocity:'metre/second',time:'simulation second'},axes:{east:'+X',up:'+Y',north:'-Z'},simulationSeconds:time,hour:state.hour,paused:!playing,timeScale:state.timeScale,wind:{fromDegrees:state.direction,direction:dir,forceMps:state.wind,gustMultiplier:gust,velocityMps:dir.map(v=>v*state.wind*gust)},cloud:{kind,seed,driftMps:speed,velocityMps:dir.map(v=>v*speed*gust),offsetMetres:windOffset.map(v=>v*1000),loopPhase},sun:{direction:sun,linearColor:[1.30*Math.exp(-(.012+.018*state.haze)*mass),1.27*Math.exp(-(.056+.021*state.haze)*mass),1.22*Math.exp(-(.145+.025*state.haze)*mass)],intensity:state.sunlight,skylight:state.skylight,exposure:state.exposure},weather:{case:weather,rain:state.rain,fog:state.fog,snow:state.snow,humidityPercent:state.humidity},limitations:['illustrative solar clock; no geographic ephemeris','graphical weather presets; not observed conditions','no ocean wave, foam, reflection or shared-depth integration supplied']};
}
'''
anchor='window.WeatherMother={qa,setWeather,setKind,'
assert engine.count(anchor)==1
engine=engine.replace(anchor,restore+'\nwindow.WeatherMother={qa,packageVersion:"1.0.0-clean",getConfiguration,applyConfiguration,getEnvironment,setWeather,setKind,')
(OUT/'engine.js').write_text(engine,encoding='utf-8')
html=src['index.html'].replace('0.6.2-loop',VERSION).replace('062loop-r1','clean-1.0.0').replace('V0.6.2 LOOP · HIGH QUALITY WEATHER STUDIO','CLEAN V1.0 · V062 VERIFIED KERNEL').replace('V062 循环候选 · 保留 V061 基线','干净交付版 · 图形近似仍待最终验收')
html=html.replace('<summary>雷电事件</summary>','<summary>雷电事件 · 图形草案</summary>')
html=html.replace('分支电光与云内照亮共用同一事件。台风眼、眼墙和雨带的规则已整理，台风流体仿真尚未实现。','保留原版闪电演示，视觉尚未通过。七彩云、台风和新版闪电实验均未并入本交付版。')
html=html.replace('<details open><summary>风与运动</summary>','<details><summary>风与运动</summary>').replace('<details open><summary>大气与光照</summary>','<details><summary>大气与光照</summary>')
export_ui='''<details id="reuseSection"><summary>参数保存与生产线复用</summary><div class="buttons"><button id="saveConfig">保存天气参数</button><button id="loadConfig">载入天气参数</button></div><input id="configFile" type="file" accept="application/json,.json" hidden><p class="hint" id="configStatus">只保存种子、参数、相机与时钟，不保存图像。海洋接入说明随完整包提供。</p></details>'''
html=html.replace('<div class="buttons"><button id="pause">',export_ui+'<div class="buttons"><button id="pause">')
html=html.replace('</body></html>','<script src="reuse.js?v=clean-1.0.0"></script></body></html>')
html=html.replace('Weather Mother · V0.6.2 LOOP','Weather Mother · Clean V1.0')
(OUT/'index.html').write_text(html,encoding='utf-8')
reuse=r'''/* Configuration-only UI. No external services, image exports or scene assets. */
(()=>{'use strict';const $=id=>document.getElementById(id),status=$('configStatus');function api(){const a=window.WeatherMother;if(!a?.getConfiguration||!a.qa.ready)throw Error('云场仍在初始化，请稍后操作');return a;}
$('saveConfig').onclick=()=>{try{const value=api().getConfiguration(),blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='weather-mother-'+value.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);status.textContent='已保存天气参数，未保存任何图像。';}catch(e){status.textContent=e.message;}};
$('loadConfig').onclick=()=>$('configFile').click();$('configFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>131072)throw Error('参数文件超过 128 KB，已拒绝。');const value=JSON.parse(await file.text());api().applyConfiguration(value);status.textContent='参数已通过校验，正在重新生成同种子云场。';}catch(e){status.textContent='载入未完成：'+e.message;}finally{e.target.value='';}};
})();
'''
(OUT/'reuse.js').write_text(reuse,encoding='utf-8')
readme='''# Weather Mother Clean V1.0

这是唯一的一套可运行干净交付目录，基于已公开验证的 V0.6.2 循环内核。此次整理不调整云体形态、密度生成、体积光照或画质采样数。

## 在线验收

https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v1/

## 使用

将本目录原样复制到任意静态 HTTP/HTTPS 站点，打开 index.html 即可。无需 npm、构建器、API 密钥或第三方 CDN。所有运行文件均采用相对路径。

浏览器需要 WebGL2。HTML 通过 fetch 读取着色器、通过 Worker 生成数据，不能用 file:// 双击模式代替 HTTP 服务。开发人员可用 `python -m http.server 8080` 检查本目录。

## 保留功能

十种云属、八个天气案例、连续形态循环、种子、浓度、独立风力与云速、阵风与湍流、风切变、晨昏与月夜、阳光、天空光、内部散射、银边、地面反照、画质档位、时间重建、雨雪、雾、彩虹、暂停与视角操作。原版闪电、山体和飞机尾流示意保留并注明未最终验收。

增加的交付接口只有配置导出、配置校验载入，以及向其他生产线读取统一时间、日照和风的数据接口。它们没有改变渲染公式。操作位于“参数保存与生产线复用”。

## 本包不包含

旧 Cloud Mother 页面、失败或未发布的 V063 七彩云/闪电实验、构建脚本、历史 QA 日志、截图、HDR 图、照片、噪声图片、模型、依赖目录、缓存、密度二进制和其他地图生产线数据。必要的 manifest、简短运行检查结果、交接与接入说明保留。

## 交接

下一条海洋生产线先读 OCEAN_HANDOFF.md 和 HANDOFF.json。先同步日照、时钟和风，再单独制作海面；本包没有海面波浪、泡沫、折射、反射或海底系统。

本版是干净可复用的图形工作台，不能被标注为最终 3A 视觉认证、真实气象模拟或全流体求解器。保留原显示分辨率和画质档，不以减功能或减采样达成“清理”。
'''
(OUT/'README.md').write_text(readme,encoding='utf-8')
ocean='''# 给海洋生产线的 Weather Mother 接入交接

## 唯一输入

整包 Weather_Mother_Clean_V1.0.0。版本 1.0.0-clean，渲染基线 V0.6.2-loop。只用这一套入口和同目录运行文件，不从旧版本或未发布实验目录寻找替换资产。

## 已存在的接口

页面完成初始化后，`window.WeatherMother.qa.ready` 为 true。

```js
const wm = window.WeatherMother;
const recipe = wm.getConfiguration();
wm.applyConfiguration(recipe);
const env = wm.getEnvironment();
wm.set('wind', 20);
wm.set('cloudSpeed', 12);
wm.set('direction', 270);
wm.set('hour', 17.5);
wm.setSeed(4217);
wm.setLoopPhase(0.25);
wm.pause();
wm.play();
```

`getConfiguration()` 包含天气案例、云属、种子、所有数值控制、开关、画质、相机、演化时钟、循环相位和漂移位置。载入会重新生成密度数据；等待 qa.ready 与云体切换结束后检查。配置记录不包含上一代云体和时间重建历史，载入过程中短暂重新生成属于正常行为，不承诺任意中间帧的逐像素回放。手动闪电瞬态不保存。

`getEnvironment()` 输出共享数据，长度统一为米、速度为米/秒。内部体积坐标仍采用千米，因此读取 GPU 场或相机数据时另外乘以 1000。方向约定为 +X 东、+Y 上、-Z 北。270° 西风吹向 +X，0° 北风吹向 +Z。

wind.velocityMps 表示含阵风的演示风向量；cloud.velocityMps 表示独立的云漂移向量。两者不能混用。海浪应首先参考 wind，只有选中“云速跟随风速”时云速才联动。

sun.direction、sun.linearColor、sun.intensity 与工作台当前光照使用同一组公式。它们用于同步海面日照方向和光色，未包括天空立方体反射贴图或真实地理太阳历。hour 为示意日周期；没有经纬度、日期或实况气象。

## 场景接入边界

当前 engine.js 自己持有全屏 WebGL2 画布和 DOM 控件。它可以直接作为独立工作台运行，也可以置于同源 iframe；父页面在加载完成后通过 iframe.contentWindow.WeatherMother 读取数据。

它尚未封装为可直接插入 Three.js 场景图的组件。完整海洋场景需要再实现共享相机、场景深度遮挡、云和海面合成、天空反射采样以及资源生命周期。不要把两个独立画布简单叠加后声称已完成水天一体。

## 冻结边界

云的密度生成、噪声和光照内核来自此次已验证基线；不要顺便退回旧蘑菇云或低采样沙点方案。雨雪为屏幕图形效果，山体抬升、尾流和彩虹属于解析外观近似。闪电视觉仍待修正，默认普通晴日不启用。七彩云、台风和新版闪电暂缓，不随本包交付。

当前仅完成天气侧的可复用参数合同。海浪谱、涌浪、破碎浪、泡沫、潮汐、海水光学与海底需在海洋生产线独立制作。
'''
(OUT/'OCEAN_HANDOFF.md').write_text(ocean,encoding='utf-8')
handoff={'productionLine':'Weather Mother','packageVersion':VERSION,'renderBaseline':'0.6.2-loop','sourceCommit':'bf2aaa5d853af4f114c68d5bbafb99ea47134ef5','repositoryReadRef':'329670eea20d008189d0dce68d16899e667d8baf','entry':'index.html','onlineEntry':'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v1/','delivery':'online preview plus explicitly requested reusable ZIP','runtimeFiles':list(LOCK)+['reuse.js'],'pendingResearchExcluded':['V063 iridescence','new lightning','tropical cyclone'],'storedImages':0,'renderFormulaChanged':False,'samplingReduced':False,'cloudGenera':['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs'],'weatherCases':['fair','coast','mountain','rain','storm','rainbow','snow','high'],'downstream':'ocean production line','api':['getConfiguration','applyConfiguration','getEnvironment'],'claims':{'archiveReady':False,'userVisualAcceptanceOfCleanup':False,'aaaQualityApproved':False,'productionReady':False,'fullFluidSolver':False,'oceanImplemented':False},'cleanupScope':'Single distribution contains no old versions, build scripts or experimental programs. Repository history and unrelated production lines are preserved.'}
(OUT/'HANDOFF.json').write_text(json.dumps(handoff,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
files={}
for p in sorted(OUT.iterdir()):
 b=p.read_bytes();files[p.name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
manifest={'packageVersion':VERSION,'baselineSHA256':LOCK,'files':files,'runtimeBytes':sum(files[n]['bytes'] for n in list(LOCK)+['reuse.js']),'kernelIdentity':{n:files[n]['sha256']==LOCK[n] for n in ['cloud.glsl','field-worker.js','motion.js']},'noExternalRuntimeDependencies':True,'storedImageFiles':0,'status':'BUILT_PENDING_QA'}
(OUT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'output':str(OUT),'files':len(list(OUT.iterdir())),'runtimeBytes':manifest['runtimeBytes'],'kernelIdentity':manifest['kernelIdentity']},ensure_ascii=False))
