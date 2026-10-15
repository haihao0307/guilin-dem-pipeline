from pathlib import Path
import subprocess,json,hashlib
P=Path(__file__).parent
kernel=(P/'kernel-original.cpp').read_text();gl=(P/'global-original.cpp').read_text();qn=(P/'joint-original.cpp').read_text();ex=(P/'extensions.cpp').read_text()
# Outside the original grid, distance to a verified enclosing body AABB is a safe positive lower bound.
# No sample or derivative inside the original grid changes.
old='if(f[0]<0||f[1]<0||f[2]<0||f[0]>=nx-1||f[1]>=ny-1||f[2]>=nz-1)return false;'
assert old in qn
qn=qn.replace(old,'if(f[0]<0||f[1]<0||f[2]<0||f[0]>=nx-1||f[1]>=ny-1||f[2]>=nz-1)return fit43::outside(p,value,n);')
qn=qn.replace('return finite(out)?out:1e100;','out+=fit43::energy(X,G);return finite(out)?out:1e100;')
combined=kernel+gl+ex+qn
(P/'combined.cpp').write_text(combined)
subprocess.run(['clang++','--target=wasm32','-O3','-ffp-contract=off','-nostdlib','-fno-exceptions','-fno-rtti','-Wl,--no-entry','-Wl,--export-all','-Wl,-z,stack-size=32768','-Wl,--initial-memory=131072','-o',str(P/'joint-r043.wasm'),str(P/'combined.cpp')],check=True)
print('KERNEL43',hashlib.sha256((P/'joint-r043.wasm').read_bytes()).hexdigest())
