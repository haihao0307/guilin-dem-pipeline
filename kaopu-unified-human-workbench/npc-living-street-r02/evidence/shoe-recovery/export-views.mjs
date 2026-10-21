import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {actorFor} from './native-actor.mjs';
import {THREE} from '../../src/NativeBinding.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
const root=globalThis.__SHOE_QA_ROOT__;
for(const id of (process.env.ACTOR_IDS||'A,B,F').split(',')){
 const actor=actorFor(id),garments=[],sideReports={},lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let foot;
 for(const side of ['L','R']){
  const fit=fitNativeShoeSide(actor,side),mirror=side==='L'?-1:1;sideReports[side]=fit.model.report.wearerFit;if(side==='L')foot=fit.foot;
  for(const part of fit.model.parts){
   const P=part.geometry.attributes.position,N=part.geometry.attributes.normal,positions=[],normals=[];
   for(let i=0;i<P.count;i++){
    const v=new THREE.Vector3(P.getX(i)*mirror*fit.scaleM,P.getY(i)*fit.scaleM,P.getZ(i)*fit.scaleM).applyMatrix4(fit.restNative),n=new THREE.Vector3(N.getX(i)*mirror,N.getY(i),N.getZ(i)).transformDirection(fit.restNative);
    positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);if(side==='L')for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],positions[i*3+k]);hi[k]=Math.max(hi[k],positions[i*3+k]);}
   }
   const pigment=/sole|rubber|welt|foxing/.test(part.id+' '+part.role)?[.79,.80,.75]:/eyelet|metal/.test(part.id+' '+part.role)?[.48,.50,.47]:/lace|thread|stitch/.test(part.id+' '+part.role)?[.81,.82,.73]:/insole/.test(part.id)?[.67,.65,.56]:[.32,.43,.36];
   garments.push({id:side+'/'+part.id,positions,normals,faces:Array.from(part.geometry.index.array),reflection:side==='L',pigment});
  }
 }
 const d=(r,f,z)=>[foot.right[0]*r+foot.forward[0]*f,foot.right[1]*r+foot.forward[1]*f,z];
 const data={schema:'actual-complete-native-shoes-depth-view/1',actor:id,pose:'neutral',nativeAxis:'Z-up',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
  body:{positions:Array.from(actor.nativeSource.positions),faces:Array.from(actor.nativeSource.faces)},garments,
  frame:{min:lo,max:[hi[0],hi[1],hi[2]+.04],focus:'left shoe and ankle; complete body and both 39-part shoes retained'},
  cameras:[['OUTER SIDE',d(1,0,.12)],['HEEL',d(.10,-1,.25)],['TOE / INSTEP',d(.65,1,.45)],['OPENING ABOVE',d(.2,-.9,1)]],
  sideReports,limitations:['Flat diagnostic pigment and original geometric normals; no original R14 shader acceptance.','All original body/shoe triangles are submitted to the depth buffer; the local camera crops the image only.','Left negative attachment determinant uses GL_CW exactly as a reflected renderer object; indices remain original.']};
 const file=path.join(root,'evidence/shoe-recovery/ACTUAL_'+id+'_SHOES.json.gz');fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(data)));console.log(file);
}
