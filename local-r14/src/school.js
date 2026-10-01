(function(){
'use strict';
const COUNT=30,TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const difference=(a,b)=>a.map((x,k)=>x-b[k]);
function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};}
function variants(count=COUNT,seed=90401){const r=random(seed),tones=[[.965,1.003,1.045],[.953,1.008,1.055],[.973,.997,1.036],[.960,1.012,1.052],[.969,1.002,1.044]];return Array.from({length:count},(_,i)=>{const size=i? .76+.30*r():1,length=i?.94+.12*r():1,depth=i?.94+.12*r():1,width=i?.93+.14*r():1;return{id:i,size,length,depth,width,scale:[size*length,size*depth,size*width],tint:i?tones[i%tones.length].map(v=>v*(.998+.004*r())):tones[0].slice(),brightness:i?.975+.05*r():1,saturation:i?.915+.03*r():.93,phase:TAU*i/count,tempo:.94+.12*r(),eyeOffset:(r()-.5)*.016};});}
// Engineering interaction settings, not a species-specific biological fit.
const SETTINGS=Object.freeze({neighbors:9,neighborRange:2.2,maxAcceleration:.20,maxTurnRate:.28,maxPitch:.24,maxRoll:.11,minSpeed:.16,maxSpeed:.64,pointerRadius:1.15,burstRadius:2.8,panicDecay:1.1,panicTransmission:.82,bodyHalfExtent:[.515,.173,.138],clearance:.035});
// All 497,701 animated source vertices were measured in 16 full-surface frames.
// This padded OBB encloses that observation, including fin/tail sweep. Unlike a
// length-sized sphere, it permits close lateral neighbors without cutting fins.
function axes(f){return rotation(f,true);}
function half(f){return SETTINGS.bodyHalfExtent.map((x,k)=>x*f.variant.scale[k]);}
function pair(a,b,offset=difference(b.p,a.p)){
 const A=a.axes||axes(a),B=b.axes||axes(b),ha=a.half||half(a),hb=b.half||half(b);let gap=-Infinity,xBest=1,yBest=0,zBest=0;
 function test(x,y,z,unit=false){const L=unit?1:Math.sqrt(x*x+y*y+z*z);if(L<1e-7)return;const d=offset[0]*x+offset[1]*y+offset[2]*z;let support=0;for(let k=0;k<3;k++){const u=A[k],v=B[k];support+=Math.abs(u[0]*x+u[1]*y+u[2]*z)*ha[k]+Math.abs(v[0]*x+v[1]*y+v[2]*z)*hb[k];}const g=(Math.abs(d)-support)/L;if(g>gap){gap=g;const sign=(d<0?-1:1)/L;xBest=x*sign;yBest=y*sign;zBest=z*sign;}}
 for(let k=0;k<3;k++){const u=A[k],v=B[k];test(u[0],u[1],u[2],true);test(v[0],v[1],v[2],true);}for(let i=0;i<3;i++)for(let j=0;j<3;j++){const u=A[i],v=B[j];test(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);}return{gap,axis:[xBest,yBest,zBest]};
}
// Port the reference view-ray and fading radial forces; use bounded acceleration,
// not the reference's 17-unit panic speed. Thirty full meshes need no GPU grid.
function setPointer(s,ray){s.interaction.ray=ray?{origin:ray.origin.slice(),direction:norm(ray.direction)}:null;}
function disturb(s,point){s.interaction.burstPoint=point.slice();s.interaction.burst=1;s.interaction.events++;}
function clearInteraction(s){s.interaction.ray=null;s.interaction.active=0;s.interaction.burst=0;s.interaction.burstPoint=null;}
function create(count=COUNT,seed=90401){
 const rng=random(seed^0x5d178a31),fish=[];
 for(const variant of variants(count,seed)){
  const radius=.61*Math.max(...variant.scale),pitch=.025*Math.sin(variant.id*2.31),proto={variant,yaw:Math.PI,pitch,roll:0};proto.axes=axes(proto);proto.half=half(proto);let p=null;
  for(let attempt=0;attempt<100000;attempt++){const packing=1+.04*Math.floor(attempt/5000),q=[(rng()*2-1)*2.05*packing,(rng()*2-1)*.70*packing,(rng()*2-1)*1.08*packing];if((q[0]/(2.05*packing))**2+(q[1]/(.70*packing))**2+(q[2]/(1.08*packing))**2>1)continue;q[1]+=.25;proto.p=q;if(fish.every(f=>pair(proto,f).gap>.07)){p=q;break;}}
  if(!p)throw Error('Unable to initialize non-overlapping thirty-fish volume');
  const speed=.34*variant.tempo,v=[speed*Math.cos(pitch),speed*Math.sin(pitch),0];
  fish.push({...proto,p,v,radius,acceleration:[0,0,0],turnRate:0,gaitFrequency:1,gaitAmplitude:1,neighborIds:[],contactCorrections:0,panic:0,directExposure:0});
 }
 return{fish,time:0,accumulator:0,steps:0,minClearance:Infinity,contactCorrections:0,maxContactDisplacement:0,interaction:{ray:null,active:0,burstPoint:null,burst:0,events:0}};
}
function step(s,dt){
 const count=s.fish.length,center=s.fish.reduce((c,f)=>c.map((x,k)=>x+f.p[k]/count),[0,0,0]),input=s.interaction;
 input.active+=((input.ray?1:0)-input.active)*(1-Math.exp(-dt*5));input.burst*=Math.exp(-dt*2.4);
 // A weak shared cruising cue. No fish has a permanent target position.
 const t=s.time+dt,heading=.080*t+.15*Math.sin(.051*t),flow=norm([Math.cos(heading),.025*Math.sin(.043*t),Math.sin(heading)]),baseSpeed=.32+.018*Math.sin(.039*t),next=[];
 for(const f of s.fish){f.axes=axes(f);f.half=half(f);}
 for(let i=0;i<count;i++){
  const f=s.fish[i],forward=norm(f.v),candidates=[],acc=[0,0,0];
  for(let j=0;j<count;j++){if(i===j)continue;const q=s.fish[j],d=difference(q.p,f.p),L=Math.hypot(...d),unit=norm(d);
   if(L<SETTINGS.neighborRange&&dot(forward,unit)>-.70)candidates.push({q,L,j});
   // All-direction predictive near-field avoidance remains active behind fish.
   if(L<f.radius+q.radius+.45){const now=pair(f,q,d),future=pair(f,q,d.map((x,k)=>x+(q.v[k]-f.v[k])*1.4)),predicted=Math.min(now.gap,future.gap),margin=.21;
    if(predicted<margin){const force=2.7*Math.max(0,margin-predicted);for(let k=0;k<3;k++)acc[k]-=now.axis[k]*force;}}
  }
  candidates.sort((a,b)=>a.L-b.L||a.j-b.j);const neighbors=candidates.slice(0,SETTINGS.neighbors);f.neighborIds=neighbors.map(n=>n.j);
  let hover=0,burst=0;
  if(input.ray){const offset=difference(f.p,input.ray.origin),depth=Math.max(0,dot(offset,input.ray.direction)),perp=offset.map((x,k)=>x-input.ray.direction[k]*depth),L=Math.hypot(...perp);hover=clamp(1-L/SETTINGS.pointerRadius,0,1)*input.active;const away=L>1e-7?norm(perp):norm(crossFallback(input.ray.direction,i));for(let k=0;k<3;k++)acc[k]+=.32*hover*hover*away[k];}
  if(input.burstPoint){const d=difference(f.p,input.burstPoint),L=Math.hypot(...d);burst=clamp(1-L/SETTINGS.burstRadius,0,1)*input.burst;const away=L>1e-7?norm(d):[0,1,0];for(let k=0;k<3;k++)acc[k]+=.36*burst*away[k];}
  // Read previous-step neighbor excitation so transmission is order independent.
  const panic=clamp(Math.max(f.panic*Math.exp(-dt*SETTINGS.panicDecay),hover,burst,...neighbors.map(({q})=>q.panic*SETTINGS.panicTransmission)),0,1);
  if(neighbors.length)for(const {q} of neighbors)for(let k=0;k<3;k++)acc[k]+=(1.1*(q.v[k]-f.v[k])+.095*(1-.7*panic)*(q.p[k]-f.p[k]))/neighbors.length;
  const preference=(baseSpeed+.18*panic)*f.variant.tempo*(1+.045*Math.sin(.11*t+f.variant.id*1.91));
  for(let k=0;k<3;k++)acc[k]+=.48*(flow[k]*preference-f.v[k]);
  const fromCenter=difference(center,f.p),radius=Math.hypot(...fromCenter);
  // Collective attraction is smooth, with no permanent slots or individual targets.
  for(let k=0;k<3;k++)acc[k]+=.065*(1-.65*panic)*fromCenter[k];
  if(radius>2.2)for(let k=0;k<3;k++)acc[k]+=.07*(radius-2.2)*fromCenter[k]/radius;
  // Limit vertical extent gently without putting fish into horizontal layers.
  const vertical=f.p[1]-.25;acc[1]-=.08*vertical;if(f.p[1]<-.65)acc[1]+=.15*(-.65-f.p[1]);if(f.p[1]>1.4)acc[1]-=.15*(f.p[1]-1.4);
  const magnitude=Math.hypot(...acc);if(magnitude>SETTINGS.maxAcceleration)for(let k=0;k<3;k++)acc[k]*=SETTINGS.maxAcceleration/magnitude;
  let v=f.v.map((x,k)=>x+acc[k]*dt),speed=clamp(Math.hypot(...v),SETTINGS.minSpeed,SETTINGS.maxSpeed),desired=norm(v);
  const oldHeading=Math.atan2(f.v[2],f.v[0]),wantedHeading=Math.atan2(desired[2],desired[0]),angle=Math.atan2(Math.sin(wantedHeading-oldHeading),Math.cos(wantedHeading-oldHeading));
  const directionAngle=oldHeading+clamp(angle,-SETTINGS.maxTurnRate*dt,SETTINGS.maxTurnRate*dt),verticalAngle=clamp(Math.asin(clamp(desired[1],-1,1)),-SETTINGS.maxPitch,SETTINGS.maxPitch);
  v=[speed*Math.cos(verticalAngle)*Math.cos(directionAngle),speed*Math.sin(verticalAngle),speed*Math.cos(verticalAngle)*Math.sin(directionAngle)];
  next.push({p:f.p.map((x,k)=>x+v[k]*dt),v,acc:acc.slice(),panic,exposure:Math.max(hover,burst)});
 }
 for(let i=0;i<count;i++){const f=s.fish[i];f.p=next[i].p;f.v=next[i].v;f.acceleration=next[i].acc;f.panic=next[i].panic;f.directExposure=next[i].exposure;}
 // Padded animated OBB narrow phase, not the former length-sized sphere guard.
 for(let pass=0;pass<6;pass++)for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
  const a=s.fish[i],b=s.fish[j];if(Math.hypot(...difference(a.p,b.p))>a.radius+b.radius+.1)continue;const contact=pair(a,b);
  if(contact.gap<SETTINGS.clearance){const push=(SETTINGS.clearance-contact.gap)/2;s.contactCorrections++;s.maxContactDisplacement=Math.max(s.maxContactDisplacement,push);a.contactCorrections++;b.contactCorrections++;for(let k=0;k<3;k++){a.p[k]-=contact.axis[k]*push;b.p[k]+=contact.axis[k]*push;}}
 }
 for(const f of s.fish){
  const speed=Math.hypot(...f.v),desiredYaw=Math.atan2(f.v[2],-f.v[0]),error=Math.atan2(Math.sin(desiredYaw-f.yaw),Math.cos(desiredYaw-f.yaw)),yawStep=clamp(error*(1-Math.exp(-dt*9)),-SETTINGS.maxTurnRate*dt,SETTINGS.maxTurnRate*dt);
  f.yaw+=yawStep;f.turnRate=yawStep/dt;f.pitch+=(Math.asin(clamp(f.v[1]/speed,-1,1))-f.pitch)*(1-Math.exp(-dt*7));
  f.roll+=(clamp(-f.turnRate*.22,-SETTINGS.maxRoll,SETTINGS.maxRoll)-f.roll)*(1-Math.exp(-dt*5));
  const ratio=clamp(speed/(.34*f.variant.size),.6,1.5),frequency=clamp(ratio**.58,.78,1.28),amplitude=clamp(.88+.16*ratio+.22*Math.hypot(...f.acceleration),.94,1.18);
  f.gaitFrequency+=(frequency-f.gaitFrequency)*(1-Math.exp(-dt*2.4));f.gaitAmplitude+=(amplitude-f.gaitAmplitude)*(1-Math.exp(-dt*2.4));
 }
 s.time=t;s.steps++;for(const f of s.fish)f.axes=axes(f);for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)s.minClearance=Math.min(s.minClearance,pair(s.fish[i],s.fish[j]).gap);
}
function update(s,delta,speed=1){s.accumulator+=Math.min(.12,Math.max(0,delta))*speed;while(s.accumulator+1e-12>=1/60){s.accumulator-=1/60;step(s,1/60);}return s;}
function crossFallback(dir,id){const a=Math.abs(dir[1])<.9?[0,1,0]:[1,0,0];return [dir[1]*a[2]-dir[2]*a[1],dir[2]*a[0]-dir[0]*a[2],dir[0]*a[1]-dir[1]*a[0]].map(x=>x*(id%2?1:-1));}
function rotation(f,school=true){const yaw=school?f.yaw:0,pitch=school?f.pitch:0,roll=school?f.roll:0,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);return [[cy*cp,-sp,-sy*cp],[cy*sp*cr+sy*sr,cp*cr,-sy*sp*cr+cy*sr],[-cy*sp*sr+sy*cr,-cp*sr,sy*sp*sr+cy*cr]];}
function model(f,school=true){const sc=f.variant.scale,p=school?f.p:[0,.14,0],R=rotation(f,school);return new Float32Array([...R[0].map(v=>v*sc[0]),0,...R[1].map(v=>v*sc[1]),0,...R[2].map(v=>v*sc[2]),0,...p.map((x,k)=>x-.14*R[1][k]*sc[1]),1]);}
globalThis.KaopuSchoolMotion=Object.freeze({COUNT,SETTINGS,variants,create,update,model,rotation,pair,setPointer,disturb,clearInteraction});
})();
