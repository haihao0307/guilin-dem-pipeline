// R24 reversible installation adapter over unchanged R22 scalar fields.
// A .126 rad example is hypothetical, not a historical or optimum solution.
window.DYNAMIC={referenceTheta:.4,phases:Object.freeze([0,1.7,4.3]),referenceInclinations:Object.freeze([0,.11,0]),inclinations:[0,.11,0],radius:.3302,rodLength:3.5,axisY:1.016,installationMode:'baseline',candidateInclination:.126};
const D=DYNAMIC;
D.snapshot=function(options={}){const mode=options.mode??D.installationMode,beta=mode==='baseline'?.11:(options.beta??D.candidateInclination);if(!['baseline','candidate'].includes(mode)||!Number.isFinite(beta)||beta<.11||beta>.16)throw Error('Installation must be baseline or candidate in [.11,.16] rad');return Object.freeze({mode,beta});};
D.selectInstallation=function(mode,beta=D.candidateInclination){const s=D.snapshot({mode,beta});D.installationMode=s.mode;if(mode==='candidate')D.candidateInclination=s.beta;D.inclinations[1]=s.beta;return s;};
D.pose=function(t,i,inc=i===1?D.snapshot().beta:0){let a=t+D.phases[i],b=[D.radius*Math.sin(a),D.radius*Math.cos(a)],u=[Math.sin(inc),Math.cos(inc)],h=b[0]*u[0]+b[1]*u[1],perp=b[0]*u[1]-b[1]*u[0],dist=h+Math.sqrt(D.rodLength**2-perp**2);return {b:[b[0]+D.axisY,b[1]],s:[u[0]*dist+D.axisY,u[1]*dist]};};
D.referencePose=function(i){return D.pose(D.referenceTheta,i,D.referenceInclinations[i]);};
D.classify=function(part){let n=part.id.split('/')[1],side=n.startsWith('left_')?0:n.startsWith('right_')?2:1;
 if(part.group==='wheel_attachment')return {type:'crankAt',side:part.side,z:part.axle_z};
 if(part.group==='wheel')return {type:'wheel',side};
 if(part.group==='drive'){
  if(n==='D2_two_side_axle_journals')return null;
  if(n==='D2_inside_crank_webs')return {type:'crank',side:1};
  if(n.includes('main_rod_with_open_eyes'))return {type:'rod',side};
  if(n.includes('small_end_bushing'))return {type:'slider',side};
  return {type:'crankTranslate',side};
 }
 if(part.group==='actuation'){
  if(n.endsWith('cylinder_wall')||n.endsWith('fixed_guides'))return side===1?{type:'installation',side}:null;
  return {type:'slider',side};
 }
 if(part.group==='cylinder_pressure'&&n.endsWith('piston_ring_packs'))return {type:'pistonRing',side};
 if(part.group==='cylinder_pressure'&&side===1)return {type:'installation',side};
 return null;
};
D.transform=function(p,t,m,inverse=false,installation=D.snapshot()){
 if(!m||m.type==='wheel'||((m.type==='installation'||m.type==='pistonRing')&&installation.mode==='baseline'))return p.slice();
 // Source coordinates ALWAYS use the original theta .4 and inclination .11.
 let a=D.referencePose(m.side),b=D.pose(t,m.side,m.side===1?installation.beta:0),from,to,angle=0;
 if(m.type==='slider'||m.type==='pistonRing'){from=a.s;to=b.s;angle=m.side===1?D.referenceInclinations[1]-installation.beta:0;}
 else if(m.type==='installation'){from=to=[D.axisY,0];angle=D.referenceInclinations[1]-installation.beta;}
 else if(m.type==='crankTranslate'){from=a.b;to=b.b;}
 else if(m.type==='crank'||m.type==='crankAt'){from=to=[D.axisY,m.z??0];angle=-(t-D.referenceTheta);}
 else{from=a.b;to=b.b;angle=Math.atan2(b.s[1]-b.b[1],b.s[0]-b.b[0])-Math.atan2(a.s[1]-a.b[1],a.s[0]-a.b[0]);}
 if(inverse){[from,to]=[to,from];angle=-angle;}let c=Math.cos(angle),s=Math.sin(angle),y=p[1]-from[0],z=p[2]-from[1];return[p[0],to[0]+c*y-s*z,to[1]+s*y+c*z];
};
D.bounds=function(part,t,installation=D.snapshot()){let m=D.classify(part);if(!m||m.type==='wheel'||((m.type==='installation'||m.type==='pistonRing')&&installation.mode==='baseline'))return[part.aabb_min.slice(),part.aabb_max.slice()];let pts=[];for(let i=0;i<8;i++)pts.push(D.transform([i&1?part.aabb_max[0]:part.aabb_min[0],i&2?part.aabb_max[1]:part.aabb_min[1],i&4?part.aabb_max[2]:part.aabb_min[2]],t,m,false,installation));return[[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];};
D.glsl=`
uniform float timeTheta,middleInclination;
uniform int installationCandidate;
vec2 dynRotate(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
vec2 dynBig(float t,int side){float phase=side==0?0.0:(side==1?1.7:4.3);return vec2(1.016,0)+.3302*vec2(sin(t+phase),cos(t+phase));}
vec2 dynSmallAt(float t,int side,float inclination){float inc=side==1?inclination:0.;vec2 u=vec2(sin(inc),cos(inc)),b=dynBig(t,side)-vec2(1.016,0);float h=dot(b,u),perp=b.x*u.y-b.y*u.x;return vec2(1.016,0)+u*(h+sqrt(3.5*3.5-perp*perp));}
vec2 dynSmall(float t,int side){return dynSmallAt(t,side,middleInclination);}
vec3 dynInstallation(vec3 p,int side){if(installationCandidate==0)return p;p.yz=vec2(1.016,0)+dynRotate(p.yz-vec2(1.016,0),middleInclination-.11);return p;}
vec3 dynSlider(vec3 p,int side){if(side!=1||middleInclination==.11){p.yz+=dynSmallAt(.4,side,.11)-dynSmall(timeTheta,side);return p;}float angle=side==1?middleInclination-.11:0.;p.yz=dynSmallAt(.4,side,.11)+dynRotate(p.yz-dynSmall(timeTheta,side),angle);return p;}
vec3 dynPistonRing(vec3 p,int side){return installationCandidate==1?dynSlider(p,side):p;}
vec3 dynCrankTranslate(vec3 p,int side){p.yz+=dynBig(.4,side)-dynBig(timeTheta,side);return p;}
vec3 dynCrank(vec3 p){p.yz=dynRotate(p.yz-vec2(1.016,0),timeTheta-.4)+vec2(1.016,0);return p;}
vec3 dynRod(vec3 p,int side){vec2 b0=dynBig(.4,side),bn=dynBig(timeTheta,side),u0=normalize(dynSmallAt(.4,side,.11)-b0),un=normalize(dynSmall(timeTheta,side)-bn),v=p.yz-bn;p.yz=b0+u0*dot(v,un)+vec2(-u0.y,u0.x)*dot(v,vec2(-un.y,un.x));return p;}
vec3 dynCrankAt(vec3 p,float z){p.z-=z;p=dynCrank(p);p.z+=z;return p;}
`;
D.argument=function(part,p='p'){let m=D.classify(part);if(!m||m.type==='wheel')return p;return m.type==='crankAt'?`dynCrankAt(${p},${Number(m.z).toFixed(8)})`:m.type==='crank'?`dynCrank(${p})`:`dyn${m.type[0].toUpperCase()+m.type.slice(1)}(${p},${m.side})`;};
D.wheelRadii=A4_AXLE_SPEC.radii;
D.wheelTheta=function(theta,axle){return .4+(theta-.4)*1.016/D.wheelRadii[axle];};
D.scalar=function(part){const q=D.argument(part);let field=part.group==='wheel'?`${part.glsl_function}_parameterized(p,.4+(timeTheta-.4)*${(1.016/D.wheelRadii[Number(part.id.match(/axle(\d+)/)[1])]).toPrecision(17)})`:`${part.glsl_function}(${q})`;const cut=SCENE.hostCuts[part.id];return cut?`max(${field},-${cut}(${q}))`:field;};
// Conservative inverse-transformed boxes for any future interval-only part.
D.interval=function(part){if(!part.interval_function)return 'return vec2(-1e20,1e20);';if(D.argument(part)==='p')return `return ${part.interval_function}(lo,hi);`;const corners=[];for(let k=0;k<8;k++)corners.push(`vec3 q${k}=${D.argument(part,`vec3(${k&1?'hi':'lo'}.x,${k&2?'hi':'lo'}.y,${k&4?'hi':'lo'}.z)`)};`);return corners.join('')+`vec3 mn=q0,mx=q0;`+Array.from({length:7},(_,i)=>`mn=min(mn,q${i+1});mx=max(mx,q${i+1});`).join('')+`return ${part.interval_function}(mn-vec3(.000002),mx+vec3(.000002));`;};
D.localClearance=function(beta,theta){const {b,s}=D.pose(theta,1,beta),axle=[D.axisY,2.2098],v=[s[0]-b[0],s[1]-b[1]],h=Math.max(0,Math.min(1,((axle[0]-b[0])*v[0]+(axle[1]-b[1])*v[1])/(v[0]*v[0]+v[1]*v[1])));return Math.hypot(b[0]+h*v[0]-axle[0],b[1]+h*v[1]-axle[1])-.045-.1;};
D.installationSweep=function(beta,samples=1441){let margin=Infinity,worstTheta=0,guide=Infinity,piston=Infinity;for(let k=0;k<samples;k++){let theta=2*Math.PI*k/(samples-1),m=D.localClearance(beta,theta),s=D.pose(theta,1,beta).s,station=(s[0]-D.axisY)*Math.sin(beta)+s[1]*Math.cos(beta);if(m<margin){margin=m;worstTheta=theta;}guide=Math.min(guide,Math.min(4,station+.17)-Math.max(3,station-.17));piston=Math.min(piston,.4-Math.abs(station+1.25-4.75)-.025);}return{beta,rodLength:3.5,samples,minimumMargin:margin,worstTheta,minimumGuideOverlap:guide,minimumPistonEndMargin:piston,localStatus:margin<0?'COLLISION':margin<.005?'BELOW_ASSUMED_5MM':'SAMPLED_LOCAL_THRESHOLD_ONLY',wholeMechanicalAcceptance:false};};
// Time -> Location/environment -> whole Object, never isolated parts.
D.state=function(Time,Location={},ObjectState={}){if(!Number.isFinite(Time))throw Error('finite Time required');const origin=Location.origin||[0,0,0];if(origin.some(v=>v!==0))throw Error('This diagnostic uses rail-local origin [0,0,0]; translated environments are not yet validated');return {theta:(ObjectState.initialTheta??.4)+(ObjectState.angularSpeed??1)*Time,eye:Location.eye||[16,5,-4],cut:ObjectState.cut??100,installation:D.snapshot(ObjectState.installation||{}),object:'train',hierarchy:['frame','boiler','wheel','drive','actuation'],frozen:['valve including spindle','valve_chest','trucks','connections'],location:'rail-local Y=0, middle driving axle Z=0, forward +Z'};};
window.renderAt=async function(Time,Location,ObjectState){let s=D.state(Time,Location,ObjectState);return render(s.eye,[0,1.8,-4],s.cut,s.theta,s.installation);};
