"""Static release/package tests; not a substitute for Windows Script Host testing."""
import hashlib
from pathlib import Path
import struct
import unittest

ROOT=Path(__file__).resolve().parent
class ReleaseTests(unittest.TestCase):
    def test_shortcut_checks_all_files_before_creation(self):
        s=(ROOT/'create-shortcut.vbs').read_text()
        self.assertLess(s.index('For Each required'),s.index('shell.CreateShortcut'))
        for name in ('launch.vbs','app.py','core.py','bootstrap.pyw'):
            self.assertIn('"'+name+'"',s)
        self.assertIn('WScript.Quit 1',s)
    def test_launch_checks_all_files_before_python(self):
        s=(ROOT/'launch.vbs').read_text()
        self.assertLess(s.index('For Each required'),s.index('pythonw = ""'))
        self.assertIn('shell.Run(command, 1, True)',s)
    def test_guard_chinese_message_present(self):
        codes=','.join(str(ord(c)) for c in '请先全部解压，不能在ZIP里运行。')
        for file in ('launch.vbs','create-shortcut.vbs'):
            self.assertIn('Cn(Array('+codes+'))',(ROOT/file).read_text())
    def test_temp_path_can_be_confirmed(self):
        for file in ('launch.vbs','create-shortcut.vbs'):
            s=(ROOT/file).read_text()
            self.assertIn('vbYesNo + vbExclamation + vbDefaultButton2',s)
            self.assertIn('<> vbYes Then WScript.Quit 0',s)
    def test_versioned_icon_always_replaces_old_location(self):
        script=(ROOT/'create-shortcut.vbs').read_text()
        assignment='shortcut.IconLocation = fso.BuildPath(here, "assets\\KAOPU_CORA_restored_r01.ico") & ",0"'
        self.assertIn(assignment,script)
        self.assertLess(script.index(assignment),script.index('shortcut.Save'))
        self.assertNotIn('icon-location.txt',script)
        self.assertNotIn('"app.ico"',script)
    def test_brand_asset_check_precedes_shortcut_creation(self):
        script=(ROOT/'create-shortcut.vbs').read_text()
        check='If Not fso.FileExists(fso.BuildPath(here, "assets\\KAOPU_CORA_restored_r01.ico"))'
        self.assertLess(script.index(check),script.index('shell.CreateShortcut'))
    def test_runtime_version_and_path_visible(self):
        app=(ROOT/'app.py').read_text()
        self.assertIn("root.title('KAOPU File Resumer · r01.4')",app)
        self.assertIn('版本与启动位置',app)
        self.assertIn('程序目录：',app)
if __name__=='__main__':unittest.main()
