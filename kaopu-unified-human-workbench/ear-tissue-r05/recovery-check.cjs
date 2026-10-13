const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const dir=__dirname,repo=path.resolve(dir,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const build='63e5dfddf2b5ca0d686651804beeba3333b2f41e',base='3fd03f72078c309d14882a68217dde49f35eab2c',report={schema:'kaopu/ear-r05-recovery@1',build,base,checks:[],pass:false};
const check=(v,s)=>{assert(v,s);report.checks.push(s)};
try{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'BUILD.json'),'utf8'));
 check(manifest.version==='EAR-R05.0','manifest identifies R05');
 check(sha(fs.readFileSync(path.join(dir,'preview.html')))===manifest.previewSHA256,'repository preview matches frozen manifest');
 check(sha(fs.readFileSync('/tmp/ear-r05-frozen-public.html'))===manifest.previewSHA256,'fresh raw public HTML matches frozen manifest byte for byte');
 for(const source of manifest.sources)check(sha(fs.readFileSync(path.join(repo,source.path)))===source.sha256,'source integrity: '+source.path);
 check(sha(fs.readFileSync(path.join(dir,'LipMaterial.mjs')))===sha(fs.readFileSync(path.join(dir,'../ear-root-r04/LipMaterial.mjs'))),'R04 lip material preserved byte for byte');
 const files=cp.execFileSync('git',['diff','--name-only',base,'HEAD'],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 check(files.every(p=>p.startsWith('kaopu-unified-human-workbench/ear-tissue-r05/')||p==='.github/workflows/ear-r05-tissue.yml'||p==='.github/workflows/ear-r05-recovery.yml'),'changed paths isolated; R04, earlier pages, eyes, lips, rig and body sources untouched');
 report.changedPaths=files;report.previewSHA256=manifest.previewSHA256;report.previewBytes=manifest.previewBytes;
 const browser=JSON.parse(fs.readFileSync('ear-r05-recovery/public/report.json','utf8'));
 check(browser.pass===true,'fresh fixed-public browser tests pass');
 check(browser.url.includes('/'+build+'/kaopu-unified-human-workbench/ear-tissue-r05/preview.html'),'browser tested the exact frozen build, not a branch URL');
 check(browser.errors.length===0&&browser.consoleErrors.length===0&&browser.networkFailures.length===0,'fresh browser has no page, console or network errors');
 check(browser.default.protectedShiftMM===0&&browser.default.protectedNormalDifference===0,'R04 scalp/root displayed positions and normals remain unchanged');
 report.browserAssertions=browser.assertions.length;report.builtSourceVersion=manifest.version;report.browserReadyMS=browser.readyMS;report.createdAt=new Date().toISOString();report.pass=true;
}finally{fs.mkdirSync('ear-r05-recovery',{recursive:true});fs.writeFileSync('ear-r05-recovery/receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
