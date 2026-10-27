'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const modelRoot=path.resolve(process.argv[2]||path.join(__dirname,'..')),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'a4-r30-status-'));
try{
 require('./capture-current')(modelRoot,tmp);
 const run=cp.spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'replay-status.py')],{env:{...process.env,CURRENT_AUDIT_OUTPUT:tmp,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'});
 if(run.error)throw run.error;
 if(run.stdout)process.stdout.write(run.stdout);if(run.stderr)process.stderr.write(run.stderr);
 if(run.status!==0)process.exitCode=run.status||1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
