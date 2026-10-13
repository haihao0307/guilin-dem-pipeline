// Private CI-only original appearance reference with a read-only array hook.
import esbuild from'esbuild';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const p=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),old=path.resolve(p,'../r14-loadfix'),r='/tmp/hair-l02-reference';fs.mkdirSync(r,{recursive:true});
for(const n of['src','vendor','native-head','data'])fs.cpSync(old+'/'+n,r+'/'+n,{recursive:true});
fs.appendFileSync(r+'/src/app.js','\nwindow.lengthGroom.runtimeBuffers=()=>({curves:compiled.curves,normals:compiled.normals,tangents:compiled.tangents,randoms:compiled.randoms,active:compiled.active,guideMap:compiled.guideMap,weights:compiled.weights,lengths:compiled.lengths,head:head.geometry.attributes.position.array});\n');
await esbuild.build({entryPoints:[r+'/src/app.js'],bundle:true,format:'esm',outfile:r+'/bundle.js',target:'es2022',loader:{'.png':'dataurl'},minify:true,legalComments:'inline',alias:{three:r+'/vendor/three.module.js'}});
const oldHTML=fs.readFileSync(old+'/public-lite.html','utf8'),code=fs.readFileSync(r+'/bundle.js','utf8').replace(/<\/script/g,'<\\/script');
const html=oldHTML.replace(/<script type="module">[\s\S]*?<\/script>/,()=>'<script type="module">'+code+'</script>');
if(html===oldHTML)throw Error('Reference module not replaced');fs.writeFileSync(r+'/index.html',html);
fs.writeFileSync(r+'/legacy.html','<!doctype html><html><head><meta charset="utf-8"><title>L01 transport replay</title></head><body><script>fetch("./index.html").then(r=>r.text()).then(t=>{document.open();document.write(t);document.close();});</script></body></html>');
fs.writeFileSync(p+'/evidence/reference-transport.json',JSON.stringify({mode:'controlled replay of htmlpreview fetch-text/document-write barrier, not user network capture',originalDocumentBytes:Buffer.byteLength(oldHTML),instrumentedDocumentBytes:Buffer.byteLength(html),addedHook:'read-only full-array SHA inspection',appearanceChanged:false},null,2));
