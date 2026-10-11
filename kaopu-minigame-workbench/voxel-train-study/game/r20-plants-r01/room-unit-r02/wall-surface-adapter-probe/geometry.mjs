// Runtime parameter geometry only. No meshes or images are loaded.
export function cubeLattice(half,spacing){
 if(!half.every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(spacing)||spacing<.01||spacing>.12)throw Error('Invalid sampling domain/spacing');
 const positions=[],indices=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const u=(axis+1)%3,v=(axis+2)%3,nu=Math.ceil(2*half[u]/spacing),nv=Math.ceil(2*half[v]/spacing),base=positions.length/3;
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=[0,0,0];p[axis]=sign*half[axis];p[u]=(i/nu*2-1)*half[u];p[v]=(j/nv*2-1)*half[v];positions.push(...p);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=base+j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(...(sign>0?[a,b,d,a,d,c]:[a,d,b,a,c,d]));}
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices),vertexCount:positions.length/3,triangleCount:indices.length/3};
}
export function rotateToWorld(p,yaw){return yaw<-.5?[-p[2],p[1],p[0]]:[...p];}
export function rotatedHalf(half,yaw){return yaw<-.5?[half[2],half[1],half[0]]:[...half];}
// Door cap rectangles intersect only the declared conservative solid bounds.
// The fragment shader checks exact solid occupancy before shading each cap.
export function doorCaps(door,center,half){
 if(!door)return [];
 const left=door.x-door.width/2,right=door.x+door.width/2,bottom=door.bottom,top=bottom+door.height;
 const planes=[{axis:0,value:left,normal:[1,0,0]},{axis:0,value:right,normal:[-1,0,0]},{axis:1,value:top,normal:[0,-1,0]}];
 if(bottom>0)planes.push({axis:1,value:bottom,normal:[0,1,0]});
 const out=[];
 for(const p of planes){
  if(p.value<center[p.axis]-half[p.axis]||p.value>center[p.axis]+half[p.axis])continue;
  const u=p.axis===0?1:0,v=2,lo=Math.max(center[u]-half[u],u===0?left:bottom),hi=Math.min(center[u]+half[u],u===0?right:top);
  if(hi<=lo)continue;
  const positions=[];for(const [a,b]of [[lo,-1],[hi,-1],[hi,1],[lo,1]]){const q=[0,0,0];q[p.axis]=p.value;q[u]=a;q[v]=center[v]+b*half[v];positions.push(...q);}
  out.push({positions,normal:p.normal,indices:[0,1,2,0,2,3]});
 }
 return out;
}
export function inDoor(p,d){return !!d&&p[0]>d.x-d.width/2&&p[0]<d.x+d.width/2&&p[1]>d.bottom&&p[1]<d.bottom+d.height;}
