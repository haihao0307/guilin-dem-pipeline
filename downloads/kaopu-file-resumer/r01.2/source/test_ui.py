"""Pure responsive decisions, not an actual window-render test."""
import unittest
from app import layout_mode, human
class LayoutTests(unittest.TestCase):
    def test_tiny_window(self):self.assertEqual(layout_mode(360,260),'compact')
    def test_narrow_window(self):self.assertEqual(layout_mode(599,1000),'compact')
    def test_short_window(self):self.assertEqual(layout_mode(1000,519),'compact')
    def test_boundary(self):self.assertEqual(layout_mode(600,520),'normal')
    def test_regular_window(self):self.assertEqual(layout_mode(900,600),'normal')
    def test_actual_dpi_requirement(self):self.assertEqual(layout_mode(900,600,700),'compact')
    def test_actual_requirement_fits(self):self.assertEqual(layout_mode(900,750,700),'normal')
    def test_low_requirement_keeps_safe_floor(self):self.assertEqual(layout_mode(900,400,200),'compact')
    def test_sizes(self):self.assertEqual(human(1024),'1.0 KB')
if __name__=='__main__':unittest.main()
