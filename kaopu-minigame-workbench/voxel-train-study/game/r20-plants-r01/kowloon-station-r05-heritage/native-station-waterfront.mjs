// R02 waterfront semantic construction, restored as metric analytic fields.
// Original recipe: terminal-architecture.mjs @ f31df978916876205355664593b0299f027188ad.
// No photograph, mesh, sampled field, or planned U-pier is an input here.
import {STATION_SCORE} from './station-score.mjs';
import {nativeFloat as f,nativeVec as v} from './native-station-lamps.mjs';
const IDENTITY=[[1,0,0],[0,1,0],[0,0,1]];
// Authored landward reorientation: old(+X,+Y,+Z) -> new(+Z,+Y,-X).
// This keeps the source station-side sidewalk on the east side of the new road.
const ROAD_FRAME=[[0,0,1],[0,1,0],[-1,0,0]];
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),finite=(x,n)=>{if(!Number.isFinite(x))throw Error('Invalid waterfront '+n);return x;};
const boxDistance=(p,b)=>{const q=p.map((x,i)=>Math.abs(x)-b[i]);return Math.hypot(...q.map(x=>Math.max(0,x)))+Math.min(Math.max(...q),0);};
const linearHex=hex=>hex.match(/[\da-f]{2}/gi).map(s=>{const c=parseInt(s,16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
export const SOURCE_MATERIAL_ROLES=Object.freeze({
 road:{source:'A4-function-r01',role:'coal',color:'#68726a',linearColor:linearHex('68726a'),metalness:.05,roughness:.92,id:18,seed:186,status:'legacy coal surrogate; no mature asphalt mother is claimed'},
 'paint-cream':{source:'A4-function-r01',role:'paint',color:'#e5dac0',linearColor:linearHex('e5dac0'),metalness:0,roughness:.34,id:7,seed:187,status:'original finish parameters; finite inline road ingredient'},
 'platform-stone':{source:'KST1-surfaces-2',role:'concrete',id:17,seed:186,status:'reuse locked native concrete mother'},
 'quay-stone':{source:'KST1-surfaces-2 concrete in R02',role:'stone',id:2,seed:186,status:'explicit R04 binding to locked native stone mother'},
 'cast-iron':{source:'A4-function-r01',role:'iron',id:3,seed:186,status:'reuse locked native iron mother'},
});
export const WATERFRONT_SOURCE_PARAMETERS=Object.freeze({hallZ:[-25.85,32.25],quayX:[28,40],roadX:[-93,46],roadZ:[38.25,51.25],pierX:[46,70],pierZ:[-24.15,-18.15],towerZ:[-24.25,-18.049999999999997]});
/** Exact 72 accepted source descriptors. These are authored primitives, not
 * vertex/index buffers. QA compares them to the independent 8504-part freeze. */
export function waterfrontSourceParts(parameters=WATERFRONT_SOURCE_PARAMETERS){
 const {hallZ:[z0,z1],quayX:[qx0,qx1],roadX:[rx0,rx1],roadZ:[rz0,rz1],pierX:[px0,px1],pierZ:[pz0,pz1],towerZ:[tz0,tz1]}=parameters;
 const zc=(z0+z1)/2,tz=(tz0+tz1)/2,parts=[];
 const emit=(id,shape,role,feature)=>parts.push({id,shape,surface:{role,feature,component:id,metricFrame:{origin:shape.center},ageYears:35,rainExposure:.35,wetness:.10,repairFraction:.2}});
 const box=(id,center,size,role,feature)=>emit(id,{type:'box',center,size},role,feature);
 const cylinder=(id,center,radius,height,role,radiusTop=radius,segments=32)=>emit(id,{type:'cylinder',center,radius,radiusTop,height,segments},role,'turned-profile');
 box('quay-ground',[(qx0+qx1)/2,-.13,zc+1],[qx1-qx0,.4,z1-z0+18],'platform-stone','sea-quay');
 box('quay-seawall',[qx1-.2,-1.4,zc],[.75,2.5,z1-z0+18],'quay-stone','wave-bearing-seawall');
 for(let z=z0-6;z<z1+9;z+=2.8)cylinder('quay-bollard-'+z,[qx1-.7,.5,z],.11,1,'cast-iron',.09,12);
 box('station-road',[(rx0+rx1)/2,-.03,(rz0+rz1)/2],[rx1-rx0,.12,rz1-rz0],'road','road-surface');
 box('station-road-walk',[(rx0+rx1)/2,.20,rz0-2.4],[rx1-rx0,.4,4.8],'platform-stone','outside-pedestrian-promenade');
 for(let x=rx0+3;x<rx1;x+=5)box('road-line-'+x,[x,.037,(rz0+rz1)/2],[2.5,.008,.12],'paint-cream','road-line');
 box('pier-deck',[(px0+px1)/2,.4,(pz0+pz1)/2],[px1-px0,.34,6],'platform-stone','pier-slab');
 for(let x=px0+2;x<px1;x+=4)for(const sign of[-1,1])cylinder('pier-pile-'+x+'-'+sign,[x,-1.4,tz+sign*2.3],.27,4,'quay-stone');
 return parts;
}
export function stationWaterfrontPlan({site=STATION_SCORE.site,verticalOffset=-.25,pierTop=.85,paintThickness=.0004,paintEmbed=.0002}={}){
 const p={shoreX:site.shoreX,back:site.quayBack,front:site.quayFront,roadLeft:site.road.leftX,roadRight:site.road.rightX,roadBack:site.road.back,roadFront:site.road.front,pierZ:site.passengerWalk.z,verticalOffset,pierTop,paintThickness,paintEmbed};
 for(const[k,x]of Object.entries(p))finite(x,k);
 if(p.front<=p.back||p.roadFront<=p.roadBack||p.roadRight<=p.roadLeft||paintThickness<=0||paintThickness>.001||paintEmbed<=0||paintEmbed>.001)throw Error('Invalid waterfront dimensions');
 p.quayTop=.07+verticalOffset;p.wallTop=-.15+verticalOffset;p.roadTop=.03+verticalOffset;p.walkTop=.4+verticalOffset;p.bollardY=.5+verticalOffset;
 p.pierStart=p.shoreX;p.pierEnd=p.shoreX+24;p.pierBottom=p.pierTop-.34;
 // Physical joint correction: all original 4m piles enter the slab underside
 // by 20mm, instead of protruding 30mm through its walking surface.
 p.pierLift=p.pierTop-.57;p.pileTop=p.pierBottom+.02;p.pileY=p.pileTop-2;
 p.authoredChanges=[
  'Quay and seawall share current entire coast z range; source 1m ground/wall centre offset removed.',
  'All non-pier source height datums shift by verticalOffset; quay .4m and wall 2.5m thicknesses retained.',
  'Quay broad paving stays 12m wide; bollards keep 2.8m pitch and .11/.09m taper along expanded coast.',
  'Road relocated landward, extended to current road limits and widened to current road width; source .12m slab retained.',
  'Source 4.8m sidewalk is on the current station/east side, with proper quarter-turn local material frame.',
  'Source road paint floated 3mm above the coal-road surrogate and was 8mm thick; corrected to connected .4mm raised paint with .2mm embed, one road owner.',
  'Original 24x6m straight pier starts at current shore and meets public route at its .85m top; not the unbuilt U-pier.',
  'Pier source top .57m becomes .85m. All 12 pile identities/radii/4m lengths remain; original 30mm top protrusion is corrected to 20mm underside embed (top .53m, centre -1.47m, toe -3.47m).',
 ];
 return p;
}
function construct(options={}){
 const plan=stationWaterfrontPlan(options),source=waterfrontSourceParts(),parts=[],groups=[];
 const sources=pattern=>source.filter(m=>pattern.test(m.id)),put=(id,shape,sourcePart,extra={})=>{
  const role=sourcePart.surface.role,material=SOURCE_MATERIAL_ROLES[role],frame=extra.frame||IDENTITY;
  const worldExtent=shape.type==='box'?shape.size.map(x=>x/2):[Math.max(shape.radius,shape.radiusTop),shape.height/2,Math.max(shape.radius,shape.radiusTop)];
  const extent=frame===ROAD_FRAME?[worldExtent[2],worldExtent[1],worldExtent[0]]:worldExtent;
  const m={id,sourceId:extra.sourceId===null?null:sourcePart.id,sourceShape:sourcePart.shape,sourceSurface:sourcePart.surface,type:shape.type,shape,center:shape.center,extent,frame:frame.map(a=>a.slice()),materialRole:role,feature:sourcePart.surface.feature,materialId:material.id,seed:material.seed,member:parts.length,owner:extra.owner??parts.length,waterContact:extra.waterContact??0,floor:extra.floor??false,...extra};parts.push(m);return m;
 };
 const group=(family,members,stride=[0,0,0])=>{if(members.length)groups.push({family,first:members[0].member,count:members.length,stride,floor:members[0].floor});};
 const single=(id,shape,extra={})=>{const m=put(id,shape,source.find(m=>m.id===id),extra);group(id,[m]);return m;};
 const p=plan,midZ=(p.back+p.front)/2,length=p.front-p.back,roadZ=(p.roadBack+p.roadFront)/2,roadLength=p.roadFront-p.roadBack;
 single('quay-ground',{type:'box',center:[p.shoreX-6,p.quayTop-.2,midZ],size:[12,.4,length]},{floor:true,waterContact:.35});
 single('quay-seawall',{type:'box',center:[p.shoreX-.2,p.wallTop-1.25,midZ],size:[.75,2.5,length]},{waterContact:1});
 const bollardSource=sources(/^quay-bollard-/),bollards=[];
 for(let z=p.back+3,i=0;z<p.front;z+=2.8,i++)bollards.push(put(bollardSource[i]?.id??'quay-bollard-extension-'+i,{type:'cylinder',center:[p.shoreX-.7,p.bollardY,z],radius:.11,radiusTop:.09,height:1,segments:12},bollardSource[i]??bollardSource[0],{sourceId:bollardSource[i]?.id??null,waterContact:.35}));
 group('quay-bollard',bollards,[0,0,2.8]);
 const road=single('station-road',{type:'box',center:[(p.roadLeft+p.roadRight)/2,p.roadTop-.06,roadZ],size:[p.roadRight-p.roadLeft,.12,roadLength]},{floor:true,frame:ROAD_FRAME});
 single('station-road-walk',{type:'box',center:[p.roadRight+2.4,p.walkTop-.2,roadZ],size:[4.8,.4,roadLength]},{floor:true,frame:ROAD_FRAME});
 const paintSource=sources(/^road-line-/),paint=[];
 for(let z=p.roadBack+3,i=0;z<p.roadFront;z+=5,i++)paint.push(put(paintSource[i]?.id??'road-line-extension-'+i,{type:'box',center:[road.center[0],p.roadTop+(p.paintThickness-p.paintEmbed)/2,z],size:[.12,p.paintThickness+p.paintEmbed,2.5]},paintSource[i]??paintSource[0],{sourceId:paintSource[i]?.id??null,floor:true,frame:ROAD_FRAME,owner:road.member,ingredientOf:'station-road'}));
 group('road-paint-ingredient',paint,[0,0,5]);
 single('pier-deck',{type:'box',center:[(p.pierStart+p.pierEnd)/2,p.pierTop-.17,p.pierZ],size:[24,.34,6]},{floor:true,waterContact:.35});
 const pileSource=sources(/^pier-pile-/);
 for(const sign of[-1,1]){const piles=[];for(let i=0;i<6;i++){const s=pileSource[i*2+(sign===1?1:0)];piles.push(put(s.id,{type:'cylinder',center:[p.pierStart+2+i*4,p.pileY,p.pierZ+sign*2.3],radius:.27,radiusTop:.27,height:4,segments:32},s,{waterContact:1}));}group('pier-pile-'+sign,piles,[4,0,0]);}
 if(new Set(parts.map(m=>m.id)).size!==parts.length)throw Error('Duplicate waterfront member');
 return {plan,parts,groups};
}
export const stationWaterfrontMembers=options=>construct(options).parts;
export function waterfrontMemberBounds(m,padding=0){finite(padding,'padding');if(padding<0)throw Error('Negative waterfront padding');const radius=[0,1,2].map(k=>m.frame.reduce((s,a,i)=>s+Math.abs(a[k])*m.extent[i],padding));return {min:sub(m.center,radius),max:add(m.center,radius)};}
const joinedBounds=members=>{const a=members.map(m=>waterfrontMemberBounds(m));return{min:[0,1,2].map(k=>Math.min(...a.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...a.map(b=>b.max[k])))};};
const expand=(b,padding)=>({min:b.min.map(x=>x-padding),max:b.max.map(x=>x+padding)});
export function stationWaterfrontBounds(options={},padding=.03001){finite(padding,'padding');if(padding<0)throw Error('Negative waterfront padding');return expand(joinedBounds(stationWaterfrontMembers(options)),padding);}
export function stationWaterfrontFloorBounds(options={},padding=.03001){finite(padding,'padding');if(padding<0)throw Error('Negative waterfront padding');const parts=stationWaterfrontMembers(options),owners=parts.filter(m=>m.floor&&m.ingredientOf===undefined);return owners.map(m=>({id:m.id,owner:m.member,...expand(joinedBounds(parts.filter(x=>x.owner===m.member)),padding)}));}
// Tight analytic group enclosures for dispatch. id0 is a stepping sentinel,
// never a surface; these boxes are not submitted as material-bearing solids.
export function stationWaterfrontCoverageBounds(options={},padding=.03001){
 finite(padding,'padding');if(padding<0)throw Error('Negative waterfront padding');const c=construct(options);
 return c.groups.map(g=>({name:'waterfront-'+g.family,...expand(joinedBounds(c.parts.slice(g.first,g.first+g.count)),padding)}));
}
export function waterfrontMemberPoint(m,q){return m.center.map((x,k)=>x+m.frame.reduce((s,a,i)=>s+a[k]*q[i],0));}
export function waterfrontMemberSample(m,p){
 const q=m.frame.map(a=>dot(sub(p,m.center),a));let d;
 if(m.type==='box')d=boxDistance(q,m.extent);
 else{const s=m.shape,n=s.segments,ap=Math.cos(Math.PI/n),slope=(s.radiusTop-s.radius)*ap/s.height;d=Math.abs(q[1])-s.height/2;for(let k=0;k<n;k++){const a=(k+.5)*2*Math.PI/n;d=Math.max(d,(q[0]*Math.sin(a)+q[2]*Math.cos(a)-s.radius*ap-slope*(q[1]+s.height/2))/Math.hypot(1,slope));}}
 return{d,baseD:d,id:m.materialId,q,extent:m.extent.slice(),frame:m.frame,member:m.member,seed:m.seed,owner:m.owner,waterContact:m.waterContact,sourceId:m.sourceId};
}
const boundDistance=(b,p)=>boxDistance(sub(p,b.min.map((x,i)=>(x+b.max[i])/2)),b.min.map((x,i)=>(b.max[i]-x)/2));
/** Fast CPU diagnostic matches the native grouping. Far bounds carry id=0 and
 * only advance rays. Near candidates each receive the material callback before
 * union. Set exhaustive=true to inspect actual primitives without acceleration. */
export function createStationWaterfrontSampler(options={}, {materialDistance=null,materialDistanceMaxShift=.03001,exhaustive=false}={}){
 const c=construct(options),margin=finite(materialDistanceMaxShift,'material distance bound');if(margin<0)throw Error('Negative material distance bound');
 const groups=c.groups.map(g=>({...g,bounds:expand(joinedBounds(c.parts.slice(g.first,g.first+g.count)),margin)}));
 const sample=(p,skipFloor=false)=>{let best={d:1e5,baseD:1e5,id:0,member:-1,owner:-1};
  const consider=i=>{const m=c.parts[i],h=waterfrontMemberSample(m,p);if(materialDistance){h.d=materialDistance(h,p,m);if(!Number.isFinite(h.d)||Math.abs(h.d-h.baseD)>margin+1e-10)throw Error('Waterfront material distance bound exceeded');}if(h.d<best.d)best=h;};
  for(const g of groups){if(skipFloor&&g.floor)continue;if(exhaustive){for(let i=0;i<g.count;i++)consider(g.first+i);continue;}
   const bd=boundDistance(g.bounds,p);if(bd>.15){if(bd<best.d)best={d:bd,baseD:bd,id:0,member:-1,owner:-1};continue;}
   if(g.count===1){consider(g.first);continue;}
   // Near a row envelope, non-neighbour repetitions are >one complete pitch
   // away. The bounded material shift cannot make a skipped member win.
   const first=c.parts[g.first],nearest=Math.max(0,Math.min(g.count-1,Math.round(dot(sub(p,first.center),g.stride)/dot(g.stride,g.stride))));
   for(let i=Math.max(0,nearest-1);i<=Math.min(g.count-1,nearest+1);i++)consider(g.first+i);
  }return best;
 };sample.parts=c.parts;sample.groups=groups;sample.plan=c.plan;return sample;
}
/** waterContact is the member's sea-exposure role; callers combine actual p.y
 * with their one shared state resolver for geometry AND shading. It is not a
 * calibrated salt/erosion law, and never reads a member-centred y as waterline. */
export function stationWaterfrontWGSL(options={}){
 const{parts,groups}=construct(options),callback=options.materialDistance??null,margin=options.materialDistanceMaxShift??.03001;
 if(callback!==null&&!/^[A-Za-z][A-Za-z0-9_]*$/.test(callback))throw Error('Invalid waterfront callback');finite(margin,'material distance bound');if(margin<0)throw Error('Negative material distance bound');
 const frame=axes=>'mat3x3<f32>('+axes.map(v).join(',')+')';
 let code=`\nstruct StationWaterfrontHit{d:f32,baseD:f32,id:u32,q:vec3<f32>,extent:vec3<f32>,member:f32,seed:f32,frame:mat3x3<f32>,owner:f32,waterContact:f32,}\nfn StationWaterfrontEmpty()->StationWaterfrontHit{return StationWaterfrontHit(1e5,1e5,0u,vec3<f32>(0.),vec3<f32>(1.),-1.,0.,${frame(IDENTITY)},-1.,0.);}\nfn StationWaterfrontBound(d:f32)->StationWaterfrontHit{var h=StationWaterfrontEmpty();h.d=d;h.baseD=d;return h;}\nfn StationWaterfrontCandidate(p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,member:f32,id:u32,seed:f32,basis:mat3x3<f32>,owner:f32,waterContact:f32)->StationWaterfrontHit{var h=StationWaterfrontHit(d,d,id,q,extent,member,seed,basis,owner,waterContact);${callback?`h.d=${callback}(h,p);`:''}return h;}\n`;
 // This pure metadata lookup survives the outer HitField's compact record.
 code+='fn stationWaterfrontWaterContact(member:f32)->f32{\n';for(const g of groups){const m=parts[g.first];if(m.waterContact)code+=`if(member>=${f(g.first)}&&member<${f(g.first+g.count)}){return ${f(m.waterContact)};}\n`;}code+='return 0.;}\n';
 code+=`// Every repeated child and every finite road ingredient is evaluated before min.\n// skipFloor covers all four actual floor solids and their connected paint.\nfn completeStationWaterfront(p:vec3<f32>,skipFloor:bool)->StationWaterfrontHit{var h=StationWaterfrontEmpty();\n`;
 for(const g of groups){const m=parts[g.first],s=m.shape,b=expand(joinedBounds(parts.slice(g.first,g.first+g.count)),margin),center=b.min.map((x,i)=>(x+b.max[i])/2),half=b.min.map((x,i)=>(b.max[i]-x)/2);
  code+=`// ${g.family}: ${g.count} real source/extended children; ${m.feature}\n${g.floor?'if(!skipFloor)':'{'}${g.floor?'{':''}\nlet bound=box(p-${v(center)},${v(half)});if(bound>.15){if(bound<h.d){h=StationWaterfrontBound(bound);}}else{\n`;
  if(g.count>1)code+=`let nearest=i32(clamp(round(dot(p-${v(m.center)},${v(g.stride)})/dot(${v(g.stride)},${v(g.stride)})),0.,${f(g.count-1)}));for(var offset=-1;offset<=1;offset++){let index=nearest+offset;if(index>=0&&index<${g.count}){let center=${v(m.center)}+${v(g.stride)}*f32(index);let member=${f(g.first)}+f32(index);\n`;
  else code+=`let center=${v(m.center)};let member=${f(g.first)};\n`;
  code+=`let basis=${frame(m.frame)};let delta=p-center;let q=vec3<f32>(dot(delta,basis[0]),dot(delta,basis[1]),dot(delta,basis[2]));let extent=${v(m.extent)};\n`;
  const d=m.type==='box'?'box(q,extent)':`memberCone(q,${f(s.radius)},${f(s.radiusTop)},${f(s.height)},${s.segments}u)`;
  code+=`let c=StationWaterfrontCandidate(p,${d},q,extent,member,${m.materialId}u,${f(m.seed)},basis,${m.ingredientOf?f(m.owner):'member'},${f(m.waterContact)});if(c.d<h.d){h=c;}\n`;
  if(g.count>1)code+='}}\n';code+='}}\n';
 }
 return code+'return h;}\n';
}
export const STATION_WATERFRONT_WGSL=stationWaterfrontWGSL();

