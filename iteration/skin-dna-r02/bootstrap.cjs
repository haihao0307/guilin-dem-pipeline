const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const dir=__dirname,root=path.resolve(dir,'../..'),old=root+'/kaopu-unified-human-workbench/skin-dna-r01',out=root+'/kaopu-unified-human-workbench/skin-dna-r02';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'R02 source drift: '+a.slice(0,100));return s.replace(a,()=>b);};
assert(!fs.existsSync(out),'Refusing to overwrite existing R02; use a clean checkout of the source commit.');
fs.cpSync(old,out,{recursive:true});
for(const name of ['DELIVERY.json','PUBLIC_QA.json','BUILD.json','README.md','preview.html','baseline-r04.html'])fs.rmSync(out+'/'+name,{force:true});
for(const name of fs.readdirSync(out)){const p=out+'/'+name;if(fs.statSync(p).isFile()&&/\.(mjs|cjs|css)$/.test(name))write(p,read(p).replaceAll('skin-dna-r01','skin-dna-r02').replaceAll('SKIN-DNA-R01','SKIN-DNA-R02'));}
for(const name of ['EntryMode.mjs','EntryView.mjs','R02Adapters.cjs','review.css','verify.cjs','unit.cjs','NATURAL_SKIN_RULES.md'])fs.copyFileSync(dir+'/'+name,out+'/'+name);
let b=read(out+'/build.cjs');
b=once(b,"app=`import '../../skin-dna-r02/Startup.mjs';", "app=`import '../../skin-dna-r02/EntryMode.mjs';\\nimport '../../skin-dna-r02/Startup.mjs';");
b=once(b,"s=require(__dirname+'/compatibility.cjs').adapt(s,rel,adapters);","s=require(__dirname+'/R02Adapters.cjs').adapt(s,rel,adapters);s=require(__dirname+'/compatibility.cjs').adapt(s,rel,adapters);");
b=once(b,"__dirname+'/skin-dna.css'];", "__dirname+'/skin-dna.css',__dirname+'/review.css'];");
b=b.replaceAll('SKIN DNA R01','SKIN / NATURE R02').replaceAll('RGB absorption is an artistic physiological surrogate, not spectral tissue transport','Official BioSkin spectral network evaluated offline, fixed 2D LUT slice; RGB runtime, not spectral volume transport');
b=once(b,"b.reviewRefinement='V2: weaker macro pigment, irregular soft freckles, bounded inherited normal, optical roughness calibration';", "b.reviewRefinement='R02: unassisted first-frame entry; deferred idle; official BioSkin LUT; no added noise wrinkles/freckles/cloud pigment';b.bioSkin=JSON.parse(read(__dirname+'/BIOSKIN_PROOF.json'));b.rules='NATURAL_SKIN_RULES.md';");
b=once(b,"const entry=","core=once(core,'{strength:.35,slack:.4,forehead:.25,eyes:.3}','{strength:0,slack:.4,forehead:.25,eyes:.3}');\n const entry=");
write(out+'/build.cjs',b);
let ui=read(out+'/SkinDNA.mjs');
ui="import {mountReviewEntry} from './EntryView.mjs';\n"+ui;
ui=once(ui,"['variation','自然不均匀',0,1],['freckles','雀斑分布',0,1]","['variation','分区色差',0,1]");
ui=ui.replaceAll('表层细纹','原有微表面').replaceAll('SKIN DNA / R01','SKIN / NATURE R02').replaceAll('同一个人，六种肤质','参考规则下的六种肤质');
ui=once(ui,'const r=state.record;for(const el','const r=state.record;globalThis.__SKIN_REVIEW__?.updateLabel?.(r);for(const el');
ui=once(ui,'state.record.quality=old.quality;apply();',"state.record.quality=old.quality;view=0;$('sd-channel').value='0';apply();");
ui=once(ui,"window.lifelikeIdle?.pause(true);apply();return api;","window.lifelikeIdle?.pause(true);apply();mountReviewEntry({api,viewer,model,host,apply});return api;");
write(out+'/SkinDNA.mjs',ui);
let p=read(out+'/SkinProfile.mjs');
p=once(p,"export const SCHEMA='kaopu.skin-dna/1';","export const SCHEMA='kaopu.skin-dna/2';");
p=p.replace('02 · 浅色雀斑','02 · 浅色微红').replace('05 · 成熟偏干','05 · 干燥柔光');
p=p.replace('稀疏毛孔 · 细腻表面 · 低油脂','低色素基底 · 低油脂 · 细腻反光').replace('浅色基底 · 成簇雀斑 · 自然泛红','浅色基底 · 颊部微红 · 不制造雀斑').replace('暴露区色素 · 较明显毛孔 · 干润不均','较深色素 · 暴露区差异 · 局部干润').replace('浅细纹 · 斑驳色素 · 较宽柔光泽','较干表面 · 较宽柔光 · 不伪造衰老');
p=once(p,"if(!o||o.schema!==SCHEMA)throw Error('皮肤配方版本不匹配');","if(!o||o.schema!==SCHEMA)throw Error('需要 R02 皮肤配方；R01 配方请在保留的旧网页打开，不能静默套用新光学规则');");
p=p.replace(/export function opticalBase\(melanin,blood\)\{[^\n]+\}\n/,'');
write(out+'/SkinProfile.mjs',p);
let m=read(out+'/SkinMaterial.mjs');
m="import * as THREE from '../full/source/registration-vendor/three.module.js';\nimport LUT from './BioSkinLUT.json';\n"+m;
const start=m.indexOf('// Smooth, sparse pigment islands.'),end=m.indexOf('\n`;',start);assert(start>0&&end>start);
m=m.slice(0,start)+`// Official BioSkin fixed-property slice, sampled in LINEAR RGB.
uniform sampler2D uSDBioLUT;
vec3 sdBio(vec2 uv){vec2 p=clamp(uv,0.,1.)*vec2(32.,16.);ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(32,16));vec2 f=fract(p);return mix(mix(texelFetch(uSDBioLUT,a,0).rgb,texelFetch(uSDBioLUT,ivec2(b.x,a.y),0).rgb,f.x),mix(texelFetch(uSDBioLUT,ivec2(a.x,b.y),0).rgb,texelFetch(uSDBioLUT,b,0).rgb,f.x),f.y);}`+m.slice(end);
m=once(m,"const report={version:'SKIN-DNA-MATERIAL-R01'", "if(LUT.width!==33||LUT.height!==17||LUT.colorSpace!=='linear-sRGB')throw Error('BioSkin LUT contract changed');const pixels=new Float32Array(33*17*4);for(let i=0;i<33*17;i++){pixels.set(LUT.data.slice(i*3,i*3+3),i*4);pixels[i*4+3]=1;}const tex=new THREE.DataTexture(pixels,33,17,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=THREE.NearestFilter;tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;U.uSDBioLUT={value:tex};\n const report={version:'SKIN-DNA-MATERIAL-R02'");
m=m.replace("chromophores:'RGB absorption surrogate, not spectral concentrations'","chromophores:'Official BioSkin spectral decoder offline LUT; fixed 2D slice, not medical concentrations',bioSkinSource:LUT.sourceCommit,lutBytes:pixels.byteLength,addedWrinkleGeometry:false,noiseCreaseLayer:false,randomPigmentIslands:false");
const a=m.indexOf(' vec3 sdP=vCSRest'),z=m.indexOf(' // Preserve the specialist ear',a);assert(a>0&&z>a);
m=m.slice(0,a)+` // Anatomical envelopes are retained authored masks, not measured biomaps.
 vec3 sdP=vCSRest;
 float sdExposure=clamp(.26+.49*csT+.29*rfCheek+.13*rfForehead-.35*csPalm,0.,1.);
 sdPigment=clamp(uSDMel+uSDSun*sdExposure*.04,0.,1.)*(1.-csPalm*.18);
 float sdVascular=clamp(uSDBlood+uSDVariation*(.04*rfCheek+.02*rfNose-.012*csPalm)+uSDFlush*(.05+.18*rfCheek+.06*rfNose),0.,1.);
 vec3 sdAlbedo=sdBio(vec2(sdPigment,sdVascular));
`+m.slice(z);
m=once(m,'rfArea*(1.-uSDOn*.06)','rfArea*(1.-uSDOn*(.025+clamp(uSDDetail,0.,1.5)*.03))');
m=once(m,'+uSDAge*.025-sdOil*.19+(sdMedium-.5)*.068*uSDVariation','-sdOil*.19');
const na=m.indexOf(' vec3 sdMicro='),nz=m.indexOf('\n `);',na);assert(na>0&&nz>na);m=m.slice(0,na)+` // No synthesized noise heights or age-shaped channels in R02.
 // Preserved native microdetail is bounded above, not replaced by invented marks.
`+m.slice(nz);
m=once(m,'dispose(){m.onBeforeCompile=prior;','dispose(){tex.dispose();m.onBeforeCompile=prior;');
m=m.replace('/skin-dna-r02-v2','/skin-dna-r02-bioskin-v1');
write(out+'/SkinMaterial.mjs',m);
console.log('R02 source installed in independent directory');
