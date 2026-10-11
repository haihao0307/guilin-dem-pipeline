/** Coordinate bridge only; native body evaluators and their full weights live
 * in CommonBodyDriver. The already-posed GNM head must use bodySkin, not the
 * final cranial skin that also contains the GNM root transform. */
export function gnmRootInCommonRest(model,{scale,head}){
 const r=model.gnm._rotWorld,t=model.gnm._skinTrans;
 const C=[1,0,0,0,0,-1,0,1,0],inv=[1,0,0,0,0,1,0,-1,0];
 const R=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)R[i*3+j]+=C[i*3+a]*r[a*3+b]*inv[b*3+j];
 const shift=head.map((x,k)=>x+scale*(model.canonical.headTransform.translation[k]-model.referenceHead[k]));
 const tr=[scale*t[0],-scale*t[2],scale*t[1]].map((x,i)=>x+shift[i]-R.slice(i*3,i*3+3).reduce((sum,a,j)=>sum+a*shift[j],0));
 return[R[0],R[1],R[2],tr[0],R[3],R[4],R[5],tr[1],R[6],R[7],R[8],tr[2],0,0,0,1];
}
export function applyCommonBodyDriver(model,context){
 if(!model.bodyDriver)return;
 const result=model.bodyDriver.evaluate(model.effectiveState,{gnmRootRestMatrix:model.activeGNMRootRestMatrix||gnmRootInCommonRest(model,context)});
 if(result.bodyCount!==model.bodyCount||result.topologySha256!==model.canonical.topologySha256)throw Error('Common body topology changed');
 context.pos.set(result.vertices,0);
 if(model.effectiveState.owners.rig==='mhr')for(const name of['neck02','head'])context.poseDeltas[model.anny.boneLabels.indexOf(name)]=result.attachmentBodySkinMatrices[name];
 model.lastBodyDriver=result;
}
