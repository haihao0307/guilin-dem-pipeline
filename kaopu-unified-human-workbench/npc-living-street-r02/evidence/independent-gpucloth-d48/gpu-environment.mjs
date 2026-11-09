// Read-only preflight. This does not request a device or execute a solver.
export function adapterRecord(adapter) {
  const limits = {};
  for (const key of new Set([
    ...Object.keys(adapter.limits),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(adapter.limits)),
  ])) {
    try { if (typeof adapter.limits[key] === 'number') limits[key] = adapter.limits[key]; } catch {}
  }
  const info = adapter.info;
  return {
    info: info ? {
      vendor: info.vendor, architecture: info.architecture,
      device: info.device, description: info.description,
      subgroupMinSize: info.subgroupMinSize ?? null,
      subgroupMaxSize: info.subgroupMaxSize ?? null,
      isFallbackAdapter: info.isFallbackAdapter ?? null,
    } : null,
    adapterIsFallback: adapter.isFallbackAdapter ?? null,
    features: [...adapter.features].sort(), limits,
  };
}

export async function probeGPU() {
  const result = {
    status: 'PROBE_STARTED',
    secureContext: globalThis.isSecureContext,
    location: location.href,
    userAgent: navigator.userAgent,
    navigatorGPU: !!navigator.gpu,
    requestedAdapterOptions: {powerPreference: 'high-performance'},
    requiredStorageBuffersPerShaderStage: 10,
    deviceRequested: false, solverExecuted: false,
    userHardwarePerformanceAccepted: false,
  };
  if (!navigator.gpu) return {...result, status: 'WEBGPU_UNAVAILABLE', eligible: false};
  const adapter = await navigator.gpu.requestAdapter(result.requestedAdapterOptions);
  if (!adapter) return {...result, status: 'WEBGPU_ADAPTER_UNAVAILABLE', eligible: false};
  result.adapter = adapterRecord(adapter);
  result.eligible = adapter.limits.maxStorageBuffersPerShaderStage >= 10;
  result.status = result.eligible ? 'ADAPTER_PRECONDITIONS_MET' : 'ADAPTER_STORAGE_BINDINGS_INSUFFICIENT';
  return result;
}
