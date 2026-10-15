const fs=require('fs'),{PNG}=require('pngjs');
const out=process.env.QA_OUT||'public-evidence',qaPath=out+'/QA.json';
const qa=JSON.parse(fs.readFileSync(qaPath,'utf8')),screens=Object.fromEntries(qa.screens.map(s=>[s.name,s]));
function crop(name){
 const meta=screens[name];if(!meta)throw Error('Missing visibility screenshot '+name);
 const im=PNG.sync.read(fs.readFileSync(out+'/'+name+'.png')),c=meta.crop,data=new Uint8Array(c.w*c.h*3);let k=0;
 for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){const i=((c.y+y)*im.width+c.x+x)*4;data[k++]=im.data[i];data[k++]=im.data[i+1];data[k++]=im.data[i+2];}
 return data;
}
const baseline=crop('macro-r02-baseline');
function delta(name){
 const a=crop(name);if(a.length!==baseline.length)throw Error('Crop size mismatch '+name);
 let sum=0,max=0,changed=0;for(let i=0;i<a.length;i+=3){let p=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-baseline[i+c]);sum+=d;p+=d;if(d>max)max=d;}if(p/3>.5)changed++;}
 return{meanRGB:sum/a.length,maxChannel:max,changedFraction:changed/(a.length/3)};
}
const limits={
 'macro-natural':.045,
 'control-acne':.025,
 'control-healed':.009,
 'control-shave':.025,
 'control-eye':.006,
 'control-scar':.00045,
 'control-asymmetry':.015
};
const results={};let failure=[];
for(const [name,min] of Object.entries(limits)){const m=results[name]=delta(name);m.minimumMeanRGB=min;m.passed=m.meanRGB>=min&&m.maxChannel>=2;if(!m.passed)failure.push(name+' '+JSON.stringify(m));}
qa.visibilityAudit={version:'R03.1',baseline:'macro-r02-baseline',results,passed:!failure.length,meaning:'Same-camera canvas RGB delta only; UI excluded. Thresholds prevent hash-only acceptance of visually negligible controls.'};
fs.writeFileSync(qaPath,JSON.stringify(qa,null,2));
if(failure.length)throw Error('Natural trace visibility floor failed: '+failure.join('; '));
console.log(JSON.stringify(qa.visibilityAudit,null,2));
