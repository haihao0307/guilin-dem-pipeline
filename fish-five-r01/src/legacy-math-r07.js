// The original full surface and continuum stay intact. The rigid rotation of a
// fish is invariant over its vertices: evaluate its six trigonometric terms
// once per instance, rather than twice for every vertex in color/shadow passes.
const ROTATION='float c=cos(root.w),ss=sin(root.w),cp=cos(local.z),sp=sin(local.z),cr=cos(local.w),sr=sin(local.w);mat3 rot=mat3(vec3(c*cp,-sp,-ss*cp),vec3(c*sp*cr+ss*sr,cp*cr,-ss*sp*cr+c*sr),vec3(-c*sp*sr+ss*cr,-cp*sr,ss*sp*sr+c*cr));';
export function rotationColumns(yaw,pitch,roll,out,offset=0){
 const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
 out[offset]=c*cp;out[offset+1]=-sp;out[offset+2]=-s*cp;
 out[offset+3]=c*sp*cr+s*sr;out[offset+4]=cp*cr;out[offset+5]=-s*sp*cr+c*sr;
 out[offset+6]=-c*sp*sr+s*cr;out[offset+7]=-cp*sr;out[offset+8]=s*sp*sr+c*cr;return out;
}
export function patchRigidRotation(vertex,count=30){
 if(vertex.split(ROTATION).length!==2||!vertex.includes('uniform mat4 uMvp,uView;'))throw Error('R07 original rotation ABI changed');
 return vertex.replace('uniform mat4 uMvp,uView;',`uniform mat4 uMvp,uView;uniform vec3 uFishRotation[${count*3}];`).replace(ROTATION,'mat3 rot=mat3(uFishRotation[fish*3],uFishRotation[fish*3+1],uFishRotation[fish*3+2]);');
}
function compile(gl,vertex,fragment){const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export function installLegacyMath(api){
 const r=api.renderer,gl=r.gl,count=r.actors.length,baselineShader=api.shaders.meshVertex,vertex=patchRigidRotation(baselineShader,count),columns=new Float32Array(count*9),angles=new Float32Array(count*3).fill(NaN),originalApply=r.applyMesh.bind(r),originalUpload=r.uploadPoses.bind(r),versions=new WeakMap(),programs=[];let revision=0;
 if(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)<count*3+40)throw Error('R07 rotation uniforms exceed hardware limit');
 for(const key of ['program','habitatProgram','wireProgram']){const old=r[key],fragment=gl.getAttachedShaders(old).map(s=>[gl.getShaderParameter(s,gl.SHADER_TYPE),gl.getShaderSource(s)]).find(v=>v[0]===gl.FRAGMENT_SHADER)[1],program=compile(gl,vertex,fragment);r[key]=program;programs.push({key,original:old,program});gl.deleteProgram(old);}
 api.shaders.meshVertex=vertex;
 function update(){let changed=false;for(let i=0;i<count;i++){const o=i*16,a=i*3,y=r.instanceData[o+3],p=r.instanceData[o+14],z=r.instanceData[o+15];if(y!==angles[a]||p!==angles[a+1]||z!==angles[a+2]){angles[a]=y;angles[a+1]=p;angles[a+2]=z;rotationColumns(y,p,z,columns,i*9);changed=true;}}if(changed)revision++;}
 r.uploadPoses=()=>{const result=originalUpload();update();return result;};
 r.applyMesh=(program,m,animated)=>{originalApply(program,m,animated);update();if(versions.get(program)!==revision){const location=r.u(program,'uFishRotation[0]');if(location!==null)gl.uniform3fv(location,columns);versions.set(program,revision);}};
 return {version:'R07_INSTANCE_INVARIANT_ROTATION',baselineShader,vertex,columns,angles,programs,get revision(){return revision;},perVertexTrigonometricTermsRemoved:6,perInstanceTrigonometricTerms:6,completeSurfaceRetained:true};
}
const sourceKeys=['positions','indices','normalOct','uv','binding','weights','partInfo','partRoot','sourceBindings','textures'];
const multiply=(a,b)=>{const out=new Float32Array(16);for(let c=0;c<4;c++){const b0=b[c*4],b1=b[c*4+1],b2=b[c*4+2],b3=b[c*4+3];out[c*4]=a[0]*b0+a[4]*b1+a[8]*b2+a[12]*b3;out[c*4+1]=a[1]*b0+a[5]*b1+a[9]*b2+a[13]*b3;out[c*4+2]=a[2]*b0+a[6]*b1+a[10]*b2+a[14]*b3;out[c*4+3]=a[3]*b0+a[7]*b1+a[11]*b2+a[15]*b3;}return out;};
export function releaseLegacySourceCopies(api,cranial){
 const r=api.renderer,h=r.h,unique=new Set(),tipData=new Map();let bytes=0;for(const key of sourceKeys){const value=h[key];if(ArrayBuffer.isView(value)&&!unique.has(value.buffer)){unique.add(value.buffer);bytes+=value.buffer.byteLength;}}
 for(const [id,tip] of Object.entries(r.partTips||{})){const i=tip.i;tipData.set(Number(id),{root:h.partRoot.slice(i*3,i*3+3),rest:h.positions.slice(i*3,i*3+3)});}
 const vertexCount=h.metadata.counts.vertices;
 for(const key of ['jawWeight','gillWeight','jawGradient','gillGradient']){const length=key.endsWith('Gradient')?vertexCount*3:vertexCount;Object.defineProperty(cranial,key,{enumerable:true,configurable:true,get(){return new Float32Array(length);}});}
 // Skeleton rendering needs seven sampled fin rays, not half a million source
 // vertices. Its original deformation function and sample count are unchanged.
 r.drawPaths=m=>{m={...m,mvp:multiply(m.mvp,api.school.model(r.school.fish[r.state.selected],false))};const gl=r.gl;gl.disable(gl.DEPTH_TEST);r.path(m,r.h.state.worldCenters,[1,.68,.15,1]);const colors=[[.1,.9,1,1],[.75,.35,1,1],[1,.25,.5,1],[1,.55,.1,1],[.2,.9,.2,1],[.1,.55,1,1],[1,.9,.1,1]];
 for(const part of r.h.metadata.continuum.parts){const data=tipData.get(part.id);if(!data)continue;const {root,rest}=data,pts=new Float32Array(37*3);for(let j=0;j<=36;j++){const q=j/36,p=[root[0]+q*(rest[0]-root[0]),root[1]+q*(rest[1]-root[1]),root[2]+q*(rest[2]-root[2])],w=new Uint8Array(12);w[part.id===1?5:part.id===2?6:part.id===3?7:part.id===4?8:part.id===5?9:part.id===6?10:11]=255;const bodyT=Math.max(0,Math.min(1,(p[0]+.38)/.24)),s=bodyT*bodyT*(3-2*bodyT);w[0]=Math.round(s*255);w[1]=255-w[0];const pi=new Uint16Array([part.id,Math.round(q*65535)]),pd=api.instrument.deformMaterial(r.h,p,[0,0,1],null,w,pi,root,true).position;pts.set(pd,j*3);}r.path(m,pts,colors[part.id-1]);}
 for(const side of [1,-1]){const f=api.instrument.eyeFrame(r.h,side,true),d=[Math.sin(f.gazeYaw),Math.sin(f.gazePitch),Math.cos(f.gazeYaw)*Math.cos(f.gazePitch)],world=[f.tangent[0]*d[0]+f.up[0]*d[1]+f.outward[0]*d[2],f.tangent[1]*d[0]+f.up[1]*d[1]+f.outward[1]*d[2],f.tangent[2]*d[0]+f.up[2]*d[1]+f.outward[2]*d[2]];r.path(m,new Float32Array([...f.center,f.center[0]+world[0]*.055,f.center[1]+world[1]*.055,f.center[2]+world[2]*.055]),[1,.75,.15,1]);}gl.enable(gl.DEPTH_TEST);};
 for(const actor of r.actors)for(const key of sourceKeys)actor[key]=null;
 return {version:'R07_GPU_SOURCE_SINGLE_OWNER',sourceVertexCount:vertexCount,sourceIndexCount:r.indexCount,releasedUniqueArrayBytes:bytes,retainedFinRays:tipData.size,retainedDynamicTailSample:true,fullSourceAccessibleFromGpu:true};
}
