var KAOPUFishComposer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/composer.js
  var composer_exports = {};
  __export(composer_exports, {
    COMPOSER_VERSION: () => COMPOSER_VERSION,
    KC1: () => KC1,
    compareSectionStations: () => compareSectionStations,
    compileSourceScore: () => compileSourceScore,
    createReferenceLedgerEntry: () => createReferenceLedgerEntry,
    deepMerge: () => deepMerge
  });
  var COMPOSER_VERSION = "KC1.0.0";
  function deepMerge(base, delta) {
    if (Array.isArray(delta)) return structuredClone(delta);
    if (!delta || typeof delta !== "object") return delta;
    const output = base && typeof base === "object" && !Array.isArray(base) ? structuredClone(base) : {};
    for (const [key, value] of Object.entries(delta)) {
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = structuredClone(value);
      }
    }
    return output;
  }
  function compileSourceScore(baseScore, sourceScore, baseSha256) {
    const parent = sourceScore?.object?.parentScore;
    if (!parent) throw new Error("Source Score \u7F3A\u5C11 parentScore");
    if (parent.id !== baseScore.id || parent.version !== baseScore.version) throw new Error("Source Score \u5F15\u7528\u7684\u57FA\u8C31 ID\uFF0F\u7248\u672C\u4E0D\u5339\u914D");
    if (parent.sha256 !== baseSha256) throw new Error("Source Score \u5F15\u7528\u7684\u57FA\u8C31 SHA-256 \u4E0D\u5339\u914D");
    const resolved = deepMerge(baseScore, sourceScore);
    resolved.schema = "kaopu.fish.resolved/1";
    resolved.object.parentScore.resolved = true;
    resolved.provenance = { ...resolved.provenance ?? {}, baseScoreSha256: baseSha256 };
    return resolved;
  }
  function createReferenceLedgerEntry({ packageName, sha256, vertices, triangles, textureCount, rigged }) {
    return {
      source: packageName,
      sha256,
      role: "REFERENCE_TEACHER_ONLY",
      canProve: ["visible surface", "silhouette", "proportions", "fin placement", "material observation"],
      cannotProve: ["species identity", "internal skeleton", "natural motion", "muscle mechanics"],
      observed: { vertices, triangles, textureCount, rigged },
      allowedInFormalRuntime: false,
      status: "DISTILLED_INDEX_ONLY"
    };
  }
  function compareSectionStations(referenceStations, candidateStations) {
    if (!Array.isArray(referenceStations) || !Array.isArray(candidateStations) || referenceStations.length !== candidateStations.length) {
      return { comparable: false, reason: "station count mismatch" };
    }
    const fields = ["xM", "centerYM", "halfHeightM", "halfWidthM", "superellipseExponent"];
    let maxAbsolute = 0;
    let squared = 0;
    let count = 0;
    for (let i = 0; i < referenceStations.length; i += 1) {
      for (const field of fields) {
        const delta = Number(candidateStations[i][field]) - Number(referenceStations[i][field]);
        maxAbsolute = Math.max(maxAbsolute, Math.abs(delta));
        squared += delta * delta;
        count += 1;
      }
    }
    return { comparable: true, maxAbsolute, rms: Math.sqrt(squared / count), count };
  }
  var KC1 = Object.freeze({ COMPOSER_VERSION, deepMerge, compileSourceScore, createReferenceLedgerEntry, compareSectionStations });
  return __toCommonJS(composer_exports);
})();
