/** FH88 R01: deterministic SI cycle-averaged steam/longitudinal driving runtime.
 * No renderer, network, imported meshes or wall-clock physics. See MODEL.md.
 */
const clone = x => JSON.parse(JSON.stringify(x));
const deepFreeze = x => { if(x&&typeof x==='object'){for(const v of Object.values(x))deepFreeze(v);Object.freeze(x);}return x;};
const finite = (x,n) => { if(typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`${n} must be finite`); return x; };
const range = (x,lo,hi,n) => {finite(x,n); if(x<lo||x>hi)throw new RangeError(`${n} outside [${lo},${hi}]`);return x;};
const positive = (x,n) => {finite(x,n);if(x<=0)throw new RangeError(`${n} must be positive`);return x;};
const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
export function validateParameters(p) {
 if(p?.schema!=='FH88_SI_DRIVING_PARAMETERS_R01')throw new Error('EXPLICIT_SI_PARAMETER_SCHEMA_REQUIRED');
 for(const name of ['clock','train','engine','supply','rail','initialControls'])if(!p[name])throw new Error(`Missing ${name}`);
 for(const g of ['clock','train','engine','supply','rail'])for(const [k,v]of Object.entries(p[g]))finite(v,`${g}.${k}`);
 finite(p.train.initialMechanicalThetaRad,'initialMechanicalThetaRad');
 positive(p.supply.maximumPressurePa,'maximumPressurePa');
 range(p.clock.fixedDtS,1/1000,1/30,'fixedDtS');
 if(!Number.isInteger(p.clock.maxStepsPerAdvance)||p.clock.maxStepsPerAdvance<1)throw new RangeError('maxStepsPerAdvance');
 for(const n of ['massKg','adhesiveMassKg','brakedMassKg','wheelDiameterM'])positive(p.train[n],n);
 range(p.train.equivalentMassFactor,1,2,'equivalentMassFactor');
 if(p.train.adhesiveMassKg>p.train.massKg||p.train.brakedMassKg>p.train.massKg)throw new RangeError('Axle load cannot exceed train mass');
 const e=p.engine,s=p.supply,r=p.rail;
 if(e.cylinderCount!==3)throw new RangeError('This revision requires three cylinders');
 for(const n of ['cylinderBoreM','strokeM','steamTemperatureK','steamGasConstantJkgK','steamHeatJkg','maxSteamFlowKgS','referencePressurePa','exhaustPressurePa'])positive(e[n],n);
 range(e.cutoffMin,0.001,1,'cutoffMin');range(e.cutoffMax,e.cutoffMin,1,'cutoffMax');range(e.polytropicExponent,1.0001,1.99,'polytropicExponent');
 for(const n of ['diagramFactor','mechanicalEfficiency','maxIndicatedHeatFraction'])range(e[n],0.0001,1,n);
 range(e.maxDirectionChangeSpeedMps,0,1,'maxDirectionChangeSpeedMps');
 if(e.referencePressurePa<=e.exhaustPressurePa)throw new RangeError('pressure reference order');
 for(const n of ['pressureComplianceJPa','fuelLowerHeatingValueJkg','fireLagS','maxFiringKgS'])positive(s[n],n);
 range(s.absorbedHeatFraction,0.0001,1,'absorbedHeatFraction');
 for(const n of ['ambientLossW','coalInitialKg','waterInitialKg','initialFireKgS'])range(s[n],0,1e12,n);
 if(s.maximumPressurePa<=e.exhaustPressurePa)throw new RangeError('pressure maximum order');
 range(s.initialPressurePa,e.exhaustPressurePa,s.maximumPressurePa,'initialPressurePa');range(s.initialFireKgS,0,s.maxFiringKgS,'initialFireKgS');
 positive(r.gravityMps2,'gravityMps2');range(r.adhesionCoefficient,0,1,'adhesionCoefficient');
 for(const n of ['rollingConstantN','rollingLinearNsM','aeroQuadraticNs2M2','maxBrakeForceN'])range(r[n],0,1e12,n);
 positive(r.brakeBuildS,'brakeBuildS');positive(r.brakeReleaseS,'brakeReleaseS');range(r.maxAbsGrade,0,0.3,'maxAbsGrade');
 validateControls(p,p.initialControls);
 return true;
}
function validateControls(p,c) {
 const known=['throttle','reverser','cutoff','brake','firingKgS','grade'];
 for(const key of Object.keys(c))if(!known.includes(key))throw new Error(`Unknown control ${key}`);
 range(c.throttle,0,1,'throttle');range(c.brake,0,1,'brake');range(c.cutoff,p.engine.cutoffMin,p.engine.cutoffMax,'cutoff');
 if(![-1,0,1].includes(c.reverser))throw new RangeError('reverser must be -1, 0 or 1');
 range(c.firingKgS,0,p.supply.maxFiringKgS,'firingKgS');range(c.grade,-p.rail.maxAbsGrade,p.rail.maxAbsGrade,'grade');
}
/** Integral_0^1 max(p_in * expansion(u) - p_exhaust, 0) du [Pa]. */
export function meanEffectivePressurePa(pIn,pExhaust,cutoff,n) {
 if(pIn<=pExhaust)return 0;
 // expansion p=pIn on [0,c], then pIn*(c/u)^n; release to exhaust when it reaches pExhaust.
 const end=Math.min(1,cutoff*Math.pow(pIn/pExhaust,1/n));
 return pIn*cutoff + pIn*Math.pow(cutoff,n)*(Math.pow(end,1-n)-Math.pow(cutoff,1-n))/(1-n) - pExhaust*end;
}
/** Constant-force integration with exact stop event; passive forces never reverse a stopped train. */
function motion(v0,dt,m,drive,grade,brake,p) {
 let v=v0,remaining=dt,dx=0,travel=0,dragJ=0,brakeJ=0,driveJ=0,positiveDriveJ=0,gradeJ=0,lastA=0;
 for(let part=0;part<3&&remaining>1e-14;part++){
  const base=drive+grade;
  const drag=p.rollingConstantN+p.rollingLinearNsM*Math.abs(v)+p.aeroQuadraticNs2M2*v*v;
  if(Math.abs(v)<1e-12 && Math.abs(base)<=drag+brake){v=0;lastA=0;break;}
  const sign=v===0?Math.sign(base):Math.sign(v);
  const force=base-sign*(drag+brake),a=force/m;
  let h=remaining;
  if(v*a<0&&-v/a<h)h=-v/a;
  const ds=v*h+0.5*a*h*h;
  dx+=ds;travel+=Math.abs(ds);dragJ+=drag*Math.abs(ds);brakeJ+=brake*Math.abs(ds);driveJ+=drive*ds;positiveDriveJ+=Math.max(0,drive*ds);gradeJ+=grade*ds;
  v+=a*h;remaining-=h;lastA=a;
  if(Math.abs(v)<1e-10)v=0;
 }
 return {v,dx,travel,dragJ,brakeJ,driveJ,positiveDriveJ,gradeJ,lastA};
}
export class DrivingPhysics {
 constructor(parameters) {
  validateParameters(parameters);this.p=deepFreeze(clone(parameters));
  this.reset();
 }
 reset(initial={}) {
  const known=['positionM','speedMps','pressurePa','coalKg','waterKg','controls'];
  for(const key of Object.keys(initial))if(!known.includes(key))throw new Error(`Unknown initial field ${key}`);
  const p=this.p,s=p.supply,e=p.engine;
  const x=finite(initial.positionM??0,'positionM'),v=range(initial.speedMps??0,-100,100,'speedMps');
  const pressure=range(initial.pressurePa??s.initialPressurePa,e.exhaustPressurePa,s.maximumPressurePa,'pressurePa');
  const coal=range(initial.coalKg??s.coalInitialKg,0,1e9,'coalKg'),water=range(initial.waterKg??s.waterInitialKg,0,1e9,'waterKg');
  const controls={...p.initialControls,...initial.controls};validateControls(p,controls);
  this.adhesionCoefficient=p.rail.adhesionCoefficient;this.controls=controls;this.tick=0;this.accumulatorS=0;this.paused=false;
  this.state={timeS:0,positionM:x,rollingOriginPositionM:x,wheelRadiusM:p.train.wheelDiameterM/2,wheelDiameterM:p.train.wheelDiameterM,initialMechanicalThetaRad:p.train.initialMechanicalThetaRad,speedMps:v,accelerationMps2:0,wheelAngleRad:0,wheelAngularSpeedRadS:v/(p.train.wheelDiameterM/2),wheelAngularAccelerationRadS2:0,boilerPressurePa:pressure,steamChestPressurePa:e.exhaustPressurePa,boilerReserveJ:(pressure-e.exhaustPressurePa)*s.pressureComplianceJPa,fireEnergyJ:s.initialFireKgS*s.fuelLowerHeatingValueJkg*s.absorbedHeatFraction*s.fireLagS,coalKg:coal,waterKg:water,brakeFraction:controls.brake};
  this.ledger={fuelChemicalJ:0,unabsorbedFuelJ:0,ambientJ:0,reliefJ:0,steamHeatJ:0,steamMassKg:0,wheelWorkJ:0,indicatedWorkJ:0,engineRejectJ:0,mechanicalLossJ:0,rollingLossJ:0,brakeLossJ:0,gradeWorkJ:0,coalUsedKg:0};
  this.initial={energyJ:this.state.boilerReserveJ+this.state.fireEnergyJ,kineticJ:0.5*this.effectiveMassKg*v*v,coalKg:coal,waterKg:water,positionM:x};
  this.diagnostics={tractionForceN:0,requestedTractionForceN:0,adhesionLimitN:p.rail.adhesionCoefficient*p.train.adhesiveMassKg*p.rail.gravityMps2,tractionLimitedByAdhesion:false,tractionLimitedBySupply:false,wheelPowerW:0,steamFlowKgS:0,steamHeatW:0,brakeForceN:0,gradeForceN:0};
  return this.snapshot();
 }
 /** Rail weather is a bounded physical input; frozen design parameters stay unchanged. */
 setAdhesionCoefficient(value){this.adhesionCoefficient=range(value,0,1,'adhesionCoefficient');}
 /** Explicit fixture relocation, never called by the driving loop. Rebase conserved quantities. */
 place({positionM=this.state.positionM,speedMps=this.state.speedMps}={}){
  finite(positionM,'positionM');range(speedMps,-100,100,'speedMps');
  const s=this.state,dx=positionM-s.positionM;
  this.initial.kineticJ+=.5*this.effectiveMassKg*(speedMps*speedMps-s.speedMps*s.speedMps);
  this.initial.positionM+=dx;s.rollingOriginPositionM+=dx;s.positionM=positionM;s.speedMps=speedMps;
  s.accelerationMps2=0;s.wheelAngularSpeedRadS=speedMps/s.wheelRadiusM;s.wheelAngularAccelerationRadS2=0;
 }
 /** Terminal game boundary only: account removed kinetic energy as an imposed brake stop. */
 stopAtBoundary(){
  const s=this.state;this.ledger.brakeLossJ+=.5*this.effectiveMassKg*s.speedMps*s.speedMps;
  s.speedMps=0;s.accelerationMps2=0;s.wheelAngularSpeedRadS=0;s.wheelAngularAccelerationRadS2=0;
  this.controls={...this.controls,throttle:0,brake:1};
 }
 get effectiveMassKg(){return this.p.train.massKg*this.p.train.equivalentMassFactor;}
 setControls(patch) {
  const c={...this.controls,...patch};validateControls(this.p,c);
  if(c.reverser!==0&&c.reverser!==this.controls.reverser){
   if(Math.abs(this.state.speedMps)>this.p.engine.maxDirectionChangeSpeedMps)throw new Error('DIRECTION_CHANGE_REQUIRES_NEAR_STOP');
   if(c.throttle>0)throw new Error('CLOSE_THROTTLE_BEFORE_DIRECTION_CHANGE');
  }
  this.controls=c;return {...c};
 }
 setPaused(paused) {if(typeof paused!=='boolean')throw new TypeError('paused must be boolean');this.paused=paused;return paused;}
 mechanicalState() {
  const s=this.state;
  return {worldTimeS:s.timeS,commonThetaRad:this.p.train.initialMechanicalThetaRad-s.wheelAngleRad,omegaRadS:-s.wheelAngularSpeedRadS,alphaRadS2:-s.wheelAngularAccelerationRadS2};
 }
 snapshot(){return {...clone(this.state),adhesionCoefficient:this.adhesionCoefficient,effectiveMassKg:this.effectiveMassKg,controls:{...this.controls},diagnostics:{...this.diagnostics},ledger:{...this.ledger},paused:this.paused,tick:this.tick,backlogS:this.accumulatorS,residuals:this.residuals()};}
 residuals(){
  const s=this.state,l=this.ledger,ke=0.5*this.effectiveMassKg*s.speedMps*s.speedMps;
  return {thermalEnergyJ:s.boilerReserveJ+s.fireEnergyJ-this.initial.energyJ-l.fuelChemicalJ+l.unabsorbedFuelJ+l.ambientJ+l.reliefJ+l.steamHeatJ,mechanicalEnergyJ:ke-this.initial.kineticJ-l.wheelWorkJ-l.gradeWorkJ+l.rollingLossJ+l.brakeLossJ,engineEnergyJ:l.steamHeatJ-l.wheelWorkJ-l.mechanicalLossJ-l.engineRejectJ,coalKg:s.coalKg+l.coalUsedKg-this.initial.coalKg,waterKg:s.waterKg+l.steamMassKg-this.initial.waterKg};
 }
 /** Supply-limited cycle work per metre, valid at zero speed without P/v. */
 _engine(vForFlow) {
  const p=this.p,e=p.engine,c=this.controls,s=this.state;
  const empty={forceN:0,heatJperM:0,massKgPerM:0,pressurePa:e.exhaustPressurePa};
  if(c.throttle<=0||c.reverser===0||s.waterKg<=0||s.boilerPressurePa<=e.exhaustPressurePa)return empty;
  const volPerM=2*e.cylinderCount*Math.PI*e.cylinderBoreM**2/4*e.strokeM/(Math.PI*p.train.wheelDiameterM);
  const rhoFactor=1/(e.steamGasConstantJkgK*e.steamTemperatureK);
  const pTarget=e.exhaustPressurePa+c.throttle*(s.boilerPressurePa-e.exhaustPressurePa);
  const demand=pc=>c.cutoff*volPerM*pc*rhoFactor*vForFlow;
  const capacity=pc=>e.maxSteamFlowKgS*c.throttle*Math.sqrt(Math.max(0,s.boilerPressurePa-pc)/(e.referencePressurePa-e.exhaustPressurePa));
  let lo=0,hi=pTarget;
  if(demand(hi)>capacity(hi)){for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(demand(mid)>capacity(mid))hi=mid;else lo=mid;}}
  const pc=hi;
  const meanP=meanEffectivePressurePa(pc,e.exhaustPressurePa,c.cutoff,e.polytropicExponent);
  if(meanP<=0)return {...empty,pressurePa:Math.max(pc,e.exhaustPressurePa)};
  const mass=c.cutoff*volPerM*pc*rhoFactor,heat=mass*e.steamHeatJkg;
  const indicated=Math.min(e.diagramFactor*meanP*volPerM,e.maxIndicatedHeatFraction*heat);
  return {forceN:indicated*e.mechanicalEfficiency,heatJperM:heat,massKgPerM:mass,pressurePa:pc};
 }
 stepTicks(n=1){if(!Number.isInteger(n)||n<0||n>1e7)throw new RangeError('integer ticks in [0,1e7] required');if(this.paused)return this.snapshot();for(let i=0;i<n;i++)this._tick();return this.snapshot();}
 /** Wall/render dt queues physics time. Never silently discards a long frame. */
 advance(elapsedS) {
  range(elapsedS,0,86400,'elapsedS');
  if(this.paused)return this.snapshot();
  this.accumulatorS+=elapsedS;
  let steps=Math.min(this.p.clock.maxStepsPerAdvance,Math.floor((this.accumulatorS+1e-12)/this.p.clock.fixedDtS));
  for(let i=0;i<steps;i++)this._tick();
  this.accumulatorS-=steps*this.p.clock.fixedDtS;if(Math.abs(this.accumulatorS)<1e-12)this.accumulatorS=0;
  return this.snapshot();
 }
 _tick(){
  const p=this.p,s=this.state,c=this.controls,l=this.ledger,q=p.supply,e=p.engine,r=p.rail,dt=p.clock.fixedDtS,m=this.effectiveMassKg,R=p.train.wheelDiameterM/2;
  const usedCoal=Math.min(s.coalKg,c.firingKgS*dt),fuel=usedCoal*q.fuelLowerHeatingValueJkg,absorbed=fuel*q.absorbedHeatFraction;
  const equilibrium=absorbed/dt*q.fireLagS;
  const fireNext=equilibrium+(s.fireEnergyJ-equilibrium)*Math.exp(-dt/q.fireLagS);
  const released=s.fireEnergyJ+absorbed-fireNext;s.fireEnergyJ=fireNext;s.coalKg-=usedCoal;l.coalUsedKg+=usedCoal;l.fuelChemicalJ+=fuel;l.unabsorbedFuelJ+=fuel-absorbed;
  s.boilerReserveJ+=released;
  const ambient=Math.min(s.boilerReserveJ,q.ambientLossW*dt);s.boilerReserveJ-=ambient;l.ambientJ+=ambient;
  const maximum=(q.maximumPressurePa-e.exhaustPressurePa)*q.pressureComplianceJPa;
  const relief=Math.max(0,s.boilerReserveJ-maximum);s.boilerReserveJ-=relief;l.reliefJ+=relief;
  s.boilerPressurePa=e.exhaustPressurePa+s.boilerReserveJ/q.pressureComplianceJPa;
  const tau=c.brake>s.brakeFraction?r.brakeBuildS:r.brakeReleaseS;
  s.brakeFraction=c.brake+(s.brakeFraction-c.brake)*Math.exp(-dt/tau);
  const adhesion=this.adhesionCoefficient*p.train.adhesiveMassKg*r.gravityMps2;
  const brake=Math.min(r.maxBrakeForceN*s.brakeFraction,this.adhesionCoefficient*p.train.brakedMassKg*r.gravityMps2);
  const grade=-p.train.massKg*r.gravityMps2*Math.sin(Math.atan(c.grade));
  // Conservative speed for valve flow estimate covers acceleration within this tick.
  const vFlow=Math.abs(s.speedMps)+(adhesion+Math.abs(grade))*dt/m;
  const engine=this._engine(vFlow);
  const adhesionScale=engine.forceN>0?Math.min(1,adhesion/engine.forceN):1;
  const force=engine.forceN*adhesionScale*c.reverser,heatPerM=engine.heatJperM*adhesionScale,massPerM=engine.massKgPerM*adhesionScale;
  const run=k=>motion(s.speedMps,dt,m,force*k,grade,brake,r);
  const fits=(out,k)=>heatPerM*k*out.travel<=s.boilerReserveJ&&massPerM*k*out.travel<=s.waterKg;
  let scale=1,out=run(1);
  if(!fits(out,1)){
   let low=0,high=1;
   for(let i=0;i<48;i++){const mid=(low+high)/2,candidate=run(mid);if(fits(candidate,mid))low=mid;else high=mid;}
   scale=low;out=run(scale);
  }
  const heat=heatPerM*scale*out.travel,steam=massPerM*scale*out.travel;
  s.boilerReserveJ=Math.max(0,s.boilerReserveJ-heat);s.waterKg=Math.max(0,s.waterKg-steam);
  l.steamHeatJ+=heat;l.steamMassKg+=steam;l.wheelWorkJ+=out.driveJ;l.rollingLossJ+=out.dragJ;l.brakeLossJ+=out.brakeJ;l.gradeWorkJ+=out.gradeJ;
  // Engine work reversal is dissipative: absorbed vehicle work joins exhaust; no fictitious regeneration.
  const positiveWheel=out.positiveDriveJ,indicated=positiveWheel/e.mechanicalEfficiency,mechLoss=indicated-positiveWheel;
  l.indicatedWorkJ+=indicated;l.mechanicalLossJ+=mechLoss;l.engineRejectJ+=heat-out.driveJ-mechLoss;
  const oldV=s.speedMps;s.positionM+=out.dx;s.speedMps=out.v;s.accelerationMps2=(out.v-oldV)/dt;
  s.wheelAngleRad+=out.dx/R;s.wheelAngularSpeedRadS=out.v/R;s.wheelAngularAccelerationRadS2=s.accelerationMps2/R;
  s.boilerPressurePa=e.exhaustPressurePa+s.boilerReserveJ/q.pressureComplianceJPa;s.steamChestPressurePa=engine.pressurePa;
  this.tick++;s.timeS=this.tick*dt;
  this.diagnostics={tractionForceN:force*scale,requestedTractionForceN:engine.forceN*c.reverser,adhesionLimitN:adhesion,tractionLimitedByAdhesion:adhesionScale<1-1e-12,tractionLimitedBySupply:scale<1-1e-12,wheelPowerW:out.driveJ/dt,steamFlowKgS:steam/dt,steamHeatW:heat/dt,brakeForceN:brake,gradeForceN:grade,pressureEvaluationTimeS:s.timeS-dt,model:'CYCLE_AVERAGED_IDEAL_NO_SLIP'};
 }
}
