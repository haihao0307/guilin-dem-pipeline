/* HEAD-PROCEDURAL-R01. Original runtime material logic: no image maps, no texture
 * projection, no reference assets. Native person/rig/vertex deformation is retained.
 * Positions are metres; surface-detail functions use millimetres explicitly. */
(()=>{'use strict';
const VERSION='HEAD-PROCEDURAL-R01', SCHEMA='kaopu/procedural-head-surface@1';
const defaults={enabled:true,seed:731,tone:.60,warmth:.47,blood:.34,variation:.65,pores:.62,poreRadius:.075,poreSpacing:.58,microrelief:.45,roughness:.63,oil:.30,scatter:.40,freckles:.12,lipColor:.46,lipWetness:.30,eyeThinness:.40,diagnostic:0};
const bounds={seed:[1,99999],tone:[0,1],warmth:[0,1],blood:[0,1],variation:[0,1.5],pores:[0,1.5],poreRadius:[.025,.16],poreSpacing:[.35,1.1],microrelief:[0,1.5],roughness:[.32,.85],oil:[0,1],scatter:[0,1],freckles:[0,1],lipColor:[0,1],lipWetness:[0,1],eyeThinness:[0,1],diagnostic:[0,5]};
const labels={tone:'基底肤色',warmth:'冷暖底色',blood:'血色分布',variation:'肤色层次',pores:'毛孔深浅',poreRadius:'毛孔半径 · mm',poreSpacing:'毛孔间距 · mm',microrelief:'微细皮纹',roughness:'表面粗糙度',oil:'分区油脂',scatter:'浅层散射',freckles:'色素细点',lipColor:'唇部血色',lipWetness:'唇部湿润',eyeThinness:'眼周薄区'};
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('皮肤参数须为对象');const result={...defaults,...input};for(const[k,v]of Object.entries(result)){if(k==='enabled'){if(typeof v!=='boolean')throw Error('无效开关');}else{const b=bounds[k];if(!b||!Number.isFinite(v)||v<b[0]||v>b[1]||(['seed','diagnostic'].includes(k)&&!Number.isInteger(v)))throw Error('无效皮肤参数 '+k);}}return result;}
window.__HEAD_PROC__={version:VERSION,ready:false,errors:[],source:window.__HEAD_PROC_SOURCE__||'local',referenceAssetImports:0};
const declaration=`
varying vec3 vFRest; varying vec4 vFA,vFB,vCSRegion; varying float vEWeight;
uniform float psSeed,psTone,psWarmth,psBlood,psVariation,psPores,psRadius,psSpacing,psMicro,psRoughness,psOil,psScatter,psFreckles,psLip,psWet,psThin,psView;
float psHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33+psSeed*.001);return fract((p.x+p.y)*p.z);}
float psNoise(vec3 p){vec3 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(psHash(c),psHash(c+vec3(1,0,0)),f.x),mix(psHash(c+vec3(0,1,0)),psHash(c+vec3(1,1,0)),f.x),f.y),mix(mix(psHash(c+vec3(0,0,1)),psHash(c+vec3(1,0,1)),f.x),mix(psHash(c+vec3(0,1,1)),psHash(c+vec3(1,1,1)),f.x),f.y),f.z);}
float psRegion(vec3 p,vec3 c,vec3 scale){vec3 q=(vec3(abs(p.x),p.y,p.z)-c)/scale;return exp(-dot(q,q)*1.5);}
// Analytically filtered, jittered follicle bowls. Radius and depth are independent.
// Positive broad rim is much weaker than the shallow centre; never black dots.
vec2 psPoreChart(vec2 q,float chart,float radius,float spacing,float footprint){
 vec2 cell=floor(q/spacing);float height=0.,pigment=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));vec3 key=vec3(id,chart);
  vec2 jitter=vec2(psHash(key),psHash(key+vec3(19.1,73.7,2.1)));
  vec2 delta=q-(id+.14+.72*jitter)*spacing;
  float rr=radius*mix(.62,1.35,psHash(key+4.3));float r2=rr*rr;
  float filter=r2+footprint*footprint*.24;
  float d2=dot(delta,delta);float bowl=exp(-d2/filter)*r2/filter;
  float rim=exp(-d2/(filter*3.8))*r2/filter;
  float presence=smoothstep(.12,.30,psHash(key+12.4));
  height+=(-bowl+.085*rim)*presence;
  pigment+=bowl*.12*presence;
 }
 return vec2(height,pigment);
}
vec2 psPoreSurface(vec3 mm,vec3 weights,float radius,float spacing,float footprint){
 vec3 warp=vec3(psNoise(mm*.10+11.7),psNoise(mm*.10+33.1),psNoise(mm*.10+78.2))-.5;mm+=warp*.20;
 return psPoreChart(mm.yz,7.,radius,spacing,footprint)*weights.x+psPoreChart(mm.xz,31.,radius,spacing,footprint)*weights.y+psPoreChart(mm.xy,61.,radius,spacing,footprint)*weights.z;
}
float psFreckleField(vec3 mm,vec3 weights){
 float cluster=smoothstep(.65,.89,psNoise(mm*.17+19.));
 float dots=pow(clamp(psNoise(mm*2.1+4.),0.,1.),9.);
 return clamp(cluster*dots*10.,0.,1.);
}
vec3 psToLinear(vec3 s){return mix(s/12.92,pow((s+.055)/1.055,vec3(2.4)),step(vec3(.04045),s));}
vec3 psBase=vec3(0.);float psR=0.,psL=0.,psT=0.,psE=0.,psH=0.,psThinMask=0.;
`;
const direct=`
// Bounded local RGB light wrap, shadow-aware through IncidentLight.color.
// Not measured tissue or full multiple-scattering volume transport.
void psDirect(const in IncidentLight light,const in vec3 pos,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 RE_Direct_Physical(light,pos,N,V,CN,material,reflectedLight);
 float ndl=dot(N,light.direction);vec3 width=vec3(.22,.105,.055)*psScatter;
 vec3 wrap=clamp((vec3(ndl)+width)/(1.+width),0.,1.);
 vec3 delta=wrap-vec3(max(ndl,0.));
 reflectedLight.directDiffuse+=delta*light.color*BRDF_Lambert(material.diffuseColor)*.46;
}
#undef RE_Direct
#define RE_Direct psDirect
`;
const surface=`
 vec3 psP=vFRest,psMM=psP*1000.;
 psL=clamp(max(vCSRegion.y,vFA.y),0.,1.);
 psT=clamp(max(vFA.w,vFB.x*.66),0.,1.);
 psE=clamp(vEWeight,0.,1.);
 psThinMask=clamp(vFA.z,0.,1.);
 float psCheek=psRegion(psP,vec3(.038,.273,.056),vec3(.033,.034,.060));
 float psLowerEye=psRegion(psP,vec3(.031,.289,.060),vec3(.026,.009,.035));
 float psJaw=psRegion(psP,vec3(.042,.228,.027),vec3(.043,.023,.060));
 float psMacro=(psNoise(psMM*.045)-.5)*.60+(psNoise(psMM*.14+11.)-.5)*.28+(psNoise(psMM*.6+39.)-.5)*.12;
 vec3 psSrgb=mix(vec3(.30,.19,.135),vec3(.82,.65,.54),psTone);
 psSrgb+=vec3(.045,-.004,-.045)*(psWarmth-.5);
 psSrgb*=1.+psMacro*.105*psVariation;
 float psRed=(.18+.45*psCheek+.30*psT+.32*psE)*(psBlood-.20);
 psSrgb+=vec3(.065,-.050,-.040)*psRed;
 psSrgb=mix(psSrgb,psSrgb*vec3(.88,.86,.91),psLowerEye*psThin*.44);
 psSrgb=mix(psSrgb,psSrgb*vec3(.98,.98,1.025),psJaw*.13);
 vec3 psRestN=normalize(cross(dFdx(psMM),dFdy(psMM)));vec3 psWeights=pow(abs(psRestN),vec3(8.));psWeights/=max(dot(psWeights,vec3(1.)),.00001);
 float psFoot=max(length(dFdx(psMM)),length(dFdy(psMM)));
 float psF=psFreckleField(psMM,psWeights)*psFreckles*(.24+.76*psCheek);
 psSrgb*=exp(-psF*vec3(.30,.46,.57));
 float psLipFeather=smoothstep(.02,.94,psL);
 vec3 psLipColour=psSrgb*vec3(1.03,.68,.72)+vec3(.028,.006,.006);
 psLipColour=mix(psSrgb*vec3(1.0,.82,.84),psLipColour,psLip);
 psSrgb=mix(psSrgb,psLipColour,psLipFeather);
 psBase=psToLinear(clamp(psSrgb,.008,.94));diffuseColor.rgb=psBase;
 vec2 psPore=psPoreSurface(psMM,psWeights,psRadius*(1.+psT*.22-psThinMask*.32),psSpacing*(1.-psT*.10),psFoot);
 float psResolve=1.-smoothstep(.18,.72,psFoot);
 float psMeso=(psNoise(psMM*1.65)-.5)*.0000045;
 float psStria=sin(psMM.x*8.5+psNoise(psMM*1.05)*3.7)*.0000015;
 float psLipH=psStria*psMicro+(psNoise(psMM*2.2)-.5)*.0000013;
 psH=(psPore.x*.000011*psPores+psMeso*psMicro)*(1.-psThinMask*.50)*(1.-psLipFeather);
 psH+=psLipH*psLipFeather;psH*=psResolve;
 psR=clamp(psRoughness-.13*psT*psOil+.025*psCheek+.045*psThinMask+(psNoise(psMM*.85)-.5)*.055*psMicro,.27,.89);
 psR=mix(psR,.44-.13*psWet,psLipFeather);
`;
function patch(s,a,b){if(s.split(a).length!==2)throw Error('程序皮肤挂接位置改变 '+a);return s.replace(a,()=>b);}
async function boot(){
 const v=window.__IDENTITY_QA__?.viewer?.(),m=window.__IDENTITY_QA__?.model?.();
 if(!v?.skin?.material||!window.__R05_PRESET_READY__)return false;
 let settings=validate(defaults),native=v.skin.material;
 const mat=new native.constructor({vertexColors:true,roughness:.63,metalness:0,ior:1.42,specularIntensity:.68,clearcoat:.025,clearcoatRoughness:.40,side:native.side});mat.name=VERSION+'-NO-SKIN-TEXTURES';
 const U={},mapping={seed:'psSeed',tone:'psTone',warmth:'psWarmth',blood:'psBlood',variation:'psVariation',pores:'psPores',poreRadius:'psRadius',poreSpacing:'psSpacing',microrelief:'psMicro',roughness:'psRoughness',oil:'psOil',scatter:'psScatter',freckles:'psFreckles',lipColor:'psLip',lipWetness:'psWet',eyeThinness:'psThin',diagnostic:'psView'};
 for(const[k,u]of Object.entries(mapping))U[u]={value:settings[k]};
 let compiled=0,shaderText='',lastNative=native,geometryBuilds=0,drawGroupReport=null;
 mat.onBeforeCompile=s=>{
  const vertexContract={uniforms:{...s.uniforms},vertexShader:s.vertexShader,fragmentShader:s.fragmentShader};
  v.skin.material.onBeforeCompile(vertexContract,v.renderer);
  s.vertexShader=vertexContract.vertexShader;Object.assign(s.uniforms,vertexContract.uniforms,U);
  s.fragmentShader=patch(s.fragmentShader,'#include <common>','#include <common>\n'+declaration);
  s.fragmentShader=patch(s.fragmentShader,'#include <color_fragment>','#include <color_fragment>\n'+surface);
  s.fragmentShader=patch(s.fragmentShader,'#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=psR;');
  s.fragmentShader=patch(s.fragmentShader,'#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 psDx=dFdx(-vViewPosition),psDy=dFdy(-vViewPosition),psR1=cross(psDy,normal),psR2=cross(normal,psDx);float psDet=dot(psDx,psR1);
   if(abs(psDet)>1e-14){vec3 slope=sign(psDet)*(dFdx(psH)*psR1+dFdy(psH)*psR2)/abs(psDet);slope*=min(1.,.26/max(length(slope),.0001));normal=normalize(normal-slope);}
  `);
  s.fragmentShader=patch(s.fragmentShader,'#include <lights_physical_pars_fragment>','#include <lights_physical_pars_fragment>\n'+direct);
  s.fragmentShader=patch(s.fragmentShader,'#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   material.clearcoat=clamp(.006+.038*psOil*psT+.055*psWet*psL,0.,.12);
   material.clearcoatRoughness=mix(.48,.35,psL);
  `);
  s.fragmentShader=patch(s.fragmentShader,'#include <opaque_fragment>',`
   if(psView>.5&&psView<1.5)outgoingLight=psBase;
   if(psView>1.5&&psView<2.5)outgoingLight=vec3(psR);
   if(psView>2.5&&psView<3.5)outgoingLight=normal*.5+.5;
   if(psView>3.5&&psView<4.5)outgoingLight=vec3(clamp(.5+psH*20000.,0.,1.));
   if(psView>4.5)outgoingLight=vec3(psT,psThinMask,psL);
   #include <opaque_fragment>`);
  shaderText=s.fragmentShader;compiled++;
 };
 mat.customProgramCacheKey=()=>VERSION+'/native-vertex/'+v.skin.material.customProgramCacheKey();
 const cache=new WeakMap();
 function geometryFor(g){
  if(cache.has(g))return cache.get(g);
  const rest=g.attributes.fRest,cover=g.attributes.csRegion,type=g.attributes.csType;
  if(!rest||!cover||!type||!g.index)throw Error('原人物皮肤属性不完整');
  const head=[],other=[],index=g.index.array;
  function owned(id){return type.array[id]<.5&&cover.getX(id)>.5&&rest.getY(id)>.19&&rest.getY(id)<.46;}
  for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]],dst=ids.every(owned)?head:other;dst.push(...ids);}
  if(head.length<3000||other.length<3000)throw Error('头部区域隔离失败');
  const result=new g.constructor();result.attributes=g.attributes;result.morphAttributes=g.morphAttributes;result.morphTargetsRelative=g.morphTargetsRelative;
  const sorted=new index.constructor(index.length);sorted.set(other);sorted.set(head,other.length);result.setIndex(new g.index.constructor(sorted,1));
  result.clearGroups();result.addGroup(0,other.length,0);result.addGroup(other.length,head.length,1);
  result.boundingBox=g.boundingBox;result.boundingSphere=g.boundingSphere;result.drawRange={...g.drawRange};result.userData={...g.userData,proceduralHead:true};
  drawGroupReport={headTriangles:head.length/3,retainedTriangles:other.length/3,originalTriangles:index.length/3,positionArraysShared:true,canonicalIndicesChanged:false,groups:2};cache.set(g,result);geometryBuilds++;return result;
 }
 const render=v.renderer.render.bind(v.renderer);
 v.renderer.render=function(scene,camera){
  if(scene===v.scene&&v.mesh&&v.geometry){
   if(lastNative!==v.skin.material){lastNative=v.skin.material;mat.needsUpdate=true;}
   v.mesh.material=settings.enabled?[v.skin.material,mat]:v.skin.material;
   v.mesh.geometry=settings.enabled?geometryFor(v.geometry):v.geometry;
  }
  return render(scene,camera);
 };
 const nativeArchive=window.fullCommonWorkbench.archive.bind(window.fullCommonWorkbench),nativeRestore=window.fullCommonWorkbench.restore.bind(window.fullCommonWorkbench);
 function report(){return{version:VERSION,settings:{...settings},ready:compiled>0,fragmentShaderCompiles:compiled,skinImageSamplers:0,referenceAssetsUsed:false,shaderIndependentOfNativeSkinMaps:true,geometryBuilds,drawGroups:drawGroupReport,nativeVertexDeformationRetained:true,fullVolumeScattering:false,visualEquivalenceAccepted:false,source:window.__HEAD_PROC_SOURCE__||'local',headShaderHasTextureLookup:/\btexture(?:2D|Lod|Grad|Proj|Fetch)?\s*\(/.test(shaderText)};}
 const panel=document.createElement('section');panel.id='ps-controls';
 panel.innerHTML=`<h2>程序化头部皮肤 <small>R01 · 独立测试</small></h2><p>同一 R06 人物 · 不读取参考模型或皮肤贴图</p><div class="ps-buttons"><button data-ps-action="compare" aria-pressed="false">对照原皮肤</button><button data-ps-action="reset">恢复本版</button><button data-ps-view="front">正面</button><button data-ps-view="oblique">斜侧</button><button data-ps-action="cheek">脸颊微距</button><button data-ps-action="lip">嘴唇微距</button></div><label>检查通道<select id="ps-diagnostic"><option value="0">完整材质</option><option value="1">仅底色</option><option value="2">粗糙度</option><option value="3">表面法线</option><option value="4">毛孔 / 细纹高度</option><option value="5">分区：油脂 / 眼周 / 唇</option></select></label><div class="ps-sliders">${Object.entries(labels).map(([k,label])=>`<label>${label}<output data-ps-value="${k}">${settings[k].toFixed(3)}</output><input aria-label="${label}" data-ps="${k}" type="range" min="${bounds[k][0]}" max="${bounds[k][1]}" step="${k==='poreRadius'?.001:.01}" value="${settings[k]}"></label>`).join('')}</div><div class="ps-buttons"><button data-ps-action="seed">另一份皮肤种子</button><button data-ps-action="save">保存完整人物</button><button data-ps-action="load">载入档案</button><input id="ps-file" type="file" accept="application/json" hidden></div><p id="ps-status" role="status">正在编译程序表面…</p><details><summary>范围与保留</summary><p>只重建头部皮肤；眼球、牙齿、身体、原骨架与参数保留。毛孔和细纹为程序生成的高度与法线响应，不是参考贴图。散射为有界实时近似。本版并非已验收的逐像素复刻；全身扩展未执行。</p></details>`;
 document.querySelector('.parameter-host')?.prepend(panel);
 const style=document.createElement('style');style.textContent=`#ps-controls{padding:18px;background:#172127;border-bottom:1px solid #58646b;color:#e8e6df;font:13px/1.6 system-ui}#ps-controls h2{font-size:19px;margin:0 0 5px}#ps-controls h2 small{display:block;color:#bcc2bb;font-size:11px;letter-spacing:.1em;font-weight:400}#ps-controls p{font-size:12px;color:#b6c0c2;margin:7px 0 12px}.ps-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0}.ps-buttons button{font-size:12px;min-height:38px;background:#293438}.ps-sliders{margin:12px 0}.ps-sliders label{display:block;margin:8px 0}.ps-sliders output{float:right;font-variant-numeric:tabular-nums;color:#d7c7a5}.ps-sliders input{display:block;width:100%;height:18px;accent-color:#cbb795}#ps-diagnostic{width:100%;min-height:38px;font-size:12px}#ps-status{border-top:1px solid #425359;padding-top:8px}#ps-controls details{font-size:12px}@media(min-width:901px){main{grid-template-columns:minmax(0,1fr) 350px!important}}`;
 document.head.append(style);
 function sync(){for(const[k,u]of Object.entries(mapping))U[u].value=settings[k];for(const el of panel.querySelectorAll('[data-ps]')){el.value=settings[el.dataset.ps];panel.querySelector(`[data-ps-value="${el.dataset.ps}"]`).textContent=Number(el.value).toFixed(3);}panel.querySelector('#ps-diagnostic').value=settings.diagnostic;panel.querySelector('[data-ps-action="compare"]').textContent=settings.enabled?'对照原皮肤':'返回程序皮肤';panel.querySelector('[data-ps-action="compare"]').setAttribute('aria-pressed',String(!settings.enabled));}
 function set(part){settings=validate({...settings,...part});sync();v.render();panel.querySelector('#ps-status').textContent=`${settings.enabled?'程序表面':'原版对照'} · 种子 ${settings.seed} · 同一人物 / 同一灯光`;return report();}
 function archive(){return{...nativeArchive(),proceduralHeadSurface:{schema:SCHEMA,version:VERSION,settings:{...settings}}};}
 async function restore(a){const own=a?.proceduralHeadSurface;if(own&&own.schema!==SCHEMA)throw Error('不支持的皮肤档案版本');const restored=validate(own?own.settings:{...defaults,enabled:false});const copy=structuredClone(a);delete copy.proceduralHeadSurface;await nativeRestore(copy);settings=restored;sync();v.render();return report();}
 window.fullCommonWorkbench.archive=archive;window.fullCommonWorkbench.restore=restore;
 const api={version:VERSION,set,settings:()=>({...settings}),report,archive,restore,validate,material:()=>mat,fragment:()=>shaderText,originalGeometry:()=>v.geometry};window.headProceduralSkin=api;
 panel.addEventListener('input',e=>{const k=e.target.dataset.ps;if(k)set({[k]:Number(e.target.value)});});
 panel.querySelector('#ps-diagnostic').onchange=e=>set({diagnostic:Number(e.target.value)});
 function view(name){document.body.classList.remove('ear-focus','lips-focus');window.headMorphology.view(name);}
 panel.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.psView)view(b.dataset.psView);const action=b.dataset.psAction;
  if(action==='compare')set({enabled:!settings.enabled});if(action==='reset')set(defaults);
  if(action==='seed')set({seed:(settings.seed*16807)%99991+1});
  if(action==='cheek'){view('front');v.camera.zoom=2.6;v.camera.position.x+=.035;v.orbit.target.x+=.035;v.camera.position.y-=.012;v.orbit.target.y-=.012;v.camera.updateProjectionMatrix();v.orbit.update();v.render();}
  if(action==='lip'){window.lipWorkbench.open();window.lipWorkbench.view('macro');}
  if(action==='save'){const u=URL.createObjectURL(new Blob([JSON.stringify(archive(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='head-procedural-r01-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  if(action==='load')panel.querySelector('#ps-file').click();
 }catch(err){panel.querySelector('#ps-status').textContent=err.message;}});
 panel.querySelector('#ps-file').onchange=async e=>{try{await restore(JSON.parse(await e.target.files[0].text()));}catch(err){panel.querySelector('#ps-status').textContent=err.message;}finally{e.target.value='';}};
 document.querySelector('header strong').textContent='头部程序皮肤 · R01';
 set(defaults);view('oblique');v.render();window.__HEAD_PROC__.ready=compiled>0;window.__HEAD_PROC__.report=report();return true;
}
(async()=>{const start=performance.now();while(performance.now()-start<300000){try{if(await boot())return;}catch(e){window.__HEAD_PROC__.errors.push(String(e));console.error('HEAD_PROCEDURAL_INIT',e);return;}await new Promise(r=>setTimeout(r,100));}window.__HEAD_PROC__.errors.push('原人物加载超时，未创建替代模型');})();
})();