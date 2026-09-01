/* Ocean Mother / Coast 0.1.0. Independent numerical implementation.
   Depth-averaged finite-volume water; foam and smoke are uncalibrated tracers.
   No images, external geometry or copied solver implementation. SI coordinates. */
export const VERSION='0.1.0-coast';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export function hash(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967296;}
export function derive(seed,name){let s=seed>>>0;for(const c of name)s=Math.imul(s^c.charCodeAt(0),16777619);return s>>>0;}
export const DEFAULT={seed:8071,amplitude:.85,period:6.8,smallWaves:.18,wind:5,direction:270,foam:1,fire:1,smoke:1.2};
const limits={seed:[0,4294967295],amplitude:[0,1.5],period:[4,12],smallWaves:[0,.5],wind:[0,16],direction:[0,360],foam:[0,2],fire:[0,2],smoke:[0,2]};
export function validateProfile(p){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid coast profile');for(const k of Object.keys(p))if(!Object.hasOwn(limits,k))throw Error('Unknown parameter: '+k);for(const [k,[a,b]]of Object.entries(limits))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b||(k==='seed'&&!Number.isInteger(p[k])))throw Error('Invalid parameter: '+k);return {...p};}
export function shore(z){return 7.5+1.6*Math.sin(z*.13)+.65*Math.sin(z*.39+.8);}
export function sandBed(x,z){const d=x-shore(z);return .105*d+.13*Math.sin(z*.19)*Math.exp(-d*d/400)+.012*Math.sin(z*5.1+x*.8)*Math.sin(x*1.8);}
export const ROCKS=[{x:5.4,z:9,rx:3.3,rz:2.6,ry:3.7,id:1},{x:9,z:12.8,rx:2.1,rz:2.8,ry:2.3,id:2},{x:1,z:-12,rx:2.3,rz:1.9,ry:2.1,id:3},{x:12,z:-15,rx:3.8,rz:2.8,ry:3.5,id:4},{x:13,z:-9.5,rx:2.2,rz:1.7,ry:1.8,id:5},{x:20,z:8.5,rx:1.5,rz:1.15,ry:1.2,id:6}];
export const FIRE=[15.2,0,-5.5];FIRE[1]=sandBed(FIRE[0],FIRE[2])+.18;
export function rockShape(x,z,r){const a=(x-r.x)/r.rx,b=(z-r.z)/r.rz,rr=a*a+b*b;if(rr>=1)return -1e6;const theta=Math.atan2(b,a);return sandBed(r.x,r.z)+r.ry*Math.pow(1-rr,.56)*(1+.075*Math.sin(theta*5+r.id)+.04*Math.sin(x*3.2+z*2.7));}
export function bed(x,z){let y=sandBed(x,z);for(const r of ROCKS)y=Math.max(y,rockShape(x,z,r));return y;}
export function windVector(p,t){const q=p.direction*Math.PI/180,gust=1+.15*(.65*Math.sin(t*.39)+.35*Math.sin(t*.13+1.3));return[-Math.sin(q)*p.wind*gust,0,Math.cos(q)*p.wind*gust];}
export class CoastState{
 constructor(profile=DEFAULT,{nx=144,nz=112,bedFn=bed,bounds=[-34,30,-28,28],forced=true}={}){
  this.profile=validateProfile(profile);this.nx=nx;this.nz=nz;this.bounds=bounds;this.dx=(bounds[1]-bounds[0])/nx;this.dz=(bounds[3]-bounds[2])/nz;this.n=nx*nz;this.dt=1/120;this.t=0;this.steps=0;this.forced=forced;this.events=[];this.epoch=0;
  for(const k of ['h','qx','qz','b','dh','dqx','dqz','foam','nextFoam','wet'])this[k]=new Float64Array(this.n);
  this.sourceVolume=0;this.boundaryVolume=0;this.numericalVolume=0;this.maxCfl=0;this.heat=0;this.smokeParticles=[];this.spray=[];this.emitterCredit=0;this.smokeOrdinal=0;this.sprayOrdinal=0;this.emitCount=0;this.maxParticles=28;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=this.x(i),z=this.z(j);this.b[k]=bedFn(x,z);this.h[k]=Math.max(0,-this.b[k]);this.wet[k]=this.h[k]>.002?1:0;}
  this.initialVolume=this.volume();this.bedFn=bedFn;
 }
 x(i){return this.bounds[0]+(i+.5)*this.dx} z(j){return this.bounds[2]+(j+.5)*this.dz}
 volume(){let s=0;for(const h of this.h)s+=h;return s*this.dx*this.dz}
 change(key,value,record=true){const p=validateProfile({...this.profile,[key]:value});if(key==='seed'&&p.seed!==this.profile.seed)throw Error('Seed changes require a new scene');this.profile=p;if(record)this.events.push({step:this.steps,key,value});}
 sample(a,x,z){const fx=clamp((x-this.bounds[0])/this.dx-.5,0,this.nx-1),fz=clamp((z-this.bounds[2])/this.dz-.5,0,this.nz-1),i=Math.min(this.nx-2,Math.floor(fx)),j=Math.min(this.nz-2,Math.floor(fz)),u=fx-i,v=fz-j,k=j*this.nx+i;return mix(mix(a[k],a[k+1],u),mix(a[k+this.nx],a[k+this.nx+1],u),v);}
 surface(x,z){const fx=clamp((x-this.bounds[0])/this.dx-.5,0,this.nx-1),fz=clamp((z-this.bounds[2])/this.dz-.5,0,this.nz-1),i=Math.min(this.nx-2,Math.floor(fx)),j=Math.min(this.nz-2,Math.floor(fz)),u=fx-i,v=fz-j,k=j*this.nx+i;let total=0,eta=0;for(const [id,w]of [[k,(1-u)*(1-v)],[k+1,u*(1-v)],[k+this.nx,(1-u)*v],[k+this.nx+1,u*v]])if(this.h[id]>.003){total+=w;eta+=w*(this.b[id]+this.h[id]);}return total>1e-9?eta/total:this.bedFn(x,z)}
 // Hydrostatic reconstruction, Rusanov flux, matched one-sided bed corrections.
 flux(l,r,axis){const g=9.81,hl=this.h[l],hr=this.h[r],bl=this.b[l],br=this.b[r],bmax=Math.max(bl,br),a=Math.max(0,hl+bl-bmax),b=Math.max(0,hr+br-bmax),ul=hl>1e-7?this.qx[l]/hl:0,vl=hl>1e-7?this.qz[l]/hl:0,ur=hr>1e-7?this.qx[r]/hr:0,vr=hr>1e-7?this.qz[r]/hr:0;
 const un=axis?vl:ul,unr=axis?vr:ur,s=Math.max(Math.abs(un)+Math.sqrt(g*a),Math.abs(unr)+Math.sqrt(g*b)),f=.5*(a*un+b*unr)-.5*s*(b-a),fx=.5*(a*un*ul+b*unr*ur+(axis?0:.5*g*(a*a+b*b)))-.5*s*(b*ur-a*ul),fz=.5*(a*un*vl+b*unr*vr+(axis?.5*g*(a*a+b*b):0))-.5*s*(b*vr-a*vl),inv=1/(axis?this.dz:this.dx),cl=.5*g*(hl*hl-a*a),cr=.5*g*(hr*hr-b*b);
 this.dh[l]-=f*inv;this.dh[r]+=f*inv;this.dqx[l]-=(fx+(axis?0:cl))*inv;this.dqx[r]+=(fx+(axis?0:cr))*inv;this.dqz[l]-=(fz+(axis?cl:0))*inv;this.dqz[r]+=(fz+(axis?cr:0))*inv;
 }
 step(envWind=null){const dt=this.dt,nx=this.nx,nz=this.nz,p=this.profile;this.dh.fill(0);this.dqx.fill(0);this.dqz.fill(0);
  for(let j=0;j<nz;j++)for(let i=0;i<nx-1;i++)this.flux(j*nx+i,j*nx+i+1,0);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)this.flux(j*nx+i,((j+1)%nz)*nx+i,1);
  // Reflecting X boundaries, exactly zero mass flux. West forcing is a measured source.
  for(let j=0;j<nz;j++){let k=j*nx;this.dqx[k]+=.5*9.81*this.h[k]**2/this.dx;k+=nx-1;this.dqx[k]-=.5*9.81*this.h[k]**2/this.dx;}
  const wind=envWind||windVector(p,this.t);
  for(let k=0;k<this.n;k++){let h=this.h[k]+dt*this.dh[k];if(h<0){this.numericalVolume-=h*this.dx*this.dz;h=0;}this.h[k]=h;
   let x=this.qx[k]+dt*this.dqx[k],z=this.qz[k]+dt*this.dqz[k];const damp=1/(1+dt*.016*Math.hypot(x,z)/Math.max(h*h,.005));x*=damp;z*=damp;
   if(h<1e-7){x=0;z=0;}else if(this.forced&&h>.05){const a=dt*.000012*Math.hypot(wind[0],wind[2])*h/(h+.3);x+=a*wind[0];z+=a*wind[2];}
   this.qx[k]=x;this.qz[k]=z;const c=dt*((Math.abs(x)/Math.max(h,1e-7)+Math.sqrt(9.81*h))/this.dx+(Math.abs(z)/Math.max(h,1e-7)+Math.sqrt(9.81*h))/this.dz);this.maxCfl=Math.max(this.maxCfl,c);
   if(!Number.isFinite(h)||c>1.5)throw Error('Water solver stability limit reached '+JSON.stringify({k,h,x,z,c,t:this.t}));
  }
  if(this.forced){const ramp=Math.min(1,this.t/2);for(let j=0;j<nz;j++)for(let i=0;i<6;i++){const k=j*nx+i,d=Math.max(.2,-this.b[k]),c=Math.sqrt(9.81*d),phase=2*Math.PI*((this.t-(this.x(i)-this.bounds[0])/c)/p.period)+.10*Math.sin(this.z(j)*.21),eta=ramp*p.amplitude*(Math.sin(phase)+.12*Math.sin(2*phase))+.25*p.smallWaves*Math.sin(phase*2.4+this.z(j)*.4),goal=Math.max(0,d+eta),rate=(1-i/6)*dt*3,dh=(goal-this.h[k])*rate;this.h[k]+=dh;this.sourceVolume+=dh*this.dx*this.dz;this.qx[k]=mix(this.qx[k],eta*c,rate);this.qz[k]*=1-rate;}}
  // Foam is an art-directed, nonconservative surface coverage tracer. Not water mass.
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,h=this.h[k],u=this.qx[k]/Math.max(h,.02),v=this.qz[k]/Math.max(h,.02),x=this.x(i),z=this.z(j),adv=this.sample(this.foam,x-u*dt,z-v*dt)*Math.exp(-dt/7),left=k-Math.min(i,1),right=k+Math.min(nx-i-1,1),slope=Math.abs((this.h[right]+this.b[right]-this.h[left]-this.b[left])/(2*this.dx)),breaking=h>.018&&h<2.2?clamp((Math.hypot(u,v)/Math.sqrt(9.81*h)-.52)*.8+slope*.6*Math.min(1,Math.hypot(u,v)),0,1):0;
   this.nextFoam[k]=h>.002?clamp(adv+dt*p.foam*breaking*2.5,0,1):adv*Math.exp(-dt*1.2);this.wet[k]=h>.008?Math.min(1,this.wet[k]+dt*5):this.wet[k]*Math.exp(-dt/50);
   if(this.steps%8===0&&h>.02&&h<1.5&&breaking>.19&&this.spray.length<650&&hash(k+Math.imul(this.steps,197)+p.seed)<breaking*.085){let q=this.sprayOrdinal++;this.spray.push({x,y:this.b[k]+h,z,vx:u+hash(q+71)*.8,vy:1.1+hash(q+59)*2.5,vz:v+(hash(q+17)-.5)*1.5,age:0,life:.5+hash(q+5)*.9,size:.025+hash(q+11)*.045});}
  }
  [this.foam,this.nextFoam]=[this.nextFoam,this.foam];
  for(const s of this.spray){s.age+=dt;s.vy-=9.81*dt;s.vx+=wind[0]*dt*.1;s.vz+=wind[2]*dt*.1;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}
  this.spray=this.spray.filter(s=>s.age<s.life&&s.y>this.surface(s.x,s.z)+.015);
  this.heat+=(p.fire-this.heat)*(1-Math.exp(-dt/.7));this.emitterCredit+=dt*Math.min(3.2,this.heat*3.2);
  while(this.emitterCredit>=1){this.emitterCredit--;const n=this.smokeOrdinal++,s=derive(p.seed,'smoke'),r=hash(s+n*137);if(p.smoke>0)this.smokeParticles.push({x:FIRE[0]+(r-.5)*.6,y:FIRE[1]+.7,z:FIRE[2]+(hash(s+n*313)-.5)*.6,vx:0,vy:2.1+r*.8,vz:0,age:0,life:8,radius:.85,heat:this.heat,load:p.smoke*this.heat*2.2,id:n});this.emitCount++;}
  for(const s of this.smokeParticles){s.age+=dt;s.radius=.85+.23*s.age;s.heat*=Math.exp(-dt/5);const drag=1-Math.exp(-dt/2.4);s.vx+=(wind[0]*.65-s.vx)*drag;s.vz+=(wind[2]*.65-s.vz)*drag;s.vy+=(.45+1.1*s.heat-s.vy)*dt*.22;s.x+=(s.vx+.3*Math.sin(s.id*3.1+this.t*.7))*dt;s.y+=s.vy*dt;s.z+=(s.vz+.3*Math.cos(s.id*1.7+this.t*.6))*dt;}
  this.smokeParticles=this.smokeParticles.filter(s=>s.age<s.life).slice(-this.maxParticles);
  this.steps++;this.t=this.steps*dt;
 }
 stats(){const volume=this.volume();let f=0,w=0,peak=-1e9,min=1e9,mx=0;for(let k=0;k<this.n;k++){f+=this.foam[k];w+=this.wet[k];if(this.h[k]>.01){peak=Math.max(peak,this.h[k]+this.b[k]);min=Math.min(min,this.h[k]+this.b[k]);mx=Math.max(mx,Math.hypot(this.qx[k],this.qz[k])/Math.max(.02,this.h[k]));}}return {physicalTime:this.t,solverStep:this.dt,steps:this.steps,waterVolumeM3:volume,sourceVolumeM3:this.sourceVolume,numericalCorrectionM3:this.numericalVolume,massResidualM3:volume-this.initialVolume-this.sourceVolume-this.numericalVolume,maxCfl:this.maxCfl,foamCoverageMean:f/this.n,wetMean:w/this.n,peakM:peak,troughM:min,maxSpeed:mx,smokeParticles:this.smokeParticles.length,sprayParticles:this.spray.length,heatProxy:this.heat};}
 fingerprint(){let h=2166136261;for(const a of [this.h,this.qx,this.qz,this.foam,this.wet]){const v=new Uint32Array(a.buffer);for(const x of v)h=Math.imul(h^x,16777619);}for(const p of this.smokeParticles)for(const k of ['x','y','z','heat'])h=Math.imul(h^(Math.round(p[k]*1e6)),16777619);return(h>>>0).toString(16);}
}
