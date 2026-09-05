from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
url='http://127.0.0.1:8765/'
print(url, flush=True)
try:webbrowser.open(url)
except Exception:pass
ThreadingHTTPServer(('127.0.0.1',8765),SimpleHTTPRequestHandler).serve_forever()
