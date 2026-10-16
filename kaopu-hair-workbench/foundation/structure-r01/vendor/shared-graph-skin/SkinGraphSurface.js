/* Original surface adapter for the retained human. No external skin assets.
 * Own graph fields -> filtered slopes and slope variance -> native physical BRDF.
 * Microrelief does not own pigment, skeletal shape or tissue light transport. */
(()=>{'use strict';if(window.__GRAPH_SKIN_PENDING__)return;window.__GRAPH_SKIN_PENDING__=true;
const ready=setInterval(()=>{if(window.__UNIFIED_SKIN__?.ready&&window.headProceduralSkin&&window.SkinGraphKernel){clearInterval(ready);boot().catch(e=>{window.__GRAPH_SKIN_ERROR__=e.stack;console.error('GRAPH_SKIN',e);});}},100);
async function boot(){
 const api=headProceduralSkin,v=__IDENTITY_QA__.viewer(),model=__IDENTITY_QA__.model(),mat=api.material(),K=SkinGraphKernel;
 const same={geometry:v.geometry,positions:model.positions,faces:model.faces};
 const defaults={enabled:true,seed:api.settings().seed,density:.58/api.settings().poreSpacing,width:1,poreWidth:api.settings().poreRadius/.09,wrinkles:.72,pores:.72,angle:0,view:0,filter:true};let state={...defaults},generation=0,field=null,shader=null,textures=[],building=false;
 const U={gmEnabled:{value:1},gmWrinkles:{value:state.wrinkles},gmPores:{value:state.pores},gmAngle:{value:0},gmPeriod:{value:12},gmView:{value:0},gmFilter:{value:1},gmPoreMap:{value:null},gmWrinkleMap:{value:null}};
 function validate(p){for(const[k,x]of Object.entries(p)){if(!(k in defaults))throw Error('未知微纹参数 '+k);if(['enabled','filter'].includes(k)){if(typeof x!=='boolean')throw Error('无效微纹开关');}else{const ranges={seed:[1,99999],density:[.5,2],width:[.5,2],poreWidth:[.25,2],wrinkles:[0,1.5],pores:[0,1.5],angle:[-180,180],view:[0,4]};const b=ranges[k];if(!Number.isFinite(x)||x<b[0]||x>b[1]||(['seed','view'].includes(k)&&!Number.isInteger(x)))throw Error('无效微纹参数 '+k);}}}
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Graph skin shader contract: '+a.slice(0,90));return s.replace(a,()=>b);};
 const declarations=`
 uniform float gmEnabled,gmWrinkles,gmPores,gmAngle,gmPeriod,gmView,gmFilter;
 uniform sampler2D gmPoreMap,gmWrinkleMap;
 uniform float uFPass,uFEnabled;
 float gmHeight=0.,gmDx=0.,gmDy=0.,gmVariance=0.,gmLegacy=0.;
 float gmPoreRegion=1.,gmLineRegion=1.;vec2 gmMetric=vec2(1.);
 vec4 gmRead(sampler2D map,vec2 q){return texture2D(map,q/gmPeriod);}
 // Smooth union prevents a pore plus every incident crease being added as a
 // stack of independent pits. Returned yz are the exact blend derivatives.
 vec3 gmUnion(float a,float b){
  float beta=300.;vec2 pos=exp(clamp(vec2(a,b)*beta,vec2(0.),vec2(60.)));
  vec2 neg=exp(clamp(-vec2(a,b)*beta,vec2(0.),vec2(60.)));
  float sp=pos.x+pos.y-1.,sn=neg.x+neg.y-1.;
  return vec3((log(sp)-log(sn))/beta,a<0.?neg.x/sn:pos.x/sp,b<0.?neg.y/sn:pos.y/sp);
 }
 void gmChart(vec2 raw,float blend,float angle){
  float c=cos(angle),s=sin(angle);mat2 rot=mat2(c,s,-s,c);vec2 q=rot*raw*gmMetric;
  vec4 p=gmRead(gmPoreMap,q),w=gmRead(gmWrinkleMap,q);
  float pg=gmPores*psPores/.88*gmPoreRegion,wg=gmWrinkles*psMicro/.72*gmLineRegion;
  vec3 joint=gmUnion(p.a*pg,w.a*wg);
  vec2 slope=p.xy*pg*joint.y+w.xy*wg*joint.z;
  gmHeight+=joint.x*blend*.001;
  gmDx+=((dot(slope,dFdx(q))+joint.y*p.a*dFdx(pg)+joint.z*w.a*dFdx(wg))*blend+joint.x*dFdx(blend))*.001;
  gmDy+=((dot(slope,dFdy(q))+joint.y*p.a*dFdy(pg)+joint.z*w.a*dFdy(wg))*blend+joint.x*dFdy(blend))*.001;
  float pv=max(0.,p.b-dot(p.xy,p.xy)),wv=max(0.,w.b-dot(w.xy,w.xy));
  gmVariance+=(pv*pg*pg*joint.y*joint.y+wv*wg*wg*joint.z*joint.z)*blend;
 }
 void gmSurface(vec3 mm,vec3 weights,float angle){
  gmChart(mm.yz-vec2(280.,70.)+vec2(2.91,7.13),weights.x,angle+.81);
  gmChart(mm.xz-vec2(0.,70.)+vec2(5.77,1.93),weights.y,angle-.63);
  gmChart(mm.xy-vec2(0.,280.),weights.z,angle);
 }
 `;
 const original=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey.bind(mat);
 let textureType=null;
 function upload(){if(!textureType||!field)return;const next=[];for(const name of ['pore','wrinkle']){const map=field[name+'Map'],base=map.mips[0],tex=new textureType(base.data,base.width,base.height,1023,1016);tex.mipmaps=map.mips;tex.wrapS=tex.wrapT=1000;tex.magFilter=1006;tex.minFilter=1008;tex.generateMipmaps=false;tex.flipY=false;tex.unpackAlignment=1;tex.colorSpace='';tex.needsUpdate=true;tex.name='OWN-GRAPH-'+name.toUpperCase();U[name==='pore'?'gmPoreMap':'gmWrinkleMap'].value=tex;next.push(tex);}for(const t of textures)t.dispose();textures=next;}
 mat.onBeforeCompile=s=>{original(s);Object.assign(s.uniforms,U);if(!textureType){const source=Object.values(s.uniforms).map(u=>u.value).find(x=>x?.isDataTexture);if(!source)throw Error('Native DataTexture constructor unavailable');textureType=source.constructor;upload();}
  let f=s.fragmentShader;f=once(f,'vec3 psBase=vec3(0.);',declarations+'\nvec3 psBase=vec3(0.);');
  // Do not evaluate the displaced Voronoi field when the graph surface is active.
  f=once(f,'vec2 psPore=psPoreSurface(','vec2 psPore=vec2(0.);if(gmEnabled<.5)psPore=psPoreSurface(');
  f=once(f,'if(fbEnabled>.5){\n  psH*=fbPoreGain;','gmLegacy=psH;\n if(fbEnabled>.5){\n  psH*=fbPoreGain;');
  f=once(f,'fbGeomN=normal;vec3 psDx=dFdx(-vViewPosition)',`
   if(gmEnabled>.5){
    float sideFlow=psP.x/sqrt(psP.x*psP.x+.0001);
    float gmForehead=psRegion(psP,vec3(.021,.347,.065),vec3(.063,.031,.077))*fbHead;
    float angle=gmAngle+sideFlow*fbCheek*.38-fbNeck*.25-gmForehead*.16;
    gmPoreRegion=clamp((1.+.30*fbNose-.20*gmForehead-.50*fbLid)*(1.-.24*fbBody),.35,1.4);
    gmLineRegion=clamp(1.-.48*fbNose-.15*gmForehead-.30*fbLid-.12*fbBody,.35,1.);
    gmMetric=vec2(1.-.06*gmForehead+.04*fbNose,1.+.05*gmForehead);
    vec3 gmWarp=vec3(psNoise(psMM*.075+13.),psNoise(psMM*.075+37.),psNoise(psMM*.075+71.))-.5;
    gmSurface(psMM+gmWarp*.18,psWeights,angle);
    float gain=(1.-psLipFeather)*(1.-psThinMask*.50)*mix(1.,fbPoreGain,fbEnabled);
    float extra=psH-gmLegacy*mix(1.,fbPoreGain,fbEnabled);
    gmDx=gmDx*gain+gmHeight*dFdx(gain);gmDy=gmDy*gain+gmHeight*dFdy(gain);
    gmHeight*=gain;gmVariance*=gain*gain;
    psH=gmHeight+psLipH*psLipFeather+extra;
    float alpha=max(.04,roughnessFactor*roughnessFactor);
    if(gmFilter>.5)roughnessFactor=clamp(pow(alpha*alpha+gmVariance*.38,.25),.27,.91);
   }
   fbGeomN=normal;vec3 psDx=dFdx(-vViewPosition)`);
  f=once(f,'dFdx(psH)*psR1+dFdy(psH)*psR2','(dFdx(psH-gmHeight)+gmDx)*psR1+(dFdy(psH-gmHeight)+gmDy)*psR2');
  // Preserve graded pore walls instead of clipping every strong slope to the
  // same angle. Legacy mode retains its original cap for honest comparison.
  f=once(f,'slope*=min(1.,.26/max(length(slope),.0001));','if(gmEnabled>.5)slope*=inversesqrt(1.+dot(slope,slope)/(.65*.65));else slope*=min(1.,.26/max(length(slope),.0001));');
  f=once(f,'#include <opaque_fragment>',`
   // Restore the native screen-diffusion material contract for EVERY mode.
   vec3 gmDiffuse=totalDiffuse;
   #ifdef USE_CLEARCOAT
   gmDiffuse*=1.-material.clearcoat*Fcc;
   #endif
   float gmMask=clamp(vFA.x,0.,1.)*uFEnabled;
   if(uFPass>.5&&uFPass<1.5){gl_FragColor=vec4(gmDiffuse,gmMask);return;}
   if(uFPass>1.5){gl_FragColor=vec4(diffuseColor.rgb,gmMask);return;}
   if(gmView>.5&&gmView<1.5)outgoingLight=vec3(clamp(.5+psH*14000.,0.,1.));
   if(gmView>1.5&&gmView<2.5)outgoingLight=normal*.5+.5;
   if(gmView>2.5&&gmView<3.5)outgoingLight=vec3(roughnessFactor);
   if(gmView>3.5)outgoingLight=max(outgoingLight-gmDiffuse,vec3(0.));
   #include <opaque_fragment>`);s.fragmentShader=f;shader=s;window.__GRAPH_SKIN_SHADER__=f;
 };
 mat.customProgramCacheKey=()=>oldKey()+'/OWN-GRAPH-R02-MOMENTS-PASS';
 function sync(){U.gmEnabled.value=Number(state.enabled);U.gmWrinkles.value=state.wrinkles;U.gmPores.value=state.pores;U.gmAngle.value=state.angle*Math.PI/180;U.gmView.value=state.view;U.gmFilter.value=Number(state.filter);for(const el of panel.querySelectorAll('[data-graph]')){el.value=state[el.dataset.graph];const out=el.parentElement.querySelector('output');if(out)out.textContent=Number(el.value).toFixed(2);}const b=panel.querySelector('#graph-before');if(b)b.textContent=state.enabled?'对照原皮纹':'返回新皮纹';}
 const workerSource=window.__GRAPH_KERNEL_SOURCE__+`\nself.onmessage=e=>{try{const f=SkinGraphKernel.build(e.data);const result={summary:f.summary,resolution:f.resolution,period:f.period,poreField:f.poreField,wrinkleField:f.wrinkleField,poreMap:f.poreMap,wrinkleMap:f.wrinkleMap};const buffers=[f.poreField.buffer,f.wrinkleField.buffer,...f.poreMap.mips.map(m=>m.data.buffer),...f.wrinkleMap.mips.map(m=>m.data.buffer)];self.postMessage({result},buffers);}catch(e){self.postMessage({error:e.stack});}};`;
 const workerURL=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'})),worker=new Worker(workerURL);URL.revokeObjectURL(workerURL);window.addEventListener('pagehide',()=>worker.terminate(),{once:true});
 function generate(options){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('皮纹生成超时')),180000);worker.onmessage=e=>{clearTimeout(timer);e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message||'皮纹线程失败'));};worker.postMessage(options);});}
 let buildChain=Promise.resolve(),requestRevision=0;
 async function rebuild(){const ticket=++requestRevision,options={seed:state.seed,resolution:1024,period:12,density:state.density,width:state.width,poreWidth:state.poreWidth};building=true;status('正在后台生成毛孔与细纹…');const job=buildChain.catch(()=>{}).then(()=>generate(options));buildChain=job;try{const out=await job;if(ticket!==requestRevision)return report();field=out;generation++;upload();status('三层微纹已就绪 · 可换光观察');drawPreview();}finally{if(ticket===requestRevision)building=false;}v.render();return report();}
 function status(s){const e=panel.querySelector('#graph-status');if(e)e.textContent=s;}
 async function set(p){validate(p);const gen=['seed','density','width','poreWidth'].some(k=>k in p&&p[k]!==state[k]);state={...state,...p};sync();if(gen)await rebuild();else v.render();return report();}
 function report(){return{version:'OWN-SKIN-GRAPH-R02-20261016',ready:!!shader&&textures.length===2&&!building,settings:{...state},generation,field:field?.summary,textureCount:textures.length,sameGeometry:v.geometry===same.geometry,samePositions:model.positions===same.positions,sameFaces:model.faces===same.faces,passContractFixed:true,channelsIndependent:true,thirdPartySkinAssets:0,macroGeometryRebuilt:false,biologicalSimulation:false,UVGeodesicGraph:false,periodicPatchApproximation:true,stressAnimationSimulation:false,visualAcceptance:false};}
 function drawPreview(){const c=panel.querySelector('#graph-patch');if(!c||!field)return;const ctx=c.getContext('2d'),N=c.width,img=ctx.createImageData(N,N),step=field.resolution/N;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=Math.floor(y*step)*field.resolution+Math.floor(x*step),h=field.poreField[i]+field.wrinkleField[i],a=(y*N+x)*4,t=clampByte(150+h*4300);img.data[a]=t;img.data[a+1]=t;img.data[a+2]=t;img.data[a+3]=255;}ctx.putImageData(img,0,0);}
 function clampByte(x){return Math.max(0,Math.min(255,Math.round(x)));}
 const panel=document.createElement('section');panel.id='graph-controls';panel.innerHTML=`<button id="graph-open">皮肤微纹</button><div id="graph-body" hidden><strong>皮肤微纹 · 三层生长网络</strong><p>毛孔、主纹与细纹共同构成表面。拖动人物或换光查看。</p><div class="graph-buttons"><button id="graph-before">对照原皮纹</button><button id="graph-reset">恢复本版</button><button id="graph-seed">另一份皮肤</button><button id="graph-close">收起</button></div>${[['wrinkles','细纹深浅',0,1.5],['pores','毛孔深浅',0,1.5],['angle','纹路方向',-180,180],['density','纹理密度',.5,2],['width','细纹宽度',.5,2],['poreWidth','毛孔宽度',.5,2]].map(([k,l,min,max])=>`<label>${l}<output></output><input data-graph="${k}" aria-label="${l}" type="range" min="${min}" max="${max}" step="${k==='angle'?1:.01}"></label>`).join('')}<label>查看<select id="graph-view"><option value="0">完整皮肤</option><option value="1">表面起伏</option><option value="2">表面方向</option><option value="3">光泽分布</option><option value="4">仅看高光</option></select></label><details><summary>生成的纹路与研究依据</summary><canvas id="graph-patch" width="240" height="240"></canvas><p>上图为本项目函数生成的12毫米皮肤块，非照片。区域方向与深浅为自主设定；尚未模拟表情受力。</p><a href="https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/" target="_blank" rel="noopener">研究依据：Disney 2023</a></details><output id="graph-status"></output></div>`;document.body.append(panel);
 panel.querySelector('[data-graph="poreWidth"]').min='.25';
 const style=document.createElement('style');style.textContent=`#graph-controls{position:fixed;right:16px;bottom:14px;z-index:15000;color:#284937;font:12px/1.5 system-ui}#graph-open,#graph-body{background:#f7f6ef;border:1px solid #bbc7bb;border-radius:9px;padding:12px}#graph-open{font:inherit;cursor:pointer}#graph-body{width:285px;max-height:72vh;overflow:auto;box-shadow:0 4px 24px #0002}#graph-body[hidden]{display:none}#graph-body p{font-size:11px;color:#647565}#graph-body label{display:block;margin:10px 0}#graph-body input{display:block;width:100%;accent-color:#36604a}#graph-body label output{float:right}#graph-body button,#graph-body select{font:inherit;color:inherit;background:#fff;border:1px solid #c1cbbd;border-radius:5px;padding:6px}.graph-buttons{display:grid;grid-template-columns:1fr 1fr;gap:5px}#graph-view{display:block;width:100%}#graph-patch{width:100%;height:auto}#graph-status{display:block;margin-top:8px;font-size:11px}`;document.head.append(style);
 panel.querySelector('#graph-open').onclick=()=>{panel.querySelector('#graph-body').hidden=false;panel.querySelector('#graph-open').hidden=true;};panel.querySelector('#graph-close').onclick=()=>{panel.querySelector('#graph-body').hidden=true;panel.querySelector('#graph-open').hidden=false;};
 panel.querySelector('#graph-before').onclick=()=>set({enabled:!state.enabled});panel.querySelector('#graph-reset').onclick=()=>set(defaults);panel.querySelector('#graph-seed').onclick=()=>set({seed:state.seed===99999?1:state.seed+1});
 panel.addEventListener('input',e=>{const k=e.target.dataset.graph;if(k&&!['density','width','poreWidth'].includes(k))set({[k]:Number(e.target.value)});});panel.addEventListener('change',e=>{const k=e.target.dataset.graph;if(k&&['density','width','poreWidth'].includes(k))set({[k]:Number(e.target.value)}).catch(e=>status(e.message));});panel.querySelector('#graph-view').onchange=e=>{model.faceSurface.settings.diffusion=Number(e.target.value)===0?.25:0;set({view:Number(e.target.value)});};
 // The existing skin seed and save/restore remain authoritative across portraits.
 const oldSet=api.set;api.set=function(p){const before=api.settings(),result=oldSet(p),after=api.settings(),change={};if(after.seed!==before.seed)change.seed=after.seed;if(after.poreSpacing!==before.poreSpacing)change.density=.58/after.poreSpacing;if(after.poreRadius!==before.poreRadius)change.poreWidth=after.poreRadius/.09;if(Object.keys(change).length)set(change).catch(e=>status(e.message));return result;};
 const controller=__IDENTITY_QA__.controller(),oldArchive=controller.archive.bind(controller),oldRestore=controller.restore.bind(controller);
 function archive(){return{...oldArchive(),graphSkin:{schema:'kaopu/skin-graph@1',settings:{...state}}};}
 async function restore(a){const settings=a?.graphSkin?.settings;if(a?.graphSkin?.schema&&a.graphSkin.schema!=='kaopu/skin-graph@1')throw Error('不支持的微纹档案');if(settings)validate(settings);await oldRestore(a);await set(settings||{...defaults,seed:api.settings().seed});return report();}
 controller.archive=archive;controller.restore=restore;api.archive=archive;api.restore=restore;window.fullCommonWorkbench.archive=archive;window.fullCommonWorkbench.restore=restore;
 const mount=()=>{const doc=v.renderer.domElement.ownerDocument;if(panel.ownerDocument!==doc){doc.body.append(panel);doc.head.append(style.cloneNode(true));}};mount();const mountTimer=setInterval(mount,1000);window.addEventListener('pagehide',()=>clearInterval(mountTimer),{once:true});
 window.graphSkin={set,settings:()=>({...state}),report,archive,restore,field:()=>field,uniforms:U,show:()=>panel.querySelector('#graph-open').click()};sync();await rebuild();mat.needsUpdate=true;v.render();window.__GRAPH_SKIN_READY__=true;
}
})();
