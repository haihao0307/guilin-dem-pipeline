import {fromNativeAnalytic,validateEditablePattern,stablePatternJSON} from '../upstream/kaopu-tailor-workbench/pattern-batch/r02/backend/native/kaopu-tailor-workbench/learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from '../upstream/kaopu-tailor-workbench/pattern-batch/r02/backend/native/kaopu-tailor-workbench/r07/continuation/native-edit-bridge.mjs';

// Bounded independent edits of the exact S03 material-space paper. Its back
// opening is an existing 20 mm-wide triangular notch, not a constructed vent.
// The source high-level length parameter may couple opening proportions;
// this operation explicitly keeps the two requested dimensions independent.
export const OPERATION_VERSION='kaopu-s03-length-and-opening/2';
export const BASE_RECIPE='0a5b56c44b44192a6d7666da1af31f098b7c92ef382b3dd33f73c42478f5d57d';
export const BASE_GEOMETRY='5f257229209ce4ba9e57c3c32df02f03899e3462a820169d08c5abf89937f6a1';
export const LIMITS=Object.freeze({minDeltaMm:-40,maxDeltaMm:100,stepMm:10,minSlitDeltaMm:-40,maxSlitDeltaMm:80,slitStepMm:10});
export const DEFAULTS=Object.freeze({deltaMm:60,slitDeltaMm:40});
const MOVED=Object.freeze({skirt_front:[0,1],skirt_back:[0,17,18,19,20]});
const requireValue=(v,m)=>{if(!v)throw Error('SKIRT_DESIGN: '+m);};
const clone=x=>structuredClone(x);
const eq=(a,b)=>stablePatternJSON(a)===stablePatternJSON(b);
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stablePatternJSON(v)))),x=>x.toString(16).padStart(2,'0')).join('');

export function measurePaper(paper){
 const front=paper.panels.find(p=>p.id==='skirt_front'),back=paper.panels.find(p=>p.id==='skirt_back');
 requireValue(front&&back,'front and back panels are required');
 const edge=(p,id)=>p.edges.find(e=>e.index===id);
 return {frontLengthMm:front.verticesMm[3][1]-front.verticesMm[0][1],backLengthMm:back.verticesMm[2][1]-back.verticesMm[0][1],
  slitDepthMm:back.verticesMm[19][1]-back.verticesMm[18][1],frontHemWidthMm:edge(front,0).lengthMm,
  slitMouthWidthMm:back.verticesMm[18][0]-back.verticesMm[20][0],
  sidePairs:paper.seams.filter(s=>['s6','s9'].includes(s.id)).map(s=>({id:s.id,aMm:s.lengthAMm,bMm:s.lengthBMm,differenceMm:s.lengthAMm-s.lengthBMm})),
  cutAreaMm2:paper.panels.reduce((n,p)=>n+Math.abs(p.signedAreaMm2),0),units:'mm'};
}

export async function changeSkirtDesign(base,deltaMm,slitDeltaMm,{requestId=1,expectedRevision=0}={}){
 requireValue(base?.schema==='kaopu-analytic-sewing-pattern@1'&&base.units==='mm','native millimetre paper required');
 requireValue(base.recipeHash===BASE_RECIPE&&base.geometryHash===BASE_GEOMETRY,'different source recipe or geometry');
 requireValue(Number.isFinite(deltaMm)&&deltaMm>=LIMITS.minDeltaMm&&deltaMm<=LIMITS.maxDeltaMm,'length change outside the verified operation range');
 requireValue(Number.isFinite(slitDeltaMm)&&slitDeltaMm>=LIMITS.minSlitDeltaMm&&slitDeltaMm<=LIMITS.maxSlitDeltaMm,'opening-depth change outside the operation range');
 requireValue(Number.isInteger((deltaMm-LIMITS.minDeltaMm)/LIMITS.stepMm)&&Number.isInteger((slitDeltaMm-LIMITS.minSlitDeltaMm)/LIMITS.slitStepMm),'changes must use the declared 10 mm increments');
 requireValue(Number.isSafeInteger(requestId)&&requestId>0&&Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'invalid request/revision');
 const source=fromNativeAnalytic(base),document=clone(source);
 const sourceBack=base.panels.find(p=>p.id==='skirt_back');
 requireValue(sourceBack?.edges.filter(e=>[18,19].includes(e.index)).every(e=>e.kind==='line')&&sourceBack.edges.length===21,'unexpected source opening topology');
 requireValue(!base.seams.some(s=>[s.a,s.b].some(r=>r.panelId==='skirt_back'&&[18,19].includes(r.edge))),'opening edges must remain unsewn');
 const changes=[];
 for(const p of document.panels){
  const ids=MOVED[p.sourcePanelId];if(!ids)continue;
  for(const index of ids){const before=[...p.verticesMm[index]];p.verticesMm[index][1]-=deltaMm;if(p.sourcePanelId==='skirt_back'&&index===19)p.verticesMm[index][1]+=slitDeltaMm;changes.push({panelId:p.sourcePanelId,vertex:index,fromMm:before,toMm:[...p.verticesMm[index]]});}
 }
 const operation={schema:OPERATION_VERSION,type:'changeSkirtLengthAndOpening',sourcePresetId:'S03',deltaMm,slitDeltaMm,units:'mm',requestId,expectedRevision,
  openingKind:'existing triangular material cutout',independentDimensions:true,
  preserves:['waistband','waist-seam geometry','darts','hip curves','body','placements','all seam references','20 mm opening mouth width'],changedVertices:changes};
 document.revision=expectedRevision+1;document.editHistory=[{type:operation.type,revision:document.revision,deltaMm,slitDeltaMm,changedVertices:changes,materialDimensionsChanged:deltaMm!==0||slitDeltaMm!==0,placementChanged:false}];
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
 out.source.designOperation={schema:OPERATION_VERSION,deltaMm,slitDeltaMm,notUpstreamHighLevelLengthParameter:true,sourcePresetId:'S03'};
 out.validation.physicalFitStatus='not-run';
 const before=measurePaper(base),after=measurePaper(out);
 requireValue(Math.abs(after.frontLengthMm-before.frontLengthMm-deltaMm)<1e-8,'front length relation failed');
 requireValue(Math.abs(after.backLengthMm-before.backLengthMm-deltaMm)<1e-8,'back length relation failed');
 requireValue(Math.abs(after.slitDepthMm-before.slitDepthMm-slitDeltaMm)<1e-8,'opening depth relation failed');
 requireValue(Math.abs(after.slitMouthWidthMm-before.slitMouthWidthMm)<1e-8,'opening mouth width changed');
 // Opening stays below the unchanged hip line throughout the bounded domain.
 const editedBack=out.panels.find(p=>p.id==='skirt_back');
 requireValue(after.slitDepthMm>0&&editedBack.verticesMm[19][1]<Math.min(editedBack.verticesMm[1][1],editedBack.verticesMm[16][1]),'opening reaches protected hip geometry');
 requireValue(eq(base.seams.map(s=>({id:s.id,a:s.a,b:s.b})),out.seams.map(s=>({id:s.id,a:s.a,b:s.b}))),'source seam topology changed');
 requireValue(Math.abs(after.frontHemWidthMm-before.frontHemWidthMm)<1e-8,'hem width changed');
 for(const p of after.sidePairs)requireValue(Math.abs(p.differenceMm)<1e-6,'side seam lengths disagree');
 return {paper:out,operation,measurements:{before,after},requestHash:await digest(operation),protectedGeometryPassed:true,independentDimensionsPassed:true};
}
