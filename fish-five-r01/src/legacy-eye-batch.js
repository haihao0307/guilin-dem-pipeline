import {sourceEyeFit} from './legacy-eye-fit-r05.js';
// Original eye aperture and eyeFrame stay source-linked; R05 fits axial relief and material.
// Per-eye uniforms become rows in an atlas, allowing one draw per material range.
export function batchLegacyEyes(api){
 const r=api.renderer,gl=r.gl,original=r.drawEyes.bind(r),rows=new Float32Array(12*60*4);
 const declaration='uniform mat4 uMvp,uView,uModel;uniform mat3 uModelNormal;uniform vec3 uCenter,uTangent,uUp,uOutward;uniform float uGazeYaw,uGazePitch,uPupil,uGlobeRadius;';
 const fit=sourceEyeFit(api);
 function vertexFor(shader){shader=fit.vertex(shader);if(!shader.includes(declaration))throw Error('Eye batching ABI mismatch');return shader.replace(declaration,`uniform mat4 uMvp,uView;uniform highp sampler2D uEyeAtlas;
 vec4 eyeRow(int col){return texelFetch(uEyeAtlas,ivec2(col,gl_InstanceID),0);}`)
 .replace('void main(){',`void main(){
 mat4 uModel=mat4(eyeRow(0),eyeRow(1),eyeRow(2),eyeRow(3));
 mat3 uModelNormal=mat3(eyeRow(4).xyz,eyeRow(5).xyz,eyeRow(6).xyz);
 vec3 uCenter=eyeRow(7).xyz,uTangent=eyeRow(8).xyz,uUp=eyeRow(9).xyz,uOutward=eyeRow(10).xyz;
 vec4 gaze=eyeRow(11);float uGazeYaw=gaze.x,uGazePitch=gaze.y,uPupil=gaze.z,uGlobeRadius=gaze.w;`);}
 function program(vertex,fragment){const p=gl.createProgram();for(const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 // The original shaders expose the optics placeholder. Resolve from their iframe.
 const optics=r.canvas.ownerDocument.defaultView.KaopuHabitat.OPTICS_GLSL;
 const groupFragment=fit.fragment(api.shaders.habitatEyeFragment).replace('__HABITAT_OPTICS__',optics).replace('void main(){','void shadeEye(){')+`\nvoid main(){if(uHabitatShadow){outColor=vec4(1);return;}shadeEye();if(uHabitat){vec3 linear=mix(outColor.rgb/12.92,pow((outColor.rgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),outColor.rgb));linear=habitatFishAlbedo(linear,vWorldPos,transpose(mat3(uView))*normalize(vNormal));outColor.rgb=habitatFog(linear,vWorldPos,uEye);}}`;
 const groupProgram=program(vertexFor(api.shaders.habitatEyeVertex),groupFragment),singleProgram=program(vertexFor(api.shaders.eyeVertex),fit.fragment(api.shaders.eyeFragment));
 const atlas=gl.createTexture();gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,12,60,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 let key='',count=0;
 function prepare(animated){const current=[r.frames,r.state.school,r.state.selected,animated].join(':');if(current===key)return;key=current;count=0;
  for(const i of r.state.school?r.actors.map((_,j)=>j):[r.state.selected])for(const side of [1,-1]){
   const f=api.instrument.eyeFrame(r.actors[i],side,animated),m=api.school.model(r.school.fish[i],r.state.school),offset=count*48;
   rows.set(m,offset);
   for(let j=0;j<3;j++){const d=m[j*4]**2+m[j*4+1]**2+m[j*4+2]**2;rows.set([m[j*4]/d,m[j*4+1]/d,m[j*4+2]/d,0],offset+16+j*4);}
   rows.set([...f.center,0,...f.tangent,0,...f.up,0,...f.outward,0,f.gazeYaw,f.gazePitch,f.pupil,f.parameters.globeRadiusM],offset+28);count++;
  }
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,12,count,gl.RGBA,gl.FLOAT,rows.subarray(0,count*48));
 }
 r.drawEyes=(m,animated)=>{if(!r.state.eyes)return;prepare(animated);const p=r.state.school?groupProgram:singleProgram,u=name=>r.u(p,name);gl.useProgram(p);r.habitatUniforms(p,m);gl.uniformMatrix4fv(u('uMvp'),false,m.mvp);gl.uniformMatrix4fv(u('uView'),false,m.view);gl.activeTexture(gl.TEXTURE5);gl.bindSampler(5,null);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.uniform1i(u('uEyeAtlas'),5);gl.bindVertexArray(r.eyeVao);gl.disable(gl.BLEND);gl.depthMask(true);
  for(const component of [0,1,2,3]){const range=r.eyeGeometry.ranges[component];gl.drawElementsInstanced(gl.TRIANGLES,range.count,gl.UNSIGNED_INT,range.offset*4,count);}
  const range=r.eyeGeometry.ranges[4];gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawElementsInstanced(gl.TRIANGLES,range.count,gl.UNSIGNED_INT,range.offset*4,count);gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
 };
 return {fitProof:fit.proof,get instances(){return count;},get frameData(){return rows;},original,dispose(){r.drawEyes=original;gl.deleteTexture(atlas);gl.deleteProgram(groupProgram);gl.deleteProgram(singleProgram);}};
}
