import {attachAppearanceR22} from './appearance/AppearanceR22.mjs';
export async function mountR30Fixture(a,archive,anchor){
 if(archive.topologySha256!=='e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de'||archive.adapterFingerprint!=='4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5')throw Error('Not the fixed R30 common adapter');
 await a.motion().setMode('shape');a.restore(archive);a.view('face');
 const appearance=await attachAppearanceR22(a,{pigmentScale:.55,browCount:1800});
 const viewer=a.motion().viewer;viewer.restoreCamera(anchor.views.front.camera);viewer.render();
 if(JSON.stringify(a.archive())!==JSON.stringify(archive))throw Error('Fixture mutated native archive');
 return {appearance,viewer,model:a.motion().controller.model,dispose(){appearance.dispose();}};
}
