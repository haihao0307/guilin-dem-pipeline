import assert from "node:assert/strict";

function closure(roots, edges) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const node = queue.shift();
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of edges[node] ?? []) queue.push(next);
  }
  return seen;
}

function intersects(values, set) {
  return values.some((value) => set.has(value));
}

function livePublisher(publisher) {
  return Boolean(
    publisher.enabled &&
    publisher.triggerReachable &&
    publisher.writeAuthority &&
    publisher.targetPathMatch &&
    (publisher.sourceCanMaterializeTarget || publisher.mutableSourceAlias)
  );
}

function verify(receipt) {
  const failures = [];
  const required = [
    receipt.productionHead,
    receipt.publicRoute,
    receipt.activeRoots?.length,
    receipt.quarantineRoots?.length,
    receipt.rejected?.length,
  ];
  if (required.some((value) => !value)) {
    return { pass: false, state: "HOLD_QUARANTINE_CONTRACT_UNBOUND", failures: ["required_identity_missing"] };
  }

  const active = closure(receipt.activeRoots, receipt.edges ?? {});
  const quarantine = closure(receipt.quarantineRoots, receipt.edges ?? {});
  const rejectedIds = receipt.rejected.map((item) => item.id);

  if (intersects(rejectedIds, active)) failures.push("rejected_reachable_from_active_root");
  if (!rejectedIds.every((id) => quarantine.has(id))) failures.push("rejected_not_recoverable_from_quarantine_root");
  if (intersects(receipt.quarantineRoots, active)) failures.push("quarantine_root_reachable_from_active_root");
  if (!receipt.rejected.every((item) => item.digest && item.eligibleAsParent === false)) {
    failures.push("rejected_record_not_hash_bound_or_parent_ineligible");
  }
  if (intersects(rejectedIds, new Set(receipt.parentReferenceRegistry ?? []))) {
    failures.push("rejected_present_in_parent_reference_registry");
  }
  if (intersects(rejectedIds, new Set(receipt.defaultFallbackSelectors ?? []))) {
    failures.push("rejected_present_in_default_or_fallback_selector");
  }
  if (intersects(rejectedIds, new Set(receipt.finalBuildManifest ?? []))) {
    failures.push("rejected_present_in_final_build_manifest");
  }
  if (intersects(rejectedIds, new Set(receipt.runtimeRequestOrDrawInventory ?? []))) {
    failures.push("rejected_seen_in_runtime_request_or_draw_inventory");
  }
  if ((receipt.publishers ?? []).some(livePublisher)) {
    failures.push("rejected_target_recreation_publisher_reachable");
  }

  return {
    pass: failures.length === 0,
    state: failures.length === 0 ? "QUARANTINED_NOT_ACTIVE_CANDIDATE" : "HOLD_REJECTED_LINEAGE_REACHABLE",
    failures,
    activeClosure: [...active].sort(),
    quarantineClosure: [...quarantine].sort(),
  };
}

const base = {
  productionHead: "head-good",
  publicRoute: "https://example.invalid/excavator/",
  activeRoots: ["public-build"],
  quarantineRoots: ["quarantine-receipt"],
  edges: {
    "public-build": ["accepted-excavator", "safe-runtime"],
    "accepted-excavator": ["approved-bucket"],
    "quarantine-receipt": ["rejected-coarse-excavator", "failure-screenshot"],
  },
  rejected: [
    {
      id: "rejected-coarse-excavator",
      digest: "sha256:rejected",
      eligibleAsParent: false,
    },
  ],
  parentReferenceRegistry: ["accepted-excavator", "approved-bucket"],
  defaultFallbackSelectors: ["accepted-excavator"],
  finalBuildManifest: ["public-build", "accepted-excavator", "approved-bucket", "safe-runtime"],
  runtimeRequestOrDrawInventory: ["accepted-excavator", "approved-bucket"],
  publishers: [],
};

const fixtures = [
  { id: "positive_separate_active_and_quarantine_roots", mutate: (x) => x, expectPass: true },
  {
    id: "blank_screenshot_without_bound_receipt",
    mutate: (x) => ({ ...x, productionHead: null, activeRoots: [] }),
    expectState: "HOLD_QUARANTINE_CONTRACT_UNBOUND",
  },
  {
    id: "direct_active_reference",
    mutate: (x) => ({ ...x, edges: { ...x.edges, "public-build": [...x.edges["public-build"], "rejected-coarse-excavator"] } }),
    expectFailure: "rejected_reachable_from_active_root",
  },
  {
    id: "indirect_alias_reintroduction",
    mutate: (x) => ({ ...x, edges: { ...x.edges, "accepted-excavator": ["approved-bucket", "legacy-alias"], "legacy-alias": ["rejected-coarse-excavator"] } }),
    expectFailure: "rejected_reachable_from_active_root",
  },
  {
    id: "history_not_recoverable",
    mutate: (x) => ({ ...x, edges: { ...x.edges, "quarantine-receipt": ["failure-screenshot"] } }),
    expectFailure: "rejected_not_recoverable_from_quarantine_root",
  },
  {
    id: "parent_registry_leak_despite_flag",
    mutate: (x) => ({ ...x, parentReferenceRegistry: [...x.parentReferenceRegistry, "rejected-coarse-excavator"] }),
    expectFailure: "rejected_present_in_parent_reference_registry",
  },
  {
    id: "clean_bundle_but_live_republisher",
    mutate: (x) => ({ ...x, publishers: [{ enabled: true, triggerReachable: true, writeAuthority: true, targetPathMatch: true, mutableSourceAlias: true }] }),
    expectFailure: "rejected_target_recreation_publisher_reachable",
  },
  {
    id: "runtime_dynamic_fetch_leak",
    mutate: (x) => ({ ...x, runtimeRequestOrDrawInventory: [...x.runtimeRequestOrDrawInventory, "rejected-coarse-excavator"] }),
    expectFailure: "rejected_seen_in_runtime_request_or_draw_inventory",
  },
  {
    id: "final_manifest_leak",
    mutate: (x) => ({ ...x, finalBuildManifest: [...x.finalBuildManifest, "rejected-coarse-excavator"] }),
    expectFailure: "rejected_present_in_final_build_manifest",
  },
  {
    id: "default_selector_leak",
    mutate: (x) => ({ ...x, defaultFallbackSelectors: [...x.defaultFallbackSelectors, "rejected-coarse-excavator"] }),
    expectFailure: "rejected_present_in_default_or_fallback_selector",
  },
];

const results = fixtures.map((fixture) => {
  const input = structuredClone(base);
  const output = verify(fixture.mutate(input));
  if (fixture.expectPass) assert.equal(output.pass, true);
  if (fixture.expectState) assert.equal(output.state, fixture.expectState);
  if (fixture.expectFailure) assert(output.failures.includes(fixture.expectFailure));
  return { id: fixture.id, pass: true, observed: output };
});

console.log(JSON.stringify({
  schema: "kaopu.rejected-lineage-rooted-closure-probe/1",
  runtime: process.version,
  fixtureCount: results.length,
  passed: results.every((item) => item.pass),
  results,
}, null, 2));