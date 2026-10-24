import {attachOpeningOwnership,validateOpeningOwnership} from './opening-ownership.mjs';
import {hostOpening} from './building-rules.mjs';
import {observedFloor,KCC_ID} from './kcc-observed-layout.mjs';
import {finitePrism,PLAN_A_TOPOLOGY} from './kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs';
import {ASSEMBLY_SCHEMA,packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';
export const INSPECTION_ASSUMPTIONS=Object.freeze({metresPerViewPixel:.0314,wallHeight:2.7,wallThickness:.18,slabThickness:.18,doorHeight:2.1,doorWidth:.9,doorLeafThickness:.04,stairHalfRise:1.35,stairSteps:8});
const bound=ps=>({min:[0,1,2].map(k=>Math.min(...ps.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p.bounds.max[k])))});
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
/** Detached model in source-plan local axes. NO placement in actual building.
 * Inputs are deliberately required and reported as assumptions, never surveyed. */
export function buildCandidateStructure({actualFloor,assumptions,doorOpen=0,liftOpen=[0,0,0],rotationCandidate='plan-local',preparedLayout=null}){
 const layout=preparedLayout??observedFloor(actualFloor);if(layout.floorLabel!==actualFloor||layout.buildingId!==KCC_ID)throw Error('Prepared layout identity mismatch');if(!layout.supported)throw Error('Unsupported observed floor');
 if(!assumptions||Object.keys(INSPECTION_ASSUMPTIONS).some(k=>!Number.isFinite(assumptions[k])||assumptions[k]<=0))throw Error('Explicit finite inspection assumptions required');
 const c={...assumptions};if(c.doorHeight>=c.wallHeight||c.wallThickness>.5||c.wallThickness<.05||c.metresPerViewPixel>.1||c.metresPerViewPixel<.005||c.stairSteps<3||!Number.isInteger(c.stairSteps)||!Number.isFinite(doorOpen)||doorOpen<0||doorOpen>1||liftOpen.length!==3||liftOpen.some(t=>!Number.isFinite(t)||t<0||t>1))throw Error('Invalid inspection parameter');
 if(!['plan-local','R0','R180'].includes(rotationCandidate))throw Error('Unknown comparison orientation');
 const angle=rotationCandidate==='R0'?-1.9471871519880037:rotationCandidate==='R180'?1.1945189628408697:0;
 const map=p=>{const x=(p[0]-680)*c.metresPerViewPixel,z=(p[1]-515)*c.metresPerViewPixel;return[x*Math.cos(angle)-z*Math.sin(angle),x*Math.sin(angle)+z*Math.cos(angle)];};
 const ps=[],nodes=[{id:'candidate',type:'inspection_candidate',buildingId:KCC_ID,evidence:'NOT_AS_BUILT_NOT_REGISTERED'}],edges=[],portals=[],openingSeeds=[];
 const add=(id,cls,loops,range,options={})=>{const p=finitePrism(id,loops,range,options);p.objectId=2000+ps.length;p.semanticClass=cls;p.geometryEvidence='plan-topology-plus-explicit-inspection-assumptions';ps.push(p);nodes.push({id,type:cls,evidence:'candidate_geometry_not_surveyed',actualFloor,ownerBuildingId:KCC_ID});edges.push({from:id,to:'candidate',type:'ownedBy'});return p;};
 const wall=(id,a,b,{opening=null,cls='wall',open=0,width=c.doorWidth}={})=>{const x=map(a),z=map(b),dx=z[0]-x[0],dz=z[1]-x[1],L=Math.hypot(dx,dz);if(L<1e-5)return;const u=[dx/L,0,dz/L],v=[0,1,0],w=[-dz/L,0,dx/L],origin=[x[0],0,x[1]];
 const actualLeaves=[];let loop=rect(0,0,L,c.wallHeight);
 if(opening){const q=map(opening),openingRule=hostOpening({a:x,b:z,center:q,width,height:c.doorHeight,wallThickness:c.wallThickness,clampForInspection:true}),at=openingRule.at,lo=openingRule.left,hi=openingRule.right;loop=[[0,0],[lo,0],[lo,c.doorHeight],[hi,c.doorHeight],[hi,0],[L,0],[L,c.wallHeight],[0,c.wallHeight]];
 portals.push({id,origin,u,v,w,lo,hi,height:c.doorHeight,width,semanticClass:cls});
 if(cls==='elevator'){for(const side of[-1,1]){const start=at+(side<0?-width/2:0)+side*open*width/2;const o=[origin[0]+u[0]*start+w[0]*(c.wallThickness/2+.03),0,origin[2]+u[2]*start+w[2]*(c.wallThickness/2+.03)];actualLeaves.push(add(id+':leaf-'+side,'elevator',[rect(0,0,width/2,c.doorHeight)],[-.015,.015],{u,v,w,origin:o}));}}else{const theta=open*Math.PI/2,du=[u[0]*Math.cos(theta)+w[0]*Math.sin(theta),0,u[2]*Math.cos(theta)+w[2]*Math.sin(theta)],dw=[-du[2],0,du[0]],o=[origin[0]+u[0]*lo,0,origin[2]+u[2]*lo];actualLeaves.push(add(id+':leaf',cls==='elevator'?'elevator':'door',[rect(0,0,width,c.doorHeight)],[-c.doorLeafThickness/2,c.doorLeafThickness/2],{u:du,v,w:dw,origin:o}));}}
 add(id,cls,[loop],[-c.wallThickness/2,c.wallThickness/2],{u,v,w,origin});nodes.find(n=>n.id===id).hostRole='wall';if(opening)openingSeeds.push({wallId:id,actualLeaves});};
 const closest=(polygon,point)=>{let best=null;polygon.forEach((a,i)=>{const b=polygon[(i+1)%polygon.length],ab=b.map((v,k)=>v-a[k]),L=ab[0]**2+ab[1]**2,t=Math.max(0,Math.min(1,((point[0]-a[0])*ab[0]+(point[1]-a[1])*ab[1])/L)),q=mix(a,b,t),d=Math.hypot(q[0]-point[0],q[1]-point[1]);if(!best||d<best.d)best={i,q,d};});return best;};
 const polygonWalls=(id,polygon,entry,cls='wall',open=0)=>{const hit=entry?closest(polygon,entry):null;polygon.forEach((a,i)=>wall(id+':edge-'+i,a,polygon[(i+1)%polygon.length],{opening:hit?.i===i?hit.q:null,cls,open}));};
 const units=layout.nodes.filter(n=>n.type==='dwelling');
 for(const n of units){add('floor:'+n.label,'floor',[n.polygon.map(map)],[-c.slabThickness,0]);const entry=layout.nodes.find(q=>q.type==='entry_door'&&q.id.endsWith('door-'+n.label));polygonWalls('unit:'+n.label,n.polygon,entry.point,'wall',doorOpen);}
 // Reuse already traced A-flat interior only for its actual lower plan family.
 if(layout.family==='lower'){const toView=p=>[p[0]*1414/3308,p[1]*1000/2339];for(const part of PLAN_A_TOPOLOGY.walls){if(part.key==='entry-host')continue;const a=toView(part.a),b=toView(part.b),L=Math.hypot(part.b[0]-part.a[0],part.b[1]-part.a[1]),door=part.doors?.[0],point=door?toView(mix(part.a,part.b,door.at/L)):null;wall('unit:A:internal:'+part.key,a,b,{opening:point,open:doorOpen,width:door?door.width*1414/3308*c.metresPerViewPixel:c.doorWidth});}}
 const lifts=layout.nodes.filter(n=>n.type==='lift_interface'),meter=layout.nodes.find(n=>n.type==='meter_room'),stair=layout.stairEnvelope;
 const coreLeft=Math.min(...stair.map(p=>p[0]))-44,coreRight=Math.max(...stair.map(p=>p[0]))+44,top=Math.min(...lifts.flatMap(n=>n.polygon.map(p=>p[1])))-14,bottom=Math.max(...stair.map(p=>p[1]));
 add('floor:core','floor',[rect(coreLeft,top,coreRight,bottom).map(map),...lifts.map(n=>n.polygon.map(map)),stair.map(map)],[-c.slabThickness,0]);
 lifts.forEach((n,i)=>{const poly=n.polygon,a=poly[2],b=poly[3];polygonWalls('lift:'+(i+1),poly,mix(a,b,.5),'elevator',liftOpen[i]);add('lift:'+(i+1)+':cabin-floor','elevator',[poly.map(map)],[-.10,-.04]);});
 polygonWalls('meter',meter.polygon,mix(meter.polygon[2],meter.polygon[3],.6),'wall',doorOpen);
 // Explicitly schematic opposed flights. Plan confirms entrances, not interlock.
 const xmin=Math.min(...stair.map(p=>p[0])),xmax=Math.max(...stair.map(p=>p[0])),zmin=Math.min(...stair.map(p=>p[1])),zmax=Math.max(...stair.map(p=>p[1])),mid=(zmin+zmax)/2;
 for(let side=0;side<2;side++){const z0=side?mid+2:zmin+3,z1=side?zmax-3:mid-2;for(let i=0;i<c.stairSteps;i++){const a=xmin+38+(xmax-xmin-76)*i/c.stairSteps,b=xmin+38+(xmax-xmin-76)*(i+1)/c.stairSteps,h=(side?-1:1)*c.stairHalfRise*(i+1)/c.stairSteps;add('stair:route-'+side+':step-'+i,'stair',[rect(a,z0,b,z1).map(map)],[h-.13,h]);}}
 const stairEntries=layout.nodes.filter(n=>n.type==='stair_route_entry');polygonWalls('stair:enclosure',stair,null,'stair');
 // Remove uncut left/right enclosure hosts and replace with entry portals.
 for(const [i,entry]of stairEntries.entries()){const hit=closest(stair,entry.point),old='stair:enclosure:edge-'+hit.i;const ix=ps.findIndex(p=>p.nodeId===old);if(ix>=0)ps.splice(ix,1);const ni=nodes.findIndex(n=>n.id===old);if(ni>=0)nodes.splice(ni,1);const ei=edges.findIndex(e=>e.from===old);if(ei>=0)edges.splice(ei,1);wall(old,stair[hit.i],stair[(hit.i+1)%stair.length],{opening:hit.q,cls:'stair',open:doorOpen});}
 for(const n of layout.nodes.filter(n=>n.type==='sixth_floor_platform'))add(n.id,'floor',[n.polygon.map(map)],[-c.slabThickness,0]);
 ps.forEach((p,i)=>p.objectId=2000+i);
 const openingChains=openingSeeds.map(({wallId,actualLeaves})=>{
  const parts=actualLeaves.map(p=>{p.semanticPartNodeId=p.nodeId;return{id:p.nodeId,type:'leaf',objectId:p.objectId};});
  const chain=attachOpeningOwnership({nodes,edges},{buildingId:KCC_ID,wallId,openingId:wallId+':opening',infillId:wallId+':door-assembly',infillType:'door',parts});
  for(const id of[chain.openingId,chain.infillId])nodes.find(n=>n.id===id).evidence='candidate_geometry_not_surveyed';return chain;
 });
 const openingValidation=validateOpeningOwnership({nodes,edges},openingChains);if(!openingValidation.passed)throw Error('Candidate opening ownership: '+JSON.stringify(openingValidation.errors));
 const bounds=bound(ps),archetypes=[];for(let i=0;i<ps.length;i+=64){const primitives=ps.slice(i,i+64),a={schema:ASSEMBLY_SCHEMA,id:'observed-candidate-'+i,primitives,bounds:bound(primitives),counts:{primitives:primitives.length,modelTriangles:0,modelVertexBuffers:0}};packAssemblyDescriptors(a);archetypes.push(a);}
 const model={sourceModelId:KCC_ID,openingOwnership:{chains:openingChains,validation:openingValidation},placementMode:'UNREGISTERED_evidence_plan_NOT_part_of_measured_mother',graph:{nodes,edges},levels:[{id:'observed-'+actualFloor+'F',nodeId:'candidate',label:actualFloor+'/F 待定位候选',elevation:0,actualElevation:null}],archetypes,instances:archetypes.map(a=>({id:a.id+':floor',archetypeId:a.id,translation:[0,0,0],floorId:'observed-'+actualFloor+'F',objectIdOffset:10000,bounds:a.bounds})),interfaces:{stairs:[]},bounds};
 return{model,layout,portals,assumptions:c,rotationCandidate,claims:{registered:false,actualHeights:false,actualThickness:false,stairInterlockVerified:false,sourceGeometryChanged:false,modelTriangles:0},bounds};
}
