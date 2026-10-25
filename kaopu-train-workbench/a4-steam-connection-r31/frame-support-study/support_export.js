/* Pure candidate-only support scalar/GLSL exporter. No file/scene mutation.
 * Bridge and tabs form one body. Bolts have explicit holes, nominal head/washer
 * face contacts and nut envelopes. Thread/locking/strength remain unverified.
 */
'use strict';
const F=require('./frame_support');
const f=v=>{if(!Number.isFinite(v))throw Error('Nonfinite coefficient');let s=v.toPrecision(17);return /[.eE]/.test(s)?s:s+'.0';},v=p=>'vec3('+p.map(f).join(',')+')';
const box=(lo,hi)=>({kind:'box',lo,hi});
const cyl=(axis,center,radius,range)=>({kind:'cylinder',axis,center,radius,range});
const union=(...children)=>({kind:'union',children});
const subtract=(base,...voids)=>({kind:'difference',base,voids});
function scalar(shape,p){
 if(shape.kind==='box')return Math.max(...p.map((a,i)=>Math.max(shape.lo[i]-a,a-shape.hi[i])));
 if(shape.kind==='cylinder'){const a=shape.axis,rad=Math.hypot(...p.filter((_,i)=>i!==a).map((q,j)=>q-shape.center.filter((_,i)=>i!==a)[j]));return Math.max(rad-shape.radius,shape.range[0]-p[a],p[a]-shape.range[1]);}
 if(shape.kind==='union')return Math.min(...shape.children.map(s=>scalar(s,p)));
 if(shape.kind==='difference')return Math.max(scalar(shape.base,p),...shape.voids.map(s=>-scalar(s,p)));
 throw Error('Unknown shape');
}
function bounds(shape){
 if(shape.kind==='box')return [shape.lo.slice(),shape.hi.slice()];
 if(shape.kind==='cylinder'){const lo=shape.center.map(v=>v-shape.radius),hi=shape.center.map(v=>v+shape.radius);lo[shape.axis]=shape.range[0];hi[shape.axis]=shape.range[1];return [lo,hi];}
 if(shape.kind==='difference')return bounds(shape.base);
 const b=shape.children.map(bounds);return [[0,1,2].map(i=>Math.min(...b.map(x=>x[0][i]))),[0,1,2].map(i=>Math.max(...b.map(x=>x[1][i])))];
}
function glslExpr(s){
 if(s.kind==='box'){const c=s.lo.map((x,i)=>(x+s.hi[i])/2),h=s.lo.map((x,i)=>(s.hi[i]-x)/2);return `mBoxInf(p,${v(c)},${v(h)})`;}
 if(s.kind==='cylinder'){const c=s.center.slice();c[s.axis]=(s.range[0]+s.range[1])/2;return `mDisc(p,${v(c)},${s.axis},${f(s.radius)},${f((s.range[1]-s.range[0])/2)})`;}
 if(s.kind==='union')return s.children.map(glslExpr).reduce((a,b)=>`min(${a},${b})`);
 return s.voids.map(glslExpr).reduce((a,b)=>`max(${a},-(${b}))`,glslExpr(s.base));
}
function pack({hosts,pose,parts,apertures,choices={}}){
 const c={runningGap:.004,minimumEdgeLigament:.015,coreDepth:.060,tabThickness:.014,boltOffsetZ:.055,boltRadius:.006,boltHoleClearance:.0003,boltHeadRadius:.011,boltHeadLength:.008,washerRadius:.012,washerThickness:.002,nutRadius:.0105,nutLength:.008,boltEndReserve:.006,pinHeadRadius:.018,pinHeadLength:.006,pinLowerShoulderLength:.003,...choices};
 if(Object.values(c).some(x=>!(Number.isFinite(x)&&x>0)))throw Error('Positive candidate dimensions required');
 const O=pose.pins.O,pin=parts.find(p=>p.id==='pin/O');if(!pin)throw Error('O pin descriptor required');
 const top=Math.max(...parts.filter(p=>p.id!=='pin/O').map(p=>p.y[1])),height=2*(Math.max(c.boltHeadRadius,c.washerRadius,c.nutRadius)+c.minimumEdgeLigament),y=[top+c.runningGap,top+c.runningGap+height],cy=(y[0]+y[1])/2;
 const tabHalfDepth=c.boltOffsetZ+Math.max(c.boltHeadRadius,c.washerRadius,c.nutRadius)+c.minimumEdgeLigament,coreDepth=Math.max(c.coreDepth,2*(pin.outer+c.minimumEdgeLigament));
 const xl=hosts.find(h=>h.side==='left').innerFace,xr=hosts.find(h=>h.side==='right').innerFace;
 const core=box([xl,y[0],O[2]-coreDepth/2],[xr,y[1],O[2]+coreDepth/2]),tabs=hosts.map(h=>{const x=h.innerFace,s=Math.sign(h.x),a=x-s*c.tabThickness;return box([Math.min(x,a),y[0],O[2]-tabHalfDepth],[Math.max(x,a),y[1],O[2]+tabHalfDepth]);});
 const socket=cyl(1,O,pin.outer,[y[0]-1e-6,y[1]+1e-6]);
 const partsOut=[],bores=[],interfaces=[];
 const emit=(id,shape,role,more={})=>{const i=partsOut.length,name='frame_mount_'+i,b=bounds(shape);partsOut.push({id:'frame_support/'+id,source:'installation',group:'installation',glsl_function:name,glsl:`float ${name}(vec3 p){return ${glslExpr(shape)};}`,aabb_min:b[0],aabb_max:b[1],lipschitz:1.000002,shape,role,motion:'fixed in train frame',historicalDimensions:false,structuralAcceptance:false,...more});};
 // One fixed pin body including two support-retention envelopes, replaces O.
 const shaft=cyl(1,O,pin.outer,[pin.y[0],y[1]+c.pinHeadLength]),head=cyl(1,O,c.pinHeadRadius,[y[1],y[1]+c.pinHeadLength]),shoulder=cyl(1,O,c.pinHeadRadius,[y[0]-c.pinLowerShoulderLength,y[0]]);
 emit('fixed_O_pin',union(shaft,head,shoulder),'extended fixed pin with integral head/lower-retention envelopes',{replacesId:'stack_candidate/pin/O',replacesStackDescriptorId:'pin/O',sourcePartId:'valve/gresley_fixed_pivot_pin',oneBodyUnion:true,lockingDetailVerified:false});
 for(const h of hosts)for(const sZ of [-1,1]){
  const sign=Math.sign(h.x),inner=h.innerFace,outer=h.x+sign*h.halfThickness,tabInside=inner-sign*c.tabThickness,z=O[2]+sZ*c.boltOffsetZ,center=[0,cy,z],tag=h.side+'_'+(sZ<0?'rear':'front');
  const orient=(a,b)=>[Math.min(a,b),Math.max(a,b)],washerRange=orient(tabInside,tabInside-sign*c.washerThickness),nutRange=orient(tabInside-sign*c.washerThickness,tabInside-sign*(c.washerThickness+c.nutLength));
  const boltEnd=tabInside-sign*(c.washerThickness+c.nutLength+c.boltEndReserve),holeRange=orient(outer+sign*1e-6,tabInside-sign*1e-6),hole=cyl(0,center,c.boltRadius+c.boltHoleClearance,holeRange);
  bores.push({hostId:h.id,tag,shape:hole,radius:c.boltRadius+c.boltHoleClearance,explicit:true});
  const bolt=union(cyl(0,center,c.boltRadius,orient(outer,boltEnd)),cyl(0,center,c.boltHeadRadius,orient(outer,outer+sign*c.boltHeadLength)));
  emit('bolt/'+tag,bolt,'fixed side fastener shank and external head envelope',{oneBodyUnion:true,threadDetailVerified:false});
  const washer=subtract(cyl(0,center,c.washerRadius,washerRange),cyl(0,center,c.boltRadius+c.boltHoleClearance,[washerRange[0]-1e-6,washerRange[1]+1e-6]));
  emit('washer/'+tag,washer,'inside tab washer with explicit radial clearance');
  const nut=subtract(cyl(0,center,c.nutRadius,nutRange),cyl(0,center,c.boltRadius,[nutRange[0]-1e-6,nutRange[1]+1e-6]));
  emit('nut/'+tag,nut,'finite annular nut/retention envelope, not a resolved thread',{nominalShaftBoundary:true,threadDetailVerified:false});
  interfaces.push({tag,hostId:h.id,axis:'X',center:[h.x,cy,z],holeRadius:c.boltRadius+c.boltHoleClearance,shaftRadius:c.boltRadius,radialClearance:c.boltHoleClearance,headFaceX:outer,frameToTabFaceX:inner,tabToWasherFaceX:tabInside,washerToNutFaceX:tabInside-sign*c.washerThickness,declaredNominalContacts:['head/frame outside face','frame inside face/tab outside face','tab inside face/washer','washer/nut','nut inside cylinder/bolt shank'],assemblyAccess:'nut lies inward of end tab and outside core beam in Z',lockingDetailVerified:false});
 }
 const bridge=subtract(union(core,...tabs),socket,...bores.map(b=>b.shape));emit('front_stretcher',bridge,'one-piece inferred bridge with side tabs and explicit Y socket plus four X bolt bores',{oneBodyUnion:true});
 const frameHostCuts=hosts.map((h,j)=>{
  const slots=apertures.filter(a=>a.hostId===h.id&&a.required),terms=slots.map((s,i)=>{const name='frame_mount_slot_'+j+'_'+i;return {name,glsl:F.slotGLSL(s,name),slot:s};}),holeParts=bores.filter(b=>b.hostId===h.id);
  const expr=[...terms.map(t=>`${t.name}(p)`),...holeParts.map(b=>glslExpr(b.shape))].reduce((a,b)=>`min(${a},${b})`),name='frame_mount_host_cut_'+j;
  return {sourcePartId:h.id,fieldFunction:name,glsl:terms.map(t=>t.glsl).join('\n')+`\nfloat ${name}(vec3 p){return ${expr};}`,candidateOnly:true,baselinePolicy:'Caller applies cut only while installationCandidate==1; never mutate retained frame constructors',bores:holeParts,slots};
 });
 const lowestRetention=y[0]-c.pinLowerShoulderLength,checks={allHardwareAboveMovingAssembly:lowestRetention>top,minMovingAxialGapM:lowestRetention-top,bridgeInsideFrame:hosts.every(h=>y[1]<h.frontRectangle.y[1]&&O[2]+tabHalfDepth<h.frontRectangle.z[1]),nutToCoreGapM:c.boltOffsetZ-c.nutRadius-coreDepth/2,washerToCoreGapM:c.boltOffsetZ-c.washerRadius-coreDepth/2,frameTopLigamentM:Math.min(...hosts.map(h=>h.frontRectangle.y[1]-y[1])),pivotSocketCoreEdgeLigamentM:coreDepth/2-pin.outer,throughBores:true};
 if(!checks.allHardwareAboveMovingAssembly||!checks.bridgeInsideFrame||checks.nutToCoreGapM<=0||checks.washerToCoreGapM<=0)throw Error('Infeasible explicit support interfaces: '+JSON.stringify(checks));
 return {version:'R29_proposed_frame_support_v1',parts:partsOut,source:partsOut.map(p=>p.glsl).join('\n'),frameHostCuts,replaceStackIds:['stack_candidate/pin/O'],suppressAdditionalSourceIds:[],choices:c,derived:{bridgeY:y,coreDepth,tabHalfDepth,tabThickness:c.tabThickness},interfaces,socket:{center:O,radius:pin.outer,y},checks,coordinateContract:'All fields fixed in train world coordinates; no Gresley rotation applied. Main lever rotates about this same O.',historicalDimensions:false,structuralAcceptance:false,lockingDetailVerified:false,wholeTrainAcceptance:false};
}
module.exports={box,cyl,union,subtract,scalar,bounds,glslExpr,pack};
