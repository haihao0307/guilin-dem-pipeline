import {PARAMS,DEFAULTS,GROUPS} from './params.mjs';
import {rockGeometry,compileRockHeight} from './geometry.mjs';
import {bindConfig,rebuildDefinitions,FIRE_SOURCES,islandRadius,waterLevel,windAt,flowDirection,VERSION,TAU,DOMAIN,FIRE_CENTER,COAST_ROCKS,FIRE_RING,LOGS,RNG,clamp,mix,smooth,bedHeight,shorelineZ,waveAt,normalize3,sub3,cross3,mat4Perspective,mat4LookAt} from './core.mjs';
import * as SH from './shaders.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'),loading=$('loading'),progress=$('progress'),errorBox=$('error'),qaProbe=$('qaProbe');
const query=new URLSearchParams(location.search);
const config={...DEFAULTS,paused:false,mode:'environment',smokeVisible:true,fireEnabled:true,waterVisible:true};bindConfig(config);

const qa={version:VERSION,ready:false,relationshipPass:'r018-foundation',shallowWaterLayering:true,foamBandCoupling:true,waterFireReflection:true,smokeCoolingCurve:true,webgl2:false,errors:[],persistentImageAssets:0,externalModels:0,externalCdn:0,fixedStepS:1/120,rockCount:COAST_ROCKS.length,fireRingRockCount:FIRE_RING.length,logCount:LOGS.length,smokeParticles:0,flameParticles:0,sprayParticles:0,foamActiveCells:0,wetCells:0,drawCalls:0,triangles:0,frames:0,fps:0,physicalTime:0,displayLagSkippedSeconds:0,opaqueCacheRenders:0,opaqueCacheReuses:0,visualProbe:null};
window.OceanCoastR012={qa};window.OceanMotherR018=window.OceanCoastR012;
function fail(value){const err=value instanceof Error?value:new Error(String(value));qa.errors.push(err.stack||err.message);errorBox.hidden=false;errorBox.textContent=qa.errors.at(-1);loading.classList.add('done');console.error(err)}
addEventListener('error',e=>fail(e.error||e.message));
addEventListener('unhandledrejection',e=>fail(e.reason));

function shader(gl,type,source,label){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const numbered=source.split('\n').map((line,i)=>`${i+1}: ${line}`).join('\n');throw new Error(`${label}: ${gl.getShaderInfoLog(sh)}\n${numbered}`)}return sh}
function program(gl,vs,fs,label){const p=gl.createProgram(),a=shader(gl,gl.VERTEX_SHADER,vs,`${label} vertex`),b=shader(gl,gl.FRAGMENT_SHADER,fs,`${label} fragment`);gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(`${label} link: ${gl.getProgramInfoLog(p)}`);return p}
function locations(gl,p,names){const out={};for(const name of new Set([...names,'uParams[0]']))out[name]=gl.getUniformLocation(p,name);out.paramSize=0;for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p,i);if(u.name==='uParams[0]')out.paramSize=u.size;}return out;}
function sendParams(loc){if(loc.paramSize)gl.uniform1fv(loc['uParams[0]'],paramData.subarray(0,loc.paramSize));}

function u1f(gl,loc,v){if(loc!==null)gl.uniform1f(loc,v)}function u1i(gl,loc,v){if(loc!==null)gl.uniform1i(loc,v)}function u2f(gl,loc,a,b){if(loc!==null)gl.uniform2f(loc,a,b)}function u3fv(gl,loc,v){if(loc!==null)gl.uniform3fv(loc,v)}function u4f(gl,loc,a,b,c,d){if(loc!==null)gl.uniform4f(loc,a,b,c,d)}function um4(gl,loc,m){if(loc!==null)gl.uniformMatrix4fv(loc,false,m)}

const camera={target:[0,0,0],yaw:2.6,pitch:.48,distance:125,fov:50*Math.PI/180,eye:[0,0,0],forward:[0,0,-1],right:[1,0,0],up:[0,1,0],view:new Float32Array(16),proj:new Float32Array(16),dirty:true};
function updateCamera(aspect){const cp=Math.cos(camera.pitch);camera.eye=[camera.target[0]+camera.distance*cp*Math.sin(camera.yaw),camera.target[1]+camera.distance*Math.sin(camera.pitch),camera.target[2]+camera.distance*cp*Math.cos(camera.yaw)];camera.forward=normalize3(sub3(camera.target,camera.eye));camera.right=normalize3(cross3(camera.forward,[0,1,0]));camera.up=normalize3(cross3(camera.right,camera.forward));mat4LookAt(camera.view,camera.eye,camera.target,[0,1,0]);mat4Perspective(camera.proj,camera.fov,aspect,.15,650);camera.dirty=false;}
const views={overview:1,shore:1,breaker:1,fire:1,rocks:1,top:1};
function setView(name,instant=false){
 const r=config.radius,source=FIRE_SOURCES[0]||[r*.46,2,0],rock=COAST_ROCKS[2]||[r,0];
 const v={overview:{target:[0,1,0],yaw:2.6,pitch:.48,distance:r*4.9},shore:{target:[r*.64,.1,-r*.83],yaw:2.5,pitch:.26,distance:25},breaker:{target:[r*.8,.2,-r*.9],yaw:2.3,pitch:.21,distance:35},fire:{target:[source[0]+6,3,source[2]],yaw:2.8,pitch:.25,distance:27},rocks:{target:[rock[0],1,rock[1]],yaw:2.8,pitch:.25,distance:22},top:{target:[0,0,0],yaw:0,pitch:1.49,distance:r*4.6}}[name]||{target:[0,0,0],yaw:2.6,pitch:.48,distance:r*4.9};
 v.fov=50*Math.PI/180;if(innerWidth<760&&['overview','top'].includes(name)){v.distance*=1.50;v.fov=58*Math.PI/180;}
 while(v.yaw-camera.yaw>Math.PI)v.yaw-=TAU;while(v.yaw-camera.yaw<-Math.PI)v.yaw+=TAU;
 if(instant||!qa.ready){Object.assign(camera,v);camera.target=[...v.target];cameraTween=null;}else cameraTween={start:performance.now(),a:{...camera,target:[...camera.target]},b:v};
 camera.dirty=true;opaqueDirty=true;qa.view=name;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
function installCamera(){
 const pointers=new Map();let pinch=0;
 canvas.addEventListener('pointerdown',e=>{cameraTween=null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pinch=0});
 canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)camera.distance=clamp(camera.distance*pinch/Math.max(5,distance),4,270);pinch=distance;}
 else if(e.shiftKey||e.buttons===4){const k=camera.distance*.0014;for(let i=0;i<3;i++)camera.target[i]-=(camera.right[i]*dx-camera.up[i]*dy)*k;}
 else{camera.yaw-=dx*.005*config.orbitSpeed;camera.pitch=clamp(camera.pitch-dy*.004*config.orbitSpeed,.035,1.51);}
 opaqueDirty=true;});
 const release=e=>{pointers.delete(e.pointerId);pinch=0};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 canvas.addEventListener('wheel',e=>{e.preventDefault();cameraTween=null;camera.distance=clamp(camera.distance*Math.exp(e.deltaY*.001*config.zoomSpeed),4,270);opaqueDirty=true},{passive:false});
 canvas.addEventListener('dblclick',()=>setView('overview'));canvas.addEventListener('contextmenu',e=>e.preventDefault());
}

const controls=new Map();let geometryTimer=0,geometryDirty=false,cameraTween=null,uiClock=0,currentPage=1;
const paramData=new Float32Array(PARAMS.length);const paramMeta=new Map(PARAMS.map(p=>[p.key,p]));
function syncParams(){PARAMS.forEach((p,i)=>paramData[i]=config[p.key]);}
function applyUI(){
 const root=document.documentElement;
 for(const [name,key,unit] of [['glass-alpha','glassOpacity',''],['glass-blur','glassBlur','px'],['glass-flow','glassFlow',''],['glass-edge','glassEdge',''],['glass-hue','glassHue',''],['button-duration','buttonDuration','ms']])root.style.setProperty('--'+name,config[key]+unit);
 root.style.setProperty('--flow-duration',`${18/Math.max(.01,config.glassSpeed)}s`);
 root.classList.toggle('glass-still',config.glassSpeed===0||config.glassFlow===0);
 glassDirty=true;decorateDeep();
}
function applyParam(key,value){
 const m=paramMeta.get(key);if(!m||!Number.isFinite(Number(value)))return false;
 const v=clamp(Number(value),m.min,m.max);config[key]=v;
 const c=controls.get(key);if(c){c.input.value=v;c.number.value=Number(v.toFixed(3));c.row.style.setProperty('--fill',`${100*(v-m.min)/(m.max-m.min)}%`);}
 syncParams();if(m.kind==='geometry'){clearTimeout(geometryTimer);geometryDirty=true;opaqueDirty=true;geometryTimer=setTimeout(()=>{if(geometryDirty&&config.paused&&gl)rebuildWorld()},130)}
 if(m.kind==='ui')applyUI();else opaqueDirty=true;return true;
}
function buildControls(){
 for(const group of GROUPS){const box=document.createElement('section');box.dataset.group=group.id;
 const heading=document.createElement('h2');heading.textContent=group.title;box.append(heading);
 const reset=document.createElement('button');reset.className='group-reset';reset.textContent='重置本组';reset.onclick=()=>PARAMS.filter(p=>p.group===group.id).forEach(p=>applyParam(p.key,p.value));box.append(reset);
 for(const m of PARAMS.filter(p=>p.group===group.id)){
  const row=document.createElement('div');row.className='control';row.dataset.key=m.key;
  const label=document.createElement('label');label.htmlFor=`control-${m.key}`;label.textContent=m.label;
  const valueBox=document.createElement('span');valueBox.className='value-box';
  const number=document.createElement('input');number.type='number';number.min=m.min;number.max=m.max;number.step=m.step;number.value=config[m.key];number.setAttribute('aria-label',m.label+'数值');
  const unit=document.createElement('small');unit.textContent=m.unit;valueBox.append(number,unit);
  const input=document.createElement('input');Object.assign(input,{type:'range',min:m.min,max:m.max,step:m.step,value:config[m.key],id:`control-${m.key}`});
  input.oninput=()=>applyParam(m.key,input.value);number.onchange=()=>applyParam(m.key,number.value);
  row.append(label,valueBox,input);row.style.setProperty('--fill',`${100*(config[m.key]-m.min)/(m.max-m.min)}%`);controls.set(m.key,{input,number,row});box.append(row);
 }
 $(`page-${group.page}`).append(box);
 }
 $('controlCount').textContent=`${PARAMS.length} 项可调参数`;
}
function setPage(n){currentPage=n;for(let i=1;i<=3;i++)$('page-'+i).hidden=i!==n;
 document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',+b.dataset.page===n);b.setAttribute('aria-selected',String(+b.dataset.page===n))});$('panelScroll').scrollTop=0;glassDirty=true;
}
function installUI(){
 buildControls();syncParams();applyUI();
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(+b.dataset.page));
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('panelToggle').onclick=()=>{if(!coastVisible){$('deepFrame').contentDocument?.getElementById('togglePanel')?.click();return}const closed=$('panel').classList.toggle('closed');$('panelToggle').setAttribute('aria-expanded',String(!closed));glassDirty=true};
 $('panelClose').onclick=()=>{$('panel').classList.add('closed');$('panelToggle').setAttribute('aria-expanded','false');glassDirty=true};
 $('resetCamera').onclick=()=>{if(!coastVisible){$('deepFrame').contentDocument?.getElementById('reset')?.click();return}setView('overview')};
 $('pause').onclick=()=>{if(!coastVisible){const b=$('deepFrame').contentDocument?.getElementById('pause');b?.click();if(b)$('pause').textContent=b.textContent;return}config.paused=!config.paused;$('pause').textContent=config.paused?'继续运行':'暂停';lastFrame=performance.now();opaqueDirty=true};
 $('mode').onchange=e=>{config.mode=e.target.value;$('legend').hidden=config.mode!=='diagnostic';opaqueDirty=true};
 $('fireToggle').onclick=()=>{config.fireEnabled=!config.fireEnabled;$('fireToggle').textContent=config.fireEnabled?'停止添火':'继续添火';opaqueDirty=true};
 $('smokeToggle').onclick=()=>{config.smokeVisible=!config.smokeVisible;$('smokeToggle').textContent=config.smokeVisible?'隐藏烟雾':'显示烟雾';updateParticleBuffer();opaqueDirty=true};
 $('waterToggle').onclick=()=>{config.waterVisible=!config.waterVisible;$('waterToggle').textContent=config.waterVisible?'隐藏海水':'显示海水';opaqueDirty=true};
 $('coastTab').onclick=()=>setWaterMode('coast');$('deepTab').onclick=()=>setWaterMode('deep');
 const presets={calm:{wind:2,gust:.12,swell:.4,secondary:.08,curlOuter:.35,curlMiddle:.2,curlInner:.15,spray:.3},swell:{wind:12,gust:.24,swell:1.1,secondary:.26,curlOuter:1,curlMiddle:.75,curlInner:.5,spray:1.1},storm:{wind:21,gust:.4,swell:1.8,secondary:.46,curlOuter:1.4,curlMiddle:1,curlInner:.8,spray:2.1}};
 document.querySelectorAll('[data-sea]').forEach(b=>b.onclick=()=>{Object.entries(presets[b.dataset.sea]).forEach(([k,v])=>applyParam(k,v));document.querySelectorAll('[data-sea]').forEach(x=>x.classList.toggle('selected',x===b))});
 $('resetAll').onclick=()=>PARAMS.forEach(p=>applyParam(p.key,p.value));
 $('deepFrame').addEventListener('load',decorateDeep);
}
function decorateDeep(){
 const frame=$('deepFrame');if(!frame?.getAttribute('src'))return;
 try{const doc=frame.contentDocument;if(!doc||!doc.getElementById('panel'))return;
 let style=doc.getElementById('ocean-island-glass-skin');if(!style){style=doc.createElement('style');style.id='ocean-island-glass-skin';doc.head.append(style);}
 style.textContent=`#mast,#titleCard{display:none!important}#panel{top:94px!important;max-height:calc(100vh - 165px)!important}#panel,.topActions{background:linear-gradient(140deg,rgba(222,243,249,${config.glassOpacity+.15}),rgba(176,211,229,.15))!important;backdrop-filter:blur(${config.glassBlur}px) saturate(1.1);-webkit-backdrop-filter:blur(${config.glassBlur}px);border:1px solid #ffffff88!important;box-shadow:inset 0 1px 1px #fff,0 16px 36px #14384225!important;color:#102f3a!important;isolation:isolate;overflow-x:hidden}#panel:before{content:'';position:fixed;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(125deg,transparent 24%,#ffffff40 43%,#a6ebff33 49%,transparent 66%);background-size:260% 260%;animation:oceanFlow ${18/Math.max(.05,config.glassSpeed)}s ease-in-out infinite;opacity:${config.glassFlow*.5};z-index:-1}#panel>*,.topActions>*{position:relative}#panel label,#panel summary,#panel .sectionHead,#panel .row,#panel output{color:#183e4d!important}#panel button,#panel select,.topActions button{color:#173d4c!important;background:#e8f8fc26!important;transition:background ${config.buttonDuration}ms,box-shadow ${config.buttonDuration}ms,transform ${config.buttonDuration}ms}#panel button.active,#panel button:hover,.topActions button:hover{background:#e5fbff99!important;box-shadow:inset 0 1px #fff,0 3px 12px #1c6e8035}button:active{transform:scale(.97)}@keyframes oceanFlow{0%,100%{background-position:0% 0%}50%{background-position:100% 100%}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}`;
 doc.documentElement.dataset.oceanGlassSkin='r018';
 }catch(e){qa.deepSkinError=String(e);}
}

let coastVisible=true;function setWaterMode(mode){coastVisible=mode==='coast';canvas.hidden=!coastVisible;$('deepFrame').hidden=coastVisible;$('panel').hidden=!coastVisible;$('sceneTitle').hidden=!coastVisible;$('cameraBar').hidden=!coastVisible;$('cameraHint').hidden=!coastVisible;$('legend').hidden=!coastVisible||config.mode!=='diagnostic';$('mode').hidden=!coastVisible;$('coastTab').classList.toggle('selected',coastVisible);$('deepTab').classList.toggle('selected',!coastVisible);if(!coastVisible&&!$('deepFrame').getAttribute('src'))$('deepFrame').src=$('deepFrame').dataset.src;decorateDeep();lastFrame=performance.now();opaqueDirty=true}

function mesh(gl,data,indices,stride=7){const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ibo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride*4,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride*4,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,stride*4,24);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,vbo,ibo,count:indices.length,triangles:indices.length/3,vertices:data.length/stride}}
function gridMesh(gl,nx,nz,minX,maxX,minZ,maxZ,heightFn,kind=0){const data=new Float32Array((nx+1)*(nz+1)*7),indices=new Uint32Array(nx*nz*6);let o=0;for(let j=0;j<=nz;j++){const z=mix(minZ,maxZ,j/nz);for(let i=0;i<=nx;i++){const x=mix(minX,maxX,i/nx),y=heightFn(x,z),e=.18,dx=heightFn(x+e,z)-heightFn(x-e,z),dz=heightFn(x,z+e)-heightFn(x,z-e),n=normalize3([-dx/(2*e),1,-dz/(2*e)]);data[o++]=x;data[o++]=y;data[o++]=z;data[o++]=n[0];data[o++]=n[1];data[o++]=n[2];data[o++]=kind}}o=0;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices[o++]=a;indices[o++]=c;indices[o++]=b;indices[o++]=b;indices[o++]=c;indices[o++]=d}return mesh(gl,data,indices)}
function waterMesh(gl,nx,nz){const data=new Float32Array((nx+1)*(nz+1)*2),indices=new Uint32Array(nx*nz*6);let o=0;for(let j=0;j<=nz;j++){const z=mix(DOMAIN.minZ,DOMAIN.maxZ,j/nz);for(let i=0;i<=nx;i++){data[o++]=mix(DOMAIN.minX,DOMAIN.maxX,i/nx);data[o++]=z}}o=0;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices[o++]=a;indices[o++]=c;indices[o++]=b;indices[o++]=b;indices[o++]=c;indices[o++]=d}const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ibo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,vbo,ibo,count:indices.length,triangles:indices.length/3,vertices:data.length/2}}
function rockMesh(gl,definitions){const g=rockGeometry(definitions);qa.rockDegenerateTriangles=(qa.rockDegenerateTriangles||0)+g.degenerate;return mesh(gl,g.data,g.indices)}
function logMesh(gl){const data=[],indices=[];const faceDefs=[[[1,0,0],[1,2,6,5]],[[-1,0,0],[0,4,7,3]],[[0,1,0],[3,7,6,2]],[[0,-1,0],[0,1,5,4]],[[0,0,1],[4,5,6,7]],[[0,0,-1],[0,3,2,1]]];for(const[cx,cz,len,w,h,angle]of LOGS){const cy=bedHeight(cx,cz)+h*.5+.025,co=Math.cos(angle),si=Math.sin(angle),corners=[[-len/2,-h/2,-w/2],[len/2,-h/2,-w/2],[len/2,h/2,-w/2],[-len/2,h/2,-w/2],[-len/2,-h/2,w/2],[len/2,-h/2,w/2],[len/2,h/2,w/2],[-len/2,h/2,w/2]];for(const[nLocal,ids]of faceDefs){const base=data.length/7,n=[nLocal[0]*co+nLocal[2]*si,nLocal[1],-nLocal[0]*si+nLocal[2]*co];for(const id of ids){const q=corners[id],x=cx+q[0]*co+q[2]*si,z=cz-q[0]*si+q[2]*co;data.push(x,cy+q[1],z,n[0],n[1],n[2],2)}indices.push(base,base+1,base+2,base,base+2,base+3)}}return mesh(gl,new Float32Array(data),new Uint32Array(indices))}
function makeR8(gl,w,h,data){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,data);return tex}

const FIELD_W=176,FIELD_H=176,foamA=new Float32Array(FIELD_W*FIELD_H),foamB=new Float32Array(FIELD_W*FIELD_H),wetField=new Float32Array(FIELD_W*FIELD_H),filmField=new Float32Array(FIELD_W*FIELD_H),foamBytes=new Uint8Array(FIELD_W*FIELD_H),wetBytes=new Uint8Array(FIELD_W*FIELD_H);let foamFront=foamA,foamBack=foamB,foamTexture,wetTexture;
function sampleField(field,x,z){const u=clamp((x-DOMAIN.minX)/DOMAIN.width,0,.9999),v=clamp((z-DOMAIN.minZ)/DOMAIN.depth,0,.9999),fx=u*(FIELD_W-1),fz=v*(FIELD_H-1),x0=Math.floor(fx),z0=Math.floor(fz),x1=Math.min(FIELD_W-1,x0+1),z1=Math.min(FIELD_H-1,z0+1),tx=fx-x0,tz=fz-z0;return mix(mix(field[z0*FIELD_W+x0],field[z0*FIELD_W+x1],tx),mix(field[z1*FIELD_W+x0],field[z1*FIELD_W+x1],tx),tz)}
function updateFields(dt,time){
 let foamCells=0,wetCells=0,active=0;const dir=flowDirection(config.swellDir);
 for(let j=0;j<FIELD_H;j++){const z=mix(DOMAIN.minZ,DOMAIN.maxZ,j/(FIELD_H-1));for(let i=0;i<FIELD_W;i++){
 const x=mix(DOMAIN.minX,DOMAIN.maxX,i/(FIELD_W-1)),id=j*FIELD_W+i,r=Math.hypot(x,z),s=r-islandRadius(Math.atan2(z,x));
 if(s>35&&foamFront[id]<.005&&wetField[id]<.005){foamBack[id]=0;continue}active++;
 const w=waveAt(x,z,time,config),contact=rockContact(x,z,w.eta),shoreBand=smooth(.01,.12,w.depth)*(1-smooth(.25,.9,w.depth));
 const bandPulse=clamp((w.bandStrengths||[]).reduce((sum,value)=>sum+value,0),0,1.5);
 const source=w.depth>0?clamp((bandPulse*.44+w.breaker*.20+shoreBand*.18*config.shoreFoam+contact.edge*Math.max(w.breaker,bandPulse)*config.rockFoam*.55)*config.foam,0,3):0;
 const back=config.backwash*Math.sin(time*TAU/config.period-r*.5)*(1-smooth(0,7,Math.abs(s)));
 const vx=(dir[0]*(.18+w.breaker*.55)+x/Math.max(r,1)*back)*config.foamTransport,vz=(dir[1]*(.18+w.breaker*.55)+z/Math.max(r,1)*back)*config.foamTransport;
 const old=rockField.sample(x-vx*dt,z-vz*dt)>w.eta?foamFront[id]:sampleField(foamFront,x-vx*dt,z-vz*dt);
 const near=(foamFront[id-1]??old)+(foamFront[id+1]??old)+(foamFront[id-FIELD_W]??old)+(foamFront[id+FIELD_W]??old);
 const life=config.foamLife*(w.depth>0?1:.15+config.residualFoam*.7);
 foamBack[id]=contact.solid?0:clamp(old*Math.exp(-dt/life)+source*dt*(1-old)+config.foamDiffusion*dt*(near*.25-old),0,1);
 if(w.depth>.01&&!contact.solid){wetField[id]=1;filmField[id]=1;}else{wetField[id]=Math.max(0,wetField[id]-dt/config.wetLife);filmField[id]=Math.max(0,filmField[id]-dt/config.filmLife);}
 if(foamBack[id]>.09)foamCells++;if(wetField[id]>.08)wetCells++;
 }}
 [foamFront,foamBack]=[foamBack,foamFront];
 for(let i=0;i<foamFront.length;i++){foamBytes[i]=Math.round(foamFront[i]*255);wetBytes[i]=Math.round((wetField[i]*.75+filmField[i]*.25)*255)}
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,foamTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,FIELD_W,FIELD_H,gl.RED,gl.UNSIGNED_BYTE,foamBytes);
 gl.bindTexture(gl.TEXTURE_2D,wetTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,FIELD_W,FIELD_H,gl.RED,gl.UNSIGNED_BYTE,wetBytes);
 qa.foamActiveCells=foamCells;qa.wetCells=wetCells;qa.fieldCellsUpdated=active;qa.fieldUpdateCount=(qa.fieldUpdateCount||0)+1;opaqueDirty=true;
}

function rockContact(x,z,eta){const c=rockField.sample(x,z),e=1.0;let edge=0;for(const [a,b] of [[e,0],[-e,0],[0,e],[0,-e]])if(rockField.sample(x+a,z+b)>eta)edge+=.25;return{solid:c>eta,edge:c>eta?0:edge}}
const MAX_PARTICLES=innerWidth<760?2600:5200;
const particles=Array.from({length:MAX_PARTICLES},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,maxLife:1,size:1,type:0,age:0,seed:0,source:0}));
const particleData=new Float32Array(MAX_PARTICLES*8),rng=new RNG(0x7a51c30d);
let particleCursor=0,mediaVao,mediaBuffer,fireY=0,smokeEmit=0,flameEmit=0,sprayEmit=0,emberEmit=0,liveParticles=0,sourceCursor=0;
function takeParticle(){
 for(let k=0;k<MAX_PARTICLES;k++){const p=particles[particleCursor++%MAX_PARTICLES];if(p.life<=0)return p}
 qa.particleCapacityHits=(qa.particleCapacityHits||0)+1;return particles[particleCursor++%MAX_PARTICLES];
}
function sourceFor(strands){const index=(sourceCursor++)%FIRE_SOURCES.length,s=FIRE_SOURCES[index],strand=Math.floor(sourceCursor/FIRE_SOURCES.length)%Math.round(strands),a=strand/strands*TAU;return {index,x:s[0]+Math.cos(a)*.60,y:s[1],z:s[2]+Math.sin(a)*.60};}
function spawnSmoke(time){
 if(!config.fireEnabled||config.smoke===0)return;const s=sourceFor(config.smokeStrands),p=takeParticle(),wind=windAt(s.x,.45,s.z,time,config);
 Object.assign(p,{x:s.x+(rng.next()-.5)*.12,y:s.y+.45,z:s.z+(rng.next()-.5)*.12,vx:wind[0]*.035,vy:config.smokeRise*(.88+rng.next()*.18),vz:wind[2]*.035,size:config.smokeWidth*(.7+rng.next()*.6),type:0,age:0,seed:rng.next()*100,source:s.index});
 p.life=p.maxLife=config.smokeLife*(.8+rng.next()*.4);
}
function spawnFlame(){
 if(!config.fireEnabled||config.fire===0)return;const s=sourceFor(config.fireStrands),p=takeParticle();
 Object.assign(p,{x:s.x+(rng.next()-.5)*config.fireWidth,y:s.y+.25,z:s.z+(rng.next()-.5)*config.fireWidth,vx:0,vy:config.fireHeight*(.7+rng.next()*.5),vz:0,size:config.fireWidth*(.52+rng.next()*.55),type:1,age:0,seed:rng.next()*100,source:s.index});
 p.life=p.maxLife=.65+rng.next()*.75;
}
function spawnEmber(){if(!config.fireEnabled||config.fire===0)return;const s=sourceFor(config.fireStrands),p=takeParticle();Object.assign(p,{x:s.x,y:s.y+.2,z:s.z,vx:0,vy:2+rng.next()*2,vz:0,size:.018+rng.next()*.026,type:3,age:0,seed:rng.next()*100,source:s.index});p.life=p.maxLife=1.5+rng.next()*2;}
function spawnSpray(time){
 if(!config.waterVisible)return;
 for(let i=0;i<16;i++){
 const a=rng.next()*TAU,r=config.radius+2+rng.next()*17,x=Math.cos(a)*r,z=Math.sin(a)*r,w=waveAt(x,z,time,config);
 if(w.breaker<.28||w.depth<.03||rockField.sample(x,z)>w.eta)continue;
 const p=takeParticle(),mist=rng.next()<config.mistRatio,d=flowDirection(config.swellDir);
 Object.assign(p,{x,y:w.eta+.1,z,vx:d[0]*config.spraySpeed,vy:config.sprayHeight*(.7+rng.next()*.6),vz:d[1]*config.spraySpeed,size:config.dropSize*(mist?3:1),type:2,age:0,seed:rng.next()*100,source:-1,mist});
 p.life=p.maxLife=mist?config.mistLife:.8+rng.next()*1.3;return;
 }
}
function updateParticles(dt,time){
 const n=FIRE_SOURCES.length;
 smokeEmit+=dt*config.smoke*config.smokeStrands*n;flameEmit+=dt*config.fire*config.fireStrands*n*14;
 sprayEmit+=dt*config.spray*(18+config.wind*1.7)*Math.min(2,(config.curlOuter+config.curlMiddle+config.curlInner)/2);emberEmit+=dt*config.emberRate*n;
 while(smokeEmit>=1){spawnSmoke(time);smokeEmit--}while(flameEmit>=1){spawnFlame();flameEmit--}while(sprayEmit>=1){spawnSpray(time);sprayEmit--}while(emberEmit>=1){spawnEmber();emberEmit--}
 for(const p of particles){if(p.life<=0)continue;p.life-=dt;p.age+=dt;if(p.life<=0)continue;
 const wind=windAt(p.x,p.y-bedHeight(p.x,p.z),p.z,time,config);
 if(p.type===0){
  const age01=clamp(p.age/Math.max(.001,p.maxLife),0,1),drag=1-Math.exp(-config.smokeDrag*dt*(.72+.48*age01));
  p.vx+=(wind[0]-p.vx)*drag;p.vz+=(wind[2]-p.vz)*drag;
  const eddy=config.smokeTurb*(.45+.55*Math.sqrt(age01));
  p.vx+=Math.sin(p.z*.2+time*.83+p.seed)*eddy*dt;p.vz+=Math.cos(p.x*.17-time*.7+p.seed)*eddy*dt;
  const buoyancy=config.smokeRise*(1-.58*smooth(.08,.92,age01));
  p.vy+=(buoyancy+Math.sin(p.x*.2+time+p.seed)*config.smokeTurb*.25-p.vy)*dt*(.75-.25*age01);
  p.size+=config.smokeSpread*dt*(.65+1.35*Math.sqrt(age01));
 }else if(p.type===1){
  const drag=1-Math.exp(-config.windDrag*dt);p.vx+=(wind[0]*.22-p.vx)*drag;p.vz+=(wind[2]*.22-p.vz)*drag;
  p.vx+=Math.sin(time*config.fireSpeed*TAU+p.seed)*config.fireTurb*dt;p.vz+=Math.cos(time*config.fireSpeed*4+p.seed)*config.fireTurb*dt;
  p.vy-=.6*dt;p.size*=Math.exp(-.24*dt);
 }else{
  const drag=1-Math.exp(-config.windDrag*dt*(p.mist?1:.25));p.vx+=(wind[0]-p.vx)*drag;p.vz+=(wind[2]-p.vz)*drag;
  p.vy-=9.81*(p.type===3?.18:p.mist?.12:1)*dt;if(p.mist)p.size+=config.mistSpread*dt;
 }
 p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
 if(p.type>=2&&p.y<Math.max(bedHeight(p.x,p.z),waterLevel(time,config))){p.life=0;}
 }
 updateParticleBuffer();
}
function updateParticleBuffer(){
 let smokeCount=0,flameCount=0,sprayCount=0,emberCount=0,span=0,o=0;const ids=new Set();
 // Sorting transparent media gives a stable back-to-front approximation.
 const live=particles.filter(p=>p.life>0).sort((a,b)=>Math.hypot(b.x-camera.eye[0],b.y-camera.eye[1],b.z-camera.eye[2])-Math.hypot(a.x-camera.eye[0],a.y-camera.eye[1],a.z-camera.eye[2]));
 for(const p of live){
  if(p.type===0){smokeCount++;ids.add(p.source);const s=FIRE_SOURCES[p.source];if(s)span=Math.max(span,Math.hypot(p.x-s[0],p.z-s[2]));if(!config.smokeVisible)continue;}
  else if(p.type===1)flameCount++;else if(p.type===2)sprayCount++;else emberCount++;
  particleData[o++]=p.x;particleData[o++]=p.y;particleData[o++]=p.z;particleData[o++]=Math.max(0,p.life/p.maxLife);particleData[o++]=p.size;particleData[o++]=p.type;particleData[o++]=p.age;particleData[o++]=p.seed;
 }
 liveParticles=o/8;Object.assign(qa,{smokeParticles:smokeCount,flameParticles:flameCount,sprayParticles:sprayCount,emberParticles:emberCount,smokeSourceCount:ids.size,smokeExtentMeters:span});
 gl.bindBuffer(gl.ARRAY_BUFFER,mediaBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,particleData.subarray(0,o));
}

const glassRects=new Float32Array(32);let glassCount=0,glassDirty=true;
function updateGlassRects(){glassDirty=false;glassCount=0;glassRects.fill(0);
 if(matchMedia('(prefers-reduced-transparency: reduce)').matches)return;
 const sx=canvas.width/innerWidth,sy=canvas.height/innerHeight;
 for(const el of document.querySelectorAll('.glass')){const r=el.getBoundingClientRect(),c=getComputedStyle(el);if(c.visibility==='hidden'||c.display==='none'||+c.opacity<.1||r.width<2||r.height<2)continue;
  if(glassCount>=8)break;glassRects.set([r.left*sx,(innerHeight-r.bottom)*sy,r.width*sx,r.height*sy],glassCount++*4);
 }
}
new ResizeObserver(()=>glassDirty=true).observe(document.documentElement);
new MutationObserver(()=>glassDirty=true).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','hidden']});
addEventListener('transitionend',()=>glassDirty=true);
let compositeFbo,compositeColor,compositeDepth,copyProgram,copyLoc,rockTexture,rockField;
let gl,skyProgram,solidProgram,waterProgram,mediaProgram,skyLoc,solidLoc,waterLoc,mediaLoc,emptyVao,terrainGeo,rocksGeo,ringGeo,logsGeo,waterGeo,sceneFbo,sceneColor,sceneDepth,fboW=0,fboH=0,opaqueDirty=true,lastOpaque=-1,resizePending=true,physicalTime=0,accumulator=0,fieldAccumulator=0,particleAccumulator=0,lastFrame=performance.now(),frameCount=0,fpsClock=performance.now(),fpsValue=0,lastMetrics=0,qaScheduled=false;
function modeInt(){return config.mode==='neutral'?1:config.mode==='studio'?2:config.mode==='diagnostic'?3:0}
function sunDirection(){const phase=(config.hour-6)/12*Math.PI,elev=.18+.68*Math.sin(clamp(phase,0,Math.PI)),az=(config.hour-12)*.09+.42;return normalize3([Math.cos(az)*Math.cos(elev),Math.sin(elev),Math.sin(az)*Math.cos(elev)])}
function setCommon(loc){sendParams(loc);u1f(gl,loc.uTime,physicalTime);u1f(gl,loc.uSeaLevel,waterLevel(physicalTime,config));u1f(gl,loc.uSwell,config.swell);u1f(gl,loc.uPeriod,config.period);u1f(gl,loc.uWind,config.wind)}
function createSceneFbo(w,h){
 for(const t of [sceneColor,sceneDepth,compositeColor,compositeDepth])if(t)gl.deleteTexture(t);
 for(const f of [sceneFbo,compositeFbo])if(f)gl.deleteFramebuffer(f);
 function color(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t}
 function depth(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);return t}
 function target(c,d){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,c,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,d,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete frame target');return f}
 sceneColor=color();sceneDepth=depth();sceneFbo=target(sceneColor,sceneDepth);
 compositeColor=color();compositeDepth=depth();compositeFbo=target(compositeColor,compositeDepth);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);fboW=w;fboH=h;opaqueDirty=true;
}
function copyScene(final){
 gl.bindFramebuffer(gl.FRAMEBUFFER,final?null:compositeFbo);gl.viewport(0,0,fboW,fboH);
 gl.colorMask(true,true,true,true);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.ALWAYS);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
 gl.useProgram(copyProgram);sendParams(copyLoc);u1f(gl,copyLoc.uUiTime,matchMedia('(prefers-reduced-motion: reduce)').matches?0:uiClock);gl.bindVertexArray(emptyVao);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,final?compositeColor:sceneColor);u1i(gl,copyLoc.uColor,4);
 gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,sceneDepth);u1i(gl,copyLoc.uDepth,5);u1i(gl,copyLoc.uFinal,final?1:0);updateGlassRects();u1i(gl,copyLoc.uGlassCount,glassCount);gl.uniform4fv(copyLoc['uGlassRects[0]'],glassRects);u2f(gl,copyLoc.uViewport,fboW,fboH);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthFunc(gl.LESS);qa.drawCalls++;
}
function resize(){const mobile=innerWidth<760,scale=mobile?Math.min(1,devicePixelRatio||1):Math.min(1.15,devicePixelRatio||1),w=Math.max(2,Math.floor(canvas.clientWidth*scale)),h=Math.max(2,Math.floor(canvas.clientHeight*scale));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;createSceneFbo(w,h)}camera.dirty=true;glassDirty=true;resizePending=false}
const fireUniformData=new Float32Array(15);
function sendFireUniforms(loc){fireUniformData.fill(0);FIRE_SOURCES.forEach((p,i)=>fireUniformData.set(p,i*3));gl.uniform3fv(loc['uFirePositions[0]'],fireUniformData);u1i(gl,loc.uFireCount,FIRE_SOURCES.length);u1f(gl,loc.uFireIntensity,config.fireEnabled?config.fire:0);}
function drawSky(sun){gl.useProgram(skyProgram);gl.bindVertexArray(emptyVao);setCommon(skyLoc);u3fv(gl,skyLoc.uCamForward,camera.forward);u3fv(gl,skyLoc.uCamRight,camera.right);u3fv(gl,skyLoc.uCamUp,camera.up);u3fv(gl,skyLoc.uSunDir,sun);u1f(gl,skyLoc.uAspect,canvas.width/canvas.height);u1f(gl,skyLoc.uTanFov,Math.tan(camera.fov/2));u1f(gl,skyLoc.uExposure,config.exposure);u1i(gl,skyLoc.uMode,modeInt());gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,3);qa.drawCalls++}
function drawSolid(geo,sun){gl.useProgram(solidProgram);gl.bindVertexArray(geo.vao);setCommon(solidLoc);um4(gl,solidLoc.uView,camera.view);um4(gl,solidLoc.uProj,camera.proj);u3fv(gl,solidLoc.uCamera,camera.eye);u3fv(gl,solidLoc.uSunDir,sun);u3fv(gl,solidLoc.uFirePos,[FIRE_CENTER[0],fireY,FIRE_CENTER[2]]);sendFireUniforms(solidLoc);u1f(gl,solidLoc.uExposure,config.exposure);u4f(gl,solidLoc.uDomain,DOMAIN.minX,DOMAIN.minZ,DOMAIN.width,DOMAIN.depth);u1i(gl,solidLoc.uMode,modeInt());gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,wetTexture);u1i(gl,solidLoc.uWet,0);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,rockTexture);u1i(gl,solidLoc.uRockHeight,3);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.disable(gl.BLEND);gl.drawElements(gl.TRIANGLES,geo.count,gl.UNSIGNED_INT,0);qa.drawCalls++;qa.triangles+=geo.triangles}
function renderOpaque(now){const sun=sunDirection();gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFbo);gl.viewport(0,0,canvas.width,canvas.height);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.depthFunc(gl.LESS);gl.clearColor(.56,.73,.78,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawSky(sun);drawSolid(terrainGeo,sun);drawSolid(rocksGeo,sun);drawSolid(ringGeo,sun);drawSolid(logsGeo,sun);gl.bindFramebuffer(gl.FRAMEBUFFER,null);opaqueDirty=false;lastOpaque=now;qa.opaqueCacheRenders++}
function blitOpaque(){copyScene(false)}
function rebuildOpaqueDepth(sun){}
function drawWater(sun){gl.useProgram(waterProgram);gl.bindVertexArray(waterGeo.vao);setCommon(waterLoc);um4(gl,waterLoc.uView,camera.view);um4(gl,waterLoc.uProj,camera.proj);u3fv(gl,waterLoc.uCamera,camera.eye);u3fv(gl,waterLoc.uSunDir,sun);u2f(gl,waterLoc.uResolution,canvas.width,canvas.height);u4f(gl,waterLoc.uDomain,DOMAIN.minX,DOMAIN.minZ,DOMAIN.width,DOMAIN.depth);u1f(gl,waterLoc.uClarity,config.clarity);u1f(gl,waterLoc.uFoamGain,config.foam);u1f(gl,waterLoc.uRefraction,config.refraction);u1f(gl,waterLoc.uExposure,config.exposure);sendFireUniforms(waterLoc);u1i(gl,waterLoc.uMode,modeInt());gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneColor);u1i(gl,waterLoc.uScene,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,foamTexture);u1i(gl,waterLoc.uFoam,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,sceneDepth);u1i(gl,waterLoc.uSceneDepth,2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,rockTexture);u1i(gl,waterLoc.uRockHeight,3);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawElements(gl.TRIANGLES,waterGeo.count,gl.UNSIGNED_INT,0);gl.depthMask(true);qa.drawCalls++;qa.triangles+=waterGeo.triangles}
function drawMedia(){if(liveParticles<=0)return;gl.useProgram(mediaProgram);sendParams(mediaLoc);u1f(gl,mediaLoc.uTime,physicalTime);gl.bindVertexArray(mediaVao);um4(gl,mediaLoc.uView,camera.view);um4(gl,mediaLoc.uProj,camera.proj);u2f(gl,mediaLoc.uResolution,canvas.width,canvas.height);u1f(gl,mediaLoc.uExposure,config.exposure);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,liveParticles);gl.depthMask(true);qa.drawCalls++}
function metrics(now){if(now-lastMetrics<250)return;lastMetrics=now;$('rockCount').textContent=qa.rockCount;$('ringCount').textContent=qa.fireRingRockCount;$('foamCount').textContent=qa.foamActiveCells;$('smokeCount').textContent=qa.smokeParticles;$('flameCount').textContent=qa.flameParticles;$('panelFps').textContent=fpsValue.toFixed(0);$('clock').textContent=`${physicalTime.toFixed(2)} s`;$('fps').textContent=`${fpsValue.toFixed(0)} fps`;$('resolution').textContent=`${canvas.width} × ${canvas.height}`;$('windReadout').textContent=`风 ${config.wind.toFixed(1)} m/s · 烟延展 ${(qa.smokeExtentMeters||0).toFixed(0)} m`;$('status').textContent=config.paused?'Coast · 已暂停，状态保持':config.mode==='diagnostic'?'Coast · 数值诊断':'海岛 · 实时运行';$('metrics').textContent=[`版本 ${VERSION}`,`物理步长 ${(1/120).toFixed(6)} s`,`岩石 ${qa.rockCount} · 火圈石 ${qa.fireRingRockCount} · 木料 ${qa.logCount}`,`烟雾 ${qa.smokeParticles} · 火焰 ${qa.flameParticles} · 水雾 ${qa.sprayParticles}`,`泡沫活跃单元 ${qa.foamActiveCells} · 湿润单元 ${qa.wetCells}`,`不透明场重建 ${qa.opaqueCacheRenders} · 复用 ${qa.opaqueCacheReuses}`,`显示延迟未追赶 ${qa.displayLagSkippedSeconds.toFixed(3)} s`,`本帧绘制 ${qa.drawCalls} · 三角形 ${qa.triangles.toLocaleString()}`,`图片资产 0 · 外部模型 0 · CDN 0`].join('\n')}
function captureVisualProbe(){const w=canvas.width,h=canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let sum=0,top=0,topN=0,count=0,nonDark=0,blue=0,earth=0,warm=0;const step=Math.max(1,Math.floor(Math.min(w,h)/320));for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const i=(y*w+x)*4,r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,lum=.2126*r+.7152*g+.0722*b;sum+=lum;count++;if(y>h*.72){top+=lum;topN++}if(lum>.08)nonDark++;if(b>.24&&b>r*1.03&&g>r*.94)blue++;if(r>.19&&r>g*1.04&&g>b*1.02)earth++;if(r>.68&&g>.10&&g<r*.78&&b<g*.62)warm++}const probe={averageLuminance:sum/count,topLuminance:top/Math.max(1,topN),nonDarkRatio:nonDark/count,blueWaterSkyRatio:blue/count,earthSandRockRatio:earth/count,warmFireRatio:warm/count,width:w,height:h};qa.visualProbe=probe;const payload={version:VERSION,ready:qa.ready,error:qa.errors.at(-1)||null,physicalTime,composition:{rockCount:qa.rockCount,fireRingRockCount:qa.fireRingRockCount,logCount:qa.logCount,smokeParticles:qa.smokeParticles,flameParticles:qa.flameParticles,sprayParticles:qa.sprayParticles,foamActiveCells:qa.foamActiveCells,wetCells:qa.wetCells},visualProbe:probe,persistentImageAssets:0,externalModels:0,externalCdn:0};qaProbe.textContent=JSON.stringify(payload);document.body.dataset.qaReady='true'}
let curlProgram,curlLoc,curlVao,curlBuffer,curlIndex,curlCount=0,curlLast=-1;
function initCurl(){curlProgram=program(gl,SH.CURL_VS,SH.WATER_FS,'kinematic curling sheet');curlLoc=locations(gl,curlProgram,['uView','uProj',...Object.keys(waterLoc).filter(k=>k.startsWith('u'))]);curlVao=gl.createVertexArray();curlBuffer=gl.createBuffer();curlIndex=gl.createBuffer();gl.bindVertexArray(curlVao);gl.bindBuffer(gl.ARRAY_BUFFER,curlBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,curlIndex);gl.bindVertexArray(null);}
function updateCurl(time){
 const verts=[],indices=[],counts=[0,0,0],N=innerWidth<760?72:120,K=12,level=waterLevel(time,config),travel=((time/config.period)%1+1)%1,dir=flowDirection(config.swellDir),gains=[config.curlOuter,config.curlMiddle,config.curlInner];
 for(let layer=0;layer<3;layer++){
  if(gains[layer]<.001)continue;
  for(let a=0;a<N;a++){
   const theta=(a+.5)/N*TAU,nx=Math.cos(theta),nz=Math.sin(theta),facing=smooth(-.1,.7,-(nx*dir[0]+nz*dir[1]));
   if(facing<.06)continue;
   const r0=islandRadius(theta)+(3-layer)*5.6-travel*5.6;
   const w=waveAt(nx*r0,nz*r0,time,config);if(w.depth<.12)continue;
   const gain=gains[layer]*(.7+.3*Math.sin(theta*3+time*.52)),H=Math.min(1.25,w.depth*.67)*config.swell*gain*facing;
   if(H<.055)continue;const start=verts.length/8;
   for(let side=0;side<2;side++)for(let j=0;j<=K;j++){
    const angle=(a+side)/N*TAU,u=j/K;let rr,yy;
    if(u<=.5){const t=u*2;rr=r0+config.curlShoulder*(1-t);yy=level+H*Math.sin(t*Math.PI*.5);}
    else{const t=(u-.5)*2,A=t*Math.PI*1.02;rr=r0-config.curlLip*gain*Math.sin(A);yy=level+H-H*.50*(1-Math.cos(A));}
    const x=Math.cos(angle)*rr,z=Math.sin(angle)*rr,bed=bedHeight(x,z);
    verts.push(x,yy,z,0,0,0,Math.pow(u,2)*.52,Math.max(.01,yy-bed));
   }
   for(let j=0;j<K;j++){
    const a0=start+j,b=a0+1,c=a0+K+1,d=c+1;
    for(const [A,B,C] of [[a0,c,b],[b,c,d]]){
     const u=[0,1,2].map(k=>verts[B*8+k]-verts[A*8+k]),v=[0,1,2].map(k=>verts[C*8+k]-verts[A*8+k]),n=cross3(u,v);
     if(Math.hypot(...n)<1e-8)continue;indices.push(A,B,C);counts[layer]++;
     for(const id of [A,B,C])for(let k=0;k<3;k++)verts[id*8+3+k]+=n[k];
    }
   }
  }
 }
 for(let i=0;i<verts.length;i+=8){const n=normalize3(verts.slice(i+3,i+6));for(let k=0;k<3;k++)verts[i+3+k]=n[k];}
 gl.bindBuffer(gl.ARRAY_BUFFER,curlBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
 gl.bindVertexArray(curlVao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,curlIndex);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);gl.bindVertexArray(null);
 curlCount=indices.length;qa.curlLayerTriangles=counts;qa.curlUpdateCount=(qa.curlUpdateCount||0)+1;curlLast=time;
}
function drawCurl(sun){if(!curlCount)return;const oldLoc=waterLoc,oldProgram=waterProgram,oldGeo=waterGeo;waterLoc=curlLoc;waterProgram=curlProgram;waterGeo={vao:curlVao,count:curlCount,triangles:curlCount/3};drawWater(sun);waterLoc=oldLoc;waterProgram=oldProgram;waterGeo=oldGeo;}
function disposeGeo(g){if(!g)return;gl.deleteVertexArray(g.vao);if(g.vbo)gl.deleteBuffer(g.vbo);if(g.ibo)gl.deleteBuffer(g.ibo);}
function rebuildWorld(){
 rebuildDefinitions(config);
 for(const geo of [terrainGeo,rocksGeo,ringGeo,logsGeo])disposeGeo(geo);
 const mobile=innerWidth<760;terrainGeo=gridMesh(gl,mobile?160:260,mobile?160:260,DOMAIN.minX,DOMAIN.maxX,DOMAIN.minZ,DOMAIN.maxZ,bedHeight,0);
 const rg=rockGeometry(COAST_ROCKS);rocksGeo=mesh(gl,rg.data,rg.indices);rockField=compileRockHeight(rg,256,256);
 if(!rockTexture)rockTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,rockTexture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,rockField.w,rockField.h,0,gl.RED,gl.FLOAT,rockField.top);
 ringGeo=rockMesh(gl,FIRE_RING);logsGeo=logMesh(gl);fireY=FIRE_CENTER[1];
 Object.assign(qa,{rockCount:COAST_ROCKS.length,fireRingRockCount:FIRE_RING.length,logCount:LOGS.length,fireSources:FIRE_SOURCES.length,rockDegenerateTriangles:rg.degenerate,treeCount:0,geometryRebuilds:(qa.geometryRebuilds||0)+1});
 geometryDirty=false;opaqueDirty=true;curlLast=-1;
}

function frame(now){
 requestAnimationFrame(frame);
 if(!coastVisible||document.hidden){lastFrame=now;return}
 const raw=Math.max(0,(now-lastFrame)/1000),elapsed=Math.min(raw,.1);lastFrame=now;uiClock=now/1000;
 const oldResize=resizePending;if(resizePending)resize();if(geometryDirty)rebuildWorld();
 let changed=opaqueDirty||oldResize||!!cameraTween||config.autoOrbit>0;
 if(cameraTween){const t=clamp((now-cameraTween.start)/(config.cameraTransition*1000),0,1),e=t*t*(3-2*t),a=cameraTween.a,b=cameraTween.b;
 camera.target=a.target.map((x,i)=>mix(x,b.target[i],e));camera.yaw=mix(a.yaw,b.yaw,e);camera.pitch=mix(a.pitch,b.pitch,e);camera.distance=mix(a.distance,b.distance,e);camera.fov=mix(a.fov,b.fov,e);opaqueDirty=true;if(t===1)cameraTween=null;}
 if(config.autoOrbit>0&&!config.paused){camera.yaw+=config.autoOrbit*Math.PI/180*elapsed;opaqueDirty=true;}
 if(!config.paused){
  accumulator+=elapsed;qa.displayLagSkippedSeconds+=Math.max(0,raw-elapsed);
  while(accumulator>=qa.fixedStepS){physicalTime+=qa.fixedStepS;accumulator-=qa.fixedStepS;fieldAccumulator+=qa.fixedStepS;particleAccumulator+=qa.fixedStepS;}
  if(fieldAccumulator>=.12){updateFields(fieldAccumulator,physicalTime);fieldAccumulator=0;}
  while(particleAccumulator>=1/30){updateParticles(1/30,physicalTime);particleAccumulator-=1/30;}
  changed=true;
 }
 updateCamera(canvas.width/canvas.height);
 if(changed){
  if(curlLast<0||Math.abs(physicalTime-curlLast)>1/24||opaqueDirty)updateCurl(physicalTime);
  qa.drawCalls=0;qa.triangles=0;
  if(opaqueDirty||(!config.paused&&now-lastOpaque>300))renderOpaque(now);else qa.opaqueCacheReuses++;
  blitOpaque();const sun=sunDirection();if(config.waterVisible){drawWater(sun);drawCurl(sun)}drawMedia();qa.sceneFrames=(qa.sceneFrames||0)+1;
 }
 const flowing=config.glassSpeed>0&&config.glassFlow>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(changed||glassDirty||flowing)copyScene(true);else{metrics(now);return}
 frameCount++;qa.frames++;qa.physicalTime=physicalTime;qa.uiTime=uiClock;qa.glError=gl.getError();
 if(qa.glError!==gl.NO_ERROR){qa.glErrors??=[];if(qa.glErrors.length<20)qa.glErrors.push({frame:qa.frames,code:qa.glError});}
 if(now-fpsClock>=1000){fpsValue=frameCount*1000/(now-fpsClock);qa.fps=fpsValue;frameCount=0;fpsClock=now;}
 metrics(now);if(query.has('qa')&&!qaScheduled&&qa.frames>5){qaScheduled=true;captureVisualProbe();}
}
async function init(){
 progress.textContent='建立海岛、数值水体与玻璃管线';
 gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:query.has('qa'),powerPreference:'default'});
 if(!gl)throw Error('当前浏览器未提供 WebGL2');qa.webgl2=true;
 skyProgram=program(gl,SH.SKY_VS,SH.SKY_FS,'sky');solidProgram=program(gl,SH.SOLID_VS,SH.SOLID_FS,'solid');waterProgram=program(gl,SH.WATER_VS,SH.WATER_FS,'water');mediaProgram=program(gl,SH.MEDIA_VS,SH.MEDIA_FS,'media');copyProgram=program(gl,SH.COPY_VS,SH.COPY_FS,'glass');
 const common=['uTime','uSeaLevel','uSwell','uPeriod','uWind'];
 copyLoc=locations(gl,copyProgram,['uColor','uDepth','uFinal','uGlassCount','uGlassRects[0]','uViewport','uUiTime']);
 skyLoc=locations(gl,skyProgram,[...common,'uCamForward','uCamRight','uCamUp','uSunDir','uAspect','uTanFov','uExposure','uMode']);
 solidLoc=locations(gl,solidProgram,[...common,'uView','uProj','uCamera','uSunDir','uFirePos','uFireIntensity','uFirePositions[0]','uFireCount','uExposure','uWet','uRockHeight','uDomain','uMode']);
 waterLoc=locations(gl,waterProgram,[...common,'uView','uProj','uCamera','uSunDir','uFirePositions[0]','uFireCount','uFireIntensity','uResolution','uScene','uFoam','uSceneDepth','uRockHeight','uDomain','uClarity','uFoamGain','uRefraction','uExposure','uMode']);
 mediaLoc=locations(gl,mediaProgram,['uView','uProj','uResolution','uExposure','uTime']);emptyVao=gl.createVertexArray();
 syncParams();rebuildWorld();const mobile=innerWidth<760;waterGeo=waterMesh(gl,mobile?184:300,mobile?184:300);
 foamTexture=makeR8(gl,FIELD_W,FIELD_H,foamBytes);wetTexture=makeR8(gl,FIELD_W,FIELD_H,wetBytes);
 mediaVao=gl.createVertexArray();mediaBuffer=gl.createBuffer();gl.bindVertexArray(mediaVao);gl.bindBuffer(gl.ARRAY_BUFFER,mediaBuffer);gl.bufferData(gl.ARRAY_BUFFER,particleData.byteLength,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(0,1);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(1,1);gl.bindVertexArray(null);
 initCurl();installUI();installCamera();
 addEventListener('resize',()=>{resizePending=true;glassDirty=true});document.addEventListener('visibilitychange',()=>lastFrame=performance.now());
 setView(query.get('view')||'overview',true);resize();updateCamera(canvas.width/canvas.height);
 // Warm-up is explicit simulation history, not a backdrop or image sequence.
 for(let t=-16;t<0;t+=.16)updateParticles(.16,t);qa.mediaWarmupSeconds=16;
 for(let t=-3;t<0;t+=.25)updateFields(.25,t);qa.foamWarmupSeconds=3;
 updateCurl(0);qa.ready=true;qa.parameterCount=PARAMS.length;qa.parameterPages=3;
 const api={qa,getState:()=>({version:VERSION,physicalTime,config:{...config},composition:{rockCount:qa.rockCount,fireSources:qa.fireSources,smokeSources:qa.smokeSourceCount,smokeExtentMeters:qa.smokeExtentMeters,curlLayerTriangles:qa.curlLayerTriangles},model:'kinematic surface and overhang sheets; transported coverage and particles; no 3D conservative solver'}),setConfig:applyParam,setView,setPage,setWaterMode,
 pause:()=>{config.paused=true;$('pause').textContent='继续运行'},play:()=>{config.paused=false;$('pause').textContent='暂停';lastFrame=performance.now()},
 captureVisualProbe,sampleRock:(x,z)=>rockField.sample(x,z),sampleWater:(x,z,t=physicalTime)=>waveAt(x,z,t,config),sampleWind:(x,y,z,t=physicalTime)=>windAt(x,y,z,t,config),getSources:()=>FIRE_SOURCES.map(s=>[...s]),
 policy:{imageGenerationMode:false,persistentImageAssets:0,treeCount:0,full3DFluid:false},params:PARAMS};
 window.OceanIsland=window.OceanCoast=window.OceanCoastR012=window.OceanMotherR018=api;loading.classList.add('done');lastFrame=performance.now();requestAnimationFrame(frame);
}
init().catch(fail);
