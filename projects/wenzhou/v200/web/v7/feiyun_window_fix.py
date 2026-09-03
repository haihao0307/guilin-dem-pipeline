"""Apply the real Feiyun mouth label and matching browser assertions.
The source window is anchored to source OSM way 55149756, not a hand-drawn river.
"""
from pathlib import Path

def apply(root, site):
    root,site=Path(root),Path(site)
    p=site/'index.html';s=p.read_text(encoding='utf-8')
    s=s.replace('data-window="feiyun">飞云江</button>','data-window="feiyun">飞云江口</button>')
    s=s.replace('飞云江窗口覆盖 1.6 × 1.6 km','飞云江口窗口覆盖 3.2 × 3.2 km')
    assert '飞云江口窗口覆盖 3.2 × 3.2 km' in s
    p.write_text(s,encoding='utf-8')
    p=root/'qa_v7.py';s=p.read_text(encoding='utf-8')
    s=s.replace("wait_window(page,'feiyun',129)","wait_window(page,'feiyun',257)")
    s=s.replace("q['geometryGrid']==[129,129]","q['geometryGrid']==[257,257]")
    assert "wait_window(page,'feiyun',257)" in s
    assert "q['geometryGrid']==[257,257]" in s
    p.write_text(s,encoding='utf-8')
