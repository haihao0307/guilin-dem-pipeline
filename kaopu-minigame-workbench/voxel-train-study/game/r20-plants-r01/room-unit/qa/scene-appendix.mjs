// Appended only to the existing game response in unpublished QA.
window.__roomQA={ready:false};
(async()=>{try{
 const prefix=new URL('./room-unit/',import.meta.url).pathname;
 const [{loadNativeDwelling},{pinnedDependencies},{createMaterialLibrary}]=await Promise.all([import(prefix+'room-native.mjs'),import(prefix+'native-codec/codec.mjs'),import('./street/materials.mjs')]);
 const deps={};for(const dep of pinnedDependencies()){const r=await fetch(prefix+dep.id.replace('__','/'));if(!r.ok)throw Error('Missing room dependency '+dep.id);deps[dep.id]=new Uint8Array(await r.arrayBuffer());}
 const nativeBytes=await(await fetch(prefix+'native-codec/samples/old-dwelling.KaoPu')).arrayBuffer();
 const room=await loadNativeDwelling(nativeBytes,{THREE,createHostMaterialLibrary:createMaterialLibrary,dependencyBytes:deps});
 room.root.position.set(-10,.17,13);scene.add(room.root);room.update(game.view().elapsed,{wetness:.38});
 const errors=[];renderer.debug.onShaderError=(gl,program,vs,fs)=>errors.push({program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs)});
 function pose(p,t,fov=40,cutaway=false){room.setInspectionCutaway(cutaway);camera.position.fromArray(p);cameraTarget.fromArray(t);camera.lookAt(cameraTarget);camera.fov=fov;camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();viewControls.markPreset();$('startScreen').hidden=true;$('pauseScreen').hidden=true;needsRender=false;room.update(game.view().elapsed,{wetness:.38});renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);return {camera:camera.position.toArray(),target:cameraTarget.toArray(),fov,cameraCutaway:cutaway,errors};}
 const diagnostics=()=>renderer.info.programs?.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??true,programLog:p.diagnostics?.programLog??''}));
 function cost(){
 const sample=visible=>{room.root.visible=visible;renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);renderer.getContext().finish();let ms=[];for(let i=0;i<5;i++){const t=performance.now();renderer.render(scene,camera);renderer.getContext().finish();ms.push(performance.now()-t);}return{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,renderMs:ms,meanRenderMs:ms.reduce((a,b)=>a+b,0)/ms.length};};
 const baseline=sample(false),withRoom=sample(true);return{sameCamera:true,baseline,withRoom,delta:{drawCalls:withRoom.drawCalls-baseline.drawCalls,triangles:withRoom.triangles-baseline.triangles,meanRenderMs:withRoom.meanRenderMs-baseline.meanRenderMs},meaning:'one CI SwiftShader same-view synchronous render comparison, not physical-phone FPS'};
 }
 window.__roomQA={ready:true,pose,room,cost,diagnostics,open:value=>{room.setDoorOpen(value);return pose(camera.position.toArray(),cameraTarget.toArray(),camera.fov,false);},receipt:()=>({nativeBytes:nativeBytes.byteLength,measure:room.measure(),proof:room.proof,errors,renderer:window.__trainDriver.getState().rendererName,hostVersion:window.__trainDriver.version,atmosphere:atmosphere.proof})};
}catch(e){window.__roomQA={ready:false,error:e.stack||String(e)};console.error(e);}})();
