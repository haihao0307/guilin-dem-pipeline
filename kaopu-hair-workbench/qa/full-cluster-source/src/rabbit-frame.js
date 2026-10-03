'use strict';
// KAOPU offline/interaction adapter. Original renderer and shader module text is unchanged.
const ROLE = window.name;
const B = parent.WORKBENCH_BUNDLE;
const registry = Object.create(null), cache = Object.create(null);
const send = (type, data={}) => parent.postMessage({kaopu:true,role:ROLE,type,...data}, '*');
window.onerror=(message,source,line,col,error)=>send('error',{message:String(message)});
let seed=0x5eed1234;
Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
function normalize(id,base='') { const parts=(id.startsWith('.')?base.split('/').slice(0,-1).join('/')+'/'+id:id).split('/'); const out=[];for(const s of parts){if(s==='..')out.pop();else if(s&&s!=='.')out.push(s);}return out.join('/'); }
function get(id,base='') { id=normalize(id,base);if(id in cache)return cache[id];const d=registry[id];if(!d)throw Error('Missing embedded module: '+id);return cache[id]=d.factory(...d.deps.map(x=>get(x,id))); }
function jq(selector){const els=[...document.querySelectorAll(selector)];const o={show(){els.forEach(x=>x.style.display='');return o;},hide(){els.forEach(x=>x.style.display='none');return o;},css(k,v){els.forEach(x=>x.style[k]=v);return o;},html(v){els.forEach(x=>x.textContent=v);return o;}};return o;}
cache.jquery=jq;
for(const [id,source] of Object.entries(B.modules)){
  const define=(deps,factory)=>{if(typeof deps==='function'){factory=deps;deps=[];}registry[id]={deps,factory};};define.amd={};
  // This executes only pinned, embedded teacher modules; there are no external dependencies.
  new Function('define',source+'\n//# sourceURL=teacher/'+id+'.js')(define);
}
const JsonLoader=get('framework/JsonDataLoader');
JsonLoader.load=(url,callback)=>{if(!(url in B.assets))throw Error('Missing embedded model '+url);setTimeout(()=>callback(JSON.parse(B.assets[url])),0);};
const TextureLoader=get('framework/UncompressedTextureLoader'),loadTexture=TextureLoader.load;
TextureLoader.load=(url,callback)=>{if(!(url in B.assets))throw Error('Missing embedded texture '+url);return loadTexture.call(TextureLoader,B.assets[url],callback);};
// Compatibility repair: inactive GLSL attributes return -1; original truthy checks
// attempt to bind them and produce INVALID_VALUE. Bind only active attributes.
// Original source files, shader text, mesh bytes and material equations remain unchanged.
const FullModel=get('framework/FullModel');
function bindActive(shader,name,buffer,size){const location=shader[name];if(Number.isInteger(location)&&location>=0){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,size*Float32Array.BYTES_PER_ELEMENT,0);}}
FullModel.prototype.bindBuffersExtended=function(shader){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.bufferIndices);for(const [name,buffer,size]of [['rm_Vertex',this.bufferStrides,3],['rm_TexCoord0',this.UVs,2],['rm_Normal',this.bufferNormals,3],['rm_C_Normal',this.bufferCombNormals,3],['rm_Tangent',this.bufferTangents,3]])bindActive(shader,name,buffer,size);};
FullModel.prototype.bindFinsBuffersExtended=function(shader){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.finBufferIdices);for(const [name,buffer,size]of [['rm_Vertex',this.finBufferPos,3],['rm_Normal',this.finBufferNormals,3],['rm_C_Normal',this.finBufferCombedNormals,3],['rm_TexCoord0',this.finUVs,2],['rm_Extrudable',this.finExtrudableBuffer,1]])bindActive(shader,name,buffer,size);};
FullModel.prototype.bindTransformFeedbackBuffers=function(shader,type){gl.bindBuffer(gl.ARRAY_BUFFER,this.TFOutput);gl.bufferData(gl.ARRAY_BUFFER,type?this.shellVertexDataLength:this.finVertexDataLength,gl.STATIC_DRAW);for(const [name,buffer]of [['rm_Vertex',type?this.bufferStrides:this.finBufferPos],['rm_Normal',type?this.bufferNormals:this.finBufferNormals],['rm_C_Normal',type?this.bufferCombNormals:this.finBufferCombedNormals]])bindActive(shader,name,buffer,3);};
const furAppearance=installRabbitFurShaderAdapter({role:ROLE,getModule:get,getGL:()=>window.gl});
const FurRenderer=get('FurRenderer'), Presets=get('FurPresets');
const renderer=window.renderer=new FurRenderer();
const canvas=document.getElementById('canvasGL');
let frame=null, frames=0, active=true, mode='orbit', auto=false, orbitSpeed=.12, orbitLast=null, cameraEpoch=0;
let meshLoading=false, pendingMesh=null;
// Original has no animated fur update. Render on demand to avoid continuous GPU work at rest.
renderer.boundTick=()=>requestDraw();
renderer.resizeCanvas=function(){const limit=window.gl?Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS)):8192;const scale=Math.min(window.devicePixelRatio||1,limit/Math.max(1,this.canvas.clientWidth,this.canvas.clientHeight));const w=Math.max(1,Math.round(this.canvas.clientWidth*scale)),h=Math.max(1,Math.round(this.canvas.clientHeight*scale));if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;};
function canDraw(){return !document.hidden&&(active||meshLoading||frames<2);}
function cancelDraw(){if(frame!==null)cancelAnimationFrame(frame);frame=null;orbitLast=null;}
function sendCamera(){send('camera',{angles:renderer.dragAngles.slice(),size:renderer.size,orbitEpoch:cameraEpoch});}
function orbitState(){return {playing:auto,speed:orbitSpeed};}
function setOrbit(values={}){if('speed'in values&&(!Number.isFinite(values.speed)||![.06,.12,.24].includes(values.speed)))throw Error('Invalid orbit speed');if('speed'in values)orbitSpeed=values.speed;if('playing'in values)auto=!!values.playing&&!document.hidden&&ROLE==='candidate'&&parent.platform?.module==='rabbit';orbitLast=null;cameraEpoch++;if(auto)requestDraw();else if(!canDraw())cancelDraw();return orbitState();}
function pauseOrbit(reason='manual'){setOrbit({playing:false});if(parent.rabbitUI)parent.rabbitUI.pauseOrbit();else send('orbit-paused',{reason});}
function draw(now){frame=null;if(!canDraw()){orbitLast=null;return;}const start=performance.now();let moved=false;if(auto&&renderer.loaded&&active){if(orbitLast!==null){const dt=Math.min(.1,Math.max(0,(now-orbitLast)/1000));renderer.dragAngles[1]=(renderer.dragAngles[1]+orbitSpeed*dt)%(Math.PI*2);moved=dt>0;}orbitLast=now;}else orbitLast=null;renderer.resizeCanvas();renderer.drawScene();renderer.animate();if(renderer.loaded){frames++;const err=gl.getError();if(err)send('gl-error',{code:err});send('frame',{frames,ms:Math.round((performance.now()-start)*10)/10,width:canvas.width,height:canvas.height});if(frames===1)requestDraw();}if(moved)sendCamera();if(auto&&renderer.loaded&&active)requestDraw();}
function requestDraw(){if(frame===null&&canDraw())frame=requestAnimationFrame(draw);}
renderer.onPresetLoaded=()=>{meshLoading=false;send('ready',{state:state(),mesh:renderer.currentPreset.mesh,vertices:renderer.models.get(renderer.currentPreset.mesh).numVertices});requestDraw();if(pendingMesh){const next=pendingMesh;pendingMesh=null;if(next!==renderer.currentPreset.mesh)queueMicrotask(()=>changeMesh(next));}};
function changeMesh(mesh){if(meshLoading){pendingMesh=mesh;return;}if(renderer.currentPreset?.mesh===mesh){send('ready',{state:state(),mesh});return;}meshLoading=true;Presets._current=mesh==='cloth'?1:0;renderer.loadPreset(Presets.current());const deadline=performance.now()+30000;const check=setInterval(()=>{if(!renderer.loadingNextFur){clearInterval(check);requestDraw();}else if(performance.now()>deadline){clearInterval(check);meshLoading=false;send('error',{message:'模型纹理加载超时，请重新打开页面。'});}},25);}
renderer.onInitError=()=>{document.getElementById('alertError').hidden=false;send('error',{message:'此浏览器未提供 WebGL 2，无法运行真实 3D。请用支持 WebGL 2 的浏览器打开。'});};
const props=['layers','hairLength','curlyness','shellTextureSize','finTextureSize','persistence','lacunarity','lightIntensity','ambientStrength','diffusePower','specularPower','renderFur','renderFins','renderShells','finOpacity','proceduralText'];
function state(){return {mesh:renderer.currentPreset?.mesh,...Object.fromEntries(props.map(k=>[k,renderer[k]])),furColor:renderer.furColor?.slice(),lightPos:renderer.lightPos.slice(),angles:renderer.dragAngles.slice(),size:renderer.size,combRadius:renderer.combRadius,maskWidth:furAppearance.getWidth()};}
function apply(values){if('maskWidth'in values)furAppearance.setWidth(values.maskWidth);for(const key of props){if(key in values){renderer[key]=values[key];if(key==='persistence'||key==='lacunarity')renderer.recalculateNoiseText=true;}}if(values.furColor)renderer.furColor=values.furColor.slice();if(values.lightPos)renderer.lightPos=values.lightPos.slice();if(values.angles)renderer.dragAngles=values.angles.slice();if('size'in values)renderer.size=values.size;if('combRadius'in values)renderer.combRadius=values.combRadius;renderer.curlyDegree=renderer.curlyness*renderer.CURLY_DEGREE_STEP;renderer.curlyFrequency=renderer.curlyness*renderer.CURLY_FREQ_STEP+renderer.CURLY_FREQ_OFFSET;renderer.curlyAmplitude=renderer.curlyness*renderer.CURLY_AMP_STEP+renderer.CURLY_AMP_OFFSET;requestDraw();}
function resetComb(){if(!renderer.loaded)return;for(const model of renderer.models.values()){for(const [source,dest] of [['bufferNormals','bufferCombNormals'],['finBufferNormals','finBufferCombedNormals']]){gl.bindBuffer(gl.COPY_READ_BUFFER,model[source]);gl.bindBuffer(gl.COPY_WRITE_BUFFER,model[dest]);const n=gl.getBufferParameter(gl.COPY_READ_BUFFER,gl.BUFFER_SIZE);gl.copyBufferSubData(gl.COPY_READ_BUFFER,gl.COPY_WRITE_BUFFER,0,0,n);}}gl.bindBuffer(gl.COPY_READ_BUFFER,null);gl.bindBuffer(gl.COPY_WRITE_BUFFER,null);requestDraw();}
window.addEventListener('message',event=>{if(event.source!==parent||!event.data.kaopu)return;const d=event.data;if(d.type==='apply')apply(d.values);else if(d.type==='mode'){if(d.mode===(parent.rabbitUI?.interactionMode??d.mode))setMode(d.mode);}else if(d.type==='reset-comb')resetComb();else if(d.type==='active'){active=!!d.active;if(!active){setOrbit({playing:false});clearPointers();cancelDraw();}if(canDraw())requestDraw();}else if(d.type==='snapshot')send('state',{state:state()});else if(d.type==='auto'){setOrbit({playing:d.active,...('speed'in d?{speed:d.speed}:{})});}else if(d.type==='resize')requestDraw();else if(d.type==='mesh')changeMesh(d.mesh);});
// Compact studio input adapter; original model, shaders and grooming functions stay unchanged.
const pointers=new Map();let gesture=null;
function point(e){const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top,w:rect.width,h:rect.height};}
function clearComb(){renderer.combing=false;renderer.mouseMoving=false;renderer.combAngle=0;}
function clearPointers(){const ids=[...pointers.keys()];pointers.clear();gesture=null;clearComb();for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);requestDraw();}
function setMode(next){if(!['orbit','comb'].includes(next))throw Error('Invalid interaction mode');if(next===mode)return mode;clearPointers();mode=next;return mode;}
function beginGesture(){clearComb();const ps=[...pointers.values()];if(ps.length===1){const p=ps[0];renderer.mouseNDCPosition=[p.x/p.w*2-1,p.y/p.h*-2+1];renderer.mouseLastPosition=[p.x,p.y];}gesture=ps.length===2?{gap:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),size:renderer.size}:null;}
function endPointer(e){pointers.delete(e.pointerId);beginGesture();requestDraw();}
canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();pauseOrbit();canvas.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);beginGesture();if(pointers.size===1&&mode==='comb'&&ROLE==='candidate'){renderer.mouseNDCPosition=[p.x/p.w*2-1,p.y/p.h*-2+1];renderer.mouseLastPosition=[p.x,p.y];renderer.combing=true;requestDraw();}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=point(e),old=pointers.get(e.pointerId);pointers.set(e.pointerId,p);if(pointers.size===2){clearComb();const ps=[...pointers.values()],gap=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(gesture?.gap)renderer.size=Math.max(.3,Math.min(2.5,gesture.size*gap/gesture.gap));sendCamera();}
else if(pointers.size===1&&mode==='comb'&&ROLE==='candidate'){const nx=p.x/p.w*2-1,ny=p.y/p.h*-2+1;renderer.combViewDirection2D=[10*(nx-renderer.mouseNDCPosition[0]),10*(ny-renderer.mouseNDCPosition[1])];renderer.mouseNDCPosition=[nx,ny];renderer.mouseLastPosition=[p.x,p.y];renderer.combNDCRadius=renderer.combRadius/(p.w*.5);renderer.combAngle=.1;renderer.combing=true;renderer.mouseMoving=true;send('combed');}
else if(pointers.size===1){renderer.dragAngles[0]+=10/p.h*(p.y-old.y);renderer.dragAngles[1]+=10/p.h*(p.x-old.x);sendCamera();}requestDraw();});
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',()=>clearPointers());canvas.addEventListener('lostpointercapture',endPointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();pauseOrbit();renderer.size=Math.max(.3,Math.min(2.5,renderer.size-e.deltaY*.001));sendCamera();requestDraw();},{passive:false});
window.addEventListener('blur',clearPointers);document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseOrbit('hidden');clearPointers();cancelDraw();}else requestDraw();});window.addEventListener('pagehide',()=>{pauseOrbit('hidden');clearPointers();cancelDraw();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;pauseOrbit('context-lost');cancelDraw();send('error',{message:'WebGL 上下文已丢失；请重新打开页面。'});});
new ResizeObserver(requestDraw).observe(canvas);
window.runtime={furAppearance,state,apply,resetComb,requestDraw,renderer,clearPointers,setMode,setOrbit,get mode(){return mode;},get orbit(){return orbitState();},get cameraEpoch(){return cameraEpoch;},get pointerCount(){return pointers.size;},get frameCount(){return frames;}};

renderer.resizeRenderFBO=function(){gl.bindTexture(gl.TEXTURE_2D,this.targetTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.canvas.width,this.canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.bindRenderbuffer(gl.RENDERBUFFER,this.depthRenderBuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_STENCIL,this.canvas.width,this.canvas.height);gl.bindRenderbuffer(gl.RENDERBUFFER,null);};
const originalVignette=renderer.drawVignette;
renderer.drawVignette=function(texture){if(texture===this.targetTexture&&(this.combing||this.resizingComb)){const sx=this.canvas.width/this.canvas.clientWidth,sy=this.canvas.height/this.canvas.clientHeight;this.VignetteShader.use();gl.uniform1f(this.VignetteShader.mouseRadio,this.combRadius*sx);gl.uniform2f(this.VignetteShader.mousePos,this.mouseLastPosition[0]*sx,(this.canvas.clientHeight-this.mouseLastPosition[1])*sy);}return originalVignette.call(this,texture);};
renderer.init('canvasGL',true);
// Match the teacher's steady-state fin blend on the very first visible frame.
if(window.gl)gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
