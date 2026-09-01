#!/usr/bin/env python3
"""Validate an incomplete-intake receipt. This is not the shared policy validator."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

FIELDS = {'format','version','status','date','motherId','repository','branch',
 'auditedSourceCommit','commonMethod','localAuthority','requiredPresentationModes',
 'presentationImplementation','runtimeEntryPoints','plannedIntegrationPositions',
 'evidenceStatus','claims','unresolvedItems','notes'}
MODES = ['neutral_inspection','studio_beauty','diagnostic']
REQUIRED_CLAIMS = {'sharedPolicyRuntimeIntegrated','oceanRendererImplemented',
 'buoyancySolverImplemented','collisionSolverImplemented','browserVerified',
 'publicDeploymentVerified','visualApproved','productionApproved'}

def check(value: object) -> dict:
    errors = []
    def require(ok, name):
        if not ok:
            errors.append(name)
    if not isinstance(value, dict):
        return {'receiptValid': False, 'errors': ['NOT_AN_OBJECT'], 'runtimeIntegrated': False}
    require(set(value) == FIELDS, 'UNKNOWN_OR_MISSING_RECEIPT_KEYS')
    require(value.get('format') == 'ocean-unified-method-intake' and
            value.get('version') == '0.1.0', 'UNSUPPORTED_RECEIPT')
    require(value.get('status') == 'RECEIVED_PARTIAL_SOURCE_BLOCKED', 'INVALID_STAGE_CLAIM')
    method = value.get('commonMethod', {})
    require(isinstance(method, dict), 'METHOD_NOT_OBJECT')
    if isinstance(method, dict):
        require(method.get('policyVersion') == '1.0.0' and
                method.get('policyState') == 'candidate_for_user_review', 'CORE_IDENTITY_CHANGED')
        for field in ('fullDocumentReadVerified','originalByteIdentityVerified',
                      'originalSchemaReceived','originalValidatorReceived',
                      'original28TestsRerun','substituteCoreCreated'):
            require(method.get(field) is False, 'UNSUPPORTED_SOURCE_CLAIM:' + field)
        for field in ('policySha256','schemaSha256','validatorSha256'):
            require(field in method and method[field] is None, 'ORIGINAL_HASH_NOT_AVAILABLE:' + field)
    authority = value.get('localAuthority', {})
    require(authority == {'coreOverrides': {}, 'corePolicyEdited': False,
                         'crossMotherWrites': False, 'frozenAssetWrites': False,
                         'truthWrites': False, 'writeScope': ['ocean-mother/']}, 'SCOPE_OR_CORE_OVERRIDE')
    require(value.get('requiredPresentationModes') == MODES, 'REQUIRED_MODES_CHANGED')
    require(value.get('presentationImplementation') == dict.fromkeys(MODES, 'not_implemented'),
            'UNSUPPORTED_PRESENTATION_CLAIM')
    require(value.get('runtimeEntryPoints') == [], 'UNSUPPORTED_RUNTIME_ENTRY')
    claims = value.get('claims', {})
    require(isinstance(claims,dict) and set(claims) == REQUIRED_CLAIMS and
            all(x is False for x in claims.values()), 'UNSUPPORTED_APPROVAL_OR_RUNTIME_CLAIM')
    planned = value.get('plannedIntegrationPositions', [])
    require(isinstance(planned,list) and len(planned) == 6 and all(
        isinstance(p,dict) and set(p) == {'path','purpose','status'} and
        p['status'] == 'not_implemented' and isinstance(p['path'],str) and
        not p['path'].startswith('/') and '..' not in p['path'].split('/')
        for p in planned), 'INVALID_PLANNED_POSITIONS')
    require(value.get('evidenceStatus') == {
        'source_identity':'upstream_verified','effective_parameters':'bridge_only',
        'seed_lineage':'pending','causal_outputs':'pending','time_history':'pending',
        'neutral_view':'missing','beauty_view':'missing','diagnostic_view':'missing',
        'browser_log':'not_run','build_identity':'source_commit_only'}, 'MISSTATED_EVIDENCE')
    require(isinstance(value.get('unresolvedItems'),list) and len(value['unresolvedItems']) >= 6,
            'BLOCKERS_MISSING')
    return {'receiptValid': not errors, 'errors': errors,
            'scope':'intake_metadata_only', 'runtimeIntegrated': False,
            'formalAdoptionStatus':'BLOCKED', 'sharedSchemaValidated': False,
            'browserVerified': False, 'releaseGateWired': False}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('receipt', nargs='?', type=Path,
        default=Path(__file__).resolve().parents[1]/'adoption/UNIFIED_METHOD_V1_INTAKE.json')
    args = parser.parse_args()
    try:
        report = check(json.loads(args.receipt.read_text('utf-8')))
    except (OSError,ValueError) as exc:
        report = {'receiptValid': False, 'errors': [type(exc).__name__], 'runtimeIntegrated': False}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0 if report['receiptValid'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
