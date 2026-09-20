/**
 * FISH-R1-T01 v0.9 — source-independent largemouth-bass head / mouth / operculum candidate.
 *
 * Axes: x lateral-right, y dorsal-up, u tail(0)->snout(1). Unit = observed body length.
 * Reference GLB is observation-only. No source vertices, texture pixels, rig tracks or topology are embedded.
 */

export const BLACK_BASS_R09 = Object.freeze({
  schema: 'kaopu.fish.black-bass.head-mouth-operculum/0.9',
  taskId: 'FISH-R1-T01',
  species: Object.freeze({ scientific: 'Micropterus salmoides', common: 'Largemouth Bass', habitatIdentity: 'freshwater' }),
  source: Object.freeze({
    referenceId: 'FISH-REF-001',
    sha256: 'c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64',
    originalBytes: 18644040,
    sourceMeshRuntimeDependency: false,
    sourceTextureRuntimeDependency: false,
    sourceRigRuntimeDependency: false,
    sourceAnimationRuntimeDependency: false
  }),
  eyes: Object.freeze({
    leftCenter: Object.freeze([-0.0461234703, 0.0301874735, 0.8773876841]),
    rightCenter: Object.freeze([0.0459188562, 0.0301627850, 0.8773354142]),
    radii: Object.freeze([0.0092, 0.0228, 0.0223]),
    observedExtents: Object.freeze([0.0186357513, 0.0464652615, 0.0453004358])
  }),
  jaw: Object.freeze({
    hinge: Object.freeze([0.0, -0.0745099834, 0.8497990694]),
    safeOpenRangeRad: Object.freeze([0, 0.42]),
    envelope: Object.freeze([
      Object.freeze([0.8497990694,0.012,-0.068,-0.081]),
      Object.freeze([0.865,0.035,-0.040,-0.078]),
      Object.freeze([0.890,0.050,-0.018,-0.073]),
      Object.freeze([0.912,0.052,-0.008,-0.066]),
      Object.freeze([0.933,0.047,-0.004,-0.059]),
      Object.freeze([0.955,0.040,-0.003,-0.051]),
      Object.freeze([0.976,0.031,-0.0025,-0.041]),
      Object.freeze([0.995,0.018,-0.0040,-0.030]),
      Object.freeze([1.003,0.0025,-0.014,-0.020])
    ])
  }),
  cranialProfile: Object.freeze([
    Object.freeze([0.220,0.034,0.060,-0.070]),
    Object.freeze([0.300,0.041,0.080,-0.080]),
    Object.freeze([0.360,0.047,0.100,-0.088]),
    Object.freeze([0.400,0.050,0.108,-0.093]),
    Object.freeze([0.430,0.052,0.111,-0.097]),
    Object.freeze([0.470,0.059,0.112,-0.104]),
    Object.freeze([0.510,0.064,0.127,-0.103]),
    Object.freeze([0.550,0.0676,0.139,-0.103]),
    Object.freeze([0.600,0.06765,0.144,-0.105]),
    Object.freeze([0.650,0.066,0.150,-0.108]),
    Object.freeze([0.700,0.0735,0.149,-0.115]),
    Object.freeze([0.725,0.0744,0.145,-0.105]),
    Object.freeze([0.750,0.0728,0.126,-0.103]),
    Object.freeze([0.775,0.0720,0.127,-0.101]),
    Object.freeze([0.800,0.0704,0.120,-0.098]),
    Object.freeze([0.825,0.0670,0.114,-0.096]),
    Object.freeze([0.850,0.0619,0.095,-0.090]),
    Object.freeze([0.875,0.0586,0.082,-0.086]),
    Object.freeze([0.900,0.0575,0.071,-0.079]),
    Object.freeze([0.925,0.0544,0.060,-0.070]),
    Object.freeze([0.950,0.0461,0.044,-0.061]),
    Object.freeze([0.975,0.0353,0.025,-0.047]),
    Object.freeze([0.997689365,0.0120,0.005,-0.025])
  ]),
  cavityProfile: Object.freeze([
    Object.freeze([0.795,0.051,-0.018,-0.055]),
    Object.freeze([0.825,0.052,-0.014,-0.053]),
    Object.freeze([0.855,0.049,-0.009,-0.049]),
    Object.freeze([0.888,0.044,-0.004,-0.043]),
    Object.freeze([0.922,0.037,0.000,-0.035]),
    Object.freeze([0.954,0.027,0.002,-0.025]),
    Object.freeze([0.984,0.011,0.003,-0.011])
  ]),
  lipCurves: Object.freeze({
    u:Object.freeze([0.812,0.840,0.870,0.900,0.930,0.960,0.985,0.9985]),
    lateral:Object.freeze([0.061,0.061,0.059,0.055,0.048,0.037,0.020,0.003]),
    upperY:Object.freeze([-0.021,-0.016,-0.011,-0.007,-0.003,0.000,0.000,-0.002]),
    lowerY:Object.freeze([-0.030,-0.026,-0.022,-0.017,-0.013,-0.010,-0.010,-0.012]),
    radiusNormal:Object.freeze([0.0042,0.0040,0.0038,0.0035,0.0031,0.0027,0.0020,0.0008])
  }),
  operculum: Object.freeze({
    // External posterior free margin of the operculum. In this coordinate system
    // the tail is smaller u, so the middle of this curve must have a smaller u
    // than both dorsal and ventral endpoints. This corrects the v0.7 reversal.
    freeMarginYU:Object.freeze([
      Object.freeze([0.084,0.704]),
      Object.freeze([0.068,0.675]),
      Object.freeze([0.046,0.651]),
      Object.freeze([0.020,0.633]),
      Object.freeze([-0.008,0.624]),
      Object.freeze([-0.036,0.629]),
      Object.freeze([-0.063,0.646]),
      Object.freeze([-0.085,0.668]),
      Object.freeze([-0.099,0.688])
    ]),
    // Only a narrow anterior overlap band is rendered separately. The broad
    // opercular plate remains part of the continuous head volume, avoiding the
    // flat pasted-on panel seen in v0.8.
    overlapMarginYU:Object.freeze([
      Object.freeze([0.084,0.721]),
      Object.freeze([0.068,0.697]),
      Object.freeze([0.046,0.677]),
      Object.freeze([0.020,0.663]),
      Object.freeze([-0.008,0.655]),
      Object.freeze([-0.036,0.658]),
      Object.freeze([-0.063,0.671]),
      Object.freeze([-0.085,0.686]),
      Object.freeze([-0.099,0.698])
    ]),
    safeOpenRangeRad:Object.freeze([0,0.075]),
    evidence:'NOAA distinguishes external opercular plates from internal gill arches. The visible side line is therefore the posterior free opercular margin; exact plate thickness and excursion remain engineering candidates.'
  }),
  evidenceBoundary:Object.freeze({
    sourceFileFacts:Object.freeze(['body bounds','eye volumes','jaw_22 bind pivot','jaw-weighted envelope','cranial section extents']),
    naturalFacts:Object.freeze(['adult largemouth-bass upper jaw extends behind rear eye margin','operculum/suboperculum are external gill-cover plates; gill arches are internal structures','the visible lateral line is the posterior free opercular margin and bows tailward at mid-height']),
    engineeringCandidates:Object.freeze(['mouth roof boundary','maxillary allowance','operculum thickness','opercular opening amplitude','lip radii']),
    visualAcceptance:false,
    productionReady:false
  })
});

export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};

function rotateAboutHinge([x,y,u],[,hy,hu],angle){const dy=y-hy,du=u-hu,c=Math.cos(angle),s=Math.sin(angle);return[x,hy+dy*c-du*s,hu+dy*s+du*c]}
function superellipsePoint(theta,w,top,bottom,exp=2.25){const si=Math.sin(theta),co=Math.cos(theta),p=2/exp,x=Math.sign(si)*Math.pow(Math.abs(si),p)*w,cy=(top+bottom)/2,ry=co>=0?top-cy:cy-bottom;return[x,cy+Math.sign(co)*Math.pow(Math.abs(co),p)*ry]}
function catmull(a,b,c,d,t){const t2=t*t,t3=t2*t;return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3)}
export function resampleProfile(stations,subdiv=4){const out=[];for(let i=0;i<stations.length-1;i++){const p0=stations[Math.max(0,i-1)],p1=stations[i],p2=stations[i+1],p3=stations[Math.min(stations.length-1,i+2)];for(let k=0;k<subdiv;k++){const t=k/subdiv,row=p1.map((_,j)=>catmull(p0[j],p1[j],p2[j],p3[j],t));row[0]=lerp(p1[0],p2[0],t);row[1]=Math.max(row[1],1e-5);if(row[2]<=row[3])row[2]=row[3]+1e-5;out.push(row)}}out.push([...stations.at(-1)]);return out}
function angleDistance(a,b){const d=Math.abs(a-b)%(2*Math.PI);return Math.min(d,2*Math.PI-d)}
export function loftProfile(stations,{radialSegments=48,exponent=2.3,transformPoint=null,subdivisions=4,skipFace=null}={}){const sampled=resampleProfile(stations,subdivisions),positions=[],indices=[];for(const [u,w,top,bottom] of sampled){for(let k=0;k<radialSegments;k++){const th=2*Math.PI*k/radialSegments,[x,y]=superellipsePoint(th,w,top,bottom,exponent),p=transformPoint?transformPoint([x,y,u]):[x,y,u];positions.push(...p)}}for(let i=0;i<sampled.length-1;i++)for(let k=0;k<radialSegments;k++){const th=2*Math.PI*(k+.5)/radialSegments;if(skipFace&&skipFace({thetaMid:th,stationA:sampled[i],stationB:sampled[i+1]}))continue;const a=i*radialSegments+k,b=i*radialSegments+(k+1)%radialSegments,c=(i+1)*radialSegments+(k+1)%radialSegments,d=(i+1)*radialSegments+k;indices.push(a,b,c,a,c,d)}return{positions,indices,ringCount:sampled.length,radialSegments}}
function widthAtU(u){const s=BLACK_BASS_R09.cranialProfile;if(u<=s[0][0])return s[0][1];if(u>=s.at(-1)[0])return s.at(-1)[1];let i=1;while(s[i][0]<u)i++;const a=s[i-1],b=s[i],t=(u-a[0])/(b[0]-a[0]);return lerp(a[1],b[1],t)}
export function buildCranialMesh({mouthOpenRad=0}={}){const t=clamp(mouthOpenRad/BLACK_BASS_R09.jaw.safeOpenRangeRad[1],0,1);return loftProfile(BLACK_BASS_R09.cranialProfile,{radialSegments:72,exponent:2.35,subdivisions:5,skipFace:({thetaMid,stationA,stationB})=>{const u=(stationA[0]+stationB[0])/2;if(u<.807||u>.994)return false;const side=Math.min(angleDistance(thetaMid,Math.PI/2),angleDistance(thetaMid,3*Math.PI/2));const longitudinal=smoothstep(.807,.845,u)*(1-smoothstep(.972,.994,u));const halfAngle=.003+.064*t*longitudinal;return side<halfAngle}})}
export function transformJawPoint(p,angle=0){return rotateAboutHinge(p,BLACK_BASS_R09.jaw.hinge,clamp(angle,...BLACK_BASS_R09.jaw.safeOpenRangeRad))}
export function transformJawPointWeighted(p,angle,w){const q=transformJawPoint(p,angle);return p.map((v,i)=>lerp(v,q[i],w))}
export function buildLowerJawMesh({mouthOpenRad=0}={}){const a=clamp(mouthOpenRad,...BLACK_BASS_R09.jaw.safeOpenRangeRad);return{...loftProfile(BLACK_BASS_R09.jaw.envelope,{radialSegments:48,exponent:2.25,subdivisions:4,transformPoint:p=>transformJawPoint(p,a)}),mouthOpenRad:a,hinge:[...BLACK_BASS_R09.jaw.hinge]}}
export function buildMouthCavityMesh({mouthOpenRad=0}={}){const max=BLACK_BASS_R09.jaw.safeOpenRangeRad[1],t=clamp(mouthOpenRad/max,0,1);const profile=BLACK_BASS_R09.cavityProfile.map(([u,w,top,bottom])=>{const mid=(top+bottom)/2,half=(top-bottom)/2,gap=lerp(.00045,half,t);return[u,w,mid+gap,mid-gap]});return loftProfile(profile,{radialSegments:40,exponent:2.0,subdivisions:4})}
export function buildEllipsoidMesh(center,radii,{lat=18,lon=28}={}){const positions=[],indices=[];for(let iy=0;iy<=lat;iy++){const ph=Math.PI*iy/lat;for(let ix=0;ix<lon;ix++){const th=2*Math.PI*ix/lon;positions.push(center[0]+radii[0]*Math.sin(ph)*Math.cos(th),center[1]+radii[1]*Math.cos(ph),center[2]+radii[2]*Math.sin(ph)*Math.sin(th))}}for(let iy=0;iy<lat;iy++)for(let ix=0;ix<lon;ix++){const nx=(ix+1)%lon,a=iy*lon+ix,b=iy*lon+nx,c=(iy+1)*lon+nx,d=(iy+1)*lon+ix;indices.push(a,b,c,a,c,d)}return{positions,indices}}
export function buildCurveTube(points,rx,rn,{radialSegments=12,cap=true}={}){const RX=Array.isArray(rx)?rx:points.map(()=>rx),RN=Array.isArray(rn)?rn:points.map(()=>rn),positions=[],indices=[];for(let i=0;i<points.length;i++){const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],tan=norm(sub(next,prev)),e1=norm(sub([1,0,0],mul(tan,tan[0]))),e2=norm(cross(tan,e1));for(let k=0;k<radialSegments;k++){const a=2*Math.PI*k/radialSegments,p=add(points[i],add(mul(e1,Math.cos(a)*RX[i]),mul(e2,Math.sin(a)*RN[i])));positions.push(...p)}}for(let i=0;i<points.length-1;i++)for(let k=0;k<radialSegments;k++){const a=i*radialSegments+k,b=i*radialSegments+(k+1)%radialSegments,c=(i+1)*radialSegments+(k+1)%radialSegments,d=(i+1)*radialSegments+k;indices.push(a,b,c,a,c,d)}if(cap)for(const[i,flip]of[[0,true],[points.length-1,false]]){const ci=positions.length/3;positions.push(...points[i]);const base=i*radialSegments;for(let k=0;k<radialSegments;k++){const a=base+k,b=base+(k+1)%radialSegments;if(flip)indices.push(ci,b,a);else indices.push(ci,a,b)}}return{positions,indices}}

function sampleCurve(curve,t){const s=clamp(t,0,1)*(curve.length-1),i=Math.min(curve.length-2,Math.floor(s)),f=s-i;return[lerp(curve[i][0],curve[i+1][0],f),lerp(curve[i][1],curve[i+1][1],f)]}
export function operculumFreeCurve(){return BLACK_BASS_R09.operculum.freeMarginYU.map(([y,u])=>[y,u])}
export function buildOperculumFlapMesh(side,{operculumOpenRad=0,rows=36,cols=7}={}){const a=clamp(operculumOpenRad,...BLACK_BASS_R09.operculum.safeOpenRangeRad),positions=[],indices=[],shells=2;const index=(sh,r,c)=>sh*rows*cols+r*cols+c;for(let sh=0;sh<shells;sh++)for(let r=0;r<rows;r++){const t=r/(rows-1),[fy,fu]=sampleCurve(BLACK_BASS_R09.operculum.freeMarginYU,t),[ry,ru]=sampleCurve(BLACK_BASS_R09.operculum.overlapMarginYU,t),belly=Math.pow(Math.sin(Math.PI*t),1.25);for(let c=0;c<cols;c++){const q=c/(cols-1),u=lerp(fu,ru,q),y=lerp(fy,ry,q)+.0018*Math.sin(Math.PI*q)*belly,w=widthAtU(u),open=Math.sin(a)*.040*(1-q)*belly,thick=(sh?1:-1)*.00028;positions.push(side*(w+.00055+open+thick),y,u)}}for(let sh=0;sh<shells;sh++)for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a0=index(sh,r,c),b=index(sh,r,c+1),cc=index(sh,r+1,c+1),d=index(sh,r+1,c);if((side<0)===!!sh)indices.push(a0,cc,b,a0,d,cc);else indices.push(a0,b,cc,a0,cc,d)}for(let r=0;r<rows-1;r++)for(const c of[0,cols-1]){const a0=index(0,r,c),b=index(0,r+1,c),cc=index(1,r+1,c),d=index(1,r,c);indices.push(a0,b,cc,a0,cc,d)}return{positions,indices,operculumOpenRad:a}}
export function buildOperculumEdgeMesh(side,{operculumOpenRad=0}={}){const a=clamp(operculumOpenRad,...BLACK_BASS_R09.operculum.safeOpenRangeRad),pts=[];for(let i=0;i<=28;i++){const t=i/28,[y,u]=sampleCurve(BLACK_BASS_R09.operculum.freeMarginYU,t),w=widthAtU(u),open=Math.sin(a)*.040*Math.pow(Math.sin(Math.PI*t),1.25);pts.push([side*(w+.00130+open),y,u])}return buildCurveTube(pts,.00034,.00058,{radialSegments:9})}
export function buildGillOpeningMesh(side,{operculumOpenRad=0}={}){const a=clamp(operculumOpenRad,...BLACK_BASS_R09.operculum.safeOpenRangeRad),tOpen=clamp(a/BLACK_BASS_R09.operculum.safeOpenRangeRad[1],0,1),pts=[];for(let i=2;i<27;i++){const t=i/28,[y,u]=sampleCurve(BLACK_BASS_R09.operculum.freeMarginYU,t),w=widthAtU(u-.003),open=Math.sin(a)*.029*Math.pow(Math.sin(Math.PI*t),1.30);pts.push([side*(w-.0009+open),y,u-.0035])}return buildCurveTube(pts,.00010+.00085*tOpen,.00016+.00110*tOpen,{radialSegments:9})}
export function buildBranchiostegalMesh(side,{operculumOpenRad=0}={}){const a=clamp(operculumOpenRad,...BLACK_BASS_R09.operculum.safeOpenRangeRad),tOpen=clamp(a/BLACK_BASS_R09.operculum.safeOpenRangeRad[1],0,1),positions=[],indices=[],rows=9,cols=6;for(let r=0;r<rows;r++){const t=.66+.34*r/(rows-1),[fy,fu]=sampleCurve(BLACK_BASS_R09.operculum.freeMarginYU,t);for(let c=0;c<cols;c++){const q=c/(cols-1),u=lerp(fu-.006,.704,q),y=lerp(fy,-.108,q)-.0025*Math.sin(Math.PI*q),w=widthAtU(u),open=Math.sin(a)*.030*(1-q)*Math.sin(Math.PI*(t-.66)/.34);positions.push(side*(w-.0006+open),y,u)}}for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a0=r*cols+c,b=a0+1,cc=(r+1)*cols+c+1,d=(r+1)*cols+c;if(side<0)indices.push(a0,cc,b,a0,d,cc);else indices.push(a0,b,cc,a0,cc,d)}return{positions,indices,visibility:tOpen}}

function buildLipBand(which,{mouthOpenRad=0,crossSegments=34}={}){const c=BLACK_BASS_R09.lipCurves,rows=c.u.length,cols=crossSegments,positions=[],indices=[],index=(sh,r,col)=>sh*rows*cols+r*cols+col;for(let sh=0;sh<2;sh++){const sg=sh?1:-1;for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const q=j/(cols-1),side=-1+2*q,bulge=1-side*side,x=side*c.lateral[i],y0=which==='upper'?c.upperY[i]:c.lowerY[i],y=y0+sg*c.radiusNormal[i]*(.68+.32*bulge),u=c.u[i]+.0028*bulge*(1-smoothstep(.965,1,c.u[i]));let p=[x,y,u];if(which==='lower')p=transformJawPointWeighted(p,mouthOpenRad,smoothstep(.815,.875,u));positions.push(...p)}}for(let sh=0;sh<2;sh++)for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=index(sh,i,j),b=index(sh,i,j+1),cc=index(sh,i+1,j+1),d=index(sh,i+1,j);if(sh===0)indices.push(a,cc,b,a,d,cc);else indices.push(a,b,cc,a,cc,d)}return{positions,indices}}

function buildOralSeamMeshes(){const c=BLACK_BASS_R09.lipCurves,make=side=>{const pts=c.u.map((u,i)=>[side*(c.lateral[i]+.0007),(c.upperY[i]+c.lowerY[i])*.5,u]);return buildCurveTube(pts,.00020,.00042,{radialSegments:8})};return{left:make(-1),right:make(1)}}
function buildMaxillaryMeshes(){const y=[-.039,-.036,-.032,-.027,-.021,-.015],u=[.812,.830,.850,.872,.895,.918],lat=[.056,.0585,.058,.0555,.051,.045],rx=[.0016,.0017,.0017,.0016,.0014,.001],rn=[.0048,.0048,.0045,.004,.0033,.0023],make=side=>buildCurveTube(u.map((v,i)=>[side*lat[i],y[i],v]),rx,rn,{radialSegments:12});return{left:make(-1),right:make(1)}}
function buildCommissureMeshes({mouthOpenRad=0}={}){const make=side=>{const up=[side*.061,-.021,.812],lo=transformJawPointWeighted([side*.061,-.030,.812],mouthOpenRad,.08),mid=[side*.064,lerp(up[1],lo[1],.52),.808];return buildCurveTube([up,mid,lo],[.0028,.0036,.0028],[.0040,.0052,.0040],{radialSegments:10})};return{left:make(-1),right:make(1)}}

export function buildBlackBassHeadV09({mouthOpenRad=0,operculumOpenRad=0}={}){const mouth=clamp(mouthOpenRad,...BLACK_BASS_R09.jaw.safeOpenRangeRad),gill=clamp(operculumOpenRad,...BLACK_BASS_R09.operculum.safeOpenRangeRad),eyes={left:buildEllipsoidMesh(BLACK_BASS_R09.eyes.leftCenter,BLACK_BASS_R09.eyes.radii),right:buildEllipsoidMesh(BLACK_BASS_R09.eyes.rightCenter,BLACK_BASS_R09.eyes.radii)},max=buildMaxillaryMeshes(),comm=buildCommissureMeshes({mouthOpenRad:mouth}),seam=buildOralSeamMeshes(),parts={cranium:buildCranialMesh({mouthOpenRad:mouth}),operculumEdgeLeft:buildOperculumEdgeMesh(-1,{operculumOpenRad:gill}),operculumEdgeRight:buildOperculumEdgeMesh(1,{operculumOpenRad:gill}),lowerJaw:buildLowerJawMesh({mouthOpenRad:mouth}),eyeLeft:eyes.left,eyeRight:eyes.right,maxillaryLeft:max.left,maxillaryRight:max.right,upperLip:buildLipBand('upper'),lowerLip:buildLipBand('lower',{mouthOpenRad:mouth}),commissureLeft:comm.left,commissureRight:comm.right};if(mouth<.020){parts.oralSeamLeft=seam.left;parts.oralSeamRight=seam.right}else{parts.mouthCavity=buildMouthCavityMesh({mouthOpenRad:mouth})}if(gill>.004){parts.operculumFlapLeft=buildOperculumFlapMesh(-1,{operculumOpenRad:gill});parts.operculumFlapRight=buildOperculumFlapMesh(1,{operculumOpenRad:gill});parts.gillOpeningLeft=buildGillOpeningMesh(-1,{operculumOpenRad:gill});parts.gillOpeningRight=buildGillOpeningMesh(1,{operculumOpenRad:gill})}if(gill>.018){parts.branchiostegalLeft=buildBranchiostegalMesh(-1,{operculumOpenRad:gill});parts.branchiostegalRight=buildBranchiostegalMesh(1,{operculumOpenRad:gill})}return{schema:'kaopu.fish.generated-parts/0.9',identity:'Micropterus_salmoides_FISH_R1_T01',sourceMeshRuntimeDependency:false,parts,anchors:{jawHinge:[...BLACK_BASS_R09.jaw.hinge]},acceptance:{numeric:false,visual:false,user:false}}}
