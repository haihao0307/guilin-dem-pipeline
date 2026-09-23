(async()=>{'use strict';
const canvas=document.getElementById('viewport'),errorBox=document.getElementById('error'),errorText=document.getElementById('errorText'),statusText=document.getElementById('statusText');
function fail(message){errorText.textContent=message;errorBox.classList.add('show');throw new Error(message)}
if(!('DecompressionStream' in window))fail('当前浏览器不支持模型解压。请使用最新版 Chrome、Edge 或 Safari。');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl)fail('当前浏览器没有启用 WebGL 2。请使用最新版 Chrome、Edge 或 Safari。');
statusText.textContent='正在解压并载入船体…';
async function unpackModel(){
 const text=window.PATROL_BOAT_PACK||''; if(!text)fail('公开模型数据没有载入。');
 const zipped=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 const stream=new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'));
 const raw=new Uint8Array(await new Response(stream).arrayBuffer());
 const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),jsonLength=view.getUint32(0,true);
 const meta=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+jsonLength)));
 let off=4+jsonLength;
 const take=(bytes,Type)=>{const copy=raw.slice(off,off+bytes);off+=bytes;return new Type(copy.buffer)};
 for(const name of ['hull','engine']){
   const g=meta.groups[name],L=g.lengths;
   g.positions=take(L.positions,Float32Array);g.normals=take(L.normals,Int16Array);g.colors=take(L.colors,Uint8Array);g.indices=take(L.indices,Uint16Array);
 }
 return meta;
}
const D=await unpackModel(); delete window.PATROL_BOAT_PACK;
const state={groups:[],grid:true,hull:true,engine:true,auto:false,bounds:D.size,camera:{yaw:-.78,pitch:.34,distance:8,target:[0,D.size[1]*.42,0]},pointer:{down:false,button:0,x:0,y:0},last:performance.now()};
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
const norm=v=>{const n=Math.hypot(...v)||1;return[v[0]/n,v[1]/n,v[2]/n]},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function look(eye,t,u){const z=norm([eye[0]-t[0],eye[1]-t[1],eye[2]-t[2]]),x=norm(cross(u,z)),y=cross(z,x),o=I();o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-dot(x,eye);o[13]=-dot(y,eye);o[14]=-dot(z,eye);return o}
function persp(f,a,n,fa){const q=1/Math.tan(f/2),o=new Float32Array(16);o[0]=q/a;o[5]=q;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa);return o}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const meshP=program(`#version 300 es
precision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec3 c;uniform mat4 vp;out vec3 N;out vec3 C;out vec3 W;void main(){N=normalize(n);C=c;W=p;gl_Position=vp*vec4(p,1.);}`,
`#version 300 es
precision highp float;in vec3 N;in vec3 C;in vec3 W;uniform vec3 eye;out vec4 O;void main(){vec3 n=normalize(N);if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(.45,.85,.35));float d=max(dot(n,l),0.);float h=n.y*.5+.5;vec3 v=normalize(eye-W),hh=normalize(l+v);float s=pow(max(dot(n,hh),0.),36.)*.18;vec3 col=pow(C,vec3(2.2));col=col*(.34+.62*d+.15*h)+s;O=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`);
const lineP=program(`#version 300 es
precision highp float;layout(location=0)in vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.);}`,
`#version 300 es
precision highp float;uniform vec4 color;out vec4 O;void main(){O=color;}`);
const mu={vp:gl.getUniformLocation(meshP,'vp'),eye:gl.getUniformLocation(meshP,'eye')},lu={vp:gl.getUniformLocation(lineP,'vp'),color:gl.getUniformLocation(lineP,'color')};
function group(name,g){const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 let v=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,g.positions,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
 v=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,g.normals,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.SHORT,true,0,0);
 v=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,g.colors,gl.STATIC_DRAW);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.UNSIGNED_BYTE,true,0,0);
 const e=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,g.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{name,vao,count:g.indices.length}}
state.groups=[group('hull',D.groups.hull),group('engine',D.groups.engine)];
function lines(){const a=[],h=8;for(let i=-h;i<=h;i++){a.push(-h,0,i,h,0,i,i,0,-h,i,0,h)}const vao=gl.createVertexArray(),b=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return{vao,count:a.length/3}}
const grid=lines();
function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px'}gl.viewport(0,0,w,h)}
function cam(){const c=state.camera,cp=Math.cos(c.pitch),eye=[c.target[0]+c.distance*cp*Math.sin(c.yaw),c.target[1]+c.distance*Math.sin(c.pitch),c.target[2]+c.distance*cp*Math.cos(c.yaw)],v=look(eye,c.target,[0,1,0]),p=persp(Math.PI*50/180,canvas.width/canvas.height,.02,120);return{eye,vp:mul(p,v)}}
function fit(){const m=Math.max(...D.size);state.camera.distance=m/(2*Math.tan(Math.PI*50/360))*1.45;state.camera.target=[0,D.size[1]*.42,0]}
function render(now){resize();const dt=Math.min((now-state.last)/1000,.05);state.last=now;if(state.auto&&!state.pointer.down)state.camera.yaw+=dt*.25;gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.clearColor(.035,.063,.087,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const c=cam();
 if(state.grid){gl.useProgram(lineP);gl.uniformMatrix4fv(lu.vp,false,c.vp);gl.uniform4f(lu.color,.23,.37,.47,.42);gl.bindVertexArray(grid.vao);gl.drawArrays(gl.LINES,0,grid.count)}
 gl.useProgram(meshP);gl.uniformMatrix4fv(mu.vp,false,c.vp);gl.uniform3f(mu.eye,...c.eye);for(const g of state.groups){if(g.name==='hull'&&!state.hull||g.name==='engine'&&!state.engine)continue;gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_SHORT,0)}gl.bindVertexArray(null);requestAnimationFrame(render)}
function view(n){const v={iso:[-.78,.34],port:[0,.10],starboard:[Math.PI,.10],bow:[Math.PI/2,.08],stern:[-Math.PI/2,.08],top:[-.78,Math.PI/2-.035]}[n];if(v){state.camera.yaw=v[0];state.camera.pitch=v[1];fit()}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.getElementById('fitBtn').onclick=fit;document.getElementById('resetBtn').onclick=()=>view('iso');document.getElementById('autoBtn').onclick=e=>{state.auto=!state.auto;e.currentTarget.textContent=state.auto?'停止旋转':'自动旋转'};document.getElementById('hullToggle').onchange=e=>state.hull=e.target.checked;document.getElementById('engineToggle').onchange=e=>state.engine=e.target.checked;document.getElementById('gridToggle').onchange=e=>state.grid=e.target.checked;
canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{state.pointer={down:true,button:e.button,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!state.pointer.down)return;const dx=e.clientX-state.pointer.x,dy=e.clientY-state.pointer.y;state.pointer.x=e.clientX;state.pointer.y=e.clientY;if(state.pointer.button===2||e.shiftKey){const s=state.camera.distance*.0015,r=[Math.cos(state.camera.yaw),0,-Math.sin(state.camera.yaw)];state.camera.target[0]-=r[0]*dx*s;state.camera.target[2]-=r[2]*dx*s;state.camera.target[1]+=dy*s}else{state.camera.yaw-=dx*.006;state.camera.pitch=Math.max(-.04,Math.min(Math.PI/2-.02,state.camera.pitch-dy*.005))}};const up=e=>{state.pointer.down=false;try{canvas.releasePointerCapture(e.pointerId)}catch(_){}};canvas.onpointerup=up;canvas.onpointercancel=up;canvas.addEventListener('wheel',e=>{e.preventDefault();state.camera.distance=Math.max(1,Math.min(40,state.camera.distance*Math.exp(e.deltaY*.001)))},{passive:false});canvas.ondblclick=fit;
fit();statusText.textContent='船体已载入并通过浏览器可见性检查';requestAnimationFrame(render);
})().catch(err=>{console.error(err);const box=document.getElementById('error'),text=document.getElementById('errorText');if(text&&!text.textContent)text.textContent='载入失败：'+err.message;if(box)box.classList.add('show')});
