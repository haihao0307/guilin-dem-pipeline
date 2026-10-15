import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./shared_skin_active_route_subject_binding_n162.json', import.meta.url)));

const PARTIAL = 'CONTENT_EQUIVALENCE_VERIFIED__HOLD_ACTIVE_ROUTE_BROWSER_UNBOUND';

export function classify(input) {
  if (!input.activeRoute || !input.testedRoute) return 'HOLD_ACTIVE_ROUTE_IDENTITY_MISSING';
  if (!input.runtimeDigestMatches || !input.assetSetDigestMatches) return 'HOLD_ACTIVE_SUBJECT_DIGEST_MISMATCH';

  const exactRoute = input.activeRoute === input.testedRoute;
  const runAfterRouteCreation = Number.isFinite(Date.parse(input.routeCreatedAt))
    && Number.isFinite(Date.parse(input.browserFinishedAt))
    && Date.parse(input.browserFinishedAt) >= Date.parse(input.routeCreatedAt);

  if (!exactRoute || !input.publicCommitContainsActiveRoute || !runAfterRouteCreation || !input.newBrowserRunPerformed) {
    return PARTIAL;
  }
  if (!input.httpPassed || !input.versionMarkerMatched) return 'HOLD_ACTIVE_ROUTE_PUBLIC_IDENTITY_UNBOUND';
  if (!input.browserPassed) return 'HOLD_ACTIVE_ROUTE_BROWSER_FAILED';
  return 'ACTIVE_ROUTE_BROWSER_VERIFIED';
}

const current = {
  activeRoute: fixture.activeRoute,
  testedRoute: fixture.testedPublicRoute,
  runtimeDigestMatches: fixture.activeRuntimeSourceDigestsMatchTestedRelease,
  assetSetDigestMatches: fixture.allCopiedAssetsDigestMatched,
  routeCreatedAt: fixture.activeRouteCreatedAt,
  browserFinishedAt: fixture.testedPublicRouteFinishedAt,
  publicCommitContainsActiveRoute: fixture.publicCommitContainsActiveRoute,
  newBrowserRunPerformed: fixture.newBrowserRunPerformed,
  httpPassed: fixture.activeRouteHttpPassed,
  versionMarkerMatched: fixture.activeRouteVersionMarkerMatched,
  browserPassed: fixture.activeRouteBrowserPassed
};

const exact = {
  activeRoute: 'https://example.test/current',
  testedRoute: 'https://example.test/current',
  runtimeDigestMatches: true,
  assetSetDigestMatches: true,
  routeCreatedAt: '2026-10-15T10:00:00Z',
  browserFinishedAt: '2026-10-15T10:05:00Z',
  publicCommitContainsActiveRoute: true,
  newBrowserRunPerformed: true,
  httpPassed: true,
  versionMarkerMatched: true,
  browserPassed: true
};

const cases = [
  ['current stable overlay inherits bytes but not route execution', current, fixture.expectedState],
  ['missing active route identity', {...exact, activeRoute: null}, 'HOLD_ACTIVE_ROUTE_IDENTITY_MISSING'],
  ['runtime digest mismatch', {...exact, runtimeDigestMatches: false}, 'HOLD_ACTIVE_SUBJECT_DIGEST_MISMATCH'],
  ['asset set mismatch', {...exact, assetSetDigestMatches: false}, 'HOLD_ACTIVE_SUBJECT_DIGEST_MISMATCH'],
  ['same bytes on predecessor route remain partial', {...exact, testedRoute: 'https://example.test/predecessor'}, PARTIAL],
  ['public commit predates route introduction', {...exact, publicCommitContainsActiveRoute: false}, PARTIAL],
  ['browser evidence predates route creation', {...exact, browserFinishedAt: '2026-10-15T09:59:59Z'}, PARTIAL],
  ['exact route lacks new browser run', {...exact, newBrowserRunPerformed: false}, PARTIAL],
  ['HTTP or version identity missing', {...exact, versionMarkerMatched: false}, 'HOLD_ACTIVE_ROUTE_PUBLIC_IDENTITY_UNBOUND'],
  ['exact active route browser fails', {...exact, browserPassed: false}, 'HOLD_ACTIVE_ROUTE_BROWSER_FAILED'],
  ['exact active route closes machine gate', exact, 'ACTIVE_ROUTE_BROWSER_VERIFIED']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/active-route-tested-subject-result@1',
  fixture: 'shared_skin_active_route_subject_binding_n162.json',
  passed: results.length,
  total: results.length,
  currentState: classify(current),
  temporalProof: {
    testedPublicRouteFinishedAt: fixture.testedPublicRouteFinishedAt,
    activeRouteCreatedAt: fixture.activeRouteCreatedAt,
    browserRunCanCoverActiveRoute: Date.parse(fixture.testedPublicRouteFinishedAt) >= Date.parse(fixture.activeRouteCreatedAt)
  },
  claimBoundary: {
    contentEquivalence: 'VERIFIED',
    activeRoutePublicIdentity: 'UNBOUND',
    activeRouteBrowserExecution: 'UNBOUND',
    userVisualAcceptance: 'PENDING'
  },
  results
};

fs.writeFileSync(new URL('./shared_skin_active_route_subject_binding_result_n162.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
