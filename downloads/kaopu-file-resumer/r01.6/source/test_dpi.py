"""Windows API selection tests use mocks; actual display remains untested."""
import unittest
import ctypes
from ctypes import wintypes
from unittest.mock import patch
from types import SimpleNamespace
import dpi_support

class Fn:
    def __init__(self,value):self.value=value;self.calls=[]
    def __call__(self,*args):self.calls.append(args);return self.value

class DpiTests(unittest.TestCase):
    def test_non_windows_no_winapi(self):
        with patch.object(dpi_support.os,'name','posix'):
            self.assertIn('non-Windows',dpi_support.enable_windows_dpi_awareness())
    def test_modern_api_selected(self):
        fn=Fn(1)
        with patch.object(dpi_support.os,'name','nt'),patch('ctypes.WinDLL',create=True,return_value=SimpleNamespace(SetProcessDpiAwarenessContext=fn)):
            self.assertEqual(dpi_support.enable_windows_dpi_awareness(),'Per-monitor DPI awareness v2')
            self.assertEqual(len(fn.calls),1)
    def test_existing_awareness_not_overwritten(self):
        fn=Fn(0)
        with patch.object(dpi_support.os,'name','nt'),patch('ctypes.WinDLL',create=True,return_value=SimpleNamespace(SetProcessDpiAwarenessContext=fn)) as dll,patch('ctypes.get_last_error',create=True,return_value=5):
            self.assertIn('already configured',dpi_support.enable_windows_dpi_awareness())
            self.assertEqual(dll.call_count,1)
    def test_older_windows_fallback(self):
        fn=Fn(0)
        with patch.object(dpi_support.os,'name','nt'),patch('ctypes.WinDLL',create=True,side_effect=[SimpleNamespace(),SimpleNamespace(SetProcessDpiAwareness=fn)]):
            self.assertEqual(dpi_support.enable_windows_dpi_awareness(),'Per-monitor DPI awareness')
            self.assertEqual(fn.calls,[(2,)])
if __name__=='__main__':unittest.main()
