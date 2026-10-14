/* KAOPU SSG-01 / Skin Surface Lab R01. Original procedural fields, no reference texture pixels.
   Integrates the pinned own character without changing vertices, joints or specialist materials.
   Lengths below are bounded artistic engineering values, NOT measurements from the source JPEGs. */
(() => {
'use strict';
const VERSION='SKIN-SURFACE-LAB-R01';
const root=document.createElement('div');root.id='ssg-app';
const presetData=[
 {id:'satin',name:'细腻缎面',tag:'SATIN',note:'细孔 · 柔和微纹 · 局部轻油光',color:'#bd927c',p:{melanin:.18,blood:.22,oil:.25,hydration:.62,variation:.45},q:{pore:.60,width:.83,micro:.45,grain:.36},seed:41731},
 {id:'porcelain',name:'浅色微红',tag:'FAIR',note:'浅色基底 · 颊部红润 · 细软表面',color:'#dfb7a4',p:{melanin:.045,blood:.27,oil:.19,hydration:.61,variation:.68},q:{pore:.45,width:.73,micro:.38,grain:.28},seed:86219},
 {id:'warm',name:'暖色细纹',tag:'WARM',note:'暖棕基底 · 更清楚的微观组织',color:'#ad7960',p:{melanin:.35,blood:.18,oil:.32,hydration:.52,variation:.58},q:{pore:.80,width:1.12,micro:.80,grain:.45},seed:27943},
 {id:'deep',name:'深色柔光',tag:'DEEP',note:'深色素 · 独立反光 · 不压黑细节',color:'#654437',p:{melanin:.72,blood:.18,oil:.38,hydration:.60,variation:.48},q:{pore:.73,width:1.05,micro:.58,grain:.42},seed:66107},
 {id:'dry',name:'干爽微纹',tag:'MATTE',note:'弱油膜 · 稍明显微纹 · 不雕老化沟槽',color:'#bb907a',p:{melanin:.20,blood:.20,oil:.08,hydration:.25,variation:.46},q:{pore:.78,width:1.01,micro:1.10,grain:.55},seed:19463},
 {id:'mixed',name:'润泽混合',tag:'DEWY',note:'T 区更润 · 面颊较柔 · 孔口更清楚',color:'#b58770',p:{melanin:.25,blood:.23,oil:.72,hydration:.83,variation:.55},q:{pore:.87,width:1.12,micro:.52,grain:.36},seed:93113}
];
const sliders=[['melanin','基底色素',0,1,'p'],['blood','血色表现',0,1,'p'],['variation','部位色差',0,1,'p'],['pore','孔口深浅',0,1.5,'q'],['width','孔口宽度',.65,1.5,'q'],['micro','微纹强度',0,1.5,'q'],['grain','微表面起伏',0,1,'q'],['oil','局部油膜',0,1,'p'],['hydration','干润状态',0,1,'p']];
root.innerHTML=`<div class="ssg-top"><div><span class="ssg-brand">KAOPU / MATERIAL STUDIES</span><b>皮肤表面实验室</b></div><div class="ssg-top-right"><span class="ssg-pill">SSG–01 · R01</span><span>自有人物 / 独立候选</span></div></div><div id="ssg-caption"><span class="ssg-eyebrow">PROCEDURAL SKIN / LOOK DEVELOPMENT</span><h1 id="ssg-name">细腻缎面</h1><p id="ssg-description">同一张脸，观察不同皮肤的细节。</p></div><div id="ssg-camera"><button data-ssg-view="face" class="selected">正面</button><button data-ssg-view="three">斜侧</button><button data-ssg-view="side">侧面</button><button data-ssg-view="macro">肌理近看</button><button data-ssg-view="body">全身</button><button id="ssg-reset-view" title="恢复默认取景">复位</button></div><aside id="ssg-panel"><div class="ssg-section-title"><span>01 / 肤质配方</span><small>切换不改变人物形状</small></div><div class="ssg-presets">${presetData.map(x=>`<button data-ssg-preset="${x.id}" aria-pressed="${x.id==='satin'}"><i style="--chip:${x.color}"></i><span><b>${x.name}</b><small>${x.tag}</small></span></button>`).join('')}</div><div id="ssg-preset-note">${presetData[0].note}</div><div class="ssg-section-title"><span>02 / 表面参数</span><button id="ssg-reset">恢复配方</button></div><div class="ssg-sliders">${sliders.map(([key,label,min,max,group])=>`<label><span>${label}</span><output id="ssg-value-${key}"></output><input aria-label="${label}" data-ssg-param="${key}" data-group="${group}" type="range" min="${min}" max="${max}" step=".01"></label>`).join('')}</div><div class="ssg-section-title"><span>03 / 光照与检查</span><small>沿用 EB1</small></div><div class="ssg-light-row"><button data-ssg-light="neutral" class="selected">中性白光</button><button data-ssg-light="reference">暖轮廓光</button><button data-ssg-light="rake">掠射检查</button></div><div class="ssg-checks"><select aria-label="表面检查通道" id="ssg-channel"><option value="0">自然材质</option><option value="1">底色 / 不含光照</option><option value="2">粗糙度</option><option value="3">法线与微结构</option></select><button id="ssg-ab" aria-pressed="false">对照：SSG 肌理</button></div><details class="ssg-more"><summary>个体、存档与验证范围</summary><div class="ssg-seed"><label>固定种子<input aria-label="皮肤个体种子" id="ssg-seed" type="number" min="1" max="16777215" step="1"></label><button id="ssg-new-seed">换一个个体</button></div><div class="ssg-actions"><button id="ssg-save">保存当前配方</button><button id="ssg-load">导入配方</button><input id="ssg-file" type="file" accept="application/json,.json" hidden></div><p>表面由自有规则生成；不使用参考网站的皮肤贴图。毫米量级为工程设定，并非扫描标定。保留原眼、唇、耳和完整人物；本轮不声称完整生理散射或动态组织皱纹。</p><button id="ssg-legacy">展开原人物参数</button><button id="ssg-diagnostics">复制本页诊断</button><output id="ssg-diagnostic-output"></output></details><div id="ssg-status" role="status">正在载入完整人物…</div></aside><div id="ssg-bottom"><span id="ssg-geometry">完整自有人物 · 顶点与骨架保留</span><span>拖动旋转 · 滚轮缩放</span></div><div id="ssg-veil"><span class="ssg-brand">KAOPU / SKIN SURFACE LAB</span><div class="ssg-spinner"></div><b id="ssg-phase">载入完整人物与已验证资源</b><p id="ssg-load-note">首次打开需要读取人物资源；切换肤质不重新下载人物。</p><button id="ssg-retry" hidden>重新载入</button></div>`;
document.body.appendChild(root);document.body.classList.add('ssg-layout');
const $=id=>document.getElementById(id);
let viewer,model,THREE,originalAPI,U,tex,fieldReport,frameQueued=false,ready=false,disposed=false,current=presetData[0],settings={p:{...current.p},q:{...current.q},seed:current.seed},comparison=false,channel=0,lighting='neutral',viewName='face',readyAt=0,compiles=0,lastShader=null;
const errors=[],timings=[],started=performance.now();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fail=e=>{const text=String(e?.message||e);errors.push(text);$('ssg-phase').textContent='显示未完成：'+text;$('ssg-retry').hidden=false;$('ssg-veil').hidden=false;$('ssg-status').textContent=text;};
$('ssg-retry').onclick=()=>location.reload();
function random(seed){let n=seed>>>0;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
// Periodic, jittered pore-node field with bounded local connective micro-lines.
// Independent implementation inspired by graph organization, NOT a reproduction
// of Disney's optimization. R=pore trough, G=curved micro-line trough,
// B=small smooth epidermal relief, A=1. Normals derive from the same heights.
function generateField(seed,N=1024){
 const t=performance.now(),r=random(seed),cells=25,span=16,scale=N/span,step=span/cells,pts=[];
 const pore=new Float32Array(N*N),line=new Float32Array(N*N),grain=new Float32Array(N*N);
 for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)pts.push({x:(x+.18+r()*.64)*step,y:(y+.18+r()*.64)*step,r:.047+r()*.035,depth:.62+r()*.38,k:r()});
 const at=(x,y)=>((y%N+N)%N)*N+(x%N+N)%N;
 function disk(p){const cx=p.x*scale,cy=p.y*scale,rx=p.r*scale,ry=rx*(.78+p.k*.5),R=Math.ceil(Math.max(rx,ry)*2.5);for(let y=Math.floor(cy)-R;y<=cy+R;y++)for(let x=Math.floor(cx)-R;x<=cx+R;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d>6.25)continue;const k=at(x,y);pore[k]=Math.max(pore[k],Math.exp(-d)*p.depth);}}
 pts.forEach(disk);let edges=0;const unique=new Set();
 function segment(a,b,depth,width,bend){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),samples=Math.ceil(len*scale/1.5),R=Math.ceil(width*scale*2.5),wr=width*scale;
  for(let i=0;i<=samples;i++){const u=i/samples,s=Math.sin(u*Math.PI),cx=(a.x+dx*u-dy/len*bend*s)*scale,cy=(a.y+dy*u+dx/len*bend*s)*scale,taper=Math.pow(Math.sin(Math.PI*u),.55);for(let yy=Math.floor(cy)-R;yy<=cy+R;yy++)for(let xx=Math.floor(cx)-R;xx<=cx+R;xx++){const dd=((xx-cx)**2+(yy-cy)**2)/(wr*wr);if(dd>6.25)continue;const k=at(xx,yy);line[k]=Math.max(line[k],Math.exp(-dd)*depth*taper);}}
 }
 for(let j=0;j<pts.length;j++){const a=pts[j],x=j%cells,y=Math.floor(j/cells),candidates=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=(x+dx+cells)%cells,yy=(y+dy+cells)%cells,k=yy*cells+xx,b=pts[k];let bx=b.x,by=b.y;if(bx-a.x>span/2)bx-=span;if(bx-a.x<-span/2)bx+=span;if(by-a.y>span/2)by-=span;if(by-a.y<-span/2)by+=span;candidates.push({k,x:bx,y:by,d:Math.hypot(bx-a.x,by-a.y)});}candidates.sort((a,b)=>a.d-b.d);for(const b of candidates.slice(0,3)){const key=[j,b.k].sort((a,b)=>a-b).join('/');if(unique.has(key)||b.d>1.05)continue;unique.add(key);if(r()>.82)continue;segment(a,b,.33+r()*.52,.014+r()*.014,(r()-.5)*.10);edges++;}}
 const grid=32,noise=Float32Array.from({length:grid*grid},()=>r());
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const gx=x/N*grid,gy=y/N*grid,ix=Math.floor(gx),iy=Math.floor(gy);let fx=gx-ix,fy=gy-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const get=(i,j)=>noise[((j+grid)%grid)*grid+(i+grid)%grid];grain[y*N+x]=(get(ix,iy)*(1-fx)+get(ix+1,iy)*fx)*(1-fy)+(get(ix,iy+1)*(1-fx)+get(ix+1,iy+1)*fx)*fy;}
 const data=new Uint8Array(N*N*4);let sumR=0,sumG=0;for(let i=0;i<N*N;i++){data[i*4]=Math.round(pore[i]*255);data[i*4+1]=Math.round(line[i]*255);data[i*4+2]=Math.round(grain[i]*255);data[i*4+3]=255;sumR+=pore[i];sumG+=line[i];}
 let digest=2166136261;for(const n of data)digest=Math.imul(digest^n,16777619);
 return{data,width:N,height:N,report:{algorithm:'SSG bounded periodic pore-node micro-line field v1',seed,nodes:pts.length,edges,spanMM:span,textureBytes:data.byteLength,mipBytesEstimate:data.byteLength*4/3,meanPore:sumR/(N*N),meanLine:sumG/(N*N),fingerprint:(digest>>>0).toString(16).padStart(8,'0'),generationMS:performance.now()-t,measuredTissue:false,sourcePixelsCopied:false,fullDisneySolver:false}};
}
window.__SSG_GENERATE_FIELD__=generateField;
const GLSL=`
uniform sampler2D uSSGField;
uniform float uSSGOn,uSSGPore,uSSGWidth,uSSGMicro,uSSGGrain;
float ssgMask=0.,ssgHeight=0.,ssgFootprint=0.;
vec3 ssgTri(vec3 p,vec3 w){
 vec3 x=texture2D(uSSGField,p.yz/16.+vec2(.173,.419)).rgb;
 vec3 y=texture2D(uSSGField,p.zx/16.+vec2(.531,.127)).rgb;
 vec3 z=texture2D(uSSGField,p.xy/16.+vec2(.283,.617)).rgb;
 return x*w.x+y*w.y+z*w.z;
}
`;
function patchOnce(s,a,b){const pieces=s.split(a);if(pieces.length!==2)throw Error('SSG shader anchor changed: '+a.slice(0,70));return pieces[0]+b+pieces[1];}
function installSurface(){
 const material=viewer.skin.material,prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 U={uSSGField:{value:null},uSSGOn:{value:1},uSSGPore:{value:settings.q.pore},uSSGWidth:{value:settings.q.width},uSSGMicro:{value:settings.q.micro},uSSGGrain:{value:settings.q.grain}};
 material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f=GLSL+s.fragmentShader;
 const walk='if(rfArea>.001&&rfVisibility>.001&&uRFGain>.001)';
 f=patchOnce(f,walk,'if(rfArea>.001&&rfVisibility>.001&&uRFGain>.001&&uSSGOn<.5)');
 const anchor='// No synthesized noise heights or age-shaped channels in R02.';
 f=patchOnce(f,anchor,`
 ssgMask=sdSkin*uSSGOn;
 vec3 ssgP=vCSRest*1000.;
 vec3 ssgRestN=cross(dFdx(vCSRest),dFdy(vCSRest));
 ssgRestN=normalize(ssgRestN+vec3(1e-15));
 vec3 ssgW=pow(abs(ssgRestN),vec3(6.));ssgW/=max(dot(ssgW,vec3(1.)),1e-8);
 ssgFootprint=max(length(dFdx(ssgP)),length(dFdy(ssgP)));
 vec3 ssgF=ssgTri(ssgP,ssgW);
 float ssgPore=pow(max(ssgF.r,.00001),1./max(uSSGWidth*uSSGWidth,.25));
 float ssgThin=clamp(rfThin,0.,1.);
 float ssgRegion=mix(.52,1.,clamp(vFA.x,0.,1.));
 ssgRegion*=mix(1.,.22,clamp(csPalm,0.,1.));
 ssgRegion*=mix(1.,.34,ssgThin);
 float ssgPDepth=(.75+.55*rfNose+.15*rfCheek)*uSSGPore;
 float ssgLineStrength=uSSGMicro*(1.-.36*rfNose);
 // Micrometre-scale ARTISTIC relief; fixed topology, not displacement geometry.
 ssgHeight=(-ssgPore*ssgPDepth*.000010-ssgF.g*ssgLineStrength*.0000035+(ssgF.b-.5)*uSSGGrain*.000002)*ssgRegion;
 normal=normalize(mix(normal,nonPerturbedNormal,ssgMask));
 vec3 ssgDX=dFdx(-vViewPosition),ssgDY=dFdy(-vViewPosition);
 vec3 ssgR1=cross(ssgDY,normal),ssgR2=cross(normal,ssgDX);float ssgDet=dot(ssgDX,ssgR1);
 vec3 ssgSlope=sign(ssgDet)*(dFdx(ssgHeight)*ssgR1+dFdy(ssgHeight)*ssgR2)/max(abs(ssgDet),1e-14);
 ssgSlope*=min(1.,.27/max(length(ssgSlope),.0001));
 normal=normalize(normal-ssgSlope*ssgMask);
 float ssgUnresolved=1.-exp(-ssgFootprint*ssgFootprint/.012);
 float ssgOil=clamp(uSDOil*(.25+.75*csT),0.,1.);
 float ssgRough=clamp(.57+(1.-uSDHydration)*.09-ssgOil*.22+.025*rfCheek+.018*ssgThin+ssgF.g*.025+ssgUnresolved*(.011*uSSGPore+.012*uSSGMicro),.34,.79);
 roughnessFactor=mix(roughnessFactor,ssgRough,ssgMask);
 cLobeWeight=mix(cLobeWeight,.04+.08*ssgOil,ssgMask);
 // No added pigment speckles or large geometry creases.
 `+anchor);
 const spec='material.specularColor=mix(material.specularColor,vec3(.028),sdSkin);';
 f=patchOnce(f,spec,spec+'material.specularColor=mix(material.specularColor,vec3(.0295),ssgMask);');
 const coat='material.clearcoatRoughness=mix(material.clearcoatRoughness,.32,sdSkin);';
 f=patchOnce(f,coat,coat+'material.clearcoat=mix(material.clearcoat,.015*uSDOil*csT,ssgMask);material.clearcoatRoughness=mix(material.clearcoatRoughness,.38,ssgMask);');
 s.fragmentShader=f;lastShader=s;compiles++;
 };
 material.customProgramCacheKey=()=>key()+'/ssg-surface-lab-r01-v1';material.needsUpdate=true;
}
function rebuildField(seed){const result=generateField(seed);const next=new THREE.DataTexture(result.data,result.width,result.height,THREE.RGBAFormat,THREE.UnsignedByteType);next.wrapS=next.wrapT=THREE.RepeatWrapping;next.minFilter=THREE.LinearMipmapLinearFilter;next.magFilter=THREE.LinearFilter;next.generateMipmaps=true;next.colorSpace=THREE.NoColorSpace;next.anisotropy=Math.min(8,viewer.renderer.capabilities.getMaxAnisotropy());next.needsUpdate=true;const old=tex;tex=next;U.uSSGField.value=tex;fieldReport=result.report;old?.dispose();}
function draw(){if(!viewer||disposed)return;const idle=window.lifelikeIdle?.runtime?.();if(idle?.originalRender)idle.originalRender();else viewer.render();}
function requestDraw(){if(frameQueued)return;frameQueued=true;requestAnimationFrame(()=>{frameQueued=false;try{apply()}catch(e){fail(e)}});}
function sync(){for(const[k]of sliders){const v=Object.hasOwn(settings.p,k)?settings.p[k]:settings.q[k];const el=root.querySelector(`[data-ssg-param="${k}"]`);if(document.activeElement!==el)el.value=v;$('ssg-value-'+k).textContent=v.toFixed(2);}root.querySelectorAll('[data-ssg-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ssgPreset===current?.id)));$('ssg-name').textContent=comparison?'原版表面对照':current?.name||'自定义肤质';$('ssg-description').textContent=comparison?'相同人物、相同配方、相同 EB1；暂时停用新增肌理。':current?.note||'连续调整表面配方，人物形状保持不变。';$('ssg-preset-note').textContent=current?.note||'自定义表面参数';$('ssg-seed').value=settings.seed;$('ssg-ab').textContent=comparison?'对照：原版表面':'对照：SSG 肌理';$('ssg-ab').setAttribute('aria-pressed',String(comparison));$('ssg-channel').value=channel;$('ssg-status').textContent=ready?`表面已就绪 · 种子 ${settings.seed} · ${fieldReport.fingerprint}`:'正在编译新表面…';}
function apply(){if(!U)return;for(const[k,u]of [['pore','uSSGPore'],['width','uSSGWidth'],['micro','uSSGMicro'],['grain','uSSGGrain']])U[u].value=settings.q[k];U.uSSGOn.value=comparison?0:1;originalAPI.set({...settings.p,seed:settings.seed,pores:.75,poreScale:1,detail:.55,sun:0});sync();}
function camera(kind){if(!viewer)return;viewName=kind;originalAPI.view(kind==='body'?'body':'face');if(kind==='three'||kind==='side'){const d=viewer.camera.position.clone().sub(viewer.orbit.target),a=kind==='side'?Math.PI*.47:Math.PI*.19;d.applyAxisAngle(new THREE.Vector3(0,1,0),a);viewer.camera.position.copy(viewer.orbit.target).add(d);}if(kind==='macro'){viewer.camera.zoom=2.35;viewer.camera.position.x+=.025;viewer.orbit.target.x+=.025;viewer.camera.position.y-=.014;viewer.orbit.target.y-=.014;}viewer.camera.updateProjectionMatrix();viewer.orbit.update();viewer.resize();draw();root.querySelectorAll('[data-ssg-view]').forEach(b=>b.classList.toggle('selected',b.dataset.ssgView===kind));}
function select(id){const p=presetData.find(p=>p.id===id);if(!p)throw Error('未知肤质');const t=performance.now();current=p;settings={p:{...p.p},q:{...p.q},seed:p.seed};comparison=false;channel=0;originalAPI.channel(0);if(fieldReport?.seed!==settings.seed)rebuildField(settings.seed);apply();timings.push({id,applyMS:performance.now()-t});return archive();}
function archive(){return{schema:'kaopu.skin-surface-lab/1',algorithm:'ssg-field-v1',preset:current?.id||'custom',settings:structuredClone(settings)};}
function validate(o){if(!o||o.schema!=='kaopu.skin-surface-lab/1'||o.algorithm!=='ssg-field-v1')throw Error('需要本版 SSG-01 皮肤配方');const s=o.settings;if(!s||!Number.isInteger(s.seed)||s.seed<1||s.seed>16777215)throw Error('种子无效');for(const[k,group]of Object.entries({p:'p',q:'q'})){if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))throw Error('配方结构无效');for(const key of Object.keys(s[k]))if(!sliders.some(x=>x[0]===key&&x[4]===group))throw Error('未知参数 '+key);}for(const[k,,a,b,g]of sliders)if(!Number.isFinite(s[g][k])||s[g][k]<a||s[g][k]>b)throw Error('参数越界 '+k);return structuredClone(s);}
function restore(o){const s=validate(o);current=presetData.find(x=>x.id===o.preset)||null;settings=s;if(fieldReport?.seed!==s.seed)rebuildField(s.seed);apply();}
const api={version:VERSION,presets:presetData.map(({id,name,note})=>({id,name,note})),select,archive,restore,view:camera,compare(){comparison=!comparison;apply();},set(group,key,value){const def=sliders.find(x=>x[0]===key&&x[4]===group);if(!def||!Number.isFinite(value)||value<def[2]||value>def[3])throw Error('参数越界');settings[group][key]=value;current=null;apply();},setSeed(seed){if(!Number.isInteger(seed)||seed<1||seed>16777215)throw Error('种子无效');settings.seed=seed;rebuildField(seed);apply();},channel(n){if(!Number.isInteger(n)||n<0||n>3)throw Error('检查通道无效');channel=n;originalAPI.channel(n);sync();},light(name){if(!['neutral','reference','rake'].includes(name))throw Error('未知 EB1 配方');originalAPI.setLighting(name);lighting=name;root.querySelectorAll('[data-ssg-light]').forEach(b=>b.classList.toggle('selected',b.dataset.ssgLight===name));},report(){return{version:VERSION,ready,readyMS:readyAt,recipe:archive(),comparison,channel,lighting,view:viewName,field:fieldReport,shader:{compiles,bytes:lastShader?.fragmentShader?.length,extraFragmentSamplers:1,baseline15SamplerBudget:true},geometry:viewer?{vertices:viewer.geometry.attributes.position.count,triangles:viewer.geometry.index.count/3,uuid:viewer.geometry.uuid,changedBySSG:false}:null,graphics:viewer?.skinRenderHealth?.inspect?.(),baseline:originalAPI?.report?.(),timings:[...timings],errors:[...errors],fullDisneySolver:false,volumeScattering:false,dynamicTissueWrinkles:false,userVisualAccepted:false};}};
window.skinSurfaceLab=api;
root.addEventListener('click',e=>{if(!ready)return;try{const preset=e.target.closest('[data-ssg-preset]')?.dataset.ssgPreset,view=e.target.closest('[data-ssg-view]')?.dataset.ssgView,light=e.target.closest('[data-ssg-light]')?.dataset.ssgLight;if(preset)select(preset);else if(view)camera(view);else if(light)api.light(light);else if(e.target.id==='ssg-reset-view')camera('face');else if(e.target.id==='ssg-reset')select(current?.id||'satin');else if(e.target.id==='ssg-ab')api.compare();else if(e.target.id==='ssg-new-seed')api.setSeed(((settings.seed*1664525+1013904223)>>>0)%16777215+1);else if(e.target.id==='ssg-legacy'){document.body.classList.toggle('ssg-show-legacy');viewer.resize();draw();}else if(e.target.id==='ssg-save'){const blob=new Blob([JSON.stringify(archive(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kaopu-ssg01-'+settings.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else if(e.target.id==='ssg-load')$('ssg-file').click();else if(e.target.id==='ssg-diagnostics'){const s=JSON.stringify(api.report(),null,2);navigator.clipboard?.writeText(s).then(()=>$('ssg-diagnostic-output').textContent='已复制诊断',()=>$('ssg-diagnostic-output').textContent=s);}}catch(err){$('ssg-status').textContent='未应用：'+err.message;}});
root.addEventListener('input',e=>{const k=e.target.dataset.ssgParam,g=e.target.dataset.group;if(!k||!ready)return;settings[g][k]=Number(e.target.value);current=null;$('ssg-value-'+k).textContent=settings[g][k].toFixed(2);requestDraw();});
$('ssg-seed').onchange=e=>{try{api.setSeed(Number(e.target.value))}catch(err){$('ssg-status').textContent=err.message}};
$('ssg-channel').onchange=e=>{try{api.channel(Number(e.target.value))}catch(err){$('ssg-status').textContent=err.message}};
$('ssg-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>20000)throw Error('文件过大');restore(JSON.parse(await f.text()));}catch(err){$('ssg-status').textContent='未导入：'+err.message;}finally{e.target.value='';}};
const timer=setInterval(()=>{try{const r=window.__SKIN_REVIEW__;if(r?.errors?.length){clearInterval(timer);return fail(r.errors.join('; '))}if(performance.now()-started>240000){clearInterval(timer);return fail('人物载入超时；请重试，已校验资源可复用。')}const progress=window.__LIP_P3__?.progress;if(progress?.stage)$('ssg-phase').textContent=progress.stage;if(!r?.ready)return;clearInterval(timer);viewer=window.__IDENTITY_QA__.viewer();model=window.__IDENTITY_QA__.model();THREE=window.__SSG_THREE__;if(!THREE?.DataTexture)throw Error('渲染接口未连接');originalAPI=window.skinDNA;installSurface();$('ssg-phase').textContent='生成多通道微结构并验证着色器';rebuildField(settings.seed);apply();camera('face');const health=viewer.skinRenderHealth.inspect();if(!health.valid)throw Error('着色器链接或设备资源预算未通过');const gl=viewer.renderer.getContext();if(gl.getError()!==gl.NO_ERROR)throw Error('新皮肤出现图形错误');ready=true;readyAt=performance.now()-started;sync();$('ssg-geometry').textContent=`原人物 ${viewer.geometry.attributes.position.count.toLocaleString()} 顶点 / ${(viewer.geometry.index.count/3).toLocaleString()} 面 · 形体未改`;$('ssg-veil').hidden=true;document.title='KAOPU · 皮肤表面实验室 R01';window.dispatchEvent(new Event('ssg-ready'));}catch(e){clearInterval(timer);fail(e)}},160);
window.addEventListener('resize',()=>{if(ready){viewer.resize();draw();}});
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);tex?.dispose();},{once:true});
})();
