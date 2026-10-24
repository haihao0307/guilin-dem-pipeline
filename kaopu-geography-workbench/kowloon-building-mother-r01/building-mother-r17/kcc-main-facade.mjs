import {deriveKccRecessedWindow,kccRecessedWindowParameters} from './kcc-recessed-window.mjs';
/** Register observed plan intervals onto the actual source tower, explicitly as
 * replaceable registration candidates, not surveyed window coordinates. */
export function attachKccMainFacade(model,source,registration,{candidateId='R0',enabled=true,sill=.9,windowHeight=1.2,windowConstruction={}}={}){
 if(source.sourceModelId!=='B359971994401063C0')return model;
 const out=structuredClone(model),candidate=registration.candidates.find(c=>c.id===candidateId);if(!candidate)throw Error('Explicit available registration candidate required');
 const construction=kccRecessedWindowParameters(windowConstruction);
 if(!Number.isFinite(sill)||sill<construction.sillThickness||!Number.isFinite(windowHeight)||windowHeight<=0)throw Error('Window sill and height must fit the retained storey');
 out.facadeRegistration={candidateId,enabled,sourceModelId:source.sourceModelId,sourceShellUnchanged:true,actualWindowDimensions:null,actualFFL:null,registration:structuredClone(candidate),windowCount:0,verticalRule:'Existing T02..T23 design elevations assigned to observed 5..26F, not surveyed FFL',sill,windowHeight,construction:structuredClone(construction),constructionEvidence:'design_candidate_not_surveyed_or_as_built',sourceFaceCount:0,sourceFaceWindowCounts:{},observationCompleteness:'partial_reviewed_plan_intervals_not_all_building_windows'};
 if(!enabled)return out;
 const h=out.hostedComponents??={apertures:[],sourceMasks:[],records:[]};h.records??=[];
 const root=out.graph.nodes[0].id,seen=new Set(out.graph.nodes.map(n=>n.id));let index=0;
 for(let floor=5;floor<=26;floor++){
  const level=out.levels.find(l=>l.id==='T'+String(floor-3).padStart(2,'0'));if(!level)throw Error('Missing retained tower design level');
  if(sill+windowHeight>level.clearHeight+1e-7)throw Error('Window exceeds retained design storey; do not move the floor');
  const family=floor<=17?'lower':'upper';for(const w of candidate.windowsByFamily[family]){
   const p=source.patches.find(p=>p.sourcePatchId===w.sourcePatchId);if(!p||p.sourceKind!=='wallStrip'||Math.abs(p.v[1]-1)>1e-8)throw Error('Unknown or non-upright registered source wall face');
   const width=w.endU-w.startU;if(!(width>.15&&width<12))throw Error('Invalid projected source window interval');
   const y=level.elevation+sill+windowHeight/2,at=(w.startU+w.endU)/2,origin=p.origin.map((v,k)=>v+p.u[k]*at+p.v[k]*(y-p.origin[1]));
   const instanceId=index<100?300+index:10+index-100;index++;const hostId=root+':facade:'+candidateId+':'+floor+':'+w.observationId,wallId=root+':source-host:'+p.sourcePatchId,openingId=hostId+':opening',revealId=openingId+':reveal',sillId=openingId+':sill';
   const aperture=deriveKccRecessedWindow({instanceId,width,height:windowHeight,nodeId:hostId,revealId,sillId,parameters:construction,sourceFrame:{sourcePatchId:p.sourcePatchId,sourceObjectId:p.objectId,origin,u:p.u,v:p.v,w:p.n}});
   aperture.floorId=level.id;aperture.bindingKey=hostId;aperture.observationId=w.observationId;aperture.actualFloorLabel=floor;aperture.registrationCandidate=candidateId;aperture.actualDimensions=null;h.apertures.push(aperture);
   h.sourceMasks.push({enabled:true,hostId,instanceId,sourcePatchId:p.sourcePatchId,sourceObjectId:p.objectId,floorId:level.id,frame:{origin,u:p.u,v:p.v,w:p.n},width:width-construction.maskInset,height:windowHeight-construction.maskInset,depth:.08,scope:'registered_plan_candidate_not_surveyed',sourceGeometryDeleted:false});
   if(!seen.has(wallId)){out.graph.nodes.push({id:wallId,type:'source_wall_surface',sourcePatchId:p.sourcePatchId});out.graph.edges.push({from:wallId,to:root,type:'ownedBy'});seen.add(wallId);}
   out.graph.nodes.push({id:openingId,type:'opening',actualDimensions:null,evidence:'observed_plan_plus_replaceable_registration_and_design_vertical'},{id:hostId,type:'window',actualDimensions:null},{id:revealId,type:'window_reveal',semanticClass:'wall',partRole:'window_opening_reveal',sourcePatchId:p.sourcePatchId,actualThicknessM:null,evidence:'design_hollow_reveal_not_measured'},{id:sillId,type:'window_sill',semanticClass:'wall',partRole:'window_sill',sourcePatchId:p.sourcePatchId,actualThicknessM:null,evidence:'design_sill_not_measured'});out.graph.edges.push({from:openingId,to:wallId,type:'voids'},{from:hostId,to:openingId,type:'fills'},{from:hostId,to:level.nodeId,type:'ownedBy'},{from:hostId,to:wallId,type:'hostedBy'},{from:revealId,to:wallId,type:'ownedBy'},{from:sillId,to:wallId,type:'ownedBy'},{from:revealId,to:openingId,type:'bounds'},{from:sillId,to:openingId,type:'bounds'},{from:sillId,to:wallId,type:'supportedBy'},{from:hostId,to:sillId,type:'supportedBy'});
   h.records.push({role:'kcc_registered_plan_window_candidate',instanceId,sourcePatchId:p.sourcePatchId,observationId:w.observationId,actualFloorLabel:floor,floorId:level.id,registrationCandidate:candidateId,projectionResidualM:w.projectionResidualM??null,actualDimensions:null,hostId,openingId,wallId,revealId,sillId,constructionEvidence:'design_candidate_not_surveyed_or_as_built',actualWallThicknessM:null});
   out.facadeRegistration.sourceFaceWindowCounts[p.sourcePatchId]=(out.facadeRegistration.sourceFaceWindowCounts[p.sourcePatchId]??0)+1;
  }
 }
 out.facadeRegistration.windowCount=index;out.facadeRegistration.sourceFaceCount=Object.keys(out.facadeRegistration.sourceFaceWindowCounts).length;return out;
}
