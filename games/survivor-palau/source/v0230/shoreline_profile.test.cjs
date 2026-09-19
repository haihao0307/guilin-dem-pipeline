const assert=require('assert/strict');
const S=require('./shoreline_profile.cjs');
const eps=1e-5;
const result={profileId:'SMI_WAKE_BAY_R01',passed:false,checks:{}};
for(const k of S.KNOTS){
 assert(Math.abs(S.profileElevation(k[0])-k[1])<1e-12);
 const l=S.profileSlope(k[0]-eps),r=S.profileSlope(k[0]+eps);
 assert(Math.abs(l-r)<2e-4,`C1 slope break at ${k[0]}: ${l} ${r}`);
}
result.checks.c1Knots=true;
let last=S.profileElevation(-16);
for(let s=-15.99;s<=40;s+=.01){const y=S.profileElevation(s);assert(y<=last+1e-10,`profile rises at ${s}`);last=y;}
result.checks.monotonicSeaward=true;
for(const level of [0.06,0.18,0.30]){
 const s=S.waterlineSignedDistance(level);assert(Number.isFinite(s));assert(Math.abs(S.profileElevation(s)-level)<1e-9);
 result.checks[`waterline_${level.toFixed(2)}`]={signedDistance:s,gap:Math.abs(S.profileElevation(s)-level)};
}
const R=()=>27,legacy=()=>-99;
const th=S.BAY.center,r=27,x=Math.cos(th)*r,z=Math.sin(th)*r;
const center=S.shoreAt(x,z,legacy,R,.18);
assert(Math.abs(center.signedDistance)<1e-10);assert(Math.abs(center.elevation-.18)<1e-10);assert(center.profileWeight===1);
result.checks.meanContactGap=Math.abs(center.elevation-.18);
const farTheta=S.BAY.center+1.0,fx=Math.cos(farTheta)*r,fz=Math.sin(farTheta)*r;
assert(S.bedAt(fx,fz,legacy,R)===-99);
result.checks.outsideBayPreservesLegacy=true;
for(let s=-15;s<=38;s+=.25){
 const rr=27+s,xx=Math.cos(th)*rr,zz=Math.sin(th)*rr;
 const renderBed=S.bedAt(xx,zz,legacy,R);
 const playerContact=S.shoreAt(xx,zz,legacy,R,.18).elevation;
 assert(Math.abs(renderBed-playerContact)<1e-12);
}
result.checks.renderContactSameField=true;
result.passed=true;
console.log(JSON.stringify(result,null,2));
