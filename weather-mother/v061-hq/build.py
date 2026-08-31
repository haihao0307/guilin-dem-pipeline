"""Build the HQ successor from hash-locked Weather Mother v060 sources.
Only weather-mother/v061-hq generated runtime files are written.
"""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
BASE=REPO/'weather-mother/v060'
LOCK={'index.html':'820e921b47b1e258b4a7a724fea9ba4c17c59c93','engine.js':'2ec07fde5b3468b0038222ef805de774bd773175','field-worker.js':'a1cebacec518338ac000a524d8a43a080c59ba89','cloud.glsl':'496bf94e3d86e104eabbd8921784f817def56097'}
def gitblob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
source={}
for name,wanted in LOCK.items():
 data=(BASE/name).read_bytes()
 assert gitblob(data)==wanted,f'Baseline changed: {name}; stop rather than overwrite newer work.'
 source[name]=data.decode()
def replace(s,old,new,count=1):
 assert s.count(old)==count,(old[:110],s.count(old),count)
 return s.replace(old,new)
js=source['engine.js'].replace('0.6.0','0.6.1-hq').replace('?v=060','?v=061hq')
js=replace(js,"'haze','shear'];","'haze','shear','cloudSpeed','gust','turbulence','timeScale','evolution','silver','groundLight'];")
js=replace(js,'haze:.22,shear:.18},target','haze:.16,shear:.18,cloudSpeed:12,gust:.15,turbulence:.25,timeScale:1,evolution:1,silver:1,groundLight:1},target')
js=replace(js,"let seed=4217,kind='Cu',weather='fair',time=0,","let seed=4217,kind='Cu',weather='fair',time=0,evolutionTime=0,")
js=replace(js,'[160,96,128]:[256,144,192]','[192,112,160]:[320,192,256]')
js=js.replace('64**3*2','96**3*2').replace('[64,64,64]','[96,96,96]')
js=replace(js,"k==='wind'?Math.round(v)+'m/s':","(k==='wind'||k==='cloudSpeed')?Math.round(v):k==='timeScale'?v.toFixed(1)+'×':")
js=replace(js,"target[k]=+e.target.value;outputs();invalidate();","target[k]=+e.target.value;if(k==='wind'&&$('windLink').checked)target.cloudSpeed=target.wind;outputs();invalidate();")
js=replace(js,"['mountains','aircraft','rainbow','quality']","['mountains','aircraft','rainbow','quality','temporal','follow']")
js=replace(js,"addEventListener('resize',invalidate);","$('windLink').onchange=()=>{if($('windLink').checked)target.cloudSpeed=target.wind;outputs();invalidate();};\naddEventListener('resize',invalidate);")
old="time+=dt;const a=state.direction*Math.PI/180;windOffset[0]+=-Math.sin(a)*state.wind*.001*dt;windOffset[2]+=Math.cos(a)*state.wind*.001*dt;"
new="const simDt=dt*state.timeScale;time+=simDt;evolutionTime+=simDt*state.evolution;const a=state.direction*Math.PI/180,speed=$('windLink').checked?state.wind:state.cloudSpeed,gust=1+state.gust*(.65*Math.sin(time*.39)+.35*Math.sin(time*.13+1.3));windOffset[0]+=-Math.sin(a)*speed*gust*.001*simDt;windOffset[2]+=Math.cos(a)*speed*gust*.001*simDt;"
js=replace(js,old,new)
js=replace(js,"scale=q==='ultra'?1:q==='fine'?.83:.64;steps=q==='ultra'?208:q==='fine'?144:96;","scale=q==='cinema'||q==='ultra'?1:q==='fine'?.90:.64;steps=q==='cinema'?480:q==='ultra'?320:q==='fine'?192:112;")
js=replace(js,'Math.min(devicePixelRatio||1,1.5),cw=Math.min(2200,','Math.min(devicePixelRatio||1,2),cw=Math.min(3840,')
js=replace(js,'settled>=16','settled>=24')
js=replace(js,"f(prog,'uFrame',hdr?qa.frames%32:0);","f(prog,'uFrame',hdr&&$('temporal').checked?qa.frames%32:0);")
js=replace(js,"f(resolve,'uValid',hdr&&historyValid?1:0);","f(resolve,'uValid',hdr&&historyValid&&$('temporal').checked?1:0);")
js=replace(js,'weight=.86*valid;','weight=.89*valid;')
js=replace(js,"f(prog,'uShear',state.shear);","f(prog,'uShear',state.shear);f(prog,'uTemporal',hdr&&$('temporal').checked?1:0);f(prog,'uEvolution',evolutionTime);v3(prog,'uWindDirection',[-Math.sin(state.direction*Math.PI/180),0,Math.cos(state.direction*Math.PI/180)]);v4(prog,'uFlow',[state.wind,state.cloudSpeed,state.gust,state.turbulence]);v2(prog,'uSurface',state.silver,state.groundLight);")
js=replace(js,"const ls=solar(state.hour);","if($('follow').checked){camera[0]+=windOffset[0];camera[2]+=windOffset[2];cameraTarget[0]+=windOffset[0];cameraTarget[2]+=windOffset[2];}\nconst ls=solar(state.hour);")
js=replace(js,"qa.windOffset=[...windOffset];","qa.windOffset=[...windOffset];qa.cloudSpeedMps=$('windLink').checked?state.wind:state.cloudSpeed;qa.windForceMps=state.wind;qa.motionLinked=$('windLink').checked;qa.independentWindAndCloudSpeed=true;")
js=replace(js,"getState:()=>({...state,kind,weather,seed,playing,yaw,pitch,distance,blend})","getState:()=>({...state,kind,weather,seed,playing,yaw,pitch,distance,blend,windOffset:[...windOffset]})")
js=replace(js,"if(now-fpsStart>=1000||qa.frames===1){","const compass=['北','东北','东','东南','南','西南','西','西北'],bearing=Math.round(state.direction/45)%8;$('windReadout').textContent='来自'+compass[bearing]+'，吹向'+compass[(bearing+4)%8]+' · 云速 '+($('windLink').checked?state.wind:state.cloudSpeed).toFixed(1)+' m/s · '+state.timeScale.toFixed(1)+'×';\nif(now-fpsStart>=1000||qa.frames===1){")
worker=source['field-worker.js']
worker=worker.replace('64**3*2','96**3*2').replace('z<64','z<96').replace('y<64','y<96').replace('x<64','x<96').replace('(x+.5)/8','(x+.5)/12').replace('(y+.5)/8','(y+.5)/12').replace('(z+.5)/8','(z+.5)/12')
worker=replace(worker,'levels=tall?5:3','levels=tall?7:4')
worker=replace(worker,'for(let b=0;b<3;b++)','for(let b=0;b<4;b++)')
worker=replace(worker,"if(tall){for(let j=0;j<7;j++){","if(tall){lobe(x+tilt*height*.8,base+height-.65,z,1.12*scale,1.25*scale,1.02*scale);for(let j=0;j<7;j++){")
worker=replace(worker,'(.32+random()*.2)*scale','(.43+random()*.22)*scale')
shader=source['cloud.glsl']
shader=replace(shader,'uniform vec2 uRes;','uniform vec2 uRes,uSurface;\nuniform vec3 uWindDirection;uniform vec4 uFlow;uniform float uEvolution,uTemporal;')
shader=replace(shader,'q.x-=uShear*h*h*.9;','q-=uWindDirection*uShear*h*h*.9;float turbulence=uFlow.w*min(uFlow.x/30.,2.)*.16;vec3 curl=vec3(sin(q.z*.9+uEvolution*.10)*cos(q.y*.6),sin(q.x*.8-uEvolution*.07)*cos(q.z*.5),sin(q.y*.7+uEvolution*.08)*cos(q.x*.6));q+=curl*turbulence;')
shader=replace(shader,'-uTime*.004','-uEvolution*.004')
shader=replace(shader,'tau=max(0.,sh.x*1.45-.16*d)+densityAt(p+l*.12,true)*.28','tau=max(0.,sh.x*1.18-.19*d)+densityAt(p+l*.07,true)*.12+densityAt(p+l*.20,true)*.25')
shader=replace(shader,'m1=.22*exp(-tau*.28),m2=.075*exp(-tau*.075)','m1=.29*exp(-tau*.24),m2=.10*exp(-tau*.064)')
shader=replace(shader,"L+=vec3(.035,.036,.027)*(1.-h)*uDay*uLight.y;","L+=sunlight*direct*pow(sat(mu),7.)*(1.-exp(-d*3.))*uSurface.x*.08;L+=vec3(.035,.036,.027)*(1.-h)*uDay*uLight.y*uSurface.y;")
shader=replace(shader,"q.x+=uTime*.4+q.y*.16;","q.x+=uTime*.4+q.y*dot(uWindDirection,right)*min(uFlow.x/60.,1.)*.38;")
start=shader.index('if(nc>0){float ds=total/float(uSteps);')
end=shader.index('\nvec3 col=',start)
shader=shader[:start]+'''if(nc>0){float ds=total/float(uSteps),jitter=uTemporal>.5?fract(.754877666*gl_FragCoord.x+.569840296*gl_FragCoord.y+uFrame*.618033989):.5;int span=0;float edge=merged[0].x;
for(int j=0;j<528;j++){if(span>=nc||tr<.004)break;float len=min(ds,merged[span].y-edge);if(len<=1e-6){span++;if(span<nc)edge=merged[span].x;continue;}float t=edge+len*(.2+.6*jitter);vec3 p=ro+rd*t;float d=densityAt(p,true);if(d>.001){float alpha=1.-exp(-d*len*2.4);vec3 L=incident(p,rd,d);L=mix(L,sky(rd),1.-exp(-t*.006*(.6+uLight.w)));moment+=tr*alpha*t;light+=tr*alpha*L;tr*=1.-alpha;}edge+=len;if(edge>=merged[span].y-1e-5){span++;if(span<nc)edge=merged[span].x;}}}
'''+shader[end:]
html=source['index.html'].replace('0.6.0','0.6.1 HQ').replace('?v=060','?v=061hq').replace('VOLUMETRIC LAB','HIGH QUALITY WEATHER STUDIO')
def row(i,label,low,high,step,value):
 return f'<div class="row"><label for="{i}">{label}</label><input id="{i}" type="range" min="{low}" max="{high}" step="{step}" value="{value}"><output></output></div>'
html=replace(html,'<label for="wind">风速</label>','<label for="wind">风力 m/s</label>')
html=replace(html,'id="wind" type="range" min="0" max="50"','id="wind" type="range" min="0" max="80"')
marker='<div class="row"><label for="direction">'
html=replace(html,marker,row('cloudSpeed','云速 m/s',0,250,1,12)+marker)
marker='<details open><summary>大气与光照</summary>'
wind='<details open><summary>风与运动</summary>'+row('gust','阵风起伏',0,1,.01,.15)+row('turbulence','湍流强度',0,1,.01,.25)+row('timeScale','演示时速',0,60,.1,1)+row('evolution','内部演化',0,5,.05,1)+'<label class="check"><input id="windLink" type="checkbox">云速跟随风速</label><label class="check"><input id="follow" type="checkbox">相机跟随云场</label><div id="windReadout" class="hint"></div><p class="hint">风力驱动局部扰动，云速控制整片云的平移。1× 为实际秒，时速只用于加速演示。</p></details>'
html=replace(html,marker,wind+marker)
html=replace(html,'<div class="row"><label for="haze">',row('silver','透光银边',0,3,.01,1)+row('groundLight','地面反照',0,3,.01,1)+'<div class="row"><label for="haze">')
html=replace(html,'<option value="balanced">平衡</option><option value="fine" selected>精细</option><option value="ultra">特写</option>','<option value="balanced">交互预览 · 112 步</option><option value="fine" selected>高画质 · 192 步</option><option value="ultra">原生精细 · 320 步</option><option value="cinema">电影特写 · 480 步</option>')
html=replace(html,'<label class="check"><input id="mountains"','<label class="check"><input id="temporal" type="checkbox" checked>时间重投影与降噪</label><label class="check"><input id="mountains"')
html=html.replace('width:274px','width:306px').replace('grid-template-columns:68px','grid-template-columns:78px')
html=html.replace('风向为来风方向，速度为米/秒。零图片资产。','风与云速独立控制，均为米/秒。采样与内存优先服务画质，零图片资产。')
for word in ['value="Cu"','value="Cb"','value="Sc"','value="St"','value="Ns"','value="Ac"','value="As"','value="Ci"','value="Cc"','value="Cs"']:assert word in html
for name,txt in [('engine.js',js),('cloud.glsl',shader),('field-worker.js',worker),('index.html',html)]:
 (ROOT/name).write_text(txt)
 subprocess.run(['node','--check',str(ROOT/name)],check=True) if name.endswith('.js') else None
files={n:{'bytes':(ROOT/n).stat().st_size,'sha256':hashlib.sha256((ROOT/n).read_bytes()).hexdigest(),'gitBlobSha':gitblob((ROOT/n).read_bytes())} for n in LOCK}
manifest={'productionLine':'Weather Mother','version':'0.6.1-hq','baselineCommit':'7d2f2a636f3c1417e1da8c9235a8198420c7f4e9','status':'BUILT_PENDING_QA','files':files,'totalSourceBytes':sum(x['bytes'] for x in files.values()),'densityDimensionsDesktop':[320,192,256],'densityDimensionsMobile':[192,112,160],'noiseDimensions':[96,96,96],'sourceSizeLimitBytes':None,'storedImageAssets':0,'visualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'fullFluidSolverImplemented':False,'liveWeatherConnected':False,'largeWorldStreamingImplemented':False,'userHardwarePerformanceVerified':False}
(ROOT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False))
