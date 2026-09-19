const finite = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(name + ':finite_number_required');
  return v;
};

export function candidateDevelopmentStages(profile, ageDph) {
  finite(ageDph, 'ageDph');
  if (ageDph < 0) throw new Error('ageDph:nonnegative_required');
  return profile.developmentStages
    .filter(stage => {
      const lo = stage.ageRangeDph[0], hi = stage.ageRangeDph[1];
      return ageDph >= lo && (hi == null || ageDph <= hi);
    })
    .map(stage => ({ stage: stage.stage, label: stage.label, traits: structuredClone(stage.traits) }));
}

export function measuredMorphometricsFromSL(profile, standardLengthMm) {
  finite(standardLengthMm, 'standardLengthMm');
  if (standardLengthMm <= 0) throw new Error('standardLengthMm:positive_required');
  return {
    status: 'source_regression_only',
    standardLengthMm,
    eyeDiameterMm: 0.1 * standardLengthMm + 0.2,
    snoutLengthMm: 0.1 * standardLengthMm + 0.1,
    sourceId: 'ROUX2019_DVDY46'
  };
}

export function exactMeasuredAnchor(profile, ageDph) {
  finite(ageDph, 'ageDph');
  const point = profile.measuredAnchors.find(p => p.ageDph === ageDph);
  if (!point) return { status: 'no_exact_measured_anchor', ageDph };
  return { status: 'measured_anchor', ...structuredClone(point) };
}

export function studyLocalGrowthRate(profile, ageDph) {
  finite(ageDph, 'ageDph');
  const rows = profile.studyLocalGrowthRates.filter(r => ageDph >= r.ageRangeDph[0] && ageDph <= r.ageRangeDph[1]);
  if (rows.length === 0) return { status: 'unsupported_outside_reported_rate_window', ageDph };
  if (rows.length > 1) throw new Error('profile:overlapping_growth_rate_windows');
  return { status: 'reported_mean_rate', ageDph, ...structuredClone(rows[0]) };
}

export function totalLengthFeedingEvidence(profile, ageDph) {
  finite(ageDph, 'ageDph');
  const p = profile.separateTotalLengthEvidence.find(x => x.ageDph === ageDph);
  if (!p) return { status: 'no_exact_total_length_feeding_measurement', ageDph };
  return { status: 'measured_total_length_feeding_point', ...structuredClone(p) };
}

export function adultBound(profile) {
  return { status: 'adult_bound_not_age_curve', ...structuredClone(profile.adultBounds) };
}

export function lifecycleQuery(profile, query) {
  const ageDph = finite(query.ageDph, 'query.ageDph');
  return {
    ageDph,
    exactAnchor: exactMeasuredAnchor(profile, ageDph),
    stageCandidates: candidateDevelopmentStages(profile, ageDph),
    growthRate: studyLocalGrowthRate(profile, ageDph),
    behaviorEvidence: profile.behaviorEvidence.filter(b => ageDph >= b.ageRangeDph[0] && ageDph <= b.ageRangeDph[1]).map(x => structuredClone(x)),
    featureTiming: profile.featureTiming.filter(f => ageDph >= f.ageRangeDph[0] && (f.ageRangeDph[1] == null || ageDph <= f.ageRangeDph[1])).map(x => structuredClone(x)),
    note: 'Stage ranges overlap in the source. Candidate stages are returned instead of inventing a single deterministic stage.'
  };
}

export function assertNoUnsafeBlend(profile) {
  const bad = profile.conflicts.filter(c => c.status !== 'RESOLVED');
  return {
    safeForFullAgeLengthInterpolation: bad.length === 0 && profile.scope.adultAgeLengthCurveAvailable === true,
    unresolvedConflicts: structuredClone(bad),
    adultAgeLengthCurveAvailable: profile.scope.adultAgeLengthCurveAvailable
  };
}