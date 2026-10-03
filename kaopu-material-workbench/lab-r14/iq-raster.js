/* KAOPU IQ interactive rasterizer R14
   Runtime-generated adaptive-quality icosphere carrier. The SDF remains the source of truth.
   No texture assets and no external model. Fine material layers stay procedural per-fragment. */
'use strict';
window.createIQRasterRuntime=function(canvas){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
 if(!gl)throw Error('IQ raster path: WebGL2 unavailable');
 const VS=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 aPos;
 layout(location=1) in vec3 aNormal;
 uniform vec2 uRes,uPan;uniform float uYaw,uPitch,uTime,uZoom;
 out vec3 vWorld,vNormal,vObj;
 vec2 rr(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
 void main(){
   float an=.04*uTime-3.2;
   vec3 wp=aPos;wp.xz=rr(wp.xz,-an);
   vec3 wn=aNormal;wn.xz=rr(wn.xz,-an);
   vec3 po=vec3(0.,.3,1.5);po.yz=rr(po.yz,uPitch);po.xz=rr(po.xz,uYaw);
   vec3 ww=normalize(-po),uu=normalize(cross(ww,vec3(0,1,0))),vv=normalize(cross(uu,ww));
   vec3 d=wp-po;float z=max(.02,dot(d,ww));
   vec2 pp=1.7*vec2(dot(d,uu),dot(d,vv))/z;pp=uZoom*(pp-2.*uPan);
   float aspect=uRes.x/uRes.y;
   gl_Position=vec4(pp.x/aspect,pp.y,clamp(z/4.,0.,1.)*2.-1.,1.);
   vWorld=wp;vNormal=normalize(wn);vObj=aPos;
 }`;
 const FS=`#version 300 es
 precision highp float;precision highp int;
 in vec3 vWorld,vNormal,vObj;out vec4 fragColor;
 uniform vec3 uBaseRaw,uMineralLow,uMineralHigh,uPatinaColor,uMicaTint,uGrainColor;
 uniform vec4 uLayerOn,uLayerStrength,uLayerScale,uLayerCover,uLayerSeed;
 uniform float uTone,uSpecularScale,uSurfaceRough,uSurfaceWet,uMicaDark,uMicaReflect,uMicro;
 uniform vec3 uKeyTint,uFillTint,uBackground;uniform vec2 uKeyAngles,uFillAngles;uniform float uKeyPower,uFillPower;uniform int uRigLook;
 int hash1i1i(int n){n=(n<<13)^n;return n*(n*n*15731+789221)+1376312589;}
 float hash3i1f(ivec3 p){int n=hash1i1i(p.x*3+p.y*113+p.z*311);return float(n & 0x0fffffff)/float(0x0fffffff);}
 float noise(vec3 x){ivec3 i=ivec3(floor(x));vec3 f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash3i1f(i+ivec3(0,0,0)),hash3i1f(i+ivec3(1,0,0)),f.x),mix(hash3i1f(i+ivec3(0,1,0)),hash3i1f(i+ivec3(1,1,0)),f.x),f.y),
             mix(mix(hash3i1f(i+ivec3(0,0,1)),hash3i1f(i+ivec3(1,0,1)),f.x),mix(hash3i1f(i+ivec3(0,1,1)),hash3i1f(i+ivec3(1,1,1)),f.x),f.y),f.z);}
 float fbm4(vec3 p){const mat3 m=mat3(0.,.80,.60,-.80,.36,-.48,-.60,-.48,.64);float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*(2.*noise(p)-1.);p=m*p*2.01;a*=.52;}return f;}
 float fbm3(vec3 p){const mat3 m=mat3(0.,.80,.60,-.80,.36,-.48,-.60,-.48,.64);float f=0.,a=.5;for(int i=0;i<3;i++){f+=a*(2.*noise(p)-1.);p=m*p*2.01;a*=.52;}return f;}
 vec3 layerOffset(float seed){return vec3(seed==0.?0.:seed*2.173,seed*.731,seed*1.217);}
 vec2 rr(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
 vec3 rlight(vec3 p,vec2 a){p.xz=rr(p.xz,a.x);p.yz=rr(p.yz,a.y);return p;}
 float microH(vec3 p){return .68*noise(p*18.)+.32*noise(p*36.+vec3(4.1,7.7,2.3));}
 vec3 microNormal(vec3 p,vec3 n){
   if(uMicro<=.001)return n;float e=.018,h=microH(p);
   vec3 g=vec3(microH(p+vec3(e,0,0))-h,microH(p+vec3(0,e,0))-h,microH(p+vec3(0,0,e))-h)/e;
   g-=n*dot(g,n);return normalize(n-.018*uMicro*g);
 }
 void main(){
   vec3 p=vObj;vec4 mask=vec4(0.);vec3 albedo=pow(clamp(uBaseRaw,0.,1.),vec3(3.,3.2,3.));
   if(uLayerOn.x>.5){float m=clamp(.5+.6*fbm4(p*uLayerScale.x+layerOffset(uLayerSeed.x))+(uLayerCover.x-.5),0.,1.);mask.x=m;albedo=mix(albedo,mix(uMineralLow,uMineralHigh,m),uLayerStrength.x);}
   if(uLayerOn.y>.5){float m=smoothstep(0.,.5,fbm4(p*uLayerScale.y+8.+layerOffset(uLayerSeed.y))+(uLayerCover.y-.5)*.8);mask.y=m*uLayerStrength.y;albedo=mix(albedo,uPatinaColor,mask.y);}
   if(uLayerOn.z>.5){float m=smoothstep(-.15,.15,fbm4(p*uLayerScale.z+layerOffset(uLayerSeed.z))-(.15+(.5-uLayerCover.z)*.7));mask.z=m*uLayerStrength.z;}
   if(uLayerOn.w>.5){float m=smoothstep(-.12,.12,fbm3(p*uLayerScale.w+layerOffset(uLayerSeed.w))+(uLayerCover.w-.5)*.8);mask.w=m*uLayerStrength.w;albedo=mix(albedo,uGrainColor,mask.w);}
   albedo*=uTone;float mica=mask.z;albedo*=1.-uMicaDark*mica;if(uSurfaceWet>0.)albedo*=mix(1.,.66,uSurfaceWet);albedo*=mix(vec3(1),uMicaTint,mica);
   vec3 n=microNormal(p,normalize(vNormal));
   vec3 po=vec3(0.,.3,1.5),v=normalize(po-vWorld);
   vec3 lp[2]=vec3[2](4.*normalize(vec3(1,.6,.1)),4.*normalize(vec3(-1,.3,-.3)));
   vec3 lc[2]=vec3[2](2.5*vec3(16,12,8),.7*vec3(8,12,18));
   if(uRigLook==1){lp[0]=4.*normalize(vec3(1,.8,-.3));lp[1]=4.*normalize(vec3(-1,.5,.45));lc[0]=.65*vec3(16,12,8);lc[1]=vec3(8,12,18);}
   lp[0]=rlight(lp[0],uKeyAngles);lp[1]=rlight(lp[1],uFillAngles);lc[0]*=uKeyTint*uKeyPower;lc[1]*=uFillTint*uFillPower;
   float studio=.72+.28*max(n.y,0.);vec3 col=.012*albedo*studio;float ks=.4+uMicaReflect*mica;
   for(int i=0;i<2;i++){vec3 l=normalize(lp[i]-vWorld);float dif=max(dot(n,l),0.);float spot=pow(max(dot(l,normalize(lp[i])),0.),12.)*5./dot(lp[i]-vWorld,lp[i]-vWorld);dif*=spot;col+=albedo*dif*lc[i];vec3 h=normalize(l+v);float power=64.*ks/max(.25,uSurfaceRough)*(1.+uSurfaceWet);float spe=pow(max(dot(n,h),0.),power);spe*=.04+.96*pow(1.-max(dot(h,v),0.),5.);col+=spe*dif*ks*uSpecularScale;}
   col=col*1.2/(1.+col);fragColor=vec4(pow(max(col,0.),vec3(.4545)),1.);
 }`;
 function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 const vao=gl.createVertexArray(),posB=gl.createBuffer(),norB=gl.createBuffer(),idxB=gl.createBuffer();gl.bindVertexArray(vao);
 for(const [loc,b] of [[0,posB],[1,norB]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxB);gl.bindVertexArray(null);
 const U={};for(const name of ['uRes','uPan','uYaw','uPitch','uTime','uZoom','uBaseRaw','uMineralLow','uMineralHigh','uPatinaColor','uMicaTint','uGrainColor','uLayerOn','uLayerStrength','uLayerScale','uLayerCover','uLayerSeed','uTone','uSpecularScale','uSurfaceRough','uSurfaceWet','uMicaDark','uMicaReflect','uMicro','uKeyTint','uFillTint','uBackground','uKeyAngles','uFillAngles','uKeyPower','uFillPower','uRigLook'])U[name]=gl.getUniformLocation(prog,name);
 let meshKey='',indexCount=0,objPositions=null,buildMs=0,motionScale=1;
 function h1(n){n=((n<<13)^n)|0;return (Math.imul(n,(Math.imul(Math.imul(n,n),15731)+789221)|0)+1376312589)|0}
 function h3(x,y,z){return (h1((x*3+y*113+z*311)|0)&0x0fffffff)/0x0fffffff}
 const mix=(a,b,t)=>a+(b-a)*t;
 function noise(p){const ix=Math.floor(p[0]),iy=Math.floor(p[1]),iz=Math.floor(p[2]);let fx=p[0]-ix,fy=p[1]-iy,fz=p[2]-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);const a=mix(h3(ix,iy,iz),h3(ix+1,iy,iz),fx),b=mix(h3(ix,iy+1,iz),h3(ix+1,iy+1,iz),fx),c=mix(h3(ix,iy,iz+1),h3(ix+1,iy,iz+1),fx),d=mix(h3(ix,iy+1,iz+1),h3(ix+1,iy+1,iz+1),fx);return mix(mix(a,b,fy),mix(c,d,fy),fz);}
 function mp(p){return [(-.8*p[1]-.6*p[2])*2.01,(.8*p[0]+.36*p[1]-.48*p[2])*2.01,(.6*p[0]-.48*p[1]+.64*p[2])*2.01]}
 function fbm(p,oct){let f=0,a=.5,q=p.slice();for(let i=0;i<oct;i++){f+=a*(2*noise(q)-1);q=mp(q);a*=.52;}return f}
 function microTail(p){let q=p.slice(),a=.5;for(let i=0;i<7;i++){q=mp(q);a*=.52;}let f=0;for(let i=0;i<3;i++){f+=a*(2*noise(q)-1);q=mp(q);a*=.52;}return f}
 function smax(a,b,k,m){if(k<=0||m===0)return Math.max(a,b);if(m===1){const w=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return mix(a,b,w)+k*w*(1-w)}return .5*(a+b+Math.sqrt((a-b)*(a-b)+k*k))}
 function sdf(q,s){let d=Math.hypot(q[0],q[1],q[2])-1;for(let i=1;i<29&&i<=s.planes;i++){const z=s.shapeSeed||0,rp=[1.4*Math.sin(i*63+2+z*.71),-1.5*Math.sin(i*103+2+z*1.13),1.3*Math.sin(i*4+2+z*.39)],len=Math.hypot(...rp),dp=(q[0]*rp[0]+q[1]*rp[1]+q[2]*rp[2]-s.cut)/len;d=smax(d,dp,s.k,s.method)}let p=[4*q[0],4*q[1],4*q[2]];if(s.noiseSeed){p[0]+=s.noiseSeed*.317;p[1]+=s.noiseSeed*.713;p[2]+=s.noiseSeed*.113}let dis=fbm(p,7);if(s.micro>0)dis+=s.micro*microTail(p);return d+.06*s.displacement*dis}
 function normal(q,s){const e=.0005,ds=[[1,-1,-1],[-1,-1,1],[-1,1,-1],[1,1,1]];let n=[0,0,0];for(const d of ds){const k=.5773,ee=[d[0]*k,d[1]*k,d[2]*k],v=sdf([q[0]+e*ee[0],q[1]+e*ee[1],q[2]+e*ee[2]],s);n[0]+=ee[0]*v;n[1]+=ee[1]*v;n[2]+=ee[2]*v}n=[n[0]/s.scale[0],n[1]/s.scale[1],n[2]/s.scale[2]];const l=Math.hypot(...n)||1;return n.map(x=>x/l)}
 function shapeKey(s){return JSON.stringify([s.k,s.method,s.displacement,s.planes,s.shapeSeed,s.noiseSeed,s.cut,s.scale,s.micro])}
 function ico(level=4){const t=(1+Math.sqrt(5))/2;let v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p=>{const l=Math.hypot(...p);return p.map(x=>x/l)});
  let f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let l=0;l<level;l++){const cache=new Map(),nf=[];const mid=(a,b)=>{const key=a<b?a+','+b:b+','+a;if(cache.has(key))return cache.get(key);const p=[(v[a][0]+v[b][0])*.5,(v[a][1]+v[b][1])*.5,(v[a][2]+v[b][2])*.5],ll=Math.hypot(...p);p[0]/=ll;p[1]/=ll;p[2]/=ll;const id=v.length;v.push(p);cache.set(key,id);return id};for(const x of f){const[a,b,c]=x,ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca])}f=nf}return {v,f};}
 function buildMesh(s){const t0=performance.now(),g=ico(4),pos=new Float32Array(g.v.length*3),nor=new Float32Array(g.v.length*3),obj=new Float32Array(g.v.length*3);let o=0;for(const dir of g.v){let lo=0,hi=1.35;while(sdf([dir[0]*hi,dir[1]*hi,dir[2]*hi],s)<0&&hi<2)hi*=1.15;for(let k=0;k<13;k++){const m=(lo+hi)*.5;if(sdf([dir[0]*m,dir[1]*m,dir[2]*m],s)>0)hi=m;else lo=m}const r=(lo+hi)*.5,q=[dir[0]*r,dir[1]*r,dir[2]*r],nn=normal(q,s);obj.set(q,o);pos.set([q[0]*s.scale[0],q[1]*s.scale[1],q[2]*s.scale[2]],o);nor.set(nn,o);o+=3}
  const idx=new Uint16Array(g.f.length*3);o=0;for(const x of g.f){idx[o++]=x[0];idx[o++]=x[1];idx[o++]=x[2]}gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,posB);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,norB);gl.bufferData(gl.ARRAY_BUFFER,nor,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxB);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);gl.bindVertexArray(null);objPositions=obj;indexCount=idx.length;buildMs=performance.now()-t0;}
 function ensure(s){const k=shapeKey(s);if(k!==meshKey){buildMesh(s);meshKey=k}}
 function u3(l,v){gl.uniform3fv(l,v)}function u4(l,v){gl.uniform4fv(l,v)}
 function draw(s,inspect,rig){ensure(s);const box=canvas.getBoundingClientRect(),mobile=innerWidth<=600,dpr=mobile?1.25:Math.min(devicePixelRatio||1,1.3),cap=mobile?600:960,base=Math.max(260,Math.min(cap,Math.round(box.width*dpr))),w=Math.max(260,Math.round(base*motionScale)),h=Math.round(w*9/16);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.055,.061,.07,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);gl.bindVertexArray(vao);
  gl.uniform2f(U.uRes,w,h);gl.uniform2fv(U.uPan,inspect.pan);gl.uniform1f(U.uYaw,s.yaw);gl.uniform1f(U.uPitch,s.pitch);gl.uniform1f(U.uTime,s.time);gl.uniform1f(U.uZoom,inspect.zoom);
  for(const [k,v] of [['uBaseRaw',s.base],['uMineralLow',s.low],['uMineralHigh',s.high],['uPatinaColor',s.patina],['uMicaTint',s.mica],['uGrainColor',s.grain],['uKeyTint',rig.keyTint],['uFillTint',rig.fillTint]])u3(U[k],v);
  u4(U.uLayerOn,s.layers.map(x=>x.on?1:0));u4(U.uLayerStrength,s.layers.map(x=>x.strength));u4(U.uLayerScale,s.layers.map(x=>x.scale));u4(U.uLayerCover,s.layers.map(x=>x.cover));u4(U.uLayerSeed,s.layers.map(x=>x.seed));
  gl.uniform1f(U.uTone,s.tone);gl.uniform1f(U.uSpecularScale,s.specular);gl.uniform1f(U.uSurfaceRough,s.surfaceRough);gl.uniform1f(U.uSurfaceWet,s.surfaceWet);gl.uniform1f(U.uMicaDark,s.micaDark);gl.uniform1f(U.uMicaReflect,s.micaReflect);gl.uniform1f(U.uMicro,s.micro);
  gl.uniform2fv(U.uKeyAngles,rig.keyAngles);gl.uniform2fv(U.uFillAngles,rig.fillAngles);gl.uniform1f(U.uKeyPower,rig.keyPower);gl.uniform1f(U.uFillPower,rig.fillPower);gl.uniform1i(U.uRigLook,rig.look||0);
  gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);}
 return {prepare:s=>ensure(s),setScale:v=>{motionScale=Math.max(.42,Math.min(1,v))},getScale:()=>motionScale,draw,glError:()=>gl.getError(),stats:()=>({triangles:indexCount/3,vertices:objPositions?objPositions.length/3:0,buildMs,width:canvas.width,height:canvas.height,motionScale})};
};