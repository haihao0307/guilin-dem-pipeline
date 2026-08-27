const canvas=document.getElementById('terrain');
const fallback=document.getElementById('fallback');
const fallbackImage=document.getElementById('fallbackImage');
const statusEl=document.getElementById('status');
const panel=document.getElementById('panel');
const ASSET_BASE='./assets/';

function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`无法载入 ${src}`));image.src=src;});}
function startFallback(message){canvas.hidden=true;fallback.hidden=false;document.documentElement.dataset.viewer='fallback';statusEl.textContent=`${message} · 已切换二维云南色彩预览`;let scale=1,x=0,y=0,drag=false,px=0,py=0;function fit(){scale=Math.min(innerWidth/fallbackImage.naturalWidth,innerHeight/fallbackImage.naturalHeight)*.92;x=0;y=0;draw();}function draw(){fallbackImage.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${scale})`;}fallbackImage.onload=fit;if(fallbackImage.complete)fit();fallback.addEventListener('pointerdown',event=>{drag=true;px=event.clientX;py=event.clientY;fallback.setPointerCapture(event.pointerId);});fallback.addEventListener('pointermove',event=>{if(!drag)return;x+=event.clientX-px;y+=event.clientY-py;px=event.clientX;py=event.clientY;draw();});fallback.addEventListener('pointerup',event=>{drag=false;fallback.releasePointerCapture(event.pointerId);});fallback.addEventListener('wheel',event=>{event.preventDefault();scale=Math.max(.1,Math.min(14,scale*Math.exp(-event.deltaY*.001)));draw();},{passive:false});}

let manifest;
try{
  manifest=await fetch('manifest.json?v=4',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`manifest HTTP ${response.status}`);return response.json();});
  fallbackImage.src=manifest.browserAssets.fallback.file;
}catch(error){startFallback(`清单载入失败：${error.message}`);throw error;}

const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl){startFallback('浏览器没有提供 WebGL2');}
else{
  try{await start3D(gl);}catch(error){console.error(error);startFallback(`三维载入失败：${error.message}`);}
}

async function start3D(gl){
  statusEl.textContent='小坤正在载入高度、云南色彩和真实 OSM 水系…';
  const [heightImage,surfaceImage,waterImage]=await Promise.all([
    loadImage(manifest.browserAssets.height.file),
    loadImage(manifest.browserAssets.surface.file),
    loadImage(manifest.browserAssets.waterField.file)
  ]);

  const truth=manifest.authoritativeDem;
  const worldWidth=truth.widthMeters,worldDepth=truth.heightMeters;
  const minElevation=truth.elevation.min,maxElevation=truth.elevation.max,meanElevation=truth.elevation.mean,elevationSpan=maxElevation-minElevation;
  const highDetail=(navigator.deviceMemory||4)>=8&&innerWidth>=1000;
  const [meshCols,meshRows]=highDetail?manifest.browserTerrain.meshDesktop:manifest.browserTerrain.meshCompatibility;

  document.getElementById('countWays').textContent=manifest.osmCurrent.sourceCounts.waterways.toLocaleString('zh-CN');
  document.getElementById('countAreas').textContent=manifest.osmCurrent.sourceCounts.waterAreas.toLocaleString('zh-CN');
  document.getElementById('sourceTime').textContent=`OSM 抓取：${new Date(manifest.osmCurrent.retrievedAtUtc).toLocaleString('zh-CN')}。与当前裁切相交的水路线 ${manifest.osmCurrent.webWaterways.toLocaleString('zh-CN')}，水体面 ${manifest.osmCurrent.webWaterAreas.toLocaleString('zh-CN')}。`;

  const heightCanvas=document.createElement('canvas');heightCanvas.width=heightImage.width;heightCanvas.height=heightImage.height;
  const heightContext=heightCanvas.getContext('2d',{willReadFrequently:true});heightContext.drawImage(heightImage,0,0);
  const heightPixels=heightContext.getImageData(0,0,heightCanvas.width,heightCanvas.height).data;
  function decodePixel(ix,iy){const x=Math.max(0,Math.min(heightCanvas.width-1,ix)),y=Math.max(0,Math.min(heightCanvas.height-1,iy)),index=(y*heightCanvas.width+x)*4;return((heightPixels[index]<<8)|heightPixels[index+1])/65535;}
  function sampleHeight(u,v){const x=Math.max(0,Math.min(heightCanvas.width-1,u*(heightCanvas.width-1))),y=Math.max(0,Math.min(heightCanvas.height-1,v*(heightCanvas.height-1))),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(heightCanvas.width-1,x0+1),y1=Math.min(heightCanvas.height-1,y0+1),tx=x-x0,ty=y-y0,a=decodePixel(x0,y0),b=decodePixel(x1,y0),c=decodePixel(x0,y1),d=decodePixel(x1,y1);return a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty;}
  function groundY(x,z){const u=Math.max(0,Math.min(1,x/worldWidth+.5)),v=Math.max(0,Math.min(1,.5-z/worldDepth));return minElevation+sampleHeight(u,v)*elevationSpan-meanElevation;}

  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'shader compile');return shader;}
  function makeProgram(vertexSource,fragmentSource){const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'program link');return program;}
  function imageTexture(image,unit){const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);return texture;}

  const vertexShader=`#version 300 es
precision highp float;
layout(location=0)in vec2 aUV;
uniform sampler2D uHeight;
uniform mat4 uMVP;
uniform vec2 uWorldSize;
uniform float uMinElevation,uElevationSpan,uMeanElevation;
out vec2 vUV;
float decodeHeight(vec4 color){float hi=floor(color.r*255.0+.5),lo=floor(color.g*255.0+.5);return(hi*256.0+lo)/65535.0;}
void main(){float elevation=uMinElevation+decodeHeight(texture(uHeight,aUV))*uElevationSpan;vec3 position=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(.5-aUV.y)*uWorldSize.y);vUV=aUV;gl_Position=uMVP*vec4(position,1.0);}`;

  const fragmentShader=`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uHeight,uSurface,uWater;
uniform vec2 uTexel,uWorldSize,uWaterPixels;
uniform float uMinElevation,uElevationSpan,uTime;
uniform float uGreen,uRedEarth,uRock,uShade,uContrast;
uniform float uRiverWidth,uWaterColor,uFlowSpeed,uWave,uShowRivers,uShowLakes;
float decodeHeight(vec4 color){float hi=floor(color.r*255.0+.5),lo=floor(color.g*255.0+.5);return(hi*256.0+lo)/65535.0;}
float heightAt(vec2 uv){return decodeHeight(texture(uHeight,clamp(uv,vec2(0),vec2(1))))*uElevationSpan+uMinElevation;}
void main(){
  float elevation=heightAt(vUV);
  float dx=(heightAt(vUV+vec2(uTexel.x,0))-heightAt(vUV-vec2(uTexel.x,0)))/(2.0*uTexel.x*uWorldSize.x);
  float dz=(heightAt(vUV+vec2(0,uTexel.y))-heightAt(vUV-vec2(0,uTexel.y)))/(2.0*uTexel.y*uWorldSize.y);
  vec3 normal=normalize(vec3(-dx,1.0,dz));
  vec3 light=normalize(vec3(-.55,.77,.34));
  float diffuse=max(dot(normal,light),0.0);
  float slope=clamp(1.0-normal.y,0.0,1.0);
  float h=clamp((elevation-uMinElevation)/uElevationSpan,0.0,1.0);
  vec3 color=texture(uSurface,vUV).rgb;

  float valleyGreen=clamp((.62-h)*(1.0-slope)*1.45,0.0,1.0);
  float middle=clamp(1.0-abs(h-.52)*3.1,0.0,1.0);
  float warmSlope=clamp(middle*(.25+slope*.95),0.0,1.0);
  float exposedRock=clamp(slope*1.25+max(h-.63,0.0)*1.65,0.0,1.0);
  color=mix(color,vec3(.17,.39,.23),valleyGreen*uGreen*.30);
  color=mix(color,vec3(.58,.34,.20),warmSlope*uRedEarth*.26);
  color=mix(color,vec3(.41,.36,.33),exposedRock*uRock*.31);
  color=(color-.5)*(0.84+uContrast*.42)+.5;
  color*=mix(1.0,.60+.50*diffuse,uShade);

  vec4 field=texture(uWater,vUV);
  float riverDistance=field.r;
  float lakeMask=smoothstep(.22,.72,field.g)*uShowLakes;
  float direction=field.b*6.28318530718-3.14159265359;
  float riverClass=field.a;
  float baseWidth=mix(.025,.165,riverClass);
  float displayWidth=baseWidth*mix(.30,1.50,uRiverWidth);
  float riverMask=(1.0-smoothstep(displayWidth,displayWidth+.012,riverDistance))*uShowRivers;
  vec2 directionVector=vec2(cos(direction),sin(direction));
  vec2 pixelPosition=vUV*uWaterPixels;
  float flowPhase=dot(pixelPosition,directionVector)*.30-uTime*(.65+uFlowSpeed*3.4);
  float streak=clamp((.5+.5*sin(flowPhase)+.22*sin(flowPhase*2.11+1.4))*.64,0.0,1.0);
  float lakeWave=.5+.25*sin(pixelPosition.x*.085+pixelPosition.y*.061+uTime*(.45+uWave*1.9))+.25*sin(pixelPosition.x*.133-pixelPosition.y*.097-uTime*(.35+uWave*1.4));
  vec3 deep=mix(vec3(.035,.22,.38),vec3(.045,.39,.62),uWaterColor);
  vec3 bright=mix(vec3(.10,.49,.68),vec3(.30,.77,.93),uWaterColor);
  vec3 riverColor=mix(deep,bright,.15+.36*streak);
  vec3 lakeColor=mix(deep,bright,.20+.26*lakeWave*uWave);
  float waterMask=max(riverMask,lakeMask);
  vec3 waterColor=mix(riverColor,lakeColor,lakeMask);
  float glint=pow(max(0.0,.5+.5*sin(pixelPosition.x*.071+pixelPosition.y*.053+uTime*1.05)),18.0);
  waterColor+=vec3(.32,.44,.50)*glint*uWave*lakeMask*.35;
  color=mix(color,waterColor,waterMask*mix(.72,.94,uWaterColor));
  outColor=vec4(clamp(color,0.0,1.0),1.0);
}`;

  const program=makeProgram(vertexShader,fragmentShader);
  gl.useProgram(program);
  const uniform=name=>gl.getUniformLocation(program,name);
  imageTexture(heightImage,0);imageTexture(surfaceImage,1);imageTexture(waterImage,2);
  gl.uniform1i(uniform('uHeight'),0);gl.uniform1i(uniform('uSurface'),1);gl.uniform1i(uniform('uWater'),2);
  gl.uniform2f(uniform('uWorldSize'),worldWidth,worldDepth);gl.uniform2f(uniform('uTexel'),1/heightImage.width,1/heightImage.height);gl.uniform2f(uniform('uWaterPixels'),waterImage.width,waterImage.height);
  gl.uniform1f(uniform('uMinElevation'),minElevation);gl.uniform1f(uniform('uElevationSpan'),elevationSpan);gl.uniform1f(uniform('uMeanElevation'),meanElevation);

  statusEl.textContent=`小坤正在建立三维网格 ${meshCols} × ${meshRows}…`;
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const vertices=new Float32Array(meshCols*meshRows*2);let offset=0;
  for(let row=0;row<meshRows;row++)for(let column=0;column<meshCols;column++){vertices[offset++]=column/(meshCols-1);vertices[offset++]=row/(meshRows-1);}
  const indexCount=(meshCols-1)*(meshRows-1)*6,indices=new Uint32Array(indexCount);offset=0;
  for(let row=0;row<meshRows-1;row++)for(let column=0;column<meshCols-1;column++){const a=row*meshCols+column,b=a+1,c=a+meshCols,d=c+1;indices[offset++]=a;indices[offset++]=c;indices[offset++]=b;indices[offset++]=b;indices[offset++]=c;indices[offset++]=d;}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vertexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);

  function identity(){const matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;return matrix;}
  function perspective(out,fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)*nf;out[11]=-1;out[14]=2*far*near*nf;return out;}
  function lookAt(out,eye,center,up){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],length=Math.hypot(zx,zy,zz)||1;zx/=length;zy/=length;zz/=length;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;length=Math.hypot(xx,xy,xz)||1;xx/=length;xy/=length;xz/=length;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);out[15]=1;return out;}
  function multiply(out,a,b){const result=new Float32Array(16);for(let row=0;row<4;row++)for(let column=0;column<4;column++)result[column*4+row]=a[row]*b[column*4]+a[4+row]*b[column*4+1]+a[8+row]*b[column*4+2]+a[12+row]*b[column*4+3];out.set(result);return out;}

  const defaults={green:.64,redEarth:.56,rock:.58,shade:.70,contrast:.54,riverWidth:.46,waterColor:.60,flowSpeed:.52,wave:.48,showRivers:1,showLakes:1};
  const parameters={...defaults};
  const bindings=[['green','green','greenOut'],['redEarth','redEarth','redEarthOut'],['rock','rock','rockOut'],['shade','shade','shadeOut'],['contrast','contrast','contrastOut'],['riverWidth','riverWidth','riverWidthOut'],['waterColor','waterColor','waterColorOut'],['flowSpeed','flowSpeed','flowSpeedOut'],['wave','wave','waveOut']];
  for(const [id,key,outId] of bindings){const input=document.getElementById(id),output=document.getElementById(outId);input.addEventListener('input',()=>{parameters[key]=Number(input.value)/100;output.textContent=`${input.value}%`;});}
  function setToggle(id,key,onText,offText){const button=document.getElementById(id);button.addEventListener('click',()=>{parameters[key]=parameters[key]?0:1;button.classList.toggle('active',Boolean(parameters[key]));button.textContent=parameters[key]?onText:offText;});}
  setToggle('toggleRivers','showRivers','河流开','河流关');setToggle('toggleLakes','showLakes','湖泊开','湖泊关');
  document.getElementById('resetColor').addEventListener('click',()=>{Object.assign(parameters,defaults);for(const [id,key,outId] of bindings){const value=Math.round(defaults[key]*100);document.getElementById(id).value=value;document.getElementById(outId).textContent=`${value}%`;}for(const [id,key,onText] of [['toggleRivers','showRivers','河流开'],['toggleLakes','showLakes','湖泊开']]){const button=document.getElementById(id);button.classList.add('active');button.textContent=onText;}});
  document.getElementById('fullscreen').addEventListener('click',()=>document.documentElement.requestFullscreen?.());
  document.getElementById('screenshot').addEventListener('click',()=>{const link=document.createElement('a');link.download='KUNMING_YUNNAN_HYDROLOGY_V004.png';link.href=canvas.toDataURL('image/png');link.click();});
  document.getElementById('collapse').addEventListener('click',()=>panel.classList.add('collapsed'));
  document.getElementById('reopenPanel')?.addEventListener('click',()=>panel.classList.remove('collapsed'));

  let camera={yaw:-.62,pitch:.72,distance:104000,x:0,z:0};
  let dragging=false,panning=false,lastX=0,lastY=0;
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{dragging=true;panning=event.button===2||event.shiftKey;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;if(panning){const scale=Math.max(2,camera.distance*.00125),rightX=Math.cos(camera.yaw),rightZ=-Math.sin(camera.yaw),forwardX=Math.sin(camera.yaw),forwardZ=Math.cos(camera.yaw);camera.x-=dx*scale*rightX+dy*scale*forwardX;camera.z-=dx*scale*rightZ+dy*scale*forwardZ;camera.x=Math.max(-worldWidth/2,Math.min(worldWidth/2,camera.x));camera.z=Math.max(-worldDepth/2,Math.min(worldDepth/2,camera.z));}else{camera.yaw-=dx*.0055;camera.pitch=Math.max(.035,Math.min(1.555,camera.pitch-dy*.0047));}});
  canvas.addEventListener('pointerup',event=>{dragging=false;canvas.releasePointerCapture(event.pointerId);});
  canvas.addEventListener('wheel',event=>{event.preventDefault();camera.distance=Math.max(1.6,Math.min(240000,camera.distance*Math.exp(event.deltaY*.0011)));},{passive:false});

  function resize(){const ratio=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.floor(innerWidth*ratio)),height=Math.max(1,Math.floor(innerHeight*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}}
  const started=performance.now();let readyPublished=false;
  function render(){
    resize();
    const targetY=groundY(camera.x,camera.z),cosPitch=Math.cos(camera.pitch),sinPitch=Math.sin(camera.pitch);
    const eye=[camera.x+camera.distance*cosPitch*Math.sin(camera.yaw),targetY+camera.distance*sinPitch,camera.z+camera.distance*cosPitch*Math.cos(camera.yaw)];
    const near=Math.max(.05,Math.min(40,camera.distance*.00035)),far=Math.max(350000,camera.distance*4+250000),projection=identity(),view=identity(),mvp=identity();
    perspective(projection,Math.PI/4,canvas.width/canvas.height,near,far);lookAt(view,eye,[camera.x,targetY,camera.z],[0,1,0]);multiply(mvp,projection,view);
    gl.clearColor(.79,.84,.85,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(program);
    gl.uniformMatrix4fv(uniform('uMVP'),false,mvp);gl.uniform1f(uniform('uTime'),(performance.now()-started)/1000);
    gl.uniform1f(uniform('uGreen'),parameters.green);gl.uniform1f(uniform('uRedEarth'),parameters.redEarth);gl.uniform1f(uniform('uRock'),parameters.rock);gl.uniform1f(uniform('uShade'),parameters.shade);gl.uniform1f(uniform('uContrast'),parameters.contrast);
    gl.uniform1f(uniform('uRiverWidth'),parameters.riverWidth);gl.uniform1f(uniform('uWaterColor'),parameters.waterColor);gl.uniform1f(uniform('uFlowSpeed'),parameters.flowSpeed);gl.uniform1f(uniform('uWave'),parameters.wave);gl.uniform1f(uniform('uShowRivers'),parameters.showRivers);gl.uniform1f(uniform('uShowLakes'),parameters.showLakes);
    gl.bindVertexArray(vao);gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_INT,0);
    const eyeGround=groundY(Math.max(-worldWidth/2,Math.min(worldWidth/2,eye[0])),Math.max(-worldDepth/2,Math.min(worldDepth/2,eye[2]))),clearance=Math.max(0,eye[1]-eyeGround);
    statusEl.textContent=`昆明 V004 已载入 · 云南色彩 · 现代 OSM 水系 · 自然垂直比例 1.0× · 镜头离地约 ${clearance.toFixed(clearance<100?1:0)} m`;
    if(!readyPublished){readyPublished=true;document.documentElement.dataset.viewer='ready';document.documentElement.dataset.fallback='false';}
    requestAnimationFrame(render);
  }
  render();
}
