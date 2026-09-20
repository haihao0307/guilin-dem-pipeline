/**
 * FISH-R1-T01 — source-independent largemouth-bass head/mouth kernel.
 * v0.7: replaces the stepped oral cut with a narrow analytic lateral slit,
 * preserving cheek and orbital continuity while keeping cross-mouth lips,
 * jaw motion and opercular overlap as separate generated structures.
 *
 * Coordinate frame:
 *   x: lateral, positive to fish right
 *   y: vertical, positive dorsal/up
 *   u: normalized longitudinal coordinate, tail=0, snout=1
 * All values are normalized by the observed source body length.
 * The reference GLB is observation input only; no source vertices, texture
 * pixels, skin tracks or source topology are embedded here.
 */

export const BLACK_BASS_R1_CARD = Object.freeze({
  schema: 'kaopu.fish.black-bass.head-mouth/0.7',
  taskId: 'FISH-R1-T01',
  species: Object.freeze({ scientific: 'Micropterus salmoides', common: 'Largemouth Bass', habitatIdentity: 'freshwater' }),
  source: Object.freeze({
    referenceId: 'FISH-REF-001',
    sha256: 'c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64',
    originalBytes: 18644040,
    sourceMeshRuntimeDependency: false,
    sourceTextureRuntimeDependency: false,
    sourceRigRuntimeDependency: false,
    sourceAnimationRuntimeDependency: false
  }),
  frame: Object.freeze({ unit: 'bodyLength', axes: Object.freeze({ x: 'lateral-right', y: 'dorsal-up', u: 'tail-to-snout' }) }),
  eyes: Object.freeze({
    leftCenter: Object.freeze([-0.0461234703, 0.0301874735, 0.8773876841]),
    rightCenter: Object.freeze([0.0459188562, 0.0301627850, 0.8773354142]),
    radii: Object.freeze([0.0092, 0.0228, 0.0223]),
    observedExtents: Object.freeze([0.0186357513, 0.0464652615, 0.0453004358])
  }),
  jaw: Object.freeze({
    hinge: Object.freeze([0.0, -0.0745099834, 0.8497990694]),
    observedTip: Object.freeze([0.0, -0.0118980916, 1.0]),
    envelope: Object.freeze([
      Object.freeze([0.500000000, 0.006000000, -0.093000000, -0.098000000]),
      Object.freeze([0.550000000, 0.012000000, -0.090000000, -0.101000000]),
      Object.freeze([0.610000000, 0.020000000, -0.087000000, -0.100000000]),
      Object.freeze([0.640000000, 0.028000000, -0.083000000, -0.107000000]),
      Object.freeze([0.670000000, 0.034000000, -0.080000000, -0.112000000]),
      Object.freeze([0.700000000, 0.040000000, -0.077000000, -0.111000000]),
      Object.freeze([0.740091081, 0.048752301, -0.074307736, -0.102761050]),
      Object.freeze([0.761557604, 0.064950643, -0.046707035, -0.100628629]),
      Object.freeze([0.783024128, 0.068574764, -0.039459786, -0.099138125]),
      Object.freeze([0.804490652, 0.068338397, -0.023820027, -0.097922537]),
      Object.freeze([0.825957175, 0.065607679, -0.014315152, -0.095198912]),
      Object.freeze([0.847423699, 0.061820079, -0.013729200, -0.092665877]),
      Object.freeze([0.868890223, 0.059180415, -0.010000000, -0.085723487]),
      Object.freeze([0.890356746, 0.057102907, -0.009000000, -0.081923318]),
      Object.freeze([0.911823270, 0.055861743, -0.006000000, -0.075100269]),
      Object.freeze([0.933289794, 0.049184799, -0.004000000, -0.067280988]),
      Object.freeze([0.954756318, 0.042624607, -0.003000000, -0.058016849]),
      Object.freeze([0.976222841, 0.032495912, -0.002500000, -0.044564112]),
      Object.freeze([0.997689365, 0.021792835, -0.004306105, -0.030513073])
    ]),
    safeOpenRangeRad: Object.freeze([0, 0.30])
  }),
  cranialProfile: Object.freeze([
    Object.freeze([0.220000000, 0.034000000, 0.060000000, -0.070000000]),
    Object.freeze([0.300000000, 0.041000000, 0.080000000, -0.080000000]),
    Object.freeze([0.360000000, 0.047000000, 0.100000000, -0.088000000]),
    Object.freeze([0.400000000, 0.050000000, 0.108000000, -0.093000000]),
    Object.freeze([0.430000000, 0.052000000, 0.111000000, -0.097000000]),
    Object.freeze([0.470000000, 0.059000000, 0.112000000, -0.104000000]),
    Object.freeze([0.510000000, 0.064000000, 0.127000000, -0.103000000]),
    Object.freeze([0.550000000, 0.067600000, 0.139000000, -0.103000000]),
    Object.freeze([0.600000000, 0.067650000, 0.144000000, -0.105000000]),
    Object.freeze([0.650000000, 0.066000000, 0.150000000, -0.108000000]),
    Object.freeze([0.700000000, 0.073500000, 0.149000000, -0.115000000]),
    Object.freeze([0.725000000, 0.074400000, 0.145000000, -0.105000000]),
    Object.freeze([0.750000000, 0.072800000, 0.126000000, -0.103000000]),
    Object.freeze([0.775000000, 0.072000000, 0.127000000, -0.101000000]),
    Object.freeze([0.800000000, 0.070400000, 0.120000000, -0.098000000]),
    Object.freeze([0.825000000, 0.067000000, 0.114000000, -0.096000000]),
    Object.freeze([0.850000000, 0.061900000, 0.095000000, -0.090000000]),
    Object.freeze([0.875000000, 0.058600000, 0.082000000, -0.086000000]),
    Object.freeze([0.900000000, 0.057500000, 0.071000000, -0.079000000]),
    Object.freeze([0.925000000, 0.054400000, 0.060000000, -0.070000000]),
    Object.freeze([0.950000000, 0.046100000, 0.044000000, -0.061000000]),
    Object.freeze([0.975000000, 0.035300000, 0.025000000, -0.047000000]),
    Object.freeze([0.997689365, 0.012000000, 0.005000000, -0.025000000])
  ]),
  cavityProfile: Object.freeze([
    Object.freeze([0.795, 0.051, -0.018, -0.055]),
    Object.freeze([0.825, 0.052, -0.014, -0.053]),
    Object.freeze([0.855, 0.049, -0.009, -0.049]),
    Object.freeze([0.888, 0.044, -0.004, -0.043]),
    Object.freeze([0.922, 0.037, 0.000, -0.035]),
    Object.freeze([0.954, 0.027, 0.002, -0.025]),
    Object.freeze([0.984, 0.011, 0.003, -0.011])
  ]),
  maxillary: Object.freeze({
    rearAnchor: Object.freeze([0.0562, -0.0379, 0.8265]),
    frontAnchor: Object.freeze([0.0320, -0.0040, 0.9580]),
    evidence: 'engineering candidate constrained by institutional identification guidance; precise allowance not yet a biological measurement'
  }),
  operculum: Object.freeze({
    centerYU: Object.freeze([-0.004, 0.692]),
    radiiYU: Object.freeze([0.090, 0.102]),
    evidence: 'engineering shell fitted to source side-volume and fixed-view opercular boundary; not a biological plate-thickness measurement'
  }),
  lipCurves: Object.freeze({
    u: Object.freeze([0.812, 0.840, 0.870, 0.900, 0.930, 0.960, 0.985, 0.9985]),
    lateral: Object.freeze([0.061, 0.061, 0.059, 0.055, 0.048, 0.037, 0.020, 0.003]),
    upperY: Object.freeze([-0.021, -0.016, -0.011, -0.007, -0.003, 0.000, 0.000, -0.002]),
    lowerY: Object.freeze([-0.030, -0.026, -0.022, -0.017, -0.013, -0.010, -0.010, -0.012]),
    radiusNormal: Object.freeze([0.0042, 0.0040, 0.0038, 0.0035, 0.0031, 0.0027, 0.0020, 0.0008]),
    radiusLateral: Object.freeze([0.0021, 0.0021, 0.0020, 0.0019, 0.0017, 0.0015, 0.0011, 0.0005])
  }),
  evidenceBoundary: Object.freeze({
    sourceFileFacts: Object.freeze(['body bounds', 'eye volumes', 'jaw_22 bind pivot', 'jaw-weighted low-dimensional envelope', 'non-fin cranial section extents']),
    naturalFacts: Object.freeze(['adult largemouth-bass upper jaw extends behind rear eye margin']),
    engineeringCandidates: Object.freeze(['mouth-roof boundary', 'maxillary posterior allowance', 'operculum shell thickness', 'lip sweep radii', 'superellipse exponent']),
    visualAcceptance: false,
    productionReady: false
  })
});
