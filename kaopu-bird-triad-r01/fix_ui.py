"""UI-only correction to exact transfer build; instrument and score untouched."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parent
p=ROOT/'output/index.html';data=p.read_bytes()
assert hashlib.sha256(data).hexdigest()=='1f393abc88f005f328d76da214345061ab5f396b647b49065bf1c2d73cb6ad48'
s=data.decode()
replacements=[
 ('</option value="photo">','</option><option value="photo">'),
 ('<button id="importData">导入谱 / 项目</button>', '<button id="exportWorkbench" class="export-action">保存工作台 HTML</button><button id="importData">导入谱 / 项目</button>'),
 (" defs.forEach(d=>makeControl(d,$('controls')));poseDefs.forEach(d=>makeControl(d,$('poseControls')));", " $('controls').replaceChildren();$('poseControls').replaceChildren();defs.forEach(d=>makeControl(d,$('controls')));poseDefs.forEach(d=>makeControl(d,$('poseControls')));"),
 (" const wb=document.createElement('button');wb.className='full';wb.style.marginTop='8px';wb.textContent='保存当前工作台 HTML';wb.id='exportWorkbench';wb.onclick=()=>{if(!state.valid)return toast('当前谱未通过校验',true);exportWorkbench()};$('exportReport').after(wb);", " $('exportWorkbench').onclick=()=>{if(!state.valid)return toast('当前谱未通过校验',true);exportWorkbench()};")
]
for before,after in replacements:
    assert s.count(before)==1,(before,s.count(before))
    s=s.replace(before,after)
new=s.encode();assert hashlib.sha256(new).hexdigest()=='f8525a61b27f46f6fdbf2a779440d5488adb6c32b64f66f2f908265eb0c1cd3a'
p.write_bytes(new)
print('UI patch verified',hashlib.sha256(new).hexdigest())
