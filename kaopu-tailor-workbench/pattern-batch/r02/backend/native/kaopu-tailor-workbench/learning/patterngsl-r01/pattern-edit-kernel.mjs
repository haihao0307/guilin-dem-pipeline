/**
 * Original, dependency-free editing core over the workbench's native analytic
 * paper. Inspired by explicit pattern editing; NOT the unreleased PatternGSL
 * decoder, wire format, neural predictor or simulator. Units stay millimetres.
 * It is deliberately not passed off as a completed browser editing workflow.
 */
const SCHEMA='kaopu-explicit-pattern-edit@1';
const check=(ok,message)=>{if(!ok)throw Error('PATTERN_EDIT: '+message);};
const point=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const sortedKeys=x=>Array.isArray(x)?x.map(sortedKeys):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortedKeys(x[k])])):x;
export const stablePatternJSON=pattern=>JSON.stringify(sortedKeys(pattern));

export function samplePatternEdge(panel,edge,t){
 check(Number.isFinite(t)&&t>=0&&t<=1,'edge parameter must be in [0,1]');
 const a=panel.verticesMm[edge.endpoints[0]],b=panel.verticesMm[edge.endpoints[1]];
 if(edge.kind==='circle'){
  const r=edge.arc,angle=(r.startAngleDegrees+t*r.sweepDegrees)*Math.PI/180;
  return[r.centerMm[0]+r.radiusMm*Math.cos(angle),r.centerMm[1]+r.radiusMm*Math.sin(angle)];
 }
 const points=[a,...(edge.controlPointsMm??[]),b].map(p=>[...p]);
 for(let n=points.length-1;n>0;n--)for(let i=0;i<n;i++)for(let k=0;k<2;k++)points[i][k]=(1-t)*points[i][k]+t*points[i+1][k];
 return points[0];
}

/** Strict references and curve data only, not a self-intersection/physics gate. */
export function validateEditablePattern(document){
 check(document?.schema===SCHEMA&&document.units==='mm','unsupported schema or units');
 check(Number.isSafeInteger(document.revision)&&document.revision>=0&&Array.isArray(document.editHistory),'invalid revision/history');
 check(Array.isArray(document.panels)&&document.panels.length>0&&Array.isArray(document.stitches),'missing panels/stitches');
 const panels=new Map(),used=new Set(),seamIds=new Set();
 for(const p of document.panels){
  check(typeof p.id==='string'&&p.id.length>0&&!panels.has(p.id),'duplicate or absent panel ID');panels.set(p.id,p);
  check(Array.isArray(p.verticesMm)&&p.verticesMm.length>=2&&p.verticesMm.every(v=>point(v,2)),'invalid panel vertices');
  check(Array.isArray(p.edges)&&p.edges.length>=2&&Array.isArray(p.boundary)&&p.boundary.length===p.edges.length,'incomplete panel boundary');
  check(new Set(p.boundary).size===p.edges.length,'duplicate boundary edge');
  const edgeIds=new Set();
  for(const e of p.edges){
   check(Number.isInteger(e.id)&&!edgeIds.has(e.id),'invalid edge ID');edgeIds.add(e.id);
   check(Array.isArray(e.endpoints)&&e.endpoints.length===2&&e.endpoints.every(i=>Number.isInteger(i)&&i>=0&&i<p.verticesMm.length),'invalid endpoint reference');
   check(e.endpoints[0]!==e.endpoints[1],'collapsed source edge');
   check(['line','quadratic','cubic','circle'].includes(e.kind),'unknown curve type');
   const n={line:0,quadratic:1,cubic:2}[e.kind];
   if(n!==undefined)check(Array.isArray(e.controlPointsMm)&&e.controlPointsMm.length===n&&e.controlPointsMm.every(c=>point(c,2)),'wrong control-point arity');
   if(e.kind==='circle'){
    const r=e.arc;check(r&&point(r.centerMm,2)&&Number.isFinite(r.radiusMm)&&r.radiusMm>0&&[r.startAngleDegrees,r.sweepDegrees].every(Number.isFinite)&&r.sweepDegrees!==0,'invalid circular arc');
    for(const t of[0,1])check(distance(samplePatternEdge(p,e,t),p.verticesMm[e.endpoints[t]])<1e-5,'arc endpoints do not match the material');
   }
  }
  const ordered=p.boundary.map(id=>p.edges.find(e=>e.id===id));check(ordered.every(Boolean),'unknown boundary edge');
  for(let i=0;i<ordered.length;i++)check(ordered[i].endpoints[1]===ordered[(i+1)%ordered.length].endpoints[0],'boundary edges are not an ordered closed loop');
  check(point(p.placement?.translationMm,3)&&point(p.placement?.rotationDegreesXYZ,3),'invalid original panel placement');
 }
 for(const s of document.stitches){
  check(typeof s.id==='string'&&!seamIds.has(s.id),'duplicate seam ID');seamIds.add(s.id);
  for(const r of[s.a,s.b]){
   const panel=panels.get(r?.panelId);check(panel,'dangling seam panel reference');
   check(panel.edges.some(e=>e.id===r.edgeId),'dangling seam edge reference');
   check(typeof r.reverse==='boolean','seam orientation must be explicit');
   const key=JSON.stringify([r.panelId,r.edgeId]);check(!used.has(key),'an entire edge is used in more than one seam');used.add(key);
  }
 }
 return{structuralReferencesPassed:true,curveTypes:[...new Set(document.panels.flatMap(p=>p.edges.map(e=>e.kind)))].sort(),
  panelCount:panels.size,seamCount:seamIds.size,boundarySelfIntersectionsChecked:false,materialAreaChecked:false,garmentFitAccepted:false};
}

/** A canonical, lossless geometry view. No token rounding or guessed GSL scale. */
export function fromNativeAnalytic(native){
 check(native?.schema==='kaopu-analytic-sewing-pattern@1'&&native.units==='mm','native analytic paper in millimetres required');
 const source=[...native.panels].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const map=new Map(source.map((p,i)=>[p.id,`P${String(i+1).padStart(4,'0')}`]));
 const document={schema:SCHEMA,units:'mm',revision:0,isOfficialPatternGSL:false,
  source:{nativeSchema:native.schema,recipeHash:native.recipeHash??null,geometryHash:native.geometryHash??null},
  panels:source.map(p=>({id:map.get(p.id),sourcePanelId:p.id,role:p.role??null,
   verticesMm:structuredClone(p.verticesMm),boundary:[...p.boundary],
   edges:p.edges.map((e,i)=>({id:e.index??i,endpoints:[...e.endpoints],kind:e.kind,
    ...(e.kind==='circle'?{arc:structuredClone(e.arc)}:{controlPointsMm:structuredClone(e.controlPointsMm??[])})})),
   placement:structuredClone(p.placement)})),
  stitches:native.seams.map(s=>({id:s.id,sourceStitchIndex:s.sourceStitchIndex??null,
   a:{panelId:map.get(s.a.panelId),edgeId:s.a.edge,reverse:!!s.a.reverse},
   b:{panelId:map.get(s.b.panelId),edgeId:s.b.edge,reverse:!!s.b.reverse},
   stageId:s.stageId,gathering:structuredClone(s.gathering??null),direction:s.direction??null,rightWrong:s.rightWrong??null})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),
  editHistory:[],validation:null,
  simulationReady:false,reason:'Editing core only: changes require native remeshing, seam/material validation and a fresh simulation before use.'};
 document.validation=validateEditablePattern(document);return document;
}

/** Immutable edit transaction. Rejected edits leave the original entirely intact. */
export function applyPatternEdit(original,operation){
 validateEditablePattern(original);check(operation&&typeof operation.type==='string','missing edit');
 const d=structuredClone(original),known=new Map(d.panels.map(p=>[p.id,p]));
 const ids=operation.panelIds??[];check(Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length&&ids.every(id=>known.has(id)),'explicit unique panel selection required');
 const selected=new Set(ids),changes={type:operation.type,panelIds:[...ids],removedStitchIds:[],materialDimensionsChanged:false,placementChanged:false};
 switch(operation.type){
  case 'scalePanels': {
   const factor=operation.factor,anchor=operation.anchorMm??[0,0];
   check(Number.isFinite(factor)&&factor>0&&point(anchor,2),'positive uniform factor and explicit material-space anchor required');
   const scale=p=>p.map((v,k)=>anchor[k]+factor*(v-anchor[k]));
   for(const id of ids){const p=known.get(id);p.verticesMm=p.verticesMm.map(scale);for(const e of p.edges){if(e.kind==='circle'){e.arc.centerMm=scale(e.arc.centerMm);e.arc.radiusMm*=factor;}else e.controlPointsMm=e.controlPointsMm.map(scale);}}
   changes.materialDimensionsChanged=true;changes.factor=factor;changes.anchorMm=[...anchor];break;
  }
  case 'curveControl': {
   check(ids.length===1,'curve edit requires exactly one panel');
   const edge=known.get(ids[0]).edges.find(e=>e.id===operation.edgeId);
   check(edge&&['quadratic','cubic'].includes(edge.kind),'select a quadratic/cubic edge; a circular arc is not a Bezier curve');
   check(Number.isInteger(operation.controlIndex)&&operation.controlIndex>=0&&operation.controlIndex<edge.controlPointsMm.length&&point(operation.positionMm,2),'invalid control-point edit');
   edge.controlPointsMm[operation.controlIndex]=[...operation.positionMm];
   changes.materialDimensionsChanged=true;changes.edgeId=operation.edgeId;changes.controlIndex=operation.controlIndex;changes.positionMm=[...operation.positionMm];break;
  }
  case 'removePanels': {
   check(ids.length<d.panels.length,'cannot remove every panel');
   const incident=d.stitches.filter(s=>selected.has(s.a.panelId)||selected.has(s.b.panelId));
   check(incident.length===0||operation.removeIncidentStitches===true,'removing incident stitches requires an explicit edit option');
   d.panels=d.panels.filter(p=>!selected.has(p.id));d.stitches=d.stitches.filter(s=>!selected.has(s.a.panelId)&&!selected.has(s.b.panelId));
   changes.removedStitchIds=incident.map(s=>s.id);changes.remainingBoundaryNeedsReview=true;changes.materialDimensionsChanged=true;break;
  }
  case 'translatePlacement': {
   check(point(operation.deltaMm,3),'placement translation requires a finite millimetre vector');
   for(const id of ids){const p=known.get(id);p.placement.translationMm=p.placement.translationMm.map((v,k)=>v+operation.deltaMm[k]);}
   changes.placementChanged=true;changes.deltaMm=[...operation.deltaMm];break;
  }
  default:throw Error('PATTERN_EDIT: unsupported operation '+operation.type);
 }
 d.revision=original.revision+1;d.editHistory.push({...changes,revision:d.revision});
 d.validation=validateEditablePattern(d);d.simulationReady=false;
 return{document:d,changes,needsFreshMeshing:changes.materialDimensionsChanged,needsFreshDrape:true,originalBodyModified:false};
}
