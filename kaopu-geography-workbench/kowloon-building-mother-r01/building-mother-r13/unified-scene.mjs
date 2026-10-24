import {unionBounds,visibleSceneBounds} from './desktop-display.mjs';
import {buildRegistry} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';
/** Three metre-scale systems share one field scene. Only reversible translations
 * are applied. This comparison arrangement is NOT a geographic site plan. */
export const BUILDING_ORDER=['lowrise','kcc','warehouse'];
export const BUILDING_NAMES={lowrise:'喇沙利道33號',kcc:'龍總大廈',warehouse:'協記貨倉第二倉'};
const add=(a,b)=>a.map((v,k)=>v+b[k]);
export const translateBounds=(b,t)=>b?{min:add(b.min,t),max:add(b.max,t)}:null;
const ns=(id,s)=>s==null?s:`${id}::${s}`;
export function composeBuildingScene(entries,{gap=14}={}){
 if(entries.length!==3||new Set(entries.map(e=>e.caseId)).size!==3)throw Error('Three distinct complete building systems required');
 const patches=[],nodes=[],archetypes=[],instances=[],stairs=[],levels=[],apertures=[],sourceMasks=[],registry=[],graph={nodes:[{id:'scene:comparison',kind:'comparison_scene',geographicPlacement:false}],edges:[]},buildings=[];
 let cursor=0;
 for(const [index,e] of entries.entries()){
  const {caseId,source,model}=e,localBounds=visibleSceneBounds({model,source});
  const anchor=model.comparisonAnchorBounds?unionBounds([source.bounds,model.comparisonAnchorBounds]):localBounds;
  const t=[cursor-anchor.min[0],0,-(anchor.min[2]+anchor.max[2])/2],worldBounds=translateBounds(localBounds,t),offset=(index+1)*1000000,patchStart=patches.length,nodeStart=nodes.length,railStart=stairs.length;
  cursor=anchor.max[0]+t[0]+gap;
  const sourceIds=new Map(source.patches.map((p,k)=>[p.objectId,1000+patchStart+k]));
  const floorIds=new Map(model.levels.map(l=>[l.id,ns(caseId,l.id)]));
  const localRegistry=buildRegistry(model,source);
  const mapObjectId=id=>sourceIds.has(id)?sourceIds.get(id):id>=30000&&id<30000+model.interfaces.stairs.length?30000+railStart+id-30000:offset+id;
  for(const p of source.patches)patches.push({...p,sourcePatchId:ns(caseId,p.sourcePatchId),localSourcePatchId:p.sourcePatchId,localObjectId:p.objectId,buildingId:source.sourceModelId,caseId,objectId:sourceIds.get(p.objectId),origin:add(p.origin,t),bounds:translateBounds(p.bounds,t)});
  for(const n of source.nodes)nodes.push({...n,min:add(n.min,t),max:add(n.max,t),patchIndex:n.patchIndex<0?-1:n.patchIndex+patchStart,skip:n.skip+nodeStart});
  for(const a of model.archetypes)archetypes.push({...a,id:ns(caseId,a.id)});
  for(const [ix,i] of model.instances.entries())instances.push({...i,id:ns(caseId,i.id),archetypeId:ns(caseId,i.archetypeId),floorId:floorIds.get(i.floorId)??null,translation:add(i.translation??[0,0,0],t),bounds:translateBounds(i.bounds,t),objectIdOffset:offset+(i.objectIdOffset??10000*(ix+1)),nodeBindings:i.nodeBindings?Object.fromEntries(Object.entries(i.nodeBindings).map(([k,v])=>[k,ns(caseId,v)])):undefined,caseId,buildingId:source.sourceModelId,localId:i.id});
  for(const s of model.interfaces.stairs)stairs.push({...s,id:ns(caseId,s.id),archetypeId:ns(caseId,s.archetypeId),fromFloorId:floorIds.get(s.fromFloorId),toFloorId:floorIds.get(s.toFloorId),layout:{...s.layout,origin:add(s.layout.origin,t)},caseId});
  for(const l of model.levels)levels.push({...l,id:floorIds.get(l.id),nodeId:ns(caseId,l.nodeId),label:`${BUILDING_NAMES[caseId]} · ${l.label??l.id}`,caseId,buildingId:source.sourceModelId,localId:l.id});
  for(const a of (model.hostedComponents??model.floorStudy)?.apertures??[]){
   const host={...a.host,nodeId:ns(caseId,a.host.nodeId),origin:add(a.host.origin,t),sourcePatchId:ns(caseId,a.host.sourcePatchId),sourceObjectId:sourceIds.get(a.host.sourceObjectId)??a.host.sourceObjectId};
   apertures.push({...a,host,floorId:floorIds.get(a.floorId)??null,caseId,primitives:a.primitives.map(p=>({...p,objectId:offset+p.objectId,nodeId:ns(caseId,p.nodeId),origin:add(p.origin,t),bounds:translateBounds(p.bounds,t)}))});
  }
  for(const m of (model.hostedComponents??model.floorStudy)?.sourceMasks??[])sourceMasks.push({...m,hostId:ns(caseId,m.hostId),sourcePatchId:ns(caseId,m.sourcePatchId),sourceObjectId:sourceIds.get(m.sourceObjectId),floorId:floorIds.get(m.floorId)??null,frame:{...m.frame,origin:add(m.frame.origin,t)}});
  const root=ns(caseId,model.graph.nodes[0].id);graph.nodes.push(...model.graph.nodes.map(n=>({...n,id:ns(caseId,n.id),localNodeId:n.id,caseId,sourcePatchId:ns(caseId,n.sourcePatchId)})));graph.edges.push({from:root,to:'scene:comparison',type:'ownedBy'},...model.graph.edges.map(x=>({...x,from:ns(caseId,x.from),to:ns(caseId,x.to)})));
  for(const r of localRegistry)registry.push({...r,objectId:mapObjectId(r.objectId),localObjectId:r.objectId,id:ns(caseId,r.id),localId:r.id,nodeId:ns(caseId,r.nodeId),ownerId:ns(caseId,r.ownerId),sourceOwnerId:ns(caseId,r.sourceOwnerId),floorId:floorIds.get(r.floorId)??null,localFloorId:r.floorId,localOwnerId:r.ownerId,caseId,buildingId:source.sourceModelId,buildingName:BUILDING_NAMES[caseId],buildingRootId:root,frame:'comparison-world / reversible source-local translation',transform:{translation:t,scale:[1,1,1],rotation:[0,0,0]},bounds:translateBounds(r.bounds,t)});
  buildings.push({caseId,buildingId:source.sourceModelId,name:BUILDING_NAMES[caseId],rootId:root,transform:{translation:t,scale:[1,1,1],rotation:[0,0,0]},localBounds,bounds:worldBounds,sourceBounds:translateBounds(source.bounds,t),sourcePatchCount:source.patches.length,floorCount:model.levels.length,sourceGeometryHash:e.sourceGeometryHash??null,localModel:model,localSource:source});
 }
 const bounds=unionBounds(buildings.map(b=>b.bounds));
 const measured={...entries[0].source,sourceModelId:'comparison:three-buildings',coordinateSystem:'comparison_metres_NOT_geographic',patches,nodes,bounds:unionBounds(buildings.map(b=>b.sourceBounds)),counts:{patches:patches.length,bvhNodes:nodes.length,modelTriangles:0,modelVertexBuffers:0},reconstruction:{allSourcePatchesRetained:true,sourceLocalGeometryUnchanged:true,onlyTranslation:true,geographicPlacement:false}};
 registry.sort((a,b)=>a.objectId-b.objectId);if(new Set(registry.map(r=>r.objectId)).size!==registry.length)throw Error('Scene hit IDs must be unique');
 const model={sourceModelId:measured.sourceModelId,placementMode:'metre_scale_comparison_NOT_geographic',bounds,archetypes,instances,interfaces:{stairs},levels,graph,hostedComponents:{apertures,sourceMasks,floorId:null},unifiedRegistry:registry,buildings};
 return {model,source:measured,buildings,registry,bounds,sourceGeometryPreserved:true,modelTriangles:0};
}
export function localPoint(building,world){return world.map((v,k)=>v-building.transform.translation[k]);}
