// Only this workbench's resources. Back/forward-cache gets pause, not disposal.
function suspendRuntime(){setRotate(false);gate?.pause();}
function resumeRuntime(){if(disposed)return;gate?.resume();draw();}
function disposeRuntime(reason='page-exit'){
 if(disposed)return;const begin=performance.now();disposed=true;job++;busy=false;ready=false;rotating=false;if(rotateRAF)cancelAnimationFrame(rotateRAF);rotateRAF=0;gate?.dispose();
 const failures=[],dispose=(name,fn)=>{try{fn();}catch(e){failures.push(name+': '+String(e.message||e));}};
 // Never force loss for a hidden tab or a persisted pagehide.
 dispose('context',()=>renderer.forceContextLoss());dispose('orbit',()=>orbit.dispose());dispose('opacity',()=>opacity?.dispose());
 dispose('fibers',()=>handle?.dispose());dispose('brow-fibers',()=>browHandle?.dispose());dispose('native-head',()=>nativeHead?.dispose());
 const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const m of Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[])materials.add(m);});
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)textures.add(u.value);}
 for(const t of textures)dispose('texture',()=>t.dispose());for(const g of geometries)dispose('geometry',()=>g.dispose());for(const m of materials)dispose('material',()=>m.dispose());
 for(const l of lamps)dispose('shadow',()=>l.shadow.dispose());dispose('renderer',()=>renderer.dispose());scene.clear();
 compiled=null;roots=null;skin=null;model=null;guideMesh=null;rootMesh=null;head=null;brows=null;nativeHead=null;handle=null;browHandle=null;groomCache?.close();globalThis.__HAIR_BOOT?.dispose?.();
 const receipt={reason,completed:true,elapsedMs:performance.now()-begin,geometryObjects:geometries.size,materialObjects:materials.size,textureObjects:textures.size,failures};
 runtimePerf.disposal=receipt;try{sessionStorage.setItem('kaopu.hair.l03.lastExit',JSON.stringify(receipt));}catch{}return receipt;
}
addEventListener('pagehide',event=>{if(event.persisted)suspendRuntime();else disposeRuntime('pagehide');});
addEventListener('pageshow',event=>{if(event.persisted)resumeRuntime();});
document.addEventListener('freeze',suspendRuntime);document.addEventListener('resume',resumeRuntime);
window.lengthGroom.lifecycle={dispose:disposeRuntime,suspend:suspendRuntime,resume:resumeRuntime};
