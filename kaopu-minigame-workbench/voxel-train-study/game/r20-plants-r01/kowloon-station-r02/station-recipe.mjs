import {stationPlan} from './station-plan.mjs';
export const RECIPE_REVISION='KOWLOON_UNIFIED_RECIPE_R01';
export const MATERIAL_ROLES=Object.freeze(['cast-iron','structural-iron','roof-metal','platform-stone','aged-wood','lamp-glass','sign-enamel']);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
/** Every emitted component contains its geometry AND surface field coordinates.
 * There is no geometry-first/material-later public construction route. These
 * descriptors are derived data, never serialized into the .KaoPu score. */
export function compileStationRecipe(input={}, {scope='one-bay',bayIndex=5}={}){
 const plan=stationPlan(input),s=plan.score,h=s.shed,parts=[],features=[],colliders=[];
 if(!['one-bay','whole-shed'].includes(scope))throw Error('Unknown generation scope');
 if(!Number.isInteger(bayIndex)||bayIndex<0||bayIndex>=h.bays)throw Error('Invalid bay index');
 const bays=scope==='whole-shed'?Array.from({length:h.bays},(_,i)=>i):[bayIndex],first=plan.back+bays[0]*h.pitch,last=plan.back+(bays.at(-1)+1)*h.pitch;
 function emit(id,shape,materialRole,feature,extras={}){
  if(!MATERIAL_ROLES.includes(materialRole))throw Error('Unbound material role');
  const origin=shape.center||shape.a||[0,0,0],surface={role:materialRole,component:id,metricFrame:{origin:origin.slice(),axis:extras.grainAxis||[1,0,0]},ageYears:s.surface.ageYears,repairFraction:s.surface.repairFraction,wetness:s.surface.wetness,saltExposure:s.surface.saltExposure,rainExposure:s.surface.rainExposure,contact:extras.contact||'sheltered',feature,...extras};
  parts.push({id,shape,surface});return parts.at(-1);
 }
 const box=(id,center,size,role,feature,extras)=>emit(id,{type:'box',center,size},role,feature,extras);
 const beam=(id,a,b,width,depth,role='structural-iron',feature='rolled-member')=>emit(id,{type:'beam',a,b,width,depth},role,feature);
 const cyl=(id,center,radius,height,role='cast-iron',segments=20)=>emit(id,{type:'cylinder',center,radius,height,segments},role,'turned-cast-profile');
 const ring=(id,center,radius,tube)=>emit(id,{type:'ring',center,radius,tube,segments:24},'cast-iron','casting-collar');
 function column(x,z,index){
  const y=s.platform.top,id='column-'+index,base=[x,y,z];
  box(id+'-foot',add(base,[0,.12,0]),[.83,.24,.83],'cast-iron','base-plate',{contact:'ground-bearing'});
  emit(id+'-plinth',{type:'cylinder',center:add(base,[0,.46,0]),radius:.34,radiusTop:.25,height:.44,segments:8},'cast-iron','tapered-base',{contact:'ground-bearing'});
  emit(id+'-shaft',{type:'fluted-column',center:[x,(y+.66+h.eave-.45)/2,z],radius:.215,height:h.eave-.45-y-.66,flutes:12,depth:.012,segments:72},'cast-iron','cast-fluted-shaft');
  for(const [i,dy]of [.70,1.48,3.1,h.eave-y-.72].entries()){
   cyl(id+'-collar-'+i,add(base,[0,dy,0]),.26,.135);ring(id+'-collar-edge-'+i,add(base,[0,dy+.082,0]),.258,.023);
   for(let q=0;q<4;q++){const a=q*Math.PI/2;emit(id+'-bolt-'+i+'-'+q,{type:'radial-bolt',center:add(base,[Math.cos(a)*.266,dy,Math.sin(a)*.266]),radius:.044,depth:.027,angle:a,segments:6},'cast-iron','hex-bolt-head');}
  }
  cyl(id+'-neck',[x,h.eave-.31,z],.29,.18);emit(id+'-capital',{type:'cylinder',center:[x,h.eave-.10,z],radius:.29,radiusTop:.46,height:.27,segments:12},'cast-iron','fan-capital');
  box(id+'-abacus',[x,h.eave+.075,z],[.96,.12,.70],'cast-iron','capital-bearing');
  for(const side of [-1,1])beam(id+'-branch-'+side,[x,h.eave-.45,z],[x,h.eave+.5,z+side*.70],.12,.18,'cast-iron','capital-branch');
  colliders.push({id,bounds:{min:[x-.43,y,z-.43],max:[x+.43,h.eave,z+.43]},kind:'structural-column'});
  features.push({id,kind:'column',at:[x,y,z],flutes:12,collars:4,boltHeads:16,baseBolts:0});
 }
 function arch(x,centerZ,row){
  const id='truss-'+row,segments=24,half=h.span/2,radius=(half*half+h.rise*h.rise)/(2*h.rise),cy=h.eave+h.rise-radius;
  const point=(t,drop=0)=>{const z=-half+h.span*t;return[x,cy+Math.sqrt(Math.max(0,radius*radius-z*z))-drop,centerZ+z];};
  for(let i=0;i<segments;i++){
   const a=point(i/segments),b=point((i+1)/segments),c=point(i/segments,h.trussDepth),d=point((i+1)/segments,h.trussDepth);
   // True separated upper/lower chords and Warren web members; no arched solid wall.
   beam(id+'-upper-'+i,a,b,.115,.18);beam(id+'-lower-'+i,c,d,.10,.16);
   beam(id+'-web-'+i,i%2?a:c,i%2?d:b,.062,.065);
   if(i%2===0)beam(id+'-vertical-'+i,a,c,.055,.06);
  }
  features.push({id,kind:'open-arch-truss',center:[x,h.eave,centerZ],span:h.span,rise:h.rise,chordDepth:h.trussDepth,segments});
 }
 function roof(x0,x1,centerZ,bay){
  const segs=20,half=h.span/2,radius=(half*half+h.rise*h.rise)/(2*h.rise),cy=h.eave+h.rise-radius;
  for(let j=0;j<segs;j++){
   // A longitudinal daylight slot is genuinely open; no substitute grey glass.
   if(j>=9&&j<=10)continue;
   const z0=-half+j*h.span/segs,z1=-half+(j+1)*h.span/segs,y0=cy+Math.sqrt(radius*radius-z0*z0)+.08,y1=cy+Math.sqrt(radius*radius-z1*z1)+.08;
   emit('roof-'+bay+'-'+j,{type:'roof-panel',corners:[[x0,y0,centerZ+z0],[x1,y0,centerZ+z0],[x1,y1,centerZ+z1],[x0,y1,centerZ+z1]],thickness:.035},'roof-metal','standing-seam-roof',{contact:'rain-exposed'});
  }
  for(let j=0;j<=8;j++){const z=-half+j*h.span/8,y=cy+Math.sqrt(Math.max(0,radius*radius-z*z));beam('purlin-'+bay+'-'+j,[x0,y-.10,centerZ+z],[x1,y-.10,centerZ+z],.075,.14);}
 }
 for(const bay of bays){const x0=plan.back+bay*h.pitch,x1=x0+h.pitch;
  for(let row=0;row<4;row++){column(x0,plan.supportRows[row],bay+'-'+row);beam('eave-'+bay+'-'+row,[x0,h.eave,plan.supportRows[row]],[x1,h.eave,plan.supportRows[row]],.20,.26);}
  for(let span=0;span<3;span++){const z=(plan.supportRows[span]+plan.supportRows[span+1])/2;arch(x0,z,bay+'-'+span);roof(x0,x1,z,bay+'-'+span);}
 }
 for(let row=0;row<4;row++)column(last,plan.supportRows[row],'end-'+row);
 for(let span=0;span<3;span++)arch(last,(plan.supportRows[span]+plan.supportRows[span+1])/2,'end-'+span);
 for(const pf of plan.platforms){const z0=pf.bounds.min[2],z1=pf.bounds.max[2],z=(z0+z1)/2;
  box(pf.id+'-deck',[(first+last)/2,s.platform.top/2,z],[last-first,s.platform.top,z1-z0],'platform-stone','load-bearing-deck',{contact:'ground-bearing'});
  for(const side of [-1,1]){const edgeZ=side<0?z0:z1;for(let x=first;x<last-.001;x+=1.2){const w=Math.min(1.2,last-x)-.006;box(pf.id+'-coping-'+side+'-'+Math.round(x*10),[x+w/2,s.platform.top-.045,edgeZ-side*.14],[w,.09,.28],'platform-stone','coping-drip-edge',{contact:'rain-exposed'});}}
 }
 function bench(x,z,index){const id='bench-'+index,py=s.platform.top,seat=s.furnishings.seatHeight,L=s.furnishings.benchLength;
  for(let k=0;k<5;k++)box(id+'-seat-slat-'+k,[x,py+seat,z-.27+k*.115],[L,.038,.096],'aged-wood','longitudinal-seat-slat',{grainAxis:[1,0,0],endGrainFaces:['-X','+X'],stockId:id+'-seat-stock',grainOffset:[0,0,k*.115],contact:'hand-and-weather'});
  for(let k=0;k<5;k++)box(id+'-back-slat-'+k,[x,py+seat+.10+k*.10,z+.28+k*.012],[L,.075,.033],'aged-wood','longitudinal-back-slat',{grainAxis:[1,0,0],endGrainFaces:['-X','+X'],stockId:id+'-back-stock',grainOffset:[0,k*.10,0],contact:'hand-and-weather'});
  for(const side of [-1,1]){const bx=x+side*(L/2-.28);beam(id+'-front-leg-'+side,[bx,py+.03,z-.25],[bx,py+seat-.03,z-.18],.044,.048,'cast-iron');beam(id+'-rear-leg-'+side,[bx,py+.03,z+.30],[bx,py+seat+.70,z+.35],.046,.052,'cast-iron');beam(id+'-seat-support-'+side,[bx,py+seat-.03,z-.3],[bx,py+seat-.03,z+.33],.055,.04,'cast-iron');}
  colliders.push({id,kind:'bench',bounds:{min:[x-L/2,py,z-.36],max:[x+L/2,py+seat+.65,z+.42]}});features.push({id,kind:'bench',at:[x,py,z],seatHeight:seat,slatCount:10});
 }
 // Furniture placement remains out of the preserved train-side walking strip.
 for(const pf of plan.platforms)for(let n=0;n<s.furnishings.benchesPerIsland;n++){
  const x=plan.back+10+n*(h.bays*h.pitch-20)/Math.max(1,s.furnishings.benchesPerIsland-1),z=pf.index===0?pf.centerZ+.1:pf.index===3?pf.centerZ-.1:pf.centerZ+1.8;
  if(x<first+2||x>last-2)continue;
  if(plan.bridge&&x>plan.bridge.stairFlights[pf.index].start[0]-2&&x<plan.bridge.bounds.max[0]+2)continue;
  bench(x,z,pf.index+'-'+n);
 }
 for(const bay of bays)for(let row=0;row<4;row++){
  const x=plan.back+bay*h.pitch,z=plan.supportRows[row],id='lamp-sign-'+bay+'-'+row,y=s.platform.top+s.furnishings.lampHeight;
  beam(id+'-arm',[x,y,z],[x+1.2,y,z],.035,.035,'cast-iron','lamp-bracket');beam(id+'-brace',[x,y-.55,z],[x+.80,y,z],.025,.028,'cast-iron');
  cyl(id+'-stem',[x+1.18,y-.18,z],.025,.36);emit(id+'-shade',{type:'cylinder',center:[x+1.18,y-.44,z],radius:.24,radiusTop:.095,height:.25,segments:24},'cast-iron','bell-lamp-shade');cyl(id+'-bulb',[x+1.18,y-.57,z],.11,.08,'lamp-glass',16);
  box(id+'-sign',[x+.72,s.platform.top+s.furnishings.signHeight,z+.03],[1.12,.52,.045],'sign-enamel','platform-sign-face',{lettering:{line1:'PLATFORM No.',line2:String(Math.min(4,row+1)),mode:'requires-native-outline-glyph-binding'}});
  features.push({id,kind:'lamp-and-platform-sign',letteringStatus:'binding-required-no-bitmap',at:[x,y,z]});
 }
 if(plan.bridge&&scope==='whole-shed'){
  const br=plan.bridge,b=br.bounds,xc=(b.min[0]+b.max[0])/2,zc=(b.min[2]+b.max[2])/2;
  box('bridge-deck',[xc,s.bridge.deckY-.16,zc],[s.bridge.width,.32,b.max[2]-b.min[2]],'structural-iron','bridge-floor');
  // Floor loads land on longitudinal girders between the existing column rows.
  const leftFrame=plan.back+Math.floor((xc-plan.back)/h.pitch)*h.pitch;
  for(let row=0;row<4;row++)beam('bridge-transfer-girder-'+row,[leftFrame,s.bridge.deckY-.48,plan.supportRows[row]],[leftFrame+h.pitch,s.bridge.deckY-.48,plan.supportRows[row]],.32,.22);
  // West balustrade has real gaps at each stair landing.
  for(const side of [-1,1]){const x=xc+side*s.bridge.width/2;for(let z=b.min[2];z<=b.max[2];z+=.18){if(side===-1&&br.stairFlights.some(st=>Math.abs(z-st.end[2])<st.width/2+.06))continue;beam('bridge-baluster-'+side+'-'+z.toFixed(2),[x,s.bridge.deckY,z],[x,s.bridge.deckY+1.08,z],.022,.022);}}
  for(const side of [-1,1]){const x=xc+side*s.bridge.width/2,holes=side<0?br.stairFlights.map(st=>[st.end[2]-st.width/2-.06,st.end[2]+st.width/2+.06]).sort((a,b)=>a[0]-b[0]):[],segments=[];let a=b.min[2];for(const [lo,hi] of holes){if(lo>a)segments.push([a,lo]);a=Math.max(a,hi);}if(a<b.max[2])segments.push([a,b.max[2]]);for(const [j,[lo,hi]]of segments.entries())for(const y of [.12,1.08])beam('bridge-rail-'+side+'-'+j+'-'+y,[x,s.bridge.deckY+y,lo],[x,s.bridge.deckY+y,hi],.045,.05);}
  for(const st of br.stairFlights){const z=st.start[2];for(let i=0;i<st.steps;i++){const x=st.start[0]+(i+.5)*st.tread,y=st.start[1]+(i+1)*st.rise;box(st.id+'-tread-'+i,[x,y-.035,z],[st.tread,.07,st.width],'structural-iron','stair-tread');}
   for(const side of [-1,1]){const dz=side*(st.width/2+.03);beam(st.id+'-stringer-'+side,add(st.start,[0,-.12,dz]),add(st.end,[0,-.12,dz]),.10,.18);beam(st.id+'-handrail-'+side,add(st.start,[0,1.03,dz]),add(st.end,[0,1.03,dz]),.045,.045);for(let i=0;i<=st.steps;i+=2)beam(st.id+'-post-'+side+'-'+i,add(st.start,[i*st.tread,i*st.rise,dz]),add(st.start,[i*st.tread,i*st.rise+1.03,dz]),.028,.028);}
  }
 }
 const ids=new Set();for(const part of parts){if(ids.has(part.id))throw Error('Duplicate component '+part.id);ids.add(part.id);}
 if(parts.length>24000)throw Error('Construction part budget exceeded');
 return{schema:'kaopu.station.unified-derived-recipe/1',revision:RECIPE_REVISION,score:s,scope,bayIndices:bays,plan,parts,features,colliders,materials:[...new Set(parts.map(p=>p.surface.role))],proof:{historicalReplica:false,externalMeshes:0,imageTextures:0,geometryAndSurfaceShareRecipe:true,persistentExpandedGeometry:false,visualValidated:false,gpuShaderCompiled:false,materialApproval:'required',unbuilt:['hall architecture','clock tower architecture','hotel architecture','pier and boats','native outline lettering'],partCount:parts.length}};
}
