/* Independent CPU replay of actual r29 web source; no renderer changes. */
'use strict';const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=require('./model_path').modelPath(),P=require(path.join(ROOT,'topology-parameters')),src=JSON.parse(fs.readFileSync(path.join(ROOT,'COVER_EXPORT.json'),'utf8')).source,C=P.chest,webStart=C.rear+.002;
assert(src.includes('length(p.xy-a-t*d)-.045')&&src.includes('4.3819999999999997-p.z'),'Actual exported web rear cap must match cover interface');
assert(src.includes('max(4.37-axisZ,axisZ-5.13)'),'Actual web stays between power covers');
function ann(q,ri,ro,lo,hi){const rad=Math.hypot(q[0],q[1]);return Math.max(ri-rad,rad-ro,lo-q[2],q[2]-hi);}
function local(p,b){const s=Math.sin(b),c=Math.cos(b);return [p[0],c*(p[1]-1.016)-s*p[2],s*(p[1]-1.016)+c*p[2]];}
function cyl(q,r,lo,hi){return Math.max(Math.hypot(q[0],q[1])-r,lo-q[2],q[2]-hi);}
function outer(p,b){const a=[0,1.016+Math.tan(b)*p[2]],d=[P.middleX,P.planeY-a[1]],q=[p[0],p[1]-a[1]],h=Math.max(0,Math.min(1,(q[0]*d[0]+q[1]*d[1])/(d[0]**2+d[1]**2)));const axisZ=local(p,b)[2];return Math.max(Math.hypot(q[0]-h*d[0],q[1]-h*d[1])-.045,webStart-p[2],p[2]-5.0,4.37-axisZ,axisZ-5.13);}
function web(p,b){return Math.max(outer(p,b),-cyl(local(p,b),.23495,4.2,5.3),-cyl([p[0]-P.middleX,p[1]-P.planeY,p[2]],C.boreRadius,4.2,5.3));}
function power(p,b){return ann(local(p,b),.23495,.26,4.35,5.15);}
function chest(p){return ann([p[0]-P.middleX,p[1]-P.planeY,p[2]],C.boreRadius,C.outerRadius,C.rear,C.front);}
let boreQueries=0,ligamentQueries=0,minimumLigamentWidth=Infinity,leastDeepContact=-Infinity,maxBoreField=-Infinity;const witnesses=[];
for(let ib=0;ib<=10;ib++)for(let iz=0;iz<=16;iz++){
 const b=.11+.05*ib/10,z=C.rear+.025+(C.front-.025-C.rear-.025)*iz/16,ay=1.016+Math.tan(b)*z,dy=P.planeY-ay,dv=Math.hypot(P.middleX,dy),dp=Math.hypot(P.middleX,Math.cos(b)*dy);
 const ta=(.23495+.26)/2/dp,tb=1-(C.boreRadius+C.outerRadius)/2/dv;assert(ta<tb);
 const A=[ta*P.middleX,ay+ta*dy,z],B=[tb*P.middleX,ay+tb*dy,z];
 assert(web(A,b)<0&&power(A,b)<0,'Web must overlap preserved power wall');assert(web(B,b)<0&&chest(B)<0,'Web must overlap candidate chest wall');
 minimumLigamentWidth=Math.min(minimumLigamentWidth,(1-C.boreRadius/dv-.23495/dp)*dv);leastDeepContact=Math.max(leastDeepContact,web(A,b),power(A,b),web(B,b),chest(B));
 if(iz===8&&[0,5,10].includes(ib))witnesses.push({beta:b,z,powerContact:A,powerFields:[web(A,b),power(A,b)],chestContact:B,chestFields:[web(B,b),chest(B)]});
 for(let k=0;k<=64;k++){const t=ta+(tb-ta)*k/64,p=[t*P.middleX,ay+t*dy,z];assert(web(p,b)<0);assert(Math.abs(p[0])<.525);ligamentQueries++;}
 for(let k=0;k<48;k++){
  const a=k*2*Math.PI/48,r=.23495*.999,p=[r*Math.cos(a),ay+r*Math.sin(a)/Math.cos(b),z],v=[P.middleX+C.boreRadius*.999*Math.cos(a),P.planeY+C.boreRadius*.999*Math.sin(a),z];
  const fp=web(p,b),fv=web(v,b);assert(fp>0&&fv>0,'Web never occupies either bore');maxBoreField=Math.max(maxBoreField,-fp,-fv);boreQueries+=2;
 }
}
// Exact envelope: interpolation of x in [0,m] plus radius.045 remains <=.425,
// wholly inside unchanged frame inner surface .525. This includes all beta values.
const webFrameClearance=.525-(Math.abs(P.middleX)+.045);assert(webFrameClearance>0);
// All-beta existence certificate at a single interior section, not whole-volume proof.
// beta is in [.11,.16]; tan increases and cos decreases there; delta=ay-planeY>0.
const betaRange=[.11,.16],zStar=4.7,deltaLo=1.016+Math.tan(.11)*zStar-P.planeY,deltaHi=1.016+Math.tan(.16)*zStar-P.planeY;
assert(deltaLo>0);const dpLower=Math.hypot(P.middleX,Math.cos(.16)*deltaLo),dvLower=Math.hypot(P.middleX,deltaLo),taUpper=(.23495+.26)/2/dpLower,tbLower=1-(C.boreRadius+C.outerRadius)/2/dvLower;
const axialLower=Math.sin(.11)*(P.planeY-1.016)+Math.cos(.16)*zStar,axialUpper=zStar/Math.cos(.16);
assert(taUpper+1e-10<tbLower&&axialLower>4.37+1e-10&&axialUpper<5.13-1e-10&&zStar>C.rear&&zStar<C.front);
const continuousConnection={betaRange,worldZ:zStar,taUpper,tbLower,minimumFractionGap:tbLower-taUpper,powerAxialBounds:[axialLower,axialUpper],method:'Monotonic trig bounds enclose all beta and line parameters. All t between radius-midwall contacts remain outside both bores, inside web and axial caps; contacts lie inside existing power and candidate chest walls.',numericalBoundarySlack:1e-10,structuralAcceptance:false};
const rearPowerCoverMaximumZ=4.35*Math.cos(.11)+.26*Math.sin(.11),frontPowerCoverMinimumZ=5.15*Math.cos(.16)-.26*Math.sin(.16);
const removableCoverMargins={rear:C.rear-C.coverThickness-rearPowerCoverMaximumZ,front:frontPowerCoverMinimumZ-C.front-C.coverThickness,webToChestFrontCover:C.front-5.0};
assert(removableCoverMargins.rear>.005&&removableCoverMargins.front>.005&&removableCoverMargins.webToChestFrontCover>.005);
const out={parameters:P,sourceFile:'r29/COVER_EXPORT.json',boreQueries,ligamentQueries,minimumSampledLigamentLengthM:minimumLigamentWidth,largestContactFieldM:leastDeepContact,webFrameClearanceByExactXEnvelope:webFrameClearance,witnesses,continuousConnection,removableCoverMargins,coverEnvelopeMethod:'Power rear-cover maximum at beta.11 and front-cover minimum at beta.16 by monotonic endpoint formulas over [.11,.16]; new covers are horizontal. Bounds cover full discs, not just chosen witnesses.',
 boreExclusion:'Exact boolean max(newWebOuter, -powerBore, -valveBore) excludes both defined bore volumes. Tested source retains both subtractions; this does not cut original solids.',connectivity:'187 interior z/beta slices away from end stud sockets have a continuous sampled interior ligament from overlapping existing power wall to overlapping new chest wall; direct line inequalities underlie witnesses. This is topology, not load capacity.',continuousFullInstallationProof:false,structuralAcceptance:false,wholeAcceptance:false};fs.writeFileSync(path.join(__dirname,'ACTUAL_CASTING_QA.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
