import{applyBureauGroundClearance}from'./host-ground-clearance.mjs';
import {SCENE} from './source/domain.mjs';
import {VIEWS} from './source/renderer.mjs';
export const BUREAU_SITING=Object.freeze({schema:'kaopu.fh88.bureau-siting/1',units:'metres',stationIndex:1,stationNames:['油麻地','Yaumati'],offsetFromStop:[-5,.333,-66],uniformScale:1,frontLocal:[-1,0,0],frontWorld:[-1,0,0],railDirectionWorld:[1,0,0],railwardWorld:[0,0,1],primaryEntranceLocal:[-42.6,0,-18],warehouseAreaM2:SCENE.clearWarehouse.area,modelSourceCommit:'c38e0018aaa58c280ded445acf6485404301ff65',construction:'existing complete R03e functions, including both arcades, racks, conveyors, rear boiler and tapered chimney',state:'layout inspection; no baggage-delivery scenario started'});
const vector=(p,n)=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Invalid '+n);return p;};
export function createBureauBinding(){
 function frame(view,route){
  if(!Number.isFinite(view.distance)||!Number.isFinite(view.tick)||!Number.isFinite(view.elapsed))throw Error('Authoritative Session frame required');
  const plan=route.find(s=>s.index===BUREAU_SITING.stationIndex);
  if(!plan||!Number.isFinite(plan.target)||!(plan.name==='油麻地'||plan.english==='Yaumati'))throw Error('Verified Yaumati route stop absent');
  const origin=BUREAU_SITING.offsetFromStop.map((n,i)=>n+(i===0?plan.target-view.distance:0));
  const toWorld=p=>vector(p,'local point').map((n,i)=>n+origin[i]);
  const toLocal=p=>vector(p,'world point').map((n,i)=>n-origin[i]);
  const record=Object.freeze({tick:view.tick,simulationSeconds:view.elapsed,timetableMinutes:view.timetable?.minutes??387,paused:!!view.paused,stationIndex:plan.index,stationTargetM:plan.target,distanceM:view.distance,origin:Object.freeze(origin),wet:!!plan.wet,materialAge:.74,uniformScale:1,warehouseAreaM2:4500});
  return{record,toWorld,toLocal,worldDirectionToLocal:p=>vector(p,'world direction').slice(),localDirectionToWorld:p=>vector(p,'local direction').slice()};
 }
 return Object.freeze({frame,construction:BUREAU_SITING});
}
export function bureauView(name,view,route){const frame=createBureauBinding().frame(view,route),v=name==='context'?{eye:[95,65,155],target:[0,7,15],cut:0}:VIEWS[name];if(!v)throw Error('Unknown bureau view '+name);return{eye:frame.toWorld(v.eye),target:frame.toWorld(v.target),cut:v.cut,projection:'perspective',stationIndex:1};}
export function bureauExclusion(view,route){const o=createBureauBinding().frame(view,route).record.origin;return{minX:o[0]-90,maxX:o[0]+90,minZ:o[2]-75,maxZ:o[2]+75,reason:'complete existing bureau site, retained original field'};}
export function applyBureauSiteExclusion(world,getView,getRoute){const street=world.streetDistrict;if(!street)throw Error('Host street district missing');const original=street.exclusions.bind(street);street.exclusions=distance=>[...original(distance),bureauExclusion({...getView(),distance},getRoute())];const groundClearance=applyBureauGroundClearance(world,getView,getRoute,bureauExclusion);return{...BUREAU_SITING,groundClearance};}
export function requireSharedFrame({camera,frame,light,backend}){if(!camera?.isPerspectiveCamera||backend!=='webgl2-function')throw Error('Bureau requires actual host PerspectiveCamera and WebGL2 function bridge');return{backend,projection:Array.from(camera.projectionMatrix.elements),cameraToWorld:Array.from(camera.matrixWorld.elements),state:frame.record,light:{...light,direction:light.direction.slice()},depthConvention:'actual primary hit OpenGL gl_FragDepth',appearanceTextures:0,bureauSurfaceMeshes:0,source:'complete original R03e geometry/material functions compiled by pinned Naga; no standalone scene screenshot'};}
