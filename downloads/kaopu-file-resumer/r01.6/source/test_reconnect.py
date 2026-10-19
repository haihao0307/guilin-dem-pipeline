"""Strict TLS recovery and persisted retry policy. TLS CA is test-only."""
import json
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
import core
from app import retry_countdown
from test_core import Fixture, DATA

class RetryPolicyTests(unittest.TestCase):
    def test_certificate_is_not_handshake_eof(self):
        self.assertEqual(core.transport_failure(ssl.SSLCertVerificationError(1,'secret URL')).kind,'tls_certificate')
        self.assertEqual(core.transport_failure(ssl.SSLEOFError(8,'secret URL')).kind,'tls_handshake')
        self.assertEqual(core.transport_failure(ssl.SSLError(1,'secret URL')).kind,'tls_handshake')
        self.assertEqual(core.transport_failure(TimeoutError('secret URL')).kind,'network')
    def test_backoff_is_bounded_without_busy_loop(self):
        self.assertEqual([core.retry_delay('tls_certificate',i) for i in range(1,8)],[60,120,240,480,600,600,600])
        self.assertEqual(core.retry_delay('network',1),2)
        self.assertEqual(core.retry_delay('network',9),600)
        self.assertEqual(core.retry_delay('network',9,1800),1800)
    def test_countdown_changes_and_never_goes_negative(self):
        t={'status':'retry','error_kind':'tls_certificate','retry_at':165}
        self.assertEqual(retry_countdown(t,100),'证书重检 01:05')
        self.assertEqual(retry_countdown(t,166),'证书重检 00:00')
        t['status']='paused';self.assertEqual(retry_countdown(t,100),'')

class ReconnectTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.events=[];self.e=core.Engine(self.root/'data',self.events.append,allow_local=True)
        self.fixture=Fixture()
    def tearDown(self):
        self.fixture.gate.set();self.e.close();self.fixture.close();self.tmp.cleanup()
    def wait(self,pred):
        deadline=time.monotonic()+8
        while time.monotonic()<deadline:
            if pred():return
            time.sleep(.02)
        self.fail('condition timed out')
    def retry_now(self,tid):
        self.wait(lambda:tid not in self.e.threads)
        with self.e.lock:self.e.tasks[tid]['retry_at']=0
    def test_real_certificate_failure_then_valid_strict_tls_recovers(self):
        cert=self.root/'cert.pem';key=self.root/'key.pem'
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],check=True,capture_output=True)
        server=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);server.load_cert_chain(cert,key)
        self.fixture.server.socket=server.wrap_socket(self.fixture.server.socket,server_side=True)
        url=self.fixture.url('/tls.bin').replace('http:','https:')+'?secret=DO_NOT_LOG'
        tid=self.e.add_urls(url,self.root/'out')[0]
        self.wait(lambda:self.e.tasks[tid]['status']=='retry')
        t=self.e.tasks[tid]
        self.assertEqual(t['error_kind'],'tls_certificate');self.assertEqual(t['offset'],0)
        self.assertGreater(t['retry_at'],time.time()+50)
        self.assertFalse(self.fixture.calls)
        self.assertNotIn('DO_NOT_LOG',json.dumps(self.events));self.assertNotIn('DO_NOT_LOG',self.e.state.read_text())
        # Only this test trusts its ephemeral CA. Production opener is unchanged.
        context=ssl.create_default_context(cafile=str(cert))
        self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED);self.assertTrue(context.check_hostname)
        real_builder=urllib.request.build_opener
        with patch.object(core.urllib.request,'build_opener',side_effect=lambda *handlers:real_builder(*handlers,urllib.request.HTTPSHandler(context=context))):
            self.retry_now(tid)
            self.wait(lambda:self.e.tasks[tid]['status']=='complete')
        self.assertEqual((Path(t['folder'])/t['name']).read_bytes(),DATA)
        self.assertEqual(t['error_kind'],'');self.assertEqual(self.fixture.peak,1)
    def test_wrapped_eof_retries_as_handshake_not_certificate(self):
        original=urllib.request.build_opener
        calls=[0]
        def builder(*args):
            calls[0]+=1
            if calls[0]==1:raise urllib.error.URLError(ssl.SSLEOFError(8,'https://private/?secret=LEAK'))
            return original(*args)
        with patch.object(core.urllib.request,'build_opener',side_effect=builder):
            tid=self.e.add_urls(self.fixture.url('/eof.bin'),self.root/'out')[0]
            self.wait(lambda:self.e.tasks[tid]['status']=='retry')
            self.assertEqual(self.e.tasks[tid]['error_kind'],'tls_handshake')
            self.assertNotIn('LEAK',json.dumps(self.events))
            self.retry_now(tid);self.wait(lambda:self.e.tasks[tid]['status']=='complete')
    def test_manual_pause_wins_over_inflight_certificate_exception(self):
        entered=threading.Event();release=threading.Event()
        def fail(*args):entered.set();release.wait(5);raise core.Transient('tls_certificate')
        with patch.object(self.e,'_fetch',side_effect=fail):
            tid=self.e.add_urls(self.fixture.url('/pause.bin'),self.root/'out')[0]
            self.assertTrue(entered.wait(3));self.e.pause(tid);release.set()
            self.wait(lambda:tid not in self.e.threads)
            self.assertEqual(self.e.tasks[tid]['status'],'paused');self.assertEqual(self.e.tasks[tid]['pause_reason'],'manual')
            self.assertEqual(self.e.tasks[tid]['retry_at'],0)
    def test_restart_retains_retry_deadline_and_reason(self):
        self.e.closed=True;self.e.scheduler.join()
        tid=self.e.add_urls(self.fixture.url('/restart.bin'),self.root/'out')[0]
        t=self.e.tasks[tid];deadline=time.time()+550
        t.update(status='retry',error_kind='tls_certificate',pause_reason='tls_certificate',retry_at=deadline,url_sealed='fixture')
        self.e.save();self.e.close()
        with patch.object(core,'protect',return_value=self.fixture.url('/restart.bin')):
            self.e=core.Engine(self.root/'data',allow_local=True)
        time.sleep(.2);t=self.e.tasks[tid]
        self.assertEqual(t['status'],'retry');self.assertEqual(t['retry_at'],deadline)
        self.assertEqual(t['pause_reason'],'tls_certificate');self.assertFalse(self.fixture.calls)
    def test_legacy_only_known_certificate_attention_becomes_retry(self):
        self.e.closed=True;self.e.scheduler.join()
        ids=[]
        cases=[('attention','TLS证书验证失败；没有绕过安全警告。','retry'),('attention','HTTP 403：需检查链接/登录/权限；不会自动点击验证。','attention'),('paused','TLS证书验证失败；没有绕过安全警告。','paused'),('archived','TLS证书验证失败；没有绕过安全警告。','archived'),('attention','ZIP完整CRC校验失败；保留文件，不自动重下。','attention')]
        for i,(status,message,expected) in enumerate(cases):
            tid=self.e.add_urls(self.fixture.url('/case'+str(i)),self.root/'out')[0]
            self.e.tasks[tid].update(status=status,message=message,url_sealed='fixture');ids.append(tid)
        self.e.save();self.e.close()
        with patch.object(core,'protect',return_value=self.fixture.url('/restored')):
            self.e=core.Engine(self.root/'data',allow_local=True)
        for tid,(_,_,expected) in zip(ids,cases):self.assertEqual(self.e.tasks[tid]['status'],expected)
        self.assertFalse(self.fixture.calls)
    def test_after_tls_retry_changed_etag_still_blocks_without_append(self):
        original=self.e._fetch;calls=[0]
        def fetch(*args):
            calls[0]+=1
            if calls[0]==2:raise core.Transient('tls_certificate')
            return original(*args)
        with patch.object(self.e,'_fetch',side_effect=fetch):
            tid=self.e.add_urls(self.fixture.url('/changed'),self.root/'out')[0]
            self.wait(lambda:self.e.tasks[tid]['status']=='retry')
            self.assertEqual(self.e.tasks[tid]['offset'],core.CHUNK)
            self.retry_now(tid);self.wait(lambda:self.e.tasks[tid]['status']=='attention')
            t=self.e.tasks[tid]
            self.assertEqual(t['pause_reason'],'source_identity')
            self.assertEqual(t['offset'],core.CHUNK)
            self.assertEqual((Path(t['folder'])/'payload.part').read_bytes(),DATA[:core.CHUNK])
            count=len(self.fixture.calls);time.sleep(.2);self.assertEqual(len(self.fixture.calls),count)
    def test_archive_cancels_automatic_certificate_rechecks(self):
        with patch.object(self.e,'_fetch',side_effect=core.Transient('tls_certificate')) as fetch:
            tid=self.e.add_urls(self.fixture.url('/archive'),self.root/'out')[0]
            self.wait(lambda:self.e.tasks[tid]['status']=='retry')
            self.wait(lambda:tid not in self.e.threads)
            self.e.archive_tasks([tid]);self.e.tasks[tid]['retry_at']=0
            time.sleep(.3);self.assertEqual(fetch.call_count,1)
            self.e.restore_tasks([tid]);time.sleep(.3);self.assertEqual(fetch.call_count,1)
            self.assertEqual(self.e.tasks[tid]['pause_reason'],'restored')

    def test_auth_and_integrity_remain_manual_attention(self):
        tid=self.e.add_urls(self.fixture.url('/forbidden'),self.root/'out')[0]
        self.wait(lambda:self.e.tasks[tid]['status']=='attention')
        self.assertEqual(self.e.tasks[tid]['pause_reason'],'authentication')
        self.assertEqual(self.e.tasks[tid]['retry_at'],0)
        count=len(self.fixture.calls);time.sleep(.3);self.assertEqual(len(self.fixture.calls),count)

if __name__=='__main__':unittest.main()
