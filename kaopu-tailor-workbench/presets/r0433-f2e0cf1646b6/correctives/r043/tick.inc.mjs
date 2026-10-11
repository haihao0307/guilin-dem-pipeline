// R04.3 sequenced native sewing. Heavy stages yield so pause/cancel remains real.
var r043PreGuides=null,r043PreJoint=null,r043BudgetOrigin=0,r043Recovery=[];
function r043Frames(stage){return ['seam-relax','refine'].includes(stage)?(stage==='seam-relax'?1000:1600):['seam-finish','joint'].includes(stage)?1600:stage==='release'?120:90;}
function tick(token){
 if(!running||token!==epoch)return;
 try{
  const start=performance.now();
  if(wallMs+start-runStarted-r043BudgetOrigin>180000){stop();r043BudgetOrigin=wallMs;packet('paused',{budgetCheckpoint:true,message:'本轮达到180秒计算片段，状态已保留；继续可从当前工序恢复，不会丢弃结果。'});return;}
  let count=0;
  do{
   const stage=stages[stageIndex];
   if(stageFrame===0){
    if(stage==='seam-relax'){lab.kernel.prepare(1/720,lab.elapsed);r043PreGuides=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}
    else if(stage==='seam-finish')r043PreJoint=beginJointRefinement(lab);
    else if(stage==='release'){
     lab.releasePins();
     if(lab.pipeline43){lab.waistCircuitReport43=waistCircuit(lab,analytic);for(const v of lab.velocity)v.fill(0);lab.setGravity(0);}
     else lab.setGravity(1);
    }else if(stage==='refine'){lab.kernel.prepare(1/720,lab.elapsed);layerGuide=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}
    else if(stage==='joint')jointInfo=beginJointRefinement(lab);
    else {lab.activate(stage);if(stage==='sides')lab.releasePins();}
   }
   const time=performance.now();
   if(stage==='refine'||stage==='seam-relax'){
    lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();
    if(lab.waistCircuit43)for(let k=0;k<5;k++){lab.kernel.waistProject43(1);lab.kernel.vertices(.0035);}
    if(stage==='refine'&&stageFrame>=400&&stageFrame<1400)layerGuide.project();
    if(stage==='seam-relax'&&stageFrame<800)r043PreGuides.project();
    if(stage==='refine')refinementSteps++;
   }else if(stage==='joint'||stage==='seam-finish'){
    const result=lab.kernel.qnStep();if(result<0)throw Error('联合整理检测到无效材料/接缝状态；中间坐标保留供诊断。');if(stage==='joint')jointSteps++;
   }else {if(stage==='release'&&lab.pipeline43)lab.setGravity((stageFrame+1)/120);lab.step();}
   profile.solveMs+=performance.now()-time;stageFrame++;count++;
   if(stageFrame===r043Frames(stage)){
    if(stage==='seam-finish')lab.preReleaseClosure43={...jointReport(lab,r043PreJoint),closure:finalizeCloseSeams(lab)};
    if(stage==='joint'){jointInfo=jointReport(lab,jointInfo);closureInfo=finalizeCloseSeams(lab);}
    let check=lab.metrics();
    if(lab.pipeline43&&check.finite&&check.maxPrincipalStrain>5){
     const before=check.maxPrincipalStrain;lab.kernel.prepare(1/720,lab.elapsed);
     for(let j=0;j<160;j++){lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();}
     for(const v of lab.velocity)v.fill(0);check=lab.metrics();r043Recovery.push({stage,beforeMaxStrain:before,afterMaxStrain:check.maxPrincipalStrain,extraGlobalIterations:160});
    }
    if(!check.finite||check.maxPrincipalStrain>5)throw Error('当前原裁片仍存在严重材料变形；已保留有限中间状态，不认定为成衣。');
    packet('stage',{completedStage:stage});stageIndex++;stageFrame=0;
    if(stageIndex===stages.length){
     wallMs+=performance.now()-runStarted;running=false;packet('auditing');
     const begin=performance.now(),record=lab.export(),regions=regionalStrain(spec,record.positionsMm),intersections=strictIntersectionAudit(spec,record.positionsMm,record.materialToSolverGroup,bodyAudit);
     record.nativeBinding=structuredClone(nativeBinding);record.staticGate=staticGate(lab,record,regions,intersections);profile.auditMs=performance.now()-begin;
     record.jointRefinement={...jointInfo,closure:closureInfo};
     record.trial={version:lab.pipeline43?'R04.3-native-material-circuit':'R04.2-preserved-baseline',physicalFitAccepted:false,continuousCollision:false,materialCalibrated:false,runtimeSelfContact:false,originalMaterialRetained:true,wholeSeamGateUnchanged:true};
     record.r043={sourceRepresentation:analytic.source?.r043SourceRepair||null,waistCircuit:lab.waistCircuitReport43||{enabled:false},preReleaseClosure:lab.preReleaseClosure43||null,adaptiveRecovery:r043Recovery,personScaled:false,displayProxy:false};
     emit('done',{record,regions,intersections,profile,activeWallMs:wallMs+profile.auditMs});return;
    }
   }
  }while(count<8&&performance.now()-start<22);
  if(performance.now()-lastPacket>100){packet('progress');lastPacket=performance.now();}setTimeout(()=>tick(token),0);
 }catch(e){stop();if(lab&&lab.positions.every(p=>Array.from(p).every(Number.isFinite))){packet('checkpoint',{message:e.message,accepted:false,complete:false});}emit('error',{message:e.message});}
}
