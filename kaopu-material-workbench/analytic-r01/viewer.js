/* KAOPU 04 viewer. Inigo Quilez Analytic Normals 3D (MIT) stays in teacher-source.frag.
   R15 app.js and all 01/02 shaders are unchanged. */
'use strict';
(()=>{
const $=id=>document.getElementById(id),root=$('analyticWorkspace'),canvas=$('analyticCanvas'),nav=$('analyticNav');
const base=new URL('./',document.currentScript.src);let visible=false,ready=false,running=false,dirty=true,time=0,zoom=1,orbit=[0,0],last=0,frames=0,source='',gl=null,program=null,programs={},uniforms={},opening=null;
function status(s){$('analyticStatus').textContent=s;}
function fail(e){$('analyticError').textContent='04 暂未启动：'+e.message;$('analyticError').hidden=false;status('渲染未启动');console.error(e);}
function wrap(s){
 const edits=[['float an = 0.1*iTime;','float an = 0.1*iTime + uOrbit.x;'],['vec3 ro = 3.0*vec3( cos(an), 0.8, sin(an) );','vec3 ro = 3.0*vec3( cos(an), 0.8 + uOrbit.y, sin(an) );'],['p.y*cv + 1.7*cw','p.y*cv + (1.7*uZoom)*cw']];
 for(const [from,to]of edits){if(!s.includes(from))throw Error('老师相机表达式不匹配');s=s.replace(from,to);}
 return '#version 300 es\nprecision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;uniform vec2 uOrbit;uniform float uZoom;out vec4 outputColor;\n#define HW_PERFORMANCE 0\n'+s+'\nvoid main(){mainImage(outputColor,gl_FragCoord.xy);}';
}
function compile(kind,s){const shader=gl.createShader(kind);gl.shaderSource(shader,s);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
async function init(){if(ready)return;if(opening)return opening;opening=(async()=>{
 const r=await fetch(new URL('teacher-source.frag',base),{cache:'no-cache'});if(!r.ok)throw Error('原码 HTTP '+r.status);source=await r.text();
 gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw Error('此浏览器的 WebGL2 尚未启动');
 for(const [key,body] of Object.entries({baseline:'#version 300 es\nprecision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 outputColor;\n#define HW_PERFORMANCE 0\n'+source+'\nvoid main(){mainImage(outputColor,gl_FragCoord.xy);}',viewer:wrap(source)})){
 const p=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'),fs=compile(gl.FRAGMENT_SHADER,body);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.deleteShader(vs);gl.deleteShader(fs);const u={};for(const name of ['iResolution','iTime','iFrame','uOrbit','uZoom'])u[name]=gl.getUniformLocation(p,name);programs[key]={p,u};}gl.bindVertexArray(gl.createVertexArray());ready=true;dirty=true;draw();
 })();try{await opening;}catch(e){opening=null;throw e;}}
function draw(){if(!ready||!visible)return;const native=orbit[0]===0&&orbit[1]===0&&zoom===1;({p:program,u:uniforms}=programs[native?'baseline':'viewer']);gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform3f(uniforms.iResolution,canvas.width,canvas.height,1);gl.uniform1f(uniforms.iTime,time);gl.uniform1i(uniforms.iFrame,Math.floor(time*60));gl.uniform2fv(uniforms.uOrbit,orbit);gl.uniform1f(uniforms.uZoom,zoom);gl.drawArrays(gl.TRIANGLES,0,3);const err=gl.getError();if(err)throw Error('WebGL '+err);frames++;dirty=false;status((running?'旋转中':'LIVE 3D')+' · '+canvas.width+' × '+canvas.height+' · 原SDF');$('analyticZoom').textContent=Math.round(zoom*100)+'%';}
function leave(){visible=false;running=false;root.hidden=true;nav.classList.remove('on');$('analyticPlay').textContent='自动旋转';}
async function open(push=true){visible=true;root.hidden=false;window.KAOPU10?.stop();window.KAOPU10?.select('home',false);$('workspace').hidden=true;document.querySelectorAll('[data-go]').forEach(b=>b.classList.remove('on'));nav.classList.add('on');if(push)history.pushState({},'',new URL('?case=analytic&v=r15-v04r01',location.href));try{await init();dirty=true;draw();}catch(e){fail(e);}}
document.querySelectorAll('[data-material]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.material!=='volcanic')window.KAOPU_VOLCANIC?.leave();if(b.dataset.material!=='analytic')leave();}));
nav.addEventListener('click',()=>open());document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',leave));
$('analyticPlay').onclick=()=>{running=!running;$('analyticPlay').textContent=running?'暂停旋转':'自动旋转';dirty=true;};
$('analyticReset').onclick=()=>{running=false;time=0;orbit=[0,0];zoom=1;$('analyticPlay').textContent='自动旋转';dirty=true;};
function setZoom(z){zoom=Math.max(.45,Math.min(3,z));dirty=true;}
$('analyticZoomOut').onclick=()=>setZoom(zoom/1.2);$('analyticZoomIn').onclick=()=>setZoom(zoom*1.2);
$('analyticQuality').onchange=e=>{canvas.width=+e.target.value;canvas.height=Math.round(canvas.width*9/16);dirty=true;};
let drag=null;canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY,...orbit];running=false;$('analyticPlay').textContent='自动旋转';});canvas.addEventListener('pointermove',e=>{if(!drag)return;orbit=[drag[2]+(e.clientX-drag[0])*.007,Math.max(-2,Math.min(2,drag[3]+(e.clientY-drag[1])*.005))];dirty=true;});for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;running=false;opening=null;status('图形上下文已中断，请重新打开04');});
canvas.addEventListener('webglcontextrestored',()=>{opening=null;programs={};init().catch(fail);});
function tick(now){if(visible&&!document.hidden){if(running){time+=Math.min((now-last)/1000,.08);dirty=true;}if(dirty&&ready)try{draw();}catch(e){running=false;fail(e);}}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
function route(){if(new URLSearchParams(location.search).get('case')==='analytic')open(false);else leave();}
// R15's async initialization retains control of its two existing cases.
function awaitR15(){if(window.KAOPU10?.ready){window.addEventListener('popstate',route);route();return;}if(!$('error').hidden){root.querySelectorAll('button').forEach(b=>b.disabled=false);nav.disabled=false;window.addEventListener('popstate',route);route();return;}setTimeout(awaitR15,80);}awaitR15();
window.KAOPU_ANALYTIC={open,leave,wrap,draw,getState:()=>({visible,ready,running,time,zoom,orbit:orbit.slice(),frames,width:canvas.width,height:canvas.height}),setTime:t=>{time=t;dirty=true;draw();},pixels:()=>{const b=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return Array.from(b);},source:()=>source};
})();
