// This extension is assembled into the inherited worker's module scope by build.py.
import {fromNativeAnalytic,applyPatternEdit} from '../../learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from './native-edit-bridge.mjs';
let continuationBase=null,continuationDocument=null,continuationOperations=[],continuationRevision=0;
function resetContinuation(){continuationBase=continuationDocument=null;continuationOperations=[];continuationRevision=0;}
async function continuationEdit(data){
 requestId=data.requestId;
 if(running)throw Error('先暂停或取消当前缝制，再编辑裁片');
 const restore=data.restore;
 const base=structuredClone(continuationBase||restore?.base||analytic);
 if(!base||base.schema!=='kaopu-analytic-sewing-pattern@1')throw Error('先从原制版程序生成一套真实纸样');
 const proposedConfig=config||restore?.config;if(proposedConfig?.kind!=='analytic')throw Error('仅原生解析纸样支持此编辑事务');
 const operations=structuredClone(continuationBase?continuationOperations:restore?.operations||[]);
 const oldRevision=continuationBase?continuationRevision:restore?.revision||0;
 stop();const token=epoch;
 if(data.type==='edit')operations.push(structuredClone(data.operation));
 else if(data.type==='undo-edit'){if(!operations.length)throw Error('没有可撤销的裁片编辑');operations.pop();}
 else if(data.type==='reset-edits')operations.length=0;
 else if(data.type!=='replay-edits')throw Error('未知裁片事务');
 let document=fromNativeAnalytic(base);
 for(const op of operations)document=applyPatternEdit(document,op).document;
 document.revision=oldRevision+1;
 if(data.type!=='edit')document.editHistory.push({type:data.type,revision:document.revision,remainingOperations:operations.length});
 const next=await rebuildEditedAnalytic(base,document,{operations});if(token!==epoch)return;
 const start=performance.now(),meshed=compileAnalytic(next,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'anny-adult-neutral-r01'}});
 meshed.source.bodyId='anny-adult-neutral-r01';meshed.source.continuationEdits=structuredClone(next.source.continuationEdits);
 const placed=new Set(operations.filter(op=>op.type==='translatePlacement').flatMap(op=>op.panelIds));
 meshed.source.continuationExplicitPlacementPanels=document.panels.filter(p=>placed.has(p.id)).map(p=>p.sourcePanelId);
 meshed.source.trialBoundary='Edited source paper with rebuilt lengths, curves, material triangles and explicit seam references; fresh sewing required. Not a fit or motion certificate.';
 validate2(meshed);
 continuationBase=base;continuationDocument=document;continuationOperations=operations;continuationRevision=document.revision;config=proposedConfig;
 spec=meshed;analytic=next;lab=null;profile.meshMs=performance.now()-start;
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);
 emit('paper',{spec,analytic,positionsM,fingerprint:fingerprint2(spec),topology:topology(spec),profile,
  fitPreflight:fit,canSew:!fit.blocking,editInfo:{revision:continuationRevision,operationCount:operations.length,
   operations:structuredClone(operations),panelIdentities:document.panels.map(p=>({id:p.id,sourcePanelId:p.sourcePanelId,edges:p.edges.map(e=>({id:e.id,kind:e.kind,controlPointsMm:e.controlPointsMm??[]}))})),
   freshMaterialMesh:true,bodyModified:false,oldSolveInvalidated:true},physicalStatus:'Edited paper remeshed; not yet sewn or certified'},[positionsM.buffer]);
}
