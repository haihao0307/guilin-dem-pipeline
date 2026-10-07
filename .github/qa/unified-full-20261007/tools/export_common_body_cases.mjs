import fs from'node:fs';import crypto from'node:crypto';import{createCommon}from'../create-common.mjs';import{defaultState}from'../src/State.mjs';
const m=createCommon({bodyDriver:true}),dir=new URL('../research/common-body-cases/',import.meta.url),cases=[];fs.mkdirSync(dir,{recursive:true});
function add(name,s){const p=m.compute(s).slice();fs.writeFileSync(new URL(name+'.f32',dir),new Uint8Array(p.buffer));cases.push({name,state:structuredClone(s),sha256:crypto.createHash('sha256').update(p).digest('hex')});}
add('neutral',defaultState());for(const owner of['anny','mhr']){
 let s=defaultState();s.owners.rig=owner;s.mhr.identity[0]=.6;s.mhr.identity[7]=-.25;add(owner+'-shared-identity',s);
 s=defaultState();s.owners.rig=owner;s.anny.pose['upperarm01.L']=[15,10,-20];s.anny.pose['lowerarm01.L']=[0,0,-50];s.mhr.pose[44]=.4;s.mhr.pose[45]=.3;s.mhr.pose[46]=1;add(owner+'-shoulder-elbow',s);
 s.anny.pose.root=[8,5,12];s.mhr.pose[3]=.12;s.mhr.pose[4]=.18;s.mhr.pose[5]=-.08;s.gnm.rotation[1]=.2;s.gnm.rotation[4]=-.1;s.gnm.expression[200]=.7;s.gnm.identity[0]=.4;add(owner+'-combined',s);
 s=defaultState();s.owners.rig=owner;s.owners.headRig='body';s.anny.pose.neck02=[15,12,5];s.anny.pose.head=[5,-10,5];s.mhr.pose[24]=.18;s.mhr.pose[27]=-.12;add(owner+'-body-head-rig',s);
}
for(const[name,age]of[['newborn',-1/3],['baby',0],['old',1]]){const s=defaultState();s.anny.phenotypes.age=age;s.gnm.rotation[1]=.12;add(name+'-head-turn',s);}
for(const row of cases){const actual=crypto.createHash('sha256').update(m.compute(row.state)).digest('hex');if(actual!==row.sha256)throw Error('Mutable case input or stale golden: '+row.name);}
fs.writeFileSync(new URL('manifest.json',dir),JSON.stringify({fingerprint:m.adapterFingerprint,topology:m.canonical.topologySha256,cases,coverage:m.coverage},null,2));console.log({bodyDriverCases:cases.length,fingerprint:m.adapterFingerprint});
