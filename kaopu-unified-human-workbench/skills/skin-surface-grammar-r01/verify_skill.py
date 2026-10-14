"""Validate skill evidence/contract only. Does not render or certify skin realism."""
from __future__ import annotations
import argparse, hashlib, json, pathlib, platform, unittest

HERE=pathlib.Path(__file__).resolve().parent
AUDIT=None
class SkillChecks(unittest.TestCase):
    def test_frontmatter_and_existing_rule_handoff(self):
        text=(HERE/'SKILL.md').read_text()
        self.assertTrue(text.startswith('---\nname: kaopu-skin-surface-grammar'))
        self.assertIn('NSR-01',text);self.assertIn('EB1',text)
    def test_honest_example_status(self):
        p=json.loads((HERE/'SkinSurfaceSpec.example.json').read_text())
        self.assertEqual(p['schema'],'kaopu.skin-surface-spec/1')
        self.assertFalse(p['status']['generatorImplemented'])
        self.assertFalse(p['status']['rendererIntegrated'])
        self.assertFalse(p['status']['userVisualAccepted'])
    def test_no_fabricated_metric_values(self):
        p=json.loads((HERE/'SkinSurfaceSpec.example.json').read_text())
        self.assertIsNone(p['microstructure']['poreDensityPerMm2'])
        self.assertIsNone(p['microstructure']['poreDiameterDistributionMm'])
        self.assertIsNone(p['optics']['skinThicknessMm'])
        self.assertEqual(p['optics']['metalness'],0)
    def test_all_eight_sets_and_five_channels(self):
        r=json.loads((AUDIT/'reference-audit.json').read_text())
        expected={f'assets/textures/head/skin{s}{i}_{c}.jpg' for s in ('M','W') for i in range(1,5) for c in ('c','n','r','s','sss')}
        self.assertEqual({f['path'] for f in r['files']},expected)
        self.assertEqual(len(r['files']),40)
        self.assertEqual(sum(f['bytes'] for f in r['files']),105130269)
    def test_decoded_encoding_and_dimensions(self):
        r=json.loads((AUDIT/'reference-audit.json').read_text())
        for f in r['files']:
            self.assertEqual((f['width'],f['height'],f['actualEncoding']),(2048,2048,'JPEG'))
    def test_pinned_bundle_and_static_thickness_path(self):
        b=(AUDIT/'reference_bundle_for_read_only_audit.txt').read_bytes()
        sha=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        self.assertEqual(sha,'076a073a2dc579ba9d178447143503b17f6dcce2')
        s=b.decode();start=s.index('class lx extends');end=s.index('class ux extends',start)
        direct_sss=s[start:end]
        self.assertIn('thicknessColorNode',direct_sss)
        self.assertNotIn('thicknessNode',direct_sss)
        self.assertIn('get useTransmission(){return this.transmission>0||null!==this.transmissionNode}',s)
        self.assertIn('_transmission=0',s)
        self.assertNotIn('skinMaterial.transmission',s)
        self.assertIn('this.skinMaterial.thicknessNode=zp(eR["skin"+e+"_s"])',s)
    def test_no_foreign_asset_files_in_skill(self):
        forbidden={'.png','.jpg','.jpeg','.webp','.hdr','.glb','.gltf','.bin','.wasm'}
        self.assertFalse([p.name for p in HERE.iterdir() if p.suffix.lower() in forbidden])
    def test_continuous_sampling_not_fixed_distance_lod(self):
        p=json.loads((HERE/'SkinSurfaceSpec.example.json').read_text())
        self.assertFalse(p['compiler']['fixedDistanceLODBandsAllowed'])
        self.assertFalse(p['state']['actionCachingRequested'])
        self.assertFalse(p['provenance']['externalRuntimeAssetsAllowed'])

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--audit-dir',type=pathlib.Path,required=True);args=ap.parse_args();AUDIT=args.audit_dir
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SkillChecks))
    receipt={'schema':'kaopu.skin-skill-checks/1','testsRun':result.testsRun,'failures':len(result.failures),
      'errors':len(result.errors),'success':result.wasSuccessful(),'python':platform.python_version(),
      'scope':'Document, recipe and pinned source static checks only; no rendering or physiological calibration',
      'generatorImplemented':False,'rendererIntegrated':False,'userVisualAccepted':False,
      'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(HERE.iterdir()) if p.is_file() and p.name not in ('verification.json','reference-audit.json')}}
    (AUDIT/'verification.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)
