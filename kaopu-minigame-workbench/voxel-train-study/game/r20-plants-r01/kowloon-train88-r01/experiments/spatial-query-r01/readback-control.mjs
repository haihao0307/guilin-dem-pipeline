// Diagnostic-only MRT write control, using the same framebuffer and viewport.
export const controlFragment='#version 300 es\nprecision highp float;layout(location=0)out vec4 a;layout(location=1)out vec4 b;layout(location=2)out vec4 c;layout(location=3)out vec4 e;void main(){a=vec4(1,2,3,4);b=vec4(5,6,7,8);c=vec4(9,10,11,12);e=vec4(13,14,15,16);}';
export const sentinel=(attachment)=>new Float32Array([0,1,2,3].map(c=>-4096-attachment*4-c));
export function inspectReadback(combined,width,drawError,drawContextLost,attachmentErrors,contextLost){
 const nonFinite=[];let nonFiniteCount=0,nonZeroCount=0,unchangedSentinelCount=0;
 for(let i=0;i<combined.length;i++){if(!Number.isFinite(combined[i])){nonFiniteCount++;if(nonFinite.length<10)nonFinite.push({point:Math.floor(i/16),channel:i%16,bits:new Uint32Array(combined.buffer)[i]});}if(combined[i]!==0)nonZeroCount++;if(combined[i]===-4096-i%16)unchangedSentinelCount++;}
 return{drawError,drawContextLost,attachmentErrors,contextLost,nonFiniteCount,nonFinite,allZero:nonZeroCount===0,unchangedSentinelCount,allSentinelsUnchanged:unchangedSentinelCount===width*16};
}
export function readMRT(gl,width){const combined=new Float32Array(width*16),errors=[];for(let a=0;a<4;a++){const data=new Float32Array(width*4);gl.readBuffer(gl.COLOR_ATTACHMENT0+a);gl.readPixels(0,0,width,1,gl.RGBA,gl.FLOAT,data);errors.push(gl.getError());for(let i=0;i<width;i++)combined.set(data.subarray(i*4,i*4+4),i*16+a*4);}return{combined,errors};}
export function createWriteControl(gl,vertex,width){
 const program=gl.createProgram();for(const[type,code]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,controlFragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Control shader: '+gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Control program: '+gl.getProgramInfoLog(program));
 return()=>{gl.useProgram(program);gl.drawArrays(gl.TRIANGLES,0,3);const {combined,errors}=readMRT(gl,width);let wrong=0;for(let i=0;i<combined.length;i++)if(combined[i]!==i%16+1)wrong++;return{wrong,errors,contextLost:gl.isContextLost(),points:width,channels:16,passed:wrong===0&&errors.every(x=>x===gl.NO_ERROR)&&!gl.isContextLost()};};
}
