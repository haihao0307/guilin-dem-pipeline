const LENGTH_DEFINITIONS = new Set(['TL','FL','SL']);

export function assertFiniteNumber(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name}:finite_number_required`);
}

export function validateEvidencePoint(p, index = 0) {
  if (!p || typeof p !== 'object') throw new Error(`point[${index}]:object_required`);
  assertFiniteNumber(p.ageDays, `point[${index}].ageDays`);
  assertFiniteNumber(p.lengthMm, `point[${index}].lengthMm`);
  if (p.ageDays < 0 || p.lengthMm <= 0) throw new Error(`point[${index}]:positive_domain_required`);
  if (!LENGTH_DEFINITIONS.has(p.lengthDefinition)) throw new Error(`point[${index}].lengthDefinition:TL_FL_SL_required`);
  if (!p.evidence || typeof p.evidence.sourceId !== 'string' || !p.evidence.sourceId.trim()) {
    throw new Error(`point[${index}].evidence.sourceId:required`);
  }
  return p;
}

function validateCurve(name, curve) {
  if (!Array.isArray(curve) || curve.length < 2) throw new Error(`${name}:at_least_two_samples`);
  let lastU = -Infinity;
  for (let i=0;i<curve.length;i++) {
    const p = curve[i];
    assertFiniteNumber(p.u, `${name}[${i}].u`);
    assertFiniteNumber(p.v, `${name}[${i}].v`);
    if (p.u < 0 || p.u > 1 || p.u <= lastU) throw new Error(`${name}:u_must_strictly_increase_0_1`);
    lastU = p.u;
  }
}

export function validateMorphology(m) {
  if (!m || typeof m !== 'object') throw new Error('morphology:object_required');
  validateCurve('side.dorsal', m.side?.dorsal);
  validateCurve('side.ventral', m.side?.ventral);
  validateCurve('top.leftHalfWidth', m.top?.leftHalfWidth);
  validateCurve('top.rightHalfWidth', m.top?.rightHalfWidth);
  const n = m.side.dorsal.length;
  if (m.side.ventral.length !== n || m.top.leftHalfWidth.length !== n || m.top.rightHalfWidth.length !== n) {
    throw new Error('morphology:all_primary_curves_same_sample_count');
  }
  for (let i=0;i<n;i++) {
    const u = m.side.dorsal[i].u;
    if (Math.abs(m.side.ventral[i].u-u)>1e-12 || Math.abs(m.top.leftHalfWidth[i].u-u)>1e-12 || Math.abs(m.top.rightHalfWidth[i].u-u)>1e-12) {
      throw new Error('morphology:primary_curve_u_grid_must_match');
    }
    if (m.side.dorsal[i].v < m.side.ventral[i].v) throw new Error(`morphology:negative_body_height_at_${i}`);
    if (m.top.leftHalfWidth[i].v < 0 || m.top.rightHalfWidth[i].v < 0) throw new Error(`morphology:negative_half_width_at_${i}`);
  }
  for (const a of m.anchors ?? []) {
    if (!['eye','mouth','gill','fin','skeleton','other'].includes(a.kind)) throw new Error(`anchor:${a.id}:kind_invalid`);
    assertFiniteNumber(a.u, `anchor:${a.id}.u`);
    assertFiniteNumber(a.sideV, `anchor:${a.id}.sideV`);
    assertFiniteNumber(a.topV, `anchor:${a.id}.topV`);
    if (a.u < 0 || a.u > 1) throw new Error(`anchor:${a.id}.u_out_of_range`);
  }
  return m;
}

function lerp(a,b,t){ return a + (b-a)*t; }

function interpolateCurve(c0,c1,t){
  if (c0.length !== c1.length) throw new Error('curve:length_mismatch');
  return c0.map((p,i)=>{
    if (Math.abs(p.u-c1[i].u)>1e-12) throw new Error('curve:u_grid_mismatch');
    return {u:p.u,v:lerp(p.v,c1[i].v,t)};
  });
}

function anchorMap(arr){ return new Map((arr??[]).map(a=>[a.id,a])); }

function interpolateAnchors(a0,a1,t){
  const m0=anchorMap(a0),m1=anchorMap(a1),ids=new Set([...m0.keys(),...m1.keys()]);
  const out=[];
  for(const id of ids){
    const x=m0.get(id),y=m1.get(id);
    // A feature cannot be invented between measurements. If one endpoint is unknown/absent,
    // keep it explicitly unavailable until both endpoints contain the same feature identity.
    if(!x || !y) { out.push({id,status:'unknown_between_evidence_points'}); continue; }
    if(x.kind!==y.kind) throw new Error(`anchor:${id}:kind_changed_between_points`);
    out.push({
      id,kind:x.kind,status:'measured_interpolation',
      u:lerp(x.u,y.u,t),sideV:lerp(x.sideV,y.sideV,t),topV:lerp(x.topV,y.topV,t),
      sizeRel:(x.sizeRel==null||y.sizeRel==null)?null:lerp(x.sizeRel,y.sizeRel,t)
    });
  }
  return out;
}

export function createLifeSeries(points){
  if(!Array.isArray(points)||points.length<2) throw new Error('lifeSeries:at_least_two_evidence_points');
  const copy=points.map((p,i)=>validateEvidencePoint(structuredClone(p),i)).sort((a,b)=>a.ageDays-b.ageDays);
  const def=copy[0].lengthDefinition;
  for(let i=0;i<copy.length;i++){
    if(copy[i].lengthDefinition!==def) throw new Error('lifeSeries:mixed_length_definitions_forbidden');
    if(i>0 && copy[i].ageDays<=copy[i-1].ageDays) throw new Error('lifeSeries:age_days_must_strictly_increase');
    validateMorphology(copy[i].morphology);
  }
  return Object.freeze({lengthDefinition:def,points:copy});
}

export function sampleLifeSeries(series, ageDays){
  assertFiniteNumber(ageDays,'ageDays');
  const pts=series.points;
  if(ageDays<pts[0].ageDays || ageDays>pts.at(-1).ageDays) {
    return {status:'unsupported_outside_evidence_range',ageDays};
  }
  const exact=pts.find(p=>p.ageDays===ageDays);
  if(exact) return {status:'measured_point',ageDays,lengthMm:exact.lengthMm,lengthDefinition:exact.lengthDefinition,morphology:structuredClone(exact.morphology),evidence:[exact.evidence]};
  let hi=1; while(pts[hi].ageDays<ageDays) hi++;
  const lo=hi-1,a=pts[lo],b=pts[hi],t=(ageDays-a.ageDays)/(b.ageDays-a.ageDays);
  const morphology={
    side:{
      dorsal:interpolateCurve(a.morphology.side.dorsal,b.morphology.side.dorsal,t),
      ventral:interpolateCurve(a.morphology.side.ventral,b.morphology.side.ventral,t)
    },
    top:{
      leftHalfWidth:interpolateCurve(a.morphology.top.leftHalfWidth,b.morphology.top.leftHalfWidth,t),
      rightHalfWidth:interpolateCurve(a.morphology.top.rightHalfWidth,b.morphology.top.rightHalfWidth,t)
    },
    anchors:interpolateAnchors(a.morphology.anchors,b.morphology.anchors,t)
  };
  return {
    status:'interpolated_between_measured_points',ageDays,
    lengthMm:lerp(a.lengthMm,b.lengthMm,t),lengthDefinition:series.lengthDefinition,
    morphology,evidence:[a.evidence,b.evidence]
  };
}

export function physicalSection(sample,uIndex){
  const d=sample.morphology.side.dorsal[uIndex].v;
  const v=sample.morphology.side.ventral[uIndex].v;
  const l=sample.morphology.top.leftHalfWidth[uIndex].v;
  const r=sample.morphology.top.rightHalfWidth[uIndex].v;
  const L=sample.lengthMm;
  return {
    u:sample.morphology.side.dorsal[uIndex].u,
    bodyHeightMm:(d-v)*L,
    bodyWidthMm:(l+r)*L,
    dorsalFromAxisMm:d*L,
    ventralFromAxisMm:v*L
  };
}
