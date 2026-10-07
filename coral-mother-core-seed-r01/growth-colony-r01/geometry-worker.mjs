import {createRecipe,createEvaluator,QUALITY,mergeParts,computeVertexNormals,stageToOBJ} from './coral-growth.mjs';
let key='',recipe=null,evaluate=null,latest=null,timer=null;
function getRecipe(params){const next=JSON.stringify(params);if(next!==key){key=next;recipe=createRecipe(params);evaluate=createEvaluator(recipe,QUALITY.preview);}return recipe;}
async function process(message){
 try{
  const {id,type,params,time}=message;getRecipe(params);
  if(type==='lineage'){const stage=evaluate(time);postMessage({id,type,contents:JSON.stringify({recipe,stage:{time:stage.time,union:false,lineage:stage.lineage}},null,2)});return;}
  if(type==='obj'){
   const stage=message.highQuality?createEvaluator(recipe,QUALITY.export)(time):evaluate(time);
   if(message.partId)stage.parts=stage.parts.filter(p=>p.id===message.partId);
   const blob=new Blob([stageToOBJ(stage)],{type:'text/plain'});postMessage({id,type,blob,parts:stage.parts.length,time:stage.time});return;
  }
  const started=performance.now(),stage=evaluate(time),merged=mergeParts(stage.parts),normals=computeVertexNormals(merged.positions,merged.indices);
  postMessage({id,type:'geometry',time:stage.time,params:recipe.params,positions:merged.positions,indices:merged.indices,normals,ranges:merged.ranges,lineage:stage.lineage,ms:performance.now()-started},[merged.positions.buffer,merged.indices.buffer,normals.buffer]);
 }catch(error){postMessage({id:message.id,type:'error',message:String(error?.stack??error)});}
}
onmessage=({data})=>{
 if(data.type==='geometry'){latest=data;if(!timer)timer=setTimeout(()=>{timer=null;const next=latest;latest=null;process(next);},0);}
 else process(data);
};
