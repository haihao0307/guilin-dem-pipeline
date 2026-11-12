const REQUIRED = ["visible", "rotatable", "selectable", "adjustable"];

function evaluate({task, site, entry}) {
  if (!task?.expectedArtifactId || task.expectedArtifactKind !== "complete_machine") {
    return "HOLD_WHOLE_MACHINE_CONTRACT_UNBOUND";
  }
  if (site?.deploymentStatus !== "succeeded") return "HOLD_SITE_NOT_DEPLOYED";
  if (!entry || entry.artifactId !== task.expectedArtifactId) return "HOLD_ENTRY_NOT_FOUND";
  if (entry.servedVersion !== site.servedVersion) return "HOLD_ENTRY_VERSION_MISMATCH";
  if (!entry.assetDigest || entry.assetDigest !== task.expectedAssetDigest) {
    return "HOLD_ENTRY_ASSET_IDENTITY_MISMATCH";
  }

  // A catalog row is not a startup result. UNKNOWN is fail-closed, not SUCCESS.
  const startup = entry.startupProbe;
  if (!startup || startup.result === "UNKNOWN") return "HOLD_ENTRY_STARTUP_UNKNOWN";
  if (startup.result !== "SUCCESS") return "HOLD_ENTRY_STARTUP_FAILED";
  if (startup.servedVersion !== entry.servedVersion || startup.assetDigest !== entry.assetDigest) {
    return "HOLD_ENTRY_STARTUP_RECEIPT_STALE";
  }
  if ((startup.fatalConsoleErrors ?? 1) !== 0 || startup.moduleGraphResolved !== true) {
    return "HOLD_ENTRY_STARTUP_FAILED";
  }
  if (!Number.isInteger(startup.lastCompletedFrame) || startup.lastCompletedFrame < 1) {
    return "HOLD_ENTRY_NO_COMPLETED_FRAME";
  }
  if (startup.currentReadiness !== "READY") return "HOLD_ENTRY_NOT_CURRENTLY_READY";

  for (const capability of REQUIRED) {
    if (entry.capabilities?.[capability] !== true) {
      return "HOLD_WHOLE_MACHINE_CAPABILITY_MISSING";
    }
  }
  if (!site.publicExternalAccess) return "HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED";
  return "WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE";
}

const task = {
  expectedArtifactId: "ZAXIS_85USB",
  expectedArtifactKind: "complete_machine",
  expectedAssetDigest: "sha256:zaxis-canonical-v1",
};
const site = {
  deploymentStatus: "succeeded",
  servedVersion: "site-v169",
  publicExternalAccess: false,
};
const readyProbe = {
  result: "SUCCESS",
  servedVersion: "site-v169",
  assetDigest: "sha256:zaxis-canonical-v1",
  moduleGraphResolved: true,
  fatalConsoleErrors: 0,
  lastCompletedFrame: 12,
  currentReadiness: "READY",
};
const capabilities = {visible:true, rotatable:true, selectable:true, adjustable:true};

const cases = [
  {
    name: "v169 catalog row only",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities}},
    expected: "HOLD_ENTRY_STARTUP_UNKNOWN",
  },
  {
    name: "bare module resolution fatal",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities, startupProbe:{...readyProbe,result:"FAILURE",moduleGraphResolved:false,fatalConsoleErrors:1,lastCompletedFrame:0,currentReadiness:"NOT_READY"}}},
    expected: "HOLD_ENTRY_STARTUP_FAILED",
  },
  {
    name: "receipt from prior served version",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v168", assetDigest:"sha256:zaxis-canonical-v1", capabilities, startupProbe:{...readyProbe,servedVersion:"site-v168"}}},
    expected: "HOLD_ENTRY_VERSION_MISMATCH",
  },
  {
    name: "sibling machine ready does not promote ZAXIS",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities, siblingReady:{artifactId:"CAT_320",runtimeReady:true}}},
    expected: "HOLD_ENTRY_STARTUP_UNKNOWN",
  },
  {
    name: "catalog identity differs from canonical digest",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:renamed-duplicate", capabilities, startupProbe:{...readyProbe,assetDigest:"sha256:renamed-duplicate"}}},
    expected: "HOLD_ENTRY_ASSET_IDENTITY_MISMATCH",
  },
  {
    name: "runtime ready but owner-only",
    input: {task, site, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities, startupProbe:readyProbe}},
    expected: "HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED",
  },
  {
    name: "exact entry ready and public",
    input: {task, site:{...site,publicExternalAccess:true}, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities, startupProbe:readyProbe}},
    expected: "WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE",
  },
  {
    name: "readiness is revocable after a later fault",
    input: {task, site:{...site,publicExternalAccess:true}, entry:{artifactId:"ZAXIS_85USB", servedVersion:"site-v169", assetDigest:"sha256:zaxis-canonical-v1", capabilities, startupProbe:{...readyProbe,currentReadiness:"NOT_READY"}}},
    expected: "HOLD_ENTRY_NOT_CURRENTLY_READY",
  },
];

const results = cases.map(c => ({name:c.name, expected:c.expected, actual:evaluate(c.input)}));
const passed = results.filter(r => r.actual === r.expected).length;
const output = {
  probe:"N280_PER_ENTRY_STARTUP_READINESS",
  principle:"site deployment and catalog presence never inherit runtime readiness to an entry",
  results,
  assertions:{passed,total:results.length,allPassed:passed===results.length},
  boundaries:[
    "Synthetic state-machine replay; it does not execute the ZAXIS runtime.",
    "lastCompletedFrame is a receipt field, not proof of visual correctness or GPU performance.",
    "WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE is not device or user acceptance."
  ]
};
console.log(JSON.stringify(output,null,2));
if (!output.assertions.allPassed) process.exitCode=1;
