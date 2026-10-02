(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FishBehavior = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
  const unit = v => { const l = Math.hypot(...v); return l > 1e-10 ? v.map(x => x / l) : [0, 0, 0]; };
  const smooth = (a, b, dt, response) => mix(a, b, 1 - Math.exp(-dt * response));
  const profiles = Object.freeze({
    herring: { id:'herring', gait:'source-harmonic-continuous-spine-candidate', speed:0.65, burst:1.7, frequency:0.9983360022306442, amplitude:0.36, flexStart:0.22, flexPower:1.55, wave:0.95, maxTurn:0.75, fin:0.13, eye:0.095, strainLimit:.12, collisionBendBound:.45, radii:[.043554,.066344,.074139,.076638,.091325,.109415,.113044,.074651,.084109,.084245,.08393,.08251,.075974,.037166,.038224,.094632,.09993], sourceChain:[{u:.2935993447,a:.196873,phase:-1.7788396},{u:.4168671998,a:.347495,phase:-2.8255145},{u:.5317024856,a:.348368,phase:-3.8779489},{u:.6877285976,a:.34959,phase:-4.9204322},{u:.8138419432,a:.347495,phase:-5.9671062},{u:.9166352809,a:.349415,phase:-4.9204322}], sourceTiming:'R08 original local-joint phase/amplitude fit and measured canonical positions; cubic cumulative harmonic angle field with smooth visible-surface curvature constraint; not raw clip playback' },
    'tuna-yellow-label': { id:'tuna-yellow-label', gait:'posterior-BCF-candidate', speed:0.82, burst:2.2, frequency:0.9215409755706787, amplitude:0.28, flexStart:0.43, flexPower:2, wave:0.78, envelopeGain:1.45, maxTurn:0.5, fin:0.08, eye:0.06, strainLimit:.16, collisionBendBound:.24, radii:[.035503,.057146,.074296,.093559,.171841,.206222,.248594,.248594,.083501,.073928,.066569,.051906,.040285,.020953,.015,.015,.015], sourceTiming:'Source central quaternion channels measured at 0.9215409756 Hz; smooth posterior envelope gain preserves measured R01 tail excursion rather than hiding strain with a small swing' },
    'tuna-blue-label': { id:'tuna-blue-label', gait:'posterior-BCF-candidate', speed:0.9, burst:2.4, frequency:1.2, amplitude:0.27, flexStart:0.44, flexPower:2.1, wave:0.78, maxTurn:0.48, fin:0.08, eye:0.06, sourceTiming:'Source normal/fast clips 1.1667 s; engineering interpolation, actual species unconfirmed' },
    colorful: { id:'colorful', gait:'mixed-BCF-MPF-candidate', speed:0.45, burst:1.15, frequency:1.1, amplitude:0.3, flexStart:0.32, flexPower:1.6, wave:0.86, maxTurn:0.92, fin:0.22, eye:0.115, sourceTiming:'Source baked 21.6667 s clip; source specimen selection and gait calibration remain explicit' },
    picasso: { id:'picasso', gait:'MPF-alternative-candidate', speed:0.34, burst:1.15, frequency:1.35, amplitude:0.09, flexStart:0.48, flexPower:2.25, wave:0.82, maxTurn:0.9, fin:0.27, eye:0.13, sourceTiming:'Static source title Picasso Fish does not confirm taxonomy. Dorsal/anal candidate gait is experimental, not a verified species claim' }
  });
  // Actual canonical max-absolute rest coordinates read from all source score vertices.
  const measuredExtents={herring:[.5,.17642852474155662,.11304351200539661],'tuna-yellow-label':[.5,.28550726596314513,.24859399619061479],'tuna-blue-label':[.5,.19905742156384776,.14150827448080489],colorful:[.5,.28744069308992165,.0943376475062211],picasso:[.5,.3399933276235436,.2559150752167785]};
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function shapeOf(id,shape) {
    const extents=shape?.min&&shape?.max?shape.min.map((v,k)=>Math.max(Math.abs(v),Math.abs(shape.max[k]))):shape?.extents?.slice()||measuredExtents[id].slice();
    if(extents.length!==3||!extents.every(x=>Number.isFinite(x)&&x>0))throw Error('Invalid measured source extents');
    return {extents,finSweepMargin:shape?.finSweepMargin??.12,gap:shape?.gap??.025};
  }
  function configureShape(state,shape) {state.shape=shapeOf(state.id,shape);if(state.count>1)resolveContacts(state,1/60,160,true);return state;}
  function box(actor,state) {
    const cy=Math.cos(actor.yaw),sy=Math.sin(actor.yaw),cp=Math.cos(actor.pitch),sp=Math.sin(actor.pitch),cr=Math.cos(actor.roll),sr=Math.sin(actor.roll),p=state.profile;
    const axes=[[cy*cp,-sp,-sy*cp],[cy*sp*cr+sy*sr,cp*cr,-sy*sp*cr+cy*sr],[-cy*sp*sr+sy*cr,-cp*sr,sy*sp*sr+cy*cr]];
    // Analytic upper bound for integral of the flexibility envelope. Fin sweep margin
    // encloses local source-fin rotations; this is an exhibition constraint, not CFD.
    // Fixed whole-gait envelope prevents shape inflation during a beat from outrunning
    // contact correction. Source-chain bounds include a phase/amplitude grid Lipschitz margin.
    const bend=p.collisionBendBound??(.72*(1-p.flexStart)*(3/(p.flexPower+1)-2/(p.flexPower+2))+p.maxTurn*.03);
    const f=state.shape.finSweepMargin,e=state.shape.extents;
    return {center:actor.position,axes,half:[e[0]+f,e[1]+f,e[2]+bend+f]};
  }
  function separation(a,b,gap=0) {
    const dx=b.center[0]-a.center[0],dy=b.center[1]-a.center[1],dz=b.center[2]-a.center[2];
    let largest=-Infinity,nx=1,ny=0,nz=0;
    function test(x,y,z,normalized=true){const length=normalized?1:Math.hypot(x,y,z);if(length<1e-7)return;const signed=dx*x+dy*y+dz*z;let support=0;for(let k=0;k<3;k++){const A=a.axes[k],B=b.axes[k];support+=a.half[k]*Math.abs(A[0]*x+A[1]*y+A[2]*z)+b.half[k]*Math.abs(B[0]*x+B[1]*y+B[2]*z);}const clearance=(Math.abs(signed)-support)/length-gap;if(clearance>largest){largest=clearance;const sign=(signed<0?-1:1)/length;nx=x*sign;ny=y*sign;nz=z*sign;}}
    // Read all face axes before accepting separation: the old first-positive-axis
    // normal jumped between weak certificates and repeatedly stopped swimming.
    for(let k=0;k<3;k++){test(...a.axes[k]);test(...b.axes[k]);}
    if(largest<0)for(const A of a.axes)for(const B of b.axes)test(A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0],false);
    return {clearance:largest,normal:[nx,ny,nz]};
  }
  function groupClearance(state) {
    let minimum=Infinity;const boxes=state.actors.map(a=>box(a,state));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)minimum=Math.min(minimum,separation(boxes[i],boxes[j],state.shape.gap).clearance);
    return minimum;
  }
  function constrainContactVelocities(state,dt) {
    // Remove closing velocity before integration. A bounded position correction alone
    // cannot resolve sustained crowd pressure from thirty commanded swimming velocities.
    const boxes=state.actors.map(a=>box(a,state));
    for(let iteration=0;iteration<12;iteration++) {
      let changed=false;
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
        const contact=separation(boxes[i],boxes[j],state.shape.gap);
        if(contact.clearance>.12)continue;
        const vi=state.actors[i].velocity,vj=state.actors[j].velocity,
          relative=dot(vj.map((v,k)=>v-vi[k]),contact.normal),minimum=-Math.max(0,contact.clearance)*.85/dt;
        if(relative>=minimum)continue;
        const impulse=(minimum-relative)*.5;changed=true;
        for(let k=0;k<3;k++){vi[k]-=contact.normal[k]*impulse;vj[k]+=contact.normal[k]*impulse;}
      }
      if(!changed)break;
    }
    for(const a of state.actors)for(let k=0;k<3;k++)a.position[k]+=a.velocity[k]*dt;
  }
  function resolveContacts(state,dt,iterations=18,initial=false) {
    if(state.count<2)return;
    const correction=state.actors.map(()=>[0,0,0]), limit=initial?Infinity:dt*3.5;
    for(let iteration=0;iteration<iterations;iteration++) {
      let worst=0;const boxes=state.actors.map(a=>box(a,state));
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
        const sep=separation(boxes[i],boxes[j],state.shape.gap);if(sep.clearance>=-1e-6)continue;worst=Math.min(worst,sep.clearance);
        let amount=(-sep.clearance+1e-5)*.5;
        if(!initial){const spent=Math.max(Math.hypot(...correction[i]),Math.hypot(...correction[j]));amount=Math.min(amount,Math.max(0,limit-spent));}
        for(let k=0;k<3;k++){const move=sep.normal[k]*amount;state.actors[i].position[k]-=move;state.actors[j].position[k]+=move;correction[i][k]-=move;correction[j][k]+=move;}
      }
      if(worst>=-1e-6)break;
    }
    state.contact={minimumClearance:groupClearance(state),maxCorrection:Math.max(...correction.map(c=>Math.hypot(...c))),model:'Source-enclosing oriented-box SAT + bounded positional constraint; not mesh collision or hydrodynamics'};
  }
  function rng(seed) { let v = seed >>> 0 || 1; return () => { v += 0x6D2B79F5; let t = Math.imul(v ^ v >>> 15, v | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function profileOf(p) { return typeof p === 'string' ? profiles[p] : p; }
  function create(id, count = 1, seed = 1, shape) {
    if (!profiles[id]) throw new Error('Unknown fish profile: ' + id);
    count = clamp(Math.floor(count), 1, 30);
    const random = rng(seed), actors = [];
    for (let i = 0; i < count; i++) {
      let position = [0,0,0];
      if (count > 1) {
        for (let attempt = 0; attempt < 160; attempt++) {
          position = [(random()-.5)*7,(random()-.5)*3.5,(random()-.5)*5];
          if (actors.every(a => Math.hypot(...a.position.map((x,k) => x-position[k])) > .48)) break;
        }
      }
      const p = profiles[id], a = { index:i, position, velocity:[-p.speed,0,0], yaw:0, pitch:0, roll:0,
        speed:p.speed, frequency:p.frequency, amplitude:p.amplitude, beatPhase:random()*TAU,
        turnRate:0, finPhase:random()*TAU, finAngles:{pectoralLeft:0,pectoralRight:0,pelvic:0,dorsal:0,anal:0,caudal:0}, finWaves:{},
        eyes:{yaw:0,pitch:0,leftYaw:0,rightYaw:0}, eyeTarget:[0,0], eyeTimer:.4+random()*2.5,
        ownClock:random()*100, variation:.94+random()*.12, threat:0, _random:rng(seed+i*997+1777),
        thrust:1,thrustTarget:1,effortTimer:2.4+(i%7)*.37,_motionRandom:rng(seed+i*997+41477),caudalPeduncle:{angle:0,angularVelocity:0} };
      const initialSpine=sampleSpine(a,p),initialPeduncle=initialSpine.tangents[Math.round(.84*(initialSpine.tangents.length-1))];
      a._collisionBend=Math.max(...initialSpine.centers.map(v=>Math.abs(v[2])));
      a.caudalPeduncle.angle=Math.atan2(initialPeduncle[2],initialPeduncle[0]);
      actors.push(a);
    }
    const state={id,count,seed,time:0,actors,profile:profiles[id],mode:'cruise',bounds:[7,2.8,5],pointer:null,shape:shapeOf(id,shape)};
    if(count>1)resolveContacts(state,1/60,240,true);
    return state;
  }
  function reset(state) { const fresh = create(state.id,state.count,state.seed,state.shape); Object.assign(state,fresh); return state; }
  function update(state, dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return state;
    // Fixed upper step avoids large browser frame stalls producing turn/phase jumps.
    let remaining = Math.min(dt,.5);
    while (remaining > 1e-9) { const step = Math.min(remaining,1/60); tick(state,step,input); remaining -= step; }
    return state;
  }
  function tick(s, dt, input) {
    s.time += dt; s.mode = input.mode || 'cruise';
    s.pointer = input.pointer && input.pointer.length === 3 && input.pointer.every(Number.isFinite) ? input.pointer.slice() : null;
    const p = s.profile, prior = s.actors.map(a => ({position:a.position.slice(), velocity:a.velocity.slice()}));
    const leader = [-1.8*Math.sin(s.time*.13),.35*Math.sin(s.time*.21),1.5*Math.sin(s.time*.1+.3)];
    for (const a of s.actors) {
      const old = prior[a.index], centered = s.count === 1 && input.centered !== false;
      let desired = [-Math.cos(a.yaw),0,Math.sin(a.yaw)], drive = p.speed;
      if (s.count > 1 || !centered) {
        const sep=[0,0,0], align=[0,0,0], coh=[0,0,0]; let neighbors=0;
        for (let j=0;j<prior.length;j++) {
          if (j === a.index) continue;
          const b=prior[j], diff=old.position.map((x,k)=>x-b.position[k]), dist=Math.hypot(...diff);
          if(dist < 3.2) { neighbors++; for(let k=0;k<3;k++){align[k]+=b.velocity[k];coh[k]+=b.position[k];} }
          if(dist < .85) for(let k=0;k<3;k++) sep[k]+=diff[k]/Math.max(.035,dist*dist)*(.85-dist)*1.8;
        }
        const toLeader=leader.map((v,k)=>v-old.position[k]);
        desired=desired.map((v,k)=>v*.72+toLeader[k]*.23+sep[k]+(neighbors?align[k]/neighbors*.24+(coh[k]/neighbors-old.position[k])*.33:0));
        // Anticipatory steering starts before the wall: a fast tuna has a wider turn radius.
        for(let k=0;k<3;k++) if(Math.abs(old.position[k])>s.bounds[k]*.4) desired[k]-=Math.sign(old.position[k])*Math.pow(Math.abs(old.position[k])/s.bounds[k],2)*5;
        desired[1]+=Math.sin(a.ownClock+s.time*.35)*.05;
      }
      let danger = 0;
      if(s.pointer) {
        const away=old.position.map((v,k)=>v-s.pointer[k]), d=Math.hypot(...away);
        danger=clamp(1-d/2.1,0,1);
        if(danger>0) {
          const lateralSign=a.index%2 ? 1 : -1;
          for(let k=0;k<3;k++) desired[k]+=away[k]/Math.max(.12,d)*danger*4;
          // At the exact cursor center, split on two sides instead of an undefined direction.
          desired[2]+=lateralSign*danger*.8; desired[1]+=Math.sin(a.ownClock)*danger*.25;
        }
      }
      a.threat = smooth(a.threat,danger,dt,danger>a.threat?5:1.1);
      // Independent smoothly varying propulsion demand; no eye RNG or eye clock changes.
      if(p.id==='herring'||p.id==='tuna-yellow-label') {
        a.effortTimer-=dt;
        if(a.effortTimer<=0){a.effortTimer=3+a._motionRandom()*4;a.thrustTarget=.84+a._motionRandom()*.32;}
        a.thrust=smooth(a.thrust,a.thrustTarget,dt,.75);
        if(s.mode==='cruise'||s.mode==='turn')drive*=a.thrust;
      }
      if(s.mode==='rest') drive *= .09;
      if(s.mode==='hover') drive *= p.id==='picasso'?.08:.22;
      if(s.mode==='burst') drive=p.burst;
      drive=mix(drive,p.burst,a.threat*.8)*a.variation;
      if(!centered) {
        let wallSpeed=1;
        for(let k=0;k<3;k++) wallSpeed=Math.min(wallSpeed,.15+.85*clamp((s.bounds[k]-Math.abs(old.position[k]))/(s.bounds[k]*.45),0,1));
        drive*=wallSpeed;
      }
      let yawTarget=Math.atan2(desired[2],-desired[0]);
      if(centered && !s.pointer) yawTarget=s.mode==='turn'?.68*Math.sin(s.time*.72):.11*Math.sin(s.time*.24+a.ownClock);
      if(s.mode==='turn' && !centered) yawTarget+=.65*Math.sin(s.time*.7);
      const delta=angle(yawTarget-a.yaw), rate=clamp(delta*2.5,-p.maxTurn,p.maxTurn);
      a.turnRate=smooth(a.turnRate,rate,dt,5); a.yaw=angle(a.yaw+a.turnRate*dt);
      const pitchTarget=centered?.025*Math.sin(s.time*.47+a.ownClock):clamp(Math.atan2(desired[1],Math.hypot(desired[0],desired[2])),-.28,.28);
      a.pitch=smooth(a.pitch,pitchTarget,dt,2); a.roll=smooth(a.roll,clamp(a.turnRate*.18,-.15,.15),dt,3);
      a.speed=smooth(a.speed,drive,dt,1.6);
      const commanded=[-Math.cos(a.yaw)*Math.cos(a.pitch)*a.speed,Math.sin(a.pitch)*a.speed,Math.sin(a.yaw)*Math.cos(a.pitch)*a.speed];
      // Keep the accepted translation velocity between contact solves. Discarding
      // it each frame regenerated the same opposing impulses at school contacts.
      a.velocity=s.count>1?a.velocity.map((v,k)=>smooth(v,commanded[k],dt,2)):commanded;
      if(centered) a.position=[0,0,0];
      else if(s.count===1) for(let k=0;k<3;k++) a.position[k]+=a.velocity[k]*dt;
      const speedRatio=a.speed/p.speed, bodyRest=s.mode==='rest'?.18:s.mode==='hover'?.35:1;
      a.frequency=smooth(a.frequency,p.frequency*(.3+.7*Math.sqrt(Math.max(.02,speedRatio))),dt,3);
      let amp=p.amplitude*(.35+.65*Math.sqrt(Math.max(.02,speedRatio)))*bodyRest;
      if(p.id==='picasso') amp*=s.mode==='burst'?2.7:1;
      a.amplitude=smooth(a.amplitude,clamp(amp,0,.72),dt,3);
      a.beatPhase=(a.beatPhase+TAU*a.frequency*dt)%TAU;
      a.finPhase=(a.finPhase+TAU*(p.id==='picasso'?p.frequency*1.15:a.frequency*.73)*dt)%TAU;
      const hover=s.mode==='hover' || s.mode==='rest';
      a._finGain=smooth(a._finGain??.75,hover?1.25:.75,dt,3);
      a._medianGain=smooth(a._medianGain??1,hover?1.1:1,dt,3);
      const f=p.fin*a._finGain*(p.id==='tuna-yellow-label'?(.9+.1*a.thrust+.15*Math.abs(a.turnRate)):1), trim=a.turnRate*.12;
      a.finAngles.pectoralLeft=f*Math.sin(a.finPhase)+trim;
      a.finAngles.pectoralRight=-f*Math.sin(a.finPhase+.22)+trim;
      a.finAngles.pelvic=f*.25*Math.sin(a.finPhase+.5);
      const median=p.id==='picasso'?p.fin*a._medianGain:f*.25;
      a.finAngles.dorsal=median*Math.sin(a.finPhase);
      a.finAngles.anal=median*Math.sin(a.finPhase+.08);
      a.finAngles.caudal=a.amplitude*.3*Math.sin(a.beatPhase-.8);
      // Renderer can evaluate a spatial fin wave without multiplying two oscillators.
      a.finWaves={
        pectoralLeft:{amplitude:f,phase:a.finPhase,bias:trim},
        pectoralRight:{amplitude:-f,phase:a.finPhase+.22,bias:trim},
        pelvic:{amplitude:f*.25,phase:a.finPhase+.5,bias:0},
        dorsal:{amplitude:median,phase:a.finPhase,bias:0},
        anal:{amplitude:median,phase:a.finPhase+.08,bias:0},
        caudal:{amplitude:a.amplitude*.3,phase:a.beatPhase-.8,bias:0}
      };
      if(p.id==='herring'||p.id==='tuna-yellow-label') {
        const spine=sampleSpine(a,p),j=Math.round(.84*(spine.tangents.length-1)),t=spine.tangents[j],peduncle=Math.atan2(t[2],t[0]),velocity=(peduncle-a.caudalPeduncle.angle)/dt;
        a.caudalPeduncle={angle:peduncle,angularVelocity:smooth(a.caudalPeduncle.angularVelocity,velocity,dt,8)};
        const tail=clamp(-.24*peduncle-.025*a.caudalPeduncle.angularVelocity,-.34,.34);
        a.finAngles.caudal=tail;a.finWaves.caudal={amplitude:0,phase:0,bias:tail};
      }
      a.eyeTimer-=dt;
      if(a.eyeTimer<=0) {
        a.eyeTimer=.8+a._random()*2.8;
        a.eyeTarget=[(a._random()*2-1)*p.eye,(a._random()*2-1)*p.eye*.52];
        if(s.pointer) { a.eyeTarget[0]=clamp(angle(yawTarget-a.yaw)*.22,-p.eye,p.eye); }
      }
      a.eyes.yaw=smooth(a.eyes.yaw,a.eyeTarget[0],dt,9);
      a.eyes.pitch=smooth(a.eyes.pitch,a.eyeTarget[1],dt,8);
      a.eyes.leftYaw=a.eyes.yaw; a.eyes.rightYaw=a.eyes.yaw*.84;
    }
    if(s.count>1){constrainContactVelocities(s,dt);resolveContacts(s,dt);for(const a of s.actors)for(let k=0;k<3;k++)a.velocity[k]=(a.position[k]-prior[a.index].position[k])/dt;}
  }
  const spineFields=new Map();
  function sourceKnots(p){
    const knots=[{u:p.flexStart,c:[0,0]}];let sum=[0,0];
    // At a measured joint, the cross-section spans half its local rotation.
    // The cumulative harmonic coefficients retain the last source joint's
    // return to the fourth joint phase rather than inventing an equal lag.
    for(const j of p.sourceChain){const v=[j.a*Math.cos(j.phase),j.a*Math.sin(j.phase)];knots.push({u:j.u,c:sum.map((x,k)=>x+v[k]*.5)});sum=sum.map((x,k)=>x+v[k]);}
    knots.push({u:1,c:sum});
    for(let i=0;i<knots.length;i++)knots[i].d=i===0||i===knots.length-1?[0,0]:knots[i].c.map((_,k)=>(knots[i+1].c[k]-knots[i-1].c[k])/(knots[i+1].u-knots[i-1].u));
    return knots;
  }
  function spineField(p,samples){
    const key=p.id+':'+samples;if(spineFields.has(key))return spineFields.get(key);
    const knots=p.sourceChain?sourceKnots(p):null,field=[],step=1/(samples-1);
    for(let i=0;i<samples;i++){
      const u=i*step,q=clamp((u-p.flexStart)/(1-p.flexStart),0,1),n=p.flexPower+2,envelope=p.strainLimit?(p.envelopeGain||1)*Math.pow(q,n)*(n+1-n*q):Math.pow(q,p.flexPower)*(3-2*q);let coefficients=null;
      if(knots){coefficients=[0,0];if(u>p.flexStart){let j=0;while(j<knots.length-2&&knots[j+1].u<u)j++;const a=knots[j],b=knots[j+1],w=b.u-a.u,t=(u-a.u)/w,t2=t*t,t3=t2*t;coefficients=a.c.map((v,k)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*w*a.d[k]+(-2*t3+3*t2)*b.c[k]+(t3-t2)*w*b.d[k]);}}
      field.push({q,envelope,sine:Math.sin(TAU*p.wave*u),cosine:Math.cos(TAU*p.wave*u),coefficients,maxDelta:p.strainLimit&&i>0?p.strainLimit/Math.max(.015,radiusAt(p,u),radiusAt(p,u-step))*step:0});
    }
    spineFields.set(key,field);return field;
  }
  function sampleSpine(actor, profile, samples=65) {
    const p=profileOf(profile), centers=[],tangents=[],normals=[],binormals=[];
    if(!p) throw new Error('Spine requires a known specimen profile');
    samples=Math.max(3,Math.floor(samples));
    const cached=actor._spineCache;if(cached&&cached.profile===p&&cached.samples===samples&&cached.phase===actor.beatPhase&&cached.amplitude===actor.amplitude&&cached.turn===actor.turnRate)return cached.spine;
    const step=1/(samples-1),field=spineField(p,samples),sinPhase=Math.sin(actor.beatPhase),cosPhase=Math.cos(actor.beatPhase);
    let c=[-.5,0,0], previous=[1,0,0],previousTheta=0;
    for(let i=0;i<samples;i++) {
      const f=field[i],q=f.q;
      let theta=actor.amplitude*f.envelope*(f.sine*cosPhase-f.cosine*sinPhase)+actor.turnRate*.09*q*q;
      if(p.sourceChain) {
        theta=(f.coefficients[0]*sinPhase+f.coefficients[1]*cosPhase)*(actor.amplitude/p.amplitude)+actor.turnRate*.09*q*q;
      }
      if(p.strainLimit && i>0) {
        // C-infinity bounded increment: no hard clamp active-set changes during
        // a beat. The full visible source-fin radii remain the strain constraint.
        const x=(theta-previousTheta)/f.maxDelta;
        theta=previousTheta+f.maxDelta*x/Math.sqrt(Math.sqrt(1+x*x*x*x));
      }
      const tangent=[Math.cos(theta),0,Math.sin(theta)], side=[-tangent[2],0,tangent[0]];
      if(i>0) { const mid=unit(previous.map((v,k)=>v+tangent[k])); c=c.map((v,k)=>v+mid[k]*step); }
      centers.push(c.slice()); tangents.push(tangent); normals.push([0,1,0]); binormals.push(side); previous=tangent;previousTheta=theta;
    }
    const spine={centers,tangents,normals,binormals,length:1,headX:-.5,tailX:.5};actor._spineCache={profile:p,samples,phase:actor.beatPhase,amplitude:actor.amplitude,turn:actor.turnRate,spine};return spine;
  }
  function radiusAt(profile,u){const q=clamp(u,0,1)*(profile.radii.length-1),i=Math.min(profile.radii.length-2,Math.floor(q));return mix(profile.radii[i],profile.radii[i+1],q-i);}
  function deform(point,actor,profile,spine) {
    spine=spine||sampleSpine(actor,profile); const n=spine.centers.length;
    const q=clamp(point[0]+.5,0,1)*(n-1), i=Math.min(n-2,Math.floor(q)), t=q-i;
    const center=spine.centers[i].map((v,k)=>mix(v,spine.centers[i+1][k],t));
    const tangent=unit(spine.tangents[i].map((v,k)=>mix(v,spine.tangents[i+1][k],t)));
    const side=[-tangent[2],0,tangent[0]], extension=point[0]<-.5?point[0]+.5:point[0]>.5?point[0]-.5:0;
    return center.map((v,k)=>v+tangent[k]*extension+side[k]*point[2]+(k===1?point[1]:0));
  }
  function snapshot(state) {
    return {id:state.id,count:state.count,time:state.time,mode:state.mode,pointer:state.pointer,shape:state.shape,contact:state.contact,actors:state.actors.map(a=>({
      position:a.position.slice(),velocity:a.velocity.slice(),yaw:a.yaw,pitch:a.pitch,roll:a.roll,speed:a.speed,
      beatPhase:a.beatPhase,finPhase:a.finPhase,amplitude:a.amplitude,frequency:a.frequency,turnRate:a.turnRate,threat:a.threat,thrust:a.thrust,caudalPeduncle:{...a.caudalPeduncle},
      finAngles:{...a.finAngles},finWaves:JSON.parse(JSON.stringify(a.finWaves)),eyes:{...a.eyes}
    }))};
  }
  return {profiles,create,configureShape,collisionBox:box,groupClearance,update,reset,snapshot,sampleSpine,deform,convention:'Head -X; tail +X; Ry(yaw)*Rz(-pitch)*Rx(roll) with forward [-cos(yaw)*cos(pitch),sin(pitch),sin(yaw)*cos(pitch)]; body-length units; angular spine amplitude radians; profile envelopes are engineering candidates'};
});
