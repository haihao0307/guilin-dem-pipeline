const canvas=document.getElementById('terrain');
const fallback=document.getElementById('fallback');
const statusEl=document.getElementById('status');
const ASSET_BASE='../kunming-clean-3d-v001/assets/';

function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`无法载入 ${src}`));img.src=src;});}
async function loadBuffer(src){const r=await fetch(src,{cache:'no-store'});if(!r.ok)throw new Error(`${src} HTTP ${r.status}`);if(src.endsWith('.gz')){if(!('DecompressionStream' in window))throw new Error('浏览器缺少 gzip 解压能力');const stream=r.body.pipeThrough(new DecompressionStream('gzip'));return new Response(stream).arrayBuffer();}return r.arrayBuffer();}
function startFallback(message){canvas.hidden=true;fallback.hidden=false;statusEl.textContent=`${message} · 已切换二维纯净地形预览`;}

const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl){startFallback('浏览器没有提供 WebGL2');}
else{
  try{await start3D(gl);}catch(error){console.error(error);startFallback(`三维载入失败：${error.message}`);}
}

async function start3D(gl){
  statusEl.textContent='小坤正在读取真实 OSM 河道、湖泊和水库…';
  const [manifest,heightImage,surfaceImage,riversRaw,areasRaw,ohmRaw]=await Promise.all([
    fetch('data/manifest.json?v=1',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`manifest HTTP ${r.status}`);return r.json();}),
    loadImage(ASSET_BASE+'height_rg16.png'),
    loadImage(ASSET_BASE+'surface.png'),
    loadBuffer('data/rivers.f32.gz?v=1'),
    loadBuffer('data/water_areas.f32.gz?v=1'),
    loadBuffer('data/ohm_candidates.f32.gz?v=1')
  ]);

  const truth=manifest.authoritativeDem;
  const worldWidth=truth.widthMeters,worldDepth=truth.heightMeters;
  const minElevation=truth.elevation.min,maxElevation=truth.elevation.max,meanElevation=truth.elevation.mean,elevationSpan=maxElevation-minElevation;
  const desktop=(navigator.deviceMemory||8)>=8&&innerWidth>=1000;
  const [meshCols,meshRows]=desktop?manifest.browserTerrain.meshDesktop:manifest.browserTerrain.meshCompatibility;

  document.getElementById('countWays').textContent=manifest.osmCurrent.sourceCounts.waterways.toLocaleString('zh-CN');
  document.getElementById('countAreas').textContent=manifest.osmCurrent.sourceCounts.water_areas.toLocaleString('zh-CN');
  document.getElementById('countNodes').textContent=manifest.osmCurrent.sourceCounts.water_nodes.toLocaleString('zh-CN');
  document.getElementById('countRelations').textContent=manifest.osmCurrent.sourceCounts.waterway_relations.toLocaleString('zh-CN');
  document.getElementById('sourceTime').textContent=`抓取时间 ${new Date(manifest.osmCurrent.retrievedAtUtc).toLocaleString('zh-CN')}。页面内 ${manifest.osmCurrent.webClippedWaterwayFeatures.toLocaleString('zh-CN')} 条水路线和 ${manifest.osmCurrent.webWaterAreaFeatures.toLocaleString('zh-CN')} 个水体面与当前 DEM 裁切相交。`;

  const hc=document.createElement('canvas');hc.width=heightImage.width;hc.height=heightImage.height;
  const hctx=hc.getContext('2d',{willReadFrequently:true});hctx.drawImage(heightImage,0,0);
  const hp=hctx.getImageData(0,0,hc.width,hc.height).data;
  function decodePixel(ix,iy){const x=Math.max(0,Math.min(hc.width-1,ix)),y=Math.max(0,Math.min(hc.height-1,iy)),i=(y*hc.width+x)*4;return((hp[i]<<8)|hp[i+1])/65535;}
  function sampleHeight(u,v){const x=Math.max(0,Math.min(hc.width-1,u*(hc.width-1))),y=Math.max(0,Math.min(hc.height-1,v*(hc.height-1))),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(hc.width-1,x0+1),y1=Math.min(hc.height-1,y0+1),tx=x-x0,ty=y-y0,a=decodePixel(x0,y0),b=decodePixel(x1,y0),c=decodePixel(x0,y1),d=decodePixel(x1,y1);return a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty;}
  function groundY(x,z){const u=Math.max(0,Math.min(1,x/worldWidth+.5)),v=Math.max(0,Math.min(1,.5-z/worldDepth));return minElevation+sampleHeight(u,v)*elevationSpan-meanElevation;}

  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'shader compile');return shader;}
  function makeProgram(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link');return p;}
  function imageTexture(image,unit){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);return t;}
  const U=(p,n)=>gl.getUniformLocation(p,n);

  const terrainVS=`#version 300 es
precision highp float;
layout(location=0)in vec2 aUV;
uniform sampler2D uHeight;uniform mat4 uMVP;uniform vec2 uWorldSize;uniform float uMinElevation,uElevationSpan,uMeanElevation;
out vec2 vUV;
float dec(vec4 c){float hi=floor(c.r*255.0+.5),lo=floor(c.g*255.0+.5);return(hi*256.0+lo)/65535.0;}
void main(){float e=uMinElevation+dec(texture(uHeight,aUV))*uElevationSpan;vec3 p=vec3((aUV.x-.5)*uWorldSize.x,e-uMeanElevation,(.5-aUV.y)*uWorldSize.y);vUV=aUV;gl_Position=uMVP*vec4(p,1.0);}`;
  const terrainFS=`#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;
uniform sampler2D uHeight,uSurface;uniform vec2 uTexel,uWorldSize;uniform float uMinElevation,uElevationSpan,uRich;uniform int uMode;
float dec(vec4 c){float hi=floor(c.r*255.0+.5),lo=floor(c.g*255.0+.5);return(hi*256.0+lo)/65535.0;}
float h(vec2 uv){return dec(texture(uHeight,clamp(uv,vec2(0),vec2(1))))*uElevationSpan+uMinElevation;}
vec3 elev(float t){vec3 a=vec3(.17,.35,.21),b=vec3(.38,.55,.27),c=vec3(.66,.56,.34),d=vec3(.64,.60,.56),e=vec3(.93,.93,.91);if(t<.22)return mix(a,b,t/.22);if(t<.54)return mix(b,c,(t-.22)/.32);if(t<.82)return mix(c,d,(t-.54)/.28);return mix(d,e,(t-.82)/.18);}
vec3 satAdjust(vec3 c,float s){float l=dot(c,vec3(.299,.587,.114));return mix(vec3(l),c,s);}
void main(){float ce=h(vUV),dx=(h(vUV+vec2(uTexel.x,0))-h(vUV-vec2(uTexel.x,0)))/(2.0*uTexel.x*uWorldSize.x),dz=(h(vUV+vec2(0,uTexel.y))-h(vUV-vec2(0,uTexel.y)))/(2.0*uTexel.y*uWorldSize.y);vec3 n=normalize(vec3(-dx,1,dz)),light=normalize(vec3(-.55,.76,.36));float dif=max(dot(n,light),0.0),illum=.61+.43*dif,t=clamp((ce-uMinElevation)/uElevationSpan,0.0,1.0),slope=clamp(1.0-n.y,0.0,1.0);vec3 tex=texture(uSurface,vUV).rgb;vec3 col=tex*(.91+.14*dif);
if(uMode==1){vec3 rich=satAdjust(tex,1.08+.55*uRich);rich=mix(rich,vec3(.18,.37,.20),clamp((.45-t)*(1.0-slope)*.30*uRich,0.0,.32));rich=mix(rich,vec3(.57,.42,.27),clamp(slope*.48*uRich,0.0,.34));rich=mix(rich,vec3(.72,.71,.69),clamp((t-.69)*1.6+slope*.14,0.0,.30));col=rich*illum;}
else if(uMode==2)col=elev(t)*illum;
else if(uMode==3)col=mix(vec3(.22,.28,.24),tex,.32)*(.76+.24*dif);
outColor=vec4(clamp(col,0.0,1.0),1.0);}`;
  const terrainProgram=makeProgram(terrainVS,terrainFS);

  const riverVS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec2 aNormal;layout(location=2)in float aSide;layout(location=3)in float aDistance;layout(location=4)in float aBaseWidth;layout(location=5)in float aClass;
uniform mat4 uMVP;uniform float uWidthScale;
out float vSide;out float vDistance;out float vClass;out vec3 vWorld;
void main(){vec3 p=aPos;p.xz+=aNormal*aSide*aBaseWidth*uWidthScale;p.y+=1.2;vSide=aSide;vDistance=aDistance;vClass=aClass;vWorld=p;gl_Position=uMVP*vec4(p,1.0);}`;
  const riverFS=`#version 300 es
precision highp float;
in float vSide;in float vDistance;in float vClass;in vec3 vWorld;out vec4 outColor;
uniform float uTime,uFlowSpeed,uWaterColor,uWave;uniform int uShowMinor,uCandidate;
void main(){if(uShowMinor==0&&vClass>2.5)discard;float edge=1.0-smoothstep(.70,1.0,abs(vSide));float baseAlpha=vClass<.5?.88:(vClass<1.5?.78:(vClass<2.5?.74:.58));if(uCandidate==1){float dash=.45+.55*smoothstep(-.15,.30,sin(vDistance*.018));vec3 amber=vec3(.96,.60,.16);outColor=vec4(amber,edge*.65*dash);return;}float phase=vDistance*.014-uTime*(.55+uFlowSpeed*3.3);float streak=.5+.5*sin(phase)+.22*sin(phase*2.17+1.2);streak=clamp(streak*.62,0.0,1.0);vec3 deep=mix(vec3(.035,.24,.42),vec3(.045,.40,.64),uWaterColor);vec3 bright=mix(vec3(.11,.56,.78),vec3(.34,.80,.96),uWaterColor);vec3 col=mix(deep,bright,.16+.34*streak);float glint=pow(max(0.0,.5+.5*sin(vDistance*.037-uTime*(.8+uWave*2.4))),8.0);col+=vec3(.28,.42,.48)*glint*uWave*.40;outColor=vec4(clamp(col,0.0,1.0),edge*baseAlpha);}`;
  const riverProgram=makeProgram(riverVS,riverFS);

  const lakeVS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in float aClass;
uniform mat4 uMVP;out vec3 vWorld;out float vClass;
void main(){vWorld=aPos;vClass=aClass;gl_Position=uMVP*vec4(aPos,1.0);}`;
  const lakeFS=`#version 300 es
precision highp float;
in vec3 vWorld;in float vClass;out vec4 outColor;
uniform float uTime,uWaterColor,uWave;
void main(){float w1=sin(vWorld.x*.010+vWorld.z*.007+uTime*(.45+uWave*1.7));float w2=sin(vWorld.x*.018-vWorld.z*.013-uTime*(.35+uWave*1.2));float waves=.5+.25*w1+.25*w2;vec3 deep=mix(vec3(.035,.23,.39),vec3(.045,.38,.59),uWaterColor);vec3 light=mix(vec3(.12,.50,.68),vec3(.31,.76,.91),uWaterColor);vec3 col=mix(deep,light,.18+.30*waves*uWave);float glint=pow(max(0.0,.5+.5*sin(vWorld.x*.031+vWorld.z*.027+uTime*1.1)),18.0);col+=vec3(.48,.63,.70)*glint*uWave*.38;float alpha=vClass>7.5?.64:.84;outColor=vec4(clamp(col,0.0,1.0),alpha);}`;
  const lakeProgram=makeProgram(lakeVS,lakeFS);

  statusEl.textContent=`小坤正在建立高精度三维网格 ${meshCols} × ${meshRows}…`;
  await new Promise(r=>requestAnimationFrame(r));
  const terrainUV=new Float32Array(meshCols*meshRows*2);let k=0;
  for(let r=0;r<meshRows;r++)for(let c=0;c<meshCols;c++){terrainUV[k++]=c/(meshCols-1);terrainUV[k++]=r/(meshRows-1);}
  const terrainIndexCount=(meshCols-1)*(meshRows-1)*6,terrainIndices=new Uint32Array(terrainIndexCount);k=0;
  for(let r=0;r<meshRows-1;r++)for(let c=0;c<meshCols-1;c++){const a=r*meshCols+c,b=a+1,cc=a+meshCols,d=cc+1;terrainIndices[k++]=a;terrainIndices[k++]=cc;terrainIndices[k++]=b;terrainIndices[k++]=b;terrainIndices[k++]=cc;terrainIndices[k++]=d;}
  const terrainVAO=gl.createVertexArray();gl.bindVertexArray(terrainVAO);
  const terrainVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,terrainVB);gl.bufferData(gl.ARRAY_BUFFER,terrainUV,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const terrainIB=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,terrainIB);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,terrainIndices,gl.STATIC_DRAW);

  function makeRiverVAO(raw){const data=new Float32Array(raw),vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const stride=9*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,stride,3*4);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,stride,5*4);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,stride,6*4);gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,1,gl.FLOAT,false,stride,7*4);gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,1,gl.FLOAT,false,stride,8*4);return{vao,count:data.length/9};}
  function makeLakeVAO(raw){const data=new Float32Array(raw),vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const stride=4*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,stride,3*4);return{vao,count:data.length/4};}
  const rivers=makeRiverVAO(riversRaw),lakes=makeLakeVAO(areasRaw),ohm=makeRiverVAO(ohmRaw);
  imageTexture(heightImage,0);imageTexture(surfaceImage,1);
  gl.useProgram(terrainProgram);gl.uniform1i(U(terrainProgram,'uHeight'),0);gl.uniform1i(U(terrainProgram,'uSurface'),1);gl.uniform2f(U(terrainProgram,'uWorldSize'),worldWidth,worldDepth);gl.uniform2f(U(terrainProgram,'uTexel'),1/heightImage.width,1/heightImage.height);gl.uniform1f(U(terrainProgram,'uMinElevation'),minElevation);gl.uniform1f(U(terrainProgram,'uElevationSpan'),elevationSpan);gl.uniform1f(U(terrainProgram,'uMeanElevation'),meanElevation);

  function id(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
  function perspective(o,f,a,n,fa){const q=1/Math.tan(f/2),nf=1/(n-fa);o.fill(0);o[0]=q/a;o[5]=q;o[10]=(fa+n)*nf;o[11]=-1;o[14]=2*fa*n*nf;return o;}
  function lookAt(o,e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],ln=Math.hypot(zx,zy,zz)||1;zx/=ln;zy/=ln;zz/=ln;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;ln=Math.hypot(xx,xy,xz)||1;xx/=ln;xy/=ln;xz/=ln;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);o[15]=1;return o;}
  function multiply(o,a,b){const r=new Float32Array(16);for(let row=0;row<4;row++)for(let col=0;col<4;col++)r[col*4+row]=a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];o.set(r);return o;}

  let mode=0,showOsm=true,showOhm=false,showMinor=true,showLakes=true;
  const params={widthScale:6.0,waterColor:.62,flowSpeed:.58,wave:.54,rich:.68};
  let cam={yaw:-.62,pitch:.72,distance:104000,x:0,z:0},drag=false,pan=false,lx=0,ly=0;
  function overview(){cam={yaw:-.62,pitch:.72,distance:104000,x:0,z:0};}
  function top(){cam={yaw:0,pitch:1.555,distance:76000,x:0,z:0};}
  function low(){cam={yaw:-.76,pitch:.34,distance:36000,x:-9000,z:16000};}
  function focus(x,z){cam.x=x;cam.z=z;cam.distance=18000;cam.pitch=.62;}

  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{drag=true;pan=e.button===2||e.shiftKey;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;if(pan){const s=Math.max(1.5,cam.distance*.0012),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw),fx=Math.sin(cam.yaw),fz=Math.cos(cam.yaw);cam.x-=dx*s*rx+dy*s*fx;cam.z-=dx*s*rz+dy*s*fz;cam.x=Math.max(-worldWidth/2,Math.min(worldWidth/2,cam.x));cam.z=Math.max(-worldDepth/2,Math.min(worldDepth/2,cam.z));}else{cam.yaw-=dx*.0055;cam.pitch=Math.max(.025,Math.min(1.555,cam.pitch-dy*.0047));}});
  canvas.addEventListener('pointerup',e=>{drag=false;canvas.releasePointerCapture(e.pointerId);});
  canvas.addEventListener('wheel',e=>{e.preventDefault();cam.distance=Math.max(1.6,Math.min(240000,cam.distance*Math.exp(e.deltaY*.0011)));},{passive:false});

  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=+button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===button));}));
  const toggle=(id,get,set,onText,offText)=>document.getElementById(id).addEventListener('click',e=>{set(!get());e.currentTarget.classList.toggle('active',get());e.currentTarget.textContent=get()?onText:offText;});
  toggle('toggleOsm',()=>showOsm,v=>showOsm=v,'现代 OSM 水系开','现代 OSM 水系关');
  toggle('toggleOhm',()=>showOhm,v=>showOhm=v,'OHM 历史候选开','OHM 历史候选关');
  toggle('toggleMinor',()=>showMinor,v=>showMinor=v,'溪流沟渠开','溪流沟渠关');
  toggle('toggleLakes',()=>showLakes,v=>showLakes=v,'湖泊水库开','湖泊水库关');
  function bind(id,output,fn,format){const el=document.getElementById(id),out=document.getElementById(output);el.addEventListener('input',()=>{const v=+el.value;fn(v);out.textContent=format(v);});}
  bind('riverWidth','riverWidthOut',v=>params.widthScale=.5+v/10,v=>(.5+v/10).toFixed(1)+'×');
  bind('waterColor','waterColorOut',v=>params.waterColor=v/100,v=>v+'%');
  bind('flowSpeed','flowSpeedOut',v=>params.flowSpeed=v/100,v=>v+'%');
  bind('wave','waveOut',v=>params.wave=v/100,v=>v+'%');
  bind('rich','richOut',v=>params.rich=v/100,v=>v+'%');
  document.getElementById('overview').onclick=overview;document.getElementById('top').onclick=top;document.getElementById('low').onclick=low;
  document.getElementById('reset').onclick=()=>{overview();mode=0;showOsm=true;showOhm=false;showMinor=true;showLakes=true;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',+b.dataset.mode===0));const values={riverWidth:55,waterColor:62,flowSpeed:58,wave:54,rich:68};for(const[id,v]of Object.entries(values)){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'));}for(const[id,on,text]of[['toggleOsm',true,'现代 OSM 水系开'],['toggleOhm',false,'OHM 历史候选关'],['toggleMinor',true,'溪流沟渠开'],['toggleLakes',true,'湖泊水库开']]){const b=document.getElementById(id);b.classList.toggle('active',on);b.textContent=text;}};
  document.getElementById('fullscreen').onclick=()=>document.documentElement.requestFullscreen?.();
  document.getElementById('screenshot').onclick=()=>{const a=document.createElement('a');a.download='XIAOKUN_KUNMING_OSM_HYDROLOGY_V001.png';a.href=canvas.toDataURL('image/png');a.click();};

  let activeList='areas';
  function renderNames(){const list=document.getElementById('nameList'),items=(activeList==='areas'?manifest.namedWaterAreas:manifest.namedWaterways).slice(0,80);list.innerHTML='';for(const item of items){const row=document.createElement('button');row.className='name-item';const metric=activeList==='areas'?`${item.areaKm2.toLocaleString('zh-CN')} km²`:`${item.lengthKm.toLocaleString('zh-CN')} km`;row.innerHTML=`<b>${item.name}</b><span>${item.class} · ${metric}</span>`;row.onclick=()=>focus(item.x,item.z);list.appendChild(row);}}
  document.querySelectorAll('[data-list]').forEach(b=>b.addEventListener('click',()=>{activeList=b.dataset.list;document.querySelectorAll('[data-list]').forEach(x=>x.classList.toggle('active',x===b));renderNames();}));renderNames();

  function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
  const started=performance.now();let frame=0;
  function render(){
    resize();
    const targetY=groundY(cam.x,cam.z),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),eye=[cam.x+cam.distance*cp*Math.sin(cam.yaw),targetY+cam.distance*sp,cam.z+cam.distance*cp*Math.cos(cam.yaw)];
    const near=Math.max(.05,Math.min(40,cam.distance*.00035)),far=Math.max(350000,cam.distance*4+250000),projection=id(),view=id(),mvp=id();perspective(projection,Math.PI/4,canvas.width/canvas.height,near,far);lookAt(view,eye,[cam.x,targetY,cam.z],[0,1,0]);multiply(mvp,projection,view);
    const time=(performance.now()-started)/1000;
    gl.clearColor(.79,.84,.85,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);

    gl.useProgram(terrainProgram);gl.uniformMatrix4fv(U(terrainProgram,'uMVP'),false,mvp);gl.uniform1i(U(terrainProgram,'uMode'),mode);gl.uniform1f(U(terrainProgram,'uRich'),params.rich);gl.bindVertexArray(terrainVAO);gl.drawElements(gl.TRIANGLES,terrainIndexCount,gl.UNSIGNED_INT,0);

    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    if(showOsm&&showLakes){gl.useProgram(lakeProgram);gl.uniformMatrix4fv(U(lakeProgram,'uMVP'),false,mvp);gl.uniform1f(U(lakeProgram,'uTime'),time);gl.uniform1f(U(lakeProgram,'uWaterColor'),params.waterColor);gl.uniform1f(U(lakeProgram,'uWave'),params.wave);gl.bindVertexArray(lakes.vao);gl.drawArrays(gl.TRIANGLES,0,lakes.count);}
    if(showOsm){gl.useProgram(riverProgram);gl.uniformMatrix4fv(U(riverProgram,'uMVP'),false,mvp);gl.uniform1f(U(riverProgram,'uTime'),time);gl.uniform1f(U(riverProgram,'uWidthScale'),params.widthScale);gl.uniform1f(U(riverProgram,'uFlowSpeed'),params.flowSpeed);gl.uniform1f(U(riverProgram,'uWaterColor'),params.waterColor);gl.uniform1f(U(riverProgram,'uWave'),params.wave);gl.uniform1i(U(riverProgram,'uShowMinor'),showMinor?1:0);gl.uniform1i(U(riverProgram,'uCandidate'),0);gl.bindVertexArray(rivers.vao);gl.drawArrays(gl.TRIANGLES,0,rivers.count);}
    if(showOhm){gl.useProgram(riverProgram);gl.uniformMatrix4fv(U(riverProgram,'uMVP'),false,mvp);gl.uniform1f(U(riverProgram,'uTime'),time);gl.uniform1f(U(riverProgram,'uWidthScale'),Math.max(2.0,params.widthScale*.55));gl.uniform1f(U(riverProgram,'uFlowSpeed'),0);gl.uniform1f(U(riverProgram,'uWaterColor'),0);gl.uniform1f(U(riverProgram,'uWave'),0);gl.uniform1i(U(riverProgram,'uShowMinor'),1);gl.uniform1i(U(riverProgram,'uCandidate'),1);gl.bindVertexArray(ohm.vao);gl.drawArrays(gl.TRIANGLES,0,ohm.count);}
    gl.depthMask(true);gl.disable(gl.BLEND);

    if((frame++%15)===0){const ex=Math.max(-worldWidth/2,Math.min(worldWidth/2,eye[0])),ez=Math.max(-worldDepth/2,Math.min(worldDepth/2,eye[2])),clearance=Math.max(0,eye[1]-groundY(ex,ez));statusEl.textContent=`小坤在线 · 现代 OSM 真实水系 ${showOsm?'开启':'关闭'} · 历史已核验 0 · 手绘水系 0 · 网格 ${meshCols} × ${meshRows} · 镜头离地约 ${clearance.toFixed(clearance<100?1:0)} m`;}
    requestAnimationFrame(render);
  }
  render();
}
