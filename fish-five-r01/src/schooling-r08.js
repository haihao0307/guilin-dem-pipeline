(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FishSchoolingR08=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='R08_LOCAL_SCHOOL_1',TAU=Math.PI*2;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
 const coord=(p,k)=>p[k]??(k===0?p.x:k===1?p.y:p.z);
 const ease=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
 function create(views,params={},seed=1){
  if(!Array.isArray(views)||views.length<2||views.length>128)throw Error('School requires 2..128 persistent views');
  const n=views.length,k=Math.min(n-1,Math.max(1,Math.floor(params.neighborCount??6))),length=views.reduce((sum,a)=>sum+(a.length??1),0)/n;
  const p={speed:.65,burst:1.7,maxTurn:.75,maxAngularAcceleration:1.35,maxAcceleration:1.0,maxPitch:.28,maxPitchRate:.3,maxPitchAcceleration:.5,maxRoll:.15,maxRollRate:.4,maxRollAcceleration:.7,turnResponse:2.6,speedResponse:1.6,alignment:1.25,attraction:.75,avoidance:2.2,perception:6,preferredGap:.38,gap:.025,initialGap:.24,barrierReserve:.09,barrierTime:1.8,bounds:[7,2.8,5],hoverRatio:.22,restRatio:0,noise:.045,contactPasses:3,barrierPasses:12,...params};
  if(!Number.isFinite(length)||length<=0||!['speed','burst','maxTurn','maxAngularAcceleration','maxAcceleration'].every(key=>Number.isFinite(p[key])&&p[key]>0))throw Error('Invalid school engineering envelope');
  const s={views,params:p,seed:seed>>>0,n,k,length,time:0,mode:'cruise',position:new Float64Array(n*3),velocity:new Float64Array(n*3),axes:new Float64Array(n*9),candidate:new Float64Array(n*3),candidateAxes:new Float64Array(n*9),yaw:new Float64Array(n),pitch:new Float64Array(n),roll:new Float64Array(n),nextYaw:new Float64Array(n),nextPitch:new Float64Array(n),nextRoll:new Float64Array(n),nextSpeed:new Float64Array(n),nextRate:new Float64Array(n),pitchRate:new Float64Array(n),rollRate:new Float64Array(n),nextPitchRate:new Float64Array(n),nextRollRate:new Float64Array(n),neighbor:new Int32Array(n*k),neighborDistance:new Float64Array(n*k),noisePhase:new Float64Array(n),initial:new Float64Array(n*9),normal:new Float64Array(3),rayPoint:new Float64Array(3),accepted:new Float64Array(n),operations:{neighborCandidates:0,activeNeighbors:0,broadPairs:0,satTests:0,contactPairs:0,contactPasses:0,safetyClamps:0},totals:{steps:0,satTests:0,safetyClamps:0},contact:{minimumClearance:Infinity,maxCorrection:0},allocatedBytes:0};
  for(let i=0;i<n;i++){
   const a=views[i];if(!a.position||!a.velocity||!a.half||a.half.length!==3||!a.half.every(x=>Number.isFinite(x)&&x>0))throw Error('View requires position, velocity and full-source positive half extent');
   a.length=a.length??1;a.speed=a.speed??Math.hypot(...a.velocity);a.turnRate=a.turnRate??0;a.threat=a.threat??0;
   a.yaw=a.yaw??Math.atan2(a.velocity[2],-a.velocity[0]);a.pitch=a.pitch??0;a.roll=a.roll??0;
   s.noisePhase[i]=((Math.imul(i+1,2654435761)^s.seed)>>>0)/4294967296*TAU;
   for(let j=0;j<3;j++){s.initial[i*9+j]=a.position[j];s.initial[i*9+3+j]=a.velocity[j];}s.initial[i*9+6]=a.yaw;s.initial[i*9+7]=a.pitch;s.initial[i*9+8]=a.roll;
  }
  s.gradient=new Float64Array(8);s.lower=new Float64Array(n*4);s.upper=new Float64Array(n*4);
  const pairs=n*(n-1)/2;s.pairI=new Int32Array(pairs);s.pairJ=new Int32Array(pairs);s.pairNormal=new Float64Array(pairs*3);s.pairAllowed=new Float64Array(pairs);s.radii=new Float64Array(n);
  for(const value of Object.values(s))if(ArrayBuffer.isView(value))s.allocatedBytes+=value.byteLength;
  read(s);return s;
 }
 function axes(out,k,yaw,pitch,roll){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  out[k]=cy*cp;out[k+1]=-sp;out[k+2]=-sy*cp;out[k+3]=cy*sp*cr+sy*sr;out[k+4]=cp*cr;out[k+5]=-sy*sp*cr+cy*sr;out[k+6]=-cy*sp*sr+sy*cr;out[k+7]=-cp*sr;out[k+8]=sy*sp*sr+cy*cr;
 }
 function read(s){for(let i=0;i<s.n;i++){const a=s.views[i],k=i*3;for(let j=0;j<3;j++){s.position[k+j]=a.position[j];s.velocity[k+j]=a.velocity[j];}s.yaw[i]=a.yaw;s.pitch[i]=a.pitch;s.roll[i]=a.roll;s.radii[i]=Math.hypot(...a.half);axes(s.axes,i*9,a.yaw,a.pitch,a.roll);}}
 function support(s,i,x,y,z,A=s.axes){const half=s.views[i].half,k=i*9;return half[0]*Math.abs(A[k]*x+A[k+1]*y+A[k+2]*z)+half[1]*Math.abs(A[k+3]*x+A[k+4]*y+A[k+5]*z)+half[2]*Math.abs(A[k+6]*x+A[k+7]*y+A[k+8]*z);}
 function separation(s,i,j,positions=s.position,A=s.axes,gap=s.params.gap){
  s.operations.satTests++;
  const a=i*3,b=j*3,dx=positions[b]-positions[a],dy=positions[b+1]-positions[a+1],dz=positions[b+2]-positions[a+2];let best=-Infinity;
  const test=(x,y,z,normalize)=>{const L=normalize?Math.hypot(x,y,z):1;if(L<1e-7)return;const signed=dx*x+dy*y+dz*z,d=(Math.abs(signed)-support(s,i,x,y,z,A)-support(s,j,x,y,z,A))/L-gap;if(d>best){best=d;const sign=(signed<0?-1:1)/L;s.normal[0]=x*sign;s.normal[1]=y*sign;s.normal[2]=z*sign;}};
  for(let k=0;k<3;k++){let q=i*9+k*3;test(A[q],A[q+1],A[q+2],false);q=j*9+k*3;test(A[q],A[q+1],A[q+2],false);}
  if(best<0)for(let k=0;k<3;k++)for(let l=0;l<3;l++){const q=i*9+k*3,r=j*9+l*3;test(A[q+1]*A[r+2]-A[q+2]*A[r+1],A[q+2]*A[r]-A[q]*A[r+2],A[q]*A[r+1]-A[q+1]*A[r],true);}
  return best;
 }
 function initialize(s,options={}){
  read(s);const gap=options.gap??Math.max(s.params.gap,s.params.initialGap*s.length),passes=options.passes??64;
  for(let pass=0;pass<passes;pass++){let changed=false;for(let i=0;i<s.n;i++)for(let j=i+1;j<s.n;j++){const c=separation(s,i,j,s.position,s.axes,gap);if(c>=-1e-7)continue;const move=(-c+1e-5)*.5;for(let k=0;k<3;k++){s.position[i*3+k]-=s.normal[k]*move;s.position[j*3+k]+=s.normal[k]*move;}changed=true;}if(!changed)break;}
  for(let i=0;i<s.n;i++){for(let k=0;k<3;k++){s.views[i].position[k]=s.position[i*3+k];s.initial[i*9+k]=s.position[i*3+k];}s.initial[i*9+6]=s.views[i].yaw;s.initial[i*9+7]=s.views[i].pitch;s.initial[i*9+8]=s.views[i].roll;}
  s.contact.minimumClearance=clearance(s);return s;
 }
 function clearance(s){let min=Infinity;for(let i=0;i<s.n;i++)for(let j=i+1;j<s.n;j++)min=Math.min(min,separation(s,i,j));return min;}
 function neighbors(s){const {n,k,position:P,neighbor:N,neighborDistance:D}=s;N.fill(-1);D.fill(Infinity);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){s.operations.neighborCandidates++;const dx=P[j*3]-P[i*3],dy=P[j*3+1]-P[i*3+1],dz=P[j*3+2]-P[i*3+2],d=dx*dx+dy*dy+dz*dz;
   // One nearest neighbour per azimuth sector avoids a dense subcluster taking
   // every slot and losing all contact with adjacent parts of the school.
   for(let side=0;side<2;side++){const a=side?j:i,b=side?i:j,base=a*k,bearing=angle(Math.atan2(side?-dz:dz,side?dx:-dx)-s.yaw[a]),at=Math.min(k-1,Math.floor((bearing+Math.PI)/TAU*k));if(d<D[base+at]){D[base+at]=d;N[base+at]=b;}}
  }
 }
 function threat(s,i,input){const a=i*3,P=s.position,L=s.views[i].length;let danger=0;
  const point=input.pointer,ray=input.pointerRay,disturbance=input.disturbance;
  if(point||ray){let x,y,z;if(ray){const o=ray.origin,d=ray.direction,dx=coord(d,0),dy=coord(d,1),dz=coord(d,2),len=dx*dx+dy*dy+dz*dz,t=Math.max(0,((P[a]-coord(o,0))*dx+(P[a+1]-coord(o,1))*dy+(P[a+2]-coord(o,2))*dz)/Math.max(len,1e-12));x=coord(o,0)+dx*t;y=coord(o,1)+dy*t;z=coord(o,2)+dz*t;}else{x=coord(point,0);y=coord(point,1);z=coord(point,2);}s.rayPoint[0]=x;s.rayPoint[1]=y;s.rayPoint[2]=z;danger=ease(1-Math.hypot(P[a]-x,P[a+1]-y,P[a+2]-z)/(2.1*L));}
  if(disturbance?.point){const p=disturbance.point,d=ease(1-Math.hypot(P[a]-coord(p,0),P[a+1]-coord(p,1),P[a+2]-coord(p,2))/(3*L))*clamp(disturbance.strength??1,0,1);if(d>danger){danger=d;for(let k=0;k<3;k++)s.rayPoint[k]=coord(p,k);}}
  return danger;
 }
 function proposal(s,i,dt,input){const a=s.views[i],p=s.params,k=i*3,L=a.length,yaw=s.yaw[i],fx=-Math.cos(yaw),fz=Math.sin(yaw);let ali=0,att=0,vertical=0,weight=0,neighborSpeed=0,longitudinalGap=0,avoid=0,pitchAvoid=0,brake=0;
  for(let n=0;n<s.k;n++){
   const j=s.neighbor[i*s.k+n];if(j<0)continue;const q=j*3,dx=s.position[q]-s.position[k],dy=s.position[q+1]-s.position[k+1],dz=s.position[q+2]-s.position[k+2],d=Math.sqrt(s.neighborDistance[i*s.k+n]),r=p.perception*(L+s.views[j].length)*.5;if(d>=r||d<1e-10)continue;
   const front=(fx*dx+fz*dz)/d,w=ease(1-d/r)*(.25+.75*(front+1)*.5),bearing=angle(Math.atan2(dz,-dx)-yaw),supportLine=support(s,i,dx/d,dy/d,dz/d)+support(s,j,dx/d,dy/d,dz/d),preferred=supportLine+p.preferredGap*(L+s.views[j].length)*.5;
   s.operations.activeNeighbors++;ali+=w*Math.sin(s.yaw[j]-yaw);att+=w*((d-preferred)/L)/(1+(d/(3*L))**2)*Math.sin(bearing);vertical+=w*((d-preferred)/L)/(1+(d/(3*L))**2)*dy/d;weight+=w;
   neighborSpeed+=w*s.views[j].speed;
   // Bearing-only steering is zero for an ahead/behind neighbour. A signed
   // longitudinal gap closes that missing mode, without a centre or leader.
   longitudinalGap+=w*(d-preferred)/L*front;
  }
  // Predictive safety perception is not limited to six social neighbours.
  for(let j=0;j<s.n;j++)if(j!==i){
   const q=j*3,b=s.views[j],dx=s.position[q]-s.position[k],dy=s.position[q+1]-s.position[k+1],dz=s.position[q+2]-s.position[k+2],dvx=s.velocity[q]-s.velocity[k],dvy=s.velocity[q+1]-s.velocity[k+1],dvz=s.velocity[q+2]-s.velocity[k+2],d=Math.hypot(dx,dy,dz),horizon=clamp(a.speed/p.maxAcceleration+1,1.2,3.2),vv=dvx*dvx+dvy*dvy+dvz*dvz,t=clamp(-(dx*dvx+dy*dvy+dz*dvz)/Math.max(vv,1e-10),0,horizon),px=dx+dvx*t,py=dy+dvy*t,pz=dz+dvz*t,pd=Math.hypot(px,py,pz);
   if(d>p.perception*(L+b.length)*.5)continue;
   const nx=pd>1e-8?px/pd:dx/Math.max(d,1e-8),ny=pd>1e-8?py/pd:dy/Math.max(d,1e-8),nz=pd>1e-8?pz/pd:dz/Math.max(d,1e-8),gap=pd-support(s,i,nx,ny,nz)-support(s,j,nx,ny,nz),closing=Math.max(0,-(dx*dvx+dy*dvy+dz*dvz)/Math.max(d,1e-8)),margin=.22*L+closing*.3+closing*closing/(2*p.maxAcceleration)+.18*(Math.hypot(...a.half)*Math.abs(a.turnRate)+Math.hypot(...b.half)*Math.abs(b.turnRate))*horizon,risk=ease((margin-gap)/(margin+.3*L));
   if(risk<=0)continue;
   const bearing=angle(Math.atan2(dz,-dx)-yaw),sine=Math.sin(bearing),front=clamp((fx*dx+fz*dz)/Math.max(d,1e-8),0,1),hand=((Math.imul(Math.min(i,j)+1,73856093)^Math.imul(Math.max(i,j)+1,19349663))&1)?1:-1;
   avoid+=(-sine-hand*.65*(1-Math.abs(sine))*front)*risk*p.avoidance;
   pitchAvoid+=(Math.abs(dy)>.05*L?-dy/Math.max(d,.1*L):(i<j?-1:1)*.4)*risk*.3;
   brake=Math.max(brake,risk*front*clamp(closing/Math.max(a.speed,.1*L)+.18,0,1));
  }
  let rate=(weight>1e-9?(p.alignment*ali+p.attraction*att)/weight:0)+avoid;
  const phase=s.noisePhase[i],noise=p.noise*(Math.sin(s.time*.41+phase)+.45*Math.sin(s.time*.17+phase*1.7));rate+=noise;
  const bounds=p.bounds,lookahead=Math.max(L,a.speed/p.maxTurn*1.5);let wx=0,wz=0,wy=0;
  if(bounds){const D=lookahead+L;wx=2*(ease((-s.position[k]+lookahead-bounds[0])/D)-ease((s.position[k]+lookahead-bounds[0])/D));wz=2*(ease((-s.position[k+2]+lookahead-bounds[2])/D)-ease((s.position[k+2]+lookahead-bounds[2])/D));wy=.5*(ease((-s.position[k+1]+.5*L-bounds[1])/(1.2*L))-ease((s.position[k+1]+.5*L-bounds[1])/(1.2*L)));}
  if(wx||wz){const target=angle(Math.atan2(fz+wz,-(fx+wx))-yaw);rate+=target*1.5;}
  const danger=threat(s,i,input);a.threat+= (danger-a.threat)*(1-Math.exp(-dt*(danger>a.threat?5:1.1)));
  if(danger>0){const dx=s.position[k]-s.rayPoint[0],dy=s.position[k+1]-s.rayPoint[1],dz=s.position[k+2]-s.rayPoint[2],bearing=angle(Math.atan2(dz,-dx)-yaw);rate+=danger*(Math.sin(bearing)*2.3+(i%2?1:-1)*.55*(1-Math.abs(Math.sin(bearing))));pitchAvoid+=danger*clamp(dy/Math.max(Math.hypot(dx,dy,dz),.1*L),-1,1)*.25;}
  if(s.mode==='turn')rate+=p.maxTurn*.48*Math.sin(s.time*.28+phase*.035);
  if(s.mode==='rest')rate=0;
  const targetRate=clamp(rate,-p.maxTurn,p.maxTurn),relaxed=a.turnRate+(targetRate-a.turnRate)*(1-Math.exp(-dt*p.turnResponse));
  s.nextRate[i]=a.turnRate+clamp(relaxed-a.turnRate,-p.maxAngularAcceleration*dt,p.maxAngularAcceleration*dt);s.nextYaw[i]=angle(yaw+s.nextRate[i]*dt);a.desiredYaw=angle(yaw+targetRate/p.turnResponse);
  const pitchTarget=s.mode==='rest'?0:clamp((weight>1e-9?vertical/weight*.18:0)+pitchAvoid+wy+.012*Math.sin(s.time*.31+phase),-p.maxPitch,p.maxPitch);let pitchRate=clamp((pitchTarget-s.pitch[i])*2,-p.maxPitchRate,p.maxPitchRate);
  pitchRate=Math.sign(pitchRate)*Math.min(Math.abs(pitchRate),Math.sqrt(2*p.maxPitchAcceleration*Math.max(0,p.maxPitch-Math.sign(pitchRate)*s.pitch[i])));
  s.nextPitchRate[i]=s.pitchRate[i]+clamp(pitchRate-s.pitchRate[i],-p.maxPitchAcceleration*dt,p.maxPitchAcceleration*dt);s.nextPitch[i]=clamp(s.pitch[i]+s.nextPitchRate[i]*dt,-p.maxPitch,p.maxPitch);
  const rollTarget=clamp(s.nextRate[i]*.18,-p.maxRoll,p.maxRoll);let rollRate=clamp((rollTarget-s.roll[i])*3,-p.maxRollRate,p.maxRollRate);rollRate=Math.sign(rollRate)*Math.min(Math.abs(rollRate),Math.sqrt(2*p.maxRollAcceleration*Math.max(0,p.maxRoll-Math.sign(rollRate)*s.roll[i])));s.nextRollRate[i]=s.rollRate[i]+clamp(rollRate-s.rollRate[i],-p.maxRollAcceleration*dt,p.maxRollAcceleration*dt);s.nextRoll[i]=s.roll[i]+s.nextRollRate[i]*dt;
  let drive=s.mode==='burst'?p.burst:p.speed*(s.mode==='hover'?p.hoverRatio:s.mode==='rest'?p.restRatio:1)*(s.mode==='cruise'||s.mode==='turn'?(a.thrust??1):1);
  drive+=(p.burst-drive)*a.threat*.8;drive*=(a.variation??1);
  if(weight>1e-9&&s.mode!=='rest')drive+=.6*(neighborSpeed/weight-drive)+p.speed*.4*Math.tanh(longitudinalGap/weight);
  drive*=1-.85*brake;
  const speedTarget=a.speed+(drive-a.speed)*(1-Math.exp(-dt*p.speedResponse));s.nextSpeed[i]=Math.max(0,a.speed+clamp(speedTarget-a.speed,-p.maxAcceleration*dt,p.maxAcceleration*dt));
  const base=i*4;
  s.lower[base]=Math.max(0,a.speed-p.maxAcceleration*dt);s.upper[base]=Math.min(p.maxSpeed??p.burst*(a.variation??1),a.speed+p.maxAcceleration*dt);
  s.lower[base+1]=Math.max(-p.maxTurn,a.turnRate-p.maxAngularAcceleration*dt);s.upper[base+1]=Math.min(p.maxTurn,a.turnRate+p.maxAngularAcceleration*dt);
  const ap=p.maxPitchAcceleration,ar=p.maxRollAcceleration,pitchUpper=Math.sqrt((ap*dt)**2+2*ap*Math.max(0,p.maxPitch-s.pitch[i]))-ap*dt,pitchLower=-Math.sqrt((ap*dt)**2+2*ap*Math.max(0,p.maxPitch+s.pitch[i]))+ap*dt,rollUpper=Math.sqrt((ar*dt)**2+2*ar*Math.max(0,p.maxRoll-s.roll[i]))-ar*dt,rollLower=-Math.sqrt((ar*dt)**2+2*ar*Math.max(0,p.maxRoll+s.roll[i]))+ar*dt;
  s.lower[base+2]=Math.max(-p.maxPitchRate,s.pitchRate[i]-ap*dt,pitchLower);s.upper[base+2]=Math.min(p.maxPitchRate,s.pitchRate[i]+ap*dt,pitchUpper);
  s.lower[base+3]=Math.max(-p.maxRollRate,s.rollRate[i]-ar*dt,rollLower);s.upper[base+3]=Math.min(p.maxRollRate,s.rollRate[i]+ar*dt,rollUpper);
  s.nextSpeed[i]=clamp(s.nextSpeed[i],s.lower[base],s.upper[base]);s.nextPitchRate[i]=clamp(s.nextPitchRate[i],s.lower[base+2],s.upper[base+2]);s.nextRollRate[i]=clamp(s.nextRollRate[i],s.lower[base+3],s.upper[base+3]);
 }
 function controls(s,i,k,value){const array=k===0?s.nextSpeed:k===1?s.nextRate:k===2?s.nextPitchRate:s.nextRollRate;if(value!==undefined)array[i]=value;return array[i];}
 function normalGradient(s,i,nx,ny,nz,offset,translationSign,dt=1/60){
  const k=i*9,A=s.candidateAxes,O=s.axes,half=s.views[i].half,G=s.gradient;
  const yaw=s.yaw[i]+dt*s.nextRate[i],pitch=s.pitch[i]+dt*s.nextPitchRate[i],roll=s.roll[i]+dt*s.nextRollRate[i],speed=s.nextSpeed[i];axes(A,k,yaw,pitch,roll);
  const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),py=-sy,pz=-cy,rx=A[k],ry=A[k+1],rz=A[k+2];
  G[offset]=translationSign*(-A[k]*nx-A[k+1]*ny-A[k+2]*nz);
  let gy=translationSign*speed*dt*(sy*cp*nx+cy*cp*nz),gp=translationSign*speed*dt*(cy*sp*nx+cp*ny-sy*sp*nz),gr=0,growth=0;
  // Exact next-step support and heading, with the analytic control Jacobian.
  // abs is evaluated at the candidate axis, including an axis crossing zero.
  for(let j=0;j<3;j++){const q=k+j*3,x=A[q],y=A[q+1],z=A[q+2],d=O[q]*nx+O[q+1]*ny+O[q+2]*nz,next=x*nx+y*ny+z*nz,ddy=z*nx-x*nz,ddp=-pz*y*nx+(pz*x-py*z)*ny+py*y*nz,ddr=(ry*z-rz*y)*nx+(rz*x-rx*z)*ny+(rx*y-ry*x)*nz,scale=half[j]*Math.sign(next);growth+=half[j]*(Math.abs(next)-Math.abs(d))/dt;gy-=scale*ddy;gp-=scale*ddp;gr-=scale*ddr;}
  G[offset+1]=gy;G[offset+2]=gp;G[offset+3]=gr;return G[offset]*speed-growth;
 }
 function barrier(s,dt){
  // Pairwise control-space safety. Bounds stay in acceleration envelopes; the
  // separating-plane reserve starts braking before translation/rotation contact.
  let pairCount=0;
  for(let i=0;i<s.n;i++)for(let j=i+1;j<s.n;j++){
    const a=i*3,b=j*3,dx=s.position[b]-s.position[a],dy=s.position[b+1]-s.position[a+1],dz=s.position[b+2]-s.position[a+2],radius=s.radii[i]+s.radii[j]+.9*s.length;
    if(dx*dx+dy*dy+dz*dz>radius*radius)continue;
    const c=separation(s,i,j);if(c>.8*s.length)continue;
    s.pairI[pairCount]=i;s.pairJ[pairCount]=j;for(let k=0;k<3;k++)s.pairNormal[pairCount*3+k]=s.normal[k];s.pairAllowed[pairCount]=-Math.max(0,c-s.params.barrierReserve*s.length)/s.params.barrierTime;pairCount++;
  }
  for(let pass=0;pass<s.params.barrierPasses;pass++){
   for(let edge=0;edge<pairCount;edge++){
    const i=s.pairI[edge],j=s.pairJ[edge],nx=s.pairNormal[edge*3],ny=s.pairNormal[edge*3+1],nz=s.pairNormal[edge*3+2],allowed=s.pairAllowed[edge];
    for(let solve=0;solve<8;solve++){
     const actual=normalGradient(s,i,nx,ny,nz,0,-1,dt)+normalGradient(s,j,nx,ny,nz,4,1,dt);let denominator=0;
     for(let q=0;q<8;q++){const index=q<4?i:j,k=q%4,g=s.gradient[q],v=controls(s,index,k),lo=s.lower[index*4+k],hi=s.upper[index*4+k];if((g>0&&v<hi-1e-12)||(g<0&&v>lo+1e-12))denominator+=g*g;}
     const missing=allowed-actual;if(missing<=1e-8||denominator<1e-12)break;
     for(let q=0;q<8;q++){const index=q<4?i:j,k=q%4,g=s.gradient[q],v=controls(s,index,k),lo=s.lower[index*4+k],hi=s.upper[index*4+k];if((g>0&&v<hi-1e-12)||(g<0&&v>lo+1e-12))controls(s,index,k,clamp(v+g*missing/denominator,lo,hi));}
    }
   }
  }
  if(s.reviewMetrics){let worst=0,infeasible=0;for(let edge=0;edge<pairCount;edge++){const i=s.pairI[edge],j=s.pairJ[edge],nx=s.pairNormal[edge*3],ny=s.pairNormal[edge*3+1],nz=s.pairNormal[edge*3+2],rate=normalGradient(s,i,nx,ny,nz,0,-1,dt)+normalGradient(s,j,nx,ny,nz,4,1,dt),error=s.pairAllowed[edge]-rate;if(error>worst)worst=error;if(error>1e-5)infeasible++;}s.reviewMetricsResult={worst,infeasible,pairCount};}
  for(let i=0;i<s.n;i++){s.nextYaw[i]=angle(s.yaw[i]+s.nextRate[i]*dt);s.nextPitch[i]=s.pitch[i]+s.nextPitchRate[i]*dt;s.nextRoll[i]=s.roll[i]+s.nextRollRate[i]*dt;candidate(s,i,dt,1);}
  if(s.reviewPair){const i=s.reviewPair[0],j=s.reviewPair[1],c=separation(s,i,j),normal=Array.from(s.normal),actual=normalGradient(s,i,...normal,0,-1,dt)+normalGradient(s,j,...normal,4,1,dt);let tangentUpperBound=actual;for(let q=0;q<8;q++){const index=q<4?i:j,k=q%4,g=s.gradient[q];tangentUpperBound+=g*((g>0?s.upper[index*4+k]:s.lower[index*4+k])-controls(s,index,k));}s.reviewPairResult={time:s.time,clearance:c,normal,gradient:Array.from(s.gradient),actualEndpointRate:actual,tangentUpperBound,certificate:'Tangent bound only; not a nonlinear box-optimum proof',allowed:-Math.max(0,c-s.params.barrierReserve*s.length)/s.params.barrierTime};}
 }
 function candidate(s,i,dt,factor){const k=i*3,yaw=s.yaw[i]+angle(s.nextYaw[i]-s.yaw[i])*factor,pitch=s.pitch[i]+(s.nextPitch[i]-s.pitch[i])*factor,roll=s.roll[i]+(s.nextRoll[i]-s.roll[i])*factor;
  const speed=s.nextSpeed[i]*factor,cp=Math.cos(pitch);s.candidate[k]=s.position[k]-Math.cos(yaw)*cp*speed*dt;s.candidate[k+1]=s.position[k+1]+Math.sin(pitch)*speed*dt;s.candidate[k+2]=s.position[k+2]+Math.sin(yaw)*cp*speed*dt;axes(s.candidateAxes,i*9,yaw,pitch,roll);s.accepted[i]=factor;
 }
 function safety(s,dt){
  // Emergency admissible step, not post-position projection: no teleports and no
  // invented sideways impulse. Predictive steering should make this layer rare.
  for(let pass=0;pass<s.params.contactPasses;pass++){let changed=false;s.operations.contactPasses++;
   for(let i=0;i<s.n;i++)for(let j=i+1;j<s.n;j++){
    s.operations.broadPairs++;const a=i*3,b=j*3,dx=s.candidate[b]-s.candidate[a],dy=s.candidate[b+1]-s.candidate[a+1],dz=s.candidate[b+2]-s.candidate[a+2],radius=Math.hypot(...s.views[i].half)+Math.hypot(...s.views[j].half)+s.params.gap;if(dx*dx+dy*dy+dz*dz>radius*radius)continue;
    const future=separation(s,i,j,s.candidate,s.candidateAxes);if(future>=-1e-7)continue;s.operations.contactPairs++;
    const old=separation(s,i,j),factor=clamp(old/(old-future+1e-8)*.8,0,1);
    if(s.review){const normal=Array.from(s.normal),actual=normalGradient(s,i,...normal,0,-1,dt)+normalGradient(s,j,...normal,4,1,dt),allowed=-Math.max(0,old-s.params.barrierReserve*s.length)/s.params.barrierTime;let tangentUpperBound=actual;for(let q=0;q<8;q++){const index=q<4?i:j,k=q%4,g=s.gradient[q];tangentUpperBound+=g*((g>0?s.upper[index*4+k]:s.lower[index*4+k])-controls(s,index,k));}s.review({time:s.time,i,j,old,future,factor,normal,actualEndpointRate:actual,allowed,tangentUpperBound,remainingResidual:allowed-actual,qp:s.reviewMetricsResult,gradient:Array.from(s.gradient),actors:[i,j].map(k=>({position:Array.from(s.views[k].position),velocity:Array.from(s.views[k].velocity),half:Array.from(s.views[k].half),yaw:s.yaw[k],pitch:s.pitch[k],roll:s.roll[k],oldSpeed:s.views[k].speed,nextSpeed:s.nextSpeed[k],oldRate:s.views[k].turnRate,nextRate:s.nextRate[k],oldPitchRate:s.pitchRate[k],nextPitchRate:s.nextPitchRate[k],oldRollRate:s.rollRate[k],nextRollRate:s.nextRollRate[k],lower:Array.from(s.lower.subarray(k*4,k*4+4)),upper:Array.from(s.upper.subarray(k*4,k*4+4))}))});}
    candidate(s,i,dt,s.accepted[i]*factor);candidate(s,j,dt,s.accepted[j]*factor);s.operations.safetyClamps+=2;changed=true;
   }if(!changed)break;
  }
 }
 function step(s,dt,input={}){
  if(!Number.isFinite(dt)||dt<=0||input.paused)return s;
  if(dt>.1)throw Error('School step delta must be <= .1; caller retains elapsed through substeps');
  for(const key in s.operations)s.operations[key]=0;read(s);s.time+=dt;s.mode=input.mode||'cruise';neighbors(s);
  for(let i=0;i<s.n;i++)proposal(s,i,dt,input);barrier(s,dt);safety(s,dt);
  let min=Infinity;for(let i=0;i<s.n;i++)for(let j=i+1;j<s.n;j++)min=Math.min(min,separation(s,i,j,s.candidate,s.candidateAxes));
  s.contact.minimumClearance=min;s.contact.maxCorrection=0;
  for(let i=0;i<s.n;i++){
   const a=s.views[i],k=i*3,f=s.accepted[i];for(let j=0;j<3;j++){a.position[j]=s.candidate[k+j];a.velocity[j]=(s.candidate[k+j]-s.position[k+j])/dt;}
   a.yaw=angle(s.yaw[i]+angle(s.nextYaw[i]-s.yaw[i])*f);a.pitch=s.pitch[i]+(s.nextPitch[i]-s.pitch[i])*f;a.roll=s.roll[i]+(s.nextRoll[i]-s.roll[i])*f;a.speed=s.nextSpeed[i]*f;a.turnRate=s.nextRate[i]*f;s.pitchRate[i]=s.nextPitchRate[i]*f;s.rollRate[i]=s.nextRollRate[i]*f;
  }
  s.totals.steps++;s.totals.satTests+=s.operations.satTests;s.totals.safetyClamps+=s.operations.safetyClamps;return s;
 }
 function snapshot(s){const centroid=[0,0,0];let speed=0,slip=0;for(const a of s.views){for(let k=0;k<3;k++)centroid[k]+=a.position[k]/s.n;speed+=Math.hypot(...a.velocity)/s.n;if(a.speed>1e-8)slip+=Math.abs(angle(Math.atan2(a.velocity[2],-a.velocity[0])-a.yaw))/s.n;}
  return {version:VERSION,time:s.time,mode:s.mode,count:s.n,length:s.length,centroid,meanSpeed:speed,meanHeadingSlip:slip,operations:{...s.operations},totals:{...s.totals},allocatedBytes:s.allocatedBytes,contact:{...s.contact},parameters:{...s.params,bounds:s.params.bounds?.slice()},actors:s.views.map(a=>({position:Array.from(a.position),velocity:Array.from(a.velocity),yaw:a.yaw,pitch:a.pitch,roll:a.roll,speed:a.speed,turnRate:a.turnRate,threat:a.threat,length:a.length}))};
 }
 function reset(s){for(let i=0;i<s.n;i++){const a=s.views[i];for(let k=0;k<3;k++){a.position[k]=s.initial[i*9+k];a.velocity[k]=s.initial[i*9+3+k];}a.yaw=s.initial[i*9+6];a.pitch=s.initial[i*9+7];a.roll=s.initial[i*9+8];a.speed=Math.hypot(...a.velocity);a.turnRate=a.threat=0;}s.time=0;s.pitchRate.fill(0);s.rollRate.fill(0);read(s);return s;}
 return {VERSION,create,step,initialize,reset,snapshot,clearance(s){read(s);return clearance(s);},convention:'World lengths and speeds; view.length supplies BL distance scaling. Canonical head -X, Ry(yaw)*Rz(-pitch)*Rx(roll). Local engineering candidate, no species calibration.'};
});
