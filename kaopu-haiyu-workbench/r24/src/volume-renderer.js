/* Depth-tested view of source samples and independently inferred volume. */
(()=>{'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>{const m=Math.hypot(...v)||1;return v.map(x=>x/m)};
function create(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 const ctx=gl?null:canvas.getContext('2d');let program,buffer,locations;
 if(gl){const shader=(kind,src)=>{const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec4 color;varying vec4 col;uniform float size;void main(){gl_Position=vec4(p,1.);gl_PointSize=size;col=color;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 col;uniform float points;void main(){if(points>.5){vec2 uv=gl_PointCoord*2.-1.;if(dot(uv,uv)>1.)discard;}gl_FragColor=col;}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));buffer=gl.createBuffer();locations={p:gl.getAttribLocation(program,'p'),color:gl.getAttribLocation(program,'color'),size:gl.getUniformLocation(program,'size'),points:gl.getUniformLocation(program,'points')};gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);}
 const warm=unit([-.8,.4,.7]),cool=unit([.9,.18,.65]);
 function draw(packet,o){
  const w=canvas.width,h=canvas.height,aspect=w/h,scale=o.zoom/200;
  const project=p=>{const r=o.rotate(p);return[r[0]*scale/aspect,r[1]*scale,-r[2]/650]}, screen=p=>{const r=project(p);return[(r[0]+1)*w/2,(1-r[1])*h/2,-r[2]]};
  const color=(n,kind,alpha=1)=>{n=unit(o.rotate(n));if(n[2]<0)n=n.map(v=>-v);const dot=d=>Math.max(0,n.reduce((s,x,i)=>s+x*d[i],0));if(kind==='axis')return[1,.27,.46,1];const base=kind==='rib'?[.63,.81,.82]:[.58,.75,.72];if(!o.lit){const v=.3+.65*Math.max(0,n[2]);return[v,v,v,alpha]}const a=dot(warm),b=dot(cool);return base.map((v,i)=>Math.min(1,v*(.2+a*[1.4,.85,.43][i]+b*[.4,.85,1.5][i]))).concat(alpha)};
  const vertices=packet.positions||[],faces=packet.faces||[],kinds=packet.faceKinds||[];
  const triangles=[];for(let j=0;j<faces.length;j++){const kind=kinds[j]||'body';if(kind==='body'&&!o.body||kind==='axis'&&!o.spine)continue;const ps=faces[j].map(i=>vertices[i]),normal=cross(sub(ps[1],ps[0]),sub(ps[2],ps[0]));if(o.cut&&kind==='body'&&o.rotate(ps.reduce((a,p)=>a.map((v,k)=>v+p[k]/3),[0,0,0]))[2]>0&&o.rotate(normal)[2]>0)continue;const alpha=kind==='body'?(o.cut?.82:.26):1,c=color(normal,kind,alpha);triangles.push({ps,c,depth:ps.reduce((a,p)=>a+o.rotate(p)[2]/3,0),kind});}
  const cloud=o.cloud?(packet.cloud||[]):[];
  if(gl){gl.viewport(0,0,w,h);gl.clearColor(.035,.042,.045,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(locations.p);gl.enableVertexAttribArray(locations.color);gl.vertexAttribPointer(locations.p,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(locations.color,4,gl.FLOAT,false,28,12);gl.uniform1f(locations.size,Math.max(1,o.pointSize*w/800));gl.uniform1f(locations.points,0);gl.disable(gl.BLEND);gl.depthMask(true);
   const batch=(items,mode)=>{const data=[];for(const item of items)for(const p of item.ps)data.push(...project(p),...item.c);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(mode,0,data.length/7)};
   batch(triangles.filter(t=>t.c[3]===1),gl.TRIANGLES);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);batch(triangles.filter(t=>t.c[3]<1).sort((a,b)=>a.depth-b.depth),gl.TRIANGLES);
   const lines=[];if(o.sections)for(const ring of packet.rings||[]){const ps=ring.points||ring;for(let i=1;i<ps.length;i++)lines.push({ps:[ps[i-1],ps[i]],c:[.61,.79,.80,.55]})}batch(lines,gl.LINES);
   gl.uniform1f(locations.points,1);const dots=cloud.map(p=>({ps:[p],c:[.76,.86,.84,.48]}));batch(dots,gl.POINTS);gl.depthMask(true);gl.disable(gl.BLEND);return{engine:'WebGL',depthTest:gl.isEnabled(gl.DEPTH_TEST),error:gl.getError(),triangles:triangles.length};
  }
  ctx.fillStyle='#090b0c';ctx.fillRect(0,0,w,h);const items=triangles.map(t=>({kind:'face',depth:t.depth,t}));for(let i=0;i<cloud.length;i+=2){const p=cloud[i];items.push({kind:'point',depth:o.rotate(p)[2],p})}items.sort((a,b)=>a.depth-b.depth);for(const item of items){if(item.kind==='point'){const p=screen(item.p);ctx.fillStyle='rgba(192,218,214,.47)';ctx.fillRect(p[0],p[1],o.pointSize,o.pointSize)}else{const {ps,c}=item.t,p=ps.map(screen);ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();ctx.fillStyle=`rgba(${c.slice(0,3).map(v=>Math.round(v*255)).join(',')},${c[3]})`;ctx.fill();}}return{engine:'Canvas3D-fallback',depthTest:false,error:0,triangles:triangles.length};
 }
 return{draw,gl};
}
window.HaiyuVolumeRenderer={create};
})();
