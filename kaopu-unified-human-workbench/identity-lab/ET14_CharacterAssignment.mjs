import {createIdentitySkinProfile,SKIN_TYPES} from './ET14_WrinkleSkinEvolution.mjs';

export const ET14_CHARACTER_ASSIGNMENT='ET14-36-AUTO';

// Deterministic assignment. It modifies identity archives,
// not the user-facing sliders directly.
export function assignCharacterIdentity(character){
 const seed=character.id*7919+(character.bodyType||0)*131;
 const skin=createIdentitySkinProfile(seed,{
  height:character.height,
  build:character.build,
  ageClass:character.ageClass
 });
 const profiles=[...Object.keys(SKIN_TYPES)];
 const index=Math.abs(seed)%profiles.length;
 return {
  id:character.id,
  skinType:profiles[index],
  skin,
  facialBias:{
   eye:(seed%5)/10-.2,
   nose:((seed*3)%7)/10-.3,
   mouth:((seed*5)%7)/10-.3,
   brow:((seed*7)%5)/10-.2,
   cheek:((seed*11)%6)/10-.25
  },
  logic:'body-conditioned identity assignment',
  manualOverrideAllowed:true
 };
}

export function generate36IdentityProfiles(characters){
 return characters.map(assignCharacterIdentity);
}
