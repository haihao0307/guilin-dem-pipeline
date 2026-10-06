import {gradePaper,paperSummary} from './paper-program.mjs';
import {BodySDF,GarmentLab} from '../../garments-r04/src/solver.mjs';
import {regionalStrain,topology} from '../../garments-r04/src/diagnostics.mjs';
import {prepareBodyAudit,strictIntersectionAudit} from '../../garments-r04/src/intersection-audit.mjs';
let bodyAudit,sdf,base,lab,running=false,paused=false,stageIndex=0,stageFrame=0,epoch=0;
let stages=[],totals=[],totalFrames=0;
const emit=(type,data)=>postMessage({type,...data});
function snapshot(extra={}){return{positionsMm:lab.positions.map(p=>p.map(x=>x*1000)),metrics:lab.metrics(),frame:lab.frameCount,stage:stages[stageIndex]||'complete',...extra};}
function tick(token){if(token!==epoch||!running||paused)return;try{for(let chunk=0;chunk<4&&running;chunk++){
 if(stageFrame===0){if(stageIndex===stages.length-1){lab.releasePins();lab.setGravity(1);}else lab.activate(stages[stageIndex]);}
 lab.step();stageFrame++;
 if(stageFrame>=totals[stageIndex]){emit('stage',snapshot({completedStage:stages[stageIndex]}));stageFrame=0;stageIndex++;if(stageIndex>=stages.length){running=false;emit('auditing',snapshot());const record=lab.export(),regions=regionalStrain(lab.spec,record.positionsMm),intersections=strictIntersectionAudit(lab.spec,record.positionsMm,record.materialToSolverGroup,bodyAudit);emit('done',{record,regions,intersections});return;}}
 }if(lab.frameCount%12===0)emit('progress',snapshot({progress:lab.frameCount/totalFrames}));setTimeout(()=>tick(token),0);}catch(error){running=false;emit('error',{message:error.message,stack:error.stack});}}
self.onmessage=async({data})=>{try{if(data.type==='init'){base=data.base;stages=[...base.source.assemblyExperiment,'release'];totals=stages.map((_,i)=>i===stages.length-1?480:360);totalFrames=totals.reduce((a,b)=>a+b,0);sdf=new BodySDF(data.sdfMeta,new Int16Array(data.sdfBuffer));bodyAudit=prepareBodyAudit(data.body);emit('ready',{});}
 else if(data.type==='cut'){epoch++;running=false;paused=false;const spec=gradePaper(base,data.controls);lab=new GarmentLab(spec,sdf,{substeps:12,iterations:6});lab.orientationGuides=false;lab.selfCollisionEnabled=false;lab.stitchEqualityElimination=true;lab.strainGuard=true;stageIndex=0;stageFrame=0;emit('cut',{spec,summary:paperSummary(spec),topology:topology(spec),...snapshot()});}
 else if(data.type==='run'){if(!lab)throw Error('先生成纸样并裁片');if(stageIndex>=stages.length)throw Error('本轮已完成；重算需要重新裁片');running=true;paused=false;tick(++epoch);}
 else if(data.type==='pause'){epoch++;paused=true;emit('paused',lab?snapshot():{stage:'not-cut'});}
 else if(data.type==='export'){emit('export',{record:lab.export()});}
 }catch(error){emit('error',{message:error.message,stack:error.stack});}};
