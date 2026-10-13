// Complete accepted R02 footbridge/stair recipe, evaluated in its source frame.
// old(x,y,z) -> station(z,y,-x); no reflected stair flights or beam sections.
// Only construction parameters are authored here. No expanded geometry is used.
import{sourceShapeMember,stationMemberSample,stationMemberBounds,stationToSource,sourceBeamBasis,stationAssemblySupportWGSL,nativeFloat as f,nativeVec as v}from'./native-station-lamps.mjs';
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const finite=(n,k)=>{if(!Number.isFinite(n))throw Error('Invalid footbridge '+k);return n;};
const points=(a,k,n=4)=>{if(!Array.isArray(a)||a.length!==n||!a.every(Number.isFinite))throw Error('Invalid footbridge '+k);return a.slice();};
export function footbridgePlan({deck=.85,deckY=6.65,bridgeZ=-120,width=2.4,stairWidth=1.5,stairRiserMax=.18,stairTread=.29,platformCenters=[-30,-10,10,30],platformHalfWidths=[3.4,3.4,3.4,3.4],supportRows=[-30,-10,10,30],stairCenters=null,crossBounds=null,gridOriginZ=-10,bay=7.5}={}){
 for(const[k,n]of Object.entries({deck,deckY,bridgeZ,width,stairWidth,stairRiserMax,stairTread,gridOriginZ,bay}))finite(n,k);
 if(deckY-deck<2||width<=0||stairWidth<=0||stairRiserMax<=0||stairTread<=0||bay<=0)throw Error('Invalid footbridge dimensions');
 platformCenters=points(platformCenters,'platformCenters');platformHalfWidths=points(platformHalfWidths,'platformHalfWidths');supportRows=points(supportRows,'supportRows');
 if(platformHalfWidths.some(x=>x<=0))throw Error('Invalid footbridge platform widths');
 stairCenters=stairCenters===null?platformCenters.map((x,i)=>x+(i===0?.65:i===3?-.65:1.35)):points(stairCenters,'stairCenters');
 crossBounds=crossBounds===null?[platformCenters[0]-platformHalfWidths[0],platformCenters[3]+platformHalfWidths[3]]:points(crossBounds,'crossBounds',2);
 if(crossBounds[0]>=crossBounds[1])throw Error('Empty footbridge transverse span');
 for(const x of stairCenters)if(x-stairWidth/2-.06<crossBounds[0]||x+stairWidth/2+.06>crossBounds[1])throw Error('Stair landing outside bridge');
 const xc=-bridgeZ,steps=Math.ceil((deckY-deck)/stairRiserMax),rise=(deckY-deck)/steps,run=steps*stairTread,end=xc-width/2;
 const stairs=stairCenters.map((x,i)=>({id:'platform-'+i+'-stair',platformId:'platform-'+i,steps,rise,tread:stairTread,width:stairWidth,start:[end-run,deck,x],end:[end,deckY,x]}));
 const sourceGrid=-gridOriginZ,leftFrame=sourceGrid+Math.floor((xc-sourceGrid)/bay)*bay;
 return{deck,deckY,bridgeZ,width,stairWidth,stairRiserMax,stairTread,platformCenters,platformHalfWidths,supportRows,stairCenters,crossBounds,gridOriginZ,bay,sourceCenterX:xc,leftFrame,stairs};
}
function construct(options={}){
 const plan=footbridgePlan(options),parts=[],groups=[];
 const put=(id,shape,role='structural-iron',feature='rolled-member')=>{const m=sourceShapeMember(id,shape,role,feature,{member:parts.length});parts.push(m);return m;};
 const single=(id,shape,feature)=>{const m=put(id,shape,'structural-iron',feature);groups.push({first:m.member,count:1,translation:[0,0,0]});};
 const box=(id,center,size,feature)=>single(id,{type:'box',center,size},feature);
 const beam=(id,a,b,width,depth)=>single(id,{type:'beam',a,b,width,depth},'rolled-member');
 const repeated=(specs,translation)=>{if(!specs.length)return;const first=parts.length;for(const s of specs)put(s.id,s.shape,'structural-iron',s.feature||'rolled-member');groups.push({first,count:specs.length,translation});};
 const b=plan.crossBounds,xc=plan.sourceCenterX,zc=(b[0]+b[1])/2,y=plan.deckY;
 box('bridge-deck',[xc,y-.16,zc],[plan.width,.32,b[1]-b[0]],'bridge-floor');
 for(let row=0;row<4;row++)beam('bridge-transfer-girder-'+row,[plan.leftFrame,y-.48,plan.supportRows[row]],[plan.leftFrame+plan.bay,y-.48,plan.supportRows[row]],.32,.22);
 // Preserve source .18m baluster rhythm, including its clipped final interval.
 // Gaps at every source-west landing remain actual air on both rail levels.
 for(const side of[-1,1]){
  const x=xc+side*plan.width/2;let run=[];
  const flush=()=>{repeated(run,[0,0,.18]);run=[];};
  for(let z=b[0];z<=b[1];z+=.18){if(side===-1&&plan.stairs.some(st=>Math.abs(z-st.end[2])<st.width/2+.06)){flush();continue;}run.push({id:'bridge-baluster-'+side+'-'+z.toFixed(2),shape:{type:'beam',a:[x,y,z],b:[x,y+1.08,z],width:.022,depth:.022}});}
  flush();
 }
 for(const side of[-1,1]){
  const x=xc+side*plan.width/2,holes=side<0?plan.stairs.map(st=>[st.end[2]-st.width/2-.06,st.end[2]+st.width/2+.06]).sort((a,b)=>a[0]-b[0]):[],segments=[];let a=b[0];
  for(const[lo,hi]of holes){if(lo>a)segments.push([a,lo]);a=Math.max(a,hi);}if(a<b[1])segments.push([a,b[1]]);
  for(const[j,[lo,hi]]of segments.entries())for(const dy of[.12,1.08])beam('bridge-rail-'+side+'-'+j+'-'+dy,[x,y+dy,lo],[x,y+dy,hi],.045,.05);
 }
 for(const st of plan.stairs){
  const z=st.start[2],treads=[];
  for(let i=0;i<st.steps;i++){const x=st.start[0]+(i+.5)*st.tread,sy=st.start[1]+(i+1)*st.rise;treads.push({id:st.id+'-tread-'+i,shape:{type:'box',center:[x,sy-.035,z],size:[st.tread,.07,st.width]},feature:'stair-tread'});}
  repeated(treads,[st.tread,st.rise,0]);
  for(const side of[-1,1]){
   const dz=side*(st.width/2+.03);beam(st.id+'-stringer-'+side,add(st.start,[0,-.12,dz]),add(st.end,[0,-.12,dz]),.10,.18);beam(st.id+'-handrail-'+side,add(st.start,[0,1.03,dz]),add(st.end,[0,1.03,dz]),.045,.045);
   const posts=[];for(let i=0;i<=st.steps;i+=2)posts.push({id:st.id+'-post-'+side+'-'+i,shape:{type:'beam',a:add(st.start,[i*st.tread,i*st.rise,dz]),b:add(st.start,[i*st.tread,i*st.rise+1.03,dz]),width:.028,depth:.028}});
   repeated(posts,[st.tread*2,st.rise*2,0]);
  }
 }
 if(new Set(parts.map(x=>x.id)).size!==parts.length)throw Error('Duplicate footbridge source child');
 return{plan,parts,groups};
}
export function footbridgeMembers(options={}){return construct(options).parts;}
export function footbridgeBounds(options={}){const a=footbridgeMembers(options).map(stationMemberBounds);return{min:[0,1,2].map(k=>Math.min(...a.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...a.map(b=>b.max[k])))};}
function repeatPad(m,translation,materialDistanceMaxShift){const local=m.sourceFrame.map(a=>dot(a,translation)),ss=dot(local,local);return Math.ceil((dot(local.map(Math.abs),m.extent)+materialDistanceMaxShift*Math.sqrt(ss))/ss)+1;}
/** Diagnostic CPU counterpart of the compact field. The callback must not move
 * any distance farther than materialDistanceMaxShift (default 30.01 mm).
 * Every sampled child receives the callback before the nearest union. */
export function createFootbridgeSampler(options={}, {materialDistance=null,materialDistanceMaxShift=.03001,exhaustive=false}={}){
 const c=construct(options);if(!Number.isFinite(materialDistanceMaxShift)||materialDistanceMaxShift<0)throw Error('Invalid material distance bound');
 const sample=p=>{let best={d:1e5,baseD:1e5,member:-1,id:0};
  const consider=i=>{const m=c.parts[i],h=stationMemberSample(m,p);if(materialDistance){h.d=materialDistance(h,p,m);if(Math.abs(h.d-h.baseD)>materialDistanceMaxShift+1e-10)throw Error('Footbridge material distance bound exceeded');}if(h.d<best.d)best=h;};
  if(exhaustive){for(let i=0;i<c.parts.length;i++)consider(i);return best;}
  const s=stationToSource(p);
  for(const g of c.groups){if(g.count===1){consider(g.first);continue;}const m=c.parts[g.first],shape=m.sourceShape,center=shape.type==='beam'?mul(add(shape.a,shape.b),.5):shape.center,nearest=Math.max(0,Math.min(g.count-1,Math.round(dot(sub(s,center),g.translation)/dot(g.translation,g.translation)))),pad=repeatPad(m,g.translation,materialDistanceMaxShift);for(let j=Math.max(0,nearest-pad);j<=Math.min(g.count-1,nearest+pad);j++)consider(g.first+j);}
  return best;
 };
 sample.parts=c.parts;sample.groups=c.groups;sample.plan=c.plan;return sample;
}
export function footbridgeWGSL(options={}){
 const{plan,parts,groups}=construct(options),prefix='FootbridgeMember',maxShift=options.materialDistanceMaxShift??.03001;
 if(!Number.isFinite(maxShift)||maxShift<0)throw Error('Invalid material distance bound');
 let code=stationAssemblySupportWGSL(prefix,options)+`\n// ${parts.length} complete source children in ${groups.length} finite analytic groups.\n// Input and callback p are actual station-local coordinates.\nfn completeFootbridge(p:vec3<f32>)->${prefix}Hit{let s=vec3<f32>(-p.z,p.y,p.x);var h=${prefix}Empty();\n`;
 for(const g of groups){const m=parts[g.first],shape=m.sourceShape,axis=shape.type==='beam'?sub(shape.b,shape.a):[0,1,0],center=shape.type==='beam'?mul(add(shape.a,shape.b),.5):shape.center;
  code+=`// ${m.id}${g.count>1?' ... '+parts[g.first+g.count-1].id:''}: ${g.count} accepted children, ${m.feature}\n{\n`;
  if(g.count===1)code+=`let c=${prefix}Box(p,s,${v(center)},${v(axis)},${v(m.extent)},${f(g.first)});if(c.d<h.d){h=c;}\n`;
  else{const step=g.translation,pad=repeatPad(m,step,maxShift);code+=`let center=${v(center)};let stride=${v(step)};let nearest=i32(clamp(round(dot(s-center,stride)/dot(stride,stride)),0.,${f(g.count-1)}));\nfor(var offset=-${pad};offset<=${pad};offset++){let index=nearest+offset;if(index>=0&&index<${g.count}){let c=${prefix}Box(p,s,center+stride*f32(index),${v(axis)},${v(m.extent)},${f(g.first)}+f32(index));if(c.d<h.d){h=c;}}}\n`;}
  code+='}\n';
 }
 return code+'return h;}\n';
}
export const FOOTBRIDGE_WGSL=footbridgeWGSL();

/** Placement-only proposal for the retained FH88 island. It does not mutate the
 * host, move actors, omit furniture, or certify structural loads. The caller
 * must apply the identity-preserving bench relocation in the shared recipe. */
export function recommendFootbridgeHostPlacement(host){
 if(host?.schema!=='kaopu.fh88.host-construction/1')throw Error('Expected retained FH88 host construction');
 const island=host.boardingIsland,benches=host.benches;
 if(Math.abs(island.nearLocalXM-6.5897)>1e-7||Math.abs(island.farLocalXM-11.15)>1e-7)throw Error('Changed boarding island needs a new bridge placement audit');
 const options={deck:island.topLocalYM,bridgeZ:-120.5,platformCenters:[-30,-10,island.centerLocalXM,30],platformHalfWidths:[3.4,3.4,island.halfWidthM,3.4],stairCenters:[-28.7,-8.7,8.8,28.7]};
 const plan=footbridgePlan(options),parts=footbridgeMembers(options),stairParts=parts.filter(m=>m.id.startsWith('platform-2-stair-')),bounds=stairParts.map(stationMemberBounds),stairZ=[Math.min(...bounds.map(b=>b.min[2])),Math.max(...bounds.map(b=>b.max[2]))];
 const overlaps=(a,b,c,d)=>a<d&&b>c;
 if(overlaps(stairZ[0],stairZ[1],host.passengerClearance.local.minZ,host.passengerClearance.local.maxZ))throw Error('Bridge stair enters retained passenger sweep');
 const blocked=benches.retainedLocalZ.map((z,i)=>({from:z,sourceLocalZ:benches.sourceLocalZ[i]})).filter(b=>overlaps(b.from-benches.halfLengthM,b.from+benches.halfLengthM,stairZ[0],stairZ[1]));
 const identityIndices=benches.sourceLocalZ.map((z,i)=>Math.abs(z+36.25)<1e-7?i:-1).filter(i=>i>=0);
 if(identityIndices.length!==1)throw Error('Missing or duplicate source bench identity');
 const identityIndex=identityIndices[0],currentZ=benches.retainedLocalZ[identityIndex],alreadyApplied=Math.abs(currentZ+96.25)<1e-7;
 if(!alreadyApplied&&Math.abs(currentZ+111.25)>1e-7||alreadyApplied&&blocked.length!==0||!alreadyApplied&&(blocked.length!==1||Math.abs(blocked[0].sourceLocalZ+36.25)>1e-7))throw Error('Changed bench arrangement needs a new bridge placement audit');
 const relocation={from:-111.25,sourceLocalZ:-36.25,to:-96.25,alreadyApplied};
 if(benches.retainedLocalZ.filter((z,i)=>i!==identityIndex).some(z=>Math.abs(z-relocation.to)<2*benches.halfLengthM+host.passengerClearance.clearanceM))throw Error('Proposed bench relocation is occupied');
 const stairCrossExtent=.87,passageNear=options.stairCenters[2]-stairCrossExtent-island.nearLocalXM;
 return{options,benchRelocations:[relocation],stationaryColumnsPreserved:true,stairZ,passageNearM:passageNear,otherIslandSidePassageM:3.4-1.3-stairCrossExtent,steps:plan.stairs[2].steps,risersM:plan.stairs[2].rise,bridgeDeckY:plan.deckY,structuralLoadCertification:false,validationScope:'Analytic recipe and retained host clearances; render/GPU validation remains required'};
}
