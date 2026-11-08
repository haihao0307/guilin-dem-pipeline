import vm from 'node:vm';

let ambientWeather = 'dry';

const hostCreatedProvider = state => ({
  declaredGeometry: `${state.width}x${state.height}`,
  surfaceClass: ambientWeather === 'rain' ? 'wet' : 'dry',
});

function auditState(value) {
  const reads = new Set();
  const proxy = new Proxy(value, {
    get(target, property, receiver) {
      if (typeof property === 'string') reads.add(property);
      return Reflect.get(target, property, receiver);
    },
  });
  return { proxy, reads };
}

function declaredKey(state) {
  return JSON.stringify({ width: state.width, height: state.height });
}

const dryState = { width: 12, height: 8 };
const rainState = { width: 12, height: 8 };

const dryAudit = auditState(dryState);
ambientWeather = 'dry';
const dryOutput = hostCreatedProvider(dryAudit.proxy);

const rainAudit = auditState(rainState);
ambientWeather = 'rain';
const rainOutput = hostCreatedProvider(rainAudit.proxy);

const passedHostFunctionContext = vm.createContext({
  provider: hostCreatedProvider,
  state: { width: 12, height: 8 },
});
ambientWeather = 'dry';
const passedHostDry = new vm.Script('provider(state)').runInContext(passedHostFunctionContext);
ambientWeather = 'rain';
const passedHostRain = new vm.Script('provider(state)').runInContext(passedHostFunctionContext);

const providerSource = `(state) => ({
  declaredGeometry: state.width + 'x' + state.height,
  surfaceClass: ambientWeather === 'rain' ? 'wet' : 'dry',
})`;

let restrictedError = null;
try {
  const restrictedContext = vm.createContext({ state: { width: 12, height: 8 } });
  new vm.Script(`(${providerSource})(state)`).runInContext(restrictedContext);
} catch (error) {
  restrictedError = `${error.name}: ${error.message}`;
}

const explicitDry = new vm.Script(`(${providerSource})(state)`).runInContext(
  vm.createContext({ state: { width: 12, height: 8 }, ambientWeather: 'dry' }),
);
const explicitRain = new vm.Script(`(${providerSource})(state)`).runInContext(
  vm.createContext({ state: { width: 12, height: 8 }, ambientWeather: 'rain' }),
);

const checks = {
  declaredKeysCollide: declaredKey(dryState) === declaredKey(rainState),
  hiddenAmbientReadChangesOutput: dryOutput.surfaceClass !== rainOutput.surfaceClass,
  inputProxyMissesAmbientRead:
    JSON.stringify([...dryAudit.reads].sort()) === JSON.stringify(['height', 'width']) &&
    JSON.stringify([...rainAudit.reads].sort()) === JSON.stringify(['height', 'width']),
  passingHostFunctionDoesNotRemoveClosureAuthority:
    passedHostDry.surfaceClass !== passedHostRain.surfaceClass,
  restrictedEvaluationRejectsMissingEndowment:
    restrictedError?.startsWith('ReferenceError: ambientWeather is not defined') === true,
  explicitEndowmentMakesDependencyControllable:
    explicitDry.surfaceClass === 'dry' && explicitRain.surfaceClass === 'wet',
};

const result = {
  probe: 'N254_AMBIENT_AUTHORITY_CONSTRUCTION_BOUNDARY',
  runtime: process.version,
  warning: 'node:vm is used only for a deterministic correctness counterexample, not as a security boundary',
  declaredKeyDry: declaredKey(dryState),
  declaredKeyRain: declaredKey(rainState),
  dryOutput,
  rainOutput,
  observedInputReads: [...new Set([...dryAudit.reads, ...rainAudit.reads])].sort(),
  passedHostDry,
  passedHostRain,
  restrictedError,
  explicitDry,
  explicitRain,
  checks,
  passCount: Object.values(checks).filter(Boolean).length,
  totalChecks: Object.keys(checks).length,
};

console.log(JSON.stringify(result, null, 2));

if (result.passCount !== result.totalChecks) process.exitCode = 1;
