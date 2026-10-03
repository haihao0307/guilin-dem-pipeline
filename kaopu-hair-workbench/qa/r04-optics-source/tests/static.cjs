const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(process.env.HAIR_STATIC_HTML||path.join(root,'dist','KAOPU-r04-材质内测.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
if(scripts.length!==4)throw Error('Expected exactly 4 inline scripts, got '+scripts.length);
for(const [i,source]of scripts.entries())new vm.Script(source,{filename:'inline-'+i});
const context={window:{}};vm.runInNewContext(scripts[0],context);vm.runInNewContext(scripts[1],context);const bundle=context.window.WORKBENCH_BUNDLE;
let moduleCount=0;for(const [id,source]of Object.entries(bundle.modules)){new vm.Script(source,{filename:id});const original=fs.readFileSync(path.join(root,'teacher-original/js/app',id+'.js'),'utf8');if(source!==original)throw Error('Source module changed: '+id);moduleCount++;}
for(const [rel,embedded] of Object.entries(bundle.assets)){const actual=rel.endsWith('.png')?Buffer.from(embedded.split(',')[1],'base64'):Buffer.from(embedded);if(!actual.equals(fs.readFileSync(path.join(root,'teacher-original',rel))))throw Error('Asset altered: '+rel);}
const externalMarkup=[...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/g)].map(x=>x[1]);
if(/<(script|link|iframe)[^>]+(?:src|href)=[\"']https?:/i.test(html))throw Error('Unexpected runtime dependency');
const image=html.match(/<img src=\"data:image\/(?:png|jpeg);base64,([^\"]+)/);if(!image||!Buffer.from(image[1],'base64').equals(fs.readFileSync(path.join(root,'references/anemone-macro/wootton-magnifica-original.jpg'))))throw Error('Reference bytes changed');
for(const file of ['host.js','frame.js'])if(!fs.readFileSync(path.join(root,'src',file)).equals(fs.readFileSync(path.join(root,'baselines/r02',file))))throw Error('Frozen r02 adapter changed: '+file);
const sha=crypto.createHash('sha256').update(html).digest('hex');const result={timestamp:new Date().toISOString(),passed:true,inlineScripts:scripts.length,unchangedModules:moduleCount,unchangedEmbeddedAssets:Object.keys(bundle.assets).length,commit:bundle.commit,htmlBytes:Buffer.byteLength(html),htmlSha256:sha,coreExternalMarkupRequests:0,note:'Static validation only; no browser execution or pixel validation implied.'};
fs.writeFileSync(path.join(root,'qa/static-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
