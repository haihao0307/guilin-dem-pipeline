const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const p2=path.resolve(__dirname,'../lip-startup-r02'),old=JSON.parse(fs.readFileSync(p2+'/SITE.json')),src=p2+'/site',site=__dirname+'/site';
const commit=process.env.GITHUB_SHA||'local',folder='kaopu-unified-human-workbench/lip-startup-r03/p3-'+commit.slice(0,12),siteURL='https://haihao0307.github.io/guilin-dem-pipeline/'+folder+'/';
fs.rmSync(site,{recursive:true,force:true});fs.cpSync(src,site,{recursive:true});
let app=fs.readFileSync(src+'/'+old.programFile,'utf8');assert.equal(sha(app),'3c9dd2846f5075576e3bd9682846502c445d2ab59118bca91517b1609c60639b','Pinned P2 program changed');
// A digest-pinned adapter seam, not a broad substitution of model code.
// Replace only the existing verified-byte reader. All its downstream native
// constructors, decompression/digest checks, materials and geometry remain.
const start=app.indexOf('async function om(n,e,t){'),end=app.indexOf('async function kr(n){',start);assert(start>=0&&end>start);assert.equal(app.indexOf('async function om(n,e,t){',start+1),-1);
const originalReader=app.slice(start,end);assert(originalReader.includes('AbortSignal.timeout(9e4)'));assert(originalReader.includes('crypto')||originalReader.includes('await Ar(p)'));
app=app.slice(0,start)+'async function om(n,e,t){return globalThis.__LIP_P3__.transport.loadVerified(n,e,t)}'+app.slice(end);
assert(!app.includes('AbortSignal.timeout(9e4)'),'Unexpected second absolute timeout in bundle');
app=app.replaceAll(old.siteURL,siteURL).replace('window.__LIP_P2__.appStarted=true','window.__LIP_P3__.appStarted=true');assert(app.includes('window.__LIP_P3__.appStarted=true'));
const files=[],chunkSize=1024*1024;fs.mkdirSync(site+'/chunks',{recursive:true});
for(const row of old.resources){
 const model=!!row.expectedSHA256||row.file.startsWith('assets/gnm-');if(!model)continue;
 const bytes=fs.readFileSync(src+'/'+row.file);assert.equal(sha(bytes),row.sha256,row.file);
 const chunks=[];for(let offset=0;offset<bytes.length;offset+=chunkSize){const b=bytes.subarray(offset,offset+chunkSize),hash=sha(b),name='chunks/'+hash+'.bin';fs.writeFileSync(site+'/'+name,b);chunks.push({offset,bytes:b.length,sha256:hash,file:name});}
 const prefix=row.file.includes('/anny-all/')?'Anny / ':row.file.includes('/kaopu-mhr-workbench/')?'MHR / ':row.file.startsWith('assets/gnm-')?'GNM / ':'';
 files.push({logical:row.file,label:prefix+path.basename(row.file),bytes:bytes.length,sha256:row.sha256,chunks});
 fs.rmSync(site+'/'+row.file);
}
assert.equal(files.length,26,'Pinned full model transport must contain 26 original resources');
const manifest={schema:'kaopu/lip-verified-chunks@1',chunkSize,files};
const kernel=fs.readFileSync(__dirname+'/ChunkTransport.mjs','utf8').replace('export function createLipTransport','function createLipTransport'),boot=fs.readFileSync(__dirname+'/boot.js','utf8');
new vm.Script(app);new vm.Script(kernel+'\n'+boot);
let html=fs.readFileSync(src+'/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const inline='window.LIP_P3_CONFIG='+JSON.stringify({manifest})+';\n'+kernel+'\n'+boot+'\n'+app;
html=html.replace('</body>',()=>'<script>'+inline.replace(/<\/script/gi,'<\\/script')+'</script></body>').replace('<title>ET19 唇部 · P2 直连修复</title>','<title>ET19 唇部 · P3 分块恢复</title>');
assert(html.includes('__LIP_P3__'));assert.equal([...html.matchAll(/<script\b/g)].length,1);fs.writeFileSync(site+'/index.html',html);fs.rmSync(site+'/compat.html');fs.rmSync(site+'/'+old.programFile);
const report={schema:'kaopu/lip-p3-build@1',version:'ET19-L3-P3',sourceCommit:commit,p2Commit:'3f9d3106c20e36c963ff918f27dda21361e4986f',p2Site:old.siteURL,siteURL,folder,entryBytes:Buffer.byteLength(html),entrySHA256:sha(html),programSHA256:sha(app),originalReaderSHA256:sha(originalReader),transportSHA256:sha(fs.readFileSync(__dirname+'/ChunkTransport.mjs')),modelFiles:files.length,modelBytes:files.reduce((n,f)=>n+f.bytes,0),chunks:files.reduce((n,f)=>n+f.chunks.length,0),chunkSize,transport:manifest,oldRuntimeUnchanged:true,changes:['Replace 90-second absolute model timeout with 30-second no-progress watchdog','Retry complete body read, length and SHA-256 failures, up to three attempts','Persist every completed verified chunk, resume across refresh without HTTP Range dependency','Read compatible P2 full caches without deleting them; P3 writes only its bounded chunk cache','No 150-second total startup cutoff while network makes progress','Same original geometry, materials, full native weights and inline application'],limitations:['Screenshot was signal timed out, not program HTTP404; prior diagnosis was incorrect','Resume granularity is completed chunks; an incomplete chunk is downloaded again','Cache denial or eviction can prevent cross-refresh reuse','128MiB is the P3 resource cache budget only, not total RAM or all browser storage','Full model bytes and shader/geometry initialization costs remain']};
fs.writeFileSync(__dirname+'/SITE.json',JSON.stringify(report,null,2));fs.writeFileSync(site+'/BUILD.json',JSON.stringify(report,null,2));console.log(JSON.stringify({siteURL,entryBytes:report.entryBytes,modelFiles:report.modelFiles,modelBytes:report.modelBytes,chunks:report.chunks,entrySHA256:report.entrySHA256}));
