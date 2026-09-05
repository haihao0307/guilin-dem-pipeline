#!/usr/bin/env python3
"""Apply bounded R018.9 runtime corrections. Never rewrite the original deep HTML."""
import argparse,hashlib,json,re
from pathlib import Path

EXPECTED='7eef3bc029d19fb6fe81c8f65a97a4fa40470cac57c1f86b3f1f1f89af8aa5de'
def digest(b): return hashlib.sha256(b).hexdigest()
def function(s,name):
    m=re.search(r'(?:float|vec3|function)\s+'+name+r'\([^)]*\)\s*\{',s)
    if not m: raise ValueError(name+' missing')
    pos=m.end();depth=1
    while depth:
        if s[pos]=='{':depth+=1
        elif s[pos]=='}':depth-=1
        pos+=1
    return s[m.start():pos]
def build(src,dst,report):
    raw=src.read_bytes();assert digest(raw)==EXPECTED,'R018.9 baseline changed'
    s=raw.decode();baseline=s
    deep_pattern=r'const ORIGINAL_DEEP_HTML=("(?:\\.|[^"\\])*");'
    deep_before=re.search(deep_pattern,s)[1]
    split=s.index(';',re.search(deep_pattern,s).end()-1)+1
    prefix,s=s[:split],s[split:]
    def sub(a,b):
        nonlocal s
        assert s.count(a)==1,(a[:80],s.count(a))
        s=s.replace(a,b,1)
    sub('float b=breakerBand(p,float(i),t,front);','float b=breakerBandAt(p,sd,float(i),t,front);')
    sub('float band=breakerBand(p,float(i),t,front);','float band=breakerBandAt(p,sd,float(i),t,front);')
    sub('float breakerBand(vec2 p,float layer,float t,out float front){\n  float sd=shoreDistance(p);','float breakerBandAt(vec2 p,float sd,float layer,float t,out float front){')
    sub('float waterHeight(vec2 p){\n  float t=uTime;\n  float sd=shoreDistance(p);','float breakerBand(vec2 p,float layer,float t,out float front){return breakerBandAt(p,shoreDistance(p),layer,t,front);}\nfloat waterHeightAt(vec2 p,float sd){\n  float t=uTime;')
    sub('float foamFilament(vec2 p,','float waterHeight(vec2 p){return waterHeightAt(p,shoreDistance(p));}\nfloat foamFilament(vec2 p,')
    sub('vec2 q=rot2(turn)*(p-c)/r;\n  float superD=', 'vec2 q=rot2(turn)*(p-c)/r;\n  if(any(greaterThanEqual(abs(q),vec2(1.))))return 0.;\n  float superD=')
    sub('float curlDensity(vec3 p){\n  if(!flag(4))return 0.;\n  float den=0.;', '''float curlDensity(vec3 p){
  if(!flag(4))return 0.;
  float maxWave=.80*abs(uWaves.x)+2.70*abs(uWaves.z)*(1.03+.45*abs(uWaves.w));
  if(abs(p.y)>maxWave+1.95)return 0.;
  float sd=shoreDistance(p.xz);
  if(sd<=-1.5||sd>=37.)return 0.;
  float localY=p.y-waterHeightAt(p.xz,sd);
  if(localY<=-.12||localY>=1.92)return 0.;
  float den=0.;''')
    sub('float band=breakerBand(p.xz,float(i),uTime,front);\n    float localY=p.y-waterHeight(p.xz);', 'float band=breakerBandAt(p.xz,sd,float(i),uTime,front);')
    sub('float sprayDensity(vec3 p){\n  if(!flag(16))return 0.;', 'float sprayDensity(vec3 p){\n  if(!flag(16)||p.y<=-.15)return 0.;')
    sub('for(int i=0;i<STEPS;i++){\n    float fi=', 'for(int i=0;i<STEPS;i++){\n    if(mediaSpan<=0.)break;\n    float fi=')
    sub("let renderMode=0,paused=false,time=0,last=performance.now()", "let submittedFrames=0,completedFrames=0,pendingFence=null;\nlet renderMode=0,paused=false,time=0,last=0")
    sub("function draw(now){if(activeZone==='deep'){last=now;requestAnimationFrame(draw);return;}const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)time+=dt;resize();uniforms();gl.drawArrays(gl.TRIANGLES,0,6);fpsFrames++;", '''function draw(now){
requestAnimationFrame(draw);
if(pendingFence){const result=gl.clientWaitSync(pendingFence,0,0);if(result===gl.TIMEOUT_EXPIRED)return;if(result===gl.WAIT_FAILED){runtimeFail('海水帧同步失败，请重新载入');return;}gl.deleteSync(pendingFence);pendingFence=null;completedFrames++;if(window.__OCEAN_QA__){window.__OCEAN_QA__.completedFrames=completedFrames;window.__OCEAN_QA__.ready=true;}}
if(gl.isContextLost()||runtimeError)return;
if(activeZone==='deep'||document.hidden){last=0;return;}
const dt=last===0?0:Math.min(.10,Math.max(0,(now-last)/1000));last=now;
if(!paused)time+=dt;resize();uniforms();gl.drawArrays(gl.TRIANGLES,0,6);
submittedFrames++;pendingFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();fpsFrames++;
''')
    sub('window.__OCEAN_QA__={ready:true,time,paused,fps,renderScale,','window.__OCEAN_QA__={ready:completedFrames>0,submittedFrames,completedFrames,time,paused,fps,renderScale,')
    sub("deepModel:'frozen Ocean Mother V001'};requestAnimationFrame(draw);}","deepModel:'frozen Ocean Mother V001',error:runtimeError,camera:camera(),parameters:{...params}};}")
    sub("version:'0.3.9-island-r018-wave-refinement-lazy-deep'", "version:'0.3.10-island-r018-runtime-repair'")
    sub("buildId:'island-r018-wave-refinement-lazy-v001-deep'", "buildId:'r01810-clock-completion-zone-repair'")
    sub("const canvas=document.getElementById('ocean');",'''const canvas=document.getElementById('ocean');
let runtimeError=null;
function runtimeFail(message){runtimeError=String(message);const box=document.getElementById('fallback');box.classList.add('show');box.textContent='海洋运行中断：'+runtimeError+'。请重新打开页面。';document.getElementById('loading').classList.add('done');if(window.__OCEAN_QA__){window.__OCEAN_QA__.error=runtimeError;window.__OCEAN_QA__.ready=false;}}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();runtimeFail('WebGL 上下文丢失');});
window.addEventListener('error',e=>runtimeFail(e.message));''')
    sub("let deepDocumentReady=false;", "let deepDocumentReady=false,deepPausedChoice=false,deepPoll=null;")
    sub("function ensureDeepLoaded(){if(deepLoaded)return;deepLoaded=true;document.body.classList.remove('deep-ready');deepFrame.srcdoc=ORIGINAL_DEEP_HTML;}", '''function ensureDeepLoaded(){
if(deepLoaded)return;deepLoaded=true;document.body.classList.remove('deep-ready');
deepFrame.srcdoc=ORIGINAL_DEEP_HTML;
deepPoll=setInterval(()=>{try{
const q=deepFrame.contentWindow?.OceanMother?.qa;
if(q?.errors?.length){document.querySelector('#deepLoading strong').textContent='原版深海载入失败';document.querySelector('#deepLoading span').textContent=q.errors[0];clearInterval(deepPoll);return;}
if(q?.ready&&q.completedFrames>0){deepDocumentReady=true;window.__OCEAN_DEEP_READY__=true;document.body.classList.toggle('deep-ready',activeZone==='deep');innerDeepPause(activeZone!=='deep'||deepPausedChoice);clearInterval(deepPoll);}
}catch(e){document.querySelector('#deepLoading span').textContent=String(e.message);}},200);
}''')
    sub("  activeZone=zone==='deep'?'deep':'island';", '''  const next=zone==='deep'?'deep':'island';
  if(activeZone==='deep'&&next!=='deep'&&deepDocumentReady){deepPausedChoice=(deepFrame.contentDocument?.getElementById('pause')?.textContent||'').includes('继续');}
  activeZone=next;''')
    sub("if(deep)innerDeepPause(false);else if(deepLoaded)innerDeepPause(true);", "if(deep&&deepDocumentReady)innerDeepPause(deepPausedChoice);else if(!deep&&deepLoaded)innerDeepPause(true);")
    sub("if(!deep){last=performance.now();setView('overview');}window.__OCEAN_ZONE__=activeZone;", "last=0;window.__OCEAN_ZONE__=activeZone;")
    sub("deepFrame.addEventListener('load',()=>{deepDocumentReady=true;window.__OCEAN_DEEP_READY__=!!deepFrame.contentWindow?.OceanMother;if(activeZone==='deep')document.body.classList.add('deep-ready');});", "deepFrame.addEventListener('load',()=>{window.__OCEAN_DEEP_READY__=false;});")
    sub("paused=!paused;document.getElementById('pause')", "paused=!paused;last=0;document.getElementById('pause')")
    page=prefix+s
    page=page.replace('R018.9 海岛近岸水体修正版','R018.10 海岛近岸运行修正版').replace('ISLAND GOLD COAST / R018.9','ISLAND GOLD COAST / R018.10').replace('R018.9 · 近岸水体修正版','R018.10 · 运行修正版')
    deep_after=re.search(deep_pattern,page)[1];assert deep_before==deep_after
    frozen=['terrainHeight','rockField','smokeDensityAt','shadeTerrain','setView']
    locks={}
    for n in frozen:
        a=function(baseline,n);b=function(page,n);assert a==b,n+' changed';locks[n]=digest(a.encode())
    dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(page,encoding='utf-8')
    out={'format':'ocean-r01810-bounded-runtime-repair','sourceSha256':EXPECTED,'outputSha256':digest(dst.read_bytes()),'originalDeepEmbeddedSourceSha256':digest(deep_after.encode()),'originalDeepBytesUnchanged':True,'frozenFunctions':locks,'changes':['nonnegative frame delta','GPU completion readiness','reuse identical shoreline and curl calculations','preserve nearshore camera across deep switch','independent deep pause state','wait for actual original deep frame'],'browserVerified':False,'visualApproved':False,'productionApproved':False}
    report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(out,ensure_ascii=False,indent=2))
    print(json.dumps(out,ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--report',type=Path,required=True);a=p.parse_args();build(a.source,a.output,a.report)
