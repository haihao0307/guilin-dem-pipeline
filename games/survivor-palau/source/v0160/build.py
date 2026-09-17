"""Build same-scene V001 integration; frozen source is never rewritten."""
from pathlib import Path
import hashlib,json,re,subprocess
from world_patch import apply as apply_world,SHORES
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BASE=ROOT/'releases/v0.1.5.0/Survivor_Palau_V0.1.5.0_Canoe_Control_Direct_Open.html'
OUT=ROOT/'releases/v0.1.6.0'
FROZEN=HERE/'frozen'
sha=lambda s:hashlib.sha256(s.encode('utf-8')).hexdigest()
original=(FROZEN/'original-deep-v001.html').read_text()
assert sha(original)=='3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1'
script=(FROZEN/'original-script-1.js').read_text()
assert sha(script)=='856772a35239f3e4615344c8e83faf79edf4fb6637d9a7845d8adaf1545cc338'
lines=script.splitlines(keepends=True)
def span(a,b):return ''.join(lines[a-1:b])
kernel=span(10,13)+span(18,51)+span(52,52)+span(57,57)
bridge=(HERE/'bridge.js').read_text().replace('// __FROZEN_KERNEL__',kernel)
weather=(FROZEN/'original-script-0.js').read_text()
raw=(FROZEN/'resources/weather/cloud.glsl').read_text()
def function(source,signature):
 start=source.index(signature);brace=source.index('{',start);depth=1;i=brace+1
 while depth:
  depth+=(source[i]=='{')-(source[i]=='}');i+=1
 return source[start:i]
shared='''uniform vec3 uSun,uMoon,uSunColor;uniform vec4 uLight,uWeather;uniform float uDay;
uniform sampler2D smiEnvA,smiEnvB;uniform float smiEnvMix,smiEncodedEnv;
uniform vec4 smiWaveK[24],smiWaveA[24];
'''
for sig in ['float hash(vec3 p)','float phaseHG(float g,float mu)','vec3 sky(vec3 d)']:shared+=function(raw,sig)+'\n'
shared+='''vec4 smiEnvironment(vec3 d){float angle=atan(d.x,-d.z)/6.28318530718+.5;float v=sqrt(clamp(asin(clamp(d.y,0.,1.))/1.57079632679,0.,1.));vec4 a=texture(smiEnvA,vec2(angle,v)),b=texture(smiEnvB,vec2(angle,v));if(smiEncodedEnv>.5){a.rgb=a.rgb/max(1.-a.rgb,vec3(.001));b.rgb=b.rgb/max(1.-b.rgb,vec3(.001));}return mix(a,b,smiEnvMix);}
vec3 smiFilm(vec3 c){c=max(c,vec3(0));c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}
vec3 smiUnfilm(vec3 c){vec3 y=pow(clamp(c,0.,.9999),vec3(2.2)),a=2.51-2.43*y,b=.03-.59*y;return max(vec3(0),(-b+sqrt(b*b+4.*a*.14*y))/(2.*a));}
float smiDeepHeight(vec2 p,float t){float y=0.;p+=vec2(0.,8000.);for(int j=0;j<24;j++){vec4 k=smiWaveK[j],v=smiWaveA[j];y+=v.x*sin(dot(k.xy,p)*k.z-k.w*t+v.z);}return y;}
'''
h=BASE.read_text()
def rep(a,b,count=1):
 global h
 assert h.count(a)==count,(a[:100],h.count(a),count)
 h=h.replace(a,b)
rep('<script type="module">','<script type="module">\n'+weather+'\n'+bridge+'\n')
start=h.index('// BEGIN params.mjs',h.index('window.createStoneMoneyOcean'))
prefix,h=h[:start],h[start:]
rep("const VERSION='palau-survival-0.1.5.0-canoe-control'","const VERSION='stone-money-island-0.1.6.0-original-ocean'")
h=apply_world(h)
rep('cy=bedHeight(cx,cz)+sy*(isKarst?.45:(.72-SURFACE.rockEmbed))','cy=(isKarst&&Math.hypot(cx,cz)>60?0:bedHeight(cx,cz))+sy*(isKarst?.45:(.72-SURFACE.rockEmbed))')
a=h.index('vec3 skyRadiance(');b=h.index('\n`;',a)
h=h[:a]+shared+'''vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float ignoredExposure){rd=normalize(rd);vec4 e=smiEnvironment(rd);return e.rgb+e.a*sky(rd);}
vec3 farSeaRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){return skyRadiance(vec3(rd.x,abs(rd.y),rd.z),sunDir,mode,exposure);}
'''+h[b:]
pos=h.index(shared);h=h[:pos]+h[pos+len(shared):]
pos=h.index('float waveSurface(');h=h[:pos]+shared+h[pos:]
a=h.index(' const farMix=smooth(46,172,s);');b=h.index(' const run=',a);h=h[:a]+h[b:]
rep(' float farMix=smoothstep(46.0,172.0,s);eta+=farMix*p_swell*deepSpectrum(p,uTime);','')
rep(' const depth=eta-bed,breaker=',' const nearWeight=1-smooth(8,20,Math.max(0,depth0));if(window.StoneMoneyFrozenOcean)eta=mix(window.StoneMoneyFrozenOcean.sampleHeight(x,z,time),eta,nearWeight);\n const depth=eta-bed,breaker=')
f=function(h,'float waveSurface(')
h=h.replace(f,f.replace(' return eta;',' return mix(smiDeepHeight(p,uTime),eta,1.-smoothstep(8.,20.,max(0.,d0)));'))
rep('outColor=vec4(lit*uExposure,1.0);','outColor=vec4(smiFilm(lit*uExposure),1.0);')
rep('c=max(c,vec3(0));c=c/(vec3(.72)+c);c=pow(c,vec3(1.0/2.2));','c=clamp(c,0.,1.);')
a=h.index('const WATER_FS=');b=h.index('const MEDIA_VS=',a);water=h[a:b]
water=water.replace('void main(){','void main(){\n float smiCoastWeight=1.-smoothstep(8.,20.,max(0.,uSeaLevel-bedH(vWorld.xz)));if(smiCoastWeight<.001)discard;if(texture(uSceneDepth,gl_FragCoord.xy/uResolution).r<gl_FragCoord.z-.000001)discard;',1)
water=water.replace('vec3 behind=texture(uScene,refrUv).rgb','vec3 behind=smiUnfilm(texture(uScene,refrUv).rgb)')
water=re.sub(r'float farBlend=smoothstep\([^;]+;\s*water=mix\([^;]+;','',water)
water=water.replace('outColor=vec4(water*coverage*uExposure,coverage);','coverage*=smiCoastWeight;outColor=vec4(smiFilm(water*uExposure)*coverage,coverage);')
assert 'smiFilm(water' in water
h=h[:a]+water+h[b:]
a=h.index('const CURL_FS=');b=h.index('const CURL_VS=',a);curl=h[a:b]
curl=curl.replace('void main(){','void main(){\n if(texture(uSceneDepth,gl_FragCoord.xy/uResolution).r<gl_FragCoord.z-.000001)discard;',1)
curl=curl.replace('vec3 behind=texture(uScene,clamp(uv+offset,vec2(.001),vec2(.999))).rgb;','vec3 behind=smiUnfilm(texture(uScene,clamp(uv+offset,vec2(.001),vec2(.999))).rgb);')
curl=curl.replace('outColor=vec4(color*alpha*uExposure,alpha);','outColor=vec4(smiFilm(color*uExposure)*alpha,alpha);')
h=h[:a]+curl+h[b:]
a=h.index('const MEDIA_FS=');b=h.index('const COPY_VS=',a);media=h[a:b]
film=function(shared,'vec3 smiFilm(')
media=media.replace('void main(){',film+'\nvoid main(){',1)
media=media.replace('vec4(c*alpha*uExposure,alpha)','vec4(smiFilm(c*uExposure)*alpha,alpha)').replace('vec4(c*a*uExposure,a)','vec4(smiFilm(c*uExposure)*a,a)').replace('vec4(vec3(2.6,.55,.035)*a,a)','vec4(smiFilm(vec3(2.6,.55,.035))*a,a)')
h=h[:a]+media+h[b:]
rep('let gl,skyProgram','let frozenOcean;\nlet gl,skyProgram')
old=function(h,'function sunDirection()');h=h.replace(old,'function sunDirection(){return frozenOcean?frozenOcean.getEnvironment().sun.direction:[.5,.7,.5];}')
old=function(h,'function drawSky(');h=h.replace(old,'function drawSky(sun){frozenOcean.drawSky(sceneFbo,camera);qa.drawCalls++;}')
rep('gl.useProgram(solidProgram);gl.bindVertexArray(geo.vao);','gl.useProgram(solidProgram);frozenOcean.bindGame(solidProgram);gl.bindVertexArray(geo.vao);')
rep('gl.useProgram(waterProgram);gl.bindVertexArray(waterGeo.vao);','gl.useProgram(waterProgram);frozenOcean.bindGame(waterProgram);gl.bindVertexArray(waterGeo.vao);')
old=function(h,'function drawWater(')
new=old.replace('gl.enable(gl.DEPTH_TEST);gl.depthMask(false);','gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.ALWAYS);gl.depthMask(false);').replace('gl.depthMask(true);qa.drawCalls++;','gl.depthMask(true);gl.depthFunc(gl.LESS);qa.drawCalls++;')
h=h.replace(old,new)
rep('camera.fov,aspect,.15,6000','camera.fov,aspect,.15,60000')
rep("if(!gl)throw Error('当前浏览器未提供 WebGL2');qa.webgl2=true;","if(!gl)throw Error('当前浏览器未提供 WebGL2');qa.webgl2=true;frozenOcean=await window.createStoneMoneyOcean(gl,canvas);qa.frozenOcean=frozenOcean.qa;")
rep('waterGeo=oceanMesh(gl,oceanAngular,oceanRadial,OCEAN_OUTER_RADIUS)','waterGeo=oceanMesh(gl,oceanAngular,oceanRadial,360)')
rep(' updateCamera(canvas.width/canvas.height);\n if(changed){',' frozenOcean.prepare(now,physicalTime);qa.ready=frozenOcean.qa.ready;qa.visibleClouds=frozenOcean.qa.cloudAtlasFrames>0;if(qa.ready)loading.classList.add("done");changed=true;\n if(query.has("reference")){config.paused=true;physicalTime=0;camera.eye=[0,9,0];camera.forward=normalize3([Math.sin(-.48)*Math.cos(-.055),Math.sin(-.055),-Math.cos(-.48)*Math.cos(-.055)]);camera.right=normalize3(cross3(camera.forward,[0,1,0]));camera.up=cross3(camera.right,camera.forward);camera.fov=55*Math.PI/180;glassCount=0;glassDirty=false;}else updateCamera(canvas.width/canvas.height);\n if(changed){')
rep('drawSky(sun);drawSolid(terrainGeo,sun);','drawSky(sun);if(!query.has("reference")){drawSolid(terrainGeo,sun);')
rep('drawSolid(canoeGeo,sun,canoeModel());gl.bindFramebuffer','drawSolid(canoeGeo,sun,canoeModel());}gl.bindFramebuffer')
rep('blitOpaque();const sun=sunDirection();if(config.waterVisible){drawWater(sun);drawCurl(sun)}drawMedia();','blitOpaque();const sun=sunDirection();if(config.waterVisible){frozenOcean.drawSea(compositeFbo,camera);qa.drawCalls++;if(!query.has("reference")){drawWater(sun);drawCurl(sun)}}if(!query.has("reference"))drawMedia();')
rep('updateCurl(0);qa.ready=true;','updateCurl(0);qa.ready=false;')
rep("loading.classList.add('done');lastFrame=performance.now();requestAnimationFrame(frame);","progress.textContent='原版云场生成中 · 海岛已建立';lastFrame=performance.now();requestAnimationFrame(frame);")
rep('function updateGlassRects(){','function updateGlassRects(){if(query.has("reference")){glassCount=0;return;}')
rep('CANOE_STATE.drive=!!on;CANOE_STATE.speed*=CANOE_STATE.drive?1:0;','CANOE_STATE.drive=!!on;document.body.dataset.driving=String(CANOE_STATE.drive);CANOE_STATE.speed*=CANOE_STATE.drive?1:0;')
rep("const config={...DEFAULTS,paused:false,mode:'environment',smokeVisible:true,fireEnabled:true,waterVisible:true}","const config={...DEFAULTS,hour:16.2,exposure:1,wind:10,windDir:270,autoOrbit:0,paused:query.has('reference'),mode:'environment',smokeVisible:true,fireEnabled:true,waterVisible:true}")
rep('config[key]=v;','config[key]=v;if(frozenOcean&&["hour","wind","windDir","exposure"].includes(key))frozenOcean.setWeatherParameter(key==="windDir"?"direction":key,v);')
rep('const mobile=innerWidth<760,scale=QA_MODE?.68:(mobile?Math.min(1,devicePixelRatio||1):Math.min(1.15,devicePixelRatio||1))','const mobile=innerWidth<700,scale=mobile?.8:1')
h=h.replace("cloudModel:'high-contrast broken cumulus cells with shaded bases and explicit blue-sky gaps'","cloudModel:'byte-locked-original-v001-volume-worker-and-cloud-radiance-cache'")
h=h.replace("buildId:'palau-survival-v0150-canoe-control'","buildId:'stone-money-island-v0160-original-ocean'")
h=h.replace('single continuous island-to-ocean field with world-space deep spectrum, irregular breaker packets, transported foam, reef-pit bathymetry and procedural clouds; no 3D conservative solver','same-world frozen V001 ocean/cloud kernel plus authored coast instances; shoreline transport and full collision agreement remain under verification')
h=h.replace('visibleClouds:true','visibleClouds:false').replace('naturalWaveSpectrum:true','naturalWaveSpectrum:false')
h=h.replace('已抵达深海钓点范围。舟行接口通过；下一生产段接鱼群、抛线与收线。','已到达外海。鱼群与钓鱼操作正在接续制作。').replace('驶向深海钓点，同时验证浅水减速、搁浅和岩体阻挡。','沿白沙岸划行，绕过浅礁，驶向外海。')
h=prefix+h
h=h.replace('PALAU SURVIVAL','STONE MONEY ISLAND').replace('Survivor: Palau','Stone Money Island').replace('PLAYABLE CANOE · SHORE/DEEP TRANSITION / V0.1.5.0','石钱岛 · 原版海天接回 / V0.1.6.0').replace('V0.1.5.0 · 独木舟驾驶与浅深水过渡','V0.1.6.0 · 原版海天与白沙岸').replace('>深海钓点</button>','>外海</button>').replace('任务 01 · 舟行测试','沿岸探索').replace('游戏层待命 · 键盘 W/S/A/D 或方向键 · 手机使用方向键','点击驾驶 · 左右转向，向前划行')
h=re.sub(r'<title>[^<]+</title>','<title>Stone Money Island · V0.1.6.0</title>',h,count=1)
css='''
#sceneTitle,.sceneMode,#cameraHint{display:none!important}.brandMark{display:none!important}
.topbar{padding:14px 18px!important;gap:12px!important}.brand{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important}.brand b{letter-spacing:.14em;font-size:13px}.brand small{font-size:10px;opacity:.82}
#coastFooter{display:none!important}.topActions #resetCamera{display:none}
#gameDock{bottom:18px!important;left:18px!important;right:auto!important;max-width:calc(100vw - 36px);background:rgba(9,31,37,.68)!important;color:#eef9f5!important;border-color:rgba(226,245,241,.20)!important}
#canoeDrive{min-height:44px;color:#f5fff9!important;background:rgba(255,255,255,.12)!important}#canoeTelemetry{font-size:11px;max-width:320px}
#cameraBar{bottom:82px!important;max-width:calc(100vw - 36px);overflow-x:auto;justify-content:flex-start;scrollbar-width:none;white-space:nowrap}#cameraBar button{flex-shrink:0;min-height:42px}
#boatMission{top:92px!important;right:18px!important;background:rgba(9,31,37,.68)!important;color:#eef9f5!important}
#boatPad{bottom:24px!important;right:18px!important}#boatPad button{min-width:48px;min-height:48px;touch-action:none;background:rgba(9,31,37,.72);color:white;border:1px solid #deeee940}
body[data-driving="true"] #cameraBar{display:none!important}
[data-key="cloudiness"],[data-key="cloudSpeed"]{display:none!important}
@media(max-width:760px){.topbar{padding:10px!important;align-items:flex-start}.brand b{font-size:11px}.brand small{font-size:9px;max-width:180px}.topActions{gap:3px!important;padding:3px!important}.topActions button{font-size:11px;min-height:42px;padding:8px!important}#panelToggle{max-width:60px;overflow:hidden;white-space:nowrap}#gameDock{left:10px!important;bottom:14px!important;right:10px!important;max-width:none;padding:8px!important}#canoeTelemetry{font-size:10px;max-width:calc(100vw - 160px)}#cameraBar{bottom:81px!important;left:10px!important;right:10px!important;transform:none!important;width:auto!important;max-width:none}#boatPad{bottom:88px!important;right:12px!important}#boatMission{top:84px!important;left:12px!important;right:auto!important;max-width:220px;padding:9px 11px;font-size:10px}#boatMission b{font-size:10px}.topbar .brand{padding:5px!important}}
'''
h=h.replace('</style>',css+'\n</style>',1)
OUT.mkdir(parents=True,exist_ok=True)
entry=OUT/'Stone_Money_Island_V0.1.6.0_Direct_Open.html'
entry.write_text(h,encoding='utf-8')
for k,js in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',h)):
 p=OUT/f'.syntax-{k}.mjs';p.write_text(js);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
receipt={'title':'Stone Money Island','version':'0.1.6.0','baseSha256':sha(BASE.read_text()),'entrySha256':sha(h),'entryBytes':len(h.encode()),'frozenOriginalSha256':sha(original),'frozenOriginalByteIdentical':True,'originalShaderChanges':0,'originalDefaultValueChanges':0,'adapterChanges':['existing WebGL context','game camera reference z+8000','shared clock','framebuffer destinations','same cloud radiance shared by coast'],'newShoreInstances':SHORES,'shoreEvidence':'authored candidate, not surveyed Palau geometry','sourceModified':True,'staticImageSubstitute':False,'interactive3D':True,'buildPassed':True,'browserPassed':False,'publicHttpsPassed':False,'shareAllowed':False,'visualAcceptance':False,'productionReady':False,'limitations':['Original deep water has no bottom transmission; coast combination remains a separate authored expression.','No physical-device performance acceptance.','No fishing gameplay, birds or fish added by this restoration step.']}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
