const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
// Preserve the concurrently saved build core and its exact content anchor.
let source=fs.readFileSync(__dirname+'/build-core.cjs','utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'562658d0ae6f73e35756e003621b9872db5e32f3f6c462a6cab7b838fe2a90c5');
require('node:child_process').execFileSync(process.execPath,[__dirname+'/compatibility.cjs'],{stdio:'inherit'});
const at="if(s.includes('import.meta.url'))";assert.equal(source.split(at).length,2);
source=source.replace(at,()=>"s=require(__dirname+'/compatibility.cjs').adapt(s,rel,adapters);\n"+at);
new Function('require','__dirname','process',source)(require,__dirname,process);
