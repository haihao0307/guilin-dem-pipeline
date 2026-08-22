const $ = (selector) => document.querySelector(selector);
const canvas = $('#gl');
const loading = $('#loading');
const loadingText = $('#loadingText');
const toast = $('#toast');
const errorCard = $('#errorCard');
const errorText = $('#errorText');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const radians = (degrees) => degrees * Math.PI / 180;

function showToast(message, duration = 2800) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), duration);
}

async function fetchFirst(urls, type = 'arrayBuffer') {
  const failures = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (type === 'json') return await response.json();
      if (type === 'blob') return await response.blob();
      return await response.arrayBuffer();
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(failures.join(' | '));
}

async function imageFromUrls(urls) {
  const blob = await fetchFirst(urls, 'blob');
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('字段纹理解码失败'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const Vec3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  normalize(a) {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
  },
};

const Mat4 = {
  identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },
  lookAt(eye, center, up) {
    const z = Vec3.normalize(Vec3.sub(eye, center));
    const x = Vec3.normalize([
      up[1] * z[2] - up[2] * z[1],
      up[2] * z[0] - up[0] * z[2],
      up[0] * z[1] - up[1] * z[0],
    ]);
    const y = [
      z[1] * x[2] - z[2] * x[1],
      z[2] * x[0] - z[0] * x[2],
      z[0] * x[1] - z[1] * x[0],
    ];
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1,
    ]);
  },
  multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        out[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  },
  invert(matrix) {
    const m = matrix;
    const out = new Float32Array(16);
    const b00 = m[0] * m[5] - m[1] * m[4];
    const b01 = m[0] * m[6] - m[2] * m[4];
    const b02 = m[0] * m[7] - m[3] * m[4];
    const b03 = m[1] * m[6] - m[2] * m[5];
    const b04 = m[1] * m[7] - m[3] * m[5];
    const b05 = m[2] * m[7] - m[3] * m[6];
    const b06 = m[8] * m[13] - m[9] * m[12];
    const b07 = m[8] * m[14] - m[10] * m[12];
    const b08 = m[8] * m[15] - m[11] * m[12];
    const b09 = m[9] * m[14] - m[10] * m[13];
    const b10 = m[9] * m[15] - m[11] * m[13];
    const b11 = m[10] * m[15] - m[11] * m[14];
    let determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!determinant) return null;
    determinant = 1 / determinant;
    out[0] = (m[5] * b11 - m[6] * b10 + m[7] * b09) * determinant;
    out[1] = (-m[1] * b11 + m[2] * b10 - m[3] * b09) * determinant;
    out[2] = (m[13] * b05 - m[14] * b04 + m[15] * b03) * determinant;
    out[3] = (-m[9] * b05 + m[10] * b04 - m[11] * b03) * determinant;
    out[4] = (-m[4] * b11 + m[6] * b08 - m[7] * b07) * determinant;
    out[5] = (m[0] * b11 - m[2] * b08 + m[3] * b07) * determinant;
    out[6] = (-m[12] * b05 + m[14] * b02 - m[15] * b01) * determinant;
    out[7] = (m[8] * b05 - m[10] * b02 + m[11] * b01) * determinant;
    out[8] = (m[4] * b10 - m[5] * b08 + m[7] * b06) * determinant;
    out[9] = (-m[0] * b10 + m[1] * b08 - m[3] * b06) * determinant;
    out[10] = (m[12] * b04 - m[13] * b02 + m[15] * b00) * determinant;
    out[11] = (-m[8] * b04 + m[9] * b02 - m[11] * b00) * determinant;
    out[12] = (-m[4] * b09 + m[5] * b07 - m[6] * b06) * determinant;
    out[13] = (m[0] * b09 - m[1] * b07 + m[2] * b06) * determinant;
    out[14] = (-m[12] * b03 + m[13] * b01 - m[14] * b00) * determinant;
    out[15] = (m[8] * b03 - m[9] * b01 + m[10] * b00) * determinant;
    return out;
  },
  transformPoint(matrix, point) {
    const x = point[0], y = point[1], z = point[2], w = point[3] ?? 1;
    const rx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    const ry = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    const rz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    const rw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;
    return [rx / rw, ry / rw, rz / rw];
  },
};

const manifest = await fetchFirst(['./manifest.json'], 'json');
const terrainMeta = manifest.terrain;
const ecologyMeta = manifest.ecology;
const aoi = manifest.aoi;
const sideM = aoi.sideMeters;
const halfM = sideM / 2;
const meshN = terrainMeta.grid;
const minH = terrainMeta.minElevationM;
const maxH = terrainMeta.maxElevationM;
const reliefM = maxH - minH;

loadingText.textContent = '读取 v0.3.1 恢复资产';
const [heightBuffer, field0Image, field1Image, field2Image, treesBuffer, shrubsBuffer, riceBuffer] = await Promise.all([
  fetchFirst(manifest.assets.height),
  imageFromUrls(manifest.assets.field0),
  imageFromUrls(manifest.assets.field1),
  imageFromUrls(manifest.assets.field2),
  fetchFirst(manifest.assets.trees),
  fetchFirst(manifest.assets.shrubs),
  fetchFirst(manifest.assets.rice),
]);

const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance' });
if (!gl) throw new Error('浏览器不支持 WebGL2');

const common = '#version 300 es\nprecision highp float;\n';
const terrainVS = `${common}
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
uniform mat4 uViewProj;
uniform float uVerticalEx;
uniform sampler2D uField0;
uniform sampler2D uField1;
uniform sampler2D uField2;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
void main(){
  vec4 f0=texture(uField0,aUv); vec4 f1=texture(uField1,aUv); vec4 f2=texture(uField2,aUv);
  float y=aPosition.y;
  float terrace=clamp(f2.g,0.0,1.0);
  float terraceY=floor((y+.675)/1.35)*1.35;
  y=mix(y,terraceY,terrace*.62);
  float agriculture=max(step(.04,f1.r),step(.05,f2.a));
  float bund=smoothstep(.58,.94,f1.g)*agriculture*(1.0-smoothstep(.04,.20,f0.a));
  y+=bund*.36;
  vWorld=vec3(aPosition.x,y*uVerticalEx,aPosition.z);
  vNormal=normalize(vec3(aNormal.x,aNormal.y/max(uVerticalEx,.001),aNormal.z));
  vUv=aUv;
  gl_Position=uViewProj*vec4(vWorld,1.0);
}`;

const terrainFS = `${common}
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; out vec4 outColor;
uniform sampler2D uField0; uniform sampler2D uField1; uniform sampler2D uField2;
uniform vec3 uCameraPos; uniform vec3 uSunDir; uniform vec3 uFogColor;
uniform float uTime; uniform float uSeason; uniform float uForestDensity; uniform float uWaterLevel;
uniform float uShowForest; uniform float uShowPaddy; uniform float uShowWater; uniform float uShowRock;
uniform float uShowTerrace; uniform float uShowEcology; uniform float uErosionStrength;
uniform float uKarstStrength; uniform float uHydrologyDiagnostics;
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){float n=sin(dot(p,vec2(41.0,289.0)));return fract(vec2(262144.0,32768.0)*n);}
float voronoiF1(vec2 x){vec2 n=floor(x),f=fract(x);float md=8.0;for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 o=.12+.76*hash22(n+g);vec2 r=g+o-f;md=min(md,dot(r,r));}}return sqrt(md);}
float codeMask(float code,float target){return 1.0-smoothstep(.34,.52,abs(code-target));}
void main(){
  vec4 f0=texture(uField0,vUv); vec4 f1=texture(uField1,vUv); vec4 f2=texture(uField2,vUv);
  float elevation=f0.r, slope=f0.g, waterRaw=f0.a;
  float water=smoothstep(.035,.18,waterRaw)*uShowWater*uShowEcology*(1.0-smoothstep(.56,.92,slope));
  float stage=f1.r*4.0;
  float paddyMask=smoothstep(.15,.34,stage)*uShowPaddy*uShowEcology*(1.0-smoothstep(.13,.29,slope))*(1.0-water);
  float landCode=floor(f2.a*8.0+.5);
  float farmMask=step(.5,landCode)*uShowPaddy*uShowEcology*(1.0-water);
  float parcel=f1.g*max(paddyMask,farmMask); float row=f1.b*max(paddyMask,farmMask);
  float rock=smoothstep(.035,.32,f1.a*uShowRock*uKarstStrength*(1.0-water)*(1.0-max(paddyMask,farmMask)*.96));
  float wet=f2.r; float terrace=f2.g*uShowTerrace; float tributary=f2.b;
  float forest=clamp(f0.b*uForestDensity,0.0,1.0)*uShowForest*uShowEcology;
  forest*=clamp(1.0-water*1.35-rock*.98-max(paddyMask,farmMask),0.0,1.0);
  float n=hash12(floor(vWorld.xz*.18))+hash12(floor(vWorld.xz*.057+17.0))*.45;
  float parcelNoise=hash12(floor(vWorld.xz*.019+vec2(7.1,19.3)));
  float cropVariant=hash12(floor(vWorld.xz*.0107+vec2(43.7,11.9)));
  vec3 base=mix(vec3(.225,.315,.150),vec3(.335,.410,.225),elevation);
  base=mix(base,vec3(.365,.285,.168),smoothstep(.32,.82,slope)*.52+max(0.0,n-.82)*.16);
  base*=mix(.80,1.10,n*.55); base=mix(base,base*vec3(.70,.82,.72),wet*.24);
  float strata=.5+.5*sin(vWorld.y*.43+vWorld.x*.014+vWorld.z*.009+n*3.1);
  float ledge=smoothstep(.76,.96,strata);
  vec3 limestone=mix(vec3(.345,.355,.335),vec3(.805,.810,.755),elevation*.30+n*.08+ledge*.35);
  base=mix(base,limestone,rock*.975);
  float c1=codeMask(landCode,1.0),c2=codeMask(landCode,2.0),c3=codeMask(landCode,3.0),c4=codeMask(landCode,4.0);
  float c5=codeMask(landCode,5.0),c6=codeMask(landCode,6.0),c7=codeMask(landCode,7.0),c8=codeMask(landCode,8.0);
  vec3 dryA=mix(vec3(.48,.45,.16),vec3(.62,.54,.19),cropVariant);
  vec3 dryB=mix(vec3(.36,.40,.16),vec3(.52,.46,.18),parcelNoise);
  vec3 vegA=cropVariant<.33?vec3(.12,.43,.17):(cropVariant<.66?vec3(.20,.48,.40):vec3(.47,.60,.29));
  vec3 vegB=parcelNoise<.5?vec3(.17,.52,.25):vec3(.38,.63,.39);
  vec3 farm=c1*vec3(.37,.47,.23)+c2*dryA+c3*dryB+c4*vegA+c5*vegB+c6*vec3(.12,.30,.10)+c7*vec3(.17,.34,.10)+c8*vec3(.29,.34,.12);
  float cf=max(max(max(c1,c2),max(c3,c4)),max(max(c5,c6),max(c7,c8))); farm/=max(cf,.001);
  farm*=mix(.84,1.14,parcelNoise); farm+=row*vec3(.06,.08,.02); base=mix(base,farm,farmMask);
  vec3 paddy=stage<1.5?vec3(.255,.495,.545):(stage<2.5?vec3(.235,.570,.225):(stage<3.5?vec3(.470,.585,.180):vec3(.505,.400,.190)));
  if(uSeason>1.5&&uSeason<2.5)paddy=mix(paddy,vec3(.61,.50,.16),.46); if(uSeason>2.5)paddy=mix(paddy,vec3(.40,.33,.20),.60);
  paddy*=mix(.89,1.10,parcelNoise); paddy+=row*vec3(.075,.090,.020); base=mix(base,paddy,paddyMask);
  float bundCore=smoothstep(.82,.98,parcel),bundShoulder=smoothstep(.54,.84,parcel)*(1.0-bundCore);
  vec3 bundSoil=mix(vec3(.205,.145,.072),vec3(.305,.325,.120),wet*.45+cropVariant*.20);
  base=mix(base,bundSoil,bundCore*.82); base=mix(base,mix(bundSoil,vec3(.46,.425,.185),.42),bundShoulder*.38);
  float va=clamp(1.0-voronoiF1(vWorld.xz/11.5)*1.55,0.0,1.0);
  float vb=clamp(1.0-voronoiF1(vWorld.xz/23.0+19.7)*1.44,0.0,1.0);
  float vc=clamp(1.0-voronoiF1(vWorld.xz/47.0-vec2(11.3,27.8))*1.34,0.0,1.0);
  float crownPattern=clamp(pow(va,mix(.48,2.22,hash12(floor(vWorld.xz/84.0))))*.70+vb*.31+vc*.17,0.0,1.0)*forest;
  vec3 forestGround=mix(vec3(.038,.130,.060),vec3(.155,.335,.145),n*.34+elevation*.24);
  forestGround*=mix(1.0,mix(.61,1.34,crownPattern),forest*.82); base=mix(base,forestGround,forest*.93);
  float erosion=smoothstep(.07,.62,tributary)*(1.0-water)*uErosionStrength;
  float erosionCore=smoothstep(.42,.90,tributary)*(1.0-water)*uErosionStrength;
  float erosionShoulder=smoothstep(.12,.44,tributary)*(1.0-smoothstep(.48,.82,tributary))*(1.0-water)*uErosionStrength;
  base=mix(base,base*vec3(.42,.58,.46),erosion*.44); base=mix(base,vec3(.095,.125,.082),erosionCore*.58); base=mix(base,vec3(.245,.235,.155),erosionShoulder*.16); base=mix(base,base*vec3(.82,.89,.78),terrace*.18);
  vec3 geomN=normalize(cross(dFdx(vWorld),dFdy(vWorld))); if(geomN.y<0.0)geomN=-geomN;
  vec3 N=normalize(mix(vNormal,geomN,.72)); vec3 V=normalize(uCameraPos-vWorld); vec3 L=normalize(uSunDir);
  float light=.44+.66*max(dot(N,L)*.72+.28,0.0)+.10*max(dot(N,-L),0.0);
  vec3 color=base*light*(1.0-.13*slope-.14*forest-.07*wet-.09*erosionCore);
  if(water>.01){float rip=sin(vWorld.x*.047+uTime*1.35)+sin(vWorld.z*.061-uTime*.82);vec3 WN=normalize(vec3(cos(vWorld.x*.045+uTime)*.025,1.0,sin(vWorld.z*.052-uTime*.7)*.025));float fres=pow(1.0-max(dot(WN,V),0.0),2.4);float spec=pow(max(dot(reflect(-L,WN),V),0.0),52.0);vec3 wc=mix(vec3(.085,.215,.265),vec3(.305,.505,.545),fres*.58+.12);wc*=.91+.035*rip;wc+=vec3(.76,.84,.79)*spec*.66*uWaterLevel;color=mix(color,wc,clamp(water*(.76+.24*uWaterLevel),0.0,1.0));}
  color=mix(color,vec3(.08,.58,.86),uHydrologyDiagnostics*water*.55);
  float bankDiag=smoothstep(.015,.12,wet)*(1.0-water)*uHydrologyDiagnostics; color=mix(color,vec3(.82,.58,.16),bankDiag*.42);
  float dist=length(uCameraPos-vWorld); float fog=smoothstep(2450.0,6200.0,dist);
  color=mix(color,uFogColor,fog*.88); color=mix(base,color,uShowEcology*.94+.06); color=pow(clamp(color,0.0,1.25),vec3(.88)); outColor=vec4(color,1.0);
}`;

const spriteVS = `${common}
layout(location=0) in vec3 aBase; layout(location=1) in float aHeight; layout(location=2) in float aSize; layout(location=3) in float aSeed; layout(location=4) in float aSpecies;
uniform mat4 uViewProj; uniform vec3 uCameraPos; uniform float uVerticalEx; uniform float uViewportHeight; uniform float uFov; uniform float uTime; uniform float uWind; uniform float uDensity; uniform float uType;
out float vSeed; out float vSpecies; out float vFade; out float vType;
void main(){float keep=step(aSeed,min(uDensity,1.0));float sid=floor(aSpecies+.5);float conifer=step(7.5,sid)*(1.0-step(9.5,sid));float bamboo=step(9.5,sid)*(1.0-step(11.5,sid));float shrub=step(11.5,sid)*(1.0-step(15.5,sid));float orchard=step(15.5,sid);float center=mix(.70,.55,max(conifer,bamboo));center=mix(center,.48,shrub);center=mix(center,.60,orchard);float phase=aSeed*41.0;float sway=(sin(uTime*(.45+fract(aSeed*7.13))+phase)+.35*sin(uTime*1.7+phase*2.3))*uWind*aHeight*.045;vec3 world=vec3(aBase.x+sway,aBase.y*uVerticalEx+aHeight*center,aBase.z+sway*.36);float pointWorld=max(aSize,max(aHeight*.83*conifer,aHeight*.78*bamboo));pointWorld=max(pointWorld,aHeight*1.25*shrub);float dist=max(length(uCameraPos-world),1.0);float px=pointWorld*uViewportHeight/(2.0*tan(uFov*.5)*dist);px*=mix(.92,1.16,fract(aSeed*91.7));gl_PointSize=clamp(px*1.40,1.0,248.0)*keep;gl_Position=uViewProj*vec4(world,1.0);vSeed=aSeed;vSpecies=aSpecies;vType=uType;vFade=keep*smoothstep(.65,2.1,px)*(1.0-smoothstep(2750.0,5200.0,dist));}`;

const spriteFS = `${common}
in float vSeed; in float vSpecies; in float vFade; in float vType; out vec4 outColor; uniform float uSeason;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float blob(vec2 p,vec2 c,float r,vec2 s){return 1.0-smoothstep(r*.74,r,length((p-c)/s));}
vec3 speciesColor(float sid){if(sid<.5)return vec3(.045,.205,.090);if(sid<1.5)return vec3(.120,.315,.125);if(sid<2.5)return vec3(.145,.330,.135);if(sid<3.5)return vec3(.055,.235,.095);if(sid<4.5)return vec3(.175,.355,.145);if(sid<5.5)return vec3(.050,.205,.080);if(sid<6.5)return vec3(.095,.260,.090);if(sid<7.5)return vec3(.105,.285,.110);if(sid<8.5)return vec3(.095,.285,.165);if(sid<9.5)return vec3(.095,.240,.135);if(sid<10.5)return vec3(.185,.430,.170);if(sid<11.5)return vec3(.115,.330,.130);if(sid<12.5)return vec3(.165,.365,.150);if(sid<15.5)return vec3(.140,.330,.125);if(sid<16.5)return vec3(.075,.255,.075);if(sid<17.5)return vec3(.100,.285,.075);if(sid<18.5)return vec3(.255,.325,.095);return vec3(.155,.300,.105);}
void main(){if(vFade<.02)discard;vec2 p=gl_PointCoord*2.0-1.0;p.y=-p.y;float sid=floor(vSpecies+.5);float seed=vSeed*6.2831853;float broad=max(blob(p,vec2(0),.82,vec2(1,.86)),max(blob(p,vec2(-.42,.02),.58,vec2(.94,.82)),blob(p,vec2(.42,-.02),.60,vec2(.96,.82))));broad=max(broad,max(blob(p,vec2(-.18,.42),.48,vec2(1,.9)),blob(p,vec2(.22,.39),.50,vec2(1,.92))));float y01=clamp((p.y+1.0)*.5,0.0,1.0);float hw=mix(.79,.045,y01);float conifer=(1.0-smoothstep(hw*.78,hw,abs(p.x)))*smoothstep(-1.0,-.86,p.y)*(1.0-smoothstep(.88,1.0,p.y));float bamboo=max(blob(p,vec2(-.25,.25),.55,vec2(.55,1.1)),blob(p,vec2(.25,.38),.55,vec2(.55,1.1)));float shrub=max(blob(p,vec2(0,-.18),.80,vec2(1.26,.62)),max(blob(p,vec2(-.43,-.08),.55,vec2(1.08,.68)),blob(p,vec2(.43,-.08),.55,vec2(1.08,.68))));float orchard=max(blob(p,vec2(0,.02),.82,vec2(.94,.9)),max(blob(p,vec2(-.28,.10),.48,vec2(.92,.88)),blob(p,vec2(.28,.08),.48,vec2(.92,.88))));float mask=broad;if(sid>7.5&&sid<9.5)mask=conifer;else if(sid>9.5&&sid<11.5)mask=bamboo;else if(sid>11.5&&sid<15.5)mask=shrub;else if(sid>15.5)mask=orchard;if(vType>.5)mask=shrub;float leafA=hash21(floor((p+vSeed*5.3)*23.0));float leafB=hash21(floor((p+vSeed*8.1)*47.0));float alpha=smoothstep(.055,.245,mask)*mix(.58,1.0,smoothstep(.44,.72,leafA))*vFade;alpha*=mix(.88,1.12,leafB);if(alpha<.085)discard;vec3 col=speciesColor(sid);if(uSeason>1.5&&uSeason<2.5)col=mix(col,vec3(.34,.37,.12),sid<8.0?.18:.08);if(uSeason>2.5)col=mix(col,vec3(.22,.27,.13),sid<8.0?.34:.18);float sphere=sqrt(max(0.0,1.0-dot(p*.72,p*.72)));float volume=clamp(.48+.72*dot(normalize(vec3(-p.x*.72,p.y*.58,sphere)),normalize(vec3(-.52,.68,.72))),.35,1.28);col*=volume*mix(.86,1.14,leafA*.55+leafB*.45);outColor=vec4(col,alpha);}`;

const trunkVS = `${common}
layout(location=0) in vec3 aBase; layout(location=1) in float aOffset; layout(location=2) in float aSeed; layout(location=3) in float aSpecies;
uniform mat4 uViewProj; uniform vec3 uCameraPos; uniform float uVerticalEx; uniform float uDensity; out float vAlpha; out float vSpecies;
void main(){float keep=step(aSeed,min(uDensity,1.0));vec3 world=vec3(aBase.x,aBase.y*uVerticalEx+aOffset,aBase.z);float dist=length(uCameraPos-world);float sid=floor(aSpecies+.5);float shrub=step(11.5,sid)*(1.0-step(15.5,sid));vAlpha=keep*(1.0-smoothstep(1200.0,3600.0,dist))*(1.0-shrub*.92);vSpecies=sid;gl_Position=uViewProj*vec4(world,1.0);}`;
const trunkFS = `${common}in float vAlpha;in float vSpecies;out vec4 outColor;void main(){if(vAlpha<.02)discard;vec3 c=vec3(.17,.105,.045);if(vSpecies>9.5&&vSpecies<11.5)c=vec3(.20,.30,.10);else if(vSpecies>15.5)c=vec3(.20,.125,.052);outColor=vec4(c,vAlpha*.78);}`;

const riceVS = `${common}
layout(location=0) in vec3 aBase;layout(location=1) in float aHeight;layout(location=2) in float aStage;layout(location=3) in float aSeed;
uniform mat4 uViewProj;uniform vec3 uCameraPos;uniform float uVerticalEx;uniform float uViewportHeight;uniform float uFov;uniform float uTime;uniform float uWind;uniform float uDetail;out float vSeed;out float vStage;out float vFade;
void main(){float keep=step(aSeed,min(uDetail,1.0));float sway=(sin(uTime*1.8+aSeed*53.0)+.35*sin(uTime*3.2+aSeed*97.0))*uWind*aHeight*.13;vec3 world=vec3(aBase.x+sway,aBase.y*uVerticalEx+aHeight*.55,aBase.z+sway*.25);float dist=max(length(uCameraPos-world),1.0);float px=3.1*uViewportHeight/(2.0*tan(uFov*.5)*dist);gl_PointSize=clamp(px,1.0,42.0)*keep;gl_Position=uViewProj*vec4(world,1.0);vSeed=aSeed;vStage=aStage;vFade=keep*smoothstep(1.1,3.2,px)*(1.0-smoothstep(1150.0,2100.0,dist));}`;
const riceFS = `${common}
in float vSeed;in float vStage;in float vFade;out vec4 outColor;uniform float uSeason;
float lineMask(vec2 p,float slope,float offset,float width){float x=p.x-(p.y+1.0)*slope-offset;return smoothstep(width,0.0,abs(x))*smoothstep(-1.0,-.25,p.y)*(1.0-smoothstep(.70,1.0,p.y));}
void main(){if(vFade<.02)discard;vec2 p=gl_PointCoord*2.0-1.0;p.y=-p.y;float m=clamp(lineMask(p,.25,-.10,.12)+lineMask(p,-.21,.10,.115)+lineMask(p,.06,0.0,.10),0.0,1.0);if(m<.08)discard;vec3 col=vStage>2.5?vec3(.49,.61,.16):vec3(.28,.65,.24);if(uSeason>1.5&&uSeason<2.5)col=mix(col,vec3(.68,.54,.15),.62);if(uSeason>2.5)col=mix(col,vec3(.39,.31,.16),.68);outColor=vec4(col,m*vFade*.92);}`;

function compileShader(type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`${label}着色器错误：${gl.getShaderInfoLog(shader)}`);
  return shader;
}
function createProgram(vs, fs, label) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vs, label));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fs, label));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`${label}程序错误：${gl.getProgramInfoLog(program)}`);
  return program;
}
function uniforms(program, names) { return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])); }
function buffer(target, data) { const value = gl.createBuffer(); gl.bindBuffer(target, value); gl.bufferData(target, data, gl.STATIC_DRAW); return value; }

const terrainProgram = createProgram(terrainVS, terrainFS, '地形');
const spriteProgram = createProgram(spriteVS, spriteFS, '树冠');
const trunkProgram = createProgram(trunkVS, trunkFS, '树干');
const riceProgram = createProgram(riceVS, riceFS, '稻株');
const terrainU = uniforms(terrainProgram, ['uViewProj','uVerticalEx','uField0','uField1','uField2','uCameraPos','uSunDir','uFogColor','uTime','uSeason','uForestDensity','uWaterLevel','uShowForest','uShowPaddy','uShowWater','uShowRock','uShowTerrace','uShowEcology','uErosionStrength','uKarstStrength','uHydrologyDiagnostics']);
const spriteU = uniforms(spriteProgram, ['uViewProj','uCameraPos','uVerticalEx','uViewportHeight','uFov','uTime','uWind','uDensity','uType','uSeason']);
const trunkU = uniforms(trunkProgram, ['uViewProj','uCameraPos','uVerticalEx','uDensity']);
const riceU = uniforms(riceProgram, ['uViewProj','uCameraPos','uVerticalEx','uViewportHeight','uFov','uTime','uWind','uDetail','uSeason']);

function textureFromImage(image, unit) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}
textureFromImage(field0Image, 0); textureFromImage(field1Image, 1); textureFromImage(field2Image, 2);

function buildTerrain(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength !== meshN * meshN * 2) throw new Error(`高程网格长度错误：${view.byteLength}`);
  const heights = new Float32Array(meshN * meshN);
  for (let index = 0; index < heights.length; index++) heights[index] = view.getUint16(index * 2, true) / 65535 * reliefM;
  const vertices = new Float32Array(meshN * meshN * 8);
  const step = sideM / (meshN - 1);
  for (let row = 0; row < meshN; row++) for (let column = 0; column < meshN; column++) {
    const index = row * meshN + column;
    const left = heights[row * meshN + Math.max(0, column - 1)];
    const right = heights[row * meshN + Math.min(meshN - 1, column + 1)];
    const down = heights[Math.max(0, row - 1) * meshN + column];
    const up = heights[Math.min(meshN - 1, row + 1) * meshN + column];
    const normal = Vec3.normalize([-(right - left) / (step * 2), 1, -(up - down) / (step * 2)]);
    const offset = index * 8;
    vertices[offset] = column / (meshN - 1) * sideM - halfM;
    vertices[offset + 1] = heights[index];
    vertices[offset + 2] = row / (meshN - 1) * sideM - halfM;
    vertices[offset + 3] = normal[0]; vertices[offset + 4] = normal[1]; vertices[offset + 5] = normal[2];
    vertices[offset + 6] = column / (meshN - 1); vertices[offset + 7] = row / (meshN - 1);
  }
  const indices = new Uint32Array((meshN - 1) * (meshN - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < meshN - 1; row++) for (let column = 0; column < meshN - 1; column++) {
    const index = row * meshN + column;
    indices[cursor++] = index; indices[cursor++] = index + meshN; indices[cursor++] = index + 1;
    indices[cursor++] = index + 1; indices[cursor++] = index + meshN; indices[cursor++] = index + meshN + 1;
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); buffer(gl.ARRAY_BUFFER, vertices);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
  buffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bindVertexArray(null);
  return { vao, heights, count: indices.length };
}

function decodeTrees(arrayBuffer) {
  const stride = manifest.recordLayout.tree.stride, count = Math.floor(arrayBuffer.byteLength / stride), view = new DataView(arrayBuffer);
  const points = new Float32Array(count * 7), trunks = new Float32Array(count * 12);
  for (let index = 0; index < count; index++) {
    const offset = index * stride, qx = view.getUint16(offset, true), qz = view.getUint16(offset + 2, true), qg = view.getUint16(offset + 4, true);
    const height = 1 + view.getUint8(offset + 6) / 255 * 28, crown = .8 + view.getUint8(offset + 7) / 255 * 16;
    const seed = view.getUint16(offset + 8, true) / 65535, species = view.getUint8(offset + 10);
    const x = qx / 65535 * sideM - halfM, z = qz / 65535 * sideM - halfM, ground = qg / 65535 * reliefM;
    points.set([x, ground, z, height, crown, seed, species], index * 7);
    let trunkTop = height * .62; if (species >= 8 && species <= 9) trunkTop = height * .72; else if (species >= 10 && species <= 11) trunkTop = height * .84; else if (species >= 12 && species <= 15) trunkTop = height * .16;
    trunks.set([x, ground, z, 0, seed, species, x, ground, z, trunkTop, seed, species], index * 12);
  }
  return { points, trunks, count };
}
function decodeShrubs(arrayBuffer) {
  const stride = manifest.recordLayout.shrub.stride, count = Math.floor(arrayBuffer.byteLength / stride), view = new DataView(arrayBuffer), points = new Float32Array(count * 7);
  for (let index = 0; index < count; index++) { const offset = index * stride; points.set([view.getUint16(offset,true)/65535*sideM-halfM,view.getUint16(offset+4,true)/65535*reliefM,view.getUint16(offset+2,true)/65535*sideM-halfM,.5+view.getUint8(offset+6)/255*6.5,.8+view.getUint8(offset+7)/255*8,view.getUint16(offset+8,true)/65535,12+(index%4)],index*7); }
  return { points, count };
}
function decodeRice(arrayBuffer) {
  const stride = manifest.recordLayout.rice.stride, count = Math.floor(arrayBuffer.byteLength / stride), view = new DataView(arrayBuffer), points = new Float32Array(count * 6);
  for (let index = 0; index < count; index++) { const offset = index * stride; points.set([view.getUint16(offset,true)/65535*sideM-halfM,view.getUint16(offset+4,true)/65535*reliefM,view.getUint16(offset+2,true)/65535*sideM-halfM,view.getUint8(offset+6)/255*1.4,view.getUint8(offset+7),view.getUint16(offset+8,true)/65535],index*6); }
  return { points, count };
}
function spriteVao(points, components) { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); buffer(gl.ARRAY_BUFFER, points); const stride = components * 4; for (let index = 0; index < components; index++) { gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, 1, gl.FLOAT, false, stride, index * 4); } gl.bindVertexArray(null); return vao; }
function treeVao(points) { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); buffer(gl.ARRAY_BUFFER, points); const stride=28; gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0); for(let i=1;i<5;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,1,gl.FLOAT,false,stride,(i+2)*4);} gl.bindVertexArray(null); return vao; }
function trunkVao(points) { const vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer(gl.ARRAY_BUFFER,points);const stride=24;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);for(let i=1;i<4;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,1,gl.FLOAT,false,stride,(i+2)*4);}gl.bindVertexArray(null);return vao; }
function riceVao(points) { const vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer(gl.ARRAY_BUFFER,points);const stride=24;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);for(let i=1;i<4;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,1,gl.FLOAT,false,stride,(i+2)*4);}gl.bindVertexArray(null);return vao; }

const terrain = buildTerrain(heightBuffer);
const trees = decodeTrees(treesBuffer), shrubs = decodeShrubs(shrubsBuffer), rice = decodeRice(riceBuffer);
const objects = { terrain, tree: { vao: treeVao(trees.points), trunkVao: trunkVao(trees.trunks), count: trees.count }, shrub: { vao: treeVao(shrubs.points), count: shrubs.count }, rice: { vao: riceVao(rice.points), count: rice.count } };

function sampleHeight(x, z) {
  const u = (x / sideM + .5) * (meshN - 1), v = (z / sideM + .5) * (meshN - 1);
  if (u < 0 || u > meshN - 1 || v < 0 || v > meshN - 1) return null;
  const x0=Math.floor(u),z0=Math.floor(v),x1=Math.min(meshN-1,x0+1),z1=Math.min(meshN-1,z0+1),tx=u-x0,tz=v-z0;
  return lerp(lerp(terrain.heights[z0*meshN+x0],terrain.heights[z0*meshN+x1],tx),lerp(terrain.heights[z1*meshN+x0],terrain.heights[z1*meshN+x1],tx),tz);
}

const presets = {
  aerial:{target:[-90,118,60],distance:4250,azimuth:-.84,elevation:.57},water:{target:[-120,82,-130],distance:2080,azimuth:-.58,elevation:.66},paddy:{target:[-650,58,-1080],distance:1180,azimuth:2.72,elevation:.44},forest:{target:[760,132,-330],distance:1120,azimuth:2.20,elevation:.39},karst:{target:[965,194,377],distance:920,azimuth:2.42,elevation:.31},erosion:{target:[896,82,-312],distance:760,azimuth:2.58,elevation:.30},bamboo:{target:[-420,42,-40],distance:560,azimuth:1.95,elevation:.30},orchard:{target:[-435,76,845],distance:720,azimuth:-2.25,elevation:.34},top:{target:[0,100,0],distance:3900,azimuth:0,elevation:1.515}
};
const camera = { target:[...presets.aerial.target],desiredTarget:[...presets.aerial.target],distance:presets.aerial.distance,desiredDistance:presets.aerial.distance,azimuth:presets.aerial.azimuth,desiredAzimuth:presets.aerial.azimuth,elevation:presets.aerial.elevation,desiredElevation:presets.aerial.elevation,fov:radians(43),eye:[0,0,0],view:Mat4.identity(),proj:Mat4.identity(),viewProj:Mat4.identity(),inverseViewProj:Mat4.identity(),mode:'orbit',groundClearanceM:1.7,nearM:2,farM:12000,altitudeAboveGroundM:0};
const state = { verticalEx:1.6,forestDensity:1,riceDetail:1,waterLevel:1,wind:.34,season:0,showForest:1,showShrubs:1,showPaddy:1,showRice:1,showWater:1,showRock:1,showTerrace:1,showEcology:1,erosionStrength:1,karstStrength:1,hydrologyDiagnostics:0,currentView:'aerial' };

function applyPreset(name, instant=false){const preset=presets[name]||presets.aerial;camera.mode='orbit';camera.desiredTarget=[...preset.target];camera.desiredDistance=preset.distance;camera.desiredAzimuth=preset.azimuth;camera.desiredElevation=preset.elevation;state.currentView=name;document.querySelectorAll('.preset').forEach((button)=>button.classList.toggle('active',button.dataset.view===name));if(instant){camera.target=[...preset.target];camera.distance=preset.distance;camera.azimuth=preset.azimuth;camera.elevation=preset.elevation;}}
function setCameraMode(mode){camera.mode=mode==='ground'?'ground':'orbit';if(camera.mode==='ground'){camera.groundClearanceM=1.7;camera.desiredDistance=8;camera.desiredElevation=.08;}$('#groundModeButton').classList.toggle('active',camera.mode==='ground');$('#orbitModeButton').classList.toggle('active',camera.mode==='orbit');}

function resize(){const ratio=Math.min(devicePixelRatio||1,1.65),width=Math.max(1,Math.round(innerWidth*ratio)),height=Math.max(1,Math.round(innerHeight*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}}
function updateCamera(dt){camera.target[0]=damp(camera.target[0],camera.desiredTarget[0],7,dt);camera.target[2]=damp(camera.target[2],camera.desiredTarget[2],7,dt);const targetGround=sampleHeight(camera.target[0],camera.target[2]);if(targetGround!=null)camera.target[1]=damp(camera.target[1],targetGround*state.verticalEx+.25,9,dt);camera.distance=damp(camera.distance,camera.desiredDistance,7,dt);camera.azimuth=damp(camera.azimuth,camera.desiredAzimuth,7,dt);camera.elevation=damp(camera.elevation,camera.desiredElevation,7,dt);const ce=Math.cos(camera.elevation);let eye=[camera.target[0]+camera.distance*ce*Math.sin(camera.azimuth),camera.target[1]+camera.distance*Math.sin(camera.elevation),camera.target[2]+camera.distance*ce*Math.cos(camera.azimuth)];const rawGround=sampleHeight(eye[0],eye[2])??0,eyeGround=rawGround*state.verticalEx,minimumEye=eyeGround+Math.max(camera.groundClearanceM,state.showWater?.35*state.waterLevel:0);if(camera.mode==='ground'){eye[1]=minimumEye;const lookDistance=12;camera.target[0]=clamp(eye[0]-Math.sin(camera.azimuth)*lookDistance,-halfM,halfM);camera.target[2]=clamp(eye[2]-Math.cos(camera.azimuth)*lookDistance,-halfM,halfM);camera.target[1]=(sampleHeight(camera.target[0],camera.target[2])??rawGround)*state.verticalEx+1.55;}else if(eye[1]<minimumEye)eye[1]=minimumEye;camera.eye=eye;camera.altitudeAboveGroundM=Math.max(0,eye[1]-eyeGround);camera.nearM=camera.mode==='ground'?Math.min(.22,Math.max(.08,camera.altitudeAboveGroundM*.08)):Math.min(2,Math.max(.12,camera.altitudeAboveGroundM*.04));camera.farM=Math.max(12000,camera.distance*4.5);camera.view=Mat4.lookAt(camera.eye,camera.target,[0,1,0]);camera.proj=Mat4.perspective(camera.fov,canvas.width/Math.max(1,canvas.height),camera.nearM,camera.farM);camera.viewProj=Mat4.multiply(camera.proj,camera.view);camera.inverseViewProj=Mat4.invert(camera.viewProj);$('#compass').style.setProperty('--compass-rot',`${-camera.azimuth*180/Math.PI}deg`);$('#cameraDiag').textContent=`mode ${camera.mode}\nclearance ${camera.altitudeAboveGroundM.toFixed(2)} m\ndistance ${camera.distance.toFixed(1)} m\nnear ${camera.nearM.toFixed(2)} m · far ${camera.farM.toFixed(0)} m\ngrid ${meshN} × ${meshN}`;}
function pointerRay(clientX,clientY){if(!camera.inverseViewProj)return null;const rect=canvas.getBoundingClientRect(),x=(clientX-rect.left)/rect.width*2-1,y=1-(clientY-rect.top)/rect.height*2,near=Mat4.transformPoint(camera.inverseViewProj,[x,y,-1,1]),far=Mat4.transformPoint(camera.inverseViewProj,[x,y,1,1]);return{origin:near,direction:Vec3.normalize(Vec3.sub(far,near))};}
function rayTerrainHit(ray){if(!ray)return null;let tMin=0,tMax=12000;for(const axis of [0,2]){const origin=ray.origin[axis],direction=ray.direction[axis];if(Math.abs(direction)<1e-7){if(origin<-halfM||origin>halfM)return null;}else{let t1=(-halfM-origin)/direction,t2=(halfM-origin)/direction;if(t1>t2)[t1,t2]=[t2,t1];tMin=Math.max(tMin,t1);tMax=Math.min(tMax,t2);if(tMin>tMax)return null;}}let previousT=Math.max(tMin,0),previousPoint=Vec3.add(ray.origin,Vec3.scale(ray.direction,previousT)),previousHeight=sampleHeight(previousPoint[0],previousPoint[2]);if(previousHeight==null)return null;let previousF=previousPoint[1]-previousHeight*state.verticalEx;for(let index=1;index<=96;index++){const t=lerp(tMin,tMax,index/96),point=Vec3.add(ray.origin,Vec3.scale(ray.direction,t)),height=sampleHeight(point[0],point[2]);if(height==null)continue;const f=point[1]-height*state.verticalEx;if(previousF>=0&&f<=0){let low=previousT,high=t;for(let pass=0;pass<15;pass++){const mid=(low+high)/2,midPoint=Vec3.add(ray.origin,Vec3.scale(ray.direction,mid)),midHeight=sampleHeight(midPoint[0],midPoint[2]);if(midPoint[1]-midHeight*state.verticalEx>0)low=mid;else high=mid;}const hit=Vec3.add(ray.origin,Vec3.scale(ray.direction,(low+high)/2)),relative=sampleHeight(hit[0],hit[2]);return{x:hit[0],z:hit[2],elevation:minH+relative};}previousT=t;previousF=f;}return null;}

const keys=new Set();window.addEventListener('keydown',(event)=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;keys.add(event.code);if(event.code==='Escape')setCameraMode('orbit');});window.addEventListener('keyup',(event)=>keys.delete(event.code));
function updateGroundMovement(dt){if(camera.mode!=='ground')return;const forward=[-Math.sin(camera.azimuth),0,-Math.cos(camera.azimuth)],right=[Math.cos(camera.azimuth),0,-Math.sin(camera.azimuth)];let x=0,z=0;if(keys.has('KeyW')||keys.has('ArrowUp')){x+=forward[0];z+=forward[2];}if(keys.has('KeyS')||keys.has('ArrowDown')){x-=forward[0];z-=forward[2];}if(keys.has('KeyA')||keys.has('ArrowLeft')){x-=right[0];z-=right[2];}if(keys.has('KeyD')||keys.has('ArrowRight')){x+=right[0];z+=right[2];}const length=Math.hypot(x,z);if(length<1e-5)return;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?18:6;camera.target[0]=clamp(camera.target[0]+x/length*speed*dt,-halfM+2,halfM-2);camera.target[2]=clamp(camera.target[2]+z/length*speed*dt,-halfM+2,halfM-2);camera.desiredTarget[0]=camera.target[0];camera.desiredTarget[2]=camera.target[2];}

let dragging=null;canvas.addEventListener('contextmenu',(event)=>event.preventDefault());canvas.addEventListener('pointerdown',(event)=>{canvas.setPointerCapture(event.pointerId);dragging={id:event.pointerId,x:event.clientX,y:event.clientY,button:event.button};canvas.style.cursor=event.button===2?'move':'grabbing';});canvas.addEventListener('pointermove',(event)=>{if(dragging&&dragging.id===event.pointerId){const dx=event.clientX-dragging.x,dy=event.clientY-dragging.y;dragging.x=event.clientX;dragging.y=event.clientY;if(dragging.button===2||event.shiftKey){const forward=Vec3.normalize([camera.target[0]-camera.eye[0],0,camera.target[2]-camera.eye[2]]),right=Vec3.normalize([forward[2],0,-forward[0]]),scale=Math.max(1,camera.distance*.0012);camera.desiredTarget[0]=clamp(camera.desiredTarget[0]+(-right[0]*dx+forward[0]*dy)*scale,-halfM,halfM);camera.desiredTarget[2]=clamp(camera.desiredTarget[2]+(-right[2]*dx+forward[2]*dy)*scale,-halfM,halfM);}else{camera.desiredAzimuth-=dx*.0065;camera.desiredElevation=clamp(camera.desiredElevation-dy*.0055,.03,1.535);}}else{const hit=rayTerrainHit(pointerRay(event.clientX,event.clientY));if(hit)$('#coordLabel').textContent=`E ${(aoi.centerProjected[0]+hit.x).toFixed(1)} · N ${(aoi.centerProjected[1]+hit.z).toFixed(1)} · Z ${hit.elevation.toFixed(1)} m`;}});canvas.addEventListener('pointerup',(event)=>{if(dragging?.id===event.pointerId)dragging=null;canvas.style.cursor='grab';});canvas.addEventListener('pointercancel',()=>{dragging=null;canvas.style.cursor='grab';});canvas.addEventListener('wheel',(event)=>{event.preventDefault();setCameraMode('orbit');camera.desiredDistance=clamp(camera.desiredDistance*Math.exp(event.deltaY*.00105),1.25,7200);},{passive:false});canvas.addEventListener('dblclick',(event)=>{const hit=rayTerrainHit(pointerRay(event.clientX,event.clientY));if(!hit)return;setCameraMode('orbit');camera.desiredTarget=[hit.x,(hit.elevation-minH)*state.verticalEx+.25,hit.z];camera.desiredDistance=Math.max(18,Math.min(camera.desiredDistance*.42,850));showToast(`聚焦地表 Z ${hit.elevation.toFixed(1)} m`);});canvas.style.cursor='grab';

function bindUi(){document.querySelectorAll('.preset').forEach((button)=>button.addEventListener('click',()=>applyPreset(button.dataset.view)));for(const [id,key,format] of [['verticalEx','verticalEx',(v)=>`${v.toFixed(1)}×`],['forestDensity','forestDensity',(v)=>`${Math.round(v*100)}%`],['riceDetail','riceDetail',(v)=>`${Math.round(v*100)}%`],['waterLevel','waterLevel',(v)=>`${Math.round(v*100)}%`],['wind','wind',(v)=>`${Math.round(v*100)}%`],['erosionStrength','erosionStrength',(v)=>`${Math.round(v*100)}%`],['karstStrength','karstStrength',(v)=>`${Math.round(v*100)}%`]]){const input=$(`#${id}`),output=$(`#${id}Out`);input.addEventListener('input',()=>{state[key]=Number(input.value);output.value=format(state[key]);});}for(const key of ['showForest','showShrubs','showPaddy','showRice','showWater','showRock','showTerrace','showEcology'])$(`#${key}`).addEventListener('change',(event)=>state[key]=event.target.checked?1:0);$('#season').addEventListener('change',(event)=>{state.season=Number(event.target.value);$('#seasonLabel').textContent=['1944 夏季','强降雨期','秋季收割','冬季休耕'][state.season];});$('#hydrologySurface').addEventListener('change',(event)=>{state.showWater=event.target.checked?1:0;$('#showWater').checked=event.target.checked;});for(const id of ['hydrologyBanks','hydrologyDiagnostics'])$(`#${id}`).addEventListener('change',()=>state.hydrologyDiagnostics=$('#hydrologyBanks').checked||$('#hydrologyDiagnostics').checked?1:0);$('#namedHydrology').addEventListener('change',(event)=>{if(event.target.checked){event.target.checked=false;showToast('漓江与湘江命名拓扑资产仍在构建，发布门槛保持关闭。',4300);}});$('#groundModeButton').addEventListener('click',()=>setCameraMode('ground'));$('#orbitModeButton').addEventListener('click',()=>setCameraMode('orbit'));document.querySelectorAll('.core-btn').forEach((button)=>button.addEventListener('click',()=>{if(button.dataset.core==='yangtang-airfield')return;showToast(`${button.textContent.replace(' · 数据待绑定','')}真实 12.5 米核心 DEM 和生态字段仍在绑定。`,4200);}));}

function render(time,dt){resize();updateGroundMovement(dt);updateCamera(dt);const fogColor=state.season===1?[.57,.66,.65]:state.season===2?[.67,.65,.52]:state.season===3?[.61,.64,.58]:[.55,.64,.62],sunDir=state.season===1?[-.28,.80,-.43]:[-.46,.78,-.42];gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);gl.depthMask(true);gl.useProgram(terrainProgram);gl.bindVertexArray(objects.terrain.vao);gl.uniformMatrix4fv(terrainU.uViewProj,false,camera.viewProj);gl.uniform1f(terrainU.uVerticalEx,state.verticalEx);gl.uniform3fv(terrainU.uCameraPos,camera.eye);gl.uniform3fv(terrainU.uSunDir,sunDir);gl.uniform3fv(terrainU.uFogColor,fogColor);gl.uniform1f(terrainU.uTime,time);gl.uniform1f(terrainU.uSeason,state.season);gl.uniform1f(terrainU.uForestDensity,state.forestDensity);gl.uniform1f(terrainU.uWaterLevel,state.waterLevel);gl.uniform1f(terrainU.uShowForest,state.showForest);gl.uniform1f(terrainU.uShowPaddy,state.showPaddy);gl.uniform1f(terrainU.uShowWater,state.showWater);gl.uniform1f(terrainU.uShowRock,state.showRock);gl.uniform1f(terrainU.uShowTerrace,state.showTerrace);gl.uniform1f(terrainU.uShowEcology,state.showEcology);gl.uniform1f(terrainU.uErosionStrength,state.erosionStrength);gl.uniform1f(terrainU.uKarstStrength,state.karstStrength);gl.uniform1f(terrainU.uHydrologyDiagnostics,state.hydrologyDiagnostics);gl.uniform1i(terrainU.uField0,0);gl.uniform1i(terrainU.uField1,1);gl.uniform1i(terrainU.uField2,2);gl.drawElements(gl.TRIANGLES,objects.terrain.count,gl.UNSIGNED_INT,0);if(state.showEcology&&state.showForest){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.useProgram(trunkProgram);gl.bindVertexArray(objects.tree.trunkVao);gl.uniformMatrix4fv(trunkU.uViewProj,false,camera.viewProj);gl.uniform3fv(trunkU.uCameraPos,camera.eye);gl.uniform1f(trunkU.uVerticalEx,state.verticalEx);gl.uniform1f(trunkU.uDensity,state.forestDensity);gl.drawArrays(gl.LINES,0,objects.tree.count*2);gl.useProgram(spriteProgram);gl.uniformMatrix4fv(spriteU.uViewProj,false,camera.viewProj);gl.uniform3fv(spriteU.uCameraPos,camera.eye);gl.uniform1f(spriteU.uVerticalEx,state.verticalEx);gl.uniform1f(spriteU.uViewportHeight,canvas.height);gl.uniform1f(spriteU.uFov,camera.fov);gl.uniform1f(spriteU.uTime,time);gl.uniform1f(spriteU.uWind,state.wind);gl.uniform1f(spriteU.uDensity,state.forestDensity);gl.uniform1f(spriteU.uType,0);gl.uniform1f(spriteU.uSeason,state.season);gl.bindVertexArray(objects.tree.vao);gl.drawArrays(gl.POINTS,0,objects.tree.count);if(state.showShrubs){gl.uniform1f(spriteU.uType,1);gl.uniform1f(spriteU.uDensity,Math.min(1,state.forestDensity*1.1));gl.bindVertexArray(objects.shrub.vao);gl.drawArrays(gl.POINTS,0,objects.shrub.count);}}if(state.showEcology&&state.showPaddy&&state.showRice){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.useProgram(riceProgram);gl.bindVertexArray(objects.rice.vao);gl.uniformMatrix4fv(riceU.uViewProj,false,camera.viewProj);gl.uniform3fv(riceU.uCameraPos,camera.eye);gl.uniform1f(riceU.uVerticalEx,state.verticalEx);gl.uniform1f(riceU.uViewportHeight,canvas.height);gl.uniform1f(riceU.uFov,camera.fov);gl.uniform1f(riceU.uTime,time);gl.uniform1f(riceU.uWind,state.wind);gl.uniform1f(riceU.uDetail,state.riceDetail);gl.uniform1f(riceU.uSeason,state.season);gl.drawArrays(gl.POINTS,0,objects.rice.count);}gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);}

bindUi();applyPreset('aerial',true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);$('#treeMetric').textContent=trees.count.toLocaleString('zh-CN');$('#shrubMetric').textContent=shrubs.count.toLocaleString('zh-CN');$('#riceMetric').textContent=rice.count.toLocaleString('zh-CN');window.DEMEcologySurface={ready:true,getState:()=>structuredClone(state),getManifest:()=>structuredClone(manifest),setCameraMode,setCameraPreset:(name)=>{applyPreset(name,true);return true;},setLayerVisibility:(id,visible)=>{const map={forest:'showForest',shrubs:'showShrubs',paddy:'showPaddy',rice:'showRice',water:'showWater',rock:'showRock',terrace:'showTerrace',ecology:'showEcology'};if(!map[id])return false;state[map[id]]=visible?1:0;return true;}};window.__GUILIN_RECOVERY_DIAGNOSTICS__={publicationBlocked:true,baseline:'v0.3.1',activeCore:'yangtang-airfield',detailedEcologyScope:'active-core-only',groundClearanceM:1.7};window.__DEMO_READY__=true;loading.classList.add('done');setTimeout(()=>loading.remove(),650);
let last=performance.now(),fpsStart=last,frames=0;function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;render(now/1000,dt);frames++;if(now-fpsStart>800){$('#fpsLabel').textContent=`${Math.round(frames*1000/(now-fpsStart))} FPS · ${state.currentView}`;fpsStart=now;frames=0;}requestAnimationFrame(loop);}requestAnimationFrame(loop);
