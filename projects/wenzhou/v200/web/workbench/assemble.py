"""Versioned Wenzhou-owned adapter; never edits the Weather upstream kernel.
Build requires exact acquired sources and emits a research workbench only.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,sys,zipfile

def sha(b):return hashlib.sha256(b).hexdigest()
def replace(s,a,b):
    if s.count(a)!=1:raise ValueError(('patch source mismatch',a,s.count(a)))
    return s.replace(a,b)

def patch(root):
    p=root/'runtime.js';s=p.read_text()
    s=replace(s,"function wave(x,z){return .14*Math.sin(x*.023+z*.019-S.physicalTime*.9)+.06*Math.sin(-x*.037+z*.031-S.physicalTime*.6);}","""function env(){return S.mode===3&&S.weatherFrame?S.weatherFrame:null;}
function seaParams(){let e=env();if(!e)return{dir:[1,0],amplitude:1,time:S.physicalTime};return{dir:[e.wind.directionENU[0],e.wind.directionENU[2]],amplitude:.18+Math.min(e.wind.speedMps,40)/12,time:e.clock.simulationSeconds};}
function wave(x,z){let p=seaParams(),X=x*p.dir[0]+z*p.dir[1],Z=-x*p.dir[1]+z*p.dir[0];return p.amplitude*(.14*Math.sin(X*.023+Z*.019-p.time*.9)+.06*Math.sin(-X*.037+Z*.031-p.time*.6));}
function applyWeatherFrame(frame){if(!frame){if(S.weatherFrame)record('weatherDisconnected',true);S.weatherFrame=null;return;}
if(frame.schema!=='wenzhou-weather-frame-1'||frame.sourceRuntimeVersion!=='1.1.0-hq'||!Number.isFinite(frame.clock?.simulationSeconds)||!Number.isFinite(frame.wind?.speedMps)||frame.wind.speedMps<0||frame.wind.speedMps>80)throw Error('WEATHER_FRAME_CONTRACT');
for(let a of[frame.wind.directionENU,frame.solar?.directionENU,frame.solar?.colorLinear])if(!Array.isArray(a)||a.length!==3||a.some(x=>!Number.isFinite(x)))throw Error('WEATHER_VECTOR_CONTRACT');
if(Math.abs(Math.hypot(...frame.wind.directionENU)-1)>1e-5)throw Error('WEATHER_WIND_NORMALIZATION');
if(!S.weatherFrame||frame.clock.discontinuity||Math.abs(frame.wind.speedMps-S.weatherFrame.wind.speedMps)>1||frame.identity.weather!==S.weatherFrame.identity.weather)record('weatherExchange',{source:frame.identity,clock:frame.clock.simulationSeconds,windMps:frame.wind.speedMps});
S.weatherFrame=structuredClone(frame);S.weatherExchanges=(S.weatherExchanges||0)+1;
if(S.history.length>4096)S.history.shift();}
""")
    s=replace(s,"g.uniform3fv(S.u.uLights,S.lights);", """g.uniform3fv(S.u.uLights,S.lights);let sea=seaParams(),e=env();g.uniform2fv(S.u.uWaveDir,sea.dir);g.uniform1f(S.u.uWaveAmplitude,sea.amplitude);g.uniform1f(S.u.uWaveTime,sea.time);g.uniform3fv(S.u.uSun,e?.solar.directionENU||[-.6,.35,-.7]);g.uniform3fv(S.u.uSunColor,e?.solar.colorLinear||[1,1,1]);g.uniform3fv(S.u.uAtmosphere,[e?.solar.day??1,e?.solar.directMultiplier??1,e?.solar.skyMultiplier??1]);""")
    s=replace(s,"['neutral','studio','diagnostic'][S.mode]", "['neutral','studio','diagnostic','environment'][S.mode]")
    s=replace(s,"historyCount:S.history.length,imageRequests:", "historyCount:S.history.length,weather:{connected:!!S.weatherFrame,active:!!env(),exchangeCount:S.weatherExchanges||0,upstreamTimeS:S.weatherFrame?.clock.simulationSeconds??null,windMps:S.weatherFrame?.wind.speedMps??null,windDirection:S.weatherFrame?.wind.directionENU??null,sharedDepth:false,calibrated:false},waveState:seaParams(),imageRequests:")
    s=replace(s,"'uEye','uLights','uMud']", "'uEye','uLights','uMud','uWaveDir','uWaveAmplitude','uWaveTime','uSun','uSunColor','uAtmosphere']")
    s=replace(s,"history:()=>structuredClone(S.history),surface}", "history:()=>structuredClone(S.history),surface,applyWeatherFrame,setMode:id=>{let button=document.querySelector(`[data-mode=\"${id}\"]`);if(!button)throw Error('Unknown mode');button.click();},getWindWaveAt:(x,z)=>wave(x,z)}")
    p.write_text(s)
    p=root/'shaders.js';s=p.read_text()
    s=replace(s,"uniform mat4 uVP;uniform float uTime,uTide,uLogFar;", "uniform mat4 uVP;uniform float uTime,uTide,uLogFar,uWaveAmplitude,uWaveTime;uniform vec2 uWaveDir;")
    s=replace(s,"float w=.14*sin(p.x*.023+p.z*.019-uTime*.9)+.06*sin(-p.x*.037+p.z*.031-uTime*.6);", "vec2 q=vec2(dot(p.xz,uWaveDir),dot(p.xz,vec2(-uWaveDir.y,uWaveDir.x)));float w=uWaveAmplitude*(.14*sin(q.x*.023+q.y*.019-uWaveTime*.9)+.06*sin(-q.x*.037+q.y*.031-uWaveTime*.6));")
    s=replace(s,"uniform int uLayer,uMode,uIslandCount;", "uniform vec2 uWaveDir;uniform float uWaveAmplitude,uWaveTime;uniform vec3 uSun,uSunColor,uAtmosphere;uniform int uLayer,uMode,uIslandCount;")
    s=replace(s,"c*=lit*(.92+.13*b);", "if(uMode==3)lit=vec3(.13+.30*uAtmosphere.z*uAtmosphere.x)+uSunColor*uAtmosphere.y*uAtmosphere.x*max(dot(n,normalize(uSun)),0.);c*=lit*(.92+.13*b);")
    s=replace(s,"c=mix(c,vec3(.49,.66,.70),fres*.2);", """c=mix(c,vec3(.49,.66,.70),fres*.2);if(uMode==3){vec2 wdir=vec2(-uWaveDir.y,uWaveDir.x);vec2 aq=vec2(dot(p,uWaveDir),dot(p,wdir));float r1=aq.x*.023+aq.y*.019-uWaveTime*.9,r2=-aq.x*.037+aq.y*.031-uWaveTime*.6;vec2 grad=uWaveAmplitude*(.14*cos(r1)*vec2(.023,.019)+.06*cos(r2)*vec2(-.037,.031));vec3 wn=normalize(vec3(-(uWaveDir.x*grad.x+wdir.x*grad.y),1.,-(uWaveDir.y*grad.x+wdir.y*grad.y)));float sunGlow=pow(max(dot(reflect(-normalize(uSun),wn),normalize(uEye-vP)),0.),96.);c*=.32+.68*uAtmosphere.x;c+=uSunColor*uAtmosphere.x*min(.45,sunGlow*.35)*uAtmosphere.y;float drift=fbm(vec2(aq.x*.0006-uWaveTime*.0009,aq.y*.0018));c*=.94+.12*drift*min(uWaveAmplitude,2.);}""")
    p.write_text(s)
    p=root/'index.html';s=p.read_text()
    s=replace(s,'<button data-mode="diagnostic">诊断</button>','<button data-mode="diagnostic">诊断</button><button data-mode="environment">天气联动</button>')
    s=s.replace('Mother V1.0.0：部分展示与状态接口；完整规则接入仍待验证。','天气联动：风向、风力、演示时间与解析日光接入；云影与深度合成尚未实现。Mother V1.0.0 完整规则接入待验证。')
    p.write_text(s)

def main(inputs,implementation,out):
    weather=inputs/'weather/Weather_Mother_Full_Clean_V1.1.0'
    archive=inputs/'Weather_Mother_Full_Clean_V1.1.0.zip'
    assert sha(archive.read_bytes())=='ac1cd919b007eff60f2288106ca32cb8ff7f96ea8e02e52cec16d8045bb6ae6e'
    with zipfile.ZipFile(archive) as z:assert z.testzip() is None
    manifest=json.loads((weather/'MANIFEST.json').read_text());assert sha((weather/'MANIFEST.json').read_bytes())=='a4a09dc8096b93f940381efcad2bddd021ed73010e268c24b563bf9f3a721a5b'
    for name,item in manifest['files'].items():
        b=(weather/name).read_bytes();assert sha(b)==item['sha256'] and len(b)==item['bytes'],name
    src=inputs/'wenzhou-full-source';shutil.copyfile(inputs/'wenzhou-vectors.json.gz',src/'data/vectors.json.gz')
    subprocess.run([sys.executable,str(src/'build.py'),str(src),str(out/'terrain')],check=True)
    patch(out/'terrain')
    dest=out/'modules/weather-mother';dest.mkdir(parents=True,exist_ok=True)
    for f in weather.iterdir():
        if f.is_file():shutil.copyfile(f,dest/f.name)
    for name in ['index.html','workbench.js','weather-bridge.mjs']:
        shutil.copyfile(implementation/name,out/name)
    files={p.relative_to(out).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(out.rglob('*')) if p.is_file() and p.name not in ['BUILD.json','PUBLIC_QA.json']}
    build={'version':'wenzhou-workbench-0.1.0-weather110','sourceCommit':__import__('os').environ.get('GITHUB_SHA','local-unpublished'),'weatherReadRef':'fa69b5c7fed1a71339127776d0f3e44f9152c5a0','weatherZipSha256':sha(archive.read_bytes()),'attachmentBytesCompared':False,'weatherKernelModified':False,'mapOverviewSpacingM':800,'sourceNativeSpacingM':12.5,'wholeDomain':True,'fullNativeOnline':False,'sourceDeleted':False,'noPersistedImageAssets':True,'sharedWebGLDepth':False,'weatherCoupling':['base-wind-direction','base-wind-speed','upstream-demonstration-clock','derived-renderer-daylight'],'calibratedWeatherOrHydrodynamics':False,'visualApproved':False,'productionApproved':False,'files':files}
    (out/'BUILD.json').write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'fileCount':len(files),'runtimeWeatherUnchanged':True,'wholeMapGrid':[276,281]},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('inputs',type=Path);p.add_argument('implementation',type=Path);p.add_argument('out',type=Path);a=p.parse_args();main(a.inputs,a.implementation,a.out)
