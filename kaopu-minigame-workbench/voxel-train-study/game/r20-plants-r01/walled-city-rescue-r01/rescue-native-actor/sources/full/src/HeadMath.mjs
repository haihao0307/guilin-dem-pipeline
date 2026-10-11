import{specialProcrustes}from'../source/kaopu-anny-workbench/r02/src/AnnyModel.js';
export const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export const point=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];
export const vector=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2],m[4]*p[0]+m[5]*p[1]+m[6]*p[2],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]];
export const xyz=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
export function multiply(a,b){const o=Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[i*4+j]+=a[i*4+k]*b[k*4+j];return o;}
export function inverse3(a){const[x,y,z,u,v,w,p,q,r]=a,d=x*(v*r-w*q)-y*(u*r-w*p)+z*(u*q-v*p);if(Math.abs(d)<1e-30)throw Error('Degenerate component covariance');return[(v*r-w*q)/d,(z*q-y*r)/d,(y*w-z*v)/d,(w*p-u*r)/d,(x*r-z*p)/d,(z*u-x*w)/d,(u*q-v*p)/d,(y*p-x*q)/d,(x*v-y*u)/d];}
/** Exact least-squares source component fit. No invented per-channel angles. */
export function componentFit(from,to,ids,{affine=false,scale=false}={}){
 const ca=[0,0,0],cb=[0,0,0];let same=true;for(const i of ids)for(let c=0;c<3;c++){ca[c]+=from[i*3+c]/ids.length;cb[c]+=to[i*3+c]/ids.length;if(from[i*3+c]!==to[i*3+c])same=false;}if(same)return{matrix:identity(),maxResidual:0,scale:1};
 const cov=Array(9).fill(0),normal=Array(9).fill(0);let denominator=0;for(const i of ids){const a=xyz(from,i).map((v,c)=>v-ca[c]),b=xyz(to,i).map((v,c)=>v-cb[c]);for(let r=0;r<3;r++)for(let c=0;c<3;c++){cov[r*3+c]+=b[r]*a[c];normal[r*3+c]+=a[r]*a[c];}denominator+=a.reduce((s,x)=>s+x*x,0);}
 let rot;if(affine){const inv=inverse3(normal);rot=Array(9).fill(0);for(let r=0;r<3;r++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)rot[r*3+c]+=cov[r*3+k]*inv[k*3+c];}else rot=Array.from(specialProcrustes(cov));
 let k=1;if(scale&&!affine){let numerator=0;for(const i of ids){const a=xyz(from,i).map((v,c)=>v-ca[c]),b=xyz(to,i).map((v,c)=>v-cb[c]);for(let r=0;r<3;r++)numerator+=b[r]*rot.slice(r*3,r*3+3).reduce((s,v,c)=>s+v*a[c],0);}k=numerator/denominator;rot=rot.map(v=>v*k);}
 const t=cb.map((v,r)=>v-rot.slice(r*3,r*3+3).reduce((s,x,c)=>s+x*ca[c],0)),matrix=[...rot.slice(0,3),t[0],...rot.slice(3,6),t[1],...rot.slice(6,9),t[2],0,0,0,1];let maxResidual=0;for(const i of ids){const q=point(matrix,xyz(from,i)),b=xyz(to,i);maxResidual=Math.max(maxResidual,Math.hypot(...q.map((x,c)=>x-b[c])));}return{matrix,maxResidual,scale:k};
}
export function sample(vertices,indices,bary,row){const out=[0,0,0];for(let k=0;k<3;k++)for(let c=0;c<3;c++)out[c]+=vertices[indices[row*3+k]*3+c]*bary[row*3+k];return out;}
export function nativeRotationToCommon(r,o=0){const C=[1,0,0,0,0,-1,0,1,0],inv=[1,0,0,0,0,1,0,-1,0],out=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)out[i*3+j]+=C[i*3+a]*r[o+a*3+b]*inv[b*3+j];return out;}
export function skinGNMRest(model,rest,joints,translationScale){
 const g=model.gnm,rot=Array.from({length:4},(_,j)=>nativeRotationToCommon(g._rotWorld,j*9)),posed=[],t=[g.translation[0]*translationScale,-g.translation[2]*translationScale,g.translation[1]*translationScale];
 for(let j=0;j<4;j++){const parent=g.jointParents[j],p=xyz(joints,j);if(parent<0)posed[j]=p.map((x,c)=>x+t[c]);else{const delta=p.map((x,c)=>x-joints[parent*3+c]),r=rot[parent];posed[j]=[0,1,2].map(c=>posed[parent][c]+r.slice(c*3,c*3+3).reduce((s,v,k)=>s+v*delta[k],0));}}
 const out=new Float32Array(rest.length);for(let i=0;i<g.numVertices;i++){const p=xyz(rest,i),q=[0,0,0];for(let j=0;j<4;j++){const w=g.skinningWeights[j*g.numVertices+i];if(!w)continue;const d=p.map((v,c)=>v-joints[j*3+c]);for(let c=0;c<3;c++)q[c]+=w*(posed[j][c]+rot[j].slice(c*3,c*3+3).reduce((s,v,k)=>s+v*d[k],0));}out.set(q,i*3);}
 const r=rot[0],p=xyz(joints,0),tr=posed[0].map((v,i)=>v-r.slice(i*3,i*3+3).reduce((s,x,c)=>s+x*p[c],0));return{vertices:out,jointsPosed:posed,rootMatrix:[...r.slice(0,3),tr[0],...r.slice(3,6),tr[1],...r.slice(6,9),tr[2],0,0,0,1]};
}
