/** A view controller only: no body, cloth, topology, rest material or quality-gate edits. */
export class BoundedCache extends Map {
 constructor(limit){super();this.limit=limit;}
 get(key){if(!super.has(key))return;const value=super.get(key);super.delete(key);super.set(key,value);return value;}
 set(key,value){super.delete(key);super.set(key,value);while(this.size>this.limit)super.delete(this.keys().next().value);return this;}
}
export function installGarmentDisplay(THREE,viewer,{meshes,onGraphics=()=>{}}){
 const canvas=viewer.canvas;let currentView='three',focus='scene',capturing=false,disposed=false,raf=0;
 const drawable=()=>meshes().filter(m=>m?.geometry&&m.visible!==false);
 function bounds(which=focus){
  const all=drawable();if(which!=='garment'||!all.length)all.push(viewer.mesh);
  const box=new THREE.Box3();
  for(const m of all){m.updateMatrixWorld(true);m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw Error('DISPLAY_BOUNDS_INVALID');
  return box;
 }
 function frame(which=currentView,mode=focus){
  if(disposed||viewer.lost)return false;
  currentView=which;focus=mode;if(which==='face'){viewer.view('face');return true;}
  const box=bounds(),center=box.getCenter(new THREE.Vector3()),angle=which==='side'?Math.PI/2:which==='rear'?Math.PI:which==='three'?.48:0;
  const outward=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),right=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
  const ty=Math.tan(viewer.camera.fov*Math.PI/360),tx=ty*viewer.camera.aspect;let distance=.1;
  // Fit every box corner in the actual camera basis; a wide/long hem cannot be cropped.
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){
   const q=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,q.dot(outward)+Math.max(Math.abs(q.dot(right))/tx,Math.abs(q.y)/ty)*1.12);
  }
  viewer.camera.position.copy(center).addScaledVector(outward,distance);viewer.orbit.target.copy(center);viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();viewer.orbit.update();viewer.render();return true;
 }
 function audit(){
  const out={contextAvailable:!!viewer.active&&!viewer.lost,view:currentView,focus,garmentMeshes:drawable().length,framed:false,maxAbsNDC:0};
  if(!out.contextAvailable)return out;if(currentView==='face'){out.reason='intentional face close-up';return out;}
  const box=bounds();viewer.camera.updateMatrixWorld(true);
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){
   const q=new THREE.Vector3(x,y,z).project(viewer.camera);out.maxAbsNDC=Math.max(out.maxAbsNDC,Math.abs(q.x),Math.abs(q.y));
  }
  out.framed=out.maxAbsNDC<=1.00001;return out;
 }
 function thumbnail(){
  if(disposed||viewer.lost)throw Error('GRAPHICS_UNAVAILABLE_FOR_THUMBNAIL');
  const size=viewer.renderer.getSize(new THREE.Vector2()),ratio=viewer.renderer.getPixelRatio(),camera=viewer.cameraState(),aspect=viewer.camera.aspect,oldView=currentView,oldFocus=focus;
  capturing=true;
  try{viewer.renderer.setPixelRatio(1);viewer.renderer.setSize(320,400,false);viewer.camera.aspect=.8;frame('three','garment');viewer.render();return canvas.toDataURL('image/png');}
  finally{viewer.renderer.setPixelRatio(ratio);viewer.renderer.setSize(size.x,size.y,false);viewer.camera.aspect=aspect;viewer.restoreCamera(camera);currentView=oldView;focus=oldFocus;capturing=false;}
 }
 const onLost=()=>onGraphics(false),onRestored=()=>{if(disposed)return;for(const m of drawable()){for(const a of Object.values(m.geometry.attributes))a.needsUpdate=true;for(const mat of(Array.isArray(m.material)?m.material:[m.material]))mat.needsUpdate=true;}frame();onGraphics(true);};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
 const observer=new ResizeObserver(()=>{if(capturing||disposed)return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!disposed){viewer.resize();frame();}});});observer.observe(viewer.container);
 const show=e=>{if(e.persisted&&!disposed){viewer.resize();frame();onGraphics(!viewer.lost);}};addEventListener('pageshow',show);
 viewer.captureNativeThumbnail=thumbnail;
 return {frame,thumbnail,audit,focus(mode){return frame(currentView,mode);},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);removeEventListener('pageshow',show);delete viewer.captureNativeThumbnail;}};
}
