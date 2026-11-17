function verifyRuntime(contract, observation) {
  const receipt = {
    subject: observation.subject,
    observedRenderer: observation.renderer.actualContextType,
    observedConstructor: observation.renderer.constructorName,
    fallbackUsed: observation.renderer.fallbackUsed,
    firstValidFrameMs: observation.timings.firstValidFrameMs,
    interactionAckMs: observation.timings.interactionAckMs,
    largestResource: [...observation.resources].sort((a, b) => b.duration - a.duration)[0] ?? null,
    status: null,
  };

  if (observation.selfReport?.renderer !== observation.renderer.actualContextType) {
    receipt.status = "HOLD_SELF_REPORT_OBSERVATION_CONFLICT";
    return receipt;
  }
  if (
    observation.renderer.actualContextType !== contract.requiredRenderer ||
    observation.renderer.constructorName !== contract.requiredConstructor ||
    observation.renderer.fallbackUsed
  ) {
    receipt.status = "HOLD_RUNTIME_ROUTE_MISMATCH";
    return receipt;
  }
  if (!Number.isFinite(contract.maxFirstValidFrameMs)) {
    receipt.status = "RUNTIME_ROUTE_VERIFIED_LATENCY_BUDGET_UNKNOWN";
    return receipt;
  }
  if (observation.timings.firstValidFrameMs > contract.maxFirstValidFrameMs) {
    receipt.status = "HOLD_FIRST_VALID_FRAME_BUDGET_EXCEEDED";
    return receipt;
  }
  if (
    Number.isFinite(contract.maxInteractionAckMs) &&
    observation.timings.interactionAckMs > contract.maxInteractionAckMs
  ) {
    receipt.status = "HOLD_INTERACTION_ACK_BUDGET_EXCEEDED";
    return receipt;
  }
  receipt.status = "RUNTIME_ROUTE_AND_BUDGET_VERIFIED";
  return receipt;
}

const baseContract = {
  requiredRenderer: "webgl2",
  requiredConstructor: "WebGL2RenderingContext",
  maxFirstValidFrameMs: 2000,
  maxInteractionAckMs: 250,
};

const compliant = {
  subject: "workbench@example@sha256:good",
  selfReport: { renderer: "webgl2" },
  renderer: {
    actualContextType: "webgl2",
    constructorName: "WebGL2RenderingContext",
    version: "WebGL 2.0",
    fallbackUsed: false,
    acquisition: "independent-canvas-context-check",
  },
  timings: {
    navigationResponseEndMs: 130,
    firstValidFrameMs: 920,
    interactionAckMs: 74,
  },
  resources: [
    { name: "runtime.mjs", initiatorType: "script", duration: 180, transferSize: 84000 },
    { name: "scene.bin", initiatorType: "fetch", duration: 420, transferSize: 510000 },
  ],
};

const wrongFastFallback = {
  ...compliant,
  subject: "workbench@example@sha256:wrong-route",
  selfReport: { renderer: "webgl" },
  renderer: {
    ...compliant.renderer,
    actualContextType: "webgl",
    constructorName: "WebGLRenderingContext",
    version: "WebGL 1.0",
    fallbackUsed: true,
  },
  timings: { ...compliant.timings, firstValidFrameMs: 700 },
};

const falseSelfReport = {
  ...wrongFastFallback,
  subject: "workbench@example@sha256:false-claim",
  selfReport: { renderer: "webgl2" },
};

const slowCorrectRoute = {
  ...compliant,
  subject: "workbench@example@sha256:slow",
  timings: {
    ...compliant.timings,
    firstValidFrameMs: 4600,
  },
  resources: [
    { name: "runtime.mjs", initiatorType: "script", duration: 210, transferSize: 84000 },
    { name: "legacy-large.bin", initiatorType: "fetch", duration: 3650, transferSize: 9100000 },
  ],
};

const results = {
  compliant: verifyRuntime(baseContract, compliant),
  wrongFastFallback: verifyRuntime(baseContract, wrongFastFallback),
  falseSelfReport: verifyRuntime(baseContract, falseSelfReport),
  slowCorrectRoute: verifyRuntime(baseContract, slowCorrectRoute),
  noDeclaredBudget: verifyRuntime(
    { ...baseContract, maxFirstValidFrameMs: null, maxInteractionAckMs: null },
    slowCorrectRoute,
  ),
};

const assertions = {
  compliantPasses:
    results.compliant.status === "RUNTIME_ROUTE_AND_BUDGET_VERIFIED",
  fastWrongRouteStillHeld:
    results.wrongFastFallback.status === "HOLD_RUNTIME_ROUTE_MISMATCH",
  producerClaimCannotOverrideObservation:
    results.falseSelfReport.status === "HOLD_SELF_REPORT_OBSERVATION_CONFLICT",
  correctButSlowHeldAgainstDeclaredBudget:
    results.slowCorrectRoute.status === "HOLD_FIRST_VALID_FRAME_BUDGET_EXCEEDED",
  noInventedThreshold:
    results.noDeclaredBudget.status === "RUNTIME_ROUTE_VERIFIED_LATENCY_BUDGET_UNKNOWN",
  slowResourceIsAttributed:
    results.slowCorrectRoute.largestResource?.name === "legacy-large.bin",
};

if (!Object.values(assertions).every(Boolean)) {
  throw new Error(`probe failed: ${JSON.stringify({ results, assertions })}`);
}

process.stdout.write(`${JSON.stringify({
  probe: "N307_BROWSER_OBSERVED_RUNTIME_ROUTE_RECEIPT",
  contract: baseContract,
  results,
  assertions,
}, null, 2)}\n`);
