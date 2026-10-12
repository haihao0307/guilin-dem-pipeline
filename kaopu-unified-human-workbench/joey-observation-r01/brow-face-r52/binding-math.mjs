const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);if(!Number.isFinite(d)||d<1e-8)throw Error('Degenerate face frame');return a.map(x=>x/d)};
export function faceFrame(landmarks){
 const l=landmarks[36],r=landmarks[45],origin=l.map((x,k)=>(x+r[k])/2),x=unit(sub(r,l));
 const brow=[0,1,2].map(k=>landmarks.slice(17,27).reduce((s,p)=>s+p[k],0)/10),up=sub(brow,origin),y=unit(up.map((v,k)=>v-x[k]*dot(up,x))),z=unit(cross(x,y));
 if(dot(sub(landmarks[30],origin),z)<=0)throw Error('Face frame points into head or landmark sides are reversed');
 return{origin,x,y,z};
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
