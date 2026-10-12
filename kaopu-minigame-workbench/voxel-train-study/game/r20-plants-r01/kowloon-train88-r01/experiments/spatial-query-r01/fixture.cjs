const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function verifyFixture(dir){
 const f=JSON.parse(fs.readFileSync(path.join(dir,'reference-fixture.json'))),manifestBytes=fs.readFileSync(path.join(dir,'generated/manifest.json')),m=JSON.parse(manifestBytes);
 if(hash(manifestBytes)!==f.manifestSHA256||m.originalSourceSHA256!==f.originalSourceSHA256)throw Error('Reference input/source identity changed');
 for(const n of['reference','capacity']){if(hash(fs.readFileSync(path.join(dir,'generated',n+'.wgsl')))!==f.variants[n].wgsl||hash(fs.readFileSync(path.join(dir,'generated',n+'.frag')))!==f.variants[n].glsl)throw Error('Reference shader/adapter changed: '+n);}
 const field=zlib.inflateSync(Buffer.from(f.deflateBase64,'base64'));
 if(hash(field)!==f.fieldSHA256||field.length!==m.points.length*16*4)throw Error('Reference field hash/length changed');
 if(f.age!==.05||f.skipMode!==0||JSON.stringify(f.params)!==JSON.stringify([-20,2.5,4.2,.05,0,0,-1,.43,1,0,0,1.5,0,1,0,0,m.points.length,1,0,0]))throw Error('Reference uniforms changed');
 return{fixture:f,manifest:m,field};
}
function compareFields(a,b,labels){if(a.length!==b.length||a.length!==labels.length*64)throw Error('Wrong field length');let mismatches=0,first=[];for(let i=0;i<labels.length;i++)for(let c=0;c<13;c++){const o=(i*16+c)*4;if(a.readUInt32LE(o)!==b.readUInt32LE(o)){mismatches++;if(first.length<10)first.push({point:i,label:labels[i],channel:c,leftBits:a.readUInt32LE(o),rightBits:b.readUInt32LE(o),left:a.readFloatLE(o),right:b.readFloatLE(o)});}}return{mismatches,first,comparedChannels:13,points:labels.length};}
module.exports={verifyFixture,compareFields,hash};
