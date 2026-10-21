// Evidence-based classification of the one browser-initiated, optional favicon
// 404 identified in diagnostic run 39549894670. Raw errors are never removed.
// Any extra error or missing/mismatched observation remains a failed gate.
const RESOURCE_404 = 'Failed to load resource: the server responded with a status of 404 ()';

export function classifyPublicConsole(observation, publicURL) {
  const consoleErrors = observation.console.filter(row => row.type === 'error');
  const cdpErrors = observation.cdp.log.filter(row => row.level === 'error');
  const loadingFailures = observation.cdp.loadingFailures;
  const httpFailures = observation.cdp.responses.filter(row => row.status >= 400);
  const faviconURL = new URL('/favicon.ico', publicURL).href;
  const result = {
    schema: 'kaopu-r03-public-console-classification@1',
    policy: 'PUBLIC_WEB_DELIVERY_GATE v1.2.0: no fatal console errors or critical resource failures',
    classificationChange: 'The former zero-all-console-errors assertion is narrowed only for the independently observed optional origin-root favicon 404.',
    rawErrorsPreserved: true, totalConsoleErrors: consoleErrors.length,
    totalCDPLogErrors: cdpErrors.length, totalCDPLoadingFailures: loadingFailures.length,
    totalCDPHTTPFailures: httpFailures.length, unclassifiedCDPHTTPFailures: httpFailures,
    unclassifiedCDPLoadingFailures: loadingFailures, expectedOptionalFaviconURL: faviconURL,
    acceptedNoncriticalBrowserResourceErrors: [], unclassifiedConsoleErrors: consoleErrors,
    unclassifiedCDPLogErrors: cdpErrors, passed: false,
  };
  if (loadingFailures.length !== 0) return result;
  if (consoleErrors.length === 0 && cdpErrors.length === 0) {
    result.passed = httpFailures.length === 0;
    return result;
  }
  if (consoleErrors.length !== 1 || cdpErrors.length !== 1) return result;
  const error = consoleErrors[0], log = cdpErrors[0];
  const requests = observation.cdp.requests.filter(row => row.requestId === log.networkRequestId);
  const responses = observation.cdp.responses.filter(row => row.requestId === log.networkRequestId);
  const request = requests[0], response = responses[0];
  result.match = {
    consoleURL: error.location?.url === faviconURL,
    console404Text: error.text === RESOURCE_404,
    cdpNetworkError: log.source === 'network' && log.level === 'error',
    cdpURL: log.url === faviconURL,
    cdp404Text: log.text === RESOURCE_404,
    explicitRequestID: typeof log.networkRequestId === 'string' && log.networkRequestId.length > 0,
    oneRequestAndResponse: requests.length === 1 && responses.length === 1,
    soleFailedHTTPResponse: httpFailures.length === 1 && httpFailures[0] === response,
    browserInitiatedRequest: request?.type === 'Other' && request?.initiator?.type === 'other',
    exactRequestURL: request?.url === faviconURL && request?.documentURL === publicURL,
    getRequest: request?.method === 'GET',
    exactResponseURL: response?.url === faviconURL,
    noncritical404Response: response?.type === 'Other' && response?.status === 404,
    freshNetworkResponse: response?.fromDiskCache === false && response?.fromServiceWorker === false,
  };
  if (!Object.values(result.match).every(Boolean)) return result;
  result.acceptedNoncriticalBrowserResourceErrors.push({
    classification: 'OPTIONAL_BROWSER_ORIGIN_FAVICON_404',
    url: faviconURL, status: 404, requestId: log.networkRequestId,
    consoleObservedAtMS: error.observedAtMS, cdpTimestamp: log.timestamp,
    criticalRuntimeResource: false,
  });
  result.unclassifiedConsoleErrors = [];
  result.unclassifiedCDPLogErrors = [];
  result.unclassifiedCDPHTTPFailures = [];
  result.passed = true;
  return result;
}
