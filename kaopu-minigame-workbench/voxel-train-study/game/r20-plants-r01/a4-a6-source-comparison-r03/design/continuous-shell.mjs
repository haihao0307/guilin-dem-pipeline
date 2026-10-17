import {AUTHORING_D, DESIGN_LAYOUT, SOURCE_FIT, authoringX} from './source-fit.mjs';
/** Single C2 longitudinal B-spline section field. No hard-clamped interpolant.
 * Glass and paint are material groups on ONE indexed shell mesh with shared normals.
 * Transverse cubic Bezier shoulders are tangent continuous; all values are proposals.
 */
export const R01_CONTROL_SECTIONS=Object.freeze([
 [-1.40,.001,.819,.821,.820],[-1.32,.28,.62,1.02,.80],[-.65,.62,.64,1.58,1.08],[.60,1.02,.66,2.08,1.53],
 [2.10,1.31,.68,2.50,1.99],[3.40,1.44,.68,3.02,2.44],
 [4.75,1.475,.92,4.02,2.65],[6.00,1.475,.92,4.10,2.67],
 [7.80,1.475,.92,4.10,2.67],[9.60,1.475,.92,4.03,2.65],
 [11.60,1.475,.92,3.94,2.63],[13.0,1.475,.92,3.91,2.62],
 [18.40,1.475,.92,3.91,2.62],[20.10,1.475,.92,3.91,2.62],
 [20.32,1.475,.92,3.91,2.62],[25.80,1.475,.92,3.91,2.62],
 [27.40,1.475,.92,3.93,2.64],[28.30,1.45,.92,3.96,2.66]
]);
// Preserve every original transverse section, and its tangent-continuous Bezier
// construction. Only longitudinal stations and upper crown ordinates are revised.
// R03 controls are new design-only source-envelope constraints. The original
// R01 control table remains above as lineage, not a false requirement to reuse a long nose.
const r03SourceControls=[
 [11.65,.001,1.24,1.26,1.25],[11.58,.43,1.12,1.68,1.35],
 [11.30,1.25,1.10,2.40,1.65],[10.90,1.44,1.10,2.95,1.85],
 [10.30,1.475,1.10,3.55,2.30],[9.65,1.475,1.10,4.05,2.82],
 [8.90,1.475,1.10,4.42,3.02],[7.80,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],
 [6.50,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],[4.80,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],
 [2.80,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],[.70,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],
 [-1.40,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],[-3.1418,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],
 [-3.3325,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],[-8.584,1.10/.746,1.10,DESIGN_LAYOUT.crownSourceY,3.08],
 [-10.115,1.475,1.10,DESIGN_LAYOUT.crownSourceY,3.08],[-10.9776,1.45,1.10,DESIGN_LAYOUT.crownSourceY,3.08]
];
export const CONTROL_SECTION_MAP=Object.freeze(r03SourceControls.map((r,i)=>Object.freeze({sourceStationIndex:i,previous:R01_CONTROL_SECTIONS[i].slice(),revised:[authoringX(r[0]),r[1],r[2]-SOURCE_FIT.verticalOffset,r[3]-SOURCE_FIT.verticalOffset,r[4]-SOURCE_FIT.verticalOffset],treatment:'R03_SOURCE_ENVELOPE_CONSTRAINED_SHORT_NOSE_AND_BOUNDED_WINDSHIELD'})));
export const CONTROL_SECTIONS=Object.freeze(CONTROL_SECTION_MAP.map(r=>Object.freeze(r.revised)));
const clamp=x=>Math.max(0,Math.min(1,x));
export const ease5=x=>{x=clamp(x);return x*x*x*(x*(6*x-15)+10)};
const n=CONTROL_SECTIONS.length-1,p=3;
const knots=Array.from({length:n+p+2},(_,i)=>i<=p?0:i>=n+1?1:(i-p)/(n-p+1));
function deBoor(t){let k=p;while(k<n&&t>=knots[k+1])k++;const d=Array.from({length:p+1},(_,j)=>CONTROL_SECTIONS[k-p+j].slice());for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){const i=k-p+j,a=(t-knots[i])/(knots[i+p-r+1]-knots[i]||1);for(let c=0;c<d[j].length;c++)d[j][c]=(1-a)*d[j-1][c]+a*d[j][c];}return d[p]}
const sectionCache=new Map();
export function sectionAt(x){if(sectionCache.has(x))return sectionCache.get(x);let lo=0,hi=1;for(let j=0;j<44;j++){const t=(lo+hi)/2;if(deBoor(t)[0]<x)lo=t;else hi=t;}const v=deBoor((lo+hi)/2).slice(1);sectionCache.set(x,v);return v}
const bez=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t*t*t*d;
export function sectionPoint(section,t){const[w,low,high,shoulder]=section;if(t<=.5){const u=t*2;return[bez(0,w*.52,w,w,u),bez(high,high,shoulder+(high-shoulder)*.26,shoulder,u)]}const u=(t-.5)*2;return[bez(w,w,w*.98,w*.88,u),bez(shoulder,shoulder-(shoulder-low)*.65,low,low,u)]}
export function tAtZ(section,z){if(z>=section[2])return 0;if(z<=section[1])return 1;let a=0,b=1;for(let j=0;j<38;j++){const m=(a+b)/2;if(sectionPoint(section,m)[1]>z)a=m;else b=m;}return(a+b)/2}
export function halfAt(x,z){return sectionPoint(sectionAt(x),tAtZ(sectionAt(x),z))[0]}
export function shellPoint(x,t,side=1){const[y,z]=sectionPoint(sectionAt(x),t);return[x,side*y,z]}
export function shellNormal(T,x,t,side=1){const e=.00008,a=new T.Vector3(...shellPoint(Math.max(AUTHORING_D.noseX,x-e),t,side)),b=new T.Vector3(...shellPoint(Math.min(28.30,x+e),t,side)),c=new T.Vector3(...shellPoint(x,Math.max(0,t-e),side)),d=new T.Vector3(...shellPoint(x,Math.min(1,t+e),side));const normal=b.sub(a).cross(d.sub(c)).normalize();if(side<0)normal.negate();return normal}
export function cutAt(x){const low=sectionAt(x)[1],cut=DESIGN_LAYOUT.wheelOpeningCrownSourceY-SOURCE_FIT.verticalOffset,a=authoringX(DESIGN_LAYOUT.wheelOpeningFrontRampSourceZ),b=authoringX(DESIGN_LAYOUT.wheelOpeningFrontSourceZ),c=authoringX(DESIGN_LAYOUT.wheelOpeningRearSourceZ),d=authoringX(DESIGN_LAYOUT.wheelOpeningRearRampSourceZ);return low+(cut-low)*ease5((x-a)/(b-a))*(1-ease5((x-c)/(d-c)))}
export function stripeAt(x){return .86+1.43*ease5((x-AUTHORING_D.noseX)/(authoringX(DESIGN_LAYOUT.wheelOpeningFrontSourceZ)-AUTHORING_D.noseX))-.70*ease5((x-authoringX(DESIGN_LAYOUT.wheelOpeningRearSourceZ))/2.5)-.12*ease5((x-25.2)/3.1)}
/** Analytic round-ended glazing perimeter. The shared mesh rows put exact
 * vertices on this curve, rather than selecting a rectangular material band.
 * Forward tip narrows into the sloping windshield; rear turns round into the roof.
 */
export const GLASS_FRONT_X=authoringX(DESIGN_LAYOUT.glassFrontSourceZ);
export const GLASS_REAR_X=authoringX(DESIGN_LAYOUT.glassRearSourceZ);
// The forward sill is the intersection of the unchanged shell with ONE convex
// transverse parabola. Its frontal projection is a smooth single arc, including
// a horizontal tangent at the centreline. Do not multiply a section angle by a
// longitudinal taper: that creates a centre cusp and two projected side valleys.
export const WINDSHIELD_LOWER_ARC=Object.freeze({
 centreSourceY:sectionAt(GLASS_FRONT_X)[2]+SOURCE_FIT.verticalOffset,
 sourceQuadraticCoefficient:.13,
 transitionStartSourceZ:8.50,transitionEndSourceZ:7.50,
 rule:'Y = centreSourceY + 0.13 * sourceX^2; exact shell intersection'
});
export function glassBoundaryT(x){
 if(x<GLASS_FRONT_X||x>GLASS_REAR_X)return 0;
 const z=SOURCE_FIT.locoEndSourceZ+(SOURCE_FIT.locoAuthoringEnd-x)*.92,sec=sectionAt(x);
 const rear=ease5((z-DESIGN_LAYOUT.glassRearSourceZ)/1.45);
 const sideSillSourceY=3.28+.13*ease5((z-4.8)/2.8)+.05*ease5((2.2-z)/1.3);
 const blend=ease5((WINDSHIELD_LOWER_ARC.transitionStartSourceZ-z)/(WINDSHIELD_LOWER_ARC.transitionStartSourceZ-WINDSHIELD_LOWER_ARC.transitionEndSourceZ));
 if(blend>=1)return tAtZ(sec,sideSillSourceY-SOURCE_FIT.verticalOffset)*Math.sqrt(rear);
 const residual=t=>{const [u,y]=sectionPoint(sec,t),sx=u*SOURCE_FIT.transverseScale;
  const frontY=WINDSHIELD_LOWER_ARC.centreSourceY+WINDSHIELD_LOWER_ARC.sourceQuadraticCoefficient*sx*sx;
  return y+SOURCE_FIT.verticalOffset-((1-blend)*frontY+blend*sideSillSourceY);
 };
 if(residual(0)<=1e-12)return 0;
 let lo=0,hi=1;for(let i=0;i<44;i++){const t=(lo+hi)/2;if(residual(t)>0)lo=t;else hi=t;}
 return (lo+hi)/2*Math.sqrt(rear);
}
export function glassBoundaryPoint(x,side=1){return shellPoint(x,glassBoundaryT(x),side);}
export function createContinuousShell(T,D,materials){
 const xs=new Set([D.noseX,GLASS_FRONT_X,GLASS_REAR_X,D.cabStart,D.cabEnd,D.locoEnd,D.tenderStart,D.tenderEnd,...(D.additionalRows||[])].filter(x=>x>=D.noseX&&x<=D.tenderEnd));for(let i=0;i<=560;i++)xs.add(D.noseX+(D.tenderEnd-D.noseX)*i/560);const rows=[...xs].sort((a,b)=>a-b),N=96,positions=[],normals=[],uv=[],paint=[],glass=[];
 for(const x of rows){const sec=sectionAt(x),sill=Math.min(D.cabGlassSill,sec[2]-.002),ts=x>=GLASS_FRONT_X&&x<=GLASS_REAR_X?glassBoundaryT(x):tAtZ(sec,sill),tc=tAtZ(sec,cutAt(x,D.driverRadius));for(let j=-N;j<=N;j++){const a=Math.abs(j),t=a<=64?ts*a/64:ts+(tc-ts)*(a-64)/32,side=j<0?-1:1;positions.push(...shellPoint(x,t,side));const normal=j===0?new T.Vector3(-((sectionAt(Math.min(28.30,x+.0001))[2]-sectionAt(Math.max(D.noseX,x-.0001))[2])/(Math.min(28.30,x+.0001)-Math.max(D.noseX,x-.0001))),0,1).normalize():shellNormal(T,x,t,side);normals.push(...normal.toArray());uv.push(x/28.30,(j+N)/(2*N));}}
 const rowSize=N*2+1;for(let i=0;i<rows.length-1;i++){if(rows[i]>=D.locoEnd-1e-9&&rows[i+1]<=D.tenderStart+1e-9)continue;const xc=(rows[i]+rows[i+1])/2;for(let j=0;j<rowSize-1;j++){const a=i*rowSize+j,b=a+rowSize,isGlass=xc>=GLASS_FRONT_X&&xc<=GLASS_REAR_X&&j>=N-64&&j<N+64,dst=isGlass?glass:paint;dst.push(a,b,a+1,b,b+1,a+1)}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex([...paint,...glass]);geometry.addGroup(0,paint.length,0);geometry.addGroup(paint.length,glass.length,1);geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,[materials.paint,materials.glass]);mesh.name='continuous one-mesh C2 shoulder shell / shared glass-paint vertices';mesh.userData={singleIndexedExterior:true,noNormalRecomputeAtMaterialBoundary:true,longitudinalBasis:'clamped cubic B-spline C2',transverseBasis:'tangent continuous cubic Bezier quarters',externalRivets:0,sharedGlassPaintNormals:true,rows:rows.length,rowSize,revision:DESIGN_LAYOUT.revision,curvedGlazingBoundary:true,glassFrontSourceZ:DESIGN_LAYOUT.glassFrontSourceZ,glassRearSourceZ:DESIGN_LAYOUT.glassRearSourceZ,controlSectionCount:CONTROL_SECTIONS.length,originalSectionCount:R01_CONTROL_SECTIONS.length,crownSourceY:DESIGN_LAYOUT.crownSourceY,controlsTracked:true};return{mesh,rows,rowSize,paintIndices:paint.length,glassIndices:glass.length};
}
