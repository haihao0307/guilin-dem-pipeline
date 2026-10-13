const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
// Explicit composition adapter; frozen donor source copies remain byte-identical.
let source=fs.readFileSync(__dirname+'/build-core.cjs','utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'562658d0ae6f73e35756e003621b9872db5e32f3f6c462a6cab7b838fe2a90c5');
const at="if(s.includes('import.meta.url'))";assert.equal(source.split(at).length,2);
source=source.replace(at,()=>`if(rel.endsWith('/ear-root-r04/EarMaterial.mjs')){
 const from="'*csCover*uIEnabled*iInside*(1.-lpMask);'",to="'*csCover*uIEnabled*iInside;'";
 assert.equal(s.split(from).length,2,'Ear/ET19 identity-mask composition drift');
 s=s.replace(from,to);adapters.push({path:rel,anchor:'ET19 identity mask has no earlier R03 lip exclusion; apply combined lip + ear exclusion here'});
}
`+at);
new Function('require','__dirname','process',source)(require,__dirname,process);
