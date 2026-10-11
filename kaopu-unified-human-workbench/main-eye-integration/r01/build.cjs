const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const root=path.resolve(__dirname,'../..'),repo=path.resolve(root,'..'),MAIN='1c12f375953e26aed5099ccb9df6ed6decae51c6',EYES='528f813d5f02ee0e3bfbf870d1f6fb02fe722fc1',FACE='02f596def9d07ebfc187e1eb18ad345a57c8a6b6',NATIVE='0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe';
 const source=fs.readFileSync(root+'/full/ui/browser-app.mjs','utf8'),original=fs.readFileSync(root+'/index.html','utf8');let app=source;
 const patch=(a,b)=>{assert.equal(app.split(a).length,2,'Main interface drift: '+a);app=app.replace(a,()=>b);};
 app=`import {installIdentity} from '../../identity-lab/IdentityModel.mjs';
import {installIdentitySkin} from '../../identity-lab/IdentitySkin.mjs';
import {mountIdentityUI} from '../../identity-lab/IdentityUI.mjs';
import {installNativeEyeLayer} from '../../eye-transfer/NativeEyeLayer.mjs';
import {mountEyeUI} from '../../eye-transfer/TransferUI.mjs';
import {installFaceSurface} from '../../face-transfer/FaceSurface.mjs';
import {installFaceSkinBridge} from '../../face-transfer/FaceSkin.mjs';
import {mountFaceUI} from '../../face-transfer/FaceUI.mjs';
import {installNaturalEyes} from '../../eye-materials/NaturalEyeState.mjs';
import {mountNaturalEyeUI} from '../../eye-materials/NaturalEyeUI.mjs';
import {mountIterationUI} from '../../eye-materials/IterationUI.mjs';
`+app;
 patch("import{CommonViewer}from'./Viewer.mjs?v=presets-r01-20261008'","import{NaturalEyeViewer as CommonViewer}from'../../eye-materials/NaturalEyeViewer.mjs'");
 patch('model.compute(defaultState());if(savedArchive)','model.compute(defaultState());installNativeEyeLayer(model);installFaceSurface(model);installFaceSkinBridge(model);installIdentity(model);installIdentitySkin(model);installNaturalEyes(model);if(savedArchive)');
 patch('}wasLoaded=true;',`}mountEyeUI({model,viewer,controller});mountFaceUI({model,viewer,controller});mountIdentityUI({model,viewer,controller});mountNaturalEyeUI({model,viewer,controller});mountIterationUI({model,viewer,controller});mountMainEyeEntry({model,viewer,controller});wasLoaded=true;`);
 patch('function release(){','function release(){controller?.model.naturalEyes?.disposeUI?.();controller?.model.identityLab?.disposeUI?.();controller?.model.faceSurface?.disposeUI?.();controller?.model.eyeSurface?.disposeUI?.();');
 patch('const archive={...previousFaceArchive,surface:controller.archive().surface};','const appearance=controller.archive(),archive={...previousFaceArchive,surface:appearance.surface,eyeSurface:appearance.eyeSurface,faceSurface:appearance.faceSurface,faceIdentity:appearance.faceIdentity,naturalEyes:appearance.naturalEyes};');
 app+=`
function mountMainEyeEntry({model,viewer,controller}){
 const api=window.naturalEyeWorkbench,p=document.getElementById('identityPanel'),open=api.open;
 api.open=()=>{p.hidden=false;open();document.getElementById('main-eye-entry').setAttribute('aria-expanded','true');};
 const close=()=>{p.hidden=true;document.getElementById('main-eye-entry').setAttribute('aria-expanded','false');};
 const closeButton=document.createElement('button');closeButton.id='main-eye-close';closeButton.textContent='返回人物库';closeButton.addEventListener('click',close);p.querySelector('.identity-head').append(closeButton);
 close();const retained=document.querySelector('.identity-retained');if(retained)retained.hidden=true;
 const oldDispose=model.naturalEyes.disposeUI;model.naturalEyes.disposeUI=()=>{closeButton.removeEventListener('click',close);oldDispose?.();};
 window.__IDENTITY_QA__={model:()=>model,viewer:()=>viewer,controller:()=>controller};
 window.mainEyeIntegration={version:'MAIN-EYES-R01',source:'${EYES}',mainBaseline:'${MAIN}',model:()=>model,viewer:()=>viewer,controller:()=>controller,close,report:()=>({version:'MAIN-EYES-R01',sameModel:model===controller.model,nativeVertices:model.positions.length/3,eyes:api.report(),originalMainEntryRetained:true})};
 document.title='共同人物总台 · 自然眼球已接入';
}
document.getElementById('main-eye-entry').addEventListener('click',()=>withEntryRequest('自然眼球',async isCurrent=>{if(motionStudio)await motionStudio.setMode('shape');if(!isCurrent())return;naturalEyeWorkbench.open();naturalEyeWorkbench.view('eyes');entryMessage('自然眼球已应用到当前人物：左右独立、完整人物档案保存。');}).catch(()=>{}));
document.querySelectorAll('[data-entry-action]').forEach(button=>button.addEventListener('click',()=>window.mainEyeIntegration?.close(),{capture:true}));
`;
 fs.writeFileSync(root+'/full/ui/main-eye-app.generated.mjs',app);
 const plugin={name:'locked-original-asset-roots',setup(b){b.onResolve({filter:/\.(mjs|js)\?/},a=>({path:path.resolve(a.resolveDir,a.path.split('?')[0])}));b.onLoad({filter:/\.(mjs|js)$/},a=>{let s=fs.readFileSync(a.path,'utf8'),rel=path.relative(repo,a.path).split(path.sep).join('/');
  if(a.path.endsWith('/NaturalEyeUI.mjs')){const old="open();Promise.all([viewer.skin.naturalEyesReady,viewer.skin.faceReady].filter(Boolean)).then(()=>{if(!disposed){view('eyes');syncStatus();}});";assert.ok(s.includes(old),'Eye UI loading contract drift');s=s.replace(old,"open();Promise.all([viewer.skin.naturalEyesReady,viewer.skin.faceReady].filter(Boolean)).then(()=>{if(!disposed)syncStatus();});");}
  if(s.includes('import.meta.url')){const anchor=rel.includes('/face-transfer/')?FACE:rel.includes('/motion-studio/')?MAIN:NATIVE;s=s.replaceAll('import.meta.url',JSON.stringify('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+anchor+'/'+rel));}
  return{contents:s,loader:'js',resolveDir:path.dirname(a.path)};});}};
 const result=await esbuild.build({stdin:{contents:app,resolveDir:root+'/full/ui',sourcefile:'main-eye-app.generated.mjs',loader:'js'},bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',loader:{'.png':'dataurl'},alias:{three:root+'/full/source/registration-vendor/three.module.js'},plugins:[plugin]});
 const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
 let html=original.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace(/<script type="module" src="\.\/full\/ui\/browser-app\.mjs[^\"]*"><\/script>/,()=>'<script>'+code+'</script>');
 html=html.replace(/<link rel="stylesheet" href="([^\"]+)">/g,(_,s)=>'<style>'+fs.readFileSync(path.resolve(root,s.split('?')[0]))+'</style>');
 html=html.replace(/href="\.\/([^\"]+)"/g,(_,s)=>'href="https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/'+s+'"');
 const button='<button id="main-eye-entry" aria-expanded="false">自然眼球 / 五官</button>';
 html=html.replace('<button data-entry-action="shape">人物对照</button>','<button data-entry-action="shape">人物对照</button>'+button);
 assert.ok(html.includes(button));
 html=html.replace('</head>','<style>'+fs.readFileSync(root+'/eye-materials/layout.css','utf8')+'#identityPanel[hidden],.identity-retained[hidden]{display:none!important}#main-eye-close{margin-top:6px}#main-eye-entry{font-weight:600}'+ '</style><!-- MAIN-EYES-R01: same existing main character; ET16 natural eyes by callharvey3d, CC-BY attribution retained. No new head model; no hair or dynamic eyelid anatomy certification. -->\n</head>');
 assert.equal([...html.matchAll(/<script\b/g)].length,1);assert.equal(sha(fs.readFileSync(root+'/index.html')),sha(original));
 fs.writeFileSync(__dirname+'/preview.html',html);fs.writeFileSync(__dirname+'/index-before-integration.html',original);
 const inputFiles=Object.keys(result.metafile.inputs).filter(p=>fs.existsSync(p));
 const manifest={version:'MAIN-EYES-R01',sourceCommit:process.env.GITHUB_SHA||null,mainBaseline:MAIN,eyeSource:EYES,eyeVerifiedBuild:'99f89145f514eecaabdae31dc42fd51311602dd6',originalIndexSHA256:sha(original),originalAppSHA256:sha(source),previewSHA256:sha(html),previewBytes:Buffer.byteLength(html),generatedEntrySHA256:sha(app),sameOriginalCharacter:true,originalMainSceneControlsRetained:true,sourceLock:JSON.parse(fs.readFileSync(root+'/eye-materials/SOURCE_LOCK.json')),inputFiles:inputFiles.map(p=>({path:path.relative(repo,p),sha256:sha(fs.readFileSync(p))})),limitations:['ET16 bounded optical/contact shader, not anatomical eyelid reconstruction','Two original 1024x1024 atlases, not cinematic eye scans','Actual hardware and physical phone tests not performed','Hat remains its independent fitting workbench; no hair collision implemented']};
 fs.writeFileSync(__dirname+'/BUILD.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({version:manifest.version,previewBytes:manifest.previewBytes,previewSHA256:manifest.previewSHA256}));
})().catch(e=>{console.error(e);process.exit(1)});
