const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),old=root+'/human-integrated-r03',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const EAR='38a8a2140b42561eecbd31af5df074e9210d0c64',LIP='d6810d865fb7c06996b75ea7f0272c24304bf297';
const read=p=>fs.readFileSync(p,'utf8'),put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
function patch(s,a,b,count=1){assert.equal(s.split(a).length,count+1,'R04 input anchor changed: '+a);return s.split(a).join(b);}
const records=[];
function donor(sha,folder,name){const p='kaopu-unified-human-workbench/'+folder+'/'+name,b=cp.execFileSync('git',['show',sha+':'+p]);const out=__dirname+'/specialists/'+folder+'/'+name;put(out,b);records.push({path:path.relative(__dirname,out),sourceCommit:sha,sourcePath:p,sha256:hash(b)});return b.toString();}
(async()=>{
 assert.equal(hash(read(old+'/preview.html')),'d89a5b76034d005a147d0ae87decfe810f86d2b9e5d701fc552dc77a6b8500fc','R03 fixed parent changed');
 fs.cpSync(old+'/specialists',__dirname+'/specialists',{recursive:true});
 for(const f of ['EarVisibility.mjs','PenumbraFilter.mjs','ContinuityMaterial.mjs','ContinuityViewer.mjs','unit.mjs','BUILD.json'])donor(EAR,'ear-continuity-r06',f);
 for(const f of ['ChunkTransport.mjs','boot.js','SITE.json','unit.mjs'])donor(LIP,'lip-startup-r03',f);
 const p2=JSON.parse(donor(LIP,'lip-startup-r02','SITE.json')),p3=JSON.parse(read(__dirname+'/specialists/lip-startup-r03/SITE.json'));
 for(const f of ['FastLoadCommon.mjs','AssetCache.mjs','StartupRenderGate.mjs','TransportManifest.mjs'])donor(LIP,'lip-startup-r01',f);
 for(const f of ['Anatomy.mjs','AttributeBudget.mjs','FacePores.mjs','RegionalSkin.mjs','UnifiedUI.mjs','UnifiedViewer.mjs','layout.css','test.mjs'])put(__dirname+'/'+f,read(old+'/'+f).replaceAll('human-integrated-r03','human-integrated-r04').replaceAll('HUMAN-INTEGRATED-R03','HUMAN-INTEGRATED-R04'));
 const p1=__dirname+'/specialists/lip-startup-r01/';
 for(const f of ['FastLoadCommon.mjs','StartupRenderGate.mjs','TransportManifest.mjs'])put(__dirname+'/'+f,read(p1+f));
 let cache=read(p1+'AssetCache.mjs');const tail=cache.slice(cache.indexOf('export async function inflate'),cache.indexOf('P.cacheLimitBytes='));
 put(__dirname+'/AssetCache.mjs',"const P=globalThis.__LIP_STARTUP__;const alive=s=>{if(s?.aborted)throw s.reason||new DOMException('Cancelled','AbortError')};\nexport const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');\nexport function mark(stage){P.stage=stage;P.events.push({stage,ms:performance.now()});P.notify?.();}\nexport function loadVerified(url,expected,signal){return globalThis.__LIP_P3__.transport.loadVerified(url,expected,signal);}\n"+tail);
 const byFile=new Map(p2.resources.map(r=>[r.file,r]));const manifest=structuredClone(p3.transport);
 for(const f of manifest.files){const row=byFile.get(f.logical);assert(row,'P3 file has no original URL '+f.logical);assert.equal(row.sha256,f.sha256);if(!f.logical.startsWith('assets/gnm-'))f.logical=row.url;}
 put(__dirname+'/StartupConfig.mjs','export const transportConfig='+JSON.stringify({manifest,assetBase:p3.siteURL})+';\n');
 let boot=read(__dirname+'/specialists/lip-startup-r03/boot.js');boot=patch(boot,"base=new URL('.',location.href).href","base=config.assetBase");boot=boot.replace('嘴唇工作台 · P3 下载恢复版','人物总台 R04 · 耳 R06 / 唇 ET19 / P3 恢复');
 put(__dirname+'/Startup.mjs',"import {createLipTransport} from './specialists/lip-startup-r03/ChunkTransport.mjs';\nimport {transportConfig} from './StartupConfig.mjs';\nwindow.LIP_P3_CONFIG=transportConfig;\n"+boot);
 let compat=read(old+'/compatibility.cjs').replaceAll('human-integrated-r03','human-integrated-r04');put(__dirname+'/compatibility.cjs',compat);
 let v=read(__dirname+'/UnifiedViewer.mjs');v="import {syncEarLatest,disposeEarLatest} from './EarLatest.mjs';\n"+v;
 v=patch(v,'if(this.regionalSkin)this.regionalSkin.field(f);}','if(this.regionalSkin)this.regionalSkin.field(f);syncEarLatest(this);}');
 v=patch(v,'if(this.earLight)this.earLight.visible=!!this.earInspection;}','if(this.earLight)this.earLight.visible=!!this.earInspection;syncEarLatest(this);}');
 v=patch(v,"version:'HUMAN-INTEGRATED-R04',anatomy:","version:'HUMAN-INTEGRATED-R04',earLatest:this.earLatestReport,lipTransport:'P3',anatomy:");
 v=patch(v,'dispose(){this.regionalSkin?.dispose();','dispose(){disposeEarLatest(this);this.regionalSkin?.dispose();');put(__dirname+'/UnifiedViewer.mjs',v);
 let ui=read(__dirname+'/UnifiedUI.mjs').replaceAll('R03 /','R04 /').replaceAll('耳朵 R05','耳朵 R06').replaceAll('左耳 R05','左耳 R06').replaceAll('右耳 R05','右耳 R06');
 ui=patch(ui,"ear:'63e5dfddf2b5ca0d686651804beeba3333b2f41e'","ear:'"+EAR+"',lipTransport:'"+LIP+"'");
 ui=patch(ui,'<button data-uact="ear-pore">','<button data-uact="eye-check">眼周近看</button><button data-uact="ear-compare">R06 遮挡开关</button><button data-uact="ear-pore">');
 ui=patch(ui,"if(a==='face')face();","if(a==='eye-check'){viewer.view('face');viewer.camera.zoom=2;viewer.camera.updateProjectionMatrix();viewer.camera.position.y+=.045;viewer.orbit.target.y+=.045;viewer.orbit.update();viewer.render();}else if(a==='ear-compare'){if(viewer.latestEar)viewer.latestEar.enabled=!viewer.latestEar.enabled;viewer.render();}else if(a==='face')face();");put(__dirname+'/UnifiedUI.mjs',ui);
 // R06 finite fields are delivered as exact Float32 vertex-texture reads. No
 // precision reduction or arbitrary interpolation replaces the R06 algorithm.
 let material=read(__dirname+'/specialists/ear-continuity-r06/ContinuityMaterial.mjs');
 material=patch(material,"attribute vec3 e6Direct,e6Deep;varying",'uniform sampler2D uE6Packed;uniform int uE6Width;vec3 e6Fetch(int offset){int id=gl_VertexID*2+offset;return texelFetch(uE6Packed,ivec2(id%uE6Width,id/uE6Width),0).xyz;}varying');
 material=patch(material,'vE6Direct=e6Direct;vE6Deep=e6Deep;vE6Weight=eWeight;','vE6Direct=e6Fetch(0);vE6Deep=e6Fetch(1);vE6Weight=eTissue.z;');put(__dirname+'/ContinuityMaterial.adapted.mjs',material);
 // Eye changes, if present, are emitted separately with their own exact
 // predecessor anchors; no old R03 or specialist file is overwritten.
 if(fs.existsSync(__dirname+'/eye-build.cjs'))require('./eye-build.cjs')({root,old,read,put,patch});
 let core=read(old+'/build-core.cjs');assert.equal(hash(core),'562658d0ae6f73e35756e003621b9872db5e32f3f6c462a6cab7b838fe2a90c5');
 core=core.replaceAll('human-integrated-r03','human-integrated-r04').replaceAll('HUMAN-INTEGRATED-R03','HUMAN-INTEGRATED-R04');
 core=patch(core,'app=`import {installAnatomy}',"app=`import '../../human-integrated-r04/Startup.mjs';\nimport {installAnatomy}");
 core=patch(core,"const route=p=>{","const route=p=>{if(p.endsWith('/full/ui/load-common.mjs'))return __dirname+'/FastLoadCommon.mjs';if(p.endsWith('/ear-continuity-r06/ContinuityMaterial.mjs'))return __dirname+'/ContinuityMaterial.adapted.mjs';");
 core=patch(core,"'ear-tissue-r05'];","'ear-tissue-r05','ear-continuity-r06'];");
 const inject="s=require(__dirname+'/compatibility.cjs').adapt(s,rel,adapters);if(rel.endsWith('/lip-structure/LipViewer.mjs')){once('this.lipSurfaces=new Map();this.update();','this.lipSurfaces=new Map();this.startupRenderable=true;this.update();');}if(require('fs').existsSync(__dirname+'/eye-adapter.cjs'))s=require(__dirname+'/eye-adapter.cjs').adapt(s,rel,adapters);\n";
 core=patch(core,"if(s.includes('import.meta.url'))",inject+"if(s.includes('import.meta.url'))");
 put(__dirname+'/.build-runtime.cjs',core);cp.execFileSync(process.execPath,[__dirname+'/.build-runtime.cjs'],{stdio:'inherit'});fs.unlinkSync(__dirname+'/.build-runtime.cjs');
 let html=read(__dirname+'/preview.html').replace('共同人物 R03','共同人物 R04').replaceAll('R03 · 耳 R05 / 唇 ET19','R04 · 耳 R06 / 唇 ET19 + P3').replace('耳 R05 / 唇 ET19','耳 R06 / 唇 ET19 + P3');
 const b=JSON.parse(read(__dirname+'/BUILD.json'));Object.assign(b,{version:'HUMAN-INTEGRATED-R04',predecessor:'3a4443bab9ee5a830024e7cbf3de51dc13160a8b',earSource:EAR,lipSource:'5b4997e6dca27106533022b4ab46164cea073818',lipTransportSource:LIP,lipTransportManifestSHA256:hash(read(__dirname+'/specialists/lip-startup-r03/SITE.json')),modelBytes:p3.modelBytes,modelChunks:p3.chunks,previewBytes:Buffer.byteLength(html),previewSHA256:hash(html),latestEarIncluded:true,latestLipTransportIncluded:true,realPhoneTested:false,userVisualAccepted:false});
 put(__dirname+'/preview.html',html);put(__dirname+'/BUILD.json',JSON.stringify(b,null,2));put(__dirname+'/PROVENANCE.json',JSON.stringify(records,null,2));
 console.log('R04 built',b.previewBytes,b.previewSHA256);
})().catch(e=>{console.error(e);process.exitCode=1;});
