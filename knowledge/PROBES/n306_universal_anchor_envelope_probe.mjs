import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function bytes(value) {
  return Buffer.from(stable(value), "utf8");
}

function descriptor(mediaType, value, annotations = {}) {
  const payload = bytes(value);
  return {
    mediaType,
    digest: `sha256:${createHash("sha256").update(payload).digest("hex")}`,
    size: payload.byteLength,
    annotations,
  };
}

function capture({ workbench, request, adapter }) {
  const resolved = adapter.resolve(workbench, request);
  if (!resolved?.components?.length) {
    return {
      status: "HOLD_ANCHOR_SCOPE_UNRESOLVED",
      reason: "No explicit component selection was resolved from the current workbench context.",
    };
  }

  const components = resolved.components.map((component) =>
    descriptor(component.mediaType, component.payload, {
      "kaopu.componentId": component.componentId,
      "kaopu.semanticRole": component.semanticRole,
    }),
  );

  const subject = descriptor(adapter.subjectMediaType, {
    workbenchId: workbench.id,
    parentWholeCommit: workbench.parentWholeCommit,
    components,
    excludedComponentIds: resolved.excludedComponentIds,
  });

  return {
    status: "ANCHOR_CAPTURED_CANDIDATE",
    envelope: {
      schema: "kaopu.gram-anchor-envelope/0.1-candidate",
      artifactType: adapter.artifactType,
      subject,
      components,
      scope: {
        includedComponentIds: resolved.components.map((item) => item.componentId),
        excludedComponentIds: resolved.excludedComponentIds,
        selectionSource: resolved.selectionSource,
        instructionDigest: descriptor("text/plain", request.instruction).digest,
      },
      adapter: {
        id: adapter.id,
        version: adapter.version,
      },
      truth: {
        captured: true,
        independentlyVerified: false,
        frozenByUser: false,
        userAccepted: false,
      },
    },
  };
}

function verify(envelope, payloadByDigest) {
  for (const item of envelope.components) {
    const payload = payloadByDigest[item.digest];
    if (!payload) return "HOLD_COMPONENT_PAYLOAD_MISSING";
    if (descriptor(item.mediaType, payload).digest !== item.digest) {
      return "HOLD_DESCRIPTOR_MISMATCH";
    }
    if (bytes(payload).byteLength !== item.size) return "HOLD_DESCRIPTOR_MISMATCH";
  }
  return "ANCHOR_DESCRIPTOR_VERIFIED";
}

const terrainWorkbench = {
  id: "terrain/guilin-core",
  parentWholeCommit: "main@terrain-r12",
  activeSelection: ["tile:yangtang-core-03"],
  state: {
    "tile:yangtang-core-03": {
      demResolutionMeters: 12.5,
      sourceLineage: ["copernicus-glo30"],
      heightDigest: "sha256:terrain-height-demo",
    },
    "runtime:weather": { wind: "draft" },
  },
};

const garmentWorkbench = {
  id: "garment/tailor-r02",
  parentWholeCommit: "main@garment-r02",
  activeSelection: ["pattern:front-shell"],
  state: {
    "pattern:front-shell": {
      boundaryCurve: "front-shell-v7",
      seamAllowanceMm: 12,
      materialProfile: "thick-canvas-r3",
    },
    "collider:body": { revision: "draft-9" },
  },
};

const terrainAdapter = {
  id: "kaopu.adapter.terrain",
  version: "0.1.0",
  artifactType: "application/vnd.kaopu.terrain-anchor.v1+json",
  subjectMediaType: "application/vnd.kaopu.terrain-workbench-subject.v1+json",
  resolve(workbench, request) {
    const ids = request.componentIds ?? workbench.activeSelection;
    if (!ids?.length) return null;
    return {
      components: ids.map((id) => ({
        componentId: id,
        semanticRole: "terrain-tile",
        mediaType: "application/vnd.kaopu.terrain-tile.v1+json",
        payload: workbench.state[id],
      })),
      excludedComponentIds: Object.keys(workbench.state).filter((id) => !ids.includes(id)),
      selectionSource: request.componentIds ? "task-anchor-explicit" : "workbench-active-selection",
    };
  },
};

const garmentAdapter = {
  id: "kaopu.adapter.garment",
  version: "0.1.0",
  artifactType: "application/vnd.kaopu.garment-anchor.v1+json",
  subjectMediaType: "application/vnd.kaopu.garment-workbench-subject.v1+json",
  resolve(workbench, request) {
    const ids = request.componentIds ?? workbench.activeSelection;
    if (!ids?.length) return null;
    return {
      components: ids.map((id) => ({
        componentId: id,
        semanticRole: "garment-pattern-piece",
        mediaType: "application/vnd.kaopu.garment-pattern.v1+json",
        payload: workbench.state[id],
      })),
      excludedComponentIds: Object.keys(workbench.state).filter((id) => !ids.includes(id)),
      selectionSource: request.componentIds ? "task-anchor-explicit" : "workbench-active-selection",
    };
  },
};

const instruction = { instruction: "靠谱锚定当前满意部分" };
const terrain = capture({ workbench: terrainWorkbench, request: instruction, adapter: terrainAdapter });
const garment = capture({ workbench: garmentWorkbench, request: instruction, adapter: garmentAdapter });
const ambiguous = capture({
  workbench: { ...terrainWorkbench, activeSelection: [] },
  request: instruction,
  adapter: terrainAdapter,
});

const garmentPayloads = Object.fromEntries(
  garment.envelope.components.map((item) => [
    item.digest,
    garmentWorkbench.state[item.annotations["kaopu.componentId"]],
  ]),
);
const verified = verify(garment.envelope, garmentPayloads);
const tampered = verify(garment.envelope, Object.fromEntries(
  Object.keys(garmentPayloads).map((key) => [key, { ...garmentPayloads[key], seamAllowanceMm: 6 }]),
));

const assertions = {
  sameEnvelopeSchemaAcrossDomains:
    terrain.envelope.schema === garment.envelope.schema,
  domainSemanticsRemainAdapterSpecific:
    terrain.envelope.artifactType !== garment.envelope.artifactType &&
    terrain.envelope.components[0].mediaType !== garment.envelope.components[0].mediaType,
  ambiguousScopeHeld:
    ambiguous.status === "HOLD_ANCHOR_SCOPE_UNRESOLVED",
  independentDescriptorVerificationPasses:
    verified === "ANCHOR_DESCRIPTOR_VERIFIED",
  tamperIsHeld:
    tampered === "HOLD_DESCRIPTOR_MISMATCH",
  captureDoesNotClaimAcceptance:
    !terrain.envelope.truth.userAccepted &&
    !terrain.envelope.truth.frozenByUser &&
    !terrain.envelope.truth.independentlyVerified,
};

if (!Object.values(assertions).every(Boolean)) {
  throw new Error(`probe failed: ${JSON.stringify(assertions)}`);
}

process.stdout.write(`${JSON.stringify({
  probe: "N306_UNIVERSAL_ANCHOR_ENVELOPE",
  terrain,
  garment,
  ambiguous,
  verification: { verified, tampered },
  assertions,
}, null, 2)}\n`);
