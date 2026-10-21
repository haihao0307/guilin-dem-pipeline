/* R03 fine-detail diagnostic proposal, not installed in a product or CI.
 *
 * Pure fragment patch + float-readback statistics. No DOM, renderer, settings,
 * geometry, material hook, network or CI side effects. Calling patch() does not
 * compile a shader. A future bounded diagnostic runner must own installation,
 * six native renders, actual GPU source checks and exact restoration.
 *
 * REQUIRED render target: same native camera/projection and drawing-buffer size,
 * RGBA32F, samples=0, depthBuffer=true, no colour-space transform. Require WebGL2
 * and EXT_color_buffer_float; stop if unavailable. Preserve every native scene
 * object and depth test. Only the original opaque procedural head material is
 * instrumented. The output is assigned LAST, after all ordinary tone mapping,
 * output conversion, fog, premultiplication and dithering. Negative alpha is an
 * exactly representable sentinel in this float target, NOT transparency. The
 * head material must retain transparent=false, blending disabled by the opaque
 * renderer path, depthTest=true and depthWrite=true. Other native objects keep
 * their normal shaders; their alpha cannot equal this negative sentinel, so
 * visible occluding teeth/oral geometry cannot enter the head statistics.
 *
 * An existing native target constructor is available at
 * viewer.cineRig.shadowTarget.constructor. Create a NEW target, never clone or
 * mutate the live shadow target/depthTexture. In the fixed inherited Three
 * bundle: FloatType=1015, RGBAFormat=1023, NearestFilter=1003, NoColorSpace=''.
 * After a completed beauty frame, assert inherited uFPass is zero, bind the new
 * target and call the original renderer.render(viewer.scene,viewer.camera).
 * Do not invoke viewer.render() for float data: its inherited blur/compose
 * pipeline can redirect the target and transform raw values. Beauty capture
 * before/after the diagnostic still uses the full original viewer.render().
 *
 * Read each plane with renderer.readRenderTargetPixels into Float32Array. Do not
 * decode PNGs, screenshots, an sRGB target, an MSAA target or an 8-bit framebuffer
 * using this helper. Pixels are diagnostic framebuffer samples, not measured
 * human anatomy. A nominal w/W is an actual height multiplier in lrFolds; its
 * square times visibility is only an ISOLATED GAUSSIAN PEAK-SLOPE model. It is
 * not the actual total psH slope ratio at that pixel. The actual total slope
 * before and after the .26 limiter is separately captured.
 */
(function (root) {
  'use strict';
  const VERSION = 'r03-fine-detail-gpu-probe-proposal@1';
  const MARKER = '// R03_FINE_DETAIL_GPU_DIAGNOSTIC_ONLY';
  const UNIFORM = 'rfdProbePlane';
  const SENTINEL = -937.125;
  const PLANES = Object.freeze([
    { name: 'sampling', channels: ['footprintMM', 'globalVisibility', 'outerWeight'] },
    { name: 'ownership', channels: ['lrMask', 'liWeight', 'upperFlag'] },
    { name: 'filter', channels: ['minWidthOverFilteredWidth', 'maxWidthOverFilteredWidth', 'heightBeforeGlobalFadeMetres'] },
    { name: 'height', channels: ['finalLipHeightMetres', 'completePsHMetres', 'lipDepth'] },
    { name: 'slope', channels: ['completeSlopeBeforeCap', 'completeSlopeAfterCap', 'capMultiplier'] },
    { name: 'roughness', channels: ['roughnessFactor', 'geometryRoughness', 'finalMaterialRoughness'] },
  ]);

  function once(source, from, to, replacements, id) {
    if (source.split(from).length !== 2) throw Error('Non-unique diagnostic anchor: ' + id);
    replacements.push({ id, from, to });
    return source.replace(from, () => to);
  }

  function patch(fragment) {
    if (typeof fragment !== 'string' || fragment.includes(MARKER) || fragment.includes(UNIFORM))
      throw Error('Expected uninstrumented inherited R04/R03 fragment source');
    if (!fragment.includes('// LIP-INNER-R04 continuous native oral responsibility') ||
        !fragment.includes('clearcoatNormal=normal;')) throw Error('Inherited shader ownership contract changed');
    const replacements = [];
    let out = fragment;
    const declaration = 'float lrMask=0.,lrScope=0.,lrUpper=0.,lrDepth=0.,lrWet=0.,lrR=0.,lrHeight=0.;';
    out = once(out, declaration, declaration + '\n' + MARKER + '\n' +
      'uniform float ' + UNIFORM + ';\n' +
      'float rfdFoot=-1.,rfdVisibility=-1.,rfdMinWidth=1.,rfdMaxWidth=0.,rfdPreFadeHeight=0.,rfdSeen=0.;\n' +
      'float rfdRawSlope=-1.,rfdCappedSlope=-1.,rfdCap=-1.;', replacements, 'diagnostic-declarations');

    const footprint = 'float footprint=max(length(dFdx(mm)),length(dFdy(mm)));';
    out = once(out, footprint, footprint + '\n rfdFoot=footprint;', replacements, 'capture-actual-footprint');
    const width = 'float width=.035+.030*d,filterWidth=sqrt(width*width+footprint*footprint*.30);';
    out = once(out, width, width + '\n  rfdSeen=1.;rfdMinWidth=min(rfdMinWidth,width/filterWidth);rfdMaxWidth=max(rfdMaxWidth,width/filterWidth);', replacements, 'capture-three-groove-width-factors');
    const fade = 'float visibility=1.-smoothstep(.055,.34,footprint);';
    out = once(out, fade, fade + '\n rfdVisibility=visibility;\n rfdPreFadeHeight=(height+crossFold+micro)*smoothstep(-.08,.12,depth)*(1.-smoothstep(.86,1.08,depth));', replacements, 'capture-height-before-global-fade');
    const cap = 'slope*=min(1.,.26/max(length(slope),.0001));';
    out = once(out, cap,
      'rfdRawSlope=length(slope);rfdCap=min(1.,.26/max(length(slope),.0001));' + cap + 'rfdCappedSlope=length(slope);',
      replacements, 'capture-actual-total-slope-cap');

    // Require the last token to close main, rather than inserting before an
    // include that a later inherited layer can overwrite. This check covers
    // both an onBeforeCompile template and its expanded GPU source.
    if (!/void\s+main\s*\(\s*\)\s*\{/.test(out) || !/}\s*$/.test(out)) throw Error('Unexpected fragment main boundary');
    const tail = out.match(/}\s*$/)[0];
    const output = `\n ${MARKER}\n` +
      ' vec3 rfdOutput=vec3(0.);\n' +
      ' if(rfdProbePlane<.5)rfdOutput=vec3(rfdFoot,rfdVisibility,clamp(lrMask,0.,1.)*(1.-clamp(liWeight,0.,1.)));\n' +
      ' else if(rfdProbePlane<1.5)rfdOutput=vec3(lrMask,liWeight,lrUpper);\n' +
      ' else if(rfdProbePlane<2.5)rfdOutput=rfdSeen>.5?vec3(rfdMinWidth,rfdMaxWidth,rfdPreFadeHeight):vec3(-1.);\n' +
      ' else if(rfdProbePlane<3.5)rfdOutput=vec3(lrHeight,psH,lrDepth);\n' +
      ' else if(rfdProbePlane<4.5)rfdOutput=vec3(rfdRawSlope,rfdCappedSlope,rfdCap);\n' +
      ' else rfdOutput=vec3(roughnessFactor,geometryRoughness,material.roughness);\n' +
      ' gl_FragColor=vec4(rfdOutput,-937.125);\n';
    const offset = out.length - tail.length;
    replacements.push({ id: 'last-raw-float-output', from: tail, to: output + tail, finalOnly: true });
    out = out.slice(0, offset) + output + tail;
    // Verify the full patch is reversible without relying on a diff summary.
    let reversed = out;
    for (const p of [...replacements].reverse()) {
      if (p.finalOnly) {
        if (!reversed.endsWith(p.to)) throw Error('Diagnostic tail cannot be reversed');
        reversed = reversed.slice(0, -p.to.length) + p.from;
      } else {
        if (reversed.split(p.to).length !== 2) throw Error('Diagnostic replacement cannot be reversed: ' + p.id);
        reversed = reversed.replace(p.to, () => p.from);
      }
    }
    if (reversed !== fragment) throw Error('Diagnostic patch changed an undeclared character');
    return { version: VERSION, fragment: out, originalFragment: fragment, replacements,
      addedUniform: UNIFORM, uniformValue: { value: 0 }, planes: PLANES, sentinel: SENTINEL,
      requiresFloatTarget: true, sourceRoundTripExact: true, executedOnGPU: false };
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function describe(rows, totalWeight) {
    if (!rows.length) return null;
    rows.sort((a, b) => a[0] - b[0]);
    const weight = rows.reduce((s, r) => s + r[1], 0);
    if (!(weight > 0)) return null;
    const quantile = q => {
      const target = q * weight; let sum = 0;
      for (const [x, w] of rows) { sum += w; if (sum >= target) return x; }
      return rows[rows.length - 1][0];
    };
    return { samples: rows.length, weight, validWeightFraction: weight / totalWeight,
      min: rows[0][0], q05: quantile(.05), q25: quantile(.25), median: quantile(.5),
      q75: quantile(.75), q95: quantile(.95), max: rows[rows.length - 1][0],
      mean: rows.reduce((s, r) => s + r[0] * r[1], 0) / weight };
  }

  function summarize(data, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw Error('Invalid framebuffer size');
    const count = width * height;
    for (const plane of PLANES) if (!(data[plane.name] instanceof Float32Array) || data[plane.name].length !== count * 4)
      throw Error('Expected raw RGBA32F readback: ' + plane.name);
    const pixels = [], coverage = { sentinelPixels: 0, exteriorPixels: 0, corePixels: 0, sampledWeight: 0 };
    for (let i = 0; i < count; i++) {
      const j = i * 4, belongs = data.sampling[j + 3] === SENTINEL;
      for (const p of PLANES) if ((data[p.name][j + 3] === SENTINEL) !== belongs) throw Error('Visibility changed between planes at pixel ' + i);
      if (!belongs) continue;
      coverage.sentinelPixels++;
      for (const p of PLANES) for (let k = 0; k < 3; k++) if (!Number.isFinite(data[p.name][j + k]))
        throw Error('Nonfinite GPU diagnostic sample: ' + p.name + ' / ' + i);
      const m = clamp(data.ownership[j], 0, 1), oral = clamp(data.ownership[j + 1], 0, 1), weight = m * (1 - oral);
      if (Math.abs(data.sampling[j + 2] - weight) > 2e-6) throw Error('Outer-lip ownership changed between planes');
      if (!(weight > 0)) continue;
      const core = m >= .95 && oral <= .01;
      coverage.exteriorPixels++; if (core) coverage.corePixels++;
      coverage.sampledWeight += weight;
      pixels.push({ j, weight, core, upper: data.ownership[j + 2] >= .5 });
    }
    if (!pixels.length) throw Error('No visible exterior lip samples; this is not evidence of zero fine detail');
    const groups = {};
    for (const [name, predicate, weighted] of [
      ['exteriorCoverageWeighted', () => true, true],
      ['exteriorCore', p => p.core, false],
      ['upperCore', p => p.core && p.upper, false],
      ['lowerCore', p => p.core && !p.upper, false],
    ]) {
      const chosen = pixels.filter(predicate), totalWeight = chosen.reduce((s, p) => s + (weighted ? p.weight : 1), 0);
      const fields = {}, fraction = test => totalWeight ? chosen.reduce((s, p) => s + (test(p.j) ? (weighted ? p.weight : 1) : 0), 0) / totalWeight : null;
      for (const plane of PLANES) for (let k = 0; k < 3; k++) {
        const label = plane.channels[k];
        const valid = (j, x) => plane.name === 'slope' ? x >= 0 : plane.name === 'filter' ? data.filter[j] >= 0 && data.filter[j + 1] >= 0 : true;
        fields[label] = describe(chosen.map(p => [data[plane.name][p.j + k], weighted ? p.weight : 1, p.j])
          .filter(r => valid(r[2], r[0])), totalWeight);
      }
      const model = which => describe(chosen.filter(p => data.filter[p.j] >= 0).map(p =>
        [data.filter[p.j + which] ** 2 * data.sampling[p.j + 1], weighted ? p.weight : 1]), totalWeight);
      groups[name] = { pixels: chosen.length, totalWeight, fields,
        fractions: {
          footprintBelowFadeStart: fraction(j => data.sampling[j] < .055),
          footprintAtOrBeyondFadeEnd: fraction(j => data.sampling[j] >= .34),
          globalVisibilityZero: fraction(j => data.sampling[j + 1] === 0),
          globalVisibilityBelowHalf: fraction(j => data.sampling[j + 1] < .5),
          determinantInvalid: fraction(j => data.slope[j] < 0),
          completeSlopeCapActive: fraction(j => data.slope[j + 2] >= 0 && data.slope[j + 2] < 1),
        },
        isolatedGaussianPeakSlopeModel: {
          label: 'Analytic (w/W)^2 * visibility evaluated at sampled widths and footprint; not the actual total slope attenuation',
          minAcrossThreeGrooves: model(0), maxAcrossThreeGrooves: model(1),
        } };
    }
    return { version: VERSION, width, height, coverage, groups,
      input: 'Six raw non-MSAA RGBA32F GPU readbacks; caller must separately prove actual rendering and unchanged state',
      scope: 'Visible framebuffer samples of the same native exterior lip; no real-person depth/frequency claim',
      qualityConclusion: null, productionDecision: null };
  }

  const api = Object.freeze({ VERSION, UNIFORM, SENTINEL, PLANES, patch, summarize });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.defineProperty(root, '__R03_FINE_DETAIL_GPU_PROBE__', { value: api, configurable: true });
})(typeof globalThis === 'object' ? globalThis : this);
