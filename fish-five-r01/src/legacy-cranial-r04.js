import * as Ocular from './ocular-r04.js';
import * as Oral from './oral-r04.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function compile(gl,vertex,fragment){const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
async function gradients(h){
 const code='const surfaceGradients='+Oral.surfaceGradients.toString()+';onmessage=e=>{const {p,i,w}=e.data,j=surfaceGradients(p,i,w,12,2),g=surfaceGradients(p,i,w,12,3);for(let k=0;k<j.length;k++){j[k]/=255;g[k]/=255;}postMessage({j,g},[j.buffer,g.buffer]);};',url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);
 try{return await new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(Error(e.message));const p=h.positions.slice(),i=h.indices.slice(),w=h.weights.slice();worker.postMessage({p,i,w},[p.buffer,i.buffer,w.buffer]);});}finally{worker.terminate();URL.revokeObjectURL(url);}
}
export async function installLegacyCranial(api){
 const r=api.renderer,gl=r.gl,h=r.actors[0],originalVertex=api.shaders.meshVertex,grad=await gradients(h);
 let vertex=originalVertex.replace('layout(location=7) in vec3 aPartRoot;','layout(location=7) in vec3 aPartRoot;\nlayout(location=8) in vec3 aJawGradient;layout(location=9) in vec3 aGillGradient;');
 const old='float j=(uSchool?local.x:uJaw)*aW0.z;vec3 q=p-uJawPivot;p=uJawPivot+vec3(cos(j)*q.x-sin(j)*q.y,sin(j)*q.x+cos(j)*q.y,q.z);n=rotateAxis(n,vec3(0,0,1),j);\n  p.z+=sign(p.z+1e-8)*(uSchool?local.y:uGill)*aW0.w;';
 const replacement=`float jaw=(uSchool?local.x:uJaw),j=jaw*aW0.z;vec3 q=p-uJawPivot,qr=vec3(cos(j)*q.x-sin(j)*q.y,sin(j)*q.x+cos(j)*q.y,q.z);p=uJawPivot+qr;
  float gill=sign(p.z+1e-8)*(uSchool?local.y:uGill);p.z+=gill*aW0.w;
  if(aW0.z>0.0||aW0.w>0.0||dot(aJawGradient,aJawGradient)+dot(aGillGradient,aGillGradient)>0.0){
  vec3 angular=cross(vec3(0,0,1),qr),X=rotateAxis(vec3(1,0,0),vec3(0,0,1),j)+angular*jaw*aJawGradient.x,Y=rotateAxis(vec3(0,1,0),vec3(0,0,1),j)+angular*jaw*aJawGradient.y,Z=vec3(0,0,1)+angular*jaw*aJawGradient.z;X.z+=gill*aGillGradient.x;Y.z+=gill*aGillGradient.y;Z.z+=gill*aGillGradient.z;
  n=normalize(n.x*cross(Y,Z)+n.y*cross(Z,X)+n.z*cross(X,Y));}`;
 if(!vertex.includes(old))throw Error('Measured legacy jaw shader anchor changed');vertex=vertex.replace(old,replacement);
 const programs=[];for(const key of ['program','habitatProgram','wireProgram']){const original=r[key],fragment=gl.getAttachedShaders(original).map(s=>[gl.getShaderParameter(s,gl.SHADER_TYPE),gl.getShaderSource(s)]).find(v=>v[0]===gl.FRAGMENT_SHADER)[1],program=compile(gl,vertex,fragment);r[key]=program;programs.push({key,original,program});}
 const buffers=[];for(const [location,data] of [[8,grad.j],[9,grad.g]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(const vao of [r.vao,r.wireVao]){gl.bindVertexArray(vao);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);}}
 gl.bindVertexArray(null);api.shaders.meshVertex=vertex;
 let controllers=[],states=[];
 function ensure(i){const actor=r.actors[i];if(states[i]!==actor.state){states[i]=actor.state;controllers[i]={eye:Ocular.create('barracuda',90401,i,actor.metadata.continuum.eyes.eyes),oral:Oral.create('barracuda',90401,i,.038)};}return controllers[i];}
 function attach(){const advance=r.advance.bind(r);r.advance=dt=>{advance(dt);for(const i of r.state.school?r.actors.map((_,j)=>j):[r.state.selected]){const actor=r.actors[i],c=ensure(i),mode=String(r.state.mode).toLowerCase(),scan=Ocular.update(c.eye,dt,{mode,turnRate:r.school.fish[i].yawRate||0}),mouth=Oral.update(c.oral,dt,{mode,effort:r.school.fish[i].panic||0});for(const side of [1,-1]){const e=actor.metadata.continuum.eyes.eyes.find(x=>x.side===side),b=Ocular.eyeBasis(c.eye,side),a=Ocular.angles(c.eye,side),g=actor.state.gaze[side===1?0:1];g.yaw=a.yaw*dot(e.tangent,b.anterior);g.pitch=a.pitch*dot(e.up,b.up);g.yawV=g.pitchV=0;}actor.state.eyeYaw=actor.state.gaze[0].yaw;actor.state.eyePitch=actor.state.gaze[0].pitch;actor.state.jaw=mouth.lower;actor.state.gill=mouth.gill;actor.state.jawV=actor.state.gillV=0;actor.cranialR04={eye:scan,oral:mouth};}};}
 return {attach,controllers,originalVertex,vertex,jawGradient:grad.j,gillGradient:grad.g,programs,buffers,sourceEyeGeometryUnchanged:true};
}
