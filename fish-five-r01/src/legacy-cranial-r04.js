import * as Ocular from './ocular-r04.js';
import * as Oral from './oral-r04.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function compile(gl,vertex,fragment){const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export async function installLegacyCranial(api){
 const r=api.renderer,gl=r.gl,h=r.actors[0],originalVertex=api.shaders.meshVertex;
 const old='float j=(uSchool?local.x:uJaw)*aW0.z;vec3 q=p-uJawPivot;p=uJawPivot+vec3(cos(j)*q.x-sin(j)*q.y,sin(j)*q.x+cos(j)*q.y,q.z);n=rotateAxis(n,vec3(0,0,1),j);\n  p.z+=sign(p.z+1e-8)*(uSchool?local.y:uGill)*aW0.w;';
 if(!originalVertex.includes(old))throw Error('Measured legacy oral shader anchor changed');
 // Full actual GPU surface includes the inherited eye-socket recess. Both
 // jaw and gill candidates failed its triangle gate. Keep all original
 // geometry and the source mouth pose; nonzero oral uniforms cannot deform it.
 const vertex=originalVertex.replace(old,'// R04 jaw and gill HOLD_LOCAL_SOURCE_SURFACE_LIMIT; source pose retained.');
 const programs=[];for(const key of ['program','habitatProgram','wireProgram']){const original=r[key],fragment=gl.getAttachedShaders(original).map(s=>[gl.getShaderParameter(s,gl.SHADER_TYPE),gl.getShaderSource(s)]).find(v=>v[0]===gl.FRAGMENT_SHADER)[1],program=compile(gl,vertex,fragment);r[key]=program;programs.push({key,original,program});}
 api.shaders.meshVertex=vertex;
 const zeroWeight=new Float32Array(h.positions.length/3),zeroGradient=new Float32Array(h.positions.length);
 let controllers=[],states=[];
 function ensure(i){const actor=r.actors[i];if(states[i]!==actor.state){states[i]=actor.state;controllers[i]={eye:Ocular.create('barracuda',90401,i,actor.metadata.continuum.eyes.eyes),oral:Oral.create('barracuda',90401,i,0)};}return controllers[i];}
 function attach(){const advance=r.advance.bind(r);r.advance=dt=>{advance(dt);for(const i of r.state.school?r.actors.map((_,j)=>j):[r.state.selected]){const actor=r.actors[i],c=ensure(i),mode=String(r.state.mode).toLowerCase(),scan=Ocular.update(c.eye,dt,{mode,turnRate:r.school.fish[i].yawRate||0}),mouth=Oral.update(c.oral,dt,{mode,effort:r.school.fish[i].panic||0});for(const side of [1,-1]){const e=actor.metadata.continuum.eyes.eyes.find(x=>x.side===side),b=Ocular.eyeBasis(c.eye,side),a=Ocular.angles(c.eye,side),g=actor.state.gaze[side===1?0:1];g.yaw=a.yaw*dot(e.tangent,b.anterior);g.pitch=a.pitch*dot(e.up,b.up);g.yawV=g.pitchV=0;}actor.state.eyeYaw=actor.state.gaze[0].yaw;actor.state.eyePitch=actor.state.gaze[0].pitch;actor.state.jaw=mouth.lower;actor.state.gill=mouth.gill;actor.state.jawV=actor.state.gillV=0;actor.cranialR04={eye:scan,oral:mouth};}};}
 return {attach,controllers,originalVertex,vertex,jawWeight:zeroWeight,gillWeight:zeroWeight,jawGradient:zeroGradient,gillGradient:zeroGradient,oralFieldProof:{jaw:{status:'HOLD_LOCAL_SOURCE_SURFACE_LIMIT',enabled:false},gill:{status:'HOLD_LOCAL_SOCKET_NEUTRAL_SURFACE_LIMIT',enabled:false},sourceGeometryUnchanged:true},programs,buffers:[],sourceEyeGeometryUnchanged:true};
}
