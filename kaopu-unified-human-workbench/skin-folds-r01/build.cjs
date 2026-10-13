const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const root=path.resolve(__dirname,'..'),old=root+'/cinematic-r01',frozen=fs.readFileSync(old+'/preview.html');
 assert.equal(hash(frozen),'cdac65a5c84a7a79366cbb67e76cece5c126c255be685488863ef1294d89a667','Wrong user baseline');
 let src=fs.readFileSync(old+'/build.cjs','utf8');const replace=(a,b)=>{assert.equal(src.split(a).length,2,'Frozen build anchor missing: '+a);src=src.replace(a,()=>b);};
 replace('(async()=>{','return (async()=>{');
 replace('app="import {installCineProfile}',"app=\"import {installFoldProfile} from '../../skin-folds-r01/FoldProfile.mjs';\\nimport {mountFoldUI} from '../../skin-folds-r01/FoldUI.mjs';\\nimport {installCineProfile}");
 replace("from'../../cinematic-r01/CinematicViewer.mjs'","from'../../skin-folds-r01/FoldViewer.mjs'");
 replace('installIdleProfile(model);installCineProfile(model);if(savedArchive)','installIdleProfile(model);installCineProfile(model);installFoldProfile(model);if(savedArchive)');
 replace('mountCineUI({model,viewer,controller});wasLoaded=true;','mountCineUI({model,viewer,controller});mountFoldUI({model,viewer,controller});wasLoaded=true;');
 replace('function release(){controller?.model.cineProfile','function release(){controller?.model.foldProfile?.disposeUI?.();controller?.model.cineProfile');
 const transforms=`
 if(rel.endsWith('/identity-lab/TraitMaps.mjs')){const a='function wrinkle(p,width,amount){if(!amount)return;';assert.equal(s.split(a).length,2);s=s.replace(a,'function wrinkle(p,width,amount){return;');}
 if(rel.endsWith('/identity-lab/IdentityUI.mjs')){s=s.replace("['色斑','皱纹','痘痘','疤痕','痣']","['色斑','痘痘','疤痕','痣']").replace('色斑、皱纹、痘痘、疤痕固定附着','色斑、痘印、疤痕固定附着；真实褶皱由上方ET21控制');}
 if(rel.endsWith('/identity-lab/TraitSchema.mjs'))s=s.replace("label:'熟龄纹路'","label:'熟龄色斑'");
 if(rel.endsWith('/idle-r01/IdleSkin.mjs')){const a='uIdleWrinkle*(.16*uIdleBlink*vFA.z+.28*uIdleSmile*vFB.y)';assert.equal(s.split(a).length,2);s=s.replace(a,'0.');}
 `;
 replace("if(s.includes('import.meta.url'))",transforms+"if(s.includes('import.meta.url'))");
 replace("fs.readFileSync(__dirname+'/layout.css','utf8')","fs.readFileSync(root+'/cinematic-r01/layout.css','utf8')+fs.readFileSync(__dirname+'/layout.css','utf8')");
 src=src.replaceAll('et20-cinematic-app.generated','et21-fold-app.generated').replaceAll('ET20-CINE-R01.1','ET21-FOLD-R01').replaceAll("path:'kaopu-unified-human-workbench/cinematic-r01/'","path:'kaopu-unified-human-workbench/skin-folds-r01/'").replaceAll('ET20 · 影视布光 / 双高光皮肤 / 原待机保留','ET21 · 真实几何褶皱 / 冷暖光 / 原待机保留').replaceAll('共同人物 · ET20.1 影视布光与皮肤','共同人物 · ET21 真实褶皱与冷暖光');
 await new Function('require','__dirname','process',src)(require,__dirname,process);
 assert.equal(hash(fs.readFileSync(old+'/preview.html')),hash(frozen));
 const p=__dirname+'/BUILD.json',m=JSON.parse(fs.readFileSync(p));Object.assign(m,{schema:'kaopu/geometric-skin-build@1',version:'ET21-FOLD-R01',userBaseline:'ccf5a1ed9ddde8803e292f1e62d777b141ff52d8',oldCinematicPreviewSHA256:hash(frozen),geometryRoute:'one derived display surface before retained native-derived GPU idle bake',oldWrinkleRasterDisabled:true,defaultLighting:'two warm/cool directional lights, no extra shadow, no multi-pass diffusion',lightingReference:'kaopu-hair-workbench/qa/gnm-study/src/app.js @ ccf5a1ed9ddde8803e292f1e62d777b141ff52d8',cosmetics:'existing identity pigment maps, independently controlled; new makeup finishing',limitations:['Analytic bounded loose-skin rolls with tangential gathering; not a biomechanical FEM or contact solver','Default uses wrapped diffuse approximation, not volume scattering; optional old multi-pass diffusion costs extra','Only facial display geometry; eyelid aperture, lips, eye components, canonical rig/body buffers protected','Geometry edits rebuild retained idle cache after release; playback and camera orbit do not recompute folds','Close-up fidelity is limited by inherited parametric anatomy and local display tessellation','Screen-space/per-pixel and shader tests do not certify consumer GPU FPS or physical phone compatibility','Original pinned model/skin assets still load from public GitHub URLs; this is not an offline bundle']});fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');
 console.log('ET21 frozen baseline preserved; new build',m.previewSHA256,m.previewBytes);
})().catch(e=>{console.error(e);process.exit(1);});
