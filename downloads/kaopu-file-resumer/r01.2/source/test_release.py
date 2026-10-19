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
    def test_no_unconfirmed_brand_auto_loaded(self):
        app=(ROOT/'app.py').read_text()
        self.assertNotIn("with_name('app.ico')",app)
        self.assertNotIn('kaopu-original.png',app)
        self.assertIn('图标待提供',app)
    def test_personal_icon_sync_is_explicit(self):
        app=(ROOT/'app.py').read_text()
        script=(ROOT/'create-shortcut.vbs').read_text()
        self.assertIn('askopenfilename',app)
        self.assertIn('icon-location.txt',app)
        self.assertIn('icon-location.txt',script)
        self.assertIn('"ico"',script)
if __name__=='__main__':unittest.main()
