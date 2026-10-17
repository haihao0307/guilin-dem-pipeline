import {curveDistance} from './StaticGroomRules.mjs';
import {dot,sub,unit} from './HairStyleProfile.mjs';

// Local native-root neighbours are a connectivity constraint, independent of
// whole-curve shape similarity. This is not a reproduction of scalp Delaunay.
export function nativeNeighbours(guides,roots,stride=26){
 const graph=new Map(guides.map(g=>[g.id,new Set()]));
 for(const a of guides){const normal=Array.from(roots.subarray(a.rootId*stride+7,a.rootId*stride+10));const nearest=guides.filter(b=>b!==a&&b.macro===a.macro&&b.route===a.route).map(b=>({b,d:Math.hypot(...sub(a.points.slice(0,3),b.points.slice(0,3))),normal:Array.from(roots.subarray(b.rootId*stride+7,b.rootId*stride+10))})).filter(q=>q.d<=.035&&dot(unit(normal),unit(q.normal))>=.5).sort((a,b)=>a.d-b.d||a.b.rootId-b.b.rootId).slice(0,4);for(const {b}of nearest){graph.get(a.id).add(b.id);graph.get(b.id).add(a.id);}}
 return graph;
}
export function connectedMembers(ids,neighbours){
 const set=new Set(ids),visited=new Set([ids[0]]),queue=[ids[0]];for(let n=0;n<queue.length;n++)for(const id of neighbours.get(queue[n])||[])if(set.has(id)&&!visited.has(id)){visited.add(id);queue.push(id);}return visited.size===ids.length;
}
export function buildVolumeClumps(guides,roots,profile){
 const graph=[],adj=nativeNeighbours(guides,roots),distances=new Map();
 const distance=(a,b)=>{const k=[a.id,b.id].sort().join('|');if(!distances.has(k))distances.set(k,curveDistance(a,b));return distances.get(k);};
 function clusters(members,maxDiameter){const sets=members.map(g=>[g]);for(;;){let best=null,cost=Infinity;for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){if(!sets[i].some(a=>sets[j].some(b=>adj.get(a.id).has(b.id))))continue;let diameter=0;for(const a of sets[i])for(const b of sets[j])diameter=Math.max(diameter,distance(a,b));if(diameter<=maxDiameter&&diameter<cost){cost=diameter;best=[i,j];}}if(!best)break;const[i,j]=best;sets[i].push(...sets[j]);sets.splice(j,1);}return sets.sort((a,b)=>Math.min(...a.map(g=>g.rootId))-Math.min(...b.map(g=>g.rootId)));}
 function add(id,level,parent,members){let diameter=0,best=members[0],cost=Infinity;for(const a of members){let sum=0;for(const b of members){const d=distance(a,b);diameter=Math.max(diameter,d);sum+=d*d;}if(sum<cost){cost=sum;best=a;}}graph.push({id,level,parent,zone:members[0].zone,guides:members.map(g=>g.id),representativeGuide:best.id,curveDiameter:diameter,method:'connected local native-root graph plus complete-curve complete-link diameter',rootConnected:connectedMembers(members.map(g=>g.id),adj)});}
 const macroMap=new Map();for(const g of guides.slice().sort((a,b)=>a.rootId-b.rootId)){if(!macroMap.has(g.macro))macroMap.set(g.macro,[]);macroMap.get(g.macro).push(g);}
 for(const [macro,members]of macroMap){add(macro,'macro',null,members);const routes=new Map();for(const g of members){if(!routes.has(g.route))routes.set(g.route,[]);routes.get(g.route).push(g);}for(const [route,routeMembers]of routes)for(const [mi,ms]of clusters(routeMembers,profile.ClumpGraph.midDiameter).entries()){const mid=macro+'/'+route+'/volume-'+mi;add(mid,'mid',macro,ms);for(const [ci,cs]of clusters(ms,profile.ClumpGraph.microDiameter).entries()){const micro=mid+'/'+ci;add(micro,'micro',mid,cs);for(const g of cs){g.mid=mid;g.micro=micro;}}}}
 return graph;
}
