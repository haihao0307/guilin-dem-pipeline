export const KARST_FIELD_PRODUCTION_CONTRACT = Object.freeze({
  schema: "KARST_FIELD_PRODUCTION_CONTRACT_R263",
  frozenGeometry: true,
  runtimeInputs: ["tideOffset", "wetBand"],
  runtimeBands: ["demMacro", "karstStructure", "surfaceMicroscope"],
});

export function selectKarstBands(projectedPixels) {
  if (!Number.isFinite(projectedPixels) || projectedPixels < 1) return ["demMacro"];
  if (projectedPixels < 96) return ["demMacro", "karstStructure"];
  return ["demMacro", "karstStructure", "surfaceMicroscope"];
}

export function applyTideSample(workbenchRuntime, tideOffsetMeters) {
  if (!workbenchRuntime || typeof workbenchRuntime.setTideLevel !== "function") {
    throw new TypeError("Karst runtime must expose setTideLevel(offset)");
  }
  return workbenchRuntime.setTideLevel(tideOffsetMeters);
}
