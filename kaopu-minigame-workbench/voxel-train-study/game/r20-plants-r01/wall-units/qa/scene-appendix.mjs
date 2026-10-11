// Test-only response appendix. No disk application edits.
window.__wallQA={ready:false};
(async()=>{
 try {
 const prefix=new URL('./wall-units/',import.meta.url).pathname;
 const [{createNativeWallUnitFixtures},{pinnedDependencies},{createMaterialLibrary}]=await Promise.all([
 import(prefix+'wall-native.mjs'),import(prefix+'native-codec/codec.mjs'),import('./street/materials.mjs')]);
 const dependencyBytes={};
 for(const dep of pinnedDependencies()){
 const url=dep.id==='host-street-materials'?new URL('./street/materials.mjs',import.meta.url):new URL(prefix+dep.id,location.href);
 const response=await fetch(url); if(!response.ok)throw Error('Dependency read '+dep.id);dependencyBytes[dep.id]=new Uint8Array(await response.arrayBuffer());
 }
 const fixture=await createNativeWallUnitFixtures({THREE,createMaterialLibrary,dependencyBytes,origin:[-10,.081,10],readSampleBytes:async name=>{
 const r=await fetch(prefix+'native-codec/samples/'+name);if(!r.ok)throw Error('Native sample read '+name);return new Uint8Array(await r.arrayBuffer());}});
 scene.add(fixture.root);fixture.update(game.view().elapsed,{wetness:.25});
 const gpuErrors=[]; renderer.debug.onShaderError=(gl,program,vs,fs)=>gpuErrors.push({program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs)});
 const initial=window.__trainDriver.getState();
 function pose(position,target,fov=42){
 camera.position.fromArray(position);cameraTarget.fromArray(target);camera.lookAt(cameraTarget);camera.fov=fov;camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();viewControls.markPreset();
 $('startScreen').hidden=true;$('pauseScreen').hidden=true;needsRender=false;fixture.update(game.view().elapsed,{wetness:.25});renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
 return {camera:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,measure:fixture.measure(),gpuErrors,programs:renderer.info.programs?.map(p=>({name:p.name,diagnostics:p.diagnostics?{runnable:p.diagnostics.runnable,programLog:p.diagnostics.programLog}:null}))};
 }
 window.__wallQA={ready:true,pose,open:value=>{fixture.handles[1].setDoorOpen(value);return pose(camera.position.toArray(),cameraTarget.toArray(),camera.fov);},receipt:()=>({hostVersion:initial.version||window.__trainDriver.version,sourceCamera:initial.camera,measure:fixture.measure(),proofs:fixture.handles.map(h=>h.proof),gpuErrors,clock:game.view().elapsed,atmosphere:atmosphere.proof,renderer:window.__trainDriver.getState().rendererName,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),fixture};
 }catch(e){window.__wallQA={ready:false,error:e.stack||String(e)};console.error(e);}
})();
