from pathlib import Path
import hashlib,json
root=Path('kaopu-unified-human-workbench/cinematic-r01')
expected={'CineSkin.mjs':'2699e705468ce89867c7ed0fd815b2ffcd5776c2c5c710554a719f01c0e8c2e3','CineRig.mjs':'e8a7df337fed50afda305fe30132cdbaec54a26058c6151f7bd2f28221fbd505','CineState.mjs':'c5320f6d8fbb7128a84221bb9e2a1275734e55effb5d18f41b678dbe5423381e','build.cjs':'678ec0fbca7dffaebc7a6fd0779cc658c7700ff9f8d5c2abbe3fcdfd92ad82ee','verify.cjs':'75a31db02efd449df4a62152c91e8589d65c2e2115c9664c065d5974d712a2da'}
if 'uCReceiverNormalBias' in (root/'CineSkin.mjs').read_text():
    print('Reviewed correction already installed; no source mutation.')
    raise SystemExit(0)
for name,want in expected.items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==want, 'Changed source preimage: '+name
out={}
def change(s,a,b,n=1):
    assert s.count(a)==n,(a,s.count(a));return s.replace(a,b)
s=(root/'CineSkin.mjs').read_text()
s=change(s,'varying vec3 vCWorld;','varying vec3 vCWorld,vCShadowNormal;',2)
s=change(s,'uniform float uCShadowEnable,uCShadowSoftness;','uniform float uCShadowEnable,uCShadowSoftness,uCReceiverNormalBias;')
s=change(s,'vec4 q=uCShadowMatrix*vec4(vCWorld,1.);vec3 p=q.xyz/q.w;', '''// Curved receivers: preserve geometry, offset only the shadow lookup.
 // Bounded outward normal tolerance is largest near grazing incidence.
 vec3 receiverNormal=normalize(vCShadowNormal);
 vec3 receiverLight=normalize(uCKeyPosition-vCWorld);
 float grazing=1.-abs(dot(receiverNormal,receiverLight));
 vec3 receiverWorld=vCWorld+receiverNormal*(uCReceiverNormalBias*grazing);
 vec4 q=uCShadowMatrix*vec4(receiverWorld,1.);vec3 p=q.xyz/q.w;''')
s=change(s,'vec4(vCWorld+towardLight*.0006,1.)','vec4(receiverWorld+towardLight*.0006,1.)')
s=change(s,'vCWorld=(modelMatrix*vec4(transformed,1.)).xyz;','vCWorld=(modelMatrix*vec4(transformed,1.)).xyz;vCShadowNormal=inverseTransformDirection(transformedNormal,viewMatrix);')
s=change(s,'const U={...rig.U,','const U={...rig.U,uCReceiverNormalBias:{value:0.001500},')
s=change(s,'ET20-dualGGX-shadow-bilinear-tent-v3','ET20-dualGGX-shadow-curved-receiver-v4');out['CineSkin.mjs']=s
s=(root/'CineRig.mjs').read_text().replace("version:'ET20-CINE-R01'","version:'ET20-CINE-R01.1'")
s=change(s,'0.6mm comparison tolerance; not area-light ray tracing','0.6mm light-direction tolerance plus <= 1.5mm grazing normal offset; not area-light ray tracing')
s=change(s,'size:1024,frames:','size:1024,normalLookupOffsetMaxMM:1.5,frames:');out['CineRig.mjs']=s
out['CineState.mjs']=(root/'CineState.mjs').read_text().replace("ET20-CINE-R01'","ET20-CINE-R01.1'")
s=(root/'build.cjs').read_text().replace("version:'ET20-CINE-R01'","version:'ET20-CINE-R01.1'").replace('ET20 影视布光与皮肤','ET20.1 影视布光与皮肤')
s=change(s,'PCF (36 reads, 0.6mm comparison tolerance)','PCF (36 reads, 0.6mm light-direction tolerance and <= 1.5mm grazing normal lookup offset)');out['build.cjs']=s
s=(root/'verify.cjs').read_text()
addition="""// Regression for the curved receiver defect: change comparison tolerance only.
await p.evaluate(()=>{cinematicLook.inspect(6);cinematicLook.solo('key');});
const normalBiasMM=await p.evaluate(()=>__IDENTITY_QA__.viewer().cineSkin.U.uCReceiverNormalBias.value*1000);assert.equal(normalBiasMM,1.5);
const correctedShadow=await fingerprint();await snap('recovery-shadow-normal');
await p.evaluate(()=>__IDENTITY_QA__.viewer().cineSkin.U.uCReceiverNormalBias.value=0);
const oldReceiverShadow=await fingerprint();await snap('recovery-shadow-zero');
await p.evaluate(()=>{__IDENTITY_QA__.viewer().cineSkin.U.uCReceiverNormalBias.value=.0015;cinematicLook.inspect(0);cinematicLook.solo('all');});
assert.notEqual(correctedShadow.hash,oldReceiverShadow.hash);assert(correctedShadow.blackFraction>0&&correctedShadow.blackFraction<.20);
test('bounded-curved-receiver-correction-preserves-real-shadow',{maximumNormalLookupOffsetMM:normalBiasMM,correctedShadow,oldReceiverShadow,geometryMoved:false,notPhysicalContactCertification:true});
"""
s=change(s,'const original=await p.evaluate',addition+'const original=await p.evaluate');out['verify.cjs']=s
for name,text in out.items(): (root/name).write_text(text)
print(json.dumps({'sourceFiles':list(out),'sourcePreimages':expected,'normalLookupOffsetMaxMM':1.5,'geometryMoved':False,'probeRun':38187086066,'probeArtifact':11719918136},indent=2))
