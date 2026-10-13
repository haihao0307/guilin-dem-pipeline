# Synthetic persistence/overlap tests only. No GPU/model verification is implied.
import unittest,tempfile,json,hashlib,subprocess,sys
from pathlib import Path
from PIL import Image
class AssemblyTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.dirs=[]
  for i in range(3):
   d=self.root/str(i);d.mkdir();self.dirs.append(d);x=58+i*60;y=60;w=64;h=94
   shared={'fixture':'synthetic-only'};p={'sourceSHA256':'fixture','executionSourceSHA256':'fixture','shared':shared,'testResolution':[320,213],'testShadowResolution':[16,16],'geometryQuery':{'executionOutputs':shared},'traceQuery':{'executionOutputs':shared}}
   tile={'index':i,'count':3,'halo':2,'core':{'x':x+2,'y':62,'w':60,'h':90},'assemblyCrop':{'x':60,'y':62,'w':180,'h':90}}
   receipt={'status':'rendered-for-architectural-review','tile':tile,'modelCommit':'synthetic-fixture-not-GPU','commit':'synthetic-fixture-not-GPU','attempt':1,'state':{'kowloonFunction':p}}
   bits=[n for yy in range(y+h-1,y-1,-1)for xx in range(x,x+w)for n in [xx,yy,xx+yy,1]]
   raw={'fullResolution':[320,213],'width':w,'height':h,'cropTopLeft':{'x':x,'y':y,'w':w,'h':h},'encoding':'RGBA32F bits, rows bottom to top','shadowReadback':{'width':16,'height':16,'bits':[0]*1024},'footprint':shared,'buffers':{k:list(bits)for k in ['trace','qSeed','extentSourceSeed','normalBaseDistance','normalValidity','albedoRoughness','response','finish']}}
   for name,obj in [('receipt.json',receipt),('readback.json',raw),('validation.json',{'unresolved':0,'allEightBuffersFinite':True})]:self.write(d/name,obj)
   image=Image.new('RGBA',(w,h));image.putdata([(xx%256,yy%256,(xx+yy)%256,255)for yy in range(y,y+h)for xx in range(x,x+w)]);image.save(d/'native-crop.png');image.crop((2,2,62,92)).save(d/'tile-core.png');self.checkpoint(d)
 def tearDown(self):self.temp.cleanup()
 def write(self,p,obj):p.write_text(json.dumps(obj))
 def checkpoint(self,d):self.write(d/'checkpoint.json',{'complete':True,'hashes':{n:hashlib.sha256((d/n).read_bytes()).hexdigest()for n in ['receipt.json','readback.json','validation.json','native-crop.png','tile-core.png']}})
 def run_assembly(self):return subprocess.run([sys.executable,str(Path(__file__).with_name('assemble-heritage-tiles.py')),str(self.root/'out'),*[str(d)for d in self.dirs]],capture_output=True)
 def test_exact_overlap_is_lossless(self):
  result=self.run_assembly();self.assertEqual(result.returncode,0,result.stderr.decode());proof=json.loads((self.root/'out/assembly-proof.json').read_text());self.assertEqual(proof['overlapRawChannelsCompared'],24064);self.assertEqual(proof['compositedPixelMismatches'],0);
  with Image.open(self.root/'out/heritageHall-native-assembled.png')as image:self.assertEqual(image.size,(180,90))
 def test_bit_mismatch_is_rejected(self):
  d=self.dirs[1];raw=json.loads((d/'readback.json').read_text());raw['buffers']['trace'][0]^=1;self.write(d/'readback.json',raw);self.checkpoint(d);self.assertNotEqual(self.run_assembly().returncode,0)
 def test_shadow_mismatch_is_rejected(self):
  d=self.dirs[1];raw=json.loads((d/'readback.json').read_text());raw['shadowReadback']['bits'][0]=1;self.write(d/'readback.json',raw);self.checkpoint(d);self.assertNotEqual(self.run_assembly().returncode,0)
 def test_corrupt_checkpoint_is_rejected(self):
  (self.dirs[0]/'readback.json').write_text('{}');self.assertNotEqual(self.run_assembly().returncode,0)
if __name__=='__main__':unittest.main()
