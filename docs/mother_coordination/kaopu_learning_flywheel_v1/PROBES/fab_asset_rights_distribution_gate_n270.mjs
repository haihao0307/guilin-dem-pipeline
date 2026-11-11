import assert from "node:assert/strict";

function verify(receipt) {
  if (receipt.intent === "METHOD_OBSERVATION_ONLY") {
    const noContentReuse = receipt.assetBytesUsed === false &&
      receipt.assetMediaUsedAsModelInput === false &&
      receipt.outputIncorporatesContent === false &&
      receipt.contentDistributed === false;
    return noContentReuse
      ? { pass: true, state: "PASS_METHOD_OBSERVATION_ONLY" }
      : { pass: false, state: "HOLD_METHOD_ONLY_BOUNDARY_VIOLATED" };
  }

  if (!receipt.listingUrl || !receipt.listingId || !receipt.publisher || !receipt.licenseType) {
    return { pass: false, state: "HOLD_LICENSE_IDENTITY_UNBOUND" };
  }
  if (receipt.licenseType === "UNKNOWN") {
    return { pass: false, state: "HOLD_LICENSE_IDENTITY_UNBOUND" };
  }
  if (receipt.licenseType === "LEGACY_UE_MARKETPLACE" && receipt.exactLegacyTermsBound !== true) {
    return { pass: false, state: "HOLD_LEGACY_LICENSE_TERMS_UNRESOLVED" };
  }
  if (receipt.licenseType === "FAB_STANDARD" && receipt.eulaAccepted !== true) {
    return { pass: false, state: "HOLD_LICENSE_ACQUISITION_UNBOUND" };
  }
  if (receipt.licenseTier === "REFERENCE_ONLY" && receipt.sourceFormatUseRequested === true) {
    return { pass: false, state: "HOLD_REFERENCE_ONLY_SOURCE_RIGHTS_ABSENT" };
  }
  if (receipt.noAI === true && ["TRAINING", "DATASET_COLLECTION", "MODEL_DEVELOPMENT"].includes(receipt.aiUse)) {
    return { pass: false, state: "HOLD_NOAI_TRAINING_USE" };
  }
  if (receipt.noAI === true && receipt.assetMediaUsedAsModelInput === true && receipt.aiUse === "INFERENCE_UNCLASSIFIED") {
    return { pass: false, state: "HOLD_NOAI_INFERENCE_SCOPE_UNRESOLVED" };
  }
  if (receipt.licenseType === "CC_BY" && receipt.attributionComplete !== true) {
    return { pass: false, state: "HOLD_CC_BY_ATTRIBUTION_MISSING" };
  }
  if (receipt.licenseType === "FAB_STANDARD" && receipt.distributionMode === "STANDALONE_CONTENT") {
    return { pass: false, state: "HOLD_STANDALONE_ASSET_REDISTRIBUTION" };
  }
  if (receipt.licenseType === "FAB_STANDARD" && receipt.distributionMode === "PUBLIC_PROJECT" && receipt.projectIncorporationBound !== true) {
    return { pass: false, state: "HOLD_PROJECT_INCORPORATION_BOUNDARY_UNPROVEN" };
  }
  if (receipt.publicSourceRepository === true && receipt.rawLicensedContentPresent === true) {
    return { pass: false, state: "HOLD_RAW_LICENSED_CONTENT_PUBLICLY_EXPOSED" };
  }

  return { pass: true, state: "PASS_RIGHTS_BOUND_PROJECT_USE_CANDIDATE" };
}

const standard = {
  intent: "PROJECT_INCORPORATION",
  listingUrl: "https://www.fab.com/listings/example",
  listingId: "example",
  publisher: "Example Publisher",
  licenseType: "FAB_STANDARD",
  licenseTier: "PERSONAL_OR_PROFESSIONAL",
  eulaAccepted: true,
  exactLegacyTermsBound: false,
  sourceFormatUseRequested: true,
  noAI: false,
  aiUse: "NONE",
  assetBytesUsed: true,
  assetMediaUsedAsModelInput: false,
  outputIncorporatesContent: true,
  contentDistributed: true,
  distributionMode: "PUBLIC_PROJECT",
  projectIncorporationBound: true,
  publicSourceRepository: false,
  rawLicensedContentPresent: false,
  attributionComplete: false
};

const fixtures = [
  {
    id: "method_observation_without_copying_content",
    input: {
      intent: "METHOD_OBSERVATION_ONLY",
      assetBytesUsed: false,
      assetMediaUsedAsModelInput: false,
      outputIncorporatesContent: false,
      contentDistributed: false
    },
    expected: "PASS_METHOD_OBSERVATION_ONLY",
    pass: true
  },
  {
    id: "free_price_does_not_bind_license_type",
    input: { ...standard, licenseType: "UNKNOWN" },
    expected: "HOLD_LICENSE_IDENTITY_UNBOUND",
    pass: false
  },
  {
    id: "standard_license_without_acquisition_receipt",
    input: { ...standard, eulaAccepted: false },
    expected: "HOLD_LICENSE_ACQUISITION_UNBOUND",
    pass: false
  },
  {
    id: "standard_asset_incorporated_into_project",
    input: standard,
    expected: "PASS_RIGHTS_BOUND_PROJECT_USE_CANDIDATE",
    pass: true
  },
  {
    id: "standard_raw_asset_republished_as_download",
    input: { ...standard, distributionMode: "STANDALONE_CONTENT" },
    expected: "HOLD_STANDALONE_ASSET_REDISTRIBUTION",
    pass: false
  },
  {
    id: "public_project_without_incorporation_boundary",
    input: { ...standard, projectIncorporationBound: false },
    expected: "HOLD_PROJECT_INCORPORATION_BOUNDARY_UNPROVEN",
    pass: false
  },
  {
    id: "reference_only_tier_requested_as_source",
    input: { ...standard, licenseTier: "REFERENCE_ONLY" },
    expected: "HOLD_REFERENCE_ONLY_SOURCE_RIGHTS_ABSENT",
    pass: false
  },
  {
    id: "cc_by_without_attribution",
    input: { ...standard, licenseType: "CC_BY", eulaAccepted: false, attributionComplete: false },
    expected: "HOLD_CC_BY_ATTRIBUTION_MISSING",
    pass: false
  },
  {
    id: "cc_by_with_attribution",
    input: { ...standard, licenseType: "CC_BY", eulaAccepted: false, attributionComplete: true },
    expected: "PASS_RIGHTS_BOUND_PROJECT_USE_CANDIDATE",
    pass: true
  },
  {
    id: "legacy_marketplace_terms_not_bound",
    input: { ...standard, licenseType: "LEGACY_UE_MARKETPLACE", eulaAccepted: false },
    expected: "HOLD_LEGACY_LICENSE_TERMS_UNRESOLVED",
    pass: false
  },
  {
    id: "noai_content_used_for_training",
    input: { ...standard, noAI: true, aiUse: "TRAINING" },
    expected: "HOLD_NOAI_TRAINING_USE",
    pass: false
  },
  {
    id: "noai_asset_media_supplied_to_unclassified_inference",
    input: { ...standard, noAI: true, aiUse: "INFERENCE_UNCLASSIFIED", assetMediaUsedAsModelInput: true },
    expected: "HOLD_NOAI_INFERENCE_SCOPE_UNRESOLVED",
    pass: false
  },
  {
    id: "raw_licensed_content_committed_to_public_source_repo",
    input: { ...standard, publicSourceRepository: true, rawLicensedContentPresent: true },
    expected: "HOLD_RAW_LICENSED_CONTENT_PUBLICLY_EXPOSED",
    pass: false
  }
];

const results = fixtures.map((fixture) => {
  const observed = verify(structuredClone(fixture.input));
  assert.equal(observed.state, fixture.expected);
  assert.equal(observed.pass, fixture.pass);
  return { id: fixture.id, expected: fixture.expected, observed, assertionPass: true };
});

console.log(JSON.stringify({
  schema: "kaopu.fab-asset-rights-distribution-gate/1",
  runtime: process.version,
  fixtureCount: results.length,
  passed: results.every((item) => item.assertionPass),
  results
}, null, 2));
