// Original function-built interpretations of the supplied Kowloon/Fanling boards.
// Yau Ma Ti installation is a game design, not claimed to match an archival view.
import * as THREE from '../../vendor/three.module.js';
import {createWordFactory} from './street/glyphs.mjs';
import {Blocks} from './heritage.mjs';
export const STATION_NAMES=Object.freeze({0:{chinese:'九龍',english:'KOWLOON',mount:'white-post-black-foot',width:4.31,height:.94},1:{chinese:'油麻地',english:'YAU MA TI',mount:'suspended-enamel',width:4.31,height:.82}});
export function createStationNameboard(plan,{position=[-14.6,2.55,5.405]}={}){
 const spec=STATION_NAMES[plan.index];if(!spec)throw Error('R20 nameboard only covers the two authored stations');
 const group=new THREE.Group();group.name='Function-built bilingual station nameboard';group.position.fromArray(position);
 const ink=new Blocks(),boards=new Blocks(),words=createWordFactory(THREE),temporary=new THREE.MeshBasicMaterial(),point=new THREE.Vector3(),normal=new THREE.Vector3(),nm=new THREE.Matrix3();
 function appendWord(text,style,cx,cy,maxWidth,height,face){
  const word=words.makeWord(text,{style,height,depth:0,curveSegments:3,material:temporary});const natural=word.userData.sign.width,scale=Math.min(1,maxWidth/natural);word.scale.x*=scale;word.scale.y*=scale;word.position.set(cx,cy,face*.061);if(face<0)word.rotation.y=Math.PI;word.updateMatrixWorld(true);
  word.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,base=ink.p.length/3,c=new THREE.Color(0x252a23);nm.getNormalMatrix(o.matrixWorld);for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();ink.p.push(point.x,point.y,point.z);ink.n.push(normal.x,normal.y,normal.z);ink.c.push(c.r,c.g,c.b);}for(const i of g.index.array)ink.i.push(base+i);});
 }
 boards.box(0,0,0,spec.width,spec.height,.11,0xd3ceba);
 for(const face of [1,-1]){
  for(const y of [-spec.height/2+.025,spec.height/2-.025])boards.box(0,y,face*.075,spec.width+.04,.054,.060,0xe1dac3);
  for(const x of [-spec.width/2+.025,spec.width/2-.025])boards.box(x,0,face*.075,.055,spec.height,.060,0xe1dac3);
  appendWord(spec.chinese,'serif',face*-1.32,-.205,1.15,.39,face);
  appendWord(spec.english,'sans',face*.61,-.225,2.48,.46,face);
 }
 if(plan.index===0)for(const x of [-2.05,2.05]){boards.box(x,.49,0,.20,.25,.18,0xd3ceba);boards.box(x,.65,0,.13,.09,.20,0xd3ceba);}
 for(const [batch,name] of [[boards,'capped-white-nameboard'],[ink,'native-bilingual-lettering']]){const geometry=batch.geometry(),material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0});const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 words.dispose();temporary.dispose();group.userData.nameboard={...spec,source:'native curves and box functions; no image texture',historicalReconstruction:false,faces:2,chineseOccurrencesPerFace:1,englishOccurrencesPerFace:1};return group;
}
