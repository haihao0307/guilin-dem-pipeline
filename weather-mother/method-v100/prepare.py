"""Scoped Weather Mother preparation. Does not edit canonical or frozen assets.
The mirror schema below is local, not the unavailable upstream companion schema.
"""
from pathlib import Path
import json,hashlib,os,zipfile
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
p=json.loads((R/'policy.json').read_text())
assert sha((R/'policy.json').read_bytes())=='80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3'
def write(n,v):
 (R/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def strict(v):
 if isinstance(v,dict):return {'type':'object','properties':{k:strict(a) for k,a in v.items()},'required':list(v),'additionalProperties':False}
 return {'const':v,'type':'boolean' if isinstance(v,bool) else 'array' if isinstance(v,list) else 'string'}
write('policy.schema.json',{'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:weather-mother:local-policy-mirror:1.0.0-local.1',**strict(p)})
props={'motherId':{'const':'Weather Mother'},'entityId':{'type':'string','minLength':1,'maxLength':64,'pattern':'^[a-zA-Z0-9_:-]+$'},'profileVersion':{'const':'wm-method-profile-0.1.0'},'generatorVersion':{'const':'clean-1.0.0-worker+wm-method-0.1.0'},'masterSeed':{'type':'integer','minimum':0,'maximum':4294967295},'humidity':{'type':'number','minimum':0,'maximum':1},'cloudSpeedMps':{'type':'number','minimum':0,'maximum':80},'windFromDegrees':{'type':'number','minimum':0,'maximum':360},'relaxationSeconds':{'type':'number','minimum':1,'maximum':120},'initialConcentration':{'type':'number','minimum':0,'maximum':1.2},'physicalTime':{'type':'number','minimum':0,'maximum':86400},'visualApproved':{'const':False},'productionApproved':{'const':False}}
write('profile.schema.json',{'$schema':'https://json-schema.org/draft/2020-12/schema','type':'object','properties':props,'required':list(props),'additionalProperties':False})
write('profile.json',{'motherId':'Weather Mother','entityId':'cloud-method-specimen-001','profileVersion':'wm-method-profile-0.1.0','generatorVersion':'clean-1.0.0-worker+wm-method-0.1.0','masterSeed':4217,'humidity':.7,'cloudSpeedMps':12,'windFromDegrees':270,'relaxationSeconds':12,'initialConcentration':.65,'physicalTime':0,'visualApproved':False,'productionApproved':False})
assert sha((R/'policy.schema.json').read_bytes())=='b6f2d496a12f48c58b26051907b67ae247d193db1d3aed31ea4ae3ec084efa6e'
assert sha((R/'profile.schema.json').read_bytes())=='5b91645690002570cd4107883243e7ca1c32f0c7e6ecdfdf027931557884db29'
Z=R.parent/'distributions/Weather_Mother_Clean_V1.0.0.zip'
assert Z.stat().st_size==37906 and sha(Z.read_bytes())=='596b963fef0cc2eafe7855178ae9f93c3e2aef2b78bdf98dd5e9e49c1a443bae'
with zipfile.ZipFile(Z) as z:
 assert z.testzip() is None
 manifest=json.loads(z.read('Weather_Mother_Clean_V1.0.0/MANIFEST.json'))
 for n,entry in manifest['files'].items():
  b=z.read('Weather_Mother_Clean_V1.0.0/'+n)
  assert len(b)==entry['bytes'] and sha(b)==entry['sha256']
  assert (R.parent/'clean-v1'/n).read_bytes()==b
write('DOMAIN_RULES.json',{
 'motherId':'Weather Mother','version':'wm-method-profile-0.1.0','scope':'minimal new Cu specimen, not a migration of the full frozen production workspace',
 'worldModel':{'shape':'retained procedural lobe generator; a new namespaced child only','structure':'3D scalar density and internal empty regions; no measured hydrometeor topology','material':'dimensionless cloud concentration with approximate optical scattering; liquid/ice microphysics absent','surface':'volume optical response; no false surface mesh claim','environment':'explicit humidity proxy and advection drivers','history':'initial state, ordered driver events, analytic integration and preserved explicit branches','presentation':'neutral inspection, studio and labelled diagnostics; existing environment workbench remains independent'},
 'fields':[
 {'quantity':'reference density rho0','unit':'dimensionless','coordinateSpace':'object space in km','spatialScale':'38 x 14 x 32 km bounds; 192 x 112 x 160 validation grid; cells about 198 x 125 x 200 m','temporalCorrelation':'static source for this child','bounds':[0,1],'source':'locked clean-v1/field-worker.js','uncertainty':'procedural graphic, not measured density'},
 {'quantity':'concentration C','unit':'dimensionless appearance proxy','coordinateSpace':'uniform child process state','spatialScale':'whole validation child','temporalCorrelation':'piecewise exponential relaxation','bounds':[0,1.2],'source':'state.js integrate; explicit humidity history','uncertainty':'unmeasured uncalibrated response, no thermodynamic interpretation'},
 {'quantity':'world offset','unit':'metre','coordinateSpace':'+X east, +Y up, -Z north','spatialScale':'whole child translation','temporalCorrelation':'piecewise constant driver integration','bounds':'cloudSpeedMps 0..80; physicalTime 0..86400','source':'state.js integrate; weather-from bearing','uncertainty':'translation operator only; no momentum or wind-field solver'},
 {'quantity':'optical depth tau','unit':'dimensionless','coordinateSpace':'camera ray through displaced object space','spatialScale':'144 view samples; coefficient 2.4 per km times the density proxy','temporalCorrelation':'derived from current C and reference field','bounds':[0,'nonnegative; integration early-terminates at low transmission'],'source':'view.glsl main uses densityAt from locked cloud.glsl','uncertainty':'appearance attenuation, not calibrated cloud-water extinction'}],
 'process':{'id':'illustrative-moisture-relaxation','version':'0.1.0','inputs':['humidity history','initialConcentration','relaxationSeconds','physicalTime'],'outputs':['concentration-scaled density','ray optical depth and attenuation'],'units':'concentration dimensionless; time s; extinction coefficient in reciprocal km','validScale':'whole cloud proxy in a bounded inspection scene','updateRule':'Cnext = target + (Cprev-target)*exp(-dt/tau); target=clamp((humidity-.25)/.75,0,1)','boundaryConditions':'prescribed environmental reservoir; scalar source is zero at protected volume borders','calibrationStatus':'illustrative_not_calibrated','conservationExemption':'No physical water mass is represented. The prescribed appearance source/sink exchanges with an unmodelled reservoir. No mass conservation claim is made.'},
 'sharedCauseLinks':['humidity -> C(t) -> rendered density','same C(t) -> optical-depth integral -> transmission'],
 'seedRules':{'newChild':'FNV-1a32-v1 on masterSeed/entityId/processId/version','legacyNoise':'fixed seed-271 cache retained; legacy full generator has not been migrated into per-lobe stable identity streams','existingChildrenRegenerated':False},
 'rendering':{'neutral':'fixed camera, identity white balance, exposure 1, fixed linear clamp plus sRGB; no auto exposure or beauty filter','studio':'three directional key/fill/rim lights, independent switch/direction/intensity/RGB controls; coarse self-shadow approximation','diagnostic':['optical depth','object z=0 density section','weighted ray depth'],'lightUnits':'relative radiance; no claimed lux, lumen, Kelvin or spectral calibration','conversion':'piecewise sRGB-to-linear and linear-to-sRGB v1','nativePixels':'explicitly shown separately from CSS display size','macroWorkerDimensionsUnchangedForFrozenWorkspace':True},
 'missing':['upstream Schema and validator byte provenance','full Clean V1 generator/mutation/export migration','stable per-process streams throughout legacy generator','temperature/pressure/ice/liquid source data and physical calibration','full fluid and cloud microphysics','all-family history replay','wide-world seam and cross-GPU evidence','calibrated photometric lights and Kelvin support','reference visual comparison and user approvals'],
 'crossMotherWrites':False,'frozenAssetWrites':False,'rawMethodologyCopiedIntoRepository':False,'visualApproved':False,'productionApproved':False})
# Template becomes an executable entry only in the testing tree. CI publishes it after checks.
(R/'index.html').write_bytes((R/'viewer.template.html').read_bytes())
source=os.environ.get('GITHUB_SHA','local-unpublished')
write('BUILD.json',{'motherId':'Weather Mother','runtimeVersion':'wm-method-0.1.0','sourceHead':source,'baselineReadHead':'e55ad93c9502f75ae1ca4724d6caad8753eb157a','policyVersion':'1.0.0','policySha256':sha((R/'policy.json').read_bytes()),'schemaSha256':sha((R/'policy.schema.json').read_bytes()),'validatorSha256':sha((R/'guard.js').read_bytes()),'pythonValidatorSha256':sha((R/'validate.py').read_bytes()),'originalMethodologySha256':None,'originalByteHashStatus':'attachment text fully available through file search; the named MD byte file was not mounted in this execution environment','sourceAttachmentId':'file_00000000582c81fdb6607d9f476e2de5','originalSchemaSha256':None,'originalValidatorSha256':None,'mirrorSchemaOrigin':'locally generated strict mirror of embedded JSON; not the original companion schema','corePolicyUnchanged':True,'protectedZIPsha256':sha(Z.read_bytes()),'wholeLineIntegrated':False,'visualApproved':False,'productionApproved':False})
print('PREPARED Weather Mother isolated candidate',source)
