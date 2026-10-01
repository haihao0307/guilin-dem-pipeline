(function(){
'use strict';
const COUNT=30,TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0);
const difference=(a,b)=>a.map((x,k)=>x-b[k]);
function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};}
function variants(count=COUNT,seed=90401){const r=random(seed),tones=[[.965,1.003,1.045],[.953,1.008,1.055],[.973,.997,1.036],[.960,1.012,1.052],[.969,1.002,1.044]];return Array.from({length:count},(_,i)=>{const size=i? .76+.30*r():1,length=i?.94+.12*r():1,depth=i?.94+.12*r():1,width=i?.93+.14*r():1;return{id:i,size,length,depth,width,scale:[size*length,size*depth,size*width],tint:i?tones[i%tones.length].map(v=>v*(.998+.004*r())):tones[0].slice(),brightness:i?.975+.05*r():1,saturation:i?.915+.03*r():.93,phase:TAU*i/count,tempo:.94+.12*r(),eyeOffset:(r()-.5)*.016};});}
// Engineering interaction settings, not a species-specific biological fit.
const SETTINGS=Object.freeze({neighbors:7,neighborRange:3.0,maxAcceleration:.20,maxTurnRate:.28,maxPitch:.24,maxRoll:.11,minSpeed:.16,maxSpeed:.64,pointerRadius:1.8,burstRadius:4.5,panicDecay:1.1,panicTransmission:.82});
// Port the reference view-ray and fading radial forces; use bounded acceleration,
// not the reference's 17-unit panic speed. Thirty full meshes need no GPU grid.
function setPointer(s,ray){s.interaction.ray=ray?{origin:ray.origin.slice(),direction:norm(ray.direction)}:null;}
function disturb(s,point){s.interaction.burstPoint=point.slice();s.interaction.burst=1;s.interaction.events++;}
function clearInteraction(s){s.interaction.ray=null;s.interaction.active=0;s.interaction.burst=0;s.interaction.burstPoint=null;}
function create(count=COUNT,seed=90401){
 const rng=random(seed^0x5d178a31),fish=[];
 for(const variant of variants(count,seed)){
  const radius=.61*Math.max(...variant.scale);let p=null;
  for(let attempt=0;attempt<10000;attempt++){const q=[(rng()*2-1)*4.4,(rng()*2-1)*1.8,(rng()*2-1)*3.0];if((q[0]/4.4)**2+(q[1]/1.8)**2+(q[2]/3.0)**2>1)continue;q[1]+=.14;if(fish.every(f=>Math.hypot(...difference(q,f.p))>radius+f.radius+.16)){p=q;break;}}
  if(!p)throw Error('Unable to initialize non-overlapping thirty-fish volume');
  const speed=.34*variant.tempo,pitch=.025*Math.sin(variant.id*2.31),v=[speed*Math.cos(pitch),speed*Math.sin(pitch),0];
  fish.push({variant,p,v,yaw:Math.PI,pitch,roll:0,radius,acceleration:[0,0,0],turnRate:0,gaitFrequency:1,gaitAmplitude:1,neighborIds:[],contactCorrections:0,panic:0,directExposure:0});
 }
 return{fish,time:0,accumulator:0,steps:0,minClearance:Infinity,contactCorrections:0,maxContactDisplacement:0,interaction:{ray:null,active:0,burstPoint:null,burst:0,events:0}};
}
function step(s,dt){
 const count=s.fish.length,center=s.fish.reduce((c,f)=>c.map((x,k)=>x+f.p[k]/count),[0,0,0]),input=s.interaction;
 input.active+=((input.ray?1:0)-input.active)*(1-Math.exp(-dt*5));input.burst*=Math.exp(-dt*2.4);
 // A weak shared cruising cue. No fish has a permanent target position.
 const t=s.time+dt,heading=.043*t+.18*Math.sin(.051*t),flow=norm([Math.cos(heading),.035*Math.sin(.043*t),Math.sin(heading)]),baseSpeed=.34+.025*Math.sin(.039*t),next=[];
 for(let i=0;i<count;i++){
  const f=s.fish[i],forward=norm(f.v),candidates=[],acc=[0,0,0];
  for(let j=0;j<count;j++){if(i===j)continue;const q=s.fish[j],d=difference(q.p,f.p),L=Math.hypot(...d),safe=f.radius+q.radius+.035,unit=norm(d);
   if(L<SETTINGS.neighborRange&&dot(forward,unit)>-.70)candidates.push({q,L,j});
   // All-direction predictive near-field avoidance remains active behind fish.
   const approaching=dot(difference(f.v,q.v),unit),predicted=L-Math.max(0,approaching)*1.5,margin=safe+.45;
   if(predicted<margin){const force=1.4*Math.max(0,margin-predicted);for(let k=0;k<3;k++)acc[k]-=unit[k]*force;}
  }
  candidates.sort((a,b)=>a.L-b.L||a.j-b.j);const neighbors=candidates.slice(0,SETTINGS.neighbors);f.neighborIds=neighbors.map(n=>n.j);
  let hover=0,burst=0;
  if(input.ray){const offset=difference(f.p,input.ray.origin),depth=Math.max(0,dot(offset,input.ray.direction)),perp=offset.map((x,k)=>x-input.ray.direction[k]*depth),L=Math.hypot(...perp);hover=clamp(1-L/SETTINGS.pointerRadius,0,1)*input.active;const away=L>1e-7?norm(perp):norm(crossFallback(input.ray.direction,i));for(let k=0;k<3;k++)acc[k]+=.32*hover*hover*away[k];}
  if(input.burstPoint){const d=difference(f.p,input.burstPoint),L=Math.hypot(...d);burst=clamp(1-L/SETTINGS.burstRadius,0,1)*input.burst;const away=L>1e-7?norm(d):[0,1,0];for(let k=0;k<3;k++)acc[k]+=.36*burst*away[k];}
  // Read previous-step neighbor excitation so transmission is order independent.
  const panic=clamp(Math.max(f.panic*Math.exp(-dt*SETTINGS.panicDecay),hover,burst,...neighbors.map(({q})=>q.panic*SETTINGS.panicTransmission)),0,1);
  if(neighbors.length)for(const {q} of neighbors)for(let k=0;k<3;k++)acc[k]+=(.8*(q.v[k]-f.v[k])+.030*(1-.7*panic)*(q.p[k]-f.p[k]))/neighbors.length;
  const preference=(baseSpeed+.18*panic)*f.variant.tempo*(1+.045*Math.sin(.11*t+f.variant.id*1.91));
  for(let k=0;k<3;k++)acc[k]+=.48*(flow[k]*preference-f.v[k]);
  const fromCenter=difference(center,f.p),radius=Math.hypot(...fromCenter);
  if(radius>3.2)for(let k=0;k<3;k++)acc[k]+=.028*(radius-3.2)*fromCenter[k]/radius;
  // Limit vertical extent gently without putting fish into horizontal layers.
  const vertical=f.p[1]-center[1];if(Math.abs(vertical)>1.25)acc[1]-=.07*Math.sign(vertical)*(Math.abs(vertical)-1.25);
  const magnitude=Math.hypot(...acc);if(magnitude>SETTINGS.maxAcceleration)for(let k=0;k<3;k++)acc[k]*=SETTINGS.maxAcceleration/magnitude;
  let v=f.v.map((x,k)=>x+acc[k]*dt),speed=clamp(Math.hypot(...v),SETTINGS.minSpeed,SETTINGS.maxSpeed),desired=norm(v);
  const oldHeading=Math.atan2(f.v[2],f.v[0]),wantedHeading=Math.atan2(desired[2],desired[0]),angle=Math.atan2(Math.sin(wantedHeading-oldHeading),Math.cos(wantedHeading-oldHeading));
  const directionAngle=oldHeading+clamp(angle,-SETTINGS.maxTurnRate*dt,SETTINGS.maxTurnRate*dt),verticalAngle=clamp(Math.asin(clamp(desired[1],-1,1)),-SETTINGS.maxPitch,SETTINGS.maxPitch);
  v=[speed*Math.cos(verticalAngle)*Math.cos(directionAngle),speed*Math.sin(verticalAngle),speed*Math.cos(verticalAngle)*Math.sin(directionAngle)];
  next.push({p:f.p.map((x,k)=>x+v[k]*dt),v,acc:acc.slice(),panic,exposure:Math.max(hover,burst)});
 }
 for(let i=0;i<count;i++){const f=s.fish[i];f.p=next[i].p;f.v=next[i].v;f.acceleration=next[i].acc;f.panic=next[i].panic;f.directExposure=next[i].exposure;}
 // Conservative animated body enclosing spheres: rare residual contact guard.
 for(let pass=0;pass<6;pass++)for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
  const a=s.fish[i],b=s.fish[j],d=difference(a.p,b.p),L=Math.hypot(...d),minimum=a.radius+b.radius+.035;
  if(L<minimum){const axis=L>1e-8?d.map(x=>x/L):[1,0,0],push=(minimum-L)/2;s.contactCorrections++;s.maxContactDisplacement=Math.max(s.maxContactDisplacement,push);a.contactCorrections++;b.contactCorrections++;for(let k=0;k<3;k++){a.p[k]+=axis[k]*push;b.p[k]-=axis[k]*push;}}
 }
 for(const f of s.fish){
  const speed=Math.hypot(...f.v),desiredYaw=Math.atan2(f.v[2],-f.v[0]),error=Math.atan2(Math.sin(desiredYaw-f.yaw),Math.cos(desiredYaw-f.yaw)),yawStep=clamp(error*(1-Math.exp(-dt*9)),-SETTINGS.maxTurnRate*dt,SETTINGS.maxTurnRate*dt);
  f.yaw+=yawStep;f.turnRate=yawStep/dt;f.pitch+=(Math.asin(clamp(f.v[1]/speed,-1,1))-f.pitch)*(1-Math.exp(-dt*7));
  f.roll+=(clamp(-f.turnRate*.22,-SETTINGS.maxRoll,SETTINGS.maxRoll)-f.roll)*(1-Math.exp(-dt*5));
  const ratio=clamp(speed/(.34*f.variant.size),.6,1.5),frequency=clamp(ratio**.58,.78,1.28),amplitude=clamp(.88+.16*ratio+.22*Math.hypot(...f.acceleration),.94,1.18);
  f.gaitFrequency+=(frequency-f.gaitFrequency)*(1-Math.exp(-dt*2.4));f.gaitAmplitude+=(amplitude-f.gaitAmplitude)*(1-Math.exp(-dt*2.4));
 }
 s.time=t;s.steps++;for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)s.minClearance=Math.min(s.minClearance,Math.hypot(...difference(s.fish[i].p,s.fish[j].p))-s.fish[i].radius-s.fish[j].radius);
}
function update(s,delta,speed=1){s.accumulator+=Math.min(.12,Math.max(0,delta))*speed;while(s.accumulator+1e-12>=1/60){s.accumulator-=1/60;step(s,1/60);}return s;}
function crossFallback(dir,id){const a=Math.abs(dir[1])<.9?[0,1,0]:[1,0,0];return [dir[1]*a[2]-dir[2]*a[1],dir[2]*a[0]-dir[0]*a[2],dir[0]*a[1]-dir[1]*a[0]].map(x=>x*(id%2?1:-1));}
function rotation(f,school=true){const yaw=school?f.yaw:0,pitch=school?f.pitch:0,roll=school?f.roll:0,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);return [[cy*cp,-sp,-sy*cp],[cy*sp*cr+sy*sr,cp*cr,-sy*sp*cr+cy*sr],[-cy*sp*sr+sy*cr,-cp*sr,sy*sp*sr+cy*cr]];}
function model(f,school=true){const sc=f.variant.scale,p=school?f.p:[0,.14,0],R=rotation(f,school);return new Float32Array([...R[0].map(v=>v*sc[0]),0,...R[1].map(v=>v*sc[1]),0,...R[2].map(v=>v*sc[2]),0,...p.map((x,k)=>x-.14*R[1][k]*sc[1]),1]);}
globalThis.KaopuSchoolMotion=Object.freeze({COUNT,SETTINGS,variants,create,update,model,rotation,setPointer,disturb,clearInteraction});
})();
