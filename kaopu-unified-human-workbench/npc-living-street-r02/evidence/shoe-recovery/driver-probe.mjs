import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from './native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const actor=actorFor('F'),fit=fitNativeShoeSide(actor,'L'),{foot,field,scaleM}=fit,last=fit.model.last,L=last.L;
const entries=foot.samples.map(row=>{
 const s=(row.f-field.centerF)/(L*scaleM)+.5,x=field.mirror*(row.r-field.centerR)/scaleM,y=(row.p[2]-field.baseZ)/scaleM;
 const q=field.evaluate([last.center(s),last.soleTop(s)+100,L*(s-.5)]),a=q.j[0],cx=last.center(s),uX=cx+(x-cx)/a,t=clamp((s-.28)/(.65-.28)),asym=1+(uX<cx?.028:-.016)*t*t*(3-2*t);
 const xn=clamp((uX-cx)/(last.width(s)*asym),-1,1),theta=Math.asin(xn),collar=last.collarAngle(s),collarX=(last.width(s)*Math.sin(collar)*asym)*a,collarY=last.soleTop(s)+last.height(s)*Math.pow(Math.cos(collar),.72),roof=last.soleTop(s)+last.height(s)*Math.pow(1-xn*xn,.36);
 const skipped=s<.308&&collar>0&&Math.abs(theta)<collar&&y>collarY,w=clamp((roof-last.soleTop(s))/last.style.sole),weight=w*w*(3-2*w),rise=Math.max(0,(y+.0015/scaleM+last.params.thickness-roof)/Math.max(weight,1e-8));
 return{id:row.id,pointNative:row.p,footWeight:row.footWeight,otherWeights:row.outsideFootWeights,s,x,y,theta,collar,collarX,collarY,roof,rise,skipped,aboveAnkleM:row.p[2]-foot.foot[2]};
});
const data={schema:'native-shoe-recovery-height-driver/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,scaleM,baseZ:field.baseZ,foot:{...foot,samples:undefined,allSamples:undefined},drivers:entries.filter(e=>!e.skipped).sort((a,b)=>b.rise-a.rise).slice(0,100),allSizingPoints:entries,model:{width:field.report.widthScale,rise:field.report.roofRiseMm}};
fs.writeFileSync(path.join(globalThis.__SHOE_QA_ROOT__,'evidence/shoe-recovery/F_HEIGHT_DRIVER_FIRST.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({scaleM,baseZ:field.baseZ,footZ:foot.foot[2],drivers:data.drivers.slice(0,12)},null,2));
