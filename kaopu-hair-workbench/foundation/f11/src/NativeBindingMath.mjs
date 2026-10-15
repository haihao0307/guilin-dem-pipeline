const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);if(!Number.isFinite(d)||d<1e-8)throw Error('Degenerate face frame');return a.map(x=>x/d)};
const curveCache=new WeakMap();
/** A single quadratic through the five observed native brow controls in least squares.
 * The old piecewise line introduced slope discontinuities into every source fibre.
 * This smooth carrier does not alter the source fibres' transverse variation. */
export function smoothBrowValue(x,line){
 let fit=curveCache.get(line);if(!fit){
  const lo=Math.min(...line.map(p=>Math.abs(p[0]))),hi=Math.max(...line.map(p=>Math.abs(p[0])));if(hi-lo<1e-5)throw Error('Degenerate brow span');
  const rows=line.map(p=>{const u=(Math.abs(p[0])-lo)/(hi-lo);return[1,u,u*u]});
  const solve=k=>{const a=Array.from({length:3},(_,i)=>[...Array.from({length:3},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)),rows.reduce((s,r,q)=>s+r[i]*line[q][k],0)]);
   for(let i=0;i<3;i++){let at=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[at][i]))at=j;[a[i],a[at]]=[a[at],a[i]];if(Math.abs(a[i][i])<1e-10)throw Error('Unidentifiable brow curve');const d=a[i][i];for(let k=i;k<4;k++)a[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){const d=a[j][i];for(let k=i;k<4;k++)a[j][k]-=d*a[i][k];}}
   return a.map(r=>r[3]);};
  fit={lo,hi,coeff:[solve(1),solve(2)],sign:Math.sign(line[2][0])};curveCache.set(line,fit);
 }
 const u=(x-fit.lo)/(fit.hi-fit.lo);return[fit.sign*x,...fit.coeff.map(c=>c[0]+c[1]*u+c[2]*u*u)];
}
export function faceFrame(landmarks){
 const l=landmarks[36],r=landmarks[45],origin=l.map((x,k)=>(x+r[k])/2),x=unit(sub(r,l));
 // The brow ridge is forward of the eye corners and is not the head's up axis.
 // Eye-to-chin span separates longitudinal direction from brow surface depth.
 const up=sub(origin,landmarks[8]),y=unit(up.map((v,k)=>v-x[k]*dot(up,x))),z=unit(cross(x,y));
 if(dot(sub(landmarks[30],origin),z)<=0)throw Error('Face frame points into head or landmark sides are reversed');
 return{convention:'eye-horizontal/chin-longitudinal/1',origin,x,y,z};
}
export function toLocal(p,f,direction=false){const v=direction?p:sub(p,f.origin);return[f.x,f.y,f.z].map(a=>dot(v,a));}
export function fromLocal(p,f,direction=false){return[0,1,2].map(k=>(direction?0:f.origin[k])+f.x[k]*p[0]+f.y[k]*p[1]+f.z[k]*p[2]);}
export function sourceMap(recipes,bodyCount,n){const map=new Int32Array(n).fill(-1);recipes.forEach(([x,y,t],i)=>{if(x===y&&t===0){if(map[x]>=0&&map[x]!==bodyCount+i)throw Error('Ambiguous exact source mapping');map[x]=bodyCount+i;}});return map;}
export function normalizedLandmarks(g,positions,map){return Array.from({length:68},(_,i)=>{const p=[0,0,0];let sum=0;for(let k=0;k<3;k++){const id=map[g.landmarkIndices[i*3+k]],w=g.landmarkWeights[i*3+k];if(id<0||!Number.isFinite(w)||w<0)throw Error('Missing landmark support');sum+=w;for(let j=0;j<3;j++)p[j]+=positions[id*3+j]*w;}if(sum<1e-8)throw Error('Empty landmark weights');return p.map(x=>x/sum);});}
export function verifySupports(triangles,commonFaces,map,supportT,supportB,count){
 const oriented=new Set();for(let f=0;f<commonFaces.length;f+=3){const[a,b,c]=commonFaces.slice(f,f+3);oriented.add(`${a},${b},${c}`);oriented.add(`${b},${c},${a}`);oriented.add(`${c},${a},${b}`);}
 const usedFaces=new Set(),usedVertices=new Set();for(let q=0;q<count;q++){const t=supportT[q];if(!Number.isInteger(t)||t<0||t*3+2>=triangles.length)throw Error('Invalid support triangle');const ids=Array.from(triangles.slice(t*3,t*3+3));for(const id of ids){if(map[id]<0)throw Error('Missing exact source vertex');usedVertices.add(id);}if(!oriented.has(ids.map(id=>map[id]).join(',')))throw Error('Missing or reversed support triangle');const b=Array.from(supportB.slice(q*3,q*3+3));if(b.some(x=>!Number.isFinite(x)||x< -1e-6||x>1+1e-6)||Math.abs(b.reduce((a,c)=>a+c,0)-1)>1e-5)throw Error('Invalid support barycentrics');usedFaces.add(t);}
 return{usedFaces,usedVertices};
}
