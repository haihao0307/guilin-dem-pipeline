// Reconstructed pose adapter from preserved R20 drive/actuation formulas.
// This is NOT recovery of the lost R21 generator. Historical phase values remain inference.
window.DYNAMIC={referenceTheta:.4,phases:[0,1.7,4.3],inclinations:[0,.11,0],radius:.3302,rodLength:3.5,axisY:1.016};
const D=DYNAMIC;
D.pose=function(t,i){let a=t+D.phases[i],inc=D.inclinations[i],b=[D.radius*Math.sin(a),D.radius*Math.cos(a)],u=[Math.sin(inc),Math.cos(inc)],h=b[0]*u[0]+b[1]*u[1],perp=b[0]*u[1]-b[1]*u[0],dist=h+Math.sqrt(D.rodLength**2-perp**2);return {b:[b[0]+D.axisY,b[1]],s:[u[0]*dist+D.axisY,u[1]*dist]};};
D.classify=function(part){let n=part.id.split('/')[1],side=n.startsWith('left_')?0:n.startsWith('middle_')?1:n.startsWith('right_')?2:1;
 if(part.group==='wheel')return {type:'wheel',side};
 if(part.group==='drive'){
  if(n==='D2_two_side_axle_journals')return null;
  if(n==='D2_inside_crank_webs')return {type:'crank',side:1};
  if(n.includes('main_rod_with_open_eyes'))return {type:'rod',side};
  if(n.includes('small_end_bushing'))return {type:'slider',side};
  return {type:'crankTranslate',side};
 }
 if(part.group==='actuation'&&!n.endsWith('cylinder_wall')&&!n.endsWith('fixed_guides'))return {type:'slider',side};
 return null;
};
D.transform=function(p,t,m,inverse=false){if(!m||m.type==='wheel')return p.slice();let a=D.pose(.4,m.side),b=D.pose(t,m.side),from,to,angle=0;
 if(m.type==='slider'){from=a.s;to=b.s;}
 else if(m.type==='crankTranslate'){from=a.b;to=b.b;}
 else if(m.type==='crank'){from=to=[D.axisY,0];angle=-(t-.4);}
 else{from=a.b;to=b.b;angle=Math.atan2(b.s[1]-b.b[1],b.s[0]-b.b[0])-Math.atan2(a.s[1]-a.b[1],a.s[0]-a.b[0]);}
 if(inverse){[from,to]=[to,from];angle=-angle;}let c=Math.cos(angle),s=Math.sin(angle),y=p[1]-from[0],z=p[2]-from[1];return[p[0],to[0]+c*y-s*z,to[1]+s*y+c*z];
};
D.bounds=function(part,t){let m=D.classify(part);if(!m||m.type==='wheel')return[part.aabb_min,part.aabb_max];let pts=[];for(let i=0;i<8;i++)pts.push(D.transform([i&1?part.aabb_max[0]:part.aabb_min[0],i&2?part.aabb_max[1]:part.aabb_min[1],i&4?part.aabb_max[2]:part.aabb_min[2]],t,m));return[[0,1,2].map(j=>Math.min(...pts.map(p=>p[j]))-1e-6),[0,1,2].map(j=>Math.max(...pts.map(p=>p[j]))+1e-6)];};
D.glsl=`
uniform float timeTheta;
vec2 dynBig(float t,int side){float phase=side==0?0.0:(side==1?1.7:4.3);return vec2(1.016,0)+.3302*vec2(sin(t+phase),cos(t+phase));}
vec2 dynSmall(float t,int side){float inc=side==1?.11:0.;vec2 u=vec2(sin(inc),cos(inc)),b=dynBig(t,side)-vec2(1.016,0);float h=dot(b,u),perp=b.x*u.y-b.y*u.x;return vec2(1.016,0)+u*(h+sqrt(3.5*3.5-perp*perp));}
vec3 dynSlider(vec3 p,int side){p.yz+=dynSmall(.4,side)-dynSmall(timeTheta,side);return p;}
vec3 dynCrankTranslate(vec3 p,int side){p.yz+=dynBig(.4,side)-dynBig(timeTheta,side);return p;}
vec3 dynCrank(vec3 p){vec2 v=p.yz-vec2(1.016,0);float a=timeTheta-.4,c=cos(a),s=sin(a);p.yz=vec2(c*v.x-s*v.y,s*v.x+c*v.y)+vec2(1.016,0);return p;}
vec3 dynRod(vec3 p,int side){vec2 b0=dynBig(.4,side),bn=dynBig(timeTheta,side),u0=normalize(dynSmall(.4,side)-b0),un=normalize(dynSmall(timeTheta,side)-bn),v=p.yz-bn;p.yz=b0+u0*dot(v,un)+vec2(-u0.y,u0.x)*dot(v,vec2(-un.y,un.x));return p;}
`;
D.argument=function(part){let m=D.classify(part);if(!m||m.type==='wheel')return'p';return m.type==='crank'?'dynCrank(p)':`dyn${m.type[0].toUpperCase()+m.type.slice(1)}(p,${m.side})`;};
// Evaluation order: Time -> Location/environment -> Object state.
D.state=function(Time,Location={},ObjectState={}){if(!Number.isFinite(Time))throw Error('finite Time required');const origin=Location.origin||[0,0,0];if(origin.some(v=>v!==0))throw Error('This diagnostic uses rail-local origin [0,0,0]; translated environments are not yet validated');return {theta:(ObjectState.initialTheta??.4)+(ObjectState.angularSpeed??1)*Time,eye:Location.eye||[16,5,-4],cut:ObjectState.cut??100,object:'train',hierarchy:['frame','boiler','wheel','drive','actuation'],frozen:['valve','valve_chest','cylinder_pressure','trucks','connections'],location:'rail-local Y=0, middle driving axle Z=0, forward +Z'};};
window.renderAt=async function(Time,Location,ObjectState){let s=D.state(Time,Location,ObjectState);return render(s.eye,[0,1.8,-4],s.cut,s.theta);};
D.wheelRadii=[.4826,.4826,1.016,1.016,1.016,.5588];
D.wheelTheta=function(theta,axle){return .4+(theta-.4)*1.016/D.wheelRadii[axle];};
D.scalar=function(part){if(part.group==='wheel'){let axle=Number(part.id.match(/axle(\d+)/)[1]);return `${part.glsl_function}_parameterized(p,.4+(timeTheta-.4)*${(1.016/D.wheelRadii[axle]).toPrecision(17)})`;}return `${part.glsl_function}(${D.argument(part)})`;};
