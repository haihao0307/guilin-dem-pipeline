import * as THREE from '../full/source/registration-vendor/three.module.js';
import {FocusedBlink as NativeBlink} from '../brow-lash-r02/FocusedBlink.mjs';
import {buildClosureCorrections} from './ClosureProfile.mjs';
/** Two unchanged native blink targets plus two reversible local residuals. */
export class FocusedBlink extends NativeBlink {
 constructor(groom){super(groom);this.correctionAmount=.85;this.correctionReady=false;}
 async bake(){
  this.correctionReady=false;await super.bake();const start=performance.now();
  const g=this.geometry,result=buildClosureCorrections(this.groom,g);
  const originalPositions=[...g.morphAttributes.position],originalNormals=[...g.morphAttributes.normal];
  const base=g.attributes.position.array,scratch=g.clone(),scratchP=scratch.attributes.position.array;
  scratch.morphAttributes={};
  try{
   for(let j=0;j<2;j++){
    const native=originalPositions[j].array,d=result.positions[j];
    for(let k=0;k<base.length;k++)scratchP[k]=base[k]+native[k];
    scratch.computeVertexNormals();const prior=scratch.attributes.normal.array.slice();
    for(let k=0;k<base.length;k++)scratchP[k]+=d[k];
    scratch.computeVertexNormals();const next=scratch.attributes.normal.array,N=new Float32Array(base.length);
    for(let k=0;k<N.length;k++)N[k]=next[k]-prior[k];
    const P=new THREE.BufferAttribute(d,3),normal=new THREE.BufferAttribute(N,3);
    P.name=normal.name='closed-lid-local-corrective-'+j;
    g.morphAttributes.position.push(P);g.morphAttributes.normal.push(normal);
   }
  }finally{scratch.dispose();}
  this.nativePositions=originalPositions;this.nativeNormals=originalNormals;
  this.correctionReport=result.reports;this.correctionDomains=result.domains;this.edgeQA=result.edgeQA;
  this.groom.viewer.mesh.updateMorphTargets();this.correctionReady=true;
  this.correctionBuildMS=performance.now()-start;this.set(0);return true;
 }
 set(left,right=left){
  if(!this.correctionReady)return super.set(left,right);
  if(!this.ready||this.groom.viewer.mesh.geometry!==this.geometry)throw Error('人物已改变，请重新准备闭眼');
  if(![left,right].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('闭眼值必须在0–1');
  this.weights=[left,right];const v=this.groom.viewer,w=v.mesh.morphTargetInfluences;
  w[0]=left;w[1]=right;w[2]=left*this.correctionAmount;w[3]=right*this.correctionAmount;
  this.groom.sync();v.render();return this.report();
 }
 setCorrection(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('闭眼轮廓修正必须在0–1');this.correctionAmount=value;if(this.ready)this.set(...this.weights);return this.report();}
 detach(){this.correctionReady=false;super.detach();}
 report(){return {...super.report(),version:'NATIVE-BLINK-WITH-CORRECTIVE-R03',nativeTargetCount:2,correctiveTargetCount:this.correctionReady?2:0,correctionAmount:this.correctionAmount,correctiveBuildMS:this.correctionBuildMS,correction:this.correctionReport,edgeQA:this.edgeQA,neutralSurfaceUnchanged:true,method:'connected eyelid skin / coherent closed-target warp / preserved globe-axis radius / reversible authored residual',measuredAnatomicalModel:false};}
}
