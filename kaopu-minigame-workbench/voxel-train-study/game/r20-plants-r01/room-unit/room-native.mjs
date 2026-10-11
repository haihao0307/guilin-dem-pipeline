import {decode,verifyDependencyBytes} from './native-codec/codec.mjs';
import {buildDwellingUnit} from './room-unit.mjs';
export async function loadNativeDwelling(bytes,{THREE,createHostMaterialLibrary,dependencyBytes}={}){
 await verifyDependencyBytes(dependencyBytes);const score=await decode(bytes);
 const room=buildDwellingUnit(score,{THREE,createHostMaterialLibrary});
 room.proof.nativeContainer={format:'SQLite 3',profile:'kaopu.dwelling-unit/0.1-experimental',decoded:true,dependencyPinsVerified:true};return room;
}
