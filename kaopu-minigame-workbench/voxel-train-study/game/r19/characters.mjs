import * as THREE from '../../vendor/three.module.js';
import {FRONT_X} from './session.mjs';
import {PLATFORM_LAYOUT} from './metre-scale.mjs';
import {actorPoseDimensions,ADULT_REFERENCE_HEIGHT_M,ADULT_HEIGHTS_M} from './actor-scale.mjs';
const COATS=[0x9d583b,0x537f89,0xb6974e,0x657654,0x986577,0x78939a,0x766657,0xa97d55,0x647795,0x8c9b67,0xab785e,0x537768];
const SKINS=[0xd5ac86,0xb88967,0xe4c4a0,0x946847],HAIR=[0x352a24,0x554539,0x726350,0x292b29];
export function createPassengers(pathFrame,{seatGeometry=null}={}){
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.91,metalness:.015}),2600);mesh.name='Dimensioned placeholder passengers with continuous routes';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
  const rootPose=new THREE.Object3D(),part=new THREE.Object3D(),bone=new THREE.Object3D(),matrix=new THREE.Matrix4(),matrix2=new THREE.Matrix4(),qBend=new THREE.Quaternion(),qYaw=new THREE.Quaternion(),anchorOffset=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0),colors=new Map();let count=0;
  const proof={version:'r17-person-parts-metres',referenceHeightM:ADULT_REFERENCE_HEIGHT_M,adultHeightRangeM:[Math.min(...ADULT_HEIGHTS_M),Math.max(...ADULT_HEIGHTS_M)],distributionBasis:'Design parameters, not historical population statistics',sourceShape:'Preserved box-person style and identities; independent metric torso, limbs, head and accessories; not finished anatomical characters',rendered:[],excluded:[]};mesh.userData.actorScale=proof;
  function color(hex){if(!colors.has(hex))colors.set(hex,new THREE.Color(hex));return colors.get(hex);}
  function box(x,y,z,w,h,d,hex,angle=0,parent=null){part.position.set(x,y,z);part.rotation.set(0,0,angle);part.scale.set(w,h,d);part.updateMatrix();matrix.multiplyMatrices(parent||rootPose.matrix,part.matrix);mesh.setMatrixAt(count,matrix);mesh.setColorAt(count,color(hex));count++;}
  return{mesh,proof,update(view){count=0;proof.rendered=[];proof.excluded=[];for(const actor of view.actors){if(actor.kind==='gone'&&actor.age>1.3)continue;let position=actor.position.slice(),bend=0;if(actor.frame==='world'){const x=position[0]-view.distance+FRONT_X;if(x<PLATFORM_LAYOUT.minX-12||x>PLATFORM_LAYOUT.maxX+34||pathFrame(x,0,position[2]).position[1]<-2.1)continue;const frame=pathFrame(x,position[1],position[2]);position=frame.position;bend=Math.atan2(frame.tangent[1],frame.tangent[0]);}
    const walking=!!actor.path||actor.pose==='running',seated=actor.pose==='seated',skin=SKINS[actor.appearance%SKINS.length],coat=COATS[actor.appearance%COATS.length],hair=HAIR[actor.appearance%HAIR.length],stride=walking?Math.sin(actor.walk)*.5:0;
    const fadeScale=actor.kind==='gone'?Math.max(.04,1-actor.age/1.4):1,bob=walking?Math.abs(Math.sin(actor.walk))*.016:0;
    const dimensions=actorPoseDimensions(actor,{floorY:Number.isFinite(actor.floorY)?actor.floorY:position[1],...seatGeometry?.(actor,position),fadeScale,stride,bob});
    if(!dimensions.eligible){proof.excluded.push({id:actor.id??null,...dimensions});continue;}
    const s=dimensions.shape,shift=dimensions.bodyShiftY,hat=view.line==='kcr1'&&actor.appearance%3!==2&&!seated;
    if(hat&&dimensions.bodyTopY+s.hatTopAboveHair*fadeScale>dimensions.ceilingY+1e-6){proof.excluded.push({id:actor.id??null,...dimensions,eligible:false,reason:'headwear-exceeds-explicit-ceiling'});continue;}
    proof.rendered.push({id:actor.id??null,...dimensions,hatDiameter:hat?s.hatDiameter:0});
    const heading=seated?0:actor.heading??Math.PI/2;qBend.setFromAxisAngle(Z,bend);qYaw.setFromAxisAngle(Y,heading);rootPose.quaternion.copy(qBend).multiply(qYaw);rootPose.position.set(position[0],dimensions.floorY,position[2]).add(anchorOffset.set(0,dimensions.rootOffsetY,0).applyQuaternion(rootPose.quaternion));rootPose.scale.setScalar(dimensions.renderScale);rootPose.updateMatrix();
    const headBottom=s.headBottomY+shift,hairTop=s.hairTopY+shift,skinHeadHeight=s.headHeight-s.hairHeight/2;
    box(0,(s.torsoBottomY+s.torsoTopY)/2+shift,0,s.torsoDepth,s.torsoTopY-s.torsoBottomY,s.torsoWidth,coat);
    box(0,s.hipBottomY+s.hipHeight/2+shift,0,s.hipDepth,s.hipHeight,s.hipWidth,0x3f4d4e);
    box(0,headBottom+skinHeadHeight/2,0,s.headDepth,skinHeadHeight,s.headWidth,skin);
    box(-.005*s.accessoryScale,hairTop-s.hairHeight/2,0,s.headDepth+.01*s.accessoryScale,s.hairHeight,s.headWidth+.01*s.accessoryScale,hair);
    for(const side of [-1,1])box(s.headDepth/2+.003,headBottom+s.headHeight*.61,side*s.headWidth*.27,.012,.018,.026,0x232725);
    box(s.headDepth/2+.009,headBottom+s.headHeight*.44,0,.025,.028,.037,skin);
    if(hat){const q=s.hatScale,hy=hairTop;box(0,hy+.004*q,0,s.hatDiameter,.014*q,s.hatDiameter,0xb79b57);for(let h=0;h<5;h++)box(0,hy+(.024+h*.022)*q,0,s.hatDiameter*(.75-h*.118),.025*q,s.hatDiameter*(.75-h*.118),h%2?0xc8ae69:0xb39552);
      if(['waiting','angry','leaving'].includes(actor.kind)){const q=s.accessoryScale,poleY=s.shoulderY+.03*q,basketY=s.hipJointY*.55,basketTop=basketY+.08*q;box(0,poleY,0,.045*q,.035*q,1.65*q,0x9e8044);for(const sign of [-1,1]){const z=sign*.72*q;for(const x of [-.16*q,.16*q])box(x,(poleY+basketTop)/2,z,.018*q,poleY-basketTop,.021*q,0xb7a076);box(0,basketY,z,.40*q,.16*q,.36*q,0x967447);for(let layer=0;layer<3;layer++)box(0,basketY-.05*q+layer*.055*q,z,.42*q,.019*q,.38*q,0xc4a56e);for(const x of [-.115*q,0,.115*q])for(const dz of [-.10*q,.065*q]){box(x,basketTop+.07*q,z+dz,.125*q,.15*q,.115*q,(actor.appearance+Math.round(dz*10))%2?0x5e8639:0x8ea553);box(x,basketTop+.13*q,z+dz,.06*q,.085*q,.15*q,0xacc785);}}}
    }
    for(const side of [-1,1]){
      let armAngle=-side*stride*.8;if(actor.kind==='angry'){const since=view.elapsed-actor.lastThrow;armAngle=side===1?(since<.45?-2.7+since*5:-.6):.15;}else if(actor.pose==='waving'&&side===1)armAngle=-2.6+Math.sin(view.elapsed*8)*.16;
      bone.position.set(0,s.shoulderY+shift,side*(s.shoulderWidth-s.armWidth)/2);bone.rotation.set(0,0,armAngle);bone.scale.set(1,1,1);bone.updateMatrix();matrix2.multiplyMatrices(rootPose.matrix,bone.matrix);box(0,-s.coatArmLength/2,0,s.armWidth,s.coatArmLength,s.armWidth,coat,0,matrix2);box(0,-s.coatArmLength-s.handHeight/2,0,s.handWidth,s.handHeight,s.handWidth,skin,0,matrix2);
      if(seated){const leg=dimensions.seatedLeg;box(s.thighLength/2-.07*s.accessoryScale,leg.thighCenterY,side*s.legZ,s.thighLength,s.thighThickness,s.legWidth,0x3e4f53);box(leg.kneeX,leg.shinCenterY,side*s.legZ,s.legWidth,leg.shinHeight,s.legWidth,0x3e4f53);box(leg.kneeX+s.footForward,leg.shoeCenterY,side*s.legZ,s.footLength,s.shoeHeight,s.footWidth,0x2d3332);}
      else{bone.position.set(0,s.hipJointY,side*s.legZ);bone.rotation.set(0,0,side*stride);bone.updateMatrix();matrix2.multiplyMatrices(rootPose.matrix,bone.matrix);box(0,-(s.hipJointY-s.shoeHeight)/2,0,s.legWidth,s.hipJointY-s.shoeHeight,s.legWidth,0x3e4f53,0,matrix2);box(s.footForward,-s.hipJointY+s.shoeHeight/2,0,s.footLength,s.shoeHeight,s.footWidth,0x2d3332,0,matrix2);}
    }
  }mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;},get count(){return count;}};
}
