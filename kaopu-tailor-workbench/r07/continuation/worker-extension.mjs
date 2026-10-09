// This extension is assembled into the inherited worker's module scope by build.py.
import {fromNativeAnalytic,applyPatternEdit} from '../../learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from './native-edit-bridge.mjs';
let continuationBase=null,continuationDocument=null,continuationOperations=[],continuationRevision=0;
function resetContinuation(){continuationBase=continuationDocument=null;continuationOperations=[];continuationRevision=0;}
async function continuationEdit(data){
 if(running)throw Error('先暂停或取消当前缝制，再编辑裁片');
 if(config?.kind!=='analytic'||!analytic)throw Error('先从原制版程序生成一套真实纸样');
 stop();requestId=data.requestId;const token=epoch;
 const base=continuationBase||structuredClone(analytic),operations=structuredClone(continuationOperations);
 if(data.type==='edit')operations.push(structuredClone(data.operation));
 else if(data.type==='undo-edit'){if(!operations.length)throw Error('没有可撤销的裁片编辑');operations.pop();}
 else if(data.type==='reset-edits')operations.length=0;
 else throw Error('未知裁片事务');
 let document=fromNativeAnalytic(base);
 for(const op of operations)document=applyPatternEdit(document,op).document;
 document.revision=continuationRevision+1;
 if(data.type!=='edit')document.editHistory.push({type:data.type,revision:document.revision,remainingOperations:operations.length});
 const next=await rebuildEditedAnalytic(base,document,{operations});if(token!==epoch)return;
 const start=performance.now(),meshed=compileAnalytic(next,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'anny-adult-neutral-r01'}});
 meshed.source.bodyId='anny-adult-neutral-r01';meshed.source.continuationEdits=structuredClone(next.source.continuationEdits);
 meshed.source.trialBoundary='Edited source paper with rebuilt lengths, curves, material triangles and explicit seam references; fresh sewing required. Not a fit or motion certificate.';
 validate2(meshed);
 continuationBase=base;continuationDocument=document;continuationOperations=operations;continuationRevision=document.revision;
 spec=meshed;analytic=next;lab=null;profile.meshMs=performance.now()-start;
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);
 emit('paper',{spec,analytic,positionsM,fingerprint:fingerprint2(spec),topology:topology(spec),profile,
  fitPreflight:fit,canSew:!fit.blocking,editInfo:{revision:continuationRevision,operationCount:operations.length,
   operations:structuredClone(operations),panelIdentities:document.panels.map(p=>({id:p.id,sourcePanelId:p.sourcePanelId,edges:p.edges.map(e=>({id:e.id,kind:e.kind,controlPointsMm:e.controlPointsMm??[]}))})),
   freshMaterialMesh:true,bodyModified:false,oldSolveInvalidated:true},physicalStatus:'Edited paper remeshed; not yet sewn or certified'},[positionsM.buffer]);
}
