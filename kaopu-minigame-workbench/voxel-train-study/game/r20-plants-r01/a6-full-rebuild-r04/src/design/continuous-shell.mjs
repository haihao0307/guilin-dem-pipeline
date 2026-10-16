/** Single C2 longitudinal B-spline section field. No hard-clamped interpolant.
 * Glass and paint are material groups on ONE indexed shell mesh with shared normals.
 * Transverse cubic Bezier shoulders are tangent continuous; all values are proposals.
 */
export const CONTROL_SECTIONS=Object.freeze([
 [-1.40,.001,.819,.821,.820],[-1.32,.28,.62,1.02,.80],[-.65,.62,.64,1.58,1.08],[.60,1.02,.66,2.08,1.53],
 [2.10,1.31,.68,2.50,1.99],[3.40,1.44,.68,3.02,2.44],
 [4.75,1.475,.68,4.02,2.65],[6.00,1.475,.68,4.10,2.67],
 [7.80,1.475,.68,4.10,2.67],[9.60,1.475,.68,4.03,2.65],
 [11.60,1.475,.68,3.94,2.63],[13.0,1.475,.68,3.91,2.62],
 [18.40,1.475,.68,3.91,2.62],[20.10,1.475,.68,3.91,2.62],
 [20.32,1.475,.68,3.91,2.62],[25.80,1.475,.68,3.91,2.62],
 [27.40,1.475,.68,3.93,2.64],[28.30,1.45,.68,3.96,2.66]
]);
const clamp=x=>Math.max(0,Math.min(1,x));
export const ease5=x=>{x=clamp(x);return x*x*x*(x*(6*x-15)+10)};
const n=CONTROL_SECTIONS.length-1,p=3;
const knots=Array.from({length:n+p+2},(_,i)=>i<=p?0:i>=n+1?1:(i-p)/(n-p+1));
function deBoor(t){let k=p;while(k<n&&t>=knots[k+1])k++;const d=Array.from({length:p+1},(_,j)=>CONTROL_SECTIONS[k-p+j].slice());for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){const i=k-p+j,a=(t-knots[i])/(knots[i+p-r+1]-knots[i]||1);for(let c=0;c<d[j].length;c++)d[j][c]=(1-a)*d[j-1][c]+a*d[j][c];}return d[p]}
const sectionCache=new Map();
export function sectionAt(x){if(sectionCache.has(x))return sectionCache.get(x);let lo=0,hi=1;for(let j=0;j<44;j++){const t=(lo+hi)/2;if(deBoor(t)[0]<x)lo=t;else hi=t;}const v=deBoor((lo+hi)/2).slice(1);sectionCache.set(x,v);return v}
const bez=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t*t*t*d;
export function sectionPoint(section,t){const[w,low,high,shoulder]=section;if(t<=.5){const u=t*2;return[bez(0,w*.52,w,w,u),bez(high,high,shoulder+(high-shoulder)*.26,shoulder,u)]}const u=(t-.5)*2;return[bez(w,w,w*.98,w*.88,u),bez(shoulder,shoulder-(shoulder-low)*.65,low,low,u)]}
export function tAtZ(section,z){if(z>=section[2])return 0;if(z<=section[1])return 1;let a=0,b=1;for(let j=0;j<38;j++){const m=(a+b)/2;if(sectionPoint(section,m)[1]>z)a=m;else b=m;}return(a+b)/2}
export function halfAt(x,z){return sectionPoint(sectionAt(x),tAtZ(sectionAt(x),z))[0]}
export function shellPoint(x,t,side=1){const[y,z]=sectionPoint(sectionAt(x),t);return[x,side*y,z]}
export function shellNormal(T,x,t,side=1){const e=.00008,a=new T.Vector3(...shellPoint(Math.max(-1.4,x-e),t,side)),b=new T.Vector3(...shellPoint(Math.min(28.30,x+e),t,side)),c=new T.Vector3(...shellPoint(x,Math.max(0,t-e),side)),d=new T.Vector3(...shellPoint(x,Math.min(1,t+e),side));const normal=b.sub(a).cross(d.sub(c)).normalize();if(side<0)normal.negate();return normal}
export function cutAt(x,r=1.016){const low=sectionAt(x)[1],cut=2*r+.105;return low+(cut-low)*ease5((x-7.98)/.52)*(1-ease5((x-17.55)/.65))}
export function stripeAt(x){return .86+1.43*ease5((x+1.4)/5.9)-.70*ease5((x-17.3)/3.8)-.12*ease5((x-25.2)/3.1)}
export function createContinuousShell(T,D,materials){
 const xs=new Set([D.noseX,D.cabStart,D.cabEnd,D.locoEnd,D.tenderStart,D.tenderEnd]);for(let i=0;i<=560;i++)xs.add(D.noseX+(D.tenderEnd-D.noseX)*i/560);const rows=[...xs].sort((a,b)=>a-b),N=96,positions=[],normals=[],uv=[],paint=[],glass=[];
 for(const x of rows){const sec=sectionAt(x),sill=Math.min(D.cabGlassSill,sec[2]-.002),ts=tAtZ(sec,sill),tc=tAtZ(sec,cutAt(x,D.driverRadius));for(let j=-N;j<=N;j++){const a=Math.abs(j),t=a<=64?ts*a/64:ts+(tc-ts)*(a-64)/32,side=j<0?-1:1;positions.push(...shellPoint(x,t,side));const normal=j===0?new T.Vector3(-((sectionAt(Math.min(28.30,x+.0001))[2]-sectionAt(Math.max(D.noseX,x-.0001))[2])/(Math.min(28.30,x+.0001)-Math.max(D.noseX,x-.0001))),0,1).normalize():shellNormal(T,x,t,side);normals.push(...normal.toArray());uv.push(x/28.30,(j+N)/(2*N));}}
 const rowSize=N*2+1;for(let i=0;i<rows.length-1;i++){if(rows[i]>=D.locoEnd-1e-9&&rows[i+1]<=D.tenderStart+1e-9)continue;const xc=(rows[i]+rows[i+1])/2;for(let j=0;j<rowSize-1;j++){const a=i*rowSize+j,b=a+rowSize,isGlass=xc>=D.cabStart&&xc<=D.cabEnd&&j>=N-64&&j<N+64,dst=isGlass?glass:paint;dst.push(a,b,a+1,b,b+1,a+1)}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex([...paint,...glass]);geometry.addGroup(0,paint.length,0);geometry.addGroup(paint.length,glass.length,1);geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,[materials.paint,materials.glass]);mesh.name='continuous one-mesh C2 shoulder shell / shared glass-paint vertices';mesh.userData={singleIndexedExterior:true,noNormalRecomputeAtMaterialBoundary:true,longitudinalBasis:'clamped cubic B-spline C2',transverseBasis:'tangent continuous cubic Bezier quarters',externalRivets:0,sharedGlassPaintNormals:true,rows:rows.length,rowSize};return{mesh,rows,rowSize,paintIndices:paint.length,glassIndices:glass.length};
}
