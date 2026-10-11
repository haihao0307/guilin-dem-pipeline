/** Insert the native GNM neck-root transform into the existing Anny cranial
 * skinning branch. The source weights are used once, never as a second shape mask.
 * Inputs/positions remain in the same canonical mesh and metre/Z-up frame. */
export function cranialBones(anny){return new Set(anny.boneLabels.flatMap((name,i)=>/^neck\d+$/.test(name)||name==='head'||name==='eye.L'||name==='eye.R'?[i]:[]));}
export function applyGNMRootToBody(model,{pos,bodyRest,poseDeltas,scale,head}){
 if(model.activeHeadRig!=='gnm')return;const r=model.gnm._rotWorld,t=model.gnm._skinTrans;
 if(r[0]===1&&r[4]===1&&r[8]===1&&r[1]===0&&r[2]===0&&r[3]===0&&r[5]===0&&r[6]===0&&r[7]===0&&t[0]===0&&t[1]===0&&t[2]===0)return;
 const a=model.anny.arrays,V=bodyRest.vertices,shift=head.map((x,k)=>x+scale*(model.canonical.headTransform.translation[k]-model.referenceHead[k]));
 for(let i=0;i<model.bodyCount;i++){
  const[ia,ib,alpha]=model.canonical.annyRecipes[i];let ox=0,oy=0,oz=0;
  for(const[source,blend]of[[ia,1-alpha],[ib,alpha]]){if(!blend)continue;let branch=false;for(let k=0;k<model.anny.influences;k++)if(model.cranialBoneIndices.has(a.vertex_bone_indices[source*model.anny.influences+k])&&a.vertex_bone_weights[source*model.anny.influences+k]){branch=true;break;}if(!branch)continue;
   const px=V[source*3],py=V[source*3+1],pz=V[source*3+2],gx=(px-shift[0])/scale,gy=(pz-shift[2])/scale,gz=-(py-shift[1])/scale;
   const qx=r[0]*gx+r[1]*gy+r[2]*gz+t[0],qy=r[3]*gx+r[4]*gy+r[5]*gz+t[1],qz=r[6]*gx+r[7]*gy+r[8]*gz+t[2];
   const dx=scale*qx+shift[0]-px,dy=-scale*qz+shift[1]-py,dz=scale*qy+shift[2]-pz;
   for(let k=0;k<model.anny.influences;k++){const slot=source*model.anny.influences+k,j=a.vertex_bone_indices[slot],w=a.vertex_bone_weights[slot]*blend;if(!w||!model.cranialBoneIndices.has(j))continue;const b=poseDeltas[j];ox+=w*(b[0]*dx+b[1]*dy+b[2]*dz);oy+=w*(b[4]*dx+b[5]*dy+b[6]*dz);oz+=w*(b[8]*dx+b[9]*dy+b[10]*dz);}
  }if(ox||oy||oz){pos[i*3]+=ox;pos[i*3+1]+=oy;pos[i*3+2]+=oz;}
 }
}
