"""Build Weather Mother 1.1 full candidate in isolation.

The accepted V062 runtime and Clean V1 stay untouched. The unverified V063 source is
reproduced in a temporary tree, then repaired and extended under a new output path.
"""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,tempfile
SRC=Path(__file__).resolve().parent
REPO=Path.cwd()
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else REPO/'_weather_v110_stage'
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir(parents=True)
with tempfile.TemporaryDirectory() as td:
    t=Path(td)/'weather-mother';t.mkdir()
    shutil.copytree(REPO/'weather-mother/v062-loop',t/'v062-loop')
    shutil.copytree(REPO/'weather-mother/v063-optics',t/'v063-optics')
    subprocess.check_call([sys.executable,str(t/'v063-optics/build.py')])
    base=t/'v063-optics'
    for n in ['index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']:
        shutil.copyfile(base/n,OUT/n)

def patch(path,old,new,count=1):
    p=OUT/path;s=p.read_text()
    actual=s.count(old)
    assert actual==count,(path,'anchor count',actual,old[:120])
    p.write_text(s.replace(old,new,count))

def append_before(path,anchor,text):patch(path,anchor,text+anchor)

for n in ['index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']:
    p=OUT/n;p.write_text(p.read_text().replace('0.6.3','1.1.0').replace('063optics-r1','110world-r1'))

patch('index.html','<option value="nightstorm">夜间雷暴</option>',
'''<option value="nightstorm">夜间雷暴</option><option value="warmfront">暖锋云幕</option><option value="coldfront">冷锋过境</option><option value="squall">飑线雷暴</option><option value="typhoon">台风云系 · 组织预览</option>''')
patch('index.html','<details><summary>大气与光照</summary>',
'''<details><summary>大气与光照</summary><div class="row"><label for="lightScene">光影场景</label><select id="lightScene"><option value="natural">自然天气</option><option value="daylight">日光体积</option><option value="dawn">清晨暖光</option><option value="sunset">黄昏透光</option><option value="silver">逆光银边</option><option value="moon">冷色月光</option></select></div>''')
append_before('index.html','<details open id="irisSection">',
'''<details id="cycloneSection"><summary>台风与旋转风暴</summary>
<div class="row"><label for="cycloneSpin">旋转强度</label><input id="cycloneSpin" type="range" min="0" max="2.5" step=".02" value="1"><output></output></div>
<div class="row"><label for="eyeRadius">风眼半径</label><input id="eyeRadius" type="range" min="1.2" max="3.8" step=".05" value="2.2"><output></output></div>
<div class="row"><label for="rainbandCurl">雨带弯曲</label><input id="rainbandCurl" type="range" min=".4" max="2" step=".02" value="1"><output></output></div>
<div class="row"><label for="stormRadius">云系半径</label><input id="stormRadius" type="range" min="7" max="11" step=".1" value="10"><output></output></div>
<p class="hint">风眼、眼墙和螺旋雨带由同一旋转场组织。当前是可操作的体积外观模型，没有气压、海温、科氏力或数值天气求解。</p></details>''')
patch('index.html','<p class="hint">程序化天气案例。山地与尾流采用解析近似，雨雪采用屏幕空间效果，尚未接入实况天气或完整流体求解。</p>',
'''<p class="hint">程序化天气案例。山地、飞机、台风和降水仍有明确的近似边界，尚未接入实况天气或完整流体求解。</p><p class="hint"><a href="../method-v100/lighting/?lighting=silver&quality=fine" target="_blank" rel="noopener">打开独立云体光影检查页 ↗</a></p>''')
if 'CLOUD MOTHER' in (OUT/'index.html').read_text():patch('index.html','CLOUD MOTHER','WEATHER MOTHER')
if 'V063 虹彩候选' in (OUT/'index.html').read_text():patch('index.html','V063 虹彩候选','V1.1 全天气候选')

patch('engine.js',"'dropletSpread'];","'dropletSpread','cycloneSpin','eyeRadius','rainbandCurl','stormRadius'];")
patch('engine.js','iriStrength:0,dropletRadius:6,dropletSpread:.12},target=',
'''iriStrength:0,dropletRadius:6,dropletSpread:.12,cycloneSpin:1,eyeRadius:2.2,rainbandCurl:1,stormRadius:10},target=''')
patch('engine.js',"nightstorm:{kind:'Cb',density:1.00,count:4,hour:21.3,rain:.68,fog:.10,humidity:94,instability:.95,snow:0}});",
'''nightstorm:{kind:'Cb',density:1.00,count:4,hour:21.3,rain:.68,fog:.10,humidity:94,instability:.95,snow:0},
warmfront:{kind:'As',density:.76,count:6,hour:10.5,rain:.22,fog:.14,humidity:90,instability:.18,snow:0,wind:11,cloudSpeed:14,shear:.36},
coldfront:{kind:'Cb',density:.94,count:5,hour:14.2,rain:.48,fog:.10,humidity:86,instability:.80,snow:0,wind:20,cloudSpeed:24,shear:.82},
squall:{kind:'Cb',density:1.04,count:6,hour:15.6,rain:.82,fog:.10,humidity:93,instability:.98,snow:0,wind:27,cloudSpeed:30,shear:.92,lightningRate:10},
typhoon:{kind:'Cb',density:1.04,count:7,hour:13.8,rain:.88,fog:.18,humidity:98,instability:.88,snow:0,wind:32,cloudSpeed:4,direction:115,shear:.96,cycloneSpin:1.25,eyeRadius:2.2,rainbandCurl:1.15,stormRadius:10.2,lightningRate:5}});''')
patch('engine.js',"nightstorm:'夜间深对流，云内放电与云地短促复击共用事件时钟。'});",
'''nightstorm:'夜间深对流，云内放电与云地短促复击共用事件时钟。',warmfront:'大范围暖湿空气抬升形成中高层云幕和持续过渡。',coldfront:'冷锋抬升触发快速发展、风切变和阵性降水。',squall:'线性组织的强对流云塔、降水核心与较高放电频率。',typhoon:'风眼、眼墙、螺旋雨带和高层云盾由同一旋转组织场生成。'});''')
patch('engine.js','instability:target.instability,dims,min,max,sun:',
'''instability:target.instability,cycloneSpin:target.cycloneSpin,eyeRadius:target.eyeRadius,rainbandCurl:target.rainbandCurl,stormRadius:target.stormRadius,dims,min,max,sun:''')
patch('engine.js',"if(k==='count'||k==='instability'){", "if(['count','instability','cycloneSpin','eyeRadius','rainbandCurl','stormRadius'].includes(k)){")
patch('engine.js',"function fitView(){if(weather==='iridescent'||weather==='irisEdge')", "function fitView(){if(weather==='typhoon'){yaw=.22;pitch=.86;distance=27.;}else if(weather==='squall'){yaw=.10;pitch=.12;distance=25.;}else if(weather==='iridescent'||weather==='irisEdge')")
patch('engine.js',"$('lightningEnabled').checked=id==='storm'||id==='nightstorm';", "$('lightningEnabled').checked=['storm','nightstorm','squall','typhoon'].includes(id);")
patch('engine.js',"$('lightningEnabled').checked=weather==='storm'||weather==='nightstorm';", "$('lightningEnabled').checked=['storm','nightstorm','squall','typhoon'].includes(weather);")
patch('engine.js',"$('iridescence').checked=target.iriStrength>0;channelKey='';", "$('iridescence').checked=target.iriStrength>0;$('cycloneSection').open=id==='typhoon';channelKey='';")
patch('engine.js',"v4(prog,'uIris',[$('iridescence').checked?state.iriStrength:0,state.dropletRadius,state.dropletSpread,seed%10000]);",
'''v4(prog,'uIris',[$('iridescence').checked?state.iriStrength:0,state.dropletRadius,state.dropletSpread,seed%10000]);f(prog,'uSolarDay',Math.max(0,Math.cos((state.hour-12)/12*Math.PI)));v4(prog,'uCyclone',[weather==='typhoon'?1:0,state.cycloneSpin,state.eyeRadius,state.rainbandCurl]);''')
patch('engine.js',"$('lightningEnabled').onchange=invalidate;",'''const lightScenes={natural:{exposure:1,sunlight:1,skylight:1,scatter:1,silver:1,groundLight:1,haze:.16},daylight:{hour:14.5,exposure:1,sunlight:1.18,skylight:.82,scatter:1.12,silver:1.18,groundLight:.82,haze:.12},dawn:{hour:6.6,exposure:1.05,sunlight:1.08,skylight:.72,scatter:1.18,silver:1.12,groundLight:.62,haze:.28},sunset:{hour:17.5,exposure:1.03,sunlight:1.22,skylight:.58,scatter:1.24,silver:1.38,groundLight:.55,haze:.34},silver:{hour:17.1,exposure:.94,sunlight:1.35,skylight:.38,scatter:1.02,silver:2.35,groundLight:.35,haze:.18},moon:{hour:22,exposure:1.12,sunlight:.72,skylight:.42,scatter:.72,silver:.72,groundLight:.18,haze:.12}};
$('lightScene').onchange=e=>{Object.assign(target,lightScenes[e.target.value]);outputs();invalidate();};
$('lightningEnabled').onchange=invalidate;''')
patch('engine.js','qa.weatherCase=weather;qa.weatherCaseCount=Object.keys(presets).length;',
'''qa.weatherCase=weather;qa.weatherCaseCount=Object.keys(presets).length;qa.cyclone={active:weather==='typhoon',spin:state.cycloneSpin,eyeRadiusKm:state.eyeRadius,rainbandCurl:state.rainbandCurl,stormRadiusKm:state.stormRadius,model:'procedural organized volume; no NWP or fluid solver'};qa.primaryWorkbenchModes=['weather','cloud genus','wind','time','optics','events'];''')

patch('field-worker.js',"if(c.case==='iridescent'){",r'''if(c.case==='typhoon'){
const eye=Math.max(1.2,Math.min(3.8,c.eyeRadius||2.2)),outer=Math.max(7,Math.min(11,c.stormRadius||10)),curl=Math.max(.4,Math.min(2,c.rainbandCurl||1));
const wallStart=lobes.length,wallN=22;for(let j=0;j<wallN;j++){let a=6.2831853*j/wallN+(random()-.5)*.08,r=eye+1.05+random()*.52,x=Math.cos(a)*r,z=Math.sin(a)*r;for(let h=0;h<6;h++){let y=1.25+h*.92+random()*.18,rad=.52+.18*(1-h/6)+random()*.14;lobe(x+(random()-.5)*.22,y,z+(random()-.5)*.22,rad,.50+random()*.18,rad*.92,a+.35);}for(let b=0;b<3;b++){let aa=a+(b-1)*.16,rr=r+.42+random()*.38;lobe(Math.cos(aa)*rr,2.0+random()*3.6,Math.sin(aa)*rr,.42,.38,.55,aa+.25);}}group(wallStart);
for(let arm=0;arm<3;arm++){const start=lobes.length;for(let j=0;j<26;j++){let u=(j+.35)/26,r=eye+1.8+u*(outer-eye-2.0),a=arm*2.094395+curl*u*5.6+(random()-.5)*.10,x=Math.cos(a)*r,z=Math.sin(a)*r,rad=.42+.36*(1-u)+random()*.18;lobe(x,1.45+random()*.7,z,rad,.28+random()*.20,rad*1.55,a+.50);if(j%3===0)lobe(x*.98,2.25+random()*1.5,z*.98,rad*.72,.42,rad*.90,a+.35);}group(start);}
const shield=lobes.length;for(let j=0;j<42;j++){let a=random()*6.2831853,r=eye+1.9+Math.sqrt(random())*(outer-eye-2.1),x=Math.cos(a)*r,z=Math.sin(a)*r;lobe(x,5.8+random()*.55,z,1.15+random()*.65,.18+random()*.18,.95+random()*.55,a+.45);}group(shield);
}else if(c.case==='squall'){
for(let j=0;j<6;j++){let x=(j-2.5)*3.55,z=(j%2-.5)*1.2+(random()-.5)*.5;cumulus(x,z,.58+random()*.10,true);}
}else if(c.case==='iridescent'){''')

patch('cloud.glsl','uniform vec3 uLoop,uOccupancySize;uniform float uFastEmpty,uMicroFilter;',
'''uniform vec3 uLoop,uOccupancySize;uniform float uFastEmpty,uMicroFilter,uSolarDay;uniform vec4 uCyclone;''')
patch('cloud.glsl','vec3 flowPos(vec3 p){vec3 q=p-uWind;',
'''vec3 flowPos(vec3 p){vec3 q=p-uWind;if(uCyclone.x>.5){float r=length(q.xz),gate=smoothstep(uCyclone.z*.58,uCyclone.z*1.18,r)*(1.-smoothstep(11.8,15.2,r)),ang=gate*(uCyclone.y*uTime*.035+uCyclone.w*log(1.+r)*.78);float ca=cos(ang),sa=sin(ang);q.xz=mat2(ca,-sa,sa,ca)*q.xz;}''')
patch('cloud.glsl','if(uIris.x<=0.||uSun.y<=0.)return vec3(1);','if(uIris.x<=0.||uSolarDay<=0.)return vec3(1);')

README='''# Weather Mother 1.1 Full Weather Candidate

在线入口：https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v110-full/

这是完整天气主工作台。主界面以天气案例、十种云属、种子、风、时间、云体演化、光学、降水、闪电和性能为核心。中性检查与体积诊断继续作为方法论证据保留在 method-v100，不占用日常天气生产界面。

本版从已公开验证的 V0.6.2 循环内核和 V0.6.3 光学研究源重新构建。原 Clean V1.0、V0.6.2、独立光影工作室、Ocean Mother、地形和权威数据均未改动。五个光影场景通过现有自然光参数进入主工作台，独立三灯检查页继续保留链接。

天气案例总数为 20。原有晴日、海岸低云、山间湿雾、阴雨、雷暴、彩虹、雪云和高空冰云全部保留；七彩薄云、七彩云缘、荚状云、鱼鳞云、晨光低云、落日积云、湿雾云海、夜间雷暴继续存在；新增暖锋云幕、冷锋过境、飑线雷暴和台风云系。

台风案例生成空心风眼、眼墙、三条螺旋雨带与高层云盾，并通过可调旋转场演化。它是程序化体积天气外观模型。没有海温、气压、科氏力、边界层、眼墙置换循环或数值天气求解，不能用于预报与科学重建。

七彩云采用运行时生成的多波段衍射外观查找表，没有图片贴片。闪电采用连续分叉通道、短促复击和多个云内照亮节点，仍等待用户参考图校准，不能标记为最终 3A 闪电。

运行时没有云照片、HDR 图片、贴图云层或导入云模型。visualApproved、aaaQualityApproved 和 productionReady 继续为 false。
'''
(OUT/'README.md').write_text(README)
RULES={'productionLine':'Weather Mother','version':'1.1.0-world','policyVersion':'1.0.0','primaryInterface':'full weather workbench','visiblePrimaryModes':['weather cases','cloud genera','seed families','wind and motion','time history','lighting','optical phenomena','precipitation','lightning','performance'],'evidenceModesExternal':['method-v100 neutral inspection','method-v100 lighting studio','method-v100 diagnostics'],'weatherCases':['fair','coast','mountain','rain','storm','rainbow','snow','high','iridescent','irisEdge','lenticular','mackerel','dawn','sunset','fogbank','nightstorm','warmfront','coldfront','squall','typhoon'],'causalChains':{'wind':['wind force','gust','turbulence','cloud advection','shear deformation'],'typhoon':['organized source field','eye and eyewall','spiral rainbands','rotational material-space advection','rain and lightning appearance'],'iridescence':['sun-observer angle','droplet-radius control','optical thinness','spectral appearance'],'time':['physical simulation time','shape loop phase','display playback']},'truthBoundaries':['no numerical weather prediction','no full fluid solver','no live weather','no measured microphysics','no scientific typhoon reconstruction'],'protected':['weather-mother/clean-v1','weather-mother/v062-loop','weather-mother/method-v100','ocean-mother','landscape and DEM truth'],'storedImageAssets':0,'visualApproved':False,'aaaQualityApproved':False,'productionReady':False}
(OUT/'WORLD_RULES.json').write_text(json.dumps(RULES,ensure_ascii=False,indent=2)+'\n')
files={}
for p in sorted(OUT.iterdir()):
    if p.is_file():
        b=p.read_bytes();files[p.name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
manifest={'productionLine':'Weather Mother','version':'1.1.0-world','buildSourceHead':os.environ.get('GITHUB_SHA','LOCAL'),'derivedFrom':['V062 verified loop kernel','V063 optics source research'],'files':files,'runtimeBytes':sum(files[n]['bytes'] for n in ['index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']),'weatherCaseCount':20,'cloudGenusCount':10,'storedImageAssets':0,'status':'BUILT_PENDING_BROWSER_QA','mainWorkbenchContainsNeutralOrDiagnosticTabs':False,'visualApproved':False,'aaaQualityApproved':False,'productionReady':False}
(OUT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'built','files':len(files),'runtimeBytes':manifest['runtimeBytes'],'cases':20},ensure_ascii=False))
