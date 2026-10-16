import {ZONES,PROFILE,partX,smooth} from './HairStyleProfile.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// An authored route belongs to the entire strand. No gravity, noisy per-node
// target or closest-neck attraction is used to determine the lower silhouette.
export function routeForRoot(root){
 const p=root.p,zone=root.zone,side=p[0]<partX(p[2])?-1:1,fringe=zone<=1,temple=zone===6||zone===7;
 let angle=Math.atan2(Math.abs(p[0]),p[2]-.012);
 if(temple)angle=clamp(angle,.78,1.28);
 else if(zone===8||zone===9||zone===3)angle=clamp(angle,1.74,Math.PI);
 else angle=clamp(angle,.98,Math.PI);
 if(!fringe&&!temple)angle=Math.min(Math.PI,angle+.45*Math.exp(-1*((angle-1.8)/.55)**2));
 const route=fringe?'fringe':temple||angle<1.36?'ear-front':angle<2.03?'ear-back':'back';
 const layer=clamp((p[1]-.27)/.16,0,1);
 return{side,angle,route,layer,root:p.slice(),zone,macro:'macro/'+ZONES[zone][0]+'/'+(side<0?'left':'right')};
}

export function lowerRail(route,y,hem){
 const {side,angle,layer,root,zone}=route;
 if(zone<=1)return[root[0]-.027,y,.112+.004*smooth((root[1]-.35)/.07)];
 const s=smooth((.30-y)/Math.max(.035,.30-hem));
 const width=PROFILE.GuideGroom.lowerWidth+layer*.005+s*.003;
 const depth=PROFILE.GuideGroom.lowerDepth+layer*.004+s*.002;
 const z=.012+Math.cos(angle)*depth,shoulder=smooth((.235-y)/.075),outside=route.route==='ear-front'?Math.max(z,.092+layer*.005):Math.min(z,-.083-layer*.006);
 return[side*Math.sin(angle)*width,y,z+(outside-z)*shoulder];
}

// Curves are compared from scalp to cut, sampling physical arc fractions and retaining their endpoints.
// Semantic zone, part side and ear route stay hard boundaries of the hierarchy.
function sampleCurve(g,t){
 const arcs=g.arcLengths,target=arcs.at(-1)*t;let lo=0,hi=arcs.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(arcs[m]<target)lo=m;else hi=m;}
 const w=(target-arcs[lo])/(arcs[hi]-arcs[lo]);return[0,1,2].map(k=>g.points[lo*3+k]*(1-w)+g.points[hi*3+k]*w);
}
export function curveDistance(a,b){
 let d=0,w=0;
 for(let n=0;n<=12;n++){const weight=n>=8?2:1,A=sampleCurve(a,n/12),B=sampleCurve(b,n/12);for(let k=0;k<3;k++)d+=weight*(A[k]-B[k])**2;w+=weight;}
 return Math.sqrt(d/w);
}
function representative(members){let best=members[0],cost=Infinity;for(const a of members){const c=members.reduce((s,b)=>s+curveDistance(a,b)**2,0);if(c<cost){cost=c;best=a;}}return best;}
function clusters(members,maxDiameter){
 const result=members.map(g=>[g]);
 for(;;){let best=null,cost=Infinity;for(let a=0;a<result.length;a++)for(let b=a+1;b<result.length;b++){
  let diameter=0;for(const x of result[a])for(const y of result[b])diameter=Math.max(diameter,curveDistance(x,y));
  if(diameter<=maxDiameter&&diameter<cost){cost=diameter;best=[a,b];}
 }if(!best)break;const[a,b]=best;result[a].push(...result[b]);result.splice(b,1);}
 return result.sort((a,b)=>a.map(g=>g.rootId).sort((x,y)=>x-y)[0]-b.map(g=>g.rootId).sort((x,y)=>x-y)[0]);
}
export function buildClumpGraph(guides){
 const graph=[],macroMap=new Map();for(const g of guides){if(!macroMap.has(g.macro))macroMap.set(g.macro,[]);macroMap.get(g.macro).push(g);}
 const add=(id,level,parent,members)=>{const medoid=representative(members);let diameter=0;for(const a of members)for(const b of members)diameter=Math.max(diameter,curveDistance(a,b));const group={id,level,parent,zone:members[0].zone,guides:members.map(g=>g.id),representativeGuide:medoid.id,curveDiameter:diameter,method:'complete-curve complete-link clustering within semantic route'};graph.push(group);return group;};
 for(const[id,members]of macroMap){add(id,'macro',null,members);const routes=new Map();for(const g of members){if(!routes.has(g.route))routes.set(g.route,[]);routes.get(g.route).push(g);}
  for(const[route,routeMembers]of routes)for(const[midIndex,midMembers]of clusters(routeMembers,PROFILE.ClumpGraph.midDiameter).entries()){
   const mid=id+'/'+route+'/'+midIndex;add(mid,'mid',id,midMembers);
   for(const[microIndex,microMembers]of clusters(midMembers,PROFILE.ClumpGraph.microDiameter).entries()){
    const micro=mid+'/'+microIndex;add(micro,'micro',mid,microMembers);for(const g of microMembers){g.mid=mid;g.micro=micro;}
   }
  }
 }
 return graph;
}

// A coarse authored hair envelope prevents long paths from collapsing inward
// onto the smaller neck after leaving the skull. It is a curve constraint only;
// no cap, shell or extra visible volume is created.
export function supportLowerEnvelope(p,route,arc){
 if(route.zone<=1)return p;
 const width=PROFILE.GuideGroom.lowerWidth+route.layer*.005,depth=PROFILE.GuideGroom.lowerDepth+route.layer*.004;
 const x=p[0]/width,z=(p[2]-.012)/depth,r=Math.hypot(x,z),rootRadius=Math.hypot(route.root[0]/width,(route.root[2]-.012)/depth),minimum=Math.min(smooth((.385-p[1])/.070),rootRadius+(1-rootRadius)*smooth(arc/.065));
 if(r>=minimum||r<1e-10)return p;
 const scale=minimum/r;return[p[0]*scale,p[1],.012+(p[2]-.012)*scale];
}
