#!/usr/bin/env python3
import argparse,json,pathlib,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'status':'running','tests':{},'purpose':'isolate sync progress and first-draw work, not a recovery acceptance pass'}
def save():(out/'sync-microprobe.json').write_text(json.dumps(r,indent=2))
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for mode in ['minimal','warmup','readback-on-first-draw','asynchronous-1px']:
  q=b.new_page(viewport={'width':1000,'height':800});t=time.monotonic();v={};r['tests'][mode]=v
  try:
   if mode=='minimal':
    q.goto('about:blank');v['result']=q.evaluate(r'''async()=>{const c=document.createElement('canvas');c.width=16;c.height=16;document.body.append(c);const g=c.getContext('webgl2'),p=g.createProgram();for(const [type,source] of [[g.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}'],[g.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(.3,.6,.7,1.);}']]){const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);g.attachShader(p,s);}g.linkProgram(p);g.useProgram(p);g.bindVertexArray(g.createVertexArray());const start=performance.now();g.drawArrays(g.TRIANGLES,0,3);const f=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);g.flush();let status,polls=0;do{await new Promise(r=>setTimeout(r,24));status=g.clientWaitSync(f,0,0);polls++;}while(status===g.TIMEOUT_EXPIRED&&performance.now()-start<5000);return {status,polls,elapsedMs:performance.now()-start,error:g.getError(),contextLost:g.isContextLost(),syncValid:g.isSync(f),signaled:status===g.ALREADY_SIGNALED||status===g.CONDITION_SATISFIED};}''')
   else:
    if mode=='asynchronous-1px':
     def unprofile(route):
      response=route.fetch();body=response.text();needle='profileFirstDraw:qaWarmup';assert body.count(needle)==1,'expected exactly one startup profiling switch';route.fulfill(response=response,body=body.replace(needle,'profileFirstDraw:false'))
     q.route('**/gpu-recovery-r01/app.mjs',unprofile)
     q.add_init_script("""window.__SYNC_PROBE__={injectedDiagnostic:true,productionGateUnchanged:true,timeoutMs:60000,readback:false,firstFence:null};const proto=WebGL2RenderingContext.prototype,create=proto.fenceSync,del=proto.deleteSync,wait=proto.clientWaitSync;let retained=null,owner=null;proto.fenceSync=function(...args){const f=create.apply(this,args);if(!retained){retained=f;owner=this;const start=performance.now(),r=window.__SYNC_PROBE__.firstFence={submittedAt:start,polls:0,status:null,signaled:false,deleteDeferred:false};window.__SYNC_PROBE_DONE__=new Promise(resolve=>{const poll=()=>{const g=owner;r.elapsedMs=performance.now()-start;r.contextLost=g.isContextLost();if(!r.contextLost){r.status=wait.call(g,f,0,0);r.polls++;r.signaled=r.status===g.ALREADY_SIGNALED||r.status===g.CONDITION_SATISFIED;}if(r.contextLost||r.signaled||r.status===g.WAIT_FAILED||r.elapsedMs>=60000){r.error=g.getError();r.syncValid=!r.contextLost&&g.isSync(f);r.observationFinished=true;if(r.deleteDeferred&&!r.contextLost)del.call(g,f);resolve(r);}else setTimeout(poll,24);};setTimeout(poll,24);});}return f;};proto.deleteSync=function(f){const r=window.__SYNC_PROBE__.firstFence;if(f===retained&&r&&!r.observationFinished){r.deleteDeferred=true;r.productionDeleteAtMs=performance.now()-r.submittedAt;return;}return del.call(this,f);};""")
    if mode=='readback-on-first-draw':q.add_init_script("""window.__SYNC_PROBE__=[];let first=true;const f=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...a){const start=performance.now();const z=f.apply(this,a);if(first){first=false;const p=new Uint8Array(4);this.readPixels(0,0,1,1,this.RGBA,this.UNSIGNED_BYTE,p);window.__SYNC_PROBE__.push({elapsedMs:performance.now()-start,pixel:[...p],error:this.getError()});}return z;};""")
    q.goto(a.url+('?qa-warmup=1' if mode in ['warmup','asynchronous-1px'] else ''),wait_until='networkidle',timeout=90000);q.wait_for_function('window.__IMPLICIT_BUILDING__?.ready',timeout=90000);v['readyWallSeconds']=time.monotonic()-t
    try:v['settled']=q.evaluate('window.__IMPLICIT_BUILDING__.awaitSettled({timeoutMs:25000})')
    except Exception as e:v['settleError']=str(e)
    if mode=='asynchronous-1px':v['lateFenceObservation']=q.evaluate('window.__SYNC_PROBE_DONE__')
    v['compileProfile']=q.evaluate('window.__IMPLICIT_BUILDING__.snapshot().renderer.compileProfile')
    v['state']=q.evaluate('window.__GPU_RECOVERY__.snapshot()');v['probe']=q.evaluate('window.__SYNC_PROBE__??null');q.screenshot(path=str(out/(mode+'.png')))
   v['completed']=True
  except Exception as e:v['error']=str(e)
  finally:v['wallSeconds']=time.monotonic()-t;save();q.close();print(mode,json.dumps(v),flush=True)
 b.close()
r['status']='complete';save()
