// R05 native picking uses deformed guide locations and a camera-facing grab plane.
let grabState=null;
const ray=new THREE.Raycaster(),pointerNDC=new THREE.Vector2();
function guidePoint(i,t){
 const x=dynamics.positions[i*3],z=dynamics.positions[i*3+2],g=Math.max(0,Math.min(16,Math.round((x/.052+.5)*16))),s=t*.92;
 const e=Math.sin(Math.PI*s),c=Math.sin(Math.PI*t)**2,d=dynamics.sample(i,t);
 return new THREE.Vector3(x*(1-.28*t*t)+p.wave*.024*Math.sin(6*s)*e+.0035*Math.sin(8*s+g*.83)*c+d[0],.128-.268*s+d[1],z*(1-.18*t)+p.wave*.018*Math.sin(7.2*s+.4)*e+.0055*Math.sin(5.7*s+g*.83)*c+d[2]);
}
function pointerRay(e){const b=r.domElement.getBoundingClientRect();pointerNDC.set((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2);ray.setFromCamera(pointerNDC,camera);return ray.ray;}
function hitGuide(e){
 updateCamera();const box=r.domElement.getBoundingClientRect();let best=32*32,result=null;
 for(let i=0;i<85;i++)for(let n=2;n<=32;n++){const t=n/32,world=guidePoint(i,t),screen=world.clone().project(camera);if(screen.z<-1||screen.z>1)continue;
  const d=(box.x+(screen.x*.5+.5)*box.width-e.clientX)**2+(box.y+(.5-screen.y*.5)*box.height-e.clientY)**2;
  if(d<best){best=d;result={i,t,world};}
 }return result;
}
r.domElement.onpointerdown=e=>{
 if(!brushMode){oldDown(e);return;}const hit=hitGuide(e);if(!hit)return;
 const weights=new Float32Array(85),x=dynamics.positions[hit.i*3],z=dynamics.positions[hit.i*3+2];
 for(let i=0;i<85;i++)weights[i]=Math.exp(-((dynamics.positions[i*3]-x)**2)/.00007-((dynamics.positions[i*3+2]-z)**2)/.00002);
 const normal=camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.world),anchor=new THREE.Vector3();
 if(!pointerRay(e).intersectPlane(plane,anchor))return;grabState={...hit,weights,plane,anchor,initial:dynamics.sample(hit.i,hit.t)};motion=null;r.domElement.setPointerCapture(e.pointerId);
 dynamics.setGrab(weights,hit.t,grabState.initial);wakeDynamics();
};
r.domElement.onpointermove=e=>{
 if(!grabState){if(!brushMode)oldMove(e);return;}const world=new THREE.Vector3();if(!pointerRay(e).intersectPlane(grabState.plane,world))return;
 const target=world.sub(grabState.anchor).add(new THREE.Vector3(...grabState.initial));dynamics.setGrab(grabState.weights,grabState.t,target.toArray());wakeDynamics();
};
function releaseGrab(){if(grabState){grabState=null;dynamics.release();wakeDynamics();}oldUp();}
r.domElement.onpointerup=r.domElement.onpointercancel=releaseGrab;r.domElement.addEventListener('lostpointercapture',releaseGrab);
$('impulseMotion').onclick=()=>{dynamics.impulse();wakeDynamics();};
$('pipeline').onchange=e=>setPipeline(e.target.value==='merged');
function materialPassMode(){for(const m of[layerMat,layer8Mat,depthMat,pairMat])if(m)m.forceSinglePass=optimized;}
materialPassMode();
function setPipeline(v){optimized=!!v;packed=optimized&&supports8;materialPassMode();radMat.fragmentShader=optimized?fastNodeRadianceFragment:nodeRadianceFragment;radMat.needsUpdate=true;$('pipeline').value=optimized?'merged':'reference';resize();shadowDirty=shadeDirty=posDirty=true;}
// Measurements are opt-in, serialized and excluded from normal runtime.
let profiling=false,passTimings=[];
const rawFullpass=fullpass,rawGeometry=geometry,rawShadows=shadows;
function timed(name,fn){
 if(!profiling)return fn();gl.finish();const auto=r.info.autoReset;r.info.autoReset=false;
 const calls=r.info.render.calls,triangles=r.info.render.triangles,start=performance.now();
 try{const v=fn();gl.finish();passTimings.push({name,wallMS:performance.now()-start,drawCalls:r.info.render.calls-calls,triangles:r.info.render.triangles-triangles});return v;}finally{r.info.autoReset=auto;}
}
fullpass=(mat,rt)=>timed(mat===positionMat?'positions':mat===radMat?'optics81':mat===resolveMat?'resolve':mat===outMat?'display':mat===packMat?'shadow_pack':'other_quad',()=>rawFullpass(mat,rt));
geometry=(mat,rt,clear=true)=>timed(mat===frontMat?'front_depth':mat===layer8Mat?'eight_layers_one_draw':'layer_group',()=>rawGeometry(mat,rt,clear));
shadows=()=>timed('shadows_inclusive',()=>rawShadows());
