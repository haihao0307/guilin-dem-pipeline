import {initialRecord,validateProfile,seedVector} from './SkinProfile.mjs';
// Bind a stable application character ID to a skin recipe. This is not tied to
// age, ethnicity, a photograph, the current pose, or wall-clock randomness.
export function createForCharacter(characterId,style='silk'){
 if(typeof characterId!=='string'||!characterId.trim()||characterId.length>256)throw Error('人物编号必须为1至256字符');
 let h=2166136261;for(const c of 'skin-dna/1:'+characterId)h=Math.imul(h^c.charCodeAt(0),16777619);
 const seed=(h>>>0)%16777215+1,r=initialRecord(style),p=r.profile;
 const a=seedVector(seed),b=seedVector(seed^713381),u=(a[0]-3)/91-.5,v=(a[1]-7)/87-.5,w=(a[2]-11)/79-.5;
 const clamp=(x,lo=0,hi=1)=>Math.min(hi,Math.max(lo,x));
 r.preset='custom';r.profile=validateProfile({...p,seed,melanin:clamp(p.melanin+u*.045),blood:clamp(p.blood+v*.05),oil:clamp(p.oil+w*.10),hydration:clamp(p.hydration+w*.06),variation:clamp(p.variation+v*.10),pores:clamp(p.pores+u*.12,0,1.5),poreScale:clamp(p.poreScale+((b[0]-3)/91-.5)*.1,.65,1.5)});
 return r;
}
