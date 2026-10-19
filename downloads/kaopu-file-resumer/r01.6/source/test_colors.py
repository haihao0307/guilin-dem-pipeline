"""Task identity colors and proportional brand layout; headless UI contracts."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
import app
import core

class ColorTests(unittest.TestCase):
    def test_first_64_markers_are_distinct(self):
        colors=[app.task_colors(i) for i in range(64)]
        self.assertEqual(len(set(accent for bg,accent in colors)),64)
        self.assertEqual(len(set(colors)),64)
    def test_color_is_deterministic_and_not_status_driven(self):
        for i in range(50):
            self.assertEqual(app.task_colors(i),app.task_colors(i))
        ui=app.App.__new__(app.App);ui.row_markers={};ui.marker_column_width=36
        tree=MagicMock();marker=MagicMock()
        with patch.object(app.tk,'PhotoImage',return_value=marker) as create:
            first=ui.task_visual(tree,{'color_index':4,'status':'downloading'})
            second=ui.task_visual(tree,{'color_index':4,'status':'paused'})
            third=ui.task_visual(tree,{'color_index':4,'status':'complete'})
        self.assertEqual(first,second);self.assertEqual(second,third)
        create.assert_called_once();marker.put.assert_called_once()
    def test_text_contrast_on_all_initial_backgrounds(self):
        def luminance(color):
            values=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            values=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in values]
            return sum(a*b for a,b in zip(values,(.2126,.7152,.0722)))
        for i in range(100):
            bg,_=app.task_colors(i)
            self.assertGreater((luminance(app.FG)+.05)/(luminance(bg)+.05),7)
    def test_brand_targets_scale_uniformly_for_dpi(self):
        for dpi,factor in ((96,1),(144,1.5),(192,2)):
            self.assertEqual(app.brand_target_pixels(dpi),round(56*factor))
            self.assertEqual(app.brand_target_pixels(dpi,True),round(40*factor))
        self.assertEqual(app.brand_target_pixels(72),56)
        self.assertEqual(app.brand_target_pixels(500),168)
    def test_compact_marker_and_status_are_independent(self):
        source=Path(app.__file__).read_text()
        self.assertIn("show='tree headings'",source)
        self.assertIn('image=marker, tags=(tag,)',source)
        self.assertIn('self.compact_brand_label.pack(side=',source)
        self.assertIn('self.compact_brand_label.pack_forget()',source)
        self.assertEqual(app.layout_mode(360,260),'compact')
        self.assertIn("('name', 'compact_progress')",source)
    def test_archive_uses_same_identity_visual(self):
        ui=app.App.__new__(app.App);ui.row_markers={};ui.marker_column_width=36
        with patch.object(app.tk,'PhotoImage',return_value=MagicMock()):
            normal=ui.task_visual(MagicMock(),{'color_index':7})
            archived=ui.task_visual(MagicMock(),{'color_index':7,'status':'archived'})
        self.assertEqual(normal,archived)

class ColorPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.e=core.Engine(self.root/'data');self.e.closed=True;self.e.scheduler.join()
    def tearDown(self):self.e.close();self.tmp.cleanup()
    def test_restart_restore_and_new_task_keep_allocations(self):
        ids=self.e.add_urls(' '.join(f'https://example.org/{i}' for i in range(12)),self.root/'files')
        for tid in ids:self.e.pause(tid)
        before={tid:self.e.tasks[tid]['color_index'] for tid in ids}
        self.assertEqual(list(before.values()),list(range(12)))
        self.e.archive_tasks(ids[::2]);self.e.restore_tasks(ids[::4]);self.e.close()
        self.e=core.Engine(self.root/'data');self.e.closed=True;self.e.scheduler.join()
        self.assertEqual(before,{tid:self.e.tasks[tid]['color_index'] for tid in ids})
        new=self.e.add_urls('https://example.org/new',self.root/'files')[0]
        self.assertEqual(self.e.tasks[new]['color_index'],12)
    def test_legacy_colors_migrate_once_and_survive_restart(self):
        ids=self.e.add_urls('https://example.org/a https://example.org/b',self.root/'files')
        self.e.close()
        data=json.loads(self.e.state.read_text())
        for t in data['tasks']:t.pop('color_index');t['status']='paused'
        self.e.state.write_text(json.dumps(data))
        self.e=core.Engine(self.root/'data');self.e.closed=True;self.e.scheduler.join()
        before=[self.e.tasks[tid]['color_index'] for tid in ids];self.e.close()
        self.e=core.Engine(self.root/'data')
        self.assertEqual(before,[self.e.tasks[tid]['color_index'] for tid in ids])
        self.assertEqual(before,[0,1])
    def test_invalid_or_duplicate_loaded_color_gets_unique_slot(self):
        ids=self.e.add_urls('https://example.org/a https://example.org/b https://example.org/c',self.root/'files')
        self.e.close();data=json.loads(self.e.state.read_text())
        for t,color in zip(data['tasks'],[4,4,'bad']):t.update(color_index=color,status='paused')
        self.e.state.write_text(json.dumps(data));self.e=core.Engine(self.root/'data')
        self.assertEqual([self.e.tasks[tid]['color_index'] for tid in ids],[4,5,6])

if __name__=='__main__':unittest.main()
