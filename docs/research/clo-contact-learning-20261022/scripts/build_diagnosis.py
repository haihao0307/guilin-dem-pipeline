"""Build evidence-bound diagnostic incidents from existing reports; no solve."""
import gzip
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(os.environ.get('OUT', ROOT / 'contact-learning-output/clo-contact-learning-20261022'))
if not OUT.is_absolute():
    OUT = ROOT / OUT

def read(name):
    raw = (OUT / name).read_bytes()
    return json.loads(gzip.decompress(raw) if name.endswith('.gz') else raw), hashlib.sha256(raw).hexdigest()

trace, trace_hash = read('TRACE_REVIEW.json')
audit, audit_hash = read('CONTACT_AUDIT.json')
readback, readback_hash = read('CHECKPOINT_READBACK_REVIEW.json')
snapshots, snapshots_hash = read('CHECKPOINTS.json.gz')
assert trace['sourceHead'] == audit['sourceHead'] == readback['sourceHead'] == snapshots['sourceHead']
assert trace['artifacts']['checkpoints']['sha256'] == snapshots_hash
assert readback['checkpointsSHA256'] == snapshots_hash, 'Readback belongs to another checkpoint artifact'
assert readback['originalWorkerSHA256'] == trace['originalWorkerSHA256'], 'Readback worker differs'
assert readback['bodySHA256'] == trace['assetHashes']['common-body.json'], 'Readback collider differs'
assert trace['donePacketSHA256'] == audit['sourceSHA256']
assert readback['passed'] and readback['finalCheckpointEqualsDone']
assert audit['checks']['sourceUnchanged']
assert audit['summary']['reportedPairs'] == len(audit['rows'])
assert audit['summary']['longdoubleProperHitPairs'] == len(audit['rows'])
assert not audit['runtimeSelfContact'] and not audit['continuousCollision']

checkpoints = snapshots['checkpoints']
assert len(checkpoints) == len(trace['checkpointSummary'])
full_binding = checkpoints[0]['spec']['source']['nativeBinding']
assert full_binding['materialSHA256'] == trace['inputVerified']['materialSHA256']
assert full_binding['paperSHA256'] == trace['inputVerified']['paperSHA256']
assert full_binding['operation']['requestId'] == trace['inputVerified']['requestId']
phase_sets = []
for c, summary in zip(checkpoints, trace['checkpointSummary']):
    assert c['label'] == summary['label']
    assert c['stageIndex'] == summary['stageIndex'] and c['stageFrame'] == summary['stageFrame']
    assert c['observedStateUnchanged'] is True and summary['observedStateUnchanged'] is True
    assert c['spec']['source']['nativeBinding'] == full_binding
    assert c['observedStateHashesBefore'] == c['observedStateHashesAfter']
    assert c['intersections']['selfStrictTriangleIntersectionCount'] == summary['clothPairs']
    assert c['intersections']['bodyIntersectingFaceCount'] == summary['bodyFaces']
    phase_sets.append({tuple(sorted(p)) for p in c['intersections']['selfPairs']})

incidents = []
for row in audit['rows']:
    hits = row['independentLongdoubleProperHits']
    # For this frozen reference all witnesses are strictly interior, without
    # relying on the broader numerical tolerance used by the audit routine.
    assert hits and all(0 < h['edgeT'] < 1 and min(h['triangleBarycentric']) > 0 for h in hits)
    pair = tuple(sorted(row['pair']))
    observations = [c['label'] for c, pairs in zip(checkpoints, phase_sets) if pair in pairs]
    incidents.append({
        'id': 'tri-%s-%s' % pair,
        'referenceFinalPair': list(pair),
        'referenceSource': 'original-public-Chromium-done-packet',
        'panels': [row['a']['panel'], row['b']['panel']],
        'triangles': [{k: row[side][k] for k in ('panel', 'localTriangle', 'localVertices', 'ids', 'solverGroups')} for side in ('a', 'b')],
        'nearestSeamsInMaterialSpace': {side: row[side]['nearestSeams'] for side in ('a', 'b')},
        'properIntersectionWitnesses': hits,
        'observedIntersectionSpanMm': row['intersectionSpanMm'],
        'sharedMaterialVertices': row['sharedMaterialVertices'],
        'sharedSolverGroups': row['sharedSolverGroups'],
        'replayCheckpointObservations': observations,
        'firstObservedReplayCheckpoint': observations[0] if observations else None,
        'checkpointMeaning': 'Sampled states in this separate frozen-material replay; not exact collision time or a universal trajectory.',
        'rootCause': {'status': 'not-established', 'automaticRepairAuthorizedByThisEvidence': False},
    })

first_global = next((c['label'] for c in checkpoints if c['intersections']['selfStrictTriangleIntersectionCount']), None)
diagnosis = {
    'schema': 'kaopu.cloth-contact-diagnosis/1',
    'status': 'research-executable-extractor; not a product runtime integration',
    'sourceHead': trace['sourceHead'],
    'inputBindings': {**full_binding, 'requestId': full_binding['operation']['requestId'],
                      'expectedRevision': full_binding['operation']['expectedRevision']},
    'evidenceHashes': {'trace': trace_hash, 'referenceAudit': audit_hash, 'snapshotReadback': readback_hash, 'checkpoints': snapshots_hash,
                       'referencePaperPacket': trace['paperPacketSHA256'], 'referenceDonePacket': trace['donePacketSHA256']},
    'observedCapabilities': {
        'finalTriangleIntersectionAudit': True,
        'bodyContactResponse': 'sampled-body-SDF-and-surface-projection',
        'runtimeClothSelfContactResponse': False,
        'continuousCollisionCertified': False,
        'untanglingCertified': False,
        'repairImplementedByThisExtractor': False,
    },
    'firstSampledGlobalContactCheckpoint': first_global,
    'phaseObservations': [{k: c[k] for k in ('label', 'stageIndex', 'stageFrame', 'clothPairs', 'bodyFaces', 'observedStateUnchanged')} for c in trace['checkpointSummary']],
    'referenceFinalSummary': audit['summary'],
    'replayFinalSummary': trace['completion'],
    'referenceResultEqualityRequired': False,
    'incidents': incidents,
    'limitations': [
        'Reference incidents come from the pinned historical Chromium result, not from the new replay if its final result differs.',
        'First observed stage is bounded by sampling and does not identify the first exact collision event.',
        'Seam proximity, shared topology, and stage association do not establish causal fault.',
        'Intersection-pair count is not the number of independent physical defects.',
        'Neither zero final intersections nor diagnosis completion certifies dynamic wear, calibrated textile behavior, or production readiness.',
    ],
}
(OUT / 'DIAGNOSIS.json').write_text(json.dumps(diagnosis, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': True, 'referenceIncidents': len(incidents), 'firstSampledGlobalContactCheckpoint': first_global,
                  'output': str(OUT / 'DIAGNOSIS.json')}, ensure_ascii=False))
