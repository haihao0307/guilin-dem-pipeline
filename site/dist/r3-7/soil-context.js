import * as THREE from 'three';

const MANIFEST_URL='./data/soil/soil-context.json';
const TERRAIN_URL='../r3-1/data/terrain.json';
const FLAG=Symbol.for('wenzhou.r3.7.soil-context-installed');
const VISUAL_LIFT_M=0.045;
const DEFAULT_OPACITY=0.54;
const DATA_BASE=new URL('./data/soil/',import.meta.url);

const PALETTES={
  clay:['#efe1bd','#b96e4b','#5d3129'],
  sand:['#efe0a9','#c59c52','#7d5b35'],
  silt:['#e6dec4','#9c8b6e','#5d574f'],
  soc:['#d8cfaa','#5d704d','#1f2e23'],
  phh2o:['#6d5e9b','#d4b05e','#5e8d5a'],
  bdod:['#e8dfcc','#9c8b7f','#4c4a4f'],
  cfvo:['#e2dacb','#9c8f7c','#4e4943'],
  wv0033:['#d9b476','#6e9da4','#315d78'],
};

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`R3.7 JSON读取失败 (${r.status})`);return r.json();});}
async function checkedBytes(url,expectedSha,expectedBytes){
  const r=await fetch(url);if(!r.ok)throw Error(`R3.7 SoilGrids读取失败 (${r.status})`);
  const b=await r.arrayBuffer();
  if(b.byteLength!==expectedBytes)throw Error(`R3.7 SoilGrids字节数不一致 ${b.byteLength} != ${expectedBytes}`);
  if(!crypto.subtle)throw Error('当前浏览器不能执行 R3.7 SHA-256 证据校验');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==expectedSha)throw Error(`R3.7 SoilGrids SHA-256 不一致: ${actual}`);
  return b;
}
function terrainOrigin(contract,patch){
  const t=contract.source.transform;
  const east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5);
  const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1));
  const n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
  return[(e0+e1)/2,(n0+n1)/2];
}
function isTerrainCandidate(object){
  return !!(object?.isMesh
    &&!object.userData?.wenzhouSeaDemo
    &&!object.userData?.wenzhouSurfaceEvidence
    &&!object.userData?.wenzhouLandcoverEvidence
    &&!object.userData?.wenzhouOsmEvidence
    &&!object.userData?.wenzhouSoilContextEvidence
    &&object.material?.alphaMap
    &&object.geometry?.attributes?.uv
    &&object.geometry?.attributes?.position);
}
function layerFor(manifest,prop,stat){
  const layer=manifest.layers.find(x=>x.property===prop&&x.statistic===stat);
  if(!layer)throw Error(`R3.7 缺少 SoilGrids ${prop} ${stat}`);
  return layer;
}
function clamp01(v){return Math.max(0,Math.min(1,v));}
function color(hex){return new THREE.Color(hex);}
function makeNormalizedTexture(raw,layer){
  const rows=layer.rows,cols=layer.columns,noData=layer.noData;
  const lo=Number(layer.statisticsRaw?.p05Raw),hi=Number(layer.statisticsRaw?.p95Raw);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)throw Error(`R3.7 ${layer.property} ${layer.statistic} percentile range invalid`);
  const out=new Uint8Array(raw.length);
  for(let r=0;r<rows;r++){
    const dstRow=(rows-1-r)*cols;
    const srcRow=r*cols;
    for(let c=0;c<cols;c++){
      const v=raw[srcRow+c];
      if(v===noData){out[dstRow+c]=0;continue;}
      const t=clamp01((v-lo)/(hi-lo));
      out[dstRow+c]=1+Math.round(t*254);
    }
  }
  const tex=new THREE.DataTexture(out,cols,rows,THREE.RedFormat,THREE.UnsignedByteType);
  tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.flipY=false;tex.needsUpdate=true;
  return tex;
}
function rawAtProjected(raw,layer,e,n){
  const gt=layer.geotransform;
  const c=Math.floor((e-gt[0])/gt[1]);
  const r=Math.floor((n-gt[3])/gt[5]);
  if(c<0||c>=layer.columns||r<0||r>=layer.rows)return null;
  const v=raw[r*layer.columns+c];
  return v===layer.noData?null:v;
}
function conventional(raw,layer){return raw===null?null:raw/Number(layer.conversionFactor||1);}
function formatValue(value,unit){
  if(value===null||!Number.isFinite(value))return '无有效模型值';
  const digits=Math.abs(value)>=100?0:Math.abs(value)>=10?1:2;
  return `${value.toFixed(digits)} ${unit}`;
}
function soilMaterial(valueTexture,uncTexture,landMask,origin,layer,palette,useUncertainty){
  const[west,south,east,north]=layer.bounds;
  const low=color(palette[0]),mid=color(palette[1]),high=color(palette[2]);
  return new THREE.ShaderMaterial({
    uniforms:{
      uValue:{value:valueTexture},uUncertainty:{value:uncTexture},uLandMask:{value:landMask},
      uOriginEN:{value:new THREE.Vector2(origin[0],origin[1])},
      uWestSouth:{value:new THREE.Vector2(west,south)},uEastNorth:{value:new THREE.Vector2(east,north)},
      uLow:{value:low},uMid:{value:mid},uHigh:{value:high},uOpacity:{value:DEFAULT_OPACITY},uUseUncertainty:{value:useUncertainty?1:0}
    },
    vertexShader:`
      varying vec2 vLocalXZ;varying vec2 vTerrainUv;varying vec3 vNormalV;
      void main(){vLocalXZ=position.xz;vTerrainUv=uv;vNormalV=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
    `,
    fragmentShader:`
      uniform sampler2D uValue;uniform sampler2D uUncertainty;uniform sampler2D uLandMask;
      uniform vec2 uOriginEN;uniform vec2 uWestSouth;uniform vec2 uEastNorth;
      uniform vec3 uLow;uniform vec3 uMid;uniform vec3 uHigh;uniform float uOpacity;uniform float uUseUncertainty;
      varying vec2 vLocalXZ;varying vec2 vTerrainUv;varying vec3 vNormalV;
      vec3 ramp(float t){return t<.5?mix(uLow,uMid,t*2.0):mix(uMid,uHigh,(t-.5)*2.0);}
      void main(){
        float land=texture2D(uLandMask,vTerrainUv).g;if(land<.5)discard;
        float e=uOriginEN.x+vLocalXZ.x*1000.0;float n=uOriginEN.y-vLocalXZ.y*1000.0;
        vec2 uv=(vec2(e,n)-uWestSouth)/(uEastNorth-uWestSouth);
        if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))discard;
        float vb=texture2D(uValue,uv).r*255.0;if(vb<.5)discard;
        float t=clamp((vb-1.0)/254.0,0.0,1.0);
        float ub=texture2D(uUncertainty,uv).r*255.0;
        float u=ub<.5?0.0:clamp((ub-1.0)/254.0,0.0,1.0);
        vec3 c=ramp(t);
        if(uUseUncertainty>.5){float gray=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(gray),u*.58);}
        float light=.67+.33*max(dot(normalize(vNormalV),normalize(vec3(-.35,.82,.46))),0.0);
        float alpha=uOpacity*(uUseUncertainty>.5?mix(1.0,.70,u):1.0);
        gl_FragColor=vec4(c*light,alpha);
      }
    `,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:THREE.FrontSide
  });
}

export function installSoilContext(){
  if(THREE.Object3D.prototype[FLAG])return;
  THREE.Object3D.prototype[FLAG]=true;
  const originalAdd=THREE.Object3D.prototype.add;
  const manifestPromise=fetchJson(MANIFEST_URL).then(m=>{
    if(m.schema!=='wenzhou-r3.7-soilgrids-browser-context/r1'||m.sourceIdentity!=='model_prediction_external_observation'||m.resolutionM!==250||m.truthBoundary?.canonicalTruth!==false||m.truthBoundary?.mayReplaceFieldSurvey!==false||m.truthBoundary?.mayOverrideCanonicalDem!==false||m.displayPolicy?.heightDisplacement!==false||m.displayPolicy?.uncertaintyIsRelativeIndex!==true)throw Error('R3.7 SoilGrids manifest evidence boundary mismatch');
    return m;
  });
  const contractPromise=fetchJson(TERRAIN_URL);
  let active=null,activeRenderer=null,activeScene=null,activeCamera=null,activeTerrain=null,buildToken=0;
  const cache=new Map();
  const canvas=()=>document.getElementById('terrain');
  function setDataset(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values)){if(v===null||v===undefined)delete c.dataset[k];else c.dataset[k]=String(v);}}
  function forceRender(){if(activeRenderer&&activeScene&&activeCamera)activeRenderer.render(activeScene,activeCamera);}
  function captureRenderer(terrain,scene){const prior=terrain.onAfterRender;terrain.onAfterRender=function(renderer,renderScene,camera,...rest){activeRenderer=renderer;activeScene=scene;activeCamera=camera;if(typeof prior==='function')prior.call(this,renderer,renderScene,camera,...rest);};}
  function dispose(){if(!active)return;active.scene.remove(active.mesh);active.mesh.geometry?.dispose();active.mesh.material?.dispose();active.valueTexture?.dispose();active.uncTexture?.dispose();active=null;}
  async function loadLayer(layer){
    const key=layer.sha256;
    if(cache.has(key))return cache.get(key);
    const b=await checkedBytes(new URL(layer.path,DATA_BASE),layer.sha256,layer.bytes);
    const raw=new Int16Array(b);
    if(raw.length!==layer.rows*layer.columns)throw Error(`R3.7 ${layer.property} ${layer.statistic} shape 不一致`);
    cache.set(key,raw);return raw;
  }
  function selectedProperty(){return document.getElementById('soil-property')?.value||'clay';}
  function uncertaintyEnabled(){return document.getElementById('show-soil-uncertainty')?.checked??true;}
  function overlayEnabled(){return document.getElementById('show-soil-context')?.checked??true;}
  function updateCard(manifest,median,unc,medianRaw,uncRaw,contract,patchId){
    const card=document.getElementById('soil-context-card');if(!card)return;card.hidden=false;
    const title=document.getElementById('soil-context-title'),status=document.getElementById('soil-context-status'),valueEl=document.getElementById('soil-context-value'),uncEl=document.getElementById('soil-context-uncertainty'),source=document.getElementById('soil-context-source');
    title.textContent=`SoilGrids · ${median.labelZh}`;
    status.textContent=`250 m 模型预测 · 0–5 cm · ${median.statistic}`;
    const query=contract.queries?.find(q=>q.patch===patchId);
    if(query){
      const[e,n]=query.position.coordinates;
      const rv=rawAtProjected(medianRaw,median,e,n),uv=rawAtProjected(uncRaw,unc,e,n);
      valueEl.textContent=`查询锚点 ${formatValue(conventional(rv,median),median.conventionalUnit)}`;
      uncEl.textContent=uv===null?'不确定性：无有效模型值':`不确定性相对指数 ${uv}`;
    }else{
      valueEl.textContent=`区域中位数约 ${formatValue(conventional(Number(median.statisticsRaw.p50Raw),median),median.conventionalUnit)}`;
      uncEl.textContent=`不确定性以独立相对层显示${uncertaintyEnabled()?'（已开启）':'（已关闭）'}`;
    }
    source.textContent='这是 SoilGrids 250 m 模型预测覆盖层；颜色只映射属性，灰化/透明度只表达相对不确定性。它不是现场土样、田块边界、12.5 m 土壤真值，也不改变 DEM 高度。';
  }
  async function buildForTerrain(scene,terrain){
    const token=++buildToken;activeTerrain=terrain;captureRenderer(terrain,scene);await new Promise(r=>requestAnimationFrame(r));
    const patchId=canvas()?.dataset.patch||document.getElementById('location')?.value||'';
    setDataset({soilContextLoaded:false,soilContextPatch:patchId,soilContextError:null});
    try{
      const[manifest,contract]=await Promise.all([manifestPromise,contractPromise]);if(token!==buildToken)return;
      const patch=contract.patches.find(p=>p.id===patchId);if(!patch)throw Error(`R3.7 缺少地形视域 ${patchId}`);
      const prop=selectedProperty(),median=layerFor(manifest,prop,'Q0.5'),unc=layerFor(manifest,prop,'uncertainty');
      const[medianRaw,uncRaw]=await Promise.all([loadLayer(median),loadLayer(unc)]);if(token!==buildToken)return;
      const[valueTexture,uncTexture]=[makeNormalizedTexture(medianRaw,median),makeNormalizedTexture(uncRaw,unc)];
      const origin=terrainOrigin(contract,patch),palette=PALETTES[prop]||PALETTES.clay;
      const material=soilMaterial(valueTexture,uncTexture,terrain.material.alphaMap,origin,median,palette,uncertaintyEnabled());
      const geometry=terrain.geometry.clone();const mesh=new THREE.Mesh(geometry,material);mesh.scale.copy(terrain.scale);mesh.position.y=VISUAL_LIFT_M/1000;mesh.renderOrder=1.65;mesh.visible=overlayEnabled();
      mesh.userData.wenzhouSoilContextEvidence=true;mesh.userData.kind='soilgrids-250m-model-context';mesh.userData.patch=patchId;mesh.userData.property=prop;mesh.userData.heightClaim='none';mesh.userData.visualLiftM=VISUAL_LIFT_M;
      dispose();active={scene,terrain,mesh,valueTexture,uncTexture,median,unc,medianRaw,uncRaw,manifest,contract};originalAdd.call(scene,mesh);updateCard(manifest,median,unc,medianRaw,uncRaw,contract,patchId);
      setDataset({
        soilContextKind:'soilgrids-250m-model-context',soilContextLoaded:true,soilContextVisible:mesh.visible,soilContextPatch:patchId,soilContextProperty:prop,soilContextPropertyLabel:median.labelZh,
        soilContextResolutionM:manifest.resolutionM,soilContextDepth:manifest.depth,soilContextMedianSha256:median.sha256,soilContextUncertaintySha256:unc.sha256,soilContextUncertaintyVisible:uncertaintyEnabled(),
        soilContextSourceReleaseTag:manifest.sourcePermanentReleaseTag,soilContextCanonicalTruth:false,soilContextFieldObservation:false,soilContextHeightClaim:'none',soilContextVisualLiftM:VISUAL_LIFT_M,soilContextError:null
      });forceRender();
    }catch(error){if(token!==buildToken)return;dispose();setDataset({soilContextKind:'error',soilContextLoaded:false,soilContextVisible:false,soilContextPatch:patchId,soilContextError:error.message});const card=document.getElementById('soil-context-card');if(card)card.hidden=true;console.error(error);}
  }
  THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);if(this.isScene)for(const object of objects)if(isTerrainCandidate(object)){void buildForTerrain(this,object);break;}return result;};
  const show=document.getElementById('show-soil-context');if(show&&!show.dataset.boundSoilContext){show.dataset.boundSoilContext='true';show.addEventListener('change',()=>{if(active)active.mesh.visible=show.checked;setDataset({soilContextVisible:!!active&&show.checked});forceRender();});}
  const prop=document.getElementById('soil-property');if(prop&&!prop.dataset.boundSoilContext){prop.dataset.boundSoilContext='true';prop.addEventListener('change',()=>{if(activeScene&&activeTerrain)void buildForTerrain(activeScene,activeTerrain);});}
  const unc=document.getElementById('show-soil-uncertainty');if(unc&&!unc.dataset.boundSoilContext){unc.dataset.boundSoilContext='true';unc.addEventListener('change',()=>{if(active?.mesh?.material?.uniforms?.uUseUncertainty)active.mesh.material.uniforms.uUseUncertainty.value=unc.checked?1:0;if(active)updateCard(active.manifest,active.median,active.unc,active.medianRaw,active.uncRaw,active.contract,canvas()?.dataset.patch||'');setDataset({soilContextUncertaintyVisible:unc.checked});forceRender();});}
}
