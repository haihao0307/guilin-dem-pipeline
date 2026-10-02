'use strict';
const World=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function hash(x,y,z,s=83){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,2147483647)^Math.imul(s,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
function noise(x,y,z,s=83){let X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),u=x-X,v=y-Y,w=z-Z;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);return mix(mix(mix(hash(X,Y,Z,s),hash(X+1,Y,Z,s),u),mix(hash(X,Y+1,Z,s),hash(X+1,Y+1,Z,s),u),v),mix(mix(hash(X,Y,Z+1,s),hash(X+1,Y,Z+1,s),u),mix(hash(X,Y+1,Z+1,s),hash(X+1,Y+1,Z+1,s),u),v),w)}
function fbm(x,y,z,s=83){return noise(x,y,z,s)*.57+noise(2.07*x+3.7,2.07*y-1.1,2.07*z+8.1,s+17)*.28+noise(4.31*x-7.4,4.31*y+4.1,4.31*z+1.3,s+71)*.15}
function detail(x,y,z,n=4){let sum=0,a=.5;for(let i=0;i<n;i++){let u=Math.cos(x),v=Math.cos(y),w=Math.cos(z);sum+=a*(Math.cos(w*u+v*v+v*u)-.65);[x,y,z]=[1.97*(.80*x+.60*z)+7.2,2.03*y-2.4,2.01*(-.60*x+.80*z)+3.1];a*=.42}return sum}
const len=(a)=>Math.hypot(...a), norm=a=>{let l=len(a)||1;return a.map(v=>v/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const SUN=norm([-0.65,0.74,0.46]);
const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.80});
function validate(c){if(c.schema!==DEFAULT.schema||c.core!==DEFAULT.core)throw Error('配方版本不匹配');if(!Number.isInteger(c.seed)||c.seed<1||c.seed>99999)throw Error('种子超出范围');if(!Number.isInteger(c.stage)||c.stage<0||c.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1.5)throw Error('生成参数无效');if(!Number.isFinite(c.geo)||c.geo<.6||c.geo>2.4)throw Error('真实几何强度越界');if(!Number.isFinite(c.concavity)||c.concavity<.2||c.concavity>1.25)throw Error('溶蚀凹陷偏置越界');if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');if(!Number.isFinite(c.soilMicro)||c.soilMicro<0||c.soilMicro>1.5)throw Error('地面显微起伏越界');return true}
const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25},smax=(a,b,k)=>-smin(-a,-b,k);
const MASSES=[[-8,0,13.5,12.0,48,.075,-.035],[11,1,10.2,10.5,36,-.085,.035],[-19,-5,7.8,9.4,32,.06,-.02],[1,-10,12.2,9.0,43,-.055,.045]];
function makeEnvelope(seed){const masses=MASSES.map((b,i)=>{b=b.slice();if(seed!==83){b[0]+=(hash(i,8,9,seed)-.5)*4.5;b[1]+=(hash(i,4,7,seed)-.5)*3;b[2]*=.87+.26*hash(i,1,3,seed);b[3]*=.89+.22*hash(i,2,3,seed);b[4]*=.88+.24*hash(i,3,3,seed);b[5]+=(hash(i,4,3,seed)-.5)*.13;b[6]+=(hash(i,5,3,seed)-.5)*.10}return b});
const sample=function(x,y,z){let d=1e6;for(const b of masses){let X=x-b[0]-b[5]*y,Z=z-b[1]-b[6]*y,cap=smooth(b[4]*.64,b[4]+1,y),wx=b[2]*(1-.36*cap),wz=b[3]*(1-.31*cap),u=Math.abs(X),v=Math.abs(Z);
const f=[u-wx,v-wz,(u*.78+v*.63)-(wx*.78+wz*.63)*.77,y-b[4]+.72*Math.abs(X+.28*Z)+.39*Math.abs(Z-.20*X),-5-y];let m=f[0];for(let i=1;i<f.length;i++)m=smax(m,f[i],1.35);d=smin(d,m,.92)}return d};const lo=[Infinity,-7,Infinity],hi=[-Infinity,0,-Infinity];for(const b of masses){for(const [axis,center,radius,lean] of[[0,b[0],b[2],b[5]],[2,b[1],b[3],b[6]]]){lo[axis]=Math.min(lo[axis],center+Math.min(-5*lean,b[4]*lean)-radius-6);hi[axis]=Math.max(hi[axis],center+Math.max(-5*lean,b[4]*lean)+radius+6)}hi[1]=Math.max(hi[1],b[4]+4)}sample.bounds=[lo.map(v=>Math.floor(v*2)/2),hi.map(v=>Math.ceil(v*2)/2)];return sample;}
const envelope=makeEnvelope(83);
function joints(seed){let arr=[];for(let i=0;i<19;i++){let ang=i*2.399963+.65*(hash(i,7,1,seed)-.5),c=Math.cos(ang),s=Math.sin(ang),u=(hash(i,4,0,seed)-.5)*39;
arr.push({cx:c*u-s*10,cz:s*u+c*10,cy:8+hash(i,9,0,seed)*28,tx:c,tz:s,tilt:(hash(i,3,1,seed)-.5)*1.05,width:.15+hash(i,2,1,seed)**2*.76,length:7+hash(i,1,1,seed)*16,depth:2.8+hash(i,0,1,seed)*6.3,phase:hash(i,3,3,seed)*8,turn:(hash(i,18,3,seed)-.5)*.85,bend:hash(i,23,4,seed)*1.1-.55,wseed:seed+201+i*19,branch:i%3===0})}return arr}
const EVENTS=[{id:1,name:'前壁楔块',center:[7,14,10],half:[5.0,5.8,5.6],angle:.22,dest:[23,0,19],yaw:.70}, {id:2,name:'侧壁厚片',center:[-22,12,1],half:[4.7,4.8,5.1],angle:-.32,dest:[-31,0,14],yaw:-.5}, {id:3,name:'后壁崩口',center:[-1,19,-17],half:[5.5,5.0,4.7],angle:.18,dest:[9,0,-27],yaw:1.4}];
function cut(e,x,y,z){let X=x-e.center[0],Y=y-e.center[1],Z=z-e.center[2],c=Math.cos(e.angle),s=Math.sin(e.angle),u=c*X+s*Y,v=-s*X+c*Y;
let d=(Math.pow(Math.abs(u/e.half[0])**2.6+Math.abs(v/e.half[1])**2.6+Math.abs(Z/e.half[2])**2.6,1/2.6)-1)*Math.min(...e.half);
const planes=[(.8*u+.32*v+.65*Z)-e.half[0]*.99,(-.62*u-.22*v-.73*Z)-e.half[0]*1.06,(.50*u+.7*v-.4*Z)-e.half[0]*1.14,(-.63*u+.55*v+.3*Z)-e.half[0]*1.05],sg=clamp(e.spikeGuard??.9);for(let p of planes)d=smax(d,p,.72+.66*sg);let lowerCap=-v-e.half[1]*(.84-.16*sg);d=smax(d,lowerCap,.70+.78*sg);
return d+.48*(fbm(x*.41,y*.32,z*.37,e.id+561)-.5)+.22*detail(x*1.03,y*.88,z*.97,3);}
function erosionField(base,seed){const bins=new Map(),cavities=[],segments=[],paths=[],cell=4;
const key=(x,y,z)=>(Math.floor(x/cell)+32)+96*(Math.floor(y/cell)+8)+9216*(Math.floor(z/cell)+32);
function register(item,lo,hi){for(let x=Math.floor(lo[0]/cell);x<=Math.floor(hi[0]/cell);x++)for(let y=Math.floor(lo[1]/cell);y<=Math.floor(hi[1]/cell);y++)for(let z=Math.floor(lo[2]/cell);z<=Math.floor(hi[2]/cell);z++){let k=(x+32)+96*(y+8)+9216*(z+32);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(item)}}
function grad(p){const h=.15;return norm([base(p[0]+h,p[1],p[2])-base(p[0]-h,p[1],p[2]),base(p[0],p[1]+h,p[2])-base(p[0],p[1]-h,p[2]),base(p[0],p[1],p[2]+h)-base(p[0],p[1],p[2]-h)])}
function project(p){p=p.slice();for(let j=0;j<10;j++){let f=base(...p),g=grad(p);if(Math.abs(f)<.025)return p;const h=.15,dp=(base(...p.map((v,k)=>v+h*g[k]))-base(...p.map((v,k)=>v-h*g[k])))/(2*h);if(Math.abs(dp)<.15)return null;const s=clamp(f/dp,-.7,.7);p=p.map((v,k)=>v-s*g[k])}return Math.abs(base(...p))<.18?p:null}
for(let i=0;i<22;i++){let x=-25+hash(i,1,8,seed)*44,z=-15+hash(i,2,9,seed)*28,y=58;for(;y>11;y-=.6)if(base(x,y,z)<0)break;if(y<=11)continue;let p=project([x,y+.2,z]);if(!p)continue;let points=[p];
for(let j=0;j<68&&p[1]>.6;j++){let n=grad(p);if(n[1]<-.28)break;let t=[n[0]*n[1],-1+n[1]*n[1],n[2]*n[1]];if(len(t)<.06)break;t=norm(t);let q=project(p.map((v,k)=>v+t[k]*.78));if(!q||q[1]>=p[1]-.014||len(q.map((v,k)=>v-p[k]))>1.5)break;
let width=.32+.38*smooth(0,45,j)+hash(i,4,2,seed)*.24,depth=.14+.28*smooth(0,35,j),s={type:0,a:p.slice(),b:q.slice(),width,depth,path:i};s.v=q.map((v,k)=>v-p[k]);s.inv=1/dot(s.v,s.v);segments.push(s);let lo=p.map((v,k)=>Math.min(v,q[k])-width*2.8),hi=p.map((v,k)=>Math.max(v,q[k])+width*2.8);register(s,lo,hi);p=q;points.push(q)
}if(points.length>2)paths.push({id:i,points});
}
function cavity(p,U,V,N,r,id,parent,wet){const C=p.map((v,k)=>v-N[k]*r[2]*.18),ext=[0,1,2].map(k=>Math.abs(U[k])*r[0]+Math.abs(V[k])*r[1]+Math.abs(N[k])*r[2]+.6),o={type:1,C,U,V,N,r,id,parent,wet};cavities.push(o);register(o,C.map((v,k)=>v-ext[k]),C.map((v,k)=>v+ext[k]));return o}
for(let i=0;i<38;i++){let p;
if(i<paths.length&&paths[i].points.length>10){let a=paths[i].points;p=a[Math.floor(a.length*(.37+.52*hash(i,2,5,seed)))].slice()}
else{let angle=i*2.399963,ca=Math.cos(angle),sa=Math.sin(angle),y=6+hash(i,4,8,seed)*32;let last=null;for(let r=43;r>0;r-=.7){const q=[-4+ca*r,y,sa*r*.85];if(base(...q)<0){p=project(last||q);break}last=q}}
if(!p||p[1]<2||p[1]>43)continue;let N=grad(p);if(N[1]>.73||N[1]<-.6)continue;let U=norm([N[2],0,-N[0]]),V=norm([N[1]*U[2]-N[2]*U[1],N[2]*U[0]-N[0]*U[2],N[0]*U[1]-N[1]*U[0]]);
let big=i%3===0,r=[big?1.5+hash(i,1,3,seed)*2.3:.6+hash(i,1,3,seed)*1.1,big?1.7+hash(i,2,3,seed)*2.4:.75+hash(i,2,3,seed)*1.2,big?1.2+hash(i,3,3,seed)*2.3:.6+hash(i,3,3,seed)*.9];let parent=cavity(p,U,V,N,r,'P'+i,null,i<paths.length);
if(big)for(let j=0;j<4;j++){let a=j*1.8+hash(i,j,3,seed),u=Math.cos(a)*r[0]*.65,v=Math.sin(a)*r[1]*.6,center=p.map((t,k)=>t+U[k]*u+V[k]*v-N[k]*r[2]*(.3+.26*hash(i,j,6,seed)));cavity(center,U,V,N,[.45+hash(i,j,11,seed)*.75,.5+hash(i,j,12,seed)*.7,.62+hash(i,j,13,seed)*1.15],'P'+i+'-'+j,parent.id,true)}
}
for(let group=0;group<2;group++)for(let j=0;j<13;j++){let C=group?[12,7,8]:[-6,5.4,8.8],r=group?[10,3.7,8]:[6.8,4.7,9],a=3.5+hash(j,3,group,seed)*2.4,b=-.12+hash(j,4,group,seed)*1.14,p=[C[0]+r[0]*Math.cos(a)*Math.cos(b),C[1]+r[1]*Math.sin(b),C[2]+r[2]*Math.sin(a)*Math.cos(b)],N=norm([(C[0]-p[0])/(r[0]*r[0]),(C[1]-p[1])/(r[1]*r[1]),(C[2]-p[2])/(r[2]*r[2])]),U=norm([N[2],0,-N[0]]),V=norm([N[1]*U[2]-N[2]*U[1],N[2]*U[0]-N[0]*U[2],N[0]*U[1]-N[1]*U[0]]);
cavity(p,U,V,N,[.5+hash(j,5,group,seed)*.9,.6+hash(j,6,group,seed)*1.0,.9+hash(j,7,group,seed)*1.3],'C'+group+'-'+j,'CAVE'+group,true);
}
function sample(x,y,z){const list=bins.get(key(x,y,z));let hollow=99,channel=0;if(list)for(const o of list){if(o.type===0){let dx=x-o.a[0],dy=y-o.a[1],dz=z-o.a[2],t=clamp((dx*o.v[0]+dy*o.v[1]+dz*o.v[2])*o.inv),a=dx-t*o.v[0],b=dy-t*o.v[1],c=dz-t*o.v[2];channel=Math.max(channel,o.depth*Math.exp(-(a*a+b*b+c*c)/(o.width*o.width)))}else{const dx=x-o.C[0],dy=y-o.C[1],dz=z-o.C[2],u=(dx*o.U[0]+dy*o.U[1]+dz*o.U[2])/o.r[0],v=(dx*o.V[0]+dy*o.V[1]+dz*o.V[2])/o.r[1],w=(dx*o.N[0]+dy*o.N[1]+dz*o.N[2])/o.r[2],q=(Math.hypot(u,v,w)-1)*Math.min(...o.r);if(q<.7)hollow=Math.min(hollow,q+.12*(noise(x*1.13,y*1.08,z*.97,seed+819)-.5))}}return [hollow,channel]}
return {sample,paths,cavities,segments};
}
function create(config){validate(config);const c={...config},J=joints(c.seed),stage=c.stage,er=smooth(0,3,stage),jointFactor=(stage?(.20+er*.80):0)*c.fracture,env=makeEnvelope(c.seed);
const events=EVENTS.map((e,i)=>({...e,center:e.center.slice(),half:e.half.slice(),dest:e.dest.slice(),spikeGuard:c.spikeGuard}));
function substrate(x,y,z){let d=env(x,y,z);if(d>5||y< -5.6)return d;return d+(fbm(x*.091,y*.13,z*.107,c.seed)-.5)*4.5+1.1*detail(x*.44+3,y*.49,z*.48+7,4)}
const erosion=stage>=2?erosionField(substrate,c.seed):null;
function rockBeforeDetach(x,y,z){let d=substrate(x,y,z);if(d>5||y< -5.6||stage===0)return d;
for(const j of J){let Y=y-j.cy;if(Math.abs(Y)>j.length+2)continue;let protect=smooth(2,7,y)*(1-smooth(38,47,y)),ang=j.turn*protect,ca=Math.cos(ang),sa=Math.sin(ang),tx=j.tx*ca-j.tz*sa,tz=j.tx*sa+j.tz*ca,U=(x-j.cx)*tx+(z-j.cz)*tz+j.tilt*Y,V=-(x-j.cx)*tz+(z-j.cz)*tx;if(Math.abs(V-1)>j.depth+8||Math.abs(U)>4)continue;
let wander=(noise(y*.093,j.phase,V*.089,j.wseed)-.5)*1.55+j.bend*Y*.035,taper=1-smooth(j.length*.55,j.length,Math.abs(Y)),width=j.width*jointFactor*(.33+.67*noise(y*.18+3,V*.14,j.phase,j.wseed+7))*(.25+.75*taper),ell=(Math.hypot(Y/j.length,(V-1)/(j.depth+6))-1)*Math.min(j.length,j.depth+6);
let slit=smax(Math.abs(U+wander)-width,ell,.17);d=Math.max(d,-slit);
if(j.branch&&Y>-.3&&Y<j.length*.58){const fork=Math.max(Math.abs(U+wander+(Y-1)*.40)-width*.64,Math.abs(Y-j.length*.22)-j.length*.25,Math.abs(V)-j.depth*.86);d=Math.max(d,-fork)}
}
if(stage>=2){let f1=noise(x*.41+noise(x*.047,y*.052,z*.047,c.seed+91)*1.6,y*.065,z*.44,c.seed+101),f2=noise(x*.9,y*.12,z*.94,c.seed+117),groove=smooth(.56,.8,f1)*(.3+.65*smooth(.34,.7,f2)),runoff=smooth(1,12,y)*(1-smooth(40,52,y));
let [cavity,channel]=erosion.sample(x,y,z);d+=er*c.relief*(1.25*groove*runoff+.40*detail(x*1.3,y*.59,z*1.21,4)+channel*1.65);d=Math.max(d,-cavity);
let a=(x+6)/6.8,b=(y-5.4)/4.7,q=(z-8.8)/9.,cave=(Math.sqrt(a*a+b*b+q*q)-1)*4.7+.24*detail(x*.59,y*.67,z*.53,3);d=Math.max(d,-cave);
let notch=(Math.sqrt(((x-12)/10)**2+((y-7)/3.7)**2+((z-8)/8)**2)-1)*3.7+.18*detail(x*.84,y*.78,z*.92,3);d=Math.max(d,-notch);
}return d;
}
function rock(x,y,z){let d=rockBeforeDetach(x,y,z);if(stage>=3)for(const e of events)d=Math.max(d,-cut(e,x,y,z));return d}
function sourceFragment(e,x,y,z){return Math.max(rockBeforeDetach(x,y,z),cut(e,x,y,z))}
function groundBed(x,z){return -2.3+.36*Math.sin(x*.09+z*.04)+.28*Math.cos(z*.13-x*.03)+.5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)}
function soilComponents(x,z){let n=noise(x*.074,2,z*.074,c.seed+41),foot=Math.exp(-(((Math.hypot(x*.82,z)-19)/7.6)**2))*(1.4+.7*noise(x*.13,0,z*.13,c.seed+52)),accumulation=0;
if(stage>=3)for(const e of events){let r=((x-e.dest[0])/6.3)**2+((z-e.dest[2])/6.3)**2;accumulation+=Math.exp(-r)*1.4}
const cover=stage===4?1:stage===3?.62:stage===2?.28:.11;
return {residualMineralM:cover*(.18+.32*n),externalFineM:cover*(.14+.58*n+foot*.65),colluvialM:cover*(foot*.35+accumulation),organicMixM:.20+(stage===4?.10*noise(x*.17,1,z*.17,c.seed+607):0)};
}
function soilThickness(x,z){const s=soilComponents(x,z);return s.residualMineralM+s.externalFineM+s.colluvialM+s.organicMixM}
function ground(x,z){return groundBed(x,z)+soilThickness(x,z)}
function perimeter(x,z){return Math.sqrt((x/52)**2+(z/43)**2)-1+.025*Math.sin(x*.13+z*.17)+.022*Math.cos(z*.2-x*.1)}
return {config:c,bounds:env.bounds,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events,erosion};
}
function mesh(field,lo,hi,step,progress){const nx=Math.ceil((hi[0]-lo[0])/step)+1,ny=Math.ceil((hi[1]-lo[1])/step)+1,nz=Math.ceil((hi[2]-lo[2])/step)+1,NT=nx*ny*nz;if(NT>7500000)throw Error('固定网格预算超出');const sy=nx,sz=nx*ny,values=new Float32Array(NT);
let id=0;for(let k=0;k<nz;k++){for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)values[id++]=field(lo[0]+i*step,lo[1]+j*step,lo[2]+k*step);if(progress&&k%20===0)progress(k/nz*.5)}
const pos=[],ind=[],edges=new Map(),tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],offs=[0,1,1+sy,sy,sz,1+sz,1+sy+sz,sy+sz];
function coords(a){let k=Math.floor(a/sz),j=Math.floor((a-k*sz)/sy),i=a-k*sz-j*sy;return [lo[0]+i*step,lo[1]+j*step,lo[2]+k*step]}
function edge(a,b){if(a>b)[a,b]=[b,a];let key=a*NT+b,n=edges.get(key);if(n!==undefined)return n;let A=coords(a),B=coords(b),t=values[a]/(values[a]-values[b]);if(values[a]===0||values[b]===0){let v=values[a]===0?a:b;key=-v-1;t=values[a]===0?0:1;n=edges.get(key);if(n!==undefined)return n;}n=pos.length/3;pos.push(mix(A[0],B[0],t),mix(A[1],B[1],t),mix(A[2],B[2],t));edges.set(key,n);return n}
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
/* Stone-only port from haihao0307/HOUSE@53a4b072, experiments/atelier-r4/src/kernel.js.
* Retained: seeded noise, stone/rubble/dressed/pebble envelopes, beds, plane cuts,
* finite rotated chip cutters. Landscape mesh extraction and placement are adapters.
* No brick, adobe, fibers, UI, shadow sampler or external dependencies imported. */
'use strict';
const BrickStone=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,norm=v=>{let d=Math.hypot(...v)||1;return v.map(x=>x/d)};
function rng(s){return()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
function hash(x,y,z,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function noise(x,y,z,s){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);x-=ix;y-=iy;z-=iz;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z);return mix(mix(mix(hash(ix,iy,iz,s),hash(ix+1,iy,iz,s),x),mix(hash(ix,iy+1,iz,s),hash(ix+1,iy+1,iz,s),x),y),mix(mix(hash(ix,iy,iz+1,s),hash(ix+1,iy,iz+1,s),x),mix(hash(ix,iy+1,iz+1,s),hash(ix+1,iy+1,iz+1,s),x),y),z)}
function derive(master,layer){let v=master>>>0;for(let i=0;i<layer.length;i++)v=Math.imul(v^layer.charCodeAt(i),16777619)>>>0;return v}
const profiles=Object.freeze({stone:{name:'层状毛石',seed:8231,damage:.55,relief:.74,shader:1},rubble:{name:'不规则毛石',seed:9298,damage:.62,relief:.68,shader:2},dressed:{name:'粗凿砌筑石',seed:10365,damage:.40,relief:.38,shader:5},pebble:{name:'建筑卵石',seed:7179,damage:.06,relief:.22,shader:6}});
function field(family,shape,seed){
if(!profiles[family]||!['sample','long','half','thin','wedge'].includes(shape)||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('石材配方无效');
const c=profiles[family],isPebble=family==='pebble',isStone=!isPebble,ss=derive(seed,'shape'),ds=derive(seed,'damage'),R=rng(ss),D=rng(ds),h=shape==='long'?[1.32,.56,.43]:shape==='half'?[.74,.80,.44]:shape==='thin'?[1.20,.69,.23]:[1.17,.80,.44];
if(isPebble){h[0]=shape==='long'?1.30:shape==='half'?.77:1.04;h[1]=shape==='thin'?.44:.76;h[2]=shape==='thin'?.67:.74;for(let a=0;a<3;a++)h[a]*=.93+R()*.14}
if(family==='rubble'){h[0]*=.90+R()*.13;h[1]*=.92+R()*.19;h[2]*=1.32+R()*.28}if(family==='stone')h[2]*=1.1;
const planes=[];if(family==='rubble')for(let j=0;j<9;j++){let n=norm([R()*2-1,R()*2-1,R()*2-1]);planes.push([...n,(Math.abs(n[0])*h[0]+Math.abs(n[1])*h[1]+Math.abs(n[2])*h[2])*(.61+R()*.27)])}
const phase=R()*20,beds=[],cuts=[];let level=-h[1]*1.1;while(level<h[1]*1.2){level+=.09+R()*.22;beds.push([level,(R()-.5)*.16])}
function faceEvent(axis,sign,u,v,ru,rv,rd,angle,kind){const o=[0,1,2].filter(a=>a!==axis),C=[0,0,0],A=[0,0,0],B=[0,0,0],W=[0,0,0];C[o[0]]=u;C[o[1]]=v;C[axis]=sign*(h[axis]+rd*.30);A[o[0]]=1;B[o[1]]=1;W[axis]=sign;const U=A.map((a,k)=>a*Math.cos(angle)+B[k]*Math.sin(angle)),V=A.map((a,k)=>-a*Math.sin(angle)+B[k]*Math.cos(angle)),r=[ru,rv,rd];cuts.push({C,U,V,W,r,kind,ext:[0,1,2].map(a=>Math.abs(U[a])*ru+Math.abs(V[a])*rv+Math.abs(W[a])*rd+.12)})}
const count=Math.round(c.damage*(isPebble?15:55));
for(let k=0;k<count;k++){const axis=[2,2,1,0][Math.floor(k/2)%4],sign=k%2?1:-1,o=[0,1,2].filter(a=>a!==axis),a=(D()*1.92-.96)*h[o[0]],b=(D()*1.90-.95)*h[o[1]],large=k%10===0;let ru=large?.20+D()*.26:.035+D()*.11,rv=large?.12+D()*.14:ru*(.55+D()*.55),rd=large?.10+D()*.085:.038+D()*.085;if(isStone){ru*=1.1;rv*=.58}if(isPebble){ru*=.36;rv*=.36;rd*=.35}const angle=isStone?-.16+(D()-.5)*.32:D()*6.28;faceEvent(axis,sign,a,b,ru,rv,rd,angle,large||isStone?'chip':'pit')}
if(c.damage>0&&!isPebble)for(let k=0;k<9;k++){let yy=(k/9-.46)*h[1]*1.8+(D()-.5)*.24,xx=(D()-.5)*1.25*h[0];faceEvent(2,k%3===0?-1:1,xx,yy,.24+D()*.38,.025+D()*.035,(.08+D()*.11)*c.damage,-.13+(D()-.5)*.2,'chip')}
if(isStone&&c.damage>0)for(let k=0;k<18;k++){let ax=[2,2,0,1][Math.floor(k/2)%4],sign=k%2?1:-1,o=[0,1,2].filter(a=>a!==ax);faceEvent(ax,sign,(D()*1.72-.86)*h[o[0]],(D()*1.72-.86)*h[o[1]],.055+D()*.11,.018+D()*.018,.035+c.damage*.045,-.22+(D()-.5)*.66,'chip')}
if(shape==='half')faceEvent(0,1,.08,.04,.54,.44,.20,0,'chip');
function sample(px,py,pz){let a=noise(px*2.8+phase,py*2.8,pz*2.8,ss)-.5,b=noise(px*12,py*12,pz*12,ss+711)-.5,bedOffset=0;
if(family==='stone'){let w=py+px*.14+pz*.10;for(let b of beds){if(w>b[0])bedOffset=b[1];else break}}
const r=.036,qx=Math.abs(px+.018*a)-h[0]+r,qy=Math.abs(py+.02*a)-h[1]+r,qz=Math.abs(pz)-h[2]-bedOffset*c.relief+r;
let sd=Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-r;
if(isPebble)sd=(Math.hypot(px/h[0],py/h[1],pz/h[2])-1)*Math.min(...h);
if(shape==='wedge')sd=Math.max(sd,py+px*.30-h[1]*.78);for(let p of planes)sd=Math.max(sd,px*p[0]+py*p[1]+pz*p[2]-p[3]);
sd+=a*(family==='rubble'?.16:.060)*c.relief+(b*(isStone?.072:.052)+Math.pow(clamp((b+.5-.35)/.36),.32)*.035)*c.relief;
for(let t of cuts){let x=px-t.C[0],y=py-t.C[1],z=pz-t.C[2];if(Math.abs(x)>t.ext[0]||Math.abs(y)>t.ext[1]||Math.abs(z)>t.ext[2])continue;let u=(x*t.U[0]+y*t.U[1]+z*t.U[2])/t.r[0],v=(x*t.V[0]+y*t.V[1]+z*t.V[2])/t.r[1],w=(x*t.W[0]+y*t.W[1]+z*t.W[2])/t.r[2],mm=Math.min(...t.r),n=t.kind==='chip'?Math.max(Math.abs(u)*.92+Math.abs(v)*.27,Math.abs(v)*.96+Math.abs(w)*.18,Math.abs(w)*.86+Math.abs(u)*.22,(Math.abs(u)+Math.abs(v)+Math.abs(w))*.53):Math.hypot(u,v,w);sd=Math.max(sd,-((n-1)*mm+b*Math.min(.095,mm*1.12)))}
return sd;
}
return{sample,h,profile:c,seed,shape,planes,beds,cuts,bounds:[h.map(v=>-v-.25),h.map(v=>v+.25)]};
}
return{profiles,field,noise,hash,rng,derive};
})();
if(typeof module!=='undefined')module.exports=BrickStone;
/* Geometry support against the rendered soil triangles, no dynamics claim.
Deterministic pose search uses uniform-density center of mass and finite contact patches.
Soil embedding has an explicit small tolerance; every final triangle is sampled. */
'use strict';
const TerrainSupport=(()=>{
const norm=v=>{let d=Math.hypot(...v)||1;return v.map(x=>x/d)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function orient(m){const I=m.indices,nf=I.length/3,n=m.positions.length/3,adj=new Int32Array(I.length).fill(-1),same=new Uint8Array(I.length),edge=new Map();let bad=0;for(let f=0;f<nf;f++)for(let e=0;e<3;e++){let k=f*3+e,a=I[k],b=I[f*3+(e+1)%3],key=Math.min(a,b)*n+Math.max(a,b);if(edge.has(key)){let j=edge.get(key),g=Math.floor(j/3);adj[k]=g;adj[j]=f;same[k]=same[j]=+(I[j]===a);edge.delete(key);}else edge.set(key,k)}bad=edge.size;const mark=new Int8Array(nf).fill(-1),queue=new Int32Array(nf);let conflicts=0;for(let start=0;start<nf;start++){if(mark[start]>=0)continue;let read=0,write=1;queue[0]=start;mark[start]=0;while(read<write){let f=queue[read++];for(let e=0;e<3;e++){let k=f*3+e,g=adj[k];if(g<0)continue;let want=mark[f]^same[k];if(mark[g]<0){mark[g]=want;queue[write++]=g}else if(mark[g]!==want)conflicts++}}}if(conflicts||bad)throw Error('网格边界不闭合或不可定向: '+bad+'/'+conflicts);let fixed=0;for(let f=0;f<nf;f++)if(mark[f]){let k=f*3,t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;fixed++}if(World.volume(m)<0)for(let k=0;k<I.length;k+=3){let t=I[k+1];I[k+1]=I[k+2];I[k+2]=t}return fixed;}
function ground(mesh){const P=mesh.positions,I=mesh.indices,bins=new Map(),cell=1.6,tri=[];const key=(x,z)=>Math.floor(x/cell)+128+256*(Math.floor(z/cell)+128);
for(let k=0;k<I.length;k+=3){let a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ax=P[a],az=P[a+2],bx=P[b]-ax,bz=P[b+2]-az,cx=P[c]-ax,cz=P[c+2]-az,det=bx*cz-bz*cx;if(Math.abs(det)<1e-10)continue;let ny=-det,nx=(P[b+1]-P[a+1])*cz-bz*(P[c+1]-P[a+1]),nz=bx*(P[c+1]-P[a+1])-(P[b+1]-P[a+1])*cx;if(ny/Math.hypot(nx,ny,nz)<.18)continue;
let t={ax,az,bx,bz,cx,cz,det,ay:P[a+1],by:P[b+1]-P[a+1],cy:P[c+1]-P[a+1]},idx=tri.length;tri.push(t);let loX=Math.floor(Math.min(P[a],P[b],P[c])/cell),hiX=Math.floor(Math.max(P[a],P[b],P[c])/cell),loZ=Math.floor(Math.min(P[a+2],P[b+2],P[c+2])/cell),hiZ=Math.floor(Math.max(P[a+2],P[b+2],P[c+2])/cell);for(let x=loX;x<=hiX;x++)for(let z=loZ;z<=hiZ;z++){let q=x+128+256*(z+128);if(!bins.has(q))bins.set(q,[]);bins.get(q).push(idx)}}
function height(x,z){let list=bins.get(key(x,z)),best=-Infinity;if(list)for(let i of list){let t=tri[i],dx=x-t.ax,dz=z-t.az,u=(dx*t.cz-dz*t.cx)/t.det,v=(t.bx*dz-t.bz*dx)/t.det;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)best=Math.max(best,t.ay+u*t.by+v*t.cy)}return best}
return {height,triangles:tri.length};}
function center(m){let P=m.positions,I=m.indices,O=[P[0],P[1],P[2]],V=0,C=[0,0,0];for(let i=0;i<I.length;i+=3){let a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3,A=[P[a]-O[0],P[a+1]-O[1],P[a+2]-O[2]],B=[P[b]-O[0],P[b+1]-O[1],P[b+2]-O[2]],D=[P[c]-O[0],P[c+1]-O[1],P[c+2]-O[2]],w=dot(A,cross(B,D))/6;V+=w;for(let j=0;j<3;j++)C[j]+=w*(A[j]+B[j]+D[j])/4}if(Math.abs(V)<1e-12)return O;return C.map((x,i)=>x/V+O[i])}
function insideHull(points,x,z){points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(points.length<3)return false;let lower=[],upper=[];for(let p of points){while(lower.length>1&&turn(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}for(let p of points.slice().reverse()){while(upper.length>1&&turn(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}let h=lower.slice(0,-1).concat(upper.slice(0,-1));if(h.length<3)return false;return h.every((a,i)=>turn(a,h[(i+1)%h.length],[x,z])>=-1e-5)}
function settle(m,x,z,yaw,scale,terrain,id){const P=m.positions.slice(),I=m.indices,C=center(m),dirs=[],clusters=new Map(),n=P.length/3;
for(let k=0;k<I.length;k+=3){let a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],N=cross(u,v),area=Math.hypot(...N);if(area<1e-9)continue;N=N.map(v=>v/area);const key=N.map(v=>Math.round(v*4)).join(',');let p=clusters.get(key)||{sum:[0,0,0],area:0};p.area+=area;for(let j=0;j<3;j++)p.sum[j]+=N[j]*area;clusters.set(key,p)}
dirs.push(...[...clusters.values()].sort((a,b)=>b.area-a.area).slice(0,18).map(p=>norm(p.sum)),[0,0,-1],[0,-1,0],[1,0,0]);
const cloud=Array.from({length:n},(_,k)=>[P[k*3]-C[0],P[k*3+1]-C[1],P[k*3+2]-C[2]]);
function matrix(up){up=norm(up);let u=norm(cross(Math.abs(up[1])>.95?[1,0,0]:[0,1,0],up)),v=cross(u,up),ca=Math.cos(yaw),sa=Math.sin(yaw);return [u[0]*ca-v[0]*sa,u[1]*ca-v[1]*sa,u[2]*ca-v[2]*sa,...up,u[0]*sa+v[0]*ca,u[1]*sa+v[1]*ca,u[2]*sa+v[2]*ca]}
function evalR(R){let lift=-Infinity;for(let q of cloud){let X=x+scale*(R[0]*q[0]+R[1]*q[1]+R[2]*q[2]),Y=scale*(R[3]*q[0]+R[4]*q[1]+R[5]*q[2]),Z=z+scale*(R[6]*q[0]+R[7]*q[1]+R[8]*q[2]),g=terrain.height(X,Z);if(!Number.isFinite(g))return Infinity;lift=Math.max(lift,g-Y)}return lift}
const rank=dirs.map(d=>{let R=matrix(d.map(x=>-x));return {R,h:evalR(R)}}).sort((a,b)=>a.h-b.h);let best=rank[0];if(!Number.isFinite(best.h))throw Error('石块位置缺少可承托土面 '+id);
for(let step of [.15,.07,.025,.01,.003])for(let pass=0;pass<2;pass++){let options=[best];for(let axis of[0,2])for(let a of[-step,step]){let R=best.R.slice(),ca=Math.cos(a),sa=Math.sin(a),b=axis===0?1:0,c=axis===0?2:1;for(let j=0;j<3;j++){let u=R[b*3+j],v=R[c*3+j];R[b*3+j]=ca*u-sa*v;R[c*3+j]=sa*u+ca*v}options.push({R,h:evalR(R)})}best=options.sort((a,b)=>a.h-b.h)[0]}
const R=best.R,Q=new Float32Array(P.length);for(let k=0;k<P.length;k+=3){let q=[P[k]-C[0],P[k+1]-C[1],P[k+2]-C[2]];Q[k]=x+scale*(R[0]*q[0]+R[1]*q[1]+R[2]*q[2]);Q[k+1]=scale*(R[3]*q[0]+R[4]*q[1]+R[5]*q[2]);Q[k+2]=z+scale*(R[6]*q[0]+R[7]*q[1]+R[8]*q[2])}
let lift=-Infinity,samples=[];function add(X,Y,Z){let g=terrain.height(X,Z);if(!Number.isFinite(g))throw Error('土面支撑采样缺失 '+id);lift=Math.max(lift,g-Y);samples.push([X,Y,Z,g])}
for(let k=0;k<Q.length;k+=3)add(Q[k],Q[k+1],Q[k+2]);for(let k=0;k<I.length;k+=3){let a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3;for(let wt of[[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]])add(Q[a]*wt[0]+Q[b]*wt[1]+Q[c]*wt[2],Q[a+1]*wt[0]+Q[b+1]*wt[1]+Q[c+1]*wt[2],Q[a+2]*wt[0]+Q[b+2]*wt[1]+Q[c+2]*wt[2])}
let radius=Math.max(...cloud.map(p=>Math.hypot(...p)*scale)),embed=Math.min(.14,.045+radius*.014),final=lift-embed;
let contacts=samples.filter(p=>p[1]+final-p[3]<.10),support=insideHull(contacts.map(p=>[p[0],p[2]]),x,z);
if(!support){embed=Math.min(.22,.085+radius*.025);final=lift-embed;contacts=samples.filter(p=>p[1]+final-p[3]<.11);support=insideHull(contacts.map(p=>[p[0],p[2]]),x,z)}
for(let k=1;k<Q.length;k+=3)Q[k]+=final;m.supportId=id;m.positions=Q;m.rest=P;m.N=World.normals(Q,I);
const bits=new Uint32Array(Q.buffer),seen=new Map(),remap=new Uint32Array(Q.length/3),positions=[],rest=[];let welded=0,removed=0;
for(let k=0;k<Q.length/3;k++){let key=bits[k*3]+','+bits[k*3+1]+','+bits[k*3+2],at=seen.get(key);if(at===undefined){at=positions.length/3;seen.set(key,at);positions.push(Q[k*3],Q[k*3+1],Q[k*3+2]);rest.push(P[k*3],P[k*3+1],P[k*3+2])}else welded++;remap[k]=at}
if(welded){let ix=[];for(let k=0;k<I.length;k+=3){let a=remap[I[k]],b=remap[I[k+1]],c=remap[I[k+2]];if(a===b||b===c||a===c){removed++;continue}ix.push(a,b,c)}m.positions=Float32Array.from(positions);m.rest=Float32Array.from(rest);m.indices=Uint32Array.from(ix);orient(m);m.N=World.normals(m.positions,m.indices)}
let retriangulated=0;const pp=m.positions,ii=m.indices;
for(let k=0;k<ii.length;k+=3){let ids=[ii[k],ii[k+1],ii[k+2]],v=ids.map(i=>[pp[i*3],pp[i*3+1],pp[i*3+2]]),u=v[1].map((x,i)=>x-v[0][i]),w=v[2].map((x,i)=>x-v[0][i]);if(Math.hypot(...cross(u,w))>1e-14)continue;
let pairs=[[0,1,2],[1,2,0],[2,0,1]].sort((a,b)=>Math.hypot(...v[b[0]].map((x,i)=>x-v[b[1]][i]))-Math.hypot(...v[a[0]].map((x,i)=>x-v[a[1]][i]))),[a,b,c]=pairs[0],A=ids[a],B=ids[b],M=ids[c],found=false;
for(let j=0;j<ii.length&&!found;j+=3){if(j===k)continue;for(let e=0;e<3;e++){let U=ii[j+e],V=ii[j+(e+1)%3],D=ii[j+(e+2)%3];if((U===A&&V===B)||(U===B&&V===A)){ii[k]=U;ii[k+1]=M;ii[k+2]=D;ii[j]=M;ii[j+1]=V;ii[j+2]=D;found=true;retriangulated++;break}}}
if(!found)throw Error('退化面的共边修复失败 '+id);
}
if(retriangulated){orient(m);m.N=World.normals(m.positions,m.indices)}
const record={id,sourceCenter:C,worldCenter:[x,final,z],rotation:R,scale,ground:'rendered-soil-triangles',sampleCount:samples.length,minimumGapM:-embed,soilEmbeddingM:embed,collinearFacesRetriangulated:retriangulated,coincidentVerticesMerged:welded,zeroIndexFacesRemoved:removed,nearContactSamples:contacts.length,centerInsideSupportHull:support,scope:'uniform-density static pose search with compliant soil; not dynamics'};
return record;
}
return{orient,ground,settle,center};
})();
if(typeof module!=='undefined')module.exports=TerrainSupport;

'use strict';
function microscopeGeometryR2(mesh,options={}){
const W=World,Paccepted=mesh.rest,I=mesh.indices,count=Paccepted.length/3,clamp=W.clamp,smooth=W.smooth;
const strength=options.strength??1.45,concavity=options.concavity??.75,spikeGuard=options.spikeGuard??.90,baseAmp=Number.isFinite(options.amp)?options.amp:.48,requestedAmp=baseAmp*strength,ell=options.scale||7.2,requestedLayers=Math.max(1,Math.min(5,options.layers||3)),gridStep=Math.max(.05,options.gridStep||.5),minimumGeometryScale=gridStep*2,maxGeometryLayers=Math.max(1,1+Math.floor(Math.log2(Math.max(1,ell/minimumGeometryScale)))),layers=Math.min(requestedLayers,maxGeometryLayers),meshSafetyFraction=options.meshSafetyFraction??.22,dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.48,smoothing=options.smoothing??.34,seed=options.seed??83;
let P0=new Float32Array(Paccepted),Naccepted=W.normals(Paccepted,I),N0=new Float32Array(Naccepted),minY=Infinity,maxY=-Infinity;
for(let i=0;i<count;i++){let y=Paccepted[i*3+1];minY=Math.min(minY,y);maxY=Math.max(maxY,y)}const span=Math.max(1e-6,maxY-minY);
function mouthProtect(x,y,z,cx,cy,cz,rx,ry,rz){let q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz),shell=1-smooth(.045,.28,Math.abs(q-1)),front=smooth(cz-2.0,cz+3.4,z);return shell*front}
function protectionGate(i){let k=i*3,x=Paccepted[k],y=Paccepted[k+1],z=Paccepted[k+2],ny=Math.abs(Naccepted[k+1]),t=(y-minY)/span,height=smooth(.105,.205,t)*(1-smooth(.835,.935,t)),wall=smooth(.055,.40,1-ny),cave=mouthProtect(x,y,z,-6,5.4,8.8,6.8,4.7,9),notch=mouthProtect(x,y,z,12,7,8,10,3.7,8);return clamp(height*wall*(1-Math.max(cave,notch)))}
const gate=new Float32Array(count);for(let i=0;i<count;i++)gate[i]=protectionGate(i);
function flipCount(P,Ref){let flips=0;for(let q=0;q<I.length;q+=3){let ia=I[q]*3,ib=I[q+1]*3,ic=I[q+2]*3,ux=P[ib]-P[ia],uy=P[ib+1]-P[ia+1],uz=P[ib+2]-P[ia+2],vx=P[ic]-P[ia],vy=P[ic+1]-P[ia+1],vz=P[ic+2]-P[ia+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,bux=Ref[ib]-Ref[ia],buy=Ref[ib+1]-Ref[ia+1],buz=Ref[ib+2]-Ref[ia+2],bvx=Ref[ic]-Ref[ia],bvy=Ref[ic+1]-Ref[ia+1],bvz=Ref[ic+2]-Ref[ia+2],bnx=buy*bvz-buz*bvy,bny=buz*bvx-bux*bvz,bnz=bux*bvy-buy*bvx;if(nx*bnx+ny*bny+nz*bnz<0)flips++}return flips}
function neighborAverages(P){let sx=new Float64Array(count),sy=new Float64Array(count),sz=new Float64Array(count),w=new Uint16Array(count);function add(a,b){let B=b*3;sx[a]+=P[B];sy[a]+=P[B+1];sz[a]+=P[B+2];w[a]++}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}return{sx,sy,sz,w}}
let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0,antiSpikeRejectedTrials=0,antiSpikeSkippedUnsafeVertices=0;
const spikeScale=new Float32Array(count);spikeScale.fill(Infinity);function spikeMin(i,v){if(Number.isFinite(v)&&v>1e-8&&v<spikeScale[i])spikeScale[i]=v}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2]),bc=Math.hypot(P0[B]-P0[C],P0[B+1]-P0[C+1],P0[B+2]-P0[C+2]),ca=Math.hypot(P0[C]-P0[A],P0[C+1]-P0[A+1],P0[C+2]-P0[A+2]),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],area2=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);spikeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));spikeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));spikeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}for(let i=0;i<count;i++)if(!Number.isFinite(spikeScale[i]))spikeScale[i]=0;
for(let pass=0;pass<3;pass++){let av=neighborAverages(P0),accepted=null,acceptedMoved=0,acceptedMax=0;for(let gain of [.75,.48,.30,.18]){let Q=new Float32Array(P0),moved=0,trialMax=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;if(spikeScale[i]<.035){if(pass===0&&gain===.75)antiSpikeSkippedUnsafeVertices++;continue}let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.015,.58,-N0[k+1]),tip=smooth(.025,.38,depth);if(depth<=0||down<=0||tip<=0)continue;let cap=spikeScale[i]*(.018+.004*pass),dy=Math.min(depth*spikeGuard*down*tip*gain,cap);if(dy<.00015)continue;let ratio=dy/Math.max(depth,1e-6),nx=P0[k]+(ax-P0[k])*ratio*.08,ny=P0[k+1]+dy,nz=P0[k+2]+(az-P0[k+2])*ratio*.08,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;trialMax=Math.max(trialMax,dr)}if(!moved)continue;if(flipCount(Q,P0)===0){accepted=Q;acceptedMoved=moved;acceptedMax=trialMax;break}antiSpikeRejectedTrials++}if(!accepted)break;P0=accepted;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=acceptedMoved;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,acceptedMax);antiSpikePasses++}
const localScale=new Float32Array(count);localScale.fill(Infinity);function edgeLen(a,b){let A=a*3,B=b*3;return Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2])}function safeMin(id,v){if(Number.isFinite(v)&&v>1e-8&&v<localScale[id])localScale[id]=v}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=edgeLen(a,b),bc=edgeLen(b,c),ca=edgeLen(c,a),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area2=Math.hypot(nx,ny,nz);safeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));safeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));safeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}
let minLocalScale=Infinity,maxLocalScale=0;for(let i=0;i<count;i++){if(!Number.isFinite(localScale[i]))localScale[i]=gridStep;minLocalScale=Math.min(minLocalScale,localScale[i]);maxLocalScale=Math.max(maxLocalScale,localScale[i])}
function detailAt(i){
let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],th=Math.atan2(z,x);
let w0=W.fbm(x*.024,y*.019,z*.023,seed+607)-.5,w1=W.fbm(x*.031+7.1,y*.026-3.7,z*.029+11.3,seed+613)-.5,w2=W.fbm(x*.018-9.4,y*.033+5.2,z*.027-4.8,seed+631)-.5;
let bend=warp*(.22*Math.sin(y*.109+w1*1.7)+.16*Math.sin(th*2.37+y*.047+w2*2.1)+.78*w0+.24*w1*w2),a=dir+bend,ca=Math.cos(a),sa=Math.sin(a),xr=ca*x-sa*z,zr=sa*x+ca*z;
let sx=xr+ell*(.52*w1+.16*Math.sin(y*.083+w2*2.4)),sy=y+ell*(.26*w2+.10*Math.sin(th*3.07+w0*2.2)),sz=zr+ell*(.48*w0+.14*Math.sin(y*.071+w1*2.7));
let turn=warp*(W.fbm(sx*.043,sy*.031,sz*.041,seed+653)-.5)*1.18,ct=Math.cos(turn),st=Math.sin(turn),tx=ct*sx-st*sz,tz=st*sx+ct*sz;
let broad=W.fbm(tx/ell,sy/(ell*1.87),tz/ell,seed+701)-.5;
let mid=W.fbm((tx+.19*sy)/(ell*.53)+3.7,(sy-.11*tz)/(ell*.99)-1.4,(tz+.17*tx)/(ell*.51)+6.1,seed+719)-.5;
let fine=W.fbm((tx-.13*tz)/(ell*.27)-5.2,(sy+.16*tx)/(ell*.59)+2.8,(tz-.09*sy)/(ell*.24)-3.1,seed+733)-.5;
let flow=W.fbm((tx+.21*sy)/(ell*.79)+11.0,sy/(ell*2.83),(tz-.18*sy)/(ell*.74)-7.0,seed+811)-.5;
let breakup=.78+.48*(W.fbm(tx*.032,sy*.021,tz*.029,seed+887)-.5),d=(.94*broad+.52*mid+.17*fine+.31*flow)*breakup,cavity=Math.max(0,d+.035+.025*w2),rim=Math.exp(-Math.abs(d-.025-.018*w1)*8.2);
return d*1.55-concavity*cavity*cavity*2.25+rim*.055-concavity*.055
}
function capAt(i){let down=smooth(.04,.72,-N0[i*3+1]);return Math.max(1e-6,localScale[i]*meshSafetyFraction*(1-.48*spikeGuard*down))}
function neighborScalar(V){let sum=new Float64Array(count),w=new Uint16Array(count);function add(a,b){sum[a]+=V[b];w[a]++}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}return{sum,w}}
function smoothDisplacement(src){let av=neighborScalar(src),out=new Float32Array(src);for(let i=0;i<count;i++){if(gate[i]<1e-7||!av.w[i]){out[i]=0;continue}let avg=av.sum[i]/av.w[i],v=src[i]*(1-smoothing)+avg*smoothing,down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;out[i]=clamp(v,-capAt(i),capAt(i))}return out}
function build(A){let raw=new Float32Array(count),clippedVertexCount=0,minAppliedCap=Infinity,maxAppliedCap=0;for(let i=0;i<count;i++){if(gate[i]<1e-7)continue;let v=A*gate[i]*detailAt(i),down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;let cap=capAt(i),c=clamp(v,-cap,cap);if(Math.abs(c-v)>1e-12)clippedVertexCount++;raw[i]=c;minAppliedCap=Math.min(minAppliedCap,cap);maxAppliedCap=Math.max(maxAppliedCap,cap)}let disp=smoothDisplacement(smoothDisplacement(raw)),P=new Float32Array(P0),sum2=0,maxD=0,protectedCount=0,protectedDrift=0;for(let i=0;i<count;i++){let k=i*3;if(gate[i]<1e-7){protectedCount++;continue}let off=clamp(disp[i],-capAt(i),capAt(i));P[k]=P0[k]+N0[k]*off;P[k+1]=P0[k+1]+N0[k+1]*off;P[k+2]=P0[k+2]+N0[k+2]*off;maxD=Math.max(maxD,Math.abs(off));sum2+=off*off}for(let i=0;i<count;i++)if(gate[i]<1e-7){let k=i*3;if(P[k]!==Paccepted[k]||P[k+1]!==Paccepted[k+1]||P[k+2]!==Paccepted[k+2])protectedDrift++}let flips=flipCount(P,P0);return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips,clippedVertexCount,minAppliedCap:Number.isFinite(minAppliedCap)?minAppliedCap:0,maxAppliedCap}}
let attempts=[requestedAmp,requestedAmp*.86,requestedAmp*.72,requestedAmp*.56,requestedAmp*.40,requestedAmp*.28,0],attemptReports=[],chosen=null,effectiveAmp=0;for(let A of attempts){let r=build(A);attemptReports.push({amplitudeM:A,maxDisplacementM:r.maxD,rmsDisplacementM:r.rms,triangleFlipCount:r.flips,protectedDriftCount:r.protectedDrift,clippedVertexCount:r.clippedVertexCount});if(r.flips===0&&r.protectedDrift===0){chosen=r;effectiveAmp=A;break}}if(!chosen)throw Error('Microscope R2 geometry safety gate failed');
let N=W.normals(chosen.P,I),maxNormal=0;for(let k=0;k<N.length;k+=3){let d=clamp(N0[k]*N[k]+N0[k+1]*N[k+1]+N0[k+2]*N[k+2],-1,1);maxNormal=Math.max(maxNormal,Math.acos(d)*180/Math.PI)}
mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R2',baseAmplitudeM:baseAmp,geometryStrength:strength,requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,requestedLayers,effectiveLayers:layers,gridStepM:gridStep,minimumGeometryScaleM:minimumGeometryScale,finestGeometryScaleM:ell/Math.pow(2,layers-1),finerScalesRemainSurfaceOnly:layers<requestedLayers,meshSafetyFraction,minLocalMeshScaleM:minLocalScale,maxLocalMeshScaleM:maxLocalScale,clippedVertexCount:chosen.clippedVertexCount,minAppliedCapM:chosen.minAppliedCap,maxAppliedCapM:chosen.maxAppliedCap,attempts:attemptReports,concavity,spikeGuard,smoothing,directionDeg:(options.directionDeg??18),warp,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,antiSpikeRejectedTrials,antiSpikeSkippedUnsafeVertices,baseTriangleFlipCount:flipCount(P0,Paccepted),referenceDomain:'accepted R5.K2 P0 plus bounded anti-spike correction',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};return mesh.microscopeGeometry}

function soilMicroscopeR1(mesh,options={}){
const W=World,P0=mesh.rest||mesh.positions,N0=mesh.N,I=mesh.indices,count=P0.length/3,clamp=W.clamp,smooth=W.smooth;
const strength=clamp(options.strength??.8,0,1.5),seed=options.seed??83,baseAmplitude=options.amplitude??.038;
function flipCount(P){let flips=0;for(let q=0;q<I.length;q+=3){let ia=I[q]*3,ib=I[q+1]*3,ic=I[q+2]*3,ux=P[ib]-P[ia],uy=P[ib+1]-P[ia+1],uz=P[ib+2]-P[ia+2],vx=P[ic]-P[ia],vy=P[ic+1]-P[ia+1],vz=P[ic+2]-P[ia+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,bux=P0[ib]-P0[ia],buy=P0[ib+1]-P0[ia+1],buz=P0[ib+2]-P0[ia+2],bvx=P0[ic]-P0[ia],bvy=P0[ic+1]-P0[ia+1],bvz=P0[ic+2]-P0[ia+2],bnx=buy*bvz-buz*bvy,bny=buz*bvx-bux*bvz,bnz=bux*bvy-buy*bvx;if(nx*bnx+ny*bny+nz*bnz<0)flips++}return flips}
const localScale=new Float32Array(count);localScale.fill(Infinity);
function safeMin(id,v){if(Number.isFinite(v)&&v>1e-8&&v<localScale[id])localScale[id]=v}
function edge(a,b){let A=a*3,B=b*3;return Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2])}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=edge(a,b),bc=edge(b,c),ca=edge(c,a),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],area2=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);safeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));safeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));safeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}
for(let i=0;i<count;i++)if(!Number.isFinite(localScale[i]))localScale[i]=.75;
const gate=new Float32Array(count),raw=new Float32Array(count),sum=new Float64Array(count),w=new Uint16Array(count);
for(let i=0;i<count;i++){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],top=smooth(.30,.86,N0[k+1]),height=smooth(-6.2,-2.7,y)*(1-smooth(2.2,4.8,y)),edgeFade=smooth(-.02,.10,top*height),wx=W.fbm(x*.035,0,z*.035,seed+1103)-.5,wz=W.fbm(x*.041+9.7,0,z*.039-6.2,seed+1117)-.5,sx=x+2.1*wx,sz=z+1.8*wz,broad=W.fbm(sx*.18,0,sz*.16,seed+1129)-.5,mid=W.fbm(sx*.39+4.1,0,sz*.35-7.3,seed+1151)-.5,fine=W.fbm(sx*.71-5.4,0,sz*.63+2.8,seed+1163)-.5;gate[i]=edgeFade;raw[i]=strength*edgeFade*baseAmplitude*(.72*broad+.36*mid+.14*fine)}
function add(a,b){sum[a]+=raw[b];w[a]++}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}
const disp=new Float32Array(count);for(let i=0;i<count;i++){let v=w[i]?raw[i]*.64+(sum[i]/w[i])*.36:raw[i],cap=Math.max(1e-6,localScale[i]*.075);disp[i]=clamp(v,-cap,cap)}
function build(scale){let P=new Float32Array(P0),maxD=0,sum2=0,active=0;for(let i=0;i<count;i++){if(gate[i]<1e-5)continue;let k=i*3,off=disp[i]*scale;P[k+1]=P0[k+1]+off;maxD=Math.max(maxD,Math.abs(off));sum2+=off*off;active++}return{P,maxD,rms:Math.sqrt(sum2/Math.max(1,active)),active,flips:flipCount(P)}}
let chosen=null,effectiveScale=0;for(let scale of[1,.75,.5,.25,0]){let r=build(scale);if(r.flips===0){chosen=r;effectiveScale=scale;break}}if(!chosen)throw Error('Soil Microscope safety gate failed');
mesh.positions=chosen.P;mesh.N=W.normals(chosen.P,I);mesh.soilMicroscope={schema:'LANDSCAPE_SOIL_MICROSCOPE_R1',strength,baseAmplitudeM:baseAmplitude,effectiveScale,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,activeVertexCount:chosen.active,triangleFlipCount:chosen.flips,topSurfaceOnly:true,terrainSupportUsesDisplacedMesh:true,cameraAffectsGeometry:false};return mesh.soilMicroscope
}

function generateScene(config,progress=()=>{}){
const W=World,w=W.create(config),start=performance.now(),parts=[],step=.5;
progress(.02,'构造原岩与有限裂隙');
const fullMain=W.mesh(w.rock,w.bounds[0],w.bounds[1],step,p=>progress(.02+p*.37,'由体积函数提取固定网格'));
const mainGroups=W.splitComponents(fullMain);const windingRepairs=mainGroups.map(m=>TerrainSupport.orient(m));const main=mainGroups[0],looseSources=mainGroups.slice(1).map(p=>({mesh:p,event:0}));
const grid=fullMain.grid;main.name='主岩体';main.kind=0;main.event=0;main.rest=main.positions.slice();main.N=W.normals(main.positions,main.indices);const geometryAmp=config.stage<2?0:config.stage===2?.31:config.stage===3?.40:.48;const geometryMicroscope=microscopeGeometryR2(main,{amp:geometryAmp,strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:7.2,layers:3,gridStep:step,meshSafetyFraction:.22,directionDeg:18,warp:.92,smoothing:.34,seed:config.seed});parts.push(main);
progress(.45,'生成具有厚度的土体与坡积层');
const soilField=(x,y,z)=>Math.max(y-w.ground(x,z),-7-y,w.perimeter(x,z)*40,-w.rock(x,y,z));
const soil=W.mesh(soilField,[-55,-8,-46],[55,6,46],.75);soil.name='土体与风化基底';soil.kind=3;soil.event=0;TerrainSupport.orient(soil);soil.rest=soil.positions.slice();soil.N=W.normals(soil.positions,soil.indices);const soilMicroscope=soilMicroscopeR1(soil,{strength:config.soilMicro,seed:config.seed,amplitude:.038});parts.push(soil);
const terrain=TerrainSupport.ground(soil),supports=[],rigidFields=[];
const eventRecords=[],fragmentFields=[];
function rememberRigid(m,rec){const P=m.rest||m.positions,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<P.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],P[k+j]);hi[j]=Math.max(hi[j],P[k+j])}const sample=m.grid.at,at=(x,y,z)=>(x<lo[0]-.06||x>hi[0]+.06||y<lo[1]-.06||y>hi[1]+.06||z<lo[2]-.06||z>hi[2]+.06)?99:sample(x,y,z);let radius=Math.hypot(...[0,1,2].map(j=>Math.max(Math.abs(lo[j]-rec.sourceCenter[j]),Math.abs(hi[j]-rec.sourceCenter[j]))))*rec.scale+.15;rigidFields.push({at,radius,...rec});}
if(config.stage>=3)for(const e of w.events){
let lo=e.center.map((v,i)=>Math.floor((v-e.half[i]-4)/step)*step),hi=e.center.map((v,i)=>Math.ceil((v+e.half[i]+4)/step)*step);
const full=W.mesh((x,y,z)=>w.sourceFragment(e,x,y,z),lo,hi,step),groups=W.splitComponents(full);if(!groups[0]?.indices.length)continue;for(let g of groups)TerrainSupport.orient(g);const m=groups[0];for(let p of groups.slice(1))looseSources.push({mesh:p,event:e.id});m.kind=1;m.name=e.name;m.event=e.id;
const rec=TerrainSupport.settle(m,e.dest[0],e.dest[2],e.yaw,1,terrain,'F'+e.id);supports.push(rec);rememberRigid(m,rec);let inside=0;for(let i=0;i<m.positions.length;i+=3)if(grid.at(m.positions[i],m.positions[i+1],m.positions[i+2])<-.12)inside++;
eventRecords.push({...e,...rec,volumeM3:W.volume({positions:m.rest,indices:m.indices}),insideMotherSamples:inside,origin:'same irregular cutting field',trajectory:'not_simulated'});parts.push(m)
}
const looseRecords=[],numericalDust=[];
if(config.stage>=3)for(let li=0;li<looseSources.length;li++){let {mesh:m,event}=looseSources[li];TerrainSupport.orient(m);if(Math.abs(W.volume(m))<1e-7){numericalDust.push({id:'L'+li,volumeM3:W.volume(m),reason:'near-zero disconnected component at fixed precision'});continue}const center=TerrainSupport.center(m);let a=Math.atan2(center[2],center[0])+(.5-W.noise(li,1,9,config.seed))*.36,r=35+4*W.noise(li,2,9,config.seed),x=Math.cos(a)*r,z=Math.sin(a)*r*.87;for(let e of eventRecords)if(Math.hypot(x-e.dest[0],z-e.dest[2])<10){x*=1.15;z*=1.15}
const rec=TerrainSupport.settle(m,x,z,a,1,terrain,'L'+li);m.kind=2;m.event=event;m.name='次级破碎块 '+li;supports.push(rec);rememberRigid(m,rec);looseRecords.push({event,...rec,volumeM3:W.volume({positions:m.rest,indices:m.indices})});parts.push(m);
}
const pocketLocations=[],soilEcology={schema:'LANDSCAPE_KARST_SOIL_ELIGIBILITY_R1',candidateSamples:0,rejectedSteep:0,rejectedClosedSky:0,rejectedCaveInterior:0,rejectedLowEligibility:0,rejectedUnsupported:0,acceptedPockets:0,treeEligiblePockets:0,rules:['sky-open','upward-facing ledge','outside principal cave/notch volumes','supported by rock','summit/ledge/fissure accumulation']};
if(config.stage===4){let pp=[],ii=[],rr=[];for(let i=0;i<main.positions.length/3&&pocketLocations.length<30;i+=53){let k=i*3,x=main.positions[k],y=main.positions[k+1],z=main.positions[k+2];soilEcology.candidateSamples++;
let ny=main.N[k+1];if(ny<.72||y<5||y>49){soilEcology.rejectedSteep++;continue}
let skyOpen=0;for(const off of[[0,0],[.42,0],[-.42,0],[0,.42],[0,-.42]]){let open=true;for(let hh of[1.5,4,8,15,28])if(grid.at(x+off[0],y+hh,z+off[1])<-.04){open=false;break}if(open)skyOpen++}skyOpen/=5;
if(skyOpen<.80){soilEcology.rejectedClosedSky++;continue}
let caveQ=Math.hypot((x+6)/6.8,(y-5.4)/4.7,(z-8.8)/9),notchQ=Math.hypot((x-12)/10,(y-7)/3.7,(z-8)/8);if(caveQ<1.30||notchQ<1.28){soilEcology.rejectedCaveInterior++;continue}
if(pocketLocations.some(q=>Math.hypot(x-q.x,y-q.y,z-q.z)<4.3))continue;
let summit=W.smooth(8,44,y),ledge=W.smooth(.72,.97,ny),fissure=W.noise(x*.19+7.3,y*.11-2.8,z*.17+5.4,config.seed+1409),catchment=W.fbm(x*.055,y*.022,z*.055,config.seed+1423),eligibility=skyOpen*(.30+.31*summit+.22*ledge+.12*fissure+.15*catchment);
if(eligibility<.56){soilEcology.rejectedLowEligibility++;continue}
let rad=.58+W.noise(x,y,z,config.seed+112)*.92,h=.12+W.noise(x,y,z,config.seed+171)*.18,support=0;for(let j=0;j<10;j++){let a=j*Math.PI/5;if(grid.at(x+Math.cos(a)*rad*.78,y-.24,z+Math.sin(a)*rad*.62)<-.05)support++}
if(support<9||grid.at(x,y-.20,z)>-.05){soilEcology.rejectedUnsupported++;continue}
let field=(a,b,c)=>Math.max((Math.sqrt(((a-x)/rad)**2+((b-y-.08)/h)**2+((c-z)/(rad*.75))**2)-1)*h,-grid.at(a,b,c));let m=W.mesh(field,[x-rad-.3,y-h-.3,z-rad],[x+rad+.3,y+h+.4,z+rad],.22);if(!m.indices.length){soilEcology.rejectedUnsupported++;continue}
let first=pp.length/3;pp.push(...m.positions);rr.push(...m.positions);for(let v of m.indices)ii.push(v+first);let treeEligible=skyOpen>.95&&ny>.80&&y>9&&eligibility>.67;pocketLocations.push({x,y,z,radiusM:rad,thicknessM:h,skyOpen,eligibility,treeEligible})}
if(pp.length){let p={name:'向天开口的积土与植被资格囊',kind:3,event:0,pocket:true,positions:Float32Array.from(pp),rest:Float32Array.from(rr),indices:Uint32Array.from(ii)};p.N=W.normals(p.positions,p.indices);parts.push(p)}
}
soilEcology.acceptedPockets=pocketLocations.length;soilEcology.treeEligiblePockets=pocketLocations.filter(p=>p.treeEligible).length;
const stoneRecords=[],placed=[],families=['stone','rubble','dressed','pebble'];let accepted=0;
const sampler=BrickStone.rng(config.seed+47031);
if(config.stage>=3)for(let attempt=0;attempt<260&&accepted<24;attempt++){
let family=families[accepted%4],id=accepted,angle=sampler()*Math.PI*2,r=24+sampler()*18;
let x=Math.cos(angle)*r,z=Math.sin(angle)*r*.79,scale=.26+sampler()**2*1.0;
if(id<4){const front=[[-6,26],[-15,24],[-24,23],[7,28]][id];x=front[0];z=front[1];scale=id===3?.90:1.35;}
let radius=scale*1.7;
if(w.perimeter(x,z)>-.09||grid.at(x,w.ground(x,z)+scale,z)<radius*.85)continue;
if(eventRecords.some(e=>Math.hypot(x-e.dest[0],z-e.dest[2])<7.0+radius))continue;
if(placed.some(v=>Math.hypot(x-v.x,z-v.z)<radius+v.r+.30))continue;
const seed=id<4?BrickStone.profiles[family].seed:BrickStone.derive(config.seed,'stone-'+id),shape=id<4?'sample':['sample','half','thin','long','wedge'][id%5];
const src=BrickStone.field(family,shape,seed),raw=W.mesh(src.sample,src.bounds[0],src.bounds[1],.10),groups=W.splitComponents(raw),m=groups[0];if(!m?.indices.length)continue;
const orientationRepairs=TerrainSupport.orient(m);
const sourceSignature=W.checksum(m.positions)+':'+W.checksum(m.indices),yaw=sampler()*6.283185;
const rec=TerrainSupport.settle(m,x,z,yaw,scale,terrain,'BM'+(id+1));const p=m.positions;
let collision=false;for(let k=0;k<p.length;k+=3)if(grid.at(p[k],p[k+1],p[k+2])<-.01){collision=true;break}if(collision)continue;
rememberRigid(m,rec);supports.push(rec);m.rest=Float32Array.from(m.rest,v=>v/.13);m.kind=2;m.event=0;m.stoneShader=src.profile.shader;m.name=src.profile.name+' '+(id+1);m.brickSpecimen=true;
parts.push(m);placed.push({x,z,r:radius});stoneRecords.push({id:'BM'+(id+1),family,name:src.profile.name,shape,seed,sourceSignature,source:'HOUSE@53a4b072/atelier-r4/kernel.js',scaleMetres:scale,position:rec.worldCenter,yaw,gridSourceUnits:.10,orientationRepairs,triangles:m.indices.length/3,support:rec,contactScope:'rendered soil triangles, vertices/edge midpoints/face centroids, finite compliant support pose',materialCoordinate:'original specimen volume retained through rigid placement'});accepted++;
}
progress(.55,'计算最终表面的遮挡与坡向');
const colliderBins=new Map(),bc=7,key3=(x,y,z)=>Math.floor(x/bc)+32+96*(Math.floor(y/bc)+16)+9216*(Math.floor(z/bc)+32);
for(let f of rigidFields){let radius=f.radius;
for(let x=Math.floor((f.worldCenter[0]-radius)/bc);x<=Math.floor((f.worldCenter[0]+radius)/bc);x++)for(let y=Math.floor((f.worldCenter[1]-radius)/bc);y<=Math.floor((f.worldCenter[1]+radius)/bc);y++)for(let z=Math.floor((f.worldCenter[2]-radius)/bc);z<=Math.floor((f.worldCenter[2]+radius)/bc);z++){let k=x+32+96*(y+16)+9216*(z+32);if(!colliderBins.has(k))colliderBins.set(k,[]);colliderBins.get(k).push(f)}
}
function sceneField(x,y,z){let v=grid.at(x,y,z);if(v<-.05)return v;const list=colliderBins.get(key3(x,y,z));if(list)for(let e of list){let dx=(x-e.worldCenter[0])/e.scale,dy=(y-e.worldCenter[1])/e.scale,dz=(z-e.worldCenter[2])/e.scale,r=e.rotation,q=e.sourceCenter;v=Math.min(v,e.at(r[0]*dx+r[3]*dy+r[6]*dz+q[0],r[1]*dx+r[4]*dy+r[7]*dz+q[1],r[2]*dx+r[5]*dy+r[8]*dz+q[2])*e.scale)}return v}
function shade(x,y,z,n){let ax=x+n[0]*.26,ay=y+n[1]*.26,az=z+n[2]*.26,sun=1;for(let s=.28;s<78;s+=Math.max(.36,Math.min(1.3,s*.13))){let v=sceneField(ax+W.SUN[0]*s,ay+W.SUN[1]*s,az+W.SUN[2]*s);if(v<-.045){sun=.018;break}sun=Math.min(sun,W.clamp(.28+v/Math.max(.5,s*.08),.05,1))}
const tangent=W.norm([n[2],.07,-n[0]]);let occ=0;
for(let dist of [.55,1.5,3.5]){for(let sign of[-1,1]){let dir=W.norm(n.map((v,k)=>v*.8+tangent[k]*sign*.65));if(sceneField(ax+dir[0]*dist,ay+dir[1]*dist,az+dir[2]*dist)<-.045)occ+=.10}if(sceneField(ax+n[0]*dist,ay+n[1]*dist,az+n[2]*dist)<-.04)occ+=.10;if(sceneField(ax,ay+dist,az)<-.05)occ+=.105}
for(let h of[8,18])if(sceneField(ax,ay+h,az)<-.06)occ+=.07;let ao=W.clamp(1-occ,.10,1);if(y<7){let groundY=terrain.height(x,z);if(Number.isFinite(groundY)){let gap=y-groundY;if(gap<1.6&&n[1]<.6)ao*=.32+.68*W.smooth(-.04,1.25,gap)}}return [ao,sun];}
const waterReports=[];
function rainOnMesh(p){const P=p.positions,N=p.N,I=p.indices,count=P.length/3,source=new Float64Array(count),a=new Float64Array(count),down=new Int32Array(count).fill(-1),slope=new Float32Array(count);
function route(i,j){const h=P[i*3+1]-P[j*3+1];if(h<=1e-6||N[i*3+1]<-.35)return;const d=Math.hypot(P[i*3]-P[j*3],h,P[i*3+2]-P[j*3+2]),s=h/Math.max(d,1e-6);if(s>slope[i]){slope[i]=s;down[i]=j;}}
for(let k=0;k<I.length;k+=3){let i=I[k],j=I[k+1],l=I[k+2],x=i*3,y=j*3,z=l*3;
let projected=Math.max(0,((P[y+2]-P[x+2])*(P[z]-P[x])-(P[y]-P[x])*(P[z+2]-P[x+2]))/6);
source[i]+=projected;source[j]+=projected;source[l]+=projected;
route(i,j);route(j,i);route(j,l);route(l,j);route(l,i);route(i,l);}
let supply=0;for(let i=0;i<count;i++){if(source[i]===0)continue;const k=i*3,x=P[k]+N[k]*.31,y=P[k+1]+N[k+1]*.31,z=P[k+2]+N[k+2]*.31;
let exposed=true;for(let h of [.6,2,6,16,40,62])if(sceneField(x,y+h,z)<-.05){exposed=false;break;}
a[i]=exposed?source[i]:0;supply+=a[i];}
const order=Array.from({length:count},(_,i)=>i).sort((i,j)=>P[j*3+1]-P[i*3+1]);let sinks=0,used=0;
for(let i of order){if(down[i]>=0){a[down[i]]+=a[i];if(a[i]>0)used++;}else sinks+=a[i];}
const output=Float32Array.from(a,v=>1-Math.exp(-v/7));
for(let pass=0;pass<3;pass++){const sums=new Float32Array(output),weights=new Float32Array(count).fill(1);
for(let k=0;k<I.length;k+=3)for(let e=0;e<3;e++){const i=I[k+e],j=I[k+(e+1)%3];const w=Math.max(0,N[i*3]*N[j*3]+N[i*3+1]*N[j*3+1]+N[i*3+2]*N[j*3+2])*.40;sums[i]+=output[j]*w;weights[i]+=w;sums[j]+=output[i]*w;weights[j]+=w;}
for(let i=0;i<count;i++)output[i]=sums[i]/weights[i];}
waterReports.push({part:p.name,sourceProjectedAreaM2:supply,terminalAreaM2:sinks,balanceErrorM2:Math.abs(sinks-supply),routedVertices:used,scope:'one final-surface projected-area proxy; sinks include breaks, not solved infiltration'});return output;
}
for(let pi=0;pi<parts.length;pi++){const p=parts[pi],P=p.positions,N=p.N,V=new Float32Array(P.length/3*16),water=p.kind<3?rainOnMesh(p):null;let over=0;
for(let i=0;i<P.length/3;i++){let k=i*3,x=P[k],y=P[k+1],z=P[k+2],n=[N[k],N[k+1],N[k+2]],s=shade(x,y,z,n),j=i*16;V.set([x,y,z,...n,p.rest[k],p.rest[k+1],p.rest[k+2],p.kind,s[0],s[1],p.kind<3?(p.stoneShader||1):(p.pocket?.12:w.ground(x,z)-y),p.pocket?.45:w.soilThickness(x,z),p.event,water?water[i]:0],j);if(n[1]<-.18&&y>0)over++}
p.vertices=V;p.overhangVertices=over;delete p.grid;progress(.55+.25*(pi+1)/parts.length,'表面与材料使用同一最终几何')
}
function capMesh(field,lo,hi,h,kind){let P=[],I=[];function triangle(verts){let a=verts.map(v=>[...v,field(v[0],v[1],0)]),o=[];for(let k=0;k<3;k++){let u=a[k],v=a[(k+1)%3];if(u[2]<=0)o.push([u[0],u[1]]);if((u[2]<0)!==(v[2]<0)){let t=u[2]/(u[2]-v[2]);o.push([W.mix(u[0],v[0],t),W.mix(u[1],v[1],t)])}}if(o.length<3)return;let base=P.length/3;for(let v of o)P.push(v[0],v[1],.002);for(let k=1;k<o.length-1;k++)I.push(base,base+k,base+k+1)}
for(let y=lo[1];y<hi[1];y+=h)for(let x=lo[0];x<hi[0];x+=h){triangle([[x,y],[x+h,y],[x,y+h]]);triangle([[x+h,y],[x+h,y+h],[x,y+h]])}
let positions=Float32Array.from(P),indices=Uint32Array.from(I),V=new Float32Array(P.length/3*16);for(let i=0;i<P.length/3;i++){let x=P[i*3],y=P[i*3+1];V.set([x,y,.002,0,0,1,x,y,0,kind,.95,1,w.ground(x,0)-y,w.soilThickness(x,0),0,0],i*16)}return{name:kind===4?'岩体截面':'土壤截面',kind,event:0,positions,indices,vertices:V,cap:true};
}
parts.push(capMesh(w.rock,[-33,-7],[27,53],.5,4));
parts.push(capMesh((x,y,z)=>Math.max(soilField(x,y,z),-w.rock(x,y,z)),[-54,-7],[54,5],.5,5));
let unpackedBytes=0;for(const p of parts){unpackedBytes+=p.vertices.byteLength+p.indices.byteLength;p.stride=16;
if(p.kind===0||p.kind===3||p.kind===6){const old=p.vertices,n=old.length/16,v=new Float32Array(n*13);
for(let i=0;i<n;i++){const a=i*16,b=i*13;v.set(old.subarray(a,a+6),b);v.set(old.subarray(a+9,a+16),b+6);}p.vertices=v;p.stride=13;}}
const report={config:{...config},microscopeGeometry:geometryMicroscope,soilMicroscope,builtInMs:performance.now()-start,geometryGridM:step,generationBounds:w.bounds,mainVertices:main.positions.length/3,mainTriangles:main.indices.length/3,overhangVertices:main.overhangVertices,looseComponentCount:looseSources.length,looseComponentsPlaced:looseRecords,sourceGeography:'authored local specimen; not surveyed Putao',yearsCalibrated:false,events:eventRecords,soilPockets:pocketLocations,statisticalGravel:accepted,brickStoneTransfer:stoneRecords,materialSource:{repo:"haihao0307/HOUSE",commit:"53a4b0728678e31ba4ebf2a9267a213597d8f226",path:"experiments/atelier-r4/src/renderer.js",interpretation:"user-selected limestone-look candidate; source categories retain their original names"},parts:parts.map(p=>({name:p.name,kind:p.kind,vertices:p.positions.length/3,triangles:p.indices.length/3,signature:W.checksum(p.positions)+':'+W.checksum(p.indices)}))};
report.soilEcology=soilEcology;report.vegetationEligibility=pocketLocations.filter(p=>p.treeEligible);report.numericalDust=numericalDust;report.supports=supports;report.supportGroundTriangles=terrain.triangles;report.windingRepairs=windingRepairs;report.erosion=w.erosion?{reference:'substrate projection; uncalibrated morphology',paths:w.erosion.paths.length,segments:w.erosion.segments.length,cavities:w.erosion.cavities.length,nested:w.erosion.cavities.filter(p=>p.parent).length,pores:w.erosion.cavities.map(p=>({id:p.id,parent:p.parent,center:p.C,radii:p.r}))}:null;
let bytes=parts.reduce((s,p)=>s+p.vertices.byteLength+p.indices.byteLength,0);report.generatedRenderBytes=bytes;report.unpackedRenderBytes=unpackedBytes;report.waterRouting=waterReports;
for(const p of parts){delete p.N;delete p.rest;delete p.positions}
progress(1,'完成');return {parts,report};
}
if(typeof module!=='undefined')module.exports=generateScene;


self.onmessage=e=>{
  try{
    const data=generateScene(e.data,(p,text)=>self.postMessage({p,text}));
    const transfer=[];
    for(const part of data.parts)transfer.push(part.vertices.buffer,part.indices.buffer);
    self.postMessage({data},transfer);
  }catch(error){
    self.postMessage({error:error&&error.stack?error.stack:String(error)});
  }
};
