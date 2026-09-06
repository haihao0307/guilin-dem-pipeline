/* Landscape Mother: compact numerical outcrop recipe.
 * Metres; Y up. Geological stage is an uncalibrated sequence, never years.
 * Original implementation. No saved mesh, textures, external code or assets.
 */
'use strict';
const World=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function hash(x,y,z,s=83){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,2147483647)^Math.imul(s,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
function noise(x,y,z,s=83){let X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),u=x-X,v=y-Y,w=z-Z;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);return mix(mix(mix(hash(X,Y,Z,s),hash(X+1,Y,Z,s),u),mix(hash(X,Y+1,Z,s),hash(X+1,Y+1,Z,s),u),v),mix(mix(hash(X,Y,Z+1,s),hash(X+1,Y,Z+1,s),u),mix(hash(X,Y+1,Z+1,s),hash(X+1,Y+1,Z+1,s),u),v),w)}
function fbm(x,y,z,s=83){return noise(x,y,z,s)*.57+noise(2.07*x+3.7,2.07*y-1.1,2.07*z+8.1,s+17)*.28+noise(4.31*x-7.4,4.31*y+4.1,4.31*z+1.3,s+71)*.15}
// Nested cosine basis studied in Macroscopic microscope; new coordinates, weights and use.
// Mathematical basis only, no original ray accumulation or shader copied.
function detail(x,y,z,n=4){let sum=0,a=.5;for(let i=0;i<n;i++){let u=Math.cos(x),v=Math.cos(y),w=Math.cos(z);sum+=a*(Math.cos(w*u+v*v+v*u)-.65);[x,y,z]=[1.97*(.80*x+.60*z)+7.2,2.03*y-2.4,2.01*(-.60*x+.80*z)+3.1];a*=.42}return sum}
const len=(a)=>Math.hypot(...a), norm=a=>{let l=len(a)||1;return a.map(v=>v/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const SUN=norm([-0.62,0.78,0.40]);
const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'brick-limestone-1',seed:83,stage:4,fracture:1,relief:1});
function validate(c){if(c.schema!==DEFAULT.schema||c.core!==DEFAULT.core)throw Error('配方版本不匹配');if(!Number.isInteger(c.seed)||c.seed<1||c.seed>99999)throw Error('种子超出范围');if(!Number.isInteger(c.stage)||c.stage<0||c.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1.5)throw Error('生成参数无效');return true}
// Shared original rock, composed from oblique convex masses, not a radial tower profile.
const MASSES=[[-8,0,13.5,12.0,48,.075,-.035],[11,1,10.2,10.5,36,-.085,.035],[-19,-5,7.8,9.4,32,.06,-.02],[1,-10,12.2,9.0,43,-.055,.045]];
function envelope(x,y,z){let d=1e6;for(const b of MASSES){let X=x-b[0]-b[5]*y,Z=z-b[1]-b[6]*y;let cap=smooth(b[4]*.64,b[4]+1,y);let wx=b[2]*(1-.36*cap),wz=b[3]*(1-.31*cap);let u=Math.abs(X),v=Math.abs(Z);let m=Math.max(u-wx,v-wz,(u*.78+v*.63)-(wx*.78+wz*.63)*.77,y-b[4]+.72*Math.abs(X+.28*Z)+.39*Math.abs(Z-.20*X),-5-y);d=Math.min(d,m)}return d}
// Every deep discontinuity has a finite spatial extent and independent width.
function joints(seed){let arr=[];for(let i=0;i<16;i++){let face=i%4,ang=face*Math.PI/2+.15*(hash(i,7,1,seed)-.5),c=Math.cos(ang),s=Math.sin(ang),u=(hash(i,4,0,seed)-.5)*43,y=6+hash(i,9,0,seed)*32;arr.push({cx:c*u-s*11,cz:s*u+c*11,cy:y,tx:c,tz:s,tilt:(hash(i,3,1,seed)-.5)*.32,width:.20+hash(i,2,1,seed)**2*.95,length:8+hash(i,1,1,seed)*17,depth:2.2+hash(i,0,1,seed)*5.5,phase:hash(i,3,3,seed)*6.28,turn:(hash(i,18,3,seed)-.5)*.70,bend:hash(i,23,4,seed)*1.1-.55,wseed:seed+201+i*19})}return arr}
const EVENTS=[{id:1,name:'前壁楔块',center:[7,14,10],half:[5.0,5.8,5.6],angle:.22,dest:[23,0,19],yaw:.70}, {id:2,name:'侧壁厚片',center:[-22,12,1],half:[4.7,4.8,5.1],angle:-.32,dest:[-31,0,14],yaw:-.5}, {id:3,name:'后壁崩口',center:[-1,19,-17],half:[5.5,5.0,4.7],angle:.18,dest:[9,0,-27],yaw:1.4}];
function cut(e,x,y,z){let X=x-e.center[0],Y=y-e.center[1],Z=z-e.center[2],c=Math.cos(e.angle),s=Math.sin(e.angle),u=c*X+s*Y,v=-s*X+c*Y;return Math.max(Math.abs(u)-e.half[0],Math.abs(v)-e.half[1],Math.abs(Z)-e.half[2],(.8*u+.32*v+.65*Z)-e.half[0]*.99,(-.62*u-.22*v-.73*Z)-e.half[0]*1.06,(.50*u+.7*v-.4*Z)-e.half[0]*1.14,(-.63*u+.55*v+.3*Z)-e.half[0]*1.05)}
function create(config){validate(config);const c={...config},J=joints(c.seed),stage=c.stage,er=smooth(0,3,stage),jointFactor=(stage?(.22+er*.78):0)*c.fracture;
 function rockBeforeDetach(x,y,z){let d=envelope(x,y,z);if(d>5||y< -5.6)return d;
  let big=(fbm(x*.091,y*.13,z*.107,c.seed)-.5)*4.5;
  let crag=1.1*detail(x*.44+3,y*.49,z*.48+7,4);
  d+=big+crag;
  if(stage>0){let strat=y+x*.14+z*.21+1.3*noise(x*.12,y*.047,z*.14,c.seed+72);let cell=Math.floor(strat/4.7),line=(cell+.22+.53*hash(cell,7,3,c.seed+78))*4.7;let seam=Math.exp(-(((strat-line)/(.18+.23*hash(cell,2,8,c.seed+48)))**2));d+=seam*(.08+.48*smooth(.38,.72,noise(x*.29,y*.14,z*.30,c.seed+18)))*er;}
  if(stage===0)return d;
  // Finite-width deep clefts, not colour lines. Tilt and depth are independently bounded.
  for(const j of J){let protect=smooth(3,9,y)*(1-smooth(29,39,y)),ang=j.turn*protect,ca=Math.cos(ang),sa=Math.sin(ang),tx=j.tx*ca-j.tz*sa,tz=j.tx*sa+j.tz*ca;
   let U=(x-j.cx)*tx+(z-j.cz)*tz+j.tilt*(y-j.cy),V=-(x-j.cx)*tz+(z-j.cz)*tx,Y=y-j.cy;
   const legacy=.26*Math.sin(y*.25+j.phase)+.18*Math.sin(V*.5+j.phase);
   const wander=(noise(y*.081,j.phase,V*.083,j.wseed)-.5)*1.15+j.bend*Y*.035;
   let warped=U+mix(legacy,wander,protect),taper=1-smooth(j.length*.66,j.length,Math.abs(Y));
   let variation=.30+.70*noise(y*.16+3,V*.11,j.phase,j.wseed+7),oldWidth=.72+.28*Math.sin(y*.19+j.phase)**2;
   let width=j.width*jointFactor*mix(oldWidth,variation*(.48+.52*taper),protect);
   let depth=j.depth*mix(1,.55+.45*taper,protect);let slit=Math.max(Math.abs(warped)-width,Math.abs(Y)-j.length,-V-depth,V-7);d=Math.max(d,-slit)}
  if(stage>=2){
   // Spatially varied runnel proxy, with slowly warped down-wall organisation.
   let f1=noise(x*.41+noise(x*.047,y*.052,z*.047,c.seed+91)*1.6,y*.065,z*.44,c.seed+101),f2=noise(x*.9,y*.12,z*.94,c.seed+117);
   let groove=smooth(.57,.80,f1)*(.35+.75*smooth(.34,.7,f2));
   let runoffProxy=smooth(1,12,y)*(1-smooth(40,52,y));
   d+=er*c.relief*(1.35*groove*runoffProxy+.48*detail(x*1.3,y*.59,z*1.21,4)+.10);
   // A subsurface dissolution cavity, roof and undercut represented volumetrically.
   let a=(x+6)/6.8,b=(y-5.4)/4.7,q=(z-8.8)/9.0;
   let cave=(Math.sqrt(a*a+b*b+q*q)-1)*4.7+.22*noise(x*.38,y*.43,z*.38,c.seed+53);
   d=Math.max(d,-cave);
   let notch=Math.sqrt(((x-12)/10)**2+((y-7)/3.7)**2+((z-8)/8)**2)-1;
   d=Math.max(d,-notch*3.7);
  }
  return d;
 }
 function rock(x,y,z){let d=rockBeforeDetach(x,y,z);if(stage>=3)for(const e of EVENTS)d=Math.max(d,-cut(e,x,y,z));return d}
 function sourceFragment(e,x,y,z){return Math.max(rockBeforeDetach(x,y,z),cut(e,x,y,z))}
 function groundBed(x,z){return -2.3+.36*Math.sin(x*.09+z*.04)+.28*Math.cos(z*.13-x*.03)+.5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)}
 function soilComponents(x,z){let n=noise(x*.074,2,z*.074,c.seed+41),foot=Math.exp(-(((Math.hypot(x*.82,z)-19)/7.6)**2))*(1.4+.7*noise(x*.13,0,z*.13,c.seed+52)),accumulation=0;
  if(stage>=3)for(const e of EVENTS){let r=((x-e.dest[0])/6.3)**2+((z-e.dest[2])/6.3)**2;accumulation+=Math.exp(-r)*1.4}
  const cover=stage===4?1:stage===3?.62:stage===2?.28:.11;
  return {residualMineralM:cover*(.18+.32*n),externalFineM:cover*(.14+.58*n+foot*.65),colluvialM:cover*(foot*.35+accumulation),organicMixM:.20+(stage===4?.10*noise(x*.17,1,z*.17,c.seed+607):0)};
 }
 function soilThickness(x,z){const s=soilComponents(x,z);return s.residualMineralM+s.externalFineM+s.colluvialM+s.organicMixM}
 function ground(x,z){return groundBed(x,z)+soilThickness(x,z)}
 function perimeter(x,z){return Math.sqrt((x/52)**2+(z/43)**2)-1+.025*Math.sin(x*.13+z*.17)+.022*Math.cos(z*.2-x*.1)}
 return {config:c,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events:EVENTS};
}
function mesh(field,lo,hi,step,progress){const nx=Math.ceil((hi[0]-lo[0])/step)+1,ny=Math.ceil((hi[1]-lo[1])/step)+1,nz=Math.ceil((hi[2]-lo[2])/step)+1,NT=nx*ny*nz;if(NT>7500000)throw Error('固定网格预算超出');const sy=nx,sz=nx*ny,values=new Float32Array(NT);
 let id=0;for(let k=0;k<nz;k++){for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)values[id++]=field(lo[0]+i*step,lo[1]+j*step,lo[2]+k*step);if(progress&&k%20===0)progress(k/nz*.5)}
 const pos=[],ind=[],edges=new Map(),tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],offs=[0,1,1+sy,sy,sz,1+sz,1+sy+sz,sy+sz];
 function coords(a){let k=Math.floor(a/sz),j=Math.floor((a-k*sz)/sy),i=a-k*sz-j*sy;return [lo[0]+i*step,lo[1]+j*step,lo[2]+k*step]}
 function edge(a,b){if(a>b)[a,b]=[b,a];let key=a*NT+b,n=edges.get(key);if(n!==undefined)return n;let A=coords(a),B=coords(b),t=values[a]/(values[a]-values[b]);if(t<1e-4||t>1-1e-4){let v=t<.5?a:b;key=-v-1;t=t<.5?0:1;n=edges.get(key);if(n!==undefined)return n;}n=pos.length/3;pos.push(mix(A[0],B[0],t),mix(A[1],B[1],t),mix(A[2],B[2],t));edges.set(key,n);return n}
 function tri(a,b,c,inside,outside){let A=a*3,B=b*3,C=c*3,ux=pos[B]-pos[A],uy=pos[B+1]-pos[A+1],uz=pos[B+2]-pos[A+2],vx=pos[C]-pos[A],vy=pos[C+1]-pos[A+1],vz=pos[C+2]-pos[A+2],N=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];if(a===b||b===c||a===c)return;let I=coords(inside),O=coords(outside);if(N[0]*(O[0]-I[0])+N[1]*(O[1]-I[1])+N[2]*(O[2]-I[2])<0)ind.push(a,c,b);else ind.push(a,b,c)}
 for(let k=0;k<nz-1;k++){for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){let base=i+j*sy+k*sz;let vs=offs.map(o=>base+o),neg=0;for(let a of vs)neg+=values[a]<0;if(neg===0||neg===8)continue;for(let tet of tets){let inside=[],outside=[];for(let v of tet)(values[vs[v]]<0?inside:outside).push(vs[v]);if(!inside.length||!outside.length)continue;if(inside.length===1){let a=inside[0];tri(edge(a,outside[0]),edge(a,outside[1]),edge(a,outside[2]),a,outside[0])}else if(inside.length===3){let a=outside[0];tri(edge(a,inside[0]),edge(a,inside[1]),edge(a,inside[2]),inside[0],a)}else {let[a,b]=inside,[c,d]=outside,ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);tri(ac,bc,ad,a,c);tri(ad,bc,bd,a,c)}}}if(progress&&k%20===0)progress(.5+k/nz*.5)}
 function at(x,y,z){let fx=(x-lo[0])/step,fy=(y-lo[1])/step,fz=(z-lo[2])/step,i=Math.floor(fx),j=Math.floor(fy),k=Math.floor(fz);if(i<0||j<0||k<0||i>=nx-1||j>=ny-1||k>=nz-1)return 99;let a=i+j*sy+k*sz,u=fx-i,v=fy-j,w=fz-k;return mix(mix(mix(values[a],values[a+1],u),mix(values[a+sy],values[a+sy+1],u),v),mix(mix(values[a+sz],values[a+sz+1],u),mix(values[a+sz+sy],values[a+sz+sy+1],u),v),w)}
 return {positions:Float32Array.from(pos),indices:Uint32Array.from(ind),grid:{at,values,nx,ny,nz,lo,step},bounds:[lo,hi]};
}
function normals(p,I){const N=new Float32Array(p.length);for(let i=0;i<I.length;i+=3){let a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3,u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(let j of[a,b,c])for(let a=0;a<3;a++)N[j+a]+=n[a]}
 for(let i=0;i<N.length;i+=3){let l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}return N}
function volume(m){let v=0,p=m.positions,I=m.indices;for(let i=0;i<I.length;i+=3){let a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3;v+=(p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6}return v}
function checksum(arr){let x=2166136261,b=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);for(let i=0;i<b.length;i++)x=Math.imul(x^b[i],16777619);return (x>>>0).toString(16).padStart(8,'0')}
function splitComponents(m){const I=m.indices,P=m.positions,n=P.length/3,par=Int32Array.from({length:n},(_,i)=>i);function root(a){while(par[a]!==a){par[a]=par[par[a]];a=par[a]}return a}function unite(a,b){a=root(a);b=root(b);if(a!==b)par[Math.max(a,b)]=Math.min(a,b)}for(let i=0;i<I.length;i+=3){unite(I[i],I[i+1]);unite(I[i],I[i+2])}let groups=new Map();for(let i=0;i<I.length;i+=3){let r=root(I[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(I[i],I[i+1],I[i+2])}let arrays=[...groups.values()].sort((a,b)=>b.length-a.length);if(arrays.length===1)return [m];return arrays.map((f,j)=>{let map=new Map(),p=[],ix=[];for(let a of f){let b=map.get(a);if(b===undefined){b=p.length/3;map.set(a,b);p.push(P[a*3],P[a*3+1],P[a*3+2])}ix.push(b)}return{positions:Float32Array.from(p),indices:Uint32Array.from(ix),grid:m.grid}})}
return {splitComponents,DEFAULT,validate,create,mesh,normals,volume,checksum,noise,fbm,detail,clamp,smooth,mix,norm,SUN,EVENTS,cut,envelope};
})();
if(typeof module!=='undefined')module.exports=World;
