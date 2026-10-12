from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'source/Ocean_Mother_V001_Frozen_Deep.html'
base=BASE.read_text()
assert hashlib.sha256(BASE.read_bytes()).hexdigest()=='3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1'
s=base
def replace(a,b):
 global s
 assert s.count(a)==1, (a[:100],s.count(a))
 s=s.replace(a,b)
replace('<title>Ocean Mother · 原始深海工作台 V001</title>','<title>KAOPU 香港背景海 · Ocean Mother 试接 R01</title>')
start=s.index('/* Original V001 renderer is preserved;')
end=s.index('</style>',start)
s=s[:start]+'''/* The standalone HK trial restores V001 controls hidden only by its former R018 shell. */
#panel{top:96px;bottom:68px}#weatherOriginal{display:none!important}
#mapStatus{display:block;font-size:11px;letter-spacing:0;color:#d1e2e5;margin-top:5px}
#titleCard{bottom:78px}#titleCard p{max-width:420px}.presets{grid-template-columns:1fr}
@media(max-width:700px){#mast{align-items:flex-start}.brand h1{font-size:11px}.brand div>span{letter-spacing:.3px}.topActions{gap:4px}.topActions button{padding:7px 6px}#mapStatus{font-size:10px}#panel{top:86px;bottom:56px}#titleCard{bottom:64px}#titleCard h2{font-size:20px}#titleCard p{max-width:290px;font-size:10px}footer{font-size:9px}}
''' + s[end:]
replace('<body>','<body data-build="HK-BACKGROUND-SEA-R01B-20261012" data-map-assembled="false">')
replace('aria-label="Ocean Mother 实时三维海洋"','aria-label="香港背景海试接：Ocean Mother V001 实时位移海面，地图尚未装配"')
replace('<h1>OCEAN MOTHER</h1><span>海洋工作台 / 第一版</span>','<h1>KAOPU · 香港背景海</h1><span>Ocean Mother V001 · R01B</span><b id="mapStatus">独立试接 · 香港地图尚未装配</b>')
s=re.sub(r'<div class="presets" id="presets">.*?</div>','<div class="presets" id="presets"><button data-preset="hongkong" class="active">恢复海色与波形预设</button></div>',s,count=1)
replace('PROCEDURAL OCEAN LAB','HONG KONG · BACKGROUND SEA TRIAL')
replace('<h2 id="presetTitle">晴日海风</h2>','<h2 id="presetTitle">香港蓝绿背景海</h2>')
replace('Weather Mother Clean V1.0 · 同一日照与风场','24 层几何波 · 原版法线与反光 · 地图未装配')
replace('<strong>OCEAN MOTHER</strong>','<strong>香港背景海</strong>')
replace("const seaPresets={breeze:","const seaPresets={hongkong:{title:'香港蓝绿背景海',caption:'温和起伏与正常反光。水色是试接参数，香港铁路和地形尚未装配。',swell:.30,period:8.8,wind:4,chop:.40,rough:.18,foam:.04,tint:.45,hour:14.5,weather:'fair',height:9},breeze:")
replace("presetParam&&seaPresets[presetParam]?presetParam:'breeze'","presetParam&&seaPresets[presetParam]?presetParam:'hongkong'")
replace("'Ocean Mother V0.1 · 可交互候选'","'香港背景海 R01B · 地图未装配'")
replace('海面为多尺度解析波候选。泡沫与透光是图形近似，尚未接入真实岸线、海底、潮汐或流体求解。','复用 V001 位移网格、24 层解析波、12 层微法线和 Fresnel 反射。海水不透底；香港色水配置不是实测海况。此页尚未接入香港地形、铁路、岸线、海底或潮汐。')
replace('<a id="weatherOriginal" href="weather/index.html" target="_blank" rel="noopener">打开原版 Weather Mother 工作台 ↗</a>','<span id="weatherOriginal">Weather Mother Clean V1.0</span>')
# Background mode reuses the original computed atmosphere as a parameter-updated snapshot.
# Sea geometry, normals, Fresnel, sun/moon specular and environment lookup remain untouched.
replace("const qa={version:'0.1.0'", "const BACKGROUND_SKY=!new URLSearchParams(location.search).has('liveWeather');\nconst qa={backgroundSkySnapshot:BACKGROUND_SKY,weatherClockMode:BACKGROUND_SKY?'parameter-updated-static-snapshot':'original-live-weather',version:'0.1.0'")
replace("if(!baking){if(!envForce&&paused&&!envDirty)return;", "if(!baking){if(BACKGROUND_SKY&&readyEnvironment&&!envForce&&!envDirty)return;if(!envForce&&paused&&!envDirty)return;")
replace("if(!paused&&qa.ready){W.tick(dt);seaTime+=dt*S.seaSpeed;}","if(!paused&&qa.ready){if(!BACKGROUND_SKY)W.tick(dt);seaTime+=dt*S.seaSpeed;}")
replace("if(id==='height'){envDirty=true}needFrame=true;syncUI()", "if(['hour','density','wind','direction','cloudSpeed','exposure','height'].includes(id)){envDirty=true;envForce=true;baking=false}needFrame=true;syncUI()")
replace('日照与天气 <span>WEATHER LINK</span>', '背景天光 <span>PARAMETER SNAPSHOT</span>')
replace('<div class="times">', '<p>天光缓存固定为当前参数；改日照、天气、风或高度会重新生成。海浪持续运行。</p><div class="times">')
replace('function rebuild(){workerJob++;', 'function rebuild(){workerJob++;qa.weatherRequestedRevision=workerJob;')
replace('const d=pendingVolume;pendingVolume=null;', 'const d=pendingVolume;pendingVolume=null;qa.weatherAppliedRevision=d.id;')
replace('bakeSnapshot=W.snapshot();bakeEnv=W.getEnvironment();', 'bakeSnapshot=W.snapshot();bakeEnv=W.getEnvironment();qa.atlasBakingRevision=qa.weatherAppliedRevision||0;')
replace('qa.cloudAtlasFrames=envCompleted;', 'qa.cloudAtlasFrames=envCompleted;qa.atlasWeatherRevision=qa.atlasBakingRevision;')
adapter='''
<script>
(function(){'use strict';
const ID='HK-BACKGROUND-SEA-R01B-20261012';
const source={repository:'haihao0307/guilin-dem-pipeline',oceanCommit:'499e8eb8a74041c35c55622f391ee5de04aaca60',frozenPackageCommit:'90a49e399079674230e658ca9cea242c8ec44b94',deepSha256:'3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1'};
const allowed=new Set(['wind','direction','swell','period','chop','rough','foam','tint','seaSpeed','hour','density','cloudSpeed','exposure','height']);
function api(){const a=window.OceanMother;if(!a?.getConfiguration)throw Error('Ocean Mother is not initialized');return a;}
window.HKBackgroundSea={build:ID,source,
 getState(){const a=api();return{build:ID,source,mapAssembled:false,terrainAssembled:false,railwayAssembled:false,seaLevelDatum:'UNBOUND',units:{length:'metre',time:'simulation second'},axes:{east:'+X',up:'+Y',north:'-Z'},environmentMode:a.qa.weatherClockMode,configuration:a.getConfiguration(),readiness:{...a.getReadiness(),weatherWorkerBusy:a.qa.weatherRequestedRevision!==a.qa.weatherAppliedRevision,weatherRequestedRevision:a.qa.weatherRequestedRevision,weatherAppliedRevision:a.qa.weatherAppliedRevision,atlasWeatherRevision:a.qa.atlasWeatherRevision},qa:{...a.qa},visualAcceptance:false,productionReady:false};},
 setConfig(patch){const a=api();for(const[k,v]of Object.entries(patch)){if(!allowed.has(k)||!Number.isFinite(v))throw Error('Unsupported sea parameter '+k);}for(const[k,v]of Object.entries(patch))a.set(k,v);return this.getState();},
 reset(){api().setPreset('hongkong');return this.getState();},
 sampleHeight(x,z,t){if(!Number.isFinite(x)||!Number.isFinite(z)||(t!==undefined&&!Number.isFinite(t)))throw Error('Finite metre coordinates required');return api().sampleHeight(x,z,t);},
 pause(){api().pause();},play(){api().play();},setView(yaw,pitch,height){if(![yaw,pitch,height].every(Number.isFinite))throw Error('Finite camera values required');api().setView(yaw,pitch,height);}
};
})();
</script>
'''
replace('</body>',adapter+'</body>')
(ROOT/'index.html').write_text(s)
# Kernel parity is intentional: source implementation is reused, not independently recreated.
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.scripts=[];self.ins=False
 def handle_starttag(self,t,a):
  if t=='script':self.ins=True;self.scripts.append('')
 def handle_endtag(self,t):
  if t=='script':self.ins=False
 def handle_data(self,d):
  if self.ins:self.scripts[-1]+=d
for name,html in [('baseline',base),('candidate',s)]:
 p=Scripts();p.feed(html)
 for i,js in enumerate(p.scripts):(ROOT/'qa'/f'{name}-script-{i}.js').write_text(js)
# Pin byte-identical shader data, weather contract, wave generator and height sampler.
def between(text,a,b):return text[text.index(a):text.index(b,text.index(a))]
blocks={
 'bundled_shaders_and_weather':('__OM_TEXT__=',"async function text(url)"),
 'wave_generation_and_height':('function makeWaves()', 'function cameraData()'),
 'weather_contract':('(function(root)', '})(window);'),
}
parity={}
for key,(a,b) in blocks.items():
 x=between(base,a,b);y=between(s,a,b);assert x==y,key
 parity[key]=hashlib.sha256(x.encode()).hexdigest()
manifest={'build':'HK-BACKGROUND-SEA-R01B-20261012','createdUtc':'2026-10-12T23:35:00Z','sourceRepository':'haihao0307/guilin-dem-pipeline','oceanSourceCommit':'499e8eb8a74041c35c55622f391ee5de04aaca60','canonicalPackageCommit':'90a49e399079674230e658ca9cea242c8ec44b94','sourceDeepSha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'sourceDeepBytes':len(BASE.read_bytes()),'candidateBytes':len(s.encode()),'candidateSha256':hashlib.sha256(s.encode()).hexdigest(),'sourceParity':parity,'scope':'kaopu-geography-workbench/hong-kong-background-sea-r01/','mapAssembled':False,'visualAcceptance':False,'productionReady':False,'externalModelAssets':0,'externalImageAssets':0,'audioAssets':0,'standaloneHtml':True,'backgroundSkyMode':'parameter-updated-static-snapshot','liveWeatherComparisonQuery':'?liveWeather=1','geometry':'Inherited V001 displaced indexed grid, 24 directional Gerstner components, 12 filtered micro-slope harmonics','rightsBasis':'V001 README identifies new ocean implementation as original project code; shared Weather Mother supplied by the user. No third-party meshes, images, recordings, or shader-study payloads added. No broad open-source license is asserted.','rollback':'Isolated new directory; no existing homepage, accepted scene, Ocean Mother source or train runtime changed.'}
(ROOT/'SOURCE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'TASK_ANCHOR.json').write_text(json.dumps({'taskId':manifest['build'],'dispatchTime':'2026-10-12T23:34:49Z','baseSha':manifest['oceanSourceCommit'],'target':'Isolated editable Hong Kong background-sea trial','allowedPaths':[manifest['scope']],'protected':['nine accepted geography scenes and cards','geography homepage','train88 runtime','Ocean Mother canonical source'],'forbidden':['low-quality invented water','Palau island','tides','reef holes','seabed','external meshes','recordings'],'checks':{'noGeneratedImageSubstitute':True,'productionSourceChanged':True,'interactive3D':True,'realTimeRenderer':True,'publicBrowserVerified':False,'screenshotAloneFails':True}},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
