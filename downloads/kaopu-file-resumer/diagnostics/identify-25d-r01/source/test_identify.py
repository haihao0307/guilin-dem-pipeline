import json,sqlite3,tempfile,unittest,io,contextlib
from unittest.mock import patch
from pathlib import Path
import check_chrome_downloads_25d as m

class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.p=Path(self.tmp.name)/'History'
  c=sqlite3.connect(self.p)
  c.executescript('CREATE TABLE downloads(id INTEGER,current_path TEXT,target_path TEXT,state INTEGER); CREATE TABLE downloads_url_chains(id INTEGER,url TEXT);')
  self.c=c
 def tearDown(self):self.c.close();self.tmp.cleanup()
 def row(self,target='',url=None):
  self.c.execute('INSERT INTO downloads VALUES (1,?,?,2)',(r'C:\Users\PrivateUser\Downloads\未确认367748.crdownload',target))
  if url:self.c.execute('INSERT INTO downloads_url_chains VALUES(1,?)',(url,))
  self.c.commit()
 def read(self):return m.inspect_history(self.p,'test')
 def test_exact_25d_record(self):
  self.row(r'G:\GAME\11-NW-25D.zip');before=self.p.read_bytes();files=set(self.p.parent.iterdir())
  r=self.read();t=r['matches'][0]
  self.assertEqual(t['recorded_mapping'],'11-NW-25D.zip');self.assertFalse(t['continuous_prefix_verified'])
  self.assertEqual(self.p.read_bytes(),before);self.assertEqual(set(self.p.parent.iterdir()),files)
 def test_url_name_without_query_leak(self):
  self.row(url='https://download.map.gov.hk/api/3d-zip/GLTF/11-NW-25D.zip?secret=PRIVATE_TOKEN')
  r=self.read();self.assertEqual(r['matches'][0]['recorded_mapping'],'11-NW-25D.zip')
  for secret in ('PRIVATE_TOKEN','PrivateUser','https://'):self.assertNotIn(secret,json.dumps(r))
 def test_partial_alone_is_unknown(self):
  self.row();t=self.read()['matches'][0];self.assertIsNone(t['recorded_mapping']);self.assertEqual(t['mapping_status'],'unknown')
 def test_conflicting_names_not_guessed(self):
  self.row('11-NW-25C.zip','https://example.org/11-NW-25D.zip');t=self.read()['matches'][0]
  self.assertIsNone(t['recorded_mapping']);self.assertEqual(t['mapping_status'],'conflicting_filenames_do_not_guess')
 def test_25c_not_confused_with_25d(self):
  self.row('11-NW-25C.zip');self.assertEqual(self.read()['matches'][0]['recorded_mapping'],'11-NW-25C.zip')
 def test_target_only_without_current_path_remains_unknown(self):
  self.c.execute("INSERT INTO downloads VALUES(1,NULL,'11-NW-25D.zip',2)");self.c.commit()
  t=self.read()['matches'][0];self.assertIsNone(t['recorded_mapping']);self.assertEqual(t['mapping_status'],'unknown')
 def test_missing_current_path_column_remains_unknown(self):
  self.c.execute('DROP TABLE downloads');self.c.execute('CREATE TABLE downloads(id INTEGER,target_path TEXT)')
  self.c.execute("INSERT INTO downloads VALUES(1,'11-NW-25D.zip')");self.c.commit()
  t=self.read()['matches'][0];self.assertIsNone(t['recorded_mapping']);self.assertIn('current_path',t['missing_fields'])
 def test_unrelated_record_excluded(self):
  self.c.execute("INSERT INTO downloads VALUES(2,'unrelated','PRIVATE_FILE',1)");self.c.commit()
  self.assertEqual(self.read()['matches'],[])
 def test_main_writes_only_timestamped_curated_log(self):
  self.row('11-NW-25D.zip','https://example.org/11-NW-25D.zip?SECRET_TOKEN')
  local=Path(self.tmp.name)/'Local';profile=local/'Google'/'Chrome'/'User Data'/'Default';profile.mkdir(parents=True)
  db=profile/'History';db.write_bytes(self.p.read_bytes());before=db.read_bytes()
  script=Path(self.tmp.name)/'check.py'
  with patch.dict(m.os.environ,{'LOCALAPPDATA':str(local)}),patch.object(m,'__file__',str(script)),contextlib.redirect_stdout(io.StringIO()):m.main()
  logs=list(Path(self.tmp.name).glob('download-diagnostic-25d-*.txt'));self.assertEqual(len(logs),1)
  self.assertIn('11-NW-25D.zip',logs[0].read_text());self.assertNotIn('SECRET_TOKEN',logs[0].read_text())
  self.assertEqual(db.read_bytes(),before);self.assertEqual(set(p.name for p in profile.iterdir()),{'History'})
 def test_wal_stops(self):
  self.row();Path(str(self.p)+'-wal').touch();before=self.p.read_bytes()
  self.assertEqual(self.read()['status'],'stopped_wal_sidecar_present');self.assertEqual(self.p.read_bytes(),before)
 def test_exclusive_lock_stops(self):
  self.row();self.c.execute('BEGIN EXCLUSIVE')
  self.assertEqual(self.read()['status'],'stopped_database_busy');self.c.rollback()

if __name__=='__main__':unittest.main()
