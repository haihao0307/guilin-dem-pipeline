// Original analytic function renderer. The only triangle is a screen carrier.
// No road/object triangles, vertex meshes, point clouds, textures or external libraries.
const V=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const F=`#version 300 es
precision highp float;
out vec4 frag;uniform vec2 res;uniform vec3 eye;uniform vec3 target;uniform vec4 dim;uniform int phase;uniform int mode;uniform int pick;uniform int selected;uniform float bend;
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float wave(vec2 p){return .45*sin(p.x*91.+sin(p.y*33.))+.3*sin(p.y*173.+p.x*67.)+.25*sin(p.x*307.-p.y*221.);}
float roadY(float x){return .24-.025*abs(x);}
vec3 local(vec3 p){p.x-=bend*(p.z*p.z/324.-.33);return p;}
float damage(vec2 p){vec2 q=(p-vec2(-dim.x*dim.y*.25,2.))/vec2(.85,1.3);return phase==1?.16*exp(-dot(q,q)*2.):0.;}
vec2 hitmin(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 scene(vec3 world){vec3 p=local(world);float w=dim.x*dim.y*.5;float s=dim.z;float c=dim.w;float ry=roadY(p.x)-damage(p.xz)+.00025*wave(p.xz);vec2 h=vec2(box(p-vec3(0.,ry-.16,0.),vec3(w,.16,18.)),1.);
float sy=roadY(w)+.14;
h=hitmin(h,vec2(box(p-vec3(-w-.2-s*.5,sy-.12,0.),vec3(s*.5,.12,18.))-.0002*wave(p.xz),2.));
h=hitmin(h,vec2(box(p-vec3(w+.45+c+.2+s*.5,sy-.12,0.),vec3(s*.5,.12,18.))-.0002*wave(p.xz),2.));
h=hitmin(h,vec2(box(p-vec3(w+.35+c*.5,roadY(w)-.03,0.),vec3(c*.5,.12,18.))-.0002*wave(p.xz),3.));
h=hitmin(h,vec2(box(vec3(abs(p.x)-w-.1,p.y-sy+.1,p.z),vec3(.1,.1,18.)),4.));
h=hitmin(h,vec2(box(p-vec3(w+.45+c+.1,sy-.1,0.),vec3(.1,.1,18.)),4.));
// Spatial repetition evaluates only the nearest lamp cell, never an object loop.
float z=clamp(round(p.z/12.),-1.,1.)*12.;vec3 l=p-vec3(-w-.25-s*.75,sy,z);float pole=max(length(l.xz)-.052,abs(l.y-2.6)-2.6);h=hitmin(h,vec2(pole,6.));
h=hitmin(h,vec2(box(l-vec3(.6,5.15,0.),vec3(.65,.055,.055)),6.));h=hitmin(h,vec2(box(l-vec3(1.15,5.08,0.),vec3(.29,.055,.13)),6.));
if(phase==2){vec3 q=p-vec3(-w+dim.y*.5,roadY(-w+dim.y*.5),3.);float trench=box(q-vec3(0.,-.025,0.),vec3(dim.y*.38,.035,4.));h=hitmin(h,vec2(trench,8.));float zz=clamp(round(q.z/2.),-2.,2.)*2.;vec3 co=q-vec3(dim.y*.42,.34,zz);float cone=max(length(co.xz)-(.21-.20*clamp(co.y+.34,0.,.68)/.68),abs(co.y)-.34);h=hitmin(h,vec2(cone,7.));h=hitmin(h,vec2(box(co-vec3(0.,-.32,0.),vec3(.25,.035,.25)),7.));}
return vec2(h.x*.72,h.y);}
vec3 normalAt(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(scene(p+e.xyy).x-scene(p-e.xyy).x,scene(p+e.yxy).x-scene(p-e.yxy).x,scene(p+e.yyx).x-scene(p-e.yyx).x));}
vec3 palette(float id){if(id<1.5)return vec3(.27,.46,.62);if(id<2.5)return vec3(.82,.61,.36);if(id<3.5)return vec3(.32,.61,.52);if(id<4.5)return vec3(.70,.72,.74);if(id<5.5)return vec3(.98,.92,.62);if(id<6.5)return vec3(.37,.41,.48);if(id<7.5)return vec3(.91,.40,.21);if(id<8.5)return vec3(.47,.31,.25);return vec3(.25);}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/res.y;vec3 f=normalize(target-eye),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);vec3 rd=normalize(f*1.7+r*uv.x+u*uv.y);float t=0.;vec2 h=vec2(1,0);bool ok=false;for(int i=0;i<130;i++){vec3 p=eye+rd*t;h=scene(p);if(h.x<.0025){ok=true;break;}t+=max(h.x,.002);if(t>150.)break;}vec3 color=vec3(.87,.88,.88);float id=0.;if(ok){vec3 p=eye+rd*t;vec3 q=local(p);id=h.y;vec3 n=normalAt(p);float w=dim.x*dim.y*.5;float m=wave(q.xz);vec3 base=vec3(.25,.265,.27);if(id==1.){base+=m*.018;float lane=abs(mod(q.x+w,dim.y));bool lines=min(lane,dim.y-lane)<.06&&abs(q.x)<w-.2;bool dash=mod(q.z+18.,5.)<2.7;if(lines&&dash){base=vec3(.88,.88,.81);id=5.;}if(abs(q.x)>w-.30&&abs(q.x)<w-.18){base=vec3(.83,.66,.25);id=5.;}if(phase==1&&damage(q.xz)>.022){base=mix(vec3(.17,.14,.12),base,clamp(damage(q.xz)*2.,0.,1.));}if(abs(q.x)>w-.13){base=vec3(.15,.17,.17);if(mod(q.z+18.,3.)<.8&&mod(q.z*15.,1.)<.4)base*=.3;id=9.;}}
if(id==2.){vec2 tile=abs(fract(q.xz/vec2(.4,.6))-.5);float seam=smoothstep(.47,.49,max(tile.x,tile.y));base=mix(vec3(.64,.60,.53)+m*.015,vec3(.37,.36,.33),seam);}
if(id==3.){base=vec3(.30,.38,.33)+m*.012;float cx=w+.35+dim.w*.5;if(abs(q.x-cx)<.045&&mod(q.z+18.,4.)<2.){base=vec3(.82);id=5.;}}
if(id==4.){base=vec3(.67,.66,.61)+m*.015;if(fract(q.z)<.025)base*=.75;}
if(id==6.)base=vec3(.39,.42,.44)+.008*wave(q.yz);
if(id==7.){base=mod(q.y*5.,2.)>.9?vec3(.84,.83,.77):vec3(.85,.31,.12);}
if(id==8.)base=vec3(.29,.23,.18)+m*.025;
if(mode==1)base=palette(id);float lit=.48+.52*max(dot(n,normalize(vec3(-.6,1.,.4))),0.);float ao=clamp(scene(p+n*.17).x/.12,.55,1.);color=base*lit*ao;float spec=pow(max(dot(reflect(-normalize(vec3(-.6,1.,.4)),n),-rd),0.),32.);color+=spec*(id==6.?.24:.025);if(int(id)==selected)color*=1.055;color=mix(color,vec3(.87,.88,.88),1.-exp(-t*.0015));}
else if(rd.y<-.001){float g=(-.28-eye.y)/rd.y;vec3 p=eye+rd*g;float grid=1.-smoothstep(.015,.04,min(abs(fract(p.x*.2)-.5),abs(fract(p.z*.2)-.5)));color-=.024*grid;float d=length(vec2(max(abs(local(p).x)-dim.x*dim.y*.5-dim.z-2.,0.),max(abs(p.z)-18.,0.)));color*=.91+.09*smoothstep(0.,3.,d);}
if(pick==1){frag=vec4(id/255.,0.,0.,1.);return;}frag=vec4(pow(color,vec3(.92)),1.);}`;
export function createRenderer(canvas,{onPick=()=>{}}={}){
 const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('此浏览器没有可用的 WebGL2，请在支持 WebGL2 的浏览器打开。');
 function shader(type,s){const q=gl.createShader(type);gl.shaderSource(q,s);gl.compileShader(q);if(!gl.getShaderParameter(q,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(q));return q;}
 const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,V));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,F));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
 const U=Object.fromEntries(['res','eye','target','dim','phase','mode','pick','selected','bend'].map(k=>[k,gl.getUniformLocation(prog,k)]));let params={lanes:2,laneWidth:3.65,sidewalkWidth:2.4,cycleWidth:2.5,state:0,mode:'material',preset:'urban'};

 let yaw=.70,pitch=.66,distance=44,frames=0,lastMs=0,selected=0,raf=0;const pointers=new Map();let moved=0,initial=null,pinch=0;
 function draw(picking=false){raf=0;const start=performance.now();gl.useProgram(prog);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(U.res,canvas.width,canvas.height);gl.uniform3f(U.eye,Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);gl.uniform3f(U.target,0,0,0);gl.uniform4f(U.dim,params.lanes,params.laneWidth,params.sidewalkWidth,params.cycleWidth);gl.uniform1i(U.phase,params.state);gl.uniform1i(U.mode,params.mode==='color'?1:0);gl.uniform1i(U.pick,picking?1:0);gl.uniform1i(U.selected,selected);gl.uniform1f(U.bend,params.preset==='gentle'?1.8:0);gl.drawArrays(gl.TRIANGLES,0,3);frames++;lastMs=performance.now()-start;}
 function invalidate(){if(!raf)raf=requestAnimationFrame(()=>draw());}
 function resize(){const b=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(b.width*dpr));canvas.height=Math.max(1,Math.round(b.height*dpr));invalidate();}
 function selectAt(x,y){draw(true);const b=canvas.getBoundingClientRect(),pixel=new Uint8Array(4);gl.readPixels(Math.round((x-b.left)*canvas.width/b.width),Math.round((b.bottom-y)*canvas.height/b.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);selected=pixel[0];draw();if(selected)onPick(selected);}
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);initial=[e.clientX,e.clientY];moved=0;if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);moved+=Math.abs(e.clientX-old[0])+Math.abs(e.clientY-old[1]);if(pointers.size===2){const a=[...pointers.values()],n=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);distance=Math.max(13,Math.min(85,distance*pinch/Math.max(n,1)));pinch=n;}else{yaw-=(e.clientX-old[0])*.008;pitch=Math.max(.16,Math.min(1.5,pitch+(e.clientY-old[1])*.006));}invalidate();});
 canvas.addEventListener('pointerup',e=>{if(pointers.size===1&&moved<5)selectAt(e.clientX,e.clientY);pointers.delete(e.pointerId);});canvas.addEventListener('pointercancel',e=>pointers.delete(e.pointerId));canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(13,Math.min(85,distance*Math.exp(e.deltaY*.001)));invalidate();},{passive:false});
 new ResizeObserver(resize).observe(canvas);resize();
 return {setParameters(p){const changed=['lanes','laneWidth','sidewalkWidth','cycleWidth'].some(k=>p[k]!==undefined&&p[k]!==params[k]);Object.assign(params,p);if(changed){const total=params.lanes*params.laneWidth+params.sidewalkWidth*2+params.cycleWidth+1;distance=Math.max(distance,canvas.clientWidth<600?64+Math.max(0,total-16)*2.3:62+Math.max(0,total-16)*.9);}invalidate();},setSelected(id){selected=id;invalidate();},resize,resetView(){yaw=canvas.clientWidth<600?.30:.70;pitch=.66;distance=canvas.clientWidth<600?64:62;invalidate();},setView(v){yaw=v==='section'?1.57:.0;pitch=v==='plan'?1.49:v==='section'?.23:.66;distance=v==='section'?33:46;invalidate();},getDiagnostics(){return {ready:true,frames,lastSubmissionMs:lastMs,width:canvas.width,height:canvas.height,glError:gl.getError(),objectTriangles:0,screenCarrierTriangles:1,geometry:'analytic function fields',waveRequired:true,parameters:{...params},camera:{yaw,pitch,distance}};},getObjectBounds(){draw(true);const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(p[(y*canvas.width+x)*4]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}draw();return {minX,minY,maxX,maxY};},readPixels(){draw();const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}};
}
