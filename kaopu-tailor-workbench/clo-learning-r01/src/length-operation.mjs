import {fromNativeAnalytic,validateEditablePattern,stablePatternJSON} from '../upstream/kaopu-tailor-workbench/pattern-batch/r02/backend/native/kaopu-tailor-workbench/learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from '../upstream/kaopu-tailor-workbench/pattern-batch/r02/backend/native/kaopu-tailor-workbench/r07/continuation/native-edit-bridge.mjs';

// A bounded operation on the exact S03 source. This is not GarmentCode's
// pencil-skirt.length parameter: that parameter also changes slit proportions.
export const OPERATION_VERSION='kaopu-s03-hem-length/1';
export const BASE_RECIPE='0a5b56c44b44192a6d7666da1af31f098b7c92ef382b3dd33f73c42478f5d57d';
export const BASE_GEOMETRY='5f257229209ce4ba9e57c3c32df02f03899e3462a820169d08c5abf89937f6a1';
export const LIMITS=Object.freeze({minDeltaMm:-40,maxDeltaMm:100,stepMm:10});
const MOVED=Object.freeze({skirt_front:[0,1],skirt_back:[0,17,18,19,20]});
const requireValue=(v,m)=>{if(!v)throw Error('HEM_LENGTH: '+m);};
const clone=x=>structuredClone(x);
const eq=(a,b)=>stablePatternJSON(a)===stablePatternJSON(b);
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stablePatternJSON(v)))),x=>x.toString(16).padStart(2,'0')).join('');

export function measurePaper(paper){
 const front=paper.panels.find(p=>p.id==='skirt_front'),back=paper.panels.find(p=>p.id==='skirt_back');
 requireValue(front&&back,'front and back panels are required');
 const edge=(p,id)=>p.edges.find(e=>e.index===id);
 return {frontLengthMm:front.verticesMm[3][1]-front.verticesMm[0][1],backLengthMm:back.verticesMm[2][1]-back.verticesMm[0][1],
  slitDepthMm:back.verticesMm[19][1]-back.verticesMm[18][1],frontHemWidthMm:edge(front,0).lengthMm,
  sidePairs:paper.seams.filter(s=>['s6','s9'].includes(s.id)).map(s=>({id:s.id,aMm:s.lengthAMm,bMm:s.lengthBMm,differenceMm:s.lengthAMm-s.lengthBMm})),
  cutAreaMm2:paper.panels.reduce((n,p)=>n+Math.abs(p.signedAreaMm2),0),units:'mm'};
}

export async function changeHemLength(base,deltaMm,{requestId=1,expectedRevision=0}={}){
 requireValue(base?.schema==='kaopu-analytic-sewing-pattern@1'&&base.units==='mm','native millimetre paper required');
 requireValue(base.recipeHash===BASE_RECIPE&&base.geometryHash===BASE_GEOMETRY,'different source recipe or geometry');
 requireValue(Number.isFinite(deltaMm)&&deltaMm>=LIMITS.minDeltaMm&&deltaMm<=LIMITS.maxDeltaMm,'length change outside the verified operation range');
 requireValue(Number.isSafeInteger(requestId)&&requestId>0&&Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'invalid request/revision');
 const source=fromNativeAnalytic(base),document=clone(source);
 const changes=[];
 for(const p of document.panels){
  const ids=MOVED[p.sourcePanelId];if(!ids)continue;
  for(const index of ids){const before=[...p.verticesMm[index]];p.verticesMm[index][1]-=deltaMm;changes.push({panelId:p.sourcePanelId,vertex:index,fromMm:before,toMm:[...p.verticesMm[index]]});}
 }
 const operation={schema:OPERATION_VERSION,type:'changeHemLength',sourcePresetId:'S03',deltaMm,units:'mm',requestId,expectedRevision,
  preserves:['waistband','waist-seam geometry','darts','hip curves','body','placements','slit depth'],changedVertices:changes};
 document.revision=1;document.editHistory=[{type:operation.type,revision:1,deltaMm,changedVertices:changes,materialDimensionsChanged:deltaMm!==0,placementChanged:false}];
 document.validation=validateEditablePattern(document);
 // Check the selected material edits before rebuilding analytic caches.
 for(const p of document.panels){const original=source.panels.find(q=>q.id===p.id),allowed=new Set(MOVED[p.sourcePanelId]||[]);
  requireValue(eq(p.edges,original.edges)&&eq(p.placement,original.placement),'curve or placement changed outside this operation');
  for(let i=0;i<p.verticesMm.length;i++){requireValue(p.verticesMm[i][0]===original.verticesMm[i][0],'width must remain unchanged');if(!allowed.has(i))requireValue(eq(p.verticesMm[i],original.verticesMm[i]),'protected material vertex moved');}
 }
 const out=await rebuildEditedAnalytic(base,document,{operations:[operation]});
 // Preserve source evaluation order; a paper edit must not accidentally reorder
 // constraints merely because the generic editor serializes IDs lexically.
 const seamOrder=new Map(base.seams.map((s,i)=>[s.id,i]));out.seams.sort((a,b)=>seamOrder.get(a.id)-seamOrder.get(b.id));
 const panelOrder=new Map(base.panels.map((p,i)=>[p.id,i]));out.panels.sort((a,b)=>panelOrder.get(a.id)-panelOrder.get(b.id));
 // The generic bridge intentionally invalidates all high-level interfaces.
 // Restore only the two proven-unchanged waistband-top interfaces required by
 // the inherited material-circuit support. All other interface caches stay invalid.
 const retained=base.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='top');
 requireValue(retained.length===2,'expected two source waistband interfaces');
 for(const i of retained)for(const ref of i.edges){
  const before=source.panels.find(p=>p.sourcePanelId===ref.panelId),after=document.panels.find(p=>p.sourcePanelId===ref.panelId);
  requireValue(before&&after&&eq(before,after),'waistband interface geometry changed');
 }
 out.interfaces=clone(retained);
 out.source.continuationEdits.retainedValidatedInterfaces=retained.map(i=>({component:i.component,name:i.name}));
 out.source.lengthOperation={schema:OPERATION_VERSION,deltaMm,notUpstreamHighLevelLengthParameter:true,sourcePresetId:'S03'};
 out.validation.physicalFitStatus='not-run';
 const before=measurePaper(base),after=measurePaper(out);
 requireValue(Math.abs(after.frontLengthMm-before.frontLengthMm-deltaMm)<1e-8,'front length relation failed');
 requireValue(Math.abs(after.backLengthMm-before.backLengthMm-deltaMm)<1e-8,'back length relation failed');
 requireValue(Math.abs(after.slitDepthMm-before.slitDepthMm)<1e-8,'slit depth changed');
 requireValue(Math.abs(after.frontHemWidthMm-before.frontHemWidthMm)<1e-8,'hem width changed');
 for(const p of after.sidePairs)requireValue(Math.abs(p.differenceMm)<1e-6,'side seam lengths disagree');
 return {paper:out,operation,measurements:{before,after},requestHash:await digest(operation),protectedGeometryPassed:true};
}
