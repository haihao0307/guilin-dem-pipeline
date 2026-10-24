from pathlib import Path
import shutil
p=Path(__file__).resolve().parent
d=p/'dist';d.mkdir(exist_ok=True)
html=(p/'ui/index.html').read_text().replace('src="../native.html"','src="./native.html"').replace('</body>','<script type="module" src="./app.mjs"></script>\n</body>')
(d/'index.html').write_text(html)
shutil.copy2(p/'ui/styles.css',d/'styles.css')
with (d/'styles.css').open('a') as f:f.write('''\n.study-switches{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:13px 20px;border-top:1px solid #2c3535;font-size:12px;color:#a6b8af}.study-switches label{display:flex;gap:7px;align-items:center;cursor:pointer}.study-switches input{accent-color:#b5d888}.study-switches span{margin-left:auto;color:#728e81}.data-inspector{grid-column:1/-1;border-top:1px solid #2c3535;padding:18px 0 0;margin-top:12px;color:#96ad9e;font-size:12px}.data-inspector summary{cursor:pointer}.data-inspector pre{white-space:pre-wrap;overflow:auto;max-height:380px;background:#0b1212;padding:16px;font-size:11px;line-height:1.7}#sourceCanvas{touch-action:none;cursor:grab}#sourceCanvas:active{cursor:grabbing}.metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important}.metrics dd{font-size:17px!important}@media(max-width:640px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.study-switches{padding:12px;gap:12px}.study-switches span{margin-left:0}}\n''')
for name in ['app.mjs','NativeRig.mjs']:shutil.copy2(p/name,d/name)
if (p/'motion-data').exists():shutil.copytree(p/'motion-data',d/'motion-data',dirs_exist_ok=True)
print('Built study page:',d/'index.html')
