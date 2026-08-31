import {SPEC,clamp,heightAt,makeRecipe,CASES} from './fields.mjs';
import {terrainVS,terrainFS,waterVS,waterFS,skyVS,skyFS} from './shaders.mjs';
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function matrix(eye,target,aspect){const z=norm(eye.map((x,i)=>x-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);const v=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);const f=1/Math.tan(48*Math.PI/360),near=.35,far=7200;const p=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);return {vp:multiply(p,v),right:x,up:y,forward:z.map(q=>-q)}}
function shader(gl,kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl,vs,fs){const p=gl.createProgram(),a=shader(gl,gl.VERTEX_SHADER,vs),b=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.deleteShader(a);gl.deleteShader(b);return p}
export class Renderer{
 constructor(canvas,onChange){
  this.canvas=canvas;this.onChange=onChange;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!this.gl)throw Error('需要支持 WebGL2 的浏览器与图形设备');
  const gl=this.gl;this.terrainProgram=program(gl,terrainVS,terrainFS);this.waterProgram=program(gl,waterVS,waterFS);this.skyProgram=program(gl,skyVS,skyFS);
  this.sharedIndex=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.sharedIndex);const idx=new Uint32Array(128*128*6);let k=0;for(let z=0;z<128;z++)for(let x=0;x<128;x++){let a=z*129+x;idx.set([a,a+129,a+1,a+1,a+129,a+130],k);k+=6}gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  this.tiles=[];this.water=null;this.ponds=null;this.settings={color:1,wet:1,gray:0};this.target=[0,55,-50];this.yaw=.62;this.pitch=.30;this.distance=910;this.frames=0;this.frameTimes=[];this.drawCalls=0;this.triangles=0;this.state='empty';this.uniforms=new Map();this.keys=new Set();this.installInput();this.loop=this.loop.bind(this);requestAnimationFrame(this.loop);
 }
 uniform(p,key){let m=this.uniforms.get(p);if(!m){m={};this.uniforms.set(p,m)}if(!(key in m))m[key]=this.gl.getUniformLocation(p,key);return m[key]}
 async load(data){
  await this.drainGPU();
  const gl=this.gl;for(const t of this.tiles){gl.deleteVertexArray(t.vao);gl.deleteBuffer(t.vbo)}this.tiles=[];
  for(const m of [this.water,this.ponds])if(m){gl.deleteVertexArray(m.vao);for(const b of m.buffers)gl.deleteBuffer(b)}this.water=this.ponds=null;
  this.recipe=makeRecipe(data.audit.caseId,data.audit.seed);this.audit=data.audit;this.state='uploading';
  for(let i=0;i<data.tiles.length;i++){
   const t=data.tiles[i],vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,t.buffer,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.sharedIndex);
   gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,1,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.SHORT,true,16,4);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,16,12);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.UNSIGNED_BYTE,true,16,10);
   this.tiles.push({vao,vbo,x:t.x,z:t.z,cy:(t.lo+t.hi)/2,radius:Math.hypot(64,64,(t.hi-t.lo)/2)});
   if(i%32===0)await new Promise(r=>setTimeout(r,0));
  }
  this.water=this.createWater(data.water);if(data.ponds.indices.length)this.ponds=this.createWater(data.ponds);
  gl.bindVertexArray(null);const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('GPU 上传失败 '+error);
  this.state='ready';this.bookmark('overview');this.frameTimes=[];this.frames=0;this.lastSignature=null;
 }
 gpuIdle(){if(!this.gpuFence)return true;const gl=this.gl,result=gl.clientWaitSync(this.gpuFence,0,0);if(result===gl.WAIT_FAILED)throw Error('GPU 同步失败');if(result===gl.TIMEOUT_EXPIRED)return false;gl.deleteSync(this.gpuFence);this.gpuFence=null;this.completedFrames=(this.completedFrames||0)+1;this.lastGpuCompletionMs=performance.now()-this.gpuStart;return true}
 async drainGPU(){const start=performance.now();while(!this.gpuIdle()){if(performance.now()-start>90000)throw Error('图形设备未能在预算内完成固定精度帧');await new Promise(r=>setTimeout(r,16))}}
 async waitForFrame(){const before=this.frames,start=performance.now();this.lastSignature=null;while(this.frames<=before||!this.gpuIdle()){if(this.state==='error')throw Error(this.error||'渲染失败');if(performance.now()-start>90000)throw Error('固定精度帧未完成');await new Promise(r=>setTimeout(r,16))}return {state:this.snapshot(),lost:this.gl.isContextLost(),error:this.gl.getError()}}
 createWater(m){const gl=this.gl,vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);for(const [location,array,size]of [[0,m.positions,3],[1,m.depths,1]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0)}const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);return{vao,buffers,count:m.indices.length}}
 eye(){const s=Math.cos(this.pitch)*this.distance;return [this.target[0]+Math.sin(this.yaw)*s,this.target[1]+Math.sin(this.pitch)*this.distance,this.target[2]+Math.cos(this.yaw)*s]}
 protectCamera(){if(!this.recipe)return;this.target[0]=clamp(this.target[0],-820,820);this.target[2]=clamp(this.target[2],-820,820);this.distance=clamp(this.distance,4,1500);this.pitch=clamp(this.pitch,.025,1.18);const e=this.eye();if(Math.abs(e[0])<1024&&Math.abs(e[2])<1024){const floor=heightAt(this.recipe,e[0],e[2])+1.8;if(e[1]<floor)this.target[1]+=floor-e[1]}}
 bookmark(which){
  const id=this.recipe?.id||'karst';
  const sets={karst:{overview:[[0,70,-170],.70,.35,1050],close:[[254,126,-234],.92,.19,260],water:[[50,18,-70],.66,.16,260]},river:{overview:[[0,22,-155],.59,.48,1020],close:[[-28,18,110],.48,.105,195],water:[[70,18,-55],.50,.18,410]},paddy:{overview:[[270,30,270],.15,.71,690],close:[[295,37,350],.45,.20,175],water:[[0,16,0],.35,.31,480]}};
  let s=sets[id][which]||sets[id].overview;this.target=[...s[0]];this.yaw=s[1];this.pitch=s[2];this.distance=s[3];this.protectCamera();this.onChange?.();
 }
 installInput(){const c=this.canvas;this.pointers=new Map();let previous=null;
  c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,[e.clientX,e.clientY]);previous={x:e.clientX,y:e.clientY,button:e.button};c.classList.add('dragging')});
  c.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;const old=this.pointers.get(e.pointerId),other=[...this.pointers.entries()].find(([k])=>k!==e.pointerId);if(other){const before=Math.hypot(old[0]-other[1][0],old[1]-other[1][1]),now=Math.hypot(e.clientX-other[1][0],e.clientY-other[1][1]);if(now>1)this.distance*=before/now}else if(previous){const dx=e.clientX-previous.x,dy=e.clientY-previous.y;if(previous.button===2||e.shiftKey){const a=this.yaw,s=this.distance*.0011;this.target[0]-=(dx*Math.cos(a)+dy*Math.sin(a))*s;this.target[2]-=(-dx*Math.sin(a)+dy*Math.cos(a))*s}else{this.yaw-=dx*.004;this.pitch+=dy*.003}}
   this.pointers.set(e.pointerId,[e.clientX,e.clientY]);previous={x:e.clientX,y:e.clientY,button:previous?.button||0};this.protectCamera()});
  const end=e=>{this.pointers.delete(e.pointerId);previous=null;c.classList.remove('dragging')};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
  c.addEventListener('wheel',e=>{e.preventDefault();this.distance*=Math.exp(clamp(e.deltaY,-120,120)*.0016);this.protectCamera()},{passive:false});
  c.addEventListener('dblclick',e=>this.focusAt(e.clientX,e.clientY));
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;this.keys.add(e.code);if(e.code==='KeyR')this.bookmark('overview')});window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.keys.clear());
 }
 focusAt(cx,cy){if(!this.recipe)return;const box=this.canvas.getBoundingClientRect(),nx=((cx-box.left)/box.width*2-1)*box.width/box.height,ny=1-(cy-box.top)/box.height*2,e=this.eye(),m=matrix(e,this.target,box.width/box.height),f=Math.tan(48*Math.PI/360),d=norm(m.forward.map((x,i)=>x+nx*f*m.right[i]+ny*f*m.up[i]));let last=0;
  for(let t=1;t<3600;t+=5){const p=e.map((x,i)=>x+d[i]*t);if(Math.abs(p[0])>1023||Math.abs(p[2])>1023)continue;if(p[1]<=heightAt(this.recipe,p[0],p[2])){let a=last,b=t;for(let j=0;j<14;j++){const q=(a+b)/2,k=e.map((x,i)=>x+d[i]*q);if(k[1]>heightAt(this.recipe,k[0],k[2]))a=q;else b=q}this.target=e.map((x,i)=>x+d[i]*((a+b)/2));this.distance=clamp((a+b)/2,8,600);this.protectCamera();return}last=t}
 }
 setCommon(p,vp,eye){const gl=this.gl;gl.useProgram(p);gl.uniformMatrix4fv(this.uniform(p,'uVP'),false,vp);gl.uniform3fv(this.uniform(p,'uEye'),eye);gl.uniform1f(this.uniform(p,'uColor'),this.settings.color);gl.uniform1f(this.uniform(p,'uWet'),this.settings.wet);gl.uniform1f(this.uniform(p,'uGray'),this.settings.gray)}
 render(){if(!this.gpuIdle())return false;const gl=this.gl,c=this.canvas,w=Math.max(1,c.clientWidth),h=Math.max(1,c.clientHeight);if(c.width!==w||c.height!==h){c.width=w;c.height=h}gl.viewport(0,0,w,h);gl.clearColor(.72,.77,.79,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(this.skyProgram);gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);if(this.state!=='ready')return true;
  const eye=this.eye(),m=matrix(eye,this.target,w/h),vp=m.vp,planes=[];for(const [row,sign]of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){const p=[vp[3]+sign*vp[row],vp[7]+sign*vp[4+row],vp[11]+sign*vp[8+row],vp[15]+sign*vp[12+row]],l=Math.hypot(...p.slice(0,3));planes.push(p.map(a=>a/l))}
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.setCommon(this.terrainProgram,vp,eye);let calls=1,tri=0;
  for(const t of [...this.tiles].sort((a,b)=>(a.x+64-eye[0])**2+(a.z+64-eye[2])**2-((b.x+64-eye[0])**2+(b.z+64-eye[2])**2))){if(planes.some(p=>p[0]*(t.x+64)+p[1]*t.cy+p[2]*(t.z+64)+p[3]<-t.radius))continue;gl.uniform2f(this.uniform(this.terrainProgram,'uOrigin'),t.x,t.z);gl.bindVertexArray(t.vao);gl.drawElements(gl.TRIANGLES,128*128*6,gl.UNSIGNED_INT,0);calls++;tri+=128*128*2}
  this.setCommon(this.waterProgram,vp,eye);for(const [pond,msh]of [[0,this.water],[1,this.ponds]]){if(!msh)continue;gl.uniform1f(this.uniform(this.waterProgram,'uPond'),pond);gl.bindVertexArray(msh.vao);gl.drawElements(gl.TRIANGLES,msh.count,gl.UNSIGNED_INT,0);calls++;tri+=msh.count/3}
  gl.bindVertexArray(null);this.drawCalls=calls;this.triangles=tri;this.frames++;this.gpuStart=performance.now();this.gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();return true;
 }
 loop(t){const elapsed=this.lastTime?Math.min((t-this.lastTime)/1000,.1):0;this.lastTime=t;
  if(this.keys.size&&this.state==='ready'){const speed=Math.max(12,this.distance*.2)*elapsed;let sx=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),sz=(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0);this.target[0]+=(Math.cos(this.yaw)*sx+Math.sin(this.yaw)*sz)*speed;this.target[2]+=(-Math.sin(this.yaw)*sx+Math.cos(this.yaw)*sz)*speed;this.protectCamera()}
  const sig=JSON.stringify([this.state,this.target,this.yaw,this.pitch,this.distance,this.settings,this.canvas.clientWidth,this.canvas.clientHeight]);const changed=sig!==this.lastSignature;let submitted=false;const start=performance.now();try{this.gpuIdle();if(changed){submitted=this.render();if(submitted)this.lastSignature=sig}}catch(e){this.state='error';this.error=e.message;console.error(e)}const done=performance.now();if(submitted&&this.state==='ready'){this.frameTimes.push({time:t,cpuMs:done-start});if(this.frameTimes.length>180)this.frameTimes.shift()}requestAnimationFrame(this.loop)
 }
 snapshot(){const f=this.frameTimes,seconds=f.length>1?(f.at(-1).time-f[0].time)/1000:0;return {state:this.state,caseId:this.recipe?.id,grid:2049,spacingM:1,geometryVertices:this.audit?.gridVertices,terrainTriangles:this.audit?.terrainTriangles,geometryCameraDependent:false,geometryDeviceDependent:false,textureCount:0,lodCount:0,drawCalls:this.drawCalls,visibleTriangles:this.triangles,frameCount:this.frames,gpuFramesCompleted:this.completedFrames||0,gpuFramePending:!!this.gpuFence,lastGpuCompletionMs:this.lastGpuCompletionMs||null,fps:seconds?(f.length-1)/seconds:null,eye:this.eye(),target:[...this.target],error:this.error||null}}
}
