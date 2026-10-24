/**
 * Shared, additive ground / basement DESIGN fields. No measured surface, old
 * model, official record, lift stop or old query implementation is modified.
 *
 * deriveGroundSystem(baseModel, official, options) returns an adapter envelope:
 *   baseModel: the exact original object; model: the renderer-compatible view;
 *   designModel: full proposed composite, retained even while disabled;
 *   datum, metadata, basementFloorIds, groundVisibleFloorIds, additions.
 *
 * Options: basementDepth (FFL-to-FFL metres, default 3.2), enabled, visible,
 * workDatumMpd (annotation only), basementOutlineLocal (editable rings contained
 * within the official component). Unknown actual depth / footprint stay null.
 * Disabling restores baseModel by reference; hiding only changes selection and
 * never deletes graph nodes or closes the proposed warehouse stair aperture.
 *
 * The only existing DESIGN host replaced in the composite is the warehouse's
 * first slab. That reversible aperture edit has a narrow change ledger. It is
 * not an edit to official footprint coordinates or measured exterior geometry.
 */
import { ASSEMBLY_SCHEMA, queryAssembly, queryAssemblyInside, intersectAssemblyRay } from '../r07/assemblies.mjs';
import { deriveStairRails, createRailInstance, queryStairRails, traceStairRails } from '../whole-building-r01/rails.mjs';
import { controllerFor } from '../whole-building-r02/mother-system.mjs';

export const GROUND_SYSTEM_SCHEMA = 'kaopu.source-bound-ground-basement/0.1';
const EPS = 1e-7;
const copy = value => structuredClone(value);
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const mul = (a,t) => a.map(v => v*t);
const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
const len = a => Math.hypot(...a);
const finite = (a,n) => Array.isArray(a) && a.length===n && a.every(Number.isFinite);
const X=[1,0,0], Y=[0,1,0], Z=[0,0,1], FLOOR=[X,Z,Y];
const rect = (a,b,c,d) => [[a,b],[c,b],[c,d],[a,d]];
const shiftBounds = (bounds,t) => ({min:add(bounds.min,t),max:add(bounds.max,t)});
const unionBounds = items => ({min:[0,1,2].map(i=>Math.min(...items.map(x=>x.bounds.min[i]))),max:[0,1,2].map(i=>Math.max(...items.map(x=>x.bounds.max[i])))});
const boundDistance = (p,b) => Math.hypot(...p.map((v,i)=>Math.max(b.min[i]-v,0,v-b.max[i])));
const world = (q,p) => add(p.origin,add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2]))));
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
function assertSystem(s) { if(s?.schema!==GROUND_SYSTEM_SCHEMA) throw Error('Ground-system adapter required'); }
function modelOf(value) { return value?.schema===GROUND_SYSTEM_SCHEMA ? value.baseModel : value; }
function sourceOrigin(value) {
 const origin=modelOf(value)?.sourceGeoreference?.originEastingNorthingHeight;
 if(!finite(origin,3)) throw Error('Original source coordinate origin required');
 return origin;
}
/** Scalar vertical conversions, never a translation of source geometry. */
export function sourceLocalToMpd(value,localY) { if(!Number.isFinite(localY)) throw Error('Finite source-local height required'); return sourceOrigin(value)[2]+localY; }
export function mpdToSourceLocal(value,mpd) { if(!Number.isFinite(mpd)) throw Error('Finite mPD height required'); return mpd-sourceOrigin(value)[2]; }

function prism(nodeId,loops,range,frame=FLOOR,origin=[0,0,0],materialRole=1) {
 const [u,v,w]=frame,p={kind:'finite_polygon_prism',nodeId,objectId:2000,materialRole,origin:copy(origin),u:copy(u),v:copy(v),w:copy(w),loops:copy(loops),range:copy(range),geometryEvidence:'authored_basement_proposal_not_measured_underground'};
 const points=loops.flat().flatMap(q=>range.map(h=>world([...q,h],p)));
 p.bounds={min:[0,1,2].map(i=>Math.min(...points.map(q=>q[i]))),max:[0,1,2].map(i=>Math.max(...points.map(q=>q[i])))};
 p.planes=[{normal:[0,0,1],offset:range[0],domain:'cap'},{normal:[0,0,1],offset:range[1],domain:'cap'}];
 for(const loop of loops) for(let i=0,j=loop.length-1;i<loop.length;j=i++) {
  const a=loop[j],b=loop[i],n=[b[1]-a[1],a[0]-b[0],0],L=len(n);
  if(L<EPS) throw Error('Degenerate basement prism edge');
  p.planes.push({normal:mul(n,1/L),offset:dot(n,[...a,0])/L,domain:'side',edge:[a,b]});
 }
 return p;
}
function archetype(id,primitives,caseId,extra={}) {
 primitives.forEach((p,i)=>p.objectId=2000+i);
 const a={schema:ASSEMBLY_SCHEMA,fieldKind:'evidence-assembly',id,caseId,primitives,bounds:unionBounds(primitives),counts:{primitives:primitives.length,modelTriangles:0,modelVertexBuffers:0},...extra};
 a.spec={schema:a.schema,fieldKind:a.fieldKind,primitives:a.primitives,bounds:a.bounds,counts:a.counts};
 return a;
}
function insideLoop(p,loop) {
 let inside=false;
 for(let i=0,j=loop.length-1;i<loop.length;j=i++) {
  const a=loop[j],b=loop[i];
  if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
 }
 return inside;
}
function segmentDistance(p,a,b) {
 const d=sub(b,a),den=dot(d,d),t=den<EPS*EPS?0:Math.max(0,Math.min(1,dot(sub(p,a),d)/den));
 return len(sub(p,add(a,mul(d,t))));
}
const onRing = (p,ring) => ring.some((a,i)=>segmentDistance(p,a,ring[(i+1)%ring.length])<=EPS);
const contains = (p,rings) => (insideLoop(p,rings[0])||onRing(p,rings[0]))&&!rings.slice(1).some(r=>insideLoop(p,r)&&!onRing(p,r));
function containedSegment(a,b,rings) {
 const d=sub(b,a),cuts=[0,1];
 for(const ring of rings) for(let i=0;i<ring.length;i++) {
  const p=ring[i],q=ring[(i+1)%ring.length],v=sub(q,p),w=sub(p,a),den=d[0]*v[1]-d[1]*v[0];
  if(Math.abs(den)>1e-12) {
   const t=(w[0]*v[1]-w[1]*v[0])/den,u=(w[0]*d[1]-w[1]*d[0])/den;
   if(t>0&&t<1&&u>=0&&u<=1) cuts.push(t);
  }
 }
 cuts.sort((a,b)=>a-b);
 return contains(a,rings)&&contains(b,rings)&&cuts.slice(1).every((t,i)=>contains(add(a,mul(d,(t+cuts[i])/2)),rings));
}
const polygonFits = (poly,rings) => poly.every((a,i)=>containedSegment(a,poly[(i+1)%poly.length],rings))&&!rings.slice(1).some(hole=>hole.some(p=>insideLoop(p,poly)&&!onRing(p,poly)));
function validatedRings(rings) {
 if(!Array.isArray(rings)||!rings.length) throw Error('Basement outline must contain finite simple rings');
 for(const r of rings) {
  if(!Array.isArray(r)||r.length<3||r.some(p=>!finite(p,2))) throw Error('Basement outline must contain finite simple rings');
  const area=r.reduce((sum,a,i)=>{const b=r[(i+1)%r.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
  if(Math.abs(area)<EPS) throw Error('Degenerate basement outline');
  for(let i=0;i<r.length;i++) {
   const a=r[i],b=r[(i+1)%r.length];
   if(len(sub(a,b))<EPS) throw Error('Degenerate basement outline edge');
   for(let j=i+1;j<r.length;j++) {
    if(j===i+1||(i===0&&j===r.length-1)) continue;
    const c=r[j],d=r[(j+1)%r.length],ab=sub(b,a),cd=sub(d,c),ac=sub(c,a),den=ab[0]*cd[1]-ab[1]*cd[0];
    if(Math.abs(den)<EPS) { if(segmentDistance(a,c,d)<EPS||segmentDistance(b,c,d)<EPS||segmentDistance(c,a,b)<EPS) throw Error('Self-intersecting basement outline'); }
    else { const t=(ac[0]*cd[1]-ac[1]*cd[0])/den,u=(ac[0]*ab[1]-ac[1]*ab[0])/den; if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS) throw Error('Self-intersecting basement outline'); }
   }
  }
 }
 for(const hole of rings.slice(1)) if(!polygonFits(hole,[rings[0]])) throw Error('Basement outline hole leaves outer ring');
 return copy(rings);
}
function officialComponent(base,official) {
 const id={lowrise:47805,kcc:229126,warehouse:237016}[base.caseId];
 const part=official?.parts?.find(p=>p.caseId===base.caseId&&p.attributes?.OBJECTID===id);
 if(!part||!Number.isFinite(part.attributes.BaseHeight)) throw Error('Matching exact official ground component required');
 const origin=sourceOrigin(base);
 const rings=part.ringsEPSG2326.map(r=>{
  if(!Array.isArray(r)||r.length<4||r.some(p=>!finite(p,2))||len(sub(r[0],r.at(-1)))>1e-6) throw Error('Official component ring must be closed');
  return r.slice(0,-1).map(p=>[p[0]-origin[0],origin[1]-p[1]]);
 });
 return {part,rings:validatedRings(rings)};
}
function point(s,x,y,z) { return add(s.origin,add(mul(s.X,x),add(mul(s.Y,y),mul(s.Z,z)))); }
function stairPlan(s) { return rect(-s.width/2,0,s.width/2,s.runLength+s.landingDepth).map(([x,z])=>{const p=point(s,x,0,z);return[p[0],p[2]];}); }
function stepProfile(start,dir,base,height,run,n,t) {
 const p=[[start,base-t],[start,base]];
 for(let i=0;i<n;i++) p.push([start+dir*run*i/n,base+height*(i+1)/n],[start+dir*run*(i+1)/n,base+height*(i+1)/n]);
 p.push([start+dir*run,base+height-t]);
 return p;
}
function stairFields(s) {
 const h=s.floorHeight/2,t=s.slabThickness,w=s.width/2,g=s.centerGap/2,R=s.runLength;
 return [prism('stair:flight:1',[stepProfile(0,1,0,h,R,s.risersPerFlight,t)],[-w,-g],[s.Z,s.Y,s.X],s.origin),prism('stair:landing:mid',[rect(-w,R,w,R+s.landingDepth)],[h-t,h],[s.X,s.Z,s.Y],s.origin),prism('stair:flight:2',[stepProfile(R,-1,h,h,R,s.risersPerFlight,t)],[g,w],[s.Z,s.Y,s.X],s.origin)];
}
function stairPath(s) {
 const x=(s.centerGap+s.flightWidth)/2,h=s.floorHeight/2,n=s.risersPerFlight,R=s.runLength,z=s.lowerAccess[2],p=[point(s,-x,0,z),point(s,-x,0,0)];
 for(let i=0;i<n;i++) p.push(point(s,-x,h*(i+1)/n,R*i/n),point(s,-x,h*(i+1)/n,R*(i+1)/n));
 p.push(point(s,-x,h,R+s.landingDepth/2),point(s,x,h,R+s.landingDepth/2),point(s,x,h,R));
 for(let i=0;i<n;i++) p.push(point(s,x,h+h*(i+1)/n,R-R*i/n),point(s,x,h+h*(i+1)/n,R-R*(i+1)/n));
 p.push(point(s,x,2*h,z));
 return p;
}
function layoutFor(base,depth,availableHole) {
 const native=base.interfaces.stairs[0]?.layout;
 if(!native) throw Error('Existing stair core domain required');
 const s=copy(native),maxRiser=base.config.maximumRiserHeight??.18,n=Math.ceil((depth-EPS)/(2*maxRiser));
 const minimumTread=base.config.stairTreadDepth??native.treadDepth;
 const run=base.caseId==='kcc'?native.runLength:n*minimumTread;
 if(n<3||n>32||run/n<minimumTread-EPS) throw Error('Basement depth exceeds existing stair tread / core domain');
 Object.assign(s,{id:base.sourceModelId+':ground-r01:stair-layout',floorHeight:depth,risersPerFlight:n,runLength:run,z0:0,z1:run,treadDepth:run/n,upperAccess:[native.upperAccess[0],depth,native.upperAccess[2]],geometryEvidence:'authored_basement_stair_in_existing_design_core_not_as_built'});
 if(!polygonFits(stairPlan(s),[availableHole])) throw Error('Basement depth requires a stair outside the existing aperture; edit rejected');
 return s;
}
/** Stable non-cryptographic change fingerprints for an inspectable host ledger. */
export function groundFieldHash(value) {
 let hash=0x811c9dc5;
 for(const c of JSON.stringify(value)) { hash^=c.charCodeAt(0);hash=Math.imul(hash,0x01000193); }
 return 'fnv1a32:'+((hash>>>0).toString(16).padStart(8,'0'));
}

export function deriveGroundSystem(baseModel,official,options={}) {
 const base=baseModel,controller=controllerFor(base?.caseId);
 if(base?.schema!==controller.modelSchema) throw Error('Matching unchanged base building model required');
 if(!options||typeof options!=='object'||Array.isArray(options)) throw Error('Ground design options must be an object');
 const allowed=['basementDepth','enabled','visible','workDatumMpd','basementOutlineLocal'];
 for(const key of Object.keys(options)) if(!allowed.includes(key)) throw Error('Unknown ground design option: '+key);
 for(const key of ['enabled','visible']) if(options[key]!==undefined&&typeof options[key]!=='boolean') throw Error(key+' must be boolean');
 const depth=options.basementDepth??3.2,slab=base.config.slabThickness;
 if(!Number.isFinite(depth)||depth<2.6||depth>4.2||depth-slab<base.config.minimumHeadroom-EPS) throw Error('Basement depth outside bounded design / headroom domain');
 const {part,rings:officialRings}=officialComponent(base,official),count=part.attributes.StoreysInBasement;
 if(count!==null&&(!Number.isInteger(count)||count<0||count>2)) throw Error('Unsupported official basement count');
 const workingMpd=options.workDatumMpd??part.attributes.BaseHeight;
 if(!Number.isFinite(workingMpd)||Math.abs(workingMpd-part.attributes.BaseHeight)>20) throw Error('Working datum outside bounded annotation range');
 const first=base.levels[0],origin=sourceOrigin(base),root=base.sourceModelId+':ground-r01',enabled=options.enabled??true,visible=options.visible??true;
 const datum={workingMpd,localY:workingMpd-origin[2],sourceOriginMpd:origin[2],sourceLocalZeroMpd:origin[2],officialComponentBaseMpd:part.attributes.BaseHeight,actualTerrainMpd:null,actualEntranceMpd:null,designEntryMpd:first.elevationMpd,approximate:true,evidence:'approximate_official_component_base_reference_not_surveyed_terrain_or_actual_entrance',annotationOnly:true};
 const rings=options.basementOutlineLocal===undefined?copy(officialRings):validatedRings(options.basementOutlineLocal);
 if(options.basementOutlineLocal!==undefined&&!count) throw Error('No basement outline may be generated for an unknown / zero basement count');
 if(!polygonFits(rings[0],officialRings)) throw Error('Proposed basement outline leaves official component bound');
 const metadata={evidence:'DESIGN_not_actual_underground_reconstruction',officialBasementCount:count,generatedBasementCount:count??0,officialComponentId:part.componentId,officialObjectId:part.attributes.OBJECTID,officialSourceUrl:part.sourceUrl,attribution:official.attribution,termsUrl:official.termsUrl,actualDepthM:null,actualOutline:null,actualBasementFFLMpd:null,actualBasementAccessKnown:false,actualLiftServesBasement:null,designDepthM:count?depth:null,depthDefinition:'design_FFL_to_FFL_difference_not_surveyed_depth_below_terrain',proposedOutlineLocal:count?copy(rings):null,outlineEvidence:'editable_official_podium_footprint_derived_proposal_not_actual_underground_extent',datum,groundFloorLabelNote:'Hong Kong G/F / 地下 denotes ground floor, not B1.',liftFutureInterface:{enabled:false,proposedBasementFloorIds:[],servedFloorIdsUnchanged:true,requiresSeparateDesignAndEvidence:true},structuralOrFireSafetyCertification:false};
 const additions={archetypes:[],instances:[],levels:[],stairs:[],rails:{templates:[],instances:[]},graph:{nodes:[],edges:[]},modifiedDesignHosts:[],corridors:[]};
 if(!count) {
  const result={schema:GROUND_SYSTEM_SCHEMA,baseModel:base,model:base,designModel:base,enabled,visible,datum,metadata,additions,basementFloorIds:[],groundVisibleFloorIds:base.levels.slice(0,2).map(l=>l.id)};
  result.validation=validateGroundSystem(result);return result;
 }
 const nativeFirstA=base.archetypes.find(a=>a.id===first.archetypeId),availableHole=nativeFirstA.holes?.stair??base.holes?.stair;
 if(!availableHole) throw Error('Existing design stair aperture domain missing');
 const layout=layoutFor(base,depth,availableHole),newHole=stairPlan(layout);
 const accessPlan=rect(-layout.width/2,-layout.accessLandingDepth,layout.width/2,0).map(([x,z])=>{const q=point(layout,x,0,z);return[q[0],q[2]];});
 if(!polygonFits(newHole,rings)||!polygonFits(accessPlan,rings)) throw Error('Basement outline excludes stair or its supported access corridor');
 const baseRoot=base.graph.nodes.find(n=>n.type==='building-system')?.id;
 if(!baseRoot) throw Error('Existing building-system graph root required');
 const node=(id,type,label,owner,extra={})=>{
  additions.graph.nodes.push({id,type,label,evidence:'authored_basement_design_not_as_built',sourceModelId:base.sourceModelId,...extra});
  if(owner) additions.graph.edges.push({type:'ownedBy',from:id,to:owner});return id;
 };
 const component=node(root,'basement-design-component','地下设计层：官方层数，深度与范围为方案',baseRoot,{actualDepthM:null,actualOutline:null,officialBasementCount:count});
 const core=node(root+':core','shared-core','地下至原最低层的设计楼梯',component);
 const keep=a=>(additions.archetypes.push(a),a);
 function place(a,id,floorId,translation,kind,bindings) {
  const i={id,archetypeId:a.id,floorId,translation:copy(translation),bounds:shiftBounds(a.bounds,translation),kind,objectIdOffset:500000+additions.instances.length*256,nodeBindings:bindings,groundExtension:true};
  additions.instances.push(i);return i;
 }
 // B1 is nearest ground. Array order is top-down only inside additions; the
 // combined model is sorted by true elevation without renumbering old levels.
 for(let n=1;n<=count;n++) {
  const id='B'+n,nid=root+':floor:'+id,elevation=first.elevation-n*depth;
  const floorHole=n<count?copy(newHole):null;
  const a=keep(archetype(root+':plate:'+id,[prism('floor:slab',[...rings,...(floorHole?[floorHole]:[])],[-slab,0])],base.caseId,{holes:{stair:floorHole,lifts:[]},sourceOutline:copy(rings[0]),undergroundOutlineVerified:false,lowestReceivingSlab:n===count}));
  const l={id,nodeId:nid,label:id+' · DESIGN 地下层',componentId:'basement-design',index:n-1,elevation,localY:elevation,elevationMpd:elevation+origin[2],fflM:elevation+origin[2],height:depth,clearHeight:depth-slab,actualFloorLabel:null,actualFFLMpd:null,archetypeId:a.id,elevationEvidence:'editable_design_not_surveyed_basement_FFL',groundExtension:true};
  additions.levels.push(l);node(nid,'design-storey',l.label,component,{elevation,actualFFLVerified:false});
  node(nid+':slab','floor-slab',n===count?'地下最底接收板，不虚构更深洞口':'地下楼板与真实楼梯孔洞',nid);
  node(nid+':lobby','shared-circulation','由楼板实体支承的地下通路',nid);
  node(nid+':landing','stair-landing','与双跑楼梯连续的层平台',core,{floorId:id,elevation});
  additions.graph.edges.push({type:'walksTo',from:nid+':lobby',to:nid+':landing',geometryBacked:true});
  const corridor=[point(layout,layout.lowerAccess[0],elevation,layout.lowerAccess[2]),point(layout,layout.upperAccess[0],elevation,layout.upperAccess[2])];
  additions.corridors.push({id:nid+':access-corridor',floorId:id,ownerId:nid+':slab',points:corridor,footprint:copy(accessPlan),geometryBacked:true,minimumHeadroom:depth-slab});
  place(a,nid+':instance',id,[0,elevation,0],'floor',{'floor:slab':nid+':slab'});
 }
 // Warehouse's old first-floor field is intentionally solid. Open only that
 // DESIGN slab in a separate archetype; all other primitive descriptors survive.
 let patchedInstance=null;
 if(!nativeFirstA.holes?.stair) {
  if(base.caseId!=='warehouse') throw Error('Only the explicit warehouse DESIGN receiving slab may be patched');
  const oldPlate=nativeFirstA.primitives.find(p=>p.nodeId==='floor:slab');
  if(!oldPlate) throw Error('Warehouse first slab host missing');
  const newPlate=prism(oldPlate.nodeId,[...oldPlate.loops,copy(availableHole)],oldPlate.range,[oldPlate.u,oldPlate.v,oldPlate.w],oldPlate.origin,oldPlate.materialRole);
  const a=keep(archetype(root+':ground-aperture',nativeFirstA.primitives.map(p=>p===oldPlate?newPlate:copy(p)),base.caseId,{...copy(Object.fromEntries(Object.entries(nativeFirstA).filter(([k])=>!['id','spec','primitives','bounds','counts','schema','fieldKind','caseId'].includes(k)))),holes:{...copy(nativeFirstA.holes),stair:copy(availableHole)}}));
  const oldInstance=base.instances.find(i=>i.floorId===first.id&&i.kind==='floor');
  patchedInstance={...copy(oldInstance),archetypeId:a.id,bounds:shiftBounds(a.bounds,oldInstance.translation),groundDesignHostPatch:true};
  additions.modifiedDesignHosts.push({instanceId:oldInstance.id,primitiveId:oldPlate.nodeId,oldArchetypeId:nativeFirstA.id,newArchetypeId:a.id,reason:'Reversible stair aperture in existing DESIGN receiving slab, required for physical B1-to-P01 circulation; measured exterior untouched.',oldHash:groundFieldHash(oldPlate),newHash:groundFieldHash(a.primitives.find(p=>p.nodeId===oldPlate.nodeId)),hashAlgorithm:'FNV-1a 32-bit non-cryptographic change fingerprint'});
 }
 const stairA=keep(archetype(root+':stair-rise:'+depth.toFixed(9),stairFields(layout),base.caseId,{stair:copy(layout)}));
 const template=deriveStairRails({...layout,id:stairA.id+':rail-template'});additions.rails.templates.push(template);
 for(let n=1;n<=count;n++) {
  const lower=additions.levels[n-1],upper=n===1?first:additions.levels[n-2],id=core+':stair:'+lower.id+'-'+upper.id;
  const s={id,fromFloorId:lower.id,toFloorId:upper.id,fromLandingId:lower.nodeId+':landing',toLandingId:upper.nodeId+':landing',lowerElevation:lower.elevation,upperElevation:upper.elevation,rise:depth,layout:copy(layout),archetypeId:stairA.id,path:stairPath(layout).map(p=>add(p,[0,lower.elevation,0])),minimumHeadroom:depth-slab,geometryEvidence:'authored_basement_stair_real_field_joins_not_measured',groundExtension:true};
  s.joins={lower:copy(s.path[0]),upper:copy(s.path.at(-1)),exactElevationMatch:true};
  additions.stairs.push(s);node(id,'double-run-stair','设计楼梯 '+lower.id+' → '+upper.id,core,{fromFloorId:lower.id,toFloorId:upper.id});
  const bindings={};for(const suffix of ['flight:1','landing:mid','flight:2']) {node(id+':'+suffix,suffix.startsWith('flight')?'stair-flight':'stair-landing',suffix,id);bindings['stair:'+suffix]=id+':'+suffix;}
  additions.graph.edges.push({type:'walksTo',from:s.fromLandingId,to:id,geometryBacked:true},{type:'walksTo',from:id,to:s.toLandingId,geometryBacked:true});
  place(stairA,id+':instance',lower.id,[0,lower.elevation,0],'stair',bindings);
  const rail=createRailInstance(template,{id:id+':rail',stairId:id,lowerFloorId:s.fromLandingId,upperFloorId:s.toLandingId,landingId:id+':landing:mid',frame:{origin:add(layout.origin,[0,lower.elevation,0]),xAxis:layout.X,zAxis:layout.Z}});
  rail.groundExtension=true;additions.rails.instances.push(rail);
  for(const n of rail.graph.nodes) node(n.id,n.kind,n.kind,n.parentId,n);
  additions.graph.edges.push(...rail.graph.edges.map(e=>({...e,type:e.relation})));
 }
 const instances=base.instances.map(i=>patchedInstance&&i.id===patchedInstance.id?patchedInstance:i).concat(additions.instances);
 const archetypes=base.archetypes.concat(additions.archetypes),levels=base.levels.concat(additions.levels).sort((a,b)=>a.elevation-b.elevation);
 // Preserve aboveground level objects too; patched host is resolved by instance
 // ID and recorded in modifiedDesignHosts, not by rewriting the old level record.
 const designModel={...base,archetypes,instances,levels,interfaces:{...base.interfaces,stairs:base.interfaces.stairs.concat(additions.stairs),lifts:base.interfaces.lifts},rails:{templates:base.rails.templates.concat(additions.rails.templates),instances:base.rails.instances.concat(additions.rails.instances)},graph:{...base.graph,nodes:base.graph.nodes.concat(additions.graph.nodes),edges:base.graph.edges.concat(additions.graph.edges)},bounds:unionBounds([...instances,...base.rails.instances,...additions.rails.instances]),groundExtension:{schema:GROUND_SYSTEM_SCHEMA,datum,metadata,modifiedDesignHosts:additions.modifiedDesignHosts},summary:{...base.summary,basementGenerated:true,designBasementCount:count,designFloorCount:levels.length,floorCount:levels.length,stairConnectorCount:base.interfaces.stairs.length+additions.stairs.length},counts:{...base.counts,archetypes:archetypes.length,instances:instances.length,primitives:archetypes.reduce((sum,a)=>sum+a.primitives.length,0),expandedPrimitiveCount:instances.reduce((sum,i)=>sum+archetypes.find(a=>a.id===i.archetypeId).primitives.length,0)}};
 const basementFloorIds=additions.levels.map(l=>l.id);
 metadata.liftFutureInterface.proposedBasementFloorIds=copy(basementFloorIds);
 const result={schema:GROUND_SYSTEM_SCHEMA,baseModel:base,model:enabled?designModel:base,designModel,enabled,visible,datum,metadata,additions,basementFloorIds,groundVisibleFloorIds:basementFloorIds.concat(base.levels.slice(0,2).map(l=>l.id))};
 result.validation=validateGroundSystem(result);
 return result;
}

/** Hide is reversible selection only, not geometry or graph deletion. */
export function setGroundVisibility(s,visible) { assertSystem(s);if(typeof visible!=='boolean')throw Error('Visibility must be boolean');return {...s,visible}; }
/** Disabling the proposal returns the exact base model including its old slab. */
export function setGroundEnabled(s,enabled) { assertSystem(s);if(typeof enabled!=='boolean')throw Error('Enabled must be boolean');return {...s,enabled,model:enabled?s.designModel:s.baseModel}; }
export function selectedGroundInstances(s,{floorIds=null,includeStairs=true,includeHidden=false}={}) {
 assertSystem(s);const wanted=floorIds===null?null:new Set(floorIds);
 return s.model.instances.filter(i=>(includeHidden||s.visible||!i.groundExtension)&&(!wanted||wanted.has(i.floorId))&&(includeStairs||i.kind!=='stair'));
}
export function selectedGroundRails(s,{floorIds=null,includeHidden=false}={}) {
 assertSystem(s);const wanted=floorIds===null?null:new Set(floorIds),stairs=new Map(s.model.interfaces.stairs.map(t=>[t.id,t]));
 return s.model.rails.instances.filter(r=>{
  const stair=stairs.get(r.stairId);return (includeHidden||s.visible||!r.groundExtension)&&(!wanted||wanted.has(stair?.fromFloorId));
 });
}
function fieldOwner(s,i,prototype) {
 if(i.nodeBindings?.[prototype])return i.nodeBindings[prototype];
 if(s.baseModel.caseId!=='kcc')return i.id+':'+prototype;
 if(i.kind==='floor') {
  const level=s.model.levels.find(l=>l.id===i.floorId);
  if(prototype==='floor:slab')return level.nodeId+':slab';
  if(prototype.endsWith(':source-lift-core'))return 'KCC:whole-design:core';
  const letter=prototype.match(/source-unit-([A-F])-partition/);
  if(letter)return level.nodeId+':unit:'+letter[1]+':walls';
 }
 if(i.kind==='stair') {
  const id=i.id.replace(/:instance$/,'');
  if(prototype.endsWith('flight-1'))return id+':flight:1';
  if(prototype.endsWith('flight-2'))return id+':flight:2';
  if(prototype.endsWith('mid-landing'))return id+':landing:mid';
 }
 if(i.kind==='entry')return s.baseModel.entry.id;
 if(i.kind==='lift-door')return i.id.replace(/:barrier$/,'');
 if(i.kind==='lift-car')return i.id.replace(/-instance$/,'');
 if(i.kind==='lift-dock')return i.id.replace(/:dock-instance$/,':door:'+i.floorId);
 return i.id+':'+prototype;
}
function queryContext(s,{floorIds,instances,liftState,visibleOnly}) {
 const controller=controllerFor(s.baseModel.caseId);
 const dynamic=s.baseModel.interfaces.lifts.length?controller.liftVisuals(s.baseModel,liftState??controller.createLiftState(s.baseModel)):null;
 return {archetypes:s.model.archetypes.concat(dynamic?.archetypes??[]),items:instances??selectedGroundInstances(s,{floorIds,includeHidden:!visibleOnly}).concat((dynamic?.instances??[]).filter(i=>floorIds===null||i.floorId===null||floorIds.includes(i.floorId)))};
}
/** Physical queries are visibility-independent by default. Pass visibleOnly for
 * picking rendered instances; hiding does not change the design's occupancy. */
export function queryGroundSystem(s,p,{floorIds=null,instances=null,includeRails=false,visibleOnly=false,liftState=null}={}) {
 assertSystem(s);if(!finite(p,3))throw Error('Finite 3D ground query point required');
 const {items,archetypes}=queryContext(s,{floorIds,instances,liftState,visibleOnly});
 let best={distance:Infinity,inside:false},evaluations=0;
 for(const i of items) {
  if(boundDistance(p,i.bounds)>Math.max(0,best.distance)+EPS)continue;
  const a=archetypes.find(a=>a.id===i.archetypeId);if(!a)throw Error('Missing ground archetype');
  const h=queryAssembly(a,sub(p,i.translation));evaluations++;
  if(h.distance<best.distance-EPS)best={...h,point:copy(p),instanceId:i.id,floorId:i.floorId,archetypeId:a.id,prototypeNodeId:h.nodeId,nodeId:fieldOwner(s,i,h.nodeId),objectId:h.objectId+(i.objectIdOffset??0)};
 }
 if(includeRails)for(const r of selectedGroundRails(s,{floorIds,includeHidden:!visibleOnly})) {const h=queryStairRails(r,p);if(h.distance<best.distance)best={...h,nodeId:h.ownerId,instanceId:r.id};}
 return {...best,instanceEvaluations:evaluations,method:'shared_exact_prism_and_continuous_rail_fields'};
}
export function intersectGroundSystemRay(s,origin,direction,{maxDistance=10000,floorIds=null,instances=null,includeRails=false,visibleOnly=false,liftState=null}={}) {
 assertSystem(s);if(!finite(origin,3)||!finite(direction,3)||len(direction)<EPS||!Number.isFinite(maxDistance)||maxDistance<=0)throw Error('Valid ground ray required');
 const rd=mul(direction,1/len(direction)),{items,archetypes}=queryContext(s,{floorIds,instances,liftState,visibleOnly});
 let best={hit:false,status:'miss',t:maxDistance},tests=0;
 for(const i of items) {
  let traveled=0;
  for(let n=0;n<16;n++) {
   const a=archetypes.find(a=>a.id===i.archetypeId),h=intersectAssemblyRay(a,sub(add(origin,mul(rd,traveled)),i.translation),rd,{maxDistance:best.t-traveled});tests++;
   if(!h.hit)break;
   const t=h.t+traveled,p=add(h.point,i.translation);
   if([-1,1].every(side=>queryGroundSystem(s,add(p,mul(h.normal,side*1e-5)),{instances:items,liftState}).inside)) {traveled=t+2e-5;if(traveled>=best.t)break;continue;}
   best={...h,t,point:p,instanceId:i.id,floorId:i.floorId,archetypeId:a.id,prototypeNodeId:h.nodeId,nodeId:fieldOwner(s,i,h.nodeId),objectId:h.objectId+(i.objectIdOffset??0)};break;
  }
 }
 if(includeRails)for(const r of selectedGroundRails(s,{floorIds,includeHidden:!visibleOnly})) {const h=traceStairRails(r,origin,rd,{maxDistance:best.t});if(h.hit&&h.t<best.t)best={...h,nodeId:h.ownerId,instanceId:r.id};else if(h.status==='unresolved'&&h.t<best.t)best={...h,hit:false,status:'unresolved'};}
 return {...best,instanceTests:tests,method:'exact_finite_prism_plane_domain_intersection'};
}

/** Native aboveground routes stay exact. Basement routes reuse the native
 * ground approach, cross supported access landings, then descend real stairs. */
export function routeGroundSystem(s,targetFloorId,options={}) {
 assertSystem(s);const controller=controllerFor(s.baseModel.caseId);
 if(!s.basementFloorIds.includes(targetFloorId))return controller.route(s.baseModel,targetFloorId,options);
 if(!s.enabled)throw Error('Basement design is disabled');
 if(options.mode&&options.mode!=='stairs')throw Error('No lift service to basement is assumed; use the DESIGN stairs');
 const base=s.baseModel,target=s.additions.levels.find(l=>l.id===targetFloorId),native=controller.route(base,base.levels[1].id,{mode:'stairs'}),segments=[];
 for(const segment of native.segments) {if(segment.kind==='stairs')break;segments.push(copy(segment));}
 let cursor=segments.at(-1).points.at(-1);
 for(const stair of s.additions.stairs) {
  const reverse=copy(stair.path).reverse();
  segments.push({kind:'landing',floorId:stair.toFloorId,points:[copy(cursor),copy(reverse[0])],geometryBacked:true});
  segments.push({kind:'stairs',stairId:stair.id,fromFloorId:stair.toFloorId,toFloorId:stair.fromFloorId,points:reverse,headroom:stair.minimumHeadroom,descending:true,geometryBacked:true});
  cursor=reverse.at(-1);if(stair.fromFloorId===targetFloorId)break;
 }
 const corridor=s.additions.corridors.find(c=>c.floorId===targetFloorId);
 segments.push({kind:'walk',floorId:targetFloorId,points:copy(corridor.points),geometryBacked:true});
 return {status:'authored_route',mode:'stairs',from:base.entry.id,to:target.nodeId,fromFloorId:base.levels[0].id,targetFloorId,segments,points:segments.flatMap(s=>s.points??[]),streetApproachVerified:false,actualRouteVerified:false,requiresLiftArrival:false,designGraphConnected:true,basementDesign:true};
}
function solidAt(s,p) { return queryGroundSystem(s,p).inside; }
function verticalClear(s,p,height) {
 const origin=add(p,[0,.005,0]),limit=height-.01;
 return !intersectGroundSystemRay(s,origin,[0,1,0],{maxDistance:limit}).hit;
}
function validateWalk(s,points,headroom) {
 for(let k=1;k<points.length;k++) {
  const a=points[k-1],b=points[k],steps=Math.max(1,Math.ceil(len(sub(b,a))/.15));
  for(let j=0;j<=steps;j++) {const p=add(a,mul(sub(b,a),j/steps));if(queryGroundSystem(s,add(p,[0,-.012,0])).distance>EPS)throw Error('Basement corridor lacks real slab support at '+JSON.stringify(p));if(!verticalClear(s,p,headroom))throw Error('Basement corridor headroom collision');}
 }
}
export function validateGroundSystem(s) {
 assertSystem(s);const active={...s,model:s.designModel,enabled:true},base=s.baseModel,model=s.designModel,ids=new Set();
 for(const n of model.graph.nodes) {if(ids.has(n.id))throw Error('Duplicate ground graph node');ids.add(n.id);}
 for(const e of model.graph.edges)if(!ids.has(e.from)||!ids.has(e.to))throw Error('Ground graph relation has missing endpoint');
 if(!same(model.sourceGeoreference,base.sourceGeoreference)||!same(model.sourceBinding,base.sourceBinding))throw Error('Source geometry binding changed');
 if(!same(model.interfaces.lifts,base.interfaces.lifts))throw Error('Basement proposal must not extend lift service');
 for(const l of base.levels)if(model.levels.find(q=>q.id===l.id)!==l)throw Error('Original aboveground level changed');
 for(const a of base.archetypes)if(model.archetypes.find(q=>q.id===a.id)!==a)throw Error('Original aboveground archetype changed');
 const ledger=s.additions.modifiedDesignHosts;
 for(const i of base.instances) {
  const next=model.instances.find(q=>q.id===i.id);
  if(next!==i&&!ledger.some(h=>h.instanceId===i.id&&base.caseId==='warehouse'&&i.floorId===base.levels[0].id&&i.kind==='floor'))throw Error('Unapproved old design instance replacement');
 }
 if(s.metadata.actualDepthM!==null||s.metadata.actualOutline!==null||s.datum.actualEntranceMpd!==null)throw Error('Unknown actual ground facts must remain unknown');
 if(base.caseId==='lowrise'&&(s.basementFloorIds.length||s.additions.instances.length||s.metadata.officialBasementCount!==null))throw Error('No inferred lowrise basement');
 for(const stair of s.additions.stairs) {
  const lower=model.levels.find(l=>l.id===stair.fromFloorId),upper=model.levels.find(l=>l.id===stair.toFloorId),layout=stair.layout,a=model.archetypes.find(a=>a.id===stair.archetypeId);
  if(!lower||!upper||Math.abs(stair.path[0][1]-lower.elevation)>EPS||Math.abs(stair.path.at(-1)[1]-upper.elevation)>EPS)throw Error('Basement stair fails exact floor join');
  const x=(layout.centerGap+layout.flightWidth)/2,h=stair.rise/2,R=layout.runLength,n=layout.risersPerFlight;
  for(let k=0;k<n;k++)for(const side of [-1,1]) {
   const local=point(layout,side*x,(side<0?0:h)+h*(k+1)/n,side<0?R*(k+.5)/n:R*(1-(k+.5)/n));
   if(!queryAssemblyInside(a,add(local,[0,-.012,0])))throw Error('Basement stair tread has no real field support');
   if(!verticalClear(active,add(local,[0,lower.elevation,0]),base.config.minimumHeadroom))throw Error('Basement stair headroom intersects a slab or repeated flight');
  }
  for(const p of [stair.path[0],stair.path.at(-1)])if(!solidAt(active,add(p,[0,-.012,0])))throw Error('Basement access landing floats');
  const upperI=model.instances.find(i=>i.kind==='floor'&&i.floorId===upper.id),upperA=model.archetypes.find(a=>a.id===upperI.archetypeId),plate=upperA.primitives.find(p=>p.nodeId==='floor:slab'),hole=stairPlan(layout);
  if(!upperA.holes?.stair||!polygonFits(hole,[upperA.holes.stair]))throw Error('Basement stair lacks a real upper slab hole');
  const center=hole.reduce((p,q)=>add(p,mul(q,1/hole.length)),[0,0]);
  if(queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:[plate]},[center[0],-.05,center[1]]))throw Error('Basement upper slab seals stair');
 }
 for(const c of s.additions.corridors)validateWalk(active,c.points,base.config.minimumHeadroom);
 for(const r of s.additions.rails.instances)for(const support of r.supports) {
  if(!ids.has(support.ownerId)||!solidAt(active,support.startWorld))throw Error('Basement rail support lacks a physical owner surface');
  if(support.handrailContact.distance>EPS)throw Error('Basement rail support misses continuous handrail');
 }
 for(const id of s.basementFloorIds) {
  const route=routeGroundSystem(active,id);
  for(const segment of route.segments.filter(p=>p.points&&p.kind!=='stairs'))validateWalk(active,segment.points,segment.kind==='entry'?Math.min(base.config.minimumHeadroom,base.entry.height-.05):base.config.minimumHeadroom);
 }
 const seen=new Set([base.entry.id]);let changed=true;
 while(changed) {changed=false;for(const e of model.graph.edges.filter(e=>e.type==='walksTo')) {if(seen.has(e.from)&&!seen.has(e.to)){seen.add(e.to);changed=true;}if(seen.has(e.to)&&!seen.has(e.from)){seen.add(e.from);changed=true;}}}
 if(s.additions.levels.some(l=>!seen.has(l.nodeId+':lobby')))throw Error('Basement circulation graph disconnected');
 return {status:'bounded_design_fields_and_connectivity_passed',officialBasementCount:s.metadata.officialBasementCount,generatedBasements:s.basementFloorIds.length,sourceUnchanged:true,abovegroundRetainedExceptDeclaredDesignHost:ledger.length,exactStairJoins:true,slabAperturesOpen:true,corridorsSupported:true,railSupportsOnRealFields:true,headroomRaysPassed:true,allGraphReferencesResolved:true,liftServiceUnchanged:true,actualDepthKnown:false,actualUndergroundOutlineKnown:false,structuralOrFireSafetyCertification:false};
}
