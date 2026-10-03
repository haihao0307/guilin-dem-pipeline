/* KAOPU r03 mesh / KuKo material transfer, 2026-10-03.
 * The r03 tube profile, bodyMesh, joint solve, camera and indices are unchanged.
 * KuKo-derived broad rim and distance-softened color, with four study palettes.
 * Two visible front-facing layers: opaque body depth -> nearest tube depth/color
 * -> second distinct tube depth/color -> ordered linear-light alpha composite.
 * Every layer has its own DEPTH_COMPONENT24 texture and nearest-surface depth test.
 * Deeper tube layers are deliberately omitted: this is a two-layer approximation,
 * not refraction / volumetric transport or a collision solver. WebGL2 depth textures
 * need no float-color extension. If framebuffer creation fails, explicit sorted
 * whole-tentacle alpha fallback remains approximate where bent tubes interleave.
 */
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
void main(){int id=gl_InstanceID;float radius=texelFetch(joints,ivec2(0,id),0).w;float curveLength=texelFetch(joints,ivec2(28,id),0).w;float capLength=radius/curveLength;float s=param.x<.85?param.x/.85*(1.-capLength):(1.-capLength)+capLength*(param.x-.85)/.15;float v=s*28.0;int j=int(floor(v));vec3 p=mix(center(j,id),center(j+1,id),fract(v));vec3 t=normalize(center(min(j+1,28),id)-center(max(j-1,0),id));vec3 n;vec3 b;if(t.z<-.99999){n=vec3(0.,-1.,0.);b=vec3(-1.,0.,0.);}else{float k=1./(1.+t.z);n=vec3(1.-t.x*t.x*k,-t.x*t.y*k,-t.x);b=vec3(-t.x*t.y*k,1.-t.y*t.y*k,-t.y);}vec3 ring=b*cos(param.y)+n*sin(param.y);float cap=clamp((s-(1.-capLength))/capLength,0.,1.);float profile=(1.-.1*s)*(1.+.07*exp(-pow((s-.9)/.06,2.)))*sqrt(max(0.,1.-cap*cap));world=p+ring*radius*profile;normal=normalize(ring*sqrt(max(0.,1.-cap*cap))+t*cap);axial=s;variation=fract(sin(float(id)*127.1)*43758.5453);gl_Position=vp*vec4(world,1.);}`;
const bodyVertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 vertexNormal;
uniform mat4 vp;out vec3 world;out vec3 normal;out float axial;out float variation;
void main(){world=position;normal=vertexNormal;axial=-1.;variation=0.;gl_Position=vp*vec4(world,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in float axial;in float variation;uniform vec3 eye;out vec4 color;
void main(){vec3 n=normalize(normal),v=normalize(eye-world),l=normalize(vec3(-2.,5.,3.));float diffuse=max(0.,dot(n,l));float wrap=clamp((dot(n,l)+.5)/1.5,0.,1.);float fres=pow(1.-max(dot(n,v),0.),3.);float spec=pow(max(dot(n,normalize(l+v)),0.),42.);vec3 base;
if(axial<0.){base=mix(vec3(.25,.28,.15),vec3(.43,.46,.22),smoothstep(.2,.5,world.y));if(length(world.xz)<.04&&world.y>.47)base*=.28;}
else{base=mix(vec3(.34,.39,.15),vec3(.53,.58,.29),.35+variation*.35);base=mix(base,vec3(.54,.79,.64),smoothstep(.947,.988,axial));}
vec3 c=base*(.32+diffuse*.55+wrap*.25)+vec3(.39,.64,.55)*fres*.14+vec3(.75,.91,.8)*spec*.3;
float ao=mix(.64,1.,smoothstep(.4,1.1,world.y));c*=ao;color=vec4(pow(c,vec3(1./2.2)),1.);}`;

const PALETTES=Object.freeze({
 green:Object.freeze(['#5C7A48','#A6CA64','#AC6AB7']),
 red:Object.freeze(['#A34C3F','#E99177','#F4B5A4']),
 blue:Object.freeze(['#565769','#8CBBCE','#CFDFE3']),
 yellow:Object.freeze(['#AE722B','#E3B657','#F5E7C4'])
});
const linearHex=h=>[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});
const materialFragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in float axial;in float variation;
uniform vec3 eye;uniform vec3 rootColor;uniform vec3 midColor;uniform vec3 tipColor;
uniform float translucency;uniform float focusDistance;uniform int materialPass;
uniform highp sampler2D bodyDepth;uniform highp sampler2D frontDepth;
out vec4 color;
void main(){
 vec3 n=normalize(normal),v=normalize(eye-world),l=normalize(vec3(.6,.6,.5));
 float facing=clamp(abs(dot(n,v)),0.,1.),diff=max(dot(n,l),0.);
 // Broad soft KuKo rim. fwidth is evaluated unconditionally for stable derivatives.
 float wRim=max(fwidth(facing),.9);
 float rim=pow(smoothstep(0.,wRim,1.-facing),2.);
 float dt=length(eye-world);
 float coc=clamp(.12*abs(dt-focusDistance)/max(focusDistance,.1),0.,.18);
 float sharp=exp(-6.*coc);
 vec3 milk=vec3(.86,.90,.85),base,lit;float alpha=1.;
 if(axial<0.){
   // The complete original column and oral disc remain opaque depth occluders.
   base=mix(rootColor,midColor,.20)*.58;
   base=mix(base,tipColor*.42,.06*smoothstep(.15,.52,world.y));
   if(length(world.xz)<.04&&world.y>.47)base*=.28;
   lit=base*(.62+.34*diff)+mix(midColor,milk,.2)*rim*.035;
   lit*=mix(.74,1.,smoothstep(0.,.5,world.y));
 }else{
   float tissue=smoothstep(.0,.82,axial);
   base=mix(rootColor,midColor,tissue*.88+.04+variation*.07);
   base=mix(base,milk,.12+variation*.045);
   // Hue occupies only the last eight percent, with zero-slope smooth ends.
   // Broad milk lift precedes it, avoiding an abruptly painted tip cap.
   float tip=smoothstep(.92,1.,axial);
   base=mix(base,mix(tipColor,milk,.48),tip*.86);
   base=mix(base,milk,.16*smoothstep(.74,1.,axial));
   float back=pow(max(dot(-n,l),0.),1.5);
   // Transfer the teacher's *combined* rim/edge response, rather than its raw
   // 9.6 multiplier alone. Its smooth off-silhouette lobe is bounded (~.54).
   float teacherCoverage=1.-pow(max(0.,1.-facing),.2);
   float effectiveRim=9.6*rim*teacherCoverage;
   float softAmbient=.20+.8*coc;
   // A colored volume floor keeps the center substantial instead of black glass.
   lit=base*(softAmbient+.52*diff*teacherCoverage*sharp);
   lit+=mix(base,milk,.66)*effectiveRim*.68*sharp;
   lit+=base*pow(facing,1.5)*.08;
   lit+=mix(base,milk,.25)*back*.06;
   lit*=mix(.78,1.,smoothstep(.38,1.12,world.y));
   // At the default .70: solid-looking centers ~.80, soft silhouettes ~.44.
   // Only local surface coverage changes; roots, radii and normals are untouched.
   float transmission=mix(.80,.285714,smoothstep(0.,.72,facing));
   alpha=clamp(1.-translucency*transmission+tip*.035*translucency,.12,1.);
 }
 lit=max(lit,vec3(0.));
 if(materialPass==1||materialPass==2){
   // Evaluate derivatives above before discarding, keeping rim shading stable.
   ivec2 pixel=ivec2(gl_FragCoord.xy);
   if(gl_FragCoord.z>=texelFetch(bodyDepth,pixel,0).r)discard;
   if(materialPass==2){
     float first=texelFetch(frontDepth,pixel,0).r;
     // Three normalized DEPTH_COMPONENT24 units reject only the same surface.
     const float peelEpsilon=3.0/16777215.0;
     if(gl_FragCoord.z<=first+peelEpsilon)discard;
   }
 }
 if(materialPass==3){color=vec4(pow(lit,vec3(1./2.2)),alpha);}
 else{color=vec4(lit,alpha);}
}`;
const compositeVertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const compositeFragment=`#version 300 es
precision highp float;
in vec2 uv;uniform sampler2D sceneColor;uniform sampler2D frontColor;uniform sampler2D secondColor;
out vec4 color;
void main(){
 vec3 scene=texture(sceneColor,uv).rgb;
 vec4 front=texture(frontColor,uv),second=texture(secondColor,uv);
 // Correct surface ordering. Never average every tube intersected by the ray.
 vec3 behindFront=second.rgb*second.a+scene*(1.-second.a);
 vec3 linearColor=front.rgb*front.a+behindFront*(1.-front.a);
 color=vec4(pow(max(linearColor,vec3(0.)),vec3(1./2.2)),1.);
}`;

function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl,v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function bodyMesh(){const positions=[],normals=[],indices=[],steps=C.DISC_SIDES,columnRows=14,totalRows=columnRows+C.DISC_RINGS;
 const point=(row,side)=>{const a=side/steps*Math.PI*2;if(row>=columnRows)return C.discPoint(row-columnRows,side);const t=row/columnRows,r=.63+(C.discRadius(a)-.63)*t*t*t;const top=C.discPoint(0,side)[1];return [r*Math.cos(a),top*t,r*Math.sin(a)];};
 for(let row=0;row<=totalRows;row++)for(let side=0;side<=steps;side++){const p=point(row,side);positions.push(...p);normals.push(0,0,0);if(row<totalRows&&side<steps){const k=row*(steps+1)+side;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);}}
 // Closed pedal attachment face uses the same boundary ring as the column.
 const center=positions.length/3;positions.push(0,0,0);normals.push(0,0,0);for(let j=0;j<steps;j++)indices.push(center,j,j+1);
 for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),p=positions.slice(a*3,a*3+3),q=positions.slice(b*3,b*3+3),r=positions.slice(c*3,c*3+3),n=cross(q.map((x,k)=>x-p[k]),r.map((x,k)=>x-p[k]));for(const idx of [a,b,c])for(let k=0;k<3;k++)normals[idx*3+k]+=n[k];}
 for(let i=0;i<normals.length;i+=3){const v=norm(normals.slice(i,i+3));for(let k=0;k<3;k++)normals[i+k]=Number.isFinite(v[k])?v[k]:k===1?1:0;}
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
class Renderer{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!this.gl)throw Error('此浏览器无法创建 WebGL 2');const g=this.gl;this.errors=[];this.frames=0;this.drawMsTotal=0;this.drawMsMax=0;this.drawMsLast=0;this.camera={azimuth:.25,elevation:.84,distance:4.6};this.program=program(g,vertex,fragment);this.bodyProgram=program(g,bodyVertex,fragment);this.materialProgram=program(g,vertex,materialFragment);this.materialBodyProgram=program(g,bodyVertex,materialFragment);this.compositeProgram=program(g,compositeVertex,compositeFragment);this.compositeVao=g.createVertexArray();this._material=Object.freeze({palette:'green',translucency:.68,mode:'kuko'});this.peelingAvailable=true;this.transparency={method:'two-layer-depth-peeling',available:true,layers:2,deepLayers:'omitted approximation',depthFormat:'DEPTH_COMPONENT24',floatColorRequired:false,reason:null};this.targets=null;this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
 const params=[],indices=[],rings=42,sides=12;for(let i=0;i<=rings;i++)for(let a=0;a<=sides;a++){params.push(i/rings,a/sides*Math.PI*2);if(i<rings&&a<sides){const k=i*(sides+1)+a;indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}this.tube=g.createVertexArray();g.bindVertexArray(this.tube);this.buffer(0,new Float32Array(params),2);this.index(indices);this.tubeCount=indices.length;
 const body=bodyMesh();this.body=g.createVertexArray();g.bindVertexArray(this.body);this.buffer(0,body.positions,3);this.buffer(1,body.normals,3);this.index(body.indices);this.bodyCount=body.indices.length;g.bindVertexArray(null);g.enable(g.DEPTH_TEST);g.disable(g.CULL_FACE);this.reset({...C.DEFAULTS});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.errors.push('WebGL context lost');this.onError?.('WebGL 上下文已丢失，请重新打开');});
 }
 buffer(location,data,size){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);g.enableVertexAttribArray(location);g.vertexAttribPointer(location,size,g.FLOAT,false,0,0);}
 index(data){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,b);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(data),g.STATIC_DRAW);}
 reset(state){this.state={...state};this.roots=C.roots(state);this.data=C.solve(state,this.roots,0);this.time=0;this.upload(true);}
 upload(allocate=false){const g=this.gl;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);if(allocate)g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,C.SEGMENTS+1,this.roots.length,0,g.RGBA,g.FLOAT,this.data);else g.texSubImage2D(g.TEXTURE_2D,0,0,0,C.SEGMENTS+1,this.roots.length,g.RGBA,g.FLOAT,this.data);}

 static validateMaterial(values){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Material must be an object');
  for(const key of Object.keys(values))if(!['palette','translucency','mode'].includes(key))throw Error('Unknown material field: '+key);
  const next={palette:'green',translucency:.68,mode:'kuko',...values};
  if(!Object.prototype.hasOwnProperty.call(PALETTES,next.palette))throw Error('Unknown material palette');
  if(!Number.isFinite(next.translucency)||next.translucency<0||next.translucency>1)throw Error('Translucency must be within 0..1');
  if(!['kuko','baseline'].includes(next.mode))throw Error('Material mode must be kuko or baseline');
  return {...next};
 }
 get material(){return {...this._material};}
 set material(value){this.setMaterial(value);}
 setMaterial(values){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Material must be an object');
  const next=Renderer.validateMaterial({...this._material,...values});this._material=Object.freeze(next);return this.material;
 }
 releaseTargets(){
  if(!this.targets)return;const g=this.gl,t=this.targets;
  for(const f of t.framebuffers)g.deleteFramebuffer(f);
  for(const texture of [...t.textures,...t.depthTextures])g.deleteTexture(texture);
  this.targets=null;
 }
 ensureTargets(w,h){
  if(!this.peelingAvailable)return false;
  if(this.targets?.width===w&&this.targets?.height===h)return true;
  this.releaseTargets();const g=this.gl,t={width:w,height:h,textures:[],depthTextures:[],framebuffers:[]};this.targets=t;
  const texture=(internal,format,type)=>{
   const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   g.texImage2D(g.TEXTURE_2D,0,internal,w,h,0,format,type,null);return tex;
  };
  for(let i=0;i<3;i++){
   const color=texture(g.RGBA8,g.RGBA,g.UNSIGNED_BYTE);t.textures.push(color);
   const depth=texture(g.DEPTH_COMPONENT24,g.DEPTH_COMPONENT,g.UNSIGNED_INT);t.depthTextures.push(depth);
   const f=g.createFramebuffer();t.framebuffers.push(f);g.bindFramebuffer(g.FRAMEBUFFER,f);
   g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,color,0);
   g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,depth,0);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){
    this.releaseTargets();this.peelingAvailable=false;this.transparency={method:'sorted-alpha-fallback',available:false,layers:null,deepLayers:'sorted whole-tube approximation',reason:'WebGL2 depth-texture framebuffer incomplete; whole-tentacle sorting is approximate at interleaving surfaces'};
    g.bindFramebuffer(g.FRAMEBUFFER,null);return false;
   }
  }
  g.bindFramebuffer(g.FRAMEBUFFER,null);return true;
 }
 uniforms(p,vp,eye,pass,dist){
  const g=this.gl;g.useProgram(p);g.uniformMatrix4fv(g.getUniformLocation(p,'vp'),false,vp);g.uniform3fv(g.getUniformLocation(p,'eye'),eye);
  if(pass!==undefined){const palette=PALETTES[this._material.palette].map(linearHex);
   for(const [i,name] of ['rootColor','midColor','tipColor'].entries())g.uniform3fv(g.getUniformLocation(p,name),palette[i]);
   g.uniform1f(g.getUniformLocation(p,'translucency'),this._material.translucency);g.uniform1f(g.getUniformLocation(p,'focusDistance'),dist);g.uniform1i(g.getUniformLocation(p,'materialPass'),pass);
   // Inactive branches still have active samplers: bind harmless joint data there
   // so an attached current-layer depth texture is never a sampling feedback loop.
   for(const [unit,name,tex]of [[1,'bodyDepth',(pass===1||pass===2)?this.targets.depthTextures[0]:this.texture],[2,'frontDepth',pass===2?this.targets.depthTextures[1]:this.texture]]){
    g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,tex);g.uniform1i(g.getUniformLocation(p,name),unit);
   }
   g.activeTexture(g.TEXTURE0);
  }
 }
 drawBody(p,vp,eye,pass,dist){const g=this.gl;this.uniforms(p,vp,eye,pass,dist);g.bindVertexArray(this.body);g.drawElements(g.TRIANGLES,this.bodyCount,g.UNSIGNED_SHORT,0);}
 drawTubes(p,vp,eye,pass,dist,sorted=false){
  const g=this.gl;this.uniforms(p,vp,eye,pass,dist);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.uniform1i(g.getUniformLocation(p,'joints'),0);g.bindVertexArray(this.tube);
  if(!sorted){g.drawElementsInstanced(g.TRIANGLES,this.tubeCount,g.UNSIGNED_SHORT,0,this.roots.length);return;}
  // Fallback sorts a GPU-only copy of existing joint rows; CPU solve, root order,
  // exact vertex shader, positions and tube profile remain unchanged.
  const stride=(C.SEGMENTS+1)*4,order=this.roots.map((_,id)=>{let depth=0;for(let j=0;j<=C.SEGMENTS;j++){const k=id*stride+j*4;depth+=(this.data[k]-eye[0])**2+(this.data[k+1]-eye[1])**2+(this.data[k+2]-eye[2])**2;}return{id,depth};}).sort((a,b)=>b.depth-a.depth||a.id-b.id);
  if(!this.sortedData||this.sortedData.length!==this.data.length)this.sortedData=new Float32Array(this.data.length);
  for(let i=0;i<order.length;i++)this.sortedData.set(this.data.subarray(order[i].id*stride,(order[i].id+1)*stride),i*stride);
  g.texSubImage2D(g.TEXTURE_2D,0,0,0,C.SEGMENTS+1,this.roots.length,g.RGBA,g.FLOAT,this.sortedData);
  g.drawElementsInstanced(g.TRIANGLES,this.tubeCount,g.UNSIGNED_SHORT,0,this.roots.length);
 }
 draw(time=this.time){const started=performance.now();this.time=time;C.solve(this.state,this.roots,time,this.data);this.upload();const g=this.gl,c=this.canvas;const w=Math.max(1,Math.round(c.clientWidth)),h=Math.max(1,Math.round(c.clientHeight));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;g.viewport(0,0,w,h);
  const cam=this.camera,dist=cam.distance*Math.max(1,1.42/(w/h)),eye=[Math.sin(cam.azimuth)*Math.cos(cam.elevation)*dist,.55+Math.sin(cam.elevation)*dist,Math.cos(cam.azimuth)*Math.cos(cam.elevation)*dist],vp=matrix(eye,[0,.55,0],w/h);
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.depthMask(true);g.enable(g.DEPTH_TEST);g.depthFunc(g.LESS);g.disable(g.BLEND);g.disable(g.CULL_FACE);
  if(this._material.mode==='baseline'){
   // Exact original opaque r03 shading, for a geometry-preserving material A/B.
   g.clearColor(.035,.075,.071,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   this.drawBody(this.bodyProgram,vp,eye);this.drawTubes(this.program,vp,eye);
  }else if(this._material.translucency===0){
   // A true zero-translucency control: opaque material with exact depth visibility.
   g.clearColor(Math.pow(.0023,1/2.2),Math.pow(.0061,1/2.2),Math.pow(.0055,1/2.2),1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   this.drawBody(this.materialBodyProgram,vp,eye,3,dist);this.drawTubes(this.materialProgram,vp,eye,3,dist);
  }else if(this.ensureTargets(w,h)){
   const t=this.targets;g.bindFramebuffer(g.FRAMEBUFFER,t.framebuffers[0]);g.clearColor(.0023,.0061,.0055,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   this.drawBody(this.materialBodyProgram,vp,eye,0,dist);
   g.depthMask(true);g.enable(g.CULL_FACE);g.cullFace(g.BACK);g.disable(g.BLEND);
   for(let layer=1;layer<=2;layer++){
    g.bindFramebuffer(g.FRAMEBUFFER,t.framebuffers[layer]);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
    this.drawTubes(this.materialProgram,vp,eye,layer,dist);
   }
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.disable(g.DEPTH_TEST);g.disable(g.CULL_FACE);g.useProgram(this.compositeProgram);g.bindVertexArray(this.compositeVao);
   for(const [i,name]of ['sceneColor','frontColor','secondColor'].entries()){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t.textures[i]);g.uniform1i(g.getUniformLocation(this.compositeProgram,name),i);}
   g.drawArrays(g.TRIANGLES,0,3);
  }else{
   // Explicit framebuffer fallback: sorted alpha with opaque body depth.
   g.clearColor(Math.pow(.0023,1/2.2),Math.pow(.0061,1/2.2),Math.pow(.0055,1/2.2),1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   this.drawBody(this.materialBodyProgram,vp,eye,3,dist);
   g.depthMask(false);g.enable(g.CULL_FACE);g.cullFace(g.BACK);g.enable(g.BLEND);g.blendEquation(g.FUNC_ADD);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
   this.drawTubes(this.materialProgram,vp,eye,3,dist,true);
  }
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindVertexArray(null);g.depthMask(true);g.enable(g.DEPTH_TEST);g.disable(g.BLEND);g.disable(g.CULL_FACE);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);
  this.frames++;const err=g.getError();if(err){this.errors.push(err);this.onError?.('WebGL 错误 '+err);}this.drawMsLast=performance.now()-started;this.drawMsTotal+=this.drawMsLast;this.drawMsMax=Math.max(this.drawMsMax,this.drawMsLast);return err;
 }
 metrics(){return {...C.metrics(this.state,this.roots,this.data),frames:this.frames,time:this.time,drawMsLast:this.drawMsLast,drawMsMean:this.drawMsTotal/Math.max(1,this.frames),drawMsMax:this.drawMsMax,camera:{...this.camera},material:this.material,transparency:{...this.transparency,active:this._material.mode==='kuko'&&this._material.translucency>0,bodyDepthTest:true,bodyOpaque:true,volumetricTransport:false},errors:this.errors.slice(),triangles:this.tubeCount/3*this.roots.length+this.bodyCount/3};}
 pixels(){this.draw();const g=this.gl,bytes=new Uint8Array(this.canvas.width*this.canvas.height*4);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,bytes);let hash=2166136261,changed=0;for(let i=0;i<bytes.length;i++){hash=Math.imul(hash^bytes[i],16777619)>>>0;if(i%4===0&&bytes[i]>40)changed++;}const err=g.getError();if(err)this.errors.push(err);return {hash,changed,width:this.canvas.width,height:this.canvas.height,glError:err};}
}
Renderer.PALETTES=PALETTES;
root.AnemoneRenderer=Renderer;
})(window);

