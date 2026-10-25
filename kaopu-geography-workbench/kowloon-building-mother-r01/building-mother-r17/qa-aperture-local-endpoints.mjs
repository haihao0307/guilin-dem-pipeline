/** Browser QA helper, never production render policy. Run after whole-cold has
 * completed. Four native-resolution views compare 121 pixel rays each against
 * the COMPLETE remaining aperture union, including other instances/buildings.
 * Temporarily omit other passes only for this bounded numerical test; restore
 * the original scene references/options and present the complete scene again.
 */
import {intersectAperturesRay,updateAperture} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {apertureLocalEndpointContract} from './aperture-local-endpoint-trace.mjs';
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,t)=>a.map(v=>v*t);
const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0),unit=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const errorText=e=>String(e?.stack??e?.message??e);

export function apertureQaPixelRay(camera,size,x,y){
 const forward=unit(sub(camera.target,camera.eye)),right=unit(cross(forward,Math.abs(forward[1])>.999?[0,0,1]:[0,1,0])),up=cross(right,forward);
 const uv=[(2*(x+.5)-size.width)/size.height,(2*(y+.5)-size.height)/size.height],tan=Math.tan(camera.fov/2);
 return unit(forward.map((v,k)=>v+tan*(uv[0]*right[k]+uv[1]*up[k])));
}

function cameraFor(part,{door=false}={}){
 const half=part.outer.half,distance=Math.max(.8,2.8*Math.max(...half));
 const target=add(part.origin,add(mul(part.u,part.outer.center[0]),mul(part.v,part.outer.center[1])));
 // A modest door oblique keeps the opened moving leaf visible as well as its
 // unchanged frame, without changing either aperture's geometric parameters.
 const eye=add(target,add(mul(part.w,distance),mul(part.u,door?distance*.3:0)));
 return{eye,target,fov:Math.PI/4,half,distance:Math.hypot(...sub(eye,target))};
}

function pixelsFor(camera,size){
 const scale=size.height/(2*Math.tan(camera.fov/2)*camera.distance);
 const rx=Math.min(size.width*.44,Math.max(12,camera.half[0]*scale*1.18)),ry=Math.min(size.height*.44,Math.max(12,camera.half[1]*scale*1.18));
 const points=[];for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)points.push([Math.round((size.width-1)/2+rx*x/5),Math.round((size.height-1)/2+ry*y/5)]);
 if(new Set(points.map(p=>p.join(','))).size!==121)throw Error('Native test grid does not contain 121 distinct pixels');
 return points;
}

function posedDoor(door,openT){
 const next=updateAperture(door,{openT,host:door.host});
 return{...door,...next,caseId:door.caseId,floorId:door.floorId,bindingKey:door.bindingKey,roomIds:door.roomIds,
  primitives:next.primitives.map(p=>{const old=door.primitives.find(q=>q.part===p.part);if(!old)throw Error('Door rederivation changed part ownership');return{...p,objectId:old.objectId,materialRole:old.materialRole,nodeId:old.nodeId};})};
}

/** page.evaluate example:
 * const {runApertureLocalEndpointQa}=await import('./qa-aperture-local-endpoints.mjs');
 * return await runApertureLocalEndpointQa(semanticInspection, {
 *   onProgress:q=>window.__yourPersistCallback?.(q)
 * });
 * Save the returned report before asserting report.passed. This function returns
 * failure details after restoring state; it never raises a GPU wait budget.
 */
export async function runApertureLocalEndpointQa(inspection,{onProgress=null}={}){
 const r=inspection?.renderer,size=inspection?.presentedDisplay;
 if(!r||r.busy||inspection.busy||!size?.native||!(r.stats?.frames>0))throw Error('Completed idle native whole-scene frame required');
 if(r.stats.last?.visibleFloorIds)throw Error('Run after the complete unfiltered scene, not a floor-isolated view');
 const contract=apertureLocalEndpointContract(r.apertures);
 if(!contract.eligible||contract.glassCount===0)throw Error('Validated remaining glass union required');
 const original={options:r.options,archetypes:r.archetypes,railGroups:r.railGroups,integratedHosts:r.integratedHosts,
  allHostedComponents:r.allHostedComponents,apertures:r.apertures,study:r.study};
 const parts=r.apertures.flatMap(a=>a.primitives),glassRows=[13,5].map(role=>contract.mappings.find(m=>m.sashRole===role));
 if(glassRows.some(row=>!row))throw Error('Both wood-role-13 and metal-role-5 glass groups required');
 const door=r.apertures.find(a=>a.kind==='door'&&a.caseId==='kcc'&&a.primitives.some(p=>p.part==='leaf'))??r.apertures.find(a=>a.kind==='door'&&a.primitives.some(p=>p.part==='leaf'));
 if(!door)throw Error('A real movable scene door is required');
 const doorFrame=door.primitives.find(p=>p.part==='frame');
 const views=[...glassRows.map(row=>({name:'glass-sash-role-'+row.sashRole,targetId:row.glassObjectId,camera:cameraFor(parts[row.glassIndex]),role:row.sashRole})),
  {name:'door-closed',doorOpenT:0,targetId:doorFrame.objectId,camera:cameraFor(doorFrame,{door:true})},
  {name:'door-open',doorOpenT:1,targetId:doorFrame.objectId,camera:cameraFor(doorFrame,{door:true})}];
 const report={schemaVersion:1,passed:false,scope:'Native full remaining aperture union only for numerical QA; original complete scene restored afterward',
  native:{width:size.width,height:size.height,dpr:size.dpr,native:true},apertureInstances:r.apertures.length,primitiveCount:parts.length,glassCount:contract.glassCount,
  tolerances:{distanceMetres:.001,localMetres:.001,normalDot:.999},views:[],restoration:{stateRestored:false,fullSceneRendered:false},
  notice:'This is CPU analytic versus actual GPU sampling, not all-pixel equivalence. All rounded plans and cross-instance union coverage remain active.'};
 const persist=async()=>{if(onProgress)await onProgress(structuredClone(report));};
 try{
  r.options={...structuredClone(original.options),onlyHostField:false,cut:false,sliceY:null,staticHitCache:false};
  r.archetypes=[];r.railGroups=[];r.integratedHosts=[];
  for(const view of views){
   globalThis.hostQaDispatchDiagnostics?.mark('aperture-numerical-'+view.name);
   const changed=view.doorOpenT===undefined?null:posedDoor(door,view.doorOpenT);
   r.allHostedComponents=changed?{...original.allHostedComponents,apertures:original.allHostedComponents.apertures.map(a=>a.instanceId===door.instanceId?changed:a)}:original.allHostedComponents;
   r.hostedVisibilityKey=null;
   Object.assign(r.options,{eye:view.camera.eye,target:view.camera.target,fov:view.camera.fov});
   const stats=await r.render({width:size.width,height:size.height,presentWidth:size.width,presentHeight:size.height,
    tileSize:96,gpuBatchTiles:8,source:false,design:true,clipDesign:false,visibleFloorIds:null,requestRevision:++r.requestRevision});
   if(stats.cancelled)throw Error('Aperture numerical frame cancelled');
   const pass=stats.passCounts;
   if(!pass.aperture||pass.source||pass.assembly||pass.rail||pass.host||pass.dynamic)throw Error('QA pass isolation failed');
   const primitiveCount=r.apertures.reduce((n,a)=>n+a.primitives.length,0);
   if(primitiveCount!==parts.length)throw Error('The complete remaining aperture union was unexpectedly truncated');
   const result={name:view.name,targetId:view.targetId,sashRole:view.role??null,doorOpenT:view.doorOpenT??null,
    camera:structuredClone(view.camera),samples:0,hits:0,targetHits:0,mismatchCount:0,mismatches:[],primitiveCount,
    maximumDistanceError:0,maximumLocalError:0,minimumNormalDot:1,stats};
   report.views.push(result);
   for(const [x,y]of pixelsFor(view.camera,size)){
    const rd=apertureQaPixelRay(view.camera,size,x,y),cpu=intersectAperturesRay(r.apertures,view.camera.eye,rd),gpu=r.readHit(x,y),gpuHit=gpu.status>.5&&gpu.status<1.5;
    result.samples++;let bad=cpu.hit!==gpuHit||gpu.status>=1.5;
    if(cpu.hit&&gpuHit){
     result.hits++;if(gpu.objectId===view.targetId)result.targetHits++;
     const distanceError=Math.abs(cpu.t-gpu.t),localError=Math.max(...cpu.local.map((v,k)=>Math.abs(v-gpu.local[k]))),normalDot=dot(unit(cpu.normal),unit(gpu.normal));
     result.maximumDistanceError=Math.max(result.maximumDistanceError,distanceError);result.maximumLocalError=Math.max(result.maximumLocalError,localError);result.minimumNormalDot=Math.min(result.minimumNormalDot,normalDot);
     bad ||= cpu.objectId!==gpu.objectId||cpu.materialRole!==gpu.materialRole||distanceError>.001||localError>.001||normalDot<.999||!Number.isFinite(distanceError+localError+normalDot);
    }
    if(bad){result.mismatchCount++;if(result.mismatches.length<16)result.mismatches.push({x,y,cpu,gpu});}
   }
   if(view.role&&result.targetHits===0)throw Error('Glass test did not sample the target pane: '+view.name);
   await persist();
  }
 }catch(error){report.error=errorText(error);}
 finally{
  r.options=original.options;r.archetypes=original.archetypes;r.railGroups=original.railGroups;
  r.integratedHosts=original.integratedHosts;r.allHostedComponents=original.allHostedComponents;r.hostedVisibilityKey=null;
  try{
   r.updateHostedVisibility(null);
   report.restoration.stateRestored=r.options===original.options&&r.archetypes===original.archetypes&&r.railGroups===original.railGroups&&r.integratedHosts===original.integratedHosts&&r.allHostedComponents===original.allHostedComponents;
   if(r.error||r.busy)throw Error('GPU stopped or busy; references restored but complete scene could not be rendered');
   globalThis.hostQaDispatchDiagnostics?.mark('aperture-numerical-restore-whole');
   const framesBeforeRestore=r.stats.frames;
   await inspection.render();
   report.restoration.fullSceneRendered=r.stats.frames>framesBeforeRestore&&!!inspection.lastStats&&!inspection.lastStats.cancelled&&!r.error;
   report.restoration.stats=inspection.lastStats??null;
  }catch(error){report.restoration.error=errorText(error);}
 }
 report.passed=!report.error&&report.views.length===4&&report.views.every(v=>v.samples===121&&v.mismatchCount===0)&&report.restoration.stateRestored&&report.restoration.fullSceneRendered;
 await persist();return report;
}
