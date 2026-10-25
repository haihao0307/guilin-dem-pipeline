/* Load after all R29 adapters, before createSurfaceAppearance / app.js.
 * Candidate-only additions. Does not mutate any original source or part.
 * Uses the app's EXISTING valve inverse uniforms and the same mechanical theta.
 */
(function(root){'use strict';
function installOuterCrosshead(scene,D,api){
 if(D.outerCrossheadCandidate)throw Error('Outer crosshead adapter already installed');
 if(!D.outsideValveSolver||!D.valveFrame||!D.visible)throw Error('Install after valve/stack adapters');
 const candidate=(api||root.OUTER_CROSSHEAD).create(),hidden=new Set(candidate.suppress),ids=new Set(scene.parts.map(p=>p.id));
 if(candidate.parts.some(p=>ids.has(p.id)))throw Error('Duplicate candidate ID');
 const old={visible:D.visible,argument:D.argument,bounds:D.bounds,valveFrame:D.valveFrame,isOutsideValve:D.isOutsideValve};
 scene.sources.outsideJoint=candidate.source;scene.parts.push(...candidate.parts);
 D.visible=function(part,installation){if(part.source==='outsideJoint')return installation.mode==='candidate';if(installation.mode==='candidate'&&hidden.has(part.id))return false;return old.visible(part,installation);};
 D.isOutsideValve=part=>part.source==='outsideJoint'?part.frameKind!=='static':old.isOutsideValve(part);
 D.valveFrame=function(part,theta,installation=D.snapshot()){
  if(part.source!=='outsideJoint')return old.valveFrame(part,theta,installation);
  if(installation.mode!=='candidate'||part.frameKind==='static')return null;
  return D.outsideValveSolver.transformFor(part.frameSourceId,D.outsideValvePose(theta)[part.side]);
 };
 D.argument=(part,p='p')=>part.source==='outsideJoint'?(part.frameKind==='static'?p:`dynOutsideValve(${p})`):old.argument(part,p);
 D.bounds=function(part,theta,installation=D.snapshot()){
  if(part.source!=='outsideJoint')return old.bounds(part,theta,installation);
  const frame=D.valveFrame(part,theta,installation);if(!frame)return[part.aabb_min.slice(),part.aabb_max.slice()];
  const pts=Array.from({length:8},(_,k)=>D.valvePoint([0,1,2].map(j=>k&(1<<j)?part.aabb_max[j]:part.aabb_min[j]),frame));
  return[[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];
 };
 candidate.worldScalar=function(id,p,theta,installation=D.snapshot({mode:'candidate'})){
  if(installation.mode!=='candidate')return Infinity;
  const part=candidate.byId[id],frame=D.valveFrame(part,theta,installation);
  return candidate.referenceScalar(id,frame?D.valvePoint(p,frame,true):p);
 };
 D.outerCrossheadCandidate=candidate;return candidate;
}
if(typeof module==='object'&&module.exports)module.exports=installOuterCrosshead;else{root.installOuterCrosshead=installOuterCrosshead;if(root.SCENE&&root.DYNAMIC)installOuterCrosshead(root.SCENE,root.DYNAMIC,root.OUTER_CROSSHEAD);}
})(typeof globalThis!=='undefined'?globalThis:this);
