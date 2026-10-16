const unit=x=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;
export function demandTarget(input={}){
 const d=Number.isFinite(input.dHeroMeters)?Math.max(0,input.dHeroMeters):Infinity;
 const pixels=Number.isFinite(input.featurePixels)?Math.max(0,input.featurePixels):0;
 const d0=(Number.isFinite(input.d0)&&input.d0>0?input.d0:.7),s0=(Number.isFinite(input.s0)&&input.s0>0?input.s0:2);
 const D=1/(1+(d/d0)**2),S=1-Math.exp(-((pixels/s0)**2));
 const I=1-(1-.15*D)*(1-.85*S)*(1-.65*unit(input.focus));
 const qMin=.05,qVisual=qMin+(1-qMin)*unit(input.visibilityDemand??1)*I;
 const r=Number.isFinite(input.normalizedResidual)?Math.max(0,input.normalizedResidual):0,E=r/(1+r);
 return {D,S,I,E,qVisual,qPhysicsExtra:1-(1-qVisual)*(1-E)*(1-unit(input.contactRisk)),epsilonPixels:.25+.5*(1-qVisual)**2};
}
export class ContinuousDemand{
 constructor(){this.q=.05;this.last=null;this.input={};this.tasks=new Map();this.costs={main:0,worker:0,gpu:null,upload:0};}
 update(input,now=performance.now()){
  now=Number.isFinite(now)?now:performance.now();const target=demandTarget(input),dt=this.last===null?0:Math.max(0,(now-this.last)/1000),tau=target.qVisual>this.q?.1:.5;
  this.q+=(1-Math.exp(-dt/tau))*(target.qVisual-this.q);this.last=now;this.input={...input};
  this.output={...target,qVisual:this.q,epsilonPixels:.25+.5*(1-this.q)**2,qPhysicsExtra:1-(1-this.q)*(1-target.E)*(1-unit(input.contactRisk))};return this.output;
 }
 enqueue(task){if(!task?.id||!Number.isFinite(task.estimatedMS))throw Error('Invalid bounded demand task');this.tasks.set(task.id,{...task,enqueued:performance.now()});}
 take({budgetMS=2,generation=null}={}){
  const now=performance.now(),all=[...this.tasks.values()].filter(t=>generation===null||t.generation===generation);
  all.sort((a,b)=>((b.importance||1)*(b.errorReduction||1)/Math.max(.05,b.estimatedMS)+(now-b.enqueued)/10000)-((a.importance||1)*(a.errorReduction||1)/Math.max(.05,a.estimatedMS)+(now-a.enqueued)/10000));
  const result=[];let used=0;for(const task of all){if(used+task.estimatedMS>budgetMS&&result.length)continue;result.push(task);used+=task.estimatedMS;this.tasks.delete(task.id);if(used>=budgetMS)break;}return result;
 }
 cancelGeneration(generation){let count=0;for(const [id,t]of this.tasks)if(t.generation===generation){this.tasks.delete(id);count++;}return count;}
 audit(){return{input:this.input,output:this.output||null,queueLength:this.tasks.size,costs:{...this.costs},physicalPropertiesScaled:false,fixedDistanceTiers:false};}
}
