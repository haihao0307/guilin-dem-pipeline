const fs=require('fs'),crypto=require('crypto');const root=require('path').resolve(__dirname,'..');const manifest=JSON.parse(fs.readFileSync(require('path').join(root,'qa/gnm-webgl-listener-audit/manifest.json')));for(const [file,hash]of Object.entries(manifest.runtimeSha256)){if(crypto.createHash('sha256').update(fs.readFileSync(require('path').join(root,file))).digest('hex')!==hash)throw Error('Audit runtime pin mismatch '+file);}
const {spawn}=require('child_process'),path=require('path');
Promise.all(['gnm-groom-editor','gnm-study'].map(page=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(__dirname,'webgl-listener-audit.cjs')],{stdio:'inherit',env:{...process.env,HAIR_AUDIT_PAGE:page,HAIR_QA_OUT:path.join(process.env.HAIR_QA_OUT||path.join(__dirname,'../qa-listener-audit'),page)}});
 child.on('error',reject);child.on('exit',code=>resolve(code));
}))).then(codes=>{if(codes.some(x=>x!==0))process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
