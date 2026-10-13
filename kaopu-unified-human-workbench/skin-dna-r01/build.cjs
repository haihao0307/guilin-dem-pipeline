const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),r04=root+'/human-integrated-r04',r03=root+'/human-integrated-r03',hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p,'utf8'),put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Skin build anchor drift: '+a);return s.replace(a,()=>b);};
(async()=>{
 assert.equal(hash(fs.readFileSync(r04+'/preview.html')),'c8f1150714ac03d2aec7deb6df7dd1e31a4bb887b1ca4fa4a25b38e373377f8d','R04 baseline drift');
 const original={};for(const name of fs.readdirSync(r04)){const p=r04+'/'+name;if(fs.statSync(p).isFile())original[name]=hash(fs.readFileSync(p));}
 fs.cpSync(r04+'/specialists',__dirname+'/specialists',{recursive:true});
 for(const name of fs.readdirSync(r04)){if(!/\.(mjs|css|cjs)$/.test(name)||['build.cjs','verify.cjs','test.mjs'].includes(name))continue;put(__dirname+'/'+name,read(r04+'/'+name).replaceAll('human-integrated-r04','skin-dna-r01'));}
 let ear=read(__dirname+'/EarLatest.mjs');ear=once(ear,'[v.foldLights.key,v.foldLights.fill,v.earLight].map','(v.skinDNALights||[v.foldLights.key,v.foldLights.fill,v.earLight]).map');ear=once(ear,"const supported=v.model.foldProfile.settings.light!=='original';","const supported=!!v.skinDNALights||v.model.foldProfile.settings.light!=='original';");put(__dirname+'/EarLatest.mjs',ear);
 // Normalize the store adapter before bundling; retained as readable authored
 // runtime in the build commit, not an opaque patch of minified application.
 put(__dirname+'/SkinDNA.mjs',read(__dirname+'/SkinDNA.mjs').replaceAll('store.set(','store.import('));
 const eb='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/2a17b4ae0113b087b940adddedd1476fd5ce8003/lighting/eb1/';
 for(const [remote,local]of [['eb1.js','EB1.js'],['THIRD_PARTY_NOTICES.md','EB1-NOTICES.md'],['POLICY.md','EB1-POLICY.md']]){const p=__dirname+'/'+local;if(!fs.existsSync(p)){const b=cp.execFileSync('curl',['--fail','--silent','--show-error','--location','--retry','3',eb+remote]);put(p,b);}}
 assert.equal(hash(fs.readFileSync(__dirname+'/EB1.js')),'929945387f6371b1c74848f342b74fd493992fa5fe91e6543252b18cf18f70f7');
 let core=read(r03+'/build-core.cjs');assert.equal(hash(core),'562658d0ae6f73e35756e003621b9872db5e32f3f6c462a6cab7b838fe2a90c5');
 core=core.replaceAll('human-integrated-r03','skin-dna-r01').replaceAll('HUMAN-INTEGRATED-R03','SKIN-DNA-R01');
 core=once(core,'app=`import {installAnatomy}',"app=`import '../../skin-dna-r01/Startup.mjs';\nimport {installSkinDNAState,mountSkinDNA} from '../../skin-dna-r01/SkinDNA.mjs';\nimport {installAnatomy}");
 const entry="patch('installAnatomy(model);if(!savedArchive)','installAnatomy(model);installSkinDNAState(model);if(!savedArchive)');\npatch('mountUnifiedUI({model,viewer,controller});wasLoaded=true;','mountUnifiedUI({model,viewer,controller});mountSkinDNA({model,viewer,controller});wasLoaded=true;');\npatch('function release(){','function release(){controller?.model.skinDNA?.disposeUI?.();');\npatch('faceIdentity:appearance.faceIdentity,naturalEyes:','skinDNA:appearance.skinDNA,faceIdentity:appearance.faceIdentity,naturalEyes:');\n";
 core=once(core,'const folders=',entry+'const folders=');
 core=once(core,'const route=p=>{',"const route=p=>{if(p.endsWith('/full/ui/load-common.mjs'))return __dirname+'/FastLoadCommon.mjs';if(p.endsWith('/ear-continuity-r06/ContinuityMaterial.mjs'))return __dirname+'/ContinuityMaterial.adapted.mjs';");
 core=once(core,"'ear-tissue-r05'];","'ear-tissue-r05','ear-continuity-r06'];");
 const inject="s=require(__dirname+'/compatibility.cjs').adapt(s,rel,adapters);if(rel.endsWith('/lip-structure/LipViewer.mjs'))once('this.lipSurfaces=new Map();this.update();','this.lipSurfaces=new Map();this.startupRenderable=true;this.update();');if(require('fs').existsSync(__dirname+'/eye-adapter.cjs'))s=require(__dirname+'/eye-adapter.cjs').adapt(s,rel,adapters);\n";
 core=once(core,"if(s.includes('import.meta.url'))",inject+"if(s.includes('import.meta.url'))");
 core=once(core,"__dirname+'/layout.css'];","__dirname+'/layout.css',__dirname+'/skin-dna.css'];");
 put(__dirname+'/.build-runtime.cjs',core);cp.execFileSync(process.execPath,[__dirname+'/.build-runtime.cjs'],{stdio:'inherit'});fs.unlinkSync(__dirname+'/.build-runtime.cjs');
 let html=read(__dirname+'/preview.html').replace(/<title>[^<]*<\/title>/,'<title>SKIN DNA R01 · 六种肤质 · 总人物独立副本</title>').replace('R03 · 耳 R05 / 唇 ET19 / 面部分区与曲面毛孔','SKIN DNA R01 · 同一人物 / 六种皮肤 / 可复现配方');
 put(__dirname+'/preview.html',html);put(__dirname+'/baseline-r04.html',fs.readFileSync(r04+'/preview.html'));
 const b=JSON.parse(read(__dirname+'/BUILD.json'));Object.assign(b,{version:'SKIN-DNA-R01',host:'HUMAN-INTEGRATED-R04',hostCommit:'4d2787db762fc3e72e4595827865f579026c2ad4',hostBuild:'e5df3bcba13ba566d6da27d5cb051e91956055b3',earSource:'38a8a2140b42561eecbd31af5df074e9210d0c64',lipSource:'5b4997e6dca27106533022b4ab46164cea073818',lipTransportSource:'d6810d865fb7c06996b75ea7f0272c24304bf297',previewBytes:Buffer.byteLength(html),previewSHA256:hash(html),modelBytes:84045179,presets:6,oldFilesUnmodified:true,eb1SHA256:hash(read(__dirname+'/EB1.js')),userVisualAccepted:false,limitations:['RGB absorption is an artistic physiological surrogate, not spectral tissue transport','Retained surface candidates are seed-filtered and resized, not a newly measured follicle field','Real screen-space face diffusion is optional and adds multiple passes; no full-body volume SSS','No vellus hair simulation, measured physiology or all-36-person certification','Native eyelid/lip/ear geometry limitations are inherited','84 MB original native resources on first uncached load; no offline or physical-phone claim']});
 for(const [name,h]of Object.entries(original))assert.equal(hash(fs.readFileSync(r04+'/'+name)),h,'Original R04 changed: '+name);
 put(__dirname+'/BUILD.json',JSON.stringify(b,null,2)+'\n');put(__dirname+'/BASELINE_PRESERVATION.json',JSON.stringify(original,null,2));console.log('SKIN BUILD',b.previewBytes,b.previewSHA256);
})().catch(e=>{console.error(e);process.exit(1);});
