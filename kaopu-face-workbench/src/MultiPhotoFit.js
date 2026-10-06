/**
 * Local, shared-identity weak-perspective landmark bundle adjustment.
 * Uses Google's XRBlocks calibrated MediaPipe/GNM correspondence and its Horn /
 * Cholesky solvers. This is a sparse geometry baseline, not dense reconstruction.
 * The forward observations are calibrated detector points, not metric scans.
 */
import {FACE_CORRESPONDENCE as C} from '../vendor/FaceCorrespondence.js';
import {fitSimilarity, choleskySolve} from '../vendor/FaceFit.js';
import {MODEL_HASH} from './profile.js';
export const FIT_SCHEMA='kaopu-face-fit/1';
export const FIT_METHOD='gnm-mediapipe-calibrated-weak-perspective-2d-r01';
const ID_DIM=24, EXPR_COMPONENTS=[0,1,2,3,100,101,102,103,200,201,202,203];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function prepareFitModel(model){
 if(model.numVertices!==17821||model.identityDim!==253||model.expressionDim!==383)throw Error('GNM model dimensions do not match fitting correspondence');
 const n=C.count, stride=model.numVertices*3, identity=new Float64Array(n*3*ID_DIM), expression=new Float64Array(n*3*EXPR_COMPONENTS.length), actual=new Float64Array(n*3);
 for(let i=0;i<n;i++)for(let a=0;a<3;a++){
  const row=i*3+a, v=C.vertices[i]*3+a; actual[row]=model.template[v];
  for(let k=0;k<ID_DIM;k++)identity[row*ID_DIM+k]=model.identityBasis[k*stride+v]*model.identityScales[k];
  EXPR_COMPONENTS.forEach((component,k)=>expression[row*EXPR_COMPONENTS.length+k]=model.expressionBasis[component*stride+v]*model.expressionScales[component]);
 }
 return {count:n,base:Float64Array.from(C.reference),actual,identity,expression,idDim:ID_DIM,exprDim:EXPR_COMPONENTS.length,exprComponents:EXPR_COMPONENTS,rigid:Array.from(C.rigid),landmarks:Array.from(C.landmarks)};
}
export function validateFrame(frame){
 if(!frame||!finite(frame.width)||!finite(frame.height)||frame.width<32||frame.height<32||frame.width>32768||frame.height>32768)throw Error('Invalid image dimensions');
 if(typeof frame.id!=='string'||frame.id.length>256)throw Error('Invalid frame ID');
 if(!Array.isArray(frame.landmarks)||frame.landmarks.length!==478||frame.landmarks.some(p=>!p||![p.x,p.y,p.z].every(finite)||Math.abs(p.x)>4||Math.abs(p.y)>4||Math.abs(p.z)>4))throw Error('Expected 478 finite MediaPipe landmarks');
 return frame;
}
function rotation(v){
 const [x,y,z]=v, t=Math.hypot(x,y,z);if(t<1e-12)return [1,0,0,0,1,0,0,0,1];
 const a=x/t,b=y/t,c=z/t,s=Math.sin(t),q=Math.cos(t),u=1-q;
 return [q+a*a*u,a*b*u-c*s,a*c*u+b*s,b*a*u+c*s,q+b*b*u,b*c*u-a*s,c*a*u-b*s,c*b*u+a*s,q+c*c*u];
}
function toAxis(r){
 const t=Math.acos(clamp((r[0]+r[4]+r[8]-1)/2,-1,1));if(t<1e-7)return [0,0,0];const k=t/(2*Math.sin(t));return [(r[7]-r[5])*k,(r[2]-r[6])*k,(r[3]-r[1])*k];
}
function shape(m,id,expr,actual=false){
 const p=Float64Array.from(actual?m.actual:m.base);
 for(let row=0;row<p.length;row++){
  for(let k=0;k<m.idDim;k++)p[row]+=id[k]*m.identity[row*m.idDim+k];
  for(let k=0;k<m.exprDim;k++)p[row]+=expr[k]*m.expression[row*m.exprDim+k];
 }return p;
}
function project(points,camera){
 const r=rotation(camera),s=Math.exp(camera[3]),out=new Float64Array(points.length/3*2);
 for(let i=0;i<out.length/2;i++)for(let a=0;a<2;a++)out[i*2+a]=s*(r[a*3]*points[i*3]+r[a*3+1]*points[i*3+1]+r[a*3+2]*points[i*3+2])+camera[4+a];
 return out;
}
function observed(m,f){const aspect=f.width/f.height;return Float64Array.from(m.landmarks.flatMap(k=>[f.landmarks[k].x*aspect,-f.landmarks[k].y]));}
function trainPoint(i){return i%5!==0;}// Entire landmarks, including both axes, held out BEFORE any fit.
function initCamera(m,f,points){
 const source=[],target=[],a=f.width/f.height;
 for(let i=0;i<m.count;i++)if(trainPoint(i)&&m.rigid[i]){
  source.push(...points.slice(i*3,i*3+3));const p=f.landmarks[m.landmarks[i]];target.push(p.x*a,-p.y,-p.z*a);
 }
 const t=fitSimilarity(Float64Array.from(source),Float64Array.from(target));
 if(!finite(t.scale)||t.scale<=1e-6)throw Error('Degenerate face geometry');
 return [...toAxis(t.rotation),Math.log(t.scale),t.translation[0],t.translation[1]];
}
function addRow(normal,rhs,row,target,weight){
 const n=rhs.length;
 for(let a=0;a<n;a++){rhs[a]+=row[a]*target*weight;for(let b=0;b<n;b++)normal[a*n+b]+=row[a]*row[b]*weight;}
}
function ridgeSolve(normal,rhs,ridge){
 const n=rhs.length;let trace=0;for(let a=0;a<n;a++)trace+=normal[a*n+a];
 for(let a=0;a<n;a++)normal[a*n+a]+=Math.max(1e-12,ridge*trace/n);
 return choleskySolve(normal,rhs,n);
}
function optimizeCamera(m,f,points,camera,steps=6){
 const y=observed(m,f),active=Array.from({length:m.count},(_,i)=>i).filter(i=>trainPoint(i)&&m.rigid[i]);
 const loss=c=>{const p=project(points,c);let sum=0;for(const i of active)for(let a=0;a<2;a++)sum+=(p[i*2+a]-y[i*2+a])**2;return sum;};
 for(let it=0;it<steps;it++){
  const p=project(points,camera),j=[];for(let k=0;k<6;k++){const c=camera.slice();c[k]+=1e-5;const q=project(points,c);j.push(Float64Array.from(q,(v,i)=>(v-p[i])/1e-5));}
  const mat=new Float64Array(36),rhs=new Float64Array(6);
  for(const i of active)for(let a=0;a<2;a++){const row=i*2+a;addRow(mat,rhs,j.map(x=>x[row]),y[row]-p[row],1);}
  const d=ridgeSolve(mat,rhs,1e-5);let accepted=false;
  for(const alpha of [1,.5,.25,.1]){const c=camera.map((v,k)=>v+clamp(d[k],-.3,.3)*alpha);c[3]=clamp(c[3],-5,8);if(loss(c)<loss(camera)){camera=c;accepted=true;break;}}
  if(!accepted)break;
 }return camera;
}
function solveCoefficients(m,frames,cameras,identity,expressions,kind){
 const isIdentity=kind==='identity',dim=isIdentity?m.idDim:m.exprDim,basis=isIdentity?m.identity:m.expression,groups=isIdentity?[frames.map((_,i)=>i)]:frames.map((_,i)=>[i]),out=[];
 for(const group of groups){const mat=new Float64Array(dim*dim),rhs=new Float64Array(dim);
  for(const index of group){const f=frames[index],camera=cameras[index],r=rotation(camera),s=Math.exp(camera[3]),y=observed(m,f),base=shape(m,isIdentity?new Float64Array(m.idDim):identity,isIdentity?expressions[index]:new Float64Array(m.exprDim)),p=project(base,camera);
   for(let i=0;i<m.count;i++)if(trainPoint(i)&&(!isIdentity||m.rigid[i]))for(let a=0;a<2;a++){
    const row=Float64Array.from({length:dim},(_,k)=>s*(r[a*3]*basis[(i*3)*dim+k]+r[a*3+1]*basis[(i*3+1)*dim+k]+r[a*3+2]*basis[(i*3+2)*dim+k]));
    addRow(mat,rhs,row,y[i*2+a]-p[i*2+a],1/frames.length);
   }
  }out.push(Float64Array.from(ridgeSolve(mat,rhs,isIdentity?.06:.04),v=>clamp(v,-3,3)));
 }return isIdentity?out[0]:out;
}
function metrics(m,f,camera,id,expr){
 const y=observed(m,f),p=project(shape(m,id,expr),camera),raw=project(shape(m,id,expr,true),camera);let train=0,held=0,rawHeld=0,nt=0,nh=0;
 for(let i=0;i<m.count;i++){let d=0,dr=0;for(let a=0;a<2;a++){d+=((p[i*2+a]-y[i*2+a])*f.height)**2;dr+=((raw[i*2+a]-y[i*2+a])*f.height)**2;}if(trainPoint(i)){train+=d;nt++;}else{held+=d;rawHeld+=dr;nh++;}}
 const xs=f.landmarks.map(p=>p.x*f.width),ys=f.landmarks.map(p=>p.y*f.height),diag=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 return {trainingRmsPx:Math.sqrt(train/nt),heldOutRmsPx:Math.sqrt(held/nh),actualMeshHeldOutRmsPx:Math.sqrt(rawHeld/nh),heldOutFaceDiagonalRatio:Math.sqrt(held/nh)/Math.max(1,diag),trainingPoints:nt,heldOutPoints:nh,projected:Array.from(p, (v,i)=>i%2?-v:v/(f.width/f.height))};
}
function solve(m,frames,{iterations=12,fixedIdentity=null}={}){
 let identity=fixedIdentity?Float64Array.from(fixedIdentity):new Float64Array(m.idDim),expressions=frames.map(()=>new Float64Array(m.exprDim));
 let cameras=frames.map(f=>initCamera(m,f,shape(m,identity,new Float64Array(m.exprDim))));
 for(let iter=0;iter<iterations;iter++){
  cameras=cameras.map((c,i)=>optimizeCamera(m,frames[i],shape(m,identity,expressions[i]),c));
  if(!fixedIdentity)identity=solveCoefficients(m,frames,cameras,identity,expressions,'identity');
  expressions=solveCoefficients(m,frames,cameras,identity,expressions,'expression');
 }
 cameras=cameras.map((c,i)=>optimizeCamera(m,frames[i],shape(m,identity,expressions[i]),c));
 return {identity,expressions,cameras};
}
export function fitMultiPhoto(m,input,{crossValidate=true}={}){
 if(!Array.isArray(input)||input.length<1||input.length>8)throw Error('Fit requires 1–8 photos of the same confirmed person');
 const frames=input.map(validateFrame);if(new Set(frames.map(x=>x.id)).size!==frames.length)throw Error('Duplicate frame IDs');
 const t=Date.now(),result=solve(m,frames),baseline=solve(m,frames,{fixedIdentity:new Float64Array(m.idDim)});
 const evaluations=frames.map((f,i)=>({id:f.id,width:f.width,height:f.height,qualityGate:f.qualityGate||null,sourceGeometry:f.sourceGeometry||null,camera:{type:'weak-perspective',rotationAxisAngle:result.cameras[i].slice(0,3),scale:Math.exp(result.cameras[i][3]),translation:result.cameras[i].slice(4),intrinsics:null,metricDepth:null},expression:Array.from({length:383},(_,k)=>{const j=m.exprComponents.indexOf(k);return j<0?0:result.expressions[i][j];}),...metrics(m,f,result.cameras[i],result.identity,result.expressions[i]),baseline:metrics(m,f,baseline.cameras[i],baseline.identity,baseline.expressions[i])}));
 const cross=[];
 if(crossValidate&&frames.length>=3)for(let held=0;held<frames.length;held++){
  const train=solve(m,frames.filter((_,i)=>i!==held)),test=solve(m,[frames[held]],{fixedIdentity:train.identity});
  cross.push({id:frames[held].id,identityExcludedThisImage:true,cameraExpressionFitToTrainingLandmarksOnly:true,heldOutRmsPx:metrics(m,frames[held],test.cameras[0],test.identity,test.expressions[0]).heldOutRmsPx,baselineRmsPx:evaluations[held].baseline.heldOutRmsPx});
 }
 const pooledRms=values=>Math.sqrt(values.reduce((s,f)=>s+f.heldOutRmsPx**2*f.heldOutPoints,0)/values.reduce((s,f)=>s+f.heldOutPoints,0));
 const before=pooledRms(evaluations.map(f=>f.baseline)),after=pooledRms(evaluations);
 const peak=Math.max(...Array.from(result.identity,Math.abs));
 let viewSpan=0;for(let i=0;i<result.cameras.length;i++)for(let j=0;j<i;j++){const a=rotation(result.cameras[i]),b=rotation(result.cameras[j]);let trace=0;for(let k=0;k<9;k++)trace+=a[k]*b[k];viewSpan=Math.max(viewSpan,Math.acos(clamp((trace-1)/2,-1,1))*180/Math.PI);}
 const poorFit=evaluations.some(f=>f.heldOutFaceDiagonalRatio>.05);
 return {schema:FIT_SCHEMA,method:FIT_METHOD,modelHash:MODEL_HASH,status:'computed-needs-review',identity:Array.from({length:253},(_,k)=>k<m.idDim?result.identity[k]:0),identityComponents:m.idDim,expressionComponents:m.exprComponents,images:evaluations,validation:{aggregation:'pooled RMS over all held-out 2D point residuals: sqrt(sum(per-image RMS squared * held-out point count) / total held-out points)',split:'every fifth correspondence held out before camera/identity/expression fitting',heldOutRmsPx:after,baselineHeldOutRmsPx:before,improvesHeldOut:after<before,crossView:cross,estimatedViewSpanDegrees:viewSpan,lowViewDiversity:frames.length>1&&viewSpan<5,poorLandmarkFit:poorFit,singleImageUnderconstrained:frames.length===1,clampedIdentity:peak>=2.999,likenessValidated:false,realSubjectGroundTruth:false},elapsedMs:Date.now()-t,warnings:['Sparse calibrated landmarks only; no dense photometric, texture, occlusion mask or perspective calibration','MediaPipe depth is used only for pose initialization, not trusted as metric geometry','Correspondence was calibrated on a neutral frontal GNM render; large yaw, occlusion and lens distortion can bias results','Low pixel error does not establish personal likeness; inspect every view and compare with the baseline'],source:{xrblocksCommit:'265c2adadadb286854ff081fd9d07b16f39c4134',detector:'MediaPipe Face Landmarker float16/1',tasksVision:'0.10.34'}};
}
export const fittingInternals={shape,project,rotation,metrics,solve};
