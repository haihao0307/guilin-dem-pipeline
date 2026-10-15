import fs from 'node:fs';
import path from 'node:path';
import {buildBureau} from '../model.mjs';
import {PALETTE} from '../construction.mjs';
const model=buildBureau(),dest=path.resolve(process.argv[2]||'lost-property-bureau-r03f/architecture-study-r02/evidence');fs.mkdirSync(dest,{recursive:true});
const meshes=model.root.children.filter(o=>o.userData.layer!=='routes').map(o=>({name:o.name,layer:o.userData.layer,material:o.userData.material,color:PALETTE[o.userData.material],positions:Array.from(o.geometry.attributes.position.array)}));
fs.writeFileSync(path.join(dest,'geometry.json'),JSON.stringify({meshes,proof:model.proof}));fs.writeFileSync(path.join(dest,'proof.json'),JSON.stringify(model.proof,null,2));fs.writeFileSync(path.join(dest,'elements.json'),JSON.stringify(model.elements));console.log({meshes:meshes.length,triangles:model.triangles,dest});
