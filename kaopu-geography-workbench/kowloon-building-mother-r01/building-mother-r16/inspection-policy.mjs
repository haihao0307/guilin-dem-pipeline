/** Inspection framing/visibility only. No new or moved geometry. */
export function defaultFloorId(model,caseId){return model.levels.find(l=>caseId==='kcc'?l.id==='T01':caseId==='warehouse'?l.id==='W01':l.id==='L01')?.id??model.levels.find(l=>!l.id.startsWith('B'))?.id??model.levels[0]?.id;}
export function floorInspection(model,floorId,upperFraction=1){
 const levels=[...model.levels].sort((a,b)=>a.elevation-b.elevation),selected=levels.find(l=>l.id===floorId)??levels[0];
 if(!selected)throw Error('No existing design floor to inspect');
 let stairs=model.interfaces.stairs.filter(s=>s.fromFloorId===selected.id),lower=selected;
 if(!stairs.length){stairs=model.interfaces.stairs.filter(s=>s.toFloorId===selected.id);if(stairs.length)lower=levels.find(l=>l.id===stairs[0].fromFloorId)??selected;}
 const upper=levels.find(l=>l.id===stairs[0]?.toFloorId)??levels[levels.indexOf(lower)+1]??lower;
 const ids=[...new Set([lower.id,upper.id])],lo=lower.elevation-.3,fullTop=Math.max(upper.elevation+.4,lower.elevation+1.8);
 const top=lo+(fullTop-lo)*Math.max(.15,Math.min(1,upperFraction));
 const objects=model.instances.filter(i=>ids.includes(i.floorId)),b=objects.filter(i=>i.bounds).map(i=>i.bounds);
 const bounds=b.length?{min:[0,1,2].map(k=>Math.min(...b.map(q=>q.min[k]))),max:[0,1,2].map(k=>Math.max(...b.map(q=>q.max[k])))}:model.bounds;
 const stair=stairs[0],X=stair?.layout.X??[1,0,0],Z=stair?.layout.Z??[0,0,1],origin=stair?.layout.origin??bounds.min.map((v,k)=>(v+bounds.max[k])/2);
 const width=Math.max(2.4,stair?.layout.width??4),run=Math.max(2.8,stair?.layout.runLength??4),span=Math.max(upper.elevation-lower.elevation,3.2),d=Math.max(run*1.65,span*1.5);
 const target=origin.map((v,k)=>k===1?lower.elevation+Math.min(span*.5,2):v+Z[k]*run*.45);
 const eye=origin.map((v,k)=>k===1?lower.elevation+1.65:v+X[k]*width*1.8-Z[k]*d);
 const clipNormal=Z,clipOffset=Z.reduce((n,v,k)=>n+v*origin[k],0)-1.6;
 return{selectedFloorId:selected.id,visibleFloorIds:ids,stairIds:stairs.map(s=>s.id),bounds,eye,target,clipNormal,clipOffset,sliceY:[lo,top],fullSliceY:[lo,fullTop],lowerElevation:lower.elevation,upperElevation:upper.elevation,relation:`${lower.id} → ${upper.id}`,evidence:'existing authored floor/stair relationship; not surveyed interior'};
}
export function compatibleSelection(previous,records){return previous?records.find(r=>r.id===previous.id&&r.frame===previous.frame&&r.buildingId===previous.buildingId)??null:null;}
