import {probeGPU,adapterRecord} from './gpu-environment.mjs';
import {digest,typed,initialState,differences,particleSafety,saveCommitted,rollbackDifference} from './audit.mjs';
import {sourceFitArguments} from './fixture/SourceFitActorBridge.mjs';

const statusElement=document.querySelector('#status');
const report={
  schema:'independent-original-gpucloth-d48/1',status:'READY',
  productionCandidate:false,visualAcceptance:false,performanceAcceptance:false,
  scope:'Original GPUCloth fixed-D source garment fitting only. Full canonical body collider; no GNM head/display render, animation, six-person scene or user-hardware performance acceptance.',
  frames:[],completedFrames:0,actualAdapter:null,deviceErrors:[],
  unmodifiedSolver:true,unmodifiedWGSL:true,wasmFallback:false,reducedClothUsed:false,
};
const emit=async(type,data,name)=>{
  if(type==='phase'||type==='frame-start'||type==='frame')statusElement.textContent=JSON.stringify(data,null,2);
  await globalThis.__GPU_D48_EMIT__({type,data,...(name?{name}:{})});
};
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};
async function checked(path,expected){
  const response=await fetch(path,{cache:'no-store'});
  requireValue(response.ok,'SOURCE_HTTP '+response.status+' '+path);
  const bytes=await response.arrayBuffer(),hash=await digest(bytes);
  requireValue(bytes.byteLength===expected.bytes&&hash===expected.sha256,'SOURCE_BYTES '+path);
  return bytes;
}
async function decompressed(bytes){
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
function stateRecord(world,gpu){
  const rejected=gpu?.rejectedState;
  let binary=null;
  if(rejected){
    const bytes=new Uint8Array(rejected.buffer,rejected.byteOffset,rejected.byteLength);
    let text='';
    for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
    binary={encoding:'base64-float32-native-little-endian',length:rejected.length,bytes:bytes.length,data:btoa(text)};
  }
  return {
    actorPositionsYupM:Array.from(world.actor.positions),bodyFaces:Array.from(world.body.faces),
    rejectedGPUState:binary,
    rejectedParticleLayout:binary?['p.x','p.y','p.z','weight','old.x','old.y','old.z','weight','v.x','v.y','v.z','padding']:null,
    items:world.solvers.map((s,i)=>({
      id:i?'P01':'T01',p:Array.from(s.p),v:Array.from(s.v),old:Array.from(s.old),
      output:Array.from(s.output),map:Array.from(s.map),faces:Array.from(s.faces),
      edges:s.edges.map(e=>({a:e.a,b:e.b,sourceRest:e.sourceRest,targetRest:e.targetRest,rest:e.rest})),
      pins:s.pins,seamPairs:s.seamPairs,
    })),
  };
}
function metrics(gpu){
  return {...gpu.metrics,config:{...gpu.config},validationError:gpu.validationError??null,deviceLost:gpu.lost??null};
}

globalThis.__GPU_D48_RUN__=async()=>{
  let world=null,gpu=null,stage='probe',attemptedFrame=0;
  const started=performance.now();
  try{
    report.status='PROBING_ADAPTER';
    report.probe=await probeGPU();
    await emit('probe',report.probe);
    if(!report.probe.eligible){
      report.status=report.probe.status;
      return report;
    }
    stage='frozen-source-and-input-verification';
    await emit('phase',{stage});
    const build=await(await fetch('./BUILD.json',{cache:'no-store'})).json();
    const lockBytes=await(await fetch('./SOURCE_LOCK.json',{cache:'no-store'})).arrayBuffer();
    requireValue(await digest(lockBytes)===build.sourceLockSHA256,'SOURCE_LOCK_SHA256');
    const lock=JSON.parse(new TextDecoder().decode(lockBytes));
    report.sourceHead=build.sourceHead;
    report.sourceLockSHA256=build.sourceLockSHA256;
    const verifiedSources=[];
    for(const row of lock.originalFiles){
      await checked('./original/'+row.path,row);
      verifiedSources.push({path:row.path,sha256:row.sha256,bytes:row.bytes,gitBlob:row.gitBlob});
    }
    const fixtures={};
    for(const row of lock.fixtureFiles)fixtures[row.path]=await checked('./'+row.path,row);
    const inputBytes=await decompressed(fixtures['fixture/D-inputs.json.gz']);
    requireValue(inputBytes.byteLength===lock.inputJSON.bytes&&await digest(inputBytes)===lock.inputJSON.sha256,'D_INPUT_DECOMPRESSED_SHA256');
    const input=JSON.parse(new TextDecoder().decode(inputBytes));
    const expected=JSON.parse(new TextDecoder().decode(fixtures['fixture/D-initial-hashes.json']));
    report.verifiedSources=verifiedSources;
    report.input={sha256:lock.inputJSON.sha256,bytes:inputBytes.byteLength,actor:input.actorId,look:input.lookId,grading:input.grading,heightEvidence:input.targetHeightEvidence,fullNativeHeightM:input.targetFullNativeHeightM};
    report.schedule=input.fixedSchedule;
    const fixed=input.fixedSchedule;
    requireValue(input.actorId==='D'&&fixed.frames===48&&fixed.fitFrames===32&&fixed.dtSeconds===1/60&&fixed.substepHz===240&&fixed.iterations===16&&fixed.guardIterations===12&&fixed.strainCeiling===1.45&&fixed.advanceMotion===false&&fixed.motion==='idle','FIXED_SCHEDULE_CHANGED');
    requireValue(input.body.count===9253&&input.body.faces.length===55248&&input.body.skinMatrices.length===104,'FULL_FIXED_BODY_REQUIRED');
    requireValue(input.rows.length===2&&input.rows[0].id==='T01'&&input.rows[1].id==='P01','ORIGINAL_TWO_GARMENTS_REQUIRED');
    requireValue(verifiedSources.some(r=>r.path==='gpu-cloth.mjs'&&r.sha256==='ae88c3615826d6f99f32576a84f447f8e5654492be8df7e66dee80b7032a80f4'),'ORIGINAL_GPU_SOURCE_CHANGED');
    requireValue(verifiedSources.some(r=>r.path==='gpu-cloth.wgsl'&&r.sha256==='bce15ca66c757abc1900e06eb63d3e33f0f7fa03b7e0185dc2fe9c0bc2b3c2f0'),'ORIGINAL_WGSL_CHANGED');

    const [{CoupledCloth},{BodySDF},{WaistAttachments},{GPUCloth}]=await Promise.all([
      import('./original/coupled-cloth.mjs'),import('./original/material-physics.mjs'),
      import('./original/waist-attachments.mjs'),import('./original/gpu-cloth.mjs'),
    ]);
    const metaRow=lock.originalFiles.find(r=>r.path===input.sdf.metadataPath);
    const gridRow=lock.originalFiles.find(r=>r.path===input.sdf.filePath);
    const meta=JSON.parse(new TextDecoder().decode(await checked('./original/'+metaRow.path,metaRow)));
    const grid=await decompressed(await checked('./original/'+gridRow.path,gridRow));
    const sdf=new BodySDF(meta,new Int16Array(grid),input.sdf.groundShiftM);
    requireValue(await digest(sdf.data)===input.sdf.decodedGridSHA256,'ORIGINAL_DECODED_SDF_MISMATCH');
    const args=sourceFitArguments(input,sdf);
    stage='cpu-initial-state-verification';
    await emit('phase',{stage});
    world=new CoupledCloth(args.rows,args.options);
    const neutralWaist=new WaistAttachments(world);
    const actualInitial=await initialState(world,neutralWaist,args.origin,args.target);
    const mismatch=differences(actualInitial,expected);
    report.initialState={matched:mismatch.length===0,mismatches:mismatch,actual:actualInitial};
    await emit('state',report.initialState,'cpu-initial-state');
    requireValue(mismatch.length===0,'ORIGINAL_CPU_INITIAL_STATE_HASH_MISMATCH');
    report.geometry={
      bodyVertices:input.body.count,bodyTriangles:world.body.faces.length/3,bones:world.actor.skin.length,
      garments:world.solvers.map((s,i)=>({id:input.rows[i].id,vertices:s.output.length/3,particles:s.count,triangles:world.staticRows[i].indices.length/3,edges:s.edges.length,bends:s.bends.length,pins:s.pins.length})),
      GNMHeadIncluded:false,geometryReduced:false,
    };
    stage='original-gpu-create';
    await emit('phase',{stage,initialStateMatched:true,geometry:report.geometry});
    const initStart=performance.now();
    gpu=await GPUCloth.create(world);
    report.gpuInitializeMS=performance.now()-initStart;
    report.actualAdapter=adapterRecord(gpu.adapter);
    report.actualDevice={features:[...gpu.device.features].sort(),storageBuffersPerShaderStage:gpu.device.limits.maxStorageBuffersPerShaderStage,maxStorageBufferBindingSize:gpu.device.limits.maxStorageBufferBindingSize,maxBufferSize:gpu.device.limits.maxBufferSize};
    gpu.device.addEventListener('uncapturederror',event=>{
      report.deviceErrors.push({message:event.error.message,name:event.error.constructor.name});
      void emit('phase',{stage:'device-error',error:report.deviceErrors.at(-1)});
    });
    requireValue(world.acceleration===gpu&&world.backend==='WebGPU coloured XPBD + same-frame triangle contacts','ORIGINAL_GPU_BACKEND_NOT_ACTIVE');
    requireValue(gpu.config.colouredDispatch===true&&gpu.config.bodyGather===true&&gpu.config.pairWG===true,'ORIGINAL_GPU_CONFIG_CHANGED');
    const gpuWaist={rowsSHA256:await digest(JSON.stringify(gpu.waist.rows)),previous:await typed(gpu.waist.previous,Float64Array),target:await typed(gpu.waist.target,Float64Array)};
    report.gpuWaistInitial={matched:differences(gpuWaist,expected.waist).length===0,actual:gpuWaist};
    requireValue(report.gpuWaistInitial.matched,'ORIGINAL_GPU_WAIST_INITIAL_MISMATCH');
    await emit('phase',{stage:'original-gpu-ready',actualAdapter:report.actualAdapter,actualDevice:report.actualDevice,gpu:metrics(gpu)});
    report.initialSafety=particleSafety(world,gpu);
    for(let frame=1;frame<=48;frame++){
      attemptedFrame=frame;stage='original-gpu-step';
      const fraction=Math.min(1,frame/32),target=Float32Array.from(args.target,(v,k)=>args.origin[k]+(v-args.origin[k])*fraction);
      const targetReceipt=await typed(target,Float32Array),targetExpected=expected.sourceWorkerTargets.frames[frame-1];
      requireValue(targetReceipt.sha256===targetExpected.sha256,'FRAME_BODY_TARGET_HASH '+frame);
      const previous=saveCommitted(world),stepStarted=performance.now();
      await emit('frame-start',{stage,frame,fitFraction:fraction,targetSHA256:targetReceipt.sha256});
      gpu.fittingTarget=target;
      gpu.fitFraction=fraction;
      try{
        // The unmodified source method performs every original substep, body
        // carry, coloured constraint, contact pass, readback and safety check.
        await gpu.step(1/60,false);
      }catch(error){
        const failure={
          frame,fitFraction:fraction,error:{message:error.message,stack:error.stack},
          wallMS:performance.now()-stepStarted,
          rejectedSafety:gpu.rejectedState?particleSafety(world,gpu,gpu.rejectedState):null,
          committedSafety:particleSafety(world,gpu),rollback:rollbackDifference(world,previous),
          metrics:metrics(gpu),targetSHA256:targetReceipt.sha256,
          sourceNumericalSafetyRollback:!!gpu.rejectedState&&world.safetyTrips>0&&gpu.metrics.rollbacks>0,
        };
        report.failure=failure;
        await emit('state',stateRecord(world,gpu),'source-gpu-failure-state');
        await emit('frame',failure);
        throw error;
      }
      const safety=particleSafety(world,gpu),body=await typed(world.actor.positions,Float32Array);
      const record={
        frame,fitFraction:fraction,dtSeconds:1/60,simulationSeconds:world.elapsed,
        bodyTargetSHA256:targetReceipt.sha256,actualBodySHA256:body.sha256,
        bodyTargetExact:world.actor.positions.every((v,i)=>v===target[i]),
        wallMS:performance.now()-stepStarted,gpu:metrics(gpu),safety,
      };
      requireValue(record.bodyTargetExact&&body.sha256===targetReceipt.sha256,'ACTUAL_BODY_TARGET_MISMATCH '+frame);
      requireValue(safety.items.every(s=>s.nonFinite===0&&!s.sourceCeilingExceeded)&&world.safetyTrips===0&&gpu.metrics.rollbacks===0&&!gpu.validationError&&!gpu.lost,'SOURCE_SAFETY_STATE '+frame);
      report.frames.push(record);report.completedFrames=frame;
      await emit('frame',record);
    }
    requireValue(gpu.metrics.steps===48&&world.frameSequence===48&&Math.abs(world.elapsed-.8)<1e-12,'COMPLETE_48_STEP_ACCOUNTING');
    stage='final-read-only-audit';
    await emit('phase',{stage});
    // Original CPU audit supplements the GPU gate. Its nearest-face signed
    // samples are not a union-interior or continuous-collision certification.
    report.finalContactAudit=world.audit(true);
    report.finalSafety=particleSafety(world,gpu);
    report.finalGPU=metrics(gpu);
    await gpu.device.queue.onSubmittedWorkDone();
    report.finalQueueCompleted=true;
    requireValue(!gpu.validationError&&!gpu.lost&&report.deviceErrors.length===0,'FINAL_GPU_DEVICE_OR_VALIDATION_ERROR');
    await emit('state',stateRecord(world,gpu),'completed-gpu-state');
    report.status='ORIGINAL_GPU_D48_COMPLETED_NOT_APPROVED';
  }catch(error){
    report.status=report.failure?(report.failure.sourceNumericalSafetyRollback?'ORIGINAL_GPU_D48_REJECTED_SOURCE_GATE':'ORIGINAL_GPU_STEP_FAILED'):
      stage==='original-gpu-create'?'ORIGINAL_GPU_INITIALIZATION_FAILED':'DIAGNOSTIC_PRECONDITION_OR_RUNTIME_FAILED';
    report.error={stage,attemptedFrame,message:error.message,stack:error.stack};
    if(gpu)report.finalGPU=metrics(gpu);
  }finally{
    report.elapsedMS=performance.now()-started;
    report.lastStage=stage;
    report.solverActuallyCreated=!!gpu;
    report.actualSoftwareAdapterMustBeReadFromEvidence=true;
    if(gpu){
      try{gpu.dispose();report.deviceDisposed=true;}
      catch(error){report.deviceDisposed=false;report.disposeError=error.message;}
    }
    statusElement.textContent=JSON.stringify({status:report.status,completedFrames:report.completedFrames,error:report.error||null},null,2);
    await emit('terminal',report);
  }
  return report;
};
