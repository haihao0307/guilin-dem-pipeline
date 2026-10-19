"""Asset integrity and UI wiring, without pretending to render Windows."""
import hashlib,json,struct,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock,patch
import app
ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
class BrandTests(unittest.TestCase):
    def test_restored_source_exact(self):
        png=ASSETS/'KAOPU_CORA_restored_r01.png'
        self.assertEqual(hashlib.sha256(png.read_bytes()).hexdigest(),'8b185b8784e9a480d8da0b890c3cff77ced23c1e75e3eb325f71f2b7cc5e99ad')
    def test_transparent_rgba_metadata(self):
        data=(ASSETS/'KAOPU_CORA_restored_r01.png').read_bytes()
        self.assertEqual(struct.unpack('>II',data[16:24]),(1254,1254))
        self.assertEqual(data[25],6) # RGBA PNG color type
        meta=json.loads((ASSETS/'ICON-PROVENANCE.json').read_text())
        self.assertEqual(meta['alpha_extrema'],[0,255])
        self.assertIn('恢复重制',meta['provenance'])
        self.assertIn('不是找回',meta['provenance'])
    def test_header_png_size(self):
        data=(ASSETS/'KAOPU_CORA_restored_r01_32.png').read_bytes()
        self.assertEqual(struct.unpack('>II',data[16:24]),(32,32))
    def test_ico_frames(self):
        data=(ASSETS/'KAOPU_CORA_restored_r01.ico').read_bytes()
        self.assertEqual(struct.unpack('<HHH',data[:6]),(0,1,7))
        sizes=[]
        for i in range(7):
            w,h,c,r,p,b,n,o=struct.unpack('<BBBBHHII',data[6+16*i:22+16*i]);sizes.append((w or 256,h or 256))
            self.assertLessEqual(o+n,len(data))
        self.assertEqual(sizes,[(n,n) for n in (16,24,32,48,64,128,256)])
    def test_windows_title_and_header_use_bundled_brand(self):
        ui=SimpleNamespace(root=MagicMock(),brand_label=MagicMock(),brand_status=MagicMock())
        with patch.object(app,'os',SimpleNamespace(name='nt')),patch.object(app.tk,'PhotoImage',side_effect=['full_png','header_png']):
            app.App.load_brand_icon(ui)
        ui.root.iconbitmap.assert_called_once_with(str(ASSETS/'KAOPU_CORA_restored_r01.ico'))
        ui.root.iconphoto.assert_called_once_with(True,'full_png')
        ui.brand_label.configure.assert_called_once_with(image='header_png',text='')
    def test_preflight_before_download_engine(self):
        source=(ROOT/'app.py').read_text()
        self.assertLess(source.index("for name in ('KAOPU_CORA_restored_r01.ico'"),source.index('self.engine = Engine'))
if __name__=='__main__':unittest.main()
