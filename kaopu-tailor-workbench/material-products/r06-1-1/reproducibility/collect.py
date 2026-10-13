from pathlib import Path
import json,hashlib,shutil,gzip,sys,struct
root=Path(sys.argv[1]);e=Path(sys.argv[2]);out=root/'runtime'/'solved';out.mkdir(parents=True,exist_ok=True);proof=root/'runtime'/'validation';proof.mkdir(exist_ok=True)
index={'schema':'kaopu/r05-source-cloth-index@1','characterCommit':'9b6644b3210e5ee5f9b4e7fbb583dec98e90b285','motionCommit':'773f717b38ff5adf776c99fc30f06c113b4727a6','clips':[],'boots':[],'failures':[],'oldPhysicalFramesUsed':False};seen=set();seen_boot=set()
for p in sorted(e.rglob('REPORT.json')):
 r=json.loads(p.read_text());key=(r['look'],r['action']);assert key not in seen;seen.add(key);label=r['look']+'-'+r['action'].replace(':','-');shutil.copyfile(p,proof/(label+'.json'))
 if r.get('boot') and r['look'] not in seen_boot:
  boot=r['boot'];b=(p.parent/boot['file']).read_bytes();assert hashlib.sha256(b).hexdigest()==boot['sha256'];d=json.loads(gzip.decompress(b));assert d['schema']=='R05-native-original-boot/1' and d['actorHash']==r['actorHash'];assert d['proof']['bodyMinimumSampleMM']>=-.1;assert d['proof']['pairMinimumSampleMM'] is None or d['proof']['pairMinimumSampleMM']>=d['proof']['pairTargetMM']-.1
  (out/boot['file']).write_bytes(b);index['boots'].append({'look':r['look'],'actorHash':r['actorHash'],**boot});seen_boot.add(r['look'])
 if r['passed']:
  b=(p.parent/r['file']).read_bytes();assert hashlib.sha256(b).hexdigest()==r['sha256'];raw=gzip.decompress(b);n=struct.unpack('<I',raw[4:8])[0];h=json.loads(raw[8:8+n]);assert h['sourceProtocol']=='R05-native-original-motion/2' and h['proof']['passed'] and h['proof']['bodyActorHash']==r['actorHash'];assert h['motion']==r['action'];assert h['maxQuantisationErrorMM']<=.025
  (out/r['file']).write_bytes(b);index['clips'].append({k:r[k] for k in ['look','action','actorHash','key','file','bytes','sha256','duration','maxQuantisationErrorMM']})
 else:index['failures'].append({'look':r['look'],'action':r['action'],'completedSourceFrames':r['frames'],'reasons':r['errors']})
assert len(seen)==36,f'Missing physical reports: {len(seen)}/36'
assert {'K04','L04','D01'}<=seen_boot,'Missing validated neutral garment state'
(out/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2));(proof/'SUMMARY.json').write_text(json.dumps({'attempted':36,'passed':len(index['clips']),'failed':len(index['failures']),'allSourceMotionBodiesVerified':22,'allClothCombinationsPassed':len(index['clips'])==36,'physicsFramesEvaluated':len(index['clips'])>0},ensure_ascii=False,indent=2));print('SOURCE CLOTH INDEX',len(index['clips']),'passed;',len(index['failures']),'failed;',len(index['boots']),'neutral looks')
