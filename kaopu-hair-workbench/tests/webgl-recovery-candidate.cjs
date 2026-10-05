const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'qa/gnm-webgl-recovery-candidate'),out=process.env.HAIR_QA_OUT||path.join(root,'qa-webgl-recovery');
(async()=>{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'hair-recovery-candidate-'));
 try{
  const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'webgl-recovery-baseline.json')));
  for(const f of baseline.files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex');if(hash!==f.sha256)throw Error('Production source moved: '+f.path);}
  for(const name of ['gnm-groom-editor','gnm-study'])fs.cpSync(path.join(root,'qa',name),path.join(work,'qa',name),{recursive:true});
  fs.mkdirSync(path.join(work,'tests'));fs.copyFileSync(path.join(__dirname,'webgl-recovery-baseline.json'),path.join(work,'tests/webgl-recovery-baseline.json'));
  for(const f of JSON.parse(fs.readFileSync(path.join(candidate,'manifest.json'))).files){const b=fs.readFileSync(path.join(candidate,f.candidate));if(crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Candidate hash mismatch '+f.target);fs.writeFileSync(path.join(work,f.target),b);}
  const codes=await Promise.all(['gnm-groom-editor','gnm-study'].map(name=>new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[path.join(__dirname,'webgl-recovery-browser.cjs')],{stdio:'inherit',env:{...process.env,HAIR_RECOVERY_ROOT:work,HAIR_RECOVERY_PAGE:name,HAIR_QA_OUT:path.join(out,name)}});child.on('error',reject);child.on('exit',code=>resolve(code));
  })));
  if(codes.some(code=>code!==0))process.exitCode=1;
 }catch(error){console.error(error);process.exitCode=1;}finally{fs.rmSync(work,{recursive:true,force:true});}
})();
