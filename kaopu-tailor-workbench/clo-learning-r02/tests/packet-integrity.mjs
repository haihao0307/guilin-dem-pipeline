import {createHash} from 'node:crypto';

// This is an independent packet/source audit, not another solver or a cross-
// runtime material golden. It imports no operation, compiler or hash code.
// Actual material bytes must hash correctly and describe the requested frozen
// paper. Physical acceptance is deliberately left to the actual result gate.
const BASE_SHA = '3e54c6322a46ea7232644f341a4f5ea300d0b20a24a1d45765138b707d753baa';
const BASE_RECIPE = '0a5b56c44b44192a6d7666da1af31f098b7c92ef382b3dd33f73c42478f5d57d';
const BASE_GEOMETRY = '5f257229209ce4ba9e57c3c32df02f03899e3462a820169d08c5abf89937f6a1';
const OP_SCHEMA = 'kaopu-s03-length-and-opening/2';
const ANCHOR = '0ff632be3e4ab112fad93fd4c43c7bc6a90cf5f3';
const PERSON = Object.freeze({
  geometrySHA256: 'fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571',
  topologySHA256: 'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de',
  stateSHA256: 'f6a60588040d2967ac619c5352c52355cbd02b12890f88cc976d0c2fbe50c0b7',
  adapterFingerprint: '4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5'
});
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const stable = v => JSON.stringify(canonical(v));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = v => hash(stable(v));
const requireValue = (ok, message) => { if (!ok) throw Error(message); };
const same = (a, b, message) => requireValue(stable(a) === stable(b), message);
const near = (a, b, message, tolerance = 1e-7) => requireValue(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance, `${message}: ${a} versus ${b}`);
const point = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const materialProjection = spec => ({
  ...(spec.elasticStays ? {elasticStays: spec.elasticStays} : {}),
  panels: spec.panels.map(p => ({id: p.id, uvMm: p.uvMm, triangles: p.triangles})),
  seams: spec.seams.map(s => ({id: s.id, a: s.a, b: s.b, stitchVertexPairs: s.stitchVertexPairs}))
});
const edgeControl = e => ({index: e.index, endpoints: e.endpoints, kind: e.kind, controlPointsMm: e.controlPointsMm ?? [], arc: e.arc ?? null});
const seamIdentity = s => ({id: s.id, a: s.a, b: s.b, isDart: s.isDart, stageId: s.stageId, sourceStitchIndex: s.sourceStitchIndex, direction: s.direction, rightWrong: s.rightWrong});
const dimensions = p => {
  const f = p.panels.find(x => x.id === 'skirt_front'), b = p.panels.find(x => x.id === 'skirt_back');
  return {frontLengthMm: Math.max(...f.verticesMm.map(v => v[1])) - Math.min(...f.verticesMm.map(v => v[1])), backLengthMm: Math.max(...b.verticesMm.map(v => v[1])) - Math.min(...b.verticesMm.map(v => v[1])), slitDepthMm: b.verticesMm[19][1] - b.verticesMm[18][1], slitMouthWidthMm: Math.abs(b.verticesMm[18][0] - b.verticesMm[20][0])};
};

// Membership in an analytic edge is checked geometrically. In particular, no
// production arc-length sampler is rerun or used as the expected byte string.
function curveParameter(p, e, q) {
  const [a, b] = e.endpoints.map(i => p.verticesMm[i]);
  if (e.kind === 'line') {
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    const t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / length2;
    near(cross(a, b, q) / Math.sqrt(length2), 0, 'line boundary point moved');
    return t;
  }
  if (e.kind === 'circle') {
    const arc = e.arc, dx = q[0] - arc.centerMm[0], dy = q[1] - arc.centerMm[1];
    near(Math.sqrt(dx * dx + dy * dy), arc.radiusMm, 'circle boundary radius changed');
    const angle = Math.atan2(dy, dx), start = arc.startAngleDegrees * Math.PI / 180, sweep = arc.sweepDegrees * Math.PI / 180;
    return [-2, -1, 0, 1, 2].map(k => (angle + k * 2 * Math.PI - start) / sweep).sort((u, v) => Math.abs(u - .5) - Math.abs(v - .5))[0];
  }
  requireValue(e.kind === 'quadratic' && e.controlPointsMm?.length === 1, 'unsupported source curve');
  const c = e.controlPointsMm[0], candidates = [0, 1];
  for (let axis = 0; axis < 2; axis++) {
    const A = a[axis] - 2 * c[axis] + b[axis], B = 2 * (c[axis] - a[axis]), C = a[axis] - q[axis];
    if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) candidates.push(-C / B); }
    else if (B * B - 4 * A * C >= -1e-8) {
      const root = Math.sqrt(Math.max(0, B * B - 4 * A * C));
      candidates.push((-B + root) / (2 * A), (-B - root) / (2 * A));
    }
  }
  const evaluated = candidates.filter(t => t >= -1e-8 && t <= 1 + 1e-8).map(t => {
    const x = (1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0], y = (1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1];
    return {t, distance: Math.sqrt((x-q[0])**2+(y-q[1])**2)};
  }).sort((u, v) => u.distance - v.distance);
  requireValue(evaluated.length > 0 && evaluated[0].distance <= 1e-7, 'quadratic boundary point moved');
  return evaluated[0].t;
}

function inspectMesh(spec, analytic) {
  same(spec.panels.map(p => p.id), analytic.panels.map(p => p.id), 'material panel order');
  const rows = [];
  for (let panelIndex = 0; panelIndex < analytic.panels.length; panelIndex++) {
    const paper = analytic.panels[panelIndex], mesh = spec.panels[panelIndex], n = mesh.uvMm.length;
    requireValue(n <= 3000 && mesh.triangles.length <= 6000 && mesh.originalVertexCount === paper.verticesMm.length, 'original per-panel material budget/count');
    requireValue(mesh.uvMm.every(v => point(v, 2)), 'non-finite material coordinate');
    same(mesh.uvMm.slice(0, mesh.originalVertexCount), paper.verticesMm, 'original analytic vertices missing from material');
    same(mesh.analyticCurvesMm, paper.edges, 'mesh curve description differs from current paper');
    same(mesh.source.originalPlacement, paper.placement, 'mesh source placement changed');
    requireValue(mesh.source.originalPanelId === paper.id && mesh.materialId === 'digital-muslin', 'wrong material panel identity');
    same(mesh.placement.translationMm, paper.placement.translationMm, 'material placement translation');
    same(mesh.placement.rigidBasis, paper.placement.matrix3.flat(), 'material placement rotation');
    same(Object.keys(mesh.edges).sort(), paper.edges.map(e => 'e' + e.index).sort(), 'material edge identities');
    const boundary = [], boundarySegments = new Set();
    let maxCurveResidualParameter = 0;
    for (const id of paper.boundary) {
      const e = paper.edges.find(v => v.index === id), indices = mesh.edges['e' + id];
      requireValue(Array.isArray(indices) && indices.length >= 2 && new Set(indices).size === indices.length, 'invalid sampled material edge');
      same([indices[0], indices.at(-1)], e.endpoints, 'sampled edge endpoints changed');
      let previousT = -Infinity;
      for (const index of indices) {
        requireValue(Number.isInteger(index) && index >= 0 && index < n, 'invalid material boundary index');
        const t = curveParameter(paper, e, mesh.uvMm[index]);
        requireValue(t >= -1e-8 && t <= 1 + 1e-8 && t > previousT + 1e-10, 'material boundary order or arc extent');
        previousT = t; maxCurveResidualParameter = Math.max(maxCurveResidualParameter, -t, t - 1);
      }
      boundary.push(...indices.slice(0, -1));
      for (let i = 1; i < indices.length; i++) boundarySegments.add(edgeKey(indices[i-1], indices[i]));
    }
    same(mesh.boundary, boundary, 'material boundary not the complete source edge circuit');
    requireValue(new Set(boundary).size === boundary.length, 'material boundary has repeated vertices');
    const incidence = new Map(), seen = new Set(), used = new Set(); let area = 0;
    for (const tri of mesh.triangles) {
      requireValue(Array.isArray(tri) && tri.length === 3 && new Set(tri).size === 3 && tri.every(i => Number.isInteger(i) && i >= 0 && i < n), 'invalid material triangle');
      const key = [...tri].sort((a,b) => a-b).join(':'); requireValue(!seen.has(key), 'duplicate material triangle'); seen.add(key);
      const twiceArea = cross(...tri.map(i => mesh.uvMm[i])); requireValue(twiceArea > 1e-7, 'degenerate or reversed material triangle'); area += twiceArea / 2;
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k+1)%3], key = edgeKey(a,b), row = incidence.get(key) || {count:0,direction:0};
        row.count++; row.direction += a < b ? 1 : -1; incidence.set(key,row); used.add(a);
      }
    }
    requireValue(used.size === n && n - incidence.size + mesh.triangles.length === 1, 'unused material vertex or non-disk topology');
    for (const [key, row] of incidence) requireValue(boundarySegments.has(key) ? row.count === 1 : row.count === 2 && row.direction === 0, 'material triangle/boundary incidence');
    requireValue([...boundarySegments].every(k => incidence.has(k)), 'boundary segment missing from triangles');
    const polygonArea = boundary.reduce((sum, index, i) => { const a=mesh.uvMm[index], b=mesh.uvMm[boundary[(i+1)%boundary.length]]; return sum+a[0]*b[1]-a[1]*b[0]; }, 0)/2;
    near(area, Math.abs(polygonArea), 'material triangle area does not cover source boundary', 1e-5);
    rows.push({id:paper.id,vertices:n,triangles:mesh.triangles.length,boundaryVertices:boundary.length,areaMm2:area,maxCurveParameterOutsideDomain:maxCurveResidualParameter});
  }
  same(spec.seams.map(s=>s.id), analytic.seams.map(s=>s.id), 'material source seam order/count');
  let stitches = 0;
  for (let i=0;i<analytic.seams.length;i++) {
    const source=analytic.seams[i], seam=spec.seams[i];
    same(seam.sourceSeam,source,'mesh seam is not the current analytic seam');
    const lists=['a','b'].map(side=>{
      const ref=source[side]; same(seam[side],{...ref,edge:'e'+ref.edge},'source seam edge/direction changed');
      const ids=spec.panels.find(p=>p.id===ref.panelId).edges['e'+ref.edge]; return ref.reverse?[...ids].reverse():ids;
    });
    const pairs=seam.stitchVertexPairs;
    requireValue(Array.isArray(pairs)&&pairs.length>=2,'missing actual stitch material identities');
    same(pairs[0],lists.map(a=>a[0]),'source seam start omitted'); same(pairs.at(-1),lists.map(a=>a.at(-1)),'source seam end omitted');
    let previous=[-1,-1];
    for(const pair of pairs){ requireValue(Array.isArray(pair)&&pair.length===2,'bad stitch pair'); const indices=pair.map((v,side)=>lists[side].indexOf(v)); requireValue(indices.every((v,side)=>v>previous[side]),'wrong-side or non-monotone stitch identity'); previous=indices; }
    stitches+=pairs.length;
  }
  return {panels:rows,vertices:rows.reduce((s,p)=>s+p.vertices,0),triangles:rows.reduce((s,p)=>s+p.triangles,0),sourceSeams:spec.seams.length,stitchPairs:stitches,topologyMeaning:'Current mesh is a finite oriented triangulation with complete source-curve boundaries and source seam identities; no cross-runtime byte or physical equivalence is asserted.'};
}

export function verifyPacketIntegrity({paperPacket, donePacket, basePaperText, expected, previousBinding}) {
  const evidence={schema:'kaopu-clo-independent-packet-integrity/1',passed:false,expected,checks:[],hashes:{},measurements:null,mesh:null,physicalAcceptance:'Separate actual solver gate; not certified by this integrity helper.'};
  const check=(id,fn)=>{try{const details=fn();evidence.checks.push({id,passed:true,...(details||{})});}catch(error){evidence.checks.push({id,passed:false,message:error.message});const failure=Error('PACKET_INTEGRITY '+id+': '+error.message);failure.evidence=evidence;throw failure;}};
  let base,analytic,spec,binding,operation,changes,history;
  check('frozen-source-and-request',()=>{
    requireValue(typeof basePaperText==='string'&&hash(basePaperText)===BASE_SHA,'source paper bytes are not frozen S03');base=JSON.parse(basePaperText);
    requireValue(base.recipeHash===BASE_RECIPE&&base.geometryHash===BASE_GEOMETRY,'frozen source identity');
    requireValue(expected&&Number.isSafeInteger(expected.requestId)&&expected.requestId>0&&Number.isSafeInteger(expected.expectedRevision)&&expected.expectedRevision>=0&&expected.expectedRevision<Number.MAX_SAFE_INTEGER,'invalid expected request/revision');
    const {deltaMm:h,slitDeltaMm:s}=expected;requireValue(Number.isFinite(h)&&h>=-40&&h<=100&&h%10===0&&Number.isFinite(s)&&s>=-40&&s<=80&&s%10===0,'expected dimensions outside declared discrete operation');
    requireValue(paperPacket?.type==='paper'&&donePacket?.type==='done','both actual worker packets required');
    requireValue(paperPacket.requestId===expected.requestId&&donePacket.requestId===expected.requestId,'stale request packet');
    analytic=paperPacket.analytic;spec=paperPacket.spec;binding=paperPacket.binding;operation=binding?.operation;
    requireValue(analytic?.schema==='kaopu-analytic-sewing-pattern@1'&&analytic.units==='mm'&&spec?.schema==='kaopu-sewing-graph@1'&&spec.units==='mm','paper/mesh schema or units');
    same(spec.materials,[{id:'digital-muslin',densityKgM2:.2,stretchCompliance:1e-7,bendCompliance:20,calibrated:false}],'inherited material constants changed');
  });
  check('protected-source-geometry-and-independent-dimensions',()=>{
    same(analytic.panels.map(p=>p.id),base.panels.map(p=>p.id),'source panel order');same(analytic.bodyCm,base.bodyCm,'source body changed');same(analytic.derivedBodyCm,base.derivedBodyCm,'derived source body changed');same(analytic.design,base.design,'source high-level design changed');same(analytic.darts,base.darts,'source darts changed');
    changes=[];
    for(const original of base.panels){
      const p=analytic.panels.find(v=>v.id===original.id),hem=Math.min(...original.verticesMm.map(v=>v[1]));
      same(p.placement,original.placement,'protected source placement');same(p.boundary,original.boundary,'source boundary edge circuit');same(p.edges.map(edgeControl),original.edges.map(edgeControl),'protected curve controls or edge references');same(p.grain,original.grain,'grain changed');
      requireValue(p.verticesMm.length===original.verticesMm.length,'source material vertex count changed');
      original.verticesMm.forEach((v,i)=>{
        const target=[...v],isTip=original.id==='skirt_back'&&i===19,isHem=/^skirt_/.test(original.id)&&v[1]===hem;
        if(isHem||isTip){target[1]-=expected.deltaMm;if(isTip)target[1]+=expected.slitDeltaMm;changes.push({panelId:original.id,vertex:i,fromMm:[...v],toMm:target});}
        same(p.verticesMm[i],target,'unexpected source material point '+p.id+':'+i);
      });
    }
    same(analytic.seams.map(seamIdentity),base.seams.map(seamIdentity),'source seam identities changed');
    for(let i=0;i<base.seams.length;i++){
      const a=analytic.seams[i],b=base.seams[i],increase=['s6','s9'].includes(b.id)?expected.deltaMm:0;
      near(a.lengthAMm,b.lengthAMm+increase,'source seam A length');near(a.lengthBMm,b.lengthBMm+increase,'source seam B length');
      const withoutProjected=g=>g&&Object.fromEntries(Object.entries(g).filter(([k])=>!k.startsWith('projectedLength')));same(withoutProjected(a.gathering),withoutProjected(b.gathering),'source gathering coefficients/directions');
    }
    requireValue(!analytic.seams.some(s=>[s.a,s.b].some(r=>r.panelId==='skirt_back'&&[18,19].includes(r.edge))),'triangular opening sewn closed');
    same(analytic.interfaces,base.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='top'),'unvalidated high-level interface retained');
    const before=dimensions(base),after=dimensions(analytic);near(after.frontLengthMm,before.frontLengthMm+expected.deltaMm,'front length');near(after.backLengthMm,before.backLengthMm+expected.deltaMm,'back length');near(after.slitDepthMm,before.slitDepthMm+expected.slitDeltaMm,'independent opening depth');near(after.slitMouthWidthMm,20,'opening mouth');
    for(const phase of ['before','after'])for(const [key,value] of Object.entries(phase==='before'?before:after))near(paperPacket.measurements?.[phase]?.[key],value,'packet measured '+phase+' '+key);
    evidence.measurements={before,after};
  });
  check('operation-provenance-and-no-stale-physical-pass',()=>{
    const expectedOperation={schema:OP_SCHEMA,type:'changeSkirtLengthAndOpening',sourcePresetId:'S03',deltaMm:expected.deltaMm,slitDeltaMm:expected.slitDeltaMm,units:'mm',requestId:expected.requestId,expectedRevision:expected.expectedRevision,openingKind:'existing triangular material cutout',independentDimensions:true,preserves:['waistband','waist-seam geometry','darts','hip curves','body','placements','all seam references','20 mm opening mouth width'],changedVertices:changes};
    same(operation,expectedOperation,'operation does not describe requested source edits');
    history=[{type:operation.type,revision:expected.expectedRevision+1,deltaMm:expected.deltaMm,slitDeltaMm:expected.slitDeltaMm,changedVertices:changes,materialDimensionsChanged:expected.deltaMm!==0||expected.slitDeltaMm!==0,placementChanged:false}];
    const edits=analytic.source.continuationEdits;
    requireValue(edits.revision===expected.expectedRevision+1&&edits.baseRecipeHash===BASE_RECIPE&&edits.baseGeometryHash===BASE_GEOMETRY&&edits.originalBodyModified===false&&edits.requiresFreshDrape===true,'source/revision/freshness provenance');
    same(edits.operations,[expectedOperation],'paper operation envelope');same(edits.history,history,'paper edit history');
    requireValue(analytic.validation.physicalFitStatus==='not-run'&&analytic.validation.originalRulesRechecked===false&&analytic.officialOracleCm===null,'old physical PASS/oracle inherited');
    requireValue(paperPacket.protectedGeometryPassed===true&&paperPacket.independentDimensionsPassed===true&&paperPacket.geometryChanged===(expected.deltaMm!==0||expected.slitDeltaMm!==0),'operation status not bound to requested dimensions');
  });
  check('independently-recomputed-actual-hashes',()=>{
    // The inherited bridge hashes stitches in editor lexical order before the
    // operation restores the original solver order (checked independently above).
    const geometry={panels:analytic.panels.map(p=>({id:p.id,verticesMm:p.verticesMm,edges:p.edges.map(e=>({index:e.index,endpoints:e.endpoints,kind:e.kind,controlPointsMm:e.controlPointsMm??null,arc:e.arc??null})),placement:p.placement})),seams:analytic.seams.map(s=>({id:s.id,a:s.a,b:s.b,gathering:s.gathering})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
    evidence.hashes={basePaperSHA256:hash(basePaperText),paperSHA256:hash(JSON.stringify(analytic)),operationSHA256:digest(operation),recipeHash:digest({bodyCm:base.bodyCm,design:base.design,baseRecipeHash:BASE_RECIPE,operations:[operation],editHistory:history}),geometryHash:digest(geometry),materialSHA256:digest(materialProjection(spec))};
    for(const key of ['paperSHA256','operationSHA256','recipeHash','materialSHA256','basePaperSHA256'])requireValue(binding[key]===evidence.hashes[key],'recomputed '+key+' differs from binding');
    requireValue(analytic.recipeHash===evidence.hashes.recipeHash&&analytic.geometryHash===evidence.hashes.geometryHash,'derived paper identity hash');
  });
  check('actual-packet-record-binding-chain-and-person',()=>{
    same(binding.person,PERSON,'frozen native person');requireValue(binding.presetId==='S03'&&binding.basePresetId==='S03'&&binding.nativeAnchor===ANCHOR&&binding.patternSizingOrigin==='EXPLICIT_LENGTH_OPENING_EDIT_NOT_CHANGED_PERSON','source preset/person sizing contract');
    const copies=[spec.source.nativeBinding,donePacket.binding,donePacket.spec.source.nativeBinding,donePacket.record.nativeBinding,donePacket.record.snapshot.spec.source.nativeBinding];
    copies.forEach((value,i)=>same(value,binding,'packet/record binding location '+i));
    same(donePacket.analytic,analytic,'paper changed between paper and done');
    for(const material of [donePacket.spec,donePacket.record.snapshot.spec]){
      same(materialProjection(material),materialProjection(spec),'rest material changed between generation and completed trial');
      same(material.materials,spec.materials,'material constants changed during solve');same(material.seams.map(s=>s.sourceSeam),spec.seams.map(s=>s.sourceSeam),'source seam provenance changed during solve');
      same(material.panels.map(p=>({edges:p.edges,boundary:p.boundary,originalPlacement:p.source.originalPlacement})),spec.panels.map(p=>({edges:p.edges,boundary:p.boundary,originalPlacement:p.source.originalPlacement})),'material boundaries or source placements changed during solve');
      // Inherited R07 assembly moves each flat panel in world Z to the exact
      // body's envelope. This is recorded separately from protected paper
      // placement and must not be mistaken for a change of rest material.
      const preparation=material.source.r07Preparation;
      requireValue(preparation?.restUVChanged===false&&preparation.bodyGeometryChanged===false,'assembly preparation provenance');
      for(let i=0;i<material.panels.length;i++){
        const before=spec.panels[i],after=material.panels[i],move=preparation.rigidMoves.find(v=>v.panel===before.id);
        same(after.placement.rigidBasis,before.placement.rigidBasis,'assembly changed source rotation');
        same(after.placement.translationMm.slice(0,2),before.placement.translationMm.slice(0,2),'assembly changed protected XY placement');
        requireValue(point(after.placement.translationMm,3)&&move,'assembly move missing or non-finite');
        same(move.originalTranslationMm,before.placement.translationMm,'assembly original placement');same(move.assemblyTranslationMm,after.placement.translationMm,'assembly recorded placement');
      }
      requireValue(material.source.recipeHash===evidence.hashes.recipeHash&&material.source.geometryHash===evidence.hashes.geometryHash,'mesh source geometry identity');
    }
    same(spec.source.bodyMeasurements,base.bodyCm,'mesh uses another body measurement set');
    requireValue(spec.source.bodyId==='common-native-default-r04'&&donePacket.record.sourceBody==='common-native-default-r04','solver body changed');
    if(previousBinding){same(previousBinding.person,PERSON,'previous person differs');requireValue(binding.paperSHA256!==previousBinding.paperSHA256,'previous paper/result reused');const old=previousBinding.operation;if(!old||old.deltaMm!==expected.deltaMm||old.slitDeltaMm!==expected.slitDeltaMm)requireValue(binding.materialSHA256!==previousBinding.materialSHA256,'previous rest mesh reused for changed material dimensions');}
    return {bindingLocationsChecked:copies.length+1};
  });
  check('source-conforming-material-triangulation-and-seams',()=>{evidence.mesh=inspectMesh(spec,analytic);return {panels:evidence.mesh.panels.length,sourceSeams:evidence.mesh.sourceSeams,stitchPairs:evidence.mesh.stitchPairs};});
  check('complete-finite-actual-result-with-unchanged-gates',()=>{
    const n=evidence.mesh.vertices,record=donePacket.record;
    requireValue(Array.isArray(paperPacket.positionsM)&&paperPacket.positionsM.length===n*3&&paperPacket.positionsM.every(Number.isFinite),'initial positions do not match actual material order/count');
    requireValue(Array.isArray(record.positionsMm)&&record.positionsMm.length===n&&record.positionsMm.every(v=>point(v,3)),'completed positions do not match actual material order/count');
    same([...record.activeSeams].sort(),base.seams.map(s=>s.id).sort(),'completed record omits source seams');
    requireValue(record.temporaryPins.length===0&&record.productionReady===false,'temporary pins remain or production status overstated');
    same(record.staticGate.thresholds,{maximumTensionPercent:15,maximumCompressionPercent:15,maximumNeedleGapMm:.25,minimumBodyDistanceMm:-.05,maximumWholeSeamSeparationMm:.25},'physical gate thresholds changed');
    requireValue(typeof record.staticGate.passed==='boolean'&&Array.isArray(record.staticGate.failures),'actual physical gate absent');
    return {actualStaticPassed:record.staticGate.passed,actualStaticFailures:record.staticGate.failures,actualSelfIntersectionPairs:donePacket.intersections.selfStrictTriangleIntersectionCount,positionsSHA256:hash(JSON.stringify(record.positionsMm))};
  });
  evidence.passed=true;return evidence;
}
