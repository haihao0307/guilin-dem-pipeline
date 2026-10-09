import {createLiveComparisonRound} from '../../motion-architecture/live_program_schedule.mjs';
import {loadMotionInventory} from './loadMotionInventory.mjs';
const SOURCE_PATHS=['./MotionPrograms.mjs','./MotionR03.mjs','./MotionRangeR03.mjs','./NativeRestFingerprint.mjs'];
/** Validate actual source bytes and native rests once per immutable page load.
 * The reviewed schedule's deterministic rotation is cached; no bake is invented.
 */
export async function prepareInventoryGate(actors,{mode='validation',onProgress=()=>{}}={}){
 const base=new URL('./',import.meta.url),bundle=await loadMotionInventory(base,{onProgress});
 const characters=actors.map(a=>({id:a.preset.id,restFingerprint:a.restFingerprint}));
 for(let i=0;i<characters.length;i++){const a=characters[i],b=bundle.characters[i];if(a.id!==b?.id||a.restFingerprint!==b.restFingerprint)throw Error('Actual shape/rest differs from motion QA: '+a.id);}
 const sourceFiles=Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async path=>{const r=await fetch(new URL(path,base));if(!r.ok)throw Error('Motion source unavailable: '+path);return [path,new Uint8Array(await r.arrayBuffer())];})));
 const first=await createLiveComparisonRound(bundle.library,characters,0,{mode,sourceFiles});
 const programs=bundle.library.map(p=>({id:p.programId,semanticMotionId:p.semanticMotionId,qa:new Map(p.numericQA.map(q=>[`${q.binding.characterId}:${q.binding.role}`,q.numericQaFingerprint]))}));
 // No API exposes mutable inventory or source payloads after validation.
 return Object.freeze({diagnostics:()=>({schema:first.schema,validationOnly:first.validationOnly,canPublish:first.canPublish,measuredBindings:bundle.library.reduce((n,p)=>n+p.numericQA.length,0),distinctPrograms:first.distinctSemanticProgramsInInventory,sourceManifest:SOURCE_PATHS,inventoryScope:bundle.index.numericQAScope||'base-choreography-only',neuralInferenceExecuted:false}),
 assertRound(round,comparisonMode,selectedProgramId,resolve){for(let i=0;i<18;i++){const expected=comparisonMode==='same-program'?programs.find(p=>p.id===selectedProgramId):programs[(i+round%18)%18];if(!expected||resolve(i).id!==expected.id)throw Error('Runtime program differs from validated schedule');for(let roleIndex=0;roleIndex<2;roleIndex++){const role=(roleIndex^(Math.floor(round/18)%2))===0?'A':'B';if(!expected.qa.has(`${characters[i*2+roleIndex].id}:${role}`))throw Error('Runtime role lacks measured binding');}}return true;}
 });
}
