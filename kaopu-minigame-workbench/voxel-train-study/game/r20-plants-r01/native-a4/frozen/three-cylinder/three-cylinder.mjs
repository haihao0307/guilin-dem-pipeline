/** Original SI research interface. Prescribed common shaft motion, not a steam engine simulator. */
import {pose,loads} from './frozen-core/outside-drive.mjs';
const finite=(v,n)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new TypeError(n+' must be finite');return v;};
const positive=(v,n)=>{finite(v,n);if(v<=0)throw new RangeError(n+' must be positive');return v;};
export function contract(d){
 if(d?.identity!=='FH88_ORIGINAL_THREE_PARALLEL_CYLINDER_BENCH_R01'||d.lengthUnit!=='m')throw Error('EXPLICIT_ORIGINAL_METRE_DESIGN_REQUIRED');
 const g=positive(d.track?.nominalGaugeM,'gauge'),w=positive(d.track?.railHeadProxyWidthM,'rail width'),z=finite(d.track?.railTopZM,'rail top');
 const R=positive(d.wheel?.diameterM,'diameter')/2,h=positive(d.wheel?.envelopeHalfWidthM,'wheel half width');
 positive(d.strokeM,'stroke');positive(d.rodPinCentresM,'rod');positive(d.outsideRodGapFromWheelFaceM,'rod axial gap');
 if(!Array.isArray(d.cylinders)||d.cylinders.length!==3)throw Error('THREE_EXPLICIT_CYLINDERS_REQUIRED');
 if(new Set(d.cylinders.map(c=>c.id)).size!==3)throw Error('UNIQUE_CYLINDER_IDENTITIES_REQUIRED');
 for(const c of d.cylinders){finite(c.axisYM,'cylinder Y');finite(c.crankPhaseRad,'crank phase');if(c.axisAngleRad!==0)throw Error('ONLY_EXPLICIT_PARALLEL_INLINE_BENCH_SUPPORTED');}
 const contactHalf=(g+w)/2, expectedOutside=contactHalf+h+d.outsideRodGapFromWheelFaceM;
 const named=Object.fromEntries(d.cylinders.map(c=>[c.id,c]));
 if(!named.left||!named.right||!named.inside)throw Error('RIGHT_INSIDE_LEFT_REQUIRED');
 if(Math.abs(named.right.axisYM+expectedOutside)>1e-10||Math.abs(named.left.axisYM-expectedOutside)>1e-10||Math.abs(named.inside.axisYM)>1e-10)throw Error('INCONSISTENT_AXIAL_STACK');
 return {scope:'NOMINAL_CONTACT_AND_AXIAL_DATUM_CONTRACT',gaugeM:g,railInnerFaceYM:[-g/2,g/2],railHeadCentreYM:[-contactHalf,contactHalf],nominalRollingCircleYM:[-contactHalf,contactHalf],wheelAxleZM:z+R,railTopZM:z,wheelRadiusM:R,crankReferencePointM:[0,0,z+R],outsideCylinderAxisAbsYM:expectedOutside,actualTreadFlangeCompatibilityEstablished:false};
}
function single(d){return {identity:'FH88_ORIGINAL_OUTSIDE_DRIVE_CANDIDATE',wheelDiameterM:d.wheel.diameterM,strokeM:d.strokeM,rodPinCentresM:d.rodPinCentresM,rodPlaneOutboardM:d.outsideRodGapFromWheelFaceM,rodEnvelopeRadiusM:.03,crossheadHalfLengthM:.1,wheelDepthM:2*d.wheel.envelopeHalfWidthM,guideMinM:d.rodPinCentresM-d.strokeM/2-.125,guideMaxM:d.rodPinCentresM+d.strokeM/2+.125};}
export function evaluate(d,state,externalAxialForcesN,equivalentMassesKg){
 const datum=contract(d),p=single(d);
 for(const k of ['worldTimeS','commonThetaRad','omegaRadS','alphaRadS2'])finite(state?.[k],k);
 for(const [name,v] of [['forces',externalAxialForcesN],['masses',equivalentMassesKg]])if(!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('THREE_EXPLICIT_FINITE_'+name.toUpperCase()+'_REQUIRED');
 if(equivalentMassesKg.some(m=>m<0))throw Error('NEGATIVE_MASS');
 const cylinders=d.cylinders.map((c,i)=>{
  const theta=state.commonThetaRad+c.crankPhaseRad;
  const k=loads(p,{thetaRad:theta,omegaRadS:state.omegaRadS,alphaRadS2:state.alphaRadS2},externalAxialForcesN[i],equivalentMassesKg[i]);
  const force=-equivalentMassesKg[i]*k.accelerationMS2;
  return {id:c.id,phaseRad:c.crankPhaseRad,localThetaRad:theta,crankPinWorldM:[k.crankPinM[0],c.axisYM,k.crankPinM[2]+datum.wheelAxleZM],crossheadPinWorldM:[k.crossheadPinM[0],c.axisYM,datum.wheelAxleZM],kinematicsAndLoads:k,sliderInertialReactionOnFrameXN:force,sliderInertialYawCoupleNm:-c.axisYM*force};
 });
 const sum=fn=>cylinders.reduce((a,c)=>a+fn(c),0);
 return {scope:'PRESCRIBED_SHAFT_KINEMATICS_AND_SLIDER_ONLY_INERTIA',worldTimeS:state.worldTimeS,commonThetaRad:state.commonThetaRad,cylinders,
 shaftTorqueNm:sum(c=>c.kinematicsAndLoads.torqueNm),shaftPowerW:sum(c=>c.kinematicsAndLoads.crankPowerW),externalPistonPowerW:sum(c=>c.kinematicsAndLoads.pistonPowerW),sliderKineticEnergyRateW:sum(c=>c.kinematicsAndLoads.sliderKineticEnergyRateW),
 sliderInertialNetFrameForceXN:sum(c=>c.sliderInertialReactionOnFrameXN),sliderInertialYawCoupleNm:sum(c=>c.sliderInertialYawCoupleNm),momentReferencePointM:datum.crankReferencePointM,
 notIncluded:['rotating/rod inertia','counterweights','gyroscopic terms','structural response','steam valve timing','wheel-slip/contact force','vehicle acceleration','whole-machine collisions']};
}
export function nominalRollingContact(d,{bodySpeedMS,omegaRadS,bodyXM=0}){
 const c=contract(d);finite(bodySpeedMS,'body speed');finite(omegaRadS,'omega');finite(bodyXM,'body X');
 const slipVelocity=bodySpeedMS+c.wheelRadiusM*omegaRadS;
 return {scope:'IDEAL_ROLLING_CIRCLE_AT_NOMINAL_CONTACT_LINES',bottomPointWorldM:c.nominalRollingCircleYM.map(y=>[bodyXM,y,c.railTopZM]),contactPointLongitudinalVelocityMS:slipVelocity,pureRolling:Math.abs(slipVelocity)<1e-10,actualTreadOrAdhesionValidated:false};
}
