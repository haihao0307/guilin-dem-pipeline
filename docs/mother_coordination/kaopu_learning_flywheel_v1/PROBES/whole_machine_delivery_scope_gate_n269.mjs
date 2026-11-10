import assert from "node:assert/strict";

function verify(receipt) {
  const requiredIdentity = [
    receipt.productionHead,
    receipt.expectedArtifactId,
    receipt.originalWorkbenchUrl,
  ];
  if (requiredIdentity.some((value) => !value)) {
    return { pass: false, state: "HOLD_WHOLE_MACHINE_CONTRACT_UNBOUND" };
  }
  if (receipt.expectedArtifactKind !== "complete_machine") {
    return { pass: false, state: "HOLD_EXPECTED_ARTIFACT_NOT_WHOLE_MACHINE" };
  }
  if (receipt.deliveredArtifactKind !== "complete_machine") {
    return { pass: false, state: "HOLD_PARTIAL_NOT_WHOLE_MACHINE_DELIVERY" };
  }
  if (receipt.evidenceKind === "static_image") {
    return { pass: false, state: "HOLD_STATIC_NOT_INTERACTIVE" };
  }
  if (receipt.evidenceKind === "http_success_only") {
    return { pass: false, state: "HOLD_HTTP_ONLY_NOT_USABLE" };
  }
  const capabilities = receipt.capabilities ?? {};
  const missingCapabilities = ["visible", "rotatable", "selectable", "adjustable"]
    .filter((key) => capabilities[key] !== true);
  if (missingCapabilities.length) {
    return {
      pass: false,
      state: "HOLD_WHOLE_MACHINE_CAPABILITY_MISSING",
      missingCapabilities,
    };
  }
  if (receipt.publishedToOriginalWorkbench !== true) {
    return { pass: false, state: "HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED" };
  }
  if ((receipt.knownGaps?.length ?? 0) > 0 && receipt.gapsExplicitlyDeclared !== true) {
    return { pass: false, state: "HOLD_KNOWN_GAPS_NOT_DECLARED" };
  }

  const acceptance = receipt.acceptanceLayers ?? {};
  const allAcceptanceLayersPassed = [
    "package",
    "productionRuntime",
    "browser",
    "device",
    "user",
  ].every((key) => acceptance[key] === "PASS");

  if (receipt.claimedState === "FULLY_ACCEPTED" && !allAcceptanceLayersPassed) {
    return { pass: false, state: "HOLD_OBSERVATION_READY_OVERCLAIMED_AS_ACCEPTED" };
  }
  if (receipt.claimedState === "FULLY_ACCEPTED") {
    return { pass: true, state: "WHOLE_MACHINE_ACCEPTED_CANDIDATE" };
  }
  return { pass: true, state: "WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE" };
}

const base = {
  productionHead: "head-current",
  expectedArtifactId: "excavator-workbench",
  expectedArtifactKind: "complete_machine",
  deliveredArtifactKind: "complete_machine",
  originalWorkbenchUrl: "https://example.invalid/workbench/excavator",
  evidenceKind: "interactive_runtime",
  capabilities: {
    visible: true,
    rotatable: true,
    selectable: true,
    adjustable: true,
  },
  publishedToOriginalWorkbench: true,
  knownGaps: ["bucket-linkage-unverified"],
  gapsExplicitlyDeclared: true,
  claimedState: "OBSERVATION_READY",
  acceptanceLayers: {
    package: "PASS",
    productionRuntime: "PASS",
    browser: "PASS",
    device: "UNKNOWN",
    user: "UNKNOWN",
  },
};

const fixtures = [
  {
    id: "whole_machine_observation_ready_with_declared_gap",
    mutate: (x) => x,
    expected: "WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE",
    pass: true,
  },
  {
    id: "fully_accepted_only_after_all_layers_pass",
    mutate: (x) => ({
      ...x,
      claimedState: "FULLY_ACCEPTED",
      acceptanceLayers: {
        package: "PASS",
        productionRuntime: "PASS",
        browser: "PASS",
        device: "PASS",
        user: "PASS",
      },
    }),
    expected: "WHOLE_MACHINE_ACCEPTED_CANDIDATE",
    pass: true,
  },
  {
    id: "faithful_part_only_does_not_satisfy_whole_machine",
    mutate: (x) => ({ ...x, deliveredArtifactKind: "part_detail" }),
    expected: "HOLD_PARTIAL_NOT_WHOLE_MACHINE_DELIVERY",
    pass: false,
  },
  {
    id: "static_image_does_not_prove_interactivity",
    mutate: (x) => ({ ...x, evidenceKind: "static_image" }),
    expected: "HOLD_STATIC_NOT_INTERACTIVE",
    pass: false,
  },
  {
    id: "http_success_does_not_prove_usability",
    mutate: (x) => ({ ...x, evidenceKind: "http_success_only" }),
    expected: "HOLD_HTTP_ONLY_NOT_USABLE",
    pass: false,
  },
  {
    id: "missing_selectability_blocks_observation_ready",
    mutate: (x) => ({ ...x, capabilities: { ...x.capabilities, selectable: false } }),
    expected: "HOLD_WHOLE_MACHINE_CAPABILITY_MISSING",
    pass: false,
  },
  {
    id: "complete_runtime_not_reconnected_to_original_workbench",
    mutate: (x) => ({ ...x, publishedToOriginalWorkbench: false }),
    expected: "HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED",
    pass: false,
  },
  {
    id: "known_gap_hidden",
    mutate: (x) => ({ ...x, gapsExplicitlyDeclared: false }),
    expected: "HOLD_KNOWN_GAPS_NOT_DECLARED",
    pass: false,
  },
  {
    id: "observation_ready_overclaimed_as_full_acceptance",
    mutate: (x) => ({ ...x, claimedState: "FULLY_ACCEPTED" }),
    expected: "HOLD_OBSERVATION_READY_OVERCLAIMED_AS_ACCEPTED",
    pass: false,
  },
];

const results = fixtures.map((fixture) => {
  const observed = verify(fixture.mutate(structuredClone(base)));
  assert.equal(observed.state, fixture.expected);
  assert.equal(observed.pass, fixture.pass);
  return { id: fixture.id, expected: fixture.expected, observed, assertionPass: true };
});

console.log(JSON.stringify({
  schema: "kaopu.whole-machine-delivery-scope-gate/1",
  runtime: process.version,
  fixtureCount: results.length,
  passed: results.every((item) => item.assertionPass),
  results,
}, null, 2));
