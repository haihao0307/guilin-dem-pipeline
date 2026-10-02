// Keep every original triangle and the exact original position shader. A depth
// pass does not consume normals, UVs or material varyings, so the GPU linker can
// remove their calculations without changing the shadow silhouette.
export function specializeLegacyShadow(api){
 const r=api.renderer,gl=r.gl,program=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,api.shaders.meshVertex],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 outColor;void main(){outColor=vec4(1);}']]){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s);
 }
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const draw=r.drawFish.bind(r);
 r.drawFish=(matrix,animated,pass)=>{if(!pass?.shadowPass)return draw(matrix,animated,pass);const old=r.habitatProgram;r.habitatProgram=program;try{return draw(matrix,animated,pass);}finally{r.habitatProgram=old;}};
 return {program,sourceVertex:api.shaders.meshVertex,sourceIndexCount:r.indexCount,dispose(){r.drawFish=draw;gl.deleteProgram(program);}};
}
