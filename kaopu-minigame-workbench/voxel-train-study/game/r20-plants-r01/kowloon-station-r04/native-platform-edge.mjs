// Native R02 longitudinal eaves and individually jointed platform copings.
// Own frozen source: station-recipe.mjs @ f31df978916876205355664593b0299f027188ad.
// Source (x,y,z) -> station (z,y,-x) is a proper rotation (determinant +1).
// R04 has authored longer axes; segment counts adapt, section/joint rules do not.
// No deck lives here. The parent retains the floor and its skipFloor contract.
export const PLATFORM_EDGE_CONTRACT=Object.freeze({
 units:'metres',sourceCommit:'f31df978916876205355664593b0299f027188ad',
 eave:{width:.20,depth:.26,materialRole:'structural-iron',materialId:3,seed:152},
 coping:{pitch:1.2,joint:.006,height:.09,width:.28,materialRole:'platform-stone',materialId:2,seed:79},
 materialBinding:'The R02 platform-stone role used concrete KST; id 2 is the explicit current R04 stone-mother adaptation, not an assertion of source material identity.',
 phase:'R04 source parameter increases from station front toward back. A shortened final coping is retained at the back, with the same 6mm trailing joint.',
 materialUnion:'Member-local metric coordinates differ. Evaluate material on every eligible child before union; choosing a raw winner first is invalid.',
 physicalMargin:.03001,
});
export const PLATFORM_EDGE_FRAME=Object.freeze([[0,0,-1],[0,1,0],[1,0,0]].map(Object.freeze));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),f=n=>Math.abs(n)<1e-14?'0.':Number.isInteger(n)?n+'.':String(n),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
export const platformEdgeSourceToStation=p=>[p[2],p[1],-p[0]];
export const platformEdgeStationToSource=p=>[-p[2],p[1],p[0]];
const box=(q,e)=>{const d=q.map((x,i)=>Math.abs(x)-e[i]);return Math.hypot(...d.map(x=>Math.max(x,0)))+Math.min(Math.max(...d),0);};
const validate=(o)=>{for(const[k,n]of Object.entries(o))if(!Number.isFinite(n))throw Error('Invalid platform-edge '+k);};
function sourceChild(id,shape,family,row,index,side=0){
 const eave=family==='eave',center=eave?shape.a.map((x,i)=>(x+shape.b[i])/2):shape.center;
 const sourceExtent=eave?[(shape.b[0]-shape.a[0])/2,shape.width/2,shape.depth/2]:shape.size.map(x=>x/2);
 const metricOrigin=(eave?shape.a:shape.center).slice();
 return{id,family,row,index,side,sourceShape:shape,materialRole:eave?'structural-iron':'platform-stone',feature:eave?'rolled-member':'coping-drip-edge',contact:eave?'sheltered':'rain-exposed',
 center:platformEdgeSourceToStation(center),extent:sourceExtent,stationExtent:[sourceExtent[2],sourceExtent[1],sourceExtent[0]],
 metricFrame:{origin:metricOrigin,axis:[1,0,0],frame:'source xyz, metres'},materialOrigin:platformEdgeSourceToStation(metricOrigin),frame:PLATFORM_EDGE_FRAME.map(a=>a.slice()),
 materialId:eave?3:2,seed:eave?152:79,sourceMembership:{family,row,segment:index,side,component:id}};
}
// Exact source-family expansion for fixture comparison, independent of R04 siting.
export function platformEdgeSourceMembers({first=-78,last=10,bay=8,deck=1.1,eave=8.1,supportRows=[-23.8,-5.8,12.2,30.2],platforms=[{min:-25.85,max:-19.85},{min:-9.75,max:-1.85},{min:8.25,max:16.15},{min:26.25,max:32.25}]}={}){
 validate({first,last,bay,deck,eave});if(last<=first||bay<=0||supportRows.length!==platforms.length)throw Error('Invalid source-family span');
 const bays=Math.round((last-first)/bay);if(bays<1||Math.abs(bays*bay-last+first)>1e-8)throw Error('Eaves require complete source bays');
 const parts=[];
 for(let index=0;index<bays;index++)for(let row=0;row<supportRows.length;row++){
  const x=first+index*bay,z=supportRows[row];validate({z});parts.push(sourceChild(`eave-${index}-${row}`,{type:'beam',a:[x,eave,z],b:[x+bay,eave,z],width:.20,depth:.26},'eave',row,index));
 }
 for(let row=0;row<platforms.length;row++){
  const {min,max}=platforms[row];validate({min,max});if(max-min<.56)throw Error('Platform is narrower than its paired coping courses');
  for(const side of[-1,1])for(let index=0;first+index*1.2<last-.001;index++){
   const x=first+index*1.2,w=Math.min(1.2,last-x)-.006;
   if(w<=0)throw Error('Final coping remainder is narrower than its 6mm source joint');
   const edge=side<0?min:max,id=`platform-${row}-coping-${side}-${Math.round(x*10)}`;
   parts.push(sourceChild(id,{type:'box',center:[x+w/2,deck-.045,edge-side*.14],size:[w,.09,.28]},'coping',row,index,side));
  }
 }
 return parts;
}
function parameters({back=-145,front=-10,bay=7.5,deck=.85,eave=9.25,extension=1.3,...rest}={}){
 validate({back,front,bay,deck,eave,extension});if(back>=front||bay<=0||extension<0)throw Error('Invalid R04 platform-edge datums');
 const bayCount=Math.round((front-back)/bay),copingCount=Math.ceil((front-back+2*extension-.001)/1.2);
 if(bayCount<1||Math.abs(bayCount*bay-front+back)>1e-8||copingCount<1)throw Error('Invalid R04 platform-edge segment counts');
 const tail=front-back+2*extension-(copingCount-1)*1.2-.006;if(tail<=0)throw Error('Invalid clipped coping remainder');
 return{back,front,bay,deck,eave,extension,bayCount,copingCount,...rest};
}
export function platformEdgeRowMembers(options={}){
 const p=parameters(options),{row=0,center=-30,halfWidth=3.4,eaveCenter=center}=p;validate({row,center,halfWidth,eaveCenter});
 if(!Number.isInteger(row)||row<0||halfWidth<.28)throw Error('Invalid platform edge row');
 const eaves=Array.from({length:p.bayCount},(_,i)=>{const x=-p.front+i*p.bay;return sourceChild(`eave-${i}-${row}`,{type:'beam',a:[x,p.eave,eaveCenter],b:[x+p.bay,p.eave,eaveCenter],width:.20,depth:.26},'eave',row,i);});
 // Copings extend 1.3m past both shed ends. Do not stretch a cell or discard the tail.
 const copings=[];
 for(const side of[-1,1])for(let i=0;i<p.copingCount;i++){
  const x=-p.front-p.extension+i*1.2,last=-p.back+p.extension,w=Math.min(1.2,last-x)-.006;
  copings.push(sourceChild(`platform-${row}-coping-${side}-${Math.round(x*10)}`,{type:'box',center:[x+w/2,p.deck-.045,center+side*(halfWidth-.14)],size:[w,.09,.28]},'coping',row,i,side));
 }
 for(const m of eaves){m.row=row;m.id=`eave-${m.index}-${row}`;m.sourceMembership={family:'eave',row,segment:m.index,side:0,component:m.id};}
 for(const m of[...eaves,...copings])m.member=m.family==='eave'?row*p.bayCount+m.index:row*2*p.copingCount+(m.side>0?p.copingCount:0)+m.index;
 return[...eaves,...copings];
}
export function platformEdgeMembers(options={}){
 const centers=options.centers??[-30,-10,10,30],halfWidths=options.halfWidths??centers.map(()=>3.4),eaveCenters=options.eaveCenters??[-30,-10,10,30];
 if(centers.length!==halfWidths.length||centers.length!==eaveCenters.length)throw Error('Mismatched platform rows');
 return centers.flatMap((center,row)=>platformEdgeRowMembers({...options,row,center,halfWidth:halfWidths[row],eaveCenter:eaveCenters[row]}));
}
export function platformEdgeSample(member,p,{physicalDistance=null}={}){
 const q=platformEdgeStationToSource(sub(p,member.materialOrigin)),geometryQ=platformEdgeStationToSource(sub(p,member.center)),baseD=box(geometryQ,member.extent);
 const h={d:baseD,baseD,id:member.materialId,q,seed:member.seed,extent:member.extent.slice(),sourceSeed:member.member??member.index,member:member.member??member.index,sourceId:member.id,family:member.family,row:member.row,index:member.index,side:member.side,frame:member.frame.map(a=>a.slice())};
 if(physicalDistance){h.d=physicalDistance(h,p);if(!Number.isFinite(h.d))throw Error('Invalid platform-edge material distance');}
 return h;
}
export function platformEdgeRowSample(p,options={},physicalDistance=null){
 let best=null;for(const m of platformEdgeRowMembers(options)){const candidate=platformEdgeSample(m,p,{physicalDistance});if(!best||candidate.d<best.d)best=candidate;}return best;
}
export function platformEdgeRowSampleFolded(p,options={},physicalDistance=null){
 const params=parameters(options);if(Math.min(params.bay,1.2)<=.046+2*PLATFORM_EDGE_CONTRACT.physicalMargin)throw Error('Station-distance fold requires wider cells');
 const eaveCell=Math.max(0,Math.min(params.bayCount-1,Math.floor((params.front-p[2])/params.bay)));
 const copingCell=Math.max(0,Math.min(params.copingCount-1,Math.floor((params.front+params.extension-p[2])/1.2)));
 let best=null;for(const m of platformEdgeRowMembers(options)){
  if(Math.abs(m.index-(m.family==='eave'?eaveCell:copingCell))>1)continue;
  const c=platformEdgeSample(m,p,{physicalDistance});if(!best||c.d<best.d)best=c;
 }return best;
}
export function platformEdgeMaterialDirection(direction){return platformEdgeStationToSource(direction);}
export function platformEdgeBounds(options={}){
 const p=parameters(options),{center=-30,halfWidth=3.4,eaveCenter=center,margin=.03001}=p;validate({center,halfWidth,eaveCenter,margin});if(margin<0||halfWidth<.28)throw Error('Invalid platform-edge enclosure');
 const bounds=(lo,hi)=>({min:lo.map(x=>x-margin),max:hi.map(x=>x+margin),materialId:0,boundOnly:true});
 const eaves=bounds([eaveCenter-.13,p.eave-.10,p.back],[eaveCenter+.13,p.eave+.10,p.front]);
 const copings=[-1,1].map(side=>{const x=center+side*(halfWidth-.14);return bounds([x-.14,p.deck-.09,p.back-p.extension+.006],[x+.14,p.deck,p.front+p.extension]);});
 return{eaves,copings,union:{min:[0,1,2].map(k=>Math.min(eaves.min[k],...copings.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(eaves.max[k],...copings.map(b=>b.max[k]))),materialId:0,boundOnly:true}};
}
// Optional stationDistanceContract enables an exact three-cell shortlist only
// for the current station callback: abs(raw)<.045 uses raw+delta, |delta|<=.03001;
// otherwise sign(raw)*max(abs(raw)-.03,0). Omitted cells are >= one full
// pitch away (> .10502), hence cannot beat a near-field child. If all children
// are far, the distance mapping is monotone and the shortlist contains the raw
// nearest member. Clipped last cells and both sides participate explicitly.
// This is NOT a common-q material fold. Each retained child gets its own q.
// Requires the parent's box, HitField and a typed physical-distance callback.
// Without a callback this exports the raw analytic field only. Never mark its
// bound helper as a surface: a caller may use bound-only HitField id 0 for steps.
export function platformEdgeWGSL(options={}){
 const p=parameters(options),callback=options.materialDistance??null,fold=options.stationDistanceContract===true;
 if(fold&&Math.min(p.bay,1.2)<=.046+2*PLATFORM_EDGE_CONTRACT.physicalMargin)throw Error('Station-distance fold requires cells wider than the material band');
 if(callback!==null&&!/^[A-Za-z][A-Za-z0-9_]*$/.test(callback))throw Error('Invalid platform-edge material callback');
 return `
struct StationPlatformEdgeHit{d:f32,baseD:f32,id:u32,q:vec3<f32>,seed:f32,extent:vec3<f32>,sourceSeed:f32,frame:mat3x3<f32>,family:u32,row:u32,segment:u32,side:i32,}
fn stationPlatformEdgeFrame()->mat3x3<f32>{return mat3x3<f32>(vec3<f32>(0.,0.,-1.),vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.));}
fn stationPlatformEdgeMaterialDirection(n:vec3<f32>)->vec3<f32>{return transpose(stationPlatformEdgeFrame())*n;}
fn stationPlatformEdgeEmpty()->StationPlatformEdgeHit{return StationPlatformEdgeHit(1e5,1e5,0u,vec3<f32>(0.),0.,vec3<f32>(1.),-1.,stationPlatformEdgeFrame(),2u,0u,0u,0);}
fn stationPlatformEdgeRawWinner(h:StationPlatformEdgeHit)->HitField{return HitField(h.baseD,h.id,h.q,h.seed,h.baseD,h.extent,h.sourceSeed);}
// Every candidate retains its raw geometry and member-local metric frame even
// after its physical distance has participated in the inner union.
fn stationPlatformEdgeCandidate(p:vec3<f32>,center:vec3<f32>,materialOrigin:vec3<f32>,extent:vec3<f32>,id:u32,seed:f32,member:f32,family:u32,row:u32,segment:u32,side:i32)->StationPlatformEdgeHit{
 let frame=stationPlatformEdgeFrame();let q=transpose(frame)*(p-materialOrigin);let d=box(transpose(frame)*(p-center),extent);
 var h=StationPlatformEdgeHit(d,d,id,q,seed,extent,member,frame,family,row,segment,side);${callback?`h.d=${callback}(h,p);`:''}return h;
}
// Source eave-bay-row: .20m vertical x .26m transverse, full touching bay.
fn stationEaveMemberAt(p:vec3<f32>,centerX:f32,row:u32,bay:u32)->StationPlatformEdgeHit{
 if(bay>=${p.bayCount}u){return stationPlatformEdgeEmpty();}
 let front=${f(p.front)}-f32(bay)*${f(p.bay)};let center=vec3<f32>(centerX,${f(p.eave)},front-${f(p.bay/2)});
 return stationPlatformEdgeCandidate(p,center,vec3<f32>(centerX,${f(p.eave)},front),vec3<f32>(${f(p.bay/2)},.10,.13),3u,152.,f32(row*${p.bayCount}u+bay),0u,row,bay,0);
}
// Source platform-row-coping-side-round(sourceX*10), phase starts at front.
fn stationCopingMemberAt(p:vec3<f32>,centerX:f32,halfWidth:f32,row:u32,side:i32,index:u32)->StationPlatformEdgeHit{
 if(index>=${p.copingCount}u||(side!=-1&&side!=1)){return stationPlatformEdgeEmpty();}
 let front=${f(p.front+p.extension)}-f32(index)*1.2;let width=min(1.2,front-(${f(p.back-p.extension)}))-.006;
 let center=vec3<f32>(centerX+f32(side)*(halfWidth-.14),${f(p.deck-.045)},front-width*.5);let extent=vec3<f32>(width*.5,.045,.14);
 let member=row*${2*p.copingCount}u+select(0u,${p.copingCount}u,side>0)+index;
 return stationPlatformEdgeCandidate(p,center,center,extent,2u,79.,f32(member),1u,row,index,side);
}
fn completeStationEaveRow(p:vec3<f32>,centerX:f32,row:u32)->StationPlatformEdgeHit{
 var h=stationPlatformEdgeEmpty();${fold?`let cell=clamp(i32(floor((${f(p.front)}-p.z)/${f(p.bay)})),0,${p.bayCount-1});let first=u32(max(0,cell-1));let last=u32(min(${p.bayCount-1},cell+1));`:`let first=0u;let last=${p.bayCount-1}u;`}for(var i=first;i<=last;i++){let c=stationEaveMemberAt(p,centerX,row,i);if(c.d<h.d){h=c;}}return h;
}
fn completeStationCopingRow(p:vec3<f32>,centerX:f32,halfWidth:f32,row:u32)->StationPlatformEdgeHit{
 var h=stationPlatformEdgeEmpty();${fold?`let cell=clamp(i32(floor((${f(p.front+p.extension)}-p.z)/1.2)),0,${p.copingCount-1});let first=u32(max(0,cell-1));let last=u32(min(${p.copingCount-1},cell+1));`:`let first=0u;let last=${p.copingCount-1}u;`}for(var side=-1;side<=1;side+=2){for(var i=first;i<=last;i++){let c=stationCopingMemberAt(p,centerX,halfWidth,row,side,i);if(c.d<h.d){h=c;}}}return h;
}
// One final raw candidate per row can enter the parent's candidate queue.
// The current floor remains entirely with the parent; skipFloor is irrelevant.
fn completeStationPlatformEdgeRow(p:vec3<f32>,eaveCenterX:f32,centerX:f32,halfWidth:f32,row:u32)->StationPlatformEdgeHit{
 var h=completeStationEaveRow(p,eaveCenterX,row);let c=completeStationCopingRow(p,centerX,halfWidth,row);if(c.d<h.d){h=c;}return h;
}
// Conservative bounds contain every raw member plus the common 30.01mm mother
// envelope. They are acceleration only, never stone/iron surface candidates.
fn stationEaveRowBound(p:vec3<f32>,centerX:f32)->f32{return box(p-vec3<f32>(centerX,${f(p.eave)},${f((p.front+p.back)/2)}),vec3<f32>(.16001,.13001,${f((p.front-p.back)/2+.03001)}));}
fn stationCopingRowBound(p:vec3<f32>,centerX:f32,halfWidth:f32)->f32{
 let centerZ=${f((p.front+p.back+.006)/2)};let extent=vec3<f32>(.17001,.07501,${f((p.front-p.back+2*p.extension-.006)/2+.03001)});
 let low=box(p-vec3<f32>(centerX-halfWidth+.14,${f(p.deck-.045)},centerZ),extent);let high=box(p-vec3<f32>(centerX+halfWidth-.14,${f(p.deck-.045)},centerZ),extent);return min(low,high);
}
fn stationPlatformEdgeRowBound(p:vec3<f32>,eaveCenterX:f32,centerX:f32,halfWidth:f32)->f32{return min(stationEaveRowBound(p,eaveCenterX),stationCopingRowBound(p,centerX,halfWidth));}
`;
}
