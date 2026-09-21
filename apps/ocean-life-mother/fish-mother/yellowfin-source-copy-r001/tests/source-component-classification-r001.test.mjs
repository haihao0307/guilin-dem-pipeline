import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const classification=JSON.parse(fs.readFileSync(path.join(root,'SOURCE_COMPONENT_CLASSIFICATION_R001.json'),'utf8'));
let assertions=0;
const ok=(value,message)=>{assert(value,message);assertions++};
const descending=values=>values.every((value,index)=>index===0||values[index-1]>value);

ok(classification.schema==='kaopu.fish-mother.source-component-classification/1.0','classification schema locked');
ok(classification.referenceId==='FISH-REF-002','classification reference locked');
ok(classification.source.sha256==='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe','classification source hash locked');
ok(classification.source.bytes===58908280,'classification source bytes locked');
ok(classification.frame.axisContract.x==='lateral','x axis is lateral');
ok(classification.frame.axisContract.y==='tail-to-snout','y axis is tail-to-snout');
ok(classification.frame.axisContract.z==='dorsal-negative / ventral-positive','z axis contract locked');

const dorsal=classification.finlets.dorsal;
const ventral=classification.finlets.ventral;
ok(dorsal.confirmedCount===9,'nine dorsal thin-sheet finlets confirmed');
ok(ventral.confirmedCount===8,'eight ventral thin-sheet finlets confirmed');
ok(dorsal.confirmed.length===dorsal.confirmedCount,'dorsal series complete');
ok(ventral.confirmed.length===ventral.confirmedCount,'ventral series complete');
ok(descending(dorsal.confirmed.map(item=>item.centerU)),'dorsal series ordered front-to-tail');
ok(descending(ventral.confirmed.map(item=>item.centerU)),'ventral series ordered front-to-tail');
ok(dorsal.overlapCandidates.length===1,'one leading dorsal overlap remains explicit');
ok(ventral.overlapCandidates.length===0,'no hidden ventral overlap candidate');
ok(classification.gates.finletsRecoveredFromAxialThinSheets===true,'finlets recovered from axial thin sheets, not guessed from joint names');

const minimum=classification.peduncle.minimum;
ok(minimum.u>=0.1865&&minimum.u<=0.2,'peduncle minimum stays in stable high-support window');
ok(minimum.supportPoints>=48,'peduncle minimum has high point support');
ok(minimum.lateralSupportPoints>=12,'peduncle minimum has lateral support');
ok(minimum.widthPctL>0.8&&minimum.widthPctL<1.2,'peduncle width is stable and non-degenerate');
ok(minimum.depthPctL>3.5&&minimum.depthPctL<4.2,'peduncle depth is stable and non-degenerate');
ok(minimum.lateralKeelZCandidatesNormalized.length===2,'two lateral keel z clusters retained as candidates');
ok(classification.gates.keelCandidatesRequireVisualConfirmation===true,'keel candidates stay visually gated');

const semantic=classification.semanticComponents;
ok(Boolean(semantic),'full semantic component inventory emitted');
ok(semantic.dorsal_fin.length===5,'dorsal source topology components fixed');
ok(semantic.anal_fin.some(item=>item.faces>=300),'primary anal component retained');
ok(semantic.pelvic_fin.length===2,'left/right pelvic components retained');
ok(semantic.pectoral_fin.length===2,'left/right pectoral components retained');
ok(semantic.caudal_upper.length===2&&semantic.caudal_lower.length===2,'caudal side sheets retained');
for(const group of ['dorsal_fin','anal_fin','pelvic_fin','pectoral_fin','caudal_upper','caudal_lower']){
  const major=semantic[group].filter(item=>item.faces>=100);
  ok(major.length>0,`${group} has major components`);
  ok(major.every(item=>item.attachmentRoot.edges>0),`${group} attachment roots recorded`);
  ok(major.every(item=>item.freeEdge.edges>0),`${group} free edges recorded`);
}
ok(classification.jointRootAnchors.some(item=>item.group==='dorsal_fin'),'dorsal joint roots recorded');
ok(classification.jointRootAnchors.some(item=>item.group==='anal_fin'),'anal joint root recorded');
ok(classification.gates.sourceCopyGeometryGenerated===false,'classification did not silently generate replacement geometry');
ok(classification.gates.productionReady===false,'visual acceptance remains required');

console.log(`Yellowfin Source Component Classification R001: ${assertions} assertions passed`);
