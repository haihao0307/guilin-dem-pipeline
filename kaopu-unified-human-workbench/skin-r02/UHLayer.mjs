import * as THREE from '../full/source/registration-vendor/three.module.js';
// Independent implementation of publicly documented relationships, not the
// Universal Human proprietary node graph or assets. See RESEARCH.md.
export const VERSION='unified-human-skin/r02-uh-study';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const zero=v=>typeof v==='number'?Math.abs(v)<1e-7:Array.isArray(v)?v.every(zero):v&&typeof v==='object'?Object.values(v).every(zero):true;
const D=Object.freeze({mode:1,tone:.68,warmth:.52,albedoMix:.9,baseMix:0,baseColor:'#b49a88',variation:.42,redness:.34,palmLight:.42,meso:1.05,micro:1.1,roughCoupling:.65,regionRoughness:.7,oilZones:.55,lipMix:.32,lipColor:'#995751',lipGloss:.18,foundation:0,radiusR:1.1,radiusG:.95,radiusB:.85,tension:1,layer:'beauty'});
const S={...D},live=new Set();let latest=null;
export const PRESETS={natural:{...D},dry:{...D,tone:.74,warmth:.42,micro:1.35,variation:.6,roughCoupling:.85,regionRoughness:1,oilZones:.2,lipGloss:.05},warm:{...D,tone:.36,warmth:.66,variation:.52,redness:.2,palmLight:.65,oilZones:.7,lipMix:.2,micro:1.15}};
export function poseIsNeutral(s){return zero(s.gnm.rotation)&&zero(s.gnm.translation)&&zero(s.gnm.expression)&&zero(s.anny.pose)&&zero(s.anny.translations)&&zero(s.anny.facialActions)&&zero(s.mhr.pose)&&zero(s.mhr.expression);}
export function shapeKey(s){return JSON.stringify([s.owners,s.anny.phenotypes,s.anny.localChanges,s.gnm.identity,s.mhr.identity,s.mhr.correctives]);}
export function rescaleKernel(original,scales){
 const order=original.map((v,i)=>({i,x:v.w})).sort((a,b)=>a.x-b.x),area=Array(original.length);
 order.forEach((r,j)=>{area[r.i]=((order[j+1]?.x??r.x+(r.x-order[j-1].x))-(order[j-1]?.x??r.x-(order[j+1].x-r.x)))*.5;});
 const result=original.map(v=>v.clone());
 for(let c=0;c<3;c++){
  const factor=scales[c];if(factor===1)continue;
  const density=(x)=>{if(x<order[0].x||x>order.at(-1).x)return 0;let j=0;while(j<order.length-2&&order[j+1].x<x)j++;const a=order[j],b=order[j+1],t=(x-a.x)/(b.x-a.x);return ((1-t)*original[a.i].getComponent(c)/area[a.i]+t*original[b.i].getComponent(c)/area[b.i])/factor;};
  let sum=0;for(let i=0;i<result.length;i++){const w=Math.max(0,density(original[i].w/factor)*area[i]);result[i].setComponent(c,w);sum+=w;}
  if(sum<1e-12)throw Error('Invalid diffusion profile');for(const r of result)r.setComponent(c,r.getComponent(c)/sum);
 }return result;
}
export class StrainField{
 constructor(geometry,scope){this.g=geometry;this.scope=scope;const f=geometry.index.array,n=geometry.attributes.position.count;this.pairs=[];const seen=new Set();for(let i=0;i<f.length;i+=3)for(const[a,b]of [[f[i],f[i+1]],[f[i+1],f[i+2]],[f[i+2],f[i]]]){if(scope[a]<.01&&scope[b]<.01)continue;const lo=Math.min(a,b),hi=Math.max(a,b),key=lo*n+hi;if(!seen.has(key)){seen.add(key);this.pairs.push(lo,hi);}}this.values=new Float32Array(n*2);this.attr=new THREE.BufferAttribute(this.values,2);geometry.setAttribute('uhStrain',this.attr);this.rest=null;this.key=null;this.status='waiting-neutral';this.captures=0;this.lastMilliseconds=0;}
 lengths(p){const result=new Float32Array(this.pairs.length/2);for(let j=0;j<this.pairs.length;j+=2){const a=this.pairs[j]*3,b=this.pairs[j+1]*3;result[j/2]=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]);}return result;}
 update(state){const t=performance.now(),key=shapeKey(state),p=this.g.attributes.position.array;this.values.fill(0);if(key!==this.key){this.rest=null;this.key=key;this.status='shape-changed-await-neutral';}if(!this.rest&&poseIsNeutral(state)){this.rest=this.lengths(p);this.status='calibrated-current-shape';this.captures++;}if(this.rest){const cur=this.lengths(p);for(let j=0;j<cur.length;j++){if(this.rest[j]<1e-7)continue;const e=Math.log(Math.max(cur[j],1e-7)/this.rest[j]),compress=clamp((-e-.003)/.2),stretch=clamp((e-.003)/.2);for(const vi of [this.pairs[j*2],this.pairs[j*2+1]]){const k=vi*2;this.values[k]=Math.max(this.values[k],compress*this.scope[vi]);this.values[k+1]=Math.max(this.values[k+1],stretch*this.scope[vi]);}}}this.attr.needsUpdate=true;this.lastMilliseconds=performance.now()-t;}
 report(){let c=0,s=0,active=0;for(let i=0;i<this.values.length;i+=2){c=Math.max(c,this.values[i]);s=Math.max(s,this.values[i+1]);if(this.values[i]+this.values[i+1]>.001)active++;}return{status:this.status,calibrated:!!this.rest,captures:this.captures,maxCompression:c,maxStretch:s,activeVertices:active,edges:this.pairs.length/2,lastMilliseconds:this.lastMilliseconds,scope:'forearms and hands only; visual microstructure, not medical blood simulation',changesGeometry:false};}
}
function regions(v){
 const g=v.geometry,m=v.model,p=g.attributes.skinRest.array,n=g.attributes.skinRestNormal.array,cover=g.attributes.skinCoverage.array,N=m.vertexCount,mask=new Float32Array(N*4),scope=new Float32Array(N),names=m.gnm.meta.regionNames;
 const value=id=>{const name=names[id]||'';return[name==='nose'?1:name==='forehead'?.72:name==='chin'?.45:name.includes('cheek')?.16:0,name.includes('cheek')?.95:name.includes('zygomatic')?.65:name==='nose'?.50:name.includes('infraorbital')?.32:0,name==='upper_lip'||name==='lower_lip'?1:0,0];};
 const bone=id=>{const i=m.anny.boneLabels.indexOf(id);if(i<0)return null;const a=m.neutral.boneHeads;return new THREE.Vector3(a[i*3],a[i*3+2],-a[i*3+1]);};
 const wrists=['L','R'].map(side=>{const w=bone('wrist.'+side),f=bone('finger3-1.'+side),idx=bone('finger2-1.'+side),pink=bone('finger5-1.'+side);if(!w||!f||!idx||!pink)return null;const direction=f.clone().sub(w).normalize(),palmN=idx.clone().sub(w).cross(pink.clone().sub(w)).normalize();if(side==='R')palmN.negate();return{w,f,direction,palmN};}).filter(Boolean);
 for(let i=0;i<m.bodyCount;i++){
  if(!cover[i])continue;const q=new THREE.Vector3(p[i*3],p[i*3+1],p[i*3+2]),nn=new THREE.Vector3(n[i*3],n[i*3+1],n[i*3+2]);
  scope[i]=smooth(.32,.45,Math.abs(q.x))*(1-smooth(.38,.47,q.y));
  for(const w of wrists){const r=q.clone().sub(w.w),along=r.dot(w.direction),radial=r.clone().addScaledVector(w.direction,-along).length();const hand=smooth(-.02,.018,along)*(1-smooth(.17,.22,along))*(1-smooth(.065,.095,radial));mask[i*4+3]=Math.max(mask[i*4+3],hand*smooth(-.05,.6,nn.dot(w.palmN)));}
 }
 m.canonical.gnmRecipes.forEach(([a,b,t],hi)=>{const i=m.bodyCount+hi;if(!cover[i])return;const va=value(m.gnm.regionId[a]),vb=value(m.gnm.regionId[b]);for(let c=0;c<3;c++)mask[i*4+c]=va[c]*(1-t)+vb[c]*t;
  const x=p[i*3],y=p[i*3+1],z=p[i*3+2];mask[i*4+2]*=smooth(.132,.142,z)*Math.exp(-Math.pow((y-(.676+.002*Math.cos(x*95)))/.007,4))*(1-smooth(.027,.035,Math.abs(x)));
 });
 const f=g.index.array,adj=Array.from({length:N},()=>new Set());for(let i=0;i<f.length;i+=3)for(const[a,b]of[[f[i],f[i+1]],[f[i+1],f[i+2]],[f[i+2],f[i]]]){if(cover[a]&&cover[b]){adj[a].add(b);adj[b].add(a);}}
 let sm=mask;for(let it=0;it<9;it++){const next=sm.slice();for(let i=0;i<N;i++){if(!adj[i].size)continue;for(let c=0;c<4;c++){let total=0;for(const j of adj[i])total+=sm[j*4+c];next[i*4+c]=sm[i*4+c]*.62+total/adj[i].size*.38;}}sm=next;}
 g.setAttribute('uhRegion',new THREE.BufferAttribute(sm,4));const counts=[0,0,0,0];for(let i=0;i<N;i++)for(let c=0;c<4;c++)if(sm[i*4+c]>.05)counts[c]++;return{scope,counts,source:'GNM native region IDs + canonical recipe interpolation; hand bone-plane mask; smoothed on skin only'};
}
const FUNCTIONS=`
uniform float uhMode,uhAlbedoMix,uhBaseMix,uhVariation,uhRedness,uhPalmLight,uhMeso,uhMicro,uhRoughCoupling,uhRegionRough,uhOilZones,uhLipMix,uhLipGloss,uhFoundation,uhTension,uhLayer;
uniform vec3 uhTone,uhBaseColor,uhLipColor;
varying vec4 vUHRegion;varying vec2 vUHStrain;
float uhHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float uhNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(uhHash(i),uhHash(i+vec3(1,0,0)),f.x),mix(uhHash(i+vec3(0,1,0)),uhHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(uhHash(i+vec3(0,0,1)),uhHash(i+vec3(1,0,1)),f.x),mix(uhHash(i+vec3(0,1,1)),uhHash(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;}
vec3 uhGradient(vec3 p,vec3 w){vec4 a=texture2D(kDetail,p.yz)*2.-1.,b=texture2D(kDetail,p.xz)*2.-1.,c=texture2D(kDetail,p.xy)*2.-1.;vec2 da=a.xy*.42*uhMeso+a.zw*.60*uhMicro,db=b.xy*.42*uhMeso+b.zw*.60*uhMicro,dc=c.xy*.42*uhMeso+c.zw*.60*uhMicro;return -(vec3(0.,da)*w.x+vec3(db.x,0.,db.y)*w.y+vec3(dc,0.)*w.z)*kDetailStrength;}
`;
const COLOR=`
 vec4 uhR=clamp(vUHRegion,0.,1.);vec2 uhStr=clamp(vUHStrain,0.,1.)*uhTension;
 float uhMacro=uhNoise(vKRest*63.+vec3(7.2,1.3,9.4))*.58+uhNoise(vKRest*211.+vec3(12.4,5.8,1.7))*.28;
 float uhSpots=pow(smoothstep(.36,.72,uhNoise(vKRest*870.+vec3(6.,27.,16.))),2.)*uhR.y;
 float uhLip=uhR.z;float uhRegionRadius=clamp(.80+uhR.y*.14-uhR.w*.18,.45,1.);
 if(uhMode>.5){
  vec3 undercoat=mix(uhTone,uhBaseColor,uhBaseMix);
  vec3 residual=clamp(kCR.rgb/vec3(.644,.391,.321),vec3(.65),vec3(1.35));
  vec3 pigment=undercoat*mix(vec3(1.),residual,uhAlbedoMix)*exp(-kPigment*vec3(.35,.5,.65));
  pigment*=exp(-uhVariation*(uhMacro*.13+uhSpots*.24)*vec3(.66,1.06,1.22));
  pigment*=vec3(1.+uhRedness*uhR.y*.14,1.-uhRedness*uhR.y*.13,1.-uhRedness*uhR.y*.075);
  pigment=mix(pigment,pigment*1.18+vec3(.012,.009,.006),uhR.w*uhPalmLight);
  pigment=mix(pigment,uhLipColor,uhLip*uhLipMix);
  pigment=mix(pigment,undercoat,uhFoundation*.48);
  pigment*=vec3(1.+uhStr.x*.025,1.-uhStr.x*.020,1.-uhStr.x*.014);
  kAlbedo=clamp(pigment,vec3(.008),vec3(.90));diffuseColor.rgb=mix(diffuseColor.rgb,kAlbedo,kCover);
  uhRegionRadius*=1.-uhFoundation*.30;uhRegionRadius*=1.-uhLip*uhLipMix*.16;
 }
`;
function patchShader(material,U){const prior=material.onBeforeCompile;material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);s.vertexShader='attribute vec4 uhRegion;attribute vec2 uhStrain;varying vec4 vUHRegion;varying vec2 vUHStrain;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvUHRegion=uhRegion;vUHStrain=uhStrain;');s.fragmentShader=s.fragmentShader.replace('float kThickness(vec3 p)',FUNCTIONS+'\nfloat kThickness(vec3 p)');
 const replace=(a,b)=>{if(!s.fragmentShader.includes(a))throw Error('Inherited skin shader hook missing: '+a);s.fragmentShader=s.fragmentShader.replace(a,b);};
 replace('diffuseColor.rgb=mix(diffuseColor.rgb,kAlbedo,kCover);','diffuseColor.rgb=mix(diffuseColor.rgb,kAlbedo,kCover);'+COLOR);
 replace('roughnessFactor=mix(.72,clamp(kRoughness+kCR.a-.53-kOil*.025,.25,.85),kCover);',`roughnessFactor=mix(.72,clamp(kRoughness+kCR.a-.53-kOil*.025,.25,.85),kCover);
 if(uhMode>.5){roughnessFactor=clamp(roughnessFactor+uhRegionRough*(.036-uhR.x*.13+uhR.w*.07)+uhMacro*.025*uhVariation+uhFoundation*.10+uhStr.x*.035-uhStr.y*.045-uhLip*uhLipGloss*.22,.24,.82);}`);
 replace('vec3 kGrad=kGradient(kP,kW)*kCover;',`vec3 kGrad=kGradient(kP,kW)*kCover;
 if(uhMode>.5){float coupling=mix(1.,clamp((roughnessFactor-.16)/.40,.2,1.5),uhRoughCoupling);kGrad=uhGradient(kP,kW)*kCover*coupling*(1.+uhStr.x*.50-uhStr.y*.36)*(1.-uhFoundation*.28)*(1.-uhLip*uhLipGloss*.55);}`);
 replace('material.clearcoat=kOil*.68*kCover;',`material.clearcoat=kOil*.68*kCover;
 if(uhMode>.5)material.clearcoat=clamp(material.clearcoat*(.6+uhOilZones*uhR.x*2.)+uhLip*uhLipGloss*.5,0.,.65)*kCover;`);
 replace('material.clearcoatRoughness=clamp(.36-kOil*.14+(kCR.a-.53)*.6,.19,.5);',`material.clearcoatRoughness=clamp(.36-kOil*.14+(kCR.a-.53)*.6,.19,.5);if(uhMode>.5)material.clearcoatRoughness=clamp(material.clearcoatRoughness+uhMacro*.025-uhLip*uhLipGloss*.10,.19,.5);`);
 replace('if(kPass>1.5)gl_FragColor=vec4(diffuseColor.rgb,kCover);',`if(kPass>1.5)gl_FragColor=vec4(diffuseColor.rgb,kCover*mix(1.,uhRegionRadius,uhMode));
 if(uhLayer>.5){vec3 debug=uhLayer<1.5?diffuseColor.rgb:uhLayer<2.5?vec3(roughnessFactor):uhLayer<3.5?normal*.5+.5:uhLayer<4.5?vec3(uhR.x,uhR.y,uhLip):vec3(uhStr.x,.03,uhStr.y);gl_FragColor=vec4(debug,kCover);}`);
 };material.customProgramCacheKey=()=>VERSION;}
export class UHLayer{
 constructor(base){this.base=base;this.v=base.v;this.originalKernel=base.blur.uniforms.kernel.value.map(v=>v.clone());this.regionReport=regions(this.v);this.strain=new StrainField(this.v.geometry,this.regionReport.scope);this.strain.update(this.v.model.state);this.U={};const uniform=(name,v)=>this.U[name]={value:v};for(const name of ['uhMode','uhAlbedoMix','uhBaseMix','uhVariation','uhRedness','uhPalmLight','uhMeso','uhMicro','uhRoughCoupling','uhRegionRough','uhOilZones','uhLipMix','uhLipGloss','uhFoundation','uhTension','uhLayer'])uniform(name,0);for(const name of ['uhTone','uhBaseColor','uhLipColor'])uniform(name,new THREE.Color());patchShader(base.material,this.U);
  base.blur.uniforms.uhMode=this.U.uhMode;base.blur.fragmentShader='uniform float uhMode;\n'+base.blur.fragmentShader;base.blur.fragmentShader=base.blur.fragmentShader.replace('float pixels=clamp(radius*.001*projectionScale/z*absorb,.1,35.);','float localRadius=mix(1.,texture2D(tAlbedo,vUv).a,uhMode);float pixels=clamp(radius*.001*projectionScale/z*absorb*localRadius,.1,35.);');
  base.compose.uniforms.uhLayer=this.U.uhLayer;base.compose.fragmentShader='uniform float uhLayer;\n'+base.compose.fragmentShader;base.compose.fragmentShader=base.compose.fragmentShader.replace('void main(){','void main(){if(uhLayer>.5){vec4 f=texture2D(tFull,vUv);gl_FragColor=vec4(mix(srgb(background),uhLayer>2.5&&uhLayer<3.5?f.rgb:srgb(f.rgb),f.a),1.);return;}');
  live.add(this);latest=this;this.sync(false);
 }
 sync(render=true){const map={mode:'uhMode',albedoMix:'uhAlbedoMix',baseMix:'uhBaseMix',variation:'uhVariation',redness:'uhRedness',palmLight:'uhPalmLight',meso:'uhMeso',micro:'uhMicro',roughCoupling:'uhRoughCoupling',regionRoughness:'uhRegionRough',oilZones:'uhOilZones',lipMix:'uhLipMix',lipGloss:'uhLipGloss',foundation:'uhFoundation',tension:'uhTension'};for(const[k,u]of Object.entries(map))this.U[u].value=S[k];this.U.uhLayer.value={beauty:0,albedo:1,roughness:2,normal:3,regions:4,strain:5}[S.layer]||0;
  const dark=new THREE.Color('#4e2f25'),light=new THREE.Color('#d9b4a2');this.U.uhTone.value.copy(dark).lerp(light,S.tone);const warmth=S.warmth-.5;this.U.uhTone.value.r*=1+warmth*.16;this.U.uhTone.value.g*=1+warmth*.02;this.U.uhTone.value.b*=1-warmth*.16;this.U.uhBaseColor.value.set(S.baseColor);this.U.uhLipColor.value.set(S.lipColor);
  this.base.blur.uniforms.kernel.value=rescaleKernel(this.originalKernel,S.mode?[S.radiusR,S.radiusG,S.radiusB]:[1,1,1]);if(render)this.v.render();syncUI();
 }
 geometryChanged(){this.strain.update(this.v.model.state);syncUI();}
 report(){return{version:VERSION,settings:{...S},regions:{source:this.regionReport.source,counts:this.regionReport.counts},tension:this.strain.report(),kernelSums:[0,1,2].map(c=>this.base.blur.uniforms.kernel.value.reduce((n,v)=>n+v.getComponent(c),0)),baseline:'R01.1 renderer retained; compare uses same camera and lights',copiedUniversalHumanAssets:false,proprietaryNodeGraphRead:false,geometryChanged:false,bodyField:'same canonical position/index buffers',limitations:['WebGL SSS approximation, not Cycles Random Walk','no UH commercial textures or node graph','no geometry displacement or authored expression-wrinkle maps','original eyes and brows unchanged','full-body transmission remains disabled']};}
 dispose(){this.v.geometry.deleteAttribute('uhRegion');this.v.geometry.deleteAttribute('uhStrain');live.delete(this);if(latest===this)latest=null;}
}
const ranges={mode:[0,1],tone:[0,1],warmth:[0,1],albedoMix:[0,1],baseMix:[0,1],variation:[0,1],redness:[0,1],palmLight:[0,1],meso:[0,2],micro:[0,2],roughCoupling:[0,1],regionRoughness:[0,1],oilZones:[0,1],lipMix:[0,1],lipGloss:[0,1],foundation:[0,1],radiusR:[.4,1.8],radiusG:[.4,1.8],radiusB:[.4,1.8],tension:[0,1]};
function set(input){for(const[k,v]of Object.entries(input)){if(ranges[k]&&Number.isFinite(v))S[k]=clamp(v,...ranges[k]);else if(['baseColor','lipColor'].includes(k)&&/^#[0-9a-f]{6}$/i.test(v))S[k]=v;else if(k==='layer'&&['beauty','albedo','roughness','normal','regions','strain'].includes(v))S[k]=v;}for(const x of live)x.sync();syncUI();return{...S};}
function syncUI(){if(typeof document==='undefined')return;for(const[k,v]of Object.entries(S)){const e=document.getElementById('uh-'+k);if(e)e.value=v;const o=document.getElementById('uh-'+k+'-out');if(o)o.textContent=typeof v==='number'?v.toFixed(2):v;}for(const b of document.querySelectorAll('[data-uh-mode]'))b.setAttribute('aria-pressed',String(Number(b.dataset.uhMode)===S.mode));const status=document.getElementById('uh-state');if(status)status.textContent=latest?'分层 / 区域反射已接入 · '+(latest.strain.rest?'张力已按当前体型校准':'体型已变，回到中性姿态后重校准张力'):'等待原共同模型载入';}
function message(s){const e=document.getElementById('uh-message');if(e)e.textContent=s;}
export function mountUHControls(){
 const host=document.getElementById('skin-panel');if(!host)return;const el=document.createElement('div');el.className='uh-controls';const slider=(k,label)=>`<label for="uh-${k}">${label}<output id="uh-${k}-out"></output><input id="uh-${k}" type="range" min="${ranges[k][0]}" max="${ranges[k][1]}" step="0.01" value="${S[k]}"></label>`;
 el.innerHTML=`<div class="uh-row"><strong>UH 文档学习 · R02</strong><button data-uh-mode="1" aria-pressed="true">新分层处理</button><button data-uh-mode="0" aria-pressed="false">上一版处理</button><button id="uh-macro">皮肤近看</button><details class="uh-details"><summary>分层参数与对照</summary><div class="uh-body"><p class="uh-info">独立实现公开参数关系，非 Universal Human 原版移植。原人体 / 骨架 / 教师参数不改。</p><div class="uh-presets"><button data-uh-preset="natural">自然肤层</button><button data-uh-preset="dry">细孔哑光</button><button data-uh-preset="warm">深暖肤层</button></div><label>检查通道<select id="uh-layer"><option value="beauty">完整皮肤</option><option value="albedo">颜色层</option><option value="roughness">实际粗糙度</option><option value="normal">微表面法线</option><option value="regions">分区：油脂 / 血色 / 唇</option><option value="strain">张力：压缩红 / 拉伸蓝</option></select></label><h3>肤色底层 → 基底 → 纹理</h3>${slider('tone','肤色底层明暗')}${slider('warmth','底层冷暖')}${slider('albedoMix','扫描颜色纹理混合')}${slider('baseMix','基底覆盖量')}<label>基底颜色<input id="uh-baseColor" type="color" value="${S.baseColor}"></label>${slider('variation','多尺度色素起伏')}${slider('redness','面部局部血色（艺术）')}${slider('palmLight','掌侧色素差异')}<h3>区域反射与微表面联动</h3>${slider('meso','扫描中频细纹')}${slider('micro','扫描高频微孔')}${slider('roughCoupling','粗糙度 → 微孔幅度')}${slider('regionRoughness','区域粗糙度差异')}${slider('oilZones','T 区油脂分布')}<h3>局部覆盖层</h3>${slider('lipMix','唇部颜色层')}<label>唇部颜色<input id="uh-lipColor" type="color" value="${S.lipColor}"></label>${slider('lipGloss','唇部光泽 → 微结构')}${slider('foundation','均匀哑光覆盖层')}<h3>RGB 扩散宽度（相对原核）</h3>${slider('radiusR','红通道宽度')}${slider('radiusG','绿通道宽度')}${slider('radiusB','蓝通道宽度')}<h3>动作微表面实验</h3>${slider('tension','前臂 / 手部压缩拉伸响应')}<p class="uh-info">只改变材质；不是新雕刻皱纹。改变体型时，旧张力参考失效；只有中性姿态才自动重新校准。面部不套用手臂张力。</p><div class="uh-presets"><button id="uh-save">保存材质</button><button id="uh-restore">恢复材质</button><button id="uh-export">导出配方</button><button id="uh-import">导入配方</button></div><input hidden type="file" id="uh-file" accept="application/json,.json"><p id="uh-message" role="status"></p><p class="uh-info">灯光、相机与模型不随预设改变。原眼睛和眉毛仍未处理；薄部透光继续停用。</p><a href="${new URL('RESEARCH.md',import.meta.url).href}" target="_blank" rel="noopener">研究记录 / 来源与边界</a></div></details><span id="uh-state" role="status"></span></div>`;host.prepend(el);
 for(const b of el.querySelectorAll('[data-uh-mode]'))b.onclick=()=>{window.commonSkin.set({enabled:true});set({mode:Number(b.dataset.uhMode),layer:'beauty'});};for(const b of el.querySelectorAll('[data-uh-preset]'))b.onclick=()=>{window.commonSkin.set({enabled:true});set(PRESETS[b.dataset.uhPreset]);};
 for(const e of el.querySelectorAll('input[id^="uh-"],select'))if(e.type!=='file')e.oninput=()=>set({[e.id.slice(3)]:e.type==='range'?Number(e.value):e.value});
 el.querySelector('#uh-macro').onclick=()=>{const v=latest?.v;if(!v)return;v.view('face');v.camera.position.copy(v.orbit.target).add(new THREE.Vector3(.12,0,.53));v.orbit.update();v.render();};
 const recipe=()=>({schema:'kaopu/skin-uh-look@1',version:VERSION,values:{...S},base:window.commonSkin.report().settings,topology:window.commonSkin.report().topology});
 function validate(o){if(o?.schema!=='kaopu/skin-uh-look@1'||!o.values||!o.base)throw Error('不是本版材质配方');for(const[k,v]of Object.entries(o.values)){if(ranges[k]&&!Number.isFinite(v))throw Error('无效参数 '+k);}return o;}
 const restore=o=>{validate(o);const topology=window.commonSkin.report().topology;if(o.topology&&topology&&o.topology!==topology)throw Error('人物拓扑不同，未套用局部配方');set(o.values);window.commonSkin.set(o.base);};
 el.querySelector('#uh-save').onclick=()=>{try{localStorage.setItem('kaopu-skin-uh-r02',JSON.stringify(recipe()));message('材质已保存；不修改人物档案');}catch{message('浏览器禁止保存，请导出配方');}};
 el.querySelector('#uh-restore').onclick=()=>{try{const text=localStorage.getItem('kaopu-skin-uh-r02');if(!text)throw Error('没有已保存材质');restore(JSON.parse(text));message('已恢复材质');}catch(e){message(e.message);}};
 el.querySelector('#uh-export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='skin-uh-r02.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 el.querySelector('#uh-import').onclick=()=>el.querySelector('#uh-file').click();el.querySelector('#uh-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>30000)throw Error('配方过大');restore(JSON.parse(await f.text()));message('配方已导入');}catch(x){message(x.message);}finally{e.target.value='';}};
 window.uhSkin={version:VERSION,set,report:()=>latest?.report()||{version:VERSION,ready:false,settings:{...S}},recipe,restore,presets:PRESETS};syncUI();
}
