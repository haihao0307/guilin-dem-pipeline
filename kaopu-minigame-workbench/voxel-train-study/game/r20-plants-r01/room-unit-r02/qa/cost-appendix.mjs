// Diagnostic response appendix only; one shared renderer and no extra animation loop.
window.__roomCost={ready:false};
(async()=>{try{
 const {mountNativeDwelling}=await import('./room-unit-r02/host-qa.mjs');
 const room=await mountNativeDwelling({THREE,scene,position:[-10,.17,13]});room.root.visible=false;
 const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
 async function probe(){
  room.setInspectionCutaway(false);room.setDoorOpen(false);camera.position.set(-3.7,3.5,20.8);cameraTarget.set(-10,1.5,13);camera.lookAt(cameraTarget);camera.fov=43;camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();viewControls.markPreset();$('startScreen').hidden=true;$('pauseScreen').hidden=true;needsRender=false;
  const w=wrap.clientWidth,h=wrap.clientHeight,ratio=Math.min(devicePixelRatio||1,1.1,Math.sqrt(300000/(w*h)));renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
  const g=renderer.getContext(),pixels=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4),meshes=[];room.root.traverse(o=>{if(o.isMesh)meshes.push([o,o.visible]);});const samples=[];
  for(const mode of ['baseline','wood','walls']){
   room.root.visible=mode!=='baseline';for(const [o,visible]of meshes){const isWall=o.material.name.startsWith('R312-');o.visible=visible&&(mode==='baseline'||(mode==='walls'&&isWall)||(mode==='wood'&&!isWall));}
   renderer.shadowMap.needsUpdate=true;const start=performance.now();renderer.render(scene,camera);const submitMs=performance.now()-start;g.finish();const finishMs=performance.now()-start;g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,pixels);const completeReadbackMs=performance.now()-start;
   let checksum=0;for(let i=0;i<pixels.length;i+=113)checksum=(Math.imul(checksum,31)+pixels[i])>>>0;
   const sample={mode,submitMs,finishMs,completeReadbackMs,readBytes:pixels.byteLength,checksum,glError:g.getError(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,width:g.drawingBufferWidth,height:g.drawingBufferHeight};samples.push(sample);await window.__writeRoomCost(sample);
  }
  for(const [o,v]of meshes)o.visible=v;room.root.visible=false;
  return{samples,camera:camera.position.toArray(),target:cameraTarget.toArray(),pixelBudget:300000,shaderErrors:errors,measure:room.measure(),proof:room.proof,fullRoomSkipped:'A real full-room image already took 74.9 seconds at this pixel budget; no repeated full-room stress render',validMetric:'completeReadbackMs includes actual completed full RGBA readback; submit/finish are retained only to demonstrate the invalid earlier timing method',interactiveAcceptance:false};
 }
 window.__roomCost={ready:true,probe};
}catch(e){window.__roomCost={ready:false,error:e.stack||String(e)};console.error(e);}})();
