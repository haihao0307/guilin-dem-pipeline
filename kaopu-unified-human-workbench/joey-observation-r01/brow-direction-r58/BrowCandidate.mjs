// Original artistic controls for the existing surface-bound eyebrow adapter.
// No photographic pixels, image target coordinates, new fibre source or new head.
export const SPEC = {
  schema: 'native-brow-direction-r58/1',
  fixedIdentity: 'R57 lower-face candidate; R52/R54 remain the default',
  hypothesis: 'Reduce the strong central arch, move the modest crest outward, and taper the outer band into a lower tail. Keep the current eyebrow source, density, material and root-binding method.',
  expectedBaselineCenter: [0.013677520543367048, 0.02070214564972197, -0.02106164907674558],
  expectedBaselineWidth: [0.0031203730227873025, -0.0018400133471860002, 0.0011977208506788843],
  changes: {
    targetCenterYCoeff: [0.0137, 0.0011542489500491495, 0.012665794229810252, -0.014620043179859401],
    targetHalfWidthCoeff: [0.0027, 0.0011, -0.0033]
  },
  source: 'Existing BROW_PROFILE read by MakeHumanBrows.mapPoint/mapBrowField; old AppearanceR52 outerLift is unused and is not changed.',
  interpretation: 'Lengths are authored current-head local coordinates, not calibrated measurements of the photographed person. E04/U07 inform direction; U05/profile are geometry views, not restored new reference photos.'
};
export function poly(coefficients, t) { return coefficients.reduce((sum, value, i) => sum + value * t ** i, 0); }
export function validateBaseline(profile) {
  if (JSON.stringify(profile.targetCenterYCoeff) !== JSON.stringify(SPEC.expectedBaselineCenter) || JSON.stringify(profile.targetHalfWidthCoeff) !== JSON.stringify(SPEC.expectedBaselineWidth)) throw Error('Unexpected original eyebrow profile');
  if (profile.schema !== 'native-brow-band-profile/1') throw Error('Unexpected brow source schema');
}
export async function withCandidateProfile(profile, construct) {
  validateBaseline(profile);
  const saved = structuredClone(profile);
  try {
    Object.assign(profile, structuredClone(SPEC.changes));
    return await construct();
  } finally {
    for (const key of Object.keys(profile)) delete profile[key];
    Object.assign(profile, saved);
  }
}
