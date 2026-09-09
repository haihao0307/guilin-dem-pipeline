import * as THREE from 'three';

const MANIFEST_URL='./data/worldcover/worldcover-2021-context.json';
const SOURCE_RELEASE_SHA256='f558037e82ce38fac604291c6dc0327c931488c5167c7015e0dbdeae5a9ba0ad';
const TERRAIN_URL='../r3-1/data/terrain.json';
const FLAG=Symbol.for('wenzhou.r3.4.landcover-evidence-installed');
const VISUAL_LIFT_M=0.035;
const DEFAULT_OPACITY=0.48;
const CLASS_ZH={
  0:'无数据',10:'树木覆盖',20:'灌木地',30:'草地',40:'耕地',50:'建成区',60:'裸地/稀疏植被',70:'雪/冰',80:'永久水体',90:'草本湿地',95:'红树林',100:'苔藓/地衣'
};

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`R3.4 JSON读取失败 (${r.status})`);return r.json();});}
async function checkedBytes(url,expectedSha,expectedBytes){
  const r=await fetch(url);if(!r.ok)throw Error(`R3.4 土地覆盖读取失败 (${r.status})`);
  const b=await r.arrayBuffer();
  if(b.byteLength!==expectedBytes)throw Error(`R3.4 土地覆盖字节数不一致 ${b.byteLength} != ${expectedBytes}`);
  if(!crypto.subtle)throw Error('当前浏览器不能执行 R3.4 SHA-256 证据校验');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==expectedSha)throw Error(`R3.4 土地覆盖 SHA-256 不一致: ${actual}`);
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
  return !!(object?.isMesh&&!object.userData?.wenzhouSeaDemo&&!object.userData?.wenzhouSurfaceEvidence&&!object.userData?.wenzhouLandcoverEvidence&&object.material?.alphaMap&&object.geometry?.attributes?.uv&&object.geometry?.attributes?.position);
}
function flippedForGpu(src,rows,columns){
  const out=new Uint8Array(src.length);
  for(let r=0;r<rows;r++)out.set(src.subarray(r*columns,(r+1)*columns),(rows-1-r)*columns);
  return out;
}
function classAtProjected(src,meta,e,n){
  const gt=meta.geotransform;
  const c=Math.floor((e-gt[0])/gt[1]);
  const r=Math.floor((n-gt[3])/gt[5]);
  if(c<0||c>=meta.columns||r<0||r>=meta.rows)return null;
  return src[r*meta.columns+c];
}
function paletteMaterial(classTexture,landMask,origin,meta){
  const [west,south,east,north]=meta.bounds;
  return new THREE.ShaderMaterial({
    uniforms:{
      uClasses:{value:classTexture},uLandMask:{value:landMask},
      uOriginEN:{value:new THREE.Vector2(origin[0],origin[1])},
      uWestSouth:{value:new THREE.Vector2(west,south)},uEastNorth:{value:new THREE.Vector2(east,north)},
      uOpacity:{value:DEFAULT_OPACITY}
    },
    vertexShader:`
      varying vec2 vLocalXZ;varying vec2 vTerrainUv;varying vec3 vNormalV;
      void main(){vLocalXZ=position.xz;vTerrainUv=uv;vNormalV=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
    `,
    fragmentShader:`
      uniform sampler2D uClasses;uniform sampler2D uLandMask;uniform vec2 uOriginEN;uniform vec2 uWestSouth;uniform vec2 uEastNorth;uniform float uOpacity;
      varying vec2 vLocalXZ;varying vec2 vTerrainUv;varying vec3 vNormalV;
      vec3 classColor(float code){
        if(code<15.0)return vec3(.18,.43,.23);
        if(code<25.0)return vec3(.45,.53,.24);
        if(code<35.0)return vec3(.48,.62,.34);
        if(code<45.0)return vec3(.72,.66,.31);
        if(code<55.0)return vec3(.63,.38,.34);
        if(code<65.0)return vec3(.62,.56,.45);
        if(code<75.0)return vec3(.86,.91,.94);
        if(code<85.0)return vec3(.12,.43,.59);
        if(code<92.5)return vec3(.24,.55,.48);
        if(code<97.5)return vec3(.20,.48,.34);
        return vec3(.57,.62,.43);
      }
      void main(){
        float land=texture2D(uLandMask,vTerrainUv).g;if(land<.5)discard;
        float e=uOriginEN.x+vLocalXZ.x*1000.0;float n=uOriginEN.y-vLocalXZ.y*1000.0;
        vec2 uv=(vec2(e,n)-uWestSouth)/(uEastNorth-uWestSouth);
        if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))discard;
        float code=floor(texture2D(uClasses,uv).r*255.0+.5);if(code<5.0)discard;
        vec3 c=classColor(code);float light=.68+.32*max(dot(normalize(vNormalV),normalize(vec3(-.35,.82,.46))),0.0);
        gl_FragColor=vec4(c*light,uOpacity);
      }
    `,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:THREE.FrontSide
  });
}
function topClasses(meta){
  const pairs=Object.entries(meta.classCounts||{}).map(([k,v])=>[Number(k),Number(v)]).filter(([k,v])=>k!==0&&v>0).sort((a,b)=>b[1]-a[1]);
  const total=pairs.reduce((s,p)=>s+p[1],0)||1;
  return pairs.slice(0,4).map(([code,count])=>({code,count,name:CLASS_ZH[code]||`类别 ${code}`,share:count/total*100}));
}

export function installLandcoverEvidence(){
  if(THREE.Object3D.prototype[FLAG])return;
  THREE.Object3D.prototype[FLAG]=true;
  const originalAdd=THREE.Object3D.prototype.add;
  const manifestPromise=fetchJson(MANIFEST_URL).then(m=>{
    if(m.sourceReleaseAssetSha256!==SOURCE_RELEASE_SHA256||m.sourceIdentity!=='external_observation'||m.canonicalTruth!==false||m.individualObjectTruth!==false||m.productionReady!==false)throw Error('R3.4 WorldCover manifest evidence boundary mismatch');
    return m;
  });
  const contractPromise=fetchJson(TERRAIN_URL);
  let active=null,activeRenderer=null,activeScene=null,activeCamera=null,buildToken=0;
  const canvas=()=>document.getElementById('terrain');
  function forceRender(){if(activeRenderer&&activeScene&&activeCamera)activeRenderer.render(activeScene,activeCamera);}
  function captureRenderer(terrain,scene){
    const prior=terrain.onAfterRender;
    terrain.onAfterRender=function(renderer,renderScene,camera,...rest){activeRenderer=renderer;activeScene=scene;activeCamera=camera;if(typeof prior==='function')prior.call(this,renderer,renderScene,camera,...rest);};
  }
  function dispose(){
    if(!active)return;active.scene.remove(active.mesh);active.mesh.geometry?.dispose();active.mesh.material?.dispose();active.texture?.dispose();active=null;
  }
  function setDataset(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values)){if(v===null||v===undefined)delete c.dataset[k];else c.dataset[k]=String(v);}}
  function updateCard(meta,queryCode=null){
    const card=document.getElementById('landcover-card');if(!card)return;
    card.hidden=false;
    document.getElementById('landcover-title').textContent='ESA WorldCover 2021 · 土地覆盖证据';
    const exact=meta.exactNativeObservationCrop;
    document.getElementById('landcover-status').textContent=exact?`${meta.resolutionM} m 原类别裁块 · nearest`:`${meta.resolutionM} m mode 聚合 · 显示上下文`;
    const list=topClasses(meta);
    const metrics=document.getElementById('landcover-metrics');metrics.replaceChildren();
    for(const item of list){const b=document.createElement('b');b.textContent=`${item.name} ${item.share.toFixed(1)}%`;metrics.append(b);}
    document.getElementById('landcover-source').textContent=queryCode===null?'类别着色是显示调色板；不生成个体树木、建筑或田块。':`当前查询锚点像元：${CLASS_ZH[queryCode]||`类别 ${queryCode}`} (${queryCode})。这是 10 m 类别观察，不是个体 Object Truth。`;
  }
  function hideCard(){const card=document.getElementById('landcover-card');if(card)card.hidden=true;}
  async function buildForTerrain(scene,terrain){
    const token=++buildToken;captureRenderer(terrain,scene);await new Promise(resolve=>requestAnimationFrame(resolve));
    const patchId=canvas()?.dataset.patch||document.getElementById('location')?.value||'';
    try{
      const[manifest,contract]=await Promise.all([manifestPromise,contractPromise]);if(token!==buildToken)return;
      const meta=manifest.patches.find(p=>p.id===patchId),patch=contract.patches.find(p=>p.id===patchId);
      if(!meta||!patch)throw Error(`R3.4 缺少土地覆盖视域 ${patchId}`);
      const buffer=await checkedBytes(new URL(meta.path,import.meta.url),meta.sha256,meta.bytes);if(token!==buildToken)return;
      const src=new Uint8Array(buffer);if(src.length!==meta.rows*meta.columns)throw Error(`R3.4 ${patchId} 土地覆盖 shape 不一致`);
      const texture=new THREE.DataTexture(flippedForGpu(src,meta.rows,meta.columns),meta.columns,meta.rows,THREE.RedFormat,THREE.UnsignedByteType);
      texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;
      const origin=terrainOrigin(contract,patch);const material=paletteMaterial(texture,terrain.material.alphaMap,origin,meta);const geometry=terrain.geometry.clone();
      const mesh=new THREE.Mesh(geometry,material);mesh.scale.copy(terrain.scale);mesh.position.y=VISUAL_LIFT_M/1000;mesh.renderOrder=1.5;
      mesh.userData.wenzhouLandcoverEvidence=true;mesh.userData.kind='worldcover-2021-context';mesh.userData.patch=patchId;mesh.userData.heightClaim='none';mesh.userData.visualLiftM=VISUAL_LIFT_M;
      const checkbox=document.getElementById('show-landcover');mesh.visible=checkbox?.checked??false;
      dispose();active={scene,mesh,texture,meta,terrainUuid:terrain.uuid};originalAdd.call(scene,mesh);
      const query=contract.queries?.find(q=>q.patch===patchId);let queryCode=null;
      if(query){const[e,n]=query.position.coordinates;queryCode=classAtProjected(src,meta,e,n);}
      updateCard(meta,queryCode);
      const dominant=topClasses(meta)[0]||null;
      setDataset({
        landcoverKind:'worldcover-2021-context',landcoverVisible:mesh.visible,landcoverPatch:patchId,landcoverResolutionM:meta.resolutionM,
        landcoverRepresentation:meta.representation,landcoverExactNativeObservation:meta.exactNativeObservationCrop,landcoverDisplayAggregation:meta.displayAggregation,
        landcoverClassTextureSha256:meta.sha256,landcoverSourceReleaseSha256:SOURCE_RELEASE_SHA256,landcoverHeightClaim:'none',landcoverVisualLiftM:VISUAL_LIFT_M,
        landcoverDominantClassCode:dominant?.code,landcoverDominantClassName:dominant?.name,landcoverQueryClassCode:queryCode,landcoverDataOrientation:'source-row0-north-reversed-to-gpu-row0-south',landcoverLoaded:true,landcoverError:null
      });
      forceRender();
    }catch(error){if(token!==buildToken)return;dispose();hideCard();setDataset({landcoverKind:'error',landcoverVisible:false,landcoverPatch:patchId,landcoverLoaded:false,landcoverError:error.message});console.error(error);}
  }
  THREE.Object3D.prototype.add=function(...objects){
    const result=originalAdd.apply(this,objects);
    if(this.isScene)for(const object of objects)if(isTerrainCandidate(object)){void buildForTerrain(this,object);break;}
    return result;
  };
  const checkbox=document.getElementById('show-landcover');
  if(checkbox&&!checkbox.dataset.boundLandcoverEvidence){checkbox.dataset.boundLandcoverEvidence='true';checkbox.addEventListener('change',()=>{if(active)active.mesh.visible=checkbox.checked;setDataset({landcoverVisible:!!active&&checkbox.checked});forceRender();});}
}
