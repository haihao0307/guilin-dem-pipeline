// Execution-only conservative hierarchy around ORIGINAL terminalHallQuery
// blocks. Nothing inside a block, its material callback or winner comparison
// changes. Ordered contiguous subtrees retain the original strict tie order.
const F=Math.fround;
const vec=a=>'vec3<f32>('+a.map(n=>Number.isInteger(n)?n+'.':String(n)).join(',')+')';
export const HALL_HIERARCHY_LIMIT=2048;
export const HALL_HIERARCHY_PADDING=.01;
export const HALL_HIERARCHY_GUARD=.005;
function matching(s,open){let depth=1;for(let i=open+1;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&!--depth)return i;}throw Error('Unclosed hall function/block');}
export function readHallBlocks(source){
 const start=source.indexOf('fn terminalHallQuery(');if(start<0)throw Error('Original terminalHallQuery absent');const open=source.indexOf('{',start),end=matching(source,open),body=source.slice(open+1,end),stop=body.lastIndexOf('return h;');
 if(stop<0||body.slice(stop).trim()!=='return h;')throw Error('Hall return contract changed');
 const first=body.indexOf('// ');if(first<0)throw Error('Original member annotations absent');
 const blocks=[];let pos=first;
 while(pos<stop){while(/\s/.test(body[pos])&&pos<stop)pos++;if(pos>=stop)break;
  if(body.slice(pos,pos+3)!=='// ')throw Error('Hall block annotation changed');const commentEnd=body.indexOf('\n',pos);let bo=commentEnd+1;while(/\s/.test(body[bo]))bo++;if(body[bo]!=='{')throw Error('Hall top-level block changed');const be=matching(body,bo),text=body.slice(pos,be+1),annotation=body.slice(pos,commentEnd);
  const m=/let bound=box\(p-vec3<f32>\(([^)]+)\),vec3<f32>\(([^)]+)\)\);if\(bound>\.06\)/.exec(text);
  if(!m)throw Error('Original exact hall far-bound branch absent');
  const center=m[1].split(',').map(Number).map(F),half=m[2].split(',').map(Number).map(F),count=Number(/; (\d+) finite members\./.exec(annotation)?.[1]);
  if(center.length!==3||half.length!==3||[...center,...half,count].some(x=>!Number.isFinite(x))||half.some(x=>x<=0)||count<1)throw Error('Invalid original hall bound/count');
  blocks.push({index:blocks.length,text,annotation,center,half,count,min:center.map((c,k)=>c-half[k]),max:center.map((c,k)=>c+half[k])});pos=be+1;
 }
 if(!blocks.length)throw Error('Empty hall block sequence');
 return{start,open,end,head:source.slice(start,open+1),initial:body.slice(0,first),blocks,tail:body.slice(stop)};
}
export function buildOrderedHierarchy(blocks,{leafSize=4}={}){
 if(!Number.isInteger(leafSize)||leafSize<1||leafSize>16)throw Error('Invalid hierarchy leaf size');let next=0;
 function build(lo,hi){const selected=blocks.slice(lo,hi),min=[0,1,2].map(k=>Math.min(...selected.map(b=>b.min[k]))-HALL_HIERARCHY_PADDING),max=[0,1,2].map(k=>Math.max(...selected.map(b=>b.max[k]))+HALL_HIERARCHY_PADDING),node={index:next++,lo,hi,min,max,center:min.map((x,k)=>(x+max[k])/2),half:min.map((x,k)=>(max[k]-x)/2),members:selected.reduce((s,b)=>s+b.count,0)};
 if(hi-lo>leafSize){const mid=lo+Math.floor((hi-lo)/2);node.left=build(lo,mid);node.right=build(mid,hi);}return node;}
 return build(0,blocks.length);
}
export function lowerHallHierarchy(source,{leafSize=4,counters=false}={}){
 const original=readHallBlocks(source),tree=buildOrderedHierarchy(original.blocks,{leafSize});let nodes=0;
 const emit=node=>{nodes++;const body=node.left?emit(node.left)+emit(node.right):original.blocks.slice(node.lo,node.hi).map(b=>(counters?'stationHallBlocksVisited+=1u;\n':'')+b.text+'\n').join('');
  const test=`box(p-${vec(node.center)},${vec(node.half)})<=max(.06,h.d)+.005`;
  return`// Original ordered hall blocks [${node.lo},${node.hi}); empty space only.\n${counters?'stationHallBoundsVisited+=1u;\n':''}if(!hallHierarchySafe||${test}){\n${body}}${counters?`else{stationHallBlocksSkipped+=${node.hi-node.lo}u;}`:''}\n`;
 };
 const initial=original.initial+`\nlet hallHierarchySafe=all(abs(p)<vec3<f32>(2048.));\n`+(counters?'stationHallBoundsVisited=0u;stationHallBlocksVisited=0u;stationHallBlocksSkipped=0u;\n':'');
 const replacement=original.head+initial+emit(tree)+original.tail+'}';
 const declarations=counters?'\nvar<private> stationHallBoundsVisited:u32;\nvar<private> stationHallBlocksVisited:u32;\nvar<private> stationHallBlocksSkipped:u32;\n':'';
 const lowered=declarations+source.slice(0,original.start)+replacement+source.slice(original.end+1);
 // Original blocks occur ONCE byte-for-byte; no original geometry/matter rewrite.
 for(const b of original.blocks)if(lowered.split(b.text).length!==2)throw Error('Original block duplicated or modified');
 return{source:lowered,original,tree,metrics:{blocks:original.blocks.length,nodes,leafSize,representedMembers:original.blocks.reduce((s,b)=>s+b.count,0),paddingM:HALL_HIERARCHY_PADDING,comparisonGuardM:HALL_HIERARCHY_GUARD,coordinateLimitM:HALL_HIERARCHY_LIMIT,counters}};
}
export function instrumentReferenceHall(source){const o=readHallBlocks(source);const init=o.initial+'\nstationHallBoundsVisited=0u;stationHallBlocksVisited=0u;stationHallBlocksSkipped=0u;\n';const body=o.blocks.map(b=>'stationHallBlocksVisited+=1u;\n'+b.text).join('\n');return '\nvar<private> stationHallBoundsVisited:u32;\nvar<private> stationHallBlocksVisited:u32;\nvar<private> stationHallBlocksSkipped:u32;\n'+source.slice(0,o.start)+o.head+init+body+o.tail+'}'+source.slice(o.end+1);}
// Conservative CPU branch trace for tests only. Calling visit returns the same
// current physical winner distance the original sequential block would return.
export function walkOrderedHall(tree,blocks,p,visit,initial=1e5){let best=initial,visited=0,nodes=0,skipped=0;const safe=p.every(x=>Number.isFinite(x)&&Math.abs(x)<HALL_HIERARCHY_LIMIT);
 function walk(node){nodes++;if(safe&&boxF32(p,node.center,node.half)>F(F(Math.max(.06,best))+.005)){skipped+=node.hi-node.lo;return;}
 if(node.left){walk(node.left);walk(node.right);}else for(let i=node.lo;i<node.hi;i++){visited++;best=visit(blocks[i],best);}}
 walk(tree);return{best,visited,nodes,skipped};}
export function boxF32(p,center,half){const q=p.map((x,k)=>F(Math.abs(F(F(x)-F(center[k])))-F(half[k]))),n=q.map(x=>F(Math.max(x,0)));const dot=F(F(F(n[0]*n[0])+F(n[1]*n[1]))+F(n[2]*n[2]));return F(F(Math.sqrt(dot))+Math.min(Math.max(...q),0));}

// Same ordered tree and exactly the same entry-time gate. Scalar parent flags
// retain each ancestor decision; no recursive/nested GPU control tree or array.
export function lowerFlatHallHierarchy(source,{leafSize=4,counters=false}={}){
 const original=readHallBlocks(source),tree=buildOrderedHierarchy(original.blocks,{leafSize});let nodes=0;
 const emit=(node,parent=null)=>{nodes++;const flag='hallNode'+node.index,guard=`!hallHierarchySafe||box(p-${vec(node.center)},${vec(node.half)})<=max(.06,h.d)+.005`;
  const decide=(counters?'stationHallBoundsVisited+=1u;\n':'')+`${flag}=${guard};\n`+(counters?`if(!${flag}){stationHallBlocksSkipped+=${node.hi-node.lo}u;}\n`:'');
  const prefix=`// Shallow original ordered node [${node.lo},${node.hi}).\nvar ${flag}=false;\n`+(parent===null?decide:`if(hallNode${parent}){\n${decide}}\n`);
  const body=node.left?emit(node.left,node.index)+emit(node.right,node.index):`if(${flag}){\n`+original.blocks.slice(node.lo,node.hi).map(b=>(counters?'stationHallBlocksVisited+=1u;\n':'')+b.text+'\n').join('')+'}\n';
  return prefix+body;
 };
 const initial=original.initial+'\nlet hallHierarchySafe=all(abs(p)<vec3<f32>(2048.));\n'+(counters?'stationHallBoundsVisited=0u;stationHallBlocksVisited=0u;stationHallBlocksSkipped=0u;\n':'');
 const replacement=original.head+initial+emit(tree)+original.tail+'}';
 const declarations=counters?'\nvar<private> stationHallBoundsVisited:u32;\nvar<private> stationHallBlocksVisited:u32;\nvar<private> stationHallBlocksSkipped:u32;\n':'';
 const lowered=declarations+source.slice(0,original.start)+replacement+source.slice(original.end+1);
 for(const b of original.blocks)if(lowered.split(b.text).length!==2)throw Error('Original block duplicated or modified');
 return{source:lowered,original,tree,metrics:{blocks:original.blocks.length,nodes,leafSize,representedMembers:original.blocks.reduce((s,b)=>s+b.count,0),paddingM:HALL_HIERARCHY_PADDING,comparisonGuardM:HALL_HIERARCHY_GUARD,coordinateLimitM:HALL_HIERARCHY_LIMIT,counters,controlFlow:'preorder scalar parent flags; original entry-time gates'}};
}
export function walkFlatOrderedHall(tree,blocks,p,visit,initial=1e5){
 const ordered=[];function append(n,parent=null){ordered.push({n,parent});if(n.left){append(n.left,n.index);append(n.right,n.index);}}append(tree);
 let best=initial,visited=0,nodes=0,skipped=0;const active=new Map(),safe=p.every(x=>Number.isFinite(x)&&Math.abs(x)<HALL_HIERARCHY_LIMIT);
 for(const{n,parent}of ordered){if(parent!==null&&!active.get(parent)){active.set(n.index,false);continue;}nodes++;
 const enabled=!safe||boxF32(p,n.center,n.half)<=F(F(Math.max(.06,best))+.005);active.set(n.index,enabled);if(!enabled){skipped+=n.hi-n.lo;continue;}
 if(!n.left)for(let i=n.lo;i<n.hi;i++){visited++;best=visit(blocks[i],best);}}
 return{best,visited,nodes,skipped};
}
