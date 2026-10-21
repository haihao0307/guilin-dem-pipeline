"""Own QA orchestration only. Teacher is downloaded into temporary storage, never vendored."""
import hashlib,json,os,pathlib,re,shutil,subprocess,sys,tarfile,tempfile,time,urllib.request
OUT=pathlib.Path(os.environ.get('QA_LOG_DIR','elevator-qa-text'));OUT.mkdir(parents=True,exist_ok=True)
report={'teacher':'eventhorizon5/skyscraper v2.0.4','archiveSha256':'839c939959f0cdf737bf21711925c319b3a47b51739e8b06f3e937948cff0ccc','status':'preflight','runtimeVerified':False,'checks':{}}
def save(): (OUT/'result.json').write_text(json.dumps(report,indent=2))
def finish(status,reason,code=1):
 report.update(status=status,reason=reason);save();print(json.dumps(report,indent=2));sys.exit(code)
save()
missing=[x for x in ['Xvfb','xvfb-run','xauth'] if not shutil.which(x)]
report['existingDisplayTools']={x:shutil.which(x) for x in ['Xvfb','xvfb-run','xauth','glxinfo']}
if missing: finish('environment-blocked','Missing existing tools: '+','.join(missing))
url='https://github.com/eventhorizon5/skyscraper/releases/download/v2.0.4/skyscraper-2.0.4-linux-x64.tar.bz2'
with tempfile.TemporaryDirectory(prefix='teacher-study-',dir=os.environ.get('RUNNER_TEMP')) as temp:
 root=pathlib.Path(temp);archive=root/'teacher.tar.bz2'
 urllib.request.urlretrieve(url,archive)
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=report['archiveSha256']: finish('integrity-blocked','Official archive hash mismatch')
 with tarfile.open(archive) as tf:tf.extractall(root,filter='data')
 app=root/'skyscraper';env=os.environ.copy();env['LD_LIBRARY_PATH']=str(app/'lib')+':'+env.get('LD_LIBRARY_PATH','');env['LIBGL_ALWAYS_SOFTWARE']='1'
 check=subprocess.run(['ldd',str(app/'bin/skyscraper')],env=env,capture_output=True,text=True)
 (OUT/'dependencies.txt').write_text(check.stdout+check.stderr)
 if 'not found' in check.stdout+check.stderr:finish('environment-blocked','Official executable has unavailable shared libraries; no installation attempted')
 # Configuration edits affect only the ephemeral official package, never the delivery project.
 ini=app/'skyscraper.ini';s=ini.read_text()
 for key,val in {'Skyscraper.Frontend.DisableSound':'true','Skyscraper.Frontend.ShowConsole':'false','Skyscraper.SBS.Verbose':'true','Skyscraper.Frontend.Menu.Show':'false'}.items():
  s=re.sub(r'(?m)^'+re.escape(key)+r'\s*=.*$',key+' = '+val,s)
 ini.write_text(s)
 (app/'ogre.cfg').write_text('Render System=OpenGL Rendering Subsystem\n\n[OpenGL Rendering Subsystem]\nFull Screen=No\nVideo Mode=800 x 600\nVSync=No\nFSAA=0\n')
 # Exercise the real simulator through its documented action API, not a replacement CPU model.
 simple=(app/'buildings/Simple.bld').read_text()
 simple=re.sub(r'<Function runloop>.*?<EndFunction>','',simple,flags=re.S|re.I)
 actions={'QHall':'Floor 0:Call Panel 1, up','QCar':'Elevator 1:Car 1, 3','QClose':'Elevator 1:Car 1, close','QSensor':'Elevator 1:Car 1, sensor','QReset':'Elevator 1:Car 1, sensorreset','QReturn':'Elevator 1:Car 1, 0','QStop':'Elevator 1:Car 1, stop'}
 extra='\nSet qa_stage = 0\n'+''.join('AddAction '+k+', '+v+'\n' for k,v in actions.items())
 extra+='<Function runloop>\n'
 for i,(at,act) in enumerate([(3,'QHall'),(12,'QCar'),(13,'QSensor'),(15,'QClose'),(22,'QReset'),(23,'QClose'),(60,'QReturn'),(90,'QStop')]):
  extra+=f' if[%uptime% >= {at*1000} & %qa_stage% = {i}] Print QA_OBSERVE action={act} uptime=%uptime%\n'
  extra+=f' if[%uptime% >= {at*1000} & %qa_stage% = {i}] RunAction {act}\n'
  extra+=f' if[%uptime% >= {at*1000} & %qa_stage% = {i}] Set qa_stage = {i+1}\n'
 extra+='<EndFunction>\n'
 (app/'buildings/QA-Teacher-Temporary.bld').write_text(simple+extra)
 log=root/'execution.log'
 with log.open('w') as f:
  proc=subprocess.Popen(['xvfb-run','-a','-s','-screen 0 1280x800x24',str(app/'bin/skyscraper'),'-m','-c','-p','-v','QA-Teacher-Temporary.bld'],cwd=app,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  try:proc.wait(timeout=120)
  except subprocess.TimeoutExpired:
   import signal
   os.killpg(proc.pid,signal.SIGTERM)
   try:proc.wait(timeout=8)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
 report['exitCode']=proc.returncode
 text=log.read_text(errors='replace')
 # Only selected textual diagnostics leave temporary storage. Never upload screenshots, package, source, geometry or textures.
 for p in app.rglob('*.log'):
  if p.stat().st_size<8000000:text+='\nLOG '+p.name+'\n'+p.read_text(errors='replace')
 (OUT/'execution.txt').write_text(text[-400000:])
 report['actionsObserved']=re.findall(r'QA_OBSERVE action=(\w+)',text)
 report['checks']={'sceneRunloopObserved':bool(report['actionsObserved']),'dispatchLogObserved':bool(re.search(r'adding route|ProcessCallQueue.*dispatch',text,re.I)),'movementLogObserved':bool(re.search(r'moving to floor|starting elevator|moving elevator',text,re.I)),'levelingLogObserved':'leveling' in text.lower(),'doorLogObserved':bool(re.search(r'opening doors|closing doors',text,re.I))}
 report['runtimeVerified']=all(report['checks'].values())
 finish('observed-needs-review' if report['actionsObserved'] else 'runtime-blocked','Actions and native transition logs require human review; no safety claim from PID or exit code',0 if report['actionsObserved'] else 1)
