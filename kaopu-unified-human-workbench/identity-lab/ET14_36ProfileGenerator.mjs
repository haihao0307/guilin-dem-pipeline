import {assignCharacterIdentity} from './ET14_CharacterAssignment.mjs';
import {LESION_PROFILES,composeLesionIdentity} from './ET14_LesionProfiles.mjs';

export function generate36Profiles(characters){
 return characters.map((character,index)=>{
  const identity=assignCharacterIdentity({...character,id:index+1});
  const lesionNames=Object.keys(LESION_PROFILES);
  const lesion=LESION_PROFILES[index%lesionNames.length];
  return {
   ...identity,
   skinIdentity:composeLesionIdentity(lesion,lesion,index*9173),
   facialVariation:{
    eye:identity.facialBias.eye,
    nose:identity.facialBias.nose,
    mouth:identity.facialBias.mouth,
    brow:identity.facialBias.brow,
    cheek:identity.facialBias.cheek
   },
   autoAssigned:true,
   manualOverride:true
  };
 });
}
