/* Original KAOPU WebGL2 renderer. Geometry is generated at runtime. */
(function(root){'use strict';
const C=root.AnemoneCore;
const mul=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function matrix(eye,target,aspect){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);const f=1/Math.tan(.6/2),n=.05,far=50;const p=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);return mul(p,view);}
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec2 param;
uniform sampler2D joints;
uniform mat4 vp;
out vec3 world; out vec3 normal; out float axial; out float variation;
vec3 center(int j,int id){return texelFetch(joints,ivec2(clamp(j,0,28),id),0).xyz;}
void main(){int id=gl_InstanceID;float s=param.x;float v=s*28.0;int j=int(floor(v));vec3 p=mix(center(j,id),center(j+1,id),fract(v));vec3 t=normalize(center(min(j+1,28),id)-center(max(j-1,0),id));vec3 b=normalize(cross(t,vec3(0.,0.,1.)));vec3 n=normalize(cross(b,t));vec3 ring=b*cos(param.y)+n*sin(param.y);float cap=clamp((s-.93)/.07,0.,1.);float radius=texelFetch(joints,ivec2(0,id),0).w;float profile=(1.-.1*s)*(1.+.07*exp(-pow((s-.9)/.06,2.)))*sqrt(max(0.,1.-cap*cap));world=p+ring*radius*profile;normal=normalize(ring*sqrt(max(0.,1.-cap*cap))+t*cap);axial=s;variation=fract(sin(float(id)*127.1)*43758.5453);gl_Position=vp*vec4(world,1.);}`;
const bodyVertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 vertexNormal;
uniform mat4 vp;out vec3 world;out vec3 normal;out float axial;out float variation;
void main(){world=position;normal=vertexNormal;axial=-1.;variation=0.;gl_Position=vp*vec4(world,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in float axial;in float variation;uniform vec3 eye;out vec4 color;
void main(){vec3 n=normalize(normal),v=normalize(eye-world),l=normalize(vec3(-2.,5.,3.));float diffuse=max(0.,dot(n,l));float wrap=clamp((dot(n,l)+.5)/1.5,0.,1.);float fres=pow(1.-max(dot(n,v),0.),3.);float spec=pow(max(dot(n,normalize(l+v)),0.),42.);vec3 base;
if(axial<0.){base=mix(vec3(.25,.28,.15),vec3(.43,.46,.22),smoothstep(.2,.5,world.y));if(length(world.xz)<.13&&world.y>.47)base*=.28;}
else{base=mix(vec3(.34,.39,.15),vec3(.53,.58,.29),.35+variation*.35);base=mix(base,vec3(.54,.79,.64),smoothstep(.89,.99,axial));}
vec3 c=base*(.32+diffuse*.55+wrap*.25)+vec3(.39,.64,.55)*fres*.14+vec3(.75,.91,.8)*spec*.3;
float ao=mix(.64,1.,smoothstep(.4,1.1,world.y));c*=ao;color=vec4(pow(c,vec3(1./2.2)),1.);}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl,v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function bodyMesh(){const positions=[],normals=[],indices=[],steps=C.DISC_SIDES,columnRows=14,totalRows=columnRows+C.DISC_RINGS;
 const point=(row,side)=>{const a=side/steps*Math.PI*2;if(row>=columnRows)return C.discPoint(row-columnRows,side);const t=row/columnRows,r=.63+.47*t*t*t;const top=C.discHeight(C.DISC_RADIUS*Math.cos(a),C.DISC_RADIUS*Math.sin(a));return [r*Math.cos(a),top*t,r*Math.sin(a)];};
 for(let row=0;row<=totalRows;row++)for(let side=0;side<=steps;side++){const p=point(row,side);positions.push(...p);normals.push(0,0,0);if(row<totalRows&&side<steps){const k=row*(steps+1)+side;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);}}
 // Closed pedal attachment face uses the same boundary ring as the column.
 const center=positions.length/3;positions.push(0,0,0);normals.push(0,0,0);for(let j=0;j<steps;j++)indices.push(center,j,j+1);
 for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),p=positions.slice(a*3,a*3+3),q=positions.slice(b*3,b*3+3),r=positions.slice(c*3,c*3+3),n=cross(q.map((x,k)=>x-p[k]),r.map((x,k)=>x-p[k]));for(const idx of [a,b,c])for(let k=0;k<3;k++)normals[idx*3+k]+=n[k];}
 for(let i=0;i<normals.length;i+=3){const v=norm(normals.slice(i,i+3));for(let k=0;k<3;k++)normals[i+k]=Number.isFinite(v[k])?v[k]:k===1?1:0;}
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
class Renderer{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!this.gl)throw Error('此浏览器无法创建 WebGL 2');const g=this.gl;this.errors=[];this.frames=0;this.drawMsTotal=0;this.drawMsMax=0;this.drawMsLast=0;this.camera={azimuth:.25,elevation:.84,distance:4.6};this.program=program(g,vertex,fragment);this.bodyProgram=program(g,bodyVertex,fragment);this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
 const params=[],indices=[],rings=42,sides=12;for(let i=0;i<=rings;i++)for(let a=0;a<=sides;a++){params.push(i/rings,a/sides*Math.PI*2);if(i<rings&&a<sides){const k=i*(sides+1)+a;indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}this.tube=g.createVertexArray();g.bindVertexArray(this.tube);this.buffer(0,new Float32Array(params),2);this.index(indices);this.tubeCount=indices.length;
 const body=bodyMesh();this.body=g.createVertexArray();g.bindVertexArray(this.body);this.buffer(0,body.positions,3);this.buffer(1,body.normals,3);this.index(body.indices);this.bodyCount=body.indices.length;g.bindVertexArray(null);g.enable(g.DEPTH_TEST);g.disable(g.CULL_FACE);this.reset({...C.DEFAULTS});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.errors.push('WebGL context lost');this.onError?.('WebGL 上下文已丢失，请重新打开');});
 }
 buffer(location,data,size){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);g.enableVertexAttribArray(location);g.vertexAttribPointer(location,size,g.FLOAT,false,0,0);}
 index(data){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,b);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(data),g.STATIC_DRAW);}
 reset(state){this.state={...state};this.roots=C.roots(state);this.data=C.solve(state,this.roots,0);this.time=0;this.upload(true);}
 upload(allocate=false){const g=this.gl;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);if(allocate)g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,C.SEGMENTS+1,this.roots.length,0,g.RGBA,g.FLOAT,this.data);else g.texSubImage2D(g.TEXTURE_2D,0,0,0,C.SEGMENTS+1,this.roots.length,g.RGBA,g.FLOAT,this.data);}
 draw(time=this.time){const started=performance.now();this.time=time;C.solve(this.state,this.roots,time,this.data);this.upload();const g=this.gl,c=this.canvas;const w=Math.max(1,Math.round(c.clientWidth)),h=Math.max(1,Math.round(c.clientHeight));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;g.viewport(0,0,w,h);g.clearColor(.035,.075,.071,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cam=this.camera,dist=cam.distance,eye=[Math.sin(cam.azimuth)*Math.cos(cam.elevation)*dist,.55+Math.sin(cam.elevation)*dist,Math.cos(cam.azimuth)*Math.cos(cam.elevation)*dist],vp=matrix(eye,[0,.55,0],w/h);
 for(const [p,vao,count]of [[this.bodyProgram,this.body,this.bodyCount],[this.program,this.tube,this.tubeCount]]){g.useProgram(p);g.uniformMatrix4fv(g.getUniformLocation(p,'vp'),false,vp);g.uniform3fv(g.getUniformLocation(p,'eye'),eye);g.bindVertexArray(vao);if(p===this.program){g.uniform1i(g.getUniformLocation(p,'joints'),0);g.drawElementsInstanced(g.TRIANGLES,count,g.UNSIGNED_SHORT,0,this.roots.length);}else g.drawElements(g.TRIANGLES,count,g.UNSIGNED_SHORT,0);}
 g.bindVertexArray(null);this.frames++;const err=g.getError();if(err){this.errors.push(err);this.onError?.('WebGL 错误 '+err);}this.drawMsLast=performance.now()-started;this.drawMsTotal+=this.drawMsLast;this.drawMsMax=Math.max(this.drawMsMax,this.drawMsLast);return err;
 }
 metrics(){return {...C.metrics(this.state,this.roots,this.data),frames:this.frames,time:this.time,drawMsLast:this.drawMsLast,drawMsMean:this.drawMsTotal/Math.max(1,this.frames),drawMsMax:this.drawMsMax,camera:{...this.camera},errors:this.errors.slice(),triangles:this.tubeCount/3*this.roots.length+this.bodyCount/3};}
 pixels(){this.draw();const g=this.gl,bytes=new Uint8Array(this.canvas.width*this.canvas.height*4);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,bytes);let hash=2166136261,changed=0;for(let i=0;i<bytes.length;i++){hash=Math.imul(hash^bytes[i],16777619)>>>0;if(i%4===0&&bytes[i]>40)changed++;}const err=g.getError();if(err)this.errors.push(err);return {hash,changed,width:this.canvas.width,height:this.canvas.height,glError:err};}
}
root.AnemoneRenderer=Renderer;
})(window);
