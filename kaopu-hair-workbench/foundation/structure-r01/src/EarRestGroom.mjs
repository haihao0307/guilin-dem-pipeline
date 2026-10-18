import {smooth,sub,mix} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// P01 authoring envelope only. It never edits follicle/collision domains.
export function earRestProfile(){return{revision:'ear-rest-13',strength:1,cohesion:.32,protectedRootArc:.015,maxSourceY:.335,heightFade:.035,protectedTipArc:.012,tipFade:.030,maxDisplacement:.006,stationFade:.015};}
export function assertEarRestField(f){
 if(f?.revision!=='ear-rest-13')throw Error('Invalid ear rest field');
 const limits={strength:[0,1],cohesion:[0,.4],protectedRootArc:[.015,.015],maxSourceY:[.335,.335],heightFade:[.035,.035],protectedTipArc:[.012,.012],tipFade:[.030,.030],maxDisplacement:[.006,.006],stationFade:[.015,.015]};
 for(const[k,[a,b]]of Object.entries(limits))if(!Number.isFinite(f[k])||f[k]<a||f[k]>b)throw Error('Ear control outside declared envelope: '+k);
}
export function earWeight(g,n,f){
 if(g.zone<=1)return 0;const s=g.arcLengths[n],remaining=g.length-s,y=g.points[n*3+1];
 return smooth((s-f.protectedRootArc)/.025)*smooth((f.maxSourceY-y)/f.heightFade)*smooth((remaining-f.protectedTipArc)/f.tipFade);
}
// Correspond descending strands at the SAME physical height. Short roots
// enter the shared section continuously; never align unequal arc fractions.
export function descendingStation(g,y,fade=.015){
 for(let n=96;n>0;n--){const a=g.points.slice(n*3-3,n*3),b=g.points.slice(n*3,n*3+3);if(a[1]>b[1]&&y<=a[1]&&y>=b[1]){
  const top=Math.max(...g.points.filter((_,k)=>k%3===1)),bottom=g.points.at(-2),weight=smooth((top-y)/fade)*smooth((y-bottom)/fade);
  return{p:mix(a,b,(a[1]-y)/(a[1]-b[1])),weight};
 }}return null;
}
export function earGroups(source,graph){const byID=new Map(source.map(g=>[g.id,g]));return graph.filter(group=>group.level==='mid'&&group.guides.length>1&&group.guides.every(id=>byID.has(id)&&byID.get(id).zone>1)&&group.guides.some(id=>Math.abs(byID.get(id).points[0])>.045));}
export function shapeEarRest(source,graph,f,accept){
 assertEarRestField(f);const original=new Map(source.map(g=>[g.id,g])),output=new Map(source.map(g=>[g.id,structuredClone(g)])),groups=[],affected=[];let maxDisplacementMM=0;
 for(const group of earGroups(source,graph)){
  const members=group.guides.map(id=>original.get(id));
  if(members.some(g=>!g))throw Error('Missing connected wisp guide');
  if(members.some(g=>g.zone<=1)||!members.some(g=>Math.abs(g.points[0])>.045))continue;
  if(new Set(members.map(g=>g.route)).size!==1||new Set(members.map(g=>g.macro)).size!==1)throw Error('Ear wisp crosses material route');
  const desired=members.map(g=>{
   const out=structuredClone(g);for(let n=1;n<96;n++){
    const weight=earWeight(g,n,f)*f.strength;if(!weight)continue;
    const p=g.points.slice(n*3,n*3+3),sum=[p[0],p[1],p[2]];let total=1;
    for(const other of members){if(other===g)continue;const station=descendingStation(other,p[1],f.stationFade);if(!station)continue;for(const k of [0,2])sum[k]+=station.p[k]*station.weight;total+=station.weight;}
    const delta=[(sum[0]/total-p[0])*f.cohesion,0,(sum[2]/total-p[2])*f.cohesion],d=Math.hypot(...delta),bounded=d?f.maxDisplacement*Math.tanh(d/f.maxDisplacement)/d:0;
    for(const k of [0,2])out.points[n*3+k]=p[k]+delta[k]*bounded*weight;
   }return out;
  });
  // One scale per connected wisp. Individual-node clipping makes kinks;
  // individual-strand clipping can break the shared cross-section relation.
  let scale=0,candidates=members;
  for(const amount of [1,.5,.25,.125,.0625,.03125,.015625]){
   const trial=desired.map((g,i)=>({...structuredClone(members[i]),points:g.points.map((v,k)=>members[i].points[k]+(v-members[i].points[k])*amount)}));
   if(trial.every((g,i)=>accept(g,members[i]))){scale=amount;candidates=trial;break;}
  }
  let local=0;for(let i=0;i<candidates.length;i++){
   const g=candidates[i],old=members[i];let displacement=0;
   for(let n=0;n<97;n++)displacement=Math.max(displacement,Math.hypot(...sub(g.points.slice(n*3,n*3+3),old.points.slice(n*3,n*3+3)))*1000);
   if(displacement>1e-7){rebuildGuide(g);output.set(g.id,g);affected.push(g.id);local=Math.max(local,displacement);}
  }
  groups.push({id:group.id,route:members[0].route,members:group.guides,scale,maxDisplacementMM:local});maxDisplacementMM=Math.max(maxDisplacementMM,local);
 }
 return{guides:source.map(g=>output.get(g.id)),report:{revision:f.revision,changedGuides:affected.length,affected,groups,maxDisplacementMM,method:'native-connected same-route complete wisps; same-height transverse cohesion with continuous support and fixed root/crown/cut/tip anchors',physics:false}};
}
export function assertEarPreserved(source,output,f,graph){
 assertEarRestField(f);const allowed=new Set(earGroups(source,graph).flatMap(g=>g.guides));if(source.length!==output.length)throw Error('Ear edit lost guides');
 for(let i=0;i<source.length;i++){
  const a=source[i],b=output[i];for(const k of ['id','rootId','root','zone','macro','route','cut'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Ear edit changed identity/route/cut');
  for(let n=0;n<97;n++){
   if(a.points[n*3+1]!==b.points[n*3+1])throw Error('Ear edit changed point height');
   const d=Math.hypot(...sub(a.points.slice(n*3,n*3+3),b.points.slice(n*3,n*3+3)));
   if((!allowed.has(a.id)||!earWeight(a,n,f))&&d!==0)throw Error('Ear edit changed protected fringe/crown/launch/tip');
   if(d>f.maxDisplacement+2e-9)throw Error('Ear edit exceeded displacement bound');
  }
  if(a.zone<=1)for(const k of ['frames','arcLengths','length'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Ear edit changed full fringe geometry');
 }return true;
}
