// Public, versioned animal instrument. Anatomy supplies continuous surfaces;
// this module finishes anatomical proportions and materials before publication.
// No interface, reference image, camera, example score or final mesh is stored here.
import * as Anatomy from './anatomy.js';
export const THREE=Anatomy.THREE;
export const VERSION='K3.0.1';
export const SCHEMA=Anatomy.SCHEMA;
export const parseScore=Anatomy.parseScore;
export const dispose=Anatomy.dispose;
export const measure=Anatomy.measure;
export const snapshot=Anatomy.snapshot;
export const fingerprint=Anatomy.fingerprint;

function scaleAroundCenter(g,x,y,z){
 g.computeBoundingBox();const c=g.boundingBox.getCenter(new THREE.Vector3());
 g.translate(-c.x,-c.y,-c.z);g.scale(x,y,z);g.translate(c.x,c.y,c.z);
 g.computeBoundingBox();g.computeBoundingSphere();
}
function orientEagleHead(g){
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),u=THREE.MathUtils.clamp((y-.945)/.10,0,1),w=u*u*(3-2*u),angle=-.46*w;
  const x=p.getX(i),z=p.getZ(i)-.08;
  p.setXYZ(i,x*Math.cos(angle)+z*Math.sin(angle),y-.025*w,-x*Math.sin(angle)+z*Math.cos(angle)+.08);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
}
function finishBody(root,spec){
 if(spec.kind==='B'){
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(o.name==='nasal-pad'){scaleAroundCenter(o.geometry,1,.77,.64);o.material.roughness=.72;}
   if(o.name==='rounded-pinna')scaleAroundCenter(o.geometry,.82,.66,1);
   if(o.name==='ear-cavity')scaleAroundCenter(o.geometry,.82,.63,1);
   if(o.name==='claw'){scaleAroundCenter(o.geometry,.82,.68,.67);o.material.roughness=.62;}
   if(o.name==='seeded-groomed-fur'){
    // Tiny shadow-map samples produced a misleading dark speckle field.
    // Keep real groomed geometry, but let the continuous body cast the shadow.
    o.castShadow=false;o.receiveShadow=true;o.material.roughness=1;
    const col=o.geometry.attributes.color,base=new THREE.Color(spec.colors[0]);
    for(let i=0;i<col.count;i++)col.setXYZ(i,base.r*.90+col.getX(i)*.10,base.g*.90+col.getY(i)*.10,base.b*.90+col.getZ(i)*.10);
    col.needsUpdate=true;
   }
  });
 }
 if(spec.kind==='E'){
  const headNames=new Set(['continuous-avian-trunk','body-coverts','hooked-upper-beak','lower-mandible','eye-socket','iris','pupil','brow','beak-nares']);
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(headNames.has(o.name))orientEagleHead(o.geometry);
   if(o.name==='twelve-tail-vanes'){o.geometry.scale(1.7,1,1);o.geometry.computeBoundingBox();}
  });
 }
 if(spec.kind==='T'){
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(o.name==='keratin-leg-scales'){
    // An instance color already contains the skin color. Multiplying it by
    // the same base color darkened it twice and made false leopard-like spots.
    o.material.color.set('#ffffff');o.material.roughness=.97;
    const base=new THREE.Color(spec.colors[1]);
    for(let i=0;i<o.count;i++){
     const c=new THREE.Color();o.getColorAt(i,c);c.lerp(base,.82);o.setColorAt(i,c);
    }
    o.instanceColor.needsUpdate=true;
   }
  });
 }
 root.updateMatrixWorld(true);
 if(spec.kind==='B'||spec.kind==='E'){
  const box=new THREE.Box3().setFromObject(root),axis=spec.kind==='B'?'z':'x';
  root.scale.multiplyScalar(spec.p[0]/(box.max[axis]-box.min[axis]));
 }
 root.userData.version=VERSION;root.updateMatrixWorld(true);
}
export function buildScore(text){
 const spec=parseScore(text),start=performance.now(),result=Anatomy.buildScore(text);
 try{finishBody(result.root,spec);result.buildMs=performance.now()-start;return result;}
 catch(e){dispose(result.root);throw e;}
}
export function verifyReplay(result){
 const second=buildScore(result.score);
 try{const a=snapshot(result.root),b=snapshot(second.root);if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
 finally{dispose(second.root);}
}
