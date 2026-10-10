const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(){
 const root=path.resolve(__dirname,'..'),sourceFile=root+'/full/ui/eye-transfer-app.generated.mjs',original=fs.readFileSync(sourceFile,'utf8'),previous=JSON.parse(fs.readFileSync(root+'/eye-transfer/BUILD.json'));
 assert.equal(hash(original),previous.generatedAppSHA256,'ET11 base entry changed');
 cp.execFileSync('python3',[__dirname+'/bake-donor.py'],{stdio:'inherit'});
 // Correct declaration-order dependency in the new shader source before baking.
 const materialFile=__dirname+'/FaceMaterial.mjs';let shader=fs.readFileSync(materialFile,'utf8');
 shader=shader.replace('vec4 ftBands(vec2 uv){\n float lip=clamp(vCSRegion.y,0.,1.);','vec4 ftBands(vec2 uv,float lip){\n lip=clamp(lip,0.,1.);').replace('vec4 ftData=ftBands(ftUV);','vec4 ftData=ftBands(ftUV,csLip);');fs.writeFileSync(materialFile,shader);
 let app=original;
 const patch=(a,b)=>{assert.equal(app.split(a).length,2,'Native app anchor '+a);app=app.replace(a,()=>b);};
 patch("import {installNativeEyeLayer} from '../../eye-transfer/NativeEyeLayer.mjs';","import {installNativeFaceLayer as installNativeEyeLayer} from '../../face-transfer/NativeFaceLayer.mjs';");
 patch("import {mountEyeUI} from '../../eye-transfer/TransferUI.mjs';","import {mountFaceUI as mountEyeUI} from '../../face-transfer/FaceUI.mjs';");
 patch("import{IntegratedViewer as CommonViewer}from'../../eye-transfer/IntegratedViewer.mjs';","import{FaceViewer as CommonViewer}from'../../face-transfer/FaceViewer.mjs';");
 patch('function release(){','function release(){controller?.model.faceSurface?.disposeUI?.();');
 patch('controller.model.eyeSurface.viewEyes()','controller.model.faceSurface.view("front")');
 app+=`\nwindow.faceTransferredHuman={version:'ET12-F1',report:()=>viewer?.report(),set:values=>{controller.model.faceSurface.set(values);controller.changed();return viewer.report();},before:on=>controller.model.faceSurface.compare(on),view:which=>controller.model.faceSurface.view(which),fieldHashes:()=>controller.model.faceSurface.report.fieldHashesNow,beforePositions:()=>controller.model.faceSurface.before.slice(),bodyCount:()=>controller.model.bodyCount,protectedIndices:()=>Array.from(controller.model.faceSurface.fields.protectedVertex).flatMap((v,i)=>v?[i]:[]),skinUniforms:()=>Object.fromEntries(Object.entries(viewer.skin.U).map(([k,v])=>[k,typeof v.value==='number'?v.value:v.value?.toArray?.()??null])),detailView:feature=>{const ids={nose:30,mouth:51,eye:39,forehead:27},p=controller.model.eyeSurface.landmark(ids[feature]??30),c=[p[0],p[2],-p[1]],d=feature==='forehead'?.14:.10;viewer.restoreCamera({position:[c[0],c[1]+.008,c[2]+d/Math.min(1,viewer.camera.aspect)],target:c,zoom:1});},diagnostics:()=>({eye:controller.model.eyeSurface.report,face:controller.model.faceSurface.report,view:viewer.report(),nativeState:controller.state()}),exportSurface:()=>viewer.exportSurface()};\n`;
 const generated=root+'/full/ui/face-transfer-app.generated.mjs';fs.writeFileSync(generated,app);
 const RAW='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/2c9c6403815083b731d40051cc1d711cfdd7c34f/';
 const plugin={name:'preserve-native-runtime-and-extend-motion-surface',setup(b){
  b.onResolve({filter:/(^|\/)AnimatedHuman\.mjs(?:\?.*)?$/},args=>{if(!args.importer.endsWith('/face-transfer/FaceAnimatedHuman.mjs'))return {path:__dirname+'/FaceAnimatedHuman.mjs'};});
  b.onResolve({filter:/\.(js|mjs)\?/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
  b.onLoad({filter:/\.(mjs|js)$/},args=>{let s=fs.readFileSync(args.path,'utf8');if(s.includes('import.meta.url')){const rel=path.relative(path.dirname(root),args.path).split(path.sep).join('/');s=s.replaceAll('import.meta.url',JSON.stringify(RAW+rel));}return{contents:s,loader:'js',resolveDir:path.dirname(args.path)};});
 }};
 const r=await esbuild.build({entryPoints:[generated],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:root+'/full/source/registration-vendor/three.module.js'},plugins:[plugin]});
 const code=r.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
 let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace(/<script type="module" src="\.\/full\/ui\/browser-app\.mjs[^\"]*"><\/script>/,()=>'<script>'+code+'</script>');
 html=html.replace(/<link rel="stylesheet" href="([^\"]+)">/g,(_,href)=>'<style>'+fs.readFileSync(path.resolve(root,href.split('?')[0]),'utf8')+'</style>');
 html=html.replace(/href="\.\/([^\"]+)"/g,(_,href)=>'href="https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/'+href+'"');
 html=html.replace('<title>共同人物 · 形体预设</title>','<title>共同人物 · ET12 整脸结构与皮肤迁移</title>').replace('脸型 × 体格强化 · 初版36保留对照','ET12 · 整脸分区结构与材质 / 原参数保留');
 html=html.replace('</head>','<!-- Donor surface bands: Infinite 3D Head Scan by Lee Perry-Smith / triplegangers.com. CC BY 3.0 Unported. Cropped, frequency separated, normalized and tiled; no scan identity geometry copied. -->\n</head>');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
 fs.writeFileSync(__dirname+'/preview.html',html);
 const provenance=JSON.parse(fs.readFileSync(__dirname+'/DONOR-PROVENANCE.json')),m={schema:'kaopu/full-face-transfer-build@1',version:'ET12-F1',baseline:'f9378ff3da99ea1da5ff36ce5e4bea24052969f2',nativeAssetsCommit:'2c9c6403815083b731d40051cc1d711cfdd7c34f',donorEyeBaseline:'77976497de5dd957fba0fb1eb91918baf9bd46a8',nativeEntrySHA256:hash(original),generatedEntrySHA256:hash(app),previewSHA256:hash(html),previewBytes:Buffer.byteLength(html),donorBands:provenance,modules:Object.keys(r.metafile.inputs).filter(x=>x.includes('/face-transfer/')),nativeIdentityExpressionAndRigPreserved:true,originalParameterCatalogueUnchanged:true,originalCanonicalBuffersUnchanged:true,originalSkinControlsComposed:true,wholeFaceNativeGeometryRefined:true,sourceScanMeshLoaded:false,staticHeadReplacement:false,oneRenderer:true,motionMaterialAndNativeSkinningCombined:true,motionHeadSubdivision:false,trueSSS:false,allBodyStructureRepaired:false,realMobileDeviceTested:false};
 fs.writeFileSync(__dirname+'/BUILD.json',JSON.stringify(m,null,2));console.log('ET12_BUILD',JSON.stringify({version:m.version,bytes:m.previewBytes,donorBytes:provenance.pngBytes,hash:m.previewSHA256}));
}
main().catch(e=>{console.error(e);process.exit(1)});
