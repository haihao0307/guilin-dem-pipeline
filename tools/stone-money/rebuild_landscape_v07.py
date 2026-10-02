#!/usr/bin/env python3
"""V07: keep G3T3 mathematics; move repeatable production work out of page startup.
No simplification, quantization, substitute geometry, iframe or CDN worker at startup.
"""
from pathlib import Path
import json,re,subprocess,sys,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'workbenches/landscape-terrain-influence-tool-v07'
PIN='fbaa49e0e0ef076bb72734a9b48862dcd57329e1'
def source(path):
    return subprocess.check_output(['git','show',PIN+':'+path],cwd=ROOT).decode('utf-8')
def script(s,name):
    return re.search(r'<script[^>]*id=[\"\']'+name+r'[\"\'][^>]*>(.*?)</script>',s,re.S).group(1)

CODEC=r'''
function encodeBlock(a,stride,index=false){
 const n=a.length,u=new Uint32Array(a.buffer,a.byteOffset,n),out=new Uint8Array(n*4);let k=0;
 for(let c=0;c<stride;c++){let prev=0;for(let i=c;i<n;i+=stride){let next=u[i],x=index?(next-prev)>>>0:(next^prev)>>>0;out[k]=x;out[k+n]=x>>>8;out[k+n*2]=x>>>16;out[k+n*3]=x>>>24;prev=next;k++;}}
 return out;
}
function decodeBlock(b,count,stride,index=false){
 const u=new Uint32Array(count);let k=0;
 for(let c=0;c<stride;c++){let prev=0;for(let i=c;i<count;i+=stride){let x=(b[k]|b[k+count]<<8|b[k+count*2]<<16|b[k+count*3]<<24)>>>0;let next=index?(prev+x)>>>0:(prev^x)>>>0;u[i]=next;prev=next;k++;}}
 return index?u:new Float32Array(u.buffer);
}
function packData(data,encoded=true){
 let blocks=[],offset=0;const meta={report:data.report,parts:data.parts.map(p=>{
  const v=encoded?encodeBlock(p.vertices,p.stride||16):new Uint8Array(p.vertices.buffer,p.vertices.byteOffset,p.vertices.byteLength);
  const i=encoded?encodeBlock(p.indices,1,true):new Uint8Array(p.indices.buffer,p.indices.byteOffset,p.indices.byteLength);
  const out={...p,vertices:undefined,indices:undefined,vo:offset,vc:p.vertices.length,io:offset+v.byteLength,ic:p.indices.length};blocks.push(v,i);offset+=v.byteLength+i.byteLength;return out;
 })};
 const h=new TextEncoder().encode(JSON.stringify(meta)),pad=(4-h.length%4)%4,total=8+h.length+pad+offset,o=new Uint8Array(total);o.set(new TextEncoder().encode(encoded?'LM7X':'LM7R'));new DataView(o.buffer).setUint32(4,h.length,true);o.set(h,8);let pos=8+h.length+pad;for(let b of blocks){o.set(b,pos);pos+=b.length;}return o;
}
function unpackData(buffer){
 const b=new Uint8Array(buffer),h=new DataView(buffer).getUint32(4,true),m=JSON.parse(new TextDecoder().decode(b.subarray(8,8+h))),base=8+h+(4-h%4)%4,encoded=b[3]===88;
 for(let p of m.parts){p.vertices=encoded?decodeBlock(b.subarray(base+p.vo,base+p.vo+p.vc*4),p.vc,p.stride||16):new Float32Array(buffer,base+p.vo,p.vc);p.indices=encoded?decodeBlock(b.subarray(base+p.io,base+p.io+p.ic*4),p.ic,1,true):new Uint32Array(buffer,base+p.io,p.ic);}
 return m;
}
async function inflateResponse(response){if(!response.ok)throw Error('HTTP '+response.status+' '+response.url);const raw=await response.arrayBuffer();if(new Uint8Array(raw)[0]!==31)return raw;return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
'''

BAKER=r'''
function createBaker(gl,vs){
 function sh(t,s){let x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;}
 const prog=gl.createProgram();let v=vs.replace('void main(){','out vec3 rawN;\nuniform bool uInputBaked;\nvoid main(){rawN=aN;').replace('vec3 local=aP,localN=aN;', 'vec3 local=(uInputBaked&&(aD.x<.5||(aD.x>2.5&&aD.x<3.5)))?aRest:aP,localN=aN;');
 gl.attachShader(prog,sh(gl.VERTEX_SHADER,v));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(0);}'));
 gl.transformFeedbackVaryings(prog,['p','n0','q','d','e','bmQ','bmData','rawN'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 const uniforms={};for(const k of ['Scope','ShellScale','ShellContrast','ShellCoverage','ShellDirection','ShellWarp','ShellBreakup','GroundMicro','HeightScale','WidthScale','OverallScale','PalauSeed'])uniforms[k]=gl.getUniformLocation(prog,'u'+k);
 const input=gl.getUniformLocation(prog,'uInputBaked'),vp=gl.getUniformLocation(prog,'uVP');
 return async function bake(data,view,recipe,progress=()=>{},cancel=()=>false){
  const result={report:data.report,parts:[]};let done=0,total=data.parts.reduce((s,p)=>s+p.vertices.length/(p.stride||16),0);
  for(let part of data.parts){
   if(cancel())throw new DOMException('Cancelled','AbortError');
   let stride=part.stride||16,count=part.vertices.length/stride,output=new Float32Array(count*25),vao=gl.createVertexArray(),ib=gl.createBuffer(),ob=gl.createBuffer(),tf=gl.createTransformFeedback();
   gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,ib);gl.bufferData(gl.ARRAY_BUFFER,part.vertices,gl.STATIC_DRAW);
   let offs=stride===25?[0,22,6,9,13]:stride===13?[0,3,0,6,10]:[0,3,6,9,13];
   [3,3,3,4,3].forEach((n,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,stride*4,offs[i]*4);});
   gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,ob);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,Math.min(count,4096)*25*4,gl.STREAM_READ);
   for(let start=0;start<count;start+=4096){
    if(cancel())throw new DOMException('Cancelled','AbortError');let n=Math.min(4096,count-start);
    gl.useProgram(prog);gl.uniformMatrix4fv(vp,false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));gl.uniform1i(input,stride===25?1:0);
    for(let [k,u] of Object.entries(uniforms)){let val=['HeightScale','WidthScale','OverallScale'].includes(k)?1:k==='GroundMicro'?recipe.soilMicro:k==='PalauSeed'?recipe.seed:view[k[0].toLowerCase()+k.slice(1)];gl.uniform1f(u,val);}
    gl.bindVertexArray(vao);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,ob);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,start,n);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,ob);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,output,start*25,n*25);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindVertexArray(null);
    done+=n;progress(done/total);await new Promise(r=>setTimeout(r,0));
   }
   gl.deleteTransformFeedback(tf);gl.deleteVertexArray(vao);gl.deleteBuffer(ib);gl.deleteBuffer(ob);
   result.parts.push({...part,stride:25,vertices:output});
  }
  return result;
 };
}
'''

FAST_VS=r'''#version 300 es
precision highp float;
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aRest;layout(location=3)in vec4 aD;layout(location=4)in vec3 aE;layout(location=5)in vec3 aBQ;layout(location=6)in vec3 aBD;
uniform mat4 uVP;uniform float uHeightScale,uWidthScale,uOverallScale;
out vec3 p;out vec3 n0;out vec3 q;out vec4 d;out vec3 e;out vec3 bmQ;out vec3 bmData;
void main(){p=aP;n0=aN;if(aD.x<.5){float ws=max(.12,uWidthScale*uOverallScale),hs=max(.12,uHeightScale*uOverallScale),baseY=-5.20;p=vec3(p.x*ws,baseY+(p.y-baseY)*hs,p.z*ws);n0=normalize(vec3(n0.x/ws,n0.y/hs,n0.z/ws));}q=aRest;d=aD;e=aE;bmQ=aBQ;bmData=aBD;gl_Position=uVP*vec4(p,1.);}
'''

RUNTIME=r'''
let manifestPromise=null,activeData=null,bakeEngine=null,baking=false,shellStamp='',refreshTimer=null;
let timings={startupAt:performance.now(),loads:[],firstFrameMs:null};
const shapeKeys=['scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup'];
const stamp=()=>JSON.stringify(shapeKeys.map(k=>state[k]).concat(recipe.soilMicro,recipe.seed));
function progressMessage(text,p){$('#step').textContent=text;$('#progress').style.width=Math.round(p*100)+'%';const s=$('#ltiStatus');if(s)s.textContent=text;}
function errorText(e){return e?.stack||e?.message||[e?.type,e?.filename,e?.lineno].filter(Boolean).join(' ')||String(e);}
async function getManifest(){return manifestPromise||(manifestPromise=fetch('./manifest.json').then(r=>{if(!r.ok)throw Error('清单 HTTP '+r.status);return r.json();}));}
function recipeEqual(a,b){return Object.keys(a).every(k=>a[k]===b[k])&&Object.keys(a).length===Object.keys(b).length;}
async function completeFrame(){
 dirty=true;draw();gl.flush();const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),start=performance.now();gl.flush();
 await new Promise((resolve,reject)=>{function check(){let s=gl.clientWaitSync(fence,0,0);if(s===gl.WAIT_FAILED){gl.deleteSync(fence);reject(Error('GPU 完成检测失败'));return;}if(s===gl.CONDITION_SATISFIED||s===gl.ALREADY_SIGNALED){gl.deleteSync(fence);requestAnimationFrame(()=>requestAnimationFrame(resolve));return;}if(performance.now()-start>30000){gl.deleteSync(fence);reject(Error('首帧超过 30 秒，已停止；未降低地形精度'));return;}setTimeout(check,16);}check();});
}
async function build(newRecipe){
 if(!newRecipe||newRecipe.schema!=='landscape-function-world/1'||newRecipe.core!=='limestone-water-2')throw Error('配方版本不匹配');
 if(!Number.isInteger(newRecipe.stage)||newRecipe.stage<0||newRecipe.stage>4||!Number.isInteger(newRecipe.seed)||newRecipe.seed<1||newRecipe.seed>99999)throw Error('阶段或种子无效');
 for(let k of ['fracture','relief','geo','concavity','spikeGuard','soilMicro'])if(!Number.isFinite(newRecipe[k]))throw Error('非法参数 '+k);
 let id=++epoch,start=performance.now();worker?.terminate();worker=null;recipe={...newRecipe};busy=true;window.__LM_READY__=false;window.__LM_ERROR__=null;sync();$('#error').textContent='';$('#nextseed').disabled=true;
 if(!activeData)$('#loading').classList.remove('hidden');progressMessage('读取原函数生成的完整数据',.05);
 try{
  const manifest=await getManifest(),entry=manifest.entries.find(e=>recipeEqual(e.recipe,recipe));let data;
  if(entry){
   const response=await fetch('./'+entry.file);const bytes=await inflateResponse(response);progressMessage('无损还原完整地形',.65);data=unpackData(bytes);
   const match=shapeKeys.every(k=>Math.abs(state[k]-entry.view[k])<1e-8);
   if(!match){bakeEngine=bakeEngine||createBaker(gl,EXPENSIVE_VS);baking=true;data=await bakeEngine(data,state,recipe,p=>progressMessage('更新真实表面 '+Math.round(p*100)+'%',p),()=>id!==epoch);baking=false;}
  }else{
   progressMessage('自定义配方：生产计算中，保留当前画面',.02);
   const raw=await new Promise((resolve,reject)=>{const w=worker=new Worker('./generator.js');w.onerror=e=>reject(Error('生成器启动失败：'+errorText(e)));w.onmessage=e=>{if(id!==epoch){w.terminate();reject(new DOMException('Cancelled','AbortError'));return;}if(e.data.error){reject(Error(e.data.error));return;}if(e.data.data){resolve(e.data.data);w.terminate();worker=null;}else if(e.data.p!==undefined)progressMessage(e.data.text,e.data.p);};w.postMessage(recipe);});
   bakeEngine=bakeEngine||createBaker(gl,EXPENSIVE_VS);baking=true;data=await bakeEngine(raw,state,recipe,p=>progressMessage('计算固定表面 '+Math.round(p*100)+'%',p),()=>id!==epoch);baking=false;
  }
  if(id!==epoch)return;activeData=data;shellStamp=stamp();upload(data);busy=false;progressMessage('等待实际首帧',.95);await completeFrame();
  if(id!==epoch)return;$('#loading').classList.add('hidden');$('#nextseed').disabled=false;$('#nextseed').textContent='换种子';window.__LM_READY__=true;
  document.documentElement.dataset.landscapeGenerationReady='true';document.documentElement.dataset.landscapeWorkerMode=entry?'prebuilt-lossless-no-worker':'custom-worker';
  timings.loads.push({preset:state.palauPreset,loadToFrameMs:performance.now()-start,cache:!!entry,triangles:report.parts.reduce((s,p)=>s+p.triangles,0)});if(timings.firstFrameMs===null)timings.firstFrameMs=performance.now()-timings.startupAt;
  $('#status').textContent='原函数完整形体 · '+Math.round(report.parts.reduce((s,p)=>s+p.triangles,0)/1000)+'k 面 · 无减面';progressMessage('地形已显示 · 可旋转和切换',1);return report;
 }catch(e){baking=false;busy=false;if(e.name==='AbortError')return;fail(e);$('#nextseed').disabled=false;throw e;}
}
function requestSurfaceRefresh(){
 if(baking||busy||!activeData||stamp()===shellStamp)return;
 clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(busy||baking||stamp()===shellStamp)return;let id=epoch,target=stamp();baking=true;progressMessage('更新真实表面，当前画面保留',.05);try{bakeEngine=bakeEngine||createBaker(gl,EXPENSIVE_VS);let next=await bakeEngine(activeData,state,recipe,p=>progressMessage('真实表面 '+Math.round(p*100)+'%',p),()=>id!==epoch);if(id===epoch){activeData=next;upload(next);shellStamp=target;dirty=true;}}catch(e){if(e.name!=='AbortError')fail(e);}finally{baking=false;if(id===epoch)progressMessage('地形已显示 · 可旋转和切换',1);}},180);
}
'''

NODE_BUILD=r'''
const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),crypto=require('crypto'),path=require('path');
const root=__dirname;global.self={};vm.runInThisContext(fs.readFileSync(root+'/generator.js','utf8'));
const entries=JSON.parse(fs.readFileSync(root+'/entries.json','utf8'));
fs.mkdirSync(root+'/raw',{recursive:true});
for(let entry of entries){
 const start=Date.now(),data=generateScene(entry.recipe,()=>{});const raw=packData(data,false);fs.writeFileSync(root+'/raw/'+entry.id+'.lmc',zlib.gzipSync(raw,{level:1}));
 const hash=crypto.createHash('sha256');for(let p of data.parts){hash.update(Buffer.from(p.vertices.buffer));hash.update(Buffer.from(p.indices.buffer));}
 entry.originalBuffersSha256=hash.digest('hex');entry.originalSignatures=data.report.parts.map(p=>p.signature);entry.triangles=data.report.parts.reduce((s,p)=>s+p.triangles,0);entry.generatedMs=Date.now()-start;
 console.log(JSON.stringify({id:entry.id,triangles:entry.triangles,generatedMs:entry.generatedMs}));
}
fs.writeFileSync(root+'/entries.json',JSON.stringify(entries,null,2));
'''

BAKE_PAGE=r'''
<!doctype html><meta charset="utf-8"><canvas id="c" width="1" height="1"></canvas><script>
__CODEC__
const EXPENSIVE_VS=__VS__;
__BAKER__
const gl=document.getElementById('c').getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('No WebGL2 for production bake');
const bake=createBaker(gl,EXPENSIVE_VS);
window.bakeEntry=async function(entry){const data=unpackData(await inflateResponse(await fetch('./raw/'+entry.id+'.lmc')));const out=await bake(data,entry.view,entry.recipe);const bytes=packData(out,true);let r=await fetch('/__save/'+entry.id,{method:'POST',body:bytes});if(!r.ok)throw Error('Save failed');return {id:entry.id,bytes:bytes.length,glError:gl.getError()};};
</script>
'''

BAKE_PY=r'''
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
import threading,json,gzip,os,hashlib,shutil,time
root=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(root),**k)
 def log_message(self,*a):pass
 def do_POST(self):
  name=self.path.removeprefix('/__save/')
  if not name.startswith('P') or not name[1:].isdigit():self.send_error(400);return
  data=self.rfile.read(int(self.headers['Content-Length']))
  (root/'cache').mkdir(exist_ok=True);(root/'cache'/f'{name}.lmc').write_bytes(gzip.compress(data,compresslevel=6))
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
srv=ThreadingHTTPServer(('127.0.0.1',8771),Handler);threading.Thread(target=srv.serve_forever,daemon=True).start()
entries=json.loads((root/'entries.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 page=b.new_page();page.set_default_timeout(600000);page.goto('http://127.0.0.1:8771/bake.html')
 for entry in entries:
  t=time.monotonic();result=page.evaluate('e=>bakeEntry(e)',entry);assert result['glError']==0,result
  f=root/'cache'/f"{entry['id']}.lmc";entry['file']='cache/'+f.name;entry['bytes']=f.stat().st_size;entry['sha256']=hashlib.sha256(f.read_bytes()).hexdigest();print(json.dumps({'result':result,'seconds':time.monotonic()-t,'compressedBytes':entry['bytes']}),flush=True)
 b.close()
(root/'manifest.json').write_text(json.dumps({'schema':'LANDSCAPE_ORIGINAL_LOSSLESS_CACHE_V07','sourceCommit':'14fa478ff4545c2c58656bf57ba5326c03492a33','sourcePath':'workbenches/landscape-surface-r5-k2-g3t3-palau-production/index.html','quantization':False,'simplification':False,'fragmentShaderChanged':False,'vertexFieldEvaluatedBeforeRelease':True,'entries':entries},ensure_ascii=False,indent=2))
srv.shutdown()
'''

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 s=source('workbenches/landscape-terrain-influence-tool-v06/index.html')
 worker=source('workbenches/landscape-terrain-influence-tool-v06/landscape-terrain-worker-v06.js')
 # Match source exactly before changing lifecycle. Original kernel is retained.
 assert hashlib.sha256(worker.encode()).hexdigest()=='1b1bee3510c92e2c5ed685391ae0b7ce039f4c2ed9aee5e04ba67d9dc28117d7'
 presets=re.search(r'const PALAU_PRESETS=Object.freeze\((\[.*?\])\);',s,re.S).group(1)
 original_vs=re.search(r'const VS=`(.*?)`;',s,re.S).group(1)
 default_state=re.search(r'let state=(\{.*?\}),gl,',s,re.S).group(1)
 node='const vm=require("vm");const presets=vm.runInNewContext('+json.dumps(presets)+');const view=vm.runInNewContext("("+'+json.dumps(default_state)+'+")");console.log(JSON.stringify({presets,view}));'
 states=json.loads(subprocess.check_output(['node','-e',node]))
 base={'schema':'landscape-function-world/1','core':'limestone-water-2','seed':83,'stage':4,'fracture':1,'relief':1,'geo':1.65,'concavity':.85,'spikeGuard':.95,'soilMicro':.80}
 entries=[]
 for i,p in enumerate(states['presets']):
  recipe={**base,**{k:p[k] for k in ('seed','geo','concavity','soilMicro')}}
  view={**states['view'],**{k:v for k,v in p.items() if k in states['view']},'palauPreset':i}
  entries.append({'id':f'P{i+1:02d}','name':p['name'],'recipe':recipe,'view':view})
 (OUT/'entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
 (OUT/'generator.js').write_text(worker)
 (OUT/'build-caches.cjs').write_text(CODEC+'\n'+NODE_BUILD)
 (OUT/'bake.html').write_text(BAKE_PAGE.replace('__CODEC__',CODEC).replace('__VS__',json.dumps(original_vs)).replace('__BAKER__',BAKER))
 (OUT/'bake-caches.py').write_text(BAKE_PY)
 s=re.sub(r'<script id="landscapeTerrainWorkerBridge">.*?</script>','',s,flags=re.S)
 s=re.sub(r'<script id="landscapeTerrainGenerationMonitor">.*?</script>','',s,flags=re.S)
 s=s.replace('const VS=`','const EXPENSIVE_VS=`',1)
 s=s.replace("'use strict';\n(()=>{",'const VS='+json.dumps(FAST_VS)+';\n'+CODEC+'\n'+BAKER+"\n'use strict';\n(()=>{",1)
 start=s.index('async function build(newRecipe)');end=s.index('function render(t)',start)
 s=s[:start]+RUNTIME+'\n'+s[end:]
 old='[3,3,3,4,3].forEach((n,i)=>{let off=(p.stride===13?[0,3,0,6,10]:[0,3,6,9,13])[i];gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,(p.stride||16)*4,off*4)});'
 new='[3,3,3,4,3,3,3].forEach((n,i)=>{let off=[0,3,6,9,13,16,19][i];gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,25*4,off*4)});'
 assert old in s;s=s.replace(old,new,1)
 s=s.replace('function draw(){if(!dirty||busy)return;','function draw(){if(!dirty||busy||baking)return;requestSurfaceRefresh();',1)
 s=s.replace("errorLog.push(String(e));console.error(e);$('#error').textContent=String(e.message||e);", "errorLog.push(errorText(e));console.error(e);$('#error').textContent=errorText(e);",1)
 s=s.replace('window.__LM_ERROR__=String(e)', 'window.__LM_ERROR__=errorText(e)',1)
 # The old renderer's GLSL and the source arrays remain unchanged in meaning.
 s=s.replace('let recipe='+re.search(r'let recipe=(\{.*?\});',s).group(1)+';','let recipe='+json.dumps(entries[0]['recipe'])+';',1)
 old_state=re.search(r'let state=(\{.*?\}),gl,',s,re.S).group(1)
 s=s.replace('let state='+old_state+',gl,','let state='+json.dumps(entries[0]['view'])+',gl,',1)
 s=s.replace("get renderTimes(){return renderTimes}","get renderTimes(){return renderTimes},get performance(){return timings},get isSurfaceUpdating(){return baking},applyPalauPreset",1)
 s=s.replace('canvas.width=innerWidth;canvas.height=innerHeight;', 'let scale=Math.min(1,Math.sqrt(1600000/(innerWidth*innerHeight)));canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);',1)
 s=s.replace('地形影响工具体系 V0.6','地形影响工具体系 V0.7')
 s=s.replace('同一页面；生成器改用同源静态 Worker，避开在线 CDN 对 blob Worker 的兼容风险。','同一页面。预设在发布前计算，打开时无损读取；保留全部几何、原材质与函数。自定义结构修改才调用生产器。')
 s=s.replace('未携带预展开模型。正在计算结构、土层与表面。','读取原函数的完整生产结果。不减面，不在打开时重复生产。')
 s=s.replace('从函数生成岩体','读取完整地形')
 s=s.replace("'原内核已连接'","'等待地形首帧'")
 s=s.replace('原内核已连接','等待地形首帧')
 # Do not let an overlay claim success merely because its DOM is connected.
 s=s.replace("document.documentElement.dataset.lightscapeToolReady='true';","document.documentElement.dataset.lightscapeToolReady='true';")
 s=s.replace('</head>','<style>#error{white-space:pre-wrap;max-width:680px;word-break:break-word}.lti-sub{font-size:11px!important}#loading{z-index:50}#ltiPanel{max-height:calc(100vh - 145px)}</style></head>',1)
 (OUT/'index.html').write_text(s)
 (OUT/'BUILD_CONTRACT.json').write_text(json.dumps({'version':'V07','source':PIN,'generatorSha256':hashlib.sha256(worker.encode()).hexdigest(),'originalVertexShaderSha256':hashlib.sha256(original_vs.encode()).hexdigest(),'presets':10,'simplification':False,'quantization':False,'startupWorkerRequired':False,'closedR263Modified':False,'lightscapeAdapterComplete':False},indent=2))
 print('Prepared V07 without changing original terrain kernel')
if __name__=='__main__':main()
