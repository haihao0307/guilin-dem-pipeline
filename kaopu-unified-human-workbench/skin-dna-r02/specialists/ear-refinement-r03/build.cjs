const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
// First bootstrap materializes reviewed deltas as ordinary editable sources.
// Subsequent builds read those sources directly and never overwrite edits.
const seedPath=path.join(__dirname,'SEED.json');
if(fs.existsSync(seedPath)){
 const jobs=JSON.parse(fs.readFileSync(seedPath,'utf8')),staged=[];
 for(const j of jobs){
  assert(/^[A-Za-z0-9_.-]+$/.test(j.to),'Unsafe output name');
  const dest=path.join(__dirname,j.to);if(fs.existsSync(dest))continue;
  assert(/^(ear-growth|lip-structure)\/[A-Za-z0-9_.-]+$/.test(j.from),'Unsafe source');
  let text=fs.readFileSync(path.resolve(__dirname,'..',j.from),'utf8');assert.equal(sha(text),j.sha256,'Frozen source changed: '+j.from);
  for(const [a,b,s]of [...j.edits].reverse())text=text.slice(0,a)+s+text.slice(b);
  assert.equal(sha(text),j.resultSHA256,'Delta checksum mismatch: '+j.to);staged.push([dest,text]);
 }
 for(const [file,text]of staged)fs.writeFileSync(file,text);
 fs.unlinkSync(seedPath);
}
assert(fs.existsSync(path.join(__dirname,'build-runtime.cjs')),'Missing reviewed runtime builder');
require('./build-runtime.cjs');
