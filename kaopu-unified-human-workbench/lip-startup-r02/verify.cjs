const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const build=JSON.parse(fs.readFileSync(__dirname+'/SITE.json','utf8'));process.env.PERF_URL=process.env.PERF_URL||build.siteURL;process.env.PERF_OUT=process.env.PERF_OUT||'lip-p2-evidence';process.env.PERF_MODE=process.env.P2_PUBLIC==='1'?'public':'candidate';
let s=fs.readFileSync(path.resolve(__dirname,'../lip-startup-r01/verify.cjs'),'utf8');
s=s.replace("run.startup?.version==='ET19-L3-P1'","run.startup?.version==='ET19-L3-P2'");
const anchor="page.setDefaultTimeout(180000);";assert(s.includes(anchor));
s=s.replace(anchor,anchor+`
 const forbidden=[];page.on('request',r=>{if(/^https:\\/\\/(raw\\.githubusercontent\\.com|htmlpreview\\.github\\.io)\\//.test(r.url()))forbidden.push(r.url());});
 await page.route('https://raw.githubusercontent.com/**',r=>r.abort());await page.route('https://htmlpreview.github.io/**',r=>r.abort());
 if(process.env.P2_PUBLIC!=='1')await page.route(${JSON.stringify(build.siteURL)}+'**',async r=>{const rel=decodeURIComponent(r.request().url().slice(${build.siteURL.length}).split('?')[0])||'index.html';const file=path.resolve(__dirname,'site',rel);if(!file.startsWith(path.resolve(__dirname,'site')+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:'P2 candidate missing '+rel});const ext=path.extname(file);await r.fulfill({status:200,contentType:({'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.webp':'image/webp','.txt':'text/plain'})[ext]||'application/octet-stream',body:fs.readFileSync(file)});});
 `);
s=s.replace("const run=await page.evaluate(","await page.waitForFunction(()=>window.__LIP_P2__?.ready);const run=await page.evaluate(");
s=s.replace("check('no JavaScript or shader errors',errors.length===0,errors);","check('no third-party startup dependency even with raw and HTMLPreview blocked',forbidden.length===0,forbidden);check('direct P2 page fully ready',await page.evaluate(()=>__LIP_P2__.ready&&document.getElementById('lipP2Status').hidden));check('no JavaScript or shader errors',errors.length===0,errors);");
fs.writeFileSync(__dirname+'/.verify-generated.cjs',s);require(__dirname+'/.verify-generated.cjs');
