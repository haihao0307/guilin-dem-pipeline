import {deriveAperture} from './kowloon-building-mother-r01/r07/apertures.mjs';
/** Register observed plan intervals onto the actual source tower, explicitly as
 * replaceable registration candidates, not surveyed window coordinates. */
export function attachKccMainFacade(model,source,registration,{candidateId='R0',enabled=true,sill=.9,windowHeight=1.2}={}){
 if(source.sourceModelId!=='B359971994401063C0')return model;
 const out=structuredClone(model),candidate=registration.candidates.find(c=>c.id===candidateId);if(!candidate)throw Error('Explicit available registration candidate required');
 out.facadeRegistration={candidateId,enabled,sourceModelId:source.sourceModelId,sourceShellUnchanged:true,actualWindowDimensions:null,actualFFL:null,registration:structuredClone(candidate),windowCount:0,verticalRule:'Existing T02..T23 design elevations assigned to observed 5..26F, not surveyed FFL',sill,windowHeight};
 if(!enabled)return out;
 const h=out.hostedComponents??={apertures:[],sourceMasks:[],records:[]};h.records??=[];
 const root=out.graph.nodes[0].id,seen=new Set(out.graph.nodes.map(n=>n.id));let index=0;
 for(let floor=5;floor<=26;floor++){
  const level=out.levels.find(l=>l.id==='T'+String(floor-3).padStart(2,'0'));if(!level)throw Error('Missing retained tower design level');
  const family=floor<=17?'lower':'upper';for(const w of candidate.windowsByFamily[family]){
   const p=source.patches.find(p=>p.sourcePatchId===w.sourcePatchId);if(!p)throw Error('Unknown registered source face');
   const width=w.endU-w.startU;if(!(width>.15&&width<12))throw Error('Invalid projected source window interval');
   const y=level.elevation+sill+windowHeight/2,at=(w.startU+w.endU)/2,origin=p.origin.map((v,k)=>v+p.u[k]*at+p.v[k]*(y-p.origin[1]));
   const instanceId=100+index++,hostId=root+':facade:'+candidateId+':'+floor+':'+w.observationId,wallId=root+':source-host:'+p.sourcePatchId,openingId=hostId+':opening';
   const aperture=deriveAperture({instanceId,kind:'window',width,height:windowHeight,frameWidth:.045,frameDepth:.12,wallThickness:.18,leafThickness:.035,sashWidth:.035,glassThickness:.006,hingeOrSlider:'fixed',openT:0,host:{nodeId:hostId,sourcePatchId:p.sourcePatchId,sourceObjectId:p.objectId,origin:origin.map((v,k)=>v+p.n[k]*.012),u:p.u,v:p.v,w:p.n,emitWall:false}});
   for(const [partIndex,part] of aperture.primitives.entries())part.objectId=700000+instanceId*16+partIndex;aperture.floorId=level.id;aperture.bindingKey=hostId;aperture.observationId=w.observationId;aperture.actualFloorLabel=floor;aperture.registrationCandidate=candidateId;aperture.actualDimensions=null;h.apertures.push(aperture);
   h.sourceMasks.push({enabled:true,hostId,instanceId,sourcePatchId:p.sourcePatchId,sourceObjectId:p.objectId,floorId:level.id,frame:{origin,u:p.u,v:p.v,w:p.n},width:width-.012,height:windowHeight-.012,depth:.08,scope:'registered_plan_candidate_not_surveyed',sourceGeometryDeleted:false});
   if(!seen.has(wallId)){out.graph.nodes.push({id:wallId,type:'source_wall_surface',sourcePatchId:p.sourcePatchId});out.graph.edges.push({from:wallId,to:root,type:'ownedBy'});seen.add(wallId);}
   out.graph.nodes.push({id:openingId,type:'opening',actualDimensions:null,evidence:'observed_plan_plus_replaceable_registration_and_design_vertical'},{id:hostId,type:'window',actualDimensions:null});out.graph.edges.push({from:openingId,to:wallId,type:'voids'},{from:hostId,to:openingId,type:'fills'},{from:hostId,to:level.nodeId,type:'ownedBy'});
   h.records.push({role:'kcc_registered_plan_window_candidate',instanceId,sourcePatchId:p.sourcePatchId,observationId:w.observationId,actualFloorLabel:floor,floorId:level.id,registrationCandidate:candidateId,projectionResidualM:w.projectionResidualM??null,actualDimensions:null,hostId,openingId,wallId});
  }
 }
 out.facadeRegistration.windowCount=index;return out;
}
