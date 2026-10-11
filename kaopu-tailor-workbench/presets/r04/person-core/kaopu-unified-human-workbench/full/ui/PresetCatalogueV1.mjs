/**
 * Semantic, hand-authored Anny body presets for the unified human workbench.
 * No viewport/model scaling, learned fitting, arbitrary PCA edits or inferred
 * real-world ages/weights are involved. Labels describe relative model forms.
 *
 * Verified against the bundled Anny v0.6.1 metadata and AnnyModel.coefficients:
 *   gender [0, 1] = [male, female]
 *   age [-1/3, 0, 1/3, 2/3, 1] = [newborn, baby, child, young, old]
 *   height [0, 1] = [minheight, maxheight]
 *   proportions [0, 1] = [idealproportions, uncommonproportions]
 *   weight/muscle [0, .5, 1] = their minimum/average/maximum native anchors.
 * All local-change names below are present in local_change_labels. A positive
 * value selects the incr blendshape, a negative value its paired decr shape.
 * Local coefficients stay within ±.22, with smaller limits for younger forms.
 * Source: assets/anny-all/anny-model.json, source/kaopu-anny-workbench/r02/src/AnnyModel.js.
 *
 * These are modelling starting points, not medical or population classifications.
 * Stage names between child/young/old are curated interpolation labels, not
 * independently trained age classes or a chronological-year calibration.
 */

export const PRESET_SCHEMA = 'kaopu-human-preset/1';

export const STAGES = Object.freeze([
  { id: 'child', label: '儿童' },
  { id: 'teen', label: '少年' },
  { id: 'young', label: '青年' },
  { id: 'adult', label: '成年' },
  { id: 'middle', label: '中年' },
  { id: 'senior', label: '老年' },
].map(Object.freeze));

const STAGE_LABELS = Object.fromEntries(STAGES.map(s => [s.id, s.label]));
const BUILD_LABELS = Object.freeze({
  'short-slim': '矮个偏瘦',
  'tall-slim': '高个偏瘦',
  'tall-sturdy': '高个结实',
  'short-heavy': '矮个厚实',
  'rounded': '中等身高圆润',
  'sturdy': '中等身高结实',
});

// These deliberately use native width/circumference/fat fields, not the
// pregnancy control or a guessed local "scale" outside the model's parameter set.
const BUILD_LOCAL_CHANGES = Object.freeze({
  'short-slim': {
    'measure-shoulder-dist-incr': -.08,
    'measure-waist-circ-incr': -.10,
    'torso-scale-depth-incr': -.05,
    'l-upperarm-fat-incr': -.06, 'r-upperarm-fat-incr': -.06,
    'l-upperleg-fat-incr': -.06, 'r-upperleg-fat-incr': -.06,
  },
  'tall-slim': {
    'measure-shoulder-dist-incr': -.05,
    'measure-waist-circ-incr': -.12,
    'torso-scale-depth-incr': -.07,
    'hip-scale-horiz-incr': -.04,
    'l-upperarm-fat-incr': -.07, 'r-upperarm-fat-incr': -.07,
    'l-upperleg-fat-incr': -.08, 'r-upperleg-fat-incr': -.08,
  },
  'tall-sturdy': {
    'measure-shoulder-dist-incr': .12,
    'torso-vshape-incr': .08,
    'torso-muscle-dorsi-incr': .07,
    'l-upperarm-shoulder-muscle-incr': .08, 'r-upperarm-shoulder-muscle-incr': .08,
    'l-upperleg-muscle-incr': .07, 'r-upperleg-muscle-incr': .07,
  },
  'short-heavy': {
    'measure-shoulder-dist-incr': .09,
    'measure-waist-circ-incr': .19,
    'torso-scale-depth-incr': .11,
    'hip-scale-horiz-incr': .08,
    'l-upperarm-fat-incr': .10, 'r-upperarm-fat-incr': .10,
    'l-upperleg-fat-incr': .10, 'r-upperleg-fat-incr': .10,
  },
  'rounded': {
    'measure-waist-circ-incr': .22,
    'torso-scale-depth-incr': .12,
    'measure-hips-circ-incr': .12,
    'l-upperarm-fat-incr': .12, 'r-upperarm-fat-incr': .12,
    'l-upperleg-fat-incr': .12, 'r-upperleg-fat-incr': .12,
  },
  'sturdy': {
    'measure-shoulder-dist-incr': .15,
    'torso-vshape-incr': .10,
    'torso-muscle-dorsi-incr': .10,
    'l-upperarm-shoulder-muscle-incr': .12, 'r-upperarm-shoulder-muscle-incr': .12,
    'l-upperleg-muscle-incr': .10, 'r-upperleg-muscle-incr': .10,
  },
});

const LOCAL_STRENGTH = Object.freeze({ child: .40, teen: .65, young: 1, adult: 1, middle: 1, senior: .75 });
const STAGE_NOTES = Object.freeze({
  child: '使用原生 child 年龄锚点，保留儿童头身关系。',
  teen: '在原生 child 与 young 锚点之间插值。',
  young: '使用原生 young 年龄锚点。',
  adult: '从原生 young 向 old 做少量年龄插值。',
  middle: '在原生 young 与 old 锚点之间取较成熟形态。',
  senior: '使用原生 old 年龄锚点。',
});

// Each row is explicit: stage, native gender, build, age, height, weight,
// muscle, proportions. Six forms per stage, with both female/male, lean/heavy,
// and short/tall coverage. Heights were checked on the unified geometry
// to keep these examples within modest everyday-model spans; coefficients are
// not a promise of real-person measurements. All ethnicity weights remain .5.
const ROWS = [
  ['child',  1, 'short-slim',  1/3, .23, .28, .30, .48],
  ['child',  0, 'tall-slim',   1/3, .50, .27, .34, .38],
  ['child',  1, 'tall-sturdy', 1/3, .60, .53, .53, .42],
  ['child',  0, 'short-heavy', 1/3, .20, .76, .38, .56],
  ['child',  1, 'rounded',     1/3, .42, .80, .28, .58],
  ['child',  0, 'sturdy',      1/3, .36, .55, .57, .43],

  ['teen',   1, 'short-slim',  .52, .335, .26, .33, .45],
  ['teen',   0, 'tall-slim',   .52, .525, .25, .37, .32],
  ['teen',   1, 'tall-sturdy', .52, .60, .53, .60, .37],
  ['teen',   0, 'short-heavy', .52, .265, .77, .42, .54],
  ['teen',   1, 'rounded',     .52, .465, .81, .30, .58],
  ['teen',   0, 'sturdy',      .52, .41, .57, .65, .38],

  ['young',  1, 'short-slim',  2/3, .247, .26, .34, .43],
  ['young',  0, 'tall-slim',   2/3, .505, .25, .40, .30],
  ['young',  1, 'tall-sturdy', 2/3, .522, .54, .66, .34],
  ['young',  0, 'short-heavy', 2/3, .239, .79, .46, .54],
  ['young',  1, 'rounded',     2/3, .381, .83, .32, .58],
  ['young',  0, 'sturdy',      2/3, .387, .59, .76, .34],

  ['adult',  1, 'short-slim',  .74, .252, .28, .35, .45],
  ['adult',  0, 'tall-slim',   .74, .512, .27, .41, .34],
  ['adult',  1, 'tall-sturdy', .74, .528, .56, .65, .38],
  ['adult',  0, 'short-heavy', .74, .246, .81, .44, .57],
  ['adult',  1, 'rounded',     .74, .385, .84, .31, .61],
  ['adult',  0, 'sturdy',      .74, .390, .61, .72, .38],

  ['middle', 1, 'short-slim',  .85, .259, .28, .30, .48],
  ['middle', 0, 'tall-slim',   .85, .493, .27, .35, .39],
  ['middle', 1, 'tall-sturdy', .85, .515, .57, .57, .42],
  ['middle', 0, 'short-heavy', .85, .238, .82, .39, .61],
  ['middle', 1, 'rounded',     .85, .371, .85, .27, .65],
  ['middle', 0, 'sturdy',      .85, .379, .62, .63, .43],

  ['senior', 1, 'short-slim',  1,   .255, .29, .25, .53],
  ['senior', 0, 'tall-slim',   1,   .486, .28, .28, .45],
  ['senior', 1, 'tall-sturdy', 1,   .504, .55, .45, .48],
  ['senior', 0, 'short-heavy', 1,   .241, .77, .31, .64],
  ['senior', 1, 'rounded',     1,   .354, .81, .24, .67],
  ['senior', 0, 'sturdy',      1,   .371, .59, .49, .50],
];

export const PRESETS = Object.freeze(ROWS.map(([stage, gender, build, age, height, weight, muscle, proportions]) => {
  const stageLabel = STAGE_LABELS[stage];
  const genderLabel = gender === 1 ? '女性体型' : '男性体型';
  const buildLabel = BUILD_LABELS[build];
  const localChanges = Object.fromEntries(Object.entries(BUILD_LOCAL_CHANGES[build]).map(([key, value]) =>
    [key, Number((value * LOCAL_STRENGTH[stage]).toFixed(4))]));
  return Object.freeze({
    id: `${stage}-${gender === 1 ? 'female' : 'male'}-${build}`,
    label: `${stageLabel} · ${gender === 1 ? '女型' : '男型'} · ${buildLabel}`,
    stage, stageLabel, build, buildLabel, genderLabel,
    description: `${stageLabel}${genderLabel}，${buildLabel}。${STAGE_NOTES[stage]}体格由原生身高、体量、肌肉、比例及对称局部参数共同生成；高矮胖瘦为该阶段内相对描述，未校准实际年龄或体重。`,
    phenotypes: Object.freeze({
      gender, age, height, weight, muscle, proportions,
      cupsize: .5, firmness: .5, african: .5, asian: .5, caucasian: .5,
    }),
    localChanges: Object.freeze(localChanges),
  });
}));

const PRESET_BY_ID = new Map(PRESETS.map(preset => [preset.id, preset]));

function findPreset(id) {
  const preset = PRESET_BY_ID.get(id);
  if (!preset) throw new RangeError(`Unknown human preset: ${String(id)}`);
  return preset;
}

function cloneDefaults(defaults) {
  const source = typeof defaults === 'function' ? defaults() : defaults;
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      !source.anny || typeof source.anny !== 'object' ||
      !source.anny.phenotypes || typeof source.anny.phenotypes !== 'object') {
    throw new TypeError('A complete default human state (or factory) is required');
  }
  // The workbench state consists of serializable arrays, objects and scalars.
  // structuredClone keeps every inactive driver, owner and schema field intact.
  return structuredClone(source);
}

/**
 * Produce an independent, complete state from the caller's neutral defaults.
 * Pass a default-state object/factory, not the currently edited person. This
 * intentionally preserves owner choices and unrelated fields in those defaults;
 * the workbench must activate its Anny rig and shared native head layers.
 */
export function createPresetState(id, defaults) {
  const preset = findPreset(id);
  const state = cloneDefaults(defaults);
  state.anny.phenotypes = { ...state.anny.phenotypes, ...preset.phenotypes };
  state.anny.localChanges = { ...(state.anny.localChanges ?? {}), ...preset.localChanges };
  return state;
}

/** Serializable seed for later manual refinement/fitting. Performs no fitting. */
export function presetRecord(id, defaults) {
  const preset = findPreset(id);
  return {
    schema: PRESET_SCHEMA,
    presetId: preset.id,
    label: preset.label,
    stage: preset.stage,
    stageLabel: preset.stageLabel,
    build: preset.build,
    buildLabel: preset.buildLabel,
    genderLabel: preset.genderLabel,
    description: preset.description,
    parameterSource: 'anny-native',
    fittingStatus: 'unfitted-preset',
    calibration: { chronologicalAge: null, height: null, bodyMass: null },
    state: createPresetState(id, defaults),
  };
}
