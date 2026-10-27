// New reconstructed finite outside-valve motion, fixed retained reversing setting.
// The middle valve/Gresley mechanism is NOT animated or silently idealized.
(function(){
 const D=DYNAMIC,solver=createOutsideValveSolver(D);D.outsideValveSolver=solver;
 let cachedTheta=null,cached;
 D.outsideValvePose=function(theta){if(theta!==cachedTheta){cached={left:solver.pose(theta,'left'),right:solver.pose(theta,'right')};cachedTheta=theta;}return cached;};
 D.isOutsideValve=function(part){return solver.classify(part.id).status==='moving';};
 D.valveFrame=function(part,theta,installation=D.snapshot()){
  if(installation.mode==='baseline')return null;
  return solver.transformFor(part.id,theta);
 };
 D.valvePoint=function(p,frame,inverse=false){if(!frame)return p.slice();const m=inverse?frame.inverseYZ:frame.forwardYZ;return[p[0],m[0]*p[1]+m[1]*p[2]+m[2],m[3]*p[1]+m[4]*p[2]+m[5]];};
 const priorArgument=D.argument,priorBounds=D.bounds;
 D.argument=function(part,p='p'){return D.isOutsideValve(part)?`dynOutsideValve(${p})`:priorArgument(part,p);};
 D.bounds=function(part,theta,installation=D.snapshot()){
  const frame=D.valveFrame(part,theta,installation);if(!frame)return priorBounds(part,theta,installation);
  const pts=Array.from({length:8},(_,i)=>D.valvePoint([0,1,2].map(j=>i&(1<<j)?part.aabb_max[j]:part.aabb_min[j]),frame));
  return [[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];
 };
 const priorState=D.state;
 D.state=function(Time,Location={},ObjectState={}){const s=priorState(Time,Location,ObjectState);s.frozen=s.installation.mode==='baseline'?['all valve gear and valve heads','all piston rings','trucks','connections']:['middle Gresley linkage and middle valve spindle','missing middle valve chest','trucks','connections'];s.outsideValveMode=s.installation.mode==='candidate'?'reconstructed finite closure at fixed reversing setting':'retained frozen baseline';return s;};
 D.glsl+=`\nuniform vec3 valveInverseRow0,valveInverseRow1;\nvec3 dynOutsideValve(vec3 p){vec3 q=vec3(p.yz,1.);p.yz=vec2(dot(valveInverseRow0,q),dot(valveInverseRow1,q));return p;}\n`;
})();
