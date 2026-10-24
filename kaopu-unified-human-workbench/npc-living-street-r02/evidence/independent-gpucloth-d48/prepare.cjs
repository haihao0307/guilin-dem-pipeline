'use strict';
// Package only the isolated diagnostic. No application, solver or workflow edits.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const args=process.argv.slice(2);
let out='/tmp/r02-original-gpucloth-d48-site',fetchLocked=false;
for(let i=0;i<args.length;i++){
  if(args[i]==='--out'&&args[i+1])out=path.resolve(args[++i]);
  else if(args[i]==='--fetch-locked-originals')fetchLocked=true;
  else throw Error('Unknown or incomplete argument '+args[i]);
}
const base=__dirname,project=path.resolve(base,'../..');
const lock=JSON.parse(fs.readFileSync(path.join(base,'SOURCE_LOCK.json')));
function checked(bytes,row){
  if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Locked byte mismatch: '+row.path);
  if(row.gitBlob&&blob(bytes)!==row.gitBlob)throw Error('Locked Git blob mismatch: '+row.path);
  return bytes;
}
async function main(){
  if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Prepared site directory must be empty.');
  if(out===base||out.startsWith(base+path.sep))throw Error('Use a separate temporary output directory.');
  const files=[];
  function put(name,bytes,kind){
    const file=path.resolve(out,name);
    if(!file.startsWith(out+path.sep))throw Error('Unsafe closure path');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    files.push({path:name,bytes:bytes.length,sha256:sha(bytes),kind});
  }
  for(const row of lock.originalFiles){
    const local=path.resolve(project,row.localProjectPath);
    let bytes;
    if(fs.existsSync(local))bytes=fs.readFileSync(local);
    else{
      if(!fetchLocked)throw Error('Missing original '+row.localProjectPath+'; explicit --fetch-locked-originals is required in CI.');
      if(!row.url.startsWith(lock.urlPrefix))throw Error('Original URL outside the fixed source commit.');
      const response=await fetch(row.url,{redirect:'error',signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('Original HTTP '+response.status+' '+row.path);
      bytes=Buffer.from(await response.arrayBuffer());
    }
    put('original/'+row.path,checked(bytes,row),'unchanged-original-source');
  }
  const fixtureBytes=new Map();
  for(const row of lock.fixtureFiles){
    const source=row.localProjectPath?path.resolve(project,row.localProjectPath):path.join(base,row.path);
    const bytes=checked(fs.readFileSync(source),row);
    fixtureBytes.set(row.path,bytes);
    put(row.path,bytes,'frozen-diagnostic-fixture');
  }
  const compressed=fixtureBytes.get('fixture/D-inputs.json.gz');
  const decoded=zlib.gunzipSync(compressed);
  if(decoded.length!==lock.inputJSON.bytes||sha(decoded)!==lock.inputJSON.sha256)throw Error('Decoded D fixture mismatch.');
  const input=JSON.parse(decoded);
  if(input.actorId!=='D'||input.fixedSchedule.frames!==48||input.fixedSchedule.fitFrames!==32||
     input.fixedSchedule.dtSeconds!==1/60||input.fixedSchedule.substepHz!==240||
     input.fixedSchedule.iterations!==16||input.fixedSchedule.guardIterations!==12||
     input.fixedSchedule.strainCeiling!==1.45||input.fixedSchedule.advanceMotion!==false||
     input.body.count!==9253||input.body.faces.length!==55248||input.body.skinMatrices.length!==104)
    throw Error('Frozen input contract changed.');
  const own=['index.html','diagnostic.mjs','audit.mjs','gpu-environment.mjs','probe.html','fixture/native-motion.mjs'];
  for(const name of own)put(name,fs.readFileSync(path.join(base,name)),'independent-diagnostic');
  put('SOURCE_LOCK.json',fs.readFileSync(path.join(base,'SOURCE_LOCK.json')),'source-lock');
  // Source imports remain byte-for-byte intact. The sole import-map override
  // gives CoupledCloth the explicit neutral body fixture API, not another solver.
  const names=new Set(files.map(f=>f.path)),closure=[];
  for(const file of files.filter(f=>f.path.endsWith('.mjs'))){
    const text=fs.readFileSync(path.join(out,file.path),'utf8');
    const imports=[
      ...[...text.matchAll(/(?:import\s*(?:[^'";]*?\sfrom\s*)?|export\s+[^'";]*?\sfrom\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]),
      ...[...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]),
    ];
    for(const specifier of imports){
      if(!specifier.startsWith('.'))throw Error('Unexpected bare/remote import '+specifier+' in '+file.path);
      let resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file.path),specifier));
      if(resolved==='original/native-motion.mjs')resolved='fixture/native-motion.mjs';
      if(!names.has(resolved))throw Error('Source closure missing '+resolved);
      closure.push({importer:file.path,specifier,resolved});
    }
  }
  const build={
    schema:'independent-original-gpucloth-build/1',status:'PREPARED_NOT_EXECUTED',
    sourceHead:process.env.SOURCE_HEAD||process.env.GITHUB_SHA||null,
    sourceLockSHA256:sha(fs.readFileSync(path.join(base,'SOURCE_LOCK.json'))),
    originalGPUUnmodified:true,originalWGSLUnmodified:true,noWasmFallback:true,
    fixtureInputSHA256:lock.inputJSON.sha256,files,importClosure:closure,
    fixtureActorScope:'D canonical 9253 vertices / 18416 triangles; 104 neutral skin matrices; no GNM head collider or display rendering',
    productionCandidate:false,visualAcceptance:false,performanceAcceptance:false,
  };
  fs.writeFileSync(path.join(out,'BUILD.json'),JSON.stringify(build,null,2)+'\n');
  console.log(JSON.stringify({status:build.status,out,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),sourceLockSHA256:build.sourceLockSHA256,sourceHead:build.sourceHead}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
