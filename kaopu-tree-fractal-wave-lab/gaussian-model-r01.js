/* Deterministic procedural rest geometry for the Gaussian noise experiment. Not the video scan. */
(()=>{
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1)),mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
function frame(t){let n=norm(cross(t,Math.abs(t[1])>.94?[1,0,0]:[0,1,0]));return[n,norm(cross(t,n)),t];}
function quatY(d){d=norm(d);let q=[d[2],0,-d[0],1+d[1]],l=Math.hypot(...q);return l<1e-5?[1,0,0,0]:q.map(x=>x/l);}
function curl(p,time=0){let c=[0,0,0];for(let o=0;o<4;o++){const f=Math.pow(1.93,o)*.64,a=Math.pow(.51,o);for(let j=0;j<3;j++){const k=norm([[1,.53,-.74],[-.62,1,.37],[.41,-.81,1]][j]);const v=[[.37,1,-.22],[-.57,.21,1],[1,-.32,.57]][j];const ph=dot(k,p)*f+time*(.37+j*.07)+j*2.1+o*.87;c=add(c,mul(cross(k,v),Math.cos(ph)*a));}}return c;}
function hue(h){let f=n=>{let k=(n+h*6)%6;return .16+.80*(1-Math.max(0,Math.min(k,4-k,1)));};return[f(5),f(3),f(1)];}
function sampleTree(){
 const random=rng(731051),data=[],axes=[],tips=[];let barkCount=0,leafCount=0,fiberCount=0;
 function push(p,s,q,c,alpha,kind,mask,phase=0){data.push(...p,kind,...s,mask,...q,...c,alpha,phase,0,0,0);}
 function axis(points,r0,r1,order){
 const dense=[];for(let j=0;j<points.length-1;j++){const a=points[Math.max(0,j-1)],b=points[j],c=points[j+1],d=points[Math.min(points.length-1,j+2)];for(let k=0;k<5;k++){const t=k/5;dense.push(b.map((v,i)=>.5*(2*v+(-a[i]+c[i])*t+(2*a[i]-5*v+4*c[i]-d[i])*t*t+(-a[i]+3*v-3*c[i]+d[i])*t*t*t)));}}dense.push(points.at(-1));axes.push({p:dense,r0,r1,order});}
 const trunk=[[0,0,0],[-.14,1.1,.12],[.14,2.7,.06],[-.15,4.1,.08],[.42,5.8,-.12],[.35,7.4,.08],[.65,9.2,.1],[.4,11.0,.03],[.25,12.4,.12]];axis(trunk,.57,.032,0);
 // Landmark scaffold matched approximately to the old, broad-crowned tree in the clip.
 const boughs=[
 [[.1,2.7,0],[-1.5,2.6,.3],[-2.2,2.25,.4],[-2.9,2.45,.1],[-3.6,3.4,-.1],[-5,3.0,-.3]],
 [[.1,3.1,0],[-1.2,3.8,-.5],[-2.4,3.8,-.7],[-3.2,4.6,-.55],[-4.3,4.8,-.4]],
 [[.4,4.2,0],[1.2,4.5,.15],[2.0,4.05,.6],[2.5,4.2,.8],[3.6,3.7,.7]],
 [[.0,4.5,0],[-1.3,5.6,.4],[-2.3,5.5,.7],[-3.2,6.1,.8],[-4.65,6.0,.8]],
 [[.45,5.65,0],[1.2,6.1,.1],[2.4,5.45,.2],[3.45,5.0,.25],[4.4,5.55,.4],[5.1,5.1,.5]],
 [[.4,6.1,0],[-.7,7.3,.5],[-2.0,7.4,.7],[-3.4,8.35,.6],[-4.35,8.1,.5]],
 [[.4,6.65,0],[1.6,7.3,-.2],[2.9,7.4,-.7],[3.2,8.5,-.65],[4.55,8.5,-.6]],
 [[.4,7.1,0],[-.8,8.1,-.5],[-2,8.35,-.75],[-2.55,9.3,-.8],[-3.7,9.9,-.7]],
 [[.5,7.7,0],[1.3,8.7,.4],[2.0,8.3,.6],[2.5,9.3,.6],[3.5,9.7,.5]],
 [[.6,8.5,0],[-.5,9.1,.2],[-1.0,10.2,.2],[-2.2,10.8,.1],[-2.7,11.6,.2]],
 [[.6,9.1,0],[1.25,9.9,-.25],[2.3,10.7,-.4],[3.0,11.2,-.3]],
 [[.5,9.6,0],[0,10.8,.3],[-.55,11.45,.2],[-1.0,12.35,0]],
 [[.4,6.8,0],[.1,7.2,1.1],[-.9,7.7,2.35],[-1.5,8.9,3.15]],
 [[.45,7.2,0],[1.0,8,-1.25],[.5,9.2,-2.5],[-.2,10.1,-3.0]],
 [[.1,4.9,0],[.35,5.2,-1.3],[-.8,5.7,-2.6],[-1.5,6.2,-3.2]],
 [[.25,5.3,0],[.8,6.2,1.3],[1.9,6.9,2.5],[2.3,7.5,3.0]]];
 function twig(p,d,len,r,level){
  const pts=[p],f=frame(d);let cur=p,dir=d;
  for(let i=1;i<=5;i++){const bend=norm(add(mul(d,1),add(mul(f[0],(random()-.5)*.85),mul(f[1],(random()-.5)*.7))));dir=norm(mix(dir,bend,.65));cur=add(cur,mul(dir,len/5));pts.push(cur);}axis(pts,r,r*.20,level);
  if(level>=4||len<.21){tips.push({p:cur,d:dir,len,seed:random()});return;}
  const bif=2+(level<3&&random()>.55?1:0);
  for(let k=0;k<bif;k++){const theta=(k/bif)*Math.PI*2+random()*.9;const w=.38+random()*.45;const nd=norm(add(mul(dir,.75),add(mul(f[0],Math.cos(theta)*w),mul(f[1],Math.sin(theta)*w))));twig(pts[k===0?5:3+(k%2)],nd,len*(.49+random()*.15),r*.55,level+1);}
 }
 boughs.forEach((b,bi)=>{axis(b,.11+(bi<6?.1:.04),.019,1);for(let j=2;j<b.length;j++){const p=b[j],d=norm(sub(b[j],b[j-1]));const f=frame(d);for(let k=0;k<2;k++){const nd=norm(add(d,add(mul(f[0],(k?1:-1)*(.65+random()*.55)),mul([0,1,0],.35))));twig(p,nd,1.0+random()*1.15,.023+random()*.013,2);}}});
 // Sample bark as individual 3D anisotropic Gaussian ellipsoids, NOT connected tube meshes.
 for(const ax of axes){const lengths=ax.p.slice(1).map((p,i)=>Math.hypot(...sub(p,ax.p[i]))),total=lengths.reduce((s,x)=>s+x,0);let start=0;
  for(let j=0;j<lengths.length;j++){const a=ax.p[j],b=ax.p[j+1],d=norm(sub(b,a)),f=frame(d),l=lengths[j];const rmid=ax.r0+(ax.r1-ax.r0)*(start+l*.5)/total;const n=Math.max(4,Math.ceil(l*(ax.order===0?1300:ax.order===1?430:ax.order===2?140:65)));
   for(let k=0;k<n;k++){const u=random(),t=(start+l*u)/total,phi=random()*Math.PI*2,r=ax.r0+(ax.r1-ax.r0)*Math.pow(t,.82),ridge=1+.13*Math.sin(phi*7+t*19)+.06*Math.sin(phi*13-t*11),normal=add(mul(f[0],Math.cos(phi)),mul(f[1],Math.sin(phi)));const p=add(mix(a,b,u),mul(normal,r*ridge));const light=.29+.70*Math.pow(Math.max(0,dot(normal,norm([-1,.8,1.5]))),.7),lichen=random();const base=lichen>.78?[.59,.62,.58]:lichen>.54?[.39,.40,.36]:[.30,.28,.24];let col=base.map(x=>x*light*(.7+random()*.65));const size=ax.order<2?.012+random()*.015:.006+random()*.012;push(p,[size*.55,size*1.7,size*.55],quatY(d),col,.75,0,clamp((p[1]-2)/10),random());barkCount++;}
   start+=l;}
 }
 const leafTips=tips.filter(t=>t.p[1]>2.6&&t.p[1]<14.2&&Math.abs(t.p[0])<6.4);
 function clump(p,r,n,ivy){for(let j=0;j<n;j++){const v=norm([random()-.5,random()-.5,random()-.5]),rr=Math.cbrt(random()),q=add(p,[v[0]*rr*r,v[1]*rr*r*.74,v[2]*rr*r*.85]);const light=.2+.8*Math.pow(Math.max(0,dot(v,norm([-1,.8,1.5]))),.65),rnd=random(),c=[.18+rnd*.12,.23+rnd*.15,.095+rnd*.10].map(x=>x*light*(.85+random()*.42));const sz=.026+random()*.026;push(q,[sz*1.0,sz*.5,sz*.33],quatY(norm([random()-.5,random()-.5,random()-.5])),c,.90,ivy?3:1,clamp((q[1]-2)/10),random());leafCount++;}}
 for(const t of leafTips)clump(t.p,.56+random()*.44,280,false);
 for(let y=.2;y<9.4;y+=.17){const p=[.34*Math.sin(y*1.9)-.12,y,.05];clump(p,.91+Math.sin(y*.9)*.23,430,true);}
 // Coherent bundles rooted in the same rest structure. Curl trajectories are effects, not branches.
 const origins=leafTips.filter(t=>t.p[1]>6&&Math.abs(t.p[0])<4.7);const bundleCount=48;
 for(let b=0;b<bundleCount;b++){const o=origins[Math.floor(random()*origins.length)],origin=o.p,direction=norm(add(o.d,[o.p[0]*.12,.1,0]));const length=2.2+random()*3.5,h=[[.44,.95,.71],[.94,.64,.80],[.59,.60,1],[.98,.85,.61],[.55,.88,.97],[.86,.56,.97],[.83,.91,.38]][b%7];for(let hidx=0;hidx<20;hidx++){let p=add(origin,[(random()-.5)*.15,(random()-.5)*.15,(random()-.5)*.15]);const max=46+Math.floor(random()*28);for(let j=0;j<max;j++){const s=j/max,v=norm(add(mul(direction,.23),mul(curl(mul(p,1.05),b*.17+hidx*.018),1.0))),next=add(p,mul(v,length/max));const c=h.map(x=>x*(.70+random()*.28));const width=(b%11===0?.013:.0032)*(1-s*.8)*(1+random()*.4);push(mix(p,next,.5),[width,length/max*.72,width*.6],quatY(v),c,b%11===0?.19:.20,2,s,random());p=next;fiberCount++;}}}
 return{array:new Float32Array(data),stats:{bark:barkCount,leaves:leafCount,fibres:fiberCount,axes:axes.length,source:'procedural',originalAsset:false},hash:seedHash(data)};
}
function seedHash(a){let h=2166136261;for(let i=0;i<a.length;i+=20){h=Math.imul(h^(Math.round(a[i]*10000)|0),16777619);}return(h>>>0).toString(16);}

window.KAOPUGaussianModel={rng,clamp,smooth,add,sub,mul,dot,cross,norm,mix,sampleTree,seedHash};
})();
