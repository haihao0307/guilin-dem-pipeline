import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPublicConsole} from './tailor-layering-r03-console-classifier.mjs';

const BASE = 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/layering-r03-20261021-a49b6eb/';
const URL = 'https://haihao0307.github.io/favicon.ico';
const TEXT = 'Failed to load resource: the server responded with a status of 404 ()';
const fixture = () => ({console: [{type: 'error', text: TEXT, location: {url: URL}, observedAtMS: 1126}], cdp: {
  log: [{source: 'network', level: 'error', text: TEXT, url: URL, networkRequestId: '3214.3', timestamp: 1792560631378.516}],
  requests: [{requestId: '3214.3', url: URL, documentURL: BASE, method: 'GET', type: 'Other', initiator: {type: 'other'}}],
  responses: [{requestId: '3214.3', url: URL, status: 404, type: 'Other', fromDiskCache: false, fromServiceWorker: false}],
  loadingFailures: [],
}});

test('zero console and CDP errors passes without creating an exemption', () => {
  const result = classifyPublicConsole({console: [], cdp: {log: [], requests: [], responses: [], loadingFailures: []}}, BASE);
  assert.equal(result.passed, true);
  assert.equal(result.acceptedNoncriticalBrowserResourceErrors.length, 0);
});
test('a CDP loading failure without a console error remains a failed gate', () => {
  const input = {console: [], cdp: {log: [], requests: [], responses: [], loadingFailures: [{requestId: 'broken', errorText: 'net::ERR_FAILED'}]}};
  assert.equal(classifyPublicConsole(input, BASE).passed, false);
});
test('a failed CDP HTTP response without a console error remains a failed gate', () => {
  const input = {console: [], cdp: {log: [], requests: [], loadingFailures: [], responses: [{requestId: 'broken', url: BASE + 'app.mjs', status: 500, type: 'Script'}]}};
  assert.equal(classifyPublicConsole(input, BASE).passed, false);
});
test('only the fully observed optional browser favicon 404 is classified, with the raw error preserved', () => {
  const input = fixture(), before = structuredClone(input), result = classifyPublicConsole(input, BASE);
  assert.equal(result.passed, true);
  assert.equal(result.totalConsoleErrors, 1);
  assert.equal(result.totalCDPLogErrors, 1);
  assert.equal(result.acceptedNoncriticalBrowserResourceErrors.length, 1);
  assert.equal(result.acceptedNoncriticalBrowserResourceErrors[0].requestId, '3214.3');
  assert.deepEqual(input, before);
});
const rejected = [
  ['unlocated console error', x => delete x.console[0].location],
  ['different origin', x => x.console[0].location.url = 'https://example.com/favicon.ico'],
  ['runtime resource instead of origin icon', x => x.console[0].location.url = BASE + 'favicon.ico'],
  ['unrelated console error text', x => x.console[0].text = 'Uncaught TypeError: application failure'],
  ['missing CDP log', x => x.cdp.log = []],
  ['missing request', x => x.cdp.requests = []],
  ['missing response', x => x.cdp.responses = []],
  ['mismatched request ID', x => x.cdp.responses[0].requestId = 'different'],
  ['different response URL', x => x.cdp.responses[0].url = BASE + 'app.mjs'],
  ['HTTP 500', x => x.cdp.responses[0].status = 500],
  ['script-initiated request', x => x.cdp.requests[0].initiator.type = 'script'],
  ['different document', x => x.cdp.requests[0].documentURL = BASE + 'other.html'],
  ['non-GET request', x => x.cdp.requests[0].method = 'POST'],
  ['cached response', x => x.cdp.responses[0].fromDiskCache = true],
  ['extra ordinary console error', x => x.console.push({type: 'error', text: 'Another resource failed'})],
  ['extra CDP error', x => x.cdp.log.push({source: 'javascript', level: 'error', text: 'Failure'})],
  ['CDP loading failure', x => x.cdp.loadingFailures.push({requestId: '3214.3', errorText: 'net::ERR_FAILED'})],
  ['extra critical HTTP failure', x => x.cdp.responses.push({requestId: 'unrelated-critical', url: BASE + 'app.mjs', status: 500, type: 'Script', fromDiskCache: false, fromServiceWorker: false})],
];
for (const [name, mutate] of rejected) test(name + ' remains a failed gate', () => {
  const input = fixture(); mutate(input);
  assert.equal(classifyPublicConsole(input, BASE).passed, false);
});
