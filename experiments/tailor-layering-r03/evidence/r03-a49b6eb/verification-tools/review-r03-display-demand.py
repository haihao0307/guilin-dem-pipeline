"""Read-only evidence verification; does not launch a browser or run physics."""
import base64
import collections
import gzip
import hashlib
import json
import math
import pathlib
import struct
from PIL import Image, ImageChops

ROOT = pathlib.Path('/workspace/scratch/f88f885c9eb3')
SOURCE = 'a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b'
OUT = ROOT / 'scratch-review/r03-final-display-demand-readback.json'
checks = []

def check(value, label):
    checks.append({'name': label, 'passed': bool(value)})
    if not value:
        raise AssertionError(label)

def read(path):
    return json.loads(path.read_text())

def sha(data):
    return hashlib.sha256(data).hexdigest()

def array_sha(values, typecode):
    return sha(struct.pack('<' + str(len(values)) + typecode, *values))

def pixel_comparison(a, b):
    aa, bb = Image.open(a).convert('RGBA'), Image.open(b).convert('RGBA')
    check(aa.size == bb.size, 'image dimensions: ' + a.name)
    delta = max(hi for lo, hi in ImageChops.difference(aa, bb).getextrema())
    return {'pixels': aa.width * aa.height, 'dimensions': list(aa.size),
            'maxChannelDelta': delta, 'identicalPixels': delta == 0,
            'identicalPNGBytes': a.read_bytes() == b.read_bytes(), 'sha256': sha(a.read_bytes())}

metrics, artifacts = {}, {}
for name, artifact_id, job_id in [('display', 12319090927, 119023772191), ('demand', 12319111392, 119023772264)]:
    p = ROOT / 'r03-final-ci' / name
    m = read(p / 'browser-metrics.json')
    metrics[name] = m
    rec = read(p / 'independent-download-receipt.json')
    check(m['passed'] is True and m['scenario'] == name and m['scenariosCompleted'] == [name], name + ': completed exact scenario')
    check(m['sourceProvenance']['sourceCommit'] == SOURCE, name + ': source identity')
    check(m['publicationPerformed'] is False and m['screenshotsAreBrowserCaptures'] is True, name + ': local browser scope')
    check(m['consoleErrorCount'] == 0 and not m['pageErrors'] and not m['forbiddenRequests'], name + ': error summary')
    check(read(p / 'browser-errors.json') == [], name + ': raw page errors')
    console = read(p / 'browser-console.json')
    check(not any(x['type'] == 'error' for x in console), name + ': raw console errors')
    network = read(p / 'browser-network.json')
    check(len(network) == 89 and all(x.get('status') == 200 and not x.get('failure') for x in network), name + ': all 89 requests HTTP 200')
    tap = (p / 'numerical.tap').read_text()
    check(all(x in tap for x in ['# tests 38\n', '# pass 38\n', '# fail 0\n', '# skipped 0\n', '# cancelled 0\n']), name + ': numerical TAP 38 pass no skips')
    log = (ROOT / f'scratch-ci-monitor/r03-final-{name}-{job_id}.log').read_text()
    check('git checkout --progress --force ' + SOURCE in log and 'HEAD is now at a49b6eb ' in log, name + ': actual checkout')
    for f in m['sourceProvenance']['authoredFiles']:
        local = (ROOT / 'repo/experiments/tailor-layering-r03/src' / f['path']).read_bytes()
        check(len(local) == f['bytes'] and sha(local) == f['sha256'], name + ': local authored hash ' + f['path'])
    native = m['nativeObservation']
    data = (p / native['file']).read_bytes()
    check(len(data) == native['fileBytes'] and sha(data) == native['fileSHA256'], name + ': original native observation hash')
    check(all(native[k] is True for k in ['exactYUpBytesMatch', 'exactTopologyMatch', 'sameCanvas', 'platformReady']), name + ': original body identity flags')
    check(native['vertices'] == 25417 and native['triangles'] == 50624, name + ': original body topology size')
    for o in m['observations']:
        d = o['diagnostic']
        check(d['sourceCommit'] == SOURCE and d['ready'] is True and d['error'] is None, name + ': diagnostic ' + o['name'])
        if 'webgl' in o:
            check(o['webgl']['context'] is True and o['webgl']['contextLost'] is False and o['webgl']['currentProgramLinked'] is True,
                  name + ': live WebGL ' + o['name'])
    zip_sha = rec.get('verifiedZipSHA256', rec.get('zipSHA256'))
    zip_size = rec.get('verifiedZipBytes', rec.get('zipBytes'))
    zip_bytes = (p.parent / f'{name}-artifact-{artifact_id}.zip').read_bytes()
    check(sha(zip_bytes) == zip_sha and len(zip_bytes) == zip_size, name + ': original retained ZIP digest')
    artifacts[name] = {'artifactID': artifact_id, 'jobID': job_id, 'metricsSHA256': sha((p / 'browser-metrics.json').read_bytes()),
                       'artifactZIP_SHA256': zip_sha, 'artifactZIPBytes': zip_size,
                       'elapsedMS': m['elapsedMS'], 'warnings': dict(collections.Counter(x['text'] for x in console if x['type'] == 'warning'))}

display = ROOT / 'r03-final-ci/display'
capsule = read(display / 'runtime-capsule.json')
check(capsule['sourceCommit'] == SOURCE and len(capsule['entries']) == 308, 'display: new runtime capsule source and entry count')
provenance_bytes = base64.b64decode(capsule['generatedBase64']['SOURCE_PROVENANCE.json'])
entry = next(x for x in capsule['entries'] if x['path'] == 'SOURCE_PROVENANCE.json')
check(json.loads(provenance_bytes) == metrics['display']['sourceProvenance'] == metrics['demand']['sourceProvenance'], 'display/demand/capsule exact provenance match')
check(sha(provenance_bytes) == entry['sha256'] and len(provenance_bytes) == entry['bytes'], 'generated provenance bytes')
comparisons = {}
for name in ['initial', 'isolated', 'recolored', 'detail', 'separated']:
    comparisons[name] = pixel_comparison(display / (name + '-canvas.png'), ROOT / 'r03-ci/display' / (name + '-canvas.png'))
    check(comparisons[name]['identicalPNGBytes'], 'new/previous R03 exact canvas bytes: ' + name)
    check(all(o['diagnostic']['physics']['completedSteps'] == 0 for o in metrics['display']['observations']), 'display is initial presentation only')
comparisons['r02Initial'] = pixel_comparison(display / 'initial-canvas.png', ROOT / 'handoff/TAILOR_LAYERING_R02_TO_R03_HANDOFF_2026-10-21/evidence/initial-canvas.png')
check(comparisons['r02Initial']['identicalPNGBytes'], 'new/R02 exact initial canvas bytes')

p = ROOT / 'r03-final-ci/demand'
m = metrics['demand']
comparison = m['renderDemandComparison']
check(comparison['order'] == ['off', 'on', 'on', 'off'], 'render-demand: ABBA order')
trial_digests = [t['geometryDigest'] for t in comparison['trials']]
check(all(d == trial_digests[0] for d in trial_digests), 'render-demand: identical position/normal/topology digests all 4 resets')
for i, t in enumerate(comparison['trials']):
    check(t['physicsSteps'] == 0 and t['physicalSeconds'] == 0 and t['workerResponses'] == 1, 'render-demand: measurement-only real response ' + str(i))
    check(t['submittedFrames'] == t['completedFrames'] == (0 if t['enabled'] else 1), 'render-demand: completed submitted frames ' + str(i))
    check(all(v == (0 if t['enabled'] else 2) for v in t['perGarmentUploads'].values()), 'render-demand: geometry uploads ' + str(i))
    saved = read(p / (t['name'] + '-measurement.json'))
    check(saved['sameStateRenderComparison'] == t, 'render-demand: original measurement file ' + str(i))
same_pixels = pixel_comparison(p / 'demand-on-canvas.png', p / 'demand-off-canvas.png')
check(same_pixels['identicalPixels'] and same_pixels['identicalPNGBytes'], 'render-demand: independently zero actual pixel delta')

interval = next(o['continuous'] for o in m['observations'] if 'continuous' in o)
responses = interval['responseAudits']
check(len(responses) == interval['actualSteps'] == m['hiddenGeometryRestore']['actualSteps'] == 26, 'hidden: 26 actual response audits')
for i, response in enumerate(responses, 1):
    a = response['audit']
    check(response['error'] is None and response['type'] == 'step' and a['completedSteps'] == i, 'hidden: accepted actual step ' + str(i))
    check(abs(a['simulationSeconds'] - i / 120) <= 1e-12, 'hidden: physical clock ' + str(i))
    check(math.isfinite(a['maxEdgeStretch']) and a['maxEdgeStretch'] <= 1.45 and a['seamGapMM'] <= 0.01, 'hidden: original structural bounds ' + str(i))
    check(math.isfinite(a['contact']['residualMaxPenetration']) and a['contact']['residualMaxPenetration'] <= 0.0005, 'hidden: original 0.5mm cloth bound ' + str(i))
    check(a['bodyEnvelope']['maxHalfThicknessOverlapM'] <= 0.000001, 'hidden: body envelope bound ' + str(i))
check(interval['observation']['droppedCheckpoints'] == 0, 'hidden: no dropped selected checkpoints')
geometry_checks = []
for g in m['geometryChecks']:
    data = (p / g['rawName']).read_bytes()
    check(len(data) == g['rawBytes'] and sha(data) == g['rawSHA256'], 'geometry: raw hash ' + g['name'])
    raw = json.loads(gzip.decompress(data))['snapshot']
    report = read(p / g['reportName'])
    check(raw['id'] == report['requestID'] == g['requestID'] and raw['audit']['completedSteps'] == report['completedSteps'] == g['physicalStep'], 'geometry: identity ' + g['name'])
    check(report['intersections']['hasReportedIntersections'] is False and report['intersections']['degenerateTriangles'] == 0,
          'geometry: zero cross/degenerate reports ' + g['name'])
    check(report['intersections']['scope']['completeForInputTriangles'] is True, 'geometry: complete selected input scope ' + g['name'])
    check(all(v == 0 for name in ['garmentPairs', 'bodyPairs'] for v in report[name].values()), 'geometry: raw pair totals ' + g['name'])
    for row in raw['rows']:
        check(all(math.isfinite(x) for x in row['positions'] + row['normals']), 'geometry: finite arrays ' + g['name'] + '/' + row['id'])
    geometry_checks.append({'requestID': raw['id'], 'physicalStep': raw['audit']['completedSteps'], 'rawSHA256': sha(data)})
    if g['physicalStep'] == 26:
        final_rows = {x['id']: x for x in raw['rows']}
initial_hashes = {x['id']: x for x in trial_digests[0]}
for id in ['pants', 'inner']:
    check(array_sha(final_rows[id]['positions'], 'f') != initial_hashes[id]['positions'], 'hidden: actual retained positions evolved ' + id)
    check(array_sha(final_rows[id]['indices'], 'I') == initial_hashes[id]['topology'], 'hidden: retained topology unchanged ' + id)
hidden = read(p / 'isolated-body-audit.json')
shown = read(p / 'restored-newest-hidden-geometry.json')
h, s = hidden['diagnostic'], shown['diagnostic']
check(hidden['fullBodyAudit'] is True and hidden['physicalLimitsEnforced'] is True, 'hidden: full body audit enforced')
check(h['physics'] == s['physics'], 'restoration: complete physical report unchanged')
check(h['physics']['bodySampledVertices'] == 9402 and h['physics']['bodyInsideVertices'] == 0 and h['physics']['bodyThicknessOverlapMM'] == 0, 'hidden: all physical vertices body audit')
check(hidden['explicitContactInspection']['measurementOnly'] is True and hidden['explicitContactInspection']['advancedSimulation'] is False, 'audit: no physical progress impersonation')
check(h['render']['demand']['pendingIDs'] == ['pants', 'inner'] and s['render']['demand']['pendingIDs'] == [], 'restoration: pending states consumed')
for id in ['pants', 'inner']:
    check(h['render']['demand']['uploadedByGarment'][id] == 9 and s['render']['demand']['uploadedByGarment'][id] == 10, 'restoration: actual upload increment ' + id)
    check(h['render']['demand']['lastUploadedSnapshotIDByGarment'][id] == 9 and s['render']['demand']['lastUploadedSnapshotIDByGarment'][id] == hidden['actualWorkerReply'] == 37,
          'restoration: newest retained snapshot uploaded ' + id)
    check(s['render']['demand']['lastUploadedPhysicalStepByGarment'][id] == 26, 'restoration: latest physical step displayed ' + id)

result = {'schema': 'kaopu-independent-ci-artifact-readback@1', 'sourceCommit': SOURCE, 'runID': 39539509515,
          'decision': 'PASS_DISPLAY_AND_RENDER_DEMAND_SCOPES_ONLY', 'allChecksPassed': True, 'checkCount': len(checks),
          'artifacts': artifacts, 'displayPixelComparisons': comparisons, 'demandPixels': same_pixels,
          'realHiddenSteps': 26, 'realHiddenPhysicalSeconds': interval['actualSeconds'], 'selectedGeometryAudits': geometry_checks,
          'maximumStepStretch': max(r['audit']['maxEdgeStretch'] for r in responses),
          'maximumStepClothResidualMM': max(r['audit']['contact']['residualMaxPenetration'] for r in responses) * 1000,
          'maximumStepBodyHalfThicknessOverlapMM': max(r['audit']['bodyEnvelope']['maxHalfThicknessOverlapM'] for r in responses) * 1000,
          'maximumSeamGapMM': max(r['audit']['seamGapMM'] for r in responses), 'finalFullBodySampledVertices': 9402,
          'finalFullBodyInsideVertices': 0, 'finalFullBodyThicknessOverlapMM': 0,
          'restoredSnapshotID': 37, 'restoredPhysicalStep': 26,
          'limitations': ['No browser or physics was rerun by this readback; raw artifacts, hashes, arrays, records and images were reviewed.',
                          'ABBA tests render demand, not R03 contact-demand OFF/ON solver equivalence.',
                          'ABBA is a paused measurement and no dynamics acceptance is inferred from its frozen state.',
                          'Only 6 selected geometry states have independent complete triangle-pair audits; all 26 actual step reports are checked.',
                          'Live in-process restore request-count/geometry assertions passed in CI; the artifact retains selected numeric checkpoints, not a full typed-byte Worker state for every reply.',
                          'No public/mobile/reentry/continuous/native replay completion or realtime claim follows from these two jobs.'], 'checks': checks}
OUT.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k:result[k] for k in ['decision','checkCount','maximumStepStretch','maximumStepClothResidualMM','maximumStepBodyHalfThicknessOverlapMM','realHiddenSteps']}))
print(str(OUT))
