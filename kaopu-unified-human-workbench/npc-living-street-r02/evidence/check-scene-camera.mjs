/** Actual courtyard mesh raycasts only. No browser/render acceptance. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {createCourtyard} from '../src/Courtyard.mjs';
import {createSceneCamera} from '../src/SceneCamera.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
const require=createRequire(import.meta.url),THREE=await require('../build.cjs').loadNativeThreeForQA();
const heights={A:1.9273384809494019,B:1.6332803964614868,C:1.8001427054405212,D:1.5038026571273804,E:1.806150197982788,F:1.6567941308021545};
const courtyard=createCourtyard(THREE),camera=new THREE.PerspectiveCamera(38,1.5,.05,100),target=new THREE.Vector3();
const orbit={target,update(){camera.lookAt(target);camera.updateMatrixWorld(true);}};
const control=createSceneCamera({THREE,viewer:{camera,orbit},street:courtyard.group,actors:Object.entries(heights).map(([id,heightM])=>({id,measurements:{heightM}}))});
const rows=[],failures=[];
const inputs=[...STREET_LAYOUT.actorStarts.map(s=>({...s,location:'startup'}))];
for(const id of Object.keys(heights))for(const location of ['bakery','windowA','shelter'+id]){
  const spot=STREET_LAYOUT.spots[location];inputs.push({id,x:spot.stand[0],z:spot.stand[2],yaw:spot.yaw,location});
}
for(const state of inputs){
  const start=performance.now(),report=control.place(state,{mode:'follow',force:true});
  const row={location:state.location,...report,elapsedMS:performance.now()-start};rows.push(row);
  if(report.candidates!==48||report.probes!==6||report.occludedProbes!==0)failures.push(row);
}
const sourceFiles=Object.fromEntries(['src/SceneCamera.mjs','src/Courtyard.mjs','src/WorldLayout.mjs','evidence/check-scene-camera.mjs'].map(path=>{const bytes=fs.readFileSync(new URL('../'+path,import.meta.url));return[path,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}];}));
const report={schema:'actual-street-camera-mesh-raycasts/1',passed:failures.length===0,rendered:false,visualAcceptance:false,release:false,scope:'Original courtyard mesh geometry and native Three raycaster. Six measured source heights at actual startup, bakery, window and shelter coordinates. No character skin, browser, material, or screenshot acceptance.',sourceFiles,rows,failures};
fs.writeFileSync(new URL('./SCENE_CAMERA_GEOMETRY.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,rows:rows.map(x=>({actor:x.actor,location:x.location,occluded:x.occludedProbes,elapsedMS:x.elapsedMS})),failures}));
if(failures.length)process.exitCode=1;
