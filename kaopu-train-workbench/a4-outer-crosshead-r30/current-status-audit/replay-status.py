"""Replay saved points against current R30 compact exact-field inputs. No optimizer."""
from scalar_evaluator import *
from collections import Counter
rows=[];maxExpectedError=0.;maxNativeError=0.
casting={frozenset(p) for p in [('middle_topology/chest_wall','actuation/middle_cylinder_wall'),('middle_topology/common_casting_web','actuation/middle_cylinder_wall'),('middle_topology/chest_wall','middle_topology/common_casting_web')]}
def intended(pair):
 s=frozenset(pair)
 if s in casting:return 'intended_stationary_casting_union'
 for side,tag in [('left','L'),('right','R')]:
  for b in ['valve_chest/'+side+'_rear_valve_head_core','valve_chest/'+side+'_front_valve_head_core','stack_candidate/terminal_eye/'+tag]:
   if s==frozenset(['outside_joint/'+side+'_canonical_valve_spindle',b]):return 'intended_same_rigid_connection_union'
 for b in ['middle_topology/head_core_0','middle_topology/head_core_1','stack_candidate/terminal_eye/M']:
  if s==frozenset(['stack_candidate/spindle/M',b]):return 'intended_same_rigid_connection_union'
 return 'current_unexpected_negative_witness'
for i,r in enumerate(DATA['records']):
 frame={'parts':{id:DATA['matrixPool'][j] for id,j in r['frames'].items()}}
 native={id:transformed_scalar(id,np.array(r['xyz']),frame) for id in r['frames']}
 vals=[min(native[id] for id in group) for group in r['groups']]
 if 'expected' in r:maxExpectedError=max(maxExpectedError,max(abs(a-b) for a,b in zip(vals,r['expected'])))
 for id,x in r['nativeCandidateValues'].items():maxNativeError=max(maxNativeError,abs(native[id]-x))
 pair=[g[0] for g in r['groups']] if all(len(g)==1 for g in r['groups']) else None
 if max(vals)<-1e-8:classification=intended(pair or [])
 elif r['kind']=='nominal_contact':classification='nominal_boundary_contact_not_penetration'
 elif r['kind'].startswith('historical') or r['kind']=='profile_negative':classification='historical_negative_removed_at_this_point'
 else:classification='no_negative_witness_at_saved_point_not_clearance'
 assert classification==r['expectedCategory'],(i,classification,r['expectedCategory'],vals)
 rows.append({k:v for k,v in r.items() if k not in ['frames','nativeCandidateValues','expected']}|{'currentValues':vals,'classification':classification})
assert maxExpectedError<1e-11,maxExpectedError
assert maxNativeError<1e-11,maxNativeError
counts=Counter(r['classification'] for r in rows)
profile=[r for r in rows if r['kind']=='profile_negative'];profileCounts=Counter(r['classification'] for r in profile)
negative=[r for r in rows if r['classification'].startswith('intended') or r['classification']=='current_unexpected_negative_witness']
unique={tuple(g[0] for g in r['groups']) for r in negative}
summary={'currentMode':'candidate','beta':.126,'recordsReplayed':len(rows),'profileNegativeRecords':len(profile),'profileClassifications':dict(profileCounts),'allRecordClassifications':dict(counts),'uniqueCurrentNegativePairs':len(unique),'currentConfirmedUnexpectedNegativePairs':sorted({tuple(g[0] for g in r['groups']) for r in rows if r['classification']=='current_unexpected_negative_witness'}),'historicalMiddleFramePointsRemoved':sum(r['kind']=='historical_middle_frame' and r['classification']=='historical_negative_removed_at_this_point' for r in rows),'historicalOuterPointsRemoved':sum(r['kind']=='historical_removed' and r['classification']=='historical_negative_removed_at_this_point' for r in rows),'pointClassificationsMatchExpected':True,'maximumIndependentASTToCurrentNativeCandidateError':maxNativeError,'newSearchPerformed':False,'wholeMechanicalAcceptance':False,'noWitnessMeansClearance':False,'nextRequiredRepairPair':None,'conclusion':'No current unexpected collision is confirmed by the existing points replayed here. This is not whole mechanical acceptance. Historical failures may not be assigned to hidden/replaced bodies or changed installation modes.'}
# CI assertions deliberately scoped to these existing witness records.
assert len(rows)==750 and len(profile)==16
assert profileCounts=={'intended_stationary_casting_union':3,'intended_same_rigid_connection_union':9,'historical_negative_removed_at_this_point':4},profileCounts
assert not summary['currentConfirmedUnexpectedNegativePairs']
assert summary['historicalMiddleFramePointsRemoved']==10
assert summary['historicalOuterPointsRemoved']==584
assert len(unique)==12
assert counts['nominal_boundary_contact_not_penetration']==24
for r in rows:
 if r['kind']=='nominal_contact':assert max(abs(v) for v in r['currentValues'])<2e-12
assert counts['no_negative_witness_at_saved_point_not_clearance']==110
motion=DATA['motionEvidence'];assert motion['samples']==1441 and motion['sourceLocked']
assert max(x['maximumFullAffineInverseDifference'] for x in motion['relations'])<1e-12
assert motion['maximumStationaryTransformDrift']<1e-12
meta=json.load(open(Path(os.environ['CURRENT_AUDIT_OUTPUT'])/'CURRENT_SOURCE_AND_VISIBILITY.json'))
assert meta['baselineVisible']==519 and meta['candidateVisible']==662
summary.update({'passed':True,'currentUnexpectedWitnessCount':0,'globalCertificate':False,'unresolvedRelations':110,'unresolvedRelationsScope':'outer 02 current no-witness relation set only','profileUnresolvedSameVisibleRelations':223,'profileHistoricalSuppressedRelations':30,'relationSetsNotSummed':True,'historicalRegressionPointsEliminated':594,'sameTimeFullAffineSamples':1441,'maximumSameTimeFullAffineDifference':max(x['maximumFullAffineInverseDifference'] for x in motion['relations']),'sourceLockVerified':True,'historicalNegativeControlsPreservedExternally':True})
print(json.dumps(summary,indent=2))
