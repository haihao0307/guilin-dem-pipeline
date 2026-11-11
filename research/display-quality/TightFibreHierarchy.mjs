// Tight componentwise enclosure of the original quadratic plus bounded curl.
// Root identity, records, Morton order and query arithmetic remain unchanged.
const scratchFloat=new Float32Array(1),scratchBits=new Uint32Array(scratchFloat.buffer);const outward=(x,up)=>{const a=scratchFloat,u=scratchBits;a[0]=x;if((up&&a[0]<x)||(!up&&a[0]>x))u[0]+=((a[0]>=0)===up)?1:-1;return a[0];};
export function tightenFibreHierarchy(built){
 const at=performance.now(),b=new Float32Array(built.count*6),r=built.records,nodes=built.nodes.slice();
 for(let i=0;i<built.count;i++)for(let k=0;k<3;k++){const o=i*28,root=r[o+k],s=r[o+4+k],z=r[o+8+k],curl=Math.abs(r[o+12+k]),radius=r[o+3],end=root+s+z,t=z===0?-1:-s/(2*z),turn=t>0&&t<1?root+s*t+z*t*t:root;b[i*6+k]=outward(Math.min(root,end,turn)-curl-radius,false);b[i*6+3+k]=outward(Math.max(root,end,turn)+curl+radius,true);}
 for(let i=built.nodeCount-1;i>=0;i--){const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];if(nodes[i*8+3]>.5){const start=nodes[i*8+3]-1,end=Math.min(built.count,start+8);for(let j=start;j<end;j++){const id=built.order[j];for(let k=0;k<3;k++){low[k]=Math.min(low[k],b[id*6+k]);high[k]=Math.max(high[k],b[id*6+k+3]);}}}else{const a=i+1,c=nodes[a*8+7];for(let k=0;k<3;k++){low[k]=Math.min(nodes[a*8+k],nodes[c*8+k]);high[k]=Math.max(nodes[a*8+4+k],nodes[c*8+4+k]);}}for(let k=0;k<3;k++){nodes[i*8+k]=low[k];nodes[i*8+4+k]=high[k];}}
 return{...built,nodes,bounds:{low:[...nodes.slice(0,3)],high:[...nodes.slice(4,7)]},stats:{...built.stats,tightQuadraticBounds:true,hierarchyTighteningMs:performance.now()-at}};
}
