#!/usr/bin/env node
'use strict';
/** Reproducible build-time source cache; never a second Three renderer. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {promisify}=require('node:util'),execFile=promisify(cp.execFile);
const here=__dirname,lock=require('./vendor/three-additions/THREE-SOURCE-LOCK.json');
const root=path.join(here,'vendor/three-additions/three-0.170.0');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function checkCache(){return Object.entries(lock.files).every(([relative,sha])=>{const file=path.join(root,relative);return fs.existsSync(file)&&hash(fs.readFileSync(file))===sha;});}
async function prepareThree({cachedOnly=false,quiet=false}={}){
  if(!checkCache()){
    assert(!cachedOnly,'Official Three source cache missing or changed. Run prepare-three.cjs with network enabled.');
    const {stdout}=await execFile('curl',['--fail','--silent','--show-error','--location','--max-time','120',lock.tarballURL],{encoding:'buffer',maxBuffer:12*1024*1024});
    assert.equal(stdout.length,lock.tarballBytes,'Official Three tarball bytes');
    assert.equal(hash(stdout),lock.tarballSHA256,'Official Three tarball SHA256');
    assert.equal('sha512-'+crypto.createHash('sha512').update(stdout).digest('base64'),lock.tarballIntegrity,'Official npm integrity');
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'npc-r02-three-'));
    try{
      const archive=path.join(temp,'three.tgz');fs.writeFileSync(archive,stdout);
      // Extract only regular source/LICENSE/package files from the verified
      // official package. No installation, lifecycle scripts or network code.
      await execFile('tar',['-xzf',archive,'-C',temp,'package/src','package/LICENSE','package/package.json'],{maxBuffer:1024*1024});
      for(const [relative,sha]of Object.entries(lock.files)){
        assert(!path.isAbsolute(relative)&&!relative.split('/').includes('..'));
        const source=path.join(temp,'package',relative),bytes=fs.readFileSync(source);
        assert.equal(hash(bytes),sha,'Official Three source hash '+relative);
        const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
      }
    }finally{fs.rmSync(temp,{recursive:true,force:true});}
  }
  assert(checkCache(),'Complete official Three source cache integrity');
  const report={version:lock.version,files:Object.keys(lock.files).length,sourceRoot:root,verified:true};
  if(!quiet)console.log('Official Three '+lock.version+' source verified: '+report.files+' files; renderer remains canonical R07.');
  return report;
}
module.exports={prepareThree};
if(require.main===module)prepareThree({cachedOnly:process.argv.includes('--cache-only')}).catch(e=>{console.error(e);process.exitCode=1;});
