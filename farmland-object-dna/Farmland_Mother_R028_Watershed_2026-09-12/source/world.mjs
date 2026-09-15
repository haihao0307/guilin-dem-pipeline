// Farmland R028. Persistent synthetic relationships; render buffers are derived.
export const VERSION='FARMLAND_R028_WATERSHED_20260912';
export const FRAME={id:'farmland-r028-local',unit:'m',axes:'x east, y up, z south',datum:'synthetic local zero',surveyAccuracy:null,worldLocation:null};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
export function rng(seed=280912){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const hash=(x,z)=>{const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);};
export function noise(x,z){const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
export const terraceLevels=[14.1,12.65,11.5,9.8,8.4,6.9,5.55,4.25,2.9,1.65];
const contourZ=[-113,-101,-86,-77,-63,-48,-37,-23,-9,6,25];
export function contour(k,u){return contourZ[k]+18*Math.sin(u*Math.PI*1.45+.2)+5.2*Math.sin(u*Math.PI*3.1+k*.24)+2.7*Math.cos(u*8-k*.35);}
export function terracePoint(k,u,v){return[-106+98*u,mix(contour(k,u),contour(k+1,u),v)];}
export function terraceCoordinate(x,z){const u=(x+106)/98;if(u<0||u>1)return null;for(let k=0;k<10;k++){const a=contour(k,u),b=contour(k+1,u);if(z>=a&&z<=b)return{k,u,v:(z-a)/(b-a)};}return null;}
export function riverX(z){return 58+11*Math.sin((z+30)*.018)+4*Math.sin(z*.042);}
export function riverY(z){return -.36-.0025*(z+115);}
export const extent={xmin:-195,xmax:180,zmin:-305,zmax:145,step:.5};
const flatBeds=[1.16,.98,.79,.59];
const flatZ=[27,48,69,91,113];
export function flatPoint(k,u,v){const a=flatZ[k]+5*Math.sin(u*5+k*.4),b=flatZ[k+1]+5*Math.sin(u*5+(k+1)*.4),z=mix(a,b,v);const left=-4+2*Math.sin(z*.04);const right=riverX(z)-12;return[mix(left,right,u),z];}
export function flatCoordinate(x,z){for(let k=0;k<4;k++){
  const left=-4+2*Math.sin(z*.04),u=(x-left)/(riverX(z)-12-left),a=flatZ[k]+5*Math.sin(u*5+k*.4),b=flatZ[k+1]+5*Math.sin(u*5+(k+1)*.4),v=(z-a)/(b-a);
  if(u>=0&&u<=1&&v>=0&&v<=1)return{k,u,v};
}return null;}
export function area(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)*.5;}
export function ring(point,k,u0=.06,u1=.94,v0=.12,v1=.68){const p=[];for(let j=0;j<=70;j++)p.push(point(k,mix(u0,u1,j/70),v0));for(let j=0;j<=70;j++)p.push(point(k,mix(u1,u0,j/70),v1));return p;}
export const fields=[...terraceLevels.map((bed,k)=>({id:`T${k+1}`,name:`坡地第 ${k+1} 级`,kind:'terrace',k,bed,point:terracePoint,bounds:[.06,.94,.12,.68],polygon:ring(terracePoint,k),stage:k===2||k===5?'heading':'tillering',source:'generated',frame:FRAME.id})),...flatBeds.map((bed,k)=>({id:`F${k+1}`,name:['河湾秧田','移栽田','插秧田','河畔水田'][k],kind:'flat',k,bed,point:flatPoint,bounds:[.045,.955,.10,.86],polygon:ring(flatPoint,k,.045,.955,.10,.86),stage:k===0?'tillering':'transplanted',source:'generated',frame:FRAME.id}))];
for(const f of fields){f.area=area(f.polygon);f.crest=f.bed+.26;f.inletId=`in-${f.id}`;f.outletId=`out-${f.id}`;f.evidence={kind:'synthetic',source:'reference morphology, not surveyed dimensions',uncertainty:null};}
export const fieldById=Object.fromEntries(fields.map(f=>[f.id,f]));
export const mountains=[[-153,-206,48,47],[-100,-242,72,40],[-43,-211,65,34],[8,-257,99,43],[65,-215,77,38],[121,-248,70,44],[165,-192,70,48],[-193,-127,65,49],[-162,-266,81,45],[45,-289,73,50]];
export function rockHeight(x,z){let y=0;for(let i=0;i<mountains.length;i++){const[cx,cz,h,r]=mountains[i],dx=(x-cx)/r,dz=(z-cz)/(r*.72),theta=Math.atan2(dz,dx),rad=Math.hypot(dx,dz)/(1+.15*Math.sin(theta*3+i)+.045*Math.sin(theta*9));if(rad<1){const cap=Math.pow(1-Math.pow(rad,1.75+(i%3)*.35),.56+(i%2)*.11);const crack=1-.16*noise(x*.11,z*.12)-.045*Math.abs(Math.sin(theta*15+x*.025))-.035*noise(x*.42,z*.35);y=Math.max(y,h*cap*crack);}}return y;}
export function earthBase(x,z){
  const rear=3+4*noise(x*.017,z*.017);let y=.24+.23*noise(x*.035,z*.035)+rear*smooth(30,-125,z);
  // Enclosing hills are unmeasured procedural context, independent of DEM truth.
  y+=rockHeight(x,z);
  const tc=terraceCoordinate(x,z);
  if(tc){const{k,u,v}=tc,h=terraceLevels[k],next=terraceLevels[k+1]??.9;
    let ty=v<.82?h:mix(h,next,smooth(.82,1,v));
    ty+=.32*Math.exp(-Math.pow((v-.78)/.045,4));
    ty+=.30*Math.exp(-Math.pow((u-.025)/.016,4))+.30*Math.exp(-Math.pow((u-.975)/.016,4));
    const edge=(1-smooth(.97,1,u))*smooth(0,.03,u);y=mix(y,ty,edge);
  }else if(x>-114&&x<0&&z>-120&&z<35){
    const u=clamp((x+106)/98,0,1);let k=0;while(k<9&&z>contour(k+1,u))k++;
    const side=1-smooth(0,9,Math.min(Math.abs(x+106),Math.abs(x+8)));
    y=mix(y,terraceLevels[k]+.1,side);
  }
  const fc=flatCoordinate(x,z);if(fc){const{k,u,v}=fc;const crest=.25*Math.exp(-Math.pow((v-.93)/.045,4))+.25*Math.exp(-Math.pow((u-.018)/.016,4))+.25*Math.exp(-Math.pow((u-.982)/.016,4));y=flatBeds[k]+crest;}
  const d=Math.abs(x-riverX(z));if(z>-137){const channel=riverY(z)-.9+.02*Math.sin(z*.08);y=mix(channel,y,smooth(5.7,11,d));}
  return y;
}
export const connections=[];
function addEdge(id,from,to,points,crest,width=.68){connections.push({id,from,to,points,crest,width,coefficient:.38,model:'ideal head-controlled opening; uncalibrated',source:'generated',frame:FRAME.id});}
const first=fields[0],p0=first.point(0,.9,.2);
export const spring={id:'spring',x:p0[0]+6,z:p0[1]-12,bed:14.3,area:Math.PI*2.25**2,initialVolume:Math.PI*2.25**2*.085};
addEdge('spring-intake','spring','T1',[[spring.x,spring.bed+.07,spring.z],[p0[0],first.bed+.07,p0[1]]],first.bed+.10,.36);
for(let k=0;k<9;k++){
  const a=fields[k],b=fields[k+1],p=a.point(k,.9,.54),q=a.point(k,.9,.83),r=b.point(k+1,.9,.23);
  addEdge(`spill-${a.id}-${b.id}`,a.id,b.id,[[p[0],a.bed+.015,p[1]],[q[0],a.bed+.055,q[1]],[r[0],b.bed+.015,r[1]]],a.bed+.055,.85);
}
const lastT=fields[9],firstF=fields[10],a=lastT.point(9,.9,.54),b=lastT.point(9,.9,.85),c=firstF.point(0,.1,.22);
addEdge('terrace-to-flat','T10','F1',[[a[0],lastT.bed+.015,a[1]],[b[0],lastT.bed+.055,b[1]],[-7,1.35,29],[c[0],firstF.bed+.015,c[1]]],lastT.bed+.055,1.0);
for(let k=0;k<3;k++){const a=fields[10+k],b=fields[11+k],p=a.point(k,.15,.62),q=a.point(k,.15,.96),r=b.point(k+1,.15,.23);addEdge(`spill-${a.id}-${b.id}`,a.id,b.id,[[p[0],a.bed+.01,p[1]],[q[0],a.bed+.055,q[1]],[r[0],b.bed+.01,r[1]]],a.bed+.055,.95);}
const last=fields[13],out=last.point(3,.83,.62),riverZ=out[1]+7;
export const receiver={id:'river',area:50000,bed:-2,initialVolume:(riverY(riverZ)+2)*50000,z:riverZ,scope:'finite downstream reach extending beyond the visible river segment'};
addEdge('field-return-river','F4','river',[[out[0],last.bed+.01,out[1]],[riverX(out[1])-11,last.bed+.055,out[1]],[riverX(riverZ),riverY(riverZ)-.2,riverZ]],last.bed+.055,1.05);
export function segmentProjection(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);return{t,d:Math.hypot(x-mix(a[0],b[0],t),z-mix(a[2],b[2],t)),bed:mix(a[1],b[1],t)};}
export function ground(x,z){let y=earthBase(x,z);
  const d=Math.hypot(x-spring.x,z-spring.z);if(d<16){const tc=terraceCoordinate(x,z),guard=tc?1-smooth(0,.06,tc.v):1;const mound=mix(spring.bed+.24,y,smooth(3.6,16,d));y=Math.max(y,mix(y,mound,guard));}if(d<3.6)y=mix(spring.bed,Math.max(y,spring.bed+.24),smooth(2.3,3.6,d));
  // Channels and notches carve the same soil surface used by all display objects.
  for(const e of connections)for(let j=0;j<e.points.length-1;j++){const p=segmentProjection(x,z,e.points[j],e.points[j+1]);const w=e.width*.5+.35;
    if(p.d<w+.75){const bed=p.bed-.12,cut=mix(bed,y,smooth(w,w+.75,p.d));y=Math.min(y,cut);}
  }
  return y;
}
export const nodes=[{...spring},...fields.map(f=>({id:f.id,area:f.area,bed:f.bed,initialVolume:f.area*.08})),{...receiver}];
export const nodesById=Object.fromEntries(nodes.map(n=>[n.id,n]));
export function makeState(scenario='normal'){
  const s={time:0,volume:Object.fromEntries(nodes.map(n=>[n.id,n.initialVolume])),lastFlows:{},rain:0,loss:0,scenario,initial:0,clamped:0};
  if(scenario==='dry')s.volume.spring=0;
  if(scenario==='backwater')s.volume.river=nodesById.river.area*(.78-nodesById.river.bed);
  s.initial=Object.values(s.volume).reduce((a,b)=>a+b,0);return s;
}
export function level(state,id){const n=nodesById[id];return n.bed+state.volume[id]/n.area;}
export function step(state,dt=1){if(!(dt>0&&dt<=30&&Number.isFinite(dt)))throw Error('Time step outside declared model range');
  const proposals=[],outgoing={};
  for(const e of connections){const ha=level(state,e.from),hb=level(state,e.to);const from=ha>=hb?e.from:e.to,to=ha>=hb?e.to:e.from;let crest=e.crest,width=e.width;
    if(state.scenario==='blocked'&&e.id==='spill-T4-T5')width=0;
    if(state.scenario==='breach'&&e.id==='spill-T4-T5'){crest=fieldById.T4.bed;width=2.1;}
    const high=Math.max(ha,hb),low=Math.min(ha,hb),head=Math.max(0,high-Math.max(crest,low));
    const q=e.coefficient*width*Math.sqrt(2*9.81)*Math.pow(head,1.5);
    const equalize=Math.abs(ha-hb)/(1/nodesById[from].area+1/nodesById[to].area);
    const volume=Math.min(q*dt,equalize*.48);proposals.push({id:e.id,from,to,volume,sign:from===e.from?1:-1});outgoing[from]=(outgoing[from]||0)+volume;
  }
  const next={...state.volume},flows={};let newClamps=0,newRain=0;
  for(const p of proposals){const fraction=Math.min(1,state.volume[p.from]/(outgoing[p.from]||1));if(fraction<1)newClamps++;const v=p.volume*fraction;next[p.from]-=v;next[p.to]+=v;flows[p.id]=p.sign*v/dt;}
  if(state.scenario==='flood')for(const f of fields){const rain=f.area*(.045/3600)*dt;next[f.id]+=rain;newRain+=rain;}
  for(const id in next)if(!Number.isFinite(next[id])||next[id]<-1e-9)throw Error('Invalid storage '+id);
  for(const f of fields)if(f.bed+next[f.id]/f.area>f.crest)throw Error('Unsupported overtopping beyond modeled ports: '+f.id);
  state.volume=next;state.lastFlows=flows;state.time+=dt;state.rain+=newRain;state.clamped+=newClamps;return state;
}
export function balance(s){return Object.values(s.volume).reduce((a,b)=>a+b,0)-s.initial-s.rain+s.loss;}
export function waterSurfaceOnEdge(e,state,t){
  const lengths=e.points.slice(1).map((p,i)=>Math.hypot(p[0]-e.points[i][0],p[2]-e.points[i][2]));const total=lengths.reduce((a,b)=>a+b,0);let distance=t*total;
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=clamp(distance/lengths[i],0,1),p=e.points[i],q=e.points[i+1];return[mix(p[0],q[0],f),mix(p[1],q[1],f)+.015,mix(p[2],q[2],f)];}distance-=lengths[i];}
}
export function validateWorld(){const errors=[];const outgoing={};for(const e of connections){if(!nodesById[e.from]||!nodesById[e.to])errors.push('missing_endpoint:'+e.id);(outgoing[e.from]??=[]).push(e.to);if(e.points.some(p=>p.some(v=>!Number.isFinite(v))))errors.push('invalid_point:'+e.id);}
  const reaches=(a,b,seen=new Set())=>a===b||(!seen.has(a)&&(seen.add(a),(outgoing[a]||[]).some(n=>reaches(n,b,seen))));
  for(const f of fields){if(!reaches('spring',f.id)||!reaches(f.id,'river'))errors.push('orphan:'+f.id);if(!(f.area>10))errors.push('invalid_area:'+f.id);if(!connections.some(e=>e.to===f.id)||!connections.some(e=>e.from===f.id))errors.push('missing_port:'+f.id);}
  return{ok:errors.length===0,errors,fieldCount:fields.length,connections:connections.length,frame:FRAME,synthetic:true,visualAcceptance:false,productionReady:false};
}
