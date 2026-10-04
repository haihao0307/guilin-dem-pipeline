/* R21 depth-tested renderer. No geometry generation and no third-party engine. */
(()=>{'use strict';
function create(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!gl)return null;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 a_position;attribute vec3 a_color;varying vec3 v_color;void main(){gl_Position=vec4(a_position,1.0);v_color=a_color;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 v_color;void main(){gl_FragColor=vec4(v_color,1.0);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const buffer=gl.createBuffer(),pos=gl.getAttribLocation(program,'a_position'),color=gl.getAttribLocation(program,'a_color');gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
 const rgb=value=>{if(value[0]==='#'){const n=parseInt(value.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}const n=value.match(/[\d.]+/g).slice(0,3).map(Number);return n.map(x=>x/255)};
 const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function draw(packet,options){
  const {project,shade,showSurface,showSpine,showSections,neutral}=options,w=canvas.width,h=canvas.height,screen=packet.positions.map(project);
  let near=Infinity,far=-Infinity;for(const p of screen){near=Math.min(near,p[2]);far=Math.max(far,p[2]);}const span=Math.max(1,far-near),mid=(near+far)/2;
  const clip=(p,bias=0)=>[2*p[0]/w-1,1-2*p[1]/h,-1.8*(p[2]-mid)/span+bias];
  const triangles=[];for(let i=0;i<packet.faces.length;i++){const kind=packet.faceKinds[i]||'body';if(options.faceVisible?!options.faceVisible(kind,i):(kind==='spine'?!showSpine:!showSurface))continue;const ids=packet.faces[i],p=ids.map(k=>packet.positions[k]),normal=cross(sub(p[1],p[0]),sub(p[2],p[0])),c=rgb(shade(normal,kind));for(const k of ids)triangles.push(...clip(screen[k]),...c)}
  const lines=[];function addLine(points,c){if(!points||points.length<2)return;const value=rgb(c);for(let i=1;i<points.length;i++)for(const p of[points[i-1],points[i]])lines.push(...clip(project(p),-.0013),...value)}
  if(showSections)for(const section of packet.sections||[])addLine(Array.isArray(section)?section:section.points,'#8ba5a6');
  for(const l of packet.lines||[]){if(l.kind==='spine'||l.kind==='axis')continue;if(!showSections&&!['fin-vein','fin-rib','tail-ray'].includes(l.kind))continue;addLine(l.points,l.color||'#9fc5c3')}
  
  gl.viewport(0,0,w,h);gl.clearColor(neutral?.062:.031,neutral?.071:.052,neutral?.074:.060,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(triangles),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,triangles.length/6);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,lines.length/6);
  return {engine:'WebGL',depthTest:gl.isEnabled(gl.DEPTH_TEST),error:gl.getError(),triangles:triangles.length/18};
 }
 return {draw,gl};
}
window.HaiyuDepthRenderer={create};
})();
