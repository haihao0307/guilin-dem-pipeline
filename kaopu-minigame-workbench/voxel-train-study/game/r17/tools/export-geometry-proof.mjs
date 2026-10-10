// Local QA only. Temporary evaluated geometry is never part of the game payload.
import * as THREE from '../../../vendor/three.module.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {build,dispose} from '../street/instrument.mjs';
import {createGameTrain} from '../train-model.mjs';
const score=JSON.parse(readFileSync(new URL('../street/first-street.score.json',import.meta.url))),h=build(score),scene=new THREE.Group();h.root.position.set(-3,.0805,0);scene.add(h.root);const train=createGameTrain();scene.add(train.root);scene.updateMatrixWorld(true);
const batches=[],pos=new THREE.Vector3(),im=new THREE.Matrix4(),wm=new THREE.Matrix4();
scene.traverse(o=>{if(!o.isMesh||!o.visible)return;const g=o.geometry,a=g.attributes.position,ix=g.index?.array,count=o.isInstancedMesh?o.count:1,p=[],faces=[],colors=[];
 for(let n=0;n<count;n++){if(o.isInstancedMesh){o.getMatrixAt(n,im);wm.multiplyMatrices(o.matrixWorld,im);}else wm.copy(o.matrixWorld);const base=p.length/3;for(let i=0;i<a.count;i++){pos.fromBufferAttribute(a,i).applyMatrix4(wm);p.push(pos.x,-pos.z,pos.y);if(g.attributes.color){const c=g.attributes.color;colors.push(c.getX(i),c.getY(i),c.getZ(i),1);}}for(let i=0;i<(ix?.length??a.count);i+=3)faces.push([base+(ix?ix[i]:i),base+(ix?ix[i+1]:i+1),base+(ix?ix[i+2]:i+2)]);}
 const m=Array.isArray(o.material)?o.material[0]:o.material;batches.push({name:o.name,positions:p,faces,colors,color:m?.color?.toArray()??[.4,.4,.4],roughness:m?.roughness??.8,metalness:m?.metalness??0,emissive:m?.emissive?.toArray()??[0,0,0],emissiveIntensity:m?.emissiveIntensity??0});});
writeFileSync(process.argv[2]??'/tmp/r16-evaluated-geometry-proof.json',JSON.stringify({kind:'offline geometry QA; Blender materials approximate base color only, not KST1 shader validation',batches}));console.log(batches.length+' evaluated batches');dispose(h);
