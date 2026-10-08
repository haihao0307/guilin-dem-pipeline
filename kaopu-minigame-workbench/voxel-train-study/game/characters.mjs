import * as THREE from '../vendor/three.module.js';
import {FRONT_X} from './session.mjs';
const COATS=[0x9d583b,0x537f89,0xb6974e,0x657654,0x986577,0x78939a,0x766657,0xa97d55,0x647795,0x8c9b67,0xab785e,0x537768];
const SKINS=[0xd5ac86,0xb88967,0xe4c4a0,0x946847],HAIR=[0x352a24,0x554539,0x726350,0x292b29];
export function createPassengers(pathFrame){
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.91,metalness:.015}),2600);mesh.name='Passengers with continuous door/aisle/seat routes';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
  const rootPose=new THREE.Object3D(),part=new THREE.Object3D(),bone=new THREE.Object3D(),matrix=new THREE.Matrix4(),matrix2=new THREE.Matrix4(),qBend=new THREE.Quaternion(),qYaw=new THREE.Quaternion(),Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0),colors=new Map();let count=0;
  function color(hex){if(!colors.has(hex))colors.set(hex,new THREE.Color(hex));return colors.get(hex);}
  function box(x,y,z,w,h,d,hex,angle=0,parent=null){part.position.set(x,y,z);part.rotation.set(0,0,angle);part.scale.set(w,h,d);part.updateMatrix();matrix.multiplyMatrices(parent||rootPose.matrix,part.matrix);mesh.setMatrixAt(count,matrix);mesh.setColorAt(count,color(hex));count++;}
  return{mesh,update(view){count=0;for(const actor of view.actors){if(actor.kind==='gone'&&actor.age>1.3)continue;let position=actor.position.slice(),bend=0;if(actor.frame==='world'){const x=position[0]-view.distance+FRONT_X;if(x<-49||x>39||pathFrame(x,0,position[2]).position[1]<-2.1)continue;const frame=pathFrame(x,position[1],position[2]);position=frame.position;bend=Math.atan2(frame.tangent[1],frame.tangent[0]);}
      const walking=!!actor.path||actor.pose==='running',seated=actor.pose==='seated',skin=SKINS[actor.appearance%SKINS.length],coat=COATS[actor.appearance%COATS.length],hair=HAIR[actor.appearance%HAIR.length],stride=walking?Math.sin(actor.walk)*.5:0;
      const heading=seated?0:actor.heading??Math.PI/2;rootPose.position.set(...position);if(seated)rootPose.position.y-=.13;if(walking)rootPose.position.y+=Math.abs(Math.sin(actor.walk))*.016;qBend.setFromAxisAngle(Z,bend);qYaw.setFromAxisAngle(Y,heading);rootPose.quaternion.copy(qBend).multiply(qYaw);const scale=actor.kind==='gone'?Math.max(.04,1-actor.age/1.4):1;rootPose.scale.setScalar(scale);rootPose.updateMatrix();
      box(0,.63,0,.31,.37,.23,coat);box(0,.405,0,.28,.16,.22,0x3f4d4e);box(0,.91,0,.245,.245,.235,skin);box(-.017,1.04,0,.253,.07,.248,hair);box(.129,.934,-.064,.013,.025,.034,0x232725);box(.129,.934,.064,.013,.025,.034,0x232725);box(.139,.886,0,.04,.038,.055,skin);
      if(view.line==='kcr1'&&actor.appearance%3!==2&&!seated){
        // Woven straw hat and vegetable shoulder baskets. Geometry is generated here.
        box(0,1.08,0,.59,.035,.59,0xb79b57);for(let h=0;h<5;h++)box(0,1.11+h*.029,0,.44-h*.07,.035,.44-h*.07,h%2?0xc8ae69:0xb39552);
        if(['waiting','angry','leaving'].includes(actor.kind)){box(0,.87,0,.058,.048,1.86,0x9e8044);for(const z of [-.83,.83]){for(const x of [-.19,.19])box(x,.56,z,.022,.6,.025,0xb7a076);box(0,.29,z,.48,.18,.43,0x967447);for(let layer=0;layer<3;layer++)box(0,.24+layer*.065,z,.51,.023,.46,0xc4a56e);for(const x of [-.14,0,.14])for(const dz of [-.12,.08]){box(x,.44+(x===0?.025:0),z+dz,.15,.18,.14,(actor.appearance+Math.round(dz*10))%2?0x5e8639:0x8ea553);box(x,.51,z+dz,.07,.1,.18,0xacc785);}}}
      }
      for(const side of [-1,1]){
        let armAngle=-side*stride*.8;if(actor.kind==='angry'){const since=view.elapsed-actor.lastThrow;armAngle=side===1?(since<.45?-2.7+since*5:-.6):.15;}else if(actor.pose==='waving'&&side===1)armAngle=-2.6+Math.sin(view.elapsed*8)*.16;
        bone.position.set(0,.79,side*.205);bone.rotation.set(0,0,armAngle);bone.scale.set(1,1,1);bone.updateMatrix();matrix2.multiplyMatrices(rootPose.matrix,bone.matrix);box(0,-.145,0,.105,.30,.105,coat,0,matrix2);box(0,-.315,0,.108,.09,.108,skin,0,matrix2);
        if(seated){box(.095,.39,side*.088,.23,.105,.115,0x3e4f53);box(.19,.27,side*.088,.11,.22,.115,0x3e4f53);box(.235,.145,side*.088,.20,.08,.135,0x2d3332);}
        else{bone.position.set(0,.40,side*.086);bone.rotation.set(0,0,side*stride);bone.updateMatrix();matrix2.multiplyMatrices(rootPose.matrix,bone.matrix);box(0,-.16,0,.115,.31,.125,0x3e4f53,0,matrix2);box(.034,-.35,0,.19,.08,.14,0x2d3332,0,matrix2);}
      }
    }mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;},get count(){return count;}};
}

