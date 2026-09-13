import * as THREE from 'three';

const EVIDENCE_URL='../../../inputs/knowledge-r2-2/OBJECT_EVIDENCE_R2_2.json';
const EVIDENCE_SHA256='642290d1076bd700634c1c719c890819b5035a3841e24f9c86f5a171b1875482';
const TERRAIN_URL='../r3-1/data/terrain.json';
const FLAG=Symbol.for('wenzhou.r3.3.surface-evidence-installed');
const SURFACE_RADIUS_M=48;
const VISUAL_LIFT_M=0.02;

function clamp01(v){return Math.max(0,Math.min(1,v));}
function mean(props,key){return Number(props?.[key]?.values?.mean);}
function patchIndex(id){const m=/^query-(\d{2})$/.exec(id||'');return m?Number(m[1]):null;}

async function fetchJsonChecked(url,expectedSha=null){
  const r=await fetch(url);
  if(!r.ok)throw Error(`R3.3 evidence fetch failed (${r.status})`);
  const b=await r.arrayBuffer();
  if(expectedSha&&crypto.subtle){
    const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
    if(actual!==expectedSha)throw Error(`R3.3 evidence SHA mismatch: ${actual}`);
  }
  return JSON.parse(new TextDecoder().decode(b));
}

function terrainOrigin(contract,patch){
  const t=contract.source.transform;
  const east=col=>t[2]+t[0]*(col+.5);
  const north=row=>t[5]+t[4]*(row+.5);
  const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1));
  const n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
  return[(e0+e1)/2,(n0+n1)/2];
}

function appearanceFromSoil(props){
  const clay=mean(props,'clay'),sand=mean(props,'sand'),silt=mean(props,'silt'),soc=mean(props,'soc');
  const cf=clamp01(clay/100),sf=clamp01(sand/100),sif=clamp01(silt/100),of=clamp01(soc/120);
  const r=clamp01(.31+.18*sf+.07*cf-.13*of);
  const g=clamp01(.255+.11*sif+.025*sf-.11*of);
  const b=clamp01(.17+.055*sif-.035*cf-.06*of);
  return{clay,sand,silt,soc,color:new THREE.Color(r,g,b)};
}

function makeMaterial(center,soil){
  return new THREE.ShaderMaterial({
    uniforms:{
      uCenter:{value:new THREE.Vector2(center[0],center[1])},
      uRadius:{value:SURFACE_RADIUS_M/1000},
      uBase:{value:soil.color},
      uSand:{value:clamp01(soil.sand/100)},
      uClay:{value:clamp01(soil.clay/100)},
      uSoc:{value:clamp01(soil.soc/120)}
    },
    vertexShader:`
      varying vec3 vNormalV;
      varying vec2 vLocalXZ;
      void main(){
        vLocalXZ=position.xz;
        vNormalV=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform vec3 uBase;
      uniform float uSand;
      uniform float uClay;
      uniform float uSoc;
      varying vec3 vNormalV;
      varying vec2 vLocalXZ;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+17.7;a*=.5;}return s;}
      void main(){
        float d=distance(vLocalXZ,uCenter);
        float alpha=1.0-smoothstep(uRadius*.78,uRadius,d);
        if(alpha<=.002)discard;
        vec2 m=(vLocalXZ-uCenter)*1000.0;
        float macro=fbm(m*.055);
        float meso=fbm(m*.38+vec2(7.3,19.1));
        float grain=hash(floor(m*3.5));
        float clod=smoothstep(.56,.84,meso)*uClay;
        float grit=smoothstep(.72,.94,grain)*uSand;
        float organic=(.5-macro)*uSoc;
        vec3 c=uBase;
        c*=.88+.22*macro;
        c+=vec3(.085,.065,.035)*grit;
        c-=vec3(.055,.045,.03)*clod;
        c-=vec3(.05,.04,.025)*organic;
        vec3 lightDir=normalize(vec3(-.35,.82,.46));
        float ndl=max(dot(normalize(vNormalV),lightDir),0.0);
        c*=.54+.46*ndl;
        gl_FragColor=vec4(c,alpha*.9);
      }
    `,
    transparent:true,
    depthWrite:false,
    polygonOffset:true,
    polygonOffsetFactor:-1,
    polygonOffsetUnits:-1,
    side:THREE.FrontSide
  });
}

function isTerrainCandidate(object){
  return !!(object?.isMesh&&!object.userData?.wenzhouSeaDemo&&!object.userData?.wenzhouSurfaceEvidence&&object.material?.alphaMap&&object.geometry?.attributes?.uv&&object.geometry?.attributes?.position);
}

export function installSurfaceEvidence(){
  if(THREE.Object3D.prototype[FLAG])return;
  THREE.Object3D.prototype[FLAG]=true;
  const originalAdd=THREE.Object3D.prototype.add;
  let active=null;
  const evidencePromise=fetchJsonChecked(EVIDENCE_URL,EVIDENCE_SHA256);
  const terrainPromise=fetchJsonChecked(TERRAIN_URL);

  function canvas(){return document.getElementById('terrain');}
  function setState(kind='none',visible=false,patch=''){
    const c=canvas();if(!c)return;
    c.dataset.surfaceEvidenceKind=kind;
    c.dataset.surfaceVisible=String(visible);
    c.dataset.surfacePatch=patch;
    c.dataset.surfaceEvidenceSha256=EVIDENCE_SHA256;
  }
  function dispose(){
    if(!active)return;
    active.scene.remove(active.mesh);
    active.mesh.geometry?.dispose();
    active.mesh.material?.dispose();
    active=null;
  }
  function hideCard(){const card=document.getElementById('surface-card');if(card)card.hidden=true;}
  function fillCard(record,soil,patchId){
    const card=document.getElementById('surface-card');if(!card)return;
    card.hidden=false;
    document.getElementById('surface-title').textContent=`${record.label} · 土壤外观演示`;
    document.getElementById('surface-status').textContent='SoilGrids 250 m 模型预测 · 0–5 cm';
    document.getElementById('surface-clay').textContent=`黏土 ${soil.clay.toFixed(1)}%`;
    document.getElementById('surface-sand').textContent=`砂 ${soil.sand.toFixed(1)}%`;
    document.getElementById('surface-silt').textContent=`粉砂 ${soil.silt.toFixed(1)}%`;
    document.getElementById('surface-soc').textContent=`SOC ${soil.soc.toFixed(1)} g/kg`;
    document.getElementById('surface-source').textContent='颜色与微观颗粒是程序化外观映射；不是现场照片、实测纹理或新增地形高度。';
    card.dataset.patch=patchId;
  }

  async function buildForTerrain(scene,terrain){
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const c=canvas();
    const patchId=c?.dataset.patch||document.getElementById('location')?.value||'';
    const idx=patchIndex(patchId);
    if(!idx){dispose();hideCard();setState('none',false,patchId);return;}
    try{
      const[evidence,contract]=await Promise.all([evidencePromise,terrainPromise]);
      const record=evidence.objects?.find(o=>o.id===`WZ-R1-COLOCATION-${String(idx).padStart(2,'0')}`);
      const patch=contract.patches?.find(p=>p.id===patchId);
      if(!record||!patch)throw Error(`R3.3 missing query evidence for ${patchId}`);
      const props=record.measurements?.soil?.properties;
      const soil=appearanceFromSoil(props);
      if(![soil.clay,soil.sand,soil.silt,soil.soc].every(Number.isFinite))throw Error(`R3.3 incomplete soil evidence for ${patchId}`);
      const origin=terrainOrigin(contract,patch);
      const[e,n]=record.position.coordinates;
      const center=[(e-origin[0])/1000,(origin[1]-n)/1000];
      dispose();
      const geometry=terrain.geometry.clone();
      const material=makeMaterial(center,soil);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.scale.copy(terrain.scale);
      mesh.position.y=VISUAL_LIFT_M/1000;
      mesh.userData.wenzhouSurfaceEvidence=true;
      mesh.userData.kind='soil-model-appearance-demo';
      mesh.userData.patch=patchId;
      mesh.userData.radiusM=SURFACE_RADIUS_M;
      mesh.userData.visualLiftM=VISUAL_LIFT_M;
      const checkbox=document.getElementById('show-surface');
      mesh.visible=checkbox?checkbox.checked:true;
      active={scene,mesh,terrainUuid:terrain.uuid};
      originalAdd.call(scene,mesh);
      fillCard(record,soil,patchId);
      setState('soil-model-appearance-demo',mesh.visible,patchId);
      c.dataset.surfaceClayPct=String(soil.clay);
      c.dataset.surfaceSandPct=String(soil.sand);
      c.dataset.surfaceSiltPct=String(soil.silt);
      c.dataset.surfaceSocGkg=String(soil.soc);
      c.dataset.surfaceRadiusM=String(SURFACE_RADIUS_M);
      c.dataset.surfaceVisualLiftM=String(VISUAL_LIFT_M);
      c.dataset.surfaceHeightClaim='none';
    }catch(error){
      dispose();hideCard();setState('error',false,patchId);
      if(c)c.dataset.surfaceEvidenceError=error.message;
      console.error(error);
    }
  }

  THREE.Object3D.prototype.add=function(...objects){
    const result=originalAdd.apply(this,objects);
    if(this.isScene){
      for(const object of objects){
        if(isTerrainCandidate(object)){void buildForTerrain(this,object);break;}
      }
    }
    return result;
  };

  const checkbox=document.getElementById('show-surface');
  if(checkbox&&!checkbox.dataset.boundSurfaceEvidence){
    checkbox.dataset.boundSurfaceEvidence='true';
    checkbox.addEventListener('change',()=>{
      if(active)active.mesh.visible=checkbox.checked;
      const c=canvas();if(c)c.dataset.surfaceVisible=String(!!active&&checkbox.checked);
    });
  }
}
