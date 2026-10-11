import {SKIN_TYPES} from './ET14_WrinkleSkinEvolution.mjs';

export function assignSkinByCharacter(character){
 const age=character.ageClass||0;
 const outdoor=character.environment==='outdoor';
 const labor=character.work==='physical';
 let profile='natural';
 if(age<.25) profile='youthful';
 if(age>.65) profile='mature';
 if(outdoor) profile='weathered';
 if(labor) profile='dry';
 if(character.style==='luxury') profile='porcelain';
 if(character.oily) profile='oily';
 return {
  profile,
  parameters:{...SKIN_TYPES[profile]},
  source:'ET14 automatic identity assignment',
  manualOverride:true
 };
}
