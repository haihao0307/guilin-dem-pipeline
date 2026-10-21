/* This module is bundled after the unchanged R07 runtime and its two native bindings. */
(() => {
  'use strict';
  const {NativeBinding,RigidPoseSampler,THREE}=BindingModule;
  const {NativeRig}=RigModule;
  const PROTOCOL='kaopu-motion-native@1';
  const state={phase:'loading',ready:false,errors:[],framesSubmitted:0,acceptedPoses:0,version:'NATIVE-MOTION-VIEWER-R01'};
  const status=document.getElementById('native-status');
  const sub=document.getElementById('native-status-detail');
  const started=performance.now();
  let binding,rig,sampler,viewer,model,skeleton,framePending=false,restSkin,lastReport,disposed=false,lastDebugAt=-Infinity,lastPixels;
  const notify=(type,data={})=>{if(parent!==window)parent.postMessage({protocol:PROTOCOL,type,...data},location.origin==='null'?'*':location.origin);};
  const describeError=error=>String(error?.stack||error?.message||error);
  function fail(error){
    const message=describeError(error);state.phase='error';state.ready=false;state.errors.push(message);
    window.__NATIVE_REPORT_BOOT_FAILURE__?.(String(error?.message||error));
    document.getElementById('native-loading').hidden=false;
    refreshDebug();
    notify('native-error',{message});return message;
  }
  function copyMatrices(matrices){return matrices.map(m=>Array.from(m));}
  function descriptor(){
    if(!state.ready)throw Error('Native person is not ready');
    return {schema:'kaopu/native-motion-rig@1',version:state.version,names:Array.from(rig.names),parents:Array.from(rig.parents),restMatrices:copyMatrices(rig.rest),
      matrixConvention:'row-major, matrices act on column vectors',units:'metre',coordinateSystem:'right-handed native Z-up',displayTransform:'[x,z,-y]',
      heightM:binding.height,floorOffsetM:binding.floorOffset,rootIndices:rig.order.filter(j=>rig.parents[j]<0),binding:{...binding.report},
      bindRevision:'HUMAN-INTEGRATED-R07@5543f756ca3af1428323696324303fa70b8de850/default-person',sourceHostSHA256:'d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a'};
  }
  function skeletonUpdate(){
    if(!skeleton)return;
    const a=skeleton.geometry.attributes.position.array;let k=0;
    for(const j of rig.order){const p=rig.parents[j];if(p<0)continue;for(const i of [p,j]){const m=rig.posedMatrices[i];a[k++]=m[3];a[k++]=m[11];a[k++]=-m[7];}}
    skeleton.geometry.attributes.position.needsUpdate=true;
    viewer.mesh.updateWorldMatrix(true,false);skeleton.matrix.copy(viewer.mesh.matrixWorld);
    skeleton.matrixWorldNeedsUpdate=true;
  }
  function renderNow(){
    if(disposed||!state.ready)return;
    skeletonUpdate();viewer.render();state.framesSubmitted++;
    if(performance.now()-lastDebugAt>2000)refreshDebug();
    notify('native-frame',{framesSubmitted:state.framesSubmitted,acceptedPoses:state.acceptedPoses,clockMS:performance.now(),measurement:'CPU render submission, not GPU completion'});
  }
  function renderSoon(){if(framePending||disposed)return;framePending=true;requestAnimationFrame(()=>{framePending=false;renderNow();});}
  function commit(matrices,{render=true}={}){
    if(!state.ready)throw Error('Native person is not ready');
    if(!Array.isArray(matrices)||matrices.length!==rig.count)throw Error('Expected 104 row-major skin matrices');
    const previous=copyMatrices(rig.skinMatrices);
    try{
      rig.applySkinMatrices(matrices);const checked=rig.validate();
      if(!checked.finite||checked.maxBoneLengthError>.0005||checked.maxOrthogonalityError>.001)
        throw Error('Pose rejected: fixed-bone/rigid-transform contract '+JSON.stringify(checked));
      binding.animate(rig.skinMatrices);lastReport=checked;state.acceptedPoses++;
      if(render)renderSoon();return{accepted:true,poseSequence:state.acceptedPoses,...checked};
    }catch(error){rig.applySkinMatrices(previous);binding.animate(rig.skinMatrices);throw error;}
  }
  function applyPose(pose,options){
    if(!pose||pose.q?.length!==rig.count*4||pose.p?.length!==rig.count*3)throw Error('Expected native skin-delta pose q[416], p[312]');
    if(!Array.from(pose.q).every(Number.isFinite)||!Array.from(pose.p).every(Number.isFinite))throw Error('Non-finite native pose');
    for(let j=0;j<rig.count;j++)if(Math.hypot(...Array.from(pose.q).slice(j*4,j*4+4))<1e-8)throw Error('Zero native quaternion');
    return commit(sampler.apply(pose),options);
  }
  function setRotations(rotations={},root=[0,0,0],options){
    const previous=copyMatrices(rig.skinMatrices);
    try{
      if(root.length!==3||!root.every(Number.isFinite))throw Error('Invalid native root translation');
      for(const r of rig.rotationDeltas)r.fill(0);rig.rootTranslation.splice(0,3,...root);
      for(const[name,value]of Object.entries(rotations)){
        if(!rig.index.has(name)||value.length!==3||!value.every(Number.isFinite))throw Error('Invalid native rotation vector '+name);
        rig.setRotation(name,...value);
      }
      rig.fk();const candidate=copyMatrices(rig.skinMatrices);rig.applySkinMatrices(previous);return commit(candidate,options);
    }catch(error){rig.applySkinMatrices(previous);throw error;}
  }
  function reset(){return commit(restSkin);}
  function setView(name='three'){
    if(!state.ready)throw Error('Native person is not ready');
    if(!['three','front','rear','side','face'].includes(name))throw Error('Unknown view');
    viewer.view(name);return {view:name};
  }
  function setSkeleton(enabled){if(!state.ready)throw Error('Native person is not ready');skeleton.visible=!!enabled;renderSoon();return{visible:skeleton.visible};}
  function visibleInScene(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
  function uniformValue(value){
    if(value==null||typeof value==='number'||typeof value==='string'||typeof value==='boolean')return value;
    if(value.isTexture)return{texture:true,width:value.image?.width,height:value.image?.height,type:value.type,format:value.format,version:value.version};
    if(value.toArray)return value.toArray();
    if(Array.isArray(value)||ArrayBuffer.isView(value))return value.length<=16?Array.from(value):{length:value.length};
    return String(value);
  }
  function graphicsDiagnostics(){
    if(!viewer?.renderer)return null;
    const renderer=viewer.renderer,gl=renderer.getContext(),lights=[];
    viewer.scene.traverse(object=>{if(object.isLight)lights.push({name:object.name||object.type,type:object.type,visible:object.visible,effectiveVisible:visibleInScene(object),intensity:object.intensity,color:object.color?.toArray(),groundColor:object.groundColor?.toArray(),position:object.position.toArray(),parent:object.parent?.name||object.parent?.type});});
    const live=Array.isArray(viewer.mesh.material)?viewer.mesh.material:[viewer.mesh.material];
    const materials=live.map(material=>{
      const properties=renderer.properties.get(material),program=properties.currentProgram||(properties.programs&&[...properties.programs.values()].at(-1));
      const vertex=program?.vertexShader?gl.getShaderSource(program.vertexShader)||'':'';
      const selected={};for(const[name,entry]of Object.entries(properties.uniforms||{}))if(/^(mrActive|ps[A-Z]|fb[A-Z]|csTone|csRoughness|csOil|uCShadowEnable|uFPass|uE6Enabled)/.test(name))selected[name]=uniformValue(entry.value);
      return{name:material.name||material.type,uuid:material.uuid,type:material.type,color:material.color?.toArray(),emissive:material.emissive?.toArray(),roughness:material.roughness,metalness:material.metalness,vertexColors:material.vertexColors,side:material.side,opacity:material.opacity,visible:material.visible,version:material.version,programId:program?.id,linked:program?.program?!!gl.getProgramParameter(program.program,gl.LINK_STATUS):false,programLog:program?.program?gl.getProgramInfoLog(program.program):'No compiled program',vertexLog:program?.vertexShader?gl.getShaderInfoLog(program.vertexShader):null,fragmentLog:program?.fragmentShader?gl.getShaderInfoLog(program.fragmentShader):null,nativeVertexDeclarations:vertex.split('uniform sampler2D mrRanges,mrEntries,mrBones;').length-1,uniforms:selected};
    });
    return{contextLost:gl.isContextLost(),glError:gl.getError(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,renderInfo:{...renderer.info.render},meshVisible:viewer.mesh.visible,meshMaterials:materials,lights,foldSettings:model?.foldProfile?.settings,cineSettings:model?.cineProfile?.settings,headSettings:window.headProceduralSkin?.settings?.(),bodySettings:window.bodyProceduralSkin?.settings?.(),centerPixels:lastPixels};
  }
  function probeCenterPixels(){
    const gl=viewer.renderer.getContext(),w=Math.min(64,gl.drawingBufferWidth),h=Math.min(64,gl.drawingBufferHeight),pixels=new Uint8Array(w*h*4);
    gl.readPixels(Math.floor((gl.drawingBufferWidth-w)/2),Math.floor((gl.drawingBufferHeight-h)/2),w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const min=[255,255,255],max=[0,0,0],sum=[0,0,0];let nearBlack=0;
    for(let i=0;i<pixels.length;i+=4){for(let k=0;k<3;k++){min[k]=Math.min(min[k],pixels[i+k]);max[k]=Math.max(max[k],pixels[i+k]);sum[k]+=pixels[i+k];}if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<8)nearBlack++;}
    lastPixels={region:'center 64px crop; diagnostic only, not visual acceptance',size:[w,h],min,max,mean:sum.map(v=>+(v/(w*h)).toFixed(2)),nearBlackFraction:+(nearBlack/(w*h)).toFixed(4),glError:gl.getError()};
  }
  function diagnostics(){return {...state,elapsedMS:performance.now()-started,rig:rig?rig.validate():null,binding:binding?.report,assets:window.__NATIVE_ASSETS__,lastReport,graphics:graphicsDiagnostics()};}
  function refreshDebug(){
    lastDebugAt=performance.now();const output=document.getElementById('native-debug-data');if(!output)return;
    try{output.textContent=JSON.stringify(diagnostics(),null,2);}catch(error){output.textContent=JSON.stringify({...state,diagnosticError:describeError(error)},null,2);}
  }
  let readyResolve,readyReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
  const api=window.NativeMotionViewer={ready,getRig:descriptor,setSkinMatrices:commit,applyPose,setRotations,reset,setView,setSkeleton,render:renderSoon,diagnostics,
    capturePose(){if(!state.ready)throw Error('Native person is not ready');const p=sampler.pack(rig.posedMatrices);return{q:Array.from(p.q),p:Array.from(p.p)};},
    sampleVertex(index){if(!state.ready||!Number.isInteger(index)||index<0||index>=binding.report.displayVertices)throw Error('Invalid display vertex');return binding.sampleVertex(index,true);}};
  document.getElementById('native-debug-refresh')?.addEventListener('click',()=>{if(state.ready){renderNow();probeCenterPixels();}refreshDebug();});
  addEventListener('message',async event=>{
    if(event.source!==parent&&event.source!==window)return;
    const m=event.data;if(!m||m.protocol!==PROTOCOL||!m.command)return;
    try{
      if(m.command!=='diagnostics')await ready;
      let result;
      switch(m.command){
        case'get-rig':result=descriptor();break;
        case'set-skin-matrices':result=commit(m.matrices,m.options);break;
        case'set-native-pose':result=applyPose(m.pose,m.options);break;
        case'set-rotations':result=setRotations(m.rotations,m.root,m.options);break;
        case'reset':result=reset();break;
        case'view':result=setView(m.view);break;
        case'skeleton':result=setSkeleton(m.enabled);break;
        case'capture-pose':result=api.capturePose();break;
        case'diagnostics':result=diagnostics();break;
        default:throw Error('Unknown native viewer command '+m.command);
      }
      event.source.postMessage({protocol:PROTOCOL,type:'native-response',id:m.id,ok:true,result},event.origin==='null'?'*':event.origin);
    }catch(error){event.source.postMessage({protocol:PROTOCOL,type:'native-response',id:m.id,ok:false,error:String(error.message||error)},event.origin==='null'?'*':event.origin);}
  });
  async function boot(){
    while(true){
      const qa=window.__IDENTITY_QA__;
      viewer=qa?.viewer?.();model=qa?.model?.();
      const errors=[...(window.__NATIVE_BOOT_ERRORS__||[]),...(window.__LIP_P3__?.errors||[]),...(window.__HEAD_PROC__?.errors||[])];
      if(errors.length)throw Error(errors.join('; '));
      if(window.__LIP_P3__?.ready&&window.__HEAD_PROC__?.gpuVerified&&viewer?.mesh&&model?.lastBodyDriver?.rig)break;
      if(performance.now()-started>180000)throw Error('完整原生人物在 180 秒内未完成初始化。载入已停止；可刷新重新尝试，已校验的资源会复用。');
      const s=window.__LIP_STARTUP__,stats=window.__LIP_P3__?.transport?.stats;
      status.textContent=s?.stage||'正在载入原生 R07 人物';
      sub.textContent=stats?`${(stats.verifiedBytes/1048576).toFixed(1)} MiB 已校验 · 完整人物与原始骨架`:'完整人物、皮肤与 104 骨架';
      notify('native-progress',{stage:status.textContent,detail:sub.textContent,elapsedMS:performance.now()-started});
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    window.lifelikeIdle?.pause?.(true);
    await Promise.all([viewer.skin.faceReady,viewer.skin.naturalEyesReady].filter(Boolean));
    if(model.state.owners.rig!=='anny')throw Error('Expected retained 104-bone Anny rig');
    binding=new NativeBinding(model,viewer);binding.activate(true);
    rig=new NativeRig({...binding.rig,stature:binding.height});
    if(rig.count!==104||binding.report.displayVertices!==266098)throw Error('Complete R07 geometry or rig contract changed');
    sampler=new RigidPoseSampler(binding.rig);rig.fk();restSkin=copyMatrices(rig.skinMatrices);
    const points=new Float32Array((rig.count-rig.order.filter(j=>rig.parents[j]<0).length)*6);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    skeleton=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x52d9bc,depthTest:false,transparent:true,opacity:.82}));
    skeleton.matrixAutoUpdate=false;skeleton.frustumCulled=false;skeleton.renderOrder=100;skeleton.visible=false;viewer.scene.add(skeleton);
    viewer.mesh.frustumCulled=false;
    state.ready=true;state.phase='validating-final-shaders';
    binding.animate(rig.skinMatrices);viewer.resize();viewer.view('three');renderNow();
    // The original R07 ready flag precedes NativeBinding's shader hook. Check
    // the actual final driver programs after both native materials are bound.
    const graphics=graphicsDiagnostics();
    for(const material of graphics.meshMaterials){
      if(!material.linked)throw Error('原生动作材质链接失败：'+material.name+' '+[material.programLog,material.vertexLog,material.fragmentLog].filter(Boolean).join(' '));
      if(material.nativeVertexDeclarations!==1)throw Error('原生骨骼着色器必须恰好接入一次：'+material.name+' / '+material.nativeVertexDeclarations);
    }
    if(graphics.contextLost||graphics.glError!==0)throw Error('原生人物最终 WebGL 帧错误：'+graphics.glError);
    probeCenterPixels();state.ready=true;state.phase='ready';state.readyMS=performance.now()-started;state.finalMaterialLinksVerified=true;refreshDebug();
    document.getElementById('native-loading').hidden=true;
    document.getElementById('native-corner').textContent='R07 · 原生完整人物 · 104 骨';
    readyResolve(descriptor());notify('native-ready',{rig:descriptor(),readyMS:state.readyMS});
    document.getElementById('canvas')?.addEventListener('webglcontextlost',()=>fail(Error('WebGL 2 graphics context lost')),{once:true});
    addEventListener('resize',()=>{viewer.resize();renderSoon();});
  }
  boot().catch(error=>{fail(error);readyReject(error);});
})();
