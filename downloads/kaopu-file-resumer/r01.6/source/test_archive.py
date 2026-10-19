"""Archive lifecycle, concurrency, persistence and privacy regression tests."""
import copy
import hashlib
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import core
import app
from test_core import Fixture, DATA

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.events = []
        self.e = core.Engine(self.root / 'data', self.events.append, allow_local=True)
        # Hold scheduler for deterministic state tests; integration explicitly restarts it.
        self.e.closed = True
        self.e.scheduler.join()
    def tearDown(self):
        self.e.close()
        self.tmp.cleanup()
    def task(self, status='queued', url='https://example.org/file.bin?secret=SIGNED_TOKEN'):
        with self.e.lock:
            tid = self.e.add_urls(url, self.root / 'files')[0]
            self.e.tasks[tid]['status'] = status
            return tid
    def wait(self, pred):
        end = time.monotonic() + 8
        while time.monotonic() < end:
            if pred(): return
            time.sleep(.02)
        self.fail('condition timed out')
    def test_stopped_lifecycle_multi_select_preserves_files_and_checkpoints(self):
        ids = []
        originals = {}
        for i, status in enumerate(('queued', 'paused', 'complete', 'attention', 'retry')):
            tid = self.task(status, f'https://example.org/{i}.bin')
            t = self.e.tasks[tid]
            t.update(offset=3,total=3,chunks=[{'start':0,'length':3,'sha256':hashlib.sha256(b'abc').hexdigest()}])
            path = Path(t['folder']) / (t['name'] if status == 'complete' else 'payload.part')
            path.write_bytes(b'abc')
            originals[tid] = (copy.deepcopy(t), path)
            ids.append(tid)
        self.assertEqual(self.e.archive_tasks(ids + ids + ['missing']), (ids, []))
        self.assertEqual(self.e.archive_tasks(ids), ([], []))
        for tid, (original, path) in originals.items():
            t = self.e.tasks[tid]
            self.assertEqual(path.read_bytes(), b'abc')
            for field in ('id','folder','offset','chunks','etag','url_sealed','source_hash'):
                self.assertEqual(t[field],original[field])
        self.assertEqual(self.e.restore_tasks(ids + ids), ids)
        for tid, (original, path) in originals.items():
            self.assertEqual(self.e.tasks[tid]['status'], 'complete' if original['status']=='complete' else 'paused')
            self.assertEqual(path.read_bytes(),b'abc')
        self.assertEqual(self.e.restore_tasks(ids), [])
    def test_active_worker_skipped_even_after_pause_or_complete(self):
        for i, status in enumerate(('downloading','checking','verifying','paused','complete')):
            tid = self.task(status,f'https://example.org/{i}')
            self.e.threads[tid] = MagicMock()
            self.assertEqual(self.e.archive_tasks([tid]), ([], [tid]))
            self.assertEqual(self.e.tasks[tid]['status'],status)
        self.e.threads.clear()
    def test_import_copy_is_busy(self):
        tid=self.task('paused');self.e.importing.add(tid)
        self.assertEqual(self.e.archive_tasks([tid]),([], [tid]))
    def test_archive_cannot_resume_or_update_or_duplicate(self):
        tid=self.task();self.e.archive_tasks([tid]);self.e.resume(tid);self.e.pause(tid)
        self.assertEqual(self.e.tasks[tid]['status'],'archived')
        with self.assertRaises(core.SafetyPause):self.e.update_url(tid,'https://example.org/file.bin?secret=NEW')
        self.assertEqual(self.e.add_urls('https://example.org/file.bin?secret=SIGNED_TOKEN',self.root),[])
    def test_restart_archived_never_runs_even_when_url_decrypts(self):
        tid=self.task();self.e.archive_tasks([tid]);self.e.tasks[tid]['url_sealed']='encrypted';self.e.save();self.e.close()
        with patch.object(core,'protect',return_value='https://example.org/file.bin?secret=SIGNED_TOKEN'):
            self.e=core.Engine(self.root/'data',self.events.append)
        time.sleep(.35)
        self.assertEqual(self.e.tasks[tid]['status'],'archived');self.assertFalse(self.e.threads)
        self.e.restore_tasks([tid]);time.sleep(.2)
        self.assertEqual(self.e.tasks[tid]['status'],'paused');self.assertFalse(self.e.threads)
    def test_queue_and_events_do_not_leak_signed_url(self):
        tid=self.task();self.e.archive_tasks([tid]);self.e.restore_tasks([tid])
        self.assertNotIn('SIGNED_TOKEN',self.e.state.read_text())
        self.assertNotIn('SIGNED_TOKEN',json.dumps(self.events))
    def test_save_failure_rolls_back_archive_and_restore(self):
        tid=self.task('paused')
        with patch.object(self.e,'save',side_effect=OSError('disk full')):
            with self.assertRaises(OSError):self.e.archive_tasks([tid])
        self.assertEqual(self.e.tasks[tid]['status'],'paused')
        self.e.archive_tasks([tid])
        with patch.object(self.e,'save',side_effect=OSError('disk full')):
            with self.assertRaises(OSError):self.e.restore_tasks([tid])
        self.assertEqual(self.e.tasks[tid]['status'],'archived')
    def test_migration_keeps_exact_old_queue_backup(self):
        tid=self.task('paused');self.e.save();self.e.close()
        data=json.loads(self.e.state.read_text());data['version']=1
        raw=json.dumps(data).encode();self.e.state.write_bytes(raw)
        self.e=core.Engine(self.root/'data');self.e.save()
        backups=list((self.root/'data').glob('queue.r01.3-backup-*.json'))
        self.assertEqual(len(backups),1);self.assertEqual(backups[0].read_bytes(),raw)
        self.assertEqual(json.loads(self.e.state.read_text())['version'],2)
        self.assertEqual(self.e.tasks[tid]['status'],'paused')
    def test_partial_checkpoint_continues_from_saved_offset(self):
        fixture=Fixture()
        try:
            def callback(event):
                t=event.get('task',{})
                if t.get('offset') == core.CHUNK and t.get('status') == 'downloading':
                    self.e.pause(t['id'])
            self.e.callback=callback
            self.e.closed=False
            import threading
            self.e.scheduler=threading.Thread(target=self.e._schedule,daemon=True);self.e.scheduler.start()
            tid=self.e.add_urls(fixture.url('/partial.bin'),self.root/'files')[0]
            self.wait(lambda:self.e.tasks[tid]['offset']==core.CHUNK and tid not in self.e.threads)
            chunks=copy.deepcopy(self.e.tasks[tid]['chunks'])
            self.e.archive_tasks([tid]);self.e.restore_tasks([tid])
            self.assertEqual(self.e.tasks[tid]['chunks'],chunks)
            self.e.callback=self.events.append
            self.e.resume(tid)
            self.wait(lambda:self.e.tasks[tid]['status']=='complete')
            starts=[start for path,start,headers in fixture.calls]
            self.assertEqual(starts,[0,core.CHUNK,core.CHUNK*2])
            t=self.e.tasks[tid];self.assertEqual((Path(t['folder'])/t['name']).read_bytes(),DATA)
        finally:fixture.gate.set();self.e.close();fixture.close()

    def test_real_writer_pause_archive_restore_resume(self):
        fixture=Fixture()
        try:
            self.e.closed=False
            import threading
            self.e.scheduler=threading.Thread(target=self.e._schedule,daemon=True);self.e.scheduler.start()
            tid=self.e.add_urls(fixture.url('/hold.bin'),self.root/'files')[0]
            self.wait(lambda: bool(fixture.calls))
            self.assertEqual(self.e.archive_tasks([tid]),([],[tid]))
            self.assertEqual(self.e.tasks[tid]['status'],'downloading')
            self.e.pause(tid)
            self.assertEqual(self.e.archive_tasks([tid]),([],[tid]))
            fixture.gate.set();self.wait(lambda:tid not in self.e.threads)
            self.assertEqual(self.e.archive_tasks([tid]),([tid],[]))
            count=len(fixture.calls);time.sleep(.2);self.assertEqual(len(fixture.calls),count)
            self.e.restore_tasks([tid]);time.sleep(.2);self.assertEqual(len(fixture.calls),count)
            self.e.resume(tid);self.e.resume(tid)
            self.wait(lambda:self.e.tasks[tid]['status']=='complete')
            t=self.e.tasks[tid];self.assertEqual((Path(t['folder'])/t['name']).read_bytes(),DATA)
            self.assertEqual(fixture.peak,1)
        finally:fixture.gate.set();self.e.close();fixture.close()

class ArchiveUITests(unittest.TestCase):
    def test_multi_selection_applies_all_actions(self):
        ui=MagicMock();ui.tree.selection.return_value=('one','two')
        app.App.task_action(ui,'pause')
        self.assertEqual([c.args for c in ui.engine.pause.call_args_list],[('one',),('two',)])
    def test_archive_cancel_does_not_mutate(self):
        ui=MagicMock();ui.tree.selection.return_value=('one',)
        with patch.object(app.messagebox,'askyesno',return_value=False):app.App.archive_selected(ui)
        ui.engine.archive_tasks.assert_not_called()
    def test_archive_passes_whole_selection(self):
        ui=MagicMock();ui.tree.selection.return_value=('one','two');ui.engine.archive_tasks.return_value=(['one','two'],[])
        with patch.object(app.messagebox,'askyesno',return_value=True):app.App.archive_selected(ui)
        ui.engine.archive_tasks.assert_called_once_with(('one','two'))
    def test_archive_update_hides_row_not_payload(self):
        ui=MagicMock();ui.snapshots={'one':{'id':'one'}}
        app.App.update_task(ui,{'id':'one','status':'archived'})
        self.assertNotIn('one',ui.snapshots);ui.tree.delete.assert_called_once_with('one')
    def test_compact_has_archive_actions_and_extended_selection(self):
        source=Path(app.__file__).read_text()
        self.assertIn("selectmode='extended'",source)
        self.assertIn('移出选中任务（可恢复）',source)
        self.assertIn('已移出任务 / 恢复',source)

if __name__=='__main__':unittest.main()
