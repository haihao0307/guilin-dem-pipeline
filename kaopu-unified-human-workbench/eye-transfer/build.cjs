const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm'),esbuild=require('esbuild');
async function main(){
const root=path.resolve(__dirname,'..'),BASE='2c9c6403815083b731d40051cc1d711cfdd7c34f',raw='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+BASE+'/',PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/',hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const oldFile=root+'/full/ui/browser-app.mjs',original=fs.readFileSync(oldFile,'utf8');let source=original;
function patch(a,b){assert.equal(source.split(a).length,2,'Native entry anchor '+a);source=source.replace(a,()=>b);}
patch("import{CommonViewer}from'./Viewer.mjs?v=presets-r01-20261008';","import{IntegratedViewer as CommonViewer}from'../../eye-transfer/IntegratedViewer.mjs';");
source="import {installNativeEyeLayer} from '../../eye-transfer/NativeEyeLayer.mjs';\nimport {mountEyeUI} from '../../eye-transfer/TransferUI.mjs';\n"+source;
patch('model.compute(defaultState());if(savedArchive)','model.compute(defaultState());installNativeEyeLayer(model);if(savedArchive)');
patch('wasLoaded=true;', 'mountEyeUI({model,viewer,controller});wasLoaded=true;');
patch('function release(){','function release(){controller?.model.eyeSurface?.disposeUI?.();');
source+='\nwindow.eyeTransferredHuman={version:"ET11-U1",report:()=>({layer:controller?.model.eyeSurface.report,view:viewer?.report()}),set:values=>{controller.model.eyeSurface.set(values);controller.changed();return window.eyeTransferredHuman.report();},nativePositions:()=>controller.model.eyeSurface.nativePositions.slice(),exportSurface:()=>viewer.exportSurface(),viewEyes:()=>controller.model.eyeSurface.viewEyes(),compare:on=>controller.model.eyeSurface.compare(on),inspect:()=>({positions:controller.model.positions.slice(),faces:controller.model.faces.slice(),rigNames:controller.model.lastBodyDriver.rig.names.slice(),weightsUnchanged:true}),settings:()=>({...controller.model.eyeSurface.settings})};\nqueueMicrotask(()=>selectPreset("r02-adult-male-sturdy"));\n';
const generated=root+'/full/ui/eye-transfer-app.generated.mjs';fs.writeFileSync(generated,source);
const plugin={name:'fixed-original-module-paths',setup(build){
 build.onResolve({filter:/\.(mjs|js)\?/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
 build.onLoad({filter:/\.(mjs|js)$/},args=>{let s=fs.readFileSync(args.path,'utf8');if(s.includes('import.meta.url')){const rel=path.relative(path.resolve(root,'..'),args.path).split(path.sep).join('/');s=s.replaceAll('import.meta.url',JSON.stringify(raw+rel));}return {contents:s,loader:'js',resolveDir:path.dirname(args.path)};});
}};
const result=await esbuild.build({entryPoints:[generated],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:root+'/full/source/registration-vendor/three.module.js'},plugins:[plugin]});
const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace(/<script type="module" src="\.\/full\/ui\/browser-app\.mjs[^\"]*"><\/script>/,()=>'<script>'+code+'</script>');
html=html.replace(/<link rel="stylesheet" href="([^\"]+)">/g,(_,href)=>{const file=path.resolve(root,href.split('?')[0]);return '<style>'+fs.readFileSync(file,'utf8')+'</style>';});
html=html.replace(/href="\.\/([^\"]+)"/g,(_,href)=>'href="'+PUBLIC+'kaopu-unified-human-workbench/'+href+'"');
html=html.replace('<title>共同人物 · 形体预设</title>','<title>共同人物 · ET11 眼周系统迁移</title>').replace('脸型 × 体格强化 · 初版36保留对照','ET11 · 36预设 × 参数驱动眼周');
assert(!html.includes('src="./full/ui/browser-app'));assert.equal([...html.matchAll(/<script\b/g)].length,1);
fs.writeFileSync(__dirname+'/preview.html',html);
const m={schema:'kaopu/native-eye-transfer-build@1',version:'ET11-U1',baseline:BASE,donor:'Humanoid-Rig-Lab-Next/ET11-M1',nativeAppSHA256:hash(original),generatedAppSHA256:hash(source),previewSHA256:hash(html),previewBytes:Buffer.byteLength(html),newModules:Object.keys(result.metafile.inputs).filter(p=>p.includes('eye-transfer/')),canonicalNativeTopologyUnchanged:true,originalHeadMeshImported:false,originalPresetsAndParameters:true,bodyGeneratorUnchanged:true,headSurfaceRecomputedEveryNativeGeneration:true,derivedHeadSubdivision:true,realMobileDeviceTested:false,fullEyePhysicsOrFinalScanSkin:false};fs.writeFileSync(__dirname+'/BUILD.json',JSON.stringify(m,null,2));console.log(m);
}
main().catch(e=>{console.error(e);process.exit(1)});
