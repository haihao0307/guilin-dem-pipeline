const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const manifest=require('./runtime-manifest.json');const results=manifest.files.map(file=>{const data=fs.readFileSync(path.resolve(file.path));const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');return{...file,actualSha:sha,ok:sha===file.sha};});
fs.writeFileSync('driver-runtime-identity.json',JSON.stringify({candidate:manifest.candidate,files:results,allMatched:results.every(x=>x.ok)},null,2));
if(results.some(x=>!x.ok))throw new Error('Runtime bytes differ from the fully grouped candidate');console.log('All '+results.length+' runtime files exactly match '+manifest.candidate);
