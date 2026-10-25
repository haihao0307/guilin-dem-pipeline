'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function readWitnessPoints(){
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'WITNESS_MANIFEST.json'))),chunks=manifest.chunks.map(x=>{
  const b=fs.readFileSync(path.join(__dirname,x.file));if(b.length!==x.bytes||hash(b)!==x.sha256)throw Error('Witness chunk mismatch: '+x.file);return b;
 }),raw=Buffer.concat(chunks);if(raw.length!==manifest.bytes||hash(raw)!==manifest.sha256)throw Error('Witness reconstruction mismatch');
 const p=JSON.parse(raw),records=p.rows.map(r=>({kind:p.kinds[r[0]],groups:p.groups[r[1]].map(g=>g.map(i=>p.ids[i])),theta:p.numbers[r[2]],xyz:r[3].map(i=>p.numbers[i]),expectedCategory:p.classifications[r[4]]}));
 if(records.length!==750||records.length!==manifest.records)throw Error('Wrong replay record count');return records;
};
if(require.main===module)console.log(JSON.stringify({verified:true,records:module.exports().length}));
