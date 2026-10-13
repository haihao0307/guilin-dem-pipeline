from pathlib import Path
import json,hashlib
import convert
P=Path(__file__).resolve().parent
names=json.loads((P.parent/'full/activity-r01/16_57-SOURCE.json').read_text())['names']
records=[]
for clip,label,kind,interval in [('16_15','walk','walk',(174,315,18)),('16_35','run/jog','run',(38,134,16))]:
    record=convert.convert(clip,label,kind,names);p=P/(clip+'-SOURCE.json');data=json.loads(p.read_text());a,b,overlap=interval
    data['cycle']={'startFrame':a,'endFrame':b,'tailBlendFrames':overlap,'periodSeconds':(b-a)/120,'method':'inspected same-side complete stride in stable source portion; recorded pre-start context used for overlap'}
    assert a>=overlap and b<len(data['points'])
    p.write_text(json.dumps(data,separators=(',',':')));record['cycle']=data['cycle'];records.append(record)
for clip in ['143_25','143_30']:
    p=P/(clip+'-SOURCE.json');data=json.loads(p.read_text());records.append({'clip':clip,'label':data['label'],'duration':(len(data['points'])-1)/data['fps'],'sourceAMC_SHA256':data['sourceAMC_SHA256'],'cycle':None})
report={'version':'MOTION-R02-sources/2','records':records,'sourceFiles':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (P/'source').glob('*.amc')},'notPromoted':{'143_32':'brisk walk cycle not selected as ordinary walking default','143_01':'fast run capture, preliminary phase window not selected as jogging default','143_02':'official label Run to Stop, not a weight-shift idle','143_03':'official label Start to Run, not a look-around idle'},'measuredFingers':False,'termsURL':'https://mocap.cs.cmu.edu/','sourceListURL':'http://mocap.cs.cmu.edu/search.php?subjectnumber=16','gestureListURL':'http://mocap.cs.cmu.edu/search.php?subjectnumber=143','credit':'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.','terms':'Allowed inclusion in interactive products, no direct resale of original or converted motion data. This workbench is not a motion-data sale.','limits':'CMU finger/thumb channels are unmeasured and ignored; hand/toe channels can be noisy. Captured body motion still requires native retargeting and visual/contact verification.'}
(P/'SOURCE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
