// Appended only to the existing game response in unpublished QA.
window.__roomQA={ready:false};
(async()=>{try{
 const prefix=new URL('./room-unit-r02/',import.meta.url).pathname;
 const [{loadNativeDwelling},{pinnedDependencies}]=await Promise.all([import(prefix+'room-native.mjs'),import(prefix+'native-codec/codec.mjs')]);
 const deps={};for(const dep of pinnedDependencies()){const r=await fetch(prefix+dep.id.replaceAll('__','/'));if(!r.ok)throw Error('Missing room dependency '+dep.id);deps[dep.id]=new Uint8Array(await r.arrayBuffer());}
 const nativeBytes=await(await fetch(prefix+'native-codec/samples/original-material-dwelling.KaoPu')).arrayBuffer();
 const room=await loadNativeDwelling(nativeBytes,{THREE,dependencyBytes:deps});
 room.root.position.set(-10,.17,13);scene.add(room.root);room.update(game.view().elapsed);
 const sourcePixelBudget={staticPixels:300000,interactionPixels:210000,source:'Brick Mother R3.12 original draw()'};
 function applyOriginalPixelBudget(){const w=wrap.clientWidth,h=wrap.clientHeight;const ratio=Math.min(devicePixelRatio||1,1.1,Math.sqrt(sourcePixelBudget.staticPixels/(w*h)));renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);return{...sourcePixelBudget,width:renderer.domElement.width,height:renderer.domElement.height,ratio};}
 const errors=[];renderer.debug.onShaderError=(gl,program,vs,fs)=>errors.push({program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs)});
 function pose(p,t,fov=40,cutaway=false){room.setInspectionCutaway(cutaway);camera.position.fromArray(p);cameraTarget.fromArray(t);camera.lookAt(cameraTarget);camera.fov=fov;camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();viewControls.markPreset();$('startScreen').hidden=true;$('pauseScreen').hidden=true;needsRender=false;room.update(game.view().elapsed);renderer.shadowMap.needsUpdate=true;const budget=applyOriginalPixelBudget(),t0=performance.now();renderer.render(scene,camera);renderer.getContext().finish();const synchronizedRenderMs=performance.now()-t0;return {budget,synchronizedRenderMs,camera:camera.position.toArray(),target:cameraTarget.toArray(),fov,cameraCutaway:cutaway,errors,png:renderer.domElement.toDataURL('image/png')};}
 const diagnostics=()=>renderer.info.programs?.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??true,programLog:p.diagnostics?.programLog??''}));
 function cost(){
 const meshes=[];room.root.traverse(o=>{if(o.isMesh)meshes.push([o,o.visible]);});
 const budget=applyOriginalPixelBudget();
 const sample=mode=>{room.root.visible=mode!=='baseline';for(const [o,visible]of meshes){const isWall=o.material.name.startsWith('R312-');o.visible=visible&&(mode==='full'||mode==='baseline'||(mode==='walls'&&isWall)||(mode==='wood'&&!isWall));}renderer.shadowMap.needsUpdate=true;const t=performance.now();renderer.render(scene,camera);renderer.getContext().finish();return{mode,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,synchronizedRenderMs:performance.now()-t};};
 const baseline=sample('baseline'),wood=sample('wood'),walls=sample('walls'),full=sample('full');for(const [o,v]of meshes)o.visible=v;room.root.visible=true;
 return{sameCamera:true,camera:camera.position.toArray(),target:cameraTarget.toArray(),budget,samplesPerCondition:1,baseline,wood,walls,full,delta:{drawCalls:full.drawCalls-baseline.drawCalls,triangles:full.triangles-baseline.triangles,synchronizedRenderMs:full.synchronizedRenderMs-baseline.synchronizedRenderMs},meaning:'One CI SwiftShader synchronized render per visibility condition; isolated wall/wood visibility costs are not additive and are not hardware-phone FPS'};
 }
 window.__roomQA={ready:true,pose,room,cost,diagnostics,open:value=>{room.setDoorOpen(value);return pose(camera.position.toArray(),cameraTarget.toArray(),camera.fov,false);},receipt:()=>({nativeBytes:nativeBytes.byteLength,measure:room.measure(),proof:room.proof,errors,renderer:window.__trainDriver.getState().rendererName,hostVersion:window.__trainDriver.version,atmosphere:atmosphere.proof})};
}catch(e){window.__roomQA={ready:false,error:e.stack||String(e)};console.error(e);}})();
