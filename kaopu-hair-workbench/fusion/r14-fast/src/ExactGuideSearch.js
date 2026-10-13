/** Exact branch-and-bound lookup; score must be >= Euclidean distance squared.
 * Stable original-index ties preserve the brute-force sampler exactly.
 */
const indexes=new WeakMap();
function tree(gs,ids){
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const i of ids)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],gs[i].root[k]);hi[k]=Math.max(hi[k],gs[i].root[k]);}
 if(ids.length<=12)return{lo,hi,ids:ids.sort((a,b)=>a-b)};
 let axis=0;for(let k=1;k<3;k++)if(hi[k]-lo[k]>hi[axis]-lo[axis])axis=k;
 ids.sort((a,b)=>gs[a].root[axis]-gs[b].root[axis]||a-b);const m=ids.length>>1;
 return{lo,hi,left:tree(gs,ids.slice(0,m)),right:tree(gs,ids.slice(m))};
}
function lower(p,node){let d=0;for(let k=0;k<3;k++){const q=p[k]<node.lo[k]?node.lo[k]-p[k]:p[k]>node.hi[k]?p[k]-node.hi[k]:0;d+=q*q;}return d;}
export function exactNearestGuides(gs,root,score,compatible){
 let index=indexes.get(gs);if(!index){index=tree(gs,gs.map((_,i)=>i));indexes.set(gs,index);}
 const id=[-1,-1,-1],ds=[Infinity,Infinity,Infinity];
 function visit(node,bound){
  if(bound>ds[2]+1e-14)return;
  if(node.ids){for(const i of node.ids){const g=gs[i],dist=score(g);if(dist>ds[2]||(dist===ds[2]&&i>=id[2]))continue;if(!compatible(g))continue;let k=2;while(k>0&&(dist<ds[k-1]||(dist===ds[k-1]&&i<id[k-1]))){ds[k]=ds[k-1];id[k]=id[k-1];k--;}ds[k]=dist;id[k]=i;}return;}
  const l=lower(root,node.left),r=lower(root,node.right);if(l<=r){visit(node.left,l);visit(node.right,r);}else{visit(node.right,r);visit(node.left,l);}
 }
 visit(index,lower(root,index));
 if(id[0]<0)throw Error('局部发区缺少兼容导向');for(let j=1;j<3;j++)if(id[j]<0){id[j]=id[0];ds[j]=ds[0];}
 const w=ds.map(x=>1/Math.max(x,1e-8)),sum=w.reduce((a,b)=>a+b,0);return{id,w:w.map(x=>x/sum)};
}
