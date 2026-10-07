/* Independent implementation of Runions et al. 2005, sections 3-4:
   relative-neighbour attraction + delayed tagged-source removal.
   Paper: https://faculty.cc.gatech.edu/~turk/bio_sim/articles/leaf_venation_05.pdf
   No code from the CC-BY-NC-SA Jason Webb implementation is incorporated.
   Declared discretisation: reached tagged tips are welded through their source
   (within kill distance), so anastomoses are actual graph cycles, not visual gaps.
   The initial midrib/secondary scaffold is an authored study constraint.
 */
import {seeded} from './geometry.js';
import {leafWidth} from './venation.js';
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
class Grid{
 constructor(nodes,size){this.nodes=nodes;this.size=size;this.bins=new Map();nodes.forEach((n,i)=>this.add(i));}
 key(x,y){return Math.floor(x/this.size)+','+Math.floor(y/this.size);}
 add(i){const n=this.nodes[i],k=this.key(n.x,n.y);let b=this.bins.get(k);if(!b){b=[];this.bins.set(k,b);}b.push(i);}
 near(p,r){const out=[],s=this.size;for(let x=Math.floor((p.x-r)/s);x<=Math.floor((p.x+r)/s);x++)for(let y=Math.floor((p.y-r)/s);y<=Math.floor((p.y+r)/s);y++)for(const i of this.bins.get(x+','+y)||[]){const dist=d2(this.nodes[i],p);if(dist<=r*r)out.push({i,d:dist});}return out;}
}
export function relativeNeighbours(source,candidates,nodes){
 // Exact pruning: in a cone of width <=60 degrees, any nearer point blocks
 // a farther one from the relative-neighbour lune. At most six candidates
 // survive, and each is still checked against ALL points in range.
 const best=Array(6).fill(null);for(const c of candidates){const p=nodes[c.i],sector=Math.min(5,Math.floor((Math.atan2(p.y-source.y,p.x-source.x)+Math.PI)/(Math.PI/3)));if(!best[sector]||c.d<best[sector].d)best[sector]=c;}
 const out=[];for(const v of best){if(!v)continue;let ok=true;for(const u of candidates){if(u.i!==v.i&&u.d<=v.d&&d2(nodes[v.i],nodes[u.i])<=v.d){ok=false;break;}}if(ok)out.push(v);}return out;
}
export function buildReticulation({seed=771,attractors=3800,step=3.2,kill=2.45,influence=40,maxIterations=150}={}){
 const random=seeded(seed),nodes=[],edges=[],edgeKeys=new Set(),primaryPaths=[];const width=800,height=1200;
 const inside=p=>p.y>=0&&p.y<=height&&Math.abs(p.x-400)<=leafWidth(1-p.y/height)*height*.64;
 const addNode=(x,y,parent=-1,order=2)=>{const id=nodes.length;nodes.push({x,y,parent,order,birth:0});return id;};
 const addEdge=(a,b,order=2,radius=.025)=>{if(a===b)return;const k=Math.min(a,b)+','+Math.max(a,b);if(edgeKeys.has(k))return;edgeKeys.add(k);edges.push({a,b,order,radius});};
 for(let i=0;i<=120;i++){addNode(400+Math.sin(i/120*3.0)*3,1200-i*10,i-1,0);if(i)addEdge(i-1,i,0,.50*Math.pow(1-i/125,.6)+.07);}primaryPaths.push(nodes.slice(0,121).map((_,i)=>i));
 const secondaryEnds=[[],[]];for(let row=0;row<11;row++){const rootIndex=10+row*9,baseY=nodes[rootIndex].y,t=1-baseY/height;for(let side=0;side<2;side++){const sign=side?-1:1,path=[rootIndex];let parent=rootIndex;for(let k=1;k<=22;k++){const s=k/22,y=baseY-(90+80*Math.sin(t*Math.PI))*Math.pow(s,1.12),half=leafWidth(1-y/height)*height*.64*.91,x=400+sign*half*Math.sin(s*Math.PI*.46);const id=addNode(x,y,parent,1);addEdge(parent,id,1,(.095+.045*(1-t))*Math.pow(1-s*.85,.62));parent=id;path.push(id);}primaryPaths.push(path);secondaryEnds[side].push(parent);}}
 // Marginal secondary arches are explicit study scaffolding, distinct from fine growth.
 for(let side=0;side<2;side++)for(let i=0;i<10;i++){const a=secondaryEnds[side][i],b=secondaryEnds[side][i+1],start=nodes[a],end=nodes[b],path=[a];let parent=a;for(let k=1;k<12;k++){const t=k/12,y=start.y+(end.y-start.y)*t,x=400+(side?-1:1)*leafWidth(1-y/height)*height*.64*.91;const n=addNode(x,y,parent,1);addEdge(parent,n,1,.038);parent=n;path.push(n);}addEdge(parent,b,1,.038);path.push(b);primaryPaths.push(path);}
 let sources=[];const sourceGrid=new Grid(sources,12),initialGrid=new Grid(nodes,18);for(let attempt=0;sources.length<attractors&&attempt<attractors*30;attempt++){const p={x:random()*800,y:random()*1200,tags:null};if(inside(p)&&!sourceGrid.near(p,6).length&&!initialGrid.near(p,3).length){sources.push(p);sourceGrid.add(sources.length-1);}}
 let iterations=0,welds=0,stalled=0;const step2=step*step,kill2=kill*kill;
 for(;iterations<maxIterations&&sources.length;iterations++){
  const grid=new Grid(nodes,24),influenceMap=new Map(),remove=new Set();
  for(let si=0;si<sources.length;si++){const src=sources[si],rel=relativeNeighbours(src,grid.near(src,influence),nodes);if(!rel.length)continue;
   if(!src.tags&&rel.some(n=>n.d<=kill2))src.tags=rel.map(n=>({id:n.i,done:n.d<=kill2}));
   if(src.tags){for(const tag of src.tags){const dist=d2(nodes[tag.id],src);tag.done=tag.done||dist<=kill2||dist>influence*influence||!rel.some(v=>v.i===tag.id);}if(src.tags.every(t=>t.done)){const reached=src.tags.filter(t=>d2(nodes[t.id],src)<=kill2*1.001);if(reached.length>1){const v=addNode(src.x,src.y,reached[0].id,2);nodes[v].birth=iterations;for(const t of reached)addEdge(t.id,v,2,.017);welds++;}remove.add(si);continue;}}
   for(const v of rel){if(v.d<=kill2)continue;const node=nodes[v.i],len=Math.sqrt(v.d);let d=influenceMap.get(v.i);if(!d){d={x:0,y:0,n:0};influenceMap.set(v.i,d);}d.x+=(src.x-node.x)/len;d.y+=(src.y-node.y)/len;d.n++;}
  }
  const descendants=new Map();let count=0;
  for(const [parent,d] of influenceMap){const length=Math.hypot(d.x,d.y);if(length<1e-6)continue;const p=nodes[parent],next={x:p.x+step*d.x/length,y:p.y+step*d.y/length};if(!inside(next))continue;
   const near=grid.near(next,step*.52).filter(n=>n.i!==parent&&n.i!==p.parent).sort((a,b)=>a.d-b.d);
   let id;if(near.length){id=near[0].i;addEdge(parent,id,2,.021);}else{id=addNode(next.x,next.y,parent,2);nodes[id].birth=iterations;grid.add(id);addEdge(parent,id,2,.022);count++;}descendants.set(parent,id);
  }
  for(const src of sources)if(src.tags)for(const tag of src.tags)if(!tag.done&&descendants.has(tag.id))tag.id=descendants.get(tag.id);
  sources=sources.filter((_,i)=>!remove.has(i));if(count===0)stalled++;else stalled=0;if(stalled>4)break;
 }
 const weights=new Float32Array(nodes.length).fill(1);for(let i=nodes.length-1;i>0;i--)if(nodes[i].parent>=0)weights[nodes[i].parent]+=weights[i];
 for(const e of edges)if(e.order===2)e.radius=Math.min(.072,.012+Math.pow(Math.min(weights[e.a],weights[e.b]),.30)*.006);
 const parent=nodes.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(const e of edges)parent[find(e.b)]=find(e.a);const components=new Set(nodes.map((_,i)=>find(i))).size;
 return {width,height,nodes,edges,primaryPaths,seed,report:{algorithm:'Runions relative-neighbour closed growth, independent implementation',authoredScaffold:true,nodes:nodes.length,edges:edges.length,components,cycles:edges.length-nodes.length+components,sourceWelds:welds,remainingSources:sources.length,iterations,kill,step,actualAuthorSourceRun:false}};
}
