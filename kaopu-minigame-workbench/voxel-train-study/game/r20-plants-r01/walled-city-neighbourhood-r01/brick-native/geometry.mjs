// Runtime parameter geometry only. No meshes or images are loaded.
export const BRICK_MODEL_SCALE=.1153846154;
export const BRICK_HALF=[1.04,.265,.480].map(v=>v*BRICK_MODEL_SCALE);
export const BRICK_RADIUS=.055*BRICK_MODEL_SCALE;
export function cubeLattice(half,spacing){return anchoredBoxLattice(half,spacing,0);}
export function anchoredBoxLattice(half,spacing,radius=0){
 if(!half.every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(spacing)||spacing<.01||spacing>.12)throw Error('Invalid sampling domain/spacing');
 const axes=half.map(h=>{const n=Math.ceil(2*h/spacing),a=Array.from({length:n+1},(_,i)=>(i/n*2-1)*h);if(radius>0){const r=Math.min(radius,h/2);a.push(-h+r,-h+r*.5,0,h-r*.5,h-r);}return [...new Set(a.map(v=>+v.toPrecision(14)))].sort((a,b)=>a-b);});
 const positions=[],indices=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const u=(axis+1)%3,v=(axis+2)%3,nu=axes[u].length-1,nv=axes[v].length-1,base=positions.length/3;
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=[0,0,0];p[axis]=sign*half[axis];p[u]=axes[u][i];p[v]=axes[v][j];positions.push(...p);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=base+j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(...(sign>0?[a,b,d,a,d,c]:[a,d,b,a,c,d]));}
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices),vertexCount:positions.length/3,triangleCount:indices.length/3,chartHalf:[...half],tangentRadius:radius};
}
export function brickSurfaceLattice(spacing,family=0){const radius=(family===2?.072:family===3?.045:.055)*BRICK_MODEL_SCALE;return anchoredBoxLattice(BRICK_HALF,spacing,radius);}
