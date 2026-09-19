/* Stone Money Island wake-up-bay shoreline R01.
   Pure field core: no render buffers, no assets, no Ocean shader changes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.StoneMoneyShorelineCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KNOTS=Object.freeze([
  Object.freeze([-16.0, 1.85,-0.090]),
  Object.freeze([ -9.0, 1.12,-0.115]),
  Object.freeze([ -3.0, 0.43,-0.105]),
  Object.freeze([  0.0, 0.18,-0.075]),
  Object.freeze([  9.0,-0.43,-0.055]),
  Object.freeze([ 24.0,-1.02,-0.025]),
  Object.freeze([ 40.0,-1.25,-0.008])
]);
const BAY=Object.freeze({center:0.76,fullHalfAngle:0.46,fadeAngle:0.20,crossMin:-18,crossFullMin:-15,crossFullMax:38,crossMax:43});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
function smooth01(t){t=clamp(t,0,1);return t*t*(3-2*t);}
function angleDelta(a,b){let d=(a-b+Math.PI)%(Math.PI*2);if(d<0)d+=Math.PI*2;return d-Math.PI;}
function hermite(s,a,b){
 const h=b[0]-a[0],t=(s-a[0])/h,t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*h*a[2]+(-2*t3+3*t2)*b[1]+(t3-t2)*h*b[2];
}
function hermiteSlope(s,a,b){
 const h=b[0]-a[0],t=(s-a[0])/h,t2=t*t;
 return ((6*t2-6*t)*a[1]+(3*t2-4*t+1)*h*a[2]+(-6*t2+6*t)*b[1]+(3*t2-2*t)*h*b[2])/h;
}
function segmentFor(s){
 for(let i=0;i<KNOTS.length-1;i++) if(s<=KNOTS[i+1][0]) return [KNOTS[i],KNOTS[i+1]];
 return [KNOTS[KNOTS.length-2],KNOTS[KNOTS.length-1]];
}
function profileElevation(s){
 if(s<=KNOTS[0][0]){const k=KNOTS[0];return k[1]+k[2]*(s-k[0]);}
 if(s>=KNOTS[KNOTS.length-1][0]){const k=KNOTS[KNOTS.length-1];return k[1]+k[2]*(s-k[0]);}
 const [a,b]=segmentFor(s);return hermite(s,a,b);
}
function profileSlope(s){
 if(s<=KNOTS[0][0])return KNOTS[0][2];
 if(s>=KNOTS[KNOTS.length-1][0])return KNOTS[KNOTS.length-1][2];
 const [a,b]=segmentFor(s);return hermiteSlope(s,a,b);
}
function bayWeight(theta){
 const a=Math.abs(angleDelta(theta,BAY.center));
 if(a<=BAY.fullHalfAngle)return 1;
 if(a>=BAY.fullHalfAngle+BAY.fadeAngle)return 0;
 return 1-smooth01((a-BAY.fullHalfAngle)/BAY.fadeAngle);
}
function crossWeight(s){
 const left=smooth01((s-BAY.crossMin)/(BAY.crossFullMin-BAY.crossMin));
 const right=1-smooth01((s-BAY.crossFullMax)/(BAY.crossMax-BAY.crossFullMax));
 return clamp(left*right,0,1);
}
function frameAt(x,z,islandRadius){
 const r=Math.hypot(x,z),theta=Math.atan2(z,x),R=islandRadius(theta),s=r-R;
 return {r,theta,R,s,weight:bayWeight(theta)*crossWeight(s)};
}
function bedAt(x,z,legacyBed,islandRadius){
 const f=frameAt(x,z,islandRadius),legacy=legacyBed(x,z);
 return mix(legacy,profileElevation(f.s),f.weight);
}
function materialAt(s,waterLevel=0.18){
 const y=profileElevation(s);
 if(y>waterLevel+.18)return 'dry_white_sand';
 if(y>waterLevel-.10)return 'wet_sand_swatch';
 if(s<9)return 'active_swash_sand';
 if(s<24)return 'shallow_lagoon_sand_rubble';
 return 'reef_flat_transition';
}
function shoreAt(x,z,legacyBed,islandRadius,waterLevel=0.18){
 const f=frameAt(x,z,islandRadius),elevation=bedAt(x,z,legacyBed,islandRadius);
 const radial=[Math.cos(f.theta),Math.sin(f.theta)],tangent=[-radial[1],radial[0]];
 return {signedDistance:f.s,elevation,waterLevel,waterDepth:waterLevel-elevation,
  tangent,outwardNormal:radial,beachSlope:profileSlope(f.s),materialClass:materialAt(f.s,waterLevel),
  profileWeight:f.weight,profileId:'SMI_WAKE_BAY_R01'};
}
function waterlineSignedDistance(level){
 let lo=-16,hi=40;
 if(profileElevation(lo)<level||profileElevation(hi)>level)return null;
 for(let i=0;i<64;i++){const m=(lo+hi)/2;if(profileElevation(m)>level)lo=m;else hi=m;}
 return (lo+hi)/2;
}
return Object.freeze({KNOTS,BAY,profileElevation,profileSlope,bayWeight,crossWeight,frameAt,bedAt,materialAt,shoreAt,waterlineSignedDistance});
});
