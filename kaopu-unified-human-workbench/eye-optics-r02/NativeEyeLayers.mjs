/** Original KAOPU code. Recovers the two retained GNM eye surfaces from topology.
 * Source semantics: xrblocks/assets-gnm 134feb02, export_gnm_web.py:275-288.
 * No selection by camera, index range, new vertices, or material ID alone.
 */
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const d=Math.hypot(...a);if(d<1e-12)throw Error('Degenerate eye frame');return a.map(x=>x/d);};
export function connectedComponents(vertices,triangles){
 const graph=new Map(vertices.map(i=>[i,new Set()]));for(const t of triangles){if(t.some(i=>!graph.has(i)))throw Error('Eye triangle crosses fixed membership');for(const i of t)for(const j of t)if(i!==j)graph.get(i).add(j);}
 const seen=new Set(),groups=[];for(const v of vertices)if(!seen.has(v)){const queue=[v];seen.add(v);for(let k=0;k<queue.length;k++)for(const j of graph.get(queue[k]))if(!seen.has(j)){seen.add(j);queue.push(j);}groups.push(queue);}
 return groups;
}
export function recoverNativeEyeLayers(model){
 if(!model.eyeSurface?.eyes)throw Error('Existing native eye binding required');const c=model.canonical,g=model.gnm,B=model.bodyCount,layers=new Float32Array(model.vertexCount),eyes=[];
 for(const eye of model.eyeSurface.eyes){const groups=connectedComponents(eye.vertices,eye.triangles);if(groups.length!==2)throw Error('Expected exactly two native connected eye surfaces, got '+groups.length);
  const centerZ=vertices=>{const pupil=vertices.filter(i=>{const[a,b,t]=c.gnmRecipes[i-B];return g.materialId[t>.5?b:a]===6;});if(!pupil.length)throw Error('No source pupil label on retained surface');return pupil.reduce((s,i)=>{const[a,b,t]=c.gnmRecipes[i-B];return s+(g.template[a*3+2]*(1-t)+g.template[b*3+2]*t);},0)/pupil.length;};
  const sorted=groups.map(vertices=>({vertices,sourceCenterZ:centerZ(vertices)})).sort((a,b)=>a.sourceCenterZ-b.sourceCenterZ);const[interior,exterior]=sorted;if(exterior.sourceCenterZ-interior.sourceCenterZ<.0005)throw Error('Ambiguous interior/exterior orientation');
  for(const i of interior.vertices)layers[i]=1;for(const i of exterior.vertices)layers[i]=2;eyes.push({side:eye.side,interior:interior.vertices,exterior:exterior.vertices,sourceGapMM:(exterior.sourceCenterZ-interior.sourceCenterZ)*1000});
 }return{layers,eyes,method:'fixed triangle connectivity; source-space pupil-depth ordering; validated against official eye_exteriors semantics'};
}
function solve(A,b){const n=b.length,m=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;[m[i],m[p]]=[m[p],m[i]];if(Math.abs(m[i][i])<1e-14)throw Error('Singular native iris fit');const d=m[i][i];for(let j=i;j<=n;j++)m[i][j]/=d;for(let k=0;k<n;k++)if(k!==i){const f=m[k][i];for(let j=i;j<=n;j++)m[k][j]-=f*m[i][j];}}return m.map(r=>r[n]);}
/** Fits actual retained aperture support vertices (iris/pupil and narrow sclera transition ring) to a quadratic chart in fEye coordinates.
 * Does not modify the geometry. Residual quantifies the approximation.
 * Input/output positions are metres; q coordinates are the unchanged native fEye.
 */
export function fitNativeIris(vertices,position,fEye){
 const samples=vertices.filter(i=>fEye[i*4+2]>.5&&Math.hypot(fEye[i*4],fEye[i*4+1])<=1.05).map(i=>({q:[fEye[i*4],fEye[i*4+1]],p:Array.from(position.slice(i*3,i*3+3))}));if(samples.length<20)throw Error('Too few native iris samples');
 const rows=samples.map(({q:[x,y]})=>[1,x,y,x*x,x*y,y*y]),A=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)));
 const coeff=[0,1,2].map(k=>solve(A,Array.from({length:6},(_,j)=>rows.reduce((s,r,i)=>s+r[j]*samples[i].p[k],0))));
 const O=coeff.map(c=>c[0]),X=coeff.map(c=>c[1]),Y=coeff.map(c=>c[2]);let Z=unit(cross(X,Y));
 // fEye has native +X,+Y chart; display eye fronts point along this cross product.
 const xx=dot(X,X),xy=dot(X,Y),yy=dot(Y,Y),det=xx*yy-xy*xy;if(det<1e-14)throw Error('Collapsed iris metric');
 const U=X.map((x,i)=>(yy*x-xy*Y[i])/det),V=Y.map((y,i)=>(xx*y-xy*X[i])/det),H=[3,4,5].map(j=>dot(coeff.map(c=>c[j]),Z));
 let sq=0,maxResidual=0;for(const{q:[x,y],p}of samples){const h=H[0]*x*x+H[1]*x*y+H[2]*y*y,pred=O.map((o,k)=>o+X[k]*x+Y[k]*y+Z[k]*h);const err=dot(sub(p,pred),sub(p,pred));sq+=err;maxResidual=Math.max(maxResidual,Math.sqrt(err));}
 return{O,X,Y,Z,U,V,H,samples:samples.length,rmsMicrometres:Math.sqrt(sq/samples.length)*1e6,maxResidualMicrometres:maxResidual*1e6,irisRadiusMM:[Math.hypot(...X)*1000,Math.hypot(...Y)*1000]};
}
export function intersectIris(origin,direction,fit){const p=sub(origin,fit.O),q=[dot(p,fit.U),dot(p,fit.V)],d=[dot(direction,fit.U),dot(direction,fit.V)],z=dot(p,fit.Z),dz=dot(direction,fit.Z),[a,b,c]=fit.H;
 const A=-(a*d[0]*d[0]+b*d[0]*d[1]+c*d[1]*d[1]),B=dz-2*a*q[0]*d[0]-b*(q[0]*d[1]+q[1]*d[0])-2*c*q[1]*d[1],C=z-a*q[0]*q[0]-b*q[0]*q[1]-c*q[1]*q[1];let ts=[];
 if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)ts=[-C/B];}else{const D=B*B-4*A*C;if(D>=0){const s=Math.sqrt(D),q=-.5*(B+(B>=0?s:-s));ts=[q/A,Math.abs(q)>1e-15?C/q:-1];}}const positive=ts.filter(t=>t>1e-7);if(!positive.length)return null;const t=Math.min(...positive);return{t,q:q.map((v,i)=>v+d[i]*t)};
}
