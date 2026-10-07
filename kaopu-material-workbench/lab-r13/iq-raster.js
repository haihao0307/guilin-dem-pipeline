/* KAOPU IQ interactive rasterizer R13
   Heavy implicit/SDF evaluation is baked to one persistent mesh when SHAPE parameters change.
   Camera rotation/zoom then uses normal rasterization. No textures, no external models. */
'use strict';
window.createIQRasterRuntime=function(canvas){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
 if(!gl)throw Error('IQ raster path: WebGL2 unavailable');
 const VS=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 aPos;
 layout(location=1) in vec3 aNormal;
 layout(location=2) in vec4 aRaw;
 uniform vec2 uRes,uPan;
 uniform float uYaw,uPitch,uTime,uZoom;
 out vec3 vWorld,vNormal,vObj;
 out vec4 vRaw;
 vec2 rr(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
 void main(){
   float an=.04*uTime-3.2;
   vec3 wp=aPos;wp.xz=rr(wp.xz,-an);
   vec3 wn=aNormal;wn.xz=rr(wn.xz,-an);
   vec3 po=vec3(0.,.3,1.5);po.yz=rr(po.yz,uPitch);po.xz=rr(po.xz,uYaw);
   vec3 ww=normalize(-po),uu=normalize(cross(ww,vec3(0,1,0))),vv=normalize(cross(uu,ww));
   vec3 d=wp-po;float z=max(.02,dot(d,ww));
   vec2 pp=1.7*vec2(dot(d,uu),dot(d,vv))/z;
   pp=uZoom*(pp-2.*uPan);
   float aspect=uRes.x/uRes.y;
   gl_Position=vec4(pp.x/aspect,pp.y,clamp(z/4.,0.,1.)*2.-1.,1.);
   vWorld=wp;vNormal=normalize(wn);vObj=aPos;vRaw=aRaw;
 }`;
 const FS=`#version 300 es
 precision highp float;
 in vec3 vWorld,vNormal,vObj;in vec4 vRaw;out vec4 fragColor;
 uniform vec3 uBaseRaw,uMineralLow,uMineralHigh,uPatinaColor,uMicaTint,uGrainColor;
 uniform vec4 uLayerOn,uLayerStrength,uLayerCover;
 uniform float uTone,uSpecularScale,uSurfaceRough,uSurfaceWet,uMicaDark,uMicaReflect;
 uniform vec3 uKeyTint,uFillTint;uniform vec2 uKeyAngles,uFillAngles;uniform float uKeyPower,uFillPower;uniform int uRigLook;
 vec2 rr(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
 vec3 rlight(vec3 p,vec2 a){p.xz=rr(p.xz,a.x);p.yz=rr(p.yz,a.y);return p;}
 void main(){
   vec4 mask=vec4(0.);
   vec3 albedo=pow(clamp(uBaseRaw,0.,1.),vec3(3.,3.2,3.));
   if(uLayerOn.x>.5){float m=clamp(.5+.6*vRaw.x+(uLayerCover.x-.5),0.,1.);mask.x=m;albedo=mix(albedo,mix(uMineralLow,uMineralHigh,m),uLayerStrength.x);}
   if(uLayerOn.y>.5){float m=smoothstep(0.,.5,vRaw.y+(uLayerCover.y-.5)*.8);mask.y=m*uLayerStrength.y;albedo=mix(albedo,uPatinaColor,mask.y);}
   if(uLayerOn.z>.5){float m=smoothstep(-.15,.15,vRaw.z-(.15+(.5-uLayerCover.z)*.7));mask.z=m*uLayerStrength.z;}
   if(uLayerOn.w>.5){float m=smoothstep(-.12,.12,vRaw.w+(uLayerCover.w-.5)*.8);mask.w=m*uLayerStrength.w;albedo=mix(albedo,uGrainColor,mask.w);}
   albedo*=uTone;float mica=mask.z;albedo*=1.-uMicaDark*mica;if(uSurfaceWet>0.)albedo*=mix(1.,.66,uSurfaceWet);albedo*=mix(vec3(1),uMicaTint,mica);
   vec3 n=normalize(vNormal);vec3 po=vec3(0.,.3,1.5);vec3 v=normalize(po-vWorld);
   vec3 lp[2]=vec3[2](4.*normalize(vec3(1,.6,.1)),4.*normalize(vec3(-1,.3,-.3)));
   vec3 lc[2]=vec3[2](2.5*vec3(16,12,8),.7*vec3(8,12,18));
   if(uRigLook==1){lp[0]=4.*normalize(vec3(1,.8,-.3));lp[1]=4.*normalize(vec3(-1,.5,.45));lc[0]=.65*vec3(16,12,8);lc[1]=vec3(8,12,18);}
   lp[0]=rlight(lp[0],uKeyAngles);lp[1]=rlight(lp[1],uFillAngles);lc[0]*=uKeyTint*uKeyPower;lc[1]*=uFillTint*uFillPower;
   vec3 col=.012*albedo*(.7+.3*n.y);float ks=.4+uMicaReflect*mica;
   for(int i=0;i<2;i++){vec3 l=normalize(lp[i]-vWorld);float dif=max(dot(n,l),0.);float spot=pow(max(dot(l,normalize(lp[i])),0.),12.)*5./dot(lp[i]-vWorld,lp[i]-vWorld);dif*=spot;
      col+=albedo*dif*lc[i];
      vec3 h=normalize(l+v);float power=64.*ks/max(.25,uSurfaceRough)*(1.+uSurfaceWet);float spe=pow(max(dot(n,h),0.),power);spe*=.04+.96*pow(1.-max(dot(h,v),0.),5.);col+=spe*dif*ks*uSpecularScale;
   }
   col=col*1.2/(1.+col);fragColor=vec4(pow(max(col,0.),vec3(.4545)),1.);
 }`;
 function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 const vao=gl.createVertexArray(),posB=gl.createBuffer(),norB=gl.createBuffer(),rawB=gl.createBuffer(),idxB=gl.createBuffer();gl.bindVertexArray(vao);
 for(const [loc,b,size] of [[0,posB,3],[1,norB,3],[2,rawB,4]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxB);gl.bindVertexArray(null);
 const U={};for(const name of ['uRes','uPan','uYaw','uPitch','uTime','uZoom','uBaseRaw','uMineralLow','uMineralHigh','uPatinaColor','uMicaTint','uGrainColor','uLayerOn','uLayerStrength','uLayerCover','uTone','uSpecularScale','uSurfaceRough','uSurfaceWet','uMicaDark','uMicaReflect','uKeyTint','uFillTint','uKeyAngles','uFillAngles','uKeyPower','uFillPower','uRigLook'])U[name]=gl.getUniformLocation(prog,name);
 let meshKey='',rawKey='',indexCount=0,objPositions=null,rawData=null,buildMs=0,motionScale=1;
 function h1(n){n=((n<<13)^n)|0;return (Math.imul(n,(Math.imul(Math.imul(n,n),15731)+789221)|0)+1376312589)|0}
 function h3(x,y,z){return (h1((x*3+y*113+z*311)|0)&0x0fffffff)/0x0fffffff}
 const mix=(a,b,t)=>a+(b-a)*t;
 function noise(p){const ix=Math.floor(p[0]),iy=Math.floor(p[1]),iz=Math.floor(p[2]);let fx=p[0]-ix,fy=p[1]-iy,fz=p[2]-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
   const a=mix(h3(ix,iy,iz),h3(ix+1,iy,iz),fx),b=mix(h3(ix,iy+1,iz),h3(ix+1,iy+1,iz),fx),c=mix(h3(ix,iy,iz+1),h3(ix+1,iy,iz+1),fx),d=mix(h3(ix,iy+1,iz+1),h3(ix+1,iy+1,iz+1),fx);return mix(mix(a,b,fy),mix(c,d,fy),fz);}
 function mp(p){return [(-.8*p[1]-.6*p[2])*2.01,(.8*p[0]+.36*p[1]-.48*p[2])*2.01,(.6*p[0]-.48*p[1]+.64*p[2])*2.01]}
 function fbm(p,oct){let f=0,a=.5,q=p.slice();for(let i=0;i<oct;i++){f+=a*(2*noise(q)-1);q=mp(q);a*=.52;}return f}
 function microTail(p){let q=p.slice(),a=.5;for(let i=0;i<7;i++){q=mp(q);a*=.52;}let f=0;for(let i=0;i<3;i++){f+=a*(2*noise(q)-1);q=mp(q);a*=.52;}return f}
 function smax(a,b,k,method){if(k<=0||method===0)return Math.max(a,b);if(method===1){const w=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return mix(a,b,w)+k*w*(1-w);}return .5*(a+b+Math.sqrt((a-b)*(a-b)+k*k))}
 function offset(seed){return [seed===0?0:seed*2.173,seed*.731,seed*1.217]}
 function sdf(q,s){let d=Math.hypot(q[0],q[1],q[2])-1;for(let i=1;i<29&&i<=s.planes;i++){const z=s.shapeSeed||0;const rp=[1.4*Math.sin(i*63+2+z*.71),-1.5*Math.sin(i*103+2+z*1.13),1.3*Math.sin(i*4+2+z*.39)];const len=Math.hypot(...rp);const dp=(q[0]*rp[0]+q[1]*rp[1]+q[2]*rp[2]-s.cut)/len;d=smax(d,dp,s.k,s.method)}
   let p=[4*q[0],4*q[1],4*q[2]];if(s.noiseSeed){p[0]+=s.noiseSeed*.317;p[1]+=s.noiseSeed*.713;p[2]+=s.noiseSeed*.113}let dis=fbm(p,7);if(s.micro>0)dis+=s.micro*microTail(p);return d+.06*s.displacement*dis}
 function normal(q,s){const e=.00045,dirs=[[1,-1,-1],[-1,-1,1],[-1,1,-1],[1,1,1]];let n=[0,0,0];for(const d of dirs){const k=.5773;const ee=[d[0]*k,d[1]*k,d[2]*k],v=sdf([q[0]+e*ee[0],q[1]+e*ee[1],q[2]+e*ee[2]],s);n[0]+=ee[0]*v;n[1]+=ee[1]*v;n[2]+=ee[2]*v}n=[n[0]/s.scale[0],n[1]/s.scale[1],n[2]/s.scale[2]];const l=Math.hypot(...n)||1;return n.map(x=>x/l)}
 function shapeKey(s){return JSON.stringify([s.k,s.method,s.displacement,s.planes,s.shapeSeed,s.noiseSeed,s.cut,s.scale,s.micro])}
 function materialKey(s){return JSON.stringify(s.layers.map(x=>[x.scale,x.seed]))}
 function buildMesh(s){const t=performance.now(),LAT=80,LON=160,N=(LAT+1)*(LON+1),pos=new Float32Array(N*3),nor=new Float32Array(N*3),obj=new Float32Array(N*3);let o=0;
   for(let j=0;j<=LAT;j++){const th=Math.PI*j/LAT,yy=Math.cos(th),rr=Math.sin(th);for(let i=0;i<=LON;i++){const ph=2*Math.PI*i/LON,dir=[rr*Math.cos(ph),yy,rr*Math.sin(ph)];let lo=0,hi=1.35;while(sdf([dir[0]*hi,dir[1]*hi,dir[2]*hi],s)<0&&hi<2)hi*=1.15;for(let k=0;k<14;k++){const m=(lo+hi)*.5;if(sdf([dir[0]*m,dir[1]*m,dir[2]*m],s)>0)hi=m;else lo=m}const r=(lo+hi)*.5,q=[dir[0]*r,dir[1]*r,dir[2]*r],nn=normal(q,s);obj.set(q,o);pos.set([q[0]*s.scale[0],q[1]*s.scale[1],q[2]*s.scale[2]],o);nor.set(nn,o);o+=3;}}
   const idx=new Uint16Array(LAT*LON*6);let k=0;for(let j=0;j<LAT;j++)for(let i=0;i<LON;i++){const a=j*(LON+1)+i,b=a+1,c=a+LON+1,d=c+1;idx[k++]=a;idx[k++]=c;idx[k++]=b;idx[k++]=b;idx[k++]=c;idx[k++]=d}
   gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,posB);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,norB);gl.bufferData(gl.ARRAY_BUFFER,nor,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxB);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);gl.bindVertexArray(null);objPositions=obj;indexCount=idx.length;rawKey='';buildMs=performance.now()-t;}
 function buildRaw(s){const key=materialKey(s);if(key===rawKey&&rawData)return;const n=objPositions.length/3,raw=new Float32Array(n*4);for(let i=0;i<n;i++){const p=[objPositions[i*3],objPositions[i*3+1],objPositions[i*3+2]];for(let l=0;l<4;l++){const z=s.layers[l],off=offset(z.seed),base=l===1?8:0,q=[p[0]*z.scale+base+off[0],p[1]*z.scale+base+off[1],p[2]*z.scale+base+off[2]];raw[i*4+l]=fbm(q,l===3?3:4)}}gl.bindBuffer(gl.ARRAY_BUFFER,rawB);gl.bufferData(gl.ARRAY_BUFFER,raw,gl.STATIC_DRAW);rawData=raw;rawKey=key}
 function ensure(s){const key=shapeKey(s);if(key!==meshKey){buildMesh(s);meshKey=key;}buildRaw(s)}
 function uni3(loc,v){gl.uniform3fv(loc,v)}function uni4(loc,v){gl.uniform4fv(loc,v)}
 function draw(s,inspect,rig){ensure(s);const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.25),baseW=Math.max(240,Math.min(720,Math.round(box.width*dpr))),w=Math.max(240,Math.round(baseW*motionScale)),h=Math.round(w*9/16);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(prog);gl.bindVertexArray(vao);
   gl.uniform2f(U.uRes,w,h);gl.uniform2fv(U.uPan,inspect.pan);gl.uniform1f(U.uYaw,s.yaw);gl.uniform1f(U.uPitch,s.pitch);gl.uniform1f(U.uTime,s.time);gl.uniform1f(U.uZoom,inspect.zoom);
   for(const [k,v] of [['uBaseRaw',s.base],['uMineralLow',s.low],['uMineralHigh',s.high],['uPatinaColor',s.patina],['uMicaTint',s.mica],['uGrainColor',s.grain],['uKeyTint',rig.keyTint],['uFillTint',rig.fillTint]])uni3(U[k],v);
   uni4(U.uLayerOn,s.layers.map(x=>x.on?1:0));uni4(U.uLayerStrength,s.layers.map(x=>x.strength));uni4(U.uLayerCover,s.layers.map(x=>x.cover));
   gl.uniform1f(U.uTone,s.tone);gl.uniform1f(U.uSpecularScale,s.specular);gl.uniform1f(U.uSurfaceRough,s.surfaceRough);gl.uniform1f(U.uSurfaceWet,s.surfaceWet);gl.uniform1f(U.uMicaDark,s.micaDark);gl.uniform1f(U.uMicaReflect,s.micaReflect);
   gl.uniform2fv(U.uKeyAngles,rig.keyAngles);gl.uniform2fv(U.uFillAngles,rig.fillAngles);gl.uniform1f(U.uKeyPower,rig.keyPower);gl.uniform1f(U.uFillPower,rig.fillPower);gl.uniform1i(U.uRigLook,rig.look||0);
   gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);}
 return {prepare:s=>ensure(s),setScale:v=>{motionScale=Math.max(.38,Math.min(1,v));},getScale:()=>motionScale,draw,pixels(){const b=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b},glError:()=>gl.getError(),bench(s,inspect,rig,loops=5){ensure(s);draw(s,inspect,rig);gl.finish();const t=performance.now();for(let i=0;i<loops;i++){draw(s,inspect,rig);gl.finish();}const ms=(performance.now()-t)/loops;return {avgMs:ms,fps:1000/ms,loops,width:canvas.width,height:canvas.height};},stats:()=>({triangles:indexCount/3,vertices:objPositions?objPositions.length/3:0,buildMs,width:canvas.width,height:canvas.height,motionScale})};
};