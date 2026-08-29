const SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
const DATA_ROOT = '/guilin-dem-pipeline/yangshuo-lijiang-2048-v300/data';
const RIVER_URL = '/guilin-dem-pipeline/yangshuo-noise-terrain-v310/data/lijiang_osm.geojson';
const BUILD_VERSION = '3201';
const SOURCE_GRID = 2048;
const SOURCE_SPACING = 12.5;
const REGIONAL_EXTENT = 20480;
const CONTEXT_EXTENT = 6400;
const DETAIL_EXTENT = 512;
const RIVER_SAMPLE_METERS = 4;
const EXPECTED_REFERENCE_SHA = 'b1711f4c3c119e6a0620b6a06561cb2eab4c1823e251b52d8153b47d4674f7bd';

const CANDIDATES = {
  A:{id:'A',name:'阳朔县城北侧漓江峰丛谷地',bounds:[437150,2731925,462750,2757525],center:[110.504749,24.816544]},
  C:{id:'C',name:'兴坪南侧九马画山漓江贴水峡谷段',bounds:[436800,2738400,462400,2764000],center:[110.501051,24.875008]},
  D:{id:'D',name:'相公山至兴坪第一湾',bounds:[437312.5,2742887.5,462912.5,2768487.5],center:[110.505964,24.915551]}
};

const PRESETS = {
  atlas:{id:'atlas',candidate:'A',title:'金标准 01 · 峰林与稻田谷地总体关系',focusMode:'atlas',detailMode:'paddy',view:'overview'},
  paddy:{id:'paddy',candidate:'A',title:'冲积平原田、缓坡梯田与连续田埂',focusMode:'paddy',detailMode:'paddy',view:'valley'},
  cliff:{id:'cliff',candidate:'D',title:'塔峰峰壁、短促峰脚与非对称轮廓',focusMode:'cliff',detailMode:'cliff',view:'ground'},
  river:{id:'river',candidate:'C',title:'漓江主槽、岸坡、河床横断面与连续水面',focusMode:'river',detailMode:'river',view:'valley'}
};

const params = new URL(location.href).searchParams;
const isMobile = params.get('mobile') === '1' || innerWidth <= 700;
const REGIONAL_GRID = isMobile ? 129 : 257;
const CONTEXT_GRID = isMobile ? 257 : 513;
const DETAIL_GRID = isMobile ? 257 : 513;
const DETAIL_SPACING = DETAIL_EXTENT / (DETAIL_GRID - 1);

const $ = id => document.getElementById(id);
const ui = {
  loading:$('loading'),loadingTitle:$('loadingTitle'),loadingText:$('loadingText'),progressBar:$('progressBar'),progressLabel:$('progressLabel'),progressValue:$('progressValue'),retry:$('retryButton'),
  statusMain:$('statusMain'),statusSub:$('statusSub'),title:$('title')
};

const state = {
  preset:PRESETS.atlas,
  macro:1,
  process:.78,
  bund:.70,
  river:1,
  enhanceMix:1,
  tone:true,
  wire:false,
  buildToken:0,
  sourceIndex:null,
  candidateCache:new Map(),
  riverGeoJSON:null,
  projectedRiverLines:null,
  currentBuild:null,
  rebuildTimer:null
};

let renderer,scene,camera,controls,sun,terrainGroup;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const fract=x=>x-Math.floor(x);
const radians=d=>d*Math.PI/180;

function progress(value,label,text){
  const pct=clamp(Math.round(value),0,100);
  ui.progressBar.style.width=pct+'%';ui.progressValue.textContent=pct+'%';ui.progressLabel.textContent=label;
  if(text)ui.loadingText.textContent=text;
}
function setStatus(main,sub=''){ui.statusMain.textContent=main;ui.statusSub.textContent=sub}
function setBusy(busy){document.querySelectorAll('.preset,.action').forEach(b=>{if(b.id!=='truthToggle'&&b.id!=='wireToggle'&&b.id!=='toneToggle')b.disabled=busy})}
function showLoading(title,text){ui.loading.hidden=false;ui.loading.style.display='grid';ui.loading.style.visibility='visible';ui.loading.style.opacity='1';ui.loading.style.pointerEvents='auto';ui.loadingTitle.textContent=title;ui.loadingText.classList.remove('error');ui.loadingText.textContent=text;ui.retry.style.display='none'}
function hideLoading(){ui.loading.style.opacity='0';ui.loading.style.pointerEvents='none';setTimeout(()=>{if(Number(getComputedStyle(ui.loading).opacity)<=.05){ui.loading.hidden=true;ui.loading.style.display='none';ui.loading.style.visibility='hidden'}},430)}
function showError(error){console.error(error);ui.loading.hidden=false;ui.loading.style.display='grid';ui.loading.style.visibility='visible';ui.loading.style.opacity='1';ui.loading.style.pointerEvents='auto';ui.loadingTitle.textContent='地貌图谱构建失败';ui.loadingText.classList.add('error');ui.loadingText.textContent=(error?.stack||error?.message||String(error))+'\n\n请刷新页面重试。';ui.retry.style.display='block';progress(0,'失败');setStatus('加载失败','保留失败现场');setBusy(false);window.__terrainV320QA={ready:false,error:String(error)}}

function hash21(x,z,seed=0){return fract(Math.sin(x*127.1+z*311.7+seed*74.7)*43758.5453123)}
function valueNoise(x,z,seed=0){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  const a=hash21(ix,iz,seed),b=hash21(ix+1,iz,seed),c=hash21(ix,iz+1,seed),d=hash21(ix+1,iz+1,seed);
  return lerp(lerp(a,b,ux),lerp(c,d,ux),uz)*2-1;
}
function fbm(x,z,seed=0,octaves=5){let sum=0,amp=.5,freq=1,norm=0;for(let i=0;i<octaves;i++){sum+=valueNoise(x*freq,z*freq,seed+i*17.13)*amp;norm+=amp;freq*=2.03;amp*=.5}return sum/norm}
function ridged(x,z,seed=0,octaves=4){let sum=0,amp=.55,freq=1,norm=0;for(let i=0;i<octaves;i++){let n=1-Math.abs(valueNoise(x*freq,z*freq,seed+i*29.7));n*=n;sum+=n*amp;norm+=amp;freq*=2.07;amp*=.52}return sum/norm}
function domainWarp(x,z,seed=0){const qx=fbm(x*.77+3.1,z*.77-1.7,seed+11,3),qz=fbm(x*.77-5.2,z*.77+4.3,seed+37,3);return[x+qx*.85,z+qz*.85]}
function worley(x,z,seed=0){
  const ix=Math.floor(x),iz=Math.floor(z);let f1=1e9,f2=1e9,cellX=0,cellZ=0;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const cx=ix+dx,cz=iz+dz;const px=cx+hash21(cx,cz,seed),pz=cz+hash21(cx,cz,seed+19.37);
    const dd=(px-x)*(px-x)+(pz-z)*(pz-z);
    if(dd<f1){f2=f1;f1=dd;cellX=cx;cellZ=cz}else if(dd<f2)f2=dd;
  }
  return{f1:Math.sqrt(f1),f2:Math.sqrt(f2),cellX,cellZ};
}
function edgeFeather(x,z,extent,band=0.12){const half=extent*.5;const d=Math.min(half-Math.abs(x),half-Math.abs(z));return smoothstep(0,extent*band,d)}

async function sha256Hex(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')}

async function initRenderer(){
  renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL:params.get('webgl')==='1'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.25:1.6));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;
  await renderer.init();$('viewer').appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0xc9d0c8);scene.fog=new THREE.Fog(0xc9d0c8,8500,22000);
  camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.5,50000);camera.position.set(5200,2700,6000);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=35;controls.maxDistance=24000;controls.maxPolarAngle=Math.PI*.495;
  const hemi=new THREE.HemisphereLight(0xe6ece6,0x6e685c,1.5);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff5dc,3.2);sun.position.set(-5200,7200,3600);sun.castShadow=true;sun.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048);sun.shadow.camera.near=100;sun.shadow.camera.far=18000;sun.shadow.camera.left=-6500;sun.shadow.camera.right=6500;sun.shadow.camera.top=6500;sun.shadow.camera.bottom=-6500;sun.shadow.bias=-.0002;scene.add(sun);
