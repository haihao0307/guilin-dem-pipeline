import * as THREE from 'three';
import {terrainOrigin,isTerrainCandidate} from './soil-context.js';

const BASE=new URL('./data/',import.meta.url);
const COLORS=['#ad734e','#7d98b2','#ddab6c','#675955','#e4ce95','#d2b487','#8ca478','#b78760','#c1cdd5','#c9a777','#b84d38','#75a898','#638d85','#d8c6a2','#4f4d39','#ad8255','#a3a39b','#c58555','#9a875f','#9f5449','#67664d','#9ba7a1','#b67256','#a58e84','#d0bb9a','#d9cbdd','#bba9c6','#799d9a','#7a7566','#777466'];
const $=id=>document.getElementById(id);
const mode=()=>$('evidence-mode')?.value||'soil';
const manifestCache=new Map(),bufferCache=new Map();
async function manifest(family){
  if(manifestCache.has(family))return manifestCache.get(family);
  const url=new URL(family==='wrb'?'wrb/wrb-context.json':'water/water-context.json',BASE);
  const r=await fetch(url);if(!r.ok)throw Error(`证据索引读取失败 ${r.status}`);
  const m=await r.json();
  if(m.truthBoundary?.canonicalTruth!==false||m.grid?.crs!=='EPSG:32651'||m.grid?.rows!==1003||m.grid?.columns!==884)throw Error('证据身份或参考架不符');
  if(family==='wrb'&&(m.schema!=='wenzhou-r3.8-wrb-browser-context/r1'||m.probabilityLayers?.length!==30))throw Error('WRB 索引不符');
  if(family==='water'&&(m.schema!=='wenzhou-r3.8-historical-water/r1'||m.truthBoundary.currentWaterLevel!==false))throw Error('历史水体边界不符');
  manifestCache.set(family,m);return m;
}
async function bytes(rec,family,signal){
  if(bufferCache.has(rec.sha256))return bufferCache.get(rec.sha256);
  const r=await fetch(new URL(family+'/'+rec.path,BASE),{signal});if(!r.ok)throw Error(`证据读取失败 ${r.status}`);
  const b=await r.arrayBuffer();if(b.byteLength!==rec.bytes)throw Error('证据长度不符');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==rec.sha256)throw Error('证据 SHA-256 不符');
  signal.throwIfAborted();const a=new Uint8Array(b);bufferCache.set(rec.sha256,a);
  while(bufferCache.size>4)bufferCache.delete(bufferCache.keys().next().value);
  return a;
}
function rgba(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];}
function palette(m,selected,rec){
  if(selected==='water')return rec.palette.map(x=>({code:Number(x.value),label:x.label,color:x.color}));
  if(selected==='wrb-difference')return [{code:0,label:'分类一致',color:'#6e9985'},{code:1,label:'分类不同',color:'#ef915f'}];
  if(selected==='wrb-probability')return Array.from({length:255},(_,code)=>{const t=Math.min(code/100,1);return {code,label:`源概率分数 ${code}`,color:'#'+[Math.round(237-195*t),Math.round(217-97*t),Math.round(166-29*t)].map(x=>x.toString(16).padStart(2,'0')).join('')};});
  return m.legend.map(x=>({code:x.code,label:x.name,color:COLORS[x.code]}));
}
function texture(raw,grid,colors){
  const lut=new Map(colors.map(x=>[x.code,rgba(x.color)]));const data=new Uint8Array(raw.length*4);
  for(let r=0;r<grid.rows;r++)for(let c=0;c<grid.columns;c++){
    const v=raw[r*grid.columns+c],color=lut.get(v);if(v===255||!color)continue;
    data.set(color,((grid.rows-1-r)*grid.columns+c)*4);
  }
  const t=new THREE.DataTexture(data,grid.columns,grid.rows,THREE.RGBAFormat);
  t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;
}
function material(tex,mask,origin,bounds){
  return new THREE.ShaderMaterial({uniforms:{uEvidence:{value:tex},uLand:{value:mask},uOrigin:{value:new THREE.Vector2(...origin)},uBounds:{value:new THREE.Vector4(...bounds)}},
    vertexShader:`varying vec2 localXZ;varying vec2 terrainUV;void main(){localXZ=position.xz;terrainUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D uEvidence;uniform sampler2D uLand;uniform vec2 uOrigin;uniform vec4 uBounds;varying vec2 localXZ;varying vec2 terrainUV;void main(){if(texture2D(uLand,terrainUV).g<.5)discard;vec2 en=uOrigin+vec2(localXZ.x,-localXZ.y)*1000.;vec2 p=(en-uBounds.xy)/(uBounds.zw-uBounds.xy);if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,vec2(1.))))discard;vec4 v=texture2D(uEvidence,p);if(v.a<.5)discard;gl_FragColor=vec4(v.rgb,.68);}`,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
}
export function sampleGrid(raw,grid,e,n){
  const t=grid.geotransform,c=Math.floor((e-t[0])/t[1]),r=Math.floor((n-t[3])/t[5]);
  if(c<0||r<0||c>=grid.columns||r>=grid.rows)return null;
  const v=raw[r*grid.columns+c];return v===255?null:v;
}
export function installEnvironmentContext(){
  let scene,terrain,renderer,camera,active,abort,token=0;
  const captured=new WeakSet(),original=THREE.Object3D.prototype.add;
  const contract=fetch(new URL('../r3-1/data/terrain.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('地形参考架读取失败');return r.json();});
  const state=(values)=>{for(const[k,v]of Object.entries(values))$('terrain').dataset[k]=String(v);};
  const render=()=>{if(renderer&&scene&&camera)renderer.render(scene,camera);};
  const dispose=()=>{if(active){active.scene.remove(active.mesh);active.mesh.geometry.dispose();active.mesh.material.dispose();active.tex.dispose();active=null;}};
  function controls(){
    const selected=mode();$('environment-help').textContent=selected==='water'?'JRC 历史观察；不代表当前水位。':'250 m 土壤模型证据；不代替现场土样。';$('soil-settings').hidden=selected!=='soil';$('wrb-settings').hidden=selected!=='wrb-probability';$('water-settings').hidden=selected!=='water';
    $('soil-context-card').hidden=selected!=='soil';$('environment-card').hidden=selected==='soil';
  }
  async function build(){
    const current=++token;abort?.abort();abort=new AbortController();const signal=abort.signal;
    dispose();controls();render();const selected=mode();state({environmentLoaded:false,environmentVisible:false,environmentError:''});
    if(selected==='soil'||!scene||!terrain)return;
    const currentScene=scene,currentTerrain=terrain;
    $('environment-title').textContent=selected==='water'?'JRC · 历史水体':'WRB · 土壤分类证据';
    $('environment-status').textContent='读取并校验证据…';$('environment-value').textContent='';$('environment-legend').replaceChildren();$('environment-retry').hidden=true;
    try{
      await new Promise(r=>requestAnimationFrame(r));
      const patchId=$('terrain').dataset.patch,family=selected==='water'?'water':'wrb';
      const [m,c]=await Promise.all([manifest(family),contract]);if(current!==token)return;
      if(family==='wrb'&&!$('wrb-class').options.length)for(const cls of m.legend)$('wrb-class').add(new Option(cls.name,String(cls.code)));
      let rec;
      if(selected==='water')rec=m.layers.find(x=>x.product===$('water-product').value);
      else if(selected==='wrb-probability')rec=m.probabilityLayers.find(x=>x.code===Number($('wrb-class').value));
      else rec=m.outputs[{'wrb-official':'officialMostProbable','wrb-derived':'postAlignmentArgmax','wrb-difference':'classificationDisagreement'}[selected]];
      if(!rec)throw Error('找不到当前证据');
      const raw=await bytes(rec,family,signal);if(current!==token)return;
      if(raw.length!==m.grid.rows*m.grid.columns)throw Error('证据栅格形状不符');
      const patch=c.patches.find(x=>x.id===patchId);if(!patch)throw Error('地形参考架不存在');
      const colors=palette(m,selected,rec),tex=texture(raw,m.grid,colors),mat=material(tex,currentTerrain.material.alphaMap,terrainOrigin(c,patch),m.grid.bounds);
      const mesh=new THREE.Mesh(currentTerrain.geometry.clone(),mat);mesh.scale.copy(currentTerrain.scale);mesh.position.copy(currentTerrain.position);mesh.quaternion.copy(currentTerrain.quaternion);mesh.position.y+=.045/1000;mesh.renderOrder=1.7;mesh.visible=$('show-soil-context').checked;
      mesh.userData={wenzhouSoilContextEvidence:true,kind:'external-environment-evidence',heightClaim:'none',patch:patchId};
      original.call(currentScene,mesh);active={scene:currentScene,mesh,tex,raw,grid:m.grid};
      const q=c.queries?.find(x=>x.patch===patchId);const v=q?sampleGrid(raw,m.grid,...q.position.coordinates):null;
      const label=colors.find(x=>x.code===v)?.label;
      $('environment-title').textContent=selected==='water'?`JRC · ${$('water-product').selectedOptions[0].text}`:selected==='wrb-probability'?`WRB · ${rec.name}`:$('evidence-mode').selectedOptions[0].text;
      $('environment-status').textContent=selected==='water'?`${rec.period} · 30 m 来源 / 250 m 显示抽样`:'250 m 模型预测 · 官方分类与派生分类独立保存';
      $('environment-value').textContent=q?(v===null?'查询锚点：无有效证据':`查询锚点：${label??v}`):'切换到查询点可读取同一位置的源值。';
      $('environment-boundary').textContent=selected==='water'?`历史统计，不是当前水位；当前只显示地形曲面范围，细小水体可能被 250 m 抽样遗漏。${rec.caveat} Source: EC JRC/Google`:'SoilGrids 外部模型证据，不是现场分类；两种分类差异 6.1103%。概率保留源分数，不强制归一，不改变 DEM。';
      let legend=colors;
      if(selected==='wrb-probability')legend=colors.filter(x=>[0,25,50,75,100].includes(x.code));
      if(selected==='water')legend=colors.filter(x=>rec.rawValues.includes(x.code)&&x.code!==255);
      if(legend.length>30)legend=legend.filter(x=>[0,25,50,75,100,125,150,175,200,253,254].includes(x.code));
      for(const x of legend){const s=document.createElement('span'),i=document.createElement('i');i.style.background=x.color;s.append(i,document.createTextNode(x.label));$('environment-legend').append(s);}
      state({environmentLoaded:true,environmentVisible:mesh.visible,environmentMode:selected,environmentPatch:patchId,environmentSha256:rec.sha256,environmentRawAtAnchor:v??'nodata',environmentCacheEntries:bufferCache.size,environmentError:''});
      window.dispatchEvent(new CustomEvent('wenzhou:evidence',{detail:{mode:selected,patch:patchId,rawAtAnchor:v,sha256:rec.sha256,sourceIdentity:m.sourceIdentity||'model_prediction_external_observation',period:rec.period||null}}));render();
    }catch(e){if(current!==token||e.name==='AbortError')return;dispose();state({environmentError:e.message,environmentLoaded:false});$('environment-status').textContent=`读取失败：${e.message}`;$('environment-retry').hidden=false;render();}
  }
  THREE.Object3D.prototype.add=function(...objects){const result=original.apply(this,objects);if(this.isScene)for(const o of objects)if(isTerrainCandidate(o)){
    scene=this;terrain=o;if(!captured.has(o)){captured.add(o);const prior=o.onAfterRender;o.onAfterRender=function(r,s,c,...rest){renderer=r;camera=c;if(typeof prior==='function')prior.call(this,r,s,c,...rest);};}void build();break;
  }return result;};
  for(const id of ['evidence-mode','wrb-class','water-product'])$(id).addEventListener('change',()=>void build());
  $('show-soil-context').addEventListener('change',()=>{if(active)active.mesh.visible=$('show-soil-context').checked;state({environmentVisible:!!active&&active.mesh.visible});render();});
  $('environment-retry').addEventListener('click',()=>void build());controls();
}
