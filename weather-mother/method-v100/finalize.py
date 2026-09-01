"""Assemble a machine-readable partial-adoption receipt. Never grant approval."""
from pathlib import Path
import hashlib,json,os,sys
R=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
build=json.loads((R/'BUILD.json').read_text())
reports={n:json.loads((R/n).read_text()) for n in ['POLICY_TESTS.json','RUNTIME_TESTS.json','BROWSER_TESTS.json']}
assert reports['POLICY_TESTS.json']['status']=='LOCAL_MIRROR_DOCUMENT_VALID'
assert reports['RUNTIME_TESTS.json']['status']=='PASS'
assert reports['BROWSER_TESTS.json']['status']=='PASS'
public=(R/'PUBLIC_TESTS.json').exists() and os.environ.get('FINALIZE_PUBLIC')=='1'
if public:
 reports['PUBLIC_TESTS.json']=json.loads((R/'PUBLIC_TESTS.json').read_text());assert reports['PUBLIC_TESTS.json']['status']=='PASS'
receipt={
 'motherId':'Weather Mother','repository':'haihao0307/guilin-dem-pipeline','branch':'gh-pages',
 'commit':build['sourceHead'],'commitRole':'candidate source build identity; generated-file deployment commit is separate',
 'deploymentCommit':os.environ.get('METHOD_DEPLOYMENT_SHA'),
 'runtimeVersion':'wm-method-0.1.0','policyVersion':'1.0.0','policyState':'candidate_for_user_review',
 'policySha256':sha(R/'policy.json'),'schemaSha256':sha(R/'policy.schema.json'),'validatorSha256':sha(R/'guard.js'),
 'pythonValidatorSha256':sha(R/'validate.py'),'profileSchemaSha256':sha(R/'profile.schema.json'),
 'schemaOrigin':'locally generated strict Draft 2020-12 mirror; original companion Schema was not supplied',
 'validatorOrigin':'local Python jsonschema mirror checker and locked-subset browser guard; not the original supplied-project validator',
 'originalMethodologySha256':build['originalMethodologySha256'],'originalMethodologyByteIdentityStatus':build['originalByteHashStatus'],
 'originalSchemaSha256':None,'originalValidatorSha256':None,'originalCompanionVerification':'MISSING',
 'receivedSource':'MOTHER_UNIFIED_EVOLUTION_METHOD_V1.0.0.md; all 17 sections and embedded JSON read from attached text',
 'commonCoreValuesChanged':False,'documentReceiptIsRuntimeIntegration':False,
 'status':'PARTIAL_RUNTIME_ADOPTION_PUBLICLY_VERIFIED' if public else 'PARTIAL_RUNTIME_ADOPTION_BROWSER_VERIFIED',
 'wholeWeatherLineIntegrated':False,'canonicalWorkspaceReplaced':False,
 'previewURL':'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/method-v100/',
 'runtimeEntryPoints':{
  'ruleLoad':'runtime.js: guard.boot before any generation; guard.js checks policy and schema bytes',
  'generate':'runtime.js: generate; state.js: History constructor',
  'parameterMutation':'runtime.js: mutate/setMode/setLight and state.js: History.mutate',
  'export':'runtime.js: exportState calls History.export and guard.check(export)',
  'productionAcceptance':'WeatherMethod.attemptProduction -> guard.check(release) blocks without approval/evidence',
  'candidatePublication':'dedicated weather-mother-method-v100 workflow verifies schemas, runtime, real browser and write scope before publishing preview only'},
 'minimalObject':{'entityId':'cloud-method-specimen-001','generator':'frozen Clean V1 density functions used for a new namespaced Cu child','environmentDriver':'humidity history','process':'exact piecewise analytic dimensionless relaxation, uncalibrated appearance proxy','sharedOutputs':['volume density scale','optical depth and transmitted light'],'physicalClaims':'no condensation thermodynamics or water-mass conservation claimed'},
 'tests':{n:{'status':d['status'],'count':len(d['checks']),'sha256':sha(R/n)} for n,d in reports.items()},
 'evidence':{
  'source_identity':'BUILD.json source file and ZIP identities; browser dataHashes',
  'effective_parameters':'strict profile.json and runtime export effectiveParametersSha256',
  'seed_lineage':'state.js namespaced derivation and RUNTIME_TESTS.json; same child regeneration browser bytes',
  'causal_outputs':'BROWSER_TESTS.json humidity-off density and optical-thickness pixel differences',
  'time_history':'RUNTIME_TESTS.json ordered replay, frame-rate and playback-rate equality',
  'neutral_view':'BROWSER_TESTS.json renderEvidence.neutral_inspection',
  'beauty_view':'BROWSER_TESTS.json renderEvidence.studio_beauty',
  'diagnostic_view':'BROWSER_TESTS.json renderEvidence.diagnostic',
  'browser_log':'BROWSER_TESTS.json desktop; PUBLIC_TESTS.json after public verification',
  'build_identity':'BUILD.json sourceHead, MANIFEST.json file identities and deploymentCommit in this receipt'},
 'evidenceLimit':'Rendered pixels are captured and compared in memory; only hashes, settings and numeric differences retained. No claim that numeric QA supplies human visual review.',
 'unresolvedItems':[
  'Original companion Schema, validator and source MD byte identity are unavailable in this runtime; their identities cannot be asserted.',
  'Full Clean V1 workspace generation, all parameter mutations and exports remain unchanged and have not been migrated to the new guard.',
  'This minimal closure covers one new Cu child, not all ten cloud genera and all weather cases.',
  'The inherited legacy generator still uses its existing internal sequential RNG and fixed noise cache; only new child/process identities are namespaced.',
  'Liquid-water/ice composition, temperature-pressure coupling, real microphysics, calibrated rates and physical conservation evidence remain absent.',
  'Full-world seams, multiple devices, user-GPU performance, high-resolution temporal stability and reference visual comparisons remain unverified.',
  'Studio lights use relative directional radiance and RGB; calibrated lux, Kelvin and spectral equivalence are unsupported.',
  'Independent user visual and production approval records for this exact build are absent.'
 ],
 'writeAllowlist':['weather-mother/method-v100/**','.github/workflows/weather-mother-method-v100.yml'],
 'protectedInputs':{'cleanZipSHA256':build['protectedZIPsha256'],'canonicalWeatherFilesChanged':False,'oceanMotherChanged':False,'landscapeOrTruthChanged':False,'originalAttachmentDeleted':False,'rawMethodologyStoredInRepository':False},
 'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False,'userHardwarePerformanceVerified':False
}
(R/'ADOPTION_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
runtime=['index.html','runtime.js','view.glsl','guard.js','state.js','policy.json','policy.schema.json','profile.json','profile.schema.json','BUILD.json']
manifest={'runtimeVersion':'wm-method-0.1.0','sourceHead':build['sourceHead'],'status':receipt['status'],'files':{n:{'bytes':(R/n).stat().st_size,'sha256':sha(R/n)} for n in runtime},'totalRuntimeBytes':sum((R/n).stat().st_size for n in runtime),'externalImages':0,'frozenSourceReferences':{'../clean-v1/cloud.glsl':'d0d28a6321d26cf83e2380dac032aee1741bdd87a58cda4883110dab642b0626','../clean-v1/field-worker.js':'8c4402977790dc2e9c6116f6f4ac8d75b88bda967183f2df077970663a44aa4e'},'wholeLineIntegrated':False,'visualApproved':False,'productionApproved':False}
(R/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(receipt['status'],{n:len(d['checks']) for n,d in reports.items()})
