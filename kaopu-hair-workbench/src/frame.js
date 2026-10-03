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
const FurRenderer=get('FurRenderer'), Presets=get('FurPresets');
const renderer=window.renderer=new FurRenderer();
const canvas=document.getElementById('canvasGL');
let scheduled=false, frames=0, active=true, mode='orbit', auto=false;
let meshLoading=false, pendingMesh=null;
// Original has no animated fur update. Render on demand to avoid continuous GPU work at rest.
renderer.boundTick=()=>requestDraw();
renderer.resizeCanvas=function(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;};
function draw(){scheduled=false;if(!active)return; const start=performance.now();renderer.resizeCanvas();renderer.drawScene();renderer.animate();if(renderer.loaded){frames++; const err=gl.getError();if(err)send('gl-error',{code:err});send('frame',{frames,ms:Math.round((performance.now()-start)*10)/10,width:canvas.width,height:canvas.height});if(frames===1)requestDraw();}if(auto&&renderer.loaded){renderer.dragAngles[1]+=.004;send('camera',{angles:renderer.dragAngles.slice(),size:renderer.size});requestDraw();}}
function requestDraw(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
renderer.onPresetLoaded=()=>{meshLoading=false;send('ready',{state:state(),mesh:renderer.currentPreset.mesh,vertices:renderer.models.get(renderer.currentPreset.mesh).numVertices});requestDraw();if(pendingMesh){const next=pendingMesh;pendingMesh=null;if(next!==renderer.currentPreset.mesh)queueMicrotask(()=>changeMesh(next));}};
function changeMesh(mesh){if(meshLoading){pendingMesh=mesh;return;}if(renderer.currentPreset?.mesh===mesh){send('ready',{state:state(),mesh});return;}meshLoading=true;Presets._current=mesh==='cloth'?1:0;renderer.loadPreset(Presets.current());const deadline=performance.now()+30000;const check=setInterval(()=>{if(!renderer.loadingNextFur){clearInterval(check);requestDraw();}else if(performance.now()>deadline){clearInterval(check);meshLoading=false;send('error',{message:'模型纹理加载超时，请重新打开页面。'});}},25);}
renderer.onInitError=()=>{document.getElementById('alertError').hidden=false;send('error',{message:'此浏览器未提供 WebGL 2，无法运行真实 3D。请用支持 WebGL 2 的浏览器打开。'});};
const props=['layers','hairLength','curlyness','shellTextureSize','finTextureSize','persistence','lacunarity','lightIntensity','ambientStrength','diffusePower','specularPower','renderFur','renderFins','renderShells','finOpacity','proceduralText'];
function state(){return {mesh:renderer.currentPreset?.mesh,...Object.fromEntries(props.map(k=>[k,renderer[k]])),furColor:renderer.furColor?.slice(),lightPos:renderer.lightPos.slice(),angles:renderer.dragAngles.slice(),size:renderer.size,combRadius:renderer.combRadius};}
function apply(values){for(const key of props){if(key in values){renderer[key]=values[key];if(key==='persistence'||key==='lacunarity')renderer.recalculateNoiseText=true;}}if(values.furColor)renderer.furColor=values.furColor.slice();if(values.lightPos)renderer.lightPos=values.lightPos.slice();if(values.angles)renderer.dragAngles=values.angles.slice();if('size'in values)renderer.size=values.size;if('combRadius'in values)renderer.combRadius=values.combRadius;renderer.curlyDegree=renderer.curlyness*renderer.CURLY_DEGREE_STEP;renderer.curlyFrequency=renderer.curlyness*renderer.CURLY_FREQ_STEP+renderer.CURLY_FREQ_OFFSET;renderer.curlyAmplitude=renderer.curlyness*renderer.CURLY_AMP_STEP+renderer.CURLY_AMP_OFFSET;requestDraw();}
function resetComb(){if(!renderer.loaded)return;for(const model of renderer.models.values()){for(const [source,dest] of [['bufferNormals','bufferCombNormals'],['finBufferNormals','finBufferCombedNormals']]){gl.bindBuffer(gl.COPY_READ_BUFFER,model[source]);gl.bindBuffer(gl.COPY_WRITE_BUFFER,model[dest]);const n=gl.getBufferParameter(gl.COPY_READ_BUFFER,gl.BUFFER_SIZE);gl.copyBufferSubData(gl.COPY_READ_BUFFER,gl.COPY_WRITE_BUFFER,0,0,n);}}gl.bindBuffer(gl.COPY_READ_BUFFER,null);gl.bindBuffer(gl.COPY_WRITE_BUFFER,null);requestDraw();}
window.addEventListener('message',event=>{if(event.source!==parent||!event.data.kaopu)return;const d=event.data;if(d.type==='apply')apply(d.values);else if(d.type==='mode')mode=d.mode;else if(d.type==='reset-comb')resetComb();else if(d.type==='active'){active=d.active;if(active)requestDraw();}else if(d.type==='snapshot')send('state',{state:state()});else if(d.type==='auto'){auto=d.active;requestDraw();}else if(d.type==='resize')requestDraw();else if(d.type==='mesh')changeMesh(d.mesh);});
const pointers=new Map();let startDistance=0,lastPosition;
function point(e){const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top,w:rect.width,h:rect.height};}
function endPointer(e){pointers.delete(e.pointerId);renderer.combing=false;renderer.mouseMoving=false;renderer.combAngle=0;lastPosition=null;requestDraw();}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);lastPosition=p;if(pointers.size===2){const a=[...pointers.values()];startDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}if(mode==='comb'&&ROLE==='candidate'){renderer.mouseNDCPosition=[p.x/p.w*2-1,p.y/p.h*-2+1];renderer.combing=true;renderer.mouseMoving=false;renderer.mouseLastPosition=[p.x,p.y];requestDraw();}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=point(e),old=pointers.get(e.pointerId);pointers.set(e.pointerId,p);if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(startDistance)renderer.size=Math.max(.3,Math.min(2.5,renderer.size*dist/startDistance));startDistance=dist;send('camera',{angles:renderer.dragAngles.slice(),size:renderer.size});}
else if(mode==='comb'&&ROLE==='candidate'){const nx=p.x/p.w*2-1,ny=p.y/p.h*-2+1;renderer.combViewDirection2D=[10*(nx-renderer.mouseNDCPosition[0]),10*(ny-renderer.mouseNDCPosition[1])];renderer.mouseNDCPosition=[nx,ny];renderer.mouseLastPosition=[p.x,p.y];renderer.combNDCRadius=renderer.combRadius/(p.w*.5);renderer.combAngle=.1;renderer.combing=true;renderer.mouseMoving=true;send('combed');}
else{renderer.dragAngles[0]+=10/p.h*(p.y-old.y);renderer.dragAngles[1]+=10/p.h*(p.x-old.x);send('camera',{angles:renderer.dragAngles.slice(),size:renderer.size});}requestDraw();});
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.size=Math.max(.3,Math.min(2.5,renderer.size-e.deltaY*.001));send('camera',{angles:renderer.dragAngles.slice(),size:renderer.size});requestDraw();},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;send('error',{message:'WebGL 上下文已丢失；请重新打开页面。'});});
new ResizeObserver(requestDraw).observe(canvas);
window.runtime={state,apply,resetComb,requestDraw,renderer,get frameCount(){return frames;}};
renderer.init('canvasGL',true);
// Match the teacher's steady-state fin blend on the very first visible frame.
if(window.gl)gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
