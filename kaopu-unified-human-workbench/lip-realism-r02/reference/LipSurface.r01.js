/* LIP-REALISM-R01. Native lip rails -> independent surface fields.
 * Appended after R07's complete skin hook. No replacement head, added mesh,
 * imported image, world-space sliding texture, or change to the light rig.
 * Tissue colours and micrometre amplitudes are engineering appearance controls,
 * not calibrated blood concentrations, clinical measurements or volume SSS.
 * Evidence and the limits of the two supplied lip-colour studies: RESEARCH.md.
 */
(()=>{'use strict';
const VERSION='LIP-REALISM-R01',SCHEMA='kaopu/lip-realism@1',COARSE_RELIEF_SCALE=.35;
const defaults=Object.freeze({enabled:true,redness:.40,pigment:.25,upperDifference:.18,variation:.65,edgeSoftness:.34,wetness:.35,roughness:.53,foldStrength:.55,seed:731,diagnostic:0});
const limits={redness:[0,1],pigment:[0,1],upperDifference:[-1,1],variation:[0,1],edgeSoftness:[0,1],wetness:[0,1],roughness:[.32,.75],foldStrength:[0,1.2],seed:[1,99999],diagnostic:[0,4]};
const presets={natural:{...defaults},pigmented:{...defaults,pigment:.69,redness:.32,upperDifference:.55,variation:.72},dry:{...defaults,roughness:.65,wetness:.10,foldStrength:.62}};
const labels={redness:'红润程度',pigment:'棕褐色素',upperDifference:'上下唇色差',variation:'局部色彩变化',edgeSoftness:'唇缘过渡',wetness:'内缘湿润反射',roughness:'外露唇面粗糙度',foldStrength:'细纹起伏'};
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('嘴唇参数必须是对象');
 const out={...defaults,...input};
 for(const[k,v]of Object.entries(out)){
  if(k==='enabled'){if(typeof v!=='boolean')throw Error('无效嘴唇开关');continue;}
  const b=limits[k];if(!b||!Number.isFinite(v)||v<b[0]||v>b[1]||(['seed','diagnostic'].includes(k)&&!Number.isInteger(v)))throw Error('无效嘴唇参数：'+k);
 }
 return out;
}
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Lip integration anchor changed: '+a.slice(0,100));return s.replace(a,()=>b);};
function rail(name,points){
 if(!Array.isArray(points)||points.length<3||points.some(p=>p.length<2||!p.every(Number.isFinite)))throw Error('Native lip rail missing');
 const f=n=>Number(n).toFixed(9);let s=`float ${name}(float x){if(x<=${f(points[0][0])})return ${f(points[0][1])};`;
 for(let i=0;i<points.length-1;i++){
  const p=points[i],q=points[i+1],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+2)],span=q[0]-p[0];
  if(span<=0)throw Error('Native lip rails must be ordered');
  const ma=(q[1]-a[1])/(q[0]-a[0]),mb=(b[1]-p[1])/(b[0]-p[0]);
  s+=`if(x<=${f(q[0])}){float t=clamp((x-(${f(p[0])}))/${f(span)},0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*${f(p[1])}+(t3-2.*t2+t)*${f(span*ma)}+(-2.*t3+3.*t2)*${f(q[1])}+(t3-t2)*${f(span*mb)};}`;
 }
 return s+`return ${f(points.at(-1)[1])};}`;
}
function shaderFields(r){
 const f=n=>Number(n).toFixed(9);
 return `
// LIP-REALISM-R01: all coordinates are attached to the inherited lip rest frame.
varying vec4 vL19State,vL19Detail;
uniform float lrEnabled,lrRedness,lrPigment,lrUpperDifference,lrVariation,lrEdgeSoftness,lrWetness,lrRoughness,lrFoldStrength,lrSeed,lrDiagnostic;
float lrMask=0.,lrScope=0.,lrUpper=0.,lrDepth=0.,lrWet=0.,lrR=0.,lrHeight=0.;
vec3 lrSkinSrgb=vec3(0.),lrAlbedo=vec3(0.);
${rail('lrTop',r.top)}
${rail('lrBottom',r.bottom)}
${rail('lrInnerTop',r.innerTop)}
${rail('lrInnerBottom',r.innerBottom)}
float lrHash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+31.32+lrSeed*.00071);return fract((q.x+q.y)*q.z);}
float lrNoise(vec2 p){vec2 i=floor(p),v=fract(p);v=v*v*(3.-2.*v);return mix(mix(lrHash(i),lrHash(i+vec2(1,0)),v.x),mix(lrHash(i+vec2(0,1)),lrHash(i+vec2(1,1)),v.x),v.y);}
// Jittered finite grooves with connected short branches. No repeating sine rows.
// Spacing and heights below are engineering initial values, in mm and metres.
float lrFolds(vec2 mm,float depth,float upper,float footprint){
 float spacing=1.05,cell=floor(mm.x/spacing),height=0.;
 for(int j=-1;j<=1;j++){
  float id=cell+float(j);vec2 k=vec2(id,upper*97.+23.);
  float a=lrHash(k),b=lrHash(k+17.7),c=lrHash(k+54.1),d=lrHash(k+91.3);
  float root=(id+.13+.74*a)*spacing;
  float start=.035+.18*b,end=.60+.36*c;
  float tangent=(a-.5)*.34+(root/${f(Math.max(10,r.half*1000))})*.20;
  float center=root+tangent*(depth-.40)+(b-.5)*.18*depth*(1.-depth)*4.;
  float width=.035+.030*d,filterWidth=sqrt(width*width+footprint*footprint*.30);
  float along=smoothstep(start,start+.13,depth)*(1.-smoothstep(end-.17,end,depth));
  float delta=(mm.x-center)/filterWidth;
  float primary=-exp(-delta*delta)*along;
  float branchStart=.24+.20*c,branchEnd=min(.96,branchStart+.17+.18*a);
  float t=clamp((depth-branchStart)/max(.04,branchEnd-branchStart),0.,1.);
  float branchCenter=center+mix(-1.,1.,step(.5,d))*(.14+.26*b)*t*t*(3.-2.*t);
  float branchDelta=(mm.x-branchCenter)/(filterWidth*.72);
  float branch=-exp(-branchDelta*branchDelta)*smoothstep(0.,.2,t)*(1.-smoothstep(.72,1.,t));
  height+=(primary+.32*branch)*(.000005+.000006*c)*(width/filterWidth);
 }
 float crossField=lrNoise(mm*vec2(.47,3.0)+upper*41.);
 float crossFold=-pow(clamp((crossField-.48)*2.,0.,1.),3.)*.0000024;
 float micro=(lrNoise(mm*vec2(5.1,6.3)+upper*71.)-.5)*.0000016;
 float visibility=1.-smoothstep(.055,.34,footprint);
 return (height+crossFold+micro)*visibility*smoothstep(-.08,.12,depth)*(1.-smoothstep(.86,1.08,depth));
}
void lrEvaluate(float oldMask){
 float top=lrTop(vFRest.x),bottom=lrBottom(vFRest.x),it=lrInnerTop(vFRest.x),ib=lrInnerBottom(vFRest.x);
 float u=(vFRest.x-${f(r.cx)})/${f(r.half)};
 lrUpper=step((it+ib)*.5,vFRest.y);
 lrDepth=mix((ib-vFRest.y)/max(.001,ib-bottom),(vFRest.y-it)/max(.001,top-it),lrUpper);
 vec2 mm=(vFRest.xy-vec2(${f(r.cx)},${f(r.cy)}))*1000.;
 float footprint=max(length(dFdx(mm)),length(dFdy(mm)));
 float edgeWidth=mix(.00032,.00105,lrEdgeSoftness)*(.75+.5*lrNoise(vec2(u*6.+13.,lrUpper*9.)));
 float aa=max(fwidth(vFRest.y)*.65,edgeWidth);
 float contourJitter=(lrNoise(mm*vec2(1.8,1.1))-.5)*.00015;
 float y=vFRest.y+contourJitter;
 float cover=clamp(vCSRegion.x,0.,1.);
 float front=smoothstep(${f(r.front)},${f(r.front+.006)},vFRest.z);
 float lateral=1.-smoothstep(.965,1.005,abs(u));
 float shape=smoothstep(bottom-aa,bottom+aa,y)*(1.-smoothstep(top-aa,top+aa,y));
 lrMask=shape*lateral*front*cover*smoothstep(0.,.0006,max(0.,top-bottom));
 // Original feather is part of the correction domain, removing its fuzzy tint
 // without changing unrelated face/body surface values.
 lrScope=max(lrMask,oldMask)*front*cover;
 // Derivatives above are evaluated for every fragment before this branch.
 // Unrelated face/body pixels need no tissue noise or groove evaluation.
 if(lrScope==0.)return;
 float tissue=(lrNoise(vec2(u*3.4,lrDepth*2.0)+vec2(31.,lrUpper*7.))-.5);
 float smallTissue=(lrNoise(mm*.48+vec2(11.,lrUpper*37.))-.5);
 float pigmentField=.65+.35*lrNoise(vec2(u*2.6+4.,lrDepth*1.7+lrUpper*8.));
 float wetBand=(1.-smoothstep(.015,.30,lrDepth));
 lrWet=clamp(max(wetBand,clamp(vL19State.x,0.,1.)),0.,1.)*lrMask*(.76+.24*lrNoise(mm*.7+61.));
 float tone=smoothstep(.26,.78,dot(lrSkinSrgb,vec3(.2126,.7152,.0722)));
 vec3 color=mix(vec3(.34,.20,.19),vec3(.77,.54,.51),tone);
 color+=vec3(.10,-.055,-.025)*(lrRedness-.44);
 color*=exp(-vec3(.18,.27,.28)*lrPigment*pigmentField);
 color*=exp(-vec3(.15,.13,.09)*lrUpperDifference*lrUpper);
 color+=vec3(.057,-.034,-.024)*(tissue*.78+smallTissue*.22)*lrVariation;
 color*=1.+tissue*.060*lrVariation;
 // Tissue colour and saliva-film controls are intentionally independent.
 color=mix(color,color*vec3(.90,.85,.91),wetBand*.18);
 float outer=smoothstep(.62,1.02,lrDepth)*(.28+.24*lrNoise(mm*.30+13.));
 color=mix(color,lrSkinSrgb,outer);
 lrAlbedo=psToLinear(clamp(color,.006,.93));
 float roughVariation=(lrNoise(mm*.8+vec2(19.,3.))-.5)*.032;
 lrR=clamp(lrRoughness+lrUpper*.016+roughVariation-lrWetness*lrWet*.20,.28,.80);
 float strain=clamp(vL19State.y,.72,1.5);
 lrHeight=lrFolds(mm,lrDepth,lrUpper,footprint)*lrFoldStrength/strain;
 lrHeight*=1.-lrWet*.16*lrWetness;
}
`;
}
function addSurface(shader,rails,uniforms){
 Object.assign(shader.uniforms,uniforms);let f=shader.fragmentShader;
 // Insert after every inherited declaration. Putting these helpers directly
 // after <common> would use vFRest / vCSRegion / psToLinear before declaration.
 const main=f.match(/void\s+main\s*\(\s*\)\s*\{/g);
 if(main?.length!==1)throw Error('Lip integration expects one fragment main');
 f=once(f,main[0],shaderFields(rails)+'\n'+main[0]);
 f=once(f,'float psLipFeather=smoothstep(.02,.94,psL);','float psLipFeather=smoothstep(.02,.94,psL);lrSkinSrgb=psSrgb;lrEvaluate(psLipFeather);');
 f=once(f,'roughnessFactor=psR;',`
 // Final lip ownership comes AFTER all inherited skin colour and relief layers.
 if(lrEnabled>.5&&lrScope>0.){
  vec3 boundedBase=mix(psToLinear(clamp(lrSkinSrgb,.008,.94)),lrAlbedo,lrMask);
  psBase=mix(psBase,boundedBase,lrScope);diffuseColor.rgb=psBase;
  if(lrMask>0.){psH=mix(psH,lrHeight,lrMask);psR=mix(psR,lrR,lrMask);}
 }
 roughnessFactor=psR;`);
 f=once(f,'clearcoatNormal=normal;',`clearcoatNormal=normal;
 if(lrEnabled>.5&&lrMask>0.){
  material.clearcoat=mix(material.clearcoat,.010+.20*lrWetness*lrWet,lrMask);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,.34-.12*lrWetness*lrWet,lrMask);
 }`);
 f=once(f,'#include <opaque_fragment>',`
 if(lrDiagnostic>.5&&lrDiagnostic<1.5)outgoingLight=vec3(step(.000005,lrScope)*8.);
 if(lrDiagnostic>1.5&&lrDiagnostic<2.5)outgoingLight=psBase;
 if(lrDiagnostic>2.5&&lrDiagnostic<3.5)outgoingLight=vec3(psR);
 if(lrDiagnostic>3.5)outgoingLight=normal*.5+.5;
 #include <opaque_fragment>`);
 shader.fragmentShader=f;return f;
}
window.__LIP_REALISM__={version:VERSION,ready:false,errors:[],source:window.__LIP_REALISM_SOURCE__||null};
function boot(){
 const status=window.__LIP_REALISM__,skin=window.headProceduralSkin,body=window.bodyProceduralSkin,v=window.__IDENTITY_QA__?.viewer?.(),model=window.__IDENTITY_QA__?.model?.(),controller=window.__IDENTITY_QA__?.controller?.();
 if(!skin||!body||!v?.startupFinalFrame||!window.__HEAD_PROC__?.gpuVerified||window.__R05_PRESET_READY__!==true)return false;
 if(!model?.lipStructure?.rails)throw Error('当前人物的原生唇缘缺失，未创建替代嘴唇');
 const rails=model.lipStructure.rails,mat=skin.material();
 if(!mat?.isMeshPhysicalMaterial)throw Error('当前嘴唇接入需要原平台 MeshPhysicalMaterial');
 const oldCompile=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey.bind(mat);
 let state=validate(defaults),compiles=0,finalFragment='',lastView='macro',geometryApplied=false;
 // The inherited main grooves are already geometry, not the replaced psH.
 // Scale only that native local relief during its synchronous calculation.
 // Restore the actual DNA value in finally: presets, UI and archives keep
 // their original authoring values, without repeated multiplicative decay.
 const mother=model.lipStructure.mother,nativeMotherUpdate=mother.update;
 mother.update=function(geometry){
  const dna=model.lipStructure.anatomy.settings,original=dna.microGeometry;
  if(state.enabled)dna.microGeometry=original*COARSE_RELIEF_SCALE;
  try{return nativeMotherUpdate.call(this,geometry);}finally{dna.microGeometry=original;}
 };
 const names={enabled:'lrEnabled',redness:'lrRedness',pigment:'lrPigment',upperDifference:'lrUpperDifference',variation:'lrVariation',edgeSoftness:'lrEdgeSoftness',wetness:'lrWetness',roughness:'lrRoughness',foldStrength:'lrFoldStrength',seed:'lrSeed',diagnostic:'lrDiagnostic'},uniforms={};
 for(const[k,n]of Object.entries(names))uniforms[n]={value:k==='enabled'?Number(state[k]):state[k]};
 mat.onBeforeCompile=function(shader,...args){oldCompile.call(this,shader,...args);finalFragment=addSurface(shader,rails,uniforms);compiles++;};
 mat.customProgramCacheKey=()=>oldKey()+'/'+VERSION+'/native-rails-v1';mat.needsUpdate=true;
 function gpu(){
  const gl=v.renderer.getContext(),p=v.renderer.properties.get(mat),program=p.currentProgram||(p.programs&&[...p.programs.values()].at(-1));
  const linked=!!program?.program&&!!gl.getProgramParameter(program.program,gl.LINK_STATUS);
  return{linked,programId:program?.id??null};
 }
 function report(){
  const g=gpu();return{version:VERSION,ready:compiles>0&&g.linked,linked:g.linked,shaderCompiles:compiles,programId:g.programId,settings:{...state},source:status.source,view:lastView,canonicalGeometryChanged:false,displayLipReliefAdjusted:state.enabled,coarseReliefScale:state.enabled?COARSE_RELIEF_SCALE:1,nativeMicroGeometry:model.lipStructure.anatomy.settings.microGeometry,maxGeometryFurrowMicrons:model.lipStructure.biomechanicsReport?.maxGeometryFurrowMicrons,newMeshes:0,newImageMaps:0,wholeBodySkinFilesChanged:false,lightingChangedByModule:false,coordinateSystem:'existing native lip outer/inner rails in fRest; follows inherited deformation',fieldsSummary:{outerTop:rails.top.length,outerBottom:rails.bottom.length,innerTop:rails.innerTop.length,innerBottom:rails.innerBottom.length,widthMM:rails.half*2000,upperLowerIndependent:true,wetnessChangesAlbedo:false,pigmentChangesGeometry:false,maskDomain:'native lip and inherited lip feather; independently checked against native mouth ROI',microAmplitude:'engineering micrometre-scale relief; inherited coarse groove amplitude locally reduced, not measured anatomy'},fullVolumeScattering:false,visualAcceptance:false,productionReady:false};
 }
 const panel=document.createElement('section');panel.id='lr-controls';
 panel.innerHTML=`<h2>嘴唇专项 <small>R01 · 同一人物</small></h2><p class="lr-intro">上下唇分区、自然细纹与内缘湿润反射。</p><div class="lr-row"><button data-lr-mode="new" aria-pressed="true">本版嘴唇</button><button data-lr-mode="original" aria-pressed="false">原版嘴唇</button></div><p class="lr-note">切换时保持同一人物、镜头和灯光。</p><div class="lr-row lr-views"><button data-lr-view="front">整脸正面</button><button data-lr-view="macro">嘴部正面</button><button data-lr-view="oblique">嘴部斜侧</button><button data-lr-view="bust">头颈同框</button></div><label class="lr-select">唇部状态<select id="lr-preset"><option value="natural">自然裸唇</option><option value="pigmented">色素较深</option><option value="dry">轻微偏干</option></select></label><div class="lr-sliders">${Object.entries(labels).map(([k,label])=>`<label>${label}<output data-lr-value="${k}"></output><input data-lr="${k}" aria-label="${label}" type="range" min="${limits[k][0]}" max="${limits[k][1]}" step=".01"></label>`).join('')}</div><label class="lr-select">观察通道<select id="lr-diagnostic"><option value="0">完整材质</option><option value="1">唇部作用范围</option><option value="2">仅底色</option><option value="3">粗糙度</option><option value="4">表面法线</option></select></label><div class="lr-row"><button data-lr-action="seed">换一份局部变化</button><button data-lr-action="reset">恢复本版默认</button></div><div class="lr-row"><button data-lr-action="save">保存完整人物</button><button data-lr-action="load">载入人物档案</button><input id="lr-file" type="file" accept="application/json" hidden></div><p id="lr-status" role="status"></p><details><summary>本次改善与研究依据</summary><p>区域来自本人的原生唇缘。唇色、粗糙度、细纹与水膜分别控制，数值是制作参数。研究支持唇色的差异与连续变化，不能将论文色表直接铺满嘴唇。本版仍需视觉验收。</p><a href="https://onlinelibrary.wiley.com/doi/10.1111/srt.13418" target="_blank" rel="noopener">上下唇色测量</a> · <a href="https://onlinelibrary.wiley.com/doi/full/10.1111/ics.70004" target="_blank" rel="noopener">自然唇色色域</a> · <a href="https://dev.epicgames.com/documentation/unreal-engine/digital-humans?application_version=4.27" target="_blank" rel="noopener">数字人表面通道</a></details>`;
 const shell=document.querySelector('#control-shell');if(!shell)throw Error('原人物总台控件容器缺失');shell.prepend(panel);
 const oldPanel=document.querySelector('#ps-controls');if(oldPanel){const fold=document.createElement('details');fold.id='lr-existing';const summary=document.createElement('summary');summary.textContent='展开原有皮肤与灯光参数';fold.append(summary);oldPanel.before(fold);fold.append(oldPanel);}
 const style=document.createElement('style');style.textContent=`#lr-controls{padding:18px 18px 14px;color:#e8e6df;background:#172127;font:13px/1.55 system-ui;flex-shrink:0}#lr-controls h2{font-size:21px;line-height:1.2;margin:0 0 8px}#lr-controls h2 small{font-size:12px;font-weight:400;color:#b6c9c9;margin-left:8px}#lr-controls p{margin:6px 0 10px;font-size:12px;color:#b9c7c8}.lr-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}.lr-row button{min-height:36px;font-size:12px}.lr-row button[aria-pressed="true"]{border-color:#d7c091;background:#354440;color:#f6ecdb}.lr-views{gap:5px}.lr-select{display:block;margin:12px 0}.lr-select select{display:block;width:100%;min-height:34px;font-size:12px;margin-top:4px}.lr-sliders label{display:block;margin:8px 0;font-size:12px}.lr-sliders output{float:right;font-variant-numeric:tabular-nums;color:#d8c49c}.lr-sliders input{display:block;width:100%;height:16px;accent-color:#cdb78f}#lr-controls details{font-size:12px;margin-top:8px}#lr-status{border-top:1px solid #405259;padding-top:10px}#lr-existing{border-top:1px solid #566765;font:13px system-ui}#lr-existing>summary{padding:15px;cursor:pointer}#lr-controls .lr-note{font-size:11px}#control-shell{overflow-y:auto!important}#lr-controls a{color:#c6ddcf}@media(max-width:900px){#lr-controls{padding:13px}.lr-sliders{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}#lr-controls h2{font-size:18px}}`;document.head.append(style);
 function sync(){
  for(const[k,n]of Object.entries(names))uniforms[n].value=k==='enabled'?Number(state[k]):state[k];
  for(const input of panel.querySelectorAll('[data-lr]')){input.value=state[input.dataset.lr];panel.querySelector(`[data-lr-value="${input.dataset.lr}"]`).textContent=Number(input.value).toFixed(2);}
  panel.querySelector('#lr-diagnostic').value=state.diagnostic;
  for(const b of panel.querySelectorAll('[data-lr-mode]'))b.setAttribute('aria-pressed',String((b.dataset.lrMode==='new')===state.enabled));
  panel.querySelector('#lr-status').textContent=`${state.enabled?'本版嘴唇':'R07 原版嘴唇对照'} · 同一总台人物 · 局部种子 ${state.seed}`;
 }
 function set(part){const previous=state.enabled;state=validate({...state,...part});sync();if(!geometryApplied||previous!==state.enabled){v.update();geometryApplied=true;}else v.render();status.ready=report().ready;return report();}
 function view(kind){
  if(!['front','macro','oblique','bust'].includes(kind))throw Error('无效嘴唇观察视角');
  // Reuse the host's framing calculations, then remove perspective skew for
  // the front comparison. Material toggles never call this function.
  const lightMode=skin.inspection?.report?.().mode;
  document.body.classList.remove('ear-focus','lips-focus');
  if(kind==='front')window.headMorphology.view('front');
  else if(kind==='bust')body.focus('bust');
  else window.lipWorkbench.view('macro');
  if(kind==='macro'||kind==='oblique'){
   const t=v.orbit.target,d=v.camera.position.distanceTo(t),angle=kind==='oblique'?.32:0;
   v.camera.position.set(t.x+Math.sin(angle)*d,t.y,t.z+Math.cos(angle)*d);v.camera.updateProjectionMatrix();v.orbit.update();
  }
  if(lightMode&&skin.inspection?.set)skin.inspection.set(lightMode);
  lastView=kind;v.render();return{kind,camera:v.camera.position.toArray(),target:v.orbit.target.toArray(),zoom:v.camera.zoom};
 }
 const priorArchive=controller.archive.bind(controller),priorRestore=controller.restore.bind(controller);
 // Native ET19 calibrates groove strain from a historical neutral surface.
 // Its original archive omits those reference arrays. A portrait round trip
 // may recalibrate them, even when canonical geometry and DNA are identical.
 // Preserve the actual native calibration alongside the new surface settings;
 // this keeps saved persons exact without changing their authored anatomy.
 const calibrationSchema='kaopu/lip-calibration@1';
 const nativeCalibration=()=>mother.surfaces.get(v.currentLip?.geometry);
 const calibrationCount=nativeCalibration()?.topology.count;
 const nativeIdentityKey=()=>JSON.stringify([model.state.gnm.identity,model.state.anny.phenotypes,model.state.anny.localChanges,model.identityLab?.settings?.shape]);
 function encodeReference(a){
  if(!a)return null;const bytes=new Uint8Array(a.length*4),data=new DataView(bytes.buffer);
  for(let i=0;i<a.length;i++)data.setFloat32(i*4,a[i],true);
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
 }
 function decodeReference(value,count){
  if(value===null)return null;
  if(typeof value!=='string'||value.length!==Math.ceil(count*4/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('无效唇纹参考数据');
  const binary=atob(value);if(binary.length!==count*4)throw Error('唇纹参考数据长度不匹配');
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),data=new DataView(bytes.buffer),a=new Float32Array(count);
  for(let i=0;i<count;i++){const n=data.getFloat32(i*4,true);if(!Number.isFinite(n)||n<0)throw Error('无效唇纹参考数值');a[i]=n;}return a;
 }
 function calibrationArchive(){
  const c=nativeCalibration();if(!c)return null;
  if(c.topology.count!==calibrationCount||c.lastKey!==nativeIdentityKey())throw Error('原生唇纹校准与当前人物不匹配');
  return{schema:calibrationSchema,count:c.topology.count,lastKey:c.lastKey,byteOrder:'float32-le',reference:encodeReference(c.reference),referenceHorizontal:encodeReference(c.referenceHorizontal)};
 }
 function calibrationInput(c){
  if(c===undefined||c===null)return null;
  if(c.schema!==calibrationSchema||c.byteOrder!=='float32-le'||!Number.isInteger(c.count)||c.count!==calibrationCount||typeof c.lastKey!=='string'||c.lastKey.length>200000)throw Error('不支持的唇纹校准档案');
  return{count:c.count,lastKey:c.lastKey,reference:decodeReference(c.reference,c.count),referenceHorizontal:decodeReference(c.referenceHorizontal,c.count)};
 }
 function archive(){return{...priorArchive(),lipRealism:{schema:SCHEMA,version:VERSION,settings:{...state},calibration:calibrationArchive()}};}
 async function restore(a){
  const own=a?.lipRealism;if(own&&own.schema!==SCHEMA)throw Error('不支持的嘴唇档案');
  const next=validate(own?own.settings:defaults),calibration=calibrationInput(own?.calibration),copy=structuredClone(a);delete copy.lipRealism;
  // Match the frozen ET19 key before changing the current person. Its fourth
  // component is null: this host exposes identityLab.shape, not .settings.shape.
  // Preserve that native contract here rather than silently changing it.
  const archivedKey=JSON.stringify([copy?.state?.gnm?.identity,copy?.state?.anny?.phenotypes,copy?.state?.anny?.localChanges,null]);
  if(calibration&&calibration.lastKey!==archivedKey)throw Error('唇纹校准不属于此人物档案');
  await priorRestore(copy);
  if(!calibration)return set(next);
  const c=nativeCalibration();
  if(!c||c.topology.count!==calibration.count||nativeIdentityKey()!==calibration.lastKey)throw Error('唇纹校准与载入的人物不匹配');
  c.reference=calibration.reference;c.referenceHorizontal=calibration.referenceHorizontal;c.lastKey=calibration.lastKey;
  state=next;sync();v.update();geometryApplied=true;status.ready=report().ready;return report();
 }
 controller.archive=archive;controller.restore=restore;window.fullCommonWorkbench.archive=archive;window.fullCommonWorkbench.restore=restore;
 function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(archive(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lip-realism-r01-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const api={version:VERSION,get ready(){return report().ready;},set,settings:()=>({...state}),report,view,archive,restore,validate,defaults:()=>({...defaults}),presets:()=>structuredClone(presets),fragment:()=>finalFragment};window.lipRealism=api;
 panel.addEventListener('input',e=>{if(e.target.dataset.lr)set({[e.target.dataset.lr]:Number(e.target.value)});});
 panel.querySelector('#lr-diagnostic').onchange=e=>set({diagnostic:Number(e.target.value)});
 panel.querySelector('#lr-preset').onchange=e=>set({...presets[e.target.value],seed:state.seed,diagnostic:state.diagnostic});
 panel.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.lrMode)set({enabled:b.dataset.lrMode==='new'});
  if(b.dataset.lrView)view(b.dataset.lrView);
  switch(b.dataset.lrAction){case'seed':set({seed:(state.seed*16807)%99991+1});break;case'reset':set(defaults);panel.querySelector('#lr-preset').value='natural';break;case'save':save();break;case'load':panel.querySelector('#lr-file').click();break;}
 }catch(e){panel.querySelector('#lr-status').textContent=String(e);status.errors.push(String(e));console.error('LIP_REALISM_CONTROL',e);}});
 panel.querySelector('#lr-file').onchange=async e=>{try{await restore(JSON.parse(await e.target.files[0].text()));}catch(err){panel.querySelector('#lr-status').textContent=String(err);}finally{e.target.value='';}};
 document.title='KAOPU · 人物总台嘴唇专项 R01';document.querySelector('header strong').textContent='人物总台 · 嘴唇专项 R01';document.documentElement.dataset.lipRealism=VERSION;
 document.documentElement.dataset.lipSource=status.source?.sourceCommit||'local';
 set(defaults);view('macro');v.render();status.ready=report().ready;status.report=report();return true;
}
const start=performance.now(),timer=setInterval(()=>{try{if(boot()){clearInterval(timer);return;}if(performance.now()-start>300000){clearInterval(timer);window.__LIP_REALISM__.errors.push('原人物材质未就绪，嘴唇专项没有启用替代模型');}}catch(e){clearInterval(timer);window.__LIP_REALISM__.errors.push(String(e));console.error('LIP_REALISM_INIT',e);}},120);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
