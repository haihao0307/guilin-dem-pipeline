const scenarios = [
  {
    id: "real-feedback-partial-acceptance",
    input: {
      acceptedScopes: ["vehicle.geometry.big_boom_configuration"],
      openScopes: [{
        scope: "vehicle.brand_mark.hitachi",
        status: "SOURCE_ENTRY_REQUIRED",
        requiredSourceClass: "OFFICIAL_SVG_OR_VECTOR",
        selfDrawnForbidden: true,
      }],
      artifactUserAccepted: false,
    },
    expected: "PASS",
  },
  {
    id: "negative-whole-artifact-falsely-accepted",
    input: {
      acceptedScopes: ["vehicle.geometry.big_boom_configuration"],
      openScopes: [{scope: "vehicle.brand_mark.hitachi", status: "SOURCE_ENTRY_REQUIRED", requiredSourceClass: "OFFICIAL_SVG_OR_VECTOR", selfDrawnForbidden: true}],
      artifactUserAccepted: true,
    },
    expected: "REJECT",
  },
  {
    id: "negative-accepted-geometry-discarded",
    input: {
      acceptedScopes: [],
      openScopes: [{scope: "vehicle.brand_mark.hitachi", status: "SOURCE_ENTRY_REQUIRED", requiredSourceClass: "OFFICIAL_SVG_OR_VECTOR", selfDrawnForbidden: true}],
      artifactUserAccepted: false,
    },
    expected: "REJECT",
  },
  {
    id: "negative-self-drawn-brand-substitute",
    input: {
      acceptedScopes: ["vehicle.geometry.big_boom_configuration"],
      openScopes: [{scope: "vehicle.brand_mark.hitachi", status: "REJECTED_CREATIVE_SUBSTITUTE", sourceClass: "SELF_DRAWN", selfDrawnForbidden: true}],
      artifactUserAccepted: false,
    },
    expected: "REJECT",
  },
  {
    id: "official-asset-ready-for-exact-artifact-verification",
    input: {
      acceptedScopes: ["vehicle.geometry.big_boom_configuration"],
      openScopes: [],
      verifiedScopes: [{scope: "vehicle.brand_mark.hitachi", sourceClass: "OFFICIAL_SVG_OR_VECTOR", provenanceBound: true, rightsChecked: true}],
      artifactUserAccepted: false,
    },
    expected: "PASS",
  },
];

function classify(input) {
  const geometryPreserved = input.acceptedScopes.includes("vehicle.geometry.big_boom_configuration");
  const unresolved = input.openScopes?.some(x => x.status === "SOURCE_ENTRY_REQUIRED");
  const selfDrawn = input.openScopes?.some(x => x.sourceClass === "SELF_DRAWN" || x.status === "REJECTED_CREATIVE_SUBSTITUTE");
  if (!geometryPreserved) return "REJECT";
  if (input.artifactUserAccepted && unresolved) return "REJECT";
  if (selfDrawn) return "REJECT";
  return "PASS";
}

const results = scenarios.map(s => ({id: s.id, expected: s.expected, actual: classify(s.input)}));
const passed = results.filter(r => r.expected === r.actual).length;
console.log(JSON.stringify({candidateId: "COMPONENT-SCOPE-ACCEPTANCE-OFFICIAL-BRAND-ASSET-001", passed, total: results.length, allPassed: passed === results.length, results}, null, 2));
