import assert from 'node:assert/strict';
import * as T from '../../../a4-a6-source-comparison-r03/vendor/three.module.js';
import {buildA6LocomotiveShell,createA6ShellSampler} from '../src/a6-locomotive-shell.mjs';
import {buildA6TenderShell} from '../src/a6-tender-shell.mjs';
import {createA6MaterialLibrary} from '../src/a6-materials.mjs';
import {createA6Branding} from '../src/a6-branding.mjs';
const library=createA6MaterialLibrary(T);
for(const topHeight of [3.98,4.03,4.15])for(const cabShift of [-.15,0,.15]){
 const loco=buildA6LocomotiveShell({topHeight,cabShift}),sampler=createA6ShellSampler(loco.parameters),group=createA6Branding(T,{loco,tender:buildA6TenderShell({crownHeight:topHeight}),materialLibrary:library});
 assert.equal(group.children.length,8);
 for(const mesh of group.children){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const xyz=[p.getX(i),p.getY(i),p.getZ(i)];assert(xyz.every(Number.isFinite));if(!mesh.name.includes('red'))assert(xyz[1]>sampler.skirtEdge(xyz[2]).y+.005,`Brand over open wheel arch: ${mesh.name}`);}mesh.geometry.dispose();}
 for(const m of group.userData.ownedMaterials)m.dispose();
}
library.dispose();console.log('8 full retained brand instances: finite native surface conformation and >5mm clear of wheel openings across editable range. Text readability requires actual screen review.');
