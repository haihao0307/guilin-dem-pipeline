const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function replace(source,a,b){assert.equal(source.split(a).length,2,'Pinned source anchor must be unique: '+a.slice(0,100));return source.replace(a,()=>b);}
(async()=>{
 const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..'),read=p=>fs.readFileSync(root+'/'+p,'utf8');
 const baselineApp=read('full/ui/identity-app.generated.mjs'),baselineHTML=read('identity-lab/preview.html');
 assert.equal(hash(baselineApp),'a3351e4b9eefe98628a945c5b1ddb8660b24e7e27eb28b585ba10922a33dfa85');
 assert.equal(hash(baselineHTML),'99942c121ec46428e980568a6b0b82c5872359bf1a7576f600ac5fa1a4a952ad');
 // Generated copies are isolated here. ET13 and the unfinished ET14 sources
 // remain byte-identical, and every integration anchor is asserted.
 let fold=read('skin-cinema-et14/FoldField.mjs');
 fold=replace(fold,"from './Schema.mjs'","from '../skin-cinema-et14/Schema.mjs'");
 fold=replace(fold,'const base=paintTraitMaps(noWrinkles);base.color.dispose();','const base=paintTraitMaps(noWrinkles); // Retain non-wrinkle color: remove old ink as well as grooves.');
 fold=replace(fold,'return {texture,baseHeight:base.height,report:','return {texture,baseHeight:base.height,baseColor:base.color,report:');
 fold=replace(fold,'extraTextureBytes:W*H*4+1024*1280*4','oldWrinkleInkRemoved:true,extraTextureBytes:W*H*4+2*1024*1280*4');
 fold=replace(fold,'texture.dispose();base.height.dispose();','texture.dispose();base.height.dispose();base.color.dispose();');
 fold=fold.replace('Only the old wrinkle HEIGHT channels','Both the old wrinkle color/roughness and HEIGHT channels').replace('seed, and pigment remain native.','seed, and non-wrinkle pigment remain native.');
 fs.writeFileSync(__dirname+'/FoldField.generated.mjs',fold);
 let shader=read('skin-cinema-et14/Shader.mjs');
 shader=replace(shader,'uniform sampler2D uCFolds,uCBaseHeight;','uniform sampler2D uCFolds,uCBaseHeight,uCBaseColor;');
 shader=replace(shader,' return source;',` replace('vec3 iPaint=csPaint*exp','iPigment=mix(iPigment,texture2D(uCBaseColor,clamp(iUV,0.,1.)),uCEnabled);iRelief=mix(iRelief,texture2D(uCBaseHeight,clamp(iUV,0.,1.)),uCEnabled);vec3 iPaint=csPaint*exp');\n return source;`);
 fs.writeFileSync(__dirname+'/CinemaShader.generated.mjs',shader);
 let runtime=read('skin-cinema-et14/Runtime.mjs');
 runtime=replace(runtime,"from './FoldField.mjs'","from './FoldField.generated.mjs'");
 runtime=replace(runtime,"from './Shader.mjs'","from './CinemaShader.generated.mjs'");
 runtime=replace(runtime,"from './Schema.mjs'","from '../skin-cinema-et14/Schema.mjs'");
 runtime=replace(runtime,'uCBaseHeight:{value:api.folds.baseHeight},','uCBaseHeight:{value:api.folds.baseHeight},uCBaseColor:{value:api.folds.baseColor},');
 runtime=replace(runtime,'U.uCBaseHeight.value=api.folds.baseHeight;','U.uCBaseHeight.value=api.folds.baseHeight;U.uCBaseColor.value=api.folds.baseColor;');
 fs.writeFileSync(__dirname+'/CinemaRuntime.generated.mjs',runtime);
 let app="import {installET15,mountET15} from '../../skin-eye-et15/Runtime.mjs';\nimport {installCinema,mountCinema} from '../../skin-eye-et15/CinemaRuntime.generated.mjs';\n"+baselineApp;
 app=replace(app,'installIdentitySkin(model);if(savedArchive)','installIdentitySkin(model);installCinema(model);installET15(model);if(savedArchive)');
 app=replace(app,'mountIdentityUI({model,viewer,controller});wasLoaded=true;','mountIdentityUI({model,viewer,controller});mountCinema({model,viewer,controller});mountET15({model,viewer,controller});wasLoaded=true;');
 app=replace(app,'function release(){','function release(){controller?.model.et15?.disposeUI?.();controller?.model.cinemaSkin?.disposeUI?.();');
 app=replace(app,'panel=null;controller=null;','panel=null;controller?.model.et15?.dispose?.();controller?.model.cinemaSkin?.dispose?.();controller=null;');
 app=replace(app,'faceIdentity:appearance.faceIdentity};','faceIdentity:appearance.faceIdentity,cinemaSkin:appearance.cinemaSkin,et15:appearance.et15};');
 fs.writeFileSync(__dirname+'/entry.generated.mjs','// Build resolveDir: ../full/ui (see build.cjs). Bundled into preview.html.\n'+app);
 const plugin={name:'pinned-native-assets',setup(b){
  b.onResolve({filter:/\.(mjs|js)\?/},a=>({path:path.resolve(a.resolveDir,a.path.split('?')[0])}));
  b.onLoad({filter:/\.(mjs|js)$/},a=>{let text=fs.readFileSync(a.path,'utf8');const rel=path.relative(repo,a.path).split(path.sep).join('/'),ref=rel.includes('/face-transfer/')?'02f596def9d07ebfc187e1eb18ad345a57c8a6b6':'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe';text=text.replaceAll('import.meta.url',JSON.stringify('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+ref+'/'+rel));return{contents:text,loader:'js',resolveDir:path.dirname(a.path)};});
 }};
 const result=await esbuild.build({stdin:{contents:app,resolveDir:root+'/full/ui',sourcefile:'et15-entry.mjs',loader:'js'},bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:root+'/full/source/registration-vendor/three.module.js'},plugins:[plugin]});
 const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
 let html=baselineHTML.replace(/<script>[\s\S]*?<\/script>/,()=>'<script>'+code+'</script>');html=html.replace(/<title>[^<]*<\/title>/,'<title>ET15-R1 · 36人身份 · 眼睛与肤质</title>').replace('ET13 · 五官形态 × 皱纹/雀斑/痘痘/疤痕','ET15-R1 · 36人身份 × 眼睛与肤质');
 assert.equal([...html.matchAll(/<script\b/g)].length,1);fs.writeFileSync(__dirname+'/preview.html',html);
 const manifest={version:'ET15-R1',sourceCommit:process.env.GITHUB_SHA||null,protectedET13:'7ff27f9b5e16f2635b1e665c1321265d5da2b221',protectedET13SHA256:hash(baselineHTML),inheritedCinemaSource:'772908914d9a7ac096c9ea58bc013bbc73d5c6e6',previewSHA256:hash(html),previewBytes:Buffer.byteLength(html),nativeCastProfiles:36,oldFacialControls:89,oldSkinTraits:37,cinemaControls:17,eyeOpticScalars:8,oneRenderer:true,newHumanMesh:false,bodyPreserved:true,oldWrinkleInkRemoved:true,archiveReadback:'two completed presentation frames then exact framebuffer comparison',geometryWrinkleDisplacement:false,ocularRefraction:false,tearMeniscusGeometry:false,stressSolver:false,realDeviceTest:false,mobileTested:false,filmQualityAccepted:false,sources:Object.keys(result.metafile.inputs).filter(p=>p.includes('skin-eye-et15')).map(p=>({path:p,sha256:hash(fs.readFileSync(p))}))};
 fs.writeFileSync(__dirname+'/BUILD.json',JSON.stringify(manifest,null,2));
 console.log('ET15_BUILD',JSON.stringify(manifest));
})().catch(e=>{console.error(e);process.exit(1);});
