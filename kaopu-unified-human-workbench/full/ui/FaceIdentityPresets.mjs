/**
 * State-local application of the existing native R03.1 GNM face identities.
 * Coefficients below are copied exactly from Catalogue.mjs, not fitted anew.
 * A local snapshot avoids importing the unrelated R03 -> R02 body catalogue.
 * tests/face-identity-presets.mjs checks every coefficient and the source hash.
 * This module does not choose a body, replace geometry, or change render owners.
 * The caller must archive the current state before applying it to provide Undo.
 * State tests are not geometric, browser, likeness, or anatomical acceptance.
 */
export const GNM_IDENTITY_DIMENSIONS = 253;
export const FACE_IDENTITY_SOURCE = Object.freeze({
  path: 'full/shape-r031/Catalogue.mjs',
  exportName: 'IDENTITIES',
  sha256: '784e1b108121b2b125e9616fad1d41e0bbb5e5e1ac8f4bbf2f81bfa0787c78cb',
});

// Exact source arrays, before the original square_jaw application gain of 0.80.
const nativeIdentities = Object.freeze([
  Object.freeze({id: "long_narrow", label: "长脸窄颌·长鼻薄唇", gnmIdentity: Object.freeze([
    0.027542, -0.203483, 0.289258, 0.172025, -0.025487, -0.006131, 2.435782, 0.607052, -0.096094, 0.405399, 0.263009, 0.310207,
    -0.302813, 0.44371, 1.345362, -1.298759, -0.381799, -0.481717, 1.032024, -0.028955, 0.326028, 0.429106, -2.204999, 1.034105,
    0.088609, -0.198924, 0.111252, 0.613439, -0.213059, 0.268318, 0.130453, -0.298517, 0.102551, 0.384913, 0.351239, -0.529113,
    0.503865, -0.051486, 0.349556, 0.434524, 0.143304, 0.201971, -0.423551, 0.580631, 0.089424, 0.302417, 0.171996, 0.336754,
    -0.074936, -0.073285, -0.136676, 0.078683, 0.22887, 0.297994, 0.25684, 0.445649, -0.734873, 0.099373, -0.045331, 0.65349,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0,
  ])}),
  Object.freeze({id: "short_broad", label: "短脸宽颧·短鼻丰唇", gnmIdentity: Object.freeze([
    -0.089331, 0.190095, -0.152821, -0.886568, -0.056983, -0.025753, -2.612994, -1.052555, 0.479541, 0.245658, 0.924341, -0.347675,
    -0.079041, 0.644292, -0.34896, 0.53847, 0.340973, 0.619426, -0.323623, 0.441845, -0.416552, -0.105884, 1.098255, -0.485651,
    0.276635, -0.451212, 0.211571, -0.597897, -0.181021, -0.118064, -0.246756, 0.923538, -0.301386, -0.034357, -0.291528, 0.213013,
    -0.416138, 0.38399, -0.324312, 0.458354, -0.212571, -0.336535, 0.343663, -0.260971, -0.536346, -0.20456, 0.188747, -0.071925,
    0.125932, 0.317336, -0.129353, -0.206435, 0.324009, 0.012072, -0.179723, -0.097832, 0.295994, -0.128822, -0.114075, -0.333172,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0,
  ])}),
  Object.freeze({id: "square_jaw", label: "方颌低眉·阔口直鼻", gnmIdentity: Object.freeze([
    -0.358345, -0.044682, 0.345067, 0.193648, 0.073207, 0.412815, -0.620093, 1.177457, 0.133045, -0.946852, -1.53179, 0.559831,
    -0.796616, -1.867219, -1.205921, 0.054419, -0.087652, -0.367651, 1.022306, 0.577874, -0.919246, 0.526586, 0.651001, -1.225015,
    -0.284303, -0.51328, 0.541021, -0.280513, 0.539663, -0.210885, -0.695105, 1.406144, 0.133162, -0.817123, -0.632368, -0.049903,
    -0.258263, -0.731872, -0.640115, -0.024824, -0.646571, -0.151101, 0.787773, -0.733159, 0.389424, -0.70518, 0.422413, -0.967293,
    0.023743, 0.796197, -0.16345, -0.056938, -0.336415, -0.293287, -0.322396, -0.347451, 0.38451, 0.079145, 0.11965, -0.773155,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0,
  ])}),
 ]);

const descriptions = Object.freeze({
  long_narrow: '原 R03.1 长窄脸身份：窄颌、长鼻、薄唇，眼距较近。',
  short_broad: '原 R03.1 短宽脸身份：宽颧、短鼻、丰唇，眼距较宽。',
  square_jaw: '原 R03.1 方颌身份：方颌、阔口、直鼻，沿用原 0.80 强度。',
});
const verification = '状态层保留身体参数；未做当前总台几何或浏览器验收，不保证身体顶点不变。';
const localChangesPolicy = '默认保留全部 Anny 局部参数；仅清除运行模型声明为 head-only 且匹配原头部规则的局部参数，混合头身参数保留。';
export const FACE_IDENTITIES = Object.freeze([
  Object.freeze({
    id: 'neutral',
    label: 'GNM 中性脸',
    description: '将 GNM 身份的 253 维系数归零；Anny 局部参数按 head-only 声明处理，默认全部保留；不是撤销。',
    source: Object.freeze({kind: 'gnm-zero-identity', coefficientScale: 0}),
    verification,
    localChangesPolicy,
  }),
  ...nativeIdentities.map(identity => Object.freeze({
    id: identity.id,
    label: identity.label,
    description: descriptions[identity.id],
    source: Object.freeze({
      ...FACE_IDENTITY_SOURCE,
      identityId: identity.id,
      coefficientScale: identity.id === 'square_jaw' ? 0.80 : 1,
    }),
    verification,
    localChangesPolicy,
  })),
]);

// The original Catalogue rule identifies candidates, not proof of head-only
// geometric support. Remove a key only if the live model also declares it
// head-only. Without that declaration no local parameter is removed.
const conflictingHeadLocal = /^(l-|r-)?(head|cheek|chin|nose|forehead|eye|eyebrows|mouth)/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Return a fully independent, face-edited copy of a current native state.
 * Only gnm.identity and explicitly declared head-only matching locals change.
 * Mixed head/body local parameters survive, even if their names match.
 * Keeping body state values is not proof that every body vertex is unchanged.
 * No owner is switched silently; integration must use an active GNM head layer.
 * Neutral is the native zero identity, never a substitute for an archived Undo.
 * @param {object} currentState A legal kaopu-common-person/rebuild-1 state.
 * @param {string} id One of FACE_IDENTITIES[].id.
 * @param {object} [options]
 * @param {Set<string>|string[]} [options.headOnlyAnnyLocalLabels] Live-model
 * declaration, normally controller.model.headTransfer.headOnlyAnnyLocalLabels.
 * Omit it to preserve all Anny localChanges rather than guess their support.
 */
export function applyFaceIdentity(currentState, id, options = {}) {
  const preset = FACE_IDENTITIES.find(candidate => candidate.id === id);
  if (!preset) throw new RangeError('Unknown native face identity: ' + String(id));
  if (!isRecord(options)) throw new TypeError('Face identity options must be an object');
  const declaredLabels = options.headOnlyAnnyLocalLabels;
  if (declaredLabels !== undefined &&
      !(declaredLabels instanceof Set) && !Array.isArray(declaredLabels)) {
    throw new TypeError('headOnlyAnnyLocalLabels must be a Set or array of strings');
  }
  const headOnlyLabels = new Set(declaredLabels);
  if ([...headOnlyLabels].some(label => typeof label !== 'string')) {
    throw new TypeError('headOnlyAnnyLocalLabels must contain only strings');
  }
  if (!isRecord(currentState) || currentState.schema !== 'kaopu-common-person/rebuild-1' ||
      !isRecord(currentState.gnm) || !Array.isArray(currentState.gnm.identity) ||
      currentState.gnm.identity.length !== GNM_IDENTITY_DIMENSIONS ||
      !currentState.gnm.identity.every(Number.isFinite) ||
      !isRecord(currentState.anny) || !isRecord(currentState.anny.localChanges)) {
    throw new TypeError('A legal kaopu-common-person/rebuild-1 state with 253 GNM identity coefficients is required');
  }
  const state = structuredClone(currentState);
  const identity = nativeIdentities.find(candidate => candidate.id === id);
  state.gnm.identity = identity
    ? identity.gnmIdentity.map(value => value * preset.source.coefficientScale)
    : Array(GNM_IDENTITY_DIMENSIONS).fill(0);
  for (const key of Object.keys(state.anny.localChanges)) {
    if (headOnlyLabels.has(key) && conflictingHeadLocal.test(key)) delete state.anny.localChanges[key];
  }
  return state;
}
