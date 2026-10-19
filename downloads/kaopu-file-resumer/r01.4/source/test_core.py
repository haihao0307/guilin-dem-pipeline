"""Offline integration tests. All network traffic is loopback; all files are temporary."""
import io
import json
import os
import re
import socket
import tempfile
import threading
import time
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import core

DATA = bytes(range(256)) * 9000

class Fixture:
    def __init__(self):
        self.calls = []
        self.lock = threading.Lock()
        self.active = 0
        self.peak = 0
        self.gate = threading.Event()
        self.bodies = {}
        owner = self
        class Handler(BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'
            def log_message(self, *args): pass
            def do_GET(self):
                path = self.path.split('?')[0]
                start, end = map(int, re.fullmatch(r'bytes=(\d+)-(\d+)', self.headers['Range']).groups())
                with owner.lock:
                    prior = sum(p == path and s == start for p,s,_ in owner.calls)
                    owner.calls.append((path, start, dict(self.headers)))
                    owner.active += 1
                    owner.peak = max(owner.peak, owner.active)
                try:
                    if path.startswith('/hold'):
                        owner.gate.wait(5)
                    data = owner.bodies.get(path, DATA)
                    end = min(end, len(data)-1)
                    body = data[start:end+1]
                    if path == '/forbidden':
                        self.send_response(403); self.send_header('Content-Length','0'); self.end_headers(); return
                    status = 200 if path == '/whole' and start else 206
                    if status == 200: body = data
                    self.send_response(status)
                    self.send_header('ETag', '"changed"' if path == '/changed' and start else '"stable"')
                    self.send_header('Content-Range', f'bytes {start + (1 if path == "/wrong" and start else 0)}-{end}/{len(data)}')
                    self.send_header('Content-Length', str(len(body)))
                    if path == '/encoded' and start: self.send_header('Content-Encoding','gzip')
                    self.end_headers()
                    if path == '/interrupt' and start == core.CHUNK and prior == 0:
                        self.wfile.write(body[:731]); self.wfile.flush()
                        self.close_connection = True
                        self.connection.shutdown(socket.SHUT_RDWR)
                        return
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError, OSError): pass
                finally:
                    with owner.lock: owner.active -= 1
        self.server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
    def url(self,path): return f'http://127.0.0.1:{self.server.server_port}{path}'
    def close(self):
        self.gate.set(); self.server.shutdown(); self.server.server_close(); self.thread.join()

class CoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.fixture = Fixture()
        self.engines = []
        self.engine = self.make_engine()
    def make_engine(self, callback=lambda e:None, root=None):
        e = core.Engine(root or self.root/'queue', callback, allow_local=True)
        self.engines.append(e)
        return e
    def tearDown(self):
        self.fixture.gate.set()
        for e in self.engines:
            if not e.closed: e.close()
        self.fixture.close()
        self.tmp.cleanup()
    def wait(self, pred, timeout=8):
        until = time.monotonic()+timeout
        while time.monotonic()<until:
            if pred(): return
            time.sleep(.02)
        self.fail('Timed out waiting for expected state: '+repr(self.engine.tasks))
    def add(self,path): return self.engine.add_urls(self.fixture.url(path),self.root/'files')[0]
    def terminal(self,tid):
        self.wait(lambda:self.engine.tasks[tid]['status'] in ('complete','attention','paused'))
        return self.engine.tasks[tid]
    def assert_complete(self,tid,expected=DATA):
        t = self.terminal(tid)
        self.assertEqual(t['status'],'complete', t['message'])
        self.assertEqual((Path(t['folder'])/t['name']).read_bytes(),expected)
        self.assertFalse((Path(t['folder'])/'payload.part').exists())
    def test_safe_206_exact_bytes(self):
        tid=self.add('/safe'); self.assert_complete(tid)
        calls=self.fixture.calls
        self.assertEqual([c[1] for c in calls],[0,core.CHUNK,2*core.CHUNK])
        self.assertEqual(calls[1][2].get('If-Range'),'"stable"')
        self.assertTrue(all(c[2].get('Accept-Encoding')=='identity' for c in calls))
    def test_interrupted_body_retries_checkpoint_without_duplicate_bytes(self):
        tid=self.add('/interrupt')
        self.wait(lambda:self.engine.tasks[tid]['status']=='retry')
        t=self.engine.tasks[tid]
        self.assertEqual(t['offset'],core.CHUNK)
        self.assertEqual((Path(t['folder'])/'payload.part').read_bytes(),DATA[:core.CHUNK])
        self.assert_complete(tid)
        self.assertEqual([c[1] for c in self.fixture.calls],[0,core.CHUNK,core.CHUNK,2*core.CHUNK])
    def refuse_after_prefix(self,path):
        tid=self.add(path); t=self.terminal(tid)
        self.assertEqual(t['status'],'attention')
        self.assertEqual(t['offset'],core.CHUNK)
        self.assertEqual((Path(t['folder'])/'payload.part').read_bytes(), DATA[:core.CHUNK])
        self.assertFalse((Path(t['folder'])/t['name']).exists())
    def test_changed_etag_preserves_prefix(self): self.refuse_after_prefix('/changed')
    def test_wrong_content_range_preserves_prefix(self): self.refuse_after_prefix('/wrong')
    def test_200_body_never_appended(self): self.refuse_after_prefix('/whole')
    def test_encoded_body_never_appended(self): self.refuse_after_prefix('/encoded')
    def test_403_only_blocks_its_task(self):
        bad=self.add('/forbidden'); good=self.add('/safe')
        self.assertEqual(self.terminal(bad)['status'],'attention')
        self.assert_complete(good)
        self.assertEqual(self.engine.tasks[bad]['offset'],0)
    def test_zip_crc_valid_and_corrupt(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_STORED) as z: z.writestr('payload.txt',b'CRC CHECK CONTENT')
        valid=out.getvalue(); broken=bytearray(valid); broken[valid.index(b'CRC CHECK CONTENT')]^=1
        self.fixture.bodies['/valid.zip']=valid; self.fixture.bodies['/broken.zip']=bytes(broken)
        tid=self.add('/valid.zip'); self.assert_complete(tid,valid)
        bad=self.add('/broken.zip'); t=self.terminal(bad)
        self.assertEqual(t['status'],'attention'); self.assertIn('CRC',t['message'])
        self.assertEqual((Path(t['folder'])/'payload.part').read_bytes(),broken)
    @unittest.skipIf(os.name=='nt','This assertion concerns unsupported-platform URL storage')
    def test_no_raw_url_secret_persisted_non_windows(self):
        with self.engine.lock:
            tid=self.add('/safe?token=TOP_SECRET_9174'); self.engine.pause(tid)
        raw=self.engine.state.read_text()
        self.assertNotIn('TOP_SECRET_9174',raw)
        self.assertNotIn(self.fixture.url('/safe?token='),raw)
        self.assertEqual(json.loads(raw)['tasks'][0]['url_sealed'],'')
    def test_restore_manual_paused_never_restarts_even_with_available_url(self):
        # Fake reversible sealing solely in test to exercise the Windows restore branch on Unix.
        with patch.object(core,'protect',side_effect=lambda value,decrypt=False:value):
            with self.engine.lock:
                tid=self.add('/safe'); self.engine.pause(tid)
            self.engine.close(); self.engine=self.make_engine()
            time.sleep(.35)
            self.assertEqual(self.engine.tasks[tid]['status'],'paused')
            self.assertEqual(self.fixture.calls,[])
            self.engine.resume(tid); self.assert_complete(tid)
    def test_restore_checkpoint_verifies_and_resumes(self):
        with patch.object(core,'protect',side_effect=lambda value,decrypt=False:value):
            tid=self.add('/interrupt')
            self.wait(lambda:self.engine.tasks[tid]['status']=='retry')
            self.engine.close(); self.engine=self.make_engine()
            self.assert_complete(tid)
            self.assertEqual([c[1] for c in self.fixture.calls].count(0),1)
    def test_default_concurrency_three(self):
        ids=[self.add('/hold'+str(i)) for i in range(5)]
        self.wait(lambda:self.fixture.active==3)
        time.sleep(.3)
        self.assertEqual(self.engine.concurrency,3)
        self.assertEqual(len(self.fixture.calls),3)
        self.fixture.gate.set()
        for tid in ids:self.assert_complete(tid)
        self.assertEqual(self.fixture.peak,3)
    def test_manual_pause_not_restarted_by_watchdog(self):
        self.engine.watchdog_seconds=.05
        tid=self.add('/interrupt')
        self.wait(lambda:self.engine.tasks[tid]['status']=='retry')
        self.engine.pause(tid); count=len(self.fixture.calls)
        time.sleep(2.3)
        self.assertEqual(self.engine.tasks[tid]['status'],'paused')
        self.assertEqual(len(self.fixture.calls),count)
    def test_modified_checkpoint_refuses_network_and_keeps_evidence(self):
        tid=self.add('/interrupt')
        self.wait(lambda:self.engine.tasks[tid]['status']=='retry')
        self.engine.pause(tid)
        self.wait(lambda:tid not in self.engine.threads)
        part=Path(self.engine.tasks[tid]['folder'])/'payload.part'
        changed=bytearray(part.read_bytes()); changed[17]^=1; part.write_bytes(changed)
        calls=len(self.fixture.calls)
        self.engine.resume(tid)
        self.assertEqual(self.terminal(tid)['status'],'attention')
        self.assertEqual(len(self.fixture.calls),calls)
        self.assertEqual(part.read_bytes(),changed)
    def test_update_url_allows_query_refresh_but_rejects_resource_change(self):
        with self.engine.lock:
            tid=self.add('/safe?token=old'); self.engine.pause(tid)
            with self.assertRaises(core.SafetyPause):
                self.engine.update_url(tid,self.fixture.url('/other?token=new'))
            self.assertEqual(self.engine.tasks[tid]['status'],'paused')
            self.engine.update_url(tid,self.fixture.url('/safe?token=new'))
        self.assert_complete(tid)
    def test_uncommitted_tail_trimmed_before_retry(self):
        tid=self.add('/interrupt')
        self.wait(lambda:self.engine.tasks[tid]['status']=='retry')
        self.engine.pause(tid)
        self.wait(lambda:tid not in self.engine.threads)
        part=Path(self.engine.tasks[tid]['folder'])/'payload.part'
        with part.open('ab') as f:f.write(b'uncommitted crash tail')
        self.engine.resume(tid); self.assert_complete(tid)
    def test_pause_at_last_commit_cannot_be_overwritten(self):
        fired=threading.Event()
        def callback(event):
            t=event.get('task',{})
            if t.get('offset')==len(DATA) and t.get('status')=='downloading' and not fired.is_set():
                fired.set(); self.engine.pause(t['id'])
        self.engine.callback=callback
        tid=self.add('/safe')
        self.wait(fired.is_set)
        self.wait(lambda:tid not in self.engine.threads)
        t=self.engine.tasks[tid]
        self.assertEqual(t['status'],'paused')
        self.assertFalse((Path(t['folder'])/t['name']).exists())

if __name__=='__main__': unittest.main(verbosity=2)
