from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  path=path.split('?')[0]
  if path.startswith('/kaopu-unified-human-workbench/'):return str(ROOT/'unified-human-20261006'/path.removeprefix('/kaopu-unified-human-workbench/'))
  if path=='/kaopu-face-workbench/assets/gnm_head_web.bin':return str(ROOT/'face-workbench-20261005/qa-assets/gnm_head_web.bin')
  if path.startswith('/kaopu-anny-workbench/'):return str(ROOT/'anny-workbench-20261006/kaopu-anny-workbench'/path.removeprefix('/kaopu-anny-workbench/'))
  return super().translate_path(path)
ThreadingHTTPServer(('127.0.0.1',8791),Handler).serve_forever()
