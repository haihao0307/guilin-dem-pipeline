#!/usr/bin/env python3
"""Verify the already-published immutable page; never rebuild or republish it."""
import datetime
import hashlib
import json
import os
from pathlib import Path

source = 'c5c99dd6e7fb2124435653843c618bc6a4e4c47b'
url = 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/clo-learning/r02-c5c99dd6e7fb/'
html_sha = '182b8d581cf027704c109daea30e2f988b124d90933b6c7133c89007cee2a8ac'
directory = Path('docs/handoffs/clo-learning-r02-20261022/verification')
results = Path('public-verification-results')
prior_path = directory / 'PUBLICATION_PROOF_INITIAL.json'
prior = json.loads(prior_path.read_text())
report_path = results / 'public-browser-smoke.json'
report = json.loads(report_path.read_text())
assert os.environ['CLO_EXPECTED_SOURCE_HEAD'] == source
assert prior['sourceHead'] == source and prior['fixedURL'] == url
assert prior['files']['index.html'] == {'bytes': 15919775, 'sha256': html_sha}
assert all(prior.get(k) is True for k in ('sourceModified', 'interactive3D', 'buildPassed', 'deployed', 'httpPassed', 'publicHttpsPassed', 'changedOnlyInsideNewSnapshot'))
assert prior['publicationCommit'] == '0185ddebd9742449e394cb42a9a3b6f8fea0bda4'
assert all(report.get(k) is True for k in ('passed', 'desktopPassed', 'mobileViewportPassed'))
assert report['mode'] == 'https' and report['target'] == url and report['evidence']['finalURL'] == url
assert report['sourceHead'] == source and report['expectedSourceHead'] == source
assert report['verifierSourceHead'] == os.environ['GITHUB_SHA']
assert len(report['checks']) >= 84 and all(c['passed'] for c in report['checks'])
assert report['evidence']['htmlByteReadback']['sha256'] == html_sha
assert report['evidence']['htmlByteReadback']['bytes'] == 15919775
assert report['standaloneCoreNetworkRequests'] == 0
assert report['contextLossObserved'] is False and not report['pageErrors'] and not report['consoleErrors']
assert len(report['packetAudit']['integrityReports']) == 2
assert all(r['passed'] for r in report['packetAudit']['integrityReports'])
proof = {
    'schema': 'kaopu.publication-proof/2',
    'taskId': 'CLO-LEARNING-PILOT-R02-20261022',
    'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceHead': source,
    'fixedURL': url,
    'publicationCommit': prior['publicationCommit'],
    'files': prior['files'],
    'sourceModified': True,
    'interactive3D': True,
    'staticImageSubstitute': False,
    'buildPassed': True,
    'deployed': True,
    'httpPassed': True,
    'publicHttpsPassed': True,
    'browserPassed': True,
    'shareAllowed': True,
    'visualAcceptance': False,
    'productionReady': False,
    'verificationOnly': True,
    'appRebuiltOrRepublishedDuringRecovery': False,
    'verifierSourceHead': os.environ['GITHUB_SHA'],
    'verificationRunURL': 'https://github.com/' + os.environ['GITHUB_REPOSITORY'] + '/actions/runs/' + os.environ['GITHUB_RUN_ID'],
    'initialBuildRunURL': 'https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39716223368',
    'historicalPublicFailure': 'Chromium DevTools evicted the large document response before body read; the original failed report and shareAllowed=false proof are retained unchanged.',
    'recovery': 'The independent verification copy fetches exact public bytes through APIRequestContext and preserves original browser navigation, all UI/physics/packet/network/viewport assertions.',
    'priorProofSHA256': hashlib.sha256(prior_path.read_bytes()).hexdigest(),
    'publicBrowserReportFile': report_path.name,
    'publicBrowserReportSHA256': hashlib.sha256(report_path.read_bytes()).hexdigest(),
    'publicChecksPassed': len(report['checks']),
    'limits': ['Functional CI and responsive viewport verification; separate screenshot review is recorded in the delivery handoff.', 'No user visual approval, calibrated material claim, dynamic wear certification, continuous collision certification or manufacturing acceptance.']
}
(results / 'FINAL_PUBLICATION_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print('VERIFIED_EXISTING_PUBLIC_PAGE ' + url)
