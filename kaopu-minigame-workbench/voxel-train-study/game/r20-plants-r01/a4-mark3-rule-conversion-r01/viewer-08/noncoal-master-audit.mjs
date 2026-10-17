import * as T from 'three';
import {RoomEnvironment} from '../../a4-a6-source-comparison-r03/vendor/RoomEnvironment.mjs';
import {applyAcceptanceCamera,projectedExtents} from '../../a4-a6-source-comparison-r03/src/orthographic-acceptance.mjs';
import {loadNonCoalBrowserModel} from '../research-a6-noncoal-08/browser-audit.mjs';
import {getBytes} from './transport.mjs';
import {sha256} from '../checkpoint-08-candidate/src/exact-decoder.mjs';
export async function runNoncoalMasterAudit(){
 const base=new URL('../master-materials-noncoal-r02/',import.meta.url),lockBytes=await getBytes(new URL('runtime-lock.json',base));
 if(await sha256(lockBytes)!=='58c294053d5399ebfa79d92b6dbd8ca6060719de68dc2ae97570472bd4db1d4b')throw Error('NONCOAL_MASTER_LOCK_MISMATCH');
 const lock=JSON.parse(new TextDecoder().decode(lockBytes));for(const f of lock.files){const b=await getBytes(new URL(f.path,base));if(b.length!==f.bytes||await sha256(b)!==f.sha256)throw Error('NONCOAL_MASTER_FILE_MISMATCH '+f.path);}
 const {installTrainMaster}=await import('../master-materials-noncoal-r02/train-binding.mjs');
 const source=await loadNonCoalBrowserModel();source.key='a4';source.projection=source.manifest.projection;source.root.updateMatrixWorld(true);
 const inv=source.root.matrixWorld.clone().invert();source.materialRestMatrices=new WeakMap();source.root.traverse(o=>{if(o.isMesh)source.materialRestMatrices.set(o,new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));});
 const meshes=[];source.root.traverse(o=>{if(o.isMesh)meshes.push({o,geometry:o.geometry,material:o.material,world:o.matrixWorld.elements.slice()});});
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,420);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;const errors=[];renderer.debug.onShaderError=(gl,p)=>errors.push(gl.getProgramInfoLog(p));
 const scene=new T.Scene();scene.background=new T.Color('#e9e6dd');scene.add(source.root,new T.HemisphereLight(0xffffff,0x656b62,1.2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,15);scene.add(sun);const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04).texture;scene.environment=env;room.dispose();pmrem.dispose();
 const box=new T.Box3().setFromObject(source.root,true),size=box.getSize(new T.Vector3()),extent=projectedExtents(size,'side'),scale=Math.max(extent.width/1200,extent.height/420)*1.12,camera=new T.OrthographicCamera();applyAcceptanceCamera(T,camera,{view:'side',center:box.getCenter(new T.Vector3()),worldUnitsPerPixel:scale,width:1200,height:420});
 const draw=()=>{renderer.render(scene,camera);renderer.getContext().finish();return renderer.domElement.toDataURL('image/png');};
 const original=draw(),binding=await installTrainMaster(T,source);binding.switchMode('master-upgrade');const started=performance.now(),candidate=draw(),completedFrameMs=performance.now()-started,changed=meshes.filter(x=>x.o.material!==x.material).length;
 if(changed!==75)throw Error('Expected75 noncoal original-identity bindings, got '+changed);
 if(!meshes.every(x=>x.o.geometry===x.geometry&&x.world.every((n,i)=>n===x.o.matrixWorld.elements[i])))throw Error('Noncoal master changed geometry/placement');
 binding.switchMode('source-exact');if(!meshes.every(x=>x.o.material===x.material))throw Error('Noncoal original material identities not restored');const restored=draw();if(original!==restored)throw Error('Restored noncoal raster differs');if(errors.length||renderer.getContext().isContextLost())throw Error('Noncoal shader/context failure '+errors.join('\n'));
 const report={passed:true,changed,retained:meshes.length-changed,projectionReport:binding.projectionReport,errors,sourceRestoredPixelExact:true,geometryUnchanged:true,sourceUnits:'UNCALIBRATED',microSurfaceVisualAcceptance:false,completedFrameMs,performanceEnvironment:'Chromium SwiftShader only',camera:camera.userData.acceptance,images:{original,candidate}};binding.dispose();renderer.dispose();env.dispose();return report;
}
