import {loadLocal} from '../../full/boxing/tests/load-model.mjs';
import {PRESETS,createPresetState} from '../../full/ui/PresetCatalogueR2.mjs';
import {AnimatedHuman} from '../../full/boxing/AnimatedHuman.mjs';
import {createBoxingRig,recommendPairSeparation} from '../../full/boxing/Motion.mjs';
import {createGlovePair} from '../../full/boxing-r02/Gloves.mjs';
import * as THREE from '../../full/source/registration-vendor/three.module.js';
import {AnnyProxyAdapter} from '../AnnyProxyAdapter.mjs';
import {CollisionWorld} from '../CollisionWorld.mjs';
const {model,defaultState}=await loadLocal({allowNetwork:false}),actors=[],pairIndex=8,root=new THREE.Group();root.position.set(3,1,-5);
for(let f=0;f<2;f++){const preset=PRESETS[pairIndex*2+f],state=createPresetState(preset.id,defaultState);model.compute(state);const human=new AnimatedHuman(model,state),motion=createBoxingRig({names:human.rig.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height}),group=new THREE.Group();group.rotation.y=f?-Math.PI/2:Math.PI/2;group.position.y=human.floorOffset;root.add(group);const gloves=createGlovePair({names:human.names,height:human.height});gloves.forEach(g=>group.add(g));actors.push({human,motion,group,gloves,preset,latest:null});}
const world=await CollisionWorld.create(),adapter=await AnnyProxyAdapter.create(actors);
function pose(t,d){for(let f=0;f<2;f++){const a=actors[f];a.group.position.x=(f?1:-1)*d/2;a.latest=a.motion.evaluate(t,{pairIndex,fighter:f,opponentStature:actors[f^1].human.height});for(const g of a.gloves)g.updateFromPose(a.latest.posedMatrices,a.human.height);}root.updateMatrixWorld(true);}
const cases=[];
for(const reduction of [0,.15]){world.reset();adapter.reset();let events=[];for(let i=0;i<1440;i++){pose(i/120,recommendPairSeparation(pairIndex)-reduction);const s=adapter.sample();if(s)events.push(...world.step({time:i/120,dt:1/120,...s}));}cases.push({reduction,hits:events.length,events});}
if(cases[0].hits!==0||cases[1].hits<1)throw Error('The safe/contact geometric controls failed');
console.log(JSON.stringify({passed:true,model:'full canonical Anny + GNM',coordinates:'Y-up world; ring translation (3,1,-5)',shapeFingerprints:adapter.shapeFingerprints,fits:adapter.fits,cases},null,2));world.dispose();
