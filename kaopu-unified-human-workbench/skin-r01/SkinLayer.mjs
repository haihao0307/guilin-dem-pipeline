import * as THREE from '../full/source/registration-vendor/three.module.js';
/** R02 material-only bridge. No compute(), rig, faces or positions are written. */
export const SKIN_VERSION='unified-human-skin/r01';
const ASSETS=new URL('./assets/',import.meta.url);
const defaults={enabled:true,roughness:.53,oil:.23,detail:.72,pigment:.22,sss:.78,radius:1.15,translucency:.55};
const instances=new Set();let lastInstance=null;const settings={...defaults};
const qv=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
// Uses Separable SSS. Copyright (C) 2012 Jorge Jimenez and Diego Gutierrez.
// Same 25-point RGB kernel and albedo-separated composition as accepted R02.
function kernel(){const c=[.530605,.613514,.739601,0];const h=[[.000973794,.0000111862,.000000943437,3],[.00333804,.0000785443,.000012945,2.52083],[.00500364,.00020094,.0000528848,2.08333],[.00700976,.00049366,.000151938,1.6875],[.0094389,.00139119,.000416598,1.33333],[.0128496,.00356329,.00132016,1.02083],[.017924,.00711691,.00347194,.75],[.0263642,.0119715,.00684598,.520833],[.0410172,.0199899,.0118481,.333333],[.0493588,.0367726,.0219485,.1875],[.0402784,.0657244,.04631,.0833333],[.0211412,.0459286,.0378196,.0208333]];return[new THREE.Vector4(...c),...h.map(v=>new THREE.Vector4(v[0],v[1],v[2],-v[3])),...h.map(v=>new THREE.Vector4(...v))];}
const blur=`precision highp float;varying vec2 vUv;uniform sampler2D tColor,tDepth,tAlbedo;uniform vec2 direction;uniform float radius,projectionScale,nearPlane,farPlane,firstPass;uniform vec4 kernel[25];
float vz(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
vec3 splitColor(vec2 p){vec3 c=texture2D(tColor,p).rgb;if(firstPass>.5)c/=sqrt(max(texture2D(tAlbedo,p).rgb,vec3(.025)));return c;}
void main(){vec4 center=texture2D(tColor,vUv);if(center.a<.5){gl_FragColor=center;return;}vec3 albedo=texture2D(tAlbedo,vUv).rgb;float z=vz(texture2D(tDepth,vUv).r);float absorb=mix(.62,1.,smoothstep(.04,.45,dot(albedo,vec3(.2126,.7152,.0722))));float pixels=clamp(radius*.001*projectionScale/z*absorb,.1,35.);vec3 middle=splitColor(vUv),sum=middle*kernel[0].rgb;for(int i=1;i<25;i++){vec2 p=vUv+direction*pixels*kernel[i].w;float nz=vz(texture2D(tDepth,p).r);float visible=step(.5,texture2D(tColor,p).a);float sameSurface=exp(-abs(nz-z)/max(.0004,radius*.0015))*visible;sum+=mix(middle,splitColor(p),sameSurface)*kernel[i].rgb;}gl_FragColor=vec4(sum,center.a);}`;
const compose=`precision highp float;varying vec2 vUv;uniform sampler2D tFull,tDiffuse,tBlur,tAlbedo;uniform float strength,exposure;uniform vec3 background;
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 film(vec3 x){x=max(x,vec3(0.));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec4 f=texture2D(tFull,vUv);vec3 d=texture2D(tDiffuse,vUv).rgb,b=texture2D(tBlur,vUv).rgb;b*=sqrt(max(texture2D(tAlbedo,vUv).rgb,vec3(.025)));vec3 c=max(vec3(0.),f.rgb+mix(d,b,strength)-d);gl_FragColor=vec4(mix(srgb(background),srgb(film(c*exposure)),f.a),1.);}`;
const declarations=`
uniform sampler2D kColorRough,kDetail,kEntry;uniform float kPass,kRoughness,kOil,kPigment,kDetailStrength,kSSS,kTranslucency,kEntryRange,kTileScale;uniform mat4 kEntryVP;uniform vec3 kLightDirection,kLightEnergy;
varying vec3 vKRest,vKRestNormal,vKWorld;varying float vKCoverage;
vec3 kWeights(){vec3 w=pow(abs(normalize(vKRestNormal)),vec3(4.));return w/max(dot(w,vec3(1.)),.00001);}
vec4 kSample(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}
vec3 kGradient(vec3 p,vec3 w){vec4 a=texture2D(kDetail,p.yz)*2.-1.,b=texture2D(kDetail,p.xz)*2.-1.,c=texture2D(kDetail,p.xy)*2.-1.;vec2 da=a.xy*.42+a.zw*.60,db=b.xy*.42+b.zw*.60,dc=c.xy*.42+c.zw*.60;return -(vec3(0.,da)*w.x+vec3(db.x,0.,db.y)*w.y+vec3(dc,0.)*w.z)*kDetailStrength;}
float kThickness(vec3 p){vec4 q=kEntryVP*vec4(p,1.);q.xyz=q.xyz/q.w*.5+.5;if(q.x<.001||q.x>.999||q.y<.001||q.y>.999)return 1.;float d=unpackRGBAToDepth(texture2D(kEntry,q.xy));return max(0.,(q.z-d)*kEntryRange);}
`;
function physical(U){
 const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.53,metalness:0,ior:1.42,specularIntensity:.85,clearcoat:.15,clearcoatRoughness:.30,side:THREE.FrontSide});material.customProgramCacheKey=()=>SKIN_VERSION;
 material.onBeforeCompile=s=>{Object.assign(s.uniforms,U);
  s.vertexShader='attribute vec3 skinRest,skinRestNormal;attribute float skinCoverage;varying vec3 vKRest,vKRestNormal,vKWorld;varying float vKCoverage;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKRest=skinRest;vKRestNormal=skinRestNormal;vKCoverage=skinCoverage;vKWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <packing>','#include <packing>\n'+declarations);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 kP=vKRest/kTileScale,kW=kWeights();vec4 kCR=kSample(kColorRough,kP,kW);float kCover=clamp(vKCoverage,0.,1.);vec3 kAlbedo=kCR.rgb*exp(-kPigment*vec3(1.,1.43,1.8));diffuseColor.rgb=mix(diffuseColor.rgb,kAlbedo,kCover);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  roughnessFactor=mix(.72,clamp(kRoughness+kCR.a-.53-kOil*.025,.25,.85),kCover);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec3 kGrad=kGradient(kP,kW)*kCover;vec3 kDx=dFdx(-vViewPosition),kDy=dFdy(-vViewPosition),kR1=cross(kDy,normal),kR2=cross(normal,kDx);float kDet=dot(kDx,kR1);float kHx=dot(kGrad,dFdx(vKRest)),kHy=dot(kGrad,dFdy(vKRest));if(abs(kDet)>1e-14)normal=normalize(abs(kDet)*normal-sign(kDet)*(kHx*kR1+kHy*kR2));`);
  s.fragmentShader=s.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
  #ifdef USE_CLEARCOAT
  clearcoatNormal=normal;
  #endif`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
  material.clearcoat=kOil*.68*kCover;material.clearcoatRoughness=clamp(.36-kOil*.14+(kCR.a-.53)*.6,.19,.5);
  #endif`);
  let pc=THREE.ShaderChunk.lights_physical_pars_fragment;const anchor='reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';if(!pc.includes(anchor))throw Error('当前 Three.js 光照接口与皮肤适配不符');
  pc=pc.replace(anchor,`float kNL=dot(geometryNormal,directLight.direction);vec3 kWrap=max(vec3(kNL)+vec3(.12,.035,.015),vec3(0.))/vec3(1.2544,1.071225,1.030225);reflectedLight.directDiffuse+=mix(vec3(dotNL),kWrap,kSSS*.28*vKCoverage)*directLight.color*BRDF_Lambert(material.diffuseColor);`);s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',pc);
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
  vec3 kDiffuse=totalDiffuse;
  #ifdef USE_CLEARCOAT
  kDiffuse*=1.-material.clearcoat*Fcc;
  #endif
  vec3 kWN=inverseTransformDirection(nonPerturbedNormal,viewMatrix);float kMM=max(.2,kThickness(vKWorld-kWN*.00012)*1000.);float kBack=max(dot(-kWN,kLightDirection),0.);float kForward=max(dot(normalize(vViewPosition),normalize((viewMatrix*vec4(-kLightDirection,0.)).xyz)),0.);vec3 kTrans=exp(-kMM/vec3(2.8,.7,.35))*kBack*(.3+.7*kForward*kForward)*kTranslucency*kCover*kLightEnergy*diffuseColor.rgb*.8;kDiffuse+=kTrans;outgoingLight+=kTrans;
  #include <opaque_fragment>
  if(kPass>.5&&kPass<1.5)gl_FragColor=vec4(kDiffuse*kCover,kCover);if(kPass>1.5)gl_FragColor=vec4(diffuseColor.rgb,kCover);`);
 };return material;
}
function rt(depth=false){const r=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:depth,stencilBuffer:false});if(depth)r.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);r.samples=depth?4:0;return r;}
function note(s){const el=document.getElementById('skin-status');if(el)el.textContent=s;}
class SkinLayer{
 constructor(viewer){this.v=viewer;this.ready=false;this.disposed=false;this.renderCount=0;this.depthDirty=true;this.errors=[];this.abort=new AbortController();this.originalMaterial=viewer.material;this.addedAttributes=[];this.targets=[];this.textures=[];instances.add(this);lastInstance=this;this.start().catch(e=>{if(!this.disposed){this.errors.push(e.message);note('皮肤未启用：'+e.message+'；保留原白模');console.error(e);}});}
 async start(){
  const json=await fetch(new URL('mapping.json',ASSETS),{signal:this.abort.signal}).then(r=>{if(!r.ok)throw Error('皮肤映射清单载入失败');return r.json();});const m=this.v.model;
  if(json.topologySha256!==m.canonical.topologySha256||json.vertexCount!==m.vertexCount)throw Error('共同网格版本已变化，未套用旧映射');
  const load=async p=>{const r=await fetch(new URL(p,ASSETS),{signal:this.abort.signal});if(!r.ok)throw Error('皮肤映射载入失败 '+p);return r.arrayBuffer();};
  const loader=new THREE.TextureLoader();const tex=async(p,srgb)=>{const t=await loader.loadAsync(new URL(p,ASSETS).href);if(this.disposed){t.dispose();throw Error('皮肤任务已取消');}this.textures.push(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=this.v.renderer.capabilities.getMaxAnisotropy();return t;};
  const [restRaw,normRaw,maskRaw,color,detail]=await Promise.all([load('rest.f32'),load('rest-normal.f32'),load('coverage.u8'),tex('scan-color-rough.png',true),tex('scan-meso-micro.png',false)]);if(this.disposed)return;
  const rest=new Float32Array(restRaw),normals=new Float32Array(normRaw),mask=new Uint8Array(maskRaw);if(rest.length!==m.vertexCount*3||normals.length!==rest.length||mask.length!==m.vertexCount)throw Error('皮肤坐标长度与原顶点不一致');
  if(m.gnm?.materialId){const skinId=m.gnm.meta.materialNames.indexOf('skin');if(skinId<0)throw Error('GNM 皮肤语义缺失');m.canonical.gnmRecipes.forEach(([a,b],i)=>{if(m.gnm.materialId[a]!==skinId||m.gnm.materialId[b]!==skinId)mask[m.bodyCount+i]=0;});}
  this.mapping=json;for(const [key,array,size,normalized]of [['skinRest',rest,3,false],['skinRestNormal',normals,3,false],['skinCoverage',mask,1,true]]){this.v.geometry.setAttribute(key,new THREE.BufferAttribute(array,size,normalized));this.addedAttributes.push(key);}
  this.U={kColorRough:{value:color},kDetail:{value:detail},kEntry:{value:null},kPass:{value:0},kRoughness:{value:settings.roughness},kOil:{value:settings.oil},kPigment:{value:settings.pigment},kDetailStrength:{value:settings.detail},kSSS:{value:settings.sss},kTranslucency:{value:settings.translucency},kEntryVP:{value:new THREE.Matrix4()},kEntryRange:{value:4},kTileScale:{value:.065},kLightDirection:{value:new THREE.Vector3()},kLightEnergy:{value:new THREE.Color()}};this.material=physical(this.U);
  this.full=rt(true);this.diff=rt(true);this.albedo=rt(true);this.a=rt();this.b=rt();this.targets.push(this.full,this.diff,this.albedo,this.a,this.b);
  this.entry=new THREE.WebGLRenderTarget(1024,1024,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});this.targets.push(this.entry);this.depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});this.entryCamera=new THREE.OrthographicCamera();this.U.kEntry.value=this.entry.texture;
  this.blur=new THREE.ShaderMaterial({vertexShader:qv,fragmentShader:blur,depthTest:false,depthWrite:false,uniforms:{tColor:{value:null},tDepth:{value:this.diff.depthTexture},tAlbedo:{value:this.albedo.texture},direction:{value:new THREE.Vector2()},radius:{value:settings.radius},projectionScale:{value:1},nearPlane:{value:.01},farPlane:{value:50},firstPass:{value:1},kernel:{value:kernel()}}});
  this.compose=new THREE.ShaderMaterial({vertexShader:qv,fragmentShader:compose,depthTest:false,depthWrite:false,uniforms:{tFull:{value:this.full.texture},tDiffuse:{value:this.diff.texture},tBlur:{value:this.b.texture},tAlbedo:{value:this.albedo.texture},strength:{value:settings.sss},exposure:{value:1.05},background:{value:new THREE.Color()}}});
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.compose);this.postScene=new THREE.Scene();this.postScene.add(this.quad);this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.ready=true;this.apply();note('R02 皮肤已附着 · 原顶点与参数保持不变');
 }
 apply(){if(!this.ready||this.disposed)return;for(const[k,v]of Object.entries({kRoughness:settings.roughness,kOil:settings.oil,kPigment:settings.pigment,kDetailStrength:settings.detail,kSSS:settings.sss,kTranslucency:settings.translucency}))this.U[k].value=v;this.blur.uniforms.radius.value=settings.radius;this.compose.uniforms.strength.value=settings.sss;this.v.render();}
 entryPass(){if(!this.depthDirty)return;const v=this.v,r=v.renderer,box=new THREE.Box3().setFromBufferAttribute(v.geometry.attributes.position),center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length()*.55;const lights=v.scene.children.filter(o=>o.isDirectionalLight),light=lights[0];if(!light)throw Error('原平台没有可用主光');const direction=light.position.clone().sub(light.target.position).normalize();this.U.kLightDirection.value.copy(direction);this.U.kLightEnergy.value.copy(light.color).multiplyScalar(light.intensity);
  const c=this.entryCamera;c.left=c.bottom=-radius;c.right=c.top=radius;c.near=.01;c.far=radius*6+.01;c.position.copy(center).addScaledVector(direction,radius*3);c.lookAt(center);c.updateProjectionMatrix();c.updateMatrixWorld();this.U.kEntryRange.value=c.far-c.near;this.U.kEntryVP.value.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);const override=v.scene.overrideMaterial;v.scene.overrideMaterial=this.depthMaterial;r.setClearColor(0xffffff,1);r.setRenderTarget(this.entry);r.clear();r.render(v.scene,c);v.scene.overrideMaterial=override;this.depthDirty=false;
 }
 render(){const v=this.v,r=v.renderer;if(!this.ready||this.disposed||v.lost)return;const size=r.getDrawingBufferSize(new THREE.Vector2());if(this.full.width!==size.x||this.full.height!==size.y)for(const t of[this.full,this.diff,this.albedo,this.a,this.b])t.setSize(size.x,size.y);
  const old={target:r.getRenderTarget(),tone:r.toneMapping,space:r.outputColorSpace,color:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),material:v.mesh.material,override:v.scene.overrideMaterial};
  try{r.toneMapping=THREE.NoToneMapping;r.outputColorSpace=THREE.LinearSRGBColorSpace;v.mesh.material=this.material;this.entryPass();r.setClearColor(0x000000,0);for(const [pass,target]of [[0,this.full],[1,this.diff],[2,this.albedo]]){this.U.kPass.value=pass;r.setRenderTarget(target);r.clear();r.render(v.scene,v.camera);}this.U.kPass.value=0;
   const bu=this.blur.uniforms;bu.projectionScale.value=v.camera.projectionMatrix.elements[5]*size.y*.5;bu.nearPlane.value=v.camera.near;bu.farPlane.value=v.camera.far;this.quad.material=this.blur;bu.firstPass.value=1;bu.tColor.value=this.diff.texture;bu.direction.value.set(1/size.x,0);r.setRenderTarget(this.a);r.render(this.postScene,this.postCamera);bu.firstPass.value=0;bu.tColor.value=this.a.texture;bu.direction.value.set(0,1/size.y);r.setRenderTarget(this.b);r.render(this.postScene,this.postCamera);
   this.quad.material=this.compose;this.compose.uniforms.background.value.copy(old.color);this.compose.uniforms.exposure.value=r.toneMappingExposure;r.setRenderTarget(old.target);r.render(this.postScene,this.postCamera);this.renderCount++;v.renders++;
  }finally{v.mesh.material=old.material;v.scene.overrideMaterial=old.override;r.setRenderTarget(old.target);r.toneMapping=old.tone;r.outputColorSpace=old.space;r.setClearColor(old.color,old.alpha);}
 }
 report(){return{version:SKIN_VERSION,ready:this.ready,enabled:settings.enabled,settings:{...settings},errors:this.errors.slice(),geometryUnchanged:true,topology:this.mapping?.topologySha256,vertices:this.v?.model?.vertexCount,renderCount:this.renderCount,referenceSpace:'fixed canonical rest vertex attributes; no UV surgery',mapping:this.mapping,textureBytes:this.textures.reduce((n,t)=>n+(t.image?.width||0)*(t.image?.height||0)*4,0),sss:'R02 25-point RGB albedo-separated, depth/coverage guarded',geometryDisplacement:false};}
 dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();this.ready=false;this.material?.dispose();this.depthMaterial?.dispose();this.blur?.dispose();this.compose?.dispose();this.quad?.geometry.dispose();for(const t of this.targets)t.dispose();for(const t of this.textures)t.dispose();for(const key of this.addedAttributes)this.v.geometry?.deleteAttribute(key);instances.delete(this);if(lastInstance===this)lastInstance=null;}
}
function syncUI(){for(const [key,value]of Object.entries(settings)){const input=document.getElementById('skin-'+key);if(input&&key!=='enabled'){input.value=value;document.getElementById('skin-'+key+'-out').textContent=value.toFixed(2)+(key==='radius'?' mm':'');}}for(const b of document.querySelectorAll('[data-skin-mode]'))b.setAttribute('aria-pressed',String(settings.enabled===(b.dataset.skinMode==='skin')));}
function set(values){for(const [k,v]of Object.entries(values)){if(!(k in defaults))continue;if(k==='enabled')settings.enabled=!!v;else if(Number.isFinite(v)){const ranges={roughness:[.25,.8],oil:[0,1],detail:[0,1.8],pigment:[0,1],sss:[0,1],radius:[.2,3],translucency:[0,1.5]};settings[k]=Math.max(ranges[k][0],Math.min(ranges[k][1],v));}}for(const i of instances)i.apply();syncUI();return{...settings};}
function controls(){const host=document.querySelector('.view-tools');if(!host)return;const panel=document.createElement('section');panel.id='skin-panel';panel.className='skin-panel';panel.setAttribute('aria-label','R02 皮肤材质');const slider=(key,label,min,max)=>`<label for="skin-${key}">${label}<output id="skin-${key}-out"></output><input id="skin-${key}" type="range" min="${min}" max="${max}" step="0.01" value="${settings[key]}"></label>`;
 panel.innerHTML=`<div class="skin-row"><strong>R02 · 皮肤材质</strong><button data-skin-mode="skin" aria-pressed="true">皮肤</button><button data-skin-mode="white" aria-pressed="false">原白模对照</button><details><summary>材质参数</summary><div class="skin-sliders">${slider('roughness','粗糙度',.25,.8)}${slider('oil','表层油光',0,1)}${slider('detail','扫描微孔 / 细纹',0,1.8)}${slider('pigment','色素深浅',0,1)}${slider('sss','皮下散射',0,1)}${slider('radius','扩散尺度（估计）',.2,3)}${slider('translucency','薄部透光',0,1.5)}<button id="skin-reset">恢复本版材质</button></div></details><span id="skin-status" role="status">载入共同模型后附着；不改五官或参数</span></div>`;host.after(panel);for(const b of panel.querySelectorAll('[data-skin-mode]'))b.onclick=()=>set({enabled:b.dataset.skinMode==='skin'});for(const el of panel.querySelectorAll('input'))el.oninput=()=>set({[el.id.slice(5)]:Number(el.value)});panel.querySelector('#skin-reset').onclick=()=>set(defaults);syncUI();
}
export function installSkinPreview(Viewer){const update=Viewer.prototype.update,render=Viewer.prototype.render,dispose=Viewer.prototype.dispose;
 Viewer.prototype.update=function(){update.call(this);if(!this.active)return;if(!this.__skinLayer)this.__skinLayer=new SkinLayer(this);else{this.__skinLayer.depthDirty=true;this.render();}};
 Viewer.prototype.render=function(){const s=this.__skinLayer;if(this.active&&!this.lost&&settings.enabled&&!this.wire&&!this.band&&s?.ready)s.render();else render.call(this);};
 Viewer.prototype.dispose=function(){this.__skinLayer?.dispose();dispose.call(this);};controls();window.commonSkin={version:SKIN_VERSION,set,report:()=>lastInstance?.report()||{version:SKIN_VERSION,ready:false,settings:{...settings}},_viewer:()=>lastInstance?.v};
}
