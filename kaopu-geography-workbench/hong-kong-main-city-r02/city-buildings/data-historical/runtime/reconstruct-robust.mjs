/** Independent 0.2 research adapter. Regular recipes use the frozen 0.1
 * generator. Explicit residual faces are NOT claimed to be rule extraction.
 * Degenerate source faces are retained as diagnostics, never rasterized.
 */
import {validateScore as validateFrozen, reconstructBuffers as reconstructFrozen} from './reconstruct.mjs';
export const GENERATOR=Object.freeze({id:'hk-measured-boundary',version:'0.2.0'});
export const ADAPTER='kaopu.hk.measured-plane-boundary/0.2-research';
const RESIDUAL=new Set(['triangleResidual','degenerateTriangleResidual']);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const frozenScore=(score,ops)=>({...score,adapter:'kaopu.hk.measured-plane-boundary/0.1-research',reconstruction:{...score.reconstruction,version:'0.1.0',operations:ops}});
export function validateScore(score){
  if(score?.adapter==='kaopu.hk.measured-plane-boundary/0.1-research')return validateFrozen(score);
  if(score?.adapter!==ADAPTER||score.reconstruction?.generator!==GENERATOR.id||score.reconstruction?.version!==GENERATOR.version)throw Error('Unsupported robust adapter or generator');
  const ops=score.reconstruction.operations;
  if(!Array.isArray(ops)||ops.length>2000000)throw Error('Invalid operation budget');
  const ids=new Set(),regular=[];
  for(const op of ops){
    if(ids.has(op.id))throw Error('Duplicate recipe id');ids.add(op.id);
    if(!RESIDUAL.has(op.kind)){regular.push(op);continue;}
    if(!Array.isArray(op.pointsENU)||op.pointsENU.length!==3||!op.pointsENU.every(finite3)||!finite3(op.normalENU))throw Error('Invalid residual geometry');
    if(!Number.isInteger(op.sourceTriangle)||op.sourceTriangle<0||!Array.isArray(op.sourcePositionIds)||op.sourcePositionIds.length!==3||op.sourcePositionIds.some(i=>!Number.isInteger(i)||i<0))throw Error('Missing residual source identity');
    if(typeof op.reason!=='string'||!op.reason.length||op.extractionStatus!=='exception_not_rule_extracted')throw Error('Residual must explicitly identify its extraction exception');
    const [a,b,c]=op.pointsENU,cr=cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])),mag=Math.hypot(...cr);
    if(op.kind==='triangleResidual'){
      if(mag<1e-10)throw Error('Nondegenerate residual has zero area');
      if(Math.abs(Math.hypot(...op.normalENU)-1)>1e-6||cr.reduce((s,v,i)=>s+v*op.normalENU[i],0)/mag<.999999)throw Error('Residual normal/source winding mismatch');
    }else if(mag>=1e-10)throw Error('Degenerate diagnostic has a nondegenerate source triangle');
  }
  // Validate normal recipe groups without imposing the frozen per-object cap
  // on explicitly typed source residues.
  for(let i=0;i<regular.length;i+=20000)validateFrozen(frozenScore(score,regular.slice(i,i+20000)));
  if(!regular.length)validateFrozen(frozenScore(score,[]));
  return true;
}
export function reconstructBuffers(score,THREE){
  if(score?.adapter==='kaopu.hk.measured-plane-boundary/0.1-research'){
    const result=reconstructFrozen(score,THREE);return {...result,diagnosticResidues:[],residualSummary:{regularOperations:result.patches.length,triangleResiduals:0,degenerateTriangleResiduals:0,status:'success'}};
  }
  validateScore(score);
  const operations=score.reconstruction.operations,regular=operations.filter(o=>!RESIDUAL.has(o.kind)),residuals=operations.filter(o=>RESIDUAL.has(o.kind));
  const pieces=[];for(let i=0;i<regular.length;i+=20000)pieces.push(reconstructFrozen(frozenScore(score,regular.slice(i,i+20000)),THREE));
  const renderable=residuals.filter(o=>o.kind==='triangleResidual');
  const sourceTriangles=operations.every(o=>Number.isInteger(o.sourceTriangleCount)&&o.sourceTriangleCount>0)?operations.reduce((s,o)=>s+o.sourceTriangleCount,0):null;
  const regularLength=pieces.reduce((s,p)=>s+p.positions.length,0),positions=new Float32Array(regularLength+renderable.length*9),normals=new Float32Array(positions.length),groups=[],patches=[],diagnosticResidues=[];
  let offset=0;
  for(const piece of pieces){positions.set(piece.positions,offset);normals.set(piece.normals,offset);groups.push(...piece.groups.map(g=>({...g,start:g.start+offset/3})));patches.push(...piece.patches.map(p=>({...p,start:p.start+offset/3,status:'success',rendered:true})));offset+=piece.positions.length;}
  const scales=[score.edits?.scaleEast??1,score.edits?.scaleNorth??1,score.edits?.scaleHeight??1];
  for(const op of residuals){
    const points=op.pointsENU.map(p=>[p[0]*scales[0],p[2]*scales[2],-p[1]*scales[1]]),start=offset/3;
    if(op.kind==='degenerateTriangleResidual'){
      diagnosticResidues.push({id:op.id,kind:op.kind,pointsDisplay:points,sourceTriangle:op.sourceTriangle,sourcePositionIds:op.sourcePositionIds,reason:op.reason,rendered:false});
      patches.push({id:op.id,kind:op.kind,start,count:0,holes:0,status:'exception',reason:op.reason,rendered:false});continue;
    }
    const enuN=op.normalENU.map((v,i)=>v/scales[i]),length=Math.hypot(...enuN),n=[enuN[0]/length,enuN[2]/length,-enuN[1]/length];
    for(const p of points){positions.set(p,offset);normals.set(n,offset);offset+=3;}
    const material=Math.abs(op.normalENU[2])<.5?0:(op.normalENU[2]>0?1:2);
    groups.push({start,count:3,materialIndex:material});patches.push({id:op.id,kind:op.kind,start,count:3,holes:0,status:'exception',reason:op.reason,rendered:true});
  }
  return {positions,normals,indices:null,groups,patches,diagnosticResidues,edited:scales.some(x=>x!==1),residualSummary:{sourceTriangles,residualTriangleFraction:sourceTriangles?residuals.length/sourceTriangles:null,regularOperations:regular.length,triangleResiduals:renderable.length,degenerateTriangleResiduals:diagnosticResidues.length,status:residuals.length?'exception':'success'}};
}
export function buildGeometry(score,THREE){
  const data=reconstructBuffers(score,THREE),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  for(const g of data.groups)geometry.addGroup(g.start,g.count,g.materialIndex);
  if(data.positions.length){geometry.computeBoundingBox();geometry.computeBoundingSphere();}
  geometry.userData={objectId:score.objectId,generator:score.reconstruction.version==='0.1.0'?{id:GENERATOR.id,version:'0.1.0'}:GENERATOR,patches:data.patches,edited:data.edited,sourceMeshReadAtRuntime:false,residualSummary:data.residualSummary,diagnosticResidues:data.diagnosticResidues};
  return geometry;
}
