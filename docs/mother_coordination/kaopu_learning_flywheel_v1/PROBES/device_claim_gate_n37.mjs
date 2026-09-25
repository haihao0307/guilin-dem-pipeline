import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'device_claim_fixture_n37.json'), 'utf8'));

function missingFields(profile, evidence) {
  return profile.requiredEnvironmentFields.filter((field) => {
    const value = evidence[field];
    return value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);
  });
}

function decide(profileId, evidence, userObservation = null) {
  const profile = fixture.claimProfiles[profileId];
  if (!profile) return { decision: 'UNKNOWN_PROFILE', missing: [] };

  if (profileId === 'PHYSICAL_IOS_SAFARI_OPERATIONAL' && userObservation === 'WHITE_SCREEN') {
    return { decision: 'REJECTED_BY_USER_OBSERVATION', missing: missingFields(profile, evidence) };
  }

  const missing = missingFields(profile, evidence);
  if (profile.requiresPhysicalDevice &&
      (evidence.executionKind !== 'physicalDevice' || evidence.physicalDevice !== true)) {
    return { decision: 'UNKNOWN_NO_PHYSICAL_DEVICE_RUN', missing };
  }
  if (missing.length) return { decision: 'HOLD_ENVIRONMENT_IDENTITY_INCOMPLETE', missing };

  if (profileId === 'RESPONSIVE_VIEWPORT_390X844') {
    return {
      decision: evidence.viewports?.includes('390x844')
        ? 'RESPONSIVE_VIEWPORT_VERIFIED'
        : 'HOLD_REQUIRED_VIEWPORT_MISSING',
      missing
    };
  }
  if (profileId === 'HOSTED_CHROMIUM_RUNTIME') {
    return {
      decision: evidence.browserEngine === 'chromium'
        ? 'HOSTED_CHROMIUM_RUNTIME_VERIFIED'
        : 'HOLD_BROWSER_ENGINE_MISMATCH',
      missing
    };
  }
  return {
    decision: evidence.result === 'pass'
      ? 'PHYSICAL_DEVICE_OPERATIONAL_VERIFIED'
      : 'HOLD_PHYSICAL_DEVICE_RUN_FAILED',
    missing
  };
}

const r006 = fixture.historicalCases.FISH_R006;
const r012 = fixture.historicalCases.FISH_R012;
const viewportOnly = fixture.syntheticControls.viewportOnlyEvidence;
const physical = fixture.syntheticControls.completePhysicalDeviceEvidence;

const decisions = {
  r006HostedRuntime: decide('HOSTED_CHROMIUM_RUNTIME', r006.evidenceEnvironment),
  r006PhysicalDevice: decide(
    'PHYSICAL_IOS_SAFARI_OPERATIONAL',
    r006.evidenceEnvironment,
    r006.userObservation
  ),
  r012Viewport: decide('RESPONSIVE_VIEWPORT_390X844', r012.evidenceEnvironment),
  r012HostedRuntime: decide('HOSTED_CHROMIUM_RUNTIME', r012.evidenceEnvironment),
  r012PhysicalDevice: decide('PHYSICAL_IOS_SAFARI_OPERATIONAL', r012.evidenceEnvironment),
  viewportOnlyAsPhysical: decide('PHYSICAL_IOS_SAFARI_OPERATIONAL', viewportOnly),
  completePhysicalControl: decide('PHYSICAL_IOS_SAFARI_OPERATIONAL', physical)
};

const checks = [];
function check(id, actual, expected) {
  checks.push({ id, actual, expected, passed: JSON.stringify(actual) === JSON.stringify(expected) });
}

check('r012-exact-tested-subject', r012.testedSubjectSha,
  'b5f2d11cbf55e17518dda411bf034596818c46d5');
check('r012-runner-is-hosted-ubuntu', r012.workflowFacts.runsOn, 'ubuntu-latest');
check('r012-installed-browser-is-chromium', r012.workflowFacts.installedBrowser, 'chromium');
check('r012-receipt-keeps-user-device-untested', r012.receiptFacts.userDeviceRetested, false);
check('r012-viewport-claim-is-valid', decisions.r012Viewport.decision,
  'RESPONSIVE_VIEWPORT_VERIFIED');
check('r012-hosted-runtime-claim-is-valid', decisions.r012HostedRuntime.decision,
  'HOSTED_CHROMIUM_RUNTIME_VERIFIED');
check('r012-physical-device-claim-stays-unknown', decisions.r012PhysicalDevice.decision,
  'UNKNOWN_NO_PHYSICAL_DEVICE_RUN');
check('viewport-only-cannot-promote-to-physical-device', decisions.viewportOnlyAsPhysical.decision,
  'UNKNOWN_NO_PHYSICAL_DEVICE_RUN');
check('r006-hosted-runtime-evidence-remains-valid', decisions.r006HostedRuntime.decision,
  'HOSTED_CHROMIUM_RUNTIME_VERIFIED');
check('r006-user-white-screen-rejects-strong-device-operational-claim',
  decisions.r006PhysicalDevice.decision, 'REJECTED_BY_USER_OBSERVATION');
check('complete-physical-device-control-can-pass', decisions.completePhysicalControl.decision,
  'PHYSICAL_DEVICE_OPERATIONAL_VERIFIED');
check('physical-control-has-no-missing-environment-fields',
  decisions.completePhysicalControl.missing, []);

const result = {
  schema: 'kaopu.device-claim-probe/1.0',
  round: 'N37',
  boundedQuestion:
    'Can a 390x844 Chromium viewport pass on an ubuntu-latest hosted runner be promoted to physical iPhone/Safari verification?',
  historicalDecision: {
    r006: {
      hostedRuntime: decisions.r006HostedRuntime.decision,
      physicalDeviceOperational: decisions.r006PhysicalDevice.decision,
      originalClientCause: 'UNKNOWN_NOT_INFERRED'
    },
    r012: {
      responsiveViewport: decisions.r012Viewport.decision,
      hostedRuntime: decisions.r012HostedRuntime.decision,
      physicalDeviceOperational: decisions.r012PhysicalDevice.decision,
      userDeviceRetested: false
    }
  },
  candidateMethod: {
    rule: 'A claim may inherit only evidence whose execution environment satisfies the claim environment profile.',
    independentAxes: [
      'viewport/layout',
      'browser engine and host platform',
      'physical device and OS',
      'user observation/acceptance'
    ],
    forbiddenPromotion:
      'viewport dimensions or emulated device parameters imply physical-device execution'
  },
  decisions,
  checks,
  summary: {
    passed: checks.filter((x) => x.passed).length,
    total: checks.length,
    allPassed: checks.every((x) => x.passed)
  }
};

fs.writeFileSync(path.join(here, 'device_claim_result_n37.json'),
  JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.summary.allPassed) process.exit(1);
