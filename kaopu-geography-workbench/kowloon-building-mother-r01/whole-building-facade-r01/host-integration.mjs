import {OBSERVED_FRAME_COAT_LINEAR} from './finish-instance.mjs';
/** Four observed eastern glazed groups. Source planes are never flattened.
 * Photo proportions/camera are tentative; lower edges and all section sizes are
 * editable DESIGN. 02/03 are not classified as windows or balcony doors.
 * Existing R07 analytic fields/materials are reused. No external assets/code.
 */
import {deriveCaseIntegration as original,integrationEntryGate,CASE_COMPONENT_PLAN} from '../whole-building-integrated-r01/host-integration.mjs';
import {deriveAperture} from '../r07/apertures.mjs';
import {validateFiniteHostDomain,bindingLocalToSource} from '../r07/host-bindings.mjs';
export {integrationEntryGate,CASE_COMPONENT_PLAN};
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,t)=>a.map(x=>x*t),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),copy=x=>structuredClone(x);
export const MASK_CAPACITY=16;
export const OBSERVATIONS=Object.freeze([
 {id:'F-E04-01',centerSouth:7.802,width:1.052,topY:7.018,columns:2,rows:1,category:'glazed-opening',observed:'two tall vertical divisions; lower edge obscured'},
 {id:'F-E04-02',centerSouth:3.316,width:1.078,topY:6.999,columns:2,rows:1,category:'glazed-opening',observed:'two tall vertical divisions under canopy; window versus balcony door unknown'},
 {id:'F-E04-03',centerSouth:1.523,width:1.188,topY:6.996,columns:2,rows:1,category:'glazed-opening',observed:'two tall vertical divisions under canopy; window versus balcony door unknown'},
 {id:'F-E04-04',centerSouth:-.243,width:1.232,topY:7.025,columns:2,rows:2,category:'glazed-opening',observed:'two vertical divisions and upper horizontal transom'}
]);
export const FACADE_EVIDENCE={photo:{provider:'Google Street View',panoId:'9XP6BUAdazrcL9UxjoPAvg',displayedDate:'2023-12',pixelsRedistributed:false},sourceModelId:'B367642137201063C0',facade:'east F-E04',sourcePatches:['p112','p114'],seamPatch:'p113',registration:{kind:'tentative_six_control_perspective_fit',rmsPixels:5.37,maxPixels:9.43,independentValidation:false},actualDimensions:null,actualLowerEdges:null,actualRevealDepth:null,actualOperation:null,actualFrameMaterial:null,actualGlassTint:null,uncovered:['north','south','west','ground-floor facade','actual building entry'],notFullBuilding:true};
function patchPoints(p){return p.loops.flat().map(q=>add(p.origin,add(mul(p.u,q[0]),mul(p.v,q[1]))));}
/** Validation-only chart joins a single explicit internal diagonal. Coordinates
 * in the source descriptors remain untouched; no convex hull or new surface. */
export function stitchedFacadeDomain(measured){
 const pp=['p112','p114'].map(id=>measured.patches.find(p=>p.sourcePatchId===id));if(pp.some(p=>!p||p.loops.length!==1))throw Error('Expected two finite single-loop wall patches');
 const vertices=[],edges=new Map(),tol=1e-6;const key=q=>{let i=vertices.findIndex(v=>Math.hypot(v[0]-q[0],v[1]-q[1])<=tol);if(i<0){i=vertices.length;vertices.push(q);}return i;};
 for(const p of pp){const a=patchPoints(p).map(q=>[-q[2],q[1]]).map(key);for(let i=0;i<a.length;i++){const x=a[i],y=a[(i+1)%a.length],k=[x,y].sort((a,b)=>a-b).join(':');const r=edges.get(k)??{a:x,b:y,count:0};r.count++;edges.set(k,r);}}
 const seams=[...edges.values()].filter(e=>e.count===2),outside=[...edges.values()].filter(e=>e.count===1);if(seams.length!==1||[...edges.values()].some(e=>e.count>2))throw Error('Exactly one known shared diagonal required');
 const neighbors=new Map();for(const e of outside){for(const [a,b]of[[e.a,e.b],[e.b,e.a]]){const n=neighbors.get(a)??[];n.push(b);neighbors.set(a,n);}}if([...neighbors.values()].some(n=>n.length!==2))throw Error('Exterior must be one simple ring');
 const ids=[outside[0].a];let previous=-1,current=ids[0];for(let i=0;i<outside.length;i++){const next=neighbors.get(current).find(x=>x!==previous);if(next===ids[0])break;if(ids.includes(next))throw Error('Disconnected facade ring');ids.push(next);previous=current;current=next;}if(ids.length!==outside.length)throw Error('Exterior ring incomplete');return{loops:[ids.map(i=>vertices[i])],joinToleranceM:tol,internalSeam:seams.map(e=>[vertices[e.a],vertices[e.b]]),method:'explicit shared diagonal cancellation in north/up validation chart'};
}
export function validateMasks(masks,measured){
 const active=masks.filter(m=>m.enabled);if(active.length>MASK_CAPACITY)throw Error('Source-mask capacity exceeded');for(const m of active){const p=measured.patches.find(p=>p.sourcePatchId===m.sourcePatchId);if(!p||p.objectId!==m.sourceObjectId)throw Error('Mask source string/numeric identity mismatch');if(![m.width,m.height,m.depth].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid bounded source mask');}return active;
}
function adaptMetal(c){for(const p of c.primitives)if(p.part!=='glass')p.materialRole=13;c.materialEvidence='pale coated-metal appearance approximation using the existing mother; exact color and substrate unknown';return c;}
export function deriveFacadeGroups(measured,{floorId,enabled=true,lowerY=5.0,frameDepth=.16,frameWidth=.045}={}){
 if(measured.sourceModelId!==FACADE_EVIDENCE.sourceModelId||typeof floorId!=='string')throw Error('Original lowrise and explicit owner floor required');if(!Number.isFinite(lowerY)||lowerY<4.5||lowerY>5.35||!Number.isFinite(frameDepth)||frameDepth<.06||frameDepth>.35||!Number.isFinite(frameWidth)||frameWidth<.025||frameWidth>.08)throw Error('Facade design parameters outside supported domain');
 const domain=stitchedFacadeDomain(measured),wall=measured.patches.find(p=>p.sourcePatchId==='p112'),seam=measured.patches.find(p=>p.sourcePatchId==='p113');if(!seam||seam.objectId!==1113)throw Error('Known bridging seam identity required');const sourcePatches=['p112','p114','p113'].map(id=>measured.patches.find(p=>p.sourcePatchId===id));
 const depths=sourcePatches.flatMap(p=>patchPoints(p).map(q=>dot(sub(q,wall.origin),wall.n))),maxDeviation=Math.max(...depths.map(Math.abs));if(maxDeviation>.012)throw Error('Source seam deviation changed; require new audit');const components=[],masks=[],records=[];
 for(let g=0;g<OBSERVATIONS.length;g++){
  const o=OBSERVATIONS[g],height=o.topY-lowerY,y=(o.topY+lowerY)/2,s=(o.centerSouth-wall.origin[2])/wall.u[2],plane=add(wall.origin,mul(wall.u,s));plane[1]=y;
  const origin=add(plane,mul(wall.n,.01)),hostId='lowrise:source-facade:F-E04:'+o.id,host={nodeId:hostId,origin,u:wall.u,v:wall.v,w:wall.n,emitWall:false,sourcePatchId:'p112',sourceObjectId:1112};
  const support=[[-o.width/2,-height/2],[o.width/2,-height/2],[o.width/2,height/2],[-o.width/2,height/2]].map(q=>bindingLocalToSource(host,[...q,0])).map(q=>[-q[2],q[1]]);validateFiniteHostDomain(support,domain.loops,{minimumMargin:.02});
  const instanceId=200+10*g,base={instanceId,kind:'window',width:o.width,height,frameDepth,wallThickness:frameDepth,frameWidth,clearance:.002,sashWidth:.025,leafThickness:.03,glassThickness:.006,glassSeat:.004,mountGap:.002,hingeOrSlider:'fixed',openT:0,host};
  const outer=adaptMetal(deriveAperture({...base,leafEnabled:false}));outer.floorId=floorId;outer.bindingKey=o.id;outer.observationGroup=o.id;components.push(outer);
  const clearW=o.width-2*frameWidth,clearH=height-2*frameWidth,rows=o.rows===1?[{height:clearH,y:0}]:[{height:clearH-.36,y:-.18},{height:.36,y:clearH/2-.18}];let k=0;
  for(const row of rows)for(let col=0;col<2;col++){const x=(col-.5)*clearW/2,childHost={...host,nodeId:hostId+':panel:'+k,origin:bindingLocalToSource(host,[x,row.y,0])};const c=adaptMetal(deriveAperture({...base,instanceId:instanceId+1+k++,width:clearW/2,height:row.height,frameWidth:.018,frameDepth:.055,wallThickness:.055,host:childHost}));c.floorId=floorId;c.bindingKey=o.id+':panel:'+k;c.observationGroup=o.id;components.push(c);}
  const maskDepth=2*Math.max(...depths.map(d=>Math.abs(d-.01)))+.004;
  for(const p of sourcePatches)masks.push({instanceId,hostId,sourcePatchId:p.sourcePatchId,sourceObjectId:p.objectId,frame:copy(host),width:o.width-.012,height:height-.012,depth:maskDepth,roundRadius:0,enabled:true,floorId,scope:'proposal_only_exact_three_patch_join_within_one_opening',sourceGeometryDeleted:false});
  records.push({id:hostId,instanceId,category:o.category,role:'observed_glazed_group_static_representation',floorId,hostId,floorAssignment:'observed upper-storey facade band; baseline design FFL/height not photographically registered',sourcePatchIds:sourcePatches.map(p=>p.sourcePatchId),observation:copy(o),evidence:{groupAndDivisions:'observed',positionAndVisibleProportions:'tentative_photo_source_fit',lowerEdgeAndSections:'specified_design',operation:'unknown',material:'unknown'},dimensions:{width:o.width,height,frameDepth,lowerY,glassThickness:.006},actualDimensions:null,actualFinish:null,designFinish:{kind:'pale_coated_metal_appearance_approximation',linearCoatColor:[...OBSERVED_FRAME_COAT_LINEAR],colorCalibrated:false,actualSubstrate:null},operation:{kind:'static_closed_representation',actualMechanism:null,openT:0},parts:components.filter(c=>c.observationGroup===o.id).flatMap(c=>c.primitives.map(p=>({id:p.objectId,part:p.part,materialRole:p.materialRole}))),constructionTolerance:{sourcePlaneDeviationM:maxDeviation,sourceNotFlattened:true,rigidFrameFrontOffsetM:.01,sourceMaskInsetM:.006},notes:['Two pane divisions observed, metric subdivisions inferred.','Hidden lower boundary and frame/glass sections are editable design.','No hinge or balcony-door claim.']});
 }
 validateMasks(masks,measured);return{components:enabled?components:[],sourceMasks:enabled?masks:[],records,evidence:copy(FACADE_EVIDENCE),domain,sourceSeamAudit:{sourcePatchId:'p113',objectId:1113,vertices:patchPoints(seam),maxPlaneDeviationM:maxDeviation,maskOnlyWithinOpening:true},design:{lowerY,frameDepth,frameWidth},counts:{groups:4,panes:10,sourcePatchesAffected:3,originalPatches:measured.patches.length},sourceUnchanged:true};
}
export function deriveCaseIntegration(caseId,model,measured,official,options={}){
 const out=original(caseId,model,measured,official,options);if(caseId!=='lowrise')return out;
 const floor=model.levels.find(l=>l.actualFloorLabel==='1/F');if(!floor)throw Error('Existing upper floor owner required');const facade=deriveFacadeGroups(measured,{floorId:floor.id,...options.facade,enabled:options.enabled!==false&&options.observedEnabled!==false});
 out.components.push(...facade.components);out.sourceMasks.push(...facade.sourceMasks);out.records.push(...facade.records);validateMasks(out.sourceMasks,measured);
 for(const r of facade.records){out.model.graph.nodes.push({id:r.hostId,kind:'source_facade_host',sourcePatchIds:r.sourcePatchIds,evidence:r.evidence},{id:r.id+':group',kind:'glazed-opening',observedGroupId:r.observation.id});out.model.graph.edges.push({from:r.id+':group',to:r.hostId,type:'hostedBy'},{from:r.id+':group',to:floor.nodeId,type:'belongsToFloor'});}
 out.model.hostedComponents={...out.model.hostedComponents,apertures:out.components,sourceMasks:out.sourceMasks,records:out.records};out.facade=facade;return out;
}
