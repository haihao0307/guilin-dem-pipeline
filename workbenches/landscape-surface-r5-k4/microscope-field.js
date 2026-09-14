/* Yohei-readable coordinate/subexpression study, plus explicitly authored bounded rock application.
   No claim to reproduce the full ray marcher or geological erosion. */
const MicroscopeField=(()=>{
const CENTER=[-8,25.80121421813965,11.301214218139648],DIR=[-.02210804,.40288767,.91498238],RADIUS=7;
function domain(p){let x=(p[0]-CENTER[0])/2,y=(p[1]-CENTER[1])/2,z=(p[2]-CENTER[2])/2;
 // One position-dependent rotation; not two redundant fixed rotations.
 const angle=.24*Math.sin(.47*x+.29*y-.33*z),c=Math.cos(angle),s=Math.sin(angle),xx=c*x+s*z,zz=-s*x+c*z;
 const q=[xx+3.7,y+4.1,zz+5.3],r=Math.hypot(...q);
 return [Math.log2(r)-2,-q[2]/r-1,Math.atan2(q[0],q[1])];
}
function term(p,j){const f=2**j,u=Math.cos(p[0]*f),v=Math.cos(p[1]*f),w=Math.cos(p[2]*f);return Math.cos(w*u+v*v+v*u)/f;}
function prefix(q,n){let s=0;for(let j=0;j<n;j++)s+=term(q,j);return s;}
function mask(p){const r2=p.reduce((s,x,j)=>s+(x-CENTER[j])**2,0)/(RADIUS*RADIUS);return Math.max(0,1-r2)**3;}
function low(q){let a=0;for(let j=2;j<6;j++)a+=term(q,j);return a;}
function height(p){const m=mask(p);if(!m)return 0;return .45*m*Math.tanh(8*(low(domain(p))-.1171875));}
function deform(part,strength=1){if(!Number.isFinite(strength)||strength<0||strength>1)throw Error('形面强度必须在0—1');const V=part.vertices,I=part.indices,S=part.stride||16,D=V.slice(),count=V.length/S,moved=new Uint8Array(count),touch=new Uint8Array(count);let changed=0,maxDisplacement=0;
 for(let i=0;i<count;i++){const a=i*S,p=[V[a],V[a+1],V[a+2]],h=height(p)*strength;if(h===0)continue;for(let j=0;j<3;j++)D[a+j]=V[a+j]+DIR[j]*h;moved[i]=1;changed++;maxDisplacement=Math.max(maxDisplacement,Math.abs(h));}
 const N=new Float32Array(count*3);let minOrientation=1,minAreaRatio=1,flips=0,changedTriangles=0;
 for(let k=0;k<I.length;k+=3){const ia=I[k],ib=I[k+1],ic=I[k+2],a=ia*S,b=ib*S,c=ic*S;
 const ux=D[b]-D[a],uy=D[b+1]-D[a+1],uz=D[b+2]-D[a+2],vx=D[c]-D[a],vy=D[c+1]-D[a+1],vz=D[c+2]-D[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
 for(const i of [ia,ib,ic]){N[i*3]+=nx;N[i*3+1]+=ny;N[i*3+2]+=nz;}
 if(moved[ia]||moved[ib]||moved[ic]){touch[ia]=touch[ib]=touch[ic]=1;changedTriangles++;let u=[V[b]-V[a],V[b+1]-V[a+1],V[b+2]-V[a+2]],v=[V[c]-V[a],V[c+1]-V[a+1],V[c+2]-V[a+2]],o=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...o),l2=Math.hypot(nx,ny,nz);if(l>1e-10){const orientation=(o[0]*nx+o[1]*ny+o[2]*nz)/(l*l2||1);minOrientation=Math.min(minOrientation,orientation);minAreaRatio=Math.min(minAreaRatio,l2/l);if(!(orientation>.1&&l2/l>.15))flips++;}}
 }
 if(flips)throw Error('显微位移超出三角面安全边界：'+flips);
 for(let i=0;i<count;i++)if(touch[i]){const l=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1;for(let j=0;j<3;j++)D[i*S+3+j]=N[i*3+j]/l;}
 return {vertices:D,report:{changedVertices:changed,changedTriangles,maxDisplacement,minOrientation,minAreaRatio,flippedTriangles:flips,vertexCount:count,triangleCount:I.length/3,indicesChanged:false,radius:RADIUS,center:CENTER,geometryOctaves:[2,3,4,5],declaredOctaves:17,strength,structuralProtection:'compact world region; caves, feet, peak, soil and detached stones outside support'}};
}
return {CENTER,DIR,RADIUS,domain,term,prefix,mask,low,height,deform};})();
if(typeof module!=='undefined')module.exports=MicroscopeField;
