'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild'),vm=require('vm');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),here=__dirname,root=path.resolve(here,'..'),old=root+'/brow-lash-r01';
const read=p=>fs.readFileSync(p,'utf8'),once=(s,a,b)=>{assert.equal(s.split(a).length,2,'adapter anchor '+a.slice(0,100));return s.replace(a,()=>b);};
(async()=>{
 const host=read(root+'/human-integrated-r06/preview.html');assert.equal(hash(host),'b33c0a651570f2671ac61ea546279abfe06ebb07c966a70964e428df966420fd');
 let groom=read(old+'/Groom.mjs');assert.equal(hash(groom),'d6b1c8125ef8c42db7ee23313071902ea26f38529566f83d4ca41132e92011f8');
 groom="import {grow,followLash} from '../brow-lash-r02/Growth.mjs';\n"+groom;
 const start=groom.indexOf(' const grouped={brow:[],upper:[],lower:[]}'),end=groom.indexOf(' for(const[kind,strands]',start);assert(start>0&&end>start);groom=groom.slice(0,start)+' const grouped=grow(this,g);\n'+groom.slice(end);
 groom=once(groom,'strand.anchors?strand.anchors.map(a=>a.sampled[0]):strand.anchor.sampled','strand.anchors?strand.anchors.map(a=>a.sampled[0]):followLash(strand,this.frame)');
 groom=groom.replaceAll('BROW-LASH-R01','BROW-LASH-R02');
 groom=once(groom,'nativeSkinUnmodified:true,',"focusedBlink:this.focusBlink?.report(),fiberScattering:'four optical paths / direct lights; approximate environment',nativeSkinUnmodified:true,");
 let mat=read(old+'/FiberMaterial.mjs');mat="import{hairGLSL}from'../brow-lash-r02/HairScattering.mjs';\n"+mat;
 mat=once(mat,'m.userData.compiled=true;',"shader.fragmentShader=replace(shader.fragmentShader,'#include <lights_physical_pars_fragment>','#include <lights_physical_pars_fragment>\\n'+hairGLSL);m.userData.compiled=true;");
 mat=mat.replaceAll('kaopu-bl-r01-fiber-v4-footprint-','kaopu-bl-r02-chiang-direct-v1-');
 let app=read(old+'/app.mjs');app="import {FocusedBlink} from '../brow-lash-r02/FocusedBlink.mjs';\n"+app;
 const a=app.indexOf('async function prepare()'),b=app.indexOf("panel.addEventListener('click'",a);assert(a>0&&b>a);
 app=app.slice(0,a)+`async function prepare(){if(!groom.focusBlink)groom.focusBlink=new FocusedBlink(groom);status('只准备左右眼两个原生闭眼形变，不再先准备全部待机。');$('bl-prepare').disabled=$('bl-blink').disabled=true;try{await groom.focusBlink.prepare();$('bl-closure').disabled=false;status('两眼原生形变已就绪。可单次眨眼或停在任意闭合程度。');return true;}catch(e){status('闭眼准备失败：'+e.message,true);throw e;}finally{$('bl-prepare').disabled=$('bl-blink').disabled=false;}}
function closure(x){if(!groom.focusBlink?.ready)throw Error('请先准备原生眨眼');groom.focusBlink.cancel();groom.focusBlink.set(x);$('bl-closure').value=x;$('bl-closure-value').textContent=Math.round(x*100)+'%';sync();}
`+app.slice(b);
 app=once(app,"lifelikeIdle.trigger('blink')",'groom.focusBlink.once()');
 app=app.replaceAll('BROW-LASH-R01','BROW-LASH-R02').replaceAll('· R01','· R02').replaceAll('第一版已渲染','R02 已渲染').replaceAll('首次按需准备','仅两眼按需准备');
 const routes=new Map([[old+'/Groom.mjs',groom],[old+'/FiberMaterial.mjs',mat],[old+'/app.mjs',app]]);
 const plugin={name:'read-only-original-adapters',setup(b){b.onLoad({filter:/\.(mjs|js)$/},a=>{if(routes.has(a.path))return{contents:routes.get(a.path),loader:'js',resolveDir:path.dirname(a.path)};});}};
 const result=await esbuild.build({entryPoints:[old+'/app.mjs'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',plugins:[plugin]});
 const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
 const html=host.replace(/<title>[^<]*<\/title>/,'<title>KAOPU 眉毛 / 睫毛 R02 · 原生双眼专项</title>').replace('</body>',()=>'<script data-module="KAOPU-BROW-LASH-R02">'+code+'</script></body>');
 const getScripts=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);assert.deepEqual(getScripts(html).slice(0,getScripts(host).length).map(hash),getScripts(host).map(hash));for(const script of getScripts(html))new vm.Script(script);
 fs.writeFileSync(here+'/preview.html',html);fs.writeFileSync(here+'/Groom.adapted.txt',groom);fs.writeFileSync(here+'/Material.adapted.txt',mat);fs.writeFileSync(here+'/App.adapted.txt',app);
 const files=[...Object.keys(result.metafile.inputs),here+'/build.cjs',here+'/verify.cjs'];
 const manifest={version:'BROW-LASH-R02',sourceCommit:process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local',hostBuild:'f5017cb7cb9c2024df6a08328564c3f4ae502509',predecessor:'68f0f1a0ca7e838197ad3bba8fab47cb2e90f66d',hostExecutableUnchanged:true,previewBytes:Buffer.byteLength(html),previewSHA256:hash(html),addonBytes:Buffer.byteLength(code),sources:files.map(p=>({path:path.relative(path.resolve(root,'..'),p),sha256:hash(fs.readFileSync(p))})),adapterSHA256:{groom:hash(groom),material:hash(mat),app:hash(app)},userVisualAccepted:false,filmQualityAccepted:false};
 fs.writeFileSync(here+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));console.log('Built',manifest.previewBytes,manifest.previewSHA256);
})().catch(e=>{console.error(e);process.exitCode=1;});
